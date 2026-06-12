#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Secp256k1Keypair } from "@mysten/sui/keypairs/secp256k1";
import { Secp256r1Keypair } from "@mysten/sui/keypairs/secp256r1";
import { isValidSuiAddress, normalizeSuiAddress, parseStructTag } from "@mysten/sui/utils";
import { config as loadEnv } from "dotenv";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadIfExists(resolve(rootDir, ".env"));
loadIfExists(resolve(rootDir, "apps/api/.env"));

const network = process.env.SUI_NETWORK ?? "testnet";
const sponsorSecret = process.env.SPONSOR_PRIVATE_KEY ?? "";
const packageId =
  process.env.SUI_PACKAGE_ID ??
  "0x994e7ea20d955da3539c9971584bc4d524066b3df5bcbef0c180bfc2e3c5c340";
const mockUsdcCoinType =
  process.env.MOCK_USDC_COIN_TYPE ?? `${packageId}::mock_usdc::MOCK_USDC`;
const feeReceiverAddress =
  process.env.FEE_RECEIVER_ADDRESS ??
  "0xb1f8e9eb4c040a743fcfa2e53845b1a1b96cb517f92cf2182da09bb60de1e3ef";
const defaultSponsorGasBudgetMist = process.env.SPONSOR_GAS_BUDGET_MIST ?? "50000000";
const maxSponsorGasBudgetMist = process.env.MAX_SPONSOR_GAS_BUDGET_MIST ?? "200000000";
const minimumSponsorBalanceMist = process.env.SPONSOR_READINESS_MIN_GAS_MIST ?? "100000000";
const suiType = "0x2::sui::SUI";

const checks = [];

try {
  const signer = sponsorSignerFromSecret(sponsorSecret);
  const sponsorAddress = signer.toSuiAddress();
  addCheck("SPONSOR_PRIVATE_KEY", true, "Private key is configured and decodable");
  addCheck("Sponsor address", true, sponsorAddress);
  addCheck("SUI_NETWORK", network === "testnet", `network=${network}`);
  addCheck("SUI_PACKAGE_ID", isSuiAddress(packageId), packageId);
  addCheck("FEE_RECEIVER_ADDRESS", isSuiAddress(feeReceiverAddress), feeReceiverAddress);
  addCheck(
    "MOCK_USDC_COIN_TYPE",
    coinTypeBelongsToPackage(mockUsdcCoinType, packageId),
    mockUsdcCoinType,
  );
  addCheck(
    "Gas budget config",
    positiveBigInt(defaultSponsorGasBudgetMist) && positiveBigInt(maxSponsorGasBudgetMist),
    `default=${defaultSponsorGasBudgetMist}, max=${maxSponsorGasBudgetMist}`,
  );

  const client = new SuiJsonRpcClient({
    network,
    url: getJsonRpcFullnodeUrl(network),
  });

  const [sponsorBalance, packageObject, coinMetadata, referenceGasPrice] = await Promise.all([
    client.getBalance({ owner: sponsorAddress, coinType: suiType }),
    client.getObject({ id: packageId, options: { showType: true } }),
    client.getCoinMetadata({ coinType: mockUsdcCoinType }),
    client.getReferenceGasPrice(),
  ]);

  addCheck(
    "Sponsor SUI balance",
    BigInt(sponsorBalance.totalBalance) >= BigInt(minimumSponsorBalanceMist),
    `${sponsorBalance.totalBalance} MIST; required >= ${minimumSponsorBalanceMist} MIST`,
  );
  addCheck(
    "Package object",
    Boolean(packageObject.data && !packageObject.error),
    packageObject.error ? JSON.stringify(packageObject.error) : packageObject.data?.type ?? "found",
  );
  addCheck(
    "MockUSDC metadata",
    Boolean(coinMetadata),
    coinMetadata ? `${coinMetadata.symbol} decimals=${coinMetadata.decimals}` : "not found",
  );
  addCheck("Reference gas price", referenceGasPrice > 0n, `${referenceGasPrice.toString()} MIST`);

  finish({
    ok: checks.every((check) => check.ok),
    network,
    sponsorAddress,
    packageId,
    mockUsdcCoinType,
    minimumSponsorBalanceMist,
    checks,
  });
} catch (error) {
  if (checks.length === 0) {
    addCheck("SPONSOR_PRIVATE_KEY", false, errorMessage(error));
  }
  finish({
    ok: false,
    network,
    packageId,
    mockUsdcCoinType,
    minimumSponsorBalanceMist,
    checks,
    error: errorMessage(error),
  });
}

function sponsorSignerFromSecret(secret) {
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

function addCheck(name, ok, detail) {
  checks.push({
    name,
    ok,
    detail,
  });
}

function finish(summary) {
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.ok) {
    process.exitCode = 1;
  }
}

function loadIfExists(path) {
  if (existsSync(path)) {
    loadEnv({ path, override: false });
  }
}

function isSuiAddress(value) {
  try {
    return isValidSuiAddress(normalizeSuiAddress(value));
  } catch {
    return false;
  }
}

function coinTypeBelongsToPackage(coinType, expectedPackageId) {
  try {
    return normalizeSuiAddress(parseStructTag(coinType).address) === normalizeSuiAddress(expectedPackageId);
  } catch {
    return false;
  }
}

function positiveBigInt(value) {
  try {
    return BigInt(value) > 0n;
  } catch {
    return false;
  }
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
