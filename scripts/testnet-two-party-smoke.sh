#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOYMENT_FILE="$ROOT_DIR/deployments/testnet.json"
EVIDENCE_FILE="$ROOT_DIR/deployments/testnet-two-party-smoke.json"

DEPLOYER_ALIAS="${DEPLOYER_ALIAS:-suipaylink-testnet-deployer}"
BUYER_ALIAS="${BUYER_ALIAS:-suipaylink-buyer}"
SELLER_ALIAS="${SELLER_ALIAS:-suipaylink-seller}"
PAYMENT_MIST="${PAYMENT_MIST:-20000000}"
BUYER_FUNDING_MIST="${BUYER_FUNDING_MIST:-50000000}"
SELLER_FUNDING_MIST="${SELLER_FUNDING_MIST:-30000000}"
FEE_BPS="${FEE_BPS:-100}"
PROOF_URI="${PROOF_URI:-https://example.com/proofs/suipaylink-two-party-testnet-delivery.pdf}"

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

ORIGINAL_ADDRESS="$(sui client active-address)"
restore_active() {
  sui client switch --address "$ORIGINAL_ADDRESS" >/dev/null 2>&1 || true
}
trap restore_active EXIT

address_for_alias() {
  local alias="$1"
  sui client switch --address "$alias" >/dev/null
  sui client active-address
}

fund_alias_from_deployer() {
  local target_alias="$1"
  local target_address="$2"
  local amount_mist="$3"
  local output_file="$4"

  sui client switch --address "$DEPLOYER_ALIAS" >/dev/null
  sui client ptb \
    --split-coins gas "[$amount_mist]" \
    --assign funding \
    --transfer-objects '[funding.0]' "@$target_address" \
    --gas-budget 10000000 \
    --json > "$output_file"

  if [[ "$(jq -r '.effects.status.status' "$output_file")" != "success" ]]; then
    echo "Failed to fund $target_alias"
    cat "$output_file"
    exit 1
  fi
}

call_expect_failure() {
  local output_file="$1"
  shift

  set +e
  "$@" --json > "$output_file" 2>&1
  local exit_code=$?
  set -e

  if [[ "$exit_code" -ne 0 ]]; then
    return 0
  fi
  if [[ "$(jq -r '.effects.status.status // "failure"' "$output_file")" == "success" ]]; then
    cat "$output_file"
    echo "Expected transaction to fail, but it succeeded."
    exit 1
  fi
}

failure_status() {
  local output_file="$1"
  if jq -e . "$output_file" >/dev/null 2>&1; then
    jq -r '.effects.status.status // "failure"' "$output_file"
  else
    echo "failure"
  fi
}

failure_error() {
  local output_file="$1"
  if jq -e . "$output_file" >/dev/null 2>&1; then
    jq -r '.effects.status.error // "transaction rejected"' "$output_file"
  else
    tr '\n' ' ' < "$output_file" | cut -c 1-500
  fi
}

PACKAGE_ID="$(jq -r '.packageId' "$DEPLOYMENT_FILE")"
BUYER_ADDRESS="$(address_for_alias "$BUYER_ALIAS")"
SELLER_ADDRESS="$(address_for_alias "$SELLER_ALIAS")"
FEE_RECEIVER_ADDRESS="$(address_for_alias "$DEPLOYER_ALIAS")"

FUND_BUYER_OUTPUT="$(mktemp)"
FUND_SELLER_OUTPUT="$(mktemp)"
SPLIT_OUTPUT="$(mktemp)"
CREATE_OUTPUT="$(mktemp)"
BAD_DELIVER_OUTPUT="$(mktemp)"
DELIVER_OUTPUT="$(mktemp)"
BAD_RELEASE_OUTPUT="$(mktemp)"
RELEASE_OUTPUT="$(mktemp)"
OBJECT_OUTPUT="$(mktemp)"
trap 'restore_active; rm -f "$FUND_BUYER_OUTPUT" "$FUND_SELLER_OUTPUT" "$SPLIT_OUTPUT" "$CREATE_OUTPUT" "$BAD_DELIVER_OUTPUT" "$DELIVER_OUTPUT" "$BAD_RELEASE_OUTPUT" "$RELEASE_OUTPUT" "$OBJECT_OUTPUT"' EXIT

fund_alias_from_deployer "$BUYER_ALIAS" "$BUYER_ADDRESS" "$BUYER_FUNDING_MIST" "$FUND_BUYER_OUTPUT"
fund_alias_from_deployer "$SELLER_ALIAS" "$SELLER_ADDRESS" "$SELLER_FUNDING_MIST" "$FUND_SELLER_OUTPUT"

sui client switch --address "$BUYER_ALIAS" >/dev/null
sui client ptb \
  --split-coins gas "[$PAYMENT_MIST]" \
  --assign payment \
  --transfer-objects '[payment.0]' "@$BUYER_ADDRESS" \
  --gas-budget 10000000 \
  --json > "$SPLIT_OUTPUT"

if [[ "$(jq -r '.effects.status.status' "$SPLIT_OUTPUT")" != "success" ]]; then
  cat "$SPLIT_OUTPUT"
  exit 1
fi

PAYMENT_COIN="$(jq -r '.objectChanges[] | select(.type == "created" and (.objectType | startswith("0x2::coin::Coin<"))) | .objectId' "$SPLIT_OUTPUT")"

sui client call \
  --package "$PACKAGE_ID" \
  --module escrow \
  --function create_funded_escrow \
  --type-args 0x2::sui::SUI \
  --args "$SELLER_ADDRESS" "SuiPayLink two-party Testnet service delivery" "$PAYMENT_COIN" "$FEE_BPS" "$FEE_RECEIVER_ADDRESS" \
  --gas-budget 20000000 \
  --json > "$CREATE_OUTPUT"

if [[ "$(jq -r '.effects.status.status' "$CREATE_OUTPUT")" != "success" ]]; then
  cat "$CREATE_OUTPUT"
  exit 1
fi

ESCROW_ID="$(jq -r '.objectChanges[] | select(.objectType? | contains("::escrow::Escrow")) | .objectId' "$CREATE_OUTPUT")"

call_expect_failure "$BAD_DELIVER_OUTPUT" \
  sui client call \
    --package "$PACKAGE_ID" \
    --module escrow \
    --function mark_delivered \
    --type-args 0x2::sui::SUI \
    --args "$ESCROW_ID" "$PROOF_URI" \
    --gas-budget 10000000

sui client switch --address "$SELLER_ALIAS" >/dev/null
sui client call \
  --package "$PACKAGE_ID" \
  --module escrow \
  --function mark_delivered \
  --type-args 0x2::sui::SUI \
  --args "$ESCROW_ID" "$PROOF_URI" \
  --gas-budget 10000000 \
  --json > "$DELIVER_OUTPUT"

if [[ "$(jq -r '.effects.status.status' "$DELIVER_OUTPUT")" != "success" ]]; then
  cat "$DELIVER_OUTPUT"
  exit 1
fi

call_expect_failure "$BAD_RELEASE_OUTPUT" \
  sui client call \
    --package "$PACKAGE_ID" \
    --module escrow \
    --function release \
    --type-args 0x2::sui::SUI \
    --args "$ESCROW_ID" \
    --gas-budget 10000000

sui client switch --address "$BUYER_ALIAS" >/dev/null
sui client call \
  --package "$PACKAGE_ID" \
  --module escrow \
  --function release \
  --type-args 0x2::sui::SUI \
  --args "$ESCROW_ID" \
  --gas-budget 10000000 \
  --json > "$RELEASE_OUTPUT"

if [[ "$(jq -r '.effects.status.status' "$RELEASE_OUTPUT")" != "success" ]]; then
  cat "$RELEASE_OUTPUT"
  exit 1
fi

sui client object "$ESCROW_ID" --json > "$OBJECT_OUTPUT"

if [[ "$(jq -r '.content.buyer' "$OBJECT_OUTPUT")" != "$BUYER_ADDRESS" ]]; then
  cat "$OBJECT_OUTPUT"
  exit 1
fi
if [[ "$(jq -r '.content.seller' "$OBJECT_OUTPUT")" != "$SELLER_ADDRESS" ]]; then
  cat "$OBJECT_OUTPUT"
  exit 1
fi
if [[ "$(jq -r '.content.fee_receiver' "$OBJECT_OUTPUT")" != "$FEE_RECEIVER_ADDRESS" ]]; then
  cat "$OBJECT_OUTPUT"
  exit 1
fi
if [[ "$(jq -r '.content.delivered' "$OBJECT_OUTPUT")" != "true" ]]; then
  cat "$OBJECT_OUTPUT"
  exit 1
fi
if [[ "$(jq -r '.content.released' "$OBJECT_OUTPUT")" != "true" ]]; then
  cat "$OBJECT_OUTPUT"
  exit 1
fi
if [[ "$(jq -r '.content.funds' "$OBJECT_OUTPUT")" != "0" ]]; then
  cat "$OBJECT_OUTPUT"
  exit 1
fi

VERIFIED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
jq -n \
  --arg network "testnet" \
  --arg packageId "$PACKAGE_ID" \
  --arg buyer "$BUYER_ADDRESS" \
  --arg seller "$SELLER_ADDRESS" \
  --arg feeReceiver "$FEE_RECEIVER_ADDRESS" \
  --arg escrowObjectId "$ESCROW_ID" \
  --arg fundBuyerDigest "$(jq -r '.digest' "$FUND_BUYER_OUTPUT")" \
  --arg fundSellerDigest "$(jq -r '.digest' "$FUND_SELLER_OUTPUT")" \
  --arg splitDigest "$(jq -r '.digest' "$SPLIT_OUTPUT")" \
  --arg createDigest "$(jq -r '.digest' "$CREATE_OUTPUT")" \
  --arg badDeliverStatus "$(failure_status "$BAD_DELIVER_OUTPUT")" \
  --arg badDeliverError "$(failure_error "$BAD_DELIVER_OUTPUT")" \
  --arg deliverDigest "$(jq -r '.digest' "$DELIVER_OUTPUT")" \
  --arg badReleaseStatus "$(failure_status "$BAD_RELEASE_OUTPUT")" \
  --arg badReleaseError "$(failure_error "$BAD_RELEASE_OUTPUT")" \
  --arg releaseDigest "$(jq -r '.digest' "$RELEASE_OUTPUT")" \
  --arg verifiedAt "$VERIFIED_AT" \
  --argjson releaseEvent "$(jq '.events[] | select(.type | endswith("::EscrowReleased")) | .parsedJson' "$RELEASE_OUTPUT")" \
  --argjson finalObject "$(jq '{buyer: .content.buyer, seller: .content.seller, feeReceiver: .content.fee_receiver, delivered: .content.delivered, released: .content.released, refunded: .content.refunded, funds: .content.funds, prevTx}' "$OBJECT_OUTPUT")" \
  '{
    network: $network,
    packageId: $packageId,
    buyer: $buyer,
    seller: $seller,
    feeReceiver: $feeReceiver,
    escrowObjectId: $escrowObjectId,
    digests: {
      fundBuyerGas: $fundBuyerDigest,
      fundSellerGas: $fundSellerDigest,
      splitPaymentCoin: $splitDigest,
      createFundedEscrow: $createDigest,
      markDelivered: $deliverDigest,
      release: $releaseDigest
    },
    rejectedTransactions: {
      buyerTriedToMarkDelivered: {
        status: $badDeliverStatus,
        error: $badDeliverError
      },
      sellerTriedToRelease: {
        status: $badReleaseStatus,
        error: $badReleaseError
      }
    },
    releaseEvent: $releaseEvent,
    finalObject: $finalObject,
    verifiedAt: $verifiedAt
  }' > "$EVIDENCE_FILE"

cat "$EVIDENCE_FILE"
