# Codex Prompts for Trading Discipline Copilot

> 用途：这份文件集中保存所有可以直接发给 Codex 的 prompt。  
> 项目：Trading Discipline Copilot，一个本地运行的交易纪律检查、持仓提醒、复盘记录网页应用。  
> 配套文档：`docs/product_design.md` 和 `docs/codex_implementation_plan.md`。  
> 使用原则：一次只让 Codex 做一个阶段；每阶段结束都要能运行、能测试、能学习、能 commit。

---

## 0. 使用方式

每次开发时，建议按这个顺序和 Codex 互动：

```text
1. 发送当前 Stage 的开发 prompt。
2. Codex 完成后，先运行它给出的命令。
3. 如果报错，复制错误信息给 Codex，让它只修复当前错误。
4. 确认可运行后，让 Codex 解释本阶段你应该学会什么。
5. 手动 commit。
6. 再进入下一个 Stage。
```

不要一次性要求 Codex 完成所有阶段。这个项目同时是交易纪律工具，也是 full-stack 学习项目。

### 0.1 Universal Scope Guard：每次发给 Codex 都可以附加

```text
Before writing code, first output:
1. Stage goal.
2. Proposed git branch name for this stage, using `stage-X-short-name`, `feature/short-name`, `fix/short-name`, or `refactor/short-name`.
3. Current git branch and whether you need to create/switch to the proposed branch.
4. Files/directories you plan to modify.
5. Files/directories you will NOT modify.
6. A short self-review against docs/product_design.md.
7. What you are intentionally deferring.

Then:
- Create or switch to the proposed branch before editing files.
- Implement only the requested stage.
- Do not change unrelated files.
- Do not add auto-trading or broker write actions.

At the end, provide exact commands for:
- verification/tests
- git status
- git add
- git commit
- git push -u origin <branch-name>

Do not run `git commit` or `git push` unless I explicitly ask.
```

### 0.2 Git Branch / Commit / GitHub Push Overlay：每次开发都附加

```text
Git workflow requirements:
- Do not work directly on main.
- Before editing files, check the current branch.
- If the current branch is main, create a new branch for the requested stage or feature.
- Use branch names like:
  - stage-0-project-setup
  - stage-1-backend-database
  - stage-2-rule-engine
  - stage-3-api-contracts
  - stage-4-frontend-shell
  - stage-5-pre-trade-checklist
  - stage-6-open-trade-management
  - stage-7-post-trade-review
  - feature/rules-library
  - fix/api-error-envelope
  - refactor/rule-engine
- If there are uncommitted changes before switching branches, stop and ask me what to do.
- Keep one stage or one feature per branch.
- At the end, do not commit or push automatically unless I explicitly ask.
- Instead, provide exact commands for me to run:
  1. git status
  2. verification commands
  3. git add ...
  4. git commit -m "..."
  5. git push -u origin <branch-name>
```

Recommended stage-start commands for Codex:

```bash
git status --short
git branch --show-current
git checkout -b stage-X-short-name
```

Recommended final command block format:

```bash
# Verify
python -m pytest
npm run build

# Inspect
git status

# Commit
git add <changed-files>
git commit -m "type(scope): concise summary"

# Push branch to GitHub
git push -u origin <branch-name>
```

---



## 1. 给 Codex 的项目总指令

```text
We are building a local web app called Trading Discipline Copilot.

The goal is to turn my price action trading mindmap and trading discipline rules into a practical tool for:
1. Pre-trade checklist before entering a trade.
2. Open-trade management after entry.
3. Post-trade review after exit.
4. Daily discipline summary.

Please follow these documents:
- docs/product_design.md
- docs/codex_implementation_plan.md
- docs/engineering_workflow.md

Important principles:
- This is not an auto-trading bot.
- Do not implement automated order execution.
- Build the app stage by stage.
- Do not jump ahead unless I explicitly ask.
- Keep the code simple, readable, and testable.
- Before coding, check the current git branch and create or switch to a stage-specific branch. Do not work directly on main.
- Before coding, list the files/directories you will NOT modify in this stage.
- Before coding, briefly self-review the plan against product_design.md and explain what will be implemented and what will be deferred.
- At the end of each stage, summarize:
  - changed files
  - how to run
  - tests added
  - what I should learn from this stage
  - exact git status / git add / git commit / git push commands for this branch

Recommended stack:
- Backend: FastAPI + SQLite + SQLAlchemy + Alembic + Pydantic + PyYAML
- Frontend: React + TypeScript + Vite, with Zustand or React Context introduced when shared state becomes painful
- Rules: YAML rules loaded by backend
- Testing: pytest for backend, frontend tests later
```

---

## 2. Stage 0 Prompt：项目初始化和文档落地

```text
We are building a local web app called Trading Discipline Copilot.

Please follow docs/product_design.md and docs/codex_implementation_plan.md.
Start with Stage 0 only.

Before editing files:
- Check the current git branch.
- If on main, create a new branch named `stage-0-project-setup`.
- Do not work directly on main.

Requirements:
- Create the project structure.
- Add README.md.
- Add docs/product_design.md and docs/codex_implementation_plan.md if not already present.
- Add docs/learning_log.md with the learning template.
- Add backend/requirements.txt.
- Add a minimal frontend/package.json placeholder if needed.
- Do not implement the full app yet.

At the end, summarize:
- changed files
- commands to run
- what I should learn from this stage
- exact git status / git add / git commit / git push commands
```

---

## 3. Stage 1 Prompt：后端数据模型和 SQLite 持久化

```text
Continue to Stage 1 only. Do not jump ahead.
Before editing files, create or switch to branch `stage-1-backend-database` if needed. Do not work directly on main.

Goal:
Implement backend data models and SQLite persistence for Trading Discipline Copilot.

Requirements:
- Create a minimal FastAPI backend structure.
- Add GET /health.
- Use local SQLite + SQLAlchemy for persistence.
- Configure Alembic in Stage 1 and create the initial migration.
- Define core models/schemas for Trade, Alert, Review, and ChecklistAnswer.
- Implement database initialization through migrations, not ad-hoc table creation only.
- Implement a service function that can create a planned trade.
- Add backend tests proving that the database initializes and a planned trade can be created.

Suggested files:
- backend/app/main.py
- backend/app/database.py
- backend/app/models.py
- backend/app/schemas.py
- backend/app/services/trade_service.py
- backend/alembic.ini
- backend/alembic/env.py
- backend/alembic/versions/<initial_migration>.py
- backend/tests/test_database.py
- backend/requirements.txt

Trade fields for v0.1:
- id
- created_at
- updated_at
- symbol
- market
- direction
- setup
- market_context
- planned_entry
- actual_entry
- stop_loss
- target_1
- target_2
- runner_enabled
- runner_active
- position_size
- risk_per_trade
- status
- exit_price
- exit_reason
- final_r
- followed_plan
- discipline_score
- notes

At the end, summarize:
- changed files
- how to run backend
- how to run Alembic migration
- how to run tests
- what I should learn from this stage
- exact git status / git add / git commit / git push commands
```

---

## 4. Stage 2 Prompt：规则 YAML 和 Rule Engine

```text
Continue to Stage 2 only. Do not jump ahead.
Before editing files, create or switch to branch `stage-2-rule-engine` if needed. Do not work directly on main.

Goal:
Turn the trading discipline rules into machine-readable YAML and implement the first rule engine.

Requirements:
- Create backend/app/rules/price_action_rules.yaml.
- Add the MVP rules below:
  1. every_order_must_have_stop_loss
  2. no_reverse_trade_immediately_after_stop_loss
  3. breakout_needs_follow_through
  4. trading_range_second_leg_trap
  5. trading_range_big_bar_reversal_risk
  6. take_profit_and_let_runner_run
  7. green_trade_should_not_go_red
  8. runner_must_have_protection
- Implement backend/app/services/rule_engine.py.
- The rule engine should load YAML rules and evaluate a trade draft or open trade.
- Support field-to-value conditions such as missing, equals, greater_than, less_than.
- Reserve and test field-to-field conditions with compare_field, such as greater_than_field and less_than_field, for entry/stop/target validation.
- It should return a status: allowed, warning, or blocked.
- It should return alert objects with rule_id, severity, message, checklist, and discipline_sentence.
- Add tests for blocker, warning, reminder behavior, and at least one compare_field rule.

Important behavior:
- If stop_loss is missing for a planned trade, return blocked.
- If setup is breakout and follow-through is not confirmed, return warning.
- If an open trade reaches 1R and no partial profit is marked, return reminder.
- If runner is active but runner_stop is missing, return warning/reminder.

At the end, summarize:
- changed files
- rule YAML format
- how the rule engine works
- how to run tests
- what I should learn from this stage
- exact git status / git add / git commit / git push commands
```

---

## 5. Stage 3 Prompt：后端 API

```text
Continue to Stage 3 only. Do not jump ahead.
Before editing files, create or switch to branch `stage-3-api-contracts` if needed. Do not work directly on main.

Goal:
Expose backend APIs needed by the frontend.

Implement these endpoints:
- GET /health
- GET /trades
- POST /trades
- GET /trades/{trade_id}
- PATCH /trades/{trade_id}
- POST /trades/{trade_id}/open
- POST /trades/{trade_id}/close
- POST /trades/{trade_id}/cancel
- GET /rules
- POST /rules/evaluate
- POST /trades/{trade_id}/review
- GET /summary/daily

Behavior:
- POST /trades creates a planned trade.
- POST /rules/evaluate evaluates a trade draft or existing trade using the rule engine.
- POST /trades/{id}/open changes a planned trade to open.
- POST /trades/{id}/close records exit information and changes status to closed.
- POST /trades/{id}/review saves a review and calculates discipline score if the review service exists; otherwise create a clean placeholder for Stage 7.
- All validation and business errors must use the consistent error response envelope:
  {"error": {"code": "...", "message": "...", "details": {...}}}.

Add API tests for:
- health check
- creating a trade
- listing trades
- evaluating rules
- opening a trade
- closing a trade
- standardized API error responses

At the end, include:
- changed files
- example curl commands
- how to run tests
- what I should learn about REST API design
- exact git status / git add / git commit / git push commands
```

---

## 6. Stage 4 Prompt：前端初始化和基础布局

```text
Continue to Stage 4 only. Do not jump ahead.
Before editing files, create or switch to branch `stage-4-frontend-shell` if needed. Do not work directly on main.

Goal:
Create the React + TypeScript frontend shell for Trading Discipline Copilot.

Requirements:
- Use Vite + React + TypeScript.
- Create src/api.ts for backend calls.
- Create src/types.ts for shared frontend types.
- Create these components or pages:
  - Dashboard
  - TradeChecklist
  - RuleAlertPanel
  - OpenTradePanel
  - PostTradeReview
  - DailySummary
  - RulesLibrary
- Use simple tab state in App.tsx for navigation. Do not add complex routing yet.
- Add a backend connection check on Dashboard using GET /health.
- Keep styling simple and readable.

At the end, summarize:
- changed files
- how to run frontend
- how frontend talks to backend
- what React concepts I should learn here
- exact git status / git add / git commit / git push commands
```

---

## 7. Stage 5 Prompt：交易前检查页面

```text
Continue to Stage 5 only. Do not jump ahead.
Before editing files, create or switch to branch `stage-5-pre-trade-checklist` if needed. Do not work directly on main.

Goal:
Implement the New Trade Checklist page, which is the most important MVP feature.

Requirements:
- Implement TradeChecklist.tsx as a controlled form.
- Fields:
  - symbol
  - market
  - direction
  - setup
  - market_context
  - planned_entry
  - stop_loss
  - target_1
  - target_2
  - runner_enabled
  - position_size
  - notes
  - follow_through_confirmed if needed for breakout rules
  - recent_stop_loss if needed for reverse-after-stop rules
- As planned_entry, stop_loss, and target_1 change, calculate and display Risk/Reward and target R.
- If risk <= 0 for the selected direction, show a Blocked state or field error.
- When the user edits fields, call POST /rules/evaluate.
- Display alerts in RuleAlertPanel.
- Show final status: Allowed / Warning / Blocked.
- If status is blocked, disable Create Trade Plan.
- If status is warning, allow Create Trade Plan but show a clear confirmation message.
- Create Trade Plan should call POST /trades and save a planned trade.
- src/api.ts must parse the Stage 3 error envelope into frontend-friendly errors.

Important reminders to support:
- Missing stop loss = Blocked.
- Breakout without confirmed follow-through = Warning.
- Trading Range extreme chasing = Warning if relevant fields are available.
- Recent stop loss and immediate reverse trade = Blocked or Warning depending on confirmation.

Risk/Reward calculation:
- Long: risk = planned_entry - stop_loss; target_r = (target_1 - planned_entry) / risk.
- Short: risk = stop_loss - planned_entry; target_r = (planned_entry - target_1) / risk.
- If risk <= 0, the plan is structurally invalid.

At the end, summarize:
- changed files
- how form state works
- how rule alerts are rendered
- how to test manually in the browser
- what I should learn from this stage
- exact git status / git add / git commit / git push commands
```

---

## 8. Stage 6 Prompt：持仓管理页面

```text
Continue to Stage 6 only. Do not jump ahead.
Before editing files, create or switch to branch `stage-6-open-trade-management` if needed. Do not work directly on main.

Goal:
Implement Open Trade Management for trades that are already open.

Requirements:
- Display all open trades.
- Each open trade should show:
  - symbol
  - direction
  - actual_entry
  - current_stop
  - target_1
  - target_2
  - runner_enabled
  - runner_active
  - runner_stop
  - notes
- Add buttons/actions:
  - Mark Entry Filled or Open Trade if still planned
  - Partial Profit Taken
  - Move Stop to Breakeven
  - Move Stop by Structure
  - Runner Active
  - Runner Closed
  - Exit Trade
  - Add Note
- Allow manual current_price input.
- Calculate current R.
- For long:
  risk = entry - stop
  current_r = (current_price - entry) / risk
- For short:
  risk = stop - entry
  current_r = (entry - current_price) / risk
- If current_r >= 1 and partial profit is not marked, show a take-profit reminder.
- If runner_active is true but runner_stop is empty, show a runner protection reminder.
- Decide whether to introduce Zustand or React Context in this stage.
  - If planned/open/closed trades or alerts are shared across pages, add a lightweight store.
  - If local state is still acceptable, explain why and document when to revisit.

At the end, summarize:
- changed files
- R calculation logic
- how state updates and PATCH API work
- whether local state, Context, or Zustand is being used and why
- manual testing steps
- what I should learn from this stage
- exact git status / git add / git commit / git push commands
```

---

## 9. Stage 7 Prompt：平仓复盘和纪律评分

```text
Continue to Stage 7 only. Do not jump ahead.
Before editing files, create or switch to branch `stage-7-post-trade-review` if needed. Do not work directly on main.

Goal:
Implement post-trade review and discipline scoring.

Requirements:
- Implement backend/app/services/review_service.py.
- Implement PostTradeReview.tsx.
- For closed trades, allow the user to fill:
  - exit_price
  - exit_reason
  - final_r
  - followed_plan
  - mistake_tags
  - lesson
  - notes
- Calculate discipline_score from mistake tags and positive actions using discipline_scoring_rules.yaml.
- Classify the trade into:
  - good trade, winner
  - good trade, loser
  - bad trade, winner
  - bad trade, loser

Scoring v0.2:
- Create backend/app/rules/discipline_scoring_rules.yaml.
- Load scoring rules from YAML instead of hardcoding the numbers in Python.
- Support:
  - base_score
  - penalties
  - bonuses
  - veto_rules
  - score_bands
- Veto behavior:
  - If mistake_tags include a blocker-level veto such as no_stop_loss, discipline_score should be 0.
  - Return and display veto_reason.
- If no veto rule is hit, apply penalties and bonuses, then clamp final score between 0 and 100.

At the end, summarize:
- changed files
- scoring YAML format
- scoring logic and veto behavior
- tests added
- why trade quality is different from PnL
- what I should learn from this stage
- exact git status / git add / git commit / git push commands
```

---

## 10. Stage 8 Prompt：Dashboard 和 Daily Summary

```text
Continue to Stage 8 only. Do not jump ahead.
Before editing files, create or switch to branch `stage-8-dashboard-daily-summary` if needed. Do not work directly on main.

Goal:
Implement Dashboard and Daily Discipline Summary.

Requirements:
- Backend: implement GET /summary/daily.
- Aggregate today's:
  - number of trades
  - net R
  - average discipline score
  - number of warnings or violations
  - green-to-red count
  - revenge trade count
  - most frequent mistake_tags
- Frontend Dashboard should display summary cards.
- DailySummary should show a readable list of today's main mistakes and lessons.
- Handle empty state when there are no trades today.

At the end, summarize:
- changed files
- aggregation logic
- how dashboard cards are rendered
- how to test with sample trades
- what I should learn from this stage
- exact git status / git add / git commit / git push commands
```

---

## 11. Stage 9 Prompt：Rules Library 规则库页面

```text
Continue to Stage 9 only. Do not jump ahead.
Before editing files, create or switch to branch `stage-9-rules-library` if needed. Do not work directly on main.

Goal:
Implement the Rules Library page so the trading rules are visible and searchable.

Requirements:
- GET /rules should return all YAML rules.
- RulesLibrary.tsx should display rule cards.
- Each card should show:
  - rule name
  - category
  - stage
  - severity
  - message
  - checklist
  - avoid
  - discipline_sentence
- Add filters for:
  - stage
  - severity
  - category
- Keep the UI simple and readable.

At the end, summarize:
- changed files
- how YAML rules become UI cards
- how filters work
- what I should learn from this stage
- exact git status / git add / git commit / git push commands
```

---

## 12. Stage 10 Prompt：CSV 导入预留

```text
Continue to Stage 10 only. Do not jump ahead.
Before editing files, create or switch to branch `stage-10-csv-import-preview` if needed. Do not work directly on main.

Goal:
Add a CSV import workflow for future semi-automated review, without connecting to any real broker or placing trades.

Requirements:
- Design a simple CSV format with columns:
  - symbol
  - side
  - entry_time
  - exit_time
  - entry_price
  - exit_price
  - size
  - pnl
- Add a backend CSV parser service.
- Add an API endpoint for CSV upload.
- Add a simple frontend import section or page.
- Imported rows should create closed trade drafts.
- The user should still manually add setup, market_context, mistake_tags, and review.
- Do not connect to broker APIs.
- Do not implement automated trading.

At the end, summarize:
- changed files
- CSV format
- how import works
- why this is for review only, not auto-trading
- what I should learn from this stage
- exact git status / git add / git commit / git push commands
```

---

## 13. Stage 11 Prompt：打磨、测试、README 和学习总结

```text
Continue to Stage 11 only. Do not jump ahead.
Before editing files, create or switch to branch `stage-11-polish-tests-readme` if needed. Do not work directly on main.

Goal:
Polish the MVP so it is maintainable and useful as a long-term learning project.

Requirements:
- Update README with:
  - project purpose
  - backend setup
  - frontend setup
  - how to run tests
  - full workflow example
- Add or improve backend tests.
- Check frontend empty states, loading states, and error states.
- Add sample trades and sample rules if useful.
- Update docs/learning_log.md with a summary of all stages completed.
- Verify the full workflow:
  1. Open Dashboard.
  2. Create new trade plan.
  3. Get blocked if stop loss is missing.
  4. Add stop loss.
  5. See warning for breakout without FT.
  6. Create planned trade.
  7. Mark trade open.
  8. Enter current price reaching 1R.
  9. Get partial profit reminder.
  10. Mark partial profit and runner active.
  11. Close trade.
  12. Fill post-trade review.
  13. See discipline score in Dashboard.

At the end, summarize:
- changed files
- final run commands
- final test commands
- known limitations
- what I learned across the whole project
- exact git status / git add / git commit / git push commands
```

---

## 14. 每阶段完成后的解释 Prompt

```text
Please explain this stage to me as a full-stack learning exercise.

Focus on:
- What files were changed and why.
- What each important function/component does.
- What new concepts I should understand.
- How data flows through the app.
- How to test this stage manually.
- What mistakes beginners often make here.

Please keep the explanation practical and connected to this project.
```

---

## 15. 报错修复 Prompt

```text
I ran the command and got the following error.

Please debug only this error. Do not refactor unrelated code and do not jump to the next stage.

Command I ran:
[PASTE COMMAND]

Error output:
[PASTE ERROR]

Please explain:
- root cause
- exact files to change
- why the fix works
- command to rerun
```

---

## 16. 代码审查 Prompt

```text
Please review the current implementation for this stage.

Focus on:
- Whether it matches docs/product_design.md.
- Whether it matches the current stage in docs/codex_implementation_plan.md.
- Whether there is unnecessary complexity.
- Whether the code is readable for a beginner full-stack learner.
- Whether important edge cases are missing.

Do not implement the next stage. Only suggest or make improvements within the current stage.
```

---

## 17. 学习日志更新 Prompt

```text
Please update docs/learning_log.md for the stage we just completed.

Use this format:

## Date
YYYY-MM-DD

## Stage
Stage X - Name

## What I built
A concise description of what was completed.

## Concepts learned
- Concept 1
- Concept 2
- Concept 3

## Files changed
- file 1
- file 2

## Commands used
```bash
command 1
command 2
```

## Bugs / Confusions
- Anything that was confusing or caused errors.

## Next step
What we should build in the next stage.
```

---

## 18. Git Commit 总结 Prompt

```text
Please summarize the current stage for git commit and GitHub push.

Give me:
1. current branch interpretation and whether it matches this stage
2. git status interpretation
3. files changed grouped by purpose
4. one recommended conventional commit message
5. one slightly more detailed commit message option
6. commands to run before committing
7. exact commands to commit and push this branch to GitHub

Use this final format:

```bash
# Verify
[tests/build commands]

# Inspect
git status

# Commit
git add [files]
git commit -m "type(scope): summary"

# Push branch to GitHub
git push -u origin [current-branch]
```

Do not run `git commit` or `git push` unless I explicitly ask.
```

---

## 19. 限制 Codex 不要做太多的 Prompt

```text
You implemented more than the requested stage.

Please stop expanding scope.
For now, only keep the code required for Stage [X].
Do not implement later-stage features yet.

Please identify:
- which changes belong to Stage [X]
- which changes belong to later stages
- what should be reverted or postponed
```

---

## 20. 当你想加入新交易规则时的 Prompt

```text
I want to add a new trading discipline rule to the app.

Rule idea:
[PASTE RULE]

Please help me convert it into the existing YAML rule format.
Include:
- id
- name
- category
- stage
- severity
- trigger
- conditions if possible
- checklist
- action
- avoid
- risk
- message
- discipline_sentence
- enabled

Do not change app logic yet unless the current rule engine already supports it.
If new condition operators are needed, explain them first.
```

---

## 21. 当你想从 Markdown 导图同步规则到 YAML 时的 Prompt

```text
Please read docs/trading_price_action_mindmap.md and compare it with backend/app/rules/price_action_rules.yaml.

Goal:
Find trading discipline rules that exist in the Markdown but are not yet represented in YAML.

Please output:
1. Missing rules list.
2. Suggested YAML entries.
3. Which rules can be supported by the current rule engine.
4. Which rules require new fields or new condition operators.

Do not implement changes yet. First show me the plan.
```

---

## 22. 当你想做 UI 优化时的 Prompt

```text
Please improve the UI readability without changing core business logic.

Focus on:
- Clear layout.
- Better spacing.
- More readable alert cards.
- Clear Allowed / Warning / Blocked states.
- Beginner-friendly component structure.

Do not add new features.
Do not change backend API contracts unless absolutely necessary.
At the end, summarize changed files and what UI concepts I should learn.
```

---

## 23. 当你想准备下一阶段前检查当前项目时的 Prompt

```text
Before moving to the next stage, please inspect the current project state.

Check:
- Does the current stage meet its acceptance criteria?
- Do backend tests pass?
- Does frontend run?
- Are there TypeScript errors?
- Are there TODOs that block the next stage?
- Is the code still aligned with docs/product_design.md?

Please do not implement the next stage yet. Only report readiness and small fixes if needed.
```

---

## 24. 最小可用闭环验收 Prompt

```text
Please verify the MVP end-to-end workflow.

Workflow:
1. Open Dashboard.
2. Create new trade plan.
3. If stop loss is missing, system blocks the trade.
4. Add stop loss.
5. If setup is breakout without FT, system shows warning.
6. Create planned trade.
7. Mark trade open.
8. Enter current price reaching 1R.
9. System reminds me to take partial profit.
10. Mark partial profit and runner active.
11. Close trade.
12. Fill post-trade review.
13. Dashboard shows daily summary and discipline score.

Please report:
- what works
- what fails
- exact fixes needed
- what commands I should run
```

---

## 25. 未来自动化追踪预研 Prompt，不用于第一版

```text
I want to explore future automation for tracking trades, but not implement it yet.

Please research and design possible approaches for:
- CSV import from broker statements
- manual trade journal import
- webhook-based trade event tracking
- local log parsing
- broker API read-only integration

Important constraints:
- Do not implement automated order execution.
- Do not place, modify, or cancel real trades.
- Focus on read-only tracking and post-trade review.

Please output:
- options
- pros and cons
- risk concerns
- recommended next step after MVP
```

---

## 26. 当前推荐开发顺序

```text
1. Stage 0: project docs and structure
2. Stage 1: backend models and SQLite
3. Stage 2: YAML rules and rule engine
4. Stage 3: backend API
5. Stage 4: frontend shell
6. Stage 5: pre-trade checklist
7. Stage 6: open-trade management
8. Stage 7: post-trade review and discipline scoring
9. Stage 8: dashboard and daily summary
10. Stage 9: rules library
11. Stage 10: CSV import preview
12. Stage 11: polish, tests, README
```

核心纪律：每次只做一个 Stage。Codex 如果开始发散，就用“限制 Codex 不要做太多的 Prompt”拉回来。

---

## 18. Engineering Mode Master Prompt：让 Codex 按真实工程流程开发

```text
From now on, develop this project in engineering mode.

Please follow:
- docs/product_design.md
- docs/codex_implementation_plan.md
- docs/engineering_workflow.md

Engineering mode requirements:
- Work one stage at a time.
- Keep scope small and production-like.
- Do not jump ahead.
- Before coding, check the current git branch and create or switch to a stage-specific branch. Do not work directly on main.
- Before coding, list files/directories that you will NOT modify in this stage.
- Before coding, self-review your plan against product_design.md and state what is deferred.
- Separate API routes, schemas, services, database, and rule engine logic.
- Add or update tests for backend business logic.
- Keep frontend API calls in a typed api.ts layer.
- Do not put all UI logic into App.tsx.
- Use clear error handling.
- Add docs or learning_log updates when behavior changes.
- At the end, explain engineering tradeoffs, changed files, verification commands, tests, and exact git status / git add / git commit / git push commands.

This project is a discipline tool, not an auto-trading bot.
Do not implement automated order execution.
```

---

## 19. Engineering Stage Prompt Template

```text
Continue to Stage [X] only in engineering mode.

Goal:
[Write the stage goal here]

Scope:
- [Item 1]
- [Item 2]
- [Item 3]

Engineering requirements:
- Keep the change small and reviewable.
- Update tests for any new backend logic.
- Keep business logic out of route handlers.
- Keep frontend API calls in api.ts.
- Do not introduce auto-trading or broker write actions.
- Update docs/learning_log.md with what I should learn.

Before coding:
- check the current git branch;
- create or switch to a stage-specific branch if needed;
- briefly state the plan;
- list files/directories you will modify;
- list files/directories you will NOT modify;
- self-review the plan against product_design.md and mention any intentional deferrals.

After coding, summarize:
- changed files
- commands to run
- tests added or updated
- engineering concepts I should learn
- trading discipline concepts encoded
- exact git status / git add / git commit / git push commands
```

---

## 20. Code Review Prompt

```text
Please review the current code like a senior engineer.

Focus on:
- scope creep
- architecture boundaries
- duplicated logic
- missing tests
- weak error handling
- confusing names
- data model issues
- API contract issues
- frontend components doing too much
- any accidental auto-trading risk

Do not rewrite everything.
Give me:
1. Must fix before commit.
2. Should fix later.
3. Nice to have.
4. Suggested small patch if needed.
```

---

## 21. Test Gap Prompt

```text
Please inspect this stage and identify missing tests.

Prioritize:
- rule engine blocker/warning/reminder behavior
- trade lifecycle state transitions
- discipline score calculation
- API validation errors
- frontend build safety

Then add only the highest-value tests for this stage.
Keep the patch small.
```

---

## 22. Architecture Decision Record Prompt

```text
Create an ADR for the current engineering decision.

Decision topic:
[Example: Use YAML for price action rules]

Please write it in docs/adr/ADR-[number]-[short-title].md with:
- Status
- Context
- Decision
- Alternatives considered
- Consequences
- How we will revisit this decision

Keep it concise and practical.
```

---

## 23. CI Setup Prompt

```text
Add a minimal CI workflow for this project.

Requirements:
- GitHub Actions workflow under .github/workflows/ci.yml
- Backend: install dependencies and run pytest
- Frontend: install dependencies and run npm run build
- Keep it simple
- Do not add deployment

After adding it, explain what CI checks and why this matters in real engineering teams.
```

---

## 24. Refactor Safely Prompt

```text
Refactor this code safely without changing behavior.

Requirements:
- Explain what is being refactored and why.
- Keep the diff small.
- Do not add new product features.
- Preserve existing tests.
- Add tests only if needed to lock behavior before refactor.
- Summarize before/after architecture.
```

---

## 25. Debugging Prompt

```text
I ran the command below and got this error.

Command:
[paste command]

Error:
[paste full error]

Please debug like an engineer:
1. Identify the likely root cause.
2. Explain how to verify it.
3. Make the smallest fix.
4. Tell me which command to rerun.
5. Do not change unrelated files.
```

---

## 26. PR Summary Prompt

```text
Write a pull request summary for the current changes.

Include:
- What changed
- Why it changed
- How to test
- Screenshots or API examples if relevant
- Risks / limitations
- Follow-up work

Use a concise engineering style.
```

---

## 27. Learning Review Prompt

```text
Explain this stage to me as a full-stack learner.

Please cover:
- What files matter and why
- What backend concepts I should understand
- What frontend concepts I should understand
- What tests prove
- How this resembles real engineering work
- What I should be able to explain before moving to the next stage
```
