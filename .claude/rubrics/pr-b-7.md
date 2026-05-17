# Rubric — PR-B.7

**Title:** refactor(functions): migrate addPackageToService to canonical helper
**Branch:** feat/migrate-add-package-to-service-pr-b-7
**Base:** main
**Scope:** Migration 7 of 13. `addPackageToService` adds a new package to an existing hours-service's `packages[]` array, with orphan-entry backfill (entries created before this package existed get assigned the new packageId). Has a service-level **invariant guard** preventing drift between `service.totalHours` and `Σ(packages.hours)`. Replace the aggregate block with `writeClientWithCanonicalAggregates`. **Does NOT manage totalServices/activeServices** (count unchanged when adding a package to existing service).

## Risk profile

**Medium.** Non-trivial:
- Orphan backfill outside transaction (best-effort, eventual consistency)
- Service-level drift guard (must remain intact)
- Service-internal aggregate recomputation (totalHours, hoursUsed, hoursRemaining) — separate from client-level
- Supports both `clientId` and legacy `caseId` aliases

## MUST criteria (block on FAIL)

### M1 — addPackageToService uses writeClientWithCanonicalAggregates
**Rule:** Body calls `writeClientWithCanonicalAggregates(transaction, clientRef, { services }, { caller: 'addPackageToService', auditMeta: { uid, username } })`. Manual aggregate block removed. **Note:** `totalServices` / `activeServices` NOT passed (count unchanged).
**Evidence required:** Diff confirms swap. No `hoursUsed/hoursRemaining/minutesUsed/minutesRemaining/isBlocked/isCritical/totalHours/lastModifiedAt/lastModifiedBy` writes.

### M2 — Validations preserved (auth → clientId|caseId → serviceId → hours > 0)
**Rule:** All 4 checks preserved. The `data.clientId || data.caseId` alias still works.
**Evidence required:** Reading the new code.

### M3 — Orphan backfill preserved
**Rule:** Pre-transaction query of `timesheet_entries` where `clientId == X && serviceId == Y && !packageId`. Sum minutes. After transaction success, batch-update orphan entries with new `packageId` (chunks of 500). UNCHANGED by this migration.
**Evidence required:** Reading the code; orphan query + post-transaction batch loop preserved.

### M4 — Service-level invariant guard preserved
**Rule:** Inside transaction, after pushing new package + recomputing service totals, the guard `if (Math.abs(drift) > 0.05) throw failed-precondition` MUST run BEFORE the helper call. Drift = `service.totalHours - Σ(packages.hours)`.
**Evidence required:** Reading the code; guard runs and short-circuits before helper.

### M5 — Service-level recomputation preserved
**Rule:** `service.totalHours += data.hours`, then `service.hoursUsed = Σ(packages.hoursUsed)`, then `service.hoursRemaining = service.totalHours - service.hoursUsed`. The newly-added package may absorb orphan hours (`newHoursUsed = orphanHours`).
**Evidence required:** Reading the code.

### M6 — Service-type guard preserved
**Rule:** `service.type === ST.HOURS || service.serviceType === ST.HOURS` — only hours-services accept packages. Returns `invalid-argument` for fixed or legal_procedure.
**Evidence required:** Reading the code.

### M7 — Audit log preserved
**Rule:** `logAction('ADD_PACKAGE_TO_SERVICE', uid, username, { clientId, caseNumber, serviceId, packageId, hours, serviceName })` outside transaction.
**Evidence required:** Reading the code.

### M8 — Return value preserved
**Rule:** Return shape `{ success, packageId, package, service: { id, name, totalHours, hoursRemaining, packagesCount }, message }` unchanged.
**Evidence required:** Reading the code.

### M9 — Tests cover migrated path
**Rule:** New test file `functions/tests/add-package-to-service.test.js`:
- Auth + validation (4): auth-error, missing clientId, missing serviceId, hours ≤ 0
- Lookup (2): client / service not found
- Service-type guard (1): adding package to fixed service → invalid-argument
- Drift guard (1): construct services with intentional drift > 0.05 → failed-precondition + no write
- Helper integration (3):
  - Happy path: hours-service, no orphans → package appended, service.totalHours grows, client aggregates re-derived
  - Orphan absorption: orphan entries pre-package → newPackage.hoursUsed = orphanHours
  - Legacy `caseId` alias: works same as `clientId`
- Audit log (1)
- Return shape (1)
**Evidence required:** New test file + Jest output.

### M10 — All other tests pass + lint zero
**Rule:** functions Jest + root Vitest green. `npm run lint` 0 errors.
**Evidence required:** Test runner output.

## SHOULD criteria

### S1 — Migration comment tagged PR-B.7 + pattern source
**Evidence required:** Comment block.

### S2 — auditMeta carries `{ uid, username }`
**Evidence required:** Reading the code.

### S3 — PR description names PR-B.6 predecessor + 7/13
**Evidence required:** PR description.

### S4 — Comment explains why totalServices/activeServices NOT passed to helper
**Rule:** Brief comment that this CF adds a package (sub-document mutation), not a service — counts unchanged.
**Evidence required:** Reading the comment.

## Out of scope

- Other 6 callsites
- Changing orphan backfill semantics
- Changing drift guard threshold (0.05)
- Removing service-type guard
- Modifying renewServiceHours (separate sibling — unrelated)

## Rollback

`git revert <merge-commit>` → CI redeploys. Function reverts to prior block. The drift guard and orphan backfill remain intact across the revert. No data corruption.

## Notes for grader

- **The service-level drift guard is older than the canonical helper.** It existed to prevent a pre-2026-02-19 regression. KEEP IT. The helper guards CLIENT-level invariants; the drift guard guards SERVICE-level invariant. Different scopes, both needed.
- **Orphan backfill timing:** query before transaction (Firestore TX can't do collection queries). Batch update after transaction succeeds (best-effort). If transaction fails, orphans stay orphans — acceptable, addressed by retry of the CF.
- **Mutable `service.packages.push()`:** Yes, the code uses `.push()` not spread. This is internal to the in-memory copy within the transaction; not a Firestore mutation. Acceptable. (Compare to PR-B.6 which used spread on `services[]` — that was the top-level array; here we're inside a nested object.)
- **`clientId` / `caseId` alias:** Defensive against UI legacy. Both produce same `clientRef`. Both must work post-migration.
