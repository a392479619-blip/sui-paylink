#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const apiPort = Number(process.env.API_REGRESSION_PORT ?? "8792");
const apiBaseUrl = `http://127.0.0.1:${apiPort}`;
const buyerAddress = "0x3bb115974618e32b56dd6fb259b1c8cbfce72177fe7a36ab618e245ef19ca3f1";
const sellerAddress = "0x648badce46f20a771d805670901239e868f5d0c7e297a3616b579075a800f9f5";

let server;
let temporaryDir;

try {
  temporaryDir = await mkdtemp(join(tmpdir(), "suipaylink-api-smoke-"));
  server = await startApiServer(temporaryDir);

  const health = await apiGet("/health");
  assertEqual(health.ok, true, "health.ok");
  assertEqual(health.sponsorEnabled, false, "health.sponsorEnabled");

  const config = await apiGet("/api/config");
  assertEqual(config.network, "testnet", "config.network");
  assertEqual(config.sponsorEnabled, false, "config.sponsorEnabled");
  assertEqual(config.supportedTokens[0].gaslessEligible, false, "mUSDC gaslessEligible");

  const paylink = await createPaylink("Local API regression smoke");
  assertEqual(paylink.status, "created", "created paylink status");
  assertEqual(paylink.publicUrl, `http://127.0.0.1:5199/pay/${paylink.id}`, "publicUrl");

  const listed = await apiGet("/api/paylinks");
  assertEqual(listed.length, 1, "paylink list length");
  assertEqual(listed[0].id, paylink.id, "listed paylink id");

  const receipt = await apiGet(`/api/paylinks/${paylink.id}/receipt`);
  assertEqual(receipt.sellerAmount, "99.00", "receipt sellerAmount");
  assertEqual(receipt.platformFee, "1.00", "receipt platformFee");
  assertEqual(receipt.timeline[0].status, "complete", "created timeline");

  const chainPending = await apiPost(`/api/paylinks/${paylink.id}/sync-chain`, {});
  assertEqual(chainPending.chain.status, "pending", "chain pending status");
  assertEqual(chainPending.chain.digests.length, 0, "chain pending digests");
  assertIncludes(chainPending.chain.errors[0], "No executed sponsored transaction", "chain pending error");

  const funded = await apiPost(`/api/paylinks/${paylink.id}/fund`, {});
  assertEqual(funded.status, "funded", "funded status");
  assertTruthy(funded.fundTransactionDigest, "fund digest");
  assertTruthy(funded.escrowObjectId, "mock escrow object");

  const delivered = await apiPost(`/api/paylinks/${paylink.id}/deliver`, {
    deliveryProofUri: "https://example.com/proofs/api-regression-smoke.pdf",
  });
  assertEqual(delivered.status, "delivered", "delivered status");

  const released = await apiPost(`/api/paylinks/${paylink.id}/release`, {});
  assertEqual(released.status, "released", "released status");
  assertTruthy(released.releaseTransactionDigest, "release digest");

  const finalReceipt = await apiGet(`/api/paylinks/${paylink.id}/receipt`);
  assertEqual(finalReceipt.paylink.status, "released", "final receipt paylink status");
  assertEqual(finalReceipt.timeline[3].status, "complete", "release timeline");

  const sponsorFailure = await apiPostExpectError(
    "/api/sponsored-transactions/build",
    {
      action: "fund-mock-usdc",
      senderAddress: buyerAddress,
      sellerAddress,
      paymentCoinId: "0x1111111111111111111111111111111111111111111111111111111111111111",
      expectedAmountUnits: "100000000",
      feeBps: 100,
      paylinkId: paylink.id,
    },
    503,
    "sponsor_not_configured",
  );

  const sponsoredRecords = await apiGet(`/api/sponsored-transactions?paylinkId=${paylink.id}`);
  assertEqual(sponsoredRecords.length, 0, "sponsored records in mock mode");

  const summary = {
    ok: true,
    apiBaseUrl,
    paylinkId: paylink.id,
    finalStatus: finalReceipt.paylink.status,
    chainStatusWithoutSponsoredDigest: chainPending.chain.status,
    sponsorFailure,
  };
  console.log(JSON.stringify(summary, null, 2));
} finally {
  if (server) {
    await stopChild(server);
  }
  if (temporaryDir) {
    await rm(temporaryDir, { force: true, recursive: true });
  }
}

async function startApiServer(storeDir) {
  const child = spawn("npx", ["tsx", "apps/api/src/server.ts"], {
    cwd: rootDir,
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      PORT: String(apiPort),
      PUBLIC_BASE_URL: "http://127.0.0.1:5199",
      PAYLINK_STORE_PATH: join(storeDir, "paylinks.json"),
      SPONSORED_TRANSACTION_STORE_PATH: join(storeDir, "sponsored-transactions.json"),
      SUI_NETWORK: "testnet",
      SPONSOR_MODE: "mock",
      SPONSOR_PRIVATE_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let logs = "";
  child.stdout.on("data", (chunk) => {
    logs += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    logs += chunk.toString();
  });

  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`API server exited early: ${logs}`);
    }
    try {
      const health = await apiGet("/health");
      if (health.ok === true) {
        return child;
      }
    } catch {
      await delay(250);
    }
  }

  child.kill("SIGINT");
  throw new Error(`Timed out waiting for API server: ${logs}`);
}

async function createPaylink(memo) {
  return apiPost("/api/paylinks", {
    mode: "escrow",
    sellerName: "Alice AI Automation Studio",
    sellerAddress,
    buyerName: "Bob from Sui Project",
    buyerAddress,
    amount: "100",
    token: "mUSDC",
    memo,
    feeBps: 100,
  });
}

async function apiGet(path) {
  const response = await fetch(`${apiBaseUrl}${path}`);
  return readApiResponse(response);
}

async function apiPost(path, body) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return readApiResponse(response);
}

async function apiPostExpectError(path, body, expectedStatus, expectedCode) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (response.status !== expectedStatus || json.code !== expectedCode) {
    throw new Error(
      `Expected API ${expectedStatus} ${expectedCode}, got ${response.status}: ${JSON.stringify(json)}`,
    );
  }
  return {
    status: response.status,
    code: json.code,
    error: json.error,
  };
}

async function readApiResponse(response) {
  const json = await response.json();
  if (!response.ok) {
    throw new Error(`API ${response.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTruthy(value, label) {
  if (!value) {
    throw new Error(`${label}: expected a truthy value`);
  }
}

function assertIncludes(value, expected, label) {
  if (typeof value !== "string" || !value.includes(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(value)} to include ${JSON.stringify(expected)}`);
  }
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  const closed = new Promise((resolveClose) => {
    child.once("close", resolveClose);
  });

  signalChild(child, "SIGTERM");
  let timeoutId;
  const timeout = new Promise((resolveTimeout) => {
    timeoutId = setTimeout(() => {
      signalChild(child, "SIGKILL");
      resolveTimeout();
    }, 5_000);
  });

  await Promise.race([closed, timeout]);
  clearTimeout(timeoutId);
}

function signalChild(child, signal) {
  try {
    if (process.platform !== "win32" && child.pid) {
      process.kill(-child.pid, signal);
      return;
    }
    child.kill(signal);
  } catch (error) {
    if (error?.code !== "ESRCH") {
      throw error;
    }
  }
}
