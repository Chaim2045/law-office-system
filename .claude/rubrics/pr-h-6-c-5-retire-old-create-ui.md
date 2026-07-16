# PR Rubric — H.6.c-5: Retire Old Manual Client Creation UI

## Scope

Delete the two dead manual client-creation paths (`SimpleClientDialog.js` and `case-creation-dialog.js`) and redirect the FAB on `clients.html` to `pending-clients.html`. The new gated pending-signature flow (c-1 through c-4) replaces the old manual create.

## MUST (all required for PASS)

- M1: `SimpleClientDialog.js` is deleted (raw Firestore write bypass — security hazard)
- M2: `case-creation-dialog.js` is deleted (never loaded from any HTML page, dead code)
- M3: The FAB on `clients.html` navigates to `pending-clients.html` (not the old dialog)
- M4: No references to `CaseCreationSystem` or `caseCreationDialog` in the FAB
- M5: No HTML page loads the deleted files
- M6: Guard tests exist ensuring deleted files stay deleted and FAB redirects correctly
- M7: All existing admin-panel tests still pass (334+)
- M8: ESLint 0 errors

## SHOULD (nice-to-have)

- S1: FAB label on clients page updated to reflect new behavior ("לקוחות ממתינים")
- S2: FAB icon on clients page updated to match pending-clients semantics
