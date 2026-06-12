# Testnet Faucet Request

Status: funded on June 4, 2026. The initial Testnet deployment and smoke test
completed successfully. The channels below remain useful for future Testnet
funding.

## Dedicated deployer

```text
0xb1f8e9eb4c040a743fcfa2e53845b1a1b96cb517f92cf2182da09bb60de1e3ef
```

This address exists in the local Sui CLI keystore under the alias `suipaylink-testnet-deployer`.

## Request channels

Use one of:

- Official web faucet: `https://faucet.sui.io/?address=0xb1f8e9eb4c040a743fcfa2e53845b1a1b96cb517f92cf2182da09bb60de1e3ef`
- Official Sui Discord `#testnet-faucet` channel.
- N1Stake community faucet: `https://faucet.n1stake.com/`

Discord command:

```text
!faucet 0xb1f8e9eb4c040a743fcfa2e53845b1a1b96cb517f92cf2182da09bb60de1e3ef
```

## Verification and deployment

```bash
sui client switch --env testnet --address suipaylink-testnet-deployer
sui client gas --json
npm run chain:deploy:testnet
npm run chain:smoke:testnet
```

Do not store or publish the recovery phrase. The Sui CLI keystore already contains the key required to deploy from this machine.
