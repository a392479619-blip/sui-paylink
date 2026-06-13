# SuiPayLink Registration Copy Sheet

Generated from `submission/registration-fields.json`.
Source updatedAt: 2026-06-13

## Event

- Name: Sui Overflow 2026
- Official URL: https://overflow.sui.io/
- Registration URL: https://www.deepsurge.xyz/hackathons/b587dc0c-4cb8-4e63-ada5-519df38103bf
- Selected track: DeFi & Payments

## Ready Fields

Copy these fields into the form when the matching field exists.

### Project name

```text
SuiPayLink
```

### Tagline

```text
Gasless stablecoin escrow links for cross-border digital services.
```

### Track

```text
DeFi & Payments
```

### Short description

Length: 263/500

```text
SuiPayLink lets service sellers create gasless stablecoin escrow payment links on Sui. Buyers can enter a sponsored mUSDC escrow flow without holding SUI gas, sellers can mark delivery, buyers can release or refund, and both sides get verifiable Testnet receipts.
```

### One-sentence description

Length: 137/280

```text
SuiPayLink turns cross-border digital service payments into gasless Sui escrow links with sponsored transactions and verifiable receipts.
```

### Long description

Length: 751/1500

```text
SuiPayLink is a payment-link product for Web3 services, AI automation sellers, small cross-border agencies, creators, and Sui ecosystem teams paying contributors. It turns a service agreement into a Sui escrow payment link: the seller creates a link, the buyer opens it, signs the business transaction, and the sponsor pays gas in the verified sponsored flow. The Move package records escrow state on Sui; the API persists Paylinks and sponsored transaction records; the receipt page can sync against Sui digests and Escrow object state. The current MVP proves the payment rail and escrow state machine on public Sui Testnet using a project-owned MockUSDC coin. It is not production USDC support, a Stripe replacement, or a legal arbitration platform.
```

### Problem

Length: 285/800

```text
Stablecoin service payments still require too much manual coordination. Buyers do not want to acquire SUI before paying. Sellers do not want to send raw wallet addresses and manually reconcile payments. Both sides need a simple escrow workflow and a receipt that can be verified later.
```

### Solution

Length: 280/800

```text
SuiPayLink turns a service invoice into a Sui payment link. It supports escrow creation, sponsored transaction build/sign/submit, seller delivery marking, buyer release/refund, receipt math, and on-demand chain verification against Sui transaction digests and Escrow object state.
```

### Tech stack

Length: 161/500

```text
Sui Move, Sui TypeScript SDK, React, Vite, Fastify, Node.js 22, GitHub Actions, Cloudflare Pages workflow, file-backed JSON stores for hackathon MVP persistence.
```

### Contract package

```text
0x994e7ea20d955da3539c9971584bc4d524066b3df5bcbef0c180bfc2e3c5c340
```

### Team

Length: 51/300

```text
Solo builder. Founder / developer / product: criss.
```

## Needs Founder Verification

Do not paste these until the condition is true in the live form.

### Repository URL

```text
https://github.com/a392479619-blip/sui-paylink
```

Decision: The repository is currently private. Make it public before final submission, or confirm the platform can access a private repository.

## Hold Fields

Leave these blank unless the condition has been verified in a browser.

### Demo URL

Status: HOLD
Reason: Do not submit a demo URL until Cloudflare or another public host is actually deployed and browser-verified.
Value to submit now: leave blank

### Demo video URL

Status: HOLD
Reason: Record and upload the demo video first. Use docs/13-demo-script-cn.md.
Value to submit now: leave blank

## Evidence Links

- Package: https://suiexplorer.com/object/0x994e7ea20d955da3539c9971584bc4d524066b3df5bcbef0c180bfc2e3c5c340?network=testnet
- Package publish transaction: https://suiexplorer.com/txblock/ATkpRVoK2RWs15qSdD6r8JokLQuAHkDeWBrC8Z18fYh3?network=testnet
- Sponsored MockUSDC fund transaction: https://suiexplorer.com/txblock/ADJcJgnyaC5K8q7tUyygehMqYKYPJ9V2VYbTRUGqK7Nm?network=testnet
- Sponsored MockUSDC release transaction: https://suiexplorer.com/txblock/FHpRgU1UBvaHVQBNQMh9ReUKmr2jHWgaGZWxQHCkqAeQ?network=testnet
- Sponsored escrow object: https://suiexplorer.com/object/0xfa140db34391e6d7af3968c8cca37725028a7d4c97b3346fc6c4fda2a97ca0dc?network=testnet

## Go Conditions

- The form accepts project basics, track, repository URL, and written description.
- The form allows demo URL and demo video URL to be omitted or added later.
- The repository is made public or the platform can access a private repository.

## No-Go Conditions

- The form requires a public demo URL before submission.
- The form requires a public or unlisted demo video before submission.
- The form requires a public repository and the repository is still private.
- The form requires production payment claims beyond current Testnet mUSDC evidence.

## Pre-Submit Commands

```bash
npm run registration:audit
npm run founder:verify
npm run public:preflight
```

If `founder:verify` says `Final submit without user action: NO`, follow the hold and verification rules above instead of pasting placeholder links.

