# SuiPayLink

Walletless, gasless stablecoin paylinks with optional escrow for cross-border digital service work on Sui.

## One-liner

SuiPayLink lets a seller create a stablecoin payment link, lets a buyer pay without first holding SUI gas, and records invoice, escrow, and receipt state as Sui objects.

## Why now

Sui launched gasless stablecoin transfers in May 2026, removing the need for users to hold a separate SUI gas balance when sending supported stablecoins. That opens a narrow product window: simple payment experiences where users can send digital dollars without first learning gas mechanics.

## Target user

The first target user is not mainstream ecommerce. The first target user is:

- Web3 service providers
- AI automation service sellers
- Small cross-border agencies
- Sui ecosystem teams paying contributors
- Creators and freelancers who already accept stablecoins

## MVP

- Seller creates a direct paylink or escrow paylink.
- Buyer opens the link and pays a supported Sui stablecoin.
- Simple transfers use Sui gasless stablecoin transfer where available.
- Escrow operations use sponsored transactions so the buyer does not need SUI gas.
- Contract records invoice, escrow, payment, delivery, release, and receipt state.
- Dashboard shows link status and receipt.

## What this is not

- Not a Stripe replacement.
- Not a generic crypto checkout.
- Not a multi-chain processor.
- Not a fiat ramp.
- Not a legal arbitration platform.

## Hackathon track fit

Primary track: DeFi & Payments.

Secondary fit: Agentic Web, if we add AI invoice generation, payment reminder generation, and agent-created service payment flows.

## Repository structure

```text
sui-paylink/
├── AGENTS.md
├── Dockerfile
├── README.md
├── contracts/
│   ├── Move.toml
│   └── sources/suipaylink.move
└── docs/
    ├── 01-project-brief.md
    ├── 02-user-flows.md
    ├── 03-architecture.md
    ├── 04-business-and-gtm.md
    ├── 05-competition.md
    ├── 06-submission-pitch.md
    ├── 07-build-plan.md
    ├── 08-risk-and-compliance.md
    ├── 09-mvp-prd.md
    ├── 10-testnet-runbook.md
    ├── 11-prd-cn.md
    ├── 12-p0-implementation-checklist-cn.md
    ├── 13-demo-script-cn.md
    ├── 14-submission-checklist-cn.md
    ├── 15-deployment-runbook-cn.md
    └── 16-registration-pack-cn.md
├── submission/
│   └── registration-fields.json
```

## Current status

SuiPayLink is deployed and verified on public Sui Testnet with Sui CLI `1.73.0`.
The verified flow completed:

1. Publish package.
2. Create and fund shared escrow with SUI.
3. Mark the service delivered.
4. Release funds to seller and platform fee receiver.
5. Create and fund a separate escrow, then refund it to the buyer before delivery.
6. Run a two-party Testnet flow with separate buyer, seller, and fee receiver addresses.
7. Create, mint, escrow, deliver, and release `mUSDC`, a test-only MockUSDC coin.
8. Run a sponsored `mUSDC` escrow flow where buyer and seller both hold `0` SUI.
9. Run Move unit tests for amount validation, fee caps, permissions, release, refund, MockUSDC minting, and fee split behavior.

Verified Testnet evidence:

- [Package](https://suiexplorer.com/object/0x0bd14fb2c341415b418a74b74caa1c5f5ec513e69c7a313da533fa56d6e325b7?network=testnet): `0x0bd14fb2c341415b418a74b74caa1c5f5ec513e69c7a313da533fa56d6e325b7`
- [Publish transaction](https://suiexplorer.com/txblock/EzCXP2GqsZg9E9y1tBuje7RiTMQx2a8peExXeEc4SAjH?network=testnet): `EzCXP2GqsZg9E9y1tBuje7RiTMQx2a8peExXeEc4SAjH`
- [SUI escrow object](https://suiexplorer.com/object/0xe739f5ff0cf7df9d89259b90de24afd80bcde18c8567c9faaa18bc904dfb3f32?network=testnet): `0xe739f5ff0cf7df9d89259b90de24afd80bcde18c8567c9faaa18bc904dfb3f32`
- [SUI release transaction](https://suiexplorer.com/txblock/3PyZUQ1WXdPpVHyXTG8C8RfMkb4FS8yAdgqinXbeyYgo?network=testnet): `3PyZUQ1WXdPpVHyXTG8C8RfMkb4FS8yAdgqinXbeyYgo`
- Final state: delivered, released, and empty balance
- [Refund transaction](https://suiexplorer.com/txblock/Ap6CKTuxKSQqKWXFfc676TZfndNsXkkrdwH5pxwt3MJW?network=testnet): `Ap6CKTuxKSQqKWXFfc676TZfndNsXkkrdwH5pxwt3MJW`
- Refund final state: not delivered, not released, refunded, and empty balance
- [Two-party release transaction](https://suiexplorer.com/txblock/8nUvpEeFK3sXZX3hdMEjdzctiGpsAN5CH7NhRZ2Yko8Z?network=testnet): `8nUvpEeFK3sXZX3hdMEjdzctiGpsAN5CH7NhRZ2Yko8Z`
- Two-party escrow: `0xc1a5d8d3316d4e2290b212d9b18dbb26ed9066efe0d304121fbd43d8ce80c8ef`
- Two-party final state: separate buyer, seller, and fee receiver, delivered, released, and empty balance
- [MockUSDC release transaction](https://suiexplorer.com/txblock/JCVgJ7axUWaaNJ35fUTwvVbeVZhM6BAMTV3i9vsVXDuT?network=testnet): `JCVgJ7axUWaaNJ35fUTwvVbeVZhM6BAMTV3i9vsVXDuT`
- MockUSDC escrow: `0x510ba488084c0ae1e6c10b1ddb4d2e83065e643ea78fc82825ff1723c95d1085`
- MockUSDC coin type: `0x0bd14fb2c341415b418a74b74caa1c5f5ec513e69c7a313da533fa56d6e325b7::mock_usdc::MOCK_USDC`
- [Sponsored MockUSDC fund transaction](https://suiexplorer.com/txblock/6JPrSsia2NDvzR5SgYBn21KXCFREb7QRsnzfQzs8saad?network=testnet): `6JPrSsia2NDvzR5SgYBn21KXCFREb7QRsnzfQzs8saad`
- [Sponsored MockUSDC release transaction](https://suiexplorer.com/txblock/2AUpapsvVJdkXLtt9jVo2X8dgBPP2pvKv8FdGE6nz8QM?network=testnet): `2AUpapsvVJdkXLtt9jVo2X8dgBPP2pvKv8FdGE6nz8QM`
- Sponsored MockUSDC escrow: `0x9a1fefe14c9148a246122c9d280075994a698650e09ca6e664d9c42e4304e066`
- Sponsored proof: buyer SUI `0`, seller SUI `0`, sponsor paid gas, seller received `99 mUSDC`, fee receiver received `1 mUSDC`.

The latest Testnet smoke tests include both Test SUI and `mUSDC`. `mUSDC` is a
project-owned test coin, not real USDC. The API now has a verified sponsored
transaction path for `mUSDC` escrow actions on Testnet, file-backed Paylink
persistence for the mock product flow, a direct `/pay/:id` buyer page, and a
single-service production preview mode that serves the built web app from the
API process. This proves the gasless escrow mechanism and gives reviewers a
runnable Paylink UX, but production stablecoin support, event indexing,
browser-wallet sponsored signing, and a public hosted demo URL are still
separate work.

Local verification:

```bash
npm run smoke:api
npm run smoke:preview
npm run submission:readiness
```

`smoke:api` starts the API on an isolated local port with temporary stores and
verifies Paylink creation, mock escrow state transitions, receipt math,
`sync-chain` pending behavior, and the `sponsor_not_configured` guard.
`smoke:preview` starts the production single-service preview and verifies
`/health`, `/api/config`, Paylink creation, web fallback routes, built assets,
and unknown API 404 behavior.
`submission:readiness` checks the local Testnet evidence files, required smoke
scripts, submission docs, latest CI status when `gh` is available, and the
remaining demo blockers. It does not print private keys. Add `-- --with-sponsor`
after funding the sponsor address to include live sponsor gas readiness.

Sponsor readiness before browser-wallet E2E:

```bash
npm run sponsor:bootstrap
npm run sponsor:bootstrap -- --write-env-local --request-faucet --readiness
SPONSOR_PRIVATE_KEY=<sui-private-key> npm run sponsor:readiness
npm run evidence:browser-wallet -- --paylink-id <paylink-id>
```

`sponsor:bootstrap` generates or reuses an Ed25519 sponsor key, prints the
derived sponsor address without printing the private key, can write the key to
the gitignored `.env.local`, can request Testnet SUI from the official faucet,
and can immediately run readiness. If faucet access is rate-limited or requires
browser CAPTCHA, fund the printed sponsor address manually from a Sui Testnet
faucet, then run `npm run sponsor:readiness`.

`sponsor:readiness` validates the sponsor key without printing it, derives the
sponsor address, checks Testnet SUI gas balance, verifies the deployed package
object, reads MockUSDC metadata, and checks gas budget configuration.

Judge-friendly test mUSDC minting is optional. Configure
`MOCK_USDC_MINTER_PRIVATE_KEY` only in a private local or hosted environment
when that key owns the deployed MockUSDC TreasuryCap. When configured,
`/pay/<id>` shows a `Mint 100 test mUSDC` button for the connected Buyer wallet,
calls `POST /api/mock-usdc/mint`, and auto-selects the returned payment coin
object. Without this key, the page keeps the CLI fallback command visible and
disables web minting instead of pretending that a faucet exists.

After a real browser-wallet sponsored flow succeeds, `evidence:browser-wallet`
reads the local Paylink and sponsored transaction stores, verifies the executed
digests on Sui Testnet, checks that gas owner is the sponsor, and writes
`deployments/browser-wallet-sponsored-e2e.json` for the hackathon submission.

```bash
sui client switch --env testnet
npm run chain:deploy:testnet
npm run chain:smoke:testnet
npm run chain:smoke:refund:testnet
npm run chain:smoke:two-party:testnet
npm run chain:smoke:mock-usdc:testnet
npm run chain:smoke:sponsored-mock-usdc:testnet
npm run chain:test
```

Sponsored API endpoints:

- `POST /api/mock-usdc/mint`
- `POST /api/sponsored-transactions/build`
- `GET /api/sponsored-transactions`
- `GET /api/sponsored-transactions/:id`
- `POST /api/sponsored-transactions/:id/submit`

Allowed sponsored actions are `fund-mock-usdc`, `mark-delivered`, `release`,
and pre-delivery `refund`. Without `SPONSOR_PRIVATE_KEY`, the API returns `503` and
`sponsorEnabled: false`. For Paylink-bound requests, the API rejects duplicate
active sponsor builds for the same action, blocks conflicting release/refund
settlement requests, rejects refunds after seller delivery, and re-dry-runs
transaction bytes before sponsor signing.

The public buyer page at `/pay/<id>` is wired to the same sponsored transaction
path. It shows wallet connection, required signer roles, payment coin object
input, action buttons, and sponsored request history. In a local mock sponsor
environment the real sponsor buttons are disabled instead of falling back to the
old mock state mutation flow.

Receipt pages can call `POST /api/paylinks/:id/sync-chain` to refresh a
Paylink-bound receipt from recorded sponsored digests, Sui transaction events,
and the current Escrow object state. This is a minimal on-demand chain sync, not
a production event indexer.

The web app includes a wallet-signed on-chain verification panel and defaults to
the verified Testnet deployment. Override it with:

```bash
VITE_SUI_NETWORK=<devnet-or-testnet>
VITE_PACKAGE_ID=<package-id>
```

Local Paylinks are persisted to `.data/paylinks.json` by default. Override the
path with `PAYLINK_STORE_PATH` when running the API. Sponsored transaction
requests are persisted to `.data/sponsored-transactions.json`; override that
with `SPONSORED_TRANSACTION_STORE_PATH`. After starting the app with `npm run
dev`, create a Paylink in the seller dashboard and open the generated
`http://127.0.0.1:5174/pay/<id>` URL to review the buyer page.

Production demo preview:

```bash
npm run build
HOST=0.0.0.0 PORT=8787 SERVE_WEB_APP=true PUBLIC_BASE_URL=http://127.0.0.1:8787 npm start
```

Then open `http://127.0.0.1:8787`. In production builds, the web app calls the
same origin API unless `VITE_API_BASE` is explicitly set.

Docker demo:

```bash
docker build -t sui-paylink .
docker run --rm -p 8787:8787 \
  -e PUBLIC_BASE_URL=http://127.0.0.1:8787 \
  sui-paylink
```

For a hosted hackathon demo, set `HOST=0.0.0.0`, the platform-provided `PORT`,
`PUBLIC_BASE_URL=<hosted-url>`, and a persistent `PAYLINK_STORE_PATH` if the
host supports disk persistence. Set `SPONSOR_PRIVATE_KEY` only when recording a
real browser-wallet sponsored flow; otherwise sponsored buttons stay disabled
instead of pretending to execute on-chain.

Set `DEMO_SEED_ENABLED=true` to create a stable demo Paylink at
`/pay/demo-ai-workflow` on startup. This is useful for hosted demos on ephemeral
storage. When sponsor is not configured, that seed page exposes a local demo
button that can run the mock fund, deliver, and release sequence; it is still
only a demo record until a real sponsored wallet flow is executed.

`render.yaml` provides a Render Blueprint for a quick public demo deploy. See
`docs/15-deployment-runbook-cn.md` for the deployment checklist and current
boundaries.

Static public demo:

```bash
npm run smoke:static-demo
npm run smoke:cloudflare-demo
```

`smoke:static-demo` builds a GitHub Pages-compatible demo under `/sui-paylink/`.
`smoke:cloudflare-demo` builds the same browser-only mock demo for a root-hosted
Cloudflare Pages project. Both verify the SPA fallback for
`/pay/demo-ai-workflow`, and both keep all state in browser local storage. They
do not build sponsored transaction bytes, spend gas, or submit a new Sui
transaction.

The repository is public. GitHub Pages can be enabled through the protected
cutover script or manually in repository settings with GitHub Actions as the
source. After that, run the `Static Demo Pages` workflow manually. For Cloudflare Pages,
set GitHub secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`, then run
the `Cloudflare Static Demo` workflow manually. The expected Cloudflare URL is
`https://sui-paylink.pages.dev/pay/demo-ai-workflow`.

See `docs/10-testnet-runbook.md` for the exact completion gate.
See `docs/11-prd-cn.md` for the detailed Chinese PRD, field dictionary, and P0
acceptance criteria.
See `docs/16-registration-pack-cn.md` for the copy-paste registration fields
and founder verification checklist.
Run `npm run registration:audit` before opening the registration form; it checks
field lengths, held demo/video fields, repository visibility, and minimum
readiness.
Run `npm run founder:verify` for a single founder-facing Go/No-Go summary before
copying fields into the registration form.
Run `npm run public:preflight` before making the repository public; it checks
tracked files and git history for high-confidence private key or token patterns.
Run `npm run registration:copy -- --write` to refresh the field-by-field copy
sheet at `submission/registration-copy.md`.
Use `docs/17-founder-final-verification-cn.md` as the final Chinese checklist
before the founder opens and submits the registration form.
See `docs/12-p0-implementation-checklist-cn.md` for the next implementation
queue.
