# Rubric — PR-A4-2: untrack + gitignore PII-bearing non-loaded dev scripts (גל-3א)

**Scope:** git TRACKING/hygiene only — no code logic, no rules/schema. Removes ~162 PII-bearing NON-LOADED dev/ops/one-off scripts from the PUBLIC repo via `git rm --cached` (files KEPT on local disk) + `.gitignore`. Haim-approved decision: **UNTRACK (not delete), History=keep (no rewrite).** A read-only investigation confirmed none are loaded/CI-wired. No devils-advocate (no code/rules/schema).

## MUST
- **M1 — untrack, not delete.** All targets removed from git tracking via `git rm --cached` (staged as `D`), and STILL PRESENT on local disk (verified). NO file deleted from disk.
- **M2 — correct target set, nothing else.** Untracked = `devtools/` (157) + `apps/user-app/js/scripts/add-employee-phones.js` (1) + the tracked `scripts/` PII one-offs (deep-investigate-*/investigate-*/backup-drifted-* — 4). NO file outside these targets untracked; NO loaded/CI-wired file touched (re-verified: no HTML `<script src=`, no require/import in apps|functions, no root package.json script, no `.github/workflows` reference).
- **M3 — gitignore covers them.** `.gitignore` gains `devtools/`, `apps/user-app/js/scripts/add-employee-phones.js`, and the specific `scripts/` one-offs not already matched (the `scripts/investigate-*` pattern pre-exists; `deep-investigate-*` + `backup-drifted-*` added explicitly). After the change, no target shows as `??` (all cleanly ignored).
- **M4 — execution-log maintained (anti-drift rule).** `docs/HEALTH-MAP` execution-log gains the A4-2 row (+ flips S4 #480 to ✅ merged) and drops A4-2 from the "remaining" line. Additive; no other content removed.

## PRODUCT-GRADE GATES
- **G1** N/A — no runtime code.
- **G2 (rollback):** `git revert <sha>` re-tracks the files (+ reverts the .gitignore). Trivial. (Files never left disk.)
- **G3** N/A — no data path.
- **G4** N/A — tracking change, no behavior to test. CI build/suite unaffected (nothing loaded was touched).
- **G5** N/A — no customer strings.
- **G6** N/A — no contract/schema/route change; the untracked files were not part of the running app.
- **G7 (security):** PASS — removes staff PII (emails, a personal @gmail, phone numbers) from a PUBLIC-repo's tracked tree (§2.8). NOTE: this removes them GOING FORWARD only — the PII remains retrievable from git HISTORY (Haim-decided: defer/no history-scrub; force-push forbidden). The authz gate is unaffected (these are non-loaded scripts, not the auth path).

## Anti-premature-closure
- CI must be green — but nothing loaded/CI-wired changed, so no functional risk; the risk was "did we untrack something wired in" → verified none.
- **History exposure remains** (documented, Haim-decided defer). Working-tree/tracking cleanup ≠ history removal.
- גל-3א remaining after this: A4-3 (ADMIN_EMAILS→config), A4-4 (retire auth Layer-2 — behavioral, devils-advocate).
