# Rubric — PR-DATAMANAGER-CSV-INJECTION

**Title:** Neutralize CSV / Formula Injection in the DataManager users-CSV export (OWASP) — route through the shared `CsvSafe` SSOT encoder
**Base:** main (includes #384 CsvSafe + #385 ReportGenerator routing + #386 ClientsTable routing)
**App:** Admin Panel · **Env:** DEV · **Frontend-only, additive, admin-critical**

**Scope:** Route every value cell of `DataManager.exportToCSV()` (`apps/admin-panel/js/managers/DataManager.js` ~line 707) through `window.CsvSafe.cell` — the shared SSOT encoder `apps/admin-panel/js/core/csv-safe.js` (introduced by #384, wired live by #385) — plus a fail-secure `ensureCsvSafe()` guard. Add a vitest integration suite. **NOT a new inline neutralizer.** This is the LAST live admin-panel CSV sink (the CSV-injection sub-track closes here).

**Reachability (LIVE — security-access-expert lens):** `exportToCSV` builds the users-list CSV the admin downloads. It is wired LIVE from the "ייצוא" button in `FilterBar.js` (`attachExportButton` → `window.DataManager.exportToCSV()`), and FilterBar is loaded ONLY on `index.html` — where `csv-safe.js` is already present (line 238). Before this fix the cell-build wrapped each value in `"..."` with **NO quote-doubling AND NO formula guard** (identical class to #386). A live user `username`/`name`/`email`/`role` containing `= + - @` (or `"`) → live formula execution / broken CSV when the admin opens the download. Severity **HIGH / LIVE** (the user-list export of a live admin grid).

**Out of scope:** the other two pages that load `DataManager.js` (`workload.html`, `employee-costs.html`) do NOT load FilterBar → the export button is not reachable there, so NO `<script>` change is needed (the `ensureCsvSafe` guard is the fail-secure backstop regardless). The Hebrew headers (`headers.join(',')`) are hardcoded with no formula trigger → left as-is.

## MUST (block on FAIL)
- **M1** — every value cell routes through `window.CsvSafe.cell`: `rows.map(r => r.map(cell => \`"${window.CsvSafe.cell(cell)}"\`)...)`. No inline neutralizer/regex added. Hardcoded Hebrew headers left as-is (no formula trigger).
- **M2** — fail-secure: `ensureCsvSafe()` runs at the top of `exportToCSV` (before any cell is built); if `window.CsvSafe.cell` is unavailable the export ABORTS (`return`) with a Hebrew `window.notify.error`, never emits un-neutralized CSV.
- **M3** — SSOT preserved: uses the existing `js/core/csv-safe.js` (no new file, no regex copy) — the "encoders are SSOT — route, never copy" rule.
- **M4** — scope discipline: diff limited to `exportToCSV` + the new `ensureCsvSafe` method + the test + this rubric; no other DataManager method touched.
- **M5** — test proves the customer scenario (G4): a poisoned name/email/role comes out inert (formula-prefixed + quote-doubled), benign Hebrew unchanged, fail-secure abort emits no CSV.
- **M6** — G1: null/undefined cells → `''` (csv-safe handles), no literal `undefined`/`null` in the CSV.

## SHOULD
- **S1** — each trigger char (`= + - @`) covered in tests.
- **S2** — load-order documented: `csv-safe.js` is present on `index.html` (from #385) — the only page exposing the export; the fail-secure guard is the backstop regardless of order (export is user-triggered, post-load).

## Test plan
`tests/unit/admin-panel/datamanager-csv-injection.test.ts` (vitest + happy-dom): Blob-capture integration — poisoned `=HYPERLINK("..")` / `+`/`-`/`@` cells neutralized + quote-doubled; benign Hebrew unchanged (no false-positive `'`); fail-secure abort (`captured===''` + Hebrew notice). 6/6 pass; full admin-panel suite 143/143. (Loads `constants.js` first — the DataManager singleton is built at module load and its constructor reads `window.ADMIN_PANEL_CONSTANTS`.)

## Rollback
`git revert <merge-commit>` + redeploy (frontend; Netlify auto-redeploys from main). No data migration, no schema/rule/claim change. Reverting restores the prior `exportToCSV` cell line + removes `ensureCsvSafe`; `csv-safe.js` (from #384) untouched.

## PRODUCT-GRADE GATES
- **G1 PASS** — fail-secure Hebrew notice; null/undefined → `''`; no stack-trace/undefined in output.
- **G2 PASS** — `git revert` rollback (code-only).
- **G3 N/A** — no data mutation (export reads `filteredUsers`, writes nothing to Firestore).
- **G4 PASS** — integration test proves poisoned cells inert + fail-secure abort.
- **G5 PASS** — Hebrew error notice ("שגיאה בייצוא הקובץ — רכיב אבטחה חסר. רענן את הדף ונסה שוב").
- **G6 N/A** — no contract/schema/route change; CSV columns/format byte-identical for benign data (only newly-neutralized for malicious/quote-containing values — a fix, not a break).
- **G7 PASS** — security fix (OWASP CSV/formula injection), security-access-expert lens; SSOT-routed.

VERDICT: PASS
