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

- Package ID: `0x0bd14fb2c341415b418a74b74caa1c5f5ec513e69c7a313da533fa56d6e325b7`
- Publish digest: `EzCXP2GqsZg9E9y1tBuje7RiTMQx2a8peExXeEc4SAjH`
- SUI escrow object: `0xe739f5ff0cf7df9d89259b90de24afd80bcde18c8567c9faaa18bc904dfb3f32`
- SUI release digest: `3PyZUQ1WXdPpVHyXTG8C8RfMkb4FS8yAdgqinXbeyYgo`
- Verified state: `delivered: true`, `released: true`, and `funds: "0"`
- Refund escrow object: `0x32b160688c2f1bf241dfd671a87e4070fa4bdb2ca3ae15f2d9516dde2f9f8ead`
- Refund digest: `Ap6CKTuxKSQqKWXFfc676TZfndNsXkkrdwH5pxwt3MJW`
- Refund verified state: `refunded: true`, `released: false`, and `funds: "0"`
- Two-party escrow object: `0xc1a5d8d3316d4e2290b212d9b18dbb26ed9066efe0d304121fbd43d8ce80c8ef`
- Two-party release digest: `8nUvpEeFK3sXZX3hdMEjdzctiGpsAN5CH7NhRZ2Yko8Z`
- Two-party verified state: separate buyer, seller, fee receiver, `released: true`, and `funds: "0"`
- Negative permission checks: buyer cannot mark delivered (`E_NOT_SELLER`), seller cannot release (`E_NOT_BUYER`).
- MockUSDC coin type: `0x0bd14fb2c341415b418a74b74caa1c5f5ec513e69c7a313da533fa56d6e325b7::mock_usdc::MOCK_USDC`
- MockUSDC escrow object: `0x510ba488084c0ae1e6c10b1ddb4d2e83065e643ea78fc82825ff1723c95d1085`
- MockUSDC release digest: `JCVgJ7axUWaaNJ35fUTwvVbeVZhM6BAMTV3i9vsVXDuT`
- Sponsored MockUSDC escrow object: `0x9a1fefe14c9148a246122c9d280075994a698650e09ca6e664d9c42e4304e066`
- Sponsored MockUSDC fund digest: `6JPrSsia2NDvzR5SgYBn21KXCFREb7QRsnzfQzs8saad`
- Sponsored MockUSDC delivery digest: `9JRkLm9zqvCEpN1hfwvZRBhz5vDUT5jScNqMTFLrsAk8`
- Sponsored MockUSDC release digest: `2AUpapsvVJdkXLtt9jVo2X8dgBPP2pvKv8FdGE6nz8QM`
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
- The API rejects duplicate active sponsored requests for the same Paylink/action and re-dry-runs built bytes before sponsor signing.
- `POST /api/paylinks/:id/sync-chain` can build an on-demand chain verification summary from recorded sponsored digests, transaction events, and current Escrow object state.

Still not verified:

- Browser wallet compatibility for the sponsored UI panel.
- Fresh Testnet evidence for the expanded Paylink idempotency smoke path.
- Background event-indexed receipt state sourced from checkpoints or cursors.

Therefore the product can claim a verified Testnet sponsored `mUSDC` escrow
path, but not a production stablecoin payment product.

## Commands

Run the no-chain API regression smoke before Testnet work:

```bash
npm run smoke:api
```

After configuring a real sponsor private key, verify sponsor readiness without
printing the secret:

```bash
SPONSOR_PRIVATE_KEY=<sui-private-key> npm run sponsor:readiness
```

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
