#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOYMENT_DIR="$ROOT_DIR/deployments"
DEPLOYMENT_FILE="$DEPLOYMENT_DIR/testnet.json"

command -v sui >/dev/null || {
  echo "sui CLI is required."
  exit 1
}
command -v jq >/dev/null || {
  echo "jq is required."
  exit 1
}

if [[ "$(sui client active-env)" != "testnet" ]]; then
  echo "Active Sui environment must be testnet. Run: sui client switch --env testnet"
  exit 1
fi

ACTIVE_ADDRESS="$(sui client active-address)"
if [[ "$(sui client gas --json | jq 'length')" -eq 0 ]]; then
  echo "No Testnet SUI is available for $ACTIVE_ADDRESS"
  echo "Use: https://faucet.sui.io/?address=$ACTIVE_ADDRESS"
  exit 1
fi

mkdir -p "$DEPLOYMENT_DIR"
PUBLISH_OUTPUT="$(mktemp)"
PUBLISH_PUBFILE="$(mktemp)"
rm -f "$PUBLISH_PUBFILE"
trap 'rm -f "$PUBLISH_OUTPUT" "$PUBLISH_PUBFILE"' EXIT

sui move build --path "$ROOT_DIR/contracts" --build-env testnet
sui move test --path "$ROOT_DIR/contracts" --build-env testnet
if ! sui client test-publish "$ROOT_DIR/contracts" --build-env testnet --pubfile-path "$PUBLISH_PUBFILE" --json > "$PUBLISH_OUTPUT"; then
  cat "$PUBLISH_OUTPUT"
  exit 1
fi

if [[ "$(jq -r '.effects.status.status' "$PUBLISH_OUTPUT")" != "success" ]]; then
  cat "$PUBLISH_OUTPUT"
  exit 1
fi

PACKAGE_ID="$(jq -r '.objectChanges[] | select(.type == "published") | .packageId' "$PUBLISH_OUTPUT")"
UPGRADE_CAP_ID="$(jq -r '.objectChanges[] | select(.objectType? == "0x2::package::UpgradeCap") | .objectId' "$PUBLISH_OUTPUT")"
PUBLISH_DIGEST="$(jq -r '.digest' "$PUBLISH_OUTPUT")"
DEPLOYED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
MOCK_USDC_TYPE="$PACKAGE_ID::mock_usdc::MOCK_USDC"
MOCK_USDC_TREASURY_CAP_ID="$(jq -r --arg coinType "$MOCK_USDC_TYPE" '.objectChanges[] | select(.objectType? == ("0x2::coin::TreasuryCap<" + $coinType + ">")) | .objectId' "$PUBLISH_OUTPUT")"
MOCK_USDC_METADATA_ID="$(jq -r --arg coinType "$MOCK_USDC_TYPE" '.objectChanges[] | select(.objectType? == ("0x2::coin::CoinMetadata<" + $coinType + ">")) | .objectId' "$PUBLISH_OUTPUT")"

jq -n \
  --arg network "testnet" \
  --arg packageId "$PACKAGE_ID" \
  --arg upgradeCapId "$UPGRADE_CAP_ID" \
  --arg publishDigest "$PUBLISH_DIGEST" \
  --arg deployer "$ACTIVE_ADDRESS" \
  --arg deployedAt "$DEPLOYED_AT" \
  --arg mockUsdcType "$MOCK_USDC_TYPE" \
  --arg mockUsdcTreasuryCapId "$MOCK_USDC_TREASURY_CAP_ID" \
  --arg mockUsdcMetadataId "$MOCK_USDC_METADATA_ID" \
  '{
    network: $network,
    packageId: $packageId,
    upgradeCapId: $upgradeCapId,
    publishDigest: $publishDigest,
    deployer: $deployer,
    deployedAt: $deployedAt,
    mockUsdc: {
      coinType: $mockUsdcType,
      treasuryCapId: $mockUsdcTreasuryCapId,
      metadataId: $mockUsdcMetadataId,
      symbol: "mUSDC",
      decimals: 6,
      testOnly: true
    }
  }' > "$DEPLOYMENT_FILE"

cat "$DEPLOYMENT_FILE"
