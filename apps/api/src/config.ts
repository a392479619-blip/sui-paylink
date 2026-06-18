import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import type { AppConfig } from "@suipaylink/shared";

const projectRoot = fileURLToPath(new URL("../../..", import.meta.url));
loadIfExists(resolve(projectRoot, ".env.local"));
loadIfExists(resolve(projectRoot, ".env"));
loadIfExists(resolve(projectRoot, "apps", "api", ".env.local"));
loadIfExists(resolve(projectRoot, "apps", "api", ".env"));

const network = (process.env.SUI_NETWORK ?? "testnet") as AppConfig["network"];
const sponsorPrivateKey = process.env.SPONSOR_PRIVATE_KEY;
const mockUsdcMinterPrivateKey = process.env.MOCK_USDC_MINTER_PRIVATE_KEY;

export const packageId =
  process.env.SUI_PACKAGE_ID ??
  "0x0bd14fb2c341415b418a74b74caa1c5f5ec513e69c7a313da533fa56d6e325b7";
export const mockUsdcCoinType =
  process.env.MOCK_USDC_COIN_TYPE ?? `${packageId}::mock_usdc::MOCK_USDC`;
export const mockUsdcTreasuryCapId =
  process.env.MOCK_USDC_TREASURY_CAP_ID ??
  "0xd4a31feca435942ec4d402781ed9102b97e23823b8f23a5c32722851ea740c76";
export const feeReceiverAddress =
  process.env.FEE_RECEIVER_ADDRESS ??
  "0xb1f8e9eb4c040a743fcfa2e53845b1a1b96cb517f92cf2182da09bb60de1e3ef";
export const defaultSponsorGasBudgetMist = process.env.SPONSOR_GAS_BUDGET_MIST ?? "50000000";
export const maxSponsorGasBudgetMist = process.env.MAX_SPONSOR_GAS_BUDGET_MIST ?? "200000000";
export const sponsorReadinessMinGasMist = process.env.SPONSOR_READINESS_MIN_GAS_MIST ?? "100000000";
export const mockUsdcMintGasBudgetMist = process.env.MOCK_USDC_MINT_GAS_BUDGET_MIST ?? "5000000";
export const mockUsdcMintAmountUnits = process.env.MOCK_USDC_MINT_AMOUNT_UNITS ?? "100000000";
export const mockUsdcMintMaxUnits = process.env.MOCK_USDC_MINT_MAX_UNITS ?? mockUsdcMintAmountUnits;
export const sponsoredTransactionTtlMs = Number(process.env.SPONSORED_TX_TTL_MS ?? 10 * 60 * 1000);
export const sponsorKeySecret = sponsorPrivateKey;
export const mockUsdcMinterKeySecret = mockUsdcMinterPrivateKey;
export const paylinkStorePath = process.env.PAYLINK_STORE_PATH
  ? resolveProjectPath(process.env.PAYLINK_STORE_PATH)
  : resolve(projectRoot, ".data", "paylinks.json");
export const sponsoredTransactionStorePath = process.env.SPONSORED_TRANSACTION_STORE_PATH
  ? resolveProjectPath(process.env.SPONSORED_TRANSACTION_STORE_PATH)
  : resolve(projectRoot, ".data", "sponsored-transactions.json");

export const appConfig: AppConfig = {
  network,
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "http://127.0.0.1:5174",
  sponsorMode: (process.env.SPONSOR_MODE ?? (sponsorPrivateKey ? "self-sponsored" : "mock")) as AppConfig["sponsorMode"],
  packageId,
  mockUsdcTreasuryCapId,
  mockUsdcMintEnabled: Boolean(mockUsdcMinterPrivateKey),
  mockUsdcMintAmountUnits,
  feeReceiverAddress,
  sponsorEnabled: Boolean(sponsorPrivateKey),
  sponsoredActions: ["fund-mock-usdc", "mark-delivered", "release", "refund"],
  supportedTokens: [
    {
      symbol: "mUSDC",
      displayName: "SuiPayLink Mock USDC",
      coinType: mockUsdcCoinType,
      decimals: 6,
      gaslessEligible: Boolean(sponsorPrivateKey),
      testnetOnly: true,
    },
  ],
};

export const port = Number(process.env.PORT ?? 8787);
export const host = process.env.HOST ?? "127.0.0.1";
export const webDistDir = process.env.WEB_DIST_DIR
  ? resolveProjectPath(process.env.WEB_DIST_DIR)
  : resolve(projectRoot, "apps", "web", "dist");
export const serveWebApp = (process.env.SERVE_WEB_APP ?? "auto").toLowerCase();
export const demoSeedEnabled = process.env.DEMO_SEED_ENABLED === "true";
export const demoSeedPaylinkId = process.env.DEMO_SEED_PAYLINK_ID ?? "demo-ai-workflow";
export const demoSeedFlexibleRoles = process.env.DEMO_SEED_FLEXIBLE_ROLES !== "false";
export const demoSeedSellerName = process.env.DEMO_SEED_SELLER_NAME ?? "Alice AI Automation Studio";
export const demoSeedSellerAddress =
  process.env.DEMO_SEED_SELLER_ADDRESS ??
  "0x648badce46f20a771d805670901239e868f5d0c7e297a3616b579075a800f9f5";
export const demoSeedBuyerName = process.env.DEMO_SEED_BUYER_NAME ?? "Bob from Sui Project";
export const demoSeedBuyerAddress =
  process.env.DEMO_SEED_BUYER_ADDRESS ??
  "0x3bb115974618e32b56dd6fb259b1c8cbfce72177fe7a36ab618e245ef19ca3f1";
export const demoSeedAmount = process.env.DEMO_SEED_AMOUNT ?? "100";
export const demoSeedToken = process.env.DEMO_SEED_TOKEN ?? "mUSDC";
export const demoSeedMemo =
  process.env.DEMO_SEED_MEMO ?? "AI automation workflow setup - 48 hour delivery escrow";
export const demoSeedFeeBps = Number(process.env.DEMO_SEED_FEE_BPS ?? 100);

function resolveProjectPath(path: string): string {
  return isAbsolute(path) ? path : resolve(projectRoot, path);
}

function loadIfExists(path: string) {
  if (existsSync(path)) {
    loadEnv({ path, override: false, quiet: true });
  }
}
