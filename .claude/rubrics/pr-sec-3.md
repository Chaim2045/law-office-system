# Rubric — PR-SEC-3 (route ReportGenerator CSV exports through the shared CsvSafe SSOT encoder)

**Title:** feat(security): neutralize CSV/formula-injection in ReportGenerator exports via window.CsvSafe (OWASP)
**Branch:** security/csv-injection-report-generator-pr-sec-3
**Base:** main
**Scope:** Frontend-only, additive hardening of the two CSV exporters in
`apps/admin-panel/js/managers/ReportGenerator.js` — `generateExcel` (~L902-947) and
`generateEmployeeCSV` (~L1591-1661). User-controllable values (client/employee/task names,
service names, timesheet action/description) were written into CSV cells with only
quote-doubling (`generateEmployeeCSV`) or NO escaping at all (`generateExcel`). A cell whose
value starts with `= + - @` (or TAB 0x09 / CR 0x0D / LF 0x0A) is evaluated as a formula when
the CSV is opened in Excel / Google Sheets (OWASP "CSV Injection" / "Formula Injection").

**Approach — route, don't copy (encoders are SSOT).** PR #384 (PR-SMS-CSV-INJECTION) merged the
canonical encoder `apps/admin-panel/js/core/csv-safe.js → window.CsvSafe.cell` (single-quote
prefix on a leading trigger + RFC-4180 quote-doubling). Its own header names ReportGenerator as
a LIVE sink to route here. This PR **delegates** both ReportGenerator exporters to
`window.CsvSafe.cell` (no second inline copy), wires `csv-safe.js` to load **before**
`ReportGenerator.js` on the 3 pages that load it, and adds a fail-secure guard. This realizes
the "route the LIVE ReportGenerator sink" follow-up #384's csv-safe.js header anticipated.

**Deliberately distinct from PR #382 (XSS):** that PR HTML-escaped the same module's *HTML*
report sinks. HTML-escaping a CSV cell corrupts it — CSV/formula injection is a separate
context, which is why it was left out of #382 and addressed here.

## MUST criteria (block on FAIL)

### M1 — Both exporters route every user-controllable string cell through window.CsvSafe.cell (SSOT)
**Rule:** `generateEmployeeCSV` routes employee.name / client name / description / clientName
(via the delegated `csvEscape = (val) => window.CsvSafe.cell(val)`); `generateExcel` routes
employee name / service name / action-description / task name / status / deadline-placeholder
through `window.CsvSafe.cell(...)`. **No inline neutralizer remains** — ReportGenerator declares
no `csvCell` of its own (zero duplicated neutralization logic).
**Evidence:** `git diff` shows `window.CsvSafe.cell(...)` at every routed site; the prior inline
`csvCell` method is removed; test "ReportGenerator does NOT keep a second inline neutralizer".

### M2 — Neutralization is correct (delegated to the audited SSOT) — leading triggers + RFC-4180
**Rule:** A cell value starting with `= + - @` / TAB / CR / LF is prefixed `'` (prefix BEFORE
quote-doubling); embedded `"` is doubled. `generateExcel` (previously NO escaping) now also gets
the RFC-4180 quote-doubling. The logic itself is `window.CsvSafe.cell` (unit-tested by csv-safe's
own suite under #384); this PR proves it end-to-end through the exporters.
**Evidence:** `js/core/csv-safe.js` `cell()` (`/^[=+\-@\t\r\n]/` → `'` + `.replace(/"/g,'""')`);
integration tests assert `'=HYPERLINK(` + `""http://evil""` etc. and `not.toMatch /(?:^|[,\n])"[=+\-@\t\r]/`.

### M3 — Load-order wired: csv-safe.js loads BEFORE ReportGenerator on every page that loads it
**Rule:** The 3 HTML pages that `<script>` `ReportGenerator.js` (`clients.html`,
`clients-fluent.html`, `index.html`) load `js/core/csv-safe.js` immediately before it. (Runtime
only needs it present by export time, but loading it first is explicit + matches the wiring note.)
**Evidence:** `git diff` of the 3 HTML files — one added `<script src="js/core/csv-safe.js?v=20260617-pr-sec-3">`
line directly above each `ReportGenerator.js` line, with an explanatory comment.

### M4 — Fail-secure if the encoder is missing (no un-neutralized CSV ever emitted)
**Rule:** If `window.CsvSafe.cell` is not loaded, each exporter ABORTS before building any CSV
(returns early) and shows a Hebrew error notice — it never falls back to emitting an
un-neutralized CSV.
**Evidence:** `ensureCsvSafe()` guard at the top of both exporters; test "FAIL-SECURE: if the
CsvSafe encoder is not loaded, the export ABORTS (no CSV emitted) + Hebrew notice".

### M5 — No false positives on legitimate data
**Rule:** Hebrew text, normal names, digit-leading values, and dates are unchanged. Numeric cells
(minutes/hours/counts) are NOT routed — a legitimate negative number must not become text `'-5`.
**Evidence:** test "generateExcel: legitimate values are unchanged"; the diff leaves
`${entry.minutes}`, `${task.estimatedHours||0}`, `${task.actualMinutes||0}`, the date cells,
summary numerics, and `period.label` raw.

### M6 — Customer-scenario integration coverage (G4)
**Rule:** A test drives the actual `generateExcel` / `generateEmployeeCSV` download path with a
poisoned input and asserts the produced CSV contains the neutralized (`'`-prefixed) cell and NO
quoted cell opening directly onto a raw trigger.
**Evidence:** the two "the customer scenario (G4)" integration tests + the fail-secure test;
Blob constructor + URL stubbed to capture the CSV string; csv-safe.js imported first so
`window.CsvSafe` exists (mirrors the page <script> order). 6/6 in this suite green.

### M7 — Additive / non-breaking, output-encoding only
**Rule:** No data, schema, route, CF, rule, claim, or auth change. The only behavior changes are
(a) inert-text rendering of cells that would otherwise be formulas (the fix) and (b) a new
load-order dependency on `csv-safe.js` (additive `<script>`; pure global, no display change).
Existing ReportGenerator tests stay green.
**Evidence:** `git diff` = ReportGenerator.js + 3 HTML `<script>` adds + the test + this rubric
only; `report-generator-service-hours.test.ts` 12/12 + all admin-panel unit tests 131/131 green.

## SHOULD criteria (warning on FAIL)

### S1 — Guard documented + fail-secure with Hebrew text
**Rule:** `ensureCsvSafe()` carries a JSDoc explaining the fail-secure rationale; the user-facing
abort message is Hebrew (G5); the dev diagnostic is `console.error` (allowed).
**Evidence:** JSDoc above `ensureCsvSafe`; Hebrew `window.notify.error(...)`.

### S2 — Header label-lines correctly left untouched
**Rule:** `generateExcel` L911-913 (`דוח פעילות ללקוח - ${client.fullName}`, `מספר תיק: ...`) are
NOT changed — the user value follows a Hebrew literal so the cell never STARTS with a trigger,
and the lines are unquoted (quote-doubling without quoting would itself corrupt them).
**Evidence:** diff does not touch L911-913; security review confirmed not an injection vector.

### S3 — ESLint 0 errors
**Rule:** Changed files lint with 0 errors (pre-existing `no-console`/`any` warnings allowed).
**Evidence:** `npx eslint <changed files>` → 0 errors (47 pre-existing warnings, none added).

## Out of scope (tracked separately — Haim-approved Option 1 at the 2026-06-17 checkpoint)

- `apps/admin-panel/js/ui/ClientsTable.js` `exportToExcel()` (L738: `row.map(cell => \`"${cell}"\`)`
  — **NO escaping at all**, the worst LIVE sibling) — route to `window.CsvSafe.cell` in a separate
  PR/chip (🔴 HIGH). Named in csv-safe.js's header as a remaining LIVE sink.
- `apps/admin-panel/js/ui/SMSManagement.js` `convertToCSV()` — already routed to `window.CsvSafe.cell`
  by #384, but **orphaned** (loaded by no HTML page; SYSTEM_MAP §D) → defense-in-depth only.
- `DataManager.exportToCsv` (the 3rd LIVE sink named in csv-safe.js's header) — separate chip.

## Rollback

Additive and trivial to undo (frontend-only, no data migration):
- `git revert <sha>` → redeploy the admin panel (Netlify). The 3 `<script>` adds + the routing
  revert together; cells return to the prior (unescaped / quote-doubling-only) behavior. No
  inverse migration; nothing persisted; `csv-safe.js` itself (from #384) is untouched by the revert.

## Notes for grader

- **Why delegate instead of the originally-committed inline `csvCell`:** PR #384 merged the
  canonical `window.CsvSafe.cell` to main AFTER this branch's first commit. Per the SSOT rule
  (encoders are routed, not copied — MASTER_PLAN §2.0.2 Architecture) and #384's own header naming
  ReportGenerator as a LIVE sink, the branch was rebased onto #384 and the inline copy replaced by
  delegation. Net: one neutralizer system-wide.
- **Behavioral nuances (declared, benign):** (a) a routed cell whose value legitimately starts
  with a trigger renders with a leading apostrophe Excel/Sheets treat as the text marker (not shown
  as data); (b) `generateExcel` cells now also get RFC-4180 quote-doubling they previously lacked
  (a fix); (c) the trigger set is now CsvSafe's superset (adds LF 0x0A) — strictly safer.
- **Specialists consulted (G7):** security-access-expert — VERDICT **PASS_WITH_CONDITIONS**:
  single-quote prefix is the correct OWASP technique, `"..."` transport-quoting does NOT defeat it,
  trigger set complete, no bypass (`="evil"`, `=cmd|...`, `+1+1`, `-2+3`), numerics correctly left
  raw, header lines correctly untouched, and **strongly preferred extracting/using a shared CsvSafe
  SSOT** — which is exactly this PR's approach. All conditions satisfied.
- **devils-advocate:** NOT mandatory — output-encoding change only; no firestore.rules / claims /
  auth / field-exposure / schema / migration trigger (per §3.8.4). The 3 HTML `<script>` adds are
  additive (define a pure global; no display/state change).
- **G3 framing:** N/A — read-only export, no data mutation, no logging added.
