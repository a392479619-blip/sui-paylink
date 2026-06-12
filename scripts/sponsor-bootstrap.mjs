#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { getFaucetHost, requestSuiFromFaucetV2 } from "@mysten/sui/faucet";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { config as loadEnv } from "dotenv";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const envPath = resolve(rootDir, ".env.local");

loadIfExists(resolve(rootDir, ".env.local"));
loadIfExists(resolve(rootDir, ".env"));
loadIfExists(resolve(rootDir, "apps/api/.env.local"));
loadIfExists(resolve(rootDir, "apps/api/.env"));

const network = valueArg("--network") ?? process.env.SUI_NETWORK ?? "testnet";
const existingSecret = process.env.SPONSOR_PRIVATE_KEY;
const keypair = existingSecret ? sponsorSignerFromSecret(existingSecret) : Ed25519Keypair.generate();
const sponsorPrivateKey = existingSecret ?? keypair.getSecretKey();
const sponsorAddress = keypair.getPublicKey().toSuiAddress();
const writeEnvLocal = args.has("--write-env-local");
const requestFaucet = args.has("--request-faucet");
const runReadiness = args.has("--readiness");
const printSecret = args.has("--print-secret");
let faucetFailed = false;

const summary = {
  ok: true,
  network,
  sponsorAddress,
  reusedExistingKey: Boolean(existingSecret),
  envFile: writeEnvLocal ? envPath : undefined,
  envFileWritten: false,
  faucet: undefined,
  balanceMist: undefined,
  readiness: undefined,
  next: [
    "Keep .env.local private. It is gitignored.",
    "Run npm run sponsor:readiness before recording real sponsored browser flow.",
    "Set the same SPONSOR_PRIVATE_KEY in the hosted environment only if you are ready to sponsor Testnet gas.",
  ],
};

try {
  if (writeEnvLocal) {
    upsertEnvFile(envPath, {
      SUI_NETWORK: network,
      SPONSOR_PRIVATE_KEY: sponsorPrivateKey,
      SPONSOR_MODE: "self-sponsored",
    });
    summary.envFileWritten = true;
  }

  if (requestFaucet) {
    summary.faucet = await requestSponsorFaucet(network, sponsorAddress);
    if (!summary.faucet.ok) {
      faucetFailed = true;
    }
  }

  summary.balanceMist = await getBalanceMist(network, sponsorAddress);

  if (runReadiness) {
    summary.readiness = runSponsorReadiness(sponsorPrivateKey, network);
    summary.ok = summary.readiness.exitCode === 0;
  } else if (faucetFailed) {
    summary.ok = false;
  }

  if (printSecret) {
    summary.env = {
      SUI_NETWORK: network,
      SPONSOR_MODE: "self-sponsored",
      SPONSOR_PRIVATE_KEY: sponsorPrivateKey,
    };
  }
} catch (error) {
  summary.ok = false;
  summary.error = errorMessage(error);
}

console.log(JSON.stringify(summary, null, 2));
if (!summary.ok) {
  process.exitCode = 1;
}

function valueArg(name) {
  const prefix = `${name}=`;
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function loadIfExists(path) {
  if (existsSync(path)) {
    loadEnv({ path, override: false, quiet: true });
  }
}

function sponsorSignerFromSecret(secret) {
  const decoded = decodeSuiPrivateKey(secret);
  if (decoded.scheme !== "ED25519") {
    throw new Error(`sponsor-bootstrap only writes Ed25519 keys; existing key scheme is ${decoded.scheme}`);
  }
  return Ed25519Keypair.fromSecretKey(decoded.secretKey);
}

async function requestSponsorFaucet(targetNetwork, recipient) {
  const host = getFaucetHost(targetNetwork);
  try {
    const response = await requestSuiFromFaucetV2({ host, recipient });
    return {
      ok: true,
      host,
      status: response.status,
    };
  } catch (error) {
    return {
      ok: false,
      host,
      error: errorMessage(error),
    };
  }
}

async function getBalanceMist(targetNetwork, owner) {
  const client = new SuiJsonRpcClient({
    network: targetNetwork,
    url: getJsonRpcFullnodeUrl(targetNetwork),
  });
  const balance = await client.getBalance({ owner, coinType: "0x2::sui::SUI" });
  return balance.totalBalance;
}

function runSponsorReadiness(secret, targetNetwork) {
  const result = spawnSync("npm", ["run", "sponsor:readiness"], {
    cwd: rootDir,
    env: {
      ...process.env,
      SUI_NETWORK: targetNetwork,
      SPONSOR_PRIVATE_KEY: secret,
    },
    encoding: "utf8",
  });
  return {
    exitCode: result.status ?? 1,
    stdout: redactSecret(result.stdout, secret),
    stderr: redactSecret(result.stderr, secret),
  };
}

function upsertEnvFile(path, values) {
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  const lines = existing ? existing.split(/\r?\n/) : [];
  const nextLines = [];
  const remaining = new Map(Object.entries(values));

  for (const line of lines) {
    const key = line.match(/^([A-Z0-9_]+)=/)?.[1];
    if (key && remaining.has(key)) {
      nextLines.push(`${key}=${remaining.get(key)}`);
      remaining.delete(key);
    } else if (line.trim() !== "") {
      nextLines.push(line);
    }
  }

  for (const [key, value] of remaining.entries()) {
    nextLines.push(`${key}=${value}`);
  }

  writeFileSync(path, `${nextLines.join("\n")}\n`, { mode: 0o600 });
}

function redactSecret(value, secret) {
  return value ? value.replaceAll(secret, "[redacted]") : value;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
