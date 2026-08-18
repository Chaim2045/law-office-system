# Rubric — PR-U6: cut the "הפק דוח" table button over to the unified client card

**Track:** Admin modal-unification (`docs/PLAN-ADMIN-MODAL-UNIFICATION-2026-07.md`, PR-U6 — the entry-point cutover; U7 delete-last follows). Small frontend change (one handler + test), no schema/rules/refactor>100 → grader-gated; devils-advocate NOT mandatory (§3.8.4), but the behavioral change is declared.
**Scope:** frontend-only. `ClientsTable.handleReportClick` repointed from `ClientReportModal.open(clientId)` → `ClientManagementModal.open(client, dataManager, {initialTab:'report'})` (the unified card on its U4 report tab). `clients.html` `?v=` bump. NEW `clientstable-report-cutover.test.ts`. Nothing else.
**Type:** behavioral change (the live "הפק דוח" flow now opens the unified card, not the standalone report modal) — NOT a data/contract/route change; the report itself is bit-identical (U4's report tab = same formData + ReportGenerator engine).

## MUST (all required for PASS)

- **M1 — the cutover.** `ClientsTable.handleReportClick(clientId)` resolves the client via `this.dataManager.getClientById(clientId)` and calls `window.ClientManagementModal.open(client, this.dataManager, { initialTab: 'report' })` — the client OBJECT (not the id string), the dataManager, and the report-tab opt. It no longer calls `ClientReportModal.open`.
- **M2 — professional error paths (G1).** Missing client → Hebrew `notify.error` + early return (no crash, no modal). Missing `ClientManagementModal` global → Hebrew `notify.error`, no throw. No `undefined`/stack traces surfaced.
- **M3 — scope discipline (frozen-Fluent respected).** ONLY the LIVE main table (`ClientsTable`, on `clients.html`) is cut over. `FluentDataGrid` / `clients-fluent.html` — the FROZEN orphan page that does NOT load the unified-modal stack — is NOT touched. The residual `ClientReportModal` dependency on the Fluent page is DECLARED as a U7 (delete-last) prerequisite: ClientReportModal must not be byte-deleted until the Fluent report path is resolved (wire the unified stack there, or the cleanup track retires the page).
- **M4 — G4 test proves the customer scenario.** A test drives the LIVE `handleReportClick` through: (a) the happy path → `ClientManagementModal.open` called once with `(client, dm, {initialTab:'report'})`; (b) the cutover regression guard → `ClientReportModal.open` NOT called; (c) missing client → Hebrew error, no open; (d) missing modal → Hebrew error, no throw; (e) a static guard → `ClientsTable.js` no longer CONTAINS `ClientReportModal.open`.
- **M5 — gates.** Full admin-panel vitest suite green; ESLint 0 errors (pre-existing warnings on the file's console.log diagnostics are acceptable — 0-errors is the bar); `node --check` clean; `?v=` bumped on `ClientsTable.js` in `clients.html`.

## SHOULD

- **S1** — the report FUNCTIONALITY is unchanged: U4's report tab emits bit-identical formData and runs the same `ReportGenerator` engine; U6 only moves the container/flow into the one client card. No re-implementation of report logic.
- **S2** — the new handler mirrors the existing management-open pattern (`ClientsTable.js:657-664`) + the client-resolve idiom (`:691`) for a consistent, low-surprise diff.

## PRODUCT-GRADE GATES (expected)

- **G1** PASS — Hebrew, professional error paths ("הלקוח לא נמצא" / "מערכת ניהול הלקוח לא נטענה"); no undefined/NaN/stack traces.
- **G2** PASS — Rollback = `git revert` (frontend-only; the old `ClientReportModal.open` path returns; ClientReportModal still exists).
- **G3** N/A — entry-point repoint; no `transaction.set`/`update`/`.delete()`; the report-generation callables (ReportGenerator/ReportPreview) unchanged.
- **G4** PASS — live `handleReportClick` integration test (above), the customer scenario + regression guard.
- **G5** PASS — all customer-facing text Hebrew.
- **G6** PASS-with-declaration — BEHAVIORAL: the "הפק דוח" button now opens the unified card (report tab) instead of the standalone report modal; declared in the PR body. NO data/contract/route/count-key change; the report output is bit-identical (U4). No migration needed.
- **G7** N/A — no auth/PII/permissions; display/flow only.
