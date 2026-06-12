import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { decodeSuiPrivateKey, type Signer } from "@mysten/sui/cryptography";
import {
  SuiJsonRpcClient,
  getJsonRpcFullnodeUrl,
  type SuiObjectChange,
  type SuiObjectResponse,
  type SuiTransactionBlockResponse,
} from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Secp256k1Keypair } from "@mysten/sui/keypairs/secp256k1";
import { Secp256r1Keypair } from "@mysten/sui/keypairs/secp256r1";
import { Transaction } from "@mysten/sui/transactions";
import {
  isValidSuiAddress,
  normalizeStructTag,
  normalizeSuiAddress,
  normalizeSuiObjectId,
  parseStructTag,
} from "@mysten/sui/utils";
import { nanoid } from "nanoid";
import type {
  BuildSponsoredTransactionInput,
  Paylink,
  SponsoredTransactionAction,
  SponsoredTransactionRecord,
  SubmitSponsoredTransactionInput,
} from "@suipaylink/shared";
import {
  appConfig,
  defaultSponsorGasBudgetMist,
  feeReceiverAddress,
  maxSponsorGasBudgetMist,
  mockUsdcCoinType,
  packageId,
  sponsoredTransactionStorePath,
  sponsoredTransactionTtlMs,
  sponsorKeySecret,
} from "./config.js";
import { applySponsoredTransactionResult, getPaylink } from "./store.js";

const records = new Map<string, SponsoredTransactionRecord>();
loadSponsoredTransactions();

const buildBlockingStatuses = new Set<SponsoredTransactionRecord["status"]>([
  "built",
  "submitted",
  "executed",
]);
const submitBlockingStatuses = new Set<SponsoredTransactionRecord["status"]>([
  "submitted",
  "executed",
]);

type SponsoredTransactionStoreFile = {
  version: 1;
  records: SponsoredTransactionRecord[];
};

const client = new SuiJsonRpcClient({
  network: appConfig.network,
  url: getJsonRpcFullnodeUrl(appConfig.network),
});

export class SponsorError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function getSponsorAddress(): string | undefined {
  if (!sponsorKeySecret) {
    return undefined;
  }
  return getSponsorSigner().toSuiAddress();
}

export async function buildSponsoredTransaction(
  input: BuildSponsoredTransactionInput,
): Promise<SponsoredTransactionRecord> {
  const sponsor = requireSponsorSigner();
  const sponsorAddress = sponsor.toSuiAddress();
  const sender = normalizeAddressInput(input.senderAddress, "senderAddress");
  const coinType = normalizeStructTag(mockUsdcCoinType);
  const paylink = requireBoundPaylink(input);
  assertNoActiveSponsoredAction(paylink, input.action);
  const transaction = new Transaction();
  const gasBudget = parseGasBudget(input.gasBudgetMist);

  transaction.setSender(sender);
  transaction.setGasOwner(sponsorAddress);
  transaction.setGasBudget(gasBudget);

  let escrowObjectId: string | undefined;
  let deliveryProofUri = input.deliveryProofUri;

  if (input.action === "fund-mock-usdc") {
    const paymentCoinId = normalizeObjectIdInput(input.paymentCoinId, "paymentCoinId");
    const sellerAddress = normalizeAddressInput(input.sellerAddress ?? paylink?.sellerAddress, "sellerAddress");
    const expectedAmountUnits = input.expectedAmountUnits ?? (paylink ? amountToBaseUnits(paylink.amount, 6) : undefined);
    assertPaylinkActionAllowed({
      action: input.action,
      sender,
      paylink,
      sellerAddress,
    });
    if (sellerAddress === sender) {
      throw new SponsorError(400, "same_sender_and_seller", "sellerAddress must differ from senderAddress");
    }
    await assertOwnedCoin({
      objectId: paymentCoinId,
      owner: sender,
      coinType,
      expectedAmountUnits,
    });
    transaction.moveCall({
      target: contractTarget("create_funded_escrow"),
      typeArguments: [coinType],
      arguments: [
        transaction.pure.address(sellerAddress),
        transaction.pure.string(input.memo ?? paylink?.memo ?? "SuiPayLink sponsored MockUSDC escrow"),
        transaction.object(paymentCoinId),
        transaction.pure.u64(input.feeBps ?? paylink?.feeBps ?? 100),
        transaction.pure.address(normalizeAddressInput(input.feeReceiverAddress ?? feeReceiverAddress, "feeReceiverAddress")),
      ],
    });
  }

  if (input.action === "mark-delivered") {
    escrowObjectId = normalizeObjectIdInput(input.escrowObjectId, "escrowObjectId");
    deliveryProofUri = input.deliveryProofUri ?? "https://example.com/proofs/sponsored-delivery.pdf";
    const escrow = await readEscrow(escrowObjectId);
    assertPaylinkActionAllowed({
      action: input.action,
      sender,
      paylink,
      escrowObjectId,
    });
    assertAddressEquals(escrow.seller, sender, "Only the escrow seller can mark delivery");
    assertEscrowOpen(escrow);
    if (escrow.delivered) {
      throw new SponsorError(400, "escrow_already_delivered", "Escrow is already marked delivered");
    }
    transaction.moveCall({
      target: contractTarget("mark_delivered"),
      typeArguments: [escrow.coinType],
      arguments: [
        transaction.object(escrowObjectId),
        transaction.pure.string(deliveryProofUri),
      ],
    });
  }

  if (input.action === "release") {
    escrowObjectId = normalizeObjectIdInput(input.escrowObjectId, "escrowObjectId");
    const escrow = await readEscrow(escrowObjectId);
    assertPaylinkActionAllowed({
      action: input.action,
      sender,
      paylink,
      escrowObjectId,
    });
    assertAddressEquals(escrow.buyer, sender, "Only the escrow buyer can release funds");
    assertEscrowOpen(escrow);
    if (!escrow.delivered) {
      throw new SponsorError(400, "escrow_not_delivered", "Escrow must be delivered before release");
    }
    transaction.moveCall({
      target: contractTarget("release"),
      typeArguments: [escrow.coinType],
      arguments: [transaction.object(escrowObjectId)],
    });
  }

  if (input.action === "refund") {
    escrowObjectId = normalizeObjectIdInput(input.escrowObjectId, "escrowObjectId");
    const escrow = await readEscrow(escrowObjectId);
    assertPaylinkActionAllowed({
      action: input.action,
      sender,
      paylink,
      escrowObjectId,
    });
    assertAddressEquals(escrow.buyer, sender, "Only the escrow buyer can refund funds");
    assertEscrowOpen(escrow);
    transaction.moveCall({
      target: contractTarget("refund_to_buyer"),
      typeArguments: [escrow.coinType],
      arguments: [transaction.object(escrowObjectId)],
    });
  }

  const bytes = await transaction.build({ client });
  const transactionBytes = Buffer.from(bytes).toString("base64");
  await assertDryRunSuccess(transactionBytes);

  const now = new Date();
  const record: SponsoredTransactionRecord = {
    id: nanoid(16),
    action: input.action,
    status: "built",
    sender,
    sponsor: sponsorAddress,
    packageId,
    coinType,
    transactionBytes,
    paylinkId: input.paylinkId,
    escrowObjectId,
    paymentCoinId: input.paymentCoinId,
    sellerAddress: input.sellerAddress ?? paylink?.sellerAddress,
    deliveryProofUri,
    expectedAmountUnits: input.expectedAmountUnits ?? (paylink ? amountToBaseUnits(paylink.amount, 6) : undefined),
    feeBps: input.feeBps ?? paylink?.feeBps,
    feeReceiverAddress: input.feeReceiverAddress ?? feeReceiverAddress,
    gasBudgetMist: gasBudget,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + sponsoredTransactionTtlMs).toISOString(),
  };
  setSponsoredTransactionRecord(record);
  return record;
}

export function listSponsoredTransactions(paylinkId?: string): SponsoredTransactionRecord[] {
  const values = [...records.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return paylinkId ? values.filter((record) => record.paylinkId === paylinkId) : values;
}

export function getSponsoredTransaction(id: string): SponsoredTransactionRecord {
  const record = records.get(id);
  if (!record) {
    throw new SponsorError(404, "sponsored_transaction_not_found", "Sponsored transaction not found");
  }
  if (isExpired(record) && record.status === "built") {
    record.status = "expired";
    setSponsoredTransactionRecord(record);
  }
  return record;
}

export async function submitSponsoredTransaction(
  id: string,
  input: SubmitSponsoredTransactionInput,
): Promise<SponsoredTransactionRecord> {
  const record = getSponsoredTransaction(id);
  if (record.status === "expired" || isExpired(record)) {
    record.status = "expired";
    records.set(record.id, record);
    throw new SponsorError(410, "sponsored_transaction_expired", "Sponsored transaction expired");
  }
  if (record.status !== "built") {
    throw new SponsorError(409, "sponsored_transaction_not_submittable", `Cannot submit transaction in status ${record.status}`);
  }

  try {
    assertNoSubmittedSponsoredConflict(record);
    assertRecordPaylinkStillCurrent(record);
    await assertDryRunSuccess(record.transactionBytes);
  } catch (cause) {
    const failed: SponsoredTransactionRecord = {
      ...record,
      status: "failed",
      error: cause instanceof Error ? cause.message : String(cause),
    };
    setSponsoredTransactionRecord(failed);
    throw cause;
  }

  const sponsorSignature = await getSponsorSigner().signTransaction(
    Buffer.from(record.transactionBytes, "base64"),
  );

  const submitted: SponsoredTransactionRecord = {
    ...record,
    status: "submitted",
    submittedAt: new Date().toISOString(),
  };
  setSponsoredTransactionRecord(submitted);

  try {
    const response = await client.executeTransactionBlock({
      transactionBlock: record.transactionBytes,
      signature: [input.userSignature, sponsorSignature.signature],
      options: {
        showBalanceChanges: true,
        showEffects: true,
        showEvents: true,
        showObjectChanges: true,
      },
    });
    const status = response.effects?.status.status;
    const escrowObjectId = record.escrowObjectId ?? extractCreatedEscrowObjectId(response);
    const executed: SponsoredTransactionRecord = {
      ...submitted,
      status: status === "success" ? "executed" : "failed",
      digest: response.digest,
      escrowObjectId,
      gasCostMist: actualGasCostMist(response),
      error: status === "failure" ? response.effects?.status.error : undefined,
      executedAt: new Date().toISOString(),
    };
    setSponsoredTransactionRecord(executed);
    if (executed.status === "executed") {
      applySponsoredTransactionResult(executed);
    }
    return executed;
  } catch (cause) {
    const failed: SponsoredTransactionRecord = {
      ...submitted,
      status: "failed",
      error: cause instanceof Error ? cause.message : String(cause),
      executedAt: new Date().toISOString(),
    };
    setSponsoredTransactionRecord(failed);
    throw cause;
  }
}

function loadSponsoredTransactions() {
  if (!existsSync(sponsoredTransactionStorePath)) {
    return;
  }

  const raw = readFileSync(sponsoredTransactionStorePath, "utf8").trim();
  if (!raw) {
    return;
  }

  const parsed = JSON.parse(raw) as Partial<SponsoredTransactionStoreFile> | SponsoredTransactionRecord[];
  const storedRecords = Array.isArray(parsed) ? parsed : parsed.records;
  if (!Array.isArray(storedRecords)) {
    throw new Error(`Invalid sponsored transaction store at ${sponsoredTransactionStorePath}`);
  }

  for (const record of storedRecords) {
    if (isStoredSponsoredTransaction(record)) {
      records.set(record.id, record);
    }
  }
}

function setSponsoredTransactionRecord(record: SponsoredTransactionRecord) {
  records.set(record.id, record);
  persistSponsoredTransactions();
}

function persistSponsoredTransactions() {
  const payload: SponsoredTransactionStoreFile = {
    version: 1,
    records: listSponsoredTransactions(),
  };
  mkdirSync(dirname(sponsoredTransactionStorePath), { recursive: true });
  const temporaryPath = `${sponsoredTransactionStorePath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(payload, null, 2)}\n`);
  renameSync(temporaryPath, sponsoredTransactionStorePath);
}

function isStoredSponsoredTransaction(value: unknown): value is SponsoredTransactionRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<SponsoredTransactionRecord>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.action === "string" &&
    typeof candidate.status === "string" &&
    typeof candidate.sender === "string" &&
    typeof candidate.sponsor === "string" &&
    typeof candidate.packageId === "string" &&
    typeof candidate.coinType === "string" &&
    typeof candidate.transactionBytes === "string" &&
    typeof candidate.gasBudgetMist === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.expiresAt === "string"
  );
}

function requireBoundPaylink(input: BuildSponsoredTransactionInput): Paylink | undefined {
  if (!input.paylinkId) {
    return undefined;
  }
  const paylink = getPaylink(input.paylinkId);
  if (!paylink) {
    throw new SponsorError(404, "paylink_not_found", "Paylink not found");
  }
  if (paylink.mode !== "escrow") {
    throw new SponsorError(400, "paylink_not_escrow", "Only escrow paylinks can use sponsored escrow transactions");
  }
  if (paylink.token !== "mUSDC") {
    throw new SponsorError(400, "unsupported_paylink_token", "Only mUSDC paylinks can use the current sponsored path");
  }
  return paylink;
}

function assertPaylinkActionAllowed(input: {
  action: BuildSponsoredTransactionInput["action"];
  sender: string;
  paylink?: Paylink;
  sellerAddress?: string;
  escrowObjectId?: string;
}) {
  if (!input.paylink) {
    return;
  }

  if (input.action === "fund-mock-usdc") {
    if (input.paylink.status !== "created") {
      throw new SponsorError(409, "paylink_not_created", `Cannot fund paylink in status ${input.paylink.status}`);
    }
    if (input.sellerAddress) {
      assertAddressEquals(input.sellerAddress, input.paylink.sellerAddress, "sellerAddress does not match the Paylink seller");
    }
    assertOptionalPaylinkAddress(input.paylink.buyerAddress, input.sender, "senderAddress does not match the Paylink buyer");
    return;
  }

  if (!input.escrowObjectId) {
    throw new SponsorError(400, "missing_escrow_object", "escrowObjectId is required for this Paylink action");
  }
  if (input.paylink.escrowObjectId && normalizeObjectIdInput(input.paylink.escrowObjectId, "paylink.escrowObjectId") !== input.escrowObjectId) {
    throw new SponsorError(409, "escrow_object_mismatch", "escrowObjectId does not match the Paylink");
  }

  if (input.action === "mark-delivered") {
    if (input.paylink.status !== "funded") {
      throw new SponsorError(409, "paylink_not_funded", `Cannot mark delivery in status ${input.paylink.status}`);
    }
    assertOptionalPaylinkAddress(input.paylink.sellerAddress, input.sender, "senderAddress does not match the Paylink seller");
    return;
  }

  if (input.action === "release") {
    if (input.paylink.status !== "delivered") {
      throw new SponsorError(409, "paylink_not_delivered", `Cannot release paylink in status ${input.paylink.status}`);
    }
    assertOptionalPaylinkAddress(input.paylink.buyerAddress, input.sender, "senderAddress does not match the Paylink buyer");
    return;
  }

  if (input.action === "refund") {
    if (input.paylink.status !== "funded" && input.paylink.status !== "delivered") {
      throw new SponsorError(409, "paylink_not_refundable", `Cannot refund paylink in status ${input.paylink.status}`);
    }
    assertOptionalPaylinkAddress(input.paylink.buyerAddress, input.sender, "senderAddress does not match the Paylink buyer");
  }
}

function assertNoActiveSponsoredAction(paylink: Paylink | undefined, action: SponsoredTransactionAction) {
  if (!paylink) {
    return;
  }
  const conflicting = findBlockingSponsoredAction(paylink.id, action, buildBlockingStatuses);
  if (!conflicting) {
    return;
  }
  throw new SponsorError(
    409,
    "duplicate_sponsored_action",
    `Paylink ${paylink.id} already has ${conflicting.status} ${conflicting.action} sponsored transaction ${conflicting.id}`,
  );
}

function assertNoSubmittedSponsoredConflict(record: SponsoredTransactionRecord) {
  if (!record.paylinkId) {
    return;
  }
  const conflicting = findBlockingSponsoredAction(
    record.paylinkId,
    record.action,
    submitBlockingStatuses,
    record.id,
  );
  if (!conflicting) {
    return;
  }
  throw new SponsorError(
    409,
    "conflicting_sponsored_action_in_flight",
    `Paylink ${record.paylinkId} already has ${conflicting.status} ${conflicting.action} sponsored transaction ${conflicting.id}`,
  );
}

function assertRecordPaylinkStillCurrent(record: SponsoredTransactionRecord) {
  if (!record.paylinkId) {
    return;
  }
  const paylink = requireBoundPaylink({
    action: record.action,
    senderAddress: record.sender,
    paylinkId: record.paylinkId,
  });
  assertPaylinkActionAllowed({
    action: record.action,
    sender: record.sender,
    paylink,
    sellerAddress: record.sellerAddress,
    escrowObjectId: record.escrowObjectId,
  });
}

function findBlockingSponsoredAction(
  paylinkId: string,
  action: SponsoredTransactionAction,
  blockingStatuses: Set<SponsoredTransactionRecord["status"]>,
  excludeId?: string,
): SponsoredTransactionRecord | undefined {
  for (const record of records.values()) {
    if (record.id === excludeId || record.paylinkId !== paylinkId) {
      continue;
    }
    const status = refreshedRecordStatus(record);
    if (!blockingStatuses.has(status)) {
      continue;
    }
    if (record.action === action || (isSettlementAction(record.action) && isSettlementAction(action))) {
      return { ...record, status };
    }
  }
  return undefined;
}

function refreshedRecordStatus(record: SponsoredTransactionRecord): SponsoredTransactionRecord["status"] {
  if (record.status !== "built" || !isExpired(record)) {
    return record.status;
  }
  const expired: SponsoredTransactionRecord = {
    ...record,
    status: "expired",
  };
  setSponsoredTransactionRecord(expired);
  return expired.status;
}

function isSettlementAction(action: SponsoredTransactionAction): boolean {
  return action === "release" || action === "refund";
}

function assertOptionalPaylinkAddress(value: string | undefined, expected: string, message: string) {
  if (!value) {
    return;
  }
  assertAddressEquals(value, expected, message);
}

function amountToBaseUnits(amount: string, decimals: number): string {
  const [whole, fraction = ""] = amount.split(".");
  if (fraction.length > decimals) {
    throw new SponsorError(400, "amount_precision_too_high", `mUSDC supports at most ${decimals} decimals`);
  }
  const paddedFraction = fraction.padEnd(decimals, "0");
  return `${whole}${paddedFraction}`.replace(/^0+(?=\d)/, "");
}

function extractCreatedEscrowObjectId(response: SuiTransactionBlockResponse): string | undefined {
  const createdEscrow = response.objectChanges?.find((change) => isCreatedEscrowChange(change));
  return createdEscrow && "objectId" in createdEscrow ? createdEscrow.objectId : undefined;
}

function isCreatedEscrowChange(change: SuiObjectChange): boolean {
  return (
    change.type === "created" &&
    "objectType" in change &&
    typeof change.objectType === "string" &&
    change.objectType.includes(`${packageId}::escrow::Escrow<`)
  );
}

function actualGasCostMist(response: SuiTransactionBlockResponse): string | undefined {
  const gasUsed = response.effects?.gasUsed;
  if (!gasUsed) {
    return undefined;
  }
  const computationCost = BigInt(gasUsed.computationCost);
  const storageCost = BigInt(gasUsed.storageCost);
  const storageRebate = BigInt(gasUsed.storageRebate);
  const nonRefundableStorageFee = BigInt(gasUsed.nonRefundableStorageFee ?? "0");
  const total = computationCost + storageCost + nonRefundableStorageFee - storageRebate;
  return total > 0n ? total.toString() : "0";
}

function requireSponsorSigner(): Signer {
  if (!sponsorKeySecret) {
    throw new SponsorError(
      503,
      "sponsor_not_configured",
      "SPONSOR_PRIVATE_KEY is not configured; real sponsored transactions are disabled",
    );
  }
  return getSponsorSigner();
}

function getSponsorSigner(): Signer {
  if (!sponsorKeySecret) {
    throw new SponsorError(503, "sponsor_not_configured", "SPONSOR_PRIVATE_KEY is not configured");
  }
  const decoded = decodeSuiPrivateKey(sponsorKeySecret);
  if (decoded.scheme === "ED25519") {
    return Ed25519Keypair.fromSecretKey(decoded.secretKey);
  }
  if (decoded.scheme === "Secp256k1") {
    return Secp256k1Keypair.fromSecretKey(decoded.secretKey);
  }
  if (decoded.scheme === "Secp256r1") {
    return Secp256r1Keypair.fromSecretKey(decoded.secretKey);
  }
  throw new SponsorError(500, "unsupported_sponsor_key_scheme", `Unsupported sponsor key scheme ${decoded.scheme}`);
}

async function assertOwnedCoin(input: {
  objectId: string;
  owner: string;
  coinType: string;
  expectedAmountUnits?: string;
}) {
  const object = await getObject(input.objectId);
  const data = requireObjectData(object, input.objectId);
  if (!data.type) {
    throw new SponsorError(400, "coin_type_missing", "Payment coin type is missing");
  }
  const parsed = parseStructTag(data.type);
  const actualCoinType = parsed.typeParams[0] ? normalizeTypeParam(parsed.typeParams[0]) : "";
  if (parsed.address !== normalizeSuiAddress("0x2") || parsed.module !== "coin" || parsed.name !== "Coin") {
    throw new SponsorError(400, "payment_object_not_coin", "paymentCoinId must be a Coin object");
  }
  if (actualCoinType !== input.coinType) {
    throw new SponsorError(400, "unsupported_payment_coin", `paymentCoinId must be ${input.coinType}`);
  }
  assertAddressEquals(ownerAddress(data.owner), input.owner, "paymentCoinId is not owned by senderAddress");

  const balance = String(parsedFields(data).balance ?? "");
  if (!balance || BigInt(balance) <= 0n) {
    throw new SponsorError(400, "empty_payment_coin", "paymentCoinId has zero balance");
  }
  if (input.expectedAmountUnits && balance !== input.expectedAmountUnits) {
    throw new SponsorError(
      400,
      "payment_amount_mismatch",
      `paymentCoinId balance ${balance} does not match expectedAmountUnits ${input.expectedAmountUnits}`,
    );
  }
}

async function readEscrow(objectId: string): Promise<{
  objectId: string;
  coinType: string;
  seller: string;
  buyer: string;
  funded: boolean;
  delivered: boolean;
  released: boolean;
  refunded: boolean;
}> {
  const object = await getObject(objectId);
  const data = requireObjectData(object, objectId);
  if (!data.type) {
    throw new SponsorError(400, "escrow_type_missing", "Escrow object type is missing");
  }
  const parsed = parseStructTag(data.type);
  if (
    parsed.address !== normalizeSuiAddress(packageId) ||
    parsed.module !== "escrow" ||
    parsed.name !== "Escrow" ||
    parsed.typeParams.length !== 1
  ) {
    throw new SponsorError(400, "unsupported_escrow_object", "escrowObjectId is not a SuiPayLink Escrow object");
  }
  const coinType = normalizeTypeParam(parsed.typeParams[0]);
  if (coinType !== normalizeStructTag(mockUsdcCoinType)) {
    throw new SponsorError(400, "unsupported_escrow_coin", `Escrow coin type must be ${mockUsdcCoinType}`);
  }
  const fields = parsedFields(data);
  return {
    objectId,
    coinType,
    seller: normalizeAddressInput(String(fields.seller ?? ""), "escrow.seller"),
    buyer: normalizeAddressInput(String(fields.buyer ?? ""), "escrow.buyer"),
    funded: Boolean(fields.funded),
    delivered: Boolean(fields.delivered),
    released: Boolean(fields.released),
    refunded: Boolean(fields.refunded),
  };
}

async function assertDryRunSuccess(transactionBytes: string) {
  const result = await client.dryRunTransactionBlock({ transactionBlock: transactionBytes });
  if (result.effects.status.status !== "success") {
    throw new SponsorError(
      400,
      "sponsored_transaction_dry_run_failed",
      result.effects.status.error ?? "Dry run failed",
    );
  }
}

async function getObject(objectId: string): Promise<SuiObjectResponse> {
  return client.getObject({
    id: objectId,
    options: {
      showContent: true,
      showOwner: true,
      showType: true,
    },
  });
}

function assertEscrowOpen(escrow: {
  funded: boolean;
  released: boolean;
  refunded: boolean;
}) {
  if (!escrow.funded) {
    throw new SponsorError(400, "escrow_not_funded", "Escrow is not funded");
  }
  if (escrow.released) {
    throw new SponsorError(400, "escrow_already_released", "Escrow is already released");
  }
  if (escrow.refunded) {
    throw new SponsorError(400, "escrow_already_refunded", "Escrow is already refunded");
  }
}

function requireObjectData(object: SuiObjectResponse, objectId: string) {
  if (object.error) {
    throw new SponsorError(404, "object_not_found", `Object not found: ${objectId}`);
  }
  if (!object.data) {
    throw new SponsorError(404, "object_not_found", `Object not found: ${objectId}`);
  }
  return object.data;
}

function parsedFields(data: ReturnType<typeof requireObjectData>): Record<string, unknown> {
  const content = data.content;
  if (!content || content.dataType !== "moveObject" || !("fields" in content)) {
    throw new SponsorError(400, "object_not_parsed", "Object content is not a parsed Move object");
  }
  return content.fields as Record<string, unknown>;
}

function ownerAddress(owner: unknown): string {
  if (typeof owner === "object" && owner !== null && "AddressOwner" in owner) {
    return normalizeAddressInput(String((owner as { AddressOwner: string }).AddressOwner), "owner");
  }
  return "";
}

function assertAddressEquals(actual: string, expected: string, message: string) {
  if (!actual || normalizeAddressInput(actual, "actualAddress") !== normalizeAddressInput(expected, "expectedAddress")) {
    throw new SponsorError(403, "address_mismatch", message);
  }
}

function parseGasBudget(value?: string): string {
  const gasBudget = BigInt(value ?? defaultSponsorGasBudgetMist);
  if (gasBudget <= 0n) {
    throw new SponsorError(400, "invalid_gas_budget", "gasBudgetMist must be positive");
  }
  if (gasBudget > BigInt(maxSponsorGasBudgetMist)) {
    throw new SponsorError(400, "gas_budget_too_high", `gasBudgetMist exceeds ${maxSponsorGasBudgetMist}`);
  }
  return gasBudget.toString();
}

function normalizeAddressInput(value: string | undefined, field: string): string {
  if (!value) {
    throw new SponsorError(400, "missing_address", `${field} is required`);
  }
  const normalized = normalizeSuiAddress(value);
  if (!isValidSuiAddress(normalized)) {
    throw new SponsorError(400, "invalid_address", `${field} is not a valid Sui address`);
  }
  return normalized;
}

function normalizeObjectIdInput(value: string | undefined, field: string): string {
  return normalizeSuiObjectId(normalizeAddressInput(value, field));
}

function normalizeTypeParam(typeParam: string | ReturnType<typeof parseStructTag>): string {
  return typeof typeParam === "string" ? typeParam : normalizeStructTag(typeParam);
}

function contractTarget(functionName: string): `${string}::${string}::${string}` {
  return `${packageId}::escrow::${functionName}`;
}

function isExpired(record: SponsoredTransactionRecord): boolean {
  return Date.now() > Date.parse(record.expiresAt);
}
