# Rubric — PR-DOCS-2: archive consolidation (גל-3ד, part 2 of 2)

**Scope:** DOCS-ONLY move. Consolidates 40 historical markdown files into ONE archive location `docs/archive/` via `git mv` (100% renames — zero content change). Resolves the archive-vs-delete conflict DEFERRED from PR-DOCS-1: Haim decided (2026-07-30) to ARCHIVE (not delete) the historical reports — one archive location, zero history loss. **No devils-advocate** (pure docs, no rules/schema/code).

## What moves (40, all `git mv` R100)
- `docs/analysis/` (14) → `docs/archive/analysis/`
- `docs/fixes/` (7) → `docs/archive/fixes/`
- `.claude/CASE-CREATION-*.md` (4) + `apps/user-app/components/add-task/LEGACY-BACKUP.md` (1) → `docs/archive/case-creation/`
- ARCHIVE-bucket historical guides/explanations (14) → `docs/archive/` (flat): QUICK-START, QUICK_START, EVENTBUS_MIGRATION_GUIDE, ENTERPRISE_V2_MIGRATION_GUIDE, ENTERPRISE_V2_GAPS_AND_LIMITATIONS, SIMPLE_EXPLANATION, NEXT_STEPS, INSTRUCTIONS-UPDATE-DIALOG, SERVER_CODE_ANALYSIS, SERVER_MIGRATION_MAP, מעבר-לצד-שרת-מקצועי, architecture/REACT_MIGRATION_PLAN, .claude/ASYNC-EXPLANATION
- `.claude/sessions/2025-12-02-*.md` (1) → `docs/archive/sessions/`

## MUST
- **M1 — all moves are `git mv` renames, NOT delete+add.** `git diff --cached --name-status` shows 40 `R100` (100% similarity — byte-identical, history preserved). NO `D`+`A` pair for any moved file. Plus the README `M` + rubric `A` + exec-log `M`. Zero non-doc files.
- **M2 — zero content change on the 40.** Every rename is R100 (git confirms identical blob). The moved files are byte-for-byte what they were; only their path changed.
- **M3 — no code/CI reference breaks.** grep (excluding `.firebase/**`) shows NO `.js/.ts/.json/.yml/.html` reference to any moved file's path. The only inbound references are markdown cross-links in other historical/archive docs (expected + acceptable in an archive consolidation — moving a file INTO archive is itself the "this is historical" signal). No live build/CI/code path depends on any moved doc.
- **M4 — one archive location.** After the move, `docs/analysis/` and `docs/fixes/` no longer exist at their old paths (consolidated under `docs/archive/`). No file remains split between two archive locations. `docs/archive/README.md` §5 indexes the bulk arrivals + the contradicting "left in place" note (old line 140-142) is corrected with an explicit 2026-07-30 update banner (the prior decision was documented; this reverses it with Haim's authority, not silently).
- **M5 — safelist + KEEP-set untouched.** MASTER_PLAN/CLAUDE/rules/rubrics/bars not moved. `docs/architecture/TIME-TRACKING-FLOW.md` (a live doc the README says stays) not moved. Only the map's ARCHIVE bucket + the (now archive-decided) conflict set moved.
- **M6 — exec-log maintained.** `docs/HEALTH-MAP` exec-log gains the PR-DOCS-2 row + flips PR-DOCS-1 #493 to ✅ merged. Additive.

## PRODUCT-GRADE GATES
- **G1/G3/G4/G5/G7** N/A — docs move only; no customer path, data, strings, auth/PII/rules.
- **G2 (rollback):** `git revert <sha>` restores every file to its original path (all renames reverse cleanly). Trivial.
- **G6** N/A — no data schema / API / route / behavior contract; the running system depends on none of the moved docs (verified: no code reference).

## Anti-premature-closure
- CI green — moving unreferenced markdown into archive cannot break a build/test/deploy path; verified 0 code/CI references to the moved paths.
- **The conflict is resolved WITH authority, not buried:** the archive README's own "left in place" note (2026-07-23) is explicitly reversed with a dated banner citing Haim's 2026-07-30 decision — a future session sees the decision changed, not a silent contradiction.
- **גל-3ד nears close:** PR-DOCS-1 (deletions, #493 merged) + PR-DOCS-2 (this — archive consolidation). REMAINING in 3ד = a small **PR-DOCS-3** for the 5 doc-drift staleness banners (SYSTEM_MAP / SYSTEM_STATUS[needs Haim approval] / FUNCTION_MONITOR_README / ANALYTICS_DASHBOARD_GUIDE / WHATSAPP-PDF). Then גל-3ה (TS migration).
