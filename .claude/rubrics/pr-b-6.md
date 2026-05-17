# Rubric — PR-B.6

**Title:** refactor(functions): migrate addServiceToClient to canonical helper
**Branch:** feat/migrate-add-service-to-client-pr-b-6
**Base:** main
**Scope:** Migration 6 of 13. `addServiceToClient` is the first CF in PR-B series that ADDS a service (vs mutating one). Validates 3 service-type variants (`hours`, `legal_procedure`, `fixed`), builds the new service object (with packages/stages/work-tracker per type), appends to `services[]`, then writes the manual aggregate block. Replace the aggregate block with `writeClientWithCanonicalAggregates`.

## Risk profile

**Medium.** Three branches of service construction (hours/legal_procedure/fixed). Append-not-replace pattern. The helper handles aggregate computation regardless of which branch built the new service.

## MUST criteria (block on FAIL)

### M1 — addServiceToClient uses writeClientWithCanonicalAggregates
**Rule:** Body calls `writeClientWithCanonicalAggregates(transaction, clientRef, { services, totalServices, activeServices }, { caller: 'addServiceToClient', auditMeta: { uid, username } })`. Manual aggregate block removed.
**Evidence required:** Diff confirms swap. No `hoursUsed/hoursRemaining/minutesUsed/minutesRemaining/isBlocked/isCritical/totalHours/lastModifiedAt/lastModifiedBy` in this CF anymore.

### M2 — All pre-transaction validations preserved
**Rule:** auth → clientId → serviceType (via `isValidServiceType`) → serviceName (min 2 chars) → type-specific (hours requires `data.hours > 0`; legal_procedure requires `data.stages.length === 3` + valid pricingType; fixed requires `data.fixedPrice >= 0`).
**Evidence required:** Reading the new code; all checks in order.

### M3 — Service construction branches preserved
**Rule:** Each of 3 service types builds its expected shape:
- `hours`: with initial `packages[0]` (type='initial'), totalHours/hoursUsed/hoursRemaining
- `legal_procedure` (hourly): 3 stages with packages, currentStage = first stage id, totalHours summed across stages
- `legal_procedure` (fixed): 3 stages with `fixedPrice` + `paid:false`, totalPrice summed
- `fixed`: `fixedPrice`, `work: { totalMinutesWorked: 0, entriesCount: 0 }`, `completedAt: null`
**Evidence required:** Tests for each variant assert the constructed shape.

### M4 — Services array appended (not replaced)
**Rule:** `services = [...(clientData.services || []), newService]`. Prior services preserved. New service added at end.
**Evidence required:** Test with N existing services → length is N+1, prior IDs preserved.

### M5 — Audit log preserved
**Rule:** `logAction('ADD_SERVICE_TO_CLIENT', user.uid, user.username, { clientId, caseNumber, serviceId, serviceType, serviceName })` outside transaction.
**Evidence required:** Reading the code.

### M6 — Return value preserved
**Rule:** Return shape `{ success, serviceId, service, message }` unchanged. The `service` field is the full newly-constructed service object.
**Evidence required:** Reading the code.

### M7 — Tests cover migrated path
**Rule:** New test file `functions/tests/add-service-to-client.test.js`:
- Auth + validation (5): auth-error, missing clientId, invalid serviceType, short serviceName, type-specific validation (hours/legal_procedure/fixed each)
- Lookup (1): client not found
- Service construction (4): hours / legal_procedure hourly / legal_procedure fixed / fixed — each asserts the built shape
- Append (1): client with N prior services → length N+1 + prior IDs preserved
- Helper integration (2):
  - hours added to empty client → helper called, aggregates derived (totalHours=N, hoursRemaining=N)
  - fixed added to empty client → I1 → isBlocked=false derived
- Audit log (1): ADD_SERVICE_TO_CLIENT payload shape
- Return shape (1)
**Evidence required:** New test file + Jest output.

### M8 — All other tests pass + lint zero
**Rule:** functions Jest + root Vitest green. `npm run lint` 0 errors.
**Evidence required:** Test runner output.

## SHOULD criteria

### S1 — Migration comment tagged PR-B.6 + pattern source
**Evidence required:** Comment block.

### S2 — auditMeta carries `{ uid, username }`
**Evidence required:** Reading the code.

### S3 — PR description names PR-B.5 predecessor + 6/13
**Evidence required:** PR description.

## Out of scope

- Other 7 callsites
- Changing service-type construction logic
- Adding new service types
- Changing the `services[]` append-at-end ordering

## Rollback

`git revert <merge-commit>` → CI redeploys. Function reverts to prior block. No data corruption.

## Notes for grader

- This is the FIRST CF in PR-B that ADDS a service rather than mutating one. The helper handles append the same way as mutate — passed services[] is wholesale. Verify the new service is at the end of the array post-helper write.
- 3 service-type branches are non-trivial. Construction logic must remain intact — that's not the migration's job to refactor.
- The `serviceId = srv_${Date.now()}` outside the transaction is intentional (uniqueness). Don't move it inside.
