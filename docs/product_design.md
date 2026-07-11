# Trading Discipline Copilot 产品设计文档

> 版本：v0.2  
> 来源：基于 `trading_price_action_mindmap.md` 中的价格行为导图、交易纪律规则、止损/止盈/runner 管理规则整理。  
> 产品目标：把价格行为学习内容转成一个交易前检查、交易中提醒、交易后复盘的实用网页工具。

---

## 1. 产品定位

这个应用不是自动交易机器人，也不是行情预测软件。

Stage 14 明确产品边界：这个应用用于真实交易中的纪律支持，而不是练习模式或学习模式。系统只有一个 live discipline workflow，不提供 Practice Mode / Learning Mode，也不会因为“练习”而放松 blocker 规则。

它的定位是：

```text
Trading Discipline Copilot
= 交易纪律检查器 + 持仓提醒器 + 复盘记录器
```

核心目标是帮助交易者在三个阶段减少纪律错误：

1. **下单前**：强制核对交易理由、市场环境、止损、目标位、风险收益比，避免 FOMO、追无 FT 突破、TR 极端位置追单、止损后情绪反手。
2. **下单后**：提醒设置止损、部分止盈、保护 runner、移动止损，避免 green trade go red。
3. **平仓后**：快速复盘，区分“好交易亏损”和“坏交易盈利”，持续训练纪律。

一句话产品原则：

> 这个工具不是为了告诉我一定做多还是做空，而是为了在我下单前问清楚理由，在持仓中保护利润，在平仓后诚实复盘。

Live workflow:

```text
Plan → Execute → Manage → Review
```

- `Daily Readiness`: 开始新的 intraday 交易前，先完成当天准备检查。
- `Plan`: 填写真实交易计划，系统检查 blocker / warning / reminder。
- `Execute`: 用户自己在券商或交易平台执行；本应用不下单。
- `Manage`: 记录价格、止损、部分止盈、runner，系统提示需要处理的纪律动作。
- `Review`: 平仓后复盘执行质量，而不是只看盈亏。

---

## 2. 非目标 / 暂不做内容

MVP 阶段明确不做：

- 不自动下单。
- 不自动平仓。
- 不预测行情。
- 不自动识别所有趋势、TR、Wedge、FT。
- 不做复杂 AI 行情分析。
- 不接真实券商账户进行修改订单。
- 不提供 Practice Mode。
- 不提供 Learning Mode。
- 不因为练习或模拟场景软化 blocker 规则。

第一版优先验证：

- checklist 是否真的能减少冲动交易；
- rule alerts 是否能提醒容易遗漏的问题；
- 持仓管理是否能减少 green-to-red；
- 复盘评分是否能帮助形成纪律闭环。

---

## 3. 核心用户流程

每一笔交易都作为一个 `Trade Session` 管理。

```text
New Trade Checklist
        ↓
Open Trade Management
        ↓
Close & Review Trade
        ↓
Daily Discipline Summary
```

### 3.1 状态流转

```text
planned  →  open  →  closed
   ↓         ↓
cancelled  cancelled
```

- `planned`：完成交易前检查，但还没实际入场。
- `open`：已经开仓，需要持仓管理。
- `closed`：已经平仓，需要复盘。
- `cancelled`：交易计划被放弃，仍可记录原因。

---

## 4. 页面设计

### 4.1 Dashboard 首页

目标：让用户快速知道今天的交易纪律状态。

显示内容：

- 今日 intraday readiness 状态：Not cleared / Partially ready / Cleared。
- 今日 intraday readiness 必填项完成进度。
- 今日交易次数。
- 今日净 R 倍数。
- 今日纪律评分平均值。
- 当前是否有 open trade。
- 今日违规次数。
- green-to-red 次数。
- 止损后反手次数。
- 最近一条高优先级提醒。

核心按钮：

- `Start New Trade Checklist`
- `Manage Open Trades`
- `Close & Review Trade`
- `Daily Review`
- `Rules Library`

Daily Readiness intentionally remains at the bottom of the Dashboard. The
Dashboard should feel like an operational cockpit: state, blockers, and next
actions matter more than motivational hero copy, while the readiness editor
stays in its stable lower position.

Dashboard 卡片建议：

```text
Today R: +1.25R
Discipline Score: 84 / 100
Open Trades: 1
Warnings Today: 3
Worst Mistake: Chased breakout without FT
```

#### 4.1.1 Today's Intraday Readiness

目标：在开始新的 intraday 交易计划前，确认今天是否已经完成必要准备。

必填项：

- `watchlist_selected`: Select today's watchlist before the open.
- `market_environment_assessed`: Assess today's market environment.
- `important_events_checked`: Check important events and scheduled risks.
- `swing_positions_reviewed`: Review existing swing positions.
- `daily_risk_limits_set`: Define today's risk limits.

可选项：

- `platform_ready`: Confirm platform, data, and broker access are working.
- `mental_state_checked`: Check mental and physical state.
- `no_forced_trade_confirmed`: Confirm there is no need to force a trade today.

状态计算：

- `not_cleared`: 没有完成任何必填项。
- `partially_ready`: 完成了部分必填项。
- `cleared`: 所有必填项完成，可以开始计划 intraday trades。

这个状态不是交易信号。它只表示当天准备流程是否完成。Stage 15 中重要事件检查、市场环境判断、watchlist 和风险限制都由用户手动输入，不接入自动日历或自动分类。

---

### 4.2 New Trade Checklist 交易前检查页

目标：在点击“允许交易”之前，强制完成必要判断。

页面布局：

```text
左侧：交易计划输入
右侧：规则提醒 / checklist / blocker
底部：Allowed / Warning / Blocked 状态
```

#### 必填字段

```yaml
symbol: string
trade_horizon: intraday | swing | leap | other
market: futures | stocks | crypto | forex | options | other
direction: long | short
setup:
  - breakout
  - pullback
  - failed_breakout
  - reversal
  - h1_h2_l1_l2
  - wedge
  - double_top_bottom
  - inside_bar_triangle
  - opening_range
  - gap_open
  - other
market_context:
  - strong_trend
  - weak_trend
  - broad_channel
  - narrow_channel
  - trading_range
  - breakout_mode
  - opening_range
  - gap_open
  - uncertain
planned_entry: number
stop_loss: number
target_1: number
target_2: number | null
runner_enabled: boolean
position_size: number | null
notes: string
```

#### Trade Horizon 规则

创建交易计划时必须先分类：

- `intraday`
- `swing`
- `leap`
- `other`

`intraday` trades require today's Daily Readiness checklist to be cleared before
a new plan can be created. `swing` and `other` trades are not blocked by Daily
Readiness, because that checklist is specifically an intraday preparation gate.

Stage 18 makes `trade_horizon` a reusable filter dimension across operational
screens. Open Trades, Post-Trade Review, Daily Summary, and the Dashboard daily
summary can narrow their data to all trades, intraday, swing, leap, or other trades.
Open Trade management also supports direct inline edits for active target and
position-size metrics, and recorded partial exits are shown on the price map.

This keeps one real live workflow rather than adding Practice Mode or Learning
Mode. The app remains a discipline support tool; it does not place broker
orders, auto-execute trades, or predict market direction.

#### 自动计算辅助：Risk / Reward 与 R 倍数

为了减少低级计算错误，前端应在用户输入 `planned_entry`、`stop_loss`、`target_1` 后实时计算并显示风险收益比。

这不是自动交易，也不是行情判断，而是交易前风控校验。

Stage 16 起，交易计划中的价格和数量输入默认使用两位小数显示和保存，避免 `1.999999999` 或 `0.30000000004` 这类浮点显示噪音。

```text
Long:
risk = planned_entry - stop_loss
target_r = (target_1 - planned_entry) / risk

Short:
risk = stop_loss - planned_entry
target_r = (planned_entry - target_1) / risk
```

页面提醒规则：

- `risk <= 0`：方向、入场价或止损价不合理，显示 Blocked。
- `target_r < 1`：风险收益比偏低，显示 Warning。
- `target_r >= 1`：允许继续，但仍需完成其他 checklist。
- `target_r >= 2`：可以标记为较健康的初始盈亏比，但不代表必然交易。

UI 提示示例：

```text
Planned R/R: 1.8R
Risk per unit: 10 points
Target 1 distance: 18 points
```

#### Options 输入规则

如果 `market = options`：

- `symbol` 表示 underlying ticker，例如 `AAPL`, `TSLA`, `SPY`, `QQQ`, `NVDA`。
- `option_contract` 记录具体合约，例如 `AAPL 2026-01-16 200C`。
- 缺少 `option_contract` 是 warning，不是 blocker；用户必须确认后才能继续创建计划。
- Stage 16 不获取实时 option premium，不做 option chain，不计算 Greeks。
- Symbol price lookup 对 options 只显示 underlying price，不能当作 option premium。
- Option premium 由用户手动记录；系统不会获取或虚构 premium。期权 Gross P&L 使用 premium 差额、合约数量和标准 100 multiplier，并排除手续费。

如果 `market != options`，`option_contract` 不需要填写。

#### 交易前必须回答的问题

1. 当前市场环境是什么？
2. setup 是否和市场环境匹配？
3. 是否有清楚的入场理由？
4. 是否已经设置结构性止损？
5. 止损是否可接受？
6. 是否有第一目标位？
7. 是否准备保留 runner？runner 如何保护？
8. 是否刚被止损后想反手？
9. 是否在 TR 上沿追多 / TR 下沿追空？
10. 如果是突破，是否有好的 follow-through？

#### 页面状态

```yaml
Allowed:
  meaning: 核心项完成，可以交易
Warning:
  meaning: 可以继续，但存在明显风险，必须显式确认 warning 后才能创建计划
Blocked:
  meaning: 禁止继续，必须修正问题
Reminder:
  meaning: 不阻止计划或持仓管理，但提示需要注意的纪律动作
```

行为定义：

- Blocker: 真实交易纪律硬限制。触发后不能创建 trade plan，必须先修正。
- Warning: 允许继续，但必须由用户勾选 “I have reviewed and accepted these warnings.” 后才能创建 trade plan。
- Reminder: 提醒用户处理风险管理动作，不等同于交易建议。

典型 Blocker：

- 没有止损。
- 没有入场理由。
- 风险超过上限。
- 刚止损后立刻反手，且没有新结构信号。

典型 Warning：

- Breakout 但没有确认 FT。
- TR 上沿追多或 TR 下沿追空。
- 大阳线/大阴线出现在区间极端位置。
- 昨日高低点两次突破失败后仍追突破。

---

### 4.3 Open Trade Management 持仓管理页

目标：开仓后防止遗漏止损、止盈、runner 保护。

显示字段：

```yaml
actual_entry: number
current_stop: number
position_size: number
target_1: number
target_2: number | null
current_price: number | null
current_r: number | null
mfe_r: number | null
mae_r: number | null
partial_taken: boolean
runner_active: boolean
runner_stop: number | null
```

主要按钮：

- `Mark Entry Filled`
- `Partial Profit Taken`
- `Move Stop by Structure`
- `Runner Active`
- `Exit Trade`
- `Add Note`

交易中提醒：

```text
这笔交易已经达到 1R。是否先兑现一部分利润，并让 runner 继续跑？
```

```text
这笔交易曾经明显盈利，但现在接近回到入场价。不要让 green trade go red。
```

```text
runner 仍然打开，但没有保护性止损。请设置 runner stop。
```

```text
突破后没有回测突破点并留下缺口，趋势可能很强。可以保留 runner，但必须保护利润。
```

---

### 4.4 Close & Review Trade 平仓复盘页

目标：不只记录盈亏，还记录执行质量。

平仓时记录的只读成交事实：

```yaml
exit_price: number
exit_reason:
  - target_hit
  - stop_hit
  - manual_exit
  - runner_stop
  - invalidated_setup
  - time_exit
  - emotional_exit
  - other
final_r: number  # 后端根据 execution 自动计算
```

复盘输入字段：

```yaml
followed_plan: yes | no | partial
mistake_tags:
  - no_stop
  - chased_no_ft_breakout
  - tr_second_leg_trap
  - tr_big_bar_reversal
  - green_to_red
  - revenge_trade
  - moved_stop_wrong_way
  - no_partial_profit
  - over_sized
  - ignored_context
screenshot_url: string | null
lesson: string
next_time_reminder: string
```

复盘分类：

```text
好交易，盈利
好交易，亏损
坏交易，盈利
坏交易，亏损
```

关键原则：

> 好交易亏损，不惩罚自己；坏交易盈利，不奖励自己。

自动输出：

- 本笔纪律评分。
- 违反规则列表。
- 最主要错误。
- 下次提醒标签。
- 是否加入重点复盘案例。

---

### 4.5 Daily Discipline Summary 每日总结页

显示：

- 今日总交易数。
- 今日净 R。
- 平均纪律评分。
- 好交易数量 / 坏交易数量。
- 盈利交易中好交易比例。
- 亏损交易中是否遵守纪律。
- 高频错误标签。
- 今日最重要 lesson。

示例输出：

```text
今日交易 4 笔，净 +0.8R，平均纪律分 76。
主要问题：2 次在 Breakout 未确认 FT 时追单。
明日重点提醒：突破不是信号，突破后的 FT 才是确认。
```

---

### 4.6 Rules Library 规则库页

目标：把 Markdown 导图中的规则变成卡片和机器可读配置。

每张规则卡：

```yaml
id: breakout_needs_follow_through
name: 突破要有好的跟随
category: 价格结构 / 突破
stage: pre_trade
severity: warning
market_context: breakout, trading_range, key_level
trigger: setup == breakout
checklist:
  - 突破 K 是否足够强？
  - 突破后是否有 FT？
  - 是否快速回到区间内？
action: 等待 FT 或回踩确认
avoid: 无 FT 追突破
risk: 追入假突破
discipline_sentence: 突破不是信号，突破后的 FT 才是确认。
enabled: true
```

---

## 5. 规则引擎设计

规则分三类：

```yaml
Blocker:
  meaning: 违反后不允许继续
  examples:
    - no_stop_loss
    - no_entry_reason
    - revenge_reverse_after_stop
    - risk_too_large

Warning:
  meaning: 可继续，但必须确认风险
  examples:
    - breakout_without_ft
    - tr_extreme_chasing
    - big_bar_in_tr
    - two_failed_breakouts_yesterday_high_low

Reminder:
  meaning: 交易中或复盘中提醒
  examples:
    - reached_1r_take_partial
    - runner_without_stop
    - green_trade_near_red
    - strong_trend_gap_no_retest
```

Stage 19 adds schema validation for YAML rule definitions. Rules are a core
product asset, so invalid YAML should fail fast in tests instead of failing
silently during live trade planning. The authoring contract is documented in
`docs/rule_authoring_guide.md`.

### 5.1 初始核心规则清单

MVP 至少实现这些规则：

1. `every_order_must_have_stop_loss`
2. `no_reverse_trade_immediately_after_stop_loss`
3. `breakout_needs_follow_through`
4. `trading_range_second_leg_trap`
5. `trading_range_big_bar_reversal_risk`
6. `inside_bar_triangle_breakout_setup`
7. `yesterday_high_low_two_failed_breakouts`
8. `breakout_gap_no_retest_strength`
9. `take_profit_and_let_runner_run`
10. `green_trade_should_not_go_red`
11. `runner_must_have_protection`
12. `signal_context_over_shape`

### 5.2 Rule YAML 结构

```yaml
id: string
name: string
category: string
stage: pre_trade | in_trade | post_trade
severity: info | warning | blocker
trigger:
  setup: string | null
  market_context: string | null
  trade_status: planned | open | closed | null
conditions:
  - field: string
    operator: equals | not_equals | missing | greater_than | less_than | includes | greater_than_field | less_than_field | risk_reward_at_least
    value: any
    compare_field: string | null
checklist:
  - string
action: string
avoid: string
risk: string
message: string
discipline_sentence: string
enabled: boolean
```

#### 5.2.1 字段对比条件预留

规则引擎不应只支持“字段与固定值比较”，还应预留“字段与字段比较”。这可以用于校验做多/做空方向下的价格逻辑，例如：

```yaml
- id: long_target_must_be_above_entry
  stage: pre_trade
  severity: blocker
  conditions:
    - field: target_1
      operator: greater_than_field
      compare_field: planned_entry
  message: 做多计划中，Target 1 必须高于入场价。

- id: short_stop_must_be_above_entry
  stage: pre_trade
  severity: blocker
  conditions:
    - field: stop_loss
      operator: greater_than_field
      compare_field: planned_entry
  message: 做空计划中，止损价必须高于入场价。
```

这样后续可以把基础盘面校验、R 倍数校验和方向一致性都放进规则配置，而不是散落在前端或后端代码里。

### 5.3 规则引擎输出

```yaml
RuleEvaluationResult:
  trade_id: string | null
  status: allowed | warning | blocked
  alerts:
    - rule_id: string
      severity: info | warning | blocker
      message: string
      checklist:
        - string
      acknowledged: boolean
```

---

## 6. 数据模型

### 6.1 Trade

```yaml
Trade:
  id: string
  created_at: datetime
  updated_at: datetime
  symbol: string
  market: string
  direction: long | short
  setup: string
  market_context: string
  planned_entry: float
  actual_entry: float | null
  stop_loss: float
  target_1: float
  target_2: float | null
  runner_enabled: boolean
  runner_active: boolean
  position_size: float | null
  risk_per_trade: float | null
  status: planned | open | closed | cancelled
  exit_price: float | null
  exit_reason: string | null
  final_r: float | null
  followed_plan: string | null
  discipline_score: int | null
  notes: string
```

### 6.2 ChecklistAnswer

```yaml
ChecklistAnswer:
  id: string
  trade_id: string
  stage: pre_trade | in_trade | post_trade
  rule_id: string
  question: string
  answer: yes | no | unsure | text
  severity: info | warning | blocker
  created_at: datetime
```

### 6.3 Alert

```yaml
Alert:
  id: string
  trade_id: string | null
  rule_id: string
  stage: pre_trade | in_trade | post_trade
  severity: info | warning | blocker
  message: string
  acknowledged: boolean
  created_at: datetime
```

### 6.4 Review

```yaml
Review:
  id: string
  trade_id: string
  mistake_tags: list[string]
  lesson: string
  next_time_reminder: string
  created_at: datetime
```

---

## 7. API 设计

### 7.1 Trades

```http
GET    /trades
POST   /trades
GET    /trades/{trade_id}
PATCH  /trades/{trade_id}
POST   /trades/{trade_id}/open
POST   /trades/{trade_id}/close
POST   /trades/{trade_id}/cancel
```

### 7.2 Rules

```http
GET  /rules
POST /rules/evaluate
```

### 7.3 Checklist / Alerts

```http
POST  /trades/{trade_id}/checklist-answers
GET   /trades/{trade_id}/alerts
PATCH /alerts/{alert_id}/acknowledge
```

### 7.4 Reviews / Summary

```http
POST /trades/{trade_id}/review
GET  /summary/daily?date=YYYY-MM-DD
```

### 7.5 统一错误响应格式

前端需要稳定地区分 Blocked、Warning、字段校验错误和系统错误，因此后端从 Stage 3 开始就应统一错误响应格式，而不是等到工程硬化阶段再重构。

推荐格式：

```json
{
  "error": {
    "code": "MISSING_STOP_LOSS",
    "message": "Stop loss is required before opening a trade.",
    "details": {
      "field": "stop_loss",
      "severity": "blocker"
    }
  }
}
```

前端 `api.ts` 应把这种错误格式转换成稳定的 UI 状态：

```text
field_error → 表单字段旁提示
rule_blocker → Blocked alert panel
rule_warning → Warning alert panel
server_error → 页面级错误提示
```

---

## 8. 自动化路线图

### Phase 1：纯手动 MVP

- 手动输入交易计划。
- 手动点击 checklist。
- 手动标记入场、部分止盈、移动止损、平仓。
- 自动生成提醒、纪律评分、复盘摘要。

### Phase 2：半自动导入

- 支持导入 CSV 成交记录。
- 自动创建 trade records。
- 手动补充 setup / market_context / mistake tags。

### Phase 3：实时监听但不自动交易

- 接 broker API / webhook / 本地日志。
- 检测新订单是否有止损。
- 检测是否达到 1R。
- 检测 green trade 是否接近变 red。
- 弹窗或声音提醒。

### Phase 4：高级风控联动，暂缓

- 自动移动止损。
- 自动部分止盈。
- 自动拒绝无止损订单。

这些功能风险更高，必须等工具稳定后单独设计。

---

## 9. 纪律评分 v0.2：配置驱动 + Blocker 一票否决

纪律评分不应硬编码在后端业务逻辑中，而应该从配置文件读取。推荐在后续项目中创建：

```text
backend/app/rules/discipline_scoring_rules.yaml
```

这样后续微调扣分、加分、阈值、错误标签时，不需要修改 Python 业务代码，只需要改配置并补充测试。

### 9.1 配置文件草案

```yaml
base_score: 100
min_score: 0
max_score: 100

veto_rules:
  - tag: no_stop_loss
    score: 0
    reason: 无止损下单是风险控制底线错误，直接记为 0 分。
  - tag: revenge_reverse_after_stop_without_new_setup
    score: 0
    reason: 止损后无独立结构信号立刻反手，属于情绪接管交易。

penalties:
  revenge_reverse_after_stop: -30
  green_trade_to_red_without_review: -25
  chased_breakout_without_ft: -20
  tr_extreme_chasing: -20
  no_trade_plan: -20
  oversized_position: -20
  no_post_trade_review: -10

bonuses:
  completed_pre_trade_checklist: 10
  followed_planned_stop: 10
  took_partial_or_protected_runner: 10
  completed_post_trade_review: 10

score_bands:
  - min: 90
    label: 高纪律交易
  - min: 70
    label: 基本合格，有小问题
  - min: 50
    label: 纪律不足，需要复盘
  - min: 0
    label: 高风险情绪交易
```

### 9.2 一票否决机制

线性扣分适合普通错误，但不适合底线错误。对于 `blocker` 级错误，应支持“一票否决”。

原则：

- 普通 Warning 级错误：按配置扣分。
- Reminder 未处理：按配置扣分或标记。
- Blocker 级错误如果仍被用户强行绕过：该笔交易纪律分可以直接记为 0。
- 最典型的一票否决：无止损下单、止损后无新结构立刻情绪反手。

这比简单的 `-40` 更清楚，因为某些错误不是“扣很多分”，而是“不符合交易系统最低标准”。

### 9.3 Scoring Service 行为

`review_service.py` 或独立的 `scoring_service.py` 应该：

1. 加载 `discipline_scoring_rules.yaml`。
2. 先检查 `veto_rules`。
3. 如命中 veto，直接返回对应分数和理由。
4. 如果未命中 veto，再应用 penalties 和 bonuses。
5. 将最终分数 clamp 到 0-100。
6. 返回 score、score_band、triggered_rules、veto_reason。

### 9.4 评分与交易质量分类分离

纪律分不等于盈亏。系统应该同时显示：

```text
Trade Quality: good_trade / bad_trade
PnL Result: win / loss
Discipline Score: 0-100
```

这样可以避免“坏交易盈利”被错误奖励，也避免“好交易亏损”被错误惩罚。

---

## 10. MVP 验收标准

MVP 完成时，用户应该能做到：

1. 新建一笔交易计划。
2. 输入方向、setup、市场环境、入场、止损、目标。
3. 系统根据规则给出 Blocker / Warning / Reminder。
4. 没有止损时无法通过检查。
5. 开仓后能标记部分止盈、runner、移动止损。
6. 平仓后能填写复盘。
7. 系统生成纪律评分和错误标签。
8. Dashboard 能显示今日交易纪律概况。
9. Rules Library 能查看规则卡片。
10. 数据保存在本地 SQLite 中。

---

## 11. 前端状态管理策略

MVP 早期可以用 `App.tsx` 的 tab state，但从持仓管理和复盘开始，不同页面会共享 `plannedTrades`、`openTrades`、`closedTrades`、`alerts` 和 `dailySummary`。

推荐阶段性策略：

```text
Stage 4-5:
- React local state + api.ts
- 保持简单，先跑通页面和 API

Stage 6 起:
- 引入 React Context 或 Zustand
- 用一个轻量 store 管理 trade lifecycle 和 rule alerts
- 避免 planned/open/review 三个页面之间层层传 props
```

优先原则：

- 不为复杂而复杂；
- 一旦出现跨页面共享状态和重复 fetch，就引入轻量状态层；
- 不要把业务状态全部塞进 `App.tsx`。

---

## 12. 学习目标

开发这个应用的同时，应逐步学习：

- React 组件拆分和状态管理。
- TypeScript 类型设计。
- FastAPI 路由、schema、service 分层。
- SQLite 数据建模。
- 规则引擎的基本设计。
- 前后端 API 对接。
- 单元测试和端到端手动测试。
- 如何把一份 Markdown 知识库产品化、工具化。

---

## 13. 工程化开发原则：贴近真实团队流程

这个工具后续开发要尽量模拟真实工程团队流程，而不是让 Codex 一次性生成不可维护的代码。

核心原则：

```text
需求明确 → 技术设计 → 分阶段实现 → 自动化测试 → 代码审查 → 文档更新 → Git 提交 → 复盘学习
```

工程化目标：

- 每个功能都要有清楚的数据模型和 API 边界。
- 每个 Stage 都要可运行、可测试、可提交。
- 后端业务逻辑必须有测试，尤其是 Rule Engine 和纪律评分。
- 前端组件要拆分，不把所有逻辑堆进 App.tsx。
- 文档、代码、测试一起演进。
- 默认不接真实 broker、不自动交易，先做纪律工具和只读记录。

推荐把 `engineering_workflow.md` 作为第三份核心文档，与 `product_design.md` 和 `codex_implementation_plan.md` 一起提供给 Codex。
