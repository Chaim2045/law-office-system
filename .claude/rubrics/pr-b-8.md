# Rubric — PR-B.8

**Title:** refactor(functions): migrate moveToNextStage to canonical helper
**Branch:** feat/migrate-move-to-next-stage-pr-b-8
**Base:** main
**Scope:** Migration 8 of 13. `moveToNextStage` transitions a `legal_procedure` service from its active stage to the next stage (marks current as `completed` + completedAt, next as `active` + startedAt), then writes the aggregate block. Also writes client-level `currentStage` + `currentStageName` metadata (NOT aggregate fields — pass through).

## Equivalence analysis — verified before migration

Source formula:
```js
const clientTotalHours = (updatedServices || [])
  .filter(svc => !isFixedService(svc))
  .reduce((sum, svc) => sum + (svc.totalHours || 0), 0);
```

Helper's `recomputeTotalHours`:
```js
function recomputeTotalHours(services) {
  return services.reduce((sum, svc) => {
    if (!svc) return sum;
    if (svc.type === ST.FIXED) return sum;
    if (svc.type === ST.LEGAL_PROCEDURE && svc.pricingType === PT.FIXED) return sum;
    return sum + (typeof svc.totalHours === 'number' ? svc.totalHours : 0);
  }, 0);
}
```

`isFixedService(svc)` returns `svc.type === ST.FIXED || (svc.type === ST.LEGAL_PROCEDURE && svc.pricingType === PT.FIXED)` — IDENTICAL filter logic. Both skip the same services. Both sum `totalHours`. Helper adds defensive null-guard + type-check; source uses `|| 0` fallback. **Equivalent for all valid services.**

→ No special migration logic needed.

## Risk profile

**Medium.** Stage transition is critical to legal_procedure UX. Validation chain has 6 checks. New: helper passes through `currentStage` / `currentStageName` (client-level metadata, not in RESTRICTED_KEYS).

## MUST criteria (block on FAIL)

### M1 — moveToNextStage uses writeClientWithCanonicalAggregates
**Rule:** Body calls `writeClientWithCanonicalAggregates(transaction, clientRef, { services: updatedServices, currentStage: nextStage.id, currentStageName: nextStage.name || nextStage.id }, { caller: 'moveToNextStage', auditMeta: { uid, username } })`. Manual aggregate block removed.
**Evidence required:** Diff confirms swap. No `hoursUsed/hoursRemaining/minutesUsed/minutesRemaining/isBlocked/isCritical/totalHours/lastModifiedAt/lastModifiedBy` in this CF anymore.

### M2 — All 6 validations preserved in order
**Rule:** auth → clientId → serviceId → client exists → service exists → service.type === LEGAL_PROCEDURE → service.stages valid (array + non-empty) → active stage exists → not-last-stage. All check at the right preconditions.
**Evidence required:** Reading the new code.

### M3 — Stage transition logic preserved
**Rule:** `updatedStages` map sets `idx === activeIndex → { ...stage, status: 'completed', completedAt: now }` and `idx === activeIndex + 1 → { ...stage, status: 'active', startedAt: now }`. Other stages unchanged. Immutable.
**Evidence required:** Reading the code + test asserts both transitions.

### M4 — currentStage + currentStageName pass through helper
**Rule:** Helper writes both `currentStage` and `currentStageName` to the client doc (NOT in RESTRICTED_KEYS — pass through). Values = next stage's id and name.
**Evidence required:** Test asserts both fields in helper write payload.

### M5 — Audit log preserved
**Rule:** `logAction('MOVE_TO_NEXT_STAGE', uid, username, { clientId, caseNumber, serviceId, fromStageId, fromStageName, toStageId, toStageName, serviceName })` outside transaction.
**Evidence required:** Reading the code.

### M6 — Return value preserved
**Rule:** Return shape `{ success, serviceId, fromStage: { id, name }, toStage: { id, name }, updatedStages, isLastStage, message }` unchanged. `isLastStage = (activeIndex + 1) === stages.length - 1`.
**Evidence required:** Reading the new code.

### M7 — Tests cover migrated path
**Rule:** New test file `functions/tests/move-to-next-stage.test.js`:
- Auth + validation (3): auth-error, missing clientId, missing serviceId
- Lookup (2): client / service not found
- Service-type guard (1): non-legal_procedure → invalid-argument
- Preconditions (3): no stages, no active stage, already at last stage
- Helper integration (4):
  - Active stage → completed; next stage → active (verifies BOTH transitions)
  - currentStage + currentStageName passed through
  - isLastStage flag correct (transitioning to LAST stage → true)
  - isLastStage flag false when more stages remain
- Audit log (1)
- Return shape (1)
**Evidence required:** New test file + Jest output.

### M8 — All other tests pass + lint zero
**Rule:** functions Jest + root Vitest green. `npm run lint` 0 errors.
**Evidence required:** Test runner output.

## SHOULD criteria

### S1 — Migration comment tagged PR-B.8
**Rule:** Inline comment references PR-B.8, pattern source PR-B.1-B.7, AND the equivalence-analysis result (isFixedService filter is canonical, same as helper).
**Evidence required:** Comment block.

### S2 — auditMeta carries `{ uid, username }`
**Evidence required:** Reading the code.

### S3 — PR description names PR-B.7 predecessor + 8/13 + equivalence verified upfront
**Evidence required:** PR description.

## Out of scope

- Other 5 callsites
- Changing stage transition logic (status/timestamps unchanged)
- Removing logAction
- Modifying legal_procedure stage definition (stages.length expected to be 3, but the CF works with any length ≥ 1 — that's existing behavior)
- Modifying isLastStage formula

## Rollback

`git revert <merge-commit>` → CI redeploys. Function reverts to prior block. Stage transition + audit log + return shape unchanged. Helper remains. No data corruption.

## Notes for grader

- The equivalence-analysis was conducted as a pre-migration prep step (no code, just verification). This rubric documents the result. Going forward, if helper's recomputeTotalHours formula changes, this migration's behavior changes accordingly — that's by design (canonical).
- `currentStage` / `currentStageName` are client-level metadata fields, NOT aggregates. They reflect the active stage of a SPECIFIC service (currently only one legal_procedure per client in practice). Multi-procedure clients would technically have ambiguity, but this CF was written assuming the simpler model. Out of scope to fix.
- The `transaction.update` block previously wrote `currentStage` + `currentStageName` directly. Helper must preserve these — they pass through (not in RESTRICTED_KEYS).
