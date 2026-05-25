# Rubric — PR-META-4: CLAUDE.md restructure per Anthropic best practices

**Scope:** restructure `CLAUDE.md` per official Anthropic guidance (`code.claude.com/docs/en/memory` + `/best-practices`). Move multi-step procedures + tutorial examples to `.claude/rules/*.md` files. Use `@import` syntax. Zero rules deleted — only relocated for better adherence.

**Origin:** Tommy 2026-05-25 — system being prepared for commercial sale. Deep learning of Anthropic's official CLAUDE.md guidelines revealed current file (234 lines, multi-step procedures, tutorial examples) violates: (1) target size <200 lines, (2) "no multi-step procedures in CLAUDE.md → use skills or path-scoped rules", (3) "no long tutorials".

**Bug:** Anthropic states "If Claude keeps doing something you don't want despite having a rule against it, the file is probably too long and the rule is getting lost." Current CLAUDE.md is approaching that zone.

**Risk:** Zero — same rules, different file layout. `@import` is official Anthropic syntax. CLAUDE.md still loaded every session; imports loaded alongside (no rules "lost").

## MUST (8) — blocking

1. **`CLAUDE.md` under 200 lines.** Anthropic official target. *Evidence:* `wc -l CLAUDE.md` < 200. Current: 116.

2. **All previous rules preserved.** No rule deleted — every rule from pre-restructure exists either in `CLAUDE.md` (short form) or in a `.claude/rules/*.md` file. *Evidence:* diff comparison — every rule heading present somewhere.

3. **`.claude/rules/feature-protocol.md` created.** Contains: 6-step protocol + sub-rules + constraints + reasoning. *Evidence:* file exists; contains all 6 steps + 6a evaluator-optimizer fallback.

4. **`.claude/rules/agent-rules.md` created.** Contains: per-agent rules (gatekeeper, grader, effort-scaler, completeness-checker, evaluator-optimizer, pre-PR hook, agent-usage-review). *Evidence:* file exists; covers all 7 mechanisms.

5. **`.claude/rules/decision-point.md` created.** Contains: full decision point rule including anti-pattern + correct pattern + exemption. *Evidence:* file exists; tutorial-style examples present.

6. **CLAUDE.md uses `@import` syntax** to reference moved content. *Evidence:* `grep -E "^@" CLAUDE.md` finds `@.claude/rules/feature-protocol.md`, `@.claude/rules/agent-rules.md`, `@.claude/rules/decision-point.md`, `@.claude/rubrics/_PRODUCT-GRADE-GATES.md`.

7. **Imperative + specific language preserved.** "MUST", "NEVER", "STOP", "always", "forbidden" still prominent. No vague phrasing introduced. *Evidence:* `grep -c "MUST\|NEVER\|STOP" CLAUDE.md` ≥ pre-restructure count.

8. **No skill-style multi-step procedures in `CLAUDE.md`.** Multi-step content moved out. *Evidence:* `CLAUDE.md` has only one-liner rule descriptions + ENV map + FORBIDDEN commands list (allowed: lists of facts).

## SHOULD (3) — non-blocking

1. **Each `.claude/rules/*.md` file under 100 lines.** Modular, digestible. *Evidence:* `wc -l .claude/rules/*.md` shows each < 100.

2. **Cross-references between rule files documented.** E.g., `feature-protocol.md` references `agent-rules.md` and `decision-point.md` where relevant. *Evidence:* presence of "Related" or "See also" sections.

3. **CLAUDE.md ends with explicit `# Imports` section.** Anthropic best practice for clarity. *Evidence:* section heading present + 4 @import lines.

## Out of scope (deferred)

- Path-scoped rules (`paths:` frontmatter for rule files) — defer until specific paths benefit from scoping (current rules are global)
- Splitting `_PRODUCT-GRADE-GATES.md` further — it's already in `.claude/rubrics/`, treated as a separate concern
- Restoring `dist/` from git ignore exclusion (CLAUDE.md restructure is read-only on app code)
- `/init` regeneration — Anthropic anti-pattern says "Don't use `/init` or auto-generate your CLAUDE.md...spend some time thinking very carefully about every single line". Manual restructure preserves intent.

## Test outputs required

- `wc -l CLAUDE.md` → expected: < 200 (actual: 116)
- `wc -l .claude/rules/*.md` → expected each: < 100
- `grep -c "^@" CLAUDE.md` → expected: 4 (imports)
- `grep -c "MUST\|NEVER\|STOP\|FORBIDDEN" CLAUDE.md` → at least the count from pre-restructure
- Manual: open new chat session, verify agent loads CLAUDE.md + all 4 imports (visible in `/memory` command output)

## PRODUCT-GRADE GATES self-evaluation

| Gate | Status | Justification |
|------|--------|---------------|
| G1 Customer-visible errors | N/A | Documentation-only PR, no customer-facing code paths |
| G2 Rollback path | PASS | `git revert <commit>` reverts CLAUDE.md + 3 new files. No data. |
| G3 Monitoring if data-mutating | N/A | No data writes |
| G4 Test proves customer scenario | PASS | Test outputs section above defines verifiable checks; manual `/memory` test documented |
| G5 Hebrew customer-facing text | N/A | No UI strings |
| G6 No breaking change without migration | PASS | Rules preserved; `@import` is non-breaking; existing sessions continue to load CLAUDE.md as before |
| G7 Security agent reviewed | N/A | No PII / auth / permissions touched |
