#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOYMENT_FILE="$ROOT_DIR/deployments/testnet.json"
EVIDENCE_FILE="$ROOT_DIR/deployments/testnet-smoke.json"
PAYMENT_MIST="${PAYMENT_MIST:-100000000}"
FEE_BPS="${FEE_BPS:-100}"
PROOF_URI="${PROOF_URI:-https://example.com/proofs/suipaylink-testnet-delivery.pdf}"

command -v sui >/dev/null || {
  echo "sui CLI is required."
  exit 1
}
command -v jq >/dev/null || {
  echo "jq is required."
  exit 1
}

if [[ ! -f "$DEPLOYMENT_FILE" ]]; then
  echo "Missing $DEPLOYMENT_FILE. Run npm run chain:deploy:testnet first."
  exit 1
fi

if [[ "$(sui client active-env)" != "testnet" ]]; then
  echo "Active Sui environment must be testnet. Run: sui client switch --env testnet"
  exit 1
fi

ACTOR="$(sui client active-address)"
PACKAGE_ID="$(jq -r '.packageId' "$DEPLOYMENT_FILE")"
GAS_COIN="$(sui client gas --json | jq -r '.[0].gasCoinId // empty')"

if [[ -z "$GAS_COIN" ]]; then
  echo "No Testnet SUI is available for $ACTOR"
  echo "Use: https://faucet.sui.io/?address=$ACTOR"
  exit 1
fi

SPLIT_OUTPUT="$(mktemp)"
CREATE_OUTPUT="$(mktemp)"
DELIVER_OUTPUT="$(mktemp)"
RELEASE_OUTPUT="$(mktemp)"
trap 'rm -f "$SPLIT_OUTPUT" "$CREATE_OUTPUT" "$DELIVER_OUTPUT" "$RELEASE_OUTPUT"' EXIT

sui client ptb \
  --split-coins gas "[$PAYMENT_MIST]" \
  --assign payment \
  --transfer-objects '[payment.0]' "@$ACTOR" \
  --gas-coin "@$GAS_COIN" \
  --gas-budget 10000000 \
  --json > "$SPLIT_OUTPUT"

PAYMENT_COIN="$(jq -r '.objectChanges[] | select(.type == "created" and (.objectType | startswith("0x2::coin::Coin<"))) | .objectId' "$SPLIT_OUTPUT")"

sui client call \
  --package "$PACKAGE_ID" \
  --module escrow \
  --function create_funded_escrow \
  --type-args 0x2::sui::SUI \
  --args "$ACTOR" "SuiPayLink Testnet service delivery" "$PAYMENT_COIN" "$FEE_BPS" "$ACTOR" \
  --gas "$GAS_COIN" \
  --gas-budget 20000000 \
  --json > "$CREATE_OUTPUT"

ESCROW_ID="$(jq -r '.objectChanges[] | select(.objectType? | contains("::escrow::Escrow")) | .objectId' "$CREATE_OUTPUT")"

sui client call \
  --package "$PACKAGE_ID" \
  --module escrow \
  --function mark_delivered \
  --type-args 0x2::sui::SUI \
  --args "$ESCROW_ID" "$PROOF_URI" \
  --gas "$GAS_COIN" \
  --gas-budget 10000000 \
  --json > "$DELIVER_OUTPUT"

sui client call \
  --package "$PACKAGE_ID" \
  --module escrow \
  --function release \
  --type-args 0x2::sui::SUI \
  --args "$ESCROW_ID" \
  --gas "$GAS_COIN" \
  --gas-budget 10000000 \
  --json > "$RELEASE_OUTPUT"

for OUTPUT in "$SPLIT_OUTPUT" "$CREATE_OUTPUT" "$DELIVER_OUTPUT" "$RELEASE_OUTPUT"; do
  if [[ "$(jq -r '.effects.status.status' "$OUTPUT")" != "success" ]]; then
    cat "$OUTPUT"
    exit 1
  fi
done

VERIFIED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
jq -n \
  --arg network "testnet" \
  --arg packageId "$PACKAGE_ID" \
  --arg actor "$ACTOR" \
  --arg escrowObjectId "$ESCROW_ID" \
  --arg splitDigest "$(jq -r '.digest' "$SPLIT_OUTPUT")" \
  --arg createDigest "$(jq -r '.digest' "$CREATE_OUTPUT")" \
  --arg deliverDigest "$(jq -r '.digest' "$DELIVER_OUTPUT")" \
  --arg releaseDigest "$(jq -r '.digest' "$RELEASE_OUTPUT")" \
  --arg verifiedAt "$VERIFIED_AT" \
  --argjson releaseEvent "$(jq '.events[] | select(.type | endswith("::EscrowReleased")) | .parsedJson' "$RELEASE_OUTPUT")" \
  '{
    network: $network,
    packageId: $packageId,
    actor: $actor,
    escrowObjectId: $escrowObjectId,
    digests: {
      splitPaymentCoin: $splitDigest,
      createFundedEscrow: $createDigest,
      markDelivered: $deliverDigest,
      release: $releaseDigest
    },
    releaseEvent: $releaseEvent,
    verifiedAt: $verifiedAt
  }' > "$EVIDENCE_FILE"

cat "$EVIDENCE_FILE"
