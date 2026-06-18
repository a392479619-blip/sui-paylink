#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const deploymentFile = resolve(rootDir, "deployments/testnet.json");
const evidenceFile = resolve(rootDir, "deployments/testnet-sponsored-mock-usdc-smoke.json");
const deployerAlias = process.env.DEPLOYER_ALIAS ?? "suipaylink-testnet-deployer";
const feeBps = Number(process.env.FEE_BPS ?? "100");
const paymentUnits = process.env.PAYMENT_UNITS ?? "100000000";
const sponsorFundingMist = process.env.SPONSOR_FUNDING_MIST ?? "45000000";
const sponsorCreateGasBudgetMist = process.env.SPONSOR_CREATE_GAS_BUDGET_MIST ?? "20000000";
const sponsorActionGasBudgetMist = process.env.SPONSOR_ACTION_GAS_BUDGET_MIST ?? "10000000";
const apiPort = Number(process.env.SPONSORED_SMOKE_API_PORT ?? "8791");
const apiBaseUrl = `http://127.0.0.1:${apiPort}`;
const proofUri = process.env.PROOF_URI ?? "https://example.com/proofs/suipaylink-sponsored-testnet-delivery.pdf";
const suiType = "0x2::sui::SUI";
const client = new SuiJsonRpcClient({
  network: "testnet",
  url: getJsonRpcFullnodeUrl("testnet"),
});

let originalAddress = "";
let server;

try {
  await assertTestnet();
  originalAddress = (await runSui(["client", "active-address"])).stdout.trim();

  const deployment = JSON.parse(await readFile(deploymentFile, "utf8"));
  const packageId = requireString(deployment.packageId, "packageId");
  const mockUsdc = deployment.mockUsdc ?? {};
  const mockUsdcType = requireString(mockUsdc.coinType, "mockUsdc.coinType");
  const treasuryCapId = requireString(mockUsdc.treasuryCapId, "mockUsdc.treasuryCapId");
  const feeReceiver = requireString(deployment.deployer, "deployer");

  const sponsor = Ed25519Keypair.generate();
  const buyer = Ed25519Keypair.generate();
  const seller = Ed25519Keypair.generate();
  const sponsorAddress = sponsor.toSuiAddress();
  const buyerAddress = buyer.toSuiAddress();
  const sellerAddress = seller.toSuiAddress();

  const initialBalances = {
    buyerSui: await balance(buyerAddress, suiType),
    sellerSui: await balance(sellerAddress, suiType),
    sponsorSui: await balance(sponsorAddress, suiType),
  };
  if (initialBalances.buyerSui !== "0" || initialBalances.sellerSui !== "0") {
    throw new Error("Fresh buyer/seller unexpectedly have SUI");
  }

  const fundSponsor = await fundSponsorFromDeployer(sponsorAddress);
  const sponsorBalanceAfterFunding = await balance(sponsorAddress, suiType);

  server = await startApiServer({
    sponsorSecretKey: sponsor.getSecretKey(),
    packageId,
    mockUsdcType,
    feeReceiver,
  });

  const config = await apiGet("/api/config");
  if (!config.sponsorEnabled || config.sponsorAddress !== sponsorAddress) {
    throw new Error("API sponsor config does not match the smoke sponsor");
  }
  if (!config.mockUsdcMintEnabled) {
    throw new Error("API MockUSDC minting is not enabled");
  }

  const mintMockUsdc = await apiPost("/api/mock-usdc/mint", {
    recipientAddress: buyerAddress,
    amountUnits: paymentUnits,
  });
  const paymentCoinId = requireString(mintMockUsdc.coinObjectId, "mintMockUsdc.coinObjectId");
  const buyerMockUsdcAfterMint = await balance(buyerAddress, mockUsdcType);

  const paylink = await apiPost("/api/paylinks", {
    mode: "escrow",
    sellerName: "Sponsored Smoke Seller",
    sellerAddress,
    buyerName: "Sponsored Smoke Buyer",
    buyerAddress,
    amount: "100",
    token: "mUSDC",
    memo: "SuiPayLink sponsored idempotency smoke",
    feeBps,
  });
  const paylinkFundBuild = {
    action: "fund-mock-usdc",
    senderAddress: buyerAddress,
    sellerAddress,
    paymentCoinId,
    expectedAmountUnits: paymentUnits,
    feeBps,
    feeReceiverAddress: feeReceiver,
    gasBudgetMist: sponsorCreateGasBudgetMist,
    paylinkId: paylink.id,
  };
  const stalePaylinkFundRecord = await apiPost("/api/sponsored-transactions/build", paylinkFundBuild);
  const duplicatePaylinkFund = await apiPostExpectError(
    "/api/sponsored-transactions/build",
    paylinkFundBuild,
    409,
    "duplicate_sponsored_action",
  );

  const fundRecord = await buildSignSubmit({
    signer: buyer,
    build: {
      action: "fund-mock-usdc",
      senderAddress: buyerAddress,
      sellerAddress,
      paymentCoinId,
      expectedAmountUnits: paymentUnits,
      feeBps,
      feeReceiverAddress: feeReceiver,
      gasBudgetMist: sponsorCreateGasBudgetMist,
    },
  });
  const fundTx = await waitTx(fundRecord.digest);
  const escrowObjectId = findCreatedEscrow(fundTx);

  const deliverRecord = await buildSignSubmit({
    signer: seller,
    build: {
      action: "mark-delivered",
      senderAddress: sellerAddress,
      escrowObjectId,
      deliveryProofUri: proofUri,
      gasBudgetMist: sponsorActionGasBudgetMist,
    },
  });
  await waitTx(deliverRecord.digest);

  const releaseRecord = await buildSignSubmit({
    signer: buyer,
    build: {
      action: "release",
      senderAddress: buyerAddress,
      escrowObjectId,
      gasBudgetMist: sponsorActionGasBudgetMist,
    },
  });
  const releaseTx = await waitTx(releaseRecord.digest);
  const stalePaylinkFundSignature = await buyer.signTransaction(
    Buffer.from(stalePaylinkFundRecord.transactionBytes, "base64"),
  );
  const stalePaylinkFundSubmit = await apiPostExpectOneOfErrors(
    `/api/sponsored-transactions/${stalePaylinkFundRecord.id}/submit`,
    {
      userSignature: stalePaylinkFundSignature.signature,
    },
    [
      { status: 400, code: "sponsored_transaction_dry_run_failed" },
      { status: 502, code: "sui_rpc_error" },
    ],
  );
  const stalePaylinkFundAfterSubmit = await apiGet(`/api/sponsored-transactions/${stalePaylinkFundRecord.id}`);
  const finalObject = await readEscrowObject(escrowObjectId);
  const finalBalances = {
    buyerSui: await balance(buyerAddress, suiType),
    sellerSui: await balance(sellerAddress, suiType),
    sponsorSui: await balance(sponsorAddress, suiType),
    buyerMockUsdc: await balance(buyerAddress, mockUsdcType),
    sellerMockUsdc: await balance(sellerAddress, mockUsdcType),
    feeReceiverMockUsdc: await balance(feeReceiver, mockUsdcType),
  };

  assertFinalState(finalObject, {
    buyerAddress,
    sellerAddress,
    feeReceiver,
  });
  if (finalBalances.buyerSui !== "0" || finalBalances.sellerSui !== "0") {
    throw new Error("Buyer or seller received SUI during sponsored smoke");
  }

  const releaseEvent = findEvent(releaseTx, "::EscrowReleased");
  const verifiedAt = new Date().toISOString();
  const evidence = {
    network: "testnet",
    packageId,
    mockUsdc: {
      coinType: mockUsdcType,
      treasuryCapId,
      symbol: "mUSDC",
      decimals: 6,
      paymentUnits: Number(paymentUnits),
      testOnly: true,
    },
    buyer: buyerAddress,
    seller: sellerAddress,
    sponsor: sponsorAddress,
    feeReceiver,
    escrowObjectId,
    initialBalances,
    sponsorBalanceAfterFunding,
    buyerMockUsdcAfterMint,
    finalBalances,
    sponsorGasBudgetsMist: {
      createFundedEscrow: sponsorCreateGasBudgetMist,
      markDelivered: sponsorActionGasBudgetMist,
      release: sponsorActionGasBudgetMist,
    },
    digests: {
      fundSponsorGas: fundSponsor.digest,
      mintMockUsdc: mintMockUsdc.digest,
      createFundedEscrow: fundRecord.digest,
      markDelivered: deliverRecord.digest,
      release: releaseRecord.digest,
    },
    sponsoredTransactions: {
      createFundedEscrow: pickRecord(fundRecord),
      markDelivered: pickRecord(deliverRecord),
      release: pickRecord(releaseRecord),
    },
    paylinkIdempotency: {
      paylinkId: paylink.id,
      staleBuild: pickRecord(stalePaylinkFundRecord),
      duplicateBuild: duplicatePaylinkFund,
      staleSubmit: stalePaylinkFundSubmit,
      staleBuildAfterRejectedSubmit: pickRecord(stalePaylinkFundAfterSubmit),
    },
    releaseEvent,
    finalObject,
    verifiedAt,
  };

  await mkdir(dirname(evidenceFile), { recursive: true });
  await writeFile(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  if (server) {
    server.kill("SIGINT");
    await new Promise((resolveDone) => server.once("close", resolveDone));
  }
  if (originalAddress) {
    await runSui(["client", "switch", "--address", originalAddress], { allowFailure: true });
  }
}

async function assertTestnet() {
  const env = (await runSui(["client", "active-env"])).stdout.trim();
  if (env !== "testnet") {
    throw new Error("Active Sui environment must be testnet. Run: sui client switch --env testnet");
  }
}

async function fundSponsorFromDeployer(sponsorAddress) {
  await runSui(["client", "switch", "--address", deployerAlias]);
  const gasCoins = await selectGasCoins(BigInt(sponsorFundingMist) + 10_000_000n);
  const result = await runSui([
    "client",
    "pay-sui",
    "--input-coins",
    ...gasCoins,
    "--recipients",
    sponsorAddress,
    "--amounts",
    sponsorFundingMist,
    "--gas-budget",
    "10000000",
    "--json",
  ]);
  const tx = JSON.parse(result.stdout);
  assertSuiSuccess(tx, "fund sponsor");
  return tx;
}

async function selectGasCoins(requiredMist) {
  const result = await runSui(["client", "gas", "--json"]);
  const coins = JSON.parse(result.stdout)
    .map((coin) => ({
      id: coin.gasCoinId,
      balance: BigInt(coin.mistBalance),
    }))
    .sort((a, b) => Number(b.balance - a.balance));
  const selected = [];
  let total = 0n;
  for (const coin of coins) {
    selected.push(coin.id);
    total += coin.balance;
    if (total >= requiredMist) {
      return selected;
    }
  }
  throw new Error(`Insufficient deployer SUI. Need ${requiredMist.toString()} MIST, have ${total.toString()} MIST`);
}

async function mintMockUsdcToBuyer({ packageId, treasuryCapId, buyerAddress }) {
  await runSui(["client", "switch", "--address", deployerAlias]);
  const result = await runSui([
    "client",
    "call",
    "--package",
    packageId,
    "--module",
    "mock_usdc",
    "--function",
    "mint",
    "--args",
    treasuryCapId,
    paymentUnits,
    buyerAddress,
    "--gas-budget",
    "10000000",
    "--json",
  ]);
  const tx = JSON.parse(result.stdout);
  assertSuiSuccess(tx, "mint MockUSDC");
  return tx;
}

async function startApiServer({ sponsorSecretKey, packageId, mockUsdcType, feeReceiver }) {
  const child = spawn("npx", ["tsx", "apps/api/src/server.ts"], {
    cwd: rootDir,
    env: {
      ...process.env,
      PORT: String(apiPort),
      SUI_NETWORK: "testnet",
      SPONSOR_MODE: "self-sponsored",
      SPONSOR_PRIVATE_KEY: sponsorSecretKey,
      SUI_PACKAGE_ID: packageId,
      MOCK_USDC_COIN_TYPE: mockUsdcType,
      FEE_RECEIVER_ADDRESS: feeReceiver,
      SPONSOR_GAS_BUDGET_MIST: sponsorCreateGasBudgetMist,
      MAX_SPONSOR_GAS_BUDGET_MIST: "50000000",
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
      if (health.ok) {
        return child;
      }
    } catch {
      await delay(250);
    }
  }
  child.kill("SIGINT");
  throw new Error(`Timed out waiting for API server: ${logs}`);
}

async function buildSignSubmit({ signer, build }) {
  const built = await apiPost("/api/sponsored-transactions/build", build);
  const signature = await signer.signTransaction(Buffer.from(built.transactionBytes, "base64"));
  const submitted = await apiPost(`/api/sponsored-transactions/${built.id}/submit`, {
    userSignature: signature.signature,
  });
  if (submitted.status !== "executed") {
    throw new Error(`Sponsored transaction failed: ${JSON.stringify(submitted)}`);
  }
  return submitted;
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

async function apiPostExpectOneOfErrors(path, body, expectedErrors) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  const matched = expectedErrors.some((expected) => response.status === expected.status && json.code === expected.code);
  if (!matched) {
    throw new Error(
      `Expected API one of ${JSON.stringify(expectedErrors)}, got ${response.status}: ${JSON.stringify(json)}`,
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

async function waitTx(digest) {
  if (!digest) {
    throw new Error("Missing transaction digest");
  }
  const tx = await client.waitForTransaction({
    digest,
    timeout: 60_000,
    pollInterval: 1_000,
    options: {
      showBalanceChanges: true,
      showEffects: true,
      showEvents: true,
      showObjectChanges: true,
    },
  });
  assertSuiSuccess(tx, digest);
  return tx;
}

async function readEscrowObject(objectId) {
  const response = await client.getObject({
    id: objectId,
    options: {
      showContent: true,
      showOwner: true,
      showPreviousTransaction: true,
      showType: true,
    },
  });
  if (response.error || !response.data) {
    throw new Error(`Escrow object not found: ${objectId}`);
  }
  const content = response.data.content;
  if (!content || content.dataType !== "moveObject") {
    throw new Error(`Escrow object is not a parsed Move object: ${objectId}`);
  }
  return {
    objectId,
    objectType: response.data.type,
    previousTransaction: response.data.previousTransaction,
    owner: response.data.owner,
    buyer: content.fields.buyer,
    seller: content.fields.seller,
    feeReceiver: content.fields.fee_receiver,
    delivered: content.fields.delivered,
    released: content.fields.released,
    refunded: content.fields.refunded,
    funds: content.fields.funds,
  };
}

async function balance(owner, coinType) {
  const result = await client.getBalance({ owner, coinType });
  return result.totalBalance;
}

function findCreatedCoin(tx, coinType) {
  const created = tx.objectChanges?.find(
    (change) =>
      change.type === "created" &&
      change.objectType?.startsWith("0x2::coin::Coin<") &&
      change.objectType?.includes(coinType),
  );
  if (!created?.objectId) {
    throw new Error("Mint succeeded but no MockUSDC coin object was found");
  }
  return created.objectId;
}

function findCreatedEscrow(tx) {
  const created = tx.objectChanges?.find(
    (change) => change.type === "created" && change.objectType?.includes("::escrow::Escrow"),
  );
  if (!created?.objectId) {
    throw new Error("Sponsored fund succeeded but no Escrow object was found");
  }
  return created.objectId;
}

function findEvent(tx, suffix) {
  return tx.events?.find((event) => event.type.endsWith(suffix))?.parsedJson;
}

function assertSuiSuccess(tx, label) {
  const status = tx.effects?.status?.status;
  if (status !== "success") {
    throw new Error(`${label} failed: ${JSON.stringify(tx.effects?.status ?? tx)}`);
  }
}

function assertFinalState(finalObject, { buyerAddress, sellerAddress, feeReceiver }) {
  if (finalObject.buyer !== buyerAddress) {
    throw new Error("Final escrow buyer mismatch");
  }
  if (finalObject.seller !== sellerAddress) {
    throw new Error("Final escrow seller mismatch");
  }
  if (finalObject.feeReceiver !== feeReceiver) {
    throw new Error("Final escrow fee receiver mismatch");
  }
  if (finalObject.delivered !== true || finalObject.released !== true || finalObject.refunded !== false) {
    throw new Error(`Final escrow flags are invalid: ${JSON.stringify(finalObject)}`);
  }
  if (String(finalObject.funds) !== "0") {
    throw new Error(`Final escrow funds are not empty: ${finalObject.funds}`);
  }
}

function pickRecord(record) {
  return {
    id: record.id,
    action: record.action,
    status: record.status,
    sender: record.sender,
    sponsor: record.sponsor,
    packageId: record.packageId,
    coinType: record.coinType,
    digest: record.digest,
    escrowObjectId: record.escrowObjectId,
    createdAt: record.createdAt,
    submittedAt: record.submittedAt,
    executedAt: record.executedAt,
  };
}

function requireString(value, fieldName) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing deployment field: ${fieldName}`);
  }
  return value;
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

function runSui(args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn("sui", args, {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", rejectRun);
    child.on("close", (code) => {
      const result = { code, stdout, stderr };
      if (code === 0 || options.allowFailure) {
        resolveRun(result);
        return;
      }
      rejectRun(new Error(`sui ${args.join(" ")} failed with ${code}: ${stderr || stdout}`));
    });
  });
}
