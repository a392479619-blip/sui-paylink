#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = new Set(process.argv.slice(2));
const writeOutput = args.has("--write");
const outputPath = resolve(rootDir, "submission/registration-copy.md");

const registration = JSON.parse(readFileSync(resolve(rootDir, "submission/registration-fields.json"), "utf8"));
const readyFields = registration.fields.filter((field) => field.status === "ready");
const userFields = registration.fields.filter((field) => field.status === "needs_user_verification");
const holdFields = registration.fields.filter((field) => field.status === "hold");
const suggestedAnswers = Array.isArray(registration.suggestedAnswers) ? registration.suggestedAnswers : [];

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
  lines.push("# SuiPayLink Registration Copy Sheet");
  lines.push("");
  lines.push(`Generated from \`submission/registration-fields.json\`.`);
  lines.push(`Source updatedAt: ${registration.updatedAt ?? "unknown"}`);
  lines.push("");
  lines.push("## Event");
  lines.push("");
  lines.push(`- Name: ${registration.event?.name ?? "unknown"}`);
  lines.push(`- Official URL: ${registration.event?.officialUrl ?? "unknown"}`);
  lines.push(`- Registration URL: ${registration.event?.registrationUrl ?? "unknown"}`);
  lines.push(`- Selected track: ${registration.event?.selectedTrack ?? "unknown"}`);
  lines.push("");
  lines.push("## Ready Fields");
  lines.push("");
  lines.push("Copy these fields into the form when the matching field exists.");
  lines.push("");
  for (const field of readyFields) {
    lines.push(renderField(field));
  }
  if (suggestedAnswers.length > 0) {
    lines.push("## Optional Form Answers");
    lines.push("");
    lines.push("Use these only when the live form asks a matching question.");
    lines.push("");
    for (const answer of suggestedAnswers) {
      lines.push(renderField(answer));
    }
  }
  lines.push("## Needs Founder Verification");
  lines.push("");
  lines.push("Do not paste these until the condition is true in the live form.");
  lines.push("");
  for (const field of userFields) {
    lines.push(renderField(field));
    lines.push(`Decision: ${field.reason ?? "Verify manually before submission."}`);
    lines.push("");
  }
  lines.push("## Hold Fields");
  lines.push("");
  lines.push("Leave these blank unless the condition has been verified in a browser.");
  lines.push("");
  for (const field of holdFields) {
    lines.push(`### ${field.label}`);
    lines.push("");
    lines.push(`Status: HOLD`);
    lines.push(`Reason: ${field.reason ?? "Held until verified."}`);
    lines.push("Value to submit now: leave blank");
    lines.push("");
  }
  lines.push("## Evidence Links");
  lines.push("");
  for (const link of registration.evidenceLinks ?? []) {
    lines.push(`- ${link.label}: ${link.url}`);
  }
  lines.push("");
  lines.push("## Go Conditions");
  lines.push("");
  for (const item of registration.minimumGoNoGo?.go ?? []) {
    lines.push(`- ${item}`);
  }
  lines.push("");
  lines.push("## No-Go Conditions");
  lines.push("");
  for (const item of registration.minimumGoNoGo?.noGo ?? []) {
    lines.push(`- ${item}`);
  }
  lines.push("");
  lines.push("## Pre-Submit Commands");
  lines.push("");
  lines.push("```bash");
  lines.push("npm run registration:audit");
  lines.push("npm run founder:verify");
  lines.push("npm run public:preflight");
  lines.push("```");
  lines.push("");
  lines.push("If `founder:verify` says `Final submit without user action: NO`, follow the hold and verification rules above instead of pasting placeholder links.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function renderField(field) {
  const lines = [];
  lines.push(`### ${field.label}`);
  lines.push("");
  if (field.maxLength) {
    const length = [...String(field.value ?? "")].length;
    lines.push(`Length: ${length}/${field.maxLength}`);
    lines.push("");
  }
  lines.push("```text");
  lines.push(String(field.value ?? ""));
  lines.push("```");
  lines.push("");
  return lines.join("\n");
}
