import "dotenv/config";
import type { AppConfig } from "@suipaylink/shared";

const network = (process.env.SUI_NETWORK ?? "testnet") as AppConfig["network"];
const sponsorPrivateKey = process.env.SPONSOR_PRIVATE_KEY;

export const packageId =
  process.env.SUI_PACKAGE_ID ??
  "0x994e7ea20d955da3539c9971584bc4d524066b3df5bcbef0c180bfc2e3c5c340";
export const mockUsdcCoinType =
  process.env.MOCK_USDC_COIN_TYPE ?? `${packageId}::mock_usdc::MOCK_USDC`;
export const feeReceiverAddress =
  process.env.FEE_RECEIVER_ADDRESS ??
  "0xb1f8e9eb4c040a743fcfa2e53845b1a1b96cb517f92cf2182da09bb60de1e3ef";
export const defaultSponsorGasBudgetMist = process.env.SPONSOR_GAS_BUDGET_MIST ?? "50000000";
export const maxSponsorGasBudgetMist = process.env.MAX_SPONSOR_GAS_BUDGET_MIST ?? "200000000";
export const sponsoredTransactionTtlMs = Number(process.env.SPONSORED_TX_TTL_MS ?? 10 * 60 * 1000);
export const sponsorKeySecret = sponsorPrivateKey;

export const appConfig: AppConfig = {
  network,
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "http://localhost:5173",
  sponsorMode: (process.env.SPONSOR_MODE ?? (sponsorPrivateKey ? "self-sponsored" : "mock")) as AppConfig["sponsorMode"],
  packageId,
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
