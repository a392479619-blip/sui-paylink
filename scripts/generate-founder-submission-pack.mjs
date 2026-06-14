#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = new Set(process.argv.slice(2));
const writeOutput = args.has("--write");
const outputPath = resolve(rootDir, "submission/founder-submission-pack.md");

const registration = JSON.parse(readFileSync(resolve(rootDir, "submission/registration-fields.json"), "utf8"));
const readiness = runJson("node", ["scripts/submission-readiness.mjs", "--with-sponsor", "--json"]);
const founder = runJson("node", ["scripts/founder-final-check.mjs", "--json"]);
const externalSnapshot = readFileSync(resolve(rootDir, "submission/external-entry-snapshot.md"), "utf8");

const markdown = renderMarkdown();

if (writeOutput) {
  const parent = dirname(outputPath);
  if (!existsSync(parent)) {
    mkdirSync(parent, { recursive: true });
  }
  writeFileSync(outputPath, markdown);
} else {
  process.stdout.write(markdown);
}

function renderMarkdown() {
  const lines = [];
  const readyFields = registration.fields.filter((field) => field.status === "ready");
  const userFields = registration.fields.filter((field) => field.status === "needs_user_verification");
  const holdFields = registration.fields.filter((field) => field.status === "hold");
  const optionalAnswers = Array.isArray(registration.suggestedAnswers) ? registration.suggestedAnswers : [];
  const readinessData = readiness.data ?? {};
  const founderData = founder.data ?? {};
  const competitiveGaps = readinessData.competitiveGaps ?? [];
  const actionItems = founderData.actionItems ?? readinessData.nextActions ?? [];

  lines.push("# SuiPayLink Founder Submission Pack");
  lines.push("");
  lines.push("Generated from local submission checks.");
  lines.push(`Source updatedAt: ${registration.updatedAt ?? "unknown"}`);
  lines.push("");
  lines.push("## Current Decision");
  lines.push("");
  lines.push(`- Open registration form: ${founderData.okToOpenRegistrationForm ? "YES" : "NO"}`);
  lines.push(`- Minimum submission: ${readinessData.okForMinimumSubmission ? "PASS" : "BLOCKED"}`);
  lines.push(`- Final submit without user action: ${founderData.okToFinalSubmitWithoutUserAction ? "YES" : "NO"}`);
  lines.push(`- Competitive demo: ${readinessData.okForCompetitiveDemo ? "PASS" : "NEEDS WORK"}`);
  lines.push("");
  lines.push("Interpretation: fill prepared fields now if the live form is pre-registration or accepts missing demo/video. Do not paste placeholder Demo URL or Demo video URL.");
  lines.push("");
  lines.push("## Event");
  lines.push("");
  lines.push(`- Name: ${registration.event?.name ?? "unknown"}`);
  lines.push(`- Official URL: ${registration.event?.officialUrl ?? "unknown"}`);
  lines.push(`- Registration URL: ${registration.event?.registrationUrl ?? "unknown"}`);
  lines.push(`- Selected track: ${registration.event?.selectedTrack ?? "unknown"}`);
  lines.push(`- Track rationale: ${registration.event?.trackRationale ?? "unknown"}`);
  lines.push("");
  lines.push("## Copy These Fields");
  lines.push("");
  for (const field of readyFields) {
    lines.push(renderField(field));
  }
  lines.push("## Optional Answers");
  lines.push("");
  lines.push("Use only when the live form asks a matching question.");
  lines.push("");
  for (const answer of optionalAnswers) {
    lines.push(renderField(answer));
  }
  lines.push("## Verify Before Pasting");
  lines.push("");
  for (const field of userFields) {
    lines.push(`- ${field.label}: ${field.value}`);
    lines.push(`  Decision: ${field.reason ?? "verify manually before submission"}`);
  }
  if (userFields.length === 0) {
    lines.push("- none");
  }
  lines.push("");
  lines.push("## Leave Blank Until Verified");
  lines.push("");
  for (const field of holdFields) {
    lines.push(`- ${field.label}: ${field.reason ?? "held until verified"}`);
  }
  if (holdFields.length === 0) {
    lines.push("- none");
  }
  lines.push("");
  lines.push("## Evidence Links");
  lines.push("");
  for (const link of registration.evidenceLinks ?? []) {
    lines.push(`- ${link.label}: ${link.url}`);
  }
  lines.push("");
  lines.push("## Current Gaps");
  lines.push("");
  if (competitiveGaps.length === 0) {
    lines.push("- none");
  } else {
    for (const gap of competitiveGaps) {
      lines.push(`- ${gap}`);
    }
  }
  lines.push("");
  lines.push("## Next Actions");
  lines.push("");
  for (const action of actionItems) {
    lines.push(`- ${action}`);
  }
  lines.push("");
  lines.push("## Pre-Submit Commands");
  lines.push("");
  lines.push("```bash");
  lines.push("npm run registration:copy -- --write");
  lines.push("npm run submission:pack -- --write");
  lines.push("npm run registration:audit");
  lines.push("npm run founder:verify");
  lines.push("npm run submission:readiness -- --with-sponsor");
  lines.push("```");
  lines.push("");
  lines.push("## External Entry Snapshot");
  lines.push("");
  lines.push(stripTitle(externalSnapshot).trim());
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function renderField(field) {
  const lines = [];
  lines.push(`### ${field.label}`);
  lines.push("");
  if (field.maxLength) {
    lines.push(`Length: ${[...String(field.value ?? "")].length}/${field.maxLength}`);
    lines.push("");
  }
  lines.push("```text");
  lines.push(String(field.value ?? ""));
  lines.push("```");
  lines.push("");
  return lines.join("\n");
}

function stripTitle(markdown) {
  return markdown.replace(/^# .*\n+/, "");
}

function runJson(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: rootDir,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  try {
    return {
      ok: result.status === 0,
      data: JSON.parse(result.stdout),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      stdout: result.stdout,
    };
  }
}
