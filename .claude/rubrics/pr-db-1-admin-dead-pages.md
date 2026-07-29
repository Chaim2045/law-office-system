# Rubric — PR-DB-1: delete dead admin pages + orphan assets (גל-3ב dead-code)

**Scope:** DEAD-CODE removal (admin-panel). Deletes 8 verified-dead files (4 orphan HTML pages + case-number-generator.js + 3 orphan CSS). Re-verified on current origin/main by a read-only investigation. No rules/schema/migration → no devils-advocate.

## MUST
- **M1 — exactly the 8 verified-dead files deleted:** `tasks.html`, `timesheet.html`, `debug-firebase-init.html`, `feature-flags.html` (4 orphan pages, none in `Navigation.js`, each loads non-existent scripts), `js/modules/case-number-generator.js` (zero loader), `css/case-creation-dialog.css` + `components/styles/task-approval-panel.css` + `components/styles/task-approval-dialog.css` (zero `<link>` load). Diff = exactly these 8 deletions + the exec-log doc.
- **M2 — the LIVE twin is NOT touched.** `components/task-approval-system/styles/task-approval-dialog.css` (loaded by `clients.html` + `index.html`) MUST remain — only the `components/styles/` copy is deleted. (Verified: live twin still on disk.)
- **M3 — no live loader / test breaks.** None of the 8 is loaded by any `*.html` `<script>`/`<link>`, referenced by admin JS, or imported by any test. `clients-fluent.html` + the Fluent stack (LIVE/frozen) are untouched.
- **M4 — execution-log maintained (anti-drift).** `docs/HEALTH-MAP` exec-log gains the DB-1 row (+ flips A4-2 #481 to ✅ merged) + the גל-3ב plan note. Additive only.

## PRODUCT-GRADE GATES
- **G1** N/A — removal only.
- **G2 (rollback):** `git revert <sha>` restores the 8 files. Trivial, code-only.
- **G3** N/A — no data path.
- **G4** N/A — dead pages/assets with zero callers/tests; CI build catches a stray reference.
- **G5** N/A — no customer strings (dead pages never reached users).
- **G6** N/A — orphan files, no live consumer transition.
- **G7 (security):** PASS (minor) — removes 4 broken/debug pages served publicly (reduces the public admin surface). No auth/rules/PII behavior changed.

## Anti-premature-closure
- CI (admin-panel vitest + build) must be green — nothing loaded was touched; a stray reference would fail the build.
- Cosmetic doc-drift (stale mentions in SYSTEM_MAP / DESIGN_BAR / hosting-cache) will dangle — non-blocking, folds into the docs wave (גל-3ד).
- DB-2/DB-3/DB-4 follow; messaging/errors cluster on the separate H.8.0 track.
