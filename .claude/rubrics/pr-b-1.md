# Rubric — PR-B.1

**Title:** refactor(functions): migrate setServiceOverride to writeClientWithCanonicalAggregates
**Branch:** feat/migrate-set-service-override-pr-b-1
**Base:** main
**Scope:** Replace the `transaction.update(clientRef, { services + 6 aggregate fields })` block in `setServiceOverride` (functions/clients/index.js:1218) with a call to `writeClientWithCanonicalAggregates`. The behavior must be identical — `setServiceOverride` already calls `calcClientAggregates` and writes a clean aggregate object. The migration adds: assertion guard, violation logging, kill-switch coverage, RESTRICTED_KEYS strip defense-in-depth.

## Risk profile

**Low.** Smallest partialUpdate shape in the codebase (one swap of `services[]`). Admin-only flow, low traffic. Identical behavior expected.

## MUST criteria (block on FAIL)

### M1 — setServiceOverride uses writeClientWithCanonicalAggregates
**Rule:** `functions/clients/index.js:setServiceOverride` calls `writeClientWithCanonicalAggregates(transaction, clientRef, { services: updatedServices }, { caller: 'setServiceOverride', auditMeta: { uid: user.uid, username: user.username } })`. The prior `transaction.update(clientRef, { services + 6 aggregate fields + lastModified })` is removed.
**Evidence required:** Grep for `writeClientWithCanonicalAggregates` in `setServiceOverride` body. The 6 manually-written aggregate fields no longer appear.

### M2 — Pre-helper validation preserved
**Rule:** The existing validation must run BEFORE the helper call: auth (admin role), arg shape (`clientId, serviceId, active`), client exists (via the helper's `transaction.get`), service exists, service.type === HOURS. None of these checks may be silently removed.
**Evidence required:** Reading the new code; all 5 checks still present and in the right order.

### M3 — Audit log unchanged
**Rule:** `logAction('SET_SERVICE_OVERRIDE' | 'REMOVE_SERVICE_OVERRIDE', ...)` is still called outside the transaction with the same payload shape. The helper's `auditMeta` is a SECOND audit channel — does NOT replace the explicit logAction.
**Evidence required:** Both calls present.

### M4 — Return value unchanged
**Rule:** Return shape `{ success: true, serviceId, overrideActive }` is preserved exactly.
**Evidence required:** Reading the new code.

### M5 — Behavior verified by tests
**Rule:** Either (a) existing tests already cover setServiceOverride and continue to pass, OR (b) at least one new Jest test is added that exercises the migrated path:
- Happy path (active=true): override flag set, helper called, aggregates recomputed
- Happy path (active=false): override cleared, helper called, aggregates recomputed
- Authorization: non-admin → permission-denied (unchanged)
**Evidence required:** Jest output + test file changes if any.

### M6 — All existing tests pass
**Rule:** `cd functions && npm test` AND root `npm test` both pass. No regression. Count does not drop.
**Evidence required:** Jest + Vitest output.

### M7 — Lint zero errors
**Rule:** `npm run lint` returns 0 errors.
**Evidence required:** Lint output.

## SHOULD criteria

### S1 — Migration comment
**Rule:** Inline comment near the helper call references the migration (PR-B.1) and names the prior pattern so future readers understand why this was changed (not just functional regression).
**Evidence required:** Reading the comment block.

### S2 — Helper auditMeta carries username
**Rule:** `auditMeta` passed to the helper includes `username` so the helper's `lastModifiedBy` field aligns with the user who triggered the action.
**Evidence required:** Code shows `auditMeta: { uid: user.uid, username: user.username }`.

### S3 — Pattern documented for next migrations
**Rule:** PR description or commit message names the pattern that will be reused for the remaining 12 PR-B migrations (extract the in-transaction `calcClientAggregates + transaction.update` block, replace with the helper call, keep validations outside).
**Evidence required:** PR description / commit message.

## Out of scope

- Migrating any other callsite (each gets its own sub-PR)
- Changing the return value shape
- Changing validation order or business rules
- Removing the explicit `logAction` call (the helper's auditMeta is supplementary)
- Adding new tests for unrelated paths

## Rollback

`git revert <merge-commit>` on main → CI redeploys. `setServiceOverride` reverts to the prior `transaction.update` block. The helper remains in place; only this one callsite reverts. No data corruption possible.

## Notes for grader

- This is THE FIRST sub-PR of PR-B (refactor 13 callsites). Pattern proven here is reused for the next 12. Be appropriately strict — if M1-M7 PASS, the pattern is validated.
- The helper's RESTRICTED_KEYS will strip any aggregate field if the caller accidentally sends one. In this migration, the new partialUpdate is `{ services: updatedServices }` — no aggregate fields included — so stripping is a no-op in steady state.
- The helper does its own `transaction.get(clientRef)` — that's a SECOND read in the same transaction. Firestore caches reads within a transaction; this is not a duplicate billable read. No optimization needed.
