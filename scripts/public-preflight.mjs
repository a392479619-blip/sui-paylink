#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = new Set(process.argv.slice(2));
const jsonOutput = args.has("--json");

const checks = [];
const findings = [];
const trackedFiles = gitLines(["ls-files"]);

checkNoTrackedSensitiveFiles();
checkGitignore();
scanTrackedFiles();
scanHistory();

const blockers = checks.filter((check) => check.status === "block");
const warnings = checks.filter((check) => check.status === "warn");
const summary = {
  okToConsiderPublic: blockers.length === 0,
  generatedAt: new Date().toISOString(),
  totals: {
    ok: checks.filter((check) => check.status === "ok").length,
    warn: warnings.length,
    block: blockers.length,
    findings: findings.length,
  },
  checks,
  findings,
};

if (jsonOutput) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  printHuman(summary);
}

if (blockers.length > 0) {
  process.exitCode = 1;
}

function checkNoTrackedSensitiveFiles() {
  const risky = trackedFiles.filter((file) => isSensitiveTrackedPath(file));
  addCheck(
    "No tracked secret files",
    risky.length === 0,
    risky.length === 0 ? "no tracked .env, .data, key, pem, or credential files" : risky.join(", "),
    "block",
  );
}

function checkGitignore() {
  const gitignorePath = resolve(rootDir, ".gitignore");
  const content = existsSync(gitignorePath) ? readFileSync(gitignorePath, "utf8") : "";
  const requiredPatterns = [".env", ".env.local", ".data/", "node_modules/"];
  const missing = requiredPatterns.filter((pattern) => !content.split(/\r?\n/).includes(pattern));
  addCheck(
    "Sensitive local files ignored",
    missing.length === 0,
    missing.length === 0 ? "required ignore patterns present" : `missing ${missing.join(", ")}`,
    "block",
  );
}

function scanTrackedFiles() {
  const patterns = secretPatterns();
  for (const file of trackedFiles) {
    if (skipContentScan(file)) {
      continue;
    }
    const path = resolve(rootDir, file);
    let content = "";
    try {
      content = readFileSync(path, "utf8");
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/);
    for (const [lineIndex, line] of lines.entries()) {
      for (const pattern of patterns) {
        if (pattern.regex.test(line) && !isAllowedPlaceholder(line, pattern.id)) {
          findings.push({
            scope: "tracked-file",
            file,
            line: lineIndex + 1,
            pattern: pattern.id,
          });
        }
      }
    }
  }
  addCheck(
    "Tracked file secret scan",
    findings.filter((finding) => finding.scope === "tracked-file").length === 0,
    findings.filter((finding) => finding.scope === "tracked-file").length === 0
      ? "no high-confidence secret patterns in tracked files"
      : "high-confidence secret pattern found in tracked files",
    "block",
  );
}

function scanHistory() {
  const patterns = [
    { id: "sui-private-key", regex: "suiprivkey[1-9A-HJ-NP-Za-km-z]{20,}" },
    { id: "github-token", regex: "(ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}" },
    { id: "private-key-pem", regex: "-----BEGIN [A-Z ]*PRIVATE KEY-----" },
  ];
  const historyFindings = [];
  for (const pattern of patterns) {
    const result = spawnSync("git", ["log", "--all", "--format=%H", "-G", pattern.regex], {
      cwd: rootDir,
      encoding: "utf8",
      maxBuffer: 5 * 1024 * 1024,
    });
    if (result.status !== 0) {
      addCheck("Git history secret scan", false, `git log failed for ${pattern.id}`, "warn");
      return;
    }
    const commits = result.stdout.trim().split(/\r?\n/).filter(Boolean);
    for (const commit of commits) {
      historyFindings.push({
        scope: "git-history",
        commit: commit.slice(0, 12),
        pattern: pattern.id,
      });
    }
  }
  findings.push(...historyFindings);
  addCheck(
    "Git history secret scan",
    historyFindings.length === 0,
    historyFindings.length === 0
      ? "no high-confidence private key/token patterns in commit history"
      : "high-confidence secret pattern found in commit history",
    "block",
  );
}

function secretPatterns() {
  return [
    {
      id: "sui-private-key",
      regex: /suiprivkey[1-9A-HJ-NP-Za-km-z]{20,}/,
    },
    {
      id: "github-token",
      regex: /(ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}/,
    },
    {
      id: "cloudflare-token-assignment",
      regex: /CLOUDFLARE_API_TOKEN\s*[:=]\s*["']?[A-Za-z0-9_\-.]{20,}/,
    },
    {
      id: "sponsor-key-assignment",
      regex: /SPONSOR_PRIVATE_KEY\s*[:=]\s*["']?(?!<)[A-Za-z0-9_:-]{20,}/,
    },
    {
      id: "private-key-pem",
      regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    },
  ];
}

function isAllowedPlaceholder(line, patternId) {
  if (line.includes("${{ secrets.")) {
    return true;
  }
  if (line.includes("<sui-private-key>")) {
    return true;
  }
  if (patternId === "sponsor-key-assignment" && /SPONSOR_PRIVATE_KEY\s*=\s*["']?\s*["']?$/.test(line)) {
    return true;
  }
  return false;
}

function isSensitiveTrackedPath(file) {
  return (
    file === ".env" ||
    file === ".env.local" ||
    file.startsWith(".data/") ||
    file.endsWith(".pem") ||
    file.endsWith(".key") ||
    /(^|\/)(secret|credential|private-key|wallet)\./i.test(file)
  );
}

function skipContentScan(file) {
  return (
    file === "package-lock.json" ||
    file.endsWith(".png") ||
    file.endsWith(".jpg") ||
    file.endsWith(".jpeg") ||
    file.endsWith(".gif") ||
    file.endsWith(".webp")
  );
}

function gitLines(command) {
  const result = spawnSync("git", command, {
    cwd: rootDir,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`git ${command.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout.split(/\r?\n/).filter(Boolean);
}

function addCheck(name, ok, detail, failStatus = "block") {
  checks.push({
    name,
    status: ok ? "ok" : failStatus,
    detail,
  });
}

function printHuman(summary) {
  console.log("SuiPayLink public repository preflight");
  console.log(`Generated: ${summary.generatedAt}`);
  console.log(`Public-ready check: ${summary.okToConsiderPublic ? "PASS" : "BLOCKED"}`);
  console.log(`Totals: ok=${summary.totals.ok}, warn=${summary.totals.warn}, block=${summary.totals.block}, findings=${summary.totals.findings}`);
  console.log("");
  for (const check of summary.checks) {
    console.log(`${label(check.status)} ${check.name}: ${check.detail}`);
  }
  if (summary.findings.length > 0) {
    console.log("");
    console.log("Findings:");
    for (const finding of summary.findings) {
      if (finding.scope === "tracked-file") {
        console.log(`- ${finding.pattern}: ${finding.file}:${finding.line}`);
      } else {
        console.log(`- ${finding.pattern}: commit ${finding.commit}`);
      }
    }
  }
}

function label(status) {
  return {
    ok: "[OK]",
    warn: "[WARN]",
    block: "[BLOCK]",
  }[status] ?? "[UNKNOWN]";
}
