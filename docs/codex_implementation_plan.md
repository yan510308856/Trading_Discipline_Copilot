# Codex Implementation Plan：Trading Discipline Copilot

> 目标：让 Codex 按阶段开发一个交易纪律网页应用，同时让用户在每一阶段学习 full-stack 开发过程。  
> 技术栈建议：React + TypeScript + FastAPI + SQLite + SQLAlchemy + Alembic + YAML rules。  
> 开发原则：先做手动 MVP，再考虑 CSV 导入或实时自动化；默认不自动交易。

---

## 0. 给 Codex 的总指令

把 `trading_price_action_mindmap.md` 中的交易纪律规则，开发成一个本地运行的网页应用：**Trading Discipline Copilot**。

核心功能链：

```text
交易前检查 → 持仓管理 → 平仓复盘 → 每日纪律总结
```

开发要求：

1. 使用清晰的前后端分层。
2. 每个阶段都必须可运行、可测试、可提交。
3. 不要一次性生成过大的代码。
4. 每阶段结束输出：
   - changed files
   - how to run
   - tests added
   - what I should learn from this stage
   - suggested commit message
5. 优先做可用 MVP，不做自动下单。

推荐技术栈：

```text
Backend: Python + FastAPI + SQLite + SQLAlchemy + Alembic + Pydantic + PyYAML
Frontend: React + TypeScript + Vite，Stage 6 起根据需要引入 Zustand 或 React Context
Testing: pytest for backend, Vitest or simple component tests for frontend later
Storage: local SQLite
Rules: YAML file loaded by backend
```

---

## 1. 推荐目录结构

```text
trading-discipline-app/
  README.md
  docs/
    product_design.md
    codex_implementation_plan.md
    learning_log.md

  backend/
    app/
      __init__.py
      main.py
      database.py
      models.py
      schemas.py
      services/
        __init__.py
        trade_service.py
        rule_engine.py
        review_service.py
        summary_service.py
      rules/
        price_action_rules.yaml
        discipline_scoring_rules.yaml
    alembic/
      versions/
    tests/
      test_rule_engine.py
      test_trade_api.py
      test_review_service.py
    requirements.txt

  frontend/
    package.json
    index.html
    src/
      main.tsx
      App.tsx
      api.ts
      types.ts
      components/
        Dashboard.tsx
        TradeChecklist.tsx
        RuleAlertPanel.tsx
        OpenTradePanel.tsx
        PostTradeReview.tsx
        DailySummary.tsx
        RulesLibrary.tsx
      pages/
        DashboardPage.tsx
        NewTradePage.tsx
        OpenTradesPage.tsx
        ReviewTradePage.tsx
        RulesPage.tsx
```

MVP 可以先不使用复杂路由，先用 App 中的 tab state 切换页面。

---

## 2. 开发阶段总览

```text
Stage 0  项目初始化和文档落地
Stage 1  后端数据模型和 SQLite 持久化
Stage 2  规则 YAML 和 Rule Engine
Stage 3  后端 API：trades / rules / review / summary
Stage 4  前端初始化和基础布局
Stage 5  交易前检查页面
Stage 6  持仓管理页面
Stage 7  平仓复盘和纪律评分
Stage 8  Dashboard 和 Daily Summary
Stage 9  Rules Library 规则库页面
Stage 10 CSV 导入预留，不接真实交易
Stage 11 打磨、测试、README 和学习总结
```

---

## Stage 0：项目初始化和文档落地

### 目标

创建项目骨架，把产品设计和实现计划放进 `docs/`。

### Codex 任务

1. 创建目录结构。
2. 复制 `product_design.md` 和 `codex_implementation_plan.md` 到 `docs/`。
3. 创建 `README.md`，说明项目目标、如何运行 backend/frontend。
4. 创建 `docs/learning_log.md`，用于每阶段学习记录。

### 预期文件

```text
README.md
docs/product_design.md
docs/codex_implementation_plan.md
docs/learning_log.md
backend/requirements.txt
frontend/package.json
```

### 学习重点

- 什么是项目根目录。
- 为什么要有 `docs/`。
- 为什么先写设计文档再写代码。
- 前后端项目为什么分开。

### 验收标准

- 项目目录清晰。
- README 能解释这个项目是交易纪律工具，不是自动交易机器人。

### 建议 commit

```bash
git add .
git commit -m "stage 0 initialize trading discipline app docs"
```

---

## Stage 1：后端数据模型和 SQLite 持久化

### 目标

先不做复杂 API，建立 trade / alert / review 的核心数据结构。

### Codex 任务

1. 创建 FastAPI backend 基础结构。
2. 使用 SQLite + SQLAlchemy 存储本地数据。
3. 在 Stage 1 就配置 Alembic，用迁移管理表结构，避免后续频繁删除 `.db` 重建。
4. 定义 `Trade`, `Alert`, `Review`, `ChecklistAnswer` 模型。
5. 创建首个 Alembic migration。
6. 实现数据库初始化和测试数据库配置。
7. 写最小测试，确保数据库能创建 trade。

### 建议后端文件

```text
backend/app/main.py
backend/app/database.py
backend/app/models.py
backend/app/schemas.py
backend/app/services/trade_service.py
backend/alembic.ini
backend/alembic/env.py
backend/alembic/versions/<initial_migration>.py
backend/tests/test_database.py
backend/requirements.txt
```

### Trade 字段 v0.1

```python
id
created_at
updated_at
symbol
market
direction
setup
market_context
planned_entry
actual_entry
stop_loss
target_1
target_2
runner_enabled
runner_active
position_size
risk_per_trade
status
exit_price
exit_reason
final_r
followed_plan
discipline_score
notes
```

### 学习重点

- FastAPI 项目结构。
- schema 和 model 的区别。
- SQLite 是如何保存数据的。
- Alembic migration 为什么比手动删库重建更接近真实工程。
- service 层为什么不要写在 route 里。

### 运行命令

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

### 测试命令

```bash
cd backend
pytest
```

### 验收标准

- `GET /health` 返回正常。
- Alembic 可以执行 `alembic upgrade head`。
- 数据库文件能自动创建。
- 测试能创建一笔 planned trade。

### 建议 commit

```bash
git add .
git commit -m "stage 1 add backend data models and sqlite persistence"
```

---

## Stage 2：规则 YAML 和 Rule Engine

### 目标

把交易规则从 Markdown 思维导图变成机器可读 YAML，并实现初始规则引擎。

### Codex 任务

1. 创建 `backend/app/rules/price_action_rules.yaml`。
2. 写入 MVP 规则：
   - every_order_must_have_stop_loss
   - no_reverse_trade_immediately_after_stop_loss
   - breakout_needs_follow_through
   - trading_range_second_leg_trap
   - trading_range_big_bar_reversal_risk
   - take_profit_and_let_runner_run
   - green_trade_should_not_go_red
   - runner_must_have_protection
3. 实现 `rule_engine.py`：加载 YAML，接收 trade draft，输出 alerts。
4. 条件系统除了支持 `missing / equals / greater_than`，还要预留 `greater_than_field / less_than_field / compare_field`，用于比较 `target_1`、`planned_entry`、`stop_loss` 等字段。
5. 写测试覆盖 blocker/warning/reminder，以及至少一个字段对比规则。

### Rule YAML 示例

```yaml
- id: every_order_must_have_stop_loss
  name: 下单前必须设置好止损
  category: 风险控制
  stage: pre_trade
  severity: blocker
  trigger:
    trade_status: planned
  conditions:
    - field: stop_loss
      operator: missing
      value: null
      compare_field: null
  checklist:
    - 是否已经设置好止损？
    - 止损位置是否对应结构失效点？
  action: 设置结构性止损后才允许继续
  avoid: 无止损裸单
  risk: 单笔亏损失控
  message: 你还没有设置结构性止损。没有止损，不允许下单。
  discipline_sentence: 没有止损，就没有入场资格。
  enabled: true
```

### 字段对比规则示例

```yaml
- id: long_target_must_be_above_entry
  name: 做多目标位必须高于入场价
  stage: pre_trade
  severity: blocker
  trigger:
    direction: long
  conditions:
    - field: target_1
      operator: greater_than_field
      compare_field: planned_entry
  message: 做多计划中，Target 1 必须高于入场价。
```

### Rule Engine 输出示例

```json
{
  "status": "blocked",
  "alerts": [
    {
      "rule_id": "every_order_must_have_stop_loss",
      "severity": "blocker",
      "message": "你还没有设置结构性止损。没有止损，不允许下单。"
    }
  ]
}
```

### 学习重点

- 为什么规则要从代码里抽到 YAML。
- trigger / condition / alert 的关系。
- 如何把交易笔记转成程序逻辑。
- 单元测试如何验证规则引擎。

### 测试命令

```bash
cd backend
pytest tests/test_rule_engine.py
```

### 验收标准

- stop_loss 为空时输出 blocked。
- setup=breakout 且 FT 未确认时输出 warning。
- open trade 达到 1R 时输出 reminder。
- 字段对比规则可以检测做多/做空下 entry、stop、target 方向是否合理。

### 建议 commit

```bash
git add .
git commit -m "stage 2 add yaml rules and rule engine"
```

---

## Stage 3：后端 API

### 目标

提供前端需要调用的 API。

### Codex 任务

实现以下接口：

```http
GET    /health
GET    /trades
POST   /trades
GET    /trades/{trade_id}
PATCH  /trades/{trade_id}
POST   /trades/{trade_id}/open
POST   /trades/{trade_id}/close
POST   /trades/{trade_id}/cancel
GET    /rules
POST   /rules/evaluate
POST   /trades/{trade_id}/review
GET    /summary/daily
```

### API 行为

从 Stage 3 开始必须统一错误响应格式，避免前端 Stage 5 后再重构 API client。

```json
{
  "error": {
    "code": "MISSING_STOP_LOSS",
    "message": "Stop loss is required before opening a trade.",
    "details": {"field": "stop_loss", "severity": "blocker"}
  }
}
```

- `POST /trades` 创建 planned trade。
- `POST /rules/evaluate` 对 trade draft 或 existing trade 运行规则。
- `POST /trades/{id}/open` 把 planned trade 变成 open。
- `POST /trades/{id}/close` 填写 exit 信息并变成 closed。
- `POST /trades/{id}/review` 创建复盘并计算纪律评分。

### 学习重点

- REST API 的基本设计。
- POST / PATCH / GET 的区别。
- 后端如何返回错误信息。
- 如何用 FastAPI docs 手动测试。

### 测试命令

```bash
cd backend
pytest tests/test_trade_api.py
```

### 验收标准

- FastAPI `/docs` 可以看到接口。
- 可以通过 curl 创建一笔交易。
- 可以通过 API 获取规则提醒。
- 可以关闭交易并生成 review。
- API validation / business errors 都使用统一 error envelope。

### 示例 curl

```bash
curl -X POST http://127.0.0.1:8000/trades \
  -H "Content-Type: application/json" \
  -d '{"symbol":"ES","direction":"long","setup":"breakout","market_context":"trading_range","planned_entry":5000,"stop_loss":4990,"target_1":5020,"runner_enabled":true}'
```

### 建议 commit

```bash
git add .
git commit -m "stage 3 add backend trade and rule APIs"
```

---

## Stage 4：前端初始化和基础布局

### 目标

创建 React + TypeScript 前端，先做可点击页面壳。

### Codex 任务

1. 用 Vite 创建 React + TypeScript 项目。
2. 创建 `api.ts` 和 `types.ts`。
3. 创建基础组件：Dashboard、New Trade、Open Trades、Review、Rules。
4. App 中用简单 tabs 切换页面。
5. 不追求样式复杂，先保证结构清楚。

### 学习重点

- React 组件是什么。
- TypeScript type 如何对应后端 schema。
- 父组件如何切换页面。
- 前端如何调用后端 API。

### 运行命令

```bash
cd frontend
npm install
npm run dev
```

### 验收标准

- 浏览器能打开前端。
- 顶部或侧边能切换 5 个页面。
- Dashboard 能调用 `/health` 并显示 backend connected。

### 建议 commit

```bash
git add .
git commit -m "stage 4 scaffold react frontend layout"
```

---

## Stage 5：交易前检查页面

### 目标

完成最重要的 MVP 功能：下单前 checklist + rule alerts。

### Codex 任务

1. `TradeChecklist.tsx` 实现输入表单。
2. 字段包括：symbol、direction、setup、market_context、entry、stop、target、runner、notes。
3. 用户输入 entry、stop、target 后，前端实时计算并显示 Risk/Reward 和 target R。
4. 用户修改字段时调用 `/rules/evaluate`。
5. 右侧显示 alerts。
6. 页面底部显示状态：Allowed / Warning / Blocked。
7. Blocked 时禁用 `Create Trade Plan` 按钮，或要求用户确认修正。
8. `api.ts` 必须能解析 Stage 3 统一 error envelope。

### 需要重点实现的提醒

- 无止损：Blocked。
- Breakout 未确认 FT：Warning。
- Trading Range 上沿追多 / 下沿追空：Warning。
- 止损后反手：Blocked 或 Warning，视字段确认。

### 交易前 R/R 计算

Long：

```text
risk = planned_entry - stop_loss
target_r = (target_1 - planned_entry) / risk
```

Short：

```text
risk = stop_loss - planned_entry
target_r = (planned_entry - target_1) / risk
```

如果 `risk <= 0`，说明方向、入场价或止损价不合理，应显示 Blocked。

### 学习重点

- 表单 state 管理。
- 受控组件 controlled components。
- 前端如何根据 API 返回值渲染 warning card。
- 为什么 UI 状态要和业务规则分开。

### 验收标准

- 不填 stop loss，页面显示 Blocked。
- 输入 entry/stop/target 后能实时显示 target R。
- Long/Short 方向下 entry、stop、target 不合理时显示 Blocked 或字段错误。
- 选择 breakout，页面显示 FT checklist。
- 点击 Create Trade Plan 能保存 planned trade。

### 建议 commit

```bash
git add .
git commit -m "stage 5 implement pre trade checklist and alerts"
```

---

## Stage 6：持仓管理页面

### 目标

开仓后管理止损、止盈和 runner。

### Codex 任务

1. 显示所有 open trades。
2. 每个 open trade 显示 entry、stop、target、runner、notes。
3. 支持按钮：
   - Partial Profit Taken
   - Move Stop to Breakeven
   - Move Stop by Structure
   - Runner Active / Runner Closed
   - Exit Trade
4. 手动输入 current_price，计算 current R。
5. 当 current R >= 1 时提醒部分止盈。
6. 当 runner_active=true 但 runner_stop 为空时提醒保护 runner。
7. 如果 planned/open/closed trades 和 alerts 已经需要跨页面共享，引入 Zustand 或 React Context，避免严重 Prop Drilling；若暂时不需要，写明暂缓理由。

### 学习重点

- 状态更新和 PATCH API。
- 什么时候从 local state 平滑过渡到 Zustand / React Context。
- R 倍数计算。
- 交易中 reminder 与交易前 blocker 的区别。
- 为什么 runner 要和原始仓位分开管理。

### R 计算

Long：

```text
risk = entry - stop
current_r = (current_price - entry) / risk
```

Short：

```text
risk = stop - entry
current_r = (entry - current_price) / risk
```

### 验收标准

- planned trade 可以标记为 open。
- open trade 可以更新 stop。
- current price 达到 1R 显示 take profit reminder。
- runner 没有保护时显示 warning。
- 跨页面 trade/alert 状态不依赖层层 props 传递，或有明确的暂缓状态管理说明。

### 建议 commit

```bash
git add .
git commit -m "stage 6 add open trade management workflow"
```

---

## Stage 7：平仓复盘和纪律评分

### 目标

平仓后完成复盘，并自动计算纪律评分。

### Codex 任务

1. `PostTradeReview.tsx` 显示 closed trade review form。
2. 支持输入 exit_price、exit_reason、final_r、followed_plan、mistake_tags、lesson。
3. 后端实现 `review_service.py`，必要时拆出 `scoring_service.py`。
4. 创建并加载 `discipline_scoring_rules.yaml`。
5. 根据 mistake_tags、加分项和 veto_rules 计算 discipline_score。
6. 显示分类：好交易盈利 / 好交易亏损 / 坏交易盈利 / 坏交易亏损。

### 纪律评分 v0.2：配置驱动

评分规则必须从配置文件读取，而不是硬编码在 `review_service.py` 中。

建议文件：

```text
backend/app/rules/discipline_scoring_rules.yaml
```

配置草案：

```yaml
base_score: 100
min_score: 0
max_score: 100

veto_rules:
  - tag: no_stop_loss
    score: 0
    reason: 无止损下单是底线错误，直接记为 0 分。
  - tag: revenge_reverse_after_stop_without_new_setup
    score: 0
    reason: 止损后无新结构立刻反手，属于情绪交易。

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
```

计算顺序：

1. base_score = 100。
2. 先检查 veto_rules；命中则直接返回 0 分和 veto_reason。
3. 未命中 veto 时，再应用 penalties 和 bonuses。
4. 最终分数 clamp 到 0-100。
5. 返回 score、score_band、triggered_rules、veto_reason。

### 学习重点

- 业务逻辑如何放在 service 层。
- 配置驱动评分系统如何可测试。
- 一票否决和线性扣分的边界。
- 为什么交易质量不等于盈亏。

### 验收标准

- closed trade 可以填写 review。
- mistake_tags 会影响纪律评分。
- 命中 blocker/veto 标签时，纪律分直接为 0。
- 修改 YAML 分值后，不需要改 Python 业务代码。
- 坏交易盈利会被标记出来。
- 好交易亏损不会被系统惩罚。

### 建议 commit

```bash
git add .
git commit -m "stage 7 add post trade review and discipline scoring"
```

---

## Stage 8：Dashboard 和 Daily Summary

### 目标

汇总当天纪律状态。

### Codex 任务

1. 后端实现 `/summary/daily`。
2. 汇总：交易数、净 R、平均纪律评分、违规次数、green-to-red 次数、revenge_trade 次数。
3. 前端 Dashboard 显示 summary cards。
4. DailySummary 页面列出今日最主要 mistake_tags。

### 学习重点

- 后端聚合数据。
- 前端展示 summary cards。
- 为什么每日总结比单笔盈亏更重要。

### 验收标准

- Dashboard 显示今日交易数。
- 显示今日平均纪律分。
- 显示最高频错误。
- 显示今日净 R。

### 建议 commit

```bash
git add .
git commit -m "stage 8 add dashboard and daily discipline summary"
```

---

## Stage 9：Rules Library 规则库页面

### 目标

让用户能查看所有规则，而不是把规则藏在代码里。

### Codex 任务

1. `GET /rules` 返回 YAML 规则。
2. `RulesLibrary.tsx` 显示规则卡片。
3. 支持按 stage / severity / category 过滤。
4. 每张卡显示：name、message、checklist、avoid、discipline_sentence。

### 学习重点

- 数据驱动 UI。
- filter state。
- 为什么规则库是产品的知识核心。

### 验收标准

- 能看到所有 MVP 规则。
- 能按 blocker/warning/reminder 过滤。
- 能看到一句话纪律。

### 建议 commit

```bash
git add .
git commit -m "stage 9 add rules library page"
```

---

## Stage 10：CSV 导入预留，不接真实交易

### 目标

为未来半自动复盘预留接口，但不做真实 broker 集成。

### Codex 任务

1. 设计 CSV 格式：symbol、side、entry_time、exit_time、entry_price、exit_price、size、pnl。
2. 后端添加 CSV parser service。
3. 前端添加 Import 页面或 Rules 页面中的导入按钮。
4. 导入后创建 closed trade draft，用户再补充 setup/context/review。

### 学习重点

- 文件上传。
- CSV parsing。
- 为什么先导入复盘，不直接接交易 API。

### 验收标准

- 可以导入示例 CSV。
- 生成 trade records。
- 不涉及任何真实下单。

### 建议 commit

```bash
git add .
git commit -m "stage 10 add csv import draft workflow"
```

---

## Stage 11：打磨、测试、README 和学习总结

### 目标

让项目成为一个可以长期维护的学习项目。

### Codex 任务

1. 补充 README：安装、运行、测试、功能说明。
2. 补充 backend tests。
3. 检查所有页面空状态、错误状态、loading 状态。
4. 添加 sample trades 和 sample rules。
5. 更新 `docs/learning_log.md`。

### 学习重点

- 项目交付不仅是代码能跑，还要能维护。
- README 是给未来自己的说明书。
- 测试和空状态是应用可靠性的基础。

### 验收标准

- 新电脑按 README 能跑起来。
- 后端测试通过。
- 前端无明显 TypeScript 错误。
- 可以完整走完一笔交易：计划 → 开仓 → 持仓管理 → 平仓 → 复盘 → dashboard。

### 建议 commit

```bash
git add .
git commit -m "stage 11 polish docs tests and end to end workflow"
```

---

## 3. 每阶段学习日志模板

每完成一个阶段，在 `docs/learning_log.md` 加一段：

````markdown
## Date
YYYY-MM-DD

## Stage
Stage X - Name

## What I built
一句话描述本阶段完成了什么。

## Concepts learned
- 概念 1
- 概念 2
- 概念 3

## Files changed
- file 1
- file 2

## Commands used
```bash
command 1
command 2
```

## Bugs / Confusions
- 我哪里没理解？
- 哪个 bug 卡住了？

## Next step
下一阶段要做什么。
````

---

## 4. 推荐给 Codex 的第一条开发 Prompt

```text
We are building a local web app called Trading Discipline Copilot.

Please follow docs/product_design.md and docs/codex_implementation_plan.md.
Start with Stage 0 only.

Requirements:
- Create the project structure.
- Add README.md.
- Add docs/product_design.md and docs/codex_implementation_plan.md if not already present.
- Add docs/learning_log.md with the learning template.
- Do not implement the full app yet.
- At the end, summarize changed files, commands to run, what I should learn, and a suggested git commit message.
```

完成 Stage 0 后，再对 Codex 说：

```text
Continue to Stage 1 only. Do not jump ahead.
Implement backend data models and SQLite persistence. Add tests. Explain what I should learn from this stage.
```

---

## 5. 开发纪律

为了让这个项目真正服务交易纪律，同时服务学习，开发时遵守：

1. 每次只做一个 stage。
2. 每个 stage 都要能运行。
3. 每个 stage 都要有 commit。
4. 不理解的代码要停下来问清楚。
5. 不为了“功能多”牺牲清晰结构。
6. MVP 先手动，自动化后置。
7. 永远不把自动化交易作为默认功能。

---

## 6. 最小可用闭环定义

当以下流程能跑通时，MVP 就算成立：

```text
1. 用户打开 Dashboard。
2. 点击 New Trade。
3. 填写一笔 breakout long。
4. 如果没有 stop loss，系统 Blocked。
5. 填写 stop loss 后，系统给 FT warning。
6. 用户确认风险并创建 planned trade。
7. 用户标记 trade open。
8. 当前价格达到 1R，系统提醒 take partial。
9. 用户标记 partial profit and runner active。
10. 用户平仓。
11. 用户填写 review。
12. 系统给纪律评分。
13. Dashboard 显示今日 summary。
```

这个闭环比任何复杂自动化都重要。

---

## Engineering Overlay：把每个 Stage 做成真实工程流程

从现在开始，Codex 在执行每个 Stage 时必须同时满足功能目标和工程目标。

### 每个 Stage 的固定要求

```text
1. Keep scope small.
2. Before coding, explicitly list files/directories that will NOT be modified in this stage.
3. Before coding, do a short self-review against `product_design.md` and explain the implementation plan.
4. Update or create tests for backend business logic.
5. Keep API / service / database layers separated.
6. Keep frontend API calls in api.ts, not inside random components.
7. Avoid hidden large refactors.
8. Update docs or learning_log.md when behavior changes.
9. Print verification commands.
10. Suggest a conventional commit message.
```

### 新增工程化 Stage

在原 Stage 0-11 后追加：

```text
Stage 12 Engineering Hardening
- Refine the Stage 3 consistent error response format if needed, but do not introduce it for the first time here.
- Add structured logging.
- Add TradeEvent event log for lifecycle history.
- Add backup/export endpoint for local data.
- Add Makefile or task commands.
- Add GitHub Actions CI for backend tests and frontend build.
```

### 每阶段 Definition of Done

```text
- Feature works for the stated scope.
- Tests pass.
- No auto-trading behavior is introduced.
- Code is split by responsibility.
- User can explain what changed.
- A clean git commit can be made.
```

### 工程学习目标

这个项目每阶段不仅要完成交易工具功能，还要学习一个工程概念：

```text
Stage 0: repo structure, docs, README
Stage 1: domain model, persistence, database tests
Stage 2: config-driven rules, unit tests
Stage 3: REST API design, API tests, unified error envelope
Stage 4: frontend architecture, typed API client
Stage 5: form state, validation, rule alert UX
Stage 6: state transitions, trade lifecycle, Zustand/Context decision
Stage 7: config-driven scoring, veto rules, review workflow
Stage 8: aggregation, dashboard metrics
Stage 9: rules library, internal admin UI
Stage 10: read-only import, data normalization
Stage 11: polish, README, manual QA
Stage 12: CI, logging, event log, backup/export
```

## Stage 14 - Real Trading Workflow & Live Discipline Hardening

### Summary

Stage 14 hardens the MVP for real trading discipline support. The app keeps one live workflow, rejects Practice Mode / Learning Mode, and treats blocker rules as hard stops. Warning rules may still allow a trade plan, but only after the user explicitly acknowledges the active warnings.

### Acceptance criteria

- Missing stop loss blocks planned trade creation.
- Breakout without follow-through returns a warning.
- Warning alerts require explicit acknowledgement before creating a trade plan.
- Left-side bottom picking with options is blocked.
- Left-side bottom picking with stocks warns and reminds small size.
- Rule alerts may include `next_actions`, `ui_hints`, and `requires_acknowledgement` without breaking older rules.
- Open trade cards show a top-level Required Action area, prioritizing blocker, then warning, then reminder.
- No broker integration, order placement, order modification, cancellation, or auto-trading is introduced.
- Product documentation states this is real trading discipline support with no Practice Mode / Learning Mode.

### Engineering notes

- Rule behavior remains configuration-driven through YAML.
- Backend business logic stays in the rule engine service, not route handlers.
- Frontend API calls remain in `src/api.ts`.
- The UI change is an incremental sectioning of the existing checklist, not a routing or state-management rewrite.

## Stage 15 - Daily Intraday Readiness Checklist

### Summary

Stage 15 adds a Dashboard-based daily readiness checklist that decides whether intraday trading is cleared for the current day. The checklist persists by date and uses required preparation items only to compute readiness status.

### Acceptance criteria

- Dashboard shows Today's Intraday Readiness.
- Readiness records persist by date.
- Required and optional items are visually distinguishable.
- The backend computes required completed count, required total count, and cleared status.
- The user can save completion and notes for today's checklist.
- New Trade shows a blocker-style banner when today's intraday readiness is incomplete.
- Existing open trade management and swing review flows are not blocked by readiness.
- No broker integration, order execution, automatic event calendar, automatic watchlist generation, or automatic market classification is introduced.

### Engineering notes

- A single `daily_readiness` table stores flexible JSON checklist items.
- The checklist template and readiness calculation live in `daily_readiness_service.py`.
- The UI uses an explicit Save button to keep persistence obvious.
- Strict `trade_horizon` gating is deferred to Stage 17 to avoid widening the trade schema in this stage.

## Stage 16 - Decimal Precision, Options Contract Details, and Symbol Price Lookup

### Summary

Stage 16 improves New Trade planning for stocks and options. Numeric trade inputs use two-decimal behavior, options trades can record the exact option contract, and the form can fetch a reference quote for the underlying symbol.

### Acceptance criteria

- Planned entry, stop loss, targets, and position size use `step="0.01"` and normalize to two decimals.
- Risk per unit, target distance, and Planned R/R display clean two-decimal values.
- Options trades keep `symbol` as the underlying ticker and store `option_contract` separately.
- Missing option contract details produce a warning requiring acknowledgement, not a blocker.
- `GET /market-data/quote?symbol=...` returns a quote result or a safe manual fallback.
- Options quote display is labelled as underlying price, not option premium.
- Existing manual price input still works.

### Deferred

- Live option chain browsing.
- Option premium quotes.
- Bid/ask/spread.
- Greeks, IV, delta, and pricing models.
- Broker integration or order execution.

## Stage 17 - Trade Horizon, Intraday Gate, and Navigation Scanability

### Summary

Stage 17 adds `trade_horizon` to every trade plan and uses it to scope Daily
Readiness correctly. Intraday plans require today's readiness checklist to be
cleared; swing and other plans are not blocked by that intraday gate.

### Acceptance criteria

- `Trade` stores `trade_horizon` with allowed values `intraday`, `swing`, and `other`.
- Older clients that omit `trade_horizon` still create intraday trades.
- `GET /trades` can filter by `trade_horizon`.
- New Trade requires a horizon selection near setup/context.
- Intraday readiness creates a blocker only for intraday plans.
- Daily Readiness remains at the bottom of Dashboard.
- Navigation uses icons plus labels/short labels instead of single-letter initials.

### Deferred

- Dashboard redesign.
- Option premium lookup or option chain support.
- Broker integration, order execution, or auto trading.
- Global frontend state management.
- Backend router refactoring.

## Stage 18 - Trade Horizon Filters and Cockpit Metrics Layout

### Summary

Stage 18 promotes `trade_horizon` from a planning-only field to a reusable
filter dimension. The UI remains controlled and cockpit-like: state, blockers,
next actions, and trusted inputs have priority over motivational copy.

### Acceptance criteria

- `GET /summary/daily` accepts optional `trade_horizon`.
- Summary without a horizon includes all trades.
- Summary with a horizon includes only matching trades.
- Open Trades, Post-Trade Review, Daily Summary, and Dashboard summary expose a horizon filter where practical.
- Touched metric grids use compact labels, larger tabular values, and tighter operational spacing.
- Open-trade Target 1, Target 2, and Position size metrics can be edited inline.
- Recorded partial exits appear on the price map.
- The stop-to-breakeven shortcut is removed from the touched management controls.
- Daily Readiness remains at the bottom of Dashboard.

### Deferred

- Moving Daily Readiness.
- Dashboard redesign.
- Option quote behavior changes.
- Broker integration or auto trading.
- TanStack Query, global state management, or a full design-system extraction.

## Stage 19 - Rule Engine Schema Validation

### Summary

Stage 19 validates price-action YAML rules with Pydantic before the rule engine
uses them. Rules are treated as a core product asset: invalid stages,
severities, operators, or operator-specific fields should fail fast in tests.

### Acceptance criteria

- `price_action_rules.yaml` validates through a dedicated rule schema.
- `load_rules()` validates YAML and returns API-compatible dictionaries.
- Unsupported operators fail clearly.
- Invalid severities fail clearly.
- `in` requires a list value.
- `greater_than_field` and `less_than_field` require `compare_field`.
- Rule authoring guidance exists in `docs/rule_authoring_guide.md`.

### Deferred

- Persistent warning acknowledgement.
- New trading rules.
- Daily Readiness movement.
- Options behavior changes.
- Broker integration.
- Router refactoring.

## Stage 20 - Backend Router Split

### Summary

Stage 20 splits the large backend API route module into domain routers while
preserving every public endpoint path and response model. This is a
maintainability refactor, not a product behavior change.

### Acceptance criteria

- Domain routers live under `backend/app/api/`.
- `app.main` still includes one combined router from `app.api`.
- Daily readiness, trades, rules, market data, reviews, and summary endpoints keep the same paths.
- Route modules keep HTTP concerns separate from service-layer business logic.
- Existing backend API tests pass without product behavior changes.

### Deferred

- Endpoint path changes.
- Response model changes.
- Service refactors.
- Product features.
- Persistent warning acknowledgement.
- Broker integration.

## Stage 21 - Frontend Server State and Small UI Primitives

### Summary

Stage 21 introduces TanStack Query for frontend server state and extracts a few
small reusable UI primitives. The goal is consistency and maintainability, not a
full UI redesign.

### Acceptance criteria

- The React app is wrapped in `QueryClientProvider`.
- Key API data has query hooks for summaries, readiness, trades, rules, and open attention.
- Mutations exist for common write paths and invalidate related query data.
- Dashboard, Daily Readiness, and trade-list loading use query-backed state.
- Small primitives exist for Button, StatusBadge, Panel, and Field.
- Touched UI keeps blocker/warning/danger states visually distinct.

### Deferred

- Full design system.
- Zustand for server data.
- Broad component rewrite.
- Daily Readiness movement.
- Options behavior changes.
- Broker integration.
- Persistent warning acknowledgement.
# Stage 22 implementation

Stage 22 adds durable email alerts, execution-led closure, inline cockpit editing,
and a three-step option-aware planner. See `stage22_live_alerts_and_execution_workflow.md`.
# Stage 23 implementation

- Add process-local monitor runtime state and persisted latest-email reporting.
- Persist current-price source and timestamp with an additive migration.
- Refresh option underlyings through the stock quote provider.
- Require positive position size for new plans while preserving legacy nullable rows.
- Expand Dashboard health, price freshness, risk cockpit, plan summaries, disabled reasons, and final confirmation.
- Preserve Rule Alerts, OptionContractSelector, Daily Readiness placement, and underlying-only option R.
## Stage 24 implementation

- Normalize actionable work in a backend `/attention` endpoint.
- Order blocker → warning → reminder, with time-sensitive and recency tie-breakers.
- Rename Rule Alerts to a dedicated Attention page without a navigation count or Dashboard duplicate.
- Add reload-safe deep links for open-trade, price-alert, notification, and post-review destinations.
- Standardize runner controls, show collapsed alert history and execution preview, and provide close-to-review handoff.
- Preserve RuleAlertPanel, OptionContractSelector, underlying-only option R, and bottom Dashboard readiness.
## Stage 25 implementation

- Enforce query-owned reads and mutation-owned writes across operational pages.
- Preserve only drafts, modal state, dismissed notices, and derived calculations locally.
- Define query freshness, retry, reconnect, focus, and polling policies.
- Add additive WorkflowEvent storage, filtered development API, and lifecycle integration.
- Record planning attempts explicitly and idempotently; never audit debounced renders.
- Keep current-state models authoritative; do not introduce event replay or analytics UI.

## Stage 26 implementation

- Add a read-only `/analytics/discipline` projection over current-state tables and WorkflowEvents.
- Apply inclusive UTC dates plus horizon, market, and setup filters.
- Return null for every zero-denominator rate and document each formula.
- Add a low-frequency, query-backed Analytics page after Daily Summary.
- Invalidate analytics after lifecycle, review, and readiness writes.
- Preserve Attention, Dashboard readiness placement, OptionContractSelector, and underlying-only options R.

## Stage 27 implementation

- Add nullable structured taxonomy columns with conservative migration backfill.
- Preserve setup/context as deprecated mirrors for old rows and consumers.
- Add validated JSON location tags and generic rule list operators.
- Replace flat New Trade classification with accessible bilingual controls.
- Show compact bilingual facts in planned, open, and review workflows.
- Extend trade and analytics filters without removing historical filters.
