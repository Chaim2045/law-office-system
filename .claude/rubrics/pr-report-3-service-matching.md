# Rubric — PR-REPORT-3: Service Matching SSOT

## Scope
Route remaining raw `.find()` through `findServiceByFormData` SSOT + fix cross-service bleed (`includes()` removal) + add `.trim()` to `collectReportData`.

## MUST criteria

| # | Criterion | Evidence |
|---|-----------|----------|
| M1 | `findServiceByFormData` no longer has `sDisplayName.includes(target)` fallback | grep diff for removed line |
| M2 | `renderServiceInfo` dateService lookup uses `findServiceByFormData` | diff shows replacement |
| M3 | `collectReportData` matchService applies `.trim()` on string comparisons | diff shows `.trim()` added |
| M4 | Cross-service bleed test: "ייעוץ" matches exact, not substring of "ייעוץ מס" | test output |
| M5 | Whitespace trim test: trailing space in stored name matches trimmed formData | test output |
| M6 | All existing tests pass (zero regressions) | vitest output 316/316 |

## SHOULD criteria

| # | Criterion |
|---|-----------|
| S1 | No new ESLint warnings introduced |
| S2 | Diff is minimal — no unrelated changes |
