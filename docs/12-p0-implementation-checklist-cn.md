# SuiPayLink P0 实施清单

## 0. 目标

把当前“Testnet 合约闭环 + Mock Paylink 演示”推进到可提交黑客松的 P0 版本：

> 卖家创建真实 Paylink，买家打开公开链接，使用选定 Testnet 稳定币注资托管，平台代付 Gas，卖家交付，买家释放，回执页展示真实链上对象和交易。

P0 不追求商业化完整性，但必须避免把 Mock 描述成真实产品能力。

---

## 1. 当前已完成

| 项目 | 状态 | 证据 |
|---|---|---|
| Move 合约 Testnet 发布 | 完成 | `deployments/testnet.json` |
| Testnet 创建/注资/交付/释放 | 完成 | `deployments/testnet-smoke.json` |
| 前端默认 Testnet Package | 完成 | `apps/web/src/ChainDemo.tsx` |
| Mock API 健康检查 | 完成 | `/health` |
| Mock 创建 Paylink | 完成 | `/api/paylinks` |
| Mock 交付后释放规则 | 完成 | `releasePaylink` 只允许 `delivered` |
| Mock 退款规则 | 完成 | `refundPaylink` 只允许 `escrow + funded/delivered` |
| 买家地址输入 | 完成 | 创建表单已包含 `buyerAddress` |
| Testnet 退款路径 | 完成 | `deployments/testnet-refund-smoke.json` |
| 双地址 Testnet 路径 | 完成 | `deployments/testnet-two-party-smoke.json` |
| MockUSDC Testnet 路径 | 完成 | `deployments/testnet-mock-usdc-smoke.json`，非 SUI Coin |
| Sponsored MockUSDC Testnet 路径 | 完成 | `deployments/testnet-sponsored-mock-usdc-smoke.json`，buyer/seller SUI 均为 0 |
| Move 单元测试 | 完成 | `npm run chain:test`，13 tests passed |

---

## 2. P0 剩余任务总览

| 优先级 | 任务 | 产出 | 验收 |
|---|---|---|---|
| P0-1 | 持久化 Paylink | `.data/paylinks.json` 文件持久化 | 基础版完成，服务重启后数据不丢 |
| P0-2 | 独立公开支付页 | `/pay/:id` | 基础版完成，买家无需进入卖家 Dashboard |
| P0-3 | 不同买卖双方 Testnet 验证 | 双地址 smoke 脚本 | 完成 |
| P0-4 | Testnet 稳定币路径 | MockUSDC 测试币 | 完成，真实稳定币仍未接入 |
| P0-5 | Sponsored Transaction | Sponsor API + smoke 脚本 | 完成链上验证，产品化持久化未完成 |
| P0-6 | 链上事件索引 | Event indexer | 回执来自真实事件 |
| P0-7 | Refund Testnet 验证 | smoke 脚本 | 完成 |
| P0-8 | Move 单元测试 | `sui move test` 有实际测试 | 完成 |
| P0-9 | 演示视频脚本 | 2 分钟 Demo | 评委能看懂 Sui 必要性 |

---

## 3. 任务拆解

## 3.1 P0-1：持久化 Paylink

状态：基础版完成。当前使用 `.data/paylinks.json` 做文件持久化，已验证 API 重启后 Paylink 仍可读取。SQLite/Postgres 仍是后续产品化方向，不是当前黑客松 demo 的阻塞项。

### 要改的文件

- `apps/api/src/store.ts`
- `apps/api/src/config.ts`
- `packages/shared/src/index.ts`
- `apps/api/.env.example`
- `.gitignore`

### 最小表结构

| 表 | 用途 |
|---|---|
| `.data/paylinks.json` | Paylink 业务快照 |
| `chain_events` | 未完成，后续 Indexed Sui events |
| `sponsored_transactions` | 未完成，后续 Sponsor 请求与 Gas 成本 |

### Paylinks 最小字段

- `id`
- `mode`
- `status`
- `seller_name`
- `seller_address`
- `buyer_name`
- `buyer_address`
- `amount`
- `amount_base_units`
- `token`
- `coin_type`
- `fee_bps`
- `fee_receiver`
- `memo`
- `public_url`
- `escrow_object_id`
- `fund_transaction_digest`
- `deliver_transaction_digest`
- `release_transaction_digest`
- `refund_transaction_digest`
- `delivery_proof_uri`
- `created_at`
- `updated_at`

### 验收

- 重启 API 后 Paylink 仍存在：已验证。
- 创建、注资、交付、释放状态可恢复：基础 Mock 状态已支持。
- 不再使用内存 `Map` 作为唯一数据源：已完成，内存 `Map` 仅作为运行时缓存，文件为持久化来源。

---

## 3.2 P0-2：独立公开支付页 `/pay/:id`

状态：基础版完成。当前可直接打开 `http://127.0.0.1:5174/pay/<id>` 查看买家页并执行 Mock fund/deliver/release/refund 状态流；真实链上 sponsored Paylink 操作尚未接入该页面。

### 要改的文件

- `apps/web/src/App.tsx`
- 新增路由或轻量 route 解析
- `apps/web/src/api.ts`

### 页面必须展示

- 卖家名称与地址。
- 买家名称与地址。
- 金额、币种、手续费。
- 服务说明。
- 当前状态。
- 链上对象和交易链接。
- 注资/释放/退款按钮。

### 验收

- 直接打开 `http://127.0.0.1:5174/pay/<id>` 能看到买家支付页：已验证。
- 卖家 Dashboard 和买家公开页互不混淆：已完成。
- 公开页不能编辑 Paylink：已完成。

---

## 3.3 P0-3：不同买卖双方 Testnet 验证

状态：已完成。

### 要改的文件

- `scripts/testnet-smoke.sh`
- `deployments/testnet-smoke.json`
- 可能新增 `scripts/testnet-smoke-two-party.sh`

### 目标

使用三个不同地址：

- buyer：注资、释放、退款。
- seller：标记交付、收款。
- feeReceiver：收平台费。

### 验收

- 非 seller 标记交付失败。
- 非 buyer 释放失败。
- 正确 seller 标记交付成功。
- 正确 buyer 释放成功。
- 释放事件中 seller 与 feeReceiver 不同。

---

## 3.4 P0-4：Testnet 稳定币路径

状态：MockUSDC 测试币路径已完成；真实 USDC 或官方稳定币尚未接入。

### 路径选择

优先级：

1. 使用 Sui Testnet 上可获取的真实稳定币或官方测试稳定币。
2. 如果没有可用资产，部署项目自己的 `MockUSDC` 测试币，并明确标注为测试币。
3. 继续用 SUI 只作为合约泛型证明，不作为最终参赛闭环。

### 要改的文件

- `contracts/sources/mock_usdc.move`
- `apps/api/src/config.ts`
- `apps/web/src/ChainDemo.tsx`
- `scripts/testnet-mock-usdc-smoke.sh`
- `deployments/testnet-mock-usdc-smoke.json`

### 验收

- `Escrow<T>` 的 `T` 不是 `0x2::sui::SUI`。
- Paylink 页面显示正确 Coin Type。
- 回执显示稳定币符号、精度和金额。
- 当前已验证 `Escrow<...::mock_usdc::MOCK_USDC>`，但只能标注为测试币 `mUSDC`。

---

## 3.5 P0-5：Sponsored Transaction

### 当前状态

状态：链上验证完成，产品化未完成。

已完成：

- 新增共享 schema：`buildSponsoredTransactionSchema`、`submitSponsoredTransactionSchema`。
- 新增后端 Sponsor 服务：`apps/api/src/sponsor.ts`。
- 新增 Sponsor API：
  - `POST /api/sponsored-transactions/build`
  - `GET /api/sponsored-transactions/:id`
  - `POST /api/sponsored-transactions/:id/submit`
- 支持白名单动作：
  - `fund-mock-usdc`
  - `mark-delivered`
  - `release`
  - `refund`
- 支持 `SPONSOR_PRIVATE_KEY`、`SPONSOR_GAS_BUDGET_MIST`、`MAX_SPONSOR_GAS_BUDGET_MIST`、`SPONSORED_TX_TTL_MS` 等配置。
- 未配置 `SPONSOR_PRIVATE_KEY` 时，`/api/config` 返回 `sponsorEnabled: false`，build 返回 `503 sponsor_not_configured`。
- 新增真实 Testnet smoke：`scripts/testnet-sponsored-mock-usdc-smoke.mjs`。
- 新增命令：`npm run chain:smoke:sponsored-mock-usdc:testnet`。
- 已产出证据：`deployments/testnet-sponsored-mock-usdc-smoke.json`。
- 已验证 buyer 初始/最终 SUI 均为 `0`。
- 已验证 seller 初始/最终 SUI 均为 `0`。
- 已验证 sponsor 支付三笔业务操作 Gas：注资、交付、释放。
- 已验证 seller 收到 `99 mUSDC`，fee receiver 收到 `1 mUSDC`。

未完成：

- 前端浏览器钱包对后端 build bytes 的兼容验证。
- Sponsor 请求持久化。
- 单 Paylink 幂等控制。
- 实际 Gas 成本落库。
- 与真实 Paylink 状态机联动。

### 最小实现

先做 self-sponsored：

1. 后端构建交易。
2. 用户签名交易数据。
3. 后端校验交易内容。
4. Sponsor 钱包签 Gas。
5. 后端提交并返回 Digest。

### 已新增的接口

- `POST /api/sponsored-transactions/build`
- `GET /api/sponsored-transactions/:id`
- `POST /api/sponsored-transactions/:id/submit`

`POST /api/paylinks/:id/transactions/*` 仍未实现；当前 P0 先让 sponsor API 直接接收链上对象和 coin object。

### 风控验收

- 非白名单 Package 拒绝：已实现，Escrow package 必须等于当前 `packageId`。
- 非白名单函数拒绝：已实现，API 只构建 4 个固定 action。
- 金额不匹配拒绝：已实现，`expectedAmountUnits` 存在时必须匹配 coin balance。
- 卖家不匹配拒绝：部分实现，`mark-delivered` 要求 sender 等于链上 seller，`fund-mock-usdc` 要求 seller 与 sender 不同。
- 买家不匹配拒绝：已实现，`release` 和 `refund` 要求 sender 等于链上 buyer。
- 币种不匹配拒绝：已实现，仅允许 `mUSDC`。
- 单 Paylink 重复 Sponsor 拒绝：未实现，需要持久化 Paylink 后做幂等控制。
- 记录 Gas 预算和实际 Gas 消耗：部分实现，预算已限制，实际 Gas 成本需要从执行结果落库。

### P0-5 完成门槛

当前 smoke 已满足：

1. API 配置临时真实 `SPONSOR_PRIVATE_KEY`。
2. Sponsor 地址在 Testnet 有 SUI gas。
3. 用户 keypair 签署 `/api/sponsored-transactions/build` 返回的 `transactionBytes`。
4. `/api/sponsored-transactions/:id/submit` 使用用户签名 + sponsor 签名提交成功。
5. 产出 `mUSDC` sponsored escrow 的 Testnet digest。
6. 证明 buyer 和 seller 均可没有 SUI 余额。

还未满足：

1. 浏览器钱包签名兼容验证。
2. 真实 Paylink ID 与 sponsor request 绑定。
3. Sponsor request 持久化和幂等拒绝。

---

## 3.6 P0-6：链上事件索引

### 要索引的事件

- `EscrowCreated`
- `EscrowFunded`
- `DeliveryMarked`
- `EscrowReleased`
- `EscrowRefunded`

### 验收

- 回执页金额来自 `EscrowReleased` 事件。
- 状态来自链上对象和事件，不来自 Mock 按钮结果。
- 后端状态与链上冲突时，以链上为准。

---

## 3.7 P0-7：Refund Testnet 验证

状态：已完成。

### 脚本流程

1. 创建并注资托管。
2. 买家调用 `refund_to_buyer`。
3. 查询对象。
4. 验证：
   - `refunded=true`
   - `released=false`
   - `funds=0`

### 验收

- 生成 `deployments/testnet-refund-smoke.json`。
- 退款交易 Digest 可在 Explorer 打开。

---

## 3.8 P0-8：Move 单元测试

状态：已完成。

### 必测项

- 零金额拒绝。
- 手续费超过上限拒绝。
- 非卖家交付拒绝。
- 重复交付拒绝。
- 未交付释放拒绝。
- 非买家释放拒绝。
- 重复释放拒绝。
- 退款后释放拒绝。
- 释放后退款拒绝。
- 手续费拆分正确。

### 验收

`npm run chain:test` 当前结果为 `Total tests: 13; passed: 13; failed: 0`。

---

## 4. 推荐执行顺序

已完成的链上验证不要重复作为主线任务。当前推荐执行顺序：

1. 把真实 Paylink ID、链上 escrow object 和 sponsored transaction request 绑定起来。
2. 做事件索引或最小链上查询同步，让回执来自真实链上对象和交易。
3. 持久化 Sponsor request、Gas 预算和实际 Gas 成本。
4. 验证浏览器钱包对 sponsored transaction bytes 的签名兼容性。
5. 做 2 分钟演示视频脚本和提交材料。
6. 后续再评估真实稳定币或官方 Testnet stablecoin；当前参赛闭环先明确标注为 `mUSDC` 测试币。

---

## 5. 每次推进后的固定校验

```bash
npm run typecheck
npm run build
npm run chain:build
npm run chain:test
```

涉及 Testnet 时追加：

```bash
npm run chain:deploy:testnet
npm run chain:smoke:testnet
npm run chain:smoke:refund:testnet
npm run chain:smoke:two-party:testnet
npm run chain:smoke:mock-usdc:testnet
npm run chain:smoke:sponsored-mock-usdc:testnet
```

---

## 6. 当前下一步

下一步应做：

1. 将 Sponsor 请求、真实 Paylink ID、escrow object、fund/deliver/release/refund digest 做幂等绑定。
2. 增加最小事件索引或链上对象同步，让回执页显示真实链上状态。
3. 持久化 Sponsor request、Gas 预算和实际 Gas 成本。
4. 验证浏览器钱包签署 sponsored transaction bytes 的兼容性。
5. 准备黑客松提交材料：公开仓库、部署链接、2 分钟 demo、风险边界说明。

理由：双地址 smoke、退款 smoke、MockUSDC smoke、Sponsored MockUSDC smoke、Move 单元测试、Paylink 文件持久化和公开买家页基础版已完成。下一步不是继续证明 Mock 页面，而是把已证明的链上能力接入可给评委操作的 Paylink 产品闭环。
