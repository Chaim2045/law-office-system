# Rubric — PR-E

**Title:** feat(types): discriminated union for services + ClientV2 (PR-E)
**Branch:** feat/typescript-service-union-pr-e
**Base:** main
**File:** new `types/services.ts` + re-export from `types/index.ts` + Vitest tests
**Scope:** TypeScript-only addition. Defines `Service` discriminated union (`HoursService` | `FixedService` | `LegalProcedureService`) with full nested types (`HoursPackage`, `Stage`, `WorkTracker`) plus type guards. Adds `ClientV2` interface that uses the union. **Zero runtime impact** — no JS source files modified, no existing tests modified, no `tsconfig.json` changes.

## Why now

- All 14 callsites migrated through canonical helper (PR-A + PR-B). Service shape is now stable per architecture.
- Existing `Client` interface in `types/index.ts` has legacy 2-value `type: 'hours' | 'stages'` — does not reflect actual `services[]` array.
- 9 Vitest tests currently use `any` for service shape. Future tests + future TS migrations need a typed source of truth.

## Risk profile

**Zero runtime risk.** TypeScript types are erased at compile time. JS sources unchanged.

## MUST criteria (block on FAIL)

### M1 — `types/services.ts` defines complete discriminated union
**Rule:** New file exports:
- `HoursPackage` interface — `{ id, type: 'initial' | 'additional', hours, hoursUsed, hoursRemaining, status: 'active' | 'pending' | 'overdraft' | 'depleted', purchaseDate?, createdAt?, createdBy?, description? }`
- `Stage` interface — `{ id, name, status: 'active' | 'completed' | 'pending', pricingType: 'hourly' | 'fixed', order, totalHours?, hoursUsed?, hoursRemaining?, packages?: HoursPackage[], totalHoursWorked? }`
- `WorkTracker` interface — `{ totalMinutesWorked, entriesCount }`
- `BaseService` interface — common fields (`id`, `name`, `status`, `createdAt?`)
- `HoursService extends BaseService` — `{ type: 'hours'; totalHours; hoursUsed; hoursRemaining; packages: HoursPackage[]; overrideActive?: boolean; overdraftResolved?: { isResolved: boolean; resolvedAt?: string; resolvedBy?: string } }`
- `FixedService extends BaseService` — `{ type: 'fixed'; work: WorkTracker; totalHours: 0 }`
- `LegalProcedureService extends BaseService` — `{ type: 'legal_procedure'; pricingType: 'hourly' | 'fixed'; stages: Stage[]; totalHours; hoursUsed; hoursRemaining; currentStage?: string }`
- `Service` union type
- Type guards: `isHoursService`, `isFixedService`, `isLegalProcedureService`

**Evidence required:** File exists; all exports listed.

### M2 — `ClientV2` interface uses `Service` union
**Rule:** Exported interface with:
- `id?`, `fullName`, `clientName?`, `fileNumber?`
- `services: Service[]`
- Canonical aggregate fields (`totalHours`, `hoursUsed`, `hoursRemaining`, `minutesUsed`, `minutesRemaining`, `isBlocked`, `isCritical`)
- Optional metadata (`isArchived?`, `isOnHold?`, `status`, `_version?`, `_lastModified?`, `_modifiedBy?`, `lastActivity?`, `lastModifiedAt?`, `lastModifiedBy?`)

**Evidence required:** Interface exists, fields covered.

### M3 — Re-export from `types/index.ts`
**Rule:** `types/index.ts` adds `export * from './services';` (or named re-exports) so existing imports of `'../../types'` get the new types automatically.

**Evidence required:** Diff confirms re-export.

### M4 — Existing `Client` interface NOT removed or modified
**Rule:** Legacy `Client` interface + `ClientType = 'hours' | 'stages'` stays untouched in `types/index.ts`. Migration is opt-in via `ClientV2`.

**Evidence required:** Reading the diff; lines 82-111 of `types/index.ts` unchanged.

### M5 — Type guards work at compile-time AND runtime
**Rule:** Each `isXxxService(s: Service): s is XxxService` checks `s.type === 'xxx'`. TypeScript narrows in conditional branches.

**Evidence required:** Reading the code; test exercises narrowing.

### M6 — Tests demonstrate union usage
**Rule:** New file `tests/unit/types/services.test.ts`:
- Type guards correctly identify each service type
- Narrowing works inside `if (isHoursService(s))` — can access `s.packages` without `any`
- Switch-statement exhaustiveness check (TS `never` exhaust pattern)
- Fixture-based test using real-shape sample data

**Evidence required:** Test file + Vitest output.

### M7 — Zero runtime change
**Rule:**
- No `.js` file modified (only `.ts` files added/touched)
- No package.json / tsconfig.json change
- No existing test modified

**Evidence required:** `git diff --stat` shows only `types/services.ts` + `types/index.ts` re-export line + new test file + `.claude/rubrics/pr-e.md`.

### M8 — All other tests pass + lint zero
**Rule:** functions Jest + root Vitest green. `npm run lint` 0 errors.

**Evidence required:** Test runner output.

## SHOULD criteria

### S1 — JSDoc / TSDoc on each interface
**Rule:** Hebrew + English short description per interface explaining purpose + invariants (e.g. "FixedService.totalHours is always 0 by canonical recompute rules").

**Evidence required:** Comments present.

### S2 — `Service` union exported AND a type-narrowing helper for use in switches
**Rule:** In addition to `isXxxService` predicates, export `assertNever(x: never): never` (or similar) for exhaustiveness checks. Standard TS pattern.

**Evidence required:** Reading the code.

### S3 — PR description names PR-A/B (architectural foundation) + migration path (PR-E.1 follow-up)
**Evidence required:** PR body.

### S4 — Comment on `ClientV2` notes legacy `Client` is kept for backward compat
**Evidence required:** Inline comment.

## Out of scope

- Migrating any of the 9 existing Vitest tests to typed Service (separate follow-up PR-E.1 — optional)
- Updating `types/index.ts` legacy `Client` interface
- Adding types for `BudgetTask`, `TimesheetEntry`, etc. (those have basic types already; this PR is focused on Service)
- Adding runtime validation (Zod schemas etc.)
- Changing tsconfig.json
- Migrating any JS source to TS

## Rollback

`git revert <merge-commit>`. The new `types/services.ts` file disappears. Re-export line in `types/index.ts` reverts. No runtime change. No data corruption.

## Notes for grader

- PR-E lays the type foundation. Future PRs can migrate tests + new code to use `Service` and `ClientV2`. Existing JS code is unaffected.
- Tests use Vitest (root project), not Jest. Root `vitest.config.ts` will discover the new test file automatically.
- The discriminated-union pattern catches an entire class of bugs (accessing `.stages` on an `HoursService` etc.) at compile time. The runtime equivalents are already protected by `calcClientAggregates` + `isFixedService` in `functions/shared/aggregates.js`.
