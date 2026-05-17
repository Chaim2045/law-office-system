# Rubric — PR-B.3

**Title:** refactor(functions): migrate deleteService to canonical helper
**Branch:** feat/migrate-delete-service-pr-b-3
**Base:** main
**Scope:** Migration 3 of 13. `deleteService` in `functions/services/index.js` writes `services + totalServices + activeServices + totalHours + 6 aggregate fields + lastModified*`. Replace the aggregate-block writes with `writeClientWithCanonicalAggregates`; keep `totalServices` and `activeServices` as caller-supplied pass-through fields (they are NOT in RESTRICTED_KEYS).

## Risk profile

**Low-medium.** Slightly more complex than B.1/B.2 because of additional non-restricted fields (`totalServices`, `activeServices`) that helper passes through. Pre-existing constraint: refuse to delete if `timesheet_entries` exist for the service (preserved).

## MUST criteria (block on FAIL)

### M1 — deleteService uses writeClientWithCanonicalAggregates
**Rule:** The body calls `writeClientWithCanonicalAggregates(transaction, clientRef, { services: updatedServices, totalServices, activeServices }, { caller: 'deleteService', auditMeta: { uid, username } })`. The prior manual aggregate block is removed.
**Evidence required:** Diff shows the swap. Manual `hoursUsed/hoursRemaining/minutesUsed/minutesRemaining/isBlocked/isCritical/totalHours` lines gone.

### M2 — Validations preserved (order matters)
**Rule:** auth → arg shape (`clientId, serviceId`) → client exists → service exists → no timesheet_entries with serviceId. None silently removed or reordered.
**Evidence required:** Reading the new code.

### M3 — totalServices + activeServices pass through correctly
**Rule:** After filtering out the deleted service, `totalServices = updatedServices.length` and `activeServices = updatedServices.filter(s => s.status === 'active').length` are still computed correctly and passed to the helper. Helper passes them through (they are not in RESTRICTED_KEYS).
**Evidence required:** Helper write payload (in test) contains both fields.

### M4 — Audit log preserved
**Rule:** `logAction('DELETE_SERVICE', user.uid, user.username, { clientId, serviceId, serviceName, serviceType, deletedServiceSnapshot })` STILL called outside the transaction with the full snapshot.
**Evidence required:** Reading the code.

### M5 — Return value preserved
**Rule:** Return shape `{ success, serviceId, serviceName, deletedService, clientAggregates: { totalHours, hoursUsed, hoursRemaining, minutesRemaining, isBlocked, isCritical, totalServices, activeServices }, message }` unchanged. The `clientAggregates` block now sources its values from the helper's return.
**Evidence required:** Reading the new code + comparing shape.

### M6 — Tests cover migrated path
**Rule:** New test file `functions/tests/delete-service.test.js` covering at minimum:
- Auth: non-authenticated → unauthenticated
- Validation: missing args (clientId / serviceId)
- Lookup: client / service not found
- Guard: timesheet_entries exist → failed-precondition
- Happy path: helper called with `{ services, totalServices, activeServices }`, service removed from array, aggregates derived
- Aggregates: deleting last billable service → fixed-only → isBlocked=false (I1)
**Evidence required:** New test file + Jest output.

### M7 — All other tests pass
**Rule:** Functions Jest + root Vitest green. No regression.
**Evidence required:** Test runner output.

### M8 — Lint zero errors
**Rule:** `npm run lint` returns 0 errors.
**Evidence required:** Lint output.

## SHOULD criteria

### S1 — Migration comment tagged PR-B.3
**Rule:** Inline comment names PR-B.3 + references the PR-B.1 pattern + notes the totalServices/activeServices pass-through nuance.
**Evidence required:** Reading the comment.

### S2 — auditMeta carries `{ uid, username }`
**Rule:** Standard helper pattern.
**Evidence required:** Reading the code.

### S3 — PR description names PR-B.1/.B.2 as pattern source
**Rule:** PR body mentions previous migrations + notes this is migration 3 of 13.
**Evidence required:** PR description.

## Out of scope

- Other 10 callsites
- Changing the timesheet_entries guard
- Removing audit log
- Changing return shape

## Rollback

`git revert <merge-commit>` → CI redeploys. Function reverts to prior block. Helper remains. No data corruption.

## Notes for grader

- `totalServices` and `activeServices` are NOT in RESTRICTED_KEYS. Helper passes them through. Verify in tests that the helper write payload includes both fields with correct values.
- I1 path is testable here: deleting the last hours-service from a client leaves only fixed services → I1 → isBlocked=false (even if hoursUsed shows 0).
- `deletedServiceSnapshot` for audit recovery preserved — full pre-delete service object captured before the filter.
