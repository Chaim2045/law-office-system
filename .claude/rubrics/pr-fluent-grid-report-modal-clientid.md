# Rubric — Fluent data grid "הפק דוח" passes client id (not object) to ClientReportModal

**Scope:** Pre-existing bug found during review of PR #408 (NOT caused by it). In the Fluent clients data grid (`clients-fluent.html`), clicking "הפק דוח" (generate report) silently failed to open the report modal. `FluentDataGrid.generateReport()` passed the raw client **object** (`client.raw`) to `ClientReportModal.open()`, which expects a **string** client id — it does `dataManager.getClientById(clientId)` → `clients.find(c => c.id === clientId)`. An object never `===` a string id → `getClientById` returns `undefined` → `open()` logs "❌ Client not found" and returns early. Net effect: the report button did nothing (no modal, no user-facing feedback).

**Branch:** `fix/fluent-grid-report-modal-clientid` · **App:** Admin Panel · **Env:** DEV · frontend-only.

**Files:** `apps/admin-panel/js/fluent/FluentDataGrid.js` (one call site, line 787).

## Root-cause evidence

- `ClientReportModal.open(clientId)` — `apps/admin-panel/js/ui/ClientReportModal.js:149-159`: `getClientById(clientId)`.
- `getClientById` — `apps/admin-panel/js/managers/ClientsDataManager.js:556-558`: `this.clients.find(c => c.id === clientId)` (strict `===`).
- Fluent row model — `apps/admin-panel/js/fluent/FluentDataGrid.js:219-233`: row built with `id: doc.id` and `raw: clientData` where `clientData = doc.data()`. **`doc.data()` does NOT include the doc id** → `client.raw.id` is unreliable; `client.id` (= `doc.id`) is the reliable key.
- Both `ClientsDataManager.clients` (`:237` `id: doc.id`) and the Fluent grid read the SAME `clients` collection's `doc.id` → the id-space matches. Passing `client.id` resolves correctly.
- Correct reference call site already in repo: `apps/admin-panel/js/ui/ClientsTable.js:666` passes the string `clientId`.

## MUST

- **M1 — The report modal opens from the Fluent grid.** `generateReport(id)` passes a STRING client id to `ClientReportModal.open()`, so `getClientById` resolves the client and the modal opens (no "❌ Client not found" early-return).
- **M2 — The id passed is the reliable key.** Uses `client.id` (= Firestore `doc.id`, the 7-digit caseNumber), NOT `client.raw` (the object) and NOT `client.raw.id` (which is absent from `doc.data()`). Mirrors the working `ClientsTable.js:666` pattern.
- **M3 — Surgical, single-line behavioral fix.** Only the one call site changes; the existing `this.data.find` guard is preserved; no other behavior in `FluentDataGrid.js` touched.
- **M4 — No regression to `ClientReportModal` or `ClientsTable`.** The modal's `open()` contract (string id) is unchanged; the other (working) caller is untouched.

## SHOULD

- **S1 — Comment explains the why** (object-vs-string contract; why `client.id` not `client.raw.id`; the mirror of `ClientsTable.js:666`) so a future reader doesn't "fix" it back.

## Out of scope (not touched)

- `FluentDataGrid.viewClient()` / `editClient()` — pre-existing `console.log` TODO stubs (lines 765, 773); not bugs introduced here, no behavior expected.
- `ClientReportModal.open()` itself — its string-id contract is correct and shared by the working `ClientsTable` caller; changing it would be the wrong fix.

## PRODUCT-GRADE GATES (expected)

- **G1** PASS — the fix REMOVES a silent dead-end (button did nothing). No `null`/`NaN`/`undefined`/stack-trace surfaced; `open()`'s own empty-id guard + "not found" path remain (English `console.error` is dev-only logging, not customer-facing UI). No new error strings introduced.
- **G2** PASS — `git revert <sha>` + redeploy (frontend-only, no data/schema/rules).
- **G3** N/A — read-only display action (opens a modal); no data mutation.
- **G4** PASS (manual smoke) — an automated integration test is impractical: `generateReport` is a method on a global object literal (not an ES module) that reads `this.data` + `window.ClientReportModal` + `window.firebaseDB` against live Firebase. Manual smoke plan in the PR body proves the customer scenario (grid → "הפק דוח" → modal opens for the right client).
- **G5** N/A — no customer-facing strings added/changed (only a code comment + the argument value).
- **G6** PASS — no breaking change; `open()`'s contract is unchanged. Behavioral change DECLARED: a previously-dead admin button now works (a fix, not a contract change).
- **G7** N/A — no auth/PII/permissions/rules touched; admin-gated display screen; the value passed is a case-number id already used throughout the admin panel.
