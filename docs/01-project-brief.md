# SuiPayLink Project Brief

## Decision

Use SuiPayLink as the Sui Overflow 2026 submission project.

## One-liner

SuiPayLink is a walletless, gasless stablecoin payment link with optional escrow for cross-border digital service work.

## Problem

Stablecoin payments are useful for cross-border digital services, but the first payment still breaks on basic friction:

- The payer may hold stablecoins but not SUI gas.
- The seller may not want to explain wallets, gas, and addresses to every buyer.
- Service work needs trust: buyers fear non-delivery, sellers fear non-payment.
- Existing crypto payment links mostly optimize checkout, not service escrow.
- Existing Web2 payments solve cards well, but not stablecoin-native service settlement.

## Target beachhead

Do not target mainstream ecommerce first.

Target:

- Web3 service providers.
- AI automation consultants.
- Small cross-border agencies.
- Sui ecosystem teams paying contributors.
- Creators, translators, tutorial writers, and bounty participants.

## Product promise

Create a payment link in under one minute. Let the buyer pay supported Sui stablecoins without separately buying SUI gas. Use escrow when the payment depends on service delivery. Generate an on-chain receipt both parties can verify.

## Why Sui

Sui is relevant because:

- Sui launched gasless stablecoin transfers in May 2026.
- Sui supports sponsored transactions for gasless app flows.
- Sui's object model maps naturally to invoices, escrow, receipts, and delivery proofs.
- Sui finality and low fees fit frequent payment links and small service transactions.

## Winning angle

This is not a generic payment processor. The angle is:

> Turn a cross-border service agreement into a gasless Sui stablecoin escrow link.

## MVP success

The demo succeeds if a judge can understand and see:

1. Seller creates a service paylink.
2. Buyer pays without first holding SUI gas.
3. Funds enter escrow.
4. Seller marks delivery.
5. Buyer releases funds.
6. Seller receives stablecoin.
7. Both sides see a Sui receipt.

## Kill criteria

Kill or pivot if:

- We cannot complete a sponsored/gasless payment-like flow.
- The product becomes just a normal wallet transfer.
- Escrow is not essential to the user story.
- We cannot explain why users would not just use Stripe, PayPal, or a direct USDC transfer.
