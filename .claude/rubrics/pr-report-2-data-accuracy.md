# Rubric: PR-REPORT-2 — Data Accuracy Fixes

## Scope
Frontend-only fixes in `apps/admin-panel/js/managers/ReportGenerator.js` addressing 5 data accuracy bugs found by a Fable 5 deep audit. All fixes are display-logic corrections — no backend, no Firestore rules, no auth changes.

## MUST criteria

### M1 — `||` → `??` nullish coalescing (A1/A2/A4)
`resolveServiceHours` stage branch and service branch: `totalHours`, `hoursUsed`, `hours`, `hoursRemaining` fallback chains use `??` (not `||`). `renderPackagesTable` summary reduces and per-row renders use `??`. A service with `totalHours: 0` must be preserved as 0, not replaced by a fallback.

### M2 — `entry.minutes` string coercion fix (E2)
A `_mins(entry)` helper coerces `entry.minutes` to `Number` at all ~7 call sites. `"60"` as input produces `60` (number), never `"060"` (string concatenation).

### M3 — `renderServiceInfo` matchType=none date filtering (F1)
When `matchType === 'none'`, `renderServiceInfo` filters entries by `formData.startDate`/`formData.endDate` — not all-time. Consistent with `renderFinalSummary`.

### M4 — `filterPackagesByDateRange` active package bypass (A5)
Active packages (remaining hours > 0) always appear regardless of purchase date filter. Uses `??` (not `||`) in the active check.

### M5 — `formatDate` Invalid Date guard (G1-INV)
`formatDate` returns `'-'` for non-parseable inputs (`'-'`, `undefined`, `null`, empty string, garbage). Never shows "Invalid Date" to a customer (G1 gate).

### M6 — Tests cover all 5 fixes
New tests in `report-generator-service-hours.test.ts`:
- Zero-value preservation (A1/A2): `totalHours: 0` preserved
- `_mins` coercion (E2): string→number, 0 for null/undefined
- `formatDate` guard (G1-INV): dash for invalid, valid for real date

### M7 — No regression
All existing admin-panel tests pass (311+). ESLint 0 errors. No new warnings introduced.

## SHOULD criteria

### S1 — Minimal diff
Changes are surgical — only the lines identified in the audit. No opportunistic refactoring.

### S2 — H.3 profitability untouched
Zero changes to `profitability.html`, `profitability-format.js`, `functions/src-ts/profitability/`, or `client_profitability` rules.
