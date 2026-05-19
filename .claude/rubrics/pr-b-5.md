# Rubric — PR-B.5

**Title:** refactor(functions): migrate changeServiceStatus to canonical helper
**Branch:** feat/migrate-change-service-status-pr-b-5
**Base:** main
**Scope:** Migration 5 of 13. `changeServiceStatus` transitions a service between `active|completed|on_hold|archived`, appends an entry to `statusChangeHistory[]`, conditionally sets `completedAt`, then writes the manual aggregate block. Replace the aggregate block with `writeClientWithCanonicalAggregates`. Same pattern as PR-B.4 — `totalServices` / `activeServices` pass through.

## Risk profile

**Low-medium.** Service-level history mutation is the only new wrinkle vs PR-B.4. Aggregate plumbing identical.

## MUST criteria (block on FAIL)

### M1 — changeServiceStatus uses writeClientWithCanonicalAggregates
**Rule:** Body calls `writeClientWithCanonicalAggregates(transaction, clientRef, { services, totalServices, activeServices }, { caller: 'changeServiceStatus', auditMeta: { uid, username } })`. Manual aggregate block removed.
**Evidence required:** Diff confirms swap. No `hoursUsed/hoursRemaining/minutesUsed/minutesRemaining/isBlocked/isCritical/totalHours/lastModifiedAt/lastModifiedBy` in this CF anymore.

### M2 — Validations preserved (auth → clientId → serviceId → newStatus in VALID_STATUSES → client exists → service exists → not-same-status)
**Rule:** All 7 checks in order. `failed-precondition` for same-status preserved.
**Evidence required:** Reading the new code.

### M3 — Service mutation preserved (status + statusChangedAt + statusChangedBy + previousStatus + statusChangeHistory append)
**Rule:** `updatedService` includes ALL 5 fields. `statusChangeHistory` is an array — new entry APPENDED (not replaced), preserving prior history.
**Evidence required:** Reading the code + test asserts the history array grows.

### M4 — Conditional completedAt setting preserved
**Rule:** When `newStatus === 'completed'` AND `service.completedAt` not already set → assign `completedAt = now`. NOT set on other transitions.
**Evidence required:** Reading the code + test for both branches.

### M5 — totalServices + activeServices computed after mutation
**Rule:** Counts reflect post-transition state. Critically: transitioning to/from `active` changes `activeServices` count.
**Evidence required:** Tests assert correct counts for multiple transitions.

### M6 — Audit log preserved
**Rule:** `logAction('CHANGE_SERVICE_STATUS', uid, username, { clientId, serviceId, serviceName, serviceType, previousStatus, newStatus, note })` outside transaction. Note trimmed to 500 chars.
**Evidence required:** Reading the code.

### M7 — Return value preserved
**Rule:** Return shape `{ success, serviceId, serviceName, previousStatus, newStatus, statusChangedAt, clientAggregates, message }`. `clientAggregates` sourced from helper.
**Evidence required:** Reading the code.

### M8 — Tests cover migrated path
**Rule:** New test file `functions/tests/change-service-status.test.js`:
- Auth + validation (4): auth-error, missing clientId, missing serviceId, invalid newStatus
- Lookup (2): client / service not found
- Guard (1): same-status → failed-precondition + no write
- Helper integration (4): 
  - active → completed (sets completedAt, helper called)
  - completed → active (does NOT erase completedAt; helper called)
  - active → on_hold (activeServices decrements)
  - statusChangeHistory append (preserves prior entries)
- Audit log (1)
- Return shape (1)
**Evidence required:** New test file + Jest output.

### M9 — All other tests pass + lint zero
**Rule:** functions Jest + root Vitest green. `npm run lint` 0 errors.
**Evidence required:** Test runner output.

## SHOULD criteria

### S1 — Migration comment tagged PR-B.5
**Rule:** Inline comment references PR-B.5 + pattern source PR-B.1-B.4.
**Evidence required:** Comment block.

### S2 — auditMeta carries `{ uid, username }`
**Evidence required:** Reading the code.

### S3 — PR description names PR-B.4 as predecessor + 5/13
**Evidence required:** PR description.

## Out of scope

- Other 8 callsites
- Changing VALID_STATUSES list
- Changing history shape
- Note size limit (500 chars preserved)

## Rollback

`git revert <merge-commit>` → CI redeploys. Function reverts to prior block. No data corruption.

## Notes for grader

- This CF has 4 valid statuses (active, completed, on_hold, archived). NOT to confuse with client-level `isOnHold` field (different field, different scope).
- `statusChangeHistory` is the rare case where the migration is on data NOT covered by aggregator. Helper passes services through wholesale — the history append survives because services[i] is wholesale replaced with updatedService (which carries the updated history array).
- I3 / I1 implications: completing a service doesn't remove it from billable accounting (same as PR-B.4 finding). Tests should NOT expect `isBlocked=false` after completing a depleted hours service.
