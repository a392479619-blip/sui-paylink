# User Flows

## Actor definitions

- Seller: service provider creating a payment link.
- Buyer: customer paying for service work.
- Platform: SuiPayLink backend and sponsor wallet.
- Contract: Sui Move package that records invoice, escrow, and receipt state.

## Flow A: Direct payment link

Use when trust risk is low.

1. Seller logs in.
2. Seller creates a payment link:
   - Amount
   - Stablecoin
   - Buyer optional
   - Memo
   - Expiration
3. Buyer opens link.
4. Buyer signs in or connects wallet.
5. Buyer pays supported Sui stablecoin.
6. SuiPayLink creates or indexes receipt state.
7. Seller dashboard shows paid.

### Gas rule

If it is a simple supported stablecoin transfer, use Sui gasless stablecoin transfer where available. If receipt creation requires a contract call, sponsor that transaction from the platform gas pool.

## Flow B: Escrow payment link

Use when the service has delivery risk.

1. Seller creates escrow paylink:
   - Amount
   - Stablecoin
   - Deliverable
   - Fee bps
   - Buyer release required
2. Buyer opens link.
3. Buyer pays stablecoin into escrow.
4. Platform sponsors gas for the escrow transaction if needed.
5. Seller marks delivery and attaches proof URI.
6. Buyer reviews delivery.
7. Buyer releases funds.
8. Contract transfers seller amount to seller and fee to platform.
9. Receipt page shows completed escrow.

## Flow C: Seller with no SUI

1. Seller signs in.
2. Seller gets a Sui address through wallet or social login.
3. Seller creates payment link.
4. Buyer pays.
5. Seller receives stablecoin.

Seller does not need SUI to receive payment. The payer or sponsor pays transaction gas.

## Flow D: Buyer with stablecoin but no SUI

1. Buyer opens paylink.
2. Buyer signs in or connects wallet.
3. Buyer has supported Sui stablecoin.
4. Simple payment uses gasless stablecoin transfer, or escrow uses platform-sponsored transaction.
5. Buyer pays without first acquiring SUI.

## Out of scope: buyer with no stablecoin

If the buyer has no Sui stablecoin, they cannot pay in MVP. Fiat on-ramp and bridging are intentionally cut because they add compliance and integration risk.

## First demo script

1. Alice is an AI automation consultant.
2. Alice creates a `100 USDC` escrow paylink for a workflow setup.
3. Bob opens the link and pays into escrow.
4. Bob did not have to manage SUI gas.
5. Alice uploads delivery proof.
6. Bob releases funds.
7. Alice receives stablecoin minus platform fee.
8. Both see receipt object and transaction history.
