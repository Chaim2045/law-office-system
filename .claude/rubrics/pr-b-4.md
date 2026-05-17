# Rubric — PR-B.4

**Title:** refactor(functions): migrate completeService to canonical helper
**Branch:** feat/migrate-complete-service-pr-b-4
**Base:** main
**Scope:** Migration 4 of 13. `completeService` marks a service `status: 'completed'` + `completedAt: <iso>` and writes the manual aggregate block. Replace the aggregate block with `writeClientWithCanonicalAggregates`. Same pattern as PR-B.3 — `totalServices` / `activeServices` pass through as non-restricted fields.

## Risk profile

**Low.** Smaller shape than PR-B.3 (no timesheet_entries guard, no full snapshot for audit). Toggle is one-way (`active` → `completed`).

## MUST criteria (block on FAIL)

### M1 — completeService uses writeClientWithCanonicalAggregates
**Rule:** Body calls `writeClientWithCanonicalAggregates(transaction, clientRef, { services, totalServices, activeServices }, { caller: 'completeService', auditMeta: { uid, username } })`. Manual aggregate block removed.
**Evidence required:** Diff confirms swap. No more `hoursUsed/hoursRemaining/minutesUsed/minutesRemaining/isBlocked/isCritical/totalHours/lastModifiedAt/lastModifiedBy` in this CF.

### M2 — Validations preserved (auth → clientId → serviceId → client exists → service exists → not-already-completed)
**Rule:** All 6 checks in the right order. `failed-precondition` for already-completed status preserved.
**Evidence required:** Reading the new code.

### M3 — Service mutation preserved
**Rule:** `updatedService = { ...service, status: 'completed', completedAt: <iso> }`. Immutable `services.map()` replacement. `completedAt` is an ISO string (not serverTimestamp).
**Evidence required:** Reading the code.

### M4 — totalServices + activeServices pass through correctly
**Rule:** Computed AFTER the service is marked completed: `totalServices = updatedServices.length`, `activeServices = updatedServices.filter(s => s.status === 'active').length`. Note the just-completed service drops out of activeServices count.
**Evidence required:** Test asserts the count.

### M5 — Audit log preserved
**Rule:** `logAction('COMPLETE_SERVICE', user.uid, user.username, { clientId, caseNumber, serviceId, serviceName, serviceType, completedAt })` outside transaction.
**Evidence required:** Reading the code.

### M6 — Return value preserved
**Rule:** Return shape `{ success, serviceId, serviceName, serviceType, completedAt, clientAggregates: { totalHours, hoursRemaining, minutesRemaining, isBlocked, isCritical, totalServices, activeServices }, message }`. `clientAggregates` now sourced from helper's return.
**Evidence required:** Reading the new code.

### M7 — Tests cover migrated path
**Rule:** New test file `functions/tests/complete-service.test.js`:
- Auth + validation (4): auth-error, missing clientId, missing serviceId
- Lookup (2): client / service not found
- Guard (1): already-completed → failed-precondition + no write
- Helper integration (3): happy path (helper called, status=completed, completedAt set), activeServices count decreases by 1, last-billable-completed → I1 (isBlocked=false even if hours depleted)
- Audit log (1)
- Return shape (1)
**Evidence required:** New test file + Jest output.

### M8 — All other tests pass + lint zero
**Rule:** functions Jest + root Vitest green. `npm run lint` 0 errors.
**Evidence required:** Test runner output.

## SHOULD criteria

### S1 — Migration comment tagged PR-B.4 + references pattern from PR-B.3
**Rule:** Inline comment names PR-B.4 + the 3 prior migrations as pattern source.
**Evidence required:** Comment block.

### S2 — auditMeta carries `{ uid, username }`
**Evidence required:** Reading the code.

### S3 — PR description names PR-B.3 as immediate predecessor + migration 4/13
**Evidence required:** PR description.

## Out of scope

- Other 9 callsites
- Changing "already completed" guard
- Changing completedAt format (ISO string preserved)

## Rollback

`git revert <merge-commit>` → CI redeploys. Function reverts to prior block. No data corruption.

## Notes for grader

- This is the closest twin of PR-B.3 yet — same shape, same `totalServices`/`activeServices` pass-through pattern.
- The just-completed service drops from `activeServices` count — test must assert the count decreases (e.g., 2 services, complete 1 → activeServices=1).
- I1 case is relevant if completing the last billable service while a fixed-only remains → isBlocked=false derived.
