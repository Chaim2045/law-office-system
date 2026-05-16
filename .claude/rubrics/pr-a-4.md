# Rubric — PR-A.4

**Title:** feat(clients): refactor changeClientStatus + isOnHold + modal UI
**Branch:** feat/client-write-helper-pr-a-4
**Base:** main
**Scope:** Wire `writeClientWithCanonicalAggregates` (PR-A.2) into `changeClientStatus`, replace caller-supplied `isBlocked` with derived value, accept new `isOnHold` field (PR-A.3) as manual freeze input, replace native `prompt()` UX with a proper modal, update User App guard to check `(isBlocked || isOnHold)`.

## MUST criteria (block on FAIL)

### M1 — changeClientStatus routes writes through the helper
**Rule:** `functions/clients/index.js:changeClientStatus` calls `writeClientWithCanonicalAggregates` (from `functions/shared/client-writer.js`) instead of `transaction.update(clientRef, ...)` directly.
**Evidence required:** Grep `functions/clients/index.js` for `writeClientWithCanonicalAggregates`. The old direct `transaction.update(clientRef, { isBlocked, isCritical, status, ... })` is removed.

### M2 — caller-supplied isBlocked is rejected
**Rule:** `data.isBlocked` from caller is either (a) silently stripped by the helper (preferred), or (b) rejected with explicit error. NOT written to Firestore.
**Evidence required:** Either no reference to `data.isBlocked` in the new code, OR an explicit check that throws `invalid-argument` when present.

### M3 — isOnHold is the new manual freeze input
**Rule:** `changeClientStatus` accepts `data.isOnHold` (boolean) and writes it to the client doc. Mutual exclusion with `isCritical` if applicable.
**Evidence required:** Code path that reads `data.isOnHold` and includes it in the helper's `partialUpdate`.

### M4 — Native prompt() removed
**Rule:** `apps/admin-panel/js/ui/ClientManagementModal.js` no longer calls `prompt(...)` for status change. A proper modal/dialog component is used instead.
**Evidence required:** Grep `apps/admin-panel/js/ui/ClientManagementModal.js` for `prompt(`. Should return 0 hits for the status-change flow.

### M5 — User App guard checks both fields
**Rule:** `apps/user-app/js/modules/client-validation.js` and `apps/user-app/js/modules/client-hours.js` both check `(client.isBlocked || client.isOnHold)` when populating the blocked-clients Set.
**Evidence required:** Grep both files for `isOnHold` reference combined with `isBlocked`.

### M6 — PR-A.1 CONTRACT-CHANGED tests are migrated, not deleted
**Rule:** Each test in `functions/tests/change-client-status.test.js` tagged `// CONTRACT-CHANGED-IN-PR-A` is either:
- Updated to test the new contract (the tag may be removed), or
- Replaced by a new equivalent test
**NOT** silently deleted.
**Evidence required:** Diff of `change-client-status.test.js` shows updates (not deletions) for each tagged test, OR new equivalent tests appear.

### M7 — All existing tests pass
**Rule:** `cd functions && npm test` and root `npm test` both pass with zero failures. Total test count does not drop.
**Evidence required:** Test runner output.

### M8 — Helper invariant assertion is exercised
**Rule:** At least one new test verifies that an attempted bypass (e.g. caller sends `isBlocked: true` on a fixed-only client) is correctly handled (stripped, derived value used, no Firestore write of attacker value).
**Evidence required:** Test name + code that proves the assertion fires.

### M9 — Audit log includes both isBlocked (derived) and isOnHold (manual) in payload
**Rule:** The `logAction('CHANGE_CLIENT_STATUS', ...)` payload includes the new `isOnHold` field, so audit history captures both concerns.
**Evidence required:** Code path that builds the audit log payload includes `isOnHold`.

### M10 — Lint zero errors
**Rule:** `npm run lint` returns 0 errors.
**Evidence required:** Lint output.

## SHOULD criteria (warning on FAIL)

### S1 — Modal accessibility
**Rule:** New modal supports keyboard navigation (Tab, Enter, Esc) and ARIA attributes (role="dialog", aria-labelledby, focus trap).
**Evidence required:** HTML/JS shows ARIA usage.

### S2 — Toast / success message updated
**Rule:** Success message reflects the new semantics ("הוקפא" for isOnHold vs "חסום" for derived isBlocked — they may show differently).
**Evidence required:** String literals in success path.

### S3 — Admin panel UI shows reason separately
**Rule:** In `ClientsTable.js` or `ClientManagementModal.js`, the badge/pill shows whether the block reason is derived (`isBlocked`) or manual (`isOnHold`), or at minimum displays both states distinguishably.
**Evidence required:** Display logic reads both fields.

### S4 — Documentation updated
**Rule:** `SYSTEM_MAP.md` or relevant doc updated to mention the new `isOnHold` field on the `clients` collection.
**Evidence required:** Diff of doc files.

### S5 — Migration script run before PR-A.4 lands
**Rule:** PR description confirms `scripts/add-isOnHold-field-2026-05-16.js --confirm` has been run successfully on PROD (or that lazy backfill in the helper handles missing field). Otherwise old clients without `isOnHold` could trigger undefined-boolean issues in the User App guard.
**Evidence required:** Quote from PR description OR proof of helper lazy-default behavior.

## Out of scope

This PR explicitly does NOT do:

- Refactor the other 13 callsites that touch client docs (that's PR-B).
- Add the `clientInvariantViolations` collection (that's PR-A.5).
- Tighten Firestore Rules (that's PR-A.5).
- Add scheduled scanner / WhatsApp alerts (that's PR-C).
- Repair the 23 historically-corrupted clients (that's PR-D).

The grader should NOT downgrade for these absences.

## Rollback

If something breaks in DEV after merge:

1. `git revert <merge-commit>` on main
2. `git push origin main`
3. CI re-deploys reverted state to DEV (5 min)
4. Firebase Functions roll back automatically on next deploy
5. The `isOnHold` field added by PR-A.3 stays harmless (default false everywhere)
6. UI returns to native `prompt()` flow

If something breaks in PROD after promote:
- Same revert flow + promote revert
- `firebase deploy --only functions` from a clean checkout of pre-merge main
- Smoke: verify changeClientStatus works for both block + unblock flows

## Notes for grader

- The helper `writeClientWithCanonicalAggregates` was added in PR-A.2 (merged). It already has 29 tests.
- The `isOnHold` field on clients was added in PR-A.3 (merged). Migration script exists but may or may not have run on PROD by the time of grading — verify via S5.
- The PR-A.1 baseline tests for `changeClientStatus` are 23 tests. Several are tagged `CONTRACT-CHANGED-IN-PR-A` — those must be migrated, not deleted.
- This PR is the FIRST behavioral-change PR in the series. Up to here, everything was additive. Extra scrutiny on regressions.
