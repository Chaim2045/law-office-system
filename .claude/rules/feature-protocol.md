# FEATURE PROTOCOL — strict execution order

**Source:** referenced from `CLAUDE.md` via `@.claude/rules/feature-protocol.md`. Loaded every session alongside CLAUDE.md.

**Rule:** Every feature follows these steps in order. Never skip. Never jump ahead. Never expand scope mid-step.

## Steps

| # | Step | What | Tool / Agent | Mandatory? |
|---|------|------|--------------|------------|
| 0 | **Work Session Check** | Verify no open work blocks new task | `work-session-gatekeeper.sh` hook (UserPromptSubmit) | YES — iron protocol |
| 1 | **Intent** | Haim defines what to build; Lead Agent refines via `/intent` if vague | (Haim + Lead Agent) | YES |
| 1a | **Effort Scaling** | Decide LIGHT/MEDIUM/HEAVY before dispatching agents | `effort-scaler` agent | Required when >3 sub-agents will run |
| 2 | **Investigation** | Map flow, read code, find edge cases. **NO planning, NO code** | backend / frontend / data-investigator / security (in parallel) | YES |
| 2a | **Completeness Check** | Scan for loose ends not in original scope | `completeness-checker` agent | YES — before checkpoint |
| 3 | **Checkpoint** | Present findings to Haim with `AskUserQuestion`. Wait for approval | (Lead Agent → Haim) | YES |
| 4 | **Planning** | Plan ONLY approved scope. No expansion | (Lead Agent) | YES if scope ≥ trivial |
| 5 | **Code** | Implement only after step 3 approval | (Lead Agent + workers) | — |
| 6 | **Gates** | Run grader. Prove with evidence (PASS/FAIL only). Grader covers code review + PROD safety. | `outcomes-grader` | YES before PR |
| 6a | **Evaluator-Optimizer** | If grader = FAIL, auto-retry up to 3 times | `evaluator-optimizer` | Triggered on FAIL |

## Constraints

- **No code before step 3 approval.** Investigation must produce findings, not patches.
- **Completeness-checker findings MUST appear in the AskUserQuestion of the checkpoint.** Hidden findings = process violation.
- **Effort-scaler skipped only if obvious LIGHT** (single file, single function, ≤20 lines change). Mark explicitly: "skipping effort-scaler — task is obviously LIGHT".
- **Evaluator-Optimizer never bypasses an assertion or skips a test** to make grader pass. After 3 failed retries → escalate to Haim with root-cause hypothesis + suggested manual fix.
- **Parallelization:** in step 2, fan out workers in parallel where their work is independent. Lead Agent aggregates.
- **Recursive spawning forbidden:** sub-agents may RECOMMEND other agents but never SPAWN them. Only the Lead Agent spawns sub-agents.

## Why this order

- Investigation before planning → planning before code → prevents solving the wrong problem (Anthropic best practice: "explore first, then plan, then code").
- Gatekeeper hook first → ensures no orphan work / partial branches block new task.
- Completeness-check before checkpoint → Haim gets full picture, not partial.
- Grader before PR → prevents bloated/incomplete PR open. Grader subsumes prior `code-reviewer` + `prod-gatekeeper` roles.

## Related

- Agent specs: `.claude/agents/*.md`
- Decision point rule (when to consult agent): `.claude/rules/decision-point.md`
- Quality gates: `.claude/rubrics/_PRODUCT-GRADE-GATES.md`
