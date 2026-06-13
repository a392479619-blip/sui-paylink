# SuiPayLink 部署 Runbook

## 目标

这份 runbook 只解决黑客松 demo 的公开访问问题：让评委能打开一个 URL，创建 Paylink，进入 `/pay/:id`，查看 receipt 和 sponsor 状态。

它不证明真实 sponsor 钱包端到端成功，也不证明生产支付能力。真实 sponsor 仍需要 `SPONSOR_PRIVATE_KEY`、有余额的钱包、浏览器钱包签名录屏和 Testnet digest。

## 本地生产预览

先构建：

```bash
npm run build
```

再启动单服务预览：

```bash
HOST=0.0.0.0 PORT=8787 SERVE_WEB_APP=true PUBLIC_BASE_URL=http://127.0.0.1:8787 npm start
```

打开：

```text
http://127.0.0.1:8787
```

自动化检查：

```bash
npm run smoke:preview
```

该命令会验证：

- `/health`
- `/api/config`
- `POST /api/paylinks`
- demo seed Paylink
- demo seed mock fund/deliver/release
- `/`
- `/pay/:id`
- 前端静态资源
- 未知 `/api/*` 返回 JSON 404

## Sponsor 钱包准备

先生成或复用 sponsor 钱包，但不要把私钥提交到 Git：

```bash
npm run sponsor:bootstrap
npm run sponsor:bootstrap -- --write-env-local --request-faucet --readiness
```

脚本会输出 `sponsorAddress`，默认不会输出私钥。`--write-env-local` 会把
`SPONSOR_PRIVATE_KEY`、`SPONSOR_MODE=self-sponsored` 和 `SUI_NETWORK` 写入根目录
`.env.local`，该文件已被 Git 忽略。

如果 faucet 被限流，或页面要求 CAPTCHA，就手动把 Testnet SUI 转入脚本输出的
`sponsorAddress`，然后重新运行：

```bash
npm run sponsor:readiness
```

如果 `npm run sponsor:bootstrap -- --request-faucet --readiness` 输出
`manualTopUpRequired: true`，直接复制 `manualTopUp.address` 去手动领水或转入 Testnet SUI。这个地址必须和后续
`npm run sponsor:readiness` 输出的 `sponsorAddress` 一致。

只有 readiness 通过后，才能说 sponsor 钱包已准备好。只生成私钥、但没有
Testnet SUI gas 余额，不算完成真实 sponsor 准备。

## Render 部署

仓库已经提供 `render.yaml`。在 Render 中使用 Blueprint 部署后，至少设置：

| 环境变量 | 值 |
|---|---|
| `PUBLIC_BASE_URL` | Render 生成的公开 URL，例如 `https://<service>.onrender.com` |
| `HOST` | `0.0.0.0` |
| `SERVE_WEB_APP` | `true` |
| `DEMO_SEED_ENABLED` | `true` |
| `DEMO_SEED_PAYLINK_ID` | `demo-ai-workflow` |
| `PAYLINK_STORE_PATH` | `/tmp/suipaylink-paylinks.json` |
| `SPONSORED_TRANSACTION_STORE_PATH` | `/tmp/suipaylink-sponsored-transactions.json` |

如果要录真实 sponsor 路径，再设置：

| 环境变量 | 值 |
|---|---|
| `SPONSOR_PRIVATE_KEY` | Sui Testnet sponsor 私钥 |
| `SPONSOR_GAS_BUDGET_MIST` | 默认可先用 `50000000` |
| `MAX_SPONSOR_GAS_BUDGET_MIST` | 默认可先用 `200000000` |

不要把 `SPONSOR_PRIVATE_KEY` 写进代码、README、截图或视频。

## 部署后检查

部署成功后检查：

```bash
curl https://<service>.onrender.com/health
curl https://<service>.onrender.com/api/config
```

必须看到：

- `service` 是 `sui-paylink-api`
- `network` 是 `testnet`
- `publicBaseUrl` 是公开 URL，不是 `127.0.0.1`
- 没有 sponsor 私钥时，`sponsorEnabled` 是 `false`
- 有 sponsor 私钥时，先本地或线上跑 `npm run sponsor:readiness` 的等价检查再录屏

## Demo URL 提交流程

1. 部署服务。
2. 打开公开首页，或直接打开 `/pay/demo-ai-workflow`。
3. 如果需要自定义金额/双方地址，再在首页创建一条新的 Paylink 并打开生成的 `/pay/:id`。
4. 无 sponsor 私钥时，可以点击 demo mode 按钮走 mock fund/deliver/release，确认 receipt 变为 released。
5. 如果未配置 sponsor 私钥，视频里明确说 `Sponsor not configured`，不能说完成真实 gasless 浏览器交易。
6. 把公开首页 URL 或具体 `/pay/:id` URL 填到黑客松提交表。

## GitHub Pages 静态 Demo

仓库也提供 `.github/workflows/pages.yml`。当前仓库是 private，当前 GitHub plan 不支持为这个仓库启用
GitHub Pages，所以 workflow 默认只支持手动触发。要使用 Pages URL，需要先满足其中一个条件：

- 将仓库改为 public。
- 或使用支持 private repository Pages 的 GitHub plan。

然后在 GitHub Actions 里手动运行 `Static Demo Pages` workflow。运行前可本地验证：

```bash
npm run smoke:static-demo
```

也可以先 dry-run 一次受保护脚本。它默认只检查公开前扫描、仓库状态和预期 Demo URL，不会改变仓库可见性：

```bash
npm run demo:pages-cutover
```

只有你明确批准公开仓库后，才运行执行模式：

```bash
npm run demo:pages-cutover -- --confirm-public-repo
```

执行模式会先跑公开前扫描，再把 repo 改成 public、启用 GitHub Pages、触发 `Static Demo Pages` workflow、等待 workflow 结束，并验证：

```text
https://a392479619-blip.github.io/sui-paylink/pay/demo-ai-workflow
```

workflow 会尝试用 GitHub Actions 自动启用 Pages。如果它在 `Configure Pages` 失败并提示
`Get Pages site failed`，说明仓库还没有启用 Pages 或当前 private repo/账号计划不支持。此时需要在 GitHub
Settings -> Pages 里启用 `GitHub Actions` source，或先将仓库改为 public 后重跑 workflow。

当前已验证：2026-06-13 本仓库在 private 状态下创建 Pages 返回 `Your current plan does not support GitHub
Pages for this repository`。如果仍保持 private，优先走 Cloudflare Pages；如果要用 GitHub Pages，需要先公开仓库。

预期公开地址：

```text
https://a392479619-blip.github.io/sui-paylink/
https://a392479619-blip.github.io/sui-paylink/pay/demo-ai-workflow
```

这个 Pages demo 只用于降低评委打开成本。它运行 `VITE_STATIC_DEMO=true`，Paylink 数据保存在浏览器
`localStorage`，可以演示创建 Paylink 和 mock fund/deliver/release，但不能构建 sponsored transaction
bytes，不能花 gas，也不会提交新的 Sui Testnet 交易。

提交材料里如果使用 GitHub Pages URL，必须把它标为 `public static mock demo`。真实链上证据仍然引用
README 里的 Testnet package、smoke digest 和后续浏览器钱包 sponsored E2E 录屏。

## Cloudflare Pages 静态 Demo

Cloudflare Pages 不依赖 GitHub Pages 是否支持 private repo。仓库已经提供手动 workflow：

```text
.github/workflows/cloudflare-pages.yml
```

先在 GitHub 仓库设置里添加两个 Secrets：

| Secret | 用途 |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account id |
| `CLOUDFLARE_API_TOKEN` | API token，建议使用 `Edit Cloudflare Workers` 模板或等价 Pages/Workers 部署权限 |

本地先验证 Cloudflare 根路径构建：

```bash
npm run smoke:cloudflare-demo
```

然后在 GitHub Actions 手动运行 `Cloudflare Static Demo`。workflow 会执行：

```bash
npx wrangler@4 whoami
npm run smoke:cloudflare-demo
npx wrangler@4 pages deploy apps/web/dist --project-name=sui-paylink --branch=main
```

预期公开地址：

```text
https://sui-paylink.pages.dev/
https://sui-paylink.pages.dev/pay/demo-ai-workflow
```

这个 Cloudflare URL 仍然是 browser-only static mock demo，不是 Fastify API 公开服务，也不是真实
sponsored transaction demo。真实 API URL 仍建议用 Render、Railway、Fly、Cloud Run 等能运行 Node/Fastify
服务的平台部署。

## 当前边界

- Render 免费实例的 `/tmp` 是临时存储，重启后 Paylink 可能丢失。
- `DEMO_SEED_ENABLED=true` 会在启动时生成 `/pay/demo-ai-workflow`，用于稳定展示；页面上的 demo mode 只走本地 mock API，不代表真实链上交易。
- GitHub Pages 静态 demo 没有后端 API，只能展示 browser-only mock flow。
- Cloudflare Pages 静态 demo 同样没有后端 API，只能展示 browser-only mock flow。
- 当前 `mUSDC` 是项目 Testnet 测试币，不是真实 USDC。
- 公开 URL 只能证明 demo 可访问，不能替代真实 browser-wallet sponsored E2E。
