# Rubric — PR-DB-2: delete dead user-app clusters (גל-3ב dead-code)

**Scope:** DEAD-CODE removal (user-app). Deletes 28 verified-dead files across 4 clusters. Re-verified on current origin/main. No rules/schema/migration → no devils-advocate.

## MUST
- **M1 — the 28 deletions, grouped:** chatbot/ (10) + VA-modular 6 (`virtual-assistant/{bundle,core,data,engines,main,ui}.js`) + old draft `js/modules/virtual-assistant.js` + `virtual-assistant/virtual-assistant.css` + 6 dead globals (`statistics-calculator`, `pagination-manager`, `notification-bridge`, `flatpickr-wrapper`, `reports`, `system-diagnostics`) + 4 scratch (`components/add-task/demo.html` + 3 `case-creation/*-UPDATED.txt`). Diff = exactly these 28 + the exec-log doc.
- **M2 — KEEP the live siblings.** `virtual-assistant/virtual-assistant-complete.js` (live) + `js/modules/pagination.js` (the live original; the deleted `pagination-manager.js` was its byte-identical twin) MUST remain on disk (verified).
- **M3 — no live loader / test breaks.** None of the 28 is loaded by any `apps/user-app/**/*.html` `<script src=`/`<link>`, imported by any live JS, or imported by any test. Verified nuances: `virtual-assistant.css` had only a COMMENTED `<link>` (index.html:170); `reports.js` is NOT loaded and NOT imported — the live `reportsTab` UI is powered by `navigation.js` + `virtual-assistant-complete.js`, not by the deleted module.
- **M4 — dist/ untouched.** This PR touches NO file under `apps/user-app/dist/` (that is DB-3). `dist/js/**` (live tsc output) stays.
- **M5 — exec-log maintained.** `docs/HEALTH-MAP` exec-log gains the DB-2 row (+ flips DB-1 #482 to ✅ merged). Additive.

## PRODUCT-GRADE GATES
- **G1** N/A — removal only.
- **G2 (rollback):** `git revert <sha>` restores the 28 files. Trivial, code-only.
- **G3** N/A — no data path.
- **G4** N/A — dead code, zero callers/tests; CI build + user-app vitest catch a stray import of any deleted file.
- **G5** N/A — no customer strings (dead modules never ran).
- **G6** N/A — orphan modules, no live consumer transition.
- **G7 (security):** N/A — display/dead-code only; no auth/PII/rules.

## Anti-premature-closure
- CI (user-app vitest + build) must be green — a stray import of any deleted file would fail the build; the messaging-remnants guard test does not import any candidate.
- messaging/errors cluster NOT included here (separate H.8.0 track). DB-3 (dist dup) + DB-4 (SMSManagement+test) follow.
