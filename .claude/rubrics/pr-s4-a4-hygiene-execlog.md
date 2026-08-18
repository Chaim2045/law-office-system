# Rubric — PR-S4: A4-1 debug-email hygiene + גל-3 execution-log + §14 (גל-3א)

**Scope:** (a) CODE — remove hardcoded-staff-email `DEBUG_EMAILS` debug instrumentation from `WorkloadCalculator.js` (health-map A4, pure hygiene, PUBLIC repo); (b) DOCS — add the "גל-3 execution-log" to `docs/HEALTH-MAP` (closes the documentation-sync gap Haim flagged) + a MASTER_PLAN §14 entry recording the 3א S1–S4 sub-wave. No rules/schema/migration → no devils-advocate. Closes the core of גל-3א; A4-2/3/4 tracked as follow-ups.

## MUST
- **M1 — debug removal, zero behavior change.** All `DEBUG_EMAILS` Sets + `shouldDebug` helpers + the `if (shouldDebug(...)) { console.* }` blocks (and their `window._*Logged` flags + any const that fed ONLY a debug block, e.g. `hasWorkload`) removed from `WorkloadCalculator.js`. NO calculation/return/control-flow changed. Non-debug console statements left intact.
- **M2 — no dangling refs.** Zero remaining `DEBUG_EMAILS` / `shouldDebug` / `@ghlawoffice` / `@gmail` / `window._*Logged` debug-flag references in the file (verified = 0); `node --check` OK. `?v=` cache-bust bumped on the `WorkloadCalculator.js` `<script>` in `workload.html`.
- **M3 — execution-log added.** `docs/HEALTH-MAP-2026-07.md` gains a "יומן ביצוע גל-3" table recording S1(#477)/S2(#478)/S3(#479)/S4 with reviews+status, the remaining A4-2/3/4 follow-ups, and the doc-drift backlog. Additive (no existing map content removed).
- **M4 — §14 entry accurate.** `docs/MASTER_PLAN.md` §14 gains one additive entry recording the 3א S1–S4 sub-wave, factually matching the merged PRs; declares the S2/S3-dead-code-in-3א on-plan nuance; marks "NOT a §15 bar revision". No other §14 content changed.

## PRODUCT-GRADE GATES
- **G1** N/A — removal + docs.
- **G2 (rollback):** `git revert <sha>` restores the debug blocks + docs. Trivial.
- **G3** N/A — removes debug logging, adds no write path.
- **G4** N/A — dead debug-logging removal (no behavior to test) + docs; CI build + admin-panel suite catch a syntax break.
- **G5** N/A — no customer strings (admin-only debug logs removed; docs internal).
- **G6** N/A — no contract/schema/route change; debug-only removal.
- **G7 (security):** PASS — removes hardcoded staff PII (emails) from a PUBLIC repo's live file (§2.8 hygiene). The email lists were cosmetic/defense-in-depth, not the authz gate (server-side custom-claims). No auth/rules behavior changed.

## Anti-premature-closure
- CI (admin-panel vitest + build) must be green — a dangling `shouldDebug` ref would ReferenceError / a syntax break would fail the build; confirm CI-green before merge.
- This closes גל-3א CORE. A4-2 (scrub non-loaded scripts, incl. a personal @gmail — judgment-heavy), A4-3 (ADMIN_EMAILS→config), A4-4 (retire auth Layer-2 — behavioral, devils-advocate) remain, tracked in the map's execution-log.
- Going forward, every גל-3 PR updates the map's execution-log as part of its diff (the anti-drift rule this PR establishes).
