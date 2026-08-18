# Rubric — PR-DATE-1: Backend purchaseDate + Frontend Date Picker

## Scope
Add optional `purchaseDate` parameter to `addPackageToService` CF (mirroring the existing `addHoursPackageToStage` pattern) + replace `prompt()`/`confirm()` in `renewServiceHours` with a `ModalManager` dialog containing hours, description, and date picker fields.

## MUST criteria

| # | Criterion | Evidence |
|---|-----------|----------|
| M1 | `addPackageToService` accepts optional `data.purchaseDate` with validation (parseable, not future) | diff shows validation block |
| M2 | Omitting `purchaseDate` falls back to `now` (backward compatible) | test: "omitting purchaseDate defaults to now" |
| M3 | Invalid `purchaseDate` throws `invalid-argument` with Hebrew message | test: "unparseable purchaseDate" |
| M4 | Future `purchaseDate` throws `invalid-argument` with Hebrew message | test: "future purchaseDate" |
| M5 | Valid `purchaseDate` is stored on the new package as ISO string | test: "valid purchaseDate is stored" |
| M6 | `renewServiceHours` uses `ModalManager.create()` instead of `prompt()`/`confirm()` | diff shows ModalManager usage |
| M7 | Modal has 3 fields: hours (required), description (optional), date picker (optional) | diff shows form HTML |
| M8 | Frontend sends `purchaseDate` to the CF when user picks a date | diff shows payload construction |
| M9 | All existing tests pass (zero regressions) | vitest 865 + jest 1289 |

## SHOULD criteria

| # | Criterion |
|---|-----------|
| S1 | No new ESLint warnings introduced |
| S2 | Date picker label is "תאריך רכישה (אופציונלי)" matching the AddPackageToStage pattern |
| S3 | Backend validation mirrors `addHoursPackageToStage` exactly (same structure) |
