# Sui Overflow Submission Pitch

## Project name

SuiPayLink

## Tagline

Gasless stablecoin escrow links for cross-border digital services.

## Short description

SuiPayLink lets a seller create a stablecoin payment link, lets a buyer pay without first holding SUI gas, and records invoice, escrow, delivery, release, and receipt state on Sui. It is designed for Web3 services, AI automation sellers, creators, small agencies, and Sui teams paying contributors.

## Problem

Stablecoin payments are useful for cross-border services, but first-time payment UX still fails on wallets, gas, unclear addresses, and trust. Buyers do not want to acquire SUI before paying. Sellers do not want to manually coordinate wallet addresses. For service work, both sides need escrow and proof of delivery.

## Solution

SuiPayLink turns a service agreement into a gasless Sui stablecoin paylink:

1. Seller creates paylink.
2. Buyer opens link.
3. Buyer pays supported Sui stablecoin without managing SUI gas.
4. Funds go directly to seller or into escrow.
5. Seller marks delivery.
6. Buyer releases funds.
7. Both sides receive an on-chain receipt.

## Why Sui

Sui is uniquely suited because of:

- gasless stablecoin transfers;
- sponsored transactions;
- object-centric asset model;
- low latency and low fees;
- programmable transaction logic.

## Demo script

1. Alice creates a `100 USDC` escrow paylink for an AI workflow setup.
2. Bob opens the link and pays into escrow without needing SUI gas.
3. SuiPayLink shows the escrow object as funded.
4. Alice attaches delivery proof.
5. Bob releases funds.
6. Alice receives stablecoin minus platform fee.
7. Receipt page shows transaction and object state.

## Track

Primary: DeFi & Payments.

Secondary: Agentic Web if AI-generated invoices, reminders, and service-agent payment flows are included.

## What we built

- Sui Move escrow package.
- Paylink creation flow.
- Sponsored/gasless payment UX.
- Seller dashboard.
- Buyer paylink page.
- Receipt page.

## Business model

- Setup fees for Sui teams and crypto-native service sellers.
- Transaction fee on escrow payments.
- Seller/team subscriptions for branded pages, limits, exports, and API.

## Why it matters

Sui has made stablecoin movement simpler. SuiPayLink turns that infrastructure into a concrete workflow for real service payments: create link, pay without gas, hold in escrow, release on delivery, verify receipt.
