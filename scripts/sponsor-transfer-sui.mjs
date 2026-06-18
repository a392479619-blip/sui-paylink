#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Secp256k1Keypair } from "@mysten/sui/keypairs/secp256k1";
import { Secp256r1Keypair } from "@mysten/sui/keypairs/secp256r1";
import { Transaction } from "@mysten/sui/transactions";
import { isValidSuiAddress, normalizeSuiAddress } from "@mysten/sui/utils";
import { config as loadEnv } from "dotenv";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadIfExists(resolve(rootDir, ".env.local"));
loadIfExists(resolve(rootDir, ".env"));
loadIfExists(resolve(rootDir, "apps/api/.env.local"));
loadIfExists(resolve(rootDir, "apps/api/.env"));

const network = valueArg("--network") ?? process.env.SUI_NETWORK ?? "testnet";
const recipient = valueArg("--to");
const amountMist = valueArg("--mist") ?? "";
const sponsorSecret = process.env.SPONSOR_PRIVATE_KEY ?? "";

if (!recipient || !isValidSuiAddress(recipient)) {
  fail("Usage: node scripts/sponsor-transfer-sui.mjs --to=<sui_address> --mist=<positive_mist>");
}
if (!positiveBigInt(amountMist)) {
  fail("--mist must be a positive integer");
}

const signer = signerFromSecret(sponsorSecret);
const client = new SuiJsonRpcClient({
  network,
  url: getJsonRpcFullnodeUrl(network),
});

const transaction = new Transaction();
transaction.setSender(signer.toSuiAddress());
const [coin] = transaction.splitCoins(transaction.gas, [BigInt(amountMist)]);
transaction.transferObjects([coin], normalizeSuiAddress(recipient));

const bytes = await transaction.build({
  client,
  onlyTransactionKind: false,
});
const signature = await signer.signTransaction(bytes);
const response = await client.executeTransactionBlock({
  transactionBlock: bytes,
  signature: signature.signature,
  options: {
    showEffects: true,
    showBalanceChanges: true,
  },
  requestType: "WaitForLocalExecution",
});

const status = response.effects?.status.status;
console.log(
  JSON.stringify(
    {
      ok: status === "success",
      network,
      sender: signer.toSuiAddress(),
      recipient: normalizeSuiAddress(recipient),
      amountMist,
      digest: response.digest,
      status,
      error: response.effects?.status.error,
    },
    null,
    2,
  ),
);

if (status !== "success") {
  process.exitCode = 1;
}

function valueArg(name) {
  const prefix = `${name}=`;
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function loadIfExists(path) {
  if (existsSync(path)) {
    loadEnv({ path, override: false, quiet: true });
  }
}

function signerFromSecret(secret) {
  if (!secret) {
    throw new Error("SPONSOR_PRIVATE_KEY is missing");
  }
  const decoded = decodeSuiPrivateKey(secret);
  if (decoded.scheme === "ED25519") {
    return Ed25519Keypair.fromSecretKey(decoded.secretKey);
  }
  if (decoded.scheme === "Secp256k1") {
    return Secp256k1Keypair.fromSecretKey(decoded.secretKey);
  }
  if (decoded.scheme === "Secp256r1") {
    return Secp256r1Keypair.fromSecretKey(decoded.secretKey);
  }
  throw new Error(`Unsupported sponsor key scheme ${decoded.scheme}`);
}

function positiveBigInt(value) {
  try {
    return BigInt(value) > 0n;
  } catch {
    return false;
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
