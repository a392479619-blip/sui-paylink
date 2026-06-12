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
- `/`
- `/pay/:id`
- 前端静态资源
- 未知 `/api/*` 返回 JSON 404

## Render 部署

仓库已经提供 `render.yaml`。在 Render 中使用 Blueprint 部署后，至少设置：

| 环境变量 | 值 |
|---|---|
| `PUBLIC_BASE_URL` | Render 生成的公开 URL，例如 `https://<service>.onrender.com` |
| `HOST` | `0.0.0.0` |
| `SERVE_WEB_APP` | `true` |
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
2. 打开公开首页创建一条 Paylink。
3. 打开生成的 `/pay/:id`。
4. 确认页面显示金额、双方地址、sponsor 状态、receipt。
5. 如果未配置 sponsor 私钥，视频里明确说 `Sponsor not configured`，不能说完成真实 gasless 浏览器交易。
6. 把公开首页 URL 或具体 `/pay/:id` URL 填到黑客松提交表。

## 当前边界

- Render 免费实例的 `/tmp` 是临时存储，重启后 Paylink 可能丢失。
- 当前 `mUSDC` 是项目 Testnet 测试币，不是真实 USDC。
- 公开 URL 只能证明 demo 可访问，不能替代真实 browser-wallet sponsored E2E。
