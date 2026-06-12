# Deployments

Public chain deployment evidence is stored here.

- `devnet-smoke.json`: Earlier public Devnet proof that publish, fund, deliver, and release work remotely.
- `testnet.json`: Package ID, upgrade capability, deployer, and publish digest.
- `testnet-smoke.json`: Escrow object ID and transaction digests for the verified Testnet flow.
- `testnet-refund-smoke.json`: Escrow object ID and transaction digests for the verified Testnet refund flow.
- `testnet-two-party-smoke.json`: Buyer, seller, and fee receiver are separate Testnet addresses, including negative permission checks.
- `testnet-mock-usdc-smoke.json`: Non-SUI escrow evidence using the package-owned, test-only `mUSDC` coin.
- `testnet-sponsored-mock-usdc-smoke.json`: Sponsored non-SUI escrow evidence where buyer and seller both hold `0` SUI and sponsor pays gas.

The Testnet gate is complete. The publish, release-path smoke, and refund-path
smoke evidence files exist. Every recorded transaction succeeded, the release
path ends delivered, released, and empty, and the refund path ends refunded,
not released, and empty. The two-party smoke verifies that only the seller can
mark delivery and only the buyer can release. The MockUSDC smoke verifies that
`Escrow<T>` works with a non-SUI coin type. The sponsored MockUSDC smoke verifies
the gasless transaction mechanism for package-owned `mUSDC`, but `mUSDC` is not
real USDC.
