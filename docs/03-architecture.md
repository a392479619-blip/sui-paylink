# Architecture

## Components

```text
Frontend
  Seller dashboard
  Buyer paylink page
  Receipt page

Backend
  Paylink API
  Sponsor transaction service
  Stablecoin/payment config
  Event indexer
  Optional AI invoice/reminder generator

Sui
  Invoice object
  Escrow object
  Payment/release/refund events
  Receipt state

Optional Walrus
  Invoice PDF
  Delivery proof
  Receipt bundle
```

## Contract model

### Invoice

Used for direct payment metadata and receipt display.

Fields:

- seller
- buyer
- memo
- amount
- currency type
- created timestamp

### Escrow

Used for service transactions.

Fields:

- seller
- buyer
- memo
- amount
- fee basis points
- delivery proof URI
- funded
- delivered
- released
- refunded
- stablecoin balance

## Backend model

Tables or JSON collections:

- users
- paylinks
- supported_stablecoins
- sponsored_transactions
- indexed_events
- receipts

## Sponsored transaction design

MVP has a platform sponsor wallet funded with SUI.

Rules:

- Sponsor only whitelisted package calls.
- Sponsor only payment links created by the platform.
- Sponsor only below configured amount limits.
- Rate-limit by user, IP, and paylink.
- Log digest, sender, operation, and gas cost.

## Stablecoin handling

MVP should start with one testnet coin or one supported stablecoin type available in the chosen environment.

Production target:

- Supported Sui stablecoins from the gasless transfer rollout.
- Do not support arbitrary volatile tokens in MVP.

## Security assumptions

MVP does not solve full arbitration. It only provides:

- buyer-funded escrow
- seller delivery mark
- buyer release
- buyer refund before release
- immutable event trail

Production needs deadlines, dispute windows, admin policy, and legal terms.

## Gas cost model

Gas comes from:

1. Sui protocol-level gasless stablecoin transfers for eligible direct stablecoin moves.
2. Platform sponsor wallet for escrow and receipt calls.

Platform replenishes sponsor gas from:

- transaction fees
- subscription fees
- setup fees

## Dependencies to verify

- Sui CLI.
- `@mysten/sui` TypeScript SDK.
- Sponsored transaction API path, either direct self-sponsor or Enoki/Shinami integration.
- Availability of gasless stablecoin transfer developer docs and testnet support.
- Stablecoin package IDs for chosen network.
