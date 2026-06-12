import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { nanoid } from "nanoid";
import type { CreatePaylinkInput, Paylink, ReceiptSummary } from "@suipaylink/shared";
import { appConfig, paylinkStorePath } from "./config.js";

const paylinks = new Map<string, Paylink>();
loadPaylinks();

type StoreFile = {
  version: 1;
  paylinks: Paylink[];
};

const now = () => new Date().toISOString();

export function listPaylinks(): Paylink[] {
  return [...paylinks.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getPaylink(id: string): Paylink | undefined {
  return paylinks.get(id);
}

export function createPaylink(input: CreatePaylinkInput): Paylink {
  const id = nanoid(10);
  const timestamp = now();
  const paylink: Paylink = {
    ...input,
    id,
    status: "created",
    publicUrl: `${appConfig.publicBaseUrl}/pay/${id}`,
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
  if (paylink.status !== "funded" && paylink.status !== "delivered") {
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

function updatePaylink(id: string, patch: Partial<Paylink>, timestamp = now()): Paylink {
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
