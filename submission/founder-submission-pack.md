# SuiPayLink Founder Submission Pack

Generated from local submission checks.
Source updatedAt: 2026-06-17

## Current Decision

- Open registration form: YES
- Minimum submission: PASS
- Final submit without user action: NO
- Competitive demo: NEEDS WORK

Interpretation: fill prepared fields now if the live form is pre-registration or accepts missing demo/video. Do not paste placeholder Demo URL or Demo video URL.

## Event

- Name: Sui Overflow 2026
- Official URL: https://overflow.sui.io/
- Registration URL: https://www.deepsurge.xyz/hackathons/b587dc0c-4cb8-4e63-ada5-519df38103bf
- Selected track: DeFi & Payments
- Track rationale: SuiPayLink is a payment rail and escrow primitive for real-world cross-border digital service payments.

## Copy These Fields

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

### Repository URL

```text
https://github.com/a392479619-blip/sui-paylink
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

## Optional Answers

Use only when the live form asks a matching question.

### What makes this useful?

Length: 408/800

```text
SuiPayLink targets a concrete payment workflow instead of a generic crypto checkout. Service sellers need payment links, buyers need low-friction stablecoin payment, and both sides need escrow state plus a receipt they can verify later. The wedge is cross-border digital service escrow with sponsored gas on Sui: the buyer signs the business action, while the sponsor pays gas in the verified sponsored flow.
```

### What did you build during the hackathon?

Length: 449/900

```text
I built a Sui Move escrow package, deployed it on public Sui Testnet, added a project-owned MockUSDC test coin, verified SUI escrow, refund, two-party, MockUSDC, and sponsored MockUSDC flows, built a Fastify API for Paylinks and sponsored transaction build/submit, built a React seller dashboard and public buyer pay page, added receipt sync against Sui digests and Escrow object state, and added smoke/readiness scripts for submission verification.
```

### Why Sui?

Length: 405/800

```text
Sui fits this project because sponsored transactions let the app sponsor pay gas while the buyer or seller still signs the business action. Sui objects also map cleanly to escrow state and verifiable receipts. Low fees, fast settlement, and Sui's gasless stablecoin direction make it a strong chain for small cross-border digital service payments where forcing users to acquire gas first kills conversion.
```

### How can judges verify it?

Length: 509/900

```text
Judges can inspect the public Sui Testnet package and transactions in Sui Explorer, run the local smoke tests, and open the Paylink buyer flow. The README links the package, publish transaction, sponsored MockUSDC fund/release transactions, and sponsored escrow object. The API includes Judge Test Mode for minting Testnet mUSDC when a private minter key is configured. Locally, run npm run smoke:api, npm run smoke:preview, npm run smoke:static-demo, npm run submission:readiness, and npm run founder:verify.
```

### What is not finished?

Length: 442/900

```text
This is a hackathon MVP on public Sui Testnet. It does not claim production USDC support, fiat ramps, legal arbitration, full event indexing, or Stripe replacement behavior. The current strongest evidence is the deployed Move package plus Testnet smoke flows, including sponsored MockUSDC where buyer and seller hold 0 SUI while the sponsor pays gas. Public hosting, demo video, and browser-wallet sponsored E2E remain final submission steps.
```

## Verify Before Pasting

- none

## Leave Blank Until Verified

- Demo URL: Do not submit a demo URL until Cloudflare or another public host is actually deployed and browser-verified.
- Demo video URL: Record and upload the demo video first. Use docs/13-demo-script-cn.md.

## Evidence Links

- Package: https://suiexplorer.com/object/0x994e7ea20d955da3539c9971584bc4d524066b3df5bcbef0c180bfc2e3c5c340?network=testnet
- Package publish transaction: https://suiexplorer.com/txblock/ATkpRVoK2RWs15qSdD6r8JokLQuAHkDeWBrC8Z18fYh3?network=testnet
- Sponsored MockUSDC fund transaction: https://suiexplorer.com/txblock/ADJcJgnyaC5K8q7tUyygehMqYKYPJ9V2VYbTRUGqK7Nm?network=testnet
- Sponsored MockUSDC release transaction: https://suiexplorer.com/txblock/FHpRgU1UBvaHVQBNQMh9ReUKmr2jHWgaGZWxQHCkqAeQ?network=testnet
- Sponsored escrow object: https://suiexplorer.com/object/0xfa140db34391e6d7af3968c8cca37725028a7d4c97b3346fc6c4fda2a97ca0dc?network=testnet

## Current Gaps

- Static public demo path
- Real API hosted demo
- Browser wallet sponsored E2E

## Next Actions

- Leave Demo URL blank unless a public URL has been deployed and opened successfully in a browser.
- Leave Demo video URL blank unless a public or unlisted video has been uploaded and opened successfully.
- If the form requires Demo URL, deploy Cloudflare/GitHub Pages static demo or a hosted API demo first, then rerun npm run founder:verify.
- For a stronger demo, record one browser-wallet sponsored flow and export evidence with npm run evidence:browser-wallet.

## Pre-Submit Commands

```bash
npm run registration:copy -- --write
npm run submission:pack -- --write
npm run registration:audit
npm run founder:verify
npm run submission:readiness -- --with-sponsor
```

## External Entry Snapshot

Observed at: 2026-06-17 Asia/Shanghai

Purpose: keep the founder submission decision tied to the live public entry pages, not to memory or stale planning notes.

## Sources Checked

- Official Sui Overflow page: https://overflow.sui.io/
- DeepSurge registration entry: https://www.deepsurge.xyz/hackathons/b587dc0c-4cb8-4e63-ada5-519df38103bf

## Observations

- The official page identifies the event as Sui Overflow 2026 and shows May - August, 2026.
- The official page has a Register link pointing to DeepSurge.
- The official page body says registration is open.
- The official FAQ says pre-registration is open and says participants should sign up for updates, early access, and next steps.
- The official FAQ says a project must select one best-representative track.
- The public DeepSurge page shell is accessible, but its public HTML does not expose the logged-in form fields or required-field rules.

## Submission Impact

- Open the registration form now.
- Treat the live DeepSurge UI as authoritative for whether this is pre-registration or final project submission.
- Select only one track: DeFi & Payments.
- Do not fill Demo URL unless the public URL opens successfully in a browser.
- Do not fill Demo video URL unless the uploaded video opens publicly or unlisted.
- Repository URL can be used because the GitHub repository is public.

## Current Local Go / No-Go

Go:

- Use `submission/registration-copy.md` for prepared fields and optional answers.
- Use Testnet evidence links from README and `submission/registration-fields.json`.
- Submit a pre-registration form if it accepts project basics without requiring public demo/video.

No-Go:

- The live form requires Demo URL, but GitHub Pages/Cloudflare/hosted API has not been deployed and browser-verified.
- The live form requires Demo video URL, but no public or unlisted video has been uploaded.
- The live form requires production payment claims, real USDC, or legal arbitration claims beyond the current Testnet mUSDC MVP.

