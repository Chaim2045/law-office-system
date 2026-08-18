# Rubric — PR-REPORT-5: Security Hardening

## Scope
Three security fixes in ReportGenerator.js: CSV header injection (CSV1), popup-blocker guard (POP1), PII in console logs (PII1).

## MUST criteria

| # | Criterion | Evidence |
|---|-----------|----------|
| M1 | `generateExcel` CSV header uses `window.CsvSafe.cell()` for `client.fullName` and `client.caseNumber` | diff shows CsvSafe wrapping |
| M2 | `generateHTML` guards `window.open()` return against null with Hebrew error message | diff shows null check + notify |
| M3 | `console.log` at line 29 no longer dumps full `formData` | diff shows redaction |
| M4 | `console.log` in `fetchReportData` no longer dumps `client.name` or full `reportData` | diff shows redaction |
| M5 | `console.warn` in renderServiceInfo no longer interpolates `formData.service` | diff shows redaction |
| M6 | All existing tests pass (zero regressions) | vitest output 323/323 |

## SHOULD criteria

| # | Criterion |
|---|-----------|
| S1 | No new ESLint warnings introduced |
| S2 | Popup-blocker guard mirrors the existing pattern from `generateEmployeeHTML` |
