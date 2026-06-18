# Rubric — PR-CLIENTSTABLE-CSV-INJECTION

**Title:** Neutralize CSV / Formula Injection in the ClientsTable Excel export (OWASP) — route through the shared `CsvSafe` SSOT encoder
**Base:** main (includes #384 CsvSafe + #385 ReportGenerator routing)
**App:** Admin Panel · **Env:** DEV · **Frontend-only, additive, admin-critical**

**Scope:** Route every value cell of `ClientsTable.exportToExcel()` (`apps/admin-panel/js/ui/ClientsTable.js` ~line 738) through `window.CsvSafe.cell` — the shared SSOT encoder `apps/admin-panel/js/core/csv-safe.js` (introduced by #384, wired live by #385) — plus a fail-secure `ensureCsvSafe()` guard. Add a vitest integration suite. **NOT a new inline neutralizer.**

**Reachability (LIVE — security-access-expert lens):** ClientsTable is the live admin clients-list grid; `exportToExcel` is reachable via the "ייצוא ל-Excel" button. Before this fix the cell-build wrapped each value in `"..."` with **NO quote-doubling AND NO formula guard** — the WORST of the admin-panel CSV sinks. A live `client.fullName` / `caseNumber` / `assignedTo` containing `= + - @` (or `"`) → live formula execution / broken CSV when the admin opens the download. Severity **HIGH / LIVE** (unlike #384 SMS, which was orphaned).

**Out of scope:** the HTML-escaping in the same file (`escapeHtml`, the `titleAttr` and `getTypeBadge` `data-tooltip-html` inline escapes) — that is the separate escapeHtml-dedup track. The sibling LIVE `DataManager.exportToCsv` CSV sink — separate chip.

## MUST (block on FAIL)
- **M1** — every cell routes through `window.CsvSafe.cell`: `rows.map(row => row.map(cell => \`"${window.CsvSafe.cell(cell)}"\`)...)`. No inline neutralizer/regex added. Hardcoded Hebrew headers left as-is (no formula trigger).
- **M2** — fail-secure: `ensureCsvSafe()` at the top of `exportToExcel`; if `window.CsvSafe.cell` is unavailable the export ABORTS (`return`) with a Hebrew `window.notify.error`, never emits un-neutralized CSV.
- **M3** — SSOT preserved: uses the existing `js/core/csv-safe.js` (no new file, no regex copy) — the "encoders are SSOT — route, never copy" rule.
- **M4** — scope discipline: diff limited to `exportToExcel` + the new `ensureCsvSafe` method + the test + this rubric; the file's HTML-escaping is NOT touched.
- **M5** — test proves the customer scenario (G4): a poisoned name/case/assignedTo comes out inert (formula-prefixed + quote-doubled), benign unchanged, fail-secure abort emits no CSV.
- **M6** — G1: null/undefined cells → `''` (csv-safe handles), no literal `undefined`/`null` in the CSV.

## SHOULD
- **S1** — each trigger char (`= + - @`) covered in tests.
- **S2** — load-order documented: `csv-safe.js` is present on `clients.html` + `clients-fluent.html` (from #385); the fail-secure guard is the backstop regardless of order (export is user-triggered, post-load).

## Test plan
`tests/unit/admin-panel/clientstable-csv-injection.test.ts` (vitest + happy-dom): Blob-capture integration — poisoned `=HYPERLINK("..")` / `+`/`-`/`@` cells neutralized + quote-doubled; benign Hebrew unchanged (no false-positive `'`); fail-secure abort (`captured===''` + Hebrew notice). 6/6 pass; full admin-panel suite 137/137.

## Rollback
`git revert <merge-commit>` + redeploy (frontend; Netlify auto-redeploys from main). No data migration, no schema/rule/claim change. Reverting restores the prior `exportToExcel` cell line + removes `ensureCsvSafe`; `csv-safe.js` (from #384) untouched.

## PRODUCT-GRADE GATES
- **G1 PASS** — fail-secure Hebrew notice; null/undefined → `''`; no stack-trace/undefined in output.
- **G2 PASS** — `git revert` rollback (code-only).
- **G3 N/A** — no data mutation (export reads `filteredClients`, writes nothing to Firestore).
- **G4 PASS** — integration test proves poisoned cells inert + fail-secure abort.
- **G5 PASS** — Hebrew error notice ("שגיאה בייצוא הקובץ — רכיב אבטחה חסר. רענן את הדף ונסה שוב").
- **G6 N/A** — no contract/schema/route change; CSV columns/format byte-identical for benign data (only newly-neutralized for malicious/quote-containing values — a fix, not a break).
- **G7 PASS** — security fix (OWASP CSV/formula injection), security-access-expert lens; SSOT-routed.

VERDICT: PASS
