import { z } from "zod";

export const paylinkModes = ["direct", "escrow"] as const;
export const paylinkStatuses = [
  "created",
  "funded",
  "delivered",
  "released",
  "refunded",
  "expired",
] as const;
export const sponsoredTransactionActions = [
  "fund-mock-usdc",
  "mark-delivered",
  "release",
  "refund",
] as const;

export type PaylinkMode = (typeof paylinkModes)[number];
export type PaylinkStatus = (typeof paylinkStatuses)[number];
export type SponsoredTransactionAction = (typeof sponsoredTransactionActions)[number];

export const supportedTokenSchema = z.object({
  symbol: z.string(),
  displayName: z.string(),
  coinType: z.string(),
  decimals: z.number().int().nonnegative(),
  gaslessEligible: z.boolean(),
  testnetOnly: z.boolean().optional(),
});

export type SupportedToken = z.infer<typeof supportedTokenSchema>;

export const createPaylinkSchema = z.object({
  mode: z.enum(paylinkModes),
  sellerName: z.string().min(1),
  sellerAddress: z.string().min(1),
  buyerName: z.string().optional(),
  buyerAddress: z.string().optional(),
  amount: z.string().regex(/^\d+(\.\d{1,9})?$/),
  token: z.string().min(1),
  memo: z.string().min(1).max(500),
  feeBps: z.number().int().min(0).max(500),
});

export type CreatePaylinkInput = z.infer<typeof createPaylinkSchema>;

export const mutatePaylinkSchema = z.object({
  actor: z.enum(["seller", "buyer", "platform"]).default("buyer"),
  deliveryProofUri: z.string().url().optional(),
  notes: z.string().max(500).optional(),
});

export type MutatePaylinkInput = z.infer<typeof mutatePaylinkSchema>;

export const buildSponsoredTransactionSchema = z.object({
  action: z.enum(sponsoredTransactionActions),
  senderAddress: z.string().min(1),
  paymentCoinId: z.string().min(1).optional(),
  escrowObjectId: z.string().min(1).optional(),
  sellerAddress: z.string().min(1).optional(),
  memo: z.string().min(1).max(500).optional(),
  deliveryProofUri: z.string().url().optional(),
  expectedAmountUnits: z.string().regex(/^\d+$/).optional(),
  feeBps: z.number().int().min(0).max(500).optional(),
  feeReceiverAddress: z.string().min(1).optional(),
  gasBudgetMist: z.string().regex(/^\d+$/).optional(),
  paylinkId: z.string().min(1).optional(),
});

export type BuildSponsoredTransactionInput = z.infer<typeof buildSponsoredTransactionSchema>;

export const submitSponsoredTransactionSchema = z.object({
  userSignature: z.string().min(1),
});

export type SubmitSponsoredTransactionInput = z.infer<typeof submitSponsoredTransactionSchema>;

export type SponsoredTransactionStatus =
  | "built"
  | "submitted"
  | "executed"
  | "failed"
  | "expired";

export type SponsoredTransactionRecord = {
  id: string;
  action: SponsoredTransactionAction;
  status: SponsoredTransactionStatus;
  sender: string;
  sponsor: string;
  packageId: string;
  coinType: string;
  transactionBytes: string;
  digest?: string;
  error?: string;
  paylinkId?: string;
  escrowObjectId?: string;
  paymentCoinId?: string;
  sellerAddress?: string;
  deliveryProofUri?: string;
  expectedAmountUnits?: string;
  feeBps?: number;
  feeReceiverAddress?: string;
  gasBudgetMist: string;
  gasCostMist?: string;
  createdAt: string;
  expiresAt: string;
  submittedAt?: string;
  executedAt?: string;
};

export type Paylink = CreatePaylinkInput & {
  id: string;
  status: PaylinkStatus;
  publicUrl: string;
  deliveryProofUri?: string;
  transactionDigest?: string;
  fundTransactionDigest?: string;
  deliverTransactionDigest?: string;
  releaseTransactionDigest?: string;
  refundTransactionDigest?: string;
  sponsoredTransactionIds?: string[];
  lastSponsoredTransactionId?: string;
  escrowObjectId?: string;
  receiptObjectId?: string;
  createdAt: string;
  updatedAt: string;
  fundedAt?: string;
  deliveredAt?: string;
  releasedAt?: string;
  refundedAt?: string;
};

export type ReceiptSummary = {
  paylink: Paylink;
  platformFee: string;
  sellerAmount: string;
  timeline: Array<{
    label: string;
    status: "complete" | "current" | "pending";
    timestamp?: string;
  }>;
};

export type AppConfig = {
  network: "localnet" | "devnet" | "testnet" | "mainnet";
  publicBaseUrl: string;
  supportedTokens: SupportedToken[];
  sponsorMode: "mock" | "self-sponsored" | "provider";
  packageId?: string;
  feeReceiverAddress?: string;
  sponsorAddress?: string;
  sponsorEnabled?: boolean;
  sponsoredActions?: SponsoredTransactionAction[];
};
