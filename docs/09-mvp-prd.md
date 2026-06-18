# SuiPayLink MVP PRD

## 1. Product Summary

SuiPayLink is a gasless stablecoin paylink and escrow flow for cross-border digital service work.

MVP goal:

> Prove that a seller can create a service payment link, a buyer can fund it without manually managing SUI gas, escrow state can be represented on Sui, and the seller can receive funds after delivery confirmation.

The MVP is for Sui Overflow 2026. It should be judged as a working product demo, not a regulated payment processor.

## 2. Target Users

### Primary seller

- Web3 service provider.
- AI automation consultant.
- Cross-border freelancer or small agency.
- Sui ecosystem project paying contributors.

### Primary buyer

- Crypto-native client with stablecoins.
- Sui ecosystem team.
- Web3 founder buying service work.

### Explicit non-targets

- Mainstream ecommerce merchant.
- Consumer card checkout user.
- Large enterprise treasury.
- User with no stablecoin access at all.

## 3. Core Problem

Current options are fragmented:

- Direct stablecoin transfer is simple but has no escrow, invoice state, or delivery proof.
- Web2 payment links are good for card checkout but do not settle in stablecoins.
- Crypto checkout tools are broad and do not optimize for Sui gasless service escrow.
- Service work needs a buyer/seller state machine: funded, delivered, released, refunded.

## 4. Value Proposition

For sellers:

- Create a stablecoin payment link in under one minute.
- Avoid explaining SUI gas to every buyer.
- Use escrow for service work.
- Get an on-chain receipt.

For buyers:

- Pay a service invoice with supported Sui stablecoins.
- Avoid holding SUI just to pay gas.
- Hold funds in escrow until delivery.
- Verify receipt and delivery state.

For Sui ecosystem:

- Converts payment infrastructure into a practical real-world service flow.
- Demonstrates gasless stablecoin and sponsored transaction UX.

## 5. MVP Scope

### Must Have

| Feature | User | Description | Acceptance Criteria |
|---|---|---|---|
| Create paylink | Seller | Seller creates direct or escrow paylink with amount, memo, buyer, token, fee bps. | Form creates a link record and returns share URL. |
| View paylink | Buyer | Buyer opens a public paylink page. | Page displays seller, amount, memo, token, status, and action. |
| Fund escrow | Buyer | Buyer funds escrow using stablecoin-like asset. | Testnet `mUSDC` escrow path succeeds; Paylink state integration remains P0 work. |
| Sponsor gas abstraction | Platform | Buyer does not need to handle gas for escrow operations. | Sponsored `mUSDC` Testnet smoke succeeds with buyer and seller SUI balances at `0`. |
| Mark delivered | Seller | Seller marks work delivered and attaches proof URI. | State moves from `funded` to `delivered`; proof URI is stored. |
| Release escrow | Buyer | Buyer releases funds after delivery. | State moves from `delivered` to `released`; platform fee and seller amount are computed. |
| Refund escrow | Buyer | Buyer can refund before seller marks delivery. | State moves to `refunded`; release is blocked. After delivery, refund becomes a dispute path, not an automatic buyer action. |
| Receipt page | Both | Receipt displays payment/escrow state and transaction placeholders. | Receipt page is shareable and displays status timeline. |
| Seller dashboard | Seller | Seller sees all created links and statuses. | Dashboard lists links, amount, type, status, and actions. |

### Should Have

| Feature | Description |
|---|---|
| AI invoice copy generator | Generate memo, payment reminder, and delivery terms from short service description. |
| Walrus proof placeholder | Store delivery proof URI as string now; later support Walrus blob ID. |
| Stablecoin config | Central supported token list with symbol, type, decimals, and gasless eligibility flag. |
| Demo seed data | One realistic Alice/Bob service payment scenario. |

### Cut From MVP

- Fiat on-ramp/off-ramp.
- KYC/AML flow.
- Card payments.
- Multi-chain.
- Full dispute arbitration.
- Admin court or mediator.
- Recurring subscriptions.
- Accounting exports.
- Production custody.
- Large payment support.

## 6. Functional Requirements

## 6.1 Seller Creates Paylink

Inputs:

- Seller display name.
- Seller address.
- Buyer optional name/address.
- Amount.
- Token symbol.
- Memo.
- Payment mode: `direct` or `escrow`.
- Platform fee bps.
- Expiration optional.

Rules:

- Amount must be positive.
- Token must be supported.
- Escrow mode requires seller address.
- Fee bps must stay within configured limit.

Output:

- Paylink ID.
- Public URL.
- Initial status.

## 6.2 Buyer Funds Paylink

Direct mode:

- Buyer pays seller.
- Receipt marks direct payment complete.

Escrow mode:

- Buyer funds escrow.
- State becomes `funded`.
- Chain transaction digest is attached when available.

Gas behavior:

- Direct payment should use Sui gasless stablecoin transfer if available.
- Escrow contract call should use sponsored transaction.
- Local MVP can use mock digest but must preserve the API boundary for real sponsor execution.

## 6.3 Seller Marks Delivery

Inputs:

- Delivery proof URI.
- Notes optional.

Rules:

- Only seller can mark delivered in production.
- MVP can simulate auth with selected actor.
- Only `funded` paylinks can be marked delivered.

Output:

- Status `delivered`.
- Delivery proof visible on receipt page.

## 6.4 Buyer Releases

Rules:

- Only buyer can release in production.
- MVP can simulate auth with selected actor.
- Only `funded` or `delivered` escrow can be released.
- Release computes:
  - platform fee = amount * feeBps / 10000
  - seller amount = amount - fee

Output:

- Status `released`.
- Seller amount and platform fee visible.

## 6.5 Buyer Refunds

Rules:

- Only before seller marks delivery.
- Refund marks transaction final in MVP.
- After delivery, production needs deadline/dispute policy before public launch.

Output:

- Status `refunded`.

## 7. Data Model

### Paylink

```ts
type Paylink = {
  id: string;
  mode: "direct" | "escrow";
  status: "created" | "funded" | "delivered" | "released" | "refunded" | "expired";
  sellerName: string;
  sellerAddress: string;
  buyerName?: string;
  buyerAddress?: string;
  amount: string;
  token: string;
  memo: string;
  feeBps: number;
  publicUrl: string;
  deliveryProofUri?: string;
  transactionDigest?: string;
  escrowObjectId?: string;
  receiptObjectId?: string;
  createdAt: string;
  updatedAt: string;
};
```

### SupportedToken

```ts
type SupportedToken = {
  symbol: string;
  displayName: string;
  coinType: string;
  decimals: number;
  gaslessEligible: boolean;
  testnetOnly?: boolean;
};
```

## 8. API Requirements

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Health check. |
| GET | `/api/config` | Supported tokens and network config. |
| POST | `/api/paylinks` | Create paylink. |
| GET | `/api/paylinks` | List paylinks for dashboard. |
| GET | `/api/paylinks/:id` | Fetch public paylink. |
| POST | `/api/paylinks/:id/fund` | Fund paylink or mock fund. |
| POST | `/api/paylinks/:id/deliver` | Mark delivered. |
| POST | `/api/paylinks/:id/release` | Release escrow. |
| POST | `/api/paylinks/:id/refund` | Refund escrow. |

## 9. UX Requirements

### Seller dashboard

- Header: product one-liner.
- Create paylink panel.
- Paylink table with status badges.
- Link copy button.
- Demo actions for local MVP.

### Buyer paylink page

- Amount and token prominent.
- Memo and seller identity clear.
- Gas explanation: "No SUI gas required for this demo flow."
- Primary action: fund/pay.
- If funded: show delivery/release state.

### Receipt page

- Timeline:
  - Created
  - Funded
  - Delivered
  - Released/refunded
- Transaction/object placeholders.
- Seller amount and fee.

## 10. Technical Requirements

- Frontend: React + Vite + TypeScript.
- API: Fastify + TypeScript.
- Shared types: workspace package.
- Chain integration:
  - Sui Move escrow module.
  - API abstraction for sponsor transaction execution.
  - Mock implementation until Sui CLI and stablecoin testnet path are confirmed.

## 11. Demo Acceptance Test

Demo must complete:

1. Create escrow paylink for `100 USDC`.
2. Open public link.
3. Fund escrow.
4. Show status `funded`.
5. Mark delivered with proof URI.
6. Release escrow.
7. Show seller receives `99 USDC` if fee is `100 bps`.
8. Show receipt timeline and mock Sui object IDs/digests.

## 12. Risks

| Risk | Mitigation |
|---|---|
| Real stablecoin gasless developer path is not testnet-ready. | Demo with package-owned `mUSDC` and explicitly label it as a test coin. |
| Sponsored transaction browser-wallet UX takes longer than expected. | Use the verified SDK smoke proof and keep browser-wallet compatibility as a separate UX gate. |
| Move contract does not compile initially. | Compile after Sui CLI install; keep frontend/API isolated from contract iteration. |
| Product looks like generic paylink. | Keep escrow, service workflow, and gasless Sui UX central in demo. |

## 13. MVP Kill Criteria

Kill or pivot if by the first build gate:

- We cannot demonstrate a funded escrow state.
- We cannot explain who pays and why escrow matters.
- The product requires fiat on-ramp to be useful.
- The flow is just a normal wallet transfer with a nicer UI.
