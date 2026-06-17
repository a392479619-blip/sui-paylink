# Sui Overflow Entry Snapshot

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
- Demo URL can be used because the GitHub Pages static demo opens successfully in a browser: https://a392479619-blip.github.io/sui-paylink/pay/demo-ai-workflow
- Do not fill Demo video URL unless the uploaded video opens publicly or unlisted.
- Repository URL can be used because the GitHub repository is public.

## Current Local Go / No-Go

Go:

- Use `submission/registration-copy.md` for prepared fields and optional answers.
- Use Testnet evidence links from README and `submission/registration-fields.json`.
- Submit a pre-registration form if it accepts project basics and the static public demo URL.

No-Go:

- The live form requires Demo video URL, but no public or unlisted video has been uploaded.
- The live form rejects a static demo and requires a hosted API demo or browser-wallet E2E demo URL.
- The live form requires production payment claims, real USDC, or legal arbitration claims beyond the current Testnet mUSDC MVP.
