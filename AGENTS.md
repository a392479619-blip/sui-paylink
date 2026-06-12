# SuiPayLink Agent Guide

This project is the selected Sui Overflow 2026 submission direction.

## Project stance

SuiPayLink is not a generic crypto checkout, generic invoice tool, or Stripe replacement. It is a narrow Sui-native payment product:

> Gasless stablecoin paylinks and optional escrow for cross-border digital service work.

Keep every product, engineering, pitch, and design decision aligned with that sentence.

## Non-goals

- Do not build a multi-chain payment processor.
- Do not build fiat on-ramp/off-ramp.
- Do not build card payments.
- Do not build general ecommerce checkout.
- Do not handle large regulated custody in MVP.
- Do not promise legal dispute arbitration.
- Do not compete with Stripe, PayPal, Coinbase Commerce, Helio, or Request Finance on their broad surface area.

## MVP definition

The hackathon MVP must show:

1. Seller creates a payment link.
2. Buyer opens the link.
3. Buyer can pay without needing SUI gas.
4. A Sui object records invoice/payment/receipt state.
5. Escrow flow can hold funds and release after delivery confirmation.
6. Seller dashboard shows status.

## Sui-native requirement

The project is invalid if Sui is decorative. Sui must provide at least one essential capability:

- Gasless stablecoin transfer UX.
- Sponsored transactions for escrow/receipt operations.
- Sui object model for invoice, escrow, and receipt state.
- Programmable transaction logic for release/refund.
- Optional Walrus storage for invoice files or delivery proofs.

## Default output language

Use Chinese for founder-facing strategy and submission planning. Use English for code, README sections aimed at judges/developers, and public pitch assets unless the target audience is Chinese.
