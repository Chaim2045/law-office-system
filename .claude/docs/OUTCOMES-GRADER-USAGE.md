# Outcomes Grader — Usage Guide

Anthropic's "Outcomes" pattern (launched May 2026, part of Claude Managed Agents). Adapted for this repo using Claude Code subagents.

## What it is

A **separate-context grader** that evaluates work against a **rubric written upfront**. Returns PASS/FAIL with cited evidence. Not influenced by the main agent's reasoning.

## Why use it

- Catches drift from the plan
- Enforces the global quality bar consistently
- Provides objective gate before commit / PR
- Documented record of why a PR passed (or didn't)

## Files

```
.claude/
├── agents/
│   └── outcomes-grader.md       # The grader agent definition
├── rubrics/
│   ├── global-quality-bar.md    # Universal criteria (every PR)
│   ├── TEMPLATE.md              # Copy-paste template for new rubrics
│   ├── pr-a-4.md                # First specific rubric (example)
│   └── ...
├── commands/
│   └── מדרג.md                  # Slash command shortcut
└── docs/
    └── OUTCOMES-GRADER-USAGE.md # This file
```

## When to invoke

### Always (mandatory)
- Before opening a PR
- Before merging to main
- After amending a commit you intend to push

### Optional but recommended
- After a large refactor commit (sanity check mid-stream)
- After resolving merge conflicts
- Before declaring a feature "done"

### Skip
- Documentation-only PRs (rubric not worth the overhead)
- Single-file lint fixes
- Dependency bumps from dependabot

## How to invoke

### Option A — Slash command (easiest)

```
/מדרג pr-a-4
```

Equivalent to:
```
Spawn outcomes-grader with rubric=.claude/rubrics/pr-a-4.md scope=<current branch>
```

### Option B — Direct subagent invocation

When working with an AI agent (Tomi):

> "Spawn outcomes-grader with these inputs:
> - rubric=.claude/rubrics/pr-a-4.md
> - scope=PR #275
> - comparison=main"

The agent must read all rubric files (specific + global), inspect the diff, run tests + lint, and return a structured verdict.

### Option C — From CI (future, not implemented yet)

GitHub Action triggers grader on every push to a feature branch. Comments verdict on the PR.

## Writing a new rubric

For each significant PR:

1. **Copy the template:** `cp .claude/rubrics/TEMPLATE.md .claude/rubrics/<pr-name>.md`

2. **Fill the four sections:**
   - **MUST criteria** — 5-10 must-pass items. Specific, testable, with evidence requirement.
   - **SHOULD criteria** — 3-5 desirable items. Warning on fail, doesn't block.
   - **Out of scope** — explicit list of what this PR does NOT do. Prevents grader from downgrading for absent features.
   - **Rollback** — concrete steps if something breaks in DEV.

3. **Get approval before implementing:** Tommy reviews the rubric BEFORE the work starts. This locks the contract.

4. **Reference it in PR description:** `Rubric: .claude/rubrics/<pr-name>.md`

## Reading the grader's output

The grader returns markdown with this structure:

```
# Outcomes Grader — Verdict
**Rubric:** ...
**Overall:** PASS | FAIL | PASS_WITH_WARNINGS
**Score:** X/Y

## MUST criteria
| # | Criterion | Status | Evidence |
...

## Issues found
1. <criterion-id>: <description>
   - Expected: ...
   - Found: ...
   - Recommendation: ...
```

### Action by verdict

- **PASS** → proceed to commit / PR / merge
- **PASS_WITH_WARNINGS** → review warnings; decide per warning whether to fix now or defer (document deferral in PR description)
- **FAIL** → fix the cited issues, re-run grader. Do NOT merge.

## Anti-patterns

1. **Don't argue with the grader.** Its context is intentionally isolated. If you think it's wrong, the rubric is wrong — fix the rubric (with Tommy's approval) and re-run.

2. **Don't write rubrics after the code.** Rubrics are a contract written upfront. Writing them post-hoc defeats the purpose.

3. **Don't pad rubrics with vague criteria.** "Code is high quality" is not a criterion. "All async functions handle rejections" is.

4. **Don't skip the grader because it's "obvious".** Most production bugs were obvious in hindsight.

5. **Don't let the grader replace human review.** It catches drift from the plan. It doesn't catch novel problems the rubric didn't anticipate. Use both.

## Example workflow (typical PR)

```
1. Tommy:  defines rubric → reviews with user → user approves
2. Tomi:   implements according to rubric
3. Tomi:   commits work-in-progress (no grader yet)
4. Tomi:   when ready, runs `/מדרג <rubric-name>`
5. Grader: returns VERDICT
6.   if PASS: Tomi opens PR with rubric path in description
7.   if FAIL: Tomi fixes cited issues, goto 4
8. User:   reviews PR (humans catch things the grader doesn't)
9. User:   merges
10. Tomi:  runs grader once more post-merge to confirm landed state
```

## For future maintainers

The grader is an **agent in `.claude/agents/`**. Its behavior is fully defined by the markdown there. To modify behavior, edit that file.

The rubrics are **plain markdown checklists**. No special tooling needed. They are read by both humans and the grader.

This is intentionally low-tech. The pattern works because the rubrics are reviewed by Tommy upfront — the grader is just the enforcer.
