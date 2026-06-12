# SuiPayLink 2 分钟 Demo 脚本

## 目标

这份脚本用于录制黑客松提交视频。目标不是把产品说成已经生产可用，而是让评委在 2 分钟内看懂：

- 具体用户是谁。
- 为什么 Web2 或普通转账不够。
- Sui 的价值在哪里。
- 当前已经验证了什么。
- 当前还没有完成什么。

## 一句话开场

SuiPayLink 是面向跨境数字服务的 gasless stablecoin escrow paylink：卖家发一个链接，买家不用先持有 SUI gas 也能进入托管支付流程，交付后再释放，双方拿到可验证的链上记录。

## 录制前准备

必须先跑：

```bash
npm run smoke:api
npm run smoke:preview
npm run typecheck
npm run build
```

如果要录真实 sponsored 浏览器钱包路径，还必须先跑：

```bash
SPONSOR_PRIVATE_KEY=<sui-private-key> npm run sponsor:readiness
```

本地演示页面：

```bash
npm run dev
```

单服务生产预览：

```bash
npm run preview:prod
```

公开买家页示例：

```text
http://127.0.0.1:5174/pay/<paylink-id>
https://<demo-host>/pay/demo-ai-workflow
```

## 推荐视频结构

### 0:00 - 0:15 问题

画面：项目 README 或卖家 Dashboard。

旁白：

> 跨境数字服务付款通常卡在三件事：买家要先弄钱包和 gas，卖家要手动核对地址，服务交付前双方缺少一个轻量托管和回执。SuiPayLink 把这个流程压成一个 payment link。

不要说：

- “我们已经是 Stripe 替代品。”
- “支持所有稳定币。”
- “已经生产可用。”

### 0:15 - 0:35 创建 Paylink

画面：卖家 Dashboard 创建 `100 mUSDC` escrow paylink。

旁白：

> 卖家创建一个 100 mUSDC 的服务托管链接，填买家地址、卖家地址、服务说明和手续费。这个 demo 用的是项目自己的 Testnet MockUSDC，不是真实 USDC。

必须展示：

- seller address
- buyer address
- amount
- memo
- public URL

### 0:35 - 1:05 买家公开页

画面：打开 `/pay/:id`。

旁白：

> 买家打开公开链接，不需要进入卖家后台。页面显示付款金额、双方地址、当前状态和 sponsor 状态。真实 sponsor 模式下，买家签业务交易，平台 sponsor 钱包付 gas。

如果当前没有配置 `SPONSOR_PRIVATE_KEY`，旁白必须改成：

> 这台本地环境没有配置 sponsor 私钥，所以真实 sponsor 按钮被禁用。后端不会回退到假链上执行；这是为了避免把 mock 能力说成真实能力。

如果展示 `/pay/demo-ai-workflow` 的 demo mode，旁白必须加：

> 这个按钮只跑本地 mock API，用来让评委看到托管状态流和 receipt。它不是钱包签名，也不是新的 Sui 链上交易。

必须展示：

- `Sponsor ready` 或 `Sponsor not configured`
- required signers
- payment coin object
- sponsored action buttons

### 1:05 - 1:30 托管状态流

画面：展示已经验证过的 Testnet evidence 或本地 mock 状态流。

旁白：

> 合约层已经在 Sui Testnet 跑通过：创建托管、标记交付、释放、退款、买卖双方不同地址、MockUSDC、sponsored gas。Sponsored smoke 证明 buyer 和 seller 的 SUI 余额可以保持 0，由 sponsor 支付 gas。

必须展示至少一个：

- `deployments/testnet-sponsored-mock-usdc-smoke.json`
- README 中的 sponsored fund/release explorer digest
- Sui Explorer 交易链接

### 1:30 - 1:45 回执与链上同步

画面：Receipt 卡片，点击 `Sync chain`。

旁白：

> 回执页显示 seller received、platform fee、digest、escrow object 和 timeline。现在已经有最小按需链上同步：它会从 Paylink 绑定的 sponsored digests 拉 transaction events 和 Escrow object 状态。完整后台 event indexer 还没有做。

如果没有真实 sponsored digest，必须说明：

> 当前这条本地 Paylink 没有 executed sponsored digest，所以 chain verification 是 pending，而不是伪造 verified。

### 1:45 - 2:00 收尾

画面：README 的 status 或 runbook。

旁白：

> 这不是通用 checkout，也不是法务仲裁平台。它先服务一个窄场景：Web3 服务、AI 自动化服务、小团队和贡献者付款。Sui 的价值在于 sponsored transactions、低费率、对象模型和可验证回执。下一步是接真实稳定币、浏览器钱包端到端证据、后台事件索引和托管部署。

## 当前可声称的能力

- Move escrow package 已部署并通过 Testnet smoke。
- SUI escrow、refund、two-party、MockUSDC 和 sponsored MockUSDC 都有证据文件。
- Sponsored MockUSDC smoke 已证明 buyer/seller 可保持 0 SUI。
- Paylink API、公开买家页、Sponsor request 持久化、Paylink 回写、最小按需链上同步已实现。
- 本地 API 回归 smoke 可重复验证 mock 状态流和无 sponsor guard。

## 当前不能声称的能力

- 不能说支持真实 USDC 生产支付。
- 不能说浏览器钱包 sponsored flow 已端到端验证，除非已经完成真实钱包录屏和证据。
- 不能说有完整后台 event indexer。
- 不能说有合规仲裁或法务保障。
- 不能说买家完全不需要钱包；当前 demo 仍需要 Sui wallet 签名业务交易。

## 推荐录屏素材

- README 当前状态段落。
- Seller dashboard 创建 Paylink。
- `/pay/:id` 公开买家页。
- `Sync chain` 回执卡。
- `deployments/testnet-sponsored-mock-usdc-smoke.json`。
- Sui Explorer 中的 sponsored fund/release digests。
- `npm run smoke:api` 成功输出。
- `npm run smoke:preview` 成功输出。
