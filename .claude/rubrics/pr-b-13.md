# Rubric — PR-B.13

**Title:** refactor(functions): migrate addHoursPackageToStage to canonical helper
**Branch:** feat/migrate-add-package-stage-pr-b-13
**Base:** main
**File:** `functions/services/index.js`
**Scope:** Migration 13 of 13 (penultimate; closeCase = B.14, special). Callable for purchasing an additional hours package onto an existing legal_procedure stage. Replace client write at lines 706-717 with `writeClientWithCanonicalAggregates`. Preserve nested stage/service aggregate recomputation (helper only touches client-level), audit log, monitoring on audit-failure.

## Risk profile

**Medium.** Single callable used by Admin Panel (lawyer triggers it from UI). Lower traffic than B.12 trigger. Nested updates to stage.packages → stage aggregates → service aggregates → client aggregates. Existing code does the stage+service rollup manually (not RESTRICTED — nested fields, helper doesn't touch). Helper replaces only the client-level aggregate write.

## Equivalence analysis — verified before migration

Identical to prior PR-B migrations:
- Source clientTotalHours (line 701-702): `services.reduce((sum, s) => sum + (s.totalHours || 0), 0)` — sums ALL services including FIXED.
- Helper `recomputeTotalHours`: excludes ST.FIXED + legal_procedure with pricingType=fixed.
- For drift-free clients (FIXED services with totalHours=0 — the canonical shape) the two yield identical results. Helper corrects drift on touch.
- `calcClientAggregates(services, totalHours)` identical inputs → identical outputs (aside from totalHours-from-DB vs totalHours-from-services).

## MUST criteria (block on FAIL)

### M1 — Client write replaced by helper
**Rule:** `transaction.update(clientRef, { services, totalHours, hoursUsed, hoursRemaining, minutesUsed, minutesRemaining, isBlocked, isCritical, lastModifiedAt, lastModifiedBy })` at line 706-717 replaced by:
```js
const helperResult = await writeClientWithCanonicalAggregates(
  transaction, clientRef,
  { services },
  { caller: 'addHoursPackageToStage', auditMeta: { uid: user.uid, username: user.username } }
);
```
Manual aggregate fields removed from caller payload. `lastModifiedAt`/`lastModifiedBy` provided via `auditMeta` (helper handles them).

**Evidence required:** Diff.

### M2 — Nested aggregate recomputation preserved
**Rule:** Stage-level aggregates (lines 673-680) and service-level aggregates (lines 688-695) still recomputed manually before helper call. RESTRICTED_KEYS applies only to top-level client fields — nested `stage.totalHours`, `service.totalHours` pass through inside `services[]`.

**Evidence required:** Reading the code; lines 673-695 unchanged.

### M3 — Helper return used for response payload
**Rule:** Function still returns `client.totalHours / hoursUsed / hoursRemaining` to the caller for UI display. After migration these values come from `helperResult.aggregates` (canonical) instead of locally-computed `agg`.

**Evidence required:** Reading the return statement; values match helper output.

### M4 — Audit log preserved
**Rule:** `logAction('ADD_PACKAGE_TO_STAGE', ...)` post-transaction, with `caseId/stageId/stageName/packageId/hours/reason/procedureName/stageStatusWasCompleted` — unchanged.

**Evidence required:** Reading the code.

### M5 — Monitoring on audit failure preserved
**Rule:** On `auditError`, write to `monitoring/audit_failures` with `count/lastFailure/lastError/lastFunction/lastCaseId` — unchanged.

**Evidence required:** Reading the code.

### M6 — All input validation preserved
**Rule:**
- Auth (`checkUserPermissions`)
- caseId required, string
- stageId in VALID_STAGE_IDS
- hours: positive number, ≤ 500
- reason: trimmed, 3-500 chars, sanitized
- purchaseDate: parseable, not future, warning if >1y old

**Evidence required:** Reading the code; none touched by migration.

### M7 — IDs generated outside transaction
**Rule:** `packageId` + `now` + `purchaseDate` (default) computed BEFORE `db.runTransaction` — preserves consistency across transaction retries.

**Evidence required:** Reading the code.

### M8 — Completed-stage warning preserved
**Rule:** `if (targetStage.status === 'completed') console.warn(...)` plus `stageWasCompleted` flag bubbled to audit log.

**Evidence required:** Reading the code.

### M9 — auditMeta carries `{ uid, username }`
**Rule:** Helper invocation passes `auditMeta: { uid: user.uid, username: user.username }`. Helper adds `lastModifiedAt: serverTimestamp()` + `lastModifiedBy: user.username` to final payload.

**Evidence required:** Reading the code.

### M10 — Tests cover migrated path
**Rule:** New test file `functions/tests/add-hours-package-to-stage-canonical-helper.test.js`:
- Helper invoked once with caller `addHoursPackageToStage` + `auditMeta`
- Payload contains `services` only (no manual aggregates)
- Helper called inside transaction (not before/after)
- Stage-level aggregates recomputed correctly (sum from packages)
- Service-level aggregates recomputed correctly (sum from stages)
- Returned client.totalHours/hoursUsed/hoursRemaining from helper result
- Validation failures (missing caseId, bad stageId, hours <1, hours >500) → helper NOT called

**Evidence required:** New test file + Jest output.

### M11 — All other tests pass + lint zero
**Rule:** functions Jest + root Vitest green. `npm run lint` 0 errors.
**Evidence required:** Test runner output.

## SHOULD criteria

### S1 — Migration comment tagged PR-B.13 + pattern source PR-B.12
**Evidence required:** Inline comment above helper call.

### S2 — Default mode (no per-call override)
**Rule:** Unlike PR-B.12 trigger soak, this callable uses helper's default mode (global config — `enforce`). Lower-traffic, user-initiated, idempotent in the failure-then-retry sense.
**Evidence required:** Helper invocation has no `mode` option.

### S3 — PR description names PR-B.12 predecessor + 13/13 (last regular) + equivalence + note on B.14 closeCase as final special-case PR
**Evidence required:** PR description.

### S4 — Final-batch reminder in PR body
**Rule:** PR description states "this is the last 'regular' migration in PR-B; PR-B.14 (closeCase) follows as a special case (different write semantics)".
**Evidence required:** PR description.

## Out of scope

- B.14 closeCase migration
- B.12.1 log_only override removal (separate cleanup PR after 24h soak)
- Nested aggregate recomputation refactor
- Audit log structure changes
- Monitoring schema changes

## Rollback

`git revert <merge-commit>` → CI redeploys. Function reverts to manual aggregate writes. Audit, monitoring, validation, IDs all unchanged. No data corruption.

## Notes for grader

- Callable used from Admin Panel "Add hours package to legal procedure stage" flow. Lower traffic than B.12 (UI-triggered, lawyer action).
- Three levels of aggregate rollup: package → stage → service → client. Helper handles ONLY client level. Stage + service level remain manual (nested fields are not RESTRICTED).
- `clientTotalHours` (line 701-702) in source code is no longer needed — helper recomputes from services. Local variable can be removed OR kept for the audit return (cleaner: use helper's return).
- After PR-B.13 merges, only PR-B.14 (closeCase) remains. closeCase is special: it does extra things beyond aggregate writes (status change, locking, archival), and deserves its own rubric.
