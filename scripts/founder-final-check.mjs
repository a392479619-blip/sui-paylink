#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = new Set(process.argv.slice(2));
const jsonOutput = args.has("--json");

const registration = JSON.parse(readFileSync(resolve(rootDir, "submission/registration-fields.json"), "utf8"));
const registrationAudit = runJson("node", ["scripts/registration-audit.mjs", "--json"]);
const submissionReadiness = runJson("node", ["scripts/submission-readiness.mjs", "--with-sponsor", "--json"]);
const publicPreflight = runJson("node", ["scripts/public-preflight.mjs", "--json"]);
const sponsorReadiness = runJson("node", ["scripts/sponsor-readiness.mjs"], { allowNonzeroJson: true });

const readyFields = registration.fields.filter((field) => field.status === "ready");
const userFields = registration.fields.filter((field) => field.status === "needs_user_verification");
const holdFields = registration.fields.filter((field) => field.status === "hold");
const suggestedAnswers = Array.isArray(registration.suggestedAnswers) ? registration.suggestedAnswers : [];
const competitiveGaps = submissionReadiness.data?.competitiveGaps ?? [];
const actionItems = buildActionItems();
const noGoIfRequired = buildNoGoConditions();

const summary = {
  okToOpenRegistrationForm:
    registrationAudit.ok &&
    registrationAudit.data?.okForFounderReview === true &&
    submissionReadiness.ok &&
    submissionReadiness.data?.okForMinimumSubmission === true &&
    publicPreflight.ok &&
    publicPreflight.data?.okToConsiderPublic === true,
  okToFinalSubmitWithoutUserAction:
    registrationAudit.ok &&
    registrationAudit.data?.okForImmediateFinalSubmission === true &&
    submissionReadiness.ok &&
    submissionReadiness.data?.okForCompetitiveDemo === true &&
    publicPreflight.ok &&
    publicPreflight.data?.okToConsiderPublic === true,
  generatedAt: new Date().toISOString(),
  registration: {
    event: registration.event,
    readyFieldCount: readyFields.length,
    userVerificationFieldCount: userFields.length,
    holdFieldCount: holdFields.length,
    readyFields: readyFields.map((field) => pickField(field)),
    userVerificationFields: userFields.map((field) => pickField(field)),
    holdFields: holdFields.map((field) => pickField(field)),
    suggestedAnswers: suggestedAnswers.map((field) => pickField(field)),
    evidenceLinks: registration.evidenceLinks,
  },
  checks: {
    registrationAudit: compactRun(registrationAudit),
    submissionReadiness: compactRun(submissionReadiness),
    publicPreflight: compactRun(publicPreflight),
    sponsorReadiness: compactRun(sponsorReadiness),
  },
  sponsor: {
    address: sponsorReadiness.data?.sponsorAddress,
    minimumSponsorBalanceMist: sponsorReadiness.data?.minimumSponsorBalanceMist,
    ready: sponsorReadiness.data?.ok === true,
  },
  competitiveGaps,
  actionItems,
  noGoIfRequired,
};

if (jsonOutput) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  printHuman(summary);
}

if (!summary.okToOpenRegistrationForm) {
  process.exitCode = 1;
}

function buildActionItems() {
  const actions = [];
  const repoCheck = findCheck(registrationAudit.data?.checks, "Repository visibility");
  const staticDemoGap = competitiveGaps.includes("Static public demo path");
  const realApiGap = competitiveGaps.includes("Real API hosted demo");
  const sponsorGap = competitiveGaps.includes("Sponsor readiness");
  const browserWalletGap = competitiveGaps.includes("Browser wallet sponsored E2E");

  if (repoCheck?.status !== "ok") {
    actions.push("Make the GitHub repository public, or confirm the submission platform can access the private repository before entering the Repository URL.");
  }
  if (holdFields.some((field) => field.label === "Demo URL")) {
    actions.push("Leave Demo URL blank unless a public URL has been deployed and opened successfully in a browser.");
  }
  if (holdFields.some((field) => field.label === "Demo video URL")) {
    actions.push("Leave Demo video URL blank unless a public or unlisted video has been uploaded and opened successfully.");
  }
  if (staticDemoGap || realApiGap) {
    actions.push("If the form requires Demo URL, deploy Cloudflare/GitHub Pages static demo or a hosted API demo first, then rerun npm run founder:verify.");
  }
  if (sponsorGap) {
    const sponsorAddress = sponsorReadiness.data?.sponsorAddress;
    const required = sponsorReadiness.data?.minimumSponsorBalanceMist;
    const target = sponsorAddress ? ` ${sponsorAddress}` : "";
    const amount = required ? ` to at least ${required} MIST` : "";
    actions.push(`Fund the sponsor address${target} with Testnet SUI${amount}, then rerun npm run sponsor:readiness and npm run founder:verify.`);
  }
  if (browserWalletGap) {
    actions.push("For a stronger demo, record one browser-wallet sponsored flow and export evidence with npm run evidence:browser-wallet.");
  }
  if (actions.length === 0) {
    actions.push("Open the registration page, copy the ready fields, and keep Demo URL / Demo video blank unless verified.");
  }
  return actions;
}

function buildNoGoConditions() {
  const noGo = [];
  const repoCheck = findCheck(registrationAudit.data?.checks, "Repository visibility");
  if (repoCheck?.status !== "ok") {
    noGo.push("The form requires a public repository, but the GitHub repo is still private.");
  }
  if (holdFields.some((field) => field.label === "Demo URL")) {
    noGo.push("The form requires a public demo URL, but no browser-verified public demo URL is ready.");
  }
  if (holdFields.some((field) => field.label === "Demo video URL")) {
    noGo.push("The form requires a demo video URL, but no public or unlisted video URL is ready.");
  }
  noGo.push("The form requires production payment claims, real USDC, or legal arbitration claims beyond current Testnet mUSDC evidence.");
  return noGo;
}

function findCheck(checks, name) {
  return Array.isArray(checks) ? checks.find((check) => check.name === name) : undefined;
}

function runJson(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: rootDir,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  try {
    const data = JSON.parse(result.stdout);
    if (result.status !== 0 && !options.allowNonzeroJson) {
      return {
        ok: false,
        exitCode: result.status ?? 1,
        error: result.stderr.trim() || "command failed",
        data,
      };
    }
    return {
      ok: result.status === 0,
      exitCode: result.status ?? 0,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      exitCode: result.status ?? 1,
      error: `JSON parse failed: ${errorMessage(error)}`,
      stdout: result.stdout,
    };
  }
}

function compactRun(run) {
  if (!run.ok) {
    return {
      ok: false,
      exitCode: run.exitCode,
      error: run.error,
    };
  }
  return {
    ok: true,
    generatedAt: run.data.generatedAt,
    counts: run.data.counts ?? run.data.totals,
    nextActions: run.data.nextActions,
  };
}

function pickField(field) {
  return {
    label: field.label,
    value: field.value ?? "",
    reason: field.reason,
  };
}

function printHuman(data) {
  console.log("SuiPayLink founder final check");
  console.log(`Generated: ${data.generatedAt}`);
  console.log(`Open registration form: ${data.okToOpenRegistrationForm ? "YES" : "NO"}`);
  console.log(`Final submit without user action: ${data.okToFinalSubmitWithoutUserAction ? "YES" : "NO"}`);
  console.log("");
  console.log("Ready fields to copy:");
  for (const field of data.registration.readyFields) {
    console.log(`- ${field.label}: ${field.value}`);
  }
  if (data.registration.suggestedAnswers.length > 0) {
    console.log("");
    console.log("Optional answers for matching form questions:");
    for (const field of data.registration.suggestedAnswers) {
      console.log(`- ${field.label}: ${field.value}`);
    }
  }
  console.log("");
  console.log("Needs founder verification:");
  for (const field of data.registration.userVerificationFields) {
    console.log(`- ${field.label}: ${field.reason ?? "verify before final submit"}`);
  }
  console.log("");
  console.log("Hold fields:");
  for (const field of data.registration.holdFields) {
    console.log(`- ${field.label}: ${field.reason ?? "leave blank until verified"}`);
  }
  console.log("");
  console.log("Competitive gaps:");
  if (data.competitiveGaps.length === 0) {
    console.log("- none");
  } else {
    for (const gap of data.competitiveGaps) {
      console.log(`- ${gap}`);
    }
  }
  console.log("");
  console.log("Action items:");
  for (const action of data.actionItems) {
    console.log(`- ${action}`);
  }
  if (data.sponsor.address) {
    console.log("");
    console.log("Sponsor top-up:");
    console.log(`- address: ${data.sponsor.address}`);
    console.log(`- required balance: ${data.sponsor.minimumSponsorBalanceMist ?? "unknown"} MIST`);
    console.log(`- ready: ${data.sponsor.ready ? "yes" : "no"}`);
  }
  console.log("");
  console.log("No-Go if the form requires:");
  for (const condition of data.noGoIfRequired) {
    console.log(`- ${condition}`);
  }
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
