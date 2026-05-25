# Rubric — PR-DED-1

**Title:** fix(deduction): prefer fresh packages over depleted in getActivePackage
**Branch:** fix/deduction-active-package-selection
**Base:** main
**Scope:** Fix selection-priority bug in `getActivePackage` that caused depleted packages to be selected for deduction even when fresh packages were available, blocking customers from logging hours (CLIENT_OVERDRAFT_SOFT "פנה לגיא") despite paid-for fresh hours. Bug confirmed via client 2026065 (Miri Daniel) stage_a: pkg_initial (depleted, hoursRemaining=-7.6) was selected instead of pkg_additional (active, hoursRemaining=35.5). Fix introduces two-pass selection (fresh first, then depleted fallback) with FIFO tie-break by purchaseDate.

## MUST criteria (block on FAIL)

### M1 — Two-pass selection in canonical helper
**Rule:** `getActivePackage` in `functions/src/modules/deduction/deduction-logic.js` MUST return a package with `hoursRemaining > 0` whenever one exists in the eligible status set, before falling back to depleted/overdraft packages.
**Evidence required:** `functions/tests/get-active-package.test.js` — test "Bug repro: depleted initial + fresh additional → returns fresh additional" passes.

### M2 — FIFO tie-break by purchase date
**Rule:** When multiple fresh packages exist (`hoursRemaining > 0`), the OLDEST package by `purchaseDate` (or `createdAt` if missing) MUST be returned. Drains old additionals before new ones — matches per-package billing model.
**Evidence required:** test "two fresh packages → returns oldest by purchaseDate ASC" passes.

### M3 — Backward compatibility preserved (single depleted package)
**Rule:** When a stage/service has only depleted/overdraft packages and `allowOverdraft=true`, the function MUST return the eligible fallback package (within `-10h` floor or unrestricted if `overrideActive=true`).
**Evidence required:** tests "BC: single package, status=active, hoursRemaining=-5 → returns it" + "overrideActive=true + only depleted past -10h → returns depleted" pass.

### M4 — overrideActive preserves fresh-first priority
**Rule:** With `overrideActive=true`, fresh packages MUST still take priority over depleted. Override only bypasses the `-10h` floor in fallback pass.
**Evidence required:** test "overrideActive=true + depleted+fresh → returns FRESH (priority preserved)" passes.

### M5 — Trigger inline duplicates aligned
**Rule:** Both inline package-selection fallbacks in `functions/triggers/timesheet-trigger.js` (HOURS path + LEGAL_PROCEDURE path) MUST apply the same two-pass priority: fresh first, then depleted fallback.
**Evidence required:** grep diff for the two inline filter sites — both show fresh-first selection then fallback.

### M6 — No regressions in existing test suites
**Rule:** All existing tests in `functions/tests/` and `tests/unit/` MUST pass.
**Evidence required:** `jest` output `599+ passed, 0 failed` for `functions/tests/`; `vitest` passes for `tests/unit/deduction.test.ts`.

### M7 — G3 monitoring (PRODUCT-GRADE)
**Rule:** When fallback path is taken (depleted/overdraft selected because no fresh exists), the function MUST emit a structured `console.warn` with package id, status, hoursRemaining, overrideActive. Allows post-deploy detection of clients stuck on depleted.
**Evidence required:** test output shows the warn line during fallback tests.

## SHOULD criteria (warning on FAIL, doesn't block)

### S1 — README updated
**Rule:** `functions/src/modules/deduction/README.md` should reflect the new selection priority + the API signature with `allowOverdraft` and `overrideActive` parameters.
**Evidence required:** README contains "Selection priority" section + version-history entry for v3.1.0 (PR-DED-1).

### S2 — Stale comment refresh
**Rule:** The block comment header at `getActivePackage` should describe the new two-pass selection, not the legacy "first package" behavior.
**Evidence required:** diff shows updated docblock with "Two-pass selection" explanation.

### S3 — Integration test imports the real exported function
**Rule:** New test file should `require` the actual `getActivePackage` from `functions/src/modules/deduction/deduction-logic.js` (no inline mock).
**Evidence required:** `functions/tests/get-active-package.test.js` line 21 has `const { getActivePackage } = require('../src/modules/deduction/deduction-logic');`.

## Out of scope

This PR explicitly does NOT:

- Bring `apps/user-app/src/modules/deduction/deduction-logic.js` (drifted v1) to parity with `functions/`. Tommy decision: leave for separate work.
- Fix `overrideActive` propagation in legal_procedure deduction paths (feature gap since 2026-03-15; tracked as PR-DED-2). Grader confirmed via 3 sub-agents: NOT a regression, NEVER worked end-to-end. Out of PR-DED-1 scope.
- Backfill / migrate existing PROD clients stuck on depleted packages. Post-deploy data audit (Firestore query) is operational, not code change.
- Touch the `setServiceOverride` API at `clients/index.js:1208` (rejects non-HOURS — feature gap, PR-DED-2).
- Cleanup historical investigation scripts (`scripts/investigate-overdraft-2025306.js` etc.) that reference legacy contract.

## Rollback

Trivial code-only revert:

```bash
git revert <merge-commit-sha>
git push origin production-stable
```

No data migration. No schema change. New entries written between deploy and revert will be attributed to fresh packages instead of depleted — this is data-correct (the fix routes deduction to the right place), so revert preserves data integrity.

If selective rollback needed without reverting: hot-patch `getActivePackage` to call `.find()` on the eligible-status set without the two-pass filter (returns old behavior).

## PRODUCT-GRADE GATES status

- **G1** — customer-visible errors are professional → **PASS** (existing Hebrew CLIENT_OVERDRAFT_SOFT message preserved; fix REDUCES misfires)
- **G2** — rollback path documented → **PASS** (this section)
- **G3** — monitoring touched (data-mutating? selection logic is read-only mid-deduction) → **PASS** (`console.warn` on fallback selection)
- **G4** — test proves customer scenario → **PASS** (`functions/tests/get-active-package.test.js` "Bug repro" mirrors Miri 2026065 PROD data)
- **G5** — Hebrew customer-facing text → **N/A** (no UI strings changed; backend logic only)
- **G6** — no breaking change without migration plan → **PASS_WITH_NOTE** (behavioral change: new entries attribute to fresh package instead of depleted. NEW entries only. Existing entries unchanged. Per-package report breakdown will show different attribution after deploy — documented in PR body.)
- **G7** — security review if auth/PII/permissions touched → **N/A** (no auth/PII/permission changes; selection logic only. Verified by security sub-agent in investigation phase.)

## Notes for grader

- Bug found via PROD data investigation on client 2026065 (Miri Daniel). Console output verified: `pkg_initial=depleted, -7.6h; pkg_additional=active, 35.5h`. Fix routes deduction to additional → customer can resume work.
- Three sub-agents (backend, security, devils-advocate + completeness-checker, navigator, data-investigator) consulted during investigation phase. Findings:
  - Backend: confirmed safe; identified inline duplicates in trigger.
  - Security: PASS_WITH_WARNINGS — per-package floor evasion vector exists today via package stacking, not introduced by this PR.
  - Devils-advocate: SHIP with guard; per-package floor is intentional system-wide.
  - Completeness-checker: flagged stale README + comment + user-app drift; 3 included in PR (README/comment/missed-trigger-site), 1 deferred (user-app drift) per Tommy decision.
  - Navigator (post-deploy): confirmed 7 sites in 3 files broken for override+legal_procedure — feature gap, tracked separately as PR-DED-2.
  - Data-investigator: confirmed override for legal_procedure NEVER worked — gap since 8b5f922 (March 15, 2026). PR-DED-1 deliberately scoped to selection only.
- Tests verified: 18 new + 599 existing + 19 vitest = 636 total passed, 0 failed.
- This PR runs alongside PR-B.12's `log_only` soak mode (task #5 pending) — net safety: any invariant drift will be logged before becoming enforcement.
