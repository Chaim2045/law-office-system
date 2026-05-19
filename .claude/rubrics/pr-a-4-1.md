# Rubric — PR-A.4.1

**Title:** fix(admin-report): use canonical isFixedService in ClientReportModal service card
**Branch:** fix/client-report-modal-type-tag-pr-a-4-1
**Base:** main
**Scope:** Quick fix for a visible UI bug in the Client Report modal. Service cards rendered "שעות" (hourly) badge for plain `type: 'fixed'` services because the legacy check `pricingType === 'fixed'` only matched `legal_procedure + pricingType=fixed`. Switch to the canonical `isFixedService` check (already exposed via `window.ClientTypeDisplay`). Display only — no data path changes.

## MUST criteria (block on FAIL)

### M1 — Canonical isFixedService used in createServiceCard
**Rule:** `apps/admin-panel/js/ui/ClientReportModal.js:createServiceCard` computes `isFixedPrice` via `window.ClientTypeDisplay.isFixedService(serviceInfo)`. A fallback for the rare case the helper is not loaded must mirror its exact logic (`type === 'fixed' || (type === 'legal_procedure' && pricingType === 'fixed')`).
**Evidence required:** Grep for `isFixedService` in the file shows the new call site.

### M2 — Legacy `pricingType === 'fixed'` only on its own line removed
**Rule:** The previous single-line check `const isFixedPrice = serviceInfo.pricingType === 'fixed';` is gone from `createServiceCard`. Other callers of `pricingType === 'fixed'` are allowed elsewhere if they handle the legal_procedure subtype explicitly.
**Evidence required:** Diff of ClientReportModal.js shows the replacement.

### M3 — Cache-bust bumped
**Rule:** Both `apps/admin-panel/clients.html` and `apps/admin-panel/clients-fluent.html` reference `ClientReportModal.js?v=...` with a fresh version string (NOT the prior `20260507-stage-2`).
**Evidence required:** Grep on both HTML files.

### M4 — Lint zero errors
**Rule:** `npm run lint` returns 0 errors.
**Evidence required:** Lint output.

### M5 — All existing tests pass
**Rule:** Root `npm test` (Vitest) passes. `cd functions && npm test` (Jest) passes. No regression in count.
**Evidence required:** Test runner output.

## SHOULD criteria (warning on FAIL)

### S1 — No data-path changes
**Rule:** Edit confined to display/badge logic. No changes to `procedureType` / `type` / `pricingType` writes anywhere. No CF touched. No User App touched.
**Evidence required:** Diff scope inspection.

### S2 — Comment explains the bug
**Rule:** Inline comment near the fix references the cause (legacy check missed plain `type: 'fixed'`).
**Evidence required:** Diff shows comment.

### S3 — Other isFixedPrice consumers in the same function still work
**Rule:** `isFixedPrice` is reused at lines ~757 (`card.classList.add('fixed')`), ~838 (badge), ~869 (time tracker), ~897 (stats grid). Verify the new computation does not silently downgrade behavior for legal_procedure+fixed services.
**Evidence required:** Confirm the new `isFixedService` returns true for both `type === 'fixed'` AND `type === 'legal_procedure' && pricingType === 'fixed'`.

## Out of scope

- `ReportGenerator.js` legacy `client.type === 'hours' || ... || procedureType === 'legal_procedure'` chains — separate bug class, separate PR.
- Any change to the actual hours / fixed-price calculations.
- Migration of historical client documents (PR-D).
- Any new tests for the Report modal (existing tests cover client-type-display + aggregates; this fix uses the same canonical helper).

## Rollback

`git revert <merge-commit>` on main → CI redeploys. The badge reverts to the prior "שעות" misrender; no data effect.

## Notes for grader

This is a 1-function fix. Don't expect new unit tests — the canonical `isFixedService` helper is already covered (29 tests in `write-client-canonical-aggregates.test.js` and the 30 tests in `tests/unit/admin-panel/client-type-display.test.ts`). The fix is wiring an existing-and-tested helper into a UI consumer that was using stale logic.
