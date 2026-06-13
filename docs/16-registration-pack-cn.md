# SuiPayLink 报名最低材料包

更新时间：2026-06-14

目标：先满足 Sui Overflow 2026 报名/最低提交材料，让创始人本人验证后再报名。不要把未完成的真实浏览器钱包 E2E、真实 USDC、公开 API 部署包装成已完成。

最终报名操作以 `docs/17-founder-final-verification-cn.md` 为准。

## 官方信息核对

- 官方入口：<https://overflow.sui.io/>
- 官方报名入口：<https://www.deepsurge.xyz/hackathons/b587dc0c-4cb8-4e63-ada5-519df38103bf>
- 官方页面显示：Sui Overflow 2026，May - August 2026，Registration is open。
- 2026-06-14 复核：官方 FAQ 同时写着 `Pre-registration is now open`。这意味着当前入口可能是预注册/资料创建阶段，不要假设已经是最终项目提交表。
- 2026-06-14 复核：DeepSurge 公开 HTML 没有暴露表单字段和 required 状态。Demo URL、video URL、repo URL 是否必填，必须以你登录后的表单 UI 为准。
- 官方 FAQ 显示：只能选择一个最能代表项目的 track。
- 适配 track：DeFi & Payments。官方 track 文案覆盖 financial primitives / payment rails / real-world scenarios，SuiPayLink 是面向跨境数字服务的 gasless escrow payment link。

注意：官网页面里仍混有 2025 timeline 文案，且 registration / pre-registration 文案不完全一致。日期和字段要求以报名平台登录后的最新 UI 为准。当前最低目标是 2026-06-16 前完成可报名/预注册材料，不等同于最终获奖级 demo 完成。

## 当前报名结论

最低项目材料：可准备报名。

当前硬边界：

- GitHub 仓库当前是 private。报名前如果表单要求评委访问代码，必须改成 public，或确认平台支持私有仓库授权。
- 当前没有真实公开 API demo URL。
- 当前 Cloudflare Pages workflow 已有，但需要配置 `CLOUDFLARE_ACCOUNT_ID` 和 `CLOUDFLARE_API_TOKEN` 后手动部署。
- 当前 GitHub Pages 在 private repo 状态下不可用；GitHub 返回当前 plan 不支持该仓库 Pages。要用 GitHub Pages，需要先公开仓库后重跑 `Static Demo Pages` workflow。
- 当前 sponsor 地址没有 Testnet SUI gas，真实浏览器钱包 sponsored E2E 还不能完成。
- 当前可提交的链上证据是 Testnet smoke，包括 sponsored MockUSDC 证据；不是浏览器钱包端到端证据。

## 可复制报名字段

结构化字段文件：`submission/registration-fields.json`

报名前先跑：

```bash
npm run registration:audit
npm run founder:verify
npm run public:preflight
```

这些命令会检查字段长度、demo/video 是否被误填、GitHub 仓库可见性、最低提交 readiness、创始人 Go/No-Go 条件，以及公开仓库前的 tracked/history 密钥风险。

### Project name

SuiPayLink

### Tagline

Gasless stablecoin escrow links for cross-border digital services.

### Track

DeFi & Payments

只选这一个 track。不要同时选 Agentic Web，除非报名表允许 secondary track 且我们在提交前补了 AI invoice/payment-agent workflow。

### Short description

SuiPayLink lets service sellers create gasless stablecoin escrow payment links on Sui. Buyers can enter a sponsored mUSDC escrow flow without holding SUI gas, sellers can mark delivery, buyers can release or refund, and both sides get verifiable Testnet receipts.

### One-sentence description

SuiPayLink turns cross-border digital service payments into gasless Sui escrow links with sponsored transactions and verifiable receipts.

### Long description

SuiPayLink is a payment-link product for Web3 services, AI automation sellers, small cross-border agencies, creators, and Sui ecosystem teams paying contributors.

The problem is narrow: stablecoin payments are useful for cross-border digital services, but first-time buyers still get blocked by wallet setup, gas, unclear addresses, and trust. A seller also needs more than a raw wallet address. For service work, both sides need a lightweight agreement, escrow state, delivery proof, release/refund flow, and a receipt they can verify later.

SuiPayLink lets a seller create a payment link for a service agreement. The buyer opens the public link, reviews amount, seller, buyer, memo, and sponsor status, then signs the business transaction while a sponsor account pays gas in the verified sponsored flow. The Move package records escrow state on Sui. The API persists Paylinks and sponsored transaction records, and the receipt page can sync against recorded Sui digests and Escrow object state.

The current MVP is intentionally scoped. It proves the payment rail and escrow state machine on public Sui Testnet using a project-owned MockUSDC coin. The repo includes evidence for package publish, SUI escrow, refund, two-party flow, MockUSDC escrow, and sponsored MockUSDC escrow where buyer and seller hold 0 SUI while the sponsor pays gas. It is not a Stripe replacement, not production USDC support, and not a legal arbitration platform.

### Problem

Stablecoin service payments still require too much manual coordination. Buyers do not want to acquire SUI before paying. Sellers do not want to send raw wallet addresses and manually reconcile payments. Both sides need a simple escrow workflow and a receipt that can be verified later.

### Solution

SuiPayLink turns a service invoice into a Sui payment link. It supports escrow creation, sponsored transaction build/sign/submit, seller delivery marking, buyer release/refund, receipt math, and on-demand chain verification against Sui transaction digests and Escrow object state.

### Why Sui

- Sponsored transactions allow the app sponsor to pay gas while the user signs the business action.
- Sui object model fits escrow objects and receipt state.
- Low fees and fast settlement fit small service payments.
- Sui stablecoin/gasless direction makes payment UX materially better than generic wallet-to-wallet transfer.

### What is built

- Move escrow package deployed on Sui Testnet.
- MockUSDC Testnet coin for non-SUI payment proof.
- Sponsored MockUSDC escrow smoke where buyer and seller stay at 0 SUI.
- Fastify API for Paylinks, receipts, and sponsored transaction build/submit.
- React dashboard and public `/pay/:id` buyer page.
- Static public demo build path for GitHub Pages and Cloudflare Pages.
- Submission readiness and browser-wallet evidence export scripts.

### Tech stack

Sui Move, Sui TypeScript SDK, React, Vite, Fastify, Node.js 22, GitHub Actions, Cloudflare Pages workflow, file-backed JSON stores for hackathon MVP persistence.

### Repository URL

<https://github.com/a392479619-blip/sui-paylink>

Current status: private as of 2026-06-13. Before final submission, make it public or verify that the judges can access it.

### Demo URL

Use only after deployment is actually done:

<https://sui-paylink.pages.dev/pay/demo-ai-workflow>

Current status: not deployed yet. Do not put this into the form until the URL opens in a browser.

Fallback if the form allows no public demo yet:

Use the repository README and demo video link, and state: "Public hosted demo pending; local preview is reproducible with `npm run preview:prod`."

### Demo video URL

TBD.

Requirement before filling this field: record and upload a public/unlisted video using `docs/13-demo-script-cn.md`. The video must show verified Testnet evidence and clearly state which parts are mock/static demo.

### Contract package

`0x994e7ea20d955da3539c9971584bc4d524066b3df5bcbef0c180bfc2e3c5c340`

Explorer:

<https://suiexplorer.com/object/0x994e7ea20d955da3539c9971584bc4d524066b3df5bcbef0c180bfc2e3c5c340?network=testnet>

### Key Testnet evidence

- Package publish: <https://suiexplorer.com/txblock/ATkpRVoK2RWs15qSdD6r8JokLQuAHkDeWBrC8Z18fYh3?network=testnet>
- Sponsored MockUSDC fund: <https://suiexplorer.com/txblock/ADJcJgnyaC5K8q7tUyygehMqYKYPJ9V2VYbTRUGqK7Nm?network=testnet>
- Sponsored MockUSDC release: <https://suiexplorer.com/txblock/FHpRgU1UBvaHVQBNQMh9ReUKmr2jHWgaGZWxQHCkqAeQ?network=testnet>
- Sponsored escrow object: <https://suiexplorer.com/object/0xfa140db34391e6d7af3968c8cca37725028a7d4c97b3346fc6c4fda2a97ca0dc?network=testnet>

### Team

Solo builder.

Founder / developer / product: criss

### Suggested answers for form questions

#### What makes this useful?

It targets a concrete payment workflow: service sellers need payment links, buyers need low-friction stablecoin payment, and both sides need escrow and receipt state. The wedge is not generic checkout; it is cross-border digital service escrow with sponsored gas on Sui.

#### What did you build during the hackathon?

Move escrow contract, Testnet deployment, MockUSDC payment proof, sponsored transaction API, Paylink dashboard, public buyer page, receipt sync, static demo build, smoke tests, submission readiness checks, and evidence export tooling.

#### What is not finished?

Production USDC, public API deployment, browser-wallet sponsored E2E recording, Cloudflare deployment, event indexer, dispute/arbitration workflow, compliance review.

#### Why should judges care?

It shows a realistic payment rail on Sui instead of an abstract DeFi primitive. The sponsored MockUSDC evidence proves the core UX claim: buyer and seller can keep 0 SUI while a sponsor pays gas for escrow actions.

## 创始人亲自验证清单

报名前必须亲自确认：

```bash
git pull
npm ci
npm run submission:readiness -- --with-sponsor
npm run smoke:api
npm run smoke:preview
npm run smoke:static-demo
npm run smoke:cloudflare-demo
npm run founder:verify
```

通过标准：

- `Minimum submission: PASS`
- GitHub Actions 最新 CI 是 success
- README 的 Testnet explorer 链接能打开
- `docs/13-demo-script-cn.md` 能支撑 2 分钟视频
- `npm run public:preflight` 通过
- 如果填写 repo URL，仓库必须 public 或平台确认可访问 private repo
- 如果填写 demo URL，URL 必须真实可打开
- 如果填写 video URL，视频必须公开或 unlisted 可访问

## Go / No-Go

Go：

- 报名表只要求项目基本信息、track、repo、描述，且允许之后补 demo/video。
- 或者 repo 已公开，视频已上传，demo URL 已验证可打开。

No-Go：

- 表单强制要求 public demo URL，但 Cloudflare/GitHub Pages 还没部署。
- 表单强制要求 demo video，但视频还没上传。
- 表单强制要求公开 repo，但仓库仍是 private。
- 表单要求声称生产支付能力。当前只能说 Testnet/mUSDC/hackathon MVP。
