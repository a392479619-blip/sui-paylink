import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { nanoid } from "nanoid";
import type {
  CreatePaylinkInput,
  Paylink,
  RecordWalletTransactionInput,
  ReceiptSummary,
  SponsoredTransactionRecord,
} from "@suipaylink/shared";
import { isValidSuiAddress, normalizeSuiAddress } from "@mysten/sui/utils";
import {
  appConfig,
  demoSeedFlexibleRoles,
  demoSeedAmount,
  demoSeedBuyerAddress,
  demoSeedBuyerName,
  demoSeedEnabled,
  demoSeedFeeBps,
  demoSeedMemo,
  demoSeedPaylinkId,
  demoSeedSellerAddress,
  demoSeedSellerName,
  demoSeedToken,
  paylinkStorePath,
} from "./config.js";

const paylinks = new Map<string, Paylink>();
const now = () => new Date().toISOString();

loadPaylinks();
seedDemoPaylink();

type StoreFile = {
  version: 1;
  paylinks: Paylink[];
};

export function listPaylinks(): Paylink[] {
  return [...paylinks.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getPaylink(id: string): Paylink | undefined {
  return paylinks.get(id);
}

export function createPaylink(input: CreatePaylinkInput): Paylink {
  const id = nanoid(10);
  return insertPaylink(id, input);
}

function insertPaylink(id: string, input: CreatePaylinkInput, demoSeed = false): Paylink {
  const timestamp = now();
  const paylink: Paylink = {
    ...input,
    id,
    status: "created",
    publicUrl: `${appConfig.publicBaseUrl}/pay/${id}`,
    demoSeed,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  paylinks.set(id, paylink);
  persistPaylinks();
  return paylink;
}

export function fundPaylink(id: string): Paylink {
  const paylink = requirePaylink(id);
  if (paylink.status !== "created") {
    throw new Error(`Cannot fund paylink in status ${paylink.status}`);
  }
  const transactionDigest = mockDigest("fund");
  const timestamp = now();
  return updatePaylink(id, {
    status: "funded",
    transactionDigest,
    fundTransactionDigest: transactionDigest,
    escrowObjectId: paylink.mode === "escrow" ? mockObjectId("escrow") : undefined,
    receiptObjectId: mockObjectId("receipt"),
    fundedAt: timestamp,
  }, timestamp);
}

export function markDelivered(id: string, deliveryProofUri: string): Paylink {
  const paylink = requirePaylink(id);
  if (paylink.mode !== "escrow") {
    throw new Error("Only escrow paylinks can be marked delivered");
  }
  if (paylink.status !== "funded") {
    throw new Error(`Cannot mark delivered in status ${paylink.status}`);
  }
  const transactionDigest = mockDigest("deliver");
  const timestamp = now();
  return updatePaylink(id, {
    status: "delivered",
    deliveryProofUri,
    transactionDigest,
    deliverTransactionDigest: transactionDigest,
    deliveredAt: timestamp,
  }, timestamp);
}

export function releasePaylink(id: string): Paylink {
  const paylink = requirePaylink(id);
  if (paylink.mode !== "escrow") {
    throw new Error("Only escrow paylinks can be released");
  }
  if (paylink.status !== "delivered") {
    throw new Error(`Cannot release in status ${paylink.status}`);
  }
  const transactionDigest = mockDigest("release");
  const timestamp = now();
  return updatePaylink(id, {
    status: "released",
    transactionDigest,
    releaseTransactionDigest: transactionDigest,
    releasedAt: timestamp,
  }, timestamp);
}

export function refundPaylink(id: string): Paylink {
  const paylink = requirePaylink(id);
  if (paylink.mode !== "escrow") {
    throw new Error("Only escrow paylinks can be refunded");
  }
  if (paylink.status !== "funded") {
    throw new Error(`Cannot refund in status ${paylink.status}`);
  }
  const transactionDigest = mockDigest("refund");
  const timestamp = now();
  return updatePaylink(id, {
    status: "refunded",
    transactionDigest,
    refundTransactionDigest: transactionDigest,
    refundedAt: timestamp,
  }, timestamp);
}

export function buildReceipt(id: string): ReceiptSummary {
  const paylink = requirePaylink(id);
  const amount = Number(paylink.amount);
  const platformFee = paylink.mode === "escrow" ? amount * (paylink.feeBps / 10000) : 0;
  const sellerAmount = amount - platformFee;

  return {
    paylink,
    platformFee: platformFee.toFixed(2),
    sellerAmount: sellerAmount.toFixed(2),
    timeline: [
      timelineItem("Created", paylink.status, ["created", "funded", "delivered", "released", "refunded"], paylink.createdAt),
      timelineItem("Funded", paylink.status, ["funded", "delivered", "released", "refunded"], paylink.fundedAt),
      timelineItem("Delivered", paylink.status, ["delivered", "released"], paylink.deliveredAt),
      timelineItem(
        paylink.status === "refunded" ? "Refunded" : "Released",
        paylink.status,
        ["released", "refunded"],
        paylink.status === "refunded" ? paylink.refundedAt : paylink.releasedAt,
      ),
    ],
  };
}

export function applySponsoredTransactionResult(record: SponsoredTransactionRecord): Paylink | undefined {
  if (!record.paylinkId || record.status !== "executed" || !record.digest) {
    return undefined;
  }

  const paylink = getPaylink(record.paylinkId);
  if (!paylink) {
    return undefined;
  }

  const timestamp = record.executedAt ?? now();
  const basePatch: Partial<Paylink> = {
    transactionDigest: record.digest,
    lastSponsoredTransactionId: record.id,
    sponsoredTransactionIds: appendUnique(paylink.sponsoredTransactionIds, record.id),
  };

  if (record.action === "fund-mock-usdc") {
    return updatePaylink(record.paylinkId, {
      ...basePatch,
      status: "funded",
      buyerAddress: paylink.buyerAddress || record.sender,
      sellerAddress: paylink.sellerAddress || record.sellerAddress || paylink.sellerAddress,
      fundTransactionDigest: record.digest,
      escrowObjectId: record.escrowObjectId ?? paylink.escrowObjectId,
      fundedAt: timestamp,
    }, timestamp);
  }

  if (record.action === "mark-delivered") {
    return updatePaylink(record.paylinkId, {
      ...basePatch,
      status: "delivered",
      deliverTransactionDigest: record.digest,
      deliveryProofUri: record.deliveryProofUri ?? paylink.deliveryProofUri,
      deliveredAt: timestamp,
    }, timestamp);
  }

  if (record.action === "release") {
    return updatePaylink(record.paylinkId, {
      ...basePatch,
      status: "released",
      releaseTransactionDigest: record.digest,
      releasedAt: timestamp,
    }, timestamp);
  }

  if (record.action === "refund") {
    return updatePaylink(record.paylinkId, {
      ...basePatch,
      status: "refunded",
      refundTransactionDigest: record.digest,
      refundedAt: timestamp,
    }, timestamp);
  }

  return undefined;
}

export function recordWalletTransaction(
  id: string,
  input: RecordWalletTransactionInput,
): Paylink {
  const paylink = requirePaylink(id);
  const timestamp = now();

  if (input.action === "fund-mock-usdc") {
    if (paylink.status !== "created") {
      throw new Error(`Cannot record funding in status ${paylink.status}`);
    }
    if (!input.escrowObjectId) {
      throw new Error("escrowObjectId is required after wallet funding");
    }
    if (paylink.buyerAddress && !sameAddress(paylink.buyerAddress, input.actorAddress)) {
      throw new Error("actorAddress does not match the Paylink buyer");
    }
    return updatePaylink(id, {
      status: "funded",
      buyerAddress: paylink.buyerAddress || input.actorAddress,
      transactionDigest: input.digest,
      fundTransactionDigest: input.digest,
      escrowObjectId: input.escrowObjectId,
      fundedAt: timestamp,
    }, timestamp);
  }

  if (input.action === "mark-delivered") {
    if (paylink.status !== "funded") {
      throw new Error(`Cannot record delivery in status ${paylink.status}`);
    }
    if (!paylink.sellerAddress || !sameAddress(paylink.sellerAddress, input.actorAddress)) {
      throw new Error("actorAddress does not match the Paylink seller");
    }
    return updatePaylink(id, {
      status: "delivered",
      transactionDigest: input.digest,
      deliverTransactionDigest: input.digest,
      deliveryProofUri: input.deliveryProofUri ?? paylink.deliveryProofUri,
      deliveredAt: timestamp,
    }, timestamp);
  }

  if (input.action === "release") {
    if (paylink.status !== "delivered") {
      throw new Error(`Cannot record release in status ${paylink.status}`);
    }
    if (!paylink.buyerAddress || !sameAddress(paylink.buyerAddress, input.actorAddress)) {
      throw new Error("actorAddress does not match the Paylink buyer");
    }
    return updatePaylink(id, {
      status: "released",
      transactionDigest: input.digest,
      releaseTransactionDigest: input.digest,
      releasedAt: timestamp,
    }, timestamp);
  }

  if (input.action === "refund") {
    if (paylink.status !== "funded") {
      throw new Error(`Cannot record refund in status ${paylink.status}`);
    }
    if (!paylink.buyerAddress || !sameAddress(paylink.buyerAddress, input.actorAddress)) {
      throw new Error("actorAddress does not match the Paylink buyer");
    }
    return updatePaylink(id, {
      status: "refunded",
      transactionDigest: input.digest,
      refundTransactionDigest: input.digest,
      refundedAt: timestamp,
    }, timestamp);
  }

  throw new Error(`Unsupported wallet transaction action ${input.action}`);
}

export function updatePaylink(id: string, patch: Partial<Paylink>, timestamp = now()): Paylink {
  const current = requirePaylink(id);
  const updated = {
    ...current,
    ...patch,
    updatedAt: timestamp,
  };
  paylinks.set(id, updated);
  persistPaylinks();
  return updated;
}

function normalizePaylinkAddress(value: string): string {
  const normalized = normalizeSuiAddress(value.trim());
  if (!isValidSuiAddress(normalized)) {
    throw new Error("Invalid Sui address");
  }
  return normalized;
}

function sameAddress(left: string, right: string): boolean {
  return normalizeSuiAddress(left) === normalizeSuiAddress(right);
}

function requirePaylink(id: string): Paylink {
  const paylink = paylinks.get(id);
  if (!paylink) {
    throw new Error("Paylink not found");
  }
  return paylink;
}

function mockDigest(label: string): string {
  return `mock-${label}-${nanoid(16)}`;
}

function mockObjectId(label: string): string {
  return `0x${label}${nanoid(28).replace(/[^a-zA-Z0-9]/g, "0").slice(0, 28)}`;
}

function appendUnique(values: string[] | undefined, nextValue: string): string[] {
  const existing = values ?? [];
  return existing.includes(nextValue) ? existing : [...existing, nextValue];
}

function loadPaylinks() {
  if (!existsSync(paylinkStorePath)) {
    return;
  }

  const raw = readFileSync(paylinkStorePath, "utf8").trim();
  if (!raw) {
    return;
  }

  const parsed = JSON.parse(raw) as Partial<StoreFile> | Paylink[];
  const records = Array.isArray(parsed) ? parsed : parsed.paylinks;
  if (!Array.isArray(records)) {
    throw new Error(`Invalid paylink store at ${paylinkStorePath}`);
  }

  for (const paylink of records) {
    if (isStoredPaylink(paylink)) {
      paylinks.set(paylink.id, paylink);
    }
  }
}

function seedDemoPaylink() {
  if (!demoSeedEnabled) {
    return;
  }

  const current = paylinks.get(demoSeedPaylinkId);
  const publicUrl = `${appConfig.publicBaseUrl}/pay/${demoSeedPaylinkId}`;

  if (current) {
    if (current.demoSeed && current.publicUrl !== publicUrl) {
      updatePaylink(demoSeedPaylinkId, { publicUrl });
    }
    if (current.demoSeed && demoSeedFlexibleRoles && current.status === "created") {
      updatePaylink(demoSeedPaylinkId, {
        sellerAddress: demoSeedSellerAddress,
        buyerAddress: "",
      });
    }
    return;
  }

  insertPaylink(
    demoSeedPaylinkId,
    {
      mode: "escrow",
      sellerName: demoSeedSellerName,
      sellerAddress: demoSeedSellerAddress,
      buyerName: demoSeedBuyerName,
      buyerAddress: demoSeedFlexibleRoles ? "" : demoSeedBuyerAddress,
      amount: demoSeedAmount,
      token: demoSeedToken,
      memo: demoSeedMemo,
      feeBps: demoSeedFeeBps,
    },
    true,
  );
}

function persistPaylinks() {
  const payload: StoreFile = {
    version: 1,
    paylinks: listPaylinks(),
  };
  mkdirSync(dirname(paylinkStorePath), { recursive: true });
  const temporaryPath = `${paylinkStorePath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(payload, null, 2)}\n`);
  renameSync(temporaryPath, paylinkStorePath);
}

function isStoredPaylink(value: unknown): value is Paylink {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<Paylink>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.status === "string" &&
    typeof candidate.publicUrl === "string" &&
    typeof candidate.sellerName === "string" &&
    typeof candidate.sellerAddress === "string" &&
    typeof candidate.amount === "string" &&
    typeof candidate.token === "string" &&
    typeof candidate.memo === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string"
  );
}

function timelineItem(
  label: string,
  currentStatus: Paylink["status"],
  completeStatuses: Paylink["status"][],
  timestamp?: string,
) {
  const status = completeStatuses.includes(currentStatus)
    ? "complete"
    : currentStatus === "created" && label === "Created"
      ? "current"
      : "pending";
  return { label, status, timestamp } as const;
}
