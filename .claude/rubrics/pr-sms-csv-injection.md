# Rubric — PR-SMS-CSV-INJECTION

**Title:** Neutralize CSV / Formula Injection in the SMS phone-list export (OWASP) + introduce the shared `CsvSafe` encoder (SSOT)
**Branch:** security/sms-csv-injection
**Base:** main
**Scope:** Add `apps/admin-panel/js/core/csv-safe.js` exposing `window.CsvSafe.cell(value)` — the shared single-source-of-truth CSV/Excel cell encoder (OWASP formula-injection guard + RFC-4180 quote-doubling). Route the value cells of `convertToCSV(data)` in `apps/admin-panel/js/ui/SMSManagement.js` (~line 504) through it, with a fail-closed guard. Add a vitest unit + integration suite. Frontend-only, additive, no behavior change for benign data, no HTML/CSS/rules/claims/auth touched.

**Reachability (honest — security-access-expert verdict):** `SMSManagement.js` is **ORPHANED** — `SYSTEM_MAP.md §D "JS Files Not Loaded by Any HTML"` lists it (#5); no HTML `<script>` loads it and no other JS references it. The `exportPhoneList → convertToCSV` sink is therefore **not reachable in the running app today**. Severity is **LOW / latent (defense-in-depth)** — a real CSV formula-injection weakness in dead-but-shipped code that would carry employee name/email/phone into a downloaded CSV **if** a future PR wires the component live. We fix it now because (a) it is the safe, additive testbed that establishes the canonical `CsvSafe` encoder, and (b) that encoder turns the genuinely-LIVE sibling sinks (ClientsTable, DataManager) into a one-line fix in their follow-up PRs. "Live data-exfiltration" is NOT claimed for this PR.

## MUST criteria (block on FAIL)

### M1 — `CsvSafe.cell` is the OWASP-correct neutralizer
**Rule:** for a value starting with `= + - @ TAB(0x09) CR(0x0D) LF(0x0A)`, prefix a single `'` **before** RFC-4180 quote-doubling; return the INNER cell content (caller wraps in `"..."`). Trigger regex `/^[=+\-@\t\r\n]/` (a strict superset of PR-SEC-3's inline copy — adds LF). null/undefined → `''`.
**Evidence required:** `apps/admin-panel/js/core/csv-safe.js` `cell()`; unit tests for each trigger char + classic payloads (`=HYPERLINK`, `=cmd|' /C calc'!A1`) + combined `="evil"` (prefix-then-double).

### M2 — SMS value cells route through `CsvSafe.cell`, fail-closed
**Rule:** `SMSManagement.convertToCSV` value cells return `` `"${window.CsvSafe.cell(value)}"` `` (transport quotes preserved); if `window.CsvSafe.cell` is unavailable the function throws (fail-closed) rather than emitting raw cells. The hardcoded Hebrew header literals are NOT user data and are left as-is.
**Evidence required:** `SMSManagement.js` convertToCSV diff (guard + the routed return line); integration test asserts no quoted cell opens onto a formula trigger + the fail-closed throw.

### M3 — single canonical encoder, no new surface
**Rule:** one shared util in `js/core/` (peer of `budget-status.js` / `profitability-format.js`), one canonical name `window.CsvSafe.cell`, no new dependency, no new collection/rule/claim. No inline copy of the regex added to SMSManagement.
**Evidence required:** diff shows the util + a call site; no duplicated regex in `SMSManagement.js`.

### M4 — correct context: CSV encoding only, no HTML-escape
**Rule:** the fix uses CSV/Excel encoding (formula guard + quote-doubling). It does NOT HTML-escape (would be inert against the formula engine and would corrupt legitimate names like `O'Brien` / `Smith & Co`). No other file's CSV/HTML context is touched.
**Evidence required:** diff limited to `csv-safe.js`, `SMSManagement.js` convertToCSV, the test, and this rubric.

### M5 — test proves the neutralization (G4, to the reachable ceiling)
**Rule:** vitest suite covers (a) `CsvSafe.cell` directly — every trigger char, mid-string non-trigger, quote-doubling, prefix-before-double order, null/undefined; and (b) `convertToCSV` integration — poisoned name/email/phone come out inert, benign values unchanged, empty-data `''`, and fail-closed throw. PR body documents that a pure/integration unit test is the achievable ceiling because the calling page is orphaned (no live UI to E2E).
**Evidence required:** `tests/unit/admin-panel/sms-csv-injection.test.ts` green; full root vitest suite still green.

### M6 — no new lint errors / no benign-data behavior change
**Rule:** 0 new ESLint errors on touched lines; a benign export (Hebrew names, normal emails/phones) renders byte-identically to before except for the (now-correct) formula guard on values that legitimately start with a trigger (e.g. a `+972…` phone → text, which is desirable).
**Evidence required:** ESLint on the two JS files = 0 new errors; integration "no false positives" test.

## SHOULD criteria (warning on FAIL)

### S1 — SSOT convergence noted
**Rule:** `CsvSafe.cell` is documented as the canonical home the in-flight PR-SEC-3 `ReportGenerator.csvCell` and the live `ClientsTable` / `DataManager` exporters converge onto (tracked as follow-ups), so the project does not keep ≥3 divergent inline copies.
**Evidence required:** docblock in `csv-safe.js` + this rubric's Out-of-scope.

### S2 — no "undefined"/"null" leak (G1 alignment)
**Rule:** `CsvSafe.cell(null|undefined)` → `''` (no literal `undefined`/`null` in the CSV).
**Evidence required:** unit test assertion.

## Out of scope (tracked separately)

- **`ClientsTable.js:~738` `exportToExcel`** — LIVE (clients.html / clients-fluent.html), `"${cell}"` with **no quote-doubling at all** and no formula guard; leaks the world-readable `שם הלקוח`. Highest real-risk CSV sink → its own PR (live admin page → full ADMIN SAFETY validation). Chip filed.
- **`DataManager.js:~707` `exportToCsv`** — LIVE (index/workload/employee-costs), same weakness; own PR. Chip filed.
- **`ReportGenerator.csvCell`** (PR-SEC-3, in flight, inline) — refactor to delegate to `CsvSafe.cell` after both land (merge-second rebases to the util).
- **`SMSManagement.js` retirement** — it is orphaned with `// TODO: Implement` stubs; whether to retire vs. keep is a separate Product-Owner call. SYSTEM_MAP §D entry is NOT edited (the file stays orphaned).
- **`SMSManagement.js:~318` `innerHTML` interpolation** — a distinct XSS class (also orphaned), not part of this CSV PR.

## Rollback

`git revert <commit>` + redeploy (code-only, frontend; Netlify auto-redeploys from main). No data migration, no schema change, no Firestore rule/claim change. Reverting removes `csv-safe.js` and restores the prior `convertToCSV` line; because SMS is orphaned there is no live consumer to regress either way.

## Notes for grader

- **security-access-expert verdict: GO-WITH-CHANGES** — neutralizer logic OWASP-correct and complete (prefix-`'`-first → quote-double → wrap; transport quotes do not defeat the guard; order is load-bearing). Change folded: added `\n` to the trigger class. Reachability framed honestly (LOW/latent — SMS orphaned).
- **completeness-checker:** 9 findings; the load-bearing one (PR-SEC-3 committed inline → util-vs-one-inline convergence) is addressed by adopting a superset regex + tracking the merge-second delegation. Live sinks (ClientsTable, DataManager) deferred to their own PRs with chips.
- **G7:** output-encoding only; no firestore.rules / claims / auth / PII-handling change → the security review is the consultation; no live PII surface added (orphaned path).
