#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = new Set(process.argv.slice(2));
const jsonOutput = args.has("--json");
const strict = args.has("--strict");
const withSponsor = args.has("--with-sponsor");

const checks = [];

checkFile("Testnet package evidence", "deployments/testnet.json", validatePackageEvidence);
checkFile("SUI release smoke", "deployments/testnet-smoke.json", validateDigestEvidence);
checkFile("Refund smoke", "deployments/testnet-refund-smoke.json", validateDigestEvidence);
checkFile("Two-party smoke", "deployments/testnet-two-party-smoke.json", validateDigestEvidence);
checkFile("MockUSDC smoke", "deployments/testnet-mock-usdc-smoke.json", validateDigestEvidence);
checkFile("Sponsored MockUSDC smoke", "deployments/testnet-sponsored-mock-usdc-smoke.json", validateSponsoredEvidence);

checkPackageScript("smoke:api");
checkPackageScript("smoke:preview");
checkPackageScript("smoke:static-demo");
checkPackageScript("smoke:cloudflare-demo");
checkPackageScript("typecheck");
checkPackageScript("build");
checkPackageScript("registration:audit");
checkPackageScript("founder:verify");
checkPackageScript("public:preflight");
checkPackageScript("demo:pages-cutover");
checkPackageScript("demo:cloudflare-cutover");

checkFile("Chinese PRD", "docs/11-prd-cn.md");
checkFile("Demo script", "docs/13-demo-script-cn.md");
checkFile("Submission checklist", "docs/14-submission-checklist-cn.md");
checkFile("Deployment runbook", "docs/15-deployment-runbook-cn.md");
checkFile("Registration pack", "docs/16-registration-pack-cn.md");
checkFile("Founder final verification checklist", "docs/17-founder-final-verification-cn.md");
checkFile("Registration copy sheet", "submission/registration-copy.md");
checkFile("Registration fields", "submission/registration-fields.json", validateRegistrationFields);
checkFile("External entry snapshot", "submission/external-entry-snapshot.md", validateExternalEntrySnapshot);
checkFile("GitHub Pages workflow", ".github/workflows/pages.yml");
checkFile("Cloudflare workflow", ".github/workflows/cloudflare-pages.yml");

addCheck({
  name: "Git working tree",
  status: gitStatusIsClean() ? "ok" : "warn",
  detail: gitStatusIsClean() ? "clean" : "has uncommitted changes",
  required: false,
});

addCheck(latestCiCheck());
addCheck(repositoryVisibilityCheck());
addCheck(staticPublicDemoCheck());
addCheck(realApiDeploymentCheck());
addCheck(browserWalletE2eCheck());

if (withSponsor) {
  addCheck(runSponsorReadiness());
} else {
  addCheck({
    name: "Sponsor readiness",
    status: "warn",
    detail: "not checked; run npm run submission:readiness -- --with-sponsor after funding the sponsor address",
    required: false,
  });
}

const requiredFailures = checks.filter((check) => check.required && check.status === "block");
const warnings = checks.filter((check) => check.status === "warn");
const blockers = checks.filter((check) => check.status === "block");
const competitiveGapNames = new Set([
  "Repository visibility",
  "Static public demo path",
  "Real API hosted demo",
  "Browser wallet sponsored E2E",
  "Sponsor readiness",
]);
const competitiveGaps = checks.filter((check) => competitiveGapNames.has(check.name) && check.status !== "ok");

const summary = {
  okForMinimumSubmission: requiredFailures.length === 0,
  okForCompetitiveDemo: requiredFailures.length === 0 && competitiveGaps.length === 0,
  generatedAt: new Date().toISOString(),
  totals: {
    ok: checks.filter((check) => check.status === "ok").length,
    warn: warnings.length,
    block: blockers.length,
  },
  competitiveGaps: competitiveGaps.map((check) => check.name),
  nextActions: nextActionsFor(checks),
  checks,
};

if (jsonOutput) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  printHuman(summary);
}

if (requiredFailures.length > 0 || (strict && blockers.length > 0)) {
  process.exitCode = 1;
}

function checkFile(name, relativePath, validator = () => ({ status: "ok", detail: "present" })) {
  const path = resolve(rootDir, relativePath);
  if (!existsSync(path)) {
    addCheck({
      name,
      status: "block",
      detail: `${relativePath} is missing`,
      required: true,
    });
    return;
  }
  try {
    const result = validator(readFileSync(path, "utf8"), relativePath);
    addCheck({
      name,
      status: result.status,
      detail: result.detail,
      required: result.required ?? true,
    });
  } catch (error) {
    addCheck({
      name,
      status: "block",
      detail: `${relativePath}: ${errorMessage(error)}`,
      required: true,
    });
  }
}

function validatePackageEvidence(raw) {
  const data = JSON.parse(raw);
  const missing = ["network", "packageId", "publishDigest", "mockUsdc"].filter((key) => !data[key]);
  return missing.length === 0
    ? { status: "ok", detail: `${data.network} package ${short(data.packageId)}` }
    : { status: "block", detail: `missing ${missing.join(", ")}` };
}

function validateDigestEvidence(raw, relativePath) {
  const data = JSON.parse(raw);
  const digests = flattenDigests(data.digests);
  return digests.length > 0
    ? { status: "ok", detail: `${relativePath} has ${digests.length} digest(s)` }
    : { status: "block", detail: `${relativePath} has no transaction digests` };
}

function validateSponsoredEvidence(raw) {
  const data = JSON.parse(raw);
  const digests = flattenDigests(data.digests);
  const zeroBuyer = data.initialBalances?.buyerSui === "0" && data.finalBalances?.buyerSui === "0";
  const zeroSeller = data.initialBalances?.sellerSui === "0" && data.finalBalances?.sellerSui === "0";
  const hasExecutedRecords = Object.values(data.sponsoredTransactions ?? {}).every(
    (record) => record && record.status === "executed" && record.digest,
  );
  if (digests.length === 0) {
    return { status: "block", detail: "sponsored smoke has no transaction digests" };
  }
  if (!zeroBuyer || !zeroSeller || !hasExecutedRecords) {
    return {
      status: "warn",
      detail: "sponsored evidence exists but zero-SUI or executed-record proof is incomplete",
      required: false,
    };
  }
  return {
    status: "ok",
    detail: `buyer/seller 0 SUI, ${digests.length} digest(s), sponsor paid gas`,
  };
}

function validateRegistrationFields(raw) {
  const data = JSON.parse(raw);
  const fields = Array.isArray(data.fields) ? data.fields : [];
  const suggestedAnswers = Array.isArray(data.suggestedAnswers) ? data.suggestedAnswers : [];
  const readyFields = fields.filter((field) => field.status === "ready" && String(field.value ?? "").trim());
  const holdFields = fields.filter((field) => field.status === "hold");
  const badHoldFields = holdFields.filter((field) => String(field.value ?? "").trim());
  const missingSuggestedAnswers = suggestedAnswers.filter((answer) => !String(answer.value ?? "").trim());
  if (readyFields.length < 8) {
    return { status: "block", detail: `only ${readyFields.length} ready registration fields` };
  }
  if (missingSuggestedAnswers.length > 0) {
    return {
      status: "warn",
      detail: `suggested answers missing values: ${missingSuggestedAnswers.map((answer) => answer.label).join(", ")}`,
      required: false,
    };
  }
  if (badHoldFields.length > 0) {
    return {
      status: "warn",
      detail: `hold fields have values: ${badHoldFields.map((field) => field.label).join(", ")}`,
      required: false,
    };
  }
  return {
    status: "ok",
    detail: `${readyFields.length} ready field(s), ${suggestedAnswers.length} optional answer(s), ${holdFields.length} held field(s)`,
  };
}

function validateExternalEntrySnapshot(raw) {
  const required = [
    "https://overflow.sui.io/",
    "https://www.deepsurge.xyz/hackathons/b587dc0c-4cb8-4e63-ada5-519df38103bf",
    "DeFi & Payments",
    "No-Go",
  ];
  const missing = required.filter((item) => !raw.includes(item));
  if (missing.length > 0) {
    return {
      status: "warn",
      detail: `missing snapshot marker(s): ${missing.join(", ")}`,
      required: false,
    };
  }
  return {
    status: "ok",
    detail: "official entry source snapshot present",
  };
}

function checkPackageScript(scriptName) {
  const packageJson = JSON.parse(readFileSync(resolve(rootDir, "package.json"), "utf8"));
  const exists = Boolean(packageJson.scripts?.[scriptName]);
  addCheck({
    name: `npm script ${scriptName}`,
    status: exists ? "ok" : "block",
    detail: exists ? packageJson.scripts[scriptName] : "missing",
    required: true,
  });
}

function latestCiCheck() {
  const result = spawnSync("gh", ["run", "list", "--workflow", "ci.yml", "--limit", "1", "--json", "status,conclusion,displayTitle,databaseId"], {
    cwd: rootDir,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    return {
      name: "Latest GitHub Actions CI",
      status: "warn",
      detail: "could not read gh run list",
      required: false,
    };
  }
  try {
    const [run] = JSON.parse(result.stdout);
    if (!run) {
      return {
        name: "Latest GitHub Actions CI",
        status: "warn",
        detail: "no runs found",
        required: false,
      };
    }
    return {
      name: "Latest GitHub Actions CI",
      status: run.status === "completed" && run.conclusion === "success" ? "ok" : "warn",
      detail: `${run.displayTitle}: ${run.status}/${run.conclusion ?? "none"} (#${run.databaseId})`,
      required: false,
    };
  } catch {
    return {
      name: "Latest GitHub Actions CI",
      status: "warn",
      detail: "gh output was not parseable",
      required: false,
    };
  }
}

function repositoryVisibilityCheck() {
  const result = spawnSync("gh", ["repo", "view", "--json", "visibility,url"], {
    cwd: rootDir,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    return {
      name: "Repository visibility",
      status: "warn",
      detail: "could not read gh repo visibility",
      required: false,
    };
  }
  try {
    const repo = JSON.parse(result.stdout);
    const publicRepo = repo.visibility === "PUBLIC";
    return {
      name: "Repository visibility",
      status: publicRepo ? "ok" : "warn",
      detail: publicRepo ? `${repo.url} is public` : `${repo.url} is ${String(repo.visibility).toLowerCase()}; judges may not be able to access it`,
      required: false,
    };
  } catch {
    return {
      name: "Repository visibility",
      status: "warn",
      detail: "gh repo output was not parseable",
      required: false,
    };
  }
}

function staticPublicDemoCheck() {
  const pagesWorkflowPath = resolve(rootDir, ".github/workflows/pages.yml");
  const cloudflareWorkflowPath = resolve(rootDir, ".github/workflows/cloudflare-pages.yml");
  if (!existsSync(pagesWorkflowPath) && !existsSync(cloudflareWorkflowPath)) {
    return {
      name: "Static public demo path",
      status: "block",
      detail: "GitHub Pages and Cloudflare demo workflows are missing",
      required: false,
    };
  }
  const pages = githubPagesCheck();
  if (pages.ok) {
    return {
      name: "Static public demo path",
      status: "ok",
      detail: `GitHub Pages configured: ${pages.url}pay/demo-ai-workflow`,
      required: false,
    };
  }
  const cloudflare = cloudflareSecretsCheck();
  return {
    name: "Static public demo path",
    status: "warn",
    detail: [pages.detail, cloudflare.detail].filter(Boolean).join("; "),
    required: false,
  };
}

function githubPagesCheck() {
  const result = spawnSync("gh", ["api", "repos/a392479619-blip/sui-paylink/pages"], {
    cwd: rootDir,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    const stderr = result.stderr.trim();
    const detail = stderr.includes("Not Found")
      ? "GitHub Pages is not enabled for this repository yet"
      : "could not read GitHub Pages status";
    return { ok: false, detail };
  }
  try {
    const pages = JSON.parse(result.stdout);
    const url = typeof pages.html_url === "string" ? pages.html_url : "";
    return {
      ok: Boolean(url),
      url: url.endsWith("/") ? url : `${url}/`,
      detail: url ? `GitHub Pages configured at ${url}` : "GitHub Pages has no html_url yet",
    };
  } catch {
    return { ok: false, detail: "GitHub Pages status was not parseable" };
  }
}

function cloudflareSecretsCheck() {
  const result = spawnSync("gh", ["secret", "list"], {
    cwd: rootDir,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    return {
      ok: false,
      detail: "could not read GitHub secrets for Cloudflare deployment",
    };
  }
  const names = new Set(
    result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim().split(/\s+/)[0])
      .filter(Boolean),
  );
  const missing = ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"].filter((name) => !names.has(name));
  if (missing.length === 0) {
    return {
      ok: true,
      detail: "Cloudflare secrets are present; run Cloudflare Static Demo workflow and verify the URL",
    };
  }
  return {
    ok: false,
    detail: `Cloudflare demo secrets missing: ${missing.join(", ")}`,
  };
}

function realApiDeploymentCheck() {
  return {
    name: "Real API hosted demo",
    status: process.env.PUBLIC_DEMO_URL ? "ok" : "warn",
    detail: process.env.PUBLIC_DEMO_URL ?? "no PUBLIC_DEMO_URL provided; current public path is static mock only",
    required: false,
  };
}

function browserWalletE2eCheck() {
  const evidencePath = resolve(rootDir, "deployments/browser-wallet-sponsored-e2e.json");
  if (!existsSync(evidencePath)) {
    return {
      name: "Browser wallet sponsored E2E",
      status: "warn",
      detail: "no browser-wallet sponsored digest file found yet; run npm run evidence:browser-wallet after the real flow",
      required: false,
    };
  }
  try {
    const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
    const digests = Object.values(evidence.digests ?? {}).filter((value) => typeof value === "string" && value.length > 0);
    const ok = Boolean(
      evidence.verification?.ok &&
        evidence.source === "browser-wallet-sponsored-flow" &&
        evidence.sponsor &&
        evidence.escrowObjectId &&
        digests.length >= 3,
    );
    return {
      name: "Browser wallet sponsored E2E",
      status: ok ? "ok" : "warn",
      detail: ok
        ? `${digests.length} digest(s), escrow ${short(evidence.escrowObjectId)}`
        : "browser-wallet evidence file exists but is incomplete or not verified",
      required: false,
    };
  } catch (error) {
    return {
      name: "Browser wallet sponsored E2E",
      status: "warn",
      detail: `browser-wallet evidence is not parseable: ${errorMessage(error)}`,
      required: false,
    };
  }
}

function runSponsorReadiness() {
  const result = spawnSync("node", ["scripts/sponsor-readiness.mjs"], {
    cwd: rootDir,
    encoding: "utf8",
  });
  if (result.status === 0) {
    const parsed = safeJson(result.stdout);
    return {
      name: "Sponsor readiness",
      status: "ok",
      detail: parsed?.sponsorAddress ? `${short(parsed.sponsorAddress)} ready` : "ready",
      required: false,
    };
  }
  const parsed = safeJson(result.stdout);
  const failed = parsed?.checks?.find((check) => check.ok === false);
  return {
    name: "Sponsor readiness",
    status: "warn",
    detail: failed ? `${failed.name}: ${failed.detail}` : "not ready",
    required: false,
  };
}

function gitStatusIsClean() {
  const result = spawnSync("git", ["status", "--porcelain"], { cwd: rootDir, encoding: "utf8" });
  return result.status === 0 && result.stdout.trim() === "";
}

function addCheck(check) {
  checks.push(check);
}

function nextActionsFor(allChecks) {
  const actions = [];
  if (allChecks.some((check) => check.name === "Repository visibility" && check.status !== "ok")) {
    actions.push("Make the GitHub repository public or confirm the submission platform can access a private repository.");
  }
  if (allChecks.some((check) => check.name === "Static public demo path" && check.status !== "ok")) {
    actions.push("After approving a public repo, run npm run demo:pages-cutover -- --confirm-public-repo; otherwise set CLOUDFLARE_* secrets and run npm run demo:cloudflare-cutover -- --confirm-cloudflare-deploy.");
  }
  if (allChecks.some((check) => check.name === "Sponsor readiness" && check.status !== "ok")) {
    actions.push("Fund the sponsor address with Testnet SUI, then run npm run submission:readiness -- --with-sponsor.");
  }
  if (allChecks.some((check) => check.name === "Browser wallet sponsored E2E" && check.status !== "ok")) {
    actions.push("Record one browser-wallet sponsored flow and save its digest evidence.");
  }
  if (actions.length === 0) {
    actions.push("Record the final two-minute demo video and submit with the Testnet evidence links.");
  }
  return actions;
}

function printHuman(summary) {
  console.log("SuiPayLink submission readiness");
  console.log(`Generated: ${summary.generatedAt}`);
  console.log(`Minimum submission: ${summary.okForMinimumSubmission ? "PASS" : "BLOCKED"}`);
  console.log(`Competitive demo: ${summary.okForCompetitiveDemo ? "PASS" : "NEEDS WORK"}`);
  console.log(`Totals: ok=${summary.totals.ok}, warn=${summary.totals.warn}, block=${summary.totals.block}`);
  console.log("");
  for (const check of summary.checks) {
    console.log(`${labelFor(check.status)} ${check.name}: ${check.detail}`);
  }
  console.log("");
  console.log("Next actions:");
  for (const action of summary.nextActions) {
    console.log(`- ${action}`);
  }
}

function flattenDigests(value) {
  if (!value || typeof value !== "object") {
    return [];
  }
  return Object.values(value).filter((item) => typeof item === "string" && item.length > 0);
}

function labelFor(status) {
  return {
    ok: "[OK]",
    warn: "[WARN]",
    block: "[BLOCK]",
  }[status] ?? "[UNKNOWN]";
}

function safeJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function short(value) {
  return typeof value === "string" && value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-6)}` : value;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
