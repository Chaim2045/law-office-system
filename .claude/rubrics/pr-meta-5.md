# Rubric — PR-META-5: Agent team consolidation 21 → 12 + Lead Agent role

**Scope:** Restructure `.claude/agents/` per Anthropic 2026 multi-agent best practices. Consolidate 21 agents → 12 with explicit Lead Agent role. Replace deprecated "Tommy" mediator references with Lead Agent (orchestrator) + Haim (Product Owner). Move meta-agents to hooks/slash commands. Bring back `refactoring-expert` as 12th agent for SSOT-critical production refactors. Prune duplicate strict commands. Archive historical audits.

**Origin:** Haim 2026-05-26 — identified that the 21-agent setup had no explicit orchestrator (deprecated "Tommy" references everywhere), 3 overlapping challengers, and meta-agents that didn't need isolated context. Goal: most professional team possible. Token cost is NOT the constraint — quality is.

**References:**
- Anthropic Multi-Agent Research System: Lead + Workers + Grader pattern
- Anthropic Building Effective Agents: Evaluator-Optimizer pattern, Synthesis step
- Anthropic Outcomes (May 2026): separate-context grading
- Anthropic "How Anthropic uses Claude Code": team composition

**Risk:** Low — `.claude/` is tooling only. No application code touched. Backup of all original agents preserved at `.claude/agents.backup-20260526/` (gitignored).

## MUST (12) — blocking

1. **Lead Agent role explicit in CLAUDE.md.** Definition with responsibilities (decompose → delegate → aggregate). *Evidence:* `grep -A5 "Lead Agent" CLAUDE.md` shows role definition section.

2. **Haim defined as Product Owner, not Orchestrator.** No more "subordinate to Tommy" pattern. *Evidence:* `grep "Product Owner" CLAUDE.md` returns Haim definition.

3. **All "Tommy" references in live files replaced.** Live files = `CLAUDE.md`, `.claude/rules/*`, `.claude/agents/*`, `.claude/commands/*`, `.claude/AGENTS-CHEATSHEET.md`. Backups and historical audits/rubrics OK to retain. *Evidence:* `grep -r "Tommy\|טומי\|Tomi" .claude/agents/ .claude/rules/ CLAUDE.md` returns no semantic role references (only historical "was previously /טומי" notes).

4. **12 agent files exist in `.claude/agents/`.** Exact count, not fewer not more. *Evidence:* `ls .claude/agents/ | wc -l` = 12.

5. **All 11 deleted agents have content preserved.** Either folded into existing agent (verifiable text), or converted to slash command (file exists), or replaced by hook (file exists + registered in settings.json). *Evidence:* checklist mapping each deleted agent → its successor.

6. **`work-session-gatekeeper.sh` hook executable + works.** *Evidence:* `bash .claude/hooks/work-session-gatekeeper.sh` returns valid JSON with `hookSpecificOutput.hookEventName == "SessionStart"`.

7. **`settings.json` registers SessionStart hook.** *Evidence:* `grep -A3 "SessionStart" .claude/settings.json` shows hook registration.

8. **No broken references in live files.** No live file references deleted agents like `code-reviewer`, `prod-gatekeeper`, `firebase-rules-expert`, `ci-cd-expert`, `devops-deploy-manager`, `refactoring-expert` (other than refactoring which is restored), `performance-expert`, `work-session-gatekeeper`, `intent-refiner`, `navigator-process-guide`, `explainer-hebrew`. *Evidence:* `grep` in `.claude/agents/`, `.claude/rules/`, `.claude/commands/`, `CLAUDE.md`, `AGENTS-CHEATSHEET.md` shows only "merged from X" historical notes.

9. **Recursive spawning explicitly forbidden.** Anti-pattern documented in `agent-rules.md` + `feature-protocol.md`. *Evidence:* `grep -i "recursive\|only the Lead Agent" .claude/rules/*.md`.

10. **`require-outcomes-pass.sh` hook still active.** Pre-refactor functionality preserved. *Evidence:* still registered in `settings.json` under `PreToolUse`.

11. **Backup of original 21 agents preserved.** Local-only via gitignore. *Evidence:* `.claude/agents.backup-20260526/` exists with 21 files; `.gitignore` excludes `.claude/agents.backup-*/`.

12. **12 agents listed in `agent-rules.md` match files on disk.** Documentation matches reality. *Evidence:* the table in `agent-rules.md` lists exactly the 12 files in `.claude/agents/`.

## SHOULD (6) — non-blocking

1. **`AGENTS-CHEATSHEET.md` reflects new structure.** *Evidence:* shows 12 agents + new commands + hook descriptions.

2. **Slash commands updated where they referenced deleted agents.** `/ביקורת`, `/ולידציה`, `/ניווט`. *Evidence:* file contents now point to current agents (outcomes-grader instead of code-reviewer/prod-gatekeeper, Lead Agent instead of navigator).

3. **New slash commands documented in CHEATSHEET.** `/intent`, `/refactor`, `/perf`, `/architect`. *Evidence:* grep shows entries.

4. **`/architect` is canonical, `/טומי` is minimal alias.** *Evidence:* `architect.md` has full content; `טומי.md` points to it.

5. **3 duplicate strict commands removed.** `plan-strict.md`, `review-strict.md`, `validate-strict.md` deleted. *Evidence:* `ls .claude/commands/*strict*` returns nothing.

6. **6 historical audits archived to `.claude/audits/archive/`.** *Evidence:* `ls .claude/audits/archive/` shows 6 `2026-04-19-*.md` files; `.claude/audits/` root has only README + BENCHMARK + benchmark-runs + archive/.

## Out of scope (deferred)

- Migration of `.claude/audits/benchmark-runs/` contents — left as is
- Restoring `dist/` from git ignore — unchanged
- `agent-usage-report.sh` quarterly review — operational, not part of this PR
- CI/CD pipeline fixes (broken since 7 months ago) — separate task, identified as next priority after this PR merges
- Auto Mode evaluation — separate decision, post-merge
- Dreaming preview — research preview only, not for production yet

## Test outputs required

```bash
# Structure verification
ls .claude/agents/ | wc -l                                # expected: 12
bash .claude/hooks/work-session-gatekeeper.sh | head -1   # expected: valid JSON with SessionStart
grep -c "Lead Agent" CLAUDE.md                            # expected: ≥3
grep -c "Product Owner" CLAUDE.md                         # expected: ≥1

# No broken references
grep -rn "code-reviewer\|prod-gatekeeper\|firebase-rules-expert\|navigator-process-guide\|explainer-hebrew" .claude/agents/ .claude/rules/ .claude/commands/ CLAUDE.md AGENTS-CHEATSHEET.md 2>/dev/null | grep -v "מאוחד\|merged\|was previously\|לפנים\|לשעבר\|נמחק" 
# Expected: no output (or only historical "merged from" notes)

# Backup preserved
ls .claude/agents.backup-20260526/ | wc -l                # expected: 21
grep "agents.backup" .gitignore                           # expected: ".claude/agents.backup-*/"

# Hook registered
grep -A2 "SessionStart" .claude/settings.json             # expected: shows work-session-gatekeeper.sh
```

## PRODUCT-GRADE GATES self-evaluation

| Gate | Status | Justification |
|------|--------|---------------|
| G1 Customer-visible errors | N/A | `.claude/` tooling only — no customer-facing code paths touched |
| G2 Rollback path | PASS | `git revert 1e0f46b 4ef1f26` reverts everything; `.claude/agents.backup-20260526/` retains full original state on disk |
| G3 Monitoring if data-mutating | N/A | No data writes anywhere |
| G4 Test proves customer scenario | PASS | Test outputs section above defines verifiable structural + functional checks; `work-session-gatekeeper.sh` tested end-to-end |
| G5 Hebrew customer-facing text | N/A | No UI strings introduced; Hebrew content in agent prompts preserved verbatim |
| G6 No breaking change without migration | PASS | Existing slash commands (`/ביקורת`, `/ולידציה`, `/ניווט`) retain their entry points but now route to consolidated agents. Hebrew aliases preserved. `/טומי` retained as alias to `/architect`. No PR workflow disrupted. |
| G7 Security agent reviewed | N/A | No PII / auth / permissions / rules touched. Security agent file itself was modified to absorb firebase-rules content — no behavioral change to security posture. |
