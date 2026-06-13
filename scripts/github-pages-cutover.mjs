#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = new Set(process.argv.slice(2));
const confirmPublicRepo = args.has("--confirm-public-repo");
const triggerWorkflow = args.has("--trigger-workflow") || confirmPublicRepo;
const waitForWorkflow = args.has("--wait") || confirmPublicRepo;
const verifyUrl = args.has("--verify-url") || confirmPublicRepo;
const jsonOutput = args.has("--json");
const workflowFile = "pages.yml";
const demoUrl = "https://a392479619-blip.github.io/sui-paylink/pay/demo-ai-workflow";

const result = {
  generatedAt: new Date().toISOString(),
  dryRun: !confirmPublicRepo,
  demoUrl,
  steps: [],
};

main().catch((error) => {
  addStep("Unexpected error", "block", errorMessage(error));
  finish(1);
});

async function main() {
  const preflight = run("node", ["scripts/public-preflight.mjs", "--json"]);
  if (preflight.status !== 0) {
    addStep("Public preflight", "block", "public preflight failed; do not make the repository public");
    finish(1);
    return;
  }
  const preflightJson = safeJson(preflight.stdout);
  const preflightOk = preflightJson?.okToConsiderPublic === true;
  addStep(
    "Public preflight",
    preflightOk ? "ok" : "block",
    preflightOk ? "no high-confidence tracked/history secret findings" : "secret findings need review",
  );
  if (!preflightOk) {
    finish(1);
    return;
  }

  const repo = readRepo();
  if (!repo) {
    finish(1);
    return;
  }
  const defaultBranch = repo.defaultBranchRef?.name ?? currentBranch();
  addStep("Repository", "ok", `${repo.url} is ${String(repo.visibility).toLowerCase()}; default branch ${defaultBranch}`);

  if (repo.visibility !== "PUBLIC") {
    if (!confirmPublicRepo) {
      addStep(
        "Repository visibility change",
        "warn",
        "dry-run only; rerun with --confirm-public-repo to make the repo public before enabling GitHub Pages",
      );
      finish(0);
      return;
    }
    const edit = run("gh", ["repo", "edit", "--visibility", "public", "--accept-visibility-change-consequences"]);
    if (edit.status !== 0) {
      addStep("Repository visibility change", "block", edit.stderr.trim() || "gh repo edit failed");
      finish(1);
      return;
    }
    addStep("Repository visibility change", "ok", "repository is now public");
  } else {
    addStep("Repository visibility change", "ok", "repository is already public");
  }

  const pages = enablePages();
  if (!pages) {
    finish(1);
    return;
  }

  if (triggerWorkflow) {
    const workflow = run("gh", ["workflow", "run", workflowFile, "--ref", defaultBranch]);
    if (workflow.status !== 0) {
      addStep("Trigger Static Demo Pages workflow", "block", workflow.stderr.trim() || "gh workflow run failed");
      finish(1);
      return;
    }
    addStep("Trigger Static Demo Pages workflow", "ok", `${workflowFile} triggered on ${defaultBranch}`);
  }

  if (waitForWorkflow) {
    const latestRun = await waitForLatestWorkflowRun(defaultBranch);
    if (!latestRun) {
      finish(1);
      return;
    }
    const watch = run("gh", ["run", "watch", String(latestRun.databaseId), "--exit-status"], { maxBuffer: 20 * 1024 * 1024 });
    if (watch.status !== 0) {
      addStep("Static Demo Pages workflow", "block", watch.stdout.trim() || watch.stderr.trim() || "workflow failed");
      finish(1);
      return;
    }
    addStep("Static Demo Pages workflow", "ok", `completed successfully (#${latestRun.databaseId})`);
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

function enablePages() {
  const existing = run("gh", ["api", "repos/a392479619-blip/sui-paylink/pages"]);
  if (existing.status === 0) {
    const parsed = safeJson(existing.stdout);
    addStep("GitHub Pages", "ok", parsed?.html_url ? `already enabled: ${parsed.html_url}` : "already enabled");
    return true;
  }

  const create = run("gh", ["api", "-X", "POST", "repos/a392479619-blip/sui-paylink/pages", "-f", "build_type=workflow"]);
  if (create.status !== 0) {
    addStep("GitHub Pages", "block", create.stderr.trim() || "failed to enable Pages");
    return false;
  }
  addStep("GitHub Pages", "ok", "enabled with GitHub Actions source");
  return true;
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
      addStep("Find Static Demo Pages workflow", "block", runs.stderr.trim() || "gh run list failed");
      return null;
    }
    const parsed = safeJson(runs.stdout);
    const [latestRun] = Array.isArray(parsed) ? parsed : [];
    if (latestRun?.databaseId) {
      addStep("Find Static Demo Pages workflow", "ok", `watching run #${latestRun.databaseId}`);
      return latestRun;
    }
    await sleep(3000);
  }
  addStep("Find Static Demo Pages workflow", "block", "no workflow run found after trigger");
  return null;
}

async function waitForDemoUrl() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
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
  console.log("SuiPayLink GitHub Pages cutover");
  console.log(`Generated: ${result.generatedAt}`);
  console.log(`Mode: ${result.dryRun ? "dry-run" : "execute"}`);
  console.log(`Demo URL: ${result.demoUrl}`);
  console.log("");
  for (const step of result.steps) {
    console.log(`${labelFor(step.status)} ${step.name}: ${step.detail}`);
  }
  if (result.dryRun) {
    console.log("");
    console.log("To execute after founder approval:");
    console.log("npm run demo:pages-cutover -- --confirm-public-repo");
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
