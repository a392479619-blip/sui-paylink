# Risk And Compliance

## MVP risk stance

SuiPayLink should be treated as a hackathon prototype and limited pilot tool, not a regulated production payment processor.

## Compliance boundaries

MVP should not:

- hold fiat;
- provide fiat on-ramp or off-ramp;
- custody large funds;
- market to sanctioned jurisdictions;
- promise dispute arbitration;
- support regulated goods or services;
- provide yield, lending, or investment returns.

## Product restrictions

Early pilots should be:

- small amount;
- digital service only;
- stablecoin only;
- crypto-native users;
- no high-risk goods;
- no large enterprise treasury.

## Technical risks

| Risk | Impact | Mitigation |
|---|---|---|
| Sponsored gas abuse | Sponsor wallet drain | Whitelist calls, cap amounts, rate-limit users, require platform-created links. |
| Escrow dispute | User dissatisfaction | MVP supports buyer release after delivery and refund before delivery; no arbitration promise. |
| Wrong recipient | Funds lost | Display seller identity, memo, address preview, confirmation screen. |
| Stablecoin support unavailable on testnet | Demo blocked | Use test coin and clearly label production target. |
| Contract bug | Fund loss | Test with tiny amounts only; do not run production custody before audit. |

## Commercial risks

| Risk | Signal | Response |
|---|---|---|
| Users prefer direct USDC transfer | They reject escrow as unnecessary | Narrow to bounty/service workflows where escrow matters. |
| Buyers lack Sui stablecoins | Payment setup takes too long | Target crypto-native users first. |
| Payment competitors copy feature | Generic paylinks commoditize | Stay vertical in service escrow, receipts, and contributor payouts. |
| Compliance burden rises | Users request large payments/fiat | Avoid large/fiat flows until legal review. |

## Required warnings

Public demo and README should state:

- Prototype for hackathon use.
- Not a licensed money transmitter.
- Not legal, tax, or financial advice.
- Use small test amounts until audited.
- Escrow release/pre-delivery refund policy is simplified for MVP.

## Production prerequisites

Before real public launch:

- contract audit;
- legal review;
- terms of service;
- privacy policy;
- sanctions screening policy;
- abuse monitoring;
- dispute policy;
- stablecoin issuer and jurisdiction review.
