# Rubric — PR-REPORT-4: Timezone / Date Boundary Fix

## Scope
Fix `new Date("YYYY-MM-DD")` creating UTC midnight (instead of local midnight) at 4 sites in ReportGenerator.js. Entries logged late in the day were silently excluded from reports.

## MUST criteria

| # | Criterion | Evidence |
|---|-----------|----------|
| M1 | `_parseLocalDate` helper exists and creates LOCAL midnight / end-of-day | diff shows helper with `new Date(y, m-1, d, ...)` |
| M2 | `collectReportData` (line 70-71) uses `_parseLocalDate` instead of `new Date()` | diff shows replacement |
| M3 | `renderServiceInfo` matchType=none path uses `_parseLocalDate` | diff shows replacement |
| M4 | `renderPackagesBreakdown` date parsing uses `_parseLocalDate` | diff shows replacement |
| M5 | Test: end-of-day includes an entry at 23:30 on the same day | test output |
| M6 | Test: end-of-day excludes an entry at 00:30 on the next day | test output |
| M7 | All existing tests pass (zero regressions) | vitest output 323/323 |

## SHOULD criteria

| # | Criterion |
|---|-----------|
| S1 | No new ESLint warnings introduced |
| S2 | Diff is minimal — no unrelated changes |
| S3 | Regression test proves the old `new Date("YYYY-MM-DD")` behavior would fail |
