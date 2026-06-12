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
    └── 12-p0-implementation-checklist-cn.md
```

## Current status

SuiPayLink is deployed and verified on public Sui Testnet with Sui CLI `1.73.0`.
The verified flow completed:

1. Publish package.
2. Create and fund shared escrow with SUI.
3. Mark the service delivered.
4. Release funds to seller and platform fee receiver.
5. Create and fund a separate escrow, then refund it to the buyer.
6. Run a two-party Testnet flow with separate buyer, seller, and fee receiver addresses.
7. Create, mint, escrow, deliver, and release `mUSDC`, a test-only MockUSDC coin.
8. Run a sponsored `mUSDC` escrow flow where buyer and seller both hold `0` SUI.
9. Run Move unit tests for amount validation, fee caps, permissions, release, refund, MockUSDC minting, and fee split behavior.

Verified Testnet evidence:

- [Package](https://suiexplorer.com/object/0x994e7ea20d955da3539c9971584bc4d524066b3df5bcbef0c180bfc2e3c5c340?network=testnet): `0x994e7ea20d955da3539c9971584bc4d524066b3df5bcbef0c180bfc2e3c5c340`
- [Publish transaction](https://suiexplorer.com/txblock/ATkpRVoK2RWs15qSdD6r8JokLQuAHkDeWBrC8Z18fYh3?network=testnet): `ATkpRVoK2RWs15qSdD6r8JokLQuAHkDeWBrC8Z18fYh3`
- [SUI escrow object](https://suiexplorer.com/object/0x7d57991709a3ab42f083c33421b9b33da4edb8266cdcb3bd447129ffa6f5128c?network=testnet): `0x7d57991709a3ab42f083c33421b9b33da4edb8266cdcb3bd447129ffa6f5128c`
- [SUI release transaction](https://suiexplorer.com/txblock/5SyCRy8Hif79HYRYrkomc32TPSHxd6DiJAorp3p1avPT?network=testnet): `5SyCRy8Hif79HYRYrkomc32TPSHxd6DiJAorp3p1avPT`
- Final state: delivered, released, and empty balance
- [Refund transaction](https://suiexplorer.com/txblock/BFjypQRCWAfTJWMrSBhYJpV2FoWiXS26FGmpThFjJZ3m?network=testnet): `BFjypQRCWAfTJWMrSBhYJpV2FoWiXS26FGmpThFjJZ3m`
- Refund final state: not delivered, not released, refunded, and empty balance
- [Two-party release transaction](https://suiexplorer.com/txblock/A4FeNvjhWMhBqRkJfxg6DyNYZhvgArHCn9g9gcuxWJyt?network=testnet): `A4FeNvjhWMhBqRkJfxg6DyNYZhvgArHCn9g9gcuxWJyt`
- Two-party escrow: `0x1295580b1f37791843cc0ed9885a13eb8c1a932a273a693e360564d9411d50d3`
- Two-party final state: separate buyer, seller, and fee receiver, delivered, released, and empty balance
- [MockUSDC release transaction](https://suiexplorer.com/txblock/A4XgUMXCG5eAnG2qLWqy21H4T4MPnYnnzXvygdmmhzP3?network=testnet): `A4XgUMXCG5eAnG2qLWqy21H4T4MPnYnnzXvygdmmhzP3`
- MockUSDC escrow: `0xa044130a456a9ca7f4f73bce8890c9a21753edbb10909e19682f403aec121e04`
- MockUSDC coin type: `0x994e7ea20d955da3539c9971584bc4d524066b3df5bcbef0c180bfc2e3c5c340::mock_usdc::MOCK_USDC`
- [Sponsored MockUSDC fund transaction](https://suiexplorer.com/txblock/ADJcJgnyaC5K8q7tUyygehMqYKYPJ9V2VYbTRUGqK7Nm?network=testnet): `ADJcJgnyaC5K8q7tUyygehMqYKYPJ9V2VYbTRUGqK7Nm`
- [Sponsored MockUSDC release transaction](https://suiexplorer.com/txblock/FHpRgU1UBvaHVQBNQMh9ReUKmr2jHWgaGZWxQHCkqAeQ?network=testnet): `FHpRgU1UBvaHVQBNQMh9ReUKmr2jHWgaGZWxQHCkqAeQ`
- Sponsored MockUSDC escrow: `0xfa140db34391e6d7af3968c8cca37725028a7d4c97b3346fc6c4fda2a97ca0dc`
- Sponsored proof: buyer SUI `0`, seller SUI `0`, sponsor paid gas, seller received `99 mUSDC`, fee receiver received `1 mUSDC`.

The latest Testnet smoke tests include both Test SUI and `mUSDC`. `mUSDC` is a
project-owned test coin, not real USDC. The API now has a verified sponsored
transaction path for `mUSDC` escrow actions on Testnet, file-backed Paylink
persistence for the mock product flow, and a direct `/pay/:id` buyer page. This
proves the gasless escrow mechanism and gives reviewers a runnable Paylink UX,
but production stablecoin support, event indexing, browser-wallet sponsored
signing, and hosted deployment are still separate work.

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

- `POST /api/sponsored-transactions/build`
- `GET /api/sponsored-transactions`
- `GET /api/sponsored-transactions/:id`
- `POST /api/sponsored-transactions/:id/submit`

Allowed sponsored actions are `fund-mock-usdc`, `mark-delivered`, `release`,
and `refund`. Without `SPONSOR_PRIVATE_KEY`, the API returns `503` and
`sponsorEnabled: false`.

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

See `docs/10-testnet-runbook.md` for the exact completion gate.
See `docs/11-prd-cn.md` for the detailed Chinese PRD, field dictionary, and P0
acceptance criteria.
See `docs/12-p0-implementation-checklist-cn.md` for the next implementation
queue.
