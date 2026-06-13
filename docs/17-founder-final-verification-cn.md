# SuiPayLink 创始人最终核验清单

更新时间：2026-06-14

目标：在 2026-06-16 前完成 Sui Overflow 报名最低需求。这个清单只服务报名动作，不把未完成能力包装成已完成。

## 当前结论

可以打开报名表开始填写已准备字段。

不能无条件最终提交。最终提交前仍需要你亲自处理：

- GitHub 仓库当前仍是 private。
- Demo URL 当前没有可填的公开验证 URL。
- Demo video URL 当前没有可填的公开或 unlisted 视频 URL。
- Sponsor 地址当前没有 Testnet SUI gas，真实 browser-wallet sponsored E2E 还不能录。

## 第 1 步：拉最新代码并跑最终验收

```bash
git pull
npm ci
npm run founder:verify
```

通过标准：

- `Open registration form: YES`
- `Final submit without user action: NO` 是正常状态，表示仍有外部动作需要你确认。
- `Ready fields to copy` 里的字段可以复制到报名表。
- `Hold fields` 里的字段不要填，除非你已经完成对应验证。

## 第 2 步：公开仓库决策

当前 repo：

```text
https://github.com/a392479619-blip/sui-paylink
```

如果报名表要求评委访问代码：

1. 先跑：

```bash
npm run public:preflight
```

2. 只有输出 `Public-ready check: PASS`，才考虑把 GitHub repo 改成 public。
3. 改 public 后再跑：

```bash
npm run registration:audit
npm run founder:verify
```

No-Go：

- `public:preflight` 不通过。
- 你不接受 repo 公开。
- 表单强制 public repo，但 repo 仍 private。

## 第 3 步：Demo URL 决策

当前不要填 Demo URL，除非其中一个路径完成并在浏览器打开成功：

### 方案 A：GitHub Pages

GitHub Pages 当前在 private repo 状态下不可用，GitHub 返回当前 plan 不支持该仓库 Pages。

要走 GitHub Pages：

1. 先把 repo 改 public。
2. 在 GitHub Actions 手动运行 `Static Demo Pages`。
3. 打开：

```text
https://a392479619-blip.github.io/sui-paylink/pay/demo-ai-workflow
```

4. 打开成功后再填 Demo URL。

### 方案 B：Cloudflare Pages

当前 GitHub secrets 里还没有：

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
```

要走 Cloudflare：

1. 在 GitHub repo secrets 添加这两个值。
2. 手动运行 `Cloudflare Static Demo` workflow。
3. 打开：

```text
https://sui-paylink.pages.dev/pay/demo-ai-workflow
```

4. 打开成功后再填 Demo URL。

No-Go：

- 表单强制 Demo URL，但上述 URL 都没有实际打开成功。
- 你只能本地打开，不能公开访问。

## 第 4 步：Sponsor gas 决策

当前 sponsor 地址：

```text
0xfc6a4a759d785757841ff831d48c96bbe5113b5c52912ef0cceab97047fb0f4b
```

最低余额：

```text
100000000 MIST
```

官方 faucet 当前对本机请求限流。需要手动给上面地址注入 Testnet SUI，然后跑：

```bash
npm run sponsor:readiness
npm run founder:verify
```

通过标准：

- `npm run sponsor:readiness` 输出 `"ok": true`
- `founder:verify` 的 `Sponsor top-up` 显示 `ready: yes`

注意：

- 不要临时换 sponsor 地址。
- 如果换地址，`.env.local` 和后续部署环境里的 `SPONSOR_PRIVATE_KEY` 必须一致。
- 没有 sponsor gas 不影响最低报名 PASS，但影响真实 browser-wallet sponsored E2E 录屏。

## 第 5 步：Demo video 决策

如果表单强制 Demo video URL：

1. 按 `docs/13-demo-script-cn.md` 录 2 分钟视频。
2. 上传为 public 或 unlisted。
3. 打开视频 URL 验证可访问。
4. 再填 Demo video URL。

视频里必须明确：

- 当前是 Testnet。
- 当前使用项目 MockUSDC，不是真实 USDC。
- 静态 demo 是 mock demo，不是真实 API/链上交易。
- 已完成的链上证据来自 README 和报名包里的 Testnet digest。

No-Go：

- 视频还没上传。
- 视频 URL 需要登录或不可公开访问。
- 视频声称生产支付、真实 USDC、法律仲裁或 Stripe 替代品。

## 第 6 步：报名表填写策略

可以复制：

- Project name
- Tagline
- Track
- Short description
- One-sentence description
- Long description
- Problem
- Solution
- Tech stack
- Contract package
- Team

谨慎填写：

- Repository URL：只有 repo public 或平台明确能访问 private repo 时填写。
- Demo URL：只有公开 URL 浏览器验证后填写。
- Demo video URL：只有公开视频或 unlisted 视频验证后填写。

最后再跑：

```bash
npm run registration:audit
npm run founder:verify
```

如果仍然显示：

- `Open registration form: YES`
- 无 `block`

就可以按报名表要求提交最低材料。
