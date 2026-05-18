# Rubric — PR-B.11

**Title:** refactor(functions): migrate createTimesheetEntry_v2 to canonical helper
**Branch:** feat/migrate-create-timesheet-entry-pr-b-11
**Base:** main
**File:** `functions/timesheet/index.js`
**Scope:** Migration 11 of 13. Main timesheet-entry CF (user-app + admin-panel call site). Has **optimistic-lock via `_version`**, idempotency, 2-phase commit (reservation + commit), event sourcing. Replace both client-write branches (with-deduction + without-deduction) with `writeClientWithCanonicalAggregates`. Preserve `_version`, `_lastModified`, `_modifiedBy`, `lastActivity` (all pass-through).

## Equivalence analysis — verified before migration

Same as PR-B.9/B.10:
- Source: `calcClientAggregates(updatedServices, clientData.totalHours)` → uses DB totalHours (drift possible)
- Helper: recomputes totalHours from services (canonical)
- Identical for clients without drift; corrects on touch

## Risk profile

**High.** Most-traffic write CF. Optimistic locking via `_version` field (must NOT be in RESTRICTED_KEYS — helper passes through). 2-phase commit reservation envelope. Event sourcing post-transaction. Internal-case handling (skip client read/write entirely).

## MUST criteria (block on FAIL)

### M1 — createTimesheetEntry_v2 uses helper for BOTH branches
**Rule:** Both client writes (with-deduction at line ~860, no-deduction at line ~876) replaced by `writeClientWithCanonicalAggregates`. Each passes the appropriate `partialUpdate`:
- With deduction: `{ services: updatedServices, _version: nextVersion, _lastModified: serverTimestamp(), _modifiedBy: user.username, lastActivity: serverTimestamp() }`
- Without deduction: `{ _version: nextVersion, _lastModified: serverTimestamp(), _modifiedBy: user.username, lastActivity: serverTimestamp() }` (no `services` — helper uses current)

**Evidence required:** Diff confirms swap; manual aggregate fields removed.

### M2 — `_version` field passes through unchanged
**Rule:** `_version: nextVersion` is in helper payload. Helper does NOT strip it (not in RESTRICTED_KEYS). The optimistic-locking guarantee preserved.
**Evidence required:** Test asserts `_version` in helper write payload + write proceeds with expected value.

### M3 — Optimistic-lock validation preserved
**Rule:** `if (data.expectedVersion !== undefined && currentVersion !== data.expectedVersion) throw 'aborted'` check at line ~670 unchanged.
**Evidence required:** Reading the code.

### M4 — Internal-case skip preserved
**Rule:** When `data.isInternal === true`, the entire client read/write block (lines ~661-883) is skipped via `if (data.isInternal !== true)`. After migration, this skip still works — helper NOT called for internal cases.
**Evidence required:** Reading the code; internal-task branch bypasses helper.

### M5 — All pre-deduction guards preserved
**Rule:** Auth → idempotency → clientId/date/minutes/action validation → taskId-or-internal rule → reservation → client exists → version check → serviceId resolution → serviceId-on-client validation → blocked-service check → -10h floor.
**Evidence required:** Reading the new code; all 11 guards intact.

### M6 — 5 deduction paths untouched
**Rule:** Same as PR-B.10. hours+pkg, hours-service-only, fixed, legal_procedure+stage+pkg, legal_procedure stage-only.
**Evidence required:** Reading the code.

### M7 — Phase 3 writes preserved
**Rule:** After helper call, the following writes still execute:
- `transaction.update(taskRef, { actualMinutes, actualHours, lastActivity })` (if taskRef exists)
- `transaction.set(timesheetRef, entryData)` with `_processedByVersion: 'v2.0'` + `_idempotencyKey`
**Evidence required:** Reading the code.

### M8 — Two-phase commit envelope preserved
**Rule:** `createReservation` before transaction; `commitReservation(reservationId)` after success; `rollbackReservation` should fire on transaction failure (existing pattern). Unchanged.
**Evidence required:** Reading the code.

### M9 — Event sourcing preserved
**Rule:** `createTimeEvent({ eventType: 'TIME_ADDED', ... before: { version }, after: { version } })` post-transaction. Version values from `result.version`. Unchanged.
**Evidence required:** Reading the code.

### M10 — Idempotency preserved
**Rule:** `checkIdempotency`/`registerIdempotency` unchanged.
**Evidence required:** Reading the code.

### M11 — Tests cover migrated path
**Rule:** New test file `functions/tests/create-timesheet-entry-v2-canonical-helper.test.js`:
- Helper integration (with deduction): `_version`, `_lastModified`, `_modifiedBy`, `lastActivity`, services all in payload; canonical aggregates derived
- Helper integration (no deduction): payload has version + metadata, NO services field; helper uses current
- Internal-case path: `isInternal: true` → helper NOT called
- `_version` increment: nextVersion = currentVersion + 1; expectedVersion mismatch → aborted
- Phase ordering: helper precedes task update + timesheet set
**Evidence required:** New test file + Jest output.

### M12 — All other tests pass + lint zero
**Rule:** functions Jest + root Vitest green. `npm run lint` 0 errors.
**Evidence required:** Test runner output.

## SHOULD criteria

### S1 — Migration comment tagged PR-B.11 + pattern source PR-B.10
**Evidence required:** Inline comment.

### S2 — auditMeta carries `{ uid, username }`
**Evidence required:** Reading the code.

### S3 — PR description names PR-B.10 predecessor + 11/13 + equivalence + `_version` preservation
**Evidence required:** PR description.

### S4 — Comment notes `_version` pass-through (not in RESTRICTED_KEYS)
**Rule:** Inline comment explains why `_version` is OK to put in helper's `partialUpdate` — it's not a derived aggregate; helper passes through unchanged.
**Evidence required:** Comment block.

## Out of scope

- 2 remaining callsites (B.12 trigger, B.13 addHoursPackageToStage; plus B.14 closeCase special)
- Deduction logic refactor
- Optimistic-locking strategy changes
- 2-phase commit refactor
- Event sourcing changes
- Idempotency mechanism changes

## Rollback

`git revert <merge-commit>` → CI redeploys. Function reverts to prior manual aggregate writes. `_version`, idempotency, 2-phase commit, event sourcing all unchanged across revert. No data corruption.

## Notes for grader

- This is the **most-trafficked write CF in the system**. Every timesheet entry from any caller flows through here.
- The `_version` field is critical for optimistic-locking. It's a non-derived field. Helper's RESTRICTED_KEYS does NOT include it. Pass-through is the expected behavior. Test M2 verifies this explicitly.
- Internal-case path is a clean bypass: when `isInternal: true`, the function uses `internal_office` client for accounting but the actual client write is SKIPPED entirely. This must remain after migration.
- Phase 1 reads clientRef + taskRef. Helper reads clientRef internally (cached). Phase 3 client write (helper) is FIRST, then task, then timesheet — preserves Firestore "all reads before writes" within the implicit ordering.
