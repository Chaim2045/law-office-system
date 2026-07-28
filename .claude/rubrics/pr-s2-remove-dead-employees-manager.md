# Rubric — PR-S2: remove dead password module (גל-3א / dead-code)

**Scope:** DEAD-CODE removal. Deletes `apps/user-app/js/modules/employees-manager.js` (549 lines, loaded-but-uncalled) + its `<script>` load. Closes the last live thread of the "cleartext passwords" finding (the 3 plaintext sinks lived in this uncalled module). Live auth = Firebase Auth (separate, untouched). No rules/schema/migration → no devils-advocate (§3.8.4 not triggered; pure dead-code delete, investigated).

## MUST
- **M1 — the removal.** `employees-manager.js` deleted (whole file); its `<script type="module" src="…employees-manager.js…">` line + dedicated comment removed from `apps/user-app/index.html`. Diff scope = exactly these 2 files.
- **M2 — no load-time side effect.** The deleted module's IIFE did ONLY `window.EmployeesManager = {…}` registration + declarations (no `addEventListener`, no `DOMContentLoaded`, no immediate Firestore call, no timer, no auto-run; the one debug log is gated `DEBUG=false` → no-op). Removing its load breaks nothing.
- **M3 — nothing references it.** Zero LIVE references to `employees-manager`/`EmployeesManager` remain in `apps/` (excl. the orphan `dist/` bundle) or `functions/`. Zero tests reference it. No admin-panel twin (verified in S2 investigation + post-#474).
- **M4 — security thread closed.** The 3 cleartext-password sinks (`addEmployee`/`updateEmployee`/`authenticate`) were all inside this now-deleted uncalled module. Post-#474 + this PR, NO cleartext `password`-field write remains in live code (the live `createUser` CF hands the password to Firebase Auth, writes no password field).

## PRODUCT-GRADE GATES
- **G1** N/A — removal only.
- **G2 (rollback):** `git revert <sha>` restores the file + script tag. Trivial, code-only.
- **G3** N/A — removes code, no write path added.
- **G4** N/A — dead code with zero callers and zero existing tests; nothing to test (there is no live scenario to prove). CI runs the user-app suite to confirm no import breaks.
- **G5** N/A — no customer strings changed.
- **G6** N/A — dead code, no live consumer transitions; not a contract/schema/route change.
- **G7 (security):** PASS — net security improvement: removes the last cleartext-password code sinks from the repo. No auth/rules/PII-handling behavior changed (live auth is Firebase Auth, untouched).

## Anti-premature-closure
- CI (user-app vitest + build) must be green — a stray import of the deleted module would fail the build; confirm CI-green before merge.
- The stale `dist/` bundle still embeds the module definition (orphan build artifact) — clears on any rebuild; out of scope here.
