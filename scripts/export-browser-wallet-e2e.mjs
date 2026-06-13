#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { normalizeSuiAddress } from "@mysten/sui/utils";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = parseArgs(process.argv.slice(2));
const network = args.network ?? process.env.SUI_NETWORK ?? "testnet";
const paylinkStorePath = resolvePath(args.paylinks ?? process.env.PAYLINK_STORE_PATH ?? ".data/paylinks.json");
const recordStorePath = resolvePath(
  args.records ?? process.env.SPONSORED_TRANSACTION_STORE_PATH ?? ".data/sponsored-transactions.json",
);
const outputPath = resolvePath(args.out ?? "deployments/browser-wallet-sponsored-e2e.json");
const jsonOutput = Boolean(args.json);
const dryRun = Boolean(args.dryRun);

const client = new SuiJsonRpcClient({
  network,
  url: getJsonRpcFullnodeUrl(network),
});

try {
  const paylinks = readStoreArray(paylinkStorePath, "paylinks");
  const records = readStoreArray(recordStorePath, "records");
  const selected = selectPaylinkWithRecords(paylinks, records, args.paylinkId);
  const evidence = await buildEvidence(selected.paylink, selected.records);

  if (!dryRun) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ ok: true, outputPath, evidence }, null, 2));
  } else {
    console.log(`Browser-wallet sponsored E2E evidence ${dryRun ? "validated" : "written"}: ${outputPath}`);
    console.log(`Paylink: ${evidence.paylink.id}`);
    console.log(`Escrow: ${short(evidence.escrowObjectId)}`);
    console.log(`Digests: ${Object.values(evidence.digests).filter(Boolean).length}`);
    console.log(`Sponsor gas: ${evidence.gas.totalCostMist} MIST`);
  }
} catch (error) {
  const failure = {
    ok: false,
    error: errorMessage(error),
    nextAction: nextActionFor(errorMessage(error)),
  };
  if (jsonOutput) {
    console.log(JSON.stringify(failure, null, 2));
  } else {
    console.error(`Browser-wallet sponsored E2E evidence export failed: ${failure.error}`);
    console.error(`Next action: ${failure.nextAction}`);
  }
  process.exitCode = 1;
}

async function buildEvidence(paylink, executedRecords) {
  const actionRecords = requiredActionRecords(executedRecords);
  const settlementAction = actionRecords.release ? "release" : "refund";
  const orderedRecords = [
    actionRecords["fund-mock-usdc"],
    actionRecords["mark-delivered"],
    actionRecords[settlementAction],
  ];
  const checks = [];

  addCheck(checks, "Paylink is escrow", paylink.mode === "escrow", paylink.mode);
  addCheck(checks, "Paylink token is mUSDC", paylink.token === "mUSDC", paylink.token);
  addCheck(checks, "Final Paylink status matches settlement", paylink.status === settlementStatus(settlementAction), paylink.status);
  addCheck(checks, "Buyer signed fund", sameAddress(actionRecords["fund-mock-usdc"].sender, paylink.buyerAddress), actionRecords["fund-mock-usdc"].sender);
  addCheck(checks, "Seller signed delivery", sameAddress(actionRecords["mark-delivered"].sender, paylink.sellerAddress), actionRecords["mark-delivered"].sender);
  addCheck(checks, "Buyer signed settlement", sameAddress(actionRecords[settlementAction].sender, paylink.buyerAddress), actionRecords[settlementAction].sender);

  const sponsors = unique(orderedRecords.map((record) => normalizeAddress(record.sponsor)));
  const packageIds = unique(orderedRecords.map((record) => normalizeAddress(record.packageId)));
  const coinTypes = unique(orderedRecords.map((record) => record.coinType));
  addCheck(checks, "Single sponsor", sponsors.length === 1, sponsors.join(", "));
  addCheck(checks, "Single package", packageIds.length === 1, packageIds.join(", "));
  addCheck(checks, "Single coin type", coinTypes.length === 1, coinTypes.join(", "));

  const transactions = [];
  for (const record of orderedRecords) {
    const transaction = await readTransaction(record);
    transactions.push(transaction);
    addCheck(checks, `${record.action} succeeded`, transaction.effects?.status.status === "success", transaction.effects?.status.error ?? "success");
    addCheck(checks, `${record.action} sender matches record`, sameAddress(transaction.transaction?.data.sender, record.sender), transaction.transaction?.data.sender ?? "missing");
    addCheck(checks, `${record.action} gas owner is sponsor`, sameAddress(transaction.transaction?.data.gasData.owner, record.sponsor), transaction.transaction?.data.gasData.owner ?? "missing");
  }

  const escrowObjectId =
    paylink.escrowObjectId ??
    orderedRecords.find((record) => record.escrowObjectId)?.escrowObjectId ??
    extractCreatedEscrowObjectId(transactions[0], packageIds[0]);
  addCheck(checks, "Escrow object present", Boolean(escrowObjectId), escrowObjectId ?? "missing");

  const finalEscrow = escrowObjectId ? await readEscrowObject(escrowObjectId, packageIds[0]) : undefined;
  if (finalEscrow) {
    addCheck(checks, "Escrow buyer matches Paylink", sameAddress(finalEscrow.buyer, paylink.buyerAddress), finalEscrow.buyer);
    addCheck(checks, "Escrow seller matches Paylink", sameAddress(finalEscrow.seller, paylink.sellerAddress), finalEscrow.seller);
    addCheck(checks, "Escrow settlement state matches Paylink", finalEscrow[settlementStatus(settlementAction)] === true, JSON.stringify(finalEscrow));
  }

  const gasCosts = orderedRecords.map((record, index) => ({
    action: record.action,
    digest: requireDigest(record),
    gasCostMist: record.gasCostMist ?? actualGasCostMist(transactions[index]) ?? "0",
  }));
  const totalCostMist = gasCosts.reduce((total, item) => total + BigInt(item.gasCostMist), 0n).toString();
  const ok = checks.every((check) => check.ok);

  if (!ok) {
    throw new Error(`E2E evidence checks failed: ${checks.filter((check) => !check.ok).map((check) => check.name).join(", ")}`);
  }

  return {
    network,
    capturedAt: new Date().toISOString(),
    source: "browser-wallet-sponsored-flow",
    paylink: {
      id: paylink.id,
      status: paylink.status,
      amount: paylink.amount,
      token: paylink.token,
      memo: paylink.memo,
      buyer: normalizeAddress(paylink.buyerAddress),
      seller: normalizeAddress(paylink.sellerAddress),
      feeBps: paylink.feeBps,
    },
    sponsor: sponsors[0],
    packageId: packageIds[0],
    coinType: coinTypes[0],
    escrowObjectId,
    digests: {
      fundMockUsdc: requireDigest(actionRecords["fund-mock-usdc"]),
      markDelivered: requireDigest(actionRecords["mark-delivered"]),
      [settlementAction]: requireDigest(actionRecords[settlementAction]),
    },
    records: Object.fromEntries(
      orderedRecords.map((record) => [
        record.action,
        {
          id: record.id,
          sender: normalizeAddress(record.sender),
          sponsor: normalizeAddress(record.sponsor),
          status: record.status,
          digest: requireDigest(record),
          gasCostMist: record.gasCostMist,
          createdAt: record.createdAt,
          executedAt: record.executedAt,
        },
      ]),
    ),
    gas: {
      sponsorPaid: true,
      totalCostMist,
      byAction: gasCosts,
    },
    finalEscrow,
    explorer: Object.fromEntries(
      orderedRecords.map((record) => [record.action, explorerTxUrl(requireDigest(record))]),
    ),
    verification: {
      ok,
      checks,
    },
  };
}

function selectPaylinkWithRecords(paylinks, records, explicitPaylinkId) {
  if (explicitPaylinkId) {
    const paylink = paylinks.find((item) => item.id === explicitPaylinkId);
    if (!paylink) {
      throw new Error(`Paylink ${explicitPaylinkId} not found in ${paylinkStorePath}`);
    }
    const linkedRecords = records.filter((record) => record.paylinkId === explicitPaylinkId);
    return { paylink, records: linkedRecords };
  }

  const candidates = paylinks
    .map((paylink) => ({
      paylink,
      records: records.filter((record) => record.paylinkId === paylink.id),
    }))
    .filter((candidate) => hasRequiredExecutedRecords(candidate.records))
    .sort((a, b) => b.paylink.updatedAt.localeCompare(a.paylink.updatedAt));

  if (candidates[0]) {
    return candidates[0];
  }

  throw new Error(
    `No Paylink with executed fund-mock-usdc, mark-delivered, and release/refund sponsored records found. Pass --paylink-id after running the browser wallet flow.`,
  );
}

function requiredActionRecords(records) {
  const executed = records.filter((record) => record.status === "executed" && record.digest);
  const byAction = Object.fromEntries(executed.map((record) => [record.action, record]));
  const missing = ["fund-mock-usdc", "mark-delivered"].filter((action) => !byAction[action]);
  if (!byAction.release && !byAction.refund) {
    missing.push("release/refund");
  }
  if (missing.length > 0) {
    throw new Error(`Missing executed sponsored action(s): ${missing.join(", ")}`);
  }
  return byAction;
}

function hasRequiredExecutedRecords(records) {
  try {
    requiredActionRecords(records);
    return true;
  } catch {
    return false;
  }
}

async function readTransaction(record) {
  return client.getTransactionBlock({
    digest: requireDigest(record),
    options: {
      showBalanceChanges: true,
      showEffects: true,
      showEvents: true,
      showInput: true,
      showObjectChanges: true,
    },
  });
}

async function readEscrowObject(objectId, packageId) {
  const response = await client.getObject({
    id: objectId,
    options: {
      showContent: true,
      showOwner: true,
      showType: true,
    },
  });
  if (response.error || !response.data) {
    throw new Error(`Escrow object ${objectId} not found: ${JSON.stringify(response.error ?? {})}`);
  }
  const data = response.data;
  if (!data.type?.includes(`${packageId}::escrow::Escrow<`)) {
    throw new Error(`Object ${objectId} is not a SuiPayLink escrow for package ${packageId}`);
  }
  const content = data.content;
  if (!content || content.dataType !== "moveObject" || !("fields" in content)) {
    throw new Error(`Escrow object ${objectId} is not parsed`);
  }
  const fields = content.fields;
  return {
    objectId,
    objectType: data.type,
    buyer: normalizeAddress(String(fields.buyer ?? "")),
    seller: normalizeAddress(String(fields.seller ?? "")),
    funded: Boolean(fields.funded),
    delivered: Boolean(fields.delivered),
    released: Boolean(fields.released),
    refunded: Boolean(fields.refunded),
    funds: String(fields.funds ?? ""),
  };
}

function readStoreArray(path, key) {
  if (!existsSync(path)) {
    throw new Error(`${path} is missing`);
  }
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  const values = Array.isArray(parsed) ? parsed : parsed[key];
  if (!Array.isArray(values)) {
    throw new Error(`${path} does not contain ${key}`);
  }
  return values;
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) {
      throw new Error(`Unexpected argument ${value}`);
    }
    const key = value.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (key === "json" || key === "dryRun") {
      parsed[key] = true;
      continue;
    }
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      throw new Error(`Missing value for ${value}`);
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function resolvePath(path) {
  return path.startsWith("/") ? path : resolve(rootDir, path);
}

function addCheck(checks, name, ok, detail) {
  checks.push({ name, ok, detail });
}

function settlementStatus(action) {
  return action === "release" ? "released" : "refunded";
}

function extractCreatedEscrowObjectId(transaction, packageId) {
  const change = transaction.objectChanges?.find(
    (item) =>
      item.type === "created" &&
      "objectType" in item &&
      typeof item.objectType === "string" &&
      item.objectType.includes(`${packageId}::escrow::Escrow<`),
  );
  return change && "objectId" in change ? change.objectId : undefined;
}

function actualGasCostMist(transaction) {
  const gasUsed = transaction.effects?.gasUsed;
  if (!gasUsed) {
    return undefined;
  }
  const total =
    BigInt(gasUsed.computationCost) +
    BigInt(gasUsed.storageCost) +
    BigInt(gasUsed.nonRefundableStorageFee ?? "0") -
    BigInt(gasUsed.storageRebate);
  return total > 0n ? total.toString() : "0";
}

function requireDigest(record) {
  if (!record.digest) {
    throw new Error(`Record ${record.id} has no digest`);
  }
  return record.digest;
}

function sameAddress(left, right) {
  if (!left || !right) {
    return false;
  }
  return normalizeAddress(left) === normalizeAddress(right);
}

function normalizeAddress(value) {
  return normalizeSuiAddress(value);
}

function unique(values) {
  return [...new Set(values)];
}

function explorerTxUrl(digest) {
  return `https://suiexplorer.com/txblock/${digest}?network=${network}`;
}

function short(value) {
  return value && value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-6)}` : value;
}

function nextActionFor(message) {
  if (message.includes("missing") || message.includes("No Paylink")) {
    return "Run the hosted/local browser wallet sponsored flow first, then rerun this command with --paylink-id <id>.";
  }
  if (message.includes("Missing executed sponsored action")) {
    return "Complete fund, mark delivered, and release/refund in the public Paylink page before exporting evidence.";
  }
  return "Inspect the failed check, rerun the browser wallet flow if needed, then export again.";
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
