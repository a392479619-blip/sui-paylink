# SuiPayLink 中文详细 PRD

## 0. 文档信息

| 项目 | 内容 |
|---|---|
| 产品名称 | SuiPayLink |
| 产品定位 | 面向跨境数字服务交易的稳定币托管支付链接 |
| 参赛方向 | Sui Overflow 2026，DeFi & Payments |
| 文档版本 | v1.1 |
| 文档日期 | 2026-06-11 |
| 当前阶段 | Testnet 合约闭环、MockUSDC 与 Sponsored Gas smoke 已验证；真实稳定币、持久化和事件索引尚未完成 |
| 产品负责人 | Founder |
| 技术形态 | React + Fastify + Sui Move |

本文档描述的是参赛 MVP 应该达到的完整产品形态，同时明确当前真实实现与目标形态之间的差距。不得把 Mock API、Test SUI 或包内测试币 `mUSDC` 描述为已经实现的真实稳定币生产支付能力。

---

## 1. 产品定义

### 1.1 一句话定义

SuiPayLink 让数字服务卖家生成一个稳定币托管支付链接，买家打开链接后将稳定币存入链上托管，卖家提交交付证明，买家确认后释放款项；平台为关键交易代付 SUI Gas。

### 1.2 首个具体场景

Alice 是 AI 自动化服务商，为 Sui 项目方 Bob 搭建一套工作流，服务价格为 `100 USDC`：

1. Alice 创建服务托管支付链接。
2. Bob 打开链接，确认卖家、服务内容、金额和交付条件。
3. Bob 使用 USDC 注资托管，不需要提前持有 SUI。
4. Alice 完成服务并提交交付证明。
5. Bob 查看证明并确认释放。
6. 合约自动将 `99 USDC` 转给 Alice，将 `1 USDC` 平台费转给平台。
7. 双方获得可验证的链上交易记录和回执。

### 1.3 核心用户

| 用户 | 描述 | 核心需求 |
|---|---|---|
| 服务卖家 | Web3 服务商、AI 自动化顾问、自由职业者、小型跨境工作室 | 更容易收稳定币；降低买家不付款风险；不向买家解释 SUI Gas |
| 服务买家 | Sui 项目方、Web3 创业者、购买数字服务的个人或团队 | 交付前资金受控；能够核验收款方、交付证明和资金流向 |
| 平台运营方 | SuiPayLink 运营者 | 管理支持币种、代付 Gas、手续费、风险规则和交易记录 |

### 1.4 明确不服务的用户

- 没有任何稳定币获取渠道的买家。
- 主流电商和银行卡结账用户。
- 需要法币入金、出金或换汇的用户。
- 需要复杂仲裁、法律裁决或多方里程碑付款的企业。
- 大额、受监管、高风险商品或服务交易。

---

## 2. 产品为什么成立

### 2.1 用户问题

| 当前方案 | 优点 | 关键缺陷 |
|---|---|---|
| 直接钱包转账 | 快、简单 | 没有托管、交付状态、付款条款和结构化回执 |
| Web2 支付链接 | 用户熟悉、支持银行卡 | 不以稳定币结算；跨境收款可能慢、贵或受地区限制 |
| 通用 Crypto Checkout | 支持多币种付款 | 通常围绕商品结账，不围绕数字服务交付与买家释放 |
| 自行部署托管合约 | 可定制 | 普通服务商无法独立开发、部署和维护 |

### 2.2 Sui 必须存在的理由

SuiPayLink 不是为了“把 Web2 支付链接搬到链上”。Sui 的作用必须体现在：

1. 托管资金由 Move 合约按照状态机执行，而不是由平台数据库决定。
2. 交付、释放、退款和手续费分配形成可验证事件记录。
3. `Escrow<T>` 可接受指定 Sui Coin 类型，为稳定币托管提供基础。
4. Sponsored Transaction 让买家只持有稳定币也能完成合约调用。
5. Sui 对象模型适合把每笔服务托管表示为独立共享对象。

如果最终产品只是“连接钱包后直接转账”，则项目失去核心差异，应该否决。

---

## 3. 产品目标与非目标

### 3.1 参赛 MVP 目标

必须向评委证明：

1. 卖家可以创建一笔结构化服务托管交易。
2. 买家可以使用 Testnet 稳定币注资托管。
3. 卖家和买家由不同账户分别执行交付与释放。
4. 买家在没有 SUI 的情况下仍可完成需要的操作。
5. 资金、平台费和最终状态可以在 Sui Testnet 上核验。
6. 页面能够把复杂的钱包与 Gas 流程隐藏在清晰的服务交易流程后面。

### 3.2 商业验证目标

参赛后 30 天内验证：

- 至少访谈 10 个目标卖家。
- 至少 3 个卖家愿意创建真实试用交易。
- 至少 1 个团队愿意为定制部署或白标页面付费。
- 至少 1 笔小额稳定币托管从注资走到释放。

### 3.3 非目标

- 不做多链。
- 不做法币入金和银行卡支付。
- 不做通用电商 Checkout。
- 不做交易撮合市场。
- 不承诺平台仲裁。
- 不做收益、借贷或理财。
- 不在审计前处理真实大额资金。

---

## 4. 当前真实进度

### 4.1 已完成

| 能力 | 当前状态 | 证据 |
|---|---|---|
| Move 合约编译 | 已完成 | `npm run chain:build` |
| Testnet 发布 | 已完成 | Package `0x994e7ea20d955da3539c9971584bc4d524066b3df5bcbef0c180bfc2e3c5c340` |
| 创建并注资托管 | 已完成 | Testnet 交易已成功 |
| 标记交付 | 已完成 | Testnet 交易已成功 |
| 买家释放资金 | 已完成 | Testnet 交易已成功 |
| 手续费拆分 | 已完成 | 释放事件记录卖方金额与平台费 |
| 最终对象核验 | 已完成 | `delivered=true`、`released=true`、`funds=0` |
| 前端钱包签名交易面板 | 已完成 | 默认指向 Testnet Package |
| Mock Paylink 创建与状态演示 | 已完成 | Fastify 内存 API |
| Mock 状态规则对齐 | 已完成 | Mock 释放必须先交付，退款仅限已注资/已交付托管 |
| MockUSDC Testnet 托管 | 已完成 | `deployments/testnet-mock-usdc-smoke.json`，`Escrow<...::mock_usdc::MOCK_USDC>` |
| Sponsored MockUSDC Testnet 托管 | 已完成 | `deployments/testnet-sponsored-mock-usdc-smoke.json`，buyer/seller SUI 均为 0 |
| Move 单元测试 | 已完成 | `npm run chain:test`，13 tests passed |

### 4.2 尚未完成

| 缺口 | 当前情况 | 参赛优先级 |
|---|---|---|
| 真实 Testnet 稳定币 | 当前已验证 `mUSDC` 测试币；真实 USDC/官方稳定币尚未接入 | P0/P1 |
| Sponsored Gas 产品化 | Testnet smoke 已验证；前端钱包兼容、Paylink 幂等、Gas 成本落库尚未完成 | P0 |
| 买卖双方不同账户验证 | 已完成 | `deployments/testnet-two-party-smoke.json` |
| 真实 Paylink 与链上对象关联 | Mock API 与真实链上面板相互独立 | P0 |
| 链上事件索引 | 未实现 | P0 |
| 公开买家支付链接路由 | `publicUrl` 已生成，但前端没有独立 `/pay/:id` 页面 | P0 |
| 真实身份与权限 | Mock API 的 `actor` 字段不参与鉴权 | P0 |
| Refund Testnet 验证 | 已完成 | `deployments/testnet-refund-smoke.json` |
| Invoice 链上流程 | 合约有 `Invoice`，前端/API 未使用 | P1 |
| Direct Paylink 链上流程 | 仅 Mock 模式 | P1 |
| 过期逻辑 | `expired` 仅存在于枚举，没有定时或链上过期逻辑 | P1 |
| Walrus 交付证明 | 当前仅保存 URI 字符串 | P1 |
| zkLogin / 钱包无感登录 | 未实现 | P2 |

---

## 5. 版本范围

### 5.1 P0：参赛闭环

P0 是提交 Sui Overflow 前必须完成的范围：

- 卖家连接钱包并创建托管支付链接。
- 买家通过公开链接查看交易条款。
- 买家使用 Testnet 稳定币注资。
- 平台为买家的注资和释放操作代付 Gas。
- 卖家提交交付证明。
- 买家确认并释放。
- 支持买家退款路径。
- 页面展示链上状态、交易摘要、对象 ID 和资金分配。
- 后端索引真实链上事件。
- 使用不同买卖双方地址完成完整演示。
- 为关键合约路径补充 Move 单元测试。

### 5.2 P1：可试用产品

- Direct Paylink。
- 交易过期时间。
- 卖家品牌信息。
- 邮件或 Telegram 通知。
- Walrus 存储交付证明。
- 可下载回执。
- Sponsor Gas 风控后台。
- 卖家历史交易筛选和导出。

### 5.3 P2：商业化

- 团队账户和成员权限。
- 白标域名与主题。
- API Key 和 Webhook。
- 分阶段里程碑付款。
- 争议申请与人工协调流程。
- 订阅套餐。
- 合规策略、制裁筛查和审计。

---

## 6. 角色与权限

| 操作 | 卖家 | 买家 | 平台 | 合约 |
|---|---:|---:|---:|---:|
| 创建 Paylink 元数据 | 是 | 否 | 可代创建 | 否 |
| 注资托管 | 否 | 是 | 仅代付 Gas | 校验并持有资金 |
| 修改交易金额 | 创建后禁止 | 否 | 否 | 禁止 |
| 标记交付 | 是 | 否 | 否 | 校验发送者为卖家 |
| 释放资金 | 否 | 是 | 仅代付 Gas | 校验已交付并拆分资金 |
| 发起退款 | 否 | 是 | 否 | 校验发送者为买家 |
| 修改手续费接收方 | 创建后禁止 | 否 | 否 | 禁止 |
| 查看公开交易状态 | 是 | 是 | 是 | 提供链上状态 |
| 配置支持币种 | 否 | 否 | 是 | 不负责 |
| 决定交易争议 | 否 | 否 | P0 不支持 | 不支持 |

关键原则：

- Sponsor 只支付 Gas，不替用户签署资产授权。
- 平台不能在未经买家签名的情况下释放或退款。
- 创建后的金额、币种、卖家、买家、手续费比例和手续费接收方不得被后台静默修改。

---

## 7. 核心状态机

### 7.1 Escrow 状态

推荐后端使用单一枚举状态，并与链上布尔字段保持映射：

```text
draft -> created -> funding -> funded -> delivered -> releasing -> released
                           \-> refunding -> refunded
created/funded/delivered -> expired
任意交易提交状态 -> failed，可重试后回到原业务状态
```

当前共享类型只有：

```text
created | funded | delivered | released | refunded | expired
```

P0 应补充交易处理中间态，避免用户重复提交。

### 7.2 状态流转规则

| 当前状态 | 动作 | 执行者 | 下一状态 | 必要条件 | 失败后 |
|---|---|---|---|---|---|
| `draft` | 创建链接 | 卖家 | `created` | 表单校验通过 | 保持 `draft` |
| `created` | 注资 | 买家 | `funded` | 币种、金额、余额、签名有效 | 保持 `created` |
| `funded` | 标记交付 | 卖家 | `delivered` | 调用者是卖家；未退款/释放 | 保持 `funded` |
| `delivered` | 释放 | 买家 | `released` | 调用者是买家；已交付 | 保持 `delivered` |
| `funded` | 退款 | 买家 | `refunded` | 未释放 | 保持 `funded` |
| `delivered` | 退款 | 买家 | `refunded` | P0 合约当前允许；产品需明确告知卖家 | 保持 `delivered` |

### 7.3 不变量

- `amount > 0`。
- `feeBps <= 1000`，即合约硬上限 10%。
- 产品 P0 默认限制 `feeBps <= 500`，即 5%。
- `sellerAmount + feeAmount = amount`。
- `released` 与 `refunded` 不能同时为真。
- 释放前必须 `delivered=true`。
- 释放或退款后，`funds=0`。
- 只有卖家可以标记交付。
- 只有买家可以释放或退款。
- 同一动作不能重复执行。

---

## 8. 页面与功能需求

## 8.1 卖家连接钱包

### 功能目的

获得卖家地址，用于创建 Paylink、设置托管收款方和后续标记交付。

### 页面行为

- 页面首屏显示“连接 Sui 钱包”。
- 连接后显示缩略地址、当前网络和余额。
- 非 Testnet 钱包必须提示切换网络。
- 不允许手工输入卖家地址代替已连接钱包地址。

### 验收标准

- 连接钱包后，创建表单的 `sellerAddress` 自动填充且不可修改。
- 标记交付交易由该钱包签名。
- 钱包切换账户后，页面同步更新。

---

## 8.2 创建托管支付链接

### 功能目的

卖家定义一笔数字服务交易的付款与交付条款，并生成可分享链接。

### 表单字段

| 页面字段 | API 字段 | 类型 | 必填 | 默认值 | 校验规则 | 是否上链 |
|---|---|---|---:|---|---|---:|
| 支付模式 | `mode` | enum | 是 | `escrow` | P0 仅允许 `escrow` | 否 |
| 卖家名称 | `sellerName` | string | 是 | 钱包名称或空 | 1-100 字符 | 否 |
| 卖家地址 | `sellerAddress` | address | 是 | 当前钱包 | 必须是有效 Sui 地址；不可手工修改 | 是 |
| 买家名称 | `buyerName` | string | 否 | 空 | 0-100 字符 | 否 |
| 买家地址 | `buyerAddress` | address | P0 是 | 空 | 必须是有效 Sui 地址；不能等于卖家地址 | 是 |
| 服务标题 | `title` | string | 是 | 空 | 1-120 字符 | 建议新增，否 |
| 服务说明 | `memo` | string | 是 | 空 | 1-500 字符；不得包含敏感信息 | 是 |
| 金额 | `amount` | decimal string | 是 | 空 | 大于 0；精度不超过币种 decimals | 是，以最小单位保存 |
| 币种 | `token` | string | 是 | 首个支持稳定币 | 必须来自支持币种列表 | 是，以 Coin Type 表示 |
| 平台费率 | `feeBps` | integer | 是 | `100` | 0-500；后台可配置；合约上限 1000 | 是 |
| 交付说明 | `deliverable` | string | 是 | 空 | 1-500 字符 | 建议新增，否或 URI |
| 到期时间 | `expiresAt` | ISO datetime | P1 | 空 | 必须晚于当前时间 | 否/后续上链 |

### 创建结果

创建成功后返回：

- `paylinkId`
- `publicUrl`
- `status=created`
- 卖家、买家、金额、币种、服务条款快照
- 创建时间

### 当前实现差距

- 当前表单允许手工输入伪地址。
- 当前共享 schema 没有 `title`、`deliverable`、`expiresAt`。
- 当前创建动作只写入内存，不创建链上 Invoice。
- 当前 `publicUrl` 指向 `/pay/:id`，但没有独立公开路由页面。

### 验收标准

- 缺少必填字段时不能创建。
- 金额按币种精度正确转换为最小单位。
- 创建后页面生成可复制链接。
- 买家地址、金额和币种在注资后不能修改。

---

## 8.3 买家公开支付链接

### 功能目的

让买家在签名或转账前明确知道“向谁付款、为什么付款、多少钱、资金会如何流转”。

### 页面展示字段

| 字段 | 展示要求 |
|---|---|
| 卖家名称 | 显著展示 |
| 卖家地址 | 缩略展示，可展开复制 |
| 服务标题与说明 | 完整展示 |
| 金额与币种 | 页面最显著位置 |
| 平台费 | 明确说明由金额中扣除，不额外向买家收取 |
| 买家地址 | 如已指定，当前钱包必须匹配 |
| 当前状态 | 使用中文状态和解释 |
| 托管说明 | 明确资金在买家释放前由合约持有 |
| Gas 说明 | 只有 Sponsored Gas 真正生效时才能显示“无需 SUI” |
| 风险提示 | 原型、小额测试、无平台仲裁 |

### 主要操作

- `连接钱包`
- `确认并注资托管`
- `查看链上交易`
- `复制支付链接`

### 验收标准

- 未连接钱包时不允许注资。
- 指定买家的链接不能被其他地址注资。
- 网络错误、余额不足、币种错误都有明确提示。
- 买家签名前必须看到最终金额、收款方和币种。

---

## 8.4 注资托管

### 功能目的

买家将指定稳定币转入独立 `Escrow<T>` 共享对象。

### 交易逻辑

调用：

```text
create_funded_escrow<T>(
  seller,
  memo,
  payment,
  fee_bps,
  fee_receiver
)
```

合约自动从交易发送者得到 `buyer`，并从 `payment` Coin 得到 `amount`。

### 输入字段

| 字段 | 来源 | 说明 |
|---|---|---|
| `T` | 支持币种配置 | 支付 Coin Type |
| `seller` | Paylink 快照 | 卖家 Sui 地址 |
| `memo` | Paylink 快照 | 服务交易说明 |
| `payment` | 买家钱包 | 指定金额的 Coin |
| `fee_bps` | Paylink 快照 | 平台费率 |
| `fee_receiver` | 平台配置 | 平台手续费接收地址 |
| `buyer` | `tx_context::sender` | 由合约自动确定，不由前端传入 |

### Sponsored Gas 流程

1. 前端向后端请求构建 sponsored transaction。
2. 后端只按白名单 action 构建交易，并设置 `sender` 与 `gasOwner`。
3. 后端读取链上对象，检查 Package、函数、金额、币种、买家/卖家和状态。
4. 前端钱包签署后端返回的 `transactionBytes`。
5. 后端用 Sponsor 钱包对同一份 transaction bytes 签名。
6. 后端提交用户签名 + Sponsor 签名，并记录 Digest、状态与 Gas 成本。

### Sponsor 必须拒绝

- 非白名单 Package 或函数。
- 非平台创建的 Paylink。
- 金额、币种、卖家或手续费与 Paylink 快照不一致。
- 超出单笔或每日 Gas 预算。
- 已注资、已释放、已退款或已过期的 Paylink。
- 买家地址不匹配。
- 重复请求或疑似自动化滥用。

### 成功结果

- 创建独立 `Escrow<T>` 共享对象。
- `funded=true`。
- 后端 Paylink 状态更新为 `funded`。
- 保存 `escrowObjectId`、`fundTransactionDigest`、`fundedAt`。

### 验收标准

- 使用 Testnet 稳定币完成注资。
- 买家地址没有 SUI 余额时仍可成功。
- Sponsor Gas 失败不会导致 Paylink 被误标记为已注资。
- 重复点击不会创建两笔托管。

---

## 8.5 卖家标记交付

### 功能目的

卖家声明服务已完成，并附上买家可核验的交付证明。

### 页面字段

| 页面字段 | API/链上字段 | 类型 | 必填 | 校验 |
|---|---|---|---:|---|
| 交付证明链接 | `deliveryProofUri` | URL string | 是 | HTTPS、Walrus 或允许的存储协议 |
| 交付说明 | `deliveryNotes` | string | 否 | 最多 1000 字符；建议新增 |
| 提交时间 | `deliveredAt` | datetime | 系统 | 后端记录 |

### 交易规则

- 只有链上 `seller` 地址可以调用。
- 只有 `funded` 且未交付的托管可以提交。
- 已释放或已退款时禁止提交。
- P0 可由卖家自行支付 Gas；目标形态可以为卖家代付。

### 成功结果

- `delivered=true`
- `delivery_proof_uri` 更新
- 产生 `DeliveryMarked` 事件
- 买家收到查看和释放提示

### 验收标准

- 非卖家地址调用时链上失败。
- 交付证明可以从买家页面打开。
- 不能重复标记交付。

---

## 8.6 买家释放资金

### 功能目的

买家确认交付后，合约自动将资金分配给卖家和平台。

### 前置条件

- 当前钱包是 `buyer`。
- 托管已经注资。
- `delivered=true`。
- 未释放、未退款。

### 计算规则

```text
feeAmount = amount * feeBps / 10000
sellerAmount = amount - feeAmount
```

### 成功结果

- `released=true`
- `funds=0`
- 卖家收到 `sellerAmount`
- 平台费地址收到 `feeAmount`
- 产生 `EscrowReleased` 事件
- 后端 Paylink 状态变为 `released`

### 页面确认弹窗

买家签名前必须看到：

- 交付证明链接。
- 将释放的总金额。
- 卖家实际收到金额。
- 平台手续费。
- 释放不可撤销提示。

### 验收标准

- 未标记交付时不能释放。
- 非买家地址不能释放。
- 已释放后不能再次释放或退款。
- 买家没有 SUI 时可由 Sponsor 完成 Gas 支付。

### 当前实现状态

真实 Move 合约要求先交付再释放；Mock API 和页面按钮已按该规则对齐。

---

## 8.7 买家退款

### 功能目的

在 P0 没有仲裁机制的情况下，让买家主动取回尚未释放的托管资金。

### 当前合约规则

- 只有买家可以退款。
- 已注资、未释放、未退款时可以退款。
- 当前合约允许在卖家标记交付后退款。

### 产品风险

当前规则偏向买家。卖家提交交付后，买家仍可直接退款，因此不能把产品描述为“公平仲裁托管”。P0 页面必须明确：

> 本原型没有仲裁，买家在释放前拥有退款控制权。

### P1 建议

- 增加交付后的争议窗口。
- 交付后退款需要卖家同意或进入争议状态。
- 明确超时自动释放或自动退款规则。

### 当前实现状态

Mock API 已限制退款只能发生在 `escrow` 模式下，且状态必须是 `funded`
或 `delivered`。真实 Testnet 退款路径已通过 `testnet-refund-smoke.json`
记录。

### 验收标准

- Testnet 单独验证退款成功。
- 退款后 `refunded=true`、`funds=0`。
- 退款后禁止释放。
- 回执显示退款交易 Digest。

---

## 8.8 回执与链上验证页

### 功能目的

为买卖双方和评委提供一页可核验的交易结果。

### 展示字段

| 字段 | 来源 | 说明 |
|---|---|---|
| Paylink ID | 后端 | 平台业务标识 |
| Escrow Object ID | 链上 | 托管对象标识 |
| Package ID | 配置 | 当前合约包 |
| 网络 | 配置 | Testnet/Mainnet |
| 卖家与买家地址 | 链上 | 实际参与地址 |
| 服务说明 | Paylink/链上 | 交易目的 |
| 总金额 | 链上 | 最小单位转换为可读金额 |
| 币种 | Coin Type 配置 | 例如 Testnet USDC |
| 平台费率 | 链上 | bps |
| 卖家金额 | Release 事件 | 实际分配 |
| 平台费 | Release 事件 | 实际分配 |
| 交付证明 | 链上对象 | URI |
| 创建/注资/交付/释放/退款 Digest | 索引器 | 可点击 Explorer |
| 当前状态 | 链上 + 索引器 | 不依赖 Mock 状态 |
| 时间线 | 索引器 | 每个事件的时间 |

### 验收标准

- 每个链上标识都可跳转到 Testnet Explorer。
- 页面刷新后仍能从链上和后端恢复状态。
- 回执金额与链上事件完全一致。
- 不显示 `mock-*` Digest 作为真实交易。

---

## 8.9 卖家 Dashboard

### 功能目的

让卖家管理已创建的支付链接和待处理交易。

### 列表字段

| 字段 | 说明 |
|---|---|
| 服务标题 | 快速识别交易 |
| Paylink ID | 平台标识 |
| 买家 | 名称和缩略地址 |
| 金额/币种 | 交易金额 |
| 状态 | Created/Funded/Delivered/Released/Refunded/Expired |
| 创建时间 | 用于排序 |
| 最近更新时间 | 用于处理待办 |
| Escrow Object ID | 可跳转链上 |
| 操作 | 复制链接、提交交付、查看回执 |

### 筛选

- 全部。
- 待付款。
- 待交付。
- 待买家释放。
- 已完成。
- 已退款。

### 验收标准

- 只展示当前卖家创建的 Paylink。
- 页面状态来自真实后端持久化和链上索引，不使用内存 Map。
- 页面刷新或服务重启后数据不丢失。

---

## 8.10 平台 Sponsor Gas 服务

### 功能目的

让买家不需要持有 SUI，也能完成稳定币托管操作。

### SponsorTransaction 数据字段

| 字段 | 类型 | 必填 | 描述 |
|---|---|---:|---|
| `id` | string | 是 | 平台请求 ID |
| `paylinkId` | string | 否 | 关联业务 Paylink，当前 API 可为空 |
| `action` | enum | 是 | `fund-mock-usdc`、`mark-delivered`、`release`、`refund` |
| `sender` | address | 是 | 发起操作的钱包地址 |
| `sponsor` | address | 是 | 支付 Gas 的平台地址 |
| `packageId` | address | 是 | 白名单合约包 |
| `coinType` | string | 是 | 当前仅允许 `mUSDC` |
| `transactionBytes` | string | 是 | 后端构建的 base64 交易 bytes，提交时必须使用同一份 |
| `status` | enum | 是 | `built`、`submitted`、`executed`、`failed`、`expired` |
| `escrowObjectId` | address | 否 | 释放、退款、交付时关联的 Escrow |
| `digest` | string | 否 | 最终交易 Digest |
| `error` | string | 否 | 拒绝或执行失败原因 |
| `createdAt` | datetime | 是 | 创建时间 |
| `expiresAt` | datetime | 是 | 交易签名过期时间 |
| `submittedAt` | datetime | 否 | 用户签名提交时间 |
| `executedAt` | datetime | 否 | 链上执行完成时间 |

### 风控规则

- 单 Paylink 每个操作最多成功 Sponsor 一次。
- 用户、IP、设备和 Paylink 维度限速。
- 单笔和每日总 Gas 上限。
- 只允许固定 Package、Module、Function。
- 解析交易内容并与 Paylink 快照比对，不能只信任前端。
- Sponsor 私钥不得进入前端或源码。
- 记录每笔 Gas 成本，计算 Gas 成本占平台费收入比例。

---

## 9. 字段字典

## 9.1 后端 Paylink

当前实现字段与 P0 推荐新增字段如下。

| 字段 | 类型 | 当前已有 | 必填 | 描述 |
|---|---|---:|---:|---|
| `id` | string | 是 | 是 | 平台内部 Paylink ID |
| `mode` | `direct/escrow` | 是 | 是 | 支付模式；P0 固定 escrow |
| `status` | PaylinkStatus | 是 | 是 | 后端业务状态 |
| `sellerName` | string | 是 | 是 | 卖家展示名称，不作为链上权限依据 |
| `sellerAddress` | address | 是 | 是 | 卖家链上地址 |
| `buyerName` | string | 是 | 否 | 买家展示名称 |
| `buyerAddress` | address | 是 | P0 是 | 买家链上地址 |
| `title` | string | 否 | 是 | 服务标题，建议新增 |
| `memo` | string | 是 | 是 | 服务说明，当前会写入 Escrow |
| `deliverable` | string | 否 | 是 | 交付标准，建议新增 |
| `amount` | decimal string | 是 | 是 | 用户可读金额，例如 `100.00` |
| `amountBaseUnits` | string | 否 | 是 | 链上最小单位金额，建议新增 |
| `token` | string | 是 | 是 | 币种符号 |
| `coinType` | string | 否 | 是 | 完整 Sui Coin Type，建议快照保存 |
| `tokenDecimals` | integer | 否 | 是 | 币种精度，建议快照保存 |
| `feeBps` | integer | 是 | 是 | 平台费率 |
| `feeReceiver` | address | 否 | 是 | 手续费接收地址，建议快照保存 |
| `publicUrl` | URL | 是 | 是 | 对外支付链接 |
| `deliveryProofUri` | URL | 是 | 否 | 交付证明 |
| `deliveryNotes` | string | 否 | 否 | 交付说明，建议新增 |
| `packageId` | address | 否 | 是 | 使用的合约版本 |
| `escrowObjectId` | address | 是 | 注资后 | 链上 Escrow 对象 |
| `invoiceObjectId` | address | 否 | 否 | Direct/Invoice 对象 |
| `fundTransactionDigest` | string | 否 | 注资后 | 注资交易 |
| `deliverTransactionDigest` | string | 否 | 交付后 | 交付交易 |
| `releaseTransactionDigest` | string | 否 | 释放后 | 释放交易 |
| `refundTransactionDigest` | string | 否 | 退款后 | 退款交易 |
| `transactionDigest` | string | 是 | 否 | 当前仅保存最后一次 Mock Digest；P0 应拆分 |
| `receiptObjectId` | address | 是 | 否 | 当前 Mock 字段；真实链上尚无 Receipt 对象 |
| `expiresAt` | datetime | 否 | P1 | 到期时间 |
| `fundedAt` | datetime | 否 | 注资后 | 索引事件时间 |
| `deliveredAt` | datetime | 否 | 交付后 | 索引事件时间 |
| `releasedAt` | datetime | 否 | 释放后 | 索引事件时间 |
| `refundedAt` | datetime | 否 | 退款后 | 索引事件时间 |
| `createdAt` | datetime | 是 | 是 | 创建时间 |
| `updatedAt` | datetime | 是 | 是 | 最近更新时间 |

## 9.2 SupportedToken

| 字段 | 类型 | 当前已有 | 描述 |
|---|---|---:|---|
| `symbol` | string | 是 | 例如 USDC |
| `displayName` | string | 是 | 页面展示名称 |
| `coinType` | string | 是 | 完整 Coin Type；当前配置为可用 `mUSDC` 测试币，不是真实 USDC |
| `decimals` | integer | 是 | 最小单位精度 |
| `gaslessEligible` | boolean | 是 | 是否支持目标免 Gas 路径；必须经实际验证 |
| `testnetOnly` | boolean | 是 | 是否仅测试网络使用 |
| `network` | enum | 否 | 建议新增，防止跨网络误用 |
| `enabled` | boolean | 否 | 建议新增，运营开关 |
| `minAmount` | string | 否 | 建议新增，最小支付额 |
| `maxAmount` | string | 否 | 建议新增，最大支付额 |
| `explorerUrl` | URL | 否 | 建议新增，便于核验 Coin Type |

## 9.3 ReceiptSummary

| 字段 | 类型 | 当前已有 | 描述 |
|---|---|---:|---|
| `paylink` | Paylink | 是 | Paylink 快照 |
| `platformFee` | decimal string | 是 | 页面展示平台费 |
| `sellerAmount` | decimal string | 是 | 页面展示卖方所得 |
| `timeline` | array | 是 | 状态时间线 |
| `chainState` | object | 否 | 建议新增，链上对象当前状态 |
| `events` | array | 否 | 建议新增，真实事件与 Digest |
| `verifiedAt` | datetime | 否 | 建议新增，最近核验时间 |

注意：当前 Mock API 使用 JavaScript `Number` 计算金额，生产代码必须使用整数最小单位或精确十进制库，避免浮点误差。

## 9.4 链上 Invoice

| 字段 | Move 类型 | 描述 | 当前使用情况 |
|---|---|---|---|
| `id` | `UID` | Invoice 对象 ID | 合约已有，前端/API 未使用 |
| `seller` | `address` | 卖家地址 | 已实现 |
| `buyer` | `address` | 买家地址 | 已实现 |
| `memo` | `String` | 交易说明 | 已实现 |
| `amount` | `u64` | 最小单位金额 | 已实现 |
| `currency_type` | `String` | 币种类型说明 | 已实现 |
| `created_ms` | `u64` | 创建时间 | 已实现 |

## 9.5 链上 Escrow

| 字段 | Move 类型 | 描述 | 业务规则 |
|---|---|---|---|
| `id` | `UID` | 独立托管对象 ID | 创建后共享 |
| `seller` | `address` | 收款卖家 | 创建后不可变 |
| `buyer` | `address` | 注资买家 | 来自交易发送者 |
| `memo` | `String` | 服务说明 | 创建后不可变 |
| `amount` | `u64` | 原始注资金额 | 必须大于 0 |
| `fee_bps` | `u64` | 平台费率 | 最大 1000 bps |
| `fee_receiver` | `address` | 平台费接收地址 | 创建后不可变 |
| `delivery_proof_uri` | `String` | 交付证明 URI | 卖家标记交付时写入 |
| `funded` | `bool` | 是否已注资 | 当前创建时即为 true |
| `delivered` | `bool` | 是否已交付 | 只能从 false 变 true |
| `released` | `bool` | 是否已释放 | 与 refunded 互斥 |
| `refunded` | `bool` | 是否已退款 | 与 released 互斥 |
| `funds` | `Balance<T>` | 托管余额 | 释放或退款后为 0 |

## 9.6 链上事件

| 事件 | 关键字段 | 触发时机 | P0 用途 |
|---|---|---|---|
| `InvoiceCreated` | `invoice_id`, `seller`, `buyer`, `amount` | 创建 Invoice | P1 Direct Paylink |
| `EscrowCreated` | `escrow_id`, `seller`, `buyer`, `amount` | 创建托管 | 关联 Paylink 与对象 |
| `EscrowFunded` | `escrow_id`, `buyer`, `amount` | 注资托管 | 更新状态为 funded |
| `DeliveryMarked` | `escrow_id`, `seller` | 卖家标记交付 | 更新状态为 delivered |
| `EscrowReleased` | `escrow_id`, `seller`, `amount_to_seller`, `fee_amount` | 买家释放 | 生成最终回执 |
| `EscrowRefunded` | `escrow_id`, `buyer`, `amount` | 买家退款 | 更新状态为 refunded |

### 事件缺口

当前事件没有 `paylinkId`、时间戳、Coin Type 字符串和证明 URI。P0 可以通过对象 ID 与后端记录关联；P1 再评估是否需要合约升级。

## 9.7 Move 错误码

| 错误码 | 常量 | 用户提示 |
|---:|---|---|
| 1 | `E_NOT_BUYER` | 当前钱包不是该托管的买家 |
| 2 | `E_NOT_SELLER` | 当前钱包不是该托管的卖家 |
| 3 | `E_NOT_FUNDED` | 托管尚未注资 |
| 4 | `E_ALREADY_RELEASED` | 资金已经释放 |
| 5 | `E_ALREADY_REFUNDED` | 资金已经退款 |
| 6 | `E_INVALID_FEE_BPS` | 手续费率超过合约上限 |
| 7 | `E_ZERO_AMOUNT` | 付款金额必须大于 0 |
| 8 | `E_NOT_DELIVERED` | 卖家尚未标记交付 |
| 9 | `E_ALREADY_DELIVERED` | 该托管已经标记交付 |

前端不得直接向普通用户展示 Move 常量名，应映射为可执行的中文提示。

## 9.8 AppConfig

| 字段 | 类型 | 当前已有 | 描述 |
|---|---|---:|---|
| `network` | enum | 是 | 当前运行网络 |
| `publicBaseUrl` | URL | 是 | 生成公开 Paylink 的基础地址 |
| `supportedTokens` | SupportedToken[] | 是 | 支持币种配置 |
| `sponsorMode` | enum | 是 | `mock`、`self-sponsored` 或 `provider` |
| `packageId` | address | 是 | 当前 Testnet 合约 Package |
| `feeReceiverAddress` | address | 是 | 平台手续费接收地址 |
| `defaultFeeBps` | integer | 否 | P0 建议新增，默认费率 |
| `maxFeeBps` | integer | 否 | P0 建议新增，产品费率上限 |
| `sponsorAddress` | address | 否 | 配置 sponsor 私钥后由服务端派生 |
| `sponsorEnabled` | boolean | 是 | Sponsor 总开关，无私钥时为 `false` |
| `sponsoredActions` | string[] | 是 | 当前允许 sponsor 的 action 列表 |

## 9.9 当前 MutatePaylinkInput

| 字段 | 类型 | 当前已有 | 描述与问题 |
|---|---|---:|---|
| `actor` | `seller/buyer/platform` | 是 | 当前仅作为请求字段传入，服务端没有据此鉴权 |
| `deliveryProofUri` | URL | 是 | 交付证明 URI |
| `notes` | string | 是 | 最多 500 字符，但当前服务端未使用 |

P0 不应继续依赖客户端提交的 `actor` 字符串判断权限。权限必须来自钱包签名
地址和链上对象中的 `seller`、`buyer`。

---

## 10. API 需求

## 10.1 当前 API

| Method | Path | 当前作用 | 当前真实性 |
|---|---|---|---|
| GET | `/health` | 健康检查 | 真实 |
| GET | `/api/config` | 网络、币种和 Sponsor 配置 | 配置中币种为 Mock |
| POST | `/api/paylinks` | 创建 Paylink | 仅写入内存 |
| GET | `/api/paylinks` | 获取 Paylink 列表 | 仅内存数据 |
| GET | `/api/paylinks/:id` | 获取单个 Paylink | 仅内存数据 |
| GET | `/api/paylinks/:id/receipt` | 生成回执摘要 | 仅 Mock 状态 |
| POST | `/api/paylinks/:id/fund` | 模拟注资 | 生成 Mock Digest |
| POST | `/api/paylinks/:id/deliver` | 模拟交付 | 生成 Mock Digest |
| POST | `/api/paylinks/:id/release` | 模拟释放 | 生成 Mock Digest |
| POST | `/api/paylinks/:id/refund` | 模拟退款 | 生成 Mock Digest |
| POST | `/api/sponsored-transactions/build` | 构建白名单 sponsored transaction | 已通过 Testnet smoke 验证；无 sponsor 私钥时返回 503 |
| GET | `/api/sponsored-transactions/:id` | 查询内存中的 sponsored transaction | 仅内存数据 |
| POST | `/api/sponsored-transactions/:id/submit` | 接收用户签名并提交 sponsor 签名 | 已通过 Testnet smoke 验证；尚未持久化 |

## 10.2 P0 推荐 API

| Method | Path | 用途 |
|---|---|---|
| POST | `/api/paylinks` | 创建并持久化 Paylink |
| GET | `/api/paylinks/:id` | 获取公开 Paylink 与链上状态 |
| GET | `/api/sellers/me/paylinks` | 获取当前卖家列表 |
| POST | `/api/paylinks/:id/transactions/fund` | 构建注资交易 |
| POST | `/api/paylinks/:id/transactions/deliver` | 构建交付交易 |
| POST | `/api/paylinks/:id/transactions/release` | 构建释放交易 |
| POST | `/api/paylinks/:id/transactions/refund` | 构建退款交易 |
| POST | `/api/sponsored-transactions/:id/submit` | 接收用户签名并执行 Sponsor |
| GET | `/api/transactions/:digest` | 查询交易状态 |
| GET | `/api/paylinks/:id/receipt` | 获取链上核验回执 |

### 通用错误响应

```json
{
  "error": {
    "code": "PAYLINK_NOT_FOUND",
    "message": "支付链接不存在",
    "retryable": false,
    "details": {}
  }
}
```

### 关键错误码

| code | HTTP | 含义 |
|---|---:|---|
| `VALIDATION_FAILED` | 400 | 字段校验失败 |
| `PAYLINK_NOT_FOUND` | 404 | Paylink 不存在 |
| `WRONG_NETWORK` | 409 | 钱包网络错误 |
| `WRONG_BUYER` | 403 | 当前钱包不是指定买家 |
| `WRONG_SELLER` | 403 | 当前钱包不是卖家 |
| `INVALID_STATE` | 409 | 当前状态不允许操作 |
| `INSUFFICIENT_TOKEN_BALANCE` | 409 | 稳定币余额不足 |
| `SPONSOR_REJECTED` | 403 | Sponsor 风控拒绝 |
| `SPONSOR_BUDGET_EXCEEDED` | 429 | Sponsor Gas 预算耗尽 |
| `CHAIN_TRANSACTION_FAILED` | 502 | 链上交易失败 |
| `CHAIN_STATE_MISMATCH` | 409 | 后端状态与链上状态不一致 |

---

## 11. 数据与架构要求

### 11.1 数据源优先级

| 数据 | 权威来源 |
|---|---|
| 卖家、买家、金额、手续费、状态、余额 | Sui Escrow 对象 |
| 释放金额与平台费 | `EscrowReleased` 事件 |
| 退款金额 | `EscrowRefunded` 事件 |
| 服务标题、展示名称、通知信息 | 后端数据库 |
| Sponsor 请求、Gas 成本、拒绝原因 | Sponsor 服务数据库 |

链上数据与后端冲突时，资金相关状态必须以链上为准，并记录告警。

### 11.2 持久化

P0 不得继续使用内存 `Map` 作为唯一存储。最低要求：

- SQLite 或托管 Postgres。
- Paylink、Sponsor 请求、事件和回执表。
- 服务重启后数据可恢复。
- 通过 Escrow Object ID 唯一关联链上对象。

### 11.3 事件索引

- 监听当前 Package ID 发出的 Escrow 事件。
- 使用 Digest + Event Sequence 作为幂等键。
- 更新后端状态时必须幂等。
- 索引器中断后能够从上次 Checkpoint 恢复。
- 定期对账链上对象与数据库状态。

---

## 12. 非功能需求

### 12.1 安全

- Sponsor 钱包私钥只存在于服务端安全环境。
- 所有 Sponsor 交易必须解析并校验内容。
- 所有资产操作必须由对应用户签名。
- 前端展示完整币种、金额和目标地址确认。
- 合约必须补充单元测试并在真实资金前审计。
- P0 只使用小额 Testnet 资产。

### 12.2 性能

- Paylink 页面首屏在正常网络下 2 秒内可交互。
- API 普通查询 P95 小于 500ms，不含链 RPC。
- 交易提交后 1 秒内进入处理中状态。
- 链上确认后 10 秒内更新页面状态。

### 12.3 可观测性

必须记录：

- Paylink 创建、打开和转化。
- 每次交易构建、签名、Sponsor、提交和确认。
- 每次 Sponsor 拒绝原因。
- Gas 预算与实际消耗。
- 链上事件索引延迟。
- 数据库与链上状态不一致。

### 12.4 合规与风险提示

公开 Demo 必须说明：

- 这是黑客松原型，不是持牌支付机构。
- 不提供法币服务。
- 不提供法律仲裁。
- 未审计前只使用测试资产或小额资金。
- P0 退款规则偏向买家。

---

## 13. 指标

### 13.1 产品指标

| 指标 | 定义 |
|---|---|
| Paylink 创建数 | 成功创建的 Paylink 数 |
| 支付链接打开率 | 唯一打开人数 / 已分享链接数 |
| 注资转化率 | Funded Paylink / Created Paylink |
| 交付率 | Delivered Paylink / Funded Paylink |
| 释放率 | Released Paylink / Funded Paylink |
| 退款率 | Refunded Paylink / Funded Paylink |
| 平均注资时间 | 创建到注资的时间 |
| 平均结算时间 | 注资到释放的时间 |

### 13.2 商业指标

- 总稳定币交易额。
- 平台费收入。
- Sponsor Gas 成本。
- Sponsor Gas 成本 / 平台费收入。
- 重复卖家数量。
- 付费定制部署数量。

---

## 14. P0 验收测试

### 14.1 必须通过的主流程

1. 卖家钱包 A 连接 Testnet。
2. 卖家创建 `100` 单位选定 Testnet 稳定币或测试币的托管支付链接，当前可演示 `mUSDC`。
3. 买家钱包 B 打开公开链接，钱包 B 没有 SUI。
4. 买家 B 签名，Sponsor 支付 Gas，托管注资成功。
5. 页面显示真实 Escrow Object ID 与注资 Digest。
6. 卖家 A 提交交付证明。
7. 买家 B 查看证明并确认释放。
8. Sponsor 支付释放操作 Gas。
9. 卖家收到 `99 mUSDC`，平台收到 `1 mUSDC`。
10. 回执页显示真实事件、金额、对象和所有 Digest。

### 14.2 必须通过的异常测试

- 非指定买家尝试注资。
- 非卖家尝试标记交付。
- 未交付时尝试释放。
- 同一托管重复交付。
- 同一托管重复释放。
- 已释放后尝试退款。
- Sponsor 请求篡改卖家、金额、币种或手续费。
- Sponsor Gas 预算耗尽。
- 链上交易失败后页面重试。
- 后端重启后恢复 Paylink 和链上状态。

### 14.3 合约测试最低覆盖

当前状态：已完成。`npm run chain:test` 当前结果为 `Total tests: 13; passed: 13; failed: 0`。

- 零金额拒绝。
- 手续费超过上限拒绝。
- 非卖家交付拒绝。
- 非买家释放拒绝。
- 未交付释放拒绝。
- 重复交付拒绝。
- 重复释放拒绝。
- 退款后释放拒绝。
- 释放后退款拒绝。
- 费用和卖家金额计算正确。

---

## 15. 参赛演示脚本

### 15.1 两分钟演示

1. 展示问题：稳定币直接转账没有服务托管，合约调用又要求用户持有 SUI。
2. 卖家 A 创建 `100 mUSDC` 服务托管链接。
3. 打开买家 B 钱包，证明其没有 SUI。
4. 买家 B 点击注资，Sponsor Gas，交易成功。
5. 打开 Explorer 展示 Escrow 对象和资金。
6. 卖家 A 标记交付并提交证明。
7. 买家 B 释放。
8. 打开 Explorer 展示 `99 mUSDC + 1 mUSDC` 分配事件。
9. 展示回执页。

### 15.2 评委必须看懂的三个点

- 这不是普通转账：资金进入服务托管状态机。
- 这不是 Mock：每个关键状态都有真实 Testnet 对象和交易。
- 这不是要求用户先买 SUI：Sponsor 为买家的合约操作支付 Gas。

---

## 16. 开发优先级

### 第一优先级：补齐产品核心承诺

1. 将已验证的 Sponsored Transaction 接入真实 Paylink 页面。
2. 将真实 Paylink 页面与链上 Escrow 关联。
3. 建立事件索引与链上回执。
4. 后续替换或补充真实 Testnet 稳定币 Coin Type。

### 第二优先级：让演示可信

1. 建立持久化数据库。
2. 实现事件索引与链上回执。
3. 增加独立公开 `/pay/:id` 页面。
4. 将 Mock Paylink 状态与真实链上 Escrow 对象关联。
5. 补齐真实交易失败后的重试和状态恢复。

### 第三优先级：提高参赛表达

1. 优化卖家 Dashboard 和买家支付页。
2. 制作完整两分钟演示视频。
3. 增加架构图、Gas 代付风控说明和商业验证计划。

---

## 17. Kill Criteria

出现以下任一情况，应否决当前方向或缩小为纯托管基础设施演示：

- 无法让“只有稳定币、没有 SUI”的买家完成托管交易。
- 评委或目标用户不接受 `mUSDC` 作为 Testnet 测试币，且找不到真实稳定币替代路径。
- Sponsor Gas 无法在可控风险和成本下运行。
- 目标用户普遍认为直接钱包转账已经足够，不愿使用托管。
- 产品最终没有真实服务交付流程，只剩普通支付链接。
- 参赛前无法把真实 Paylink 页面与链上 Escrow 对象关联。

---

## 18. 当前结论

SuiPayLink 已经证明 Move 托管合约可以在 Sui Testnet 上完成创建、注资、交付、释放、退款、双地址权限校验，以及非 SUI 测试币 `mUSDC` 托管，技术底座成立。

但当前只能准确描述为：

> 已在 Sui Testnet 验证的服务托管合约、MockUSDC 测试币闭环与演示前端。

在完成 Sponsored Gas、真实 Paylink 与链上对象关联、事件索引，以及真实稳定币替换或明确测试币边界之前，不能准确描述为：

> 买家无需持有 SUI 的稳定币托管支付产品。
