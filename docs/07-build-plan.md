# Build Plan

## Deadline context

The official Sui Overflow page currently says the 2026 event runs from May to August and registration is open, but parts of its detailed timeline still display 2025 dates. Do not treat a specific submission deadline as confirmed until the participant dashboard or handbook provides the current 2026 deadline.

## Phase 0: Toolchain

Target: 0.5 day.

- Install Sui CLI.
- Create testnet address.
- Get testnet SUI.
- Verify Move build.
- Verify `@mysten/sui` SDK usage.

## Phase 1: Contract MVP

Target: 2 days.

- Compile `Invoice`.
- Compile `Escrow<T>`.
- Create funded escrow.
- Mark delivered.
- Release funds.
- Refund path.
- Emit events.
- Unit test with test coin or SUI if stablecoin test coin is unavailable.

## Phase 2: Local API

Target: 2 days.

- Create paylink record.
- Build transaction for create funded escrow.
- Add sponsor wallet path.
- Index contract events.
- Return receipt data.

## Phase 3: Frontend demo

Target: 3 days.

- Seller dashboard.
- Create paylink page.
- Buyer paylink page.
- Escrow status page.
- Receipt page.

## Phase 4: Gasless/sponsored UX

Target: 3 days.

- First attempt: use official gasless stablecoin transfer path if developer support is available.
- Fallback: self-sponsored escrow transaction.
- Fallback 2: Enoki/Shinami sponsored transaction integration.

## Phase 5: Polish and submission

Target: 3 days.

- Demo data.
- 2-minute video.
- Pitch README.
- Architecture diagram.
- Risk statement.
- Business model page.

## Build gates

### Day 3 gate

Contract compiles and can create/release escrow on testnet.

### Day 7 gate

End-to-end paylink demo works with sponsored gas.

### Day 14 gate

UI, dashboard, receipt, and demo video are coherent.

## Fallback scope

If stablecoin testnet support blocks progress:

- Use SUI or a local test coin in contract demo.
- Keep stablecoin as production target.
- Clearly explain in submission that the protocol is stablecoin-typed and the hackathon demo uses a test coin due to testnet asset availability.

If zkLogin blocks progress:

- Use wallet connection for demo.
- Keep sponsored gas path.
- Keep walletless as a roadmap item.

If sponsored transactions block progress:

- Use a platform-controlled demo flow for release/refund.
- Do not claim production gasless UX until fixed.

## Stop conditions

- Stop broadening scope.
- Do not add marketplace.
- Do not add fiat.
- Do not add multi-chain.
- Do not add quest/growth features.
