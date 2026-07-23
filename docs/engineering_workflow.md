# Engineering Workflow Guide for Trading Discipline Copilot

> 目标：把 Trading Discipline Copilot 按更接近真实工程团队 / 大厂项目的方式开发。  
> 原则：不是为了堆复杂技术，而是学习真实软件工程流程：需求、设计、分层、测试、CI、代码审查、发布、复盘。

---

## 1. 工程化目标

这个项目的工程目标不是“让 Codex 尽快堆出一个页面”，而是训练一套真实开发习惯：

```text
需求明确 → 技术设计 → 分阶段实现 → 自动化测试 → 代码审查 → 文档更新 → Git 提交 → 复盘学习
```

每个 Stage 都应该产出：

1. 可运行代码。
2. 自动化测试。
3. 清晰的 changed files 总结。
4. 可复制的运行命令。
5. 学习记录。
6. 一个干净的 git commit。

---

## 2. 技术栈升级方向

### 2.1 MVP 技术栈

第一版仍然保持轻量，但要使用工程化标准。

```text
Frontend:
- React
- TypeScript
- Vite
- React Router 或 tab-based routing
- API client layer
- Zustand 或 React Context（Stage 6 起按共享状态复杂度决定）
- ESLint + Prettier
- Vitest / React Testing Library later

Backend:
- Python
- FastAPI
- Pydantic
- SQLite
- SQLAlchemy
- Alembic
- PyYAML
- pytest
- ruff / black / mypy later

Rules:
- YAML rules
- Rule Engine service
- 单元测试覆盖 blocker / warning / reminder

Dev Workflow:
- Git
- Conventional commit message
- GitHub Actions CI later
- PR template / issue template later
```

### 2.2 不建议一开始上的东西

这些可以以后加，但 MVP 先不要上：

- Kubernetes
- 微服务
- 真实 broker 下单
- 复杂权限系统
- 云部署
- 消息队列
- 自动行情识别
- AI 自动决策

原因：当前最重要的是把交易纪律闭环做对，而不是把技术栈做重。

---

## 3. 推荐的真实工程流程

### 3.1 每个 Stage 的标准流程

每个阶段都按这个流程走：

```text
1. Read docs
2. Clarify scope
3. Create / update types and schemas
4. Implement backend or frontend feature
5. Add tests
6. Run lint / tests / build
7. Update docs
8. Summarize diff
9. Update learning_log.md
10. Commit
```

给 Codex 的要求：

```text
Do not just implement the feature. Also explain the engineering tradeoffs, tests, and how this stage fits into the product architecture.
```

### 3.2 AI 协作防范围蔓延协议

每次让 Codex 开发前，要求它先输出：

```text
1. 本 Stage 目标。
2. 本 Stage 会修改的文件/目录。
3. 本 Stage 明确不会修改的文件/目录。
4. 对照 product_design.md 的自我审查。
5. 本 Stage 明确延后不做的内容。
```

原因：Codex 容易出现 scope creep。先让它声明“不改什么”，比只说“不要跳阶段”更能收敛注意力，也更接近真实工程中的变更范围控制。

---

## 4. Git 工作流

### 4.1 分支策略

个人项目建议使用简化版 trunk-based / feature branch 流程：

```text
main
  └── feature/stage-01-backend-models
  └── feature/stage-02-rule-engine
  └── feature/stage-03-api
```

每个 Stage 一个分支，完成后合并回 `main`。

### 4.2 Commit 规范

使用 conventional commits：

```text
feat: add trade checklist backend models
fix: handle missing stop loss blocker
test: add rule engine blocker tests
refactor: split trade service from API routes
docs: add stage 2 learning notes
chore: add lint and formatter config
```

### 4.3 每次 commit 前检查

```bash
git status
git diff --stat
git diff
pytest
npm test
npm run build
```

MVP 早期如果没有 frontend tests，可以先至少保证：

```bash
npm run build
```

---

## 5. 代码结构原则

### 5.1 Backend 分层

后端不要把所有逻辑写在 `main.py` 里。

推荐分层：

```text
API routes        只处理 HTTP 请求/响应
Schemas           定义输入输出结构
Services          业务逻辑
Rule Engine       规则判断逻辑
Database layer    数据持久化
Models            数据库模型
Tests             验证行为
```

Stage 20 splits API routes by domain under `backend/app/api/`:

```text
api/daily_readiness.py
api/trades.py
api/market_data.py
api/rules.py
api/reviews.py
api/summary.py
```

Route modules own HTTP concerns: path declarations, query/body parsing,
response models, dependency injection, and HTTP status codes. Service modules own
business behavior: trade lifecycle, readiness calculation, rule evaluation,
market-data lookup, review scoring, and summary aggregation.

Router splits are maintainability refactors. Public endpoint paths and response
models should remain unchanged, and existing API tests should continue to prove
the product behavior did not move.

### 5.2 Database Migration 原则

从 Stage 1 开始引入 Alembic。

原因：

- 后续 `Trade`、`Review`、`Alert` 字段会频繁演进；
- 如果没有 migration，每次模型变更都只能删除本地 `.db` 重建，不符合真实工程流程；
- migration 可以训练 schema versioning、升级、回滚和测试数据库初始化。

要求：

```text
- 每次 SQLAlchemy model 结构变化，都要创建 Alembic migration。
- 测试环境也要能跑 migration。
- 不允许用“删除本地数据库”作为常规开发流程。
```

### 5.3 Frontend 分层

前端不要把所有内容写进 `App.tsx`。

推荐分层：

```text
pages/            页面级组件
components/       可复用组件
api.ts            API 调用
types.ts          TypeScript 类型
utils/            工具函数
hooks/queries.ts  TanStack Query server-state hooks
state/            若客户端 UI 状态跨页面共享，再考虑 Zustand 或 React Context
```

状态管理策略：

```text
Stage 4-5:
- local state + api.ts 足够。

Stage 21 起:
- 后端拥有的数据使用 TanStack Query：trades, readiness, summary, rules, open attention。
- 组件临时状态继续留在 local state：表单草稿、筛选器、展开状态、inline edit draft。
- 如果纯客户端 UI 状态跨页面共享，再考虑 Zustand。
```

Server state 和 local UI state 的区别：

- Server state: 来自 API，可能被其他页面、请求或后端流程改变，需要缓存、重新获取、失效刷新。
- Local UI state: 当前页面自己的临时交互状态，不需要后端持久化。

TanStack Query 用于 server state，因为它提供 query keys、loading/error 状态、缓存、refetch 和 mutation invalidation。Zustand 不用于 server data，因为它不会自动理解 API 缓存和失效规则；后续如果有跨页面的纯 UI 状态，再单独评估 Zustand。

UI primitives 只抽取稳定小模式，例如 Button、StatusBadge、Panel、Field。不要把它扩张成完整设计系统；只在触及的组件中使用，避免大范围视觉重写。

### 5.4 Domain Model 优先

这个项目的核心不是 UI，而是交易生命周期：

```text
Trade Plan → Open Trade → Trade Events → Review → Daily Summary
```

建议后续加入 `TradeEvent`，用于记录：

```text
created_plan
opened_position
stop_updated
partial_taken
runner_enabled
runner_stop_updated
closed_trade
review_submitted
rule_alert_triggered
```

这会让后续自动化追踪、复盘、统计纪律错误更容易。

---

## 6. 测试策略

### 6.1 测试金字塔

优先级：

```text
Rule Engine unit tests        最高优先级
Service tests                 高优先级
API tests                     高优先级
Frontend component tests      中优先级
End-to-end tests              后期加入
```

### 6.2 必须覆盖的核心测试

Rule Engine 必测：

```text
无止损 → blocked
突破无 FT → warning
TR 上沿追多 → warning
止损后立刻反手 → blocked 或 warning
到达 1R 未止盈 → reminder
runner active 但没有 runner stop → warning
```

Trade lifecycle 必测：

```text
create planned trade
open planned trade
update stop loss
mark partial profit
close trade
submit review
calculate discipline score
```

---

## 7. CI / 自动化质量门槛

后续可以加入 GitHub Actions：

```yaml
Backend CI:
  - install dependencies
  - run ruff
  - run pytest

Frontend CI:
  - install dependencies
  - run eslint
  - run npm run build
  - run frontend tests when available
```

本地也可以加 `Makefile`：

```makefile
backend-test:
	cd backend && pytest

frontend-build:
	cd frontend && npm run build

test:
	cd backend && pytest
	cd frontend && npm run build
```

---

## 8. API 设计原则

### 8.1 API 只暴露稳定行为

不要让前端直接依赖数据库结构。

API 应该围绕业务动作：

```text
POST /trades                    创建计划
POST /trades/{id}/open          开仓
PATCH /trades/{id}/stop         修改止损
POST /trades/{id}/partial       标记部分止盈
POST /trades/{id}/close         平仓
POST /trades/{id}/review        复盘
POST /rules/evaluate            评估规则
GET /summary/daily              日总结
```

### 8.2 错误格式统一

必须在 Stage 3 后端 API 阶段就建立统一错误格式，而不是等到 Stage 12。前端 Stage 5 会依赖这个结构渲染字段错误、Blocker、Warning 和页面级错误。

建议统一返回：

```json
{
  "error": {
    "code": "MISSING_STOP_LOSS",
    "message": "Stop loss is required before opening a trade.",
    "details": {}
  }
}
```

---

## 9. 规则系统工程化

每条交易纪律规则都应该支持：

```yaml
id: every_order_must_have_stop_loss
name: 下单前必须设置好止损
stage: pre_trade
severity: blocker
trigger:
  status: planned
conditions:
  stop_loss_missing: true
message: 没有止损，不允许下单。
checklist:
  - 是否已经设置好止损单？
  - 止损位置是否对应结构失效点？
discipline_sentence: 没有止损，就没有入场资格。
```

Rule Engine 的目标不是一次写得很复杂，而是先支持最重要的几种条件：

```text
missing_field
equals
not_equals
boolean_is_true
boolean_is_false
numeric_threshold
compare_field_greater_than
compare_field_less_than
risk_reward_at_least
context_contains
setup_equals
```

### 9.1 纪律评分配置化

纪律评分不写死在代码里，应由配置文件驱动：

```text
backend/app/rules/discipline_scoring_rules.yaml
```

工程原因：

- 分值和一票否决规则会随着交易系统迭代而变化；
- 配置变化应通过测试验证，而不是修改业务代码；
- 这和 `price_action_rules.yaml` 的规则引擎思路一致。

评分服务要求：

```text
1. load scoring YAML
2. apply veto_rules first
3. apply penalties / bonuses second
4. clamp score to 0-100
5. return score, score_band, triggered_rules, veto_reason
```

Blocker 级错误可以配置为 veto，例如无止损下单、止损后无新结构立刻反手。

---

## 10. 日志与可观测性

后端至少应该有结构化日志：

```text
event=create_trade trade_id=123 status=planned
rule_evaluated trade_id=123 rule_id=every_order_must_have_stop_loss result=blocked
trade_closed trade_id=123 final_r=1.4 discipline_score=86
```

目的：以后出现 bug 时可以定位问题，也能训练真实工程中的 debugging 思维。

---

## 11. 安全和风控边界

这个工具涉及交易，但 MVP 不做真实下单。

工程边界：

```text
默认本地运行
不存 broker password
不自动下单
不自动平仓
不提供财务建议
所有提醒都是纪律检查，不是盈利保证
```

未来如果接 broker API，必须单独设计：

```text
只读模式优先
paper trading 优先
真实账户必须手动确认
所有 API key 使用 .env，不提交到 Git
增加 emergency stop
增加 position risk limit
```

---

## 12. Definition of Done

每个 Stage 完成必须满足：

```text
1. 功能按本 Stage scope 完成。
2. 没有跳到未来阶段。
3. 后端测试通过。
4. 前端可以 build 或运行。
5. README 或 docs 有必要更新。
6. Codex 输出 changed files / run commands / tests / learning points。
7. 用户可以理解这一阶段学到了什么。
8. 可以形成一个清晰 commit。
```

---

## 13. 每阶段学习日志模板

```markdown
## Stage X - Title

### Date

### What changed

### Commands I ran

### Tests

### Engineering concepts learned

### Trading discipline concepts encoded

### Bugs / debugging notes

### Next stage
```

---

## 14. Codex 使用纪律

给 Codex 的限制：

```text
- One stage at a time.
- No auto-trading.
- No hidden large refactor.
- No deleting existing docs without asking.
- Always add or update tests for backend logic.
- Always explain architecture decisions.
- Always provide commands to verify.
```

当 Codex 代码太多、太快时，用这个 prompt 拉回来：

```text
Stop expanding scope. Please keep this stage small and production-like. Refactor only what is necessary, add tests, and explain the tradeoff.
```

---

## 15. 推荐执行顺序

在原有 Stage 0-11 基础上，加入工程化质量门槛：

```text
Stage 0: Repo structure + docs + README
Stage 1: Backend domain models + SQLite + tests
Stage 2: YAML rules + rule engine + tests
Stage 3: API routes + API tests
Stage 4: Frontend shell + typed API client
Stage 5: Pre-trade checklist UI + rule alerts
Stage 6: Open trade management UI + state management decision
Stage 7: Post-trade review + config-driven discipline scoring
Stage 8: Dashboard + daily summary
Stage 9: Rules Library
Stage 10: CSV import research / read-only import
Stage 11: CI + lint + docs polish
Stage 12: Engineering hardening: logging, event log, backup/export, CI; refine error format only if needed
```

---

## 16. 最重要的取舍

大厂式工程不是一开始把系统做得很复杂，而是每一步都可验证、可维护、可解释。

这个项目应该坚持：

```text
Small scope
Clear domain model
Typed contracts
Automated tests
Visible tradeoffs
Clean commits
Documented learning
```
# Stage 22 operations

Keep monitoring disabled during tests, use fake market/email providers, migrate
before startup, and verify Compose forwards SMTP secrets only at runtime.
# Stage 23 verification note

After pulling Stage 23, run `alembic upgrade head` before starting the backend. Operational health is process-local: restarting the backend clears last-cycle, last-refresh, and monitor-error timestamps until the next cycle. Verify automatic and manual price provenance separately, and never treat the status endpoint as a source of SMTP credentials.
## Stage 24 operational checks

When changing a state that can resolve an Attention item, invalidate the `attention` TanStack Query prefix so open Attention views update immediately. Test deep links both through in-app navigation and a full page reload. Attention sources must disappear when resolved; historical successful email delivery is never an active item.
## Stage 25 state and audit workflow

Before adding component data state, classify it as server state, edit draft, UI-only state, or derived data. Server state must use an existing query key or add one. Every mutation must declare its invalidation scope. Keep cached data rendered while refetching and show stale/error context without replacing it with an empty page.

Domain services append WorkflowEvent rows before their existing commit so state and audit succeed or fail together. Email outcome events are appended after each SMTP attempt and committed with the durable delivery state. Planning-attempt events require a client session ID and explicit idempotency key. Never place secrets, full notes, or raw request bodies in event data.

## Stage 26 analytics checks

Define each metric's source, ownership timestamp, numerator, denominator, filters, and null behavior before implementation. Date tests must cover the instant before and at the exclusive UTC end boundary. Include LEAP filtering and an options Underlying R case.

Analytics query keys include all filters. Relevant writes invalidate the `analytics` prefix; the page uses a five-minute stale time with no focus refetch. Future metric changes must update `discipline_analytics_definitions.md`.

## Stage 27 taxonomy checks

Treat taxonomy values as API contracts: define them once per layer, validate at boundaries, and test frontend/backend parity. Migration mappings must be conservative and self-contained. JSON multi-select values are ordered and deduplicated after validation; unsupported values fail cleanly. Test legacy payloads and rows separately from new UI requirements.
