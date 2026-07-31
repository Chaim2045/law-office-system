# Rubric — PR-GOLDENS-aggregation-deduction: characterization tests for the src/modules/aggregation deduction primitives

**Scope:** Fourth **timesheet-adjacent** package of the financial-correctness goldens track (budget-tasks #500/#501/#502; timesheet/helpers.js #503; getTimesheetEntries #504; updateTimesheetEntry #505). Pins the FOUR pure deduction primitives in `functions/src/modules/aggregation/index.js` — `applyHoursDelta` (:151), `applyLegalProcedureDelta` (:217), `applyHoursDeltaServiceOnly` (:321), `applyLegalProcedureDeltaStageOnly` (:362). These are the **SSOT deduction math** every timesheet CREATE path funnels through by service type (`timesheet/index.js` :340-406 / :921-984 / :1457-1500) — the exact place the historical hours-drift / double-count money bugs live. **Test-only, additive — ZERO production-code change** (one new file: `functions/tests/aggregation-deduction-deltas.test.js`, 18 tests + this rubric).

**Characterization discipline:** pins CURRENT behavior AS-IS (quirks included). Verified green (18/18) + cross-checked against source (`src/modules/aggregation/index.js:151-408`, read in full before writing).

## MUST
- **M1 — pins CURRENT behavior + green.** Assertions match the source:
  - `applyHoursDelta` (:151): package `hoursUsed += Δ` / `hoursRemaining = hours − used`; status `active→depleted` at ≤0 and `depleted→active` restore; `isOverage`/`overageMinutes` when the package goes negative; service-level `hoursUsed = Σpackages`, `hoursRemaining = totalHours − Σ`, `isBlocked` (with `overrideActive`/`overdraftResolved` suppression), `isCritical` in (0,5]; `null` when service OR package not found.
  - `applyHoursDeltaServiceOnly` (:321): direct service-level increment; isBlocked/isCritical/isOverage; `null` on miss.
  - `applyLegalProcedureDelta` (:217): the **FIXED-pricing stage** branch (`totalHoursWorked += Δ`, NO deduction, NO overage) + `svcHoursRemaining = null` when `svc.pricingType === PT.FIXED`; the no-`packageId` hourly passthrough (stage unchanged, still `targetFound`); package overage; `null` on service/stage miss.
  - `applyLegalProcedureDeltaStageOnly` (:362): direct stage-level increment; overage; fixed-svc `null` remaining; `null` on miss.
  **18/18 pass** (legacy-js jest, sibling `node_modules` via `modulePaths`; CI runs the real thing).
- **M2 — no production-code change.** Adds ONLY the one `.test.js` + this rubric. `functions/src/modules/aggregation/index.js` is byte-unchanged.
- **M3 — NON-overlap with existing coverage.** `tests/pr-stage-own-guard.test.js` already owns `applyLegalProcedureDelta`'s **HOURLY-stage orphan-preservation** (its Tests 6/7/8, via `recomputeStageHoursUsedPreservingOrphan`). This suite deliberately pins the OTHER branches — the FIXED-stage path, the sibling functions with zero prior direct tests, the overage/status/block flags, and the null-on-not-found contract — so there is no double-coverage.
- **M4 — the money-critical quirks are pinned** (with comments): `overrideActive` suppresses `isBlocked` while `isOverage` still fires; the no-`packageId` hourly stage resolves (not null) but is unchanged; fixed stages track `totalHoursWorked` and never overage; a fixed service reports `hoursRemaining: null` (never a negative number).
- **M5 — real functions, no logic mock.** The module is `require`d directly and the exported pure functions are called with plain fixtures (as `pr-stage-own-guard.test.js` does) — no SDK/harness mock, because these functions touch no SDK. `test/setup.js` untouched.

## PRODUCT-GRADE GATES
- **G1 (errors):** N/A — test-only, no customer path.
- **G2 (rollback):** `git revert <sha>` / delete the one file. Trivial.
- **G3 (monitoring):** N/A — pure functions, no write path.
- **G4 (test proves scenario):** PASS — exercises the REAL exported deduction primitives end-to-end (deduct → recompute → flags → return), the actual math the CREATE paths run in production.
- **G5 (Hebrew UI):** N/A — no customer-facing strings.
- **G6 (breaking change):** N/A — additive test file.
- **G7 (security):** N/A — no auth/PII/permissions surface (arithmetic on a services array).

## Anti-premature-closure
- **devils-advocate declared-skip (justified):** test-only, additive, zero production-code change → not a §3.8.4 trigger. A mis-captured assertion self-fails against current code; run green (18/18) + grader source-verify are the gates.
- **Coverage-sweep alignment:** this closes the "fixed / legal_procedure+fixed deduction, currently HOURS-only" gap the timesheet goldens named — at the SSOT primitive level (higher-value + simpler than three CREATE-CF transaction harnesses). **NEXT:** with the deduction math + the timesheet read/update/helpers pinned, the remaining CREATE-CF surface (idempotency + canonical-helper) is already covered by `quicklog-*`/`timesheet-entry-v2-*`/`create-*-canonical-helper` suites → **the timesheet-goldens track can CLOSE; return to the MVP sequence (H.8 AI chat).**
