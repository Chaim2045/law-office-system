# PR Rubric — H.6.c-4: Enable Create Button + Completeness Fixes

## Scope

Enable the disabled "אשר וצור לקוח" button on `pending-clients.html` + fix two completeness findings from the c-3 investigation:
1. `lastModifiedBy` in the release CF now resolves admin display name (employee lookup → token name → UID fallback)
2. `pending_signature_intents` cleaned up inside the release transaction (permanent `sales_record_links` replaces it)

## MUST (all required for PASS)

- M1: The create button on `pending-clients.html` is enabled and functional (calls `createClientFromSalesRecord`)
- M2: A confirm dialog appears BEFORE the create call (with client name + amount)
- M3: All tofes data in the confirm dialog is escaped via `window.escapeHtml` (XSS prevention)
- M4: Loading state prevents double-clicks during the create call
- M5: Success/error/idempotent toasts in Hebrew with error-code-specific messages
- M6: `lastModifiedBy` in the release CF writes the resolved display name (employee `username` → `token.name` → UID fallback), NOT the raw UID
- M7: `pending_signature_intents/{salesRecordId}` is deleted inside the release transaction (cleanup after the permanent `sales_record_links` replaces it)
- M8: Tests cover the actor name resolution (3 fallback paths) and the intent cleanup (3 paths: released/failed-verdict/concurrent-release)
- M9: All existing tests still pass (40/40 release tests, 876 root vitest, 1339 functions)
- M10: ESLint 0 errors

## SHOULD (nice-to-have)

- S1: Cache-bust version bumped on `pending-clients.html`
- S2: The create button has a spinner during loading
