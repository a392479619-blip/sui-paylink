#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = new Set(process.argv.slice(2));
const confirmDeploy = args.has("--confirm-cloudflare-deploy");
const skipLocalSmoke = args.has("--skip-local-smoke");
const triggerWorkflow = args.has("--trigger-workflow") || confirmDeploy;
const waitForWorkflow = args.has("--wait") || confirmDeploy;
const verifyUrl = args.has("--verify-url") || confirmDeploy;
const jsonOutput = args.has("--json");
const workflowFile = "cloudflare-pages.yml";
const demoUrl = "https://sui-paylink.pages.dev/pay/demo-ai-workflow";
const requiredSecrets = ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"];

const result = {
  generatedAt: new Date().toISOString(),
  dryRun: !confirmDeploy,
  demoUrl,
  steps: [],
};

main().catch((error) => {
  addStep("Unexpected error", "block", errorMessage(error));
  finish(1);
});

async function main() {
  const repo = readRepo();
  if (!repo) {
    finish(1);
    return;
  }
  const defaultBranch = repo.defaultBranchRef?.name ?? currentBranch();
  addStep("Repository", "ok", `${repo.url} is ${String(repo.visibility).toLowerCase()}; default branch ${defaultBranch}`);

  const workflowPath = resolve(rootDir, ".github/workflows", workflowFile);
  if (!existsSync(workflowPath)) {
    addStep("Cloudflare workflow", "block", `.github/workflows/${workflowFile} is missing`);
    finish(1);
    return;
  }
  addStep("Cloudflare workflow", "ok", `.github/workflows/${workflowFile}`);

  const missingSecrets = missingRequiredSecrets();
  if (missingSecrets.length > 0) {
    addStep("Cloudflare secrets", confirmDeploy ? "block" : "warn", `missing: ${missingSecrets.join(", ")}`);
    if (confirmDeploy) {
      finish(1);
      return;
    }
  } else {
    addStep("Cloudflare secrets", "ok", "required GitHub secrets are present");
  }

  if (!skipLocalSmoke) {
    const smoke = run("npm", ["run", "smoke:cloudflare-demo"], { maxBuffer: 20 * 1024 * 1024 });
    if (smoke.status !== 0) {
      addStep("Local Cloudflare static smoke", "block", smoke.stdout.trim() || smoke.stderr.trim() || "smoke failed");
      finish(1);
      return;
    }
    addStep("Local Cloudflare static smoke", "ok", "npm run smoke:cloudflare-demo passed");
  } else {
    addStep("Local Cloudflare static smoke", "warn", "skipped by --skip-local-smoke");
  }

  if (!confirmDeploy) {
    addStep(
      "Cloudflare deployment",
      "warn",
      "dry-run only; add GitHub secrets and rerun with --confirm-cloudflare-deploy to trigger deployment",
    );
    finish(0);
    return;
  }

  if (triggerWorkflow) {
    const workflow = run("gh", ["workflow", "run", workflowFile, "--ref", defaultBranch]);
    if (workflow.status !== 0) {
      addStep("Trigger Cloudflare Static Demo workflow", "block", workflow.stderr.trim() || "gh workflow run failed");
      finish(1);
      return;
    }
    addStep("Trigger Cloudflare Static Demo workflow", "ok", `${workflowFile} triggered on ${defaultBranch}`);
  }

  if (waitForWorkflow) {
    const latestRun = await waitForLatestWorkflowRun(defaultBranch);
    if (!latestRun) {
      finish(1);
      return;
    }
    const watch = run("gh", ["run", "watch", String(latestRun.databaseId), "--exit-status"], { maxBuffer: 20 * 1024 * 1024 });
    if (watch.status !== 0) {
      addStep("Cloudflare Static Demo workflow", "block", watch.stdout.trim() || watch.stderr.trim() || "workflow failed");
      finish(1);
      return;
    }
    addStep("Cloudflare Static Demo workflow", "ok", `completed successfully (#${latestRun.databaseId})`);
  }

  if (verifyUrl) {
    const ok = await waitForDemoUrl();
    if (!ok) {
      finish(1);
      return;
    }
  }

  finish(0);
}

function readRepo() {
  const repoResult = run("gh", ["repo", "view", "--json", "nameWithOwner,url,visibility,defaultBranchRef"]);
  if (repoResult.status !== 0) {
    addStep("Repository", "block", repoResult.stderr.trim() || "gh repo view failed");
    return null;
  }
  const repo = safeJson(repoResult.stdout);
  if (!repo?.nameWithOwner) {
    addStep("Repository", "block", "gh repo view returned invalid JSON");
    return null;
  }
  return repo;
}

function missingRequiredSecrets() {
  const list = run("gh", ["secret", "list", "--json", "name"]);
  if (list.status !== 0) {
    addStep("Read GitHub secrets", "warn", list.stderr.trim() || "gh secret list failed");
    return requiredSecrets;
  }
  const parsed = safeJson(list.stdout);
  const names = new Set((Array.isArray(parsed) ? parsed : []).map((secret) => secret.name));
  return requiredSecrets.filter((name) => !names.has(name));
}

async function waitForLatestWorkflowRun(defaultBranch) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const runs = run("gh", [
      "run",
      "list",
      "--workflow",
      workflowFile,
      "--branch",
      defaultBranch,
      "--limit",
      "1",
      "--json",
      "databaseId,status,conclusion,headSha,createdAt",
    ]);
    if (runs.status !== 0) {
      addStep("Find Cloudflare Static Demo workflow", "block", runs.stderr.trim() || "gh run list failed");
      return null;
    }
    const parsed = safeJson(runs.stdout);
    const [latestRun] = Array.isArray(parsed) ? parsed : [];
    if (latestRun?.databaseId) {
      addStep("Find Cloudflare Static Demo workflow", "ok", `watching run #${latestRun.databaseId}`);
      return latestRun;
    }
    await sleep(3000);
  }
  addStep("Find Cloudflare Static Demo workflow", "block", "no workflow run found after trigger");
  return null;
}

async function waitForDemoUrl() {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    try {
      const response = await fetch(demoUrl, { redirect: "follow" });
      const text = await response.text();
      if (response.ok && /SuiPayLink|root/.test(text)) {
        addStep("Demo URL", "ok", demoUrl);
        return true;
      }
      addStep("Demo URL attempt", "warn", `HTTP ${response.status}; waiting`);
    } catch (error) {
      addStep("Demo URL attempt", "warn", errorMessage(error));
    }
    await sleep(5000);
  }
  addStep("Demo URL", "block", `${demoUrl} did not become browser-verifiable in time`);
  return false;
}

function currentBranch() {
  const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  return branch.status === 0 ? branch.stdout.trim() : "main";
}

function run(command, commandArgs, options = {}) {
  return spawnSync(command, commandArgs, {
    cwd: rootDir,
    encoding: "utf8",
    maxBuffer: options.maxBuffer ?? 10 * 1024 * 1024,
  });
}

function addStep(name, status, detail) {
  result.steps.push({ name, status, detail });
}

function finish(exitCode) {
  result.ok = exitCode === 0 && result.steps.every((step) => step.status !== "block");
  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printHuman();
  }
  process.exitCode = result.ok ? 0 : exitCode || 1;
}

function printHuman() {
  console.log("SuiPayLink Cloudflare Pages cutover");
  console.log(`Generated: ${result.generatedAt}`);
  console.log(`Mode: ${result.dryRun ? "dry-run" : "execute"}`);
  console.log(`Demo URL: ${result.demoUrl}`);
  console.log("");
  for (const step of result.steps) {
    console.log(`${labelFor(step.status)} ${step.name}: ${step.detail}`);
  }
  if (result.dryRun) {
    console.log("");
    console.log("To execute after adding Cloudflare GitHub secrets:");
    console.log("npm run demo:cloudflare-cutover -- --confirm-cloudflare-deploy");
  }
}

function safeJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function labelFor(status) {
  return {
    ok: "[OK]",
    warn: "[WARN]",
    block: "[BLOCK]",
  }[status] ?? "[UNKNOWN]";
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
