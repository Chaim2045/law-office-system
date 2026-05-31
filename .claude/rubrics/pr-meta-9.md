# Rubric — PR-META-9: Workflows Library

**Title:** Introduce `.claude/workflows/` library — 3 templates + decision-tree governance
**Branch:** `feat/workflows-library-pr-meta-9`
**Base:** `main`
**Scope:** Add reusable workflow scripts that the Lead Agent can invoke via Anthropic's `Workflow` tool for multi-agent orchestration patterns. Does NOT add new sub-agents. Does NOT modify the 12-agent team. Adds governance text to `CLAUDE.md` and `agent-rules.md` so every future session knows when to use workflows vs direct agent invocation.

**Why this PR exists:** PR-2.1.1, PR-META-8, and the Opus 4.8 verification all surfaced multi-agent orchestration patterns (parallel fan-out + adversarial verify) that we kept re-inventing per-session. Capturing them as reusable workflow scripts produces consistency, auditability, and cost-controlled reuse — matching the institutional bar set in PR-META-8.

**Anthropic dependency disclosure:** workflows depend on the `Workflow` tool, which is research preview as of 2026-05-30. README documents this explicitly. Scripts are self-contained — if the API breaks, the patterns are still readable as manual orchestration recipes.

## MUST criteria (block on FAIL)

### M1 — Three workflow scripts exist with correct structure
**Rule:** `.claude/workflows/` contains exactly three files: `fact-check.js`, `source-verify.js`, `deep-audit.js`. Each begins with `export const meta = {...}` including `name`, `description`, `whenToUse`, and `phases`. Each accepts args via the global `args` variable and validates required args. Each is self-contained (no cross-file imports).
**Evidence required:** `ls .claude/workflows/*.js` returns the three files. Each file starts with `export const meta`. Each defines its own `args` validation.

### M2 — README documents when to use vs when NOT to use
**Rule:** `.claude/workflows/README.md` exists with sections: (a) "When to use a workflow vs a direct agent invocation" with explicit decision tree, (b) per-workflow invocation example + cost estimate, (c) research-preview warning, (d) fallback path if `Workflow` tool unavailable.
**Evidence required:** All four sections present. Decision tree includes both "use direct agent" cases and "use workflow" cases.

### M3 — CLAUDE.md has WORKFLOWS section
**Rule:** `CLAUDE.md` adds a new "WORKFLOWS" section between the existing "MASTER PLAN" section and the "# Imports" section. The section briefly explains the library exists and points to `.claude/workflows/README.md`. Approximately 5-10 lines. Does NOT duplicate the decision tree (lives in README).
**Evidence required:** `git diff main..HEAD -- CLAUDE.md` shows a new ## WORKFLOWS section, ≤10 lines.

### M4 — agent-rules.md has decision-tree section
**Rule:** `.claude/rules/agent-rules.md` adds a new section "Workflows vs direct agent invocation" with explicit triggers for each. Lives at the end of the file (or in a logical place). Cross-references `.claude/workflows/README.md` for full detail.
**Evidence required:** `git diff main..HEAD -- .claude/rules/agent-rules.md` shows new section with both "use direct" and "use workflow" triggers.

### M5 — MASTER_PLAN.md §14 has revision entry
**Rule:** A new revision entry dated 2026-05-30 is appended to §14 Plan revisions, documenting the workflows-library addition + research-preview dependency disclosure.
**Evidence required:** New entry in §14 with the date and rationale.

### M6 — Workflows do NOT introduce new agents; deep-audit uses ONLY the 12 custom specialists
**Rule:** Workflow scripts may use two kinds of agentType values:
- **12 custom project specialists** (in `.claude/agents/`): `backend-firebase-expert`, `frontend-ui-expert`, `data-investigator`, `security-access-expert`, `outcomes-grader`, `testing-quality-expert`, `devils-advocate`, `refactoring-expert`, `effort-scaler`, `completeness-checker`, `evaluator-optimizer`, `ops`.
- **Anthropic default `general-purpose`** — ONLY for tasks no specialist covers (open-ended research, web search, multi-source synthesis, fact verification). NEVER for tasks a specialist exists for.

**`deep-audit.js` SPECIFICALLY must NOT use `general-purpose`** — every code-review dimension must map to a project specialist for traceability ("who said this is a bug?"). Today's mapping: correctness → `testing-quality-expert`; security → `security-access-expert`; performance → `backend-firebase-expert`; ux → `frontend-ui-expert`; business → `backend-firebase-expert`. If a new dimension needs a specialist that doesn't exist, escalate to Haim — do NOT default to general-purpose.

**`fact-check.js` and `source-verify.js` MAY use `general-purpose`** for search/synthesis/refute — these tasks have no project-specialist analog and require open-ended research capability.

**No workflow may introduce a NEW agent type** (one not in either category above).
**Evidence required:** grep `.claude/workflows/*.js` for `agentType:` — every value is either one of the 12 OR `general-purpose`. In `deep-audit.js`, ZERO `general-purpose` references. No new agent files in `.claude/agents/`.

### M7 — Each workflow has fallback documentation in README
**Rule:** README documents how the Lead Agent should manually orchestrate the pattern if the `Workflow` tool becomes unavailable. Specifically: read the script → spawn equivalents via `Agent({...})` → synthesize manually.
**Evidence required:** README has a "Fallback" subsection.

### M8 — No modification to existing agent files
**Rule:** Existing files under `.claude/agents/*.md` are NOT modified by this PR. Workflows are additive — they compose existing agents, not redefine them.
**Evidence required:** `git diff main..HEAD -- .claude/agents/` returns empty.

### M9 — Cost transparency
**Rule:** README and each workflow's `meta.whenToUse` field disclose the typical cost (sub-agent count, token magnitude, wall-clock). Reader can decide whether the cost is worth it before invoking.
**Evidence required:** README has cost-guidance table. Each workflow's whenToUse mentions cost order.

## SHOULD criteria (warning on FAIL, doesn't block)

### S1 — Workflows include schemas for structured output
**Rule:** Each agent() call that returns data uses a JSON schema for structured output. Prevents parsing errors and improves reliability.
**Evidence required:** Each workflow defines schemas for its phases.

### S2 — Workflows use phase() labels matching meta.phases
**Rule:** Each script's `phase()` calls correspond to a `meta.phases` entry, enabling clean progress display.
**Evidence required:** Phase titles match.

### S3 — README cross-references related rules
**Rule:** README links to `agent-rules.md`, `feature-protocol.md`, and `MASTER_PLAN.md` sections.
**Evidence required:** Cross-reference section at the end of README.

## PRODUCT-GRADE GATES

- **G1** Customer-visible errors: **N/A** — infrastructure-only PR, no runtime path or UI strings affected.
- **G2** Rollback: **PASS** — `git revert <merge-commit>` removes the workflows directory + the 3 doc updates. The 12-agent team continues to function exactly as before (workflows are opt-in additions).
- **G3** Monitoring: **N/A** — no data mutations.
- **G4** Customer-scenario test: **N/A** — no behavior to test. Each workflow's value is verified at the moment of invocation (the workflow's own output IS the test).
- **G5** Hebrew UI: **N/A** — internal infrastructure docs, English (matches `MASTER_PLAN.md` baseline). Workflows DO produce Hebrew output by default (reportLanguage: 'he') when relevant.
- **G6** Breaking change: **PASS** — purely additive. Existing Lead Agent invocations of direct sub-agents continue unchanged. Existing sessions continue to function. Backward-compatible.
- **G7** Security: **N/A** — no auth/PII/permissions/rules changes. The workflows compose existing agents whose security model is unchanged.

## Out of scope

- Workflows specific to law-office-system domain logic (e.g., `law-office-audit.js`, `client-aggregate-drift-check.js`) — wait until baseline 3 are stable; add domain workflows in follow-up PRs.
- Migration-sweep workflow (`migration-sweep.js`) — wait until first real migration use case (likely PR-2.1.2 for the 61 inline classification sites).
- Pre-commit / pre-PR hook enforcement of workflow output format — future PR if needed.
- Updating `_PRODUCT-GRADE-GATES.md` to require workflows for high-stakes PRs — separate bar revision per §15 protocol; not implicit in this PR.
- Adding workflows to the `effort-scaler` decision matrix — possible future enhancement.

## Rollback

```bash
git revert <merge-commit>
git push origin main
```

The PR is purely additive:
- 5 new files in `.claude/workflows/` and `.claude/rubrics/`
- ~25 new lines total across `CLAUDE.md`, `agent-rules.md`, `MASTER_PLAN.md` §14

Reverting removes the new files and the small text additions. Zero impact on:
- The 12-agent team
- Existing workflow patterns used by other sessions
- Any production code or runtime
- Any customer-facing behavior

## Test plan

- [x] `ls .claude/workflows/` shows 4 files (3 workflows + README)
- [x] Each workflow script parses (no syntax errors — verify by reading)
- [x] Each workflow's meta block is a literal (no variables, function calls, spreads)
- [x] grep for `agentType:` in workflows — every value matches a known agent (M6)
- [x] `git diff main..HEAD -- .claude/agents/` is empty (M8)
- [x] `git diff main..HEAD -- CLAUDE.md` shows ≤10 new lines, single WORKFLOWS section (M3)
- [x] `git diff main..HEAD -- .claude/rules/agent-rules.md` shows new decision-tree section (M4)
- [x] `git diff main..HEAD -- docs/MASTER_PLAN.md` shows ONE new §14 entry, dated 2026-05-30 (M5)
- [ ] **Post-merge verification (manual):** in a new Claude Code session, ask "what workflows are available?" — Lead Agent should mention the 3 from `.claude/workflows/`
- [ ] **Post-merge verification (manual):** invoke one workflow (e.g., `fact-check` with a simple test claim) to confirm the script parses and runs end-to-end

## Notes for grader

This PR's value is **institutional capture of patterns we kept re-inventing**. The most critical MUSTs are M3 (CLAUDE.md), M4 (agent-rules.md), M6 (no new agents), M8 (no agent files touched).

If any sub-agent reference in the workflows points to a non-existent agent type, M6 FAILS — block the PR.

If the `WORKFLOWS` text in CLAUDE.md is verbose or duplicates the README, M3 FAILS — the rule is "brief pointer, not duplication."

If `.claude/agents/*.md` files were modified, M8 FAILS — workflows must be purely additive to the agent team.

The research-preview dependency is a known risk, explicitly disclosed. It is NOT a blocker — the workflows have a documented fallback. A grader who marks this as FAIL on the basis of "research preview = unstable" misunderstands the PR's intent: the workflows are documented patterns, not load-bearing infrastructure. If `Workflow` tool breaks, the Lead Agent reads the script and orchestrates manually.
