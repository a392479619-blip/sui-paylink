import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type {
  LocalJudgeActionResult,
  LocalJudgePaylinkResult,
  Paylink,
  SponsoredTransactionAction,
} from "@suipaylink/shared";
import { localJudgeModeEnabled, localJudgeWalletStorePath } from "./config.js";
import {
  SponsorError,
  buildSponsoredTransaction,
  mintTestMockUsdc,
  submitSponsoredTransaction,
} from "./sponsor.js";
import { createPaylink, getPaylink, updatePaylink } from "./store.js";

type LocalJudgeWalletPair = {
  paylinkId: string;
  buyerAddress: string;
  buyerSecretKey: string;
  sellerAddress: string;
  sellerSecretKey: string;
  createdAt: string;
};

type LocalJudgeWalletStoreFile = {
  version: 1;
  wallets: LocalJudgeWalletPair[];
};

const localJudgeWallets = new Map<string, LocalJudgeWalletPair>();
loadLocalJudgeWallets();

export function createLocalJudgePaylink(): LocalJudgePaylinkResult {
  assertLocalJudgeMode();

  const buyer = new Ed25519Keypair();
  const seller = new Ed25519Keypair();
  const buyerAddress = buyer.toSuiAddress();
  const sellerAddress = seller.toSuiAddress();

  const created = createPaylink({
    mode: "escrow",
    sellerName: "Alice AI Automation Studio",
    sellerAddress,
    buyerName: "Buyer / local judge",
    buyerAddress,
    amount: "100",
    token: "mUSDC",
    memo: "AI support workflow setup - 48 hour delivery",
    feeBps: 100,
  });
  const paylink = updatePaylink(created.id, { localJudgeDemo: true });

  setLocalJudgeWallet({
    paylinkId: paylink.id,
    buyerAddress,
    buyerSecretKey: buyer.getSecretKey(),
    sellerAddress,
    sellerSecretKey: seller.getSecretKey(),
    createdAt: new Date().toISOString(),
  });

  return {
    paylink,
    buyerAddress,
    sellerAddress,
  };
}

export async function runLocalJudgePaylinkAction(
  paylinkId: string,
  requestedAction?: SponsoredTransactionAction,
): Promise<LocalJudgeActionResult> {
  assertLocalJudgeMode();

  const paylink = requireLocalJudgePaylink(paylinkId);
  const wallets = requireLocalJudgeWallets(paylinkId);
  const action = requestedAction ?? nextActionForStatus(paylink.status);
  if (!action) {
    throw new SponsorError(409, "local_judge_flow_complete", "Local Judge flow has no next action for this Paylink");
  }

  assertActionMatchesStatus(paylink, action);

  const buyer = Ed25519Keypair.fromSecretKey(wallets.buyerSecretKey);
  const seller = Ed25519Keypair.fromSecretKey(wallets.sellerSecretKey);
  const signer = action === "mark-delivered" ? seller : buyer;
  let mint;

  if (action === "fund-mock-usdc") {
    const expectedAmountUnits = amountToBaseUnits(paylink.amount, 6);
    mint = await mintTestMockUsdc({
      recipientAddress: wallets.buyerAddress,
      amountUnits: expectedAmountUnits,
      paylinkId,
    });
    if (!mint.coinObjectId) {
      throw new SponsorError(502, "local_judge_mint_missing_coin", "Mint succeeded but no mUSDC coin object was returned");
    }
  }

  const latestPaylink = requireLocalJudgePaylink(paylinkId);
  const built = await buildSponsoredTransaction({
    action,
    senderAddress: signer.toSuiAddress(),
    paylinkId,
    paymentCoinId: action === "fund-mock-usdc" ? mint?.coinObjectId : undefined,
    sellerAddress: action === "fund-mock-usdc" ? latestPaylink.sellerAddress : undefined,
    expectedAmountUnits: action === "fund-mock-usdc" ? amountToBaseUnits(latestPaylink.amount, 6) : undefined,
    feeBps: action === "fund-mock-usdc" ? latestPaylink.feeBps : undefined,
    escrowObjectId: action === "fund-mock-usdc" ? undefined : latestPaylink.escrowObjectId,
    deliveryProofUri:
      action === "mark-delivered"
        ? "https://example.com/proofs/local-judge-delivery.pdf"
        : undefined,
    gasBudgetMist: action === "fund-mock-usdc" ? "50000000" : "10000000",
  });

  const signed = await signer.signTransaction(Buffer.from(built.transactionBytes, "base64"));
  const record = await submitSponsoredTransaction(built.id, {
    userSignature: signed.signature,
  });

  return {
    paylink: requireLocalJudgePaylink(paylinkId),
    record,
    mint,
    buyerAddress: wallets.buyerAddress,
    sellerAddress: wallets.sellerAddress,
  };
}

function assertLocalJudgeMode() {
  if (!localJudgeModeEnabled) {
    throw new SponsorError(403, "local_judge_mode_disabled", "Local Judge Mode is disabled for this API origin");
  }
}

function requireLocalJudgePaylink(id: string): Paylink {
  const paylink = getPaylink(id);
  if (!paylink) {
    throw new SponsorError(404, "paylink_not_found", "Paylink not found");
  }
  if (!paylink.localJudgeDemo) {
    throw new SponsorError(400, "not_local_judge_paylink", "This Paylink was not created by Local Judge Mode");
  }
  return paylink;
}

function requireLocalJudgeWallets(paylinkId: string): LocalJudgeWalletPair {
  const wallets = localJudgeWallets.get(paylinkId);
  if (!wallets) {
    throw new SponsorError(404, "local_judge_wallets_not_found", "Local Judge wallets are missing for this Paylink");
  }
  return wallets;
}

function nextActionForStatus(status: Paylink["status"]): SponsoredTransactionAction | undefined {
  if (status === "created") return "fund-mock-usdc";
  if (status === "funded") return "mark-delivered";
  if (status === "delivered") return "release";
  return undefined;
}

function assertActionMatchesStatus(paylink: Paylink, action: SponsoredTransactionAction) {
  const allowed =
    (paylink.status === "created" && action === "fund-mock-usdc") ||
    (paylink.status === "funded" && (action === "mark-delivered" || action === "refund")) ||
    (paylink.status === "delivered" && action === "release");
  if (!allowed) {
    throw new SponsorError(
      409,
      "local_judge_wrong_step",
      `Cannot run ${action} while Paylink is ${paylink.status}`,
    );
  }
}

function amountToBaseUnits(amount: string, decimals: number): string {
  const [whole, fraction = ""] = amount.split(".");
  if (fraction.length > decimals) {
    throw new SponsorError(400, "amount_precision_too_high", `mUSDC supports at most ${decimals} decimals`);
  }
  const units = `${whole}${fraction.padEnd(decimals, "0")}`.replace(/^0+(?=\d)/, "");
  return units || "0";
}

function loadLocalJudgeWallets() {
  if (!existsSync(localJudgeWalletStorePath)) {
    return;
  }

  const raw = readFileSync(localJudgeWalletStorePath, "utf8").trim();
  if (!raw) {
    return;
  }

  const parsed = JSON.parse(raw) as Partial<LocalJudgeWalletStoreFile> | LocalJudgeWalletPair[];
  const wallets = Array.isArray(parsed) ? parsed : parsed.wallets;
  if (!Array.isArray(wallets)) {
    throw new Error(`Invalid Local Judge wallet store at ${localJudgeWalletStorePath}`);
  }

  for (const wallet of wallets) {
    if (isStoredLocalJudgeWallet(wallet)) {
      localJudgeWallets.set(wallet.paylinkId, wallet);
    }
  }
}

function setLocalJudgeWallet(wallet: LocalJudgeWalletPair) {
  localJudgeWallets.set(wallet.paylinkId, wallet);
  persistLocalJudgeWallets();
}

function persistLocalJudgeWallets() {
  const payload: LocalJudgeWalletStoreFile = {
    version: 1,
    wallets: [...localJudgeWallets.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
  mkdirSync(dirname(localJudgeWalletStorePath), { recursive: true });
  const temporaryPath = `${localJudgeWalletStorePath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(payload, null, 2)}\n`);
  renameSync(temporaryPath, localJudgeWalletStorePath);
}

function isStoredLocalJudgeWallet(value: unknown): value is LocalJudgeWalletPair {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<LocalJudgeWalletPair>;
  return (
    typeof candidate.paylinkId === "string" &&
    typeof candidate.buyerAddress === "string" &&
    typeof candidate.buyerSecretKey === "string" &&
    typeof candidate.sellerAddress === "string" &&
    typeof candidate.sellerSecretKey === "string" &&
    typeof candidate.createdAt === "string"
  );
}
