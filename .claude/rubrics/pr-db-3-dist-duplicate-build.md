# Rubric — PR-DB-3: delete the duplicate `dist/` build (גל-3ב dead-code)

**Scope:** DEAD-CODE removal (user-app build output). Deletes 21 files across 4 stale build subtrees under `apps/user-app/dist/`, KEEPING the live `dist/js/**` (the tsc output loaded by `index.html`). Re-verified on current origin/main by a read-only investigation. No rules/schema/migration → no devils-advocate.

## MUST
- **M1 — exactly the 4 dead subtrees deleted (21 files):** `apps/user-app/dist/apps/**` + `apps/user-app/dist/types/**` (a nested duplicate tsc build — wrong `outDir`) + `apps/user-app/dist/index.html` + `apps/user-app/dist/assets/**` (a stale Vite bundle). Diff = exactly these 21 deletions + the exec-log doc.
- **M2 — KEEP `dist/js/**`.** The live tsc output (`dist/js/core/event-bus.js`, `dist/js/services/firebase-service.js`, …) is loaded by `apps/user-app/index.html:1229-1230` and MUST remain untouched (verified: 12 tracked files, 0 appear in this diff).
- **M3 — no live loader / runtime dep.** None of the 4 deleted subtrees is referenced by any `apps/user-app/**/*.html` (`<script src=`/`<link>`) — the live entry `index.html` loads `dist/js/` directly, never `dist/index.html`/`dist/assets/`. Verified: `dist/js/**` has NO runtime `import` from `../apps`/`../types`/`assets` (the deleted `.d.ts`/`.js.map` under `dist/apps`+`dist/types` are compile-time artifacts, never browser-loaded).
- **M4 — exec-log maintained (anti-drift).** `docs/HEALTH-MAP` exec-log gains the DB-3 row (+ flips DB-2 #483 to ✅ מוזג). Additive only.

## PRODUCT-GRADE GATES
- **G1** N/A — removal only.
- **G2 (rollback):** `git revert <sha>` restores the 21 files. Trivial, build-artifact-only.
- **G3** N/A — no data path.
- **G4** N/A — regenerable build output with zero live loader; CI build + user-app vitest catch a stray reference.
- **G5** N/A — no customer strings (stale build never served; the live entry is the repo-root `index.html` + `dist/js/`).
- **G6** N/A — orphan build artifacts, no live consumer transition.
- **G7 (security):** N/A — build output only; no auth/PII/rules.

## Anti-premature-closure
- CI (user-app vitest + build) must be green — a stray reference to `dist/index.html`/`dist/assets` would fail; verified none exists.
- DB-4 (SMSManagement + its test) follows. messaging/errors cluster on the separate H.8.0 track.
