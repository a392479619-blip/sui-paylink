# SuiPayLink 创始人最终核验清单

更新时间：2026-06-17

目标：在 2026-06-16 前完成 Sui Overflow 报名最低需求。这个清单只服务报名动作，不把未完成能力包装成已完成。

## 官方入口复核

2026-06-14 已复核：

- 官方页面仍显示 Sui Overflow 2026，May - August 2026，并有 Register 入口。
- 官方页面正文显示 `Registration is open!`。
- 官方 FAQ 同时显示 `Pre-registration is now open`。
- DeepSurge 公开 HTML 没有暴露表单字段和 required 状态。
- 本次外部入口快照记录在 `submission/external-entry-snapshot.md`。

2026-06-17 已复核：

- GitHub 仓库已 public。
- Sponsor 地址已 ready。
- 本地 Judge Test Mode 已启用网页 mint 测试 mUSDC。
- GitHub Pages 静态 Demo URL 已部署并验证。
- 仍缺公开视频 URL、浏览器钱包 E2E evidence。

结论：可以打开报名/预注册入口填写资料，但不要假设已经进入最终项目提交阶段。Demo video URL、是否接受静态 Demo、Repository URL 是否强制，必须以你登录后的表单 UI 为准。

## 当前结论

可以打开报名表开始填写已准备字段。

不能无条件最终提交。最终提交前仍需要你亲自处理：

- Demo URL 当前有可填的 GitHub Pages 静态 Demo URL，但它不是公开 API demo。
- Demo video URL 当前没有可填的公开或 unlisted 视频 URL。
- 真实 browser-wallet sponsored E2E 还需要你用两个钱包走完并导出 evidence。

## 第 1 步：拉最新代码并跑最终验收

```bash
git pull
npm ci
npm run registration:copy -- --write
npm run submission:pack -- --write
npm run founder:verify
```

通过标准：

- `Open registration form: YES`
- `Final submit without user action: NO` 是正常状态，表示仍有外部动作需要你确认。
- `Ready fields to copy` 里的字段可以复制到报名表。
- 如果只想复制字段，打开 `submission/registration-copy.md`。
- 如果想看字段、证据、外部入口快照、Go/No-Go 和下一步动作的完整单文件版本，打开 `submission/founder-submission-pack.md`。
- 登录 DeepSurge 后，用 `submission/live-form-verification-template.md` 记录实际看到的 required 字段，不要凭猜测提交。
- `Hold fields` 里的字段不要填，除非你已经完成对应验证。

## 第 2 步：仓库状态确认

当前 repo：

```text
https://github.com/a392479619-blip/sui-paylink
```

仓库已 public。提交前仍建议跑：

```bash
npm run public:preflight
```

然后再跑：

```bash
npm run registration:audit
npm run founder:verify
```

No-Go：

- `public:preflight` 不通过。

## 第 3 步：Demo URL 决策

当前可以填写已验证的 GitHub Pages 静态 Demo URL：

```text
https://a392479619-blip.github.io/sui-paylink/pay/demo-ai-workflow
```

注意：这是静态 mock demo，用来展示流程，不是公开 API demo，也不代表浏览器钱包 E2E 已完成。

### 方案 A：GitHub Pages

当前仓库已 public，GitHub Pages 已启用。

要走 GitHub Pages：

1. 运行：

```bash
npm run demo:pages-cutover -- --confirm-public-repo
```

2. 或在 GitHub Actions 手动运行 `Static Demo Pages`。
3. 打开：

```text
https://a392479619-blip.github.io/sui-paylink/pay/demo-ai-workflow
```

4. 打开成功后可以填写 Demo URL。

更稳的方式是先 dry-run：

```bash
npm run demo:pages-cutover
```

你确认可以公开仓库后，再执行：

```bash
npm run demo:pages-cutover -- --confirm-public-repo
```

这个命令会先跑公开前扫描，再公开仓库、启用 GitHub Pages、触发静态 Demo workflow、等待完成并验证 URL。不要在未确认可以公开仓库时运行执行模式。

### 方案 B：Cloudflare Pages

当前 GitHub secrets 里还没有：

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
```

要走 Cloudflare：

1. 在 GitHub repo secrets 添加这两个值。
2. 先 dry-run：

```bash
npm run demo:cloudflare-cutover -- --skip-local-smoke
```

3. 确认 secrets 已存在后执行：

```bash
npm run demo:cloudflare-cutover -- --confirm-cloudflare-deploy
```

也可以不跑脚本，直接在 GitHub Actions 手动运行 `Cloudflare Static Demo` workflow。

4. 打开：

```text
https://sui-paylink.pages.dev/pay/demo-ai-workflow
```

5. 如果你改用 Cloudflare 且打开成功，可以改填 Cloudflare Demo URL。

No-Go：

- 表单不接受静态 Demo，要求真实公开 API demo 或浏览器钱包 E2E demo。
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

Sponsor 当前已 ready。提交前仍建议跑：

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
- 没有 sponsor gas 不影响最低报名 PASS，但影响真实 browser-wallet sponsored E2E 录屏。如果 readiness 显示余额不足，先给上面地址补 Testnet SUI。

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

- Repository URL：当前仓库已 public，可以填写。
- Demo URL：当前 GitHub Pages 静态 Demo URL 已验证，可以填写；不要把它描述成真实公开 API demo。
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

## 登录表单后的判断

如果登录后看到的是预注册表：

- 只填身份、项目方向、track、项目简介等当前可填字段。
- 不要硬填未验证的 Demo URL 或 Demo video URL。
- 提交后记录平台给出的下一步要求。

如果登录后看到的是最终项目提交表：

- 先确认 repo 是否必须 public。
- 先确认表单是否接受静态 Demo URL。
- 先确认 Demo video 是否必填。
- 如果任何一项必填但未完成，先 No-Go，不要用占位链接提交。
