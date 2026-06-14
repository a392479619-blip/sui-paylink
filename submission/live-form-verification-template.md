# SuiPayLink Live Form Verification Template

Use this after logging into DeepSurge. The public page does not expose required-field rules, so this file records what the founder actually sees before submission.

## Session

- Date:
- Founder:
- Browser/account:
- Registration URL: https://www.deepsurge.xyz/hackathons/b587dc0c-4cb8-4e63-ada5-519df38103bf
- Form page title:
- Form type:
  - [ ] Pre-registration / profile
  - [ ] Final project submission
  - [ ] Other:

## Required Fields Seen In The Live Form

Mark each field exactly as the live UI shows it.

| Field | Present? | Required? | Source to paste from | Status |
|---|---:|---:|---|---|
| Project name | [ ] | [ ] | `submission/founder-submission-pack.md` | ready |
| Tagline | [ ] | [ ] | `submission/founder-submission-pack.md` | ready |
| Track | [ ] | [ ] | `DeFi & Payments` | ready |
| Short description | [ ] | [ ] | `submission/founder-submission-pack.md` | ready |
| One-sentence description | [ ] | [ ] | `submission/founder-submission-pack.md` | ready |
| Long description | [ ] | [ ] | `submission/founder-submission-pack.md` | ready |
| Problem | [ ] | [ ] | `submission/founder-submission-pack.md` | ready |
| Solution | [ ] | [ ] | `submission/founder-submission-pack.md` | ready |
| Tech stack | [ ] | [ ] | `submission/founder-submission-pack.md` | ready |
| Contract package | [ ] | [ ] | `submission/founder-submission-pack.md` | ready |
| Team | [ ] | [ ] | `submission/founder-submission-pack.md` | ready |
| Repository URL | [ ] | [ ] | repo URL only if public or private access is confirmed | needs verification |
| Demo URL | [ ] | [ ] | only after public URL opens in browser | hold |
| Demo video URL | [ ] | [ ] | only after public/unlisted video opens | hold |

## Live Required-Field Decision

Repository URL:

- [ ] Not present
- [ ] Optional
- [ ] Required, and private repo access is accepted
- [ ] Required, and public repo is required
- Decision:

Demo URL:

- [ ] Not present
- [ ] Optional
- [ ] Required
- Decision:

Demo video URL:

- [ ] Not present
- [ ] Optional
- [ ] Required
- Decision:

Production claims / compliance:

- [ ] Form does not require production payment claims
- [ ] Form asks for production users/revenue/compliance
- Decision:

## Go / No-Go Before Clicking Submit

Go only if all true:

- [ ] `npm run founder:verify` says `Open registration form: YES`
- [ ] No live required field depends on an unverified placeholder URL
- [ ] Repository access requirement is satisfied
- [ ] Demo URL is blank or browser-verified
- [ ] Demo video URL is blank or browser-verified
- [ ] No production USDC, legal arbitration, or Stripe-replacement claims are made

No-Go if any true:

- [ ] Public repo required, but repo is still private
- [ ] Demo URL required, but no public URL opens in browser
- [ ] Demo video required, but no uploaded video opens publicly/unlisted
- [ ] Form forces production claims beyond Testnet mUSDC MVP

## Submitted State

Fill only after successful submit.

- Submitted?
  - [ ] No
  - [ ] Yes
- Submission timestamp:
- Confirmation URL:
- Confirmation ID/email:
- Screenshot path:
- Notes:
