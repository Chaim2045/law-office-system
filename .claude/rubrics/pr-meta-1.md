# Rubric — PR-META-1: multi-agent improvements (effort-scaler + completeness-checker + evaluator-optimizer + pre-PR hook + security gaps)

**Scope:** infrastructure-only PR. Adds 3 new sub-agents, 1 hook, security.md update, CLAUDE.md mandatory rules. Aligns the team with Anthropic-recommended multi-agent patterns from "Building Effective Agents" + "Multi-Agent Research System".

**Origin:** Tommy 2026-05-24 discovered loose-ends gap during G.3.x sprint debrief — no agent asks "what did you notice but didn't fix?". Research confirmed Anthropic's "synthesis step" pattern + 3 additional improvements (effort-scaling, evaluator-optimizer, pre-PR hook).

## MUST (10) — blocking

1. **3 new agent files exist with valid frontmatter.** Each has `name` + `description` (required by Claude Code subagent spec). *Evidence:* `ls .claude/agents/` shows effort-scaler.md, completeness-checker.md, evaluator-optimizer.md.

2. **effort-scaler returns LIGHT/MEDIUM/HEAVY verdict.** System prompt defines the 3 levels with concrete criteria (file count, line count, change type). *Evidence:* `.claude/agents/effort-scaler.md` body documents the matrix.

3. **completeness-checker covers 8 loose-end sources.** System prompt lists: git state, codebase drift, adjacent bugs, backlog correlation, data integrity, tests, CI/deploy, documentation drift. *Evidence:* `.claude/agents/completeness-checker.md` "איפה לחפש loose ends" section enumerates them.

4. **evaluator-optimizer enforces 3-retry max.** System prompt explicit: "תמיד מtaximum 3 retries — אסור 4". Defines RESOLVED + ESCALATION output formats. *Evidence:* `.claude/agents/evaluator-optimizer.md` "כללי ברזל" + "Iteration 3 (אחרון)" sections.

5. **security.md adds 6 missing checks.** WhatsApp sanitization, JWT/token storage, CSP headers, webhook signatures, CORS, Firebase logs PII. Plus Israeli Privacy Law (חוק הגנת הפרטיות) explicit reference. *Evidence:* `.claude/agents/security.md` "רשימת בדיקות מורחבת (PR-META-1)" section.

6. **Pre-PR hook script exists and is executable.** `.claude/hooks/require-outcomes-pass.sh` with chmod +x. *Evidence:* `ls -la .claude/hooks/require-outcomes-pass.sh` shows execute bit.

7. **Hook config registered in settings.json.** `.claude/settings.json` has `hooks.PreToolUse[].matcher: "Bash"` pointing to the script with `if: "Bash(gh pr create *)"` filter. *Evidence:* `cat .claude/settings.json` shows the entry.

8. **Hook validates rubric existence AND grader VERDICT in PR body.** Script logic checks for rubric file matching branch/PR ID AND for "VERDICT: PASS" / "PASS_WITH_WARNINGS" string in the `gh pr create` command body. *Evidence:* read the .sh file and verify the 2 checks.

9. **CLAUDE.md updated with 4 new mandatory rules.** EFFORT SCALING RULE, COMPLETENESS CHECK RULE, EVALUATOR-OPTIMIZER RULE, PR-CREATE HOOK RULE. Plus FEATURE PROTOCOL updated with steps 1a, 2a, 6a. *Evidence:* grep CLAUDE.md for each rule heading.

10. **DECISION POINT RULE updated** with 3 new agent names. *Evidence:* "Relevant agents" line includes `effort-scaler`, `completeness-checker`, `evaluator-optimizer`.

## SHOULD (4) — non-blocking

1. **effort-scaler uses haiku model.** Cheap, fast — matches scope-decision use case. *Evidence:* frontmatter `model: haiku`.

2. **completeness-checker + evaluator-optimizer use sonnet model.** Need deeper reasoning. *Evidence:* frontmatter `model: sonnet`.

3. **Hook uses `if` filter for efficiency.** `if: "Bash(gh pr create *)"` prevents hook spawn on every Bash call. *Evidence:* settings.json hook entry has `if` field.

4. **All new agent files have skepticism protocol section.** Same style as outcomes-grader.md (require file:line evidence, no false "מצאתי"). *Evidence:* grep agents for "פרוטוקול ספקנות".

## Out of scope (deferred)

- Voting/consensus pattern (optional Anthropic recommendation — not adopted yet, accept based on observed need)
- Shared scratchpad (Anthropic doesn't deeply document)
- Citation/verification agent (low ROI for solo dev)
- TaskCompleted hook (focus on pre-PR-create only)
- Retrospective run on G.3.x sprint with new agents (separate validation task)

## Test outputs required

- Manual: subagents auto-load (start new Claude Code session → `Task({subagent_type: "effort-scaler"})` works without error)
- Manual: hook fires on dummy `gh pr create` command without rubric → blocked with clear reason
- Manual: hook passes when rubric exists AND VERDICT present in body
- Manual: dry-run trigger of completeness-checker on prior PR finds expected loose ends
- No regression: existing agents still loadable (`outcomes-grader`, `devils-advocate`, etc.)
- Lint: 0 errors on any modified files
- No code/test changes — infrastructure-only PR

## Non-criteria (do NOT check)

- Tests don't apply — no application code changed
- Vitest / Jest unchanged
- Production behavior unchanged
- Firebase deploy not needed
