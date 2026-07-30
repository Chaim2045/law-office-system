# Rubric — PR-DOCS-1: delete superseded/duplicate docs (גל-3ד, part 1 of 2)

**Scope:** DOCS-ONLY deletion. Opens גל-3ד (docs cleanup). Deletes 22 markdown files that are either byte-identical duplicates (an organized subfolder copy remains) or completed one-off analysis reports whose conclusions are captured in the SSOT `docs/HEALTH-MAP-2026-07.md`. Zero code, zero behavior, zero content-loss. Basis: HEALTH-MAP §5 (Wave-1, adversarially verified) DELETE + top-level REPLACE-BY-HEALTHMAP verdicts. **No devils-advocate** (pure docs, no rules/schema/code).

## What is deleted (22)
- **6 byte-dupes** (git-hash verified identical to an organized subfolder copy that REMAINS): `docs/README_ARCHITECTURE_v2.md` (→`docs/architecture/`), `docs/README_PHASE1_DEPLOYMENT.md` (→`docs/architecture/`), `docs/SENIOR_REVIEW.md` (→`docs/processes/`), `docs/WORKFLOW_ENFORCEMENT.md` (→`docs/processes/`), `docs/CHANGELOG-CI-CD.md` (→`docs/deployment/`), `docs/CHANGELOG-ENTERPRISE-UPGRADE.md` (→`docs/deployment/`).
- **2 self-declared backups:** `docs/BACKUP_PROGRESS_BARS_OLD.md`, `.claude/README-old.md`.
- **14 completed top-level reports** (docs/ root, superseded by HEALTH-MAP): COMPREHENSIVE_ANALYSIS_REPORT, CODE_CLEANUP_REPORT, DEDUCTION_EXECUTION_ANALYSIS, MIGRATION_PLAN_DEDUCTION, FORMS_MODULE_REPORT, CASES_IMPLEMENTATION_SUMMARY, MODALS_REFACTORING_SUMMARY, NOTIFICATION_SYSTEM_SUMMARY, MD_FILES_ORGANIZATION_SUMMARY, IMPACT_ANALYSIS_MIGRATION_PLAN, MIGRATION_SUMMARY, FIREBASE_AUTH_MIGRATION_PLAN, NOTIFICATION_SYSTEM_MIGRATION, PHASE_2.1_COMPLETED.

## What is DEFERRED to PR-DOCS-2 (a discovered conflict — NOT deleted here)
`docs/analysis/*` (14) + `docs/fixes/*` (7) + `.claude/CASE-CREATION-*` (4) + `apps/user-app/components/add-task/LEGACY-BACKUP.md` (1). **Why:** `docs/analysis/` + `docs/fixes/` are the ESTABLISHED historical archive — tracked in git, and `docs/archive/README.md` (a KEEP doc) + `.claude/rubrics/pr-docs-archive.md` both treat them as the historical home. The HEALTH-MAP marks them REPLACE (delete), but two of our own artifacts say "keep as archive" → a real archive-vs-delete conflict that gets resolved WITH Haim in PR-DOCS-2 (the archive PR), per "verify content, never delete by assumption".

## MUST
- **M1 — exactly 22 deletions + docs (exec-log + rubric).** No code file, no CI, no rules touched. `git diff --cached --name-status` = 22 `D` + the exec-log `M` + this rubric `A`.
- **M2 — byte-dupe safety (the 6):** each deleted dupe has a git-hash-identical organized copy that REMAINS tracked (verified: `git hash-object` equal for all 6 pairs). Deleting the top-level dupe loses zero content.
- **M3 — no live reference breaks.** grep (excluding `.firebase/**` generated cache) shows the ONLY inbound references to the 22 are: self-references among the deleted set, the HEALTH-MAP DELETE-list itself, and one stale mention in `.claude/instructions.md:760` of `README_ARCHITECTURE_v2.md` — which STILL RESOLVES (the organized copy `docs/architecture/README_ARCHITECTURE_v2.md` remains). No code, no CI, no build, no KEEP-doc load-bearing link.
- **M4 — the deferred set is NOT touched.** `docs/analysis/`, `docs/fixes/`, `.claude/CASE-CREATION-*`, `LEGACY-BACKUP.md` remain tracked (verified) — the archive-conflict is Haim's call in PR-DOCS-2, not silently resolved here.
- **M5 — `.firebase/hosting..cache` left as-is.** It is a tracked but GENERATED deploy ledger; its stale lines (listing now-deleted docs) self-heal on the next `firebase deploy`. Hand-editing it is fragile and out of scope. Noted, not touched. (Separate finding — internal docs served on public Hosting — spawned as a chip, not this PR.)
- **M6 — exec-log maintained.** `docs/HEALTH-MAP` exec-log gains the PR-DOCS-1 row (opens גל-3ד) + flips SHARE-7 #492 to ✅ merged. Additive.

## PRODUCT-GRADE GATES
- **G1/G3/G4/G5/G7** N/A — docs-only deletion; no customer path, no data, no strings, no auth/PII/rules.
- **G2 (rollback):** `git revert <sha>` restores all 22 files. Trivial.
- **G6** N/A — no data schema / API / route / behavior contract; the deleted docs describe nothing the running system depends on.

## Anti-premature-closure
- CI green — deleting unreferenced markdown cannot break a build/test/deploy path; verified 0 live code/CI references.
- **Conflict surfaced, not buried:** the docs/analysis + docs/fixes archive-vs-delete conflict is explicitly deferred to PR-DOCS-2 (M4) — a discovered loose end reaching the owner, per the completeness rule.
- **גל-3ד is 2 PRs** (Haim-approved): PR-DOCS-1 (these safe deletions) → PR-DOCS-2 (ARCHIVE via `git mv` + resolve the analysis/fixes conflict + doc-drift staleness edits on SYSTEM_MAP/SYSTEM_STATUS/etc). NEXT wave after 3ד = גל-3ה (TS migration).
