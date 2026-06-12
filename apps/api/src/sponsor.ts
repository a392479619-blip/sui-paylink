import { decodeSuiPrivateKey, type Signer } from "@mysten/sui/cryptography";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl, type SuiObjectResponse } from "@mysten/sui/jsonRpc";
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
  sponsoredTransactionTtlMs,
  sponsorKeySecret,
} from "./config.js";

const records = new Map<string, SponsoredTransactionRecord>();
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
  const transaction = new Transaction();
  const gasBudget = parseGasBudget(input.gasBudgetMist);

  transaction.setSender(sender);
  transaction.setGasOwner(sponsorAddress);
  transaction.setGasBudget(gasBudget);

  let escrowObjectId: string | undefined;

  if (input.action === "fund-mock-usdc") {
    const paymentCoinId = normalizeObjectIdInput(input.paymentCoinId, "paymentCoinId");
    const sellerAddress = normalizeAddressInput(input.sellerAddress, "sellerAddress");
    if (sellerAddress === sender) {
      throw new SponsorError(400, "same_sender_and_seller", "sellerAddress must differ from senderAddress");
    }
    await assertOwnedCoin({
      objectId: paymentCoinId,
      owner: sender,
      coinType,
      expectedAmountUnits: input.expectedAmountUnits,
    });
    transaction.moveCall({
      target: contractTarget("create_funded_escrow"),
      typeArguments: [coinType],
      arguments: [
        transaction.pure.address(sellerAddress),
        transaction.pure.string(input.memo ?? "SuiPayLink sponsored MockUSDC escrow"),
        transaction.object(paymentCoinId),
        transaction.pure.u64(input.feeBps ?? 100),
        transaction.pure.address(normalizeAddressInput(input.feeReceiverAddress ?? feeReceiverAddress, "feeReceiverAddress")),
      ],
    });
  }

  if (input.action === "mark-delivered") {
    escrowObjectId = normalizeObjectIdInput(input.escrowObjectId, "escrowObjectId");
    const escrow = await readEscrow(escrowObjectId);
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
        transaction.pure.string(input.deliveryProofUri ?? "https://example.com/proofs/sponsored-delivery.pdf"),
      ],
    });
  }

  if (input.action === "release") {
    escrowObjectId = normalizeObjectIdInput(input.escrowObjectId, "escrowObjectId");
    const escrow = await readEscrow(escrowObjectId);
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
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + sponsoredTransactionTtlMs).toISOString(),
  };
  records.set(record.id, record);
  return record;
}

export function getSponsoredTransaction(id: string): SponsoredTransactionRecord {
  const record = records.get(id);
  if (!record) {
    throw new SponsorError(404, "sponsored_transaction_not_found", "Sponsored transaction not found");
  }
  if (isExpired(record) && record.status === "built") {
    record.status = "expired";
    records.set(record.id, record);
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

  const sponsorSignature = await getSponsorSigner().signTransaction(
    Buffer.from(record.transactionBytes, "base64"),
  );

  const submitted: SponsoredTransactionRecord = {
    ...record,
    status: "submitted",
    submittedAt: new Date().toISOString(),
  };
  records.set(record.id, submitted);

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
    const executed: SponsoredTransactionRecord = {
      ...submitted,
      status: status === "success" ? "executed" : "failed",
      digest: response.digest,
      error: status === "failure" ? response.effects?.status.error : undefined,
      executedAt: new Date().toISOString(),
    };
    records.set(record.id, executed);
    return executed;
  } catch (cause) {
    const failed: SponsoredTransactionRecord = {
      ...submitted,
      status: "failed",
      error: cause instanceof Error ? cause.message : String(cause),
      executedAt: new Date().toISOString(),
    };
    records.set(record.id, failed);
    throw cause;
  }
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
