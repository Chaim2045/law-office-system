# Rubric — PR-SEC-XSS-REPORTGEN

**Title:** Escape user-controllable fields in the client activity report (stored-XSS fix)
**Branch:** security/pr-report-generator-xss-escape
**Base:** main
**Scope:** Output-encode every user-controllable string interpolated into the CLIENT activity report HTML (rendered via `document.write` in `generateHTML`) inside `apps/admin-panel/js/managers/ReportGenerator.js`, using the file's existing `escapeHtml` helper — bringing the client path to parity with the already-hardened employee-report path. Adds a vitest unit suite proving the escaping. Frontend-only, additive, no behavior change for benign data.

**Reachability:** the H.6 cutover CF `createClientFromSalesRecord` stores `sale.clientName` RAW into the world-readable `clients.fullName`; a client name containing markup executes when a partner generates that client's report.

## MUST criteria (block on FAIL)

### M1 — both named fullName sinks escaped
**Rule:** `client.fullName` is wrapped in `this.escapeHtml(...)` at the `<title>` (line ~226) and the info-value `<span>` (line ~482).
**Evidence required:** ReportGenerator.js:226, :482.

### M2 — all other user-controllable HTML sinks in the client path escaped
**Rule:** every remaining raw user-controllable interpolation reaching the client-report `document.write` is escaped: caseNumber (~486), formData.service section title (~502), emp.employeeName (~527), service.service (~576), entry.action/description (~832), getEmployeeName (~833), packages serviceName (~1165), pkgDescription (~1194).
**Evidence required:** the 8 file:line sites above, each via `this.escapeHtml(...)`.

### M3 — uses the existing helper, no new surface
**Rule:** escaping uses the in-file `this.escapeHtml` (line ~1666). No new escaper, no new dependency, no new collection/rule/claim.
**Evidence required:** diff shows only `escapeHtml(...)` wrapping; no new function/import.

### M4 — CSV/Excel context left untouched
**Rule:** the CSV/Excel sinks (generateExcel ~911/926/934/941, generateEmployeeCSV) are NOT HTML-escaped (different context; CSV-injection is a separate tracked item).
**Evidence required:** diff does not touch those lines.

### M5 — test proves the customer scenario
**Rule:** a vitest suite renders a report whose fullName/caseNumber/service/employee/description carry an `onerror` payload and asserts the raw live tag NEVER appears, only the escaped form; existing ReportGenerator tests still pass.
**Evidence required:** `tests/unit/admin-panel/report-generator-escaping.test.ts` green; `report-generator-service-hours.test.ts` still green.

### M6 — no new lint errors / no benign-data behavior change
**Rule:** no new ESLint errors on touched lines; numeric/date/constant interpolations untouched so benign reports render identically.
**Evidence required:** `eslint` on the two files = 0 errors on changed lines; diff limited to wrapping calls.

## SHOULD criteria (warning on FAIL)

### S1 — multi-sink regression signal
**Rule:** the test asserts an escaped-occurrence count (>= 8 in buildHTMLContent) so a regression on a single sink is caught.
**Evidence required:** test assertion.

### S2 — no "undefined" leak
**Rule:** `escapeHtml(null/undefined)` returns `''` (G1 alignment — no "undefined" rendered).
**Evidence required:** test assertion.

## Out of scope

- `WhatsAppMessageDialog.js:72` `userName` → innerHTML XSS (same class, different sink — tracked separately).
- CSV formula-injection in `generateExcel` / `generateEmployeeCSV` (csvEscape doubles quotes only — tracked separately).
- Consolidating the ~9 duplicate `escapeHtml` copies into a shared util (tracked separately).
- Re-sanitizing the 3 intake routes — the correct fix is output-encoding at the sink (existing stored data is only protected by it; intake sanitization would corrupt the billing-verified `fullName` join key).

## Rollback

`git revert <commit>` + redeploy (code-only, frontend; Netlify auto-redeploys from main). No data migration, no schema change.

## Notes for grader

- security-access-expert verdict: **GO-WITH-CHANGES → comprehensive (10 sinks)**. `escapeHtml` (& < > " ') is sufficient for the only two contexts used — element text content and the `<title>` element (RCDATA). All attribute-context interpolations (`class="${...}"`, logo `src`/`onerror`) are controlled constants — no breakout.
- Security gate relevant: `clients.fullName` is world-readable and written raw by the H.6 CF — escape-at-the-sink is the correct and complete fix.
- The H.6.a rubric (`pr-h-6-a-create-client-from-sales-record.md` M6 delta #2) names this as the tracked sink-escaping follow-up but cited only 226/482; the real sink set is 10 (this PR).
