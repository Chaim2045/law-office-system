# Rubric — PR-B.12

**Title:** refactor(functions): migrate onTimesheetEntryChanged trigger to canonical helper
**Branch:** feat/migrate-timesheet-trigger-pr-b-12
**Base:** main
**File:** `functions/triggers/timesheet-trigger.js`
**Scope:** Migration 12 of 13. Fallback Firestore trigger that processes timesheet_entries writes when callable didn't (UPDATE, DELETE, CREATE-without-flag, service-transfer). Replace single client write at line ~450 with `writeClientWithCanonicalAggregates`. Preserve `lastActivity`, idempotency, task update, entry overage flags, "all reads before all writes" ordering.

## Risk profile

**HIGH (trigger fires on every timesheet_entries write).** Entry path for UPDATE/DELETE/transfer (no callable handles these). Also covers CREATE fallback when `deductedInTransaction !== true`. Idempotency via `processed_trigger_events`. 4 writes in single transaction: client / entry / task / idempotency. Trigger self-write guard (skip if only isOverage/overageMinutes changed).

**Soak strategy:** ship with hard-coded `mode: 'log_only'` for this call. Trigger fires on every entry change in prod — invariant assertion shouldn't block real user writes during initial rollout. After 24h soak with zero violations → follow-up PR removes the override (default global `enforce`).

## Equivalence analysis — verified before migration

Same as PR-B.9/B.10/B.11:
- Source: `calcClientAggregates(updatedServices, clientData.totalHours)` → uses DB totalHours (drift possible)
- Helper: recomputes totalHours from services (canonical)
- Identical for drift-free clients; corrects on touch

## MUST criteria (block on FAIL)

### M1 — Client write replaced by helper
**Rule:** `transaction.update(clientRef, { services, hoursUsed, hoursRemaining, minutesUsed, minutesRemaining, isBlocked, isCritical, lastActivity })` at line ~450 replaced by `writeClientWithCanonicalAggregates(transaction, clientRef, { services: updatedServices, lastActivity: serverTimestamp() }, { caller: 'onTimesheetEntryChanged', mode: 'log_only' })`. Manual aggregate fields removed.
**Evidence required:** Diff confirms swap.

### M2 — `mode: 'log_only'` override present
**Rule:** Helper invocation includes `mode: 'log_only'` for initial 24h soak. Inline comment explains soak rationale + follow-up cleanup.
**Evidence required:** Comment block + code.

### M3 — Phase 3 ordering preserved
**Rule:** Helper called BEFORE entry overage update, task update, and idempotency set. Helper internally reads then writes clientRef — must not race with subsequent writes in transaction.
**Evidence required:** Code order.

### M4 — Trigger self-write guard preserved
**Rule:** Lines ~199-209: skip when only `isOverage`/`overageMinutes` changed. Helper output still writes services + aggregates → must NOT re-trigger the trigger. Verify nothing in helper payload looks like a self-write.
**Evidence required:** Reading the code.

### M5 — All other guards preserved
**Rule:**
- `deductedInTransaction === true` skip on CREATE
- `taskId` + `deductedInTransaction !== true` warning log
- `clientId` required
- `serviceId` required
- Zero-delta skip (UPDATE non-transfer)
- Service-transfer two-legged operation
- Service-type dispatch (hours / legal_procedure / fixed)
- Missing-package / missing-stage fallbacks

**Evidence required:** Reading the code; none touched by migration.

### M6 — Idempotency preserved
**Rule:** `processed_trigger_events/{event.id}` read first, written last. Atomic with other writes inside same transaction. TTL unchanged (72h).
**Evidence required:** Reading the code.

### M7 — Entry overage write preserved
**Rule:** `transaction.update(entryRef, { isOverage, overageMinutes })` still runs for CREATE/UPDATE (not DELETE). Self-write guard catches the resulting trigger.
**Evidence required:** Reading the code.

### M8 — Task update preserved
**Rule:** `transaction.update(taskRef, taskUpdate)` runs when `taskId && taskDoc.exists`. Uses `buildTaskUpdate` (FieldValue.increment-based). Unchanged.
**Evidence required:** Reading the code.

### M9 — `applyServiceTransfer` untouched
**Rule:** Two-legged transfer logic, leg1/leg2 dispatch, abort-on-not-found semantics all preserved.
**Evidence required:** Reading the code.

### M10 — Existing trigger tests pass unchanged
**Rule:** `timesheet-trigger.test.js` (pure unit tests on `_test.applyServiceTransfer` etc) still green.
**Evidence required:** Jest output.

### M11 — New test file covers migrated path
**Rule:** New test file asserts:
- Helper invoked with `mode: 'log_only'`
- Caller label = `'onTimesheetEntryChanged'`
- `services` + `lastActivity` in payload (NO manual aggregate fields)
- Helper called BEFORE entry/task/idempotency writes
- CREATE with `deductedInTransaction: true` → helper NOT called
- Self-write (only isOverage/overageMinutes changed) → helper NOT called
- Missing clientId / serviceId → helper NOT called

**Evidence required:** New test file + Jest output.

### M12 — All other tests pass + lint zero
**Rule:** functions Jest + root Vitest green. `npm run lint` 0 errors.
**Evidence required:** Test runner output.

## SHOULD criteria

### S1 — Migration comment tagged PR-B.12 + soak strategy
**Evidence required:** Inline comment block above helper call.

### S2 — No auditMeta (trigger has no user context)
**Rule:** Trigger fires on system events — no human author. `auditMeta` omitted (helper handles absence). Document rationale in comment.
**Evidence required:** Comment block.

### S3 — PR description names predecessor PR-B.11 + 12/13 + soak plan + follow-up
**Evidence required:** PR body.

### S4 — Soak follow-up tracked
**Rule:** PR description names the planned follow-up PR-B.12.1 (remove `mode: 'log_only'`) and the trigger metric to monitor (`invariant_violation_log_only` Cloud Logging events on caller=onTimesheetEntryChanged).
**Evidence required:** PR body.

## Out of scope

- 1 remaining callsite (B.13 addHoursPackageToStage; B.14 closeCase special)
- Deduction-logic changes
- `applyServiceTransfer` refactor
- Idempotency mechanism changes
- Trigger self-write guard refactor
- Removing `mode: 'log_only'` override (deferred to PR-B.12.1 after 24h soak)

## Rollback

`git revert <merge-commit>` → CI redeploys. Trigger reverts to prior manual aggregate writes. Idempotency, self-write guard, service-transfer, task update — all unchanged across revert. No data corruption.

## Notes for grader

- Trigger fires on EVERY timesheet_entries write — both CREATE-fallback path (callable didn't handle) and ALL update/delete paths.
- Self-write guard relies on detecting that ONLY `isOverage`/`overageMinutes` changed. Helper writes additional fields (services + aggregates + lastActivity + lastModifiedAt if auditMeta), so the helper's update is NOT a self-write (correctly).
- `mode: 'log_only'` is the safety override for the soak window. Any assertion violation will be logged to `clientInvariantViolations` + Cloud Logging without aborting the write. Production data flow continues.
- The follow-up PR-B.12.1 removing the override should happen only after 24h of zero `invariant_violation_log_only` events on this caller.
