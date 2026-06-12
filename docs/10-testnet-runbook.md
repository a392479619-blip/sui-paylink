# Testnet Runbook

## Goal

SuiPayLink is considered runnable on Sui Testnet only when a reviewer can verify the complete escrow state machine using public Testnet transactions:

1. Publish the Move package.
2. Create and fund an escrow.
3. Mark the service delivered.
4. Release the funds.
5. Refund a separate funded escrow.
6. Complete a separate buyer/seller/fee-receiver flow.
7. Complete a non-SUI `mUSDC` escrow flow using the package's test-only MockUSDC coin.
8. Complete a sponsored non-SUI `mUSDC` escrow flow where buyer and seller both hold `0` SUI.
9. Open the resulting package, transaction digests, and escrow objects in a public explorer.

## Completion Evidence

The Testnet gate is complete only when all of the following are true:

- `deployments/testnet.json` contains a successful publish digest and Package ID.
- `deployments/testnet-smoke.json` contains successful fund, deliver, and release digests.
- `deployments/testnet-refund-smoke.json` contains successful fund and refund digests.
- `deployments/testnet-two-party-smoke.json` contains separate buyer, seller, and fee receiver addresses.
- `deployments/testnet-mock-usdc-smoke.json` contains a successful escrow whose type is `Escrow<...::mock_usdc::MOCK_USDC>`.
- `deployments/testnet-sponsored-mock-usdc-smoke.json` contains successful sponsored fund, deliver, and release digests.
- The recorded Escrow object has `delivered: true`, `released: true`, and an empty balance.
- The recorded refund Escrow object has `refunded: true`, `released: false`, and an empty balance.
- The two-party recorded Escrow object has different buyer, seller, and fee receiver addresses.
- The sponsored recorded flow has buyer SUI `0`, seller SUI `0`, sponsor-paid gas, seller `mUSDC` settlement, and platform fee settlement.
- The web app is configured with `VITE_SUI_NETWORK=testnet` and the deployed Package ID.

Local-chain or Devnet success is useful engineering evidence, but it does not satisfy the Testnet gate.

## Current Verified Deployment

- Package ID: `0x994e7ea20d955da3539c9971584bc4d524066b3df5bcbef0c180bfc2e3c5c340`
- Publish digest: `ATkpRVoK2RWs15qSdD6r8JokLQuAHkDeWBrC8Z18fYh3`
- SUI escrow object: `0x7d57991709a3ab42f083c33421b9b33da4edb8266cdcb3bd447129ffa6f5128c`
- SUI release digest: `5SyCRy8Hif79HYRYrkomc32TPSHxd6DiJAorp3p1avPT`
- Verified state: `delivered: true`, `released: true`, and `funds: "0"`
- Refund escrow object: `0x5c858335a12b11fe44ccd7955e7fa838c84004b900e2839cbe08be5eaeb5215b`
- Refund digest: `BFjypQRCWAfTJWMrSBhYJpV2FoWiXS26FGmpThFjJZ3m`
- Refund verified state: `refunded: true`, `released: false`, and `funds: "0"`
- Two-party escrow object: `0x1295580b1f37791843cc0ed9885a13eb8c1a932a273a693e360564d9411d50d3`
- Two-party release digest: `A4FeNvjhWMhBqRkJfxg6DyNYZhvgArHCn9g9gcuxWJyt`
- Two-party verified state: separate buyer, seller, fee receiver, `released: true`, and `funds: "0"`
- Negative permission checks: buyer cannot mark delivered (`E_NOT_SELLER`), seller cannot release (`E_NOT_BUYER`).
- MockUSDC coin type: `0x994e7ea20d955da3539c9971584bc4d524066b3df5bcbef0c180bfc2e3c5c340::mock_usdc::MOCK_USDC`
- MockUSDC escrow object: `0xa044130a456a9ca7f4f73bce8890c9a21753edbb10909e19682f403aec121e04`
- MockUSDC release digest: `A4XgUMXCG5eAnG2qLWqy21H4T4MPnYnnzXvygdmmhzP3`
- Sponsored MockUSDC escrow object: `0xfa140db34391e6d7af3968c8cca37725028a7d4c97b3346fc6c4fda2a97ca0dc`
- Sponsored MockUSDC fund digest: `ADJcJgnyaC5K8q7tUyygehMqYKYPJ9V2VYbTRUGqK7Nm`
- Sponsored MockUSDC delivery digest: `J4AUZw7aV1npeoU7anpLerDScEKCseELzb1BiwukNZNB`
- Sponsored MockUSDC release digest: `FHpRgU1UBvaHVQBNQMh9ReUKmr2jHWgaGZWxQHCkqAeQ`
- Sponsored buyer SUI balance: initial `0`, final `0`
- Sponsored seller SUI balance: initial `0`, final `0`
- Sponsored settlement: seller received `99 mUSDC`, fee receiver received `1 mUSDC`

The verified flow now includes both Test SUI and `mUSDC`. `mUSDC` is a test-only
MockUSDC coin owned by this package; it is not real USDC.

## Sponsored API Status

The backend now exposes the P0 sponsored transaction boundary:

- `POST /api/sponsored-transactions/build`
- `GET /api/sponsored-transactions/:id`
- `POST /api/sponsored-transactions/:id/submit`

Allowed actions are:

- `fund-mock-usdc`
- `mark-delivered`
- `release`
- `refund`

Current verified status:

- The API compiles and builds.
- `/api/config` returns `sponsorEnabled: false` when no sponsor private key is configured.
- A build request without `SPONSOR_PRIVATE_KEY` returns `503 sponsor_not_configured`.
- With a funded Testnet sponsor key, the API builds, dry-runs, dual-signs, submits, and records sponsored `mUSDC` escrow transactions.
- `deployments/testnet-sponsored-mock-usdc-smoke.json` proves buyer and seller can execute the escrow flow with `0` SUI.
- Sponsored transaction requests are persisted to `.data/sponsored-transactions.json`.
- When a sponsored transaction has `paylinkId`, successful execution can update the Paylink with digest, escrow object, status, and actual gas cost.

Still not verified:

- Browser wallet compatibility for the sponsored UI panel.
- Paylink-specific idempotency rejection for duplicate sponsor actions.
- Event-indexed receipt state sourced from chain events.

Therefore the product can claim a verified Testnet sponsored `mUSDC` escrow
path, but not a production stablecoin payment product.

## Commands

```bash
sui client switch --env testnet
sui client gas --json
npm run chain:deploy:testnet
npm run chain:smoke:testnet
npm run chain:smoke:refund:testnet
npm run chain:smoke:two-party:testnet
npm run chain:smoke:mock-usdc:testnet
npm run chain:smoke:sponsored-mock-usdc:testnet
```

If there is no Testnet SUI, request it for the active address:

```bash
sui client active-address
```

Then use `https://faucet.sui.io/?address=<active-address>`.

The dedicated project deployer and current faucet request instructions are recorded in `deployments/testnet-faucet-request.md`.

## Hackathon Submission Boundary

A Testnet deployment is enough for the technical chain environment of a hackathon submission. Mainnet deployment is not required for the MVP.

Testnet deployment alone is not a complete submission. The final submission still needs:

- Public source repository.
- Working demo or hosted frontend.
- Clear project description and selected primary track.
- Demo video and evidence showing why Sui is essential.

Sponsored gas has Testnet smoke evidence for package-owned `mUSDC`. The final
submission still must state that `mUSDC` is a test coin and that real stablecoin
support, browser-wallet sponsored signing, event indexing, and hosted UX are
separate from the chain mechanism proof.
