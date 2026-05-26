# AGENT RULES — when each sub-agent is mandatory

**Source:** referenced from `CLAUDE.md` via `@.claude/rules/agent-rules.md`. Loaded every session.

## Team structure (post-refactor 2026-05-26)

**Lead Agent (Orchestrator)** — the main Claude Code session. Defined in `CLAUDE.md`. Spawns sub-agents, never delegates orchestration.

**Product Owner — Haim.** Approves scope, plans, PROD deploys.

**11 sub-agents** organized by function:

| Layer | Agents |
|-------|--------|
| **Workers (4)** | `backend-firebase-expert`, `frontend-ui-expert`, `data-investigator`, `security-access-expert` |
| **Quality (2)** | `outcomes-grader`, `testing-quality-expert` |
| **Challenger (1)** | `devils-advocate` |
| **Meta (3)** | `effort-scaler`, `completeness-checker`, `evaluator-optimizer` |
| **Ops (1)** | `ops` |

**Hooks (automatic — no agent invocation needed):**
- `SessionStart` → `work-session-gatekeeper.sh` (replaces former work-session-gatekeeper agent)
- `PreToolUse on Bash` → `require-outcomes-pass.sh` (blocks bad PR creates)
- `SubagentStart` → `log-agent-usage.sh` (usage telemetry)

**Slash commands (not agents):**
- `/intent` — refine vague request into Intent statement
- `/refactor` — refactoring guidance
- `/perf` — performance guidance

## Outcomes Grader (subsumes code-reviewer + prod-gatekeeper)

**Trigger:** Before opening ANY PR.
**What:** Evaluates work against rubric `.claude/rubrics/<scope>.md` + global gates + Code Review 6-stage + PROD Safety layer + Anti-Premature Closure check.
**Returns:** VERDICT = `PASS` / `PASS_WITH_WARNINGS` / `FAIL`.
**Constraints:** FAIL blocks PR open. Read-only. Separate context (no bias from Lead Agent's reasoning).
**Spec:** `.claude/agents/outcomes-grader.md`

## Effort Scaler

**Trigger:** Before dispatching >3 sub-agents in parallel.
**What:** Classifies task as `LIGHT (1-3 agents)` / `MEDIUM (4-7)` / `HEAVY (8-15)` + recommended agents.
**Returns:** Verdict + agent list.
**Model:** Haiku (fast, cheap).
**Why:** Don't waste tokens on simple tasks; don't under-resource big ones.
**Reference:** [Anthropic Multi-Agent Research System](https://www.anthropic.com/engineering/multi-agent-research-system) — sweet spot 3-5 parallel agents.
**Spec:** `.claude/agents/effort-scaler.md`

## Completeness Checker

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

## Evaluator-Optimizer

**Trigger:** When `outcomes-grader` returns FAIL.
**What:** Auto-fix attempts up to 3 retries.
**After 3 failures:** Escalate to Haim with:
- attempts + reasoning per attempt
- root-cause hypothesis
- suggested manual fix

**FORBIDDEN:**
- Bypassing an assertion to make grader pass
- Skipping a test to make grader pass
- Lowering the rubric severity

**Reference:** [Anthropic Evaluator-Optimizer pattern](https://www.anthropic.com/engineering/building-effective-agents).
**Spec:** `.claude/agents/evaluator-optimizer.md`

## Devils Advocate

**Trigger:** Lead Agent invokes before any high-stakes decision:
- Merge to `production-stable`
- Schema change
- Security rule change
- Refactor >100 lines
- Data migration

**What:** Returns 5 attacks on the proposal, each backed by file:line evidence, each with possible defense.
**Constraint:** Read-only on code. Cannot write/commit/merge. Recommendations only.
**Spec:** `.claude/agents/devils-advocate.md`

## Pre-PR Hook

**File:** `.claude/hooks/require-outcomes-pass.sh`.
**Trigger:** `gh pr create` command.
**Blocks if:**
- No rubric file in `.claude/rubrics/`
- No `VERDICT: PASS` / `PASS_WITH_WARNINGS` in PR body
- No `PRODUCT-GRADE GATES` section in PR body
- Any gate (G1-G7) marked FAIL

**Hook severity:** `deny`. **Cannot bypass.**
**If blocked:** Fix the grader artifact / PR body. Do NOT disable the hook.

## Session-Start Hook (Work Session Gatekeeper)

**File:** `.claude/hooks/work-session-gatekeeper.sh`.
**Trigger:** `SessionStart` event (once per Claude Code session).
**What:** Reports open work to Lead Agent as `additionalContext`:
- Uncommitted changes
- Stash entries
- Local branches not merged to main
- Active worktrees
- Open PRs (via gh)
- Deploy drift (main vs production-stable)

**Lead Agent action:** Before starting any new task, check the summary. If open work overlaps with new request — recommend continuing existing work. Otherwise flag the open work to Haim and ask how to proceed.

## Agent Usage Telemetry

**Hook:** `.claude/hooks/log-agent-usage.sh` writes every sub-agent invocation to `.claude/logs/agent-usage.jsonl` (gitignored).

**Quarterly routine:**
1. Run `bash .claude/scripts/agent-usage-report.sh`
2. Review dormant agents (0 invocations over the quarter) — candidates for further consolidation
3. Review co-occurrence patterns (always together) — candidates for merge
4. If 2+ agents dormant → consolidation PR recommended

**Anthropic baseline:** Lead + 2-4 workers + grader = 4 roles. Current project: 11 agents — within Anthropic's "complex research" tier (5-10+). Watch for drift back toward bloat.

## Recursive spawning — FORBIDDEN

Sub-agents may **recommend** other agents in their output. They may **never spawn** them.
**Only the Lead Agent spawns sub-agents.**

This is the explicit Anthropic anti-pattern: a sub-agent that spawns sub-agents creates exponential token cost and coordination chaos.

## Decision-point rule

See `.claude/rules/decision-point.md`. Before any `AskUserQuestion` choosing approach/scope/architecture — Lead Agent MUST consult the relevant specialist first and present the verdict alongside the choices.
