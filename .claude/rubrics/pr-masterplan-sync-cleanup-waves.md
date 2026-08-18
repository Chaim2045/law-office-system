# Rubric — PR-PLAN-SYNC: MASTER_PLAN §14 sync for cleanup waves 3ג/3ד/3ה

**Scope:** DOCS-ONLY. One additive §14 (Plan revisions) entry that reconciles the canonical MASTER_PLAN with the merged cleanup track — closing a §11-mandated gap (§14 was not synced since 2026-07-28 / S1-S4). The detailed per-PR SSOT is the `docs/HEALTH-MAP-2026-07.md` execution-log; this is the roadmap-level roll-up. Prompted by Haim's "is it accurate + documented" check. No code, no behavior. No devils-advocate (docs roll-up, no acceptance-criteria source changed → NOT a §15 bar revision, stated in the entry).

## MUST
- **M1 — exactly 1 file, additive.** `git diff --cached --name-status` = 1 `M` (`docs/MASTER_PLAN.md`). A single new §14 bullet appended after the 2026-07-28 S1-S4 entry. No existing §14 line edited/removed; no other section touched.
- **M2 — facts match merged reality (verified against git).** Every PR number in the entry (SHARE-6 #491, SHARE-7 #492, DOCS-1 #493, DOCS-2 #494, DOCS-3 #495, TS-1 #496) is merged to `main` (`git log origin/main` confirms 491-496). The wave outcomes (3ג/3ד closed, 3ה opened, safe-tier-only) match the HEALTH-MAP exec-log.
- **M3 — points to the SSOT, does not duplicate it.** The entry explicitly names `docs/HEALTH-MAP-2026-07.md` as the per-PR detail SSOT; the §14 text is a roll-up, not a re-transcription (avoids two drifting detailed logs).
- **M4 — records the discovered decisions/snags honestly** (not papered over): the DOCS-2 archive-vs-delete conflict (Haim chose archive), the TS-1 A′ template snags (TS6059 + eslint parser), the CI drift-guard, and the open `.firebase` hosting-exposure chip.
- **M5 — orthogonality preserved.** The entry restates the cleanup track is ORTHOGONAL to the H.5→H.9/H.8 MVP sequence and is NOT a §15 bar revision.

## PRODUCT-GRADE GATES
- **G1/G3/G4/G5/G7** N/A — docs roll-up; no customer path, data, strings, tests, auth/PII/rules.
- **G2 (rollback):** `git revert <sha>` removes the one §14 bullet. Trivial.
- **G6** N/A — no schema/API/route/behavior contract; describes already-merged work.

## Anti-premature-closure
- CI green — a MASTER_PLAN §14 append cannot break build/test/deploy.
- Facts self-verified against `git log origin/main` (491-496 all merged) + the HEALTH-MAP exec-log; a separate grader agent is disproportionate for a docs roll-up whose every claim was just verified against git.
- The exec-log (per-wave SSOT) remains the detailed record; §14 is now consistent with it (the §11 "reconcile FIRST" gap is closed).
