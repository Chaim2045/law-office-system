# Rubric — PR-DATE-2: Edit Existing Package Purchase Date

## Scope
Add `updatePackagePurchaseDate` callable (mirroring the existing validation pattern) + frontend packages breakdown table with edit icons in the Client Management Modal.

## MUST criteria

| # | Criterion | Evidence |
|---|-----------|----------|
| M1 | `updatePackagePurchaseDate` accepts `{ clientId, serviceId, packageId, purchaseDate }` with validation | diff shows validation block |
| M2 | Invalid/future purchaseDate throws `invalid-argument` with Hebrew message | test: "unparseable purchaseDate", "future purchaseDate" |
| M3 | Package not found throws `not-found` | test: "package not found" |
| M4 | Valid update stores new purchaseDate on the package | test: "valid update stores new purchaseDate" |
| M5 | Audit log records old + new purchaseDate | test: "audit log records the change" |
| M6 | Frontend shows packages breakdown with purchaseDate for each package | diff shows `_renderPackagesBreakdown` |
| M7 | Edit pencil icon opens ModalManager dialog with date picker | diff shows `_editPackagePurchaseDate` with `ModalManager.create` |
| M8 | Frontend calls `updatePackagePurchaseDate` callable on submit | diff shows `httpsCallable('updatePackagePurchaseDate')` |
| M9 | All existing tests pass (zero regressions) | vitest 865 + jest 1298 |

## SHOULD criteria

| # | Criterion |
|---|-----------|
| S1 | No new ESLint warnings introduced |
| S2 | Backend validation mirrors the existing `addPackageToService` pattern exactly |
| S3 | Transaction writes through `writeClientWithCanonicalAggregates` (SSOT invariant) |
