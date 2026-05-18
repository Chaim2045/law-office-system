# Rubric — PR-B.10

**Title:** refactor(functions): migrate createQuickLogEntry to canonical helper
**Branch:** feat/migrate-create-quick-log-pr-b-10
**Base:** main
**File:** `functions/timesheet/index.js`
**Scope:** Migration 10 of 13. Manager/admin-only quick-log timesheet entry. 3-phase transaction (read → calc → write). Replace both client-write branches (with-deduction + without-deduction) with `writeClientWithCanonicalAggregates`.

## Equivalence analysis — verified before migration

Source (current, with deduction):
```js
const agg = calcClientAggregates(updatedServices, clientData.totalHours);
clientUpdate = { services: updatedServices, hoursUsed, hoursRemaining, minutesUsed, minutesRemaining, isBlocked, isCritical, lastActivity };
transaction.update(clientRef, clientUpdate);
```

Source (current, no deduction):
```js
transaction.update(clientRef, { lastActivity });
```

Helper recomputes `totalHours` from services (canonical). Same equivalence as PR-B.9: identical for clients without drift; corrects clients with drift on touch.

## Risk profile

**Medium-high.** Used by managers for quick time entry. Multi-phase transaction (3 writes: client + timesheet + audit). 5 deduction paths (hours+package, hours-service-only, fixed, legal_procedure+stage+package, legal_procedure stage-only). Has idempotency + overage detection.

## MUST criteria (block on FAIL)

### M1 — createQuickLogEntry uses writeClientWithCanonicalAggregates for BOTH branches
**Rule:** Both client write paths (with-deduction → `clientUpdate`; no-deduction → `lastActivity` only) routed through helper.
- With deduction: pass `{ services: updatedServices, lastActivity: <serverTimestamp> }`
- Without deduction: pass `{ lastActivity: <serverTimestamp> }` (no `services` — helper uses current)

**Evidence required:** Diff confirms swap; both `transaction.update(clientRef, ...)` calls replaced.

### M2 — Helper call moved to FIRST position in Phase 3 (before other writes)
**Rule:** Per Firestore "all reads before all writes" rule, helper (which does `transaction.get(clientRef)`) must be invoked BEFORE `transaction.set(timesheetRef, ...)` and `transaction.set(logRef, ...)`.
**Evidence required:** Reading Phase 3; helper precedes both writes.

### M3 — All pre-deduction validations + gates preserved
**Rule:** Auth → manager/admin role → idempotency check → clientId/date/minutes/description validation → date parsing → client exists → serviceId resolution (auto-select if single, error if missing) → serviceId-on-client validation → blocked-service check → -10h floor guard.
**Evidence required:** Reading the new code; all checks intact.

### M4 — Deduction logic untouched (5 paths)
**Rule:** All 5 deduction branches preserved:
- hours + active package
- hours + service-level fallback
- fixed service (work tracker)
- legal_procedure + stage + package (hourly)
- legal_procedure stage-only fallback
**Evidence required:** Reading the code; no logic changes in the switch.

### M5 — Timesheet entry + audit log writes preserved
**Rule:** After helper call, the following writes still execute:
- `transaction.set(timesheetRef, entryData)` — with `isQuickLog: true`
- `transaction.set(logRef, { action: 'CREATE_QUICK_LOG_ENTRY', ... })`
**Evidence required:** Reading the code; 2 writes unchanged.

### M6 — Idempotency preserved
**Rule:** `checkIdempotency(data.idempotencyKey)` before transaction; `registerIdempotency(data.idempotencyKey, result)` after. Unchanged.
**Evidence required:** Reading the code.

### M7 — `lastActivity` field preserved
**Rule:** Helper receives `lastActivity: serverTimestamp` in payload; passes through (NOT in RESTRICTED_KEYS). Helper also adds `lastModifiedAt + lastModifiedBy` via auditMeta (additive).
**Evidence required:** Test verifies `lastActivity` in helper write payload.

### M8 — Tests cover migrated path
**Rule:** New test file `functions/tests/create-quick-log-canonical-helper.test.js`:
- Auth + role check (auth-error, non-manager → permission-denied)
- Validation (missing clientId/date/minutes/description, invalid date)
- Lookup (client not found, service not found, blocked service)
- Helper integration (with-deduction path):
  - hours+package → helper called with services+lastActivity, aggregates derived
  - fixed service → work tracker updated, helper called
  - legal_procedure → stage update, helper called
- Helper integration (no-deduction path):
  - resolvedServiceId absent → helper called with lastActivity only
  - aggregates unchanged (recompute matches current)
- Phase 3 ordering — helper before timesheet + log writes (call order)
- Idempotency — repeated call with same key returns cached result
**Evidence required:** New test file + Jest output.

### M9 — All other tests pass + lint zero
**Rule:** functions Jest + root Vitest green. `npm run lint` 0 errors.
**Evidence required:** Test runner output.

## SHOULD criteria

### S1 — Migration comment tagged PR-B.10 + pattern source PR-B.9
**Evidence required:** Inline comment.

### S2 — auditMeta carries `{ uid, username }`
**Evidence required:** Reading the code.

### S3 — PR description names PR-B.9 predecessor + 10/13 + equivalence analysis
**Evidence required:** PR description.

### S4 — Comment notes both-branch routing
**Rule:** Inline comment explains why no-deduction path also routes through helper (consistency + drift cleanup-on-touch).
**Evidence required:** Comment block.

## Out of scope

- Other 3 callsites
- Deduction logic refactor
- Idempotency mechanism changes
- Date parsing changes
- Adding new validation

## Rollback

`git revert <merge-commit>` → CI redeploys. Function reverts to prior 3-phase + manual aggregate block. Idempotency + deduction logic unchanged across revert. No data corruption.

## Notes for grader

- Pattern from PR-B.9 — same Phase 3 ordering constraint.
- The no-deduction path is the simpler case: just metadata update. Helper recomputes aggregates from current services (no change in steady state). Drift cleanup-on-touch is the side effect we want.
- `isQuickLog: true` flag distinguishes these entries in timesheet_entries. Preserved.
- Audit log goes to `audit_log` collection (separate from action_logs used by addTimeToTask). Preserved.
