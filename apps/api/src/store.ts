import { nanoid } from "nanoid";
import type { CreatePaylinkInput, Paylink, ReceiptSummary } from "@suipaylink/shared";
import { appConfig } from "./config.js";

const paylinks = new Map<string, Paylink>();

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
  return paylink;
}

export function fundPaylink(id: string): Paylink {
  const paylink = requirePaylink(id);
  if (paylink.status !== "created") {
    throw new Error(`Cannot fund paylink in status ${paylink.status}`);
  }
  return updatePaylink(id, {
    status: "funded",
    transactionDigest: mockDigest("fund"),
    escrowObjectId: paylink.mode === "escrow" ? mockObjectId("escrow") : undefined,
    receiptObjectId: mockObjectId("receipt"),
  });
}

export function markDelivered(id: string, deliveryProofUri: string): Paylink {
  const paylink = requirePaylink(id);
  if (paylink.mode !== "escrow") {
    throw new Error("Only escrow paylinks can be marked delivered");
  }
  if (paylink.status !== "funded") {
    throw new Error(`Cannot mark delivered in status ${paylink.status}`);
  }
  return updatePaylink(id, {
    status: "delivered",
    deliveryProofUri,
    transactionDigest: mockDigest("deliver"),
  });
}

export function releasePaylink(id: string): Paylink {
  const paylink = requirePaylink(id);
  if (paylink.mode !== "escrow") {
    throw new Error("Only escrow paylinks can be released");
  }
  if (paylink.status !== "delivered") {
    throw new Error(`Cannot release in status ${paylink.status}`);
  }
  return updatePaylink(id, {
    status: "released",
    transactionDigest: mockDigest("release"),
  });
}

export function refundPaylink(id: string): Paylink {
  const paylink = requirePaylink(id);
  if (paylink.mode !== "escrow") {
    throw new Error("Only escrow paylinks can be refunded");
  }
  if (paylink.status !== "funded" && paylink.status !== "delivered") {
    throw new Error(`Cannot refund in status ${paylink.status}`);
  }
  return updatePaylink(id, {
    status: "refunded",
    transactionDigest: mockDigest("refund"),
  });
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
      timelineItem("Funded", paylink.status, ["funded", "delivered", "released", "refunded"]),
      timelineItem("Delivered", paylink.status, ["delivered", "released"]),
      timelineItem(paylink.status === "refunded" ? "Refunded" : "Released", paylink.status, ["released", "refunded"]),
    ],
  };
}

function updatePaylink(id: string, patch: Partial<Paylink>): Paylink {
  const current = requirePaylink(id);
  const updated = {
    ...current,
    ...patch,
    updatedAt: now(),
  };
  paylinks.set(id, updated);
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
