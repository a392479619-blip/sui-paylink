# SuiPayLink 黑客松提交核验清单

## 提交前结论

当前项目适合作为 hackathon demo 提交，但不能包装成生产支付产品。提交材料必须把 `mUSDC` 测试币、mock API、本地 sponsor 未配置状态和真实 Testnet smoke 证据分开讲。

## 必填提交信息

| 字段 | 建议内容 |
|---|---|
| Project name | SuiPayLink |
| Tagline | Gasless stablecoin escrow links for cross-border digital services |
| Track | DeFi & Payments |
| Secondary track | Agentic Web, only if展示 AI invoice/payment-agent workflow |
| Repo | `https://github.com/a392479619-blip/sui-paylink` |
| Demo video | 2 分钟，按 `docs/13-demo-script-cn.md` 录 |
| Demo URL | 优先填 Render/API 公开 URL；未完成时可填 Cloudflare 静态 mock demo：`https://sui-paylink.pages.dev/pay/demo-ai-workflow`；仓库公开或支持 private Pages 后也可填 GitHub Pages 静态 mock demo |
| Contract package | `0x994e7ea20d955da3539c9971584bc4d524066b3df5bcbef0c180bfc2e3c5c340` |
| Token boundary | Testnet `mUSDC` 是项目测试币，不是真实 USDC |
| Registration copy | 使用 `docs/16-registration-pack-cn.md` 的可复制字段 |

## 提交前必须跑的命令

本地必跑：

```bash
npm run smoke:api
npm run smoke:preview
npm run smoke:static-demo
npm run smoke:cloudflare-demo
npm run submission:readiness
npm run registration:audit
npm run public:preflight
npm run typecheck
npm run build
```

如果本机有 Sui CLI 和 Testnet 环境：

```bash
npm run chain:build
npm run chain:test
```

如果配置真实 sponsor 私钥：

```bash
npm run sponsor:bootstrap -- --write-env-local --request-faucet --readiness
SPONSOR_PRIVATE_KEY=<sui-private-key> npm run sponsor:readiness
npm run submission:readiness -- --with-sponsor
```

如果 faucet 返回限流或需要 CAPTCHA，先用 Web faucet 给 `sponsor:bootstrap`
输出的 `sponsorAddress` 注入 Testnet SUI，再重新跑 `npm run sponsor:readiness`。

如果要刷新链上证据：

```bash
npm run chain:smoke:sponsored-mock-usdc:testnet
```

完成真实浏览器钱包 sponsored flow 后，导出提交证据：

```bash
npm run evidence:browser-wallet -- --paylink-id <paylink-id>
npm run submission:readiness -- --with-sponsor
```

该命令会读取 `.data/paylinks.json` 和 `.data/sponsored-transactions.json`，校验 `fund-mock-usdc`、`mark-delivered`、`release/refund` 三段 executed digest，并写入 `deployments/browser-wallet-sponsored-e2e.json`。不要手工伪造这个文件。

## 必须附上的证据

| 证据 | 文件或位置 | 状态 |
|---|---|---|
| Package 发布 | `deployments/testnet.json` | 已有 |
| SUI escrow release | `deployments/testnet-smoke.json` | 已有 |
| Refund | `deployments/testnet-refund-smoke.json` | 已有 |
| Two-party buyer/seller | `deployments/testnet-two-party-smoke.json` | 已有 |
| MockUSDC escrow | `deployments/testnet-mock-usdc-smoke.json` | 已有 |
| Sponsored MockUSDC | `deployments/testnet-sponsored-mock-usdc-smoke.json` | 已有，扩展幂等后需重跑刷新 |
| 本地 API smoke | `npm run smoke:api` 输出 | 已有命令 |
| 生产预览 smoke | `npm run smoke:preview` 输出 | 已有命令 |
| GitHub Pages 静态 demo smoke | `npm run smoke:static-demo` 输出 | 已有命令，只证明静态 mock 可访问 |
| Cloudflare Pages 静态 demo smoke | `npm run smoke:cloudflare-demo` 输出 | 已有命令，只证明静态 mock 可访问 |
| 提交就绪度 | `npm run submission:readiness` 输出 | 已有命令，会区分最小可提交和竞争力缺口 |
| 报名材料包 | `docs/16-registration-pack-cn.md` | 已有，登录报名页后逐项复制 |
| Sponsor bootstrap | `npm run sponsor:bootstrap` 输出 | 已有命令，不能泄露私钥 |
| Sponsor readiness | `npm run sponsor:readiness` 输出 | 需要真实私钥和 Testnet SUI gas 余额 |
| 浏览器钱包端到端 | 录屏 + `deployments/browser-wallet-sponsored-e2e.json` | 未完成 |

## Demo 必须展示

- 卖家创建 Paylink。
- 或展示部署自动生成的 `/pay/demo-ai-workflow` 示例 Paylink。
- 如果使用 GitHub Pages URL，必须说这是 `public static mock demo`，不是 API/链上交易。
- 如果没有 sponsor 私钥，可以展示 demo mode 的 mock fund/deliver/release，但必须说明它不是链上交易。
- 买家打开 `/pay/:id`。
- sponsor 状态是 ready 还是 not configured。
- required signer roles。
- receipt timeline。
- `Sync chain` 后的 chain verification。
- Testnet evidence 或 Explorer digest。

## 不能说的话

- “已经支持真实 USDC 生产支付。”
- “无需钱包即可完成所有流程。”
- “完整事件索引已经完成。”
- “这是 Stripe 替代品。”
- “已经解决争议仲裁。”

## 可以说的话

- “合约状态机和 sponsored MockUSDC escrow 已经在 Sui Testnet 验证。”
- “buyer 和 seller 在 sponsored smoke 里可以保持 0 SUI，由 sponsor 支付 gas。”
- “公开 Paylink 页面已经接入 sponsored build/sign/submit 入口。”
- “当前真实浏览器钱包端到端仍是最后的验证门槛。”
- “完整产品化还需要真实稳定币、后台事件索引、部署和风控。”

## 提交风险

| 风险 | 影响 | 处理 |
|---|---|---|
| 浏览器钱包 sponsored flow 未验证 | 评委可能认为 UX 证据不足 | 视频中展示后端 Testnet smoke，同时明确该项为下一步 |
| mUSDC 不是官方稳定币 | 支付真实性不足 | 明确是 Testnet 测试币，用于证明非 SUI Coin escrow |
| 未部署公开 URL | 评委试用成本高 | 尽快部署，或给出本地一键命令 |
| 只有 GitHub Pages 静态 URL | 评委只能看 mock 交互，不能验证 API | 同时附 README Testnet digest 和真实 sponsor 待完成边界 |
| 只有 Cloudflare Pages 静态 URL | 评委只能看 mock 交互，不能验证 API | 同时附 README Testnet digest 和真实 sponsor 待完成边界 |
| sponsor 私钥/资金不足 | 不能录真实 gasless demo | 先跑 `sponsor:bootstrap`，注资后再跑 `sponsor:readiness` |
| 过度包装 | 降低可信度 | 使用“已验证 / 未完成”表述 |

## 最小可提交版本

满足以下条件即可提交 demo：

- `npm run smoke:api` 通过。
- `npm run smoke:preview` 通过。
- `npm run smoke:static-demo` 通过。
- `npm run smoke:cloudflare-demo` 通过。
- `npm run submission:readiness` 的最小提交状态为 `PASS`。
- `npm run typecheck` 通过。
- `npm run build` 通过。
- README 中 Testnet evidence 链接可打开。
- Demo 视频按 `docs/13-demo-script-cn.md` 录制。
- 视频中明确 `mUSDC` 是测试币。
- 视频中明确浏览器钱包 sponsored E2E 是否已经验证。

## 强烈建议补齐后再提交

- 真实 sponsor 私钥 readiness 通过。
- sponsor 地址有足够 Testnet SUI gas 余额。
- 公开页真实浏览器钱包 sponsored flow 成功一次。
- `npm run evidence:browser-wallet -- --paylink-id <paylink-id>` 成功写入证据。
- 扩展后的 sponsored smoke 重跑，刷新 `deployments/testnet-sponsored-mock-usdc-smoke.json`。
- 用现有 `Dockerfile` 或 `npm run preview:prod` 部署一个可访问的 demo URL。
