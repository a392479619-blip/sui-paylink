#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = new Set(process.argv.slice(2));
const jsonOutput = args.has("--json");
const fieldsPath = resolve(rootDir, "submission", "registration-fields.json");

const checks = [];
const registration = JSON.parse(readFileSync(fieldsPath, "utf8"));

checkBasicShape();
checkFieldLengths();
checkSuggestedAnswerLengths();
checkHoldFields();
checkEvidenceLinks();
checks.push(readinessMinimumCheck());
checks.push(publicPreflightCheck());
checks.push(repositoryVisibilityCheck());

const blockers = checks.filter((check) => check.status === "block");
const warnings = checks.filter((check) => check.status === "warn");
const readyFields = registration.fields.filter((field) => field.status === "ready");
const needsUserFields = registration.fields.filter((field) => field.status === "needs_user_verification");
const holdFields = registration.fields.filter((field) => field.status === "hold");
const suggestedAnswers = Array.isArray(registration.suggestedAnswers) ? registration.suggestedAnswers : [];

const summary = {
  okForFounderReview: blockers.length === 0,
  okForImmediateFinalSubmission: blockers.length === 0 && warnings.length === 0,
  generatedAt: new Date().toISOString(),
  counts: {
    readyFields: readyFields.length,
    needsUserVerification: needsUserFields.length,
    holdFields: holdFields.length,
    suggestedAnswers: suggestedAnswers.length,
    warnings: warnings.length,
    blockers: blockers.length,
  },
  nextActions: nextActions(),
  checks,
};

if (jsonOutput) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  printHuman(summary);
}

if (blockers.length > 0) {
  process.exitCode = 1;
}

function checkBasicShape() {
  addCheck("Registration event", Boolean(registration.event?.name && registration.event?.registrationUrl), "ready");
  addCheck("Selected track", registration.event?.selectedTrack === "DeFi & Payments", registration.event?.selectedTrack ?? "missing");
  addCheck("Fields array", Array.isArray(registration.fields) && registration.fields.length > 0, `${registration.fields?.length ?? 0} field(s)`);
  addCheck("Evidence links", Array.isArray(registration.evidenceLinks) && registration.evidenceLinks.length > 0, `${registration.evidenceLinks?.length ?? 0} link(s)`);
}

function checkFieldLengths() {
  for (const field of registration.fields) {
    if (!field.maxLength) {
      continue;
    }
    const length = [...String(field.value ?? "")].length;
    addCheck(
      `${field.label} length`,
      length <= field.maxLength,
      `${length}/${field.maxLength}`,
      length <= field.maxLength ? "ok" : "block",
    );
  }
}

function checkSuggestedAnswerLengths() {
  if (!Array.isArray(registration.suggestedAnswers)) {
    addCheck("Suggested answers", true, "none", "warn");
    return;
  }
  addCheck("Suggested answers", registration.suggestedAnswers.length > 0, `${registration.suggestedAnswers.length} answer(s)`, "ok");
  for (const answer of registration.suggestedAnswers) {
    const hasValue = Boolean(String(answer.value ?? "").trim());
    addCheck(`${answer.label} answer`, hasValue, hasValue ? "ready" : "missing", hasValue ? "ok" : "block");
    if (!answer.maxLength) {
      continue;
    }
    const length = [...String(answer.value ?? "")].length;
    addCheck(
      `${answer.label} length`,
      length <= answer.maxLength,
      `${length}/${answer.maxLength}`,
      length <= answer.maxLength ? "ok" : "block",
    );
  }
}

function checkHoldFields() {
  for (const field of registration.fields) {
    if (field.status !== "hold") {
      continue;
    }
    const empty = !String(field.value ?? "").trim();
    addCheck(
      `${field.label} hold boundary`,
      empty,
      empty ? field.reason ?? "held until verified" : "hold field has a value; verify it before submitting",
      empty ? "warn" : "block",
    );
  }
}

function checkEvidenceLinks() {
  for (const link of registration.evidenceLinks) {
    const ok = typeof link.url === "string" && /^https:\/\/suiexplorer\.com\/(object|txblock)\//.test(link.url);
    addCheck(`${link.label} evidence URL`, ok, link.url ?? "missing", ok ? "ok" : "block");
  }
}

function readinessMinimumCheck() {
  const result = spawnSync("node", ["scripts/submission-readiness.mjs", "--with-sponsor", "--json"], {
    cwd: rootDir,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    return {
      name: "Submission readiness minimum",
      status: "block",
      detail: "submission-readiness failed",
    };
  }
  try {
    const parsed = JSON.parse(result.stdout);
    return {
      name: "Submission readiness minimum",
      status: parsed.okForMinimumSubmission ? "ok" : "block",
      detail: parsed.okForMinimumSubmission ? "Minimum submission PASS" : "Minimum submission blocked",
    };
  } catch {
    return {
      name: "Submission readiness minimum",
      status: "block",
      detail: "submission-readiness JSON was not parseable",
    };
  }
}

function publicPreflightCheck() {
  const result = spawnSync("node", ["scripts/public-preflight.mjs", "--json"], {
    cwd: rootDir,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    return {
      name: "Public repository preflight",
      status: "block",
      detail: "public preflight failed; do not make the repository public yet",
    };
  }
  try {
    const parsed = JSON.parse(result.stdout);
    return {
      name: "Public repository preflight",
      status: parsed.okToConsiderPublic ? "ok" : "block",
      detail: parsed.okToConsiderPublic ? "no high-confidence tracked/history secret findings" : "secret findings need review",
    };
  } catch {
    return {
      name: "Public repository preflight",
      status: "block",
      detail: "public preflight JSON was not parseable",
    };
  }
}

function repositoryVisibilityCheck() {
  const repoField = registration.fields.find((field) => field.label === "Repository URL");
  const result = spawnSync("gh", ["repo", "view", "--json", "visibility,url"], {
    cwd: rootDir,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    return {
      name: "Repository visibility",
      status: "warn",
      detail: repoField?.reason ?? "Could not read repository visibility",
    };
  }
  try {
    const repo = JSON.parse(result.stdout);
    return {
      name: "Repository visibility",
      status: repo.visibility === "PUBLIC" ? "ok" : "warn",
      detail: repo.visibility === "PUBLIC"
        ? `${repo.url} is public`
        : `${repo.url} is ${String(repo.visibility).toLowerCase()}; make it public or confirm private access before final submission`,
    };
  } catch {
    return {
      name: "Repository visibility",
      status: "warn",
      detail: "gh repo output was not parseable",
    };
  }
}

function addCheck(name, ok, detail, okStatus = "ok") {
  checks.push({
    name,
    status: ok ? okStatus : "block",
    detail,
  });
}

function nextActions() {
  const actions = [];
  if (checks.some((check) => check.name === "Repository visibility" && check.status !== "ok")) {
    actions.push("Decide whether to make the GitHub repository public before entering the repository URL.");
  }
  if (holdFields.some((field) => field.label === "Demo URL")) {
    actions.push("Leave Demo URL blank unless a public deployment is verified in browser.");
  }
  if (holdFields.some((field) => field.label === "Demo video URL")) {
    actions.push("Leave Demo video URL blank unless a public or unlisted video has been uploaded and opened successfully.");
  }
  if (actions.length === 0) {
    actions.push("Open the registration page and copy fields from submission/registration-fields.json.");
  }
  return actions;
}

function printHuman(summary) {
  console.log("SuiPayLink registration audit");
  console.log(`Generated: ${summary.generatedAt}`);
  console.log(`Founder review: ${summary.okForFounderReview ? "READY" : "BLOCKED"}`);
  console.log(`Immediate final submission: ${summary.okForImmediateFinalSubmission ? "READY" : "NEEDS USER ACTION"}`);
  console.log(
    `Fields: ready=${summary.counts.readyFields}, optional=${summary.counts.suggestedAnswers}, user=${summary.counts.needsUserVerification}, hold=${summary.counts.holdFields}`,
  );
  console.log(`Checks: warn=${summary.counts.warnings}, block=${summary.counts.blockers}`);
  console.log("");
  for (const check of summary.checks) {
    console.log(`${label(check.status)} ${check.name}: ${check.detail}`);
  }
  console.log("");
  console.log("Next actions:");
  for (const action of summary.nextActions) {
    console.log(`- ${action}`);
  }
}

function label(status) {
  return {
    ok: "[OK]",
    warn: "[WARN]",
    block: "[BLOCK]",
  }[status] ?? "[UNKNOWN]";
}
