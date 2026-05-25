# AGENT RULES — when each sub-agent is mandatory

**Source:** referenced from `CLAUDE.md` via `@.claude/rules/agent-rules.md`. Loaded every session.

## Work Session Gatekeeper (PR-META-1)

**Trigger:** Before ANY new task.
**What:** Verifies no orphan branches / open PRs / uncommitted work blocks the new task.
**Returns:** VERDICT = `GO` or `STOP`. If STOP — resolve open work first.
**Constraints:** Read-only on git. No exceptions.
**Spec:** `.claude/agents/work-session-gatekeeper.md`

## Outcomes Grader (PR-META-1)

**Trigger:** Before opening ANY PR.
**What:** Evaluates work against rubric `.claude/rubrics/<scope>.md` + global gates.
**Returns:** VERDICT = `PASS` / `PASS_WITH_WARNINGS` / `FAIL`.
**Constraints:** FAIL blocks PR open. Read-only. Separate context (no bias from Claude's reasoning).
**Spec:** `.claude/agents/outcomes-grader.md` + `.claude/docs/OUTCOMES-GRADER-USAGE.md`

## Effort Scaler (PR-META-1)

**Trigger:** Before dispatching >3 sub-agents in parallel.
**What:** Classifies task as `LIGHT (1-3 agents)` / `MEDIUM (4-7)` / `HEAVY (8-15)` + recommended agents.
**Returns:** Verdict + agent list.
**Model:** Haiku (fast, cheap).
**Why:** Don't waste tokens on simple tasks; don't under-resource big ones.
**Reference:** [Anthropic Multi-Agent Research System](https://www.anthropic.com/engineering/multi-agent-research-system) — sweet spot 3-5 parallel agents.
**Spec:** `.claude/agents/effort-scaler.md`

## Completeness Checker (PR-META-1)

**Trigger:** After investigation, BEFORE checkpoint.
**What:** Scans for loose ends not in original scope:
- adjacent bugs
- untracked files
- codebase drift
- backlog correlation
- stale comments
- documentation drift
- test gaps
- CI/deploy concerns

**Returns:** Severity-sorted list (🔴 critical / 🟡 important / 🟢 low) + recommendation per item.
**Constraint:** Findings MUST appear in the `AskUserQuestion` of the checkpoint. Hidden findings = process violation.
**Reference:** Anthropic "synthesis step" pattern.
**Spec:** `.claude/agents/completeness-checker.md`

## Evaluator-Optimizer (PR-META-1)

**Trigger:** When `outcomes-grader` returns FAIL.
**What:** Auto-fix attempts up to 3 retries.
**After 3 failures:** Escalate to Tommy with:
- attempts + reasoning per attempt
- root-cause hypothesis
- suggested manual fix

**FORBIDDEN:**
- Bypassing an assertion to make grader pass
- Skipping a test to make grader pass
- Lowering the rubric severity

**Reference:** [Anthropic Evaluator-Optimizer pattern](https://www.anthropic.com/engineering/building-effective-agents).
**Spec:** `.claude/agents/evaluator-optimizer.md`

## Pre-PR Hook (PR-META-1 + PR-META-3)

**File:** `.claude/hooks/require-outcomes-pass.sh`.
**Trigger:** `gh pr create` command.
**Blocks if:**
- No rubric file in `.claude/rubrics/`
- No `VERDICT: PASS` / `PASS_WITH_WARNINGS` in PR body
- No `PRODUCT-GRADE GATES` section in PR body
- Any gate (G1-G7) marked FAIL

**Hook severity:** `deny`. **Cannot bypass.**
**If blocked:** Fix the grader artifact / PR body. Do NOT disable the hook.

## Agent Usage Review (PR-META-2)

**Hook:** `.claude/hooks/log-agent-usage.sh` writes every sub-agent invocation to `.claude/logs/agent-usage.jsonl` (gitignored).

**Weekly routine:**
1. Run `bash .claude/scripts/agent-usage-report.sh`
2. Review dormant agents (0 invocations) — candidates for removal
3. Review co-occurrence patterns (always together) — candidates for merge
4. If 2+ agents dormant → consolidation PR recommended

**Anthropic baseline:**
- Code Review setup: 3 agents
- Research setup: 3-5 agents
- Current project: 20 agents → large pool. Weekly review prevents bloat.

**Goal:** Data-driven consolidation decisions, not theory.
