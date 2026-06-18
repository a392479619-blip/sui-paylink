import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const port = await getOpenPort();
const baseUrl = `http://127.0.0.1:${port}`;
const tmpStoreDir = await mkdtemp(join(tmpdir(), "suipaylink-preview-smoke-"));
let server;
const logs = [];

try {
  server = spawn("npm", ["start"], {
    cwd: rootDir,
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      PUBLIC_BASE_URL: baseUrl,
      SERVE_WEB_APP: "true",
      DEMO_SEED_ENABLED: "true",
      DEMO_SEED_PAYLINK_ID: "demo-preview",
      PAYLINK_STORE_PATH: join(tmpStoreDir, "paylinks.json"),
      SPONSORED_TRANSACTION_STORE_PATH: join(tmpStoreDir, "sponsored-transactions.json"),
      SPONSOR_PRIVATE_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  server.stdout.on("data", (chunk) => logs.push(chunk.toString()));
  server.stderr.on("data", (chunk) => logs.push(chunk.toString()));

  await waitForJson(`${baseUrl}/health`, 15_000);

  const health = await getJson(`${baseUrl}/health`);
  assert(health.ok === true, "health.ok should be true");
  assert(health.service === "sui-paylink-api", "unexpected health service name");

  const config = await getJson(`${baseUrl}/api/config`);
  assert(config.publicBaseUrl === baseUrl, "PUBLIC_BASE_URL was not reflected by /api/config");
  assert(config.sponsorEnabled === false, "preview smoke should not use a sponsor private key");

  const seeded = await getJson(`${baseUrl}/api/paylinks/demo-preview`);
  assert(seeded.id === "demo-preview", "demo seed id was not stable");
  assert(seeded.demoSeed === true, "demo seed should be marked");
  assert(seeded.publicUrl === `${baseUrl}/pay/demo-preview`, "demo seed publicUrl should use PUBLIC_BASE_URL");

  const seededFunded = await postJson(`${baseUrl}/api/paylinks/demo-preview/fund`, {});
  assert(seededFunded.status === "funded", "demo seed fund action failed");
  const seededDelivered = await postJson(`${baseUrl}/api/paylinks/demo-preview/deliver`, {
    deliveryProofUri: "https://example.com/proofs/preview-smoke-demo.pdf",
  });
  assert(seededDelivered.status === "delivered", "demo seed deliver action failed");
  const seededReleased = await postJson(`${baseUrl}/api/paylinks/demo-preview/release`, {});
  assert(seededReleased.status === "released", "demo seed release action failed");
  const seededReceipt = await getJson(`${baseUrl}/api/paylinks/demo-preview/receipt`);
  assert(seededReceipt.paylink.status === "released", "demo seed receipt did not reach released");
  assert(seededReceipt.sellerAmount === "99.00", "demo seed receipt seller amount mismatch");

  const created = await postJson(`${baseUrl}/api/paylinks`, {
    mode: "escrow",
    sellerName: "Preview Smoke Seller",
    sellerAddress: "0x648badce46f20a771d805670901239e868f5d0c7e297a3616b579075a800f9f5",
    buyerName: "Preview Smoke Buyer",
    buyerAddress: "0x3bb115974618e32b56dd6fb259b1c8cbfce72177fe7a36ab618e245ef19ca3f1",
    amount: "100",
    token: "mUSDC",
    memo: "Production preview smoke paylink",
    feeBps: 100,
  });
  assert(created.publicUrl === `${baseUrl}/pay/${created.id}`, "Paylink publicUrl should use PUBLIC_BASE_URL");

  const rootHtml = await getText(`${baseUrl}/`);
  assert(rootHtml.includes("<title>SuiPayLink</title>"), "root route did not return the web app");
  assert(!rootHtml.includes("127.0.0.1:8787"), "production HTML should not point to local dev API");

  const createHtml = await getText(`${baseUrl}/create`);
  assert(createHtml.includes("<title>SuiPayLink</title>"), "create route did not return the web app");

  const paylinkHtml = await getText(`${baseUrl}/pay/${created.id}`);
  assert(paylinkHtml.includes("<title>SuiPayLink</title>"), "paylink route did not return the web app");

  const buyerHtml = await getText(`${baseUrl}/buyer/${created.id}`);
  assert(buyerHtml.includes("<title>SuiPayLink</title>"), "buyer route did not return the web app");

  const sellerHtml = await getText(`${baseUrl}/seller/${created.id}`);
  assert(sellerHtml.includes("<title>SuiPayLink</title>"), "seller route did not return the web app");

  const seededPaylinkHtml = await getText(`${baseUrl}/pay/demo-preview`);
  assert(seededPaylinkHtml.includes("<title>SuiPayLink</title>"), "demo seed route did not return the web app");

  const assetPath = extractFirstAssetPath(rootHtml);
  const assetResponse = await fetch(`${baseUrl}${assetPath}`);
  assert(assetResponse.ok, `asset ${assetPath} returned ${assetResponse.status}`);

  const unknownApi = await fetch(`${baseUrl}/api/not-real`);
  assert(unknownApi.status === 404, "unknown API route should stay a JSON 404 instead of web fallback");
  const unknownApiBody = await unknownApi.json();
  assert(unknownApiBody.error === "API route not found", "unknown API route returned unexpected body");

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        paylinkId: created.id,
        sponsorEnabled: config.sponsorEnabled,
        seededPaylinkId: seeded.id,
        checked: [
          "health",
          "config",
          "demo-seed",
          "demo-seed-mock-release",
          "create-paylink",
          "root-web",
          "create-web",
          "paylink-web",
          "buyer-web",
          "seller-web",
          "demo-seed-web",
          "asset",
          "api-404",
        ],
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  if (logs.length > 0) {
    console.error(logs.join(""));
  }
  process.exitCode = 1;
} finally {
  if (server && !server.killed) {
    await stopChild(server);
  }
  await rm(tmpStoreDir, { force: true, recursive: true });
}

async function getJson(url) {
  const response = await fetch(url);
  assert(response.ok, `${url} returned ${response.status}`);
  return response.json();
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function getText(url) {
  const response = await fetch(url);
  assert(response.ok, `${url} returned ${response.status}`);
  return response.text();
}

async function waitForJson(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      return await getJson(url);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError ?? new Error(`Timed out waiting for ${url}`);
}

function extractFirstAssetPath(html) {
  const match = html.match(/(?:src|href)="(\/assets\/[^"]+)"/);
  assert(match?.[1], "web app HTML did not reference a built asset");
  return match[1];
}

async function getOpenPort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  assert(typeof address === "object" && address?.port, "failed to allocate local port");
  return address.port;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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
