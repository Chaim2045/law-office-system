# Rubric — PR-B.9

**Title:** refactor(functions): migrate addTimeToTaskWithTransaction to canonical helper
**Branch:** feat/migrate-add-time-to-task-pr-b-9
**Base:** main
**Scope:** Migration 9 of 13. **Most heavily-used CF in PR-B series** — deducts hours from a client's service when a user logs time. Multi-phase transaction with FOUR writes (task, timesheet_entry, client, action_log). The client write is one of those four. Replace ONLY the client write with `writeClientWithCanonicalAggregates`; other writes stay intact.

## Risk profile

**HIGH.** This is the critical path for time tracking — every time entry hits it.

Key sensitivities:
- **Firestore "reads before writes" constraint** — helper does its own `transaction.get(clientRef)`. Must call helper BEFORE other writes in Phase 3, so the helper's get isn't after any writes.
- **Retry loop** (3 attempts on version conflict) — must remain intact.
- **Conditional client update** — only when `deductionResult` is non-null. Don't change.
- **Multi-write transaction** — task + timesheet_entry + client + action_log all atomic. Don't break atomicity.

## Pre-migration analysis

The current code does its own `calcClientAggregates(deductionResult.updatedServices, clientData.totalHours)` and writes `services + 6 aggregate fields + lastActivity`. The helper does the same `calcClientAggregates` internally. Verify equivalence:

**Source:**
```js
const agg = calcClientAggregates(deductionResult.updatedServices, clientData.totalHours);
// passes second arg = clientData.totalHours (untouched current value)
```

**Helper:**
```js
const totalHours = recomputeTotalHours(services); // recomputed from services
const aggregates = calcClientAggregates(services, totalHours);
```

→ **Slight difference.** Source uses `clientData.totalHours` (current persisted value) as `clientTotalHours` arg. Helper recomputes `totalHours` from services. After deduction, services[].totalHours fields haven't changed (deduction only affects hoursUsed/packages, not totalHours). So `recomputeTotalHours(services)` should equal the persisted `clientData.totalHours` IF the data is canonical (i.e., the persisted totalHours = sum of billable services' totalHours).

**Equivalence depends on data invariant:** stored `client.totalHours == Σ(billable services' totalHours)`. This invariant SHOULD hold post-canonical migrations, but historical data (the 23 victims) may have drift here.

**Conclusion:** Equivalence holds for canonical data. For drifted data, helper produces the *correct* canonical value. Migration is upgrade-safe.

## MUST criteria (block on FAIL)

### M1 — addTimeToTaskWithTransaction uses helper for client write
**Rule:** The client write (originally `transaction.update(clientRef, clientUpdate)` at line ~598) is replaced by `await writeClientWithCanonicalAggregates(transaction, clientRef, { services, lastActivity }, { caller: 'addTimeToTaskWithTransaction', auditMeta: { uid, username } })`.
**Evidence required:** Diff confirms swap. Manual `hoursUsed/hoursRemaining/minutesUsed/minutesRemaining/isBlocked/isCritical` fields no longer in the client write.

### M2 — Helper call placed BEFORE other Phase-3 writes
**Rule:** Helper call (which contains a `transaction.get`) happens BEFORE the task update / timesheet set / action_log set. Otherwise the get-after-write Firestore violation occurs.
**Evidence required:** Reading the new code; order is: helper call → task update → timesheet set → action_log set.

### M3 — Conditional behavior preserved
**Rule:** Helper is called ONLY when `clientUpdate && clientRef` (same condition as current code). If `deductionResult === null` (e.g., internal task, no service to deduct from), no client write happens — same as before.
**Evidence required:** Reading the code.

### M4 — Retry loop intact
**Rule:** The `for (let attempt = 1; attempt <= MAX_RETRIES; attempt++)` loop and version-conflict retry logic remain unchanged.
**Evidence required:** Reading the code.

### M5 — All other writes preserved
**Rule:** `task.update` (with `actualMinutes` increment + `timeEntries` arrayUnion), `timesheet_entry.set`, `action_logs.set` all preserved with original payloads.
**Evidence required:** Reading the code.

### M6 — Phase 1 client read preserved
**Rule:** The Phase 1 `transaction.get(clientRef)` read remains. Helper will read the same doc again (cached within transaction) — acceptable.
**Evidence required:** Reading the code.

### M7 — Deduction logic preserved
**Rule:** All 3 service-type branches (HOURS / LEGAL_PROCEDURE / FIXED) preserved. `applyHoursDelta` / `applyHoursDeltaServiceOnly` / `applyLegalProcedureDelta` / `applyLegalProcedureDeltaStageOnly` / `computeFixedDeduction` all called as before. The -10h overdraft floor guard preserved.
**Evidence required:** Reading the code.

### M8 — Validation gates preserved
**Rule:** Block check (service.hoursRemaining ≤ 0 && !overrideActive → fail), serviceId required gate, serviceId-exists-on-client gate — all preserved in current order.
**Evidence required:** Reading the code.

### M9 — Tests cover migrated path
**Rule:** New tests verify:
- Helper called when deductionResult is non-null
- Helper NOT called when deductionResult is null (internal task path)
- Helper called BEFORE task update (read-before-write ordering)
- Client doc receives canonical aggregates derived by helper
- Retry loop still functions (simulate version-conflict abort)
- The -10h overdraft floor still throws CLIENT_OVERDRAFT_SOFT
- All 3 service types (HOURS / LEGAL_PROCEDURE / FIXED) trigger correct deduction + helper call
**Evidence required:** Updated existing tests OR new test file with these cases.

### M10 — All other tests pass + lint zero
**Rule:** functions Jest + root Vitest green. `npm run lint` 0 errors.
**Evidence required:** Test runner output.

## SHOULD criteria

### S1 — Migration comment tagged PR-B.9 + risk acknowledgement
**Rule:** Inline comment tags PR-B.9, references pattern from PR-B.1-B.8, AND explicitly notes the helper-must-go-first ordering requirement.
**Evidence required:** Comment block.

### S2 — auditMeta carries `{ uid, username }`
**Evidence required:** Reading the code.

### S3 — PR description names PR-B.8 predecessor + 9/13 + risk profile + equivalence analysis
**Evidence required:** PR description.

### S4 — `lastActivity` field preserved
**Rule:** The current `lastActivity: serverTimestamp` write is preserved (pass through helper). Helper also adds `lastModifiedAt` + `lastModifiedBy` via auditMeta — additive, no conflict.
**Evidence required:** Reading the code + test asserts `lastActivity` in payload.

## Out of scope

- Other 4 callsites
- Changing deduction logic, retry logic, overdraft guard
- Modifying task / timesheet_entry / action_log payloads
- Changing the multi-phase transaction structure
- Adding a fallback for non-canonical client.totalHours (helper handles via recomputeTotalHours)

## Rollback

`git revert <merge-commit>` → CI redeploys. Function reverts to prior block. Helper remains. Critical path for time entry returns to pre-migration code. No data corruption possible.

## Notes for grader

- **This is the most-trafficked CF in the system.** Any regression here affects every time-entry write. Extra scrutiny.
- **Firestore transaction ordering** is the trickiest constraint here. Verify the helper call (which contains `transaction.get`) is positioned BEFORE any `transaction.update`/`transaction.set` in Phase 3.
- **Equivalence:** for canonical data, helper produces identical aggregates as the prior code. For drifted data (23 victims), helper produces the CORRECT canonical value. PR-D will reset drifted data separately.
- The existing tests in `functions/tests/` for addTimeToTask should continue to pass (their assertions are about deduction logic, not client write shape). Updates may be needed in any test that asserts the SHAPE of the `transaction.update(clientRef, ...)` payload — those should be revised to assert the helper invocation instead.
