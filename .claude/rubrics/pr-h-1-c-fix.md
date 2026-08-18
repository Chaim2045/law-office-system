# Rubric — H.1.c fix: NUMERIC scale (normalize currency amounts to 2dp strings)

**Title:** Fix the `exportSalesToBigQuery` load failure — tofes amount values arrive as floats carrying multiplication noise (e.g. `amountWithVat` = 4249.69 stored as `4249.6900000000005`, 13 fractional digits), which exceeds the BigQuery NUMERIC scale (9) and made the WHOLE WRITE_TRUNCATE load abort (maxBadRecords=0). Normalize the 4 currency fields to fixed 2-decimal DECIMAL **strings** (`toFixed(2)`) so they load cleanly into NUMERIC.
**Branch:** `fix/h-1-c-numeric-scale`
**Base:** `main`
**App / Env:** Functions (backend) — the Pattern-D analytical exporter (`exportSalesToBigQuery`). DEV (`main`). PROD-impacting: the hourly export has been FAILING every run since H.1.c deploy (table empty); this is the fix.
**Effort:** LIGHT (single file + test, ~20 lines). Diagnosed live from the BigQuery load-job error (`Invalid NUMERIC value: 4249.6900000000005 Field: amount_with_vat`).

**Context:** Discovered during the H.1.c live-verification smoke (Haim's Console run, 2026-06-10): every hourly load job = FAILURE; `bq show -j` revealed the NUMERIC scale rejection. Not a permissions/region issue (the runtime SA has `editor`; the dataset is US). A data-representation bug in the exporter. Haim confirmed (2026-06-10) currency normalization to agorot (2dp) is correct.

## MUST criteria (block on FAIL)

### M1 — The 4 currency fields emit 2dp DECIMAL strings; 0 stays distinct from null
**Rule:** `amount_before_vat`, `vat_amount`, `amount_with_vat`, `amount` are produced by `numStrOrNull` → a finite number becomes `v.toFixed(2)` (a string); absent/non-number/non-finite → `null`; `0` → `"0.00"` (NEVER null — a real free/zero amount must survive). `BqSalesRow` types for these 4 fields are `string | null`.
**Evidence:** `mapDocToRow` uses `numStrOrNull` for all 4; the unit test asserts `0 → "0.00"`, string/NaN/null → `null`.

### M2 — The load-failure root cause is closed (the regression)
**Rule:** A source float with >9 fractional digits no longer yields an out-of-scale NUMERIC. A regression test maps `amountWithVat: 4249.6900000000005` → `"4249.69"` and asserts every amount column matches `/^-?\d+\.\d{2}$/` (≤ NUMERIC scale 9). Negatives are valid (`-100` → `"-100.00"`).
**Evidence:** the `clamps source float-noise to a NUMERIC-safe 2dp string` test.

### M3 — snapshot-never-re-derive preserved; schema unchanged
**Rule:** No VAT math, no fee-pick, no date reformat, no aggregate. The ONLY added transform is the column-dictated currency clamp (float→2dp string), documented in `numStrOrNull`. `BQ_SALES_SCHEMA` is byte-unchanged (still 19 columns, amounts still `NUMERIC`); the table schema and column types do not change — only the in-memory row VALUE representation (a NUMERIC column accepts a quoted decimal string, the BigQuery-recommended form).
**Evidence:** `git diff` touches only `numOrNull`→`numStrOrNull` + the 4 field mappings + types + docstrings; the schema drift-guard test still passes unchanged.

### M4 — No behavior change beyond the value representation; no PII in logs
**Rule:** Read / map / never-truncate-to-empty guard / dead-letter / WRITE_TRUNCATE load / run-audit / throw-on-failure are all unchanged. No amount VALUE is added to any `logger.*` / `console.*`. The all-or-nothing + reconciliation + dead-letter hardening (H.1.c 🔴-1/1b/2/4) is intact.
**Evidence:** the runtime tests (happy/read-abort/empty-guard/dead-letter/load-fail/no-PII) all still pass; AST no-PII guard green.

### M5 — Build / suite / lint green; lib committed
**Rule:** `npm run build:ts` exit 0; full functions suite green (847 → 849 with the 2 new tests); `tsc` 0; ESLint 0; the rebuilt `functions/lib/tofes-mecher/export-sales-to-bigquery.js` is committed and matches source.
**Evidence:** build/test/lint output; `git diff --numstat functions/lib/`.

## SHOULD criteria (warn on FAIL)

### S1 — No OTHER lurking load-failure class
**Rule:** Because BigQuery aborts at the first bad row (maxBadRecords=0), confirm the other column types cannot fail the load on real data: INT64 (`payments_count`/`months_count` via `intStrOrNull` → clean integers), TIMESTAMP (`record_timestamp`/`synced_at` via ISO), STRING (raw), REQUIRED (`sales_record_id` = doc id, `synced_at` = always set). If any residual risk, note it.

### S2 — Live smoke documented
**Rule:** PR body states the post-merge verification: Cloud Scheduler "Run now" → `bq SELECT COUNT(*)` returns > 0 (≈ tofes `sales_records` count).

## PRODUCT-GRADE GATES (G1–G7)
- **G1 errors:** PASS — no customer-facing surface; the change turns a hard CF failure into a successful load. No stack-trace/leak.
- **G2 rollback:** PASS — `git revert` restores the prior mapping (which only ever produced a failing load; reverting cannot corrupt data — the table is still WRITE_TRUNCATE-replaced atomically).
- **G3 monitoring:** PASS — unchanged: reconciliation counts + `TOFES_BQ_EXPORT` run audit + throw-on-failure remain; the success path now actually runs.
- **G4 customer test:** PASS — regression test reproduces the exact failing value (`4249.6900000000005`) and proves the fix; full suite 849/849; runtime load happy-path covered.
- **G5 Hebrew UI:** N/A — backend-only; the mirror is CF/analytics, never rendered as a customer string.
- **G6 breaking change:** PASS — NO breaking change. The BQ table schema/columns are identical (NUMERIC); the row representation change is internal; the table was empty (never successfully loaded) so there is no existing data to migrate.
- **G7 security:** N/A — no auth / rules / claims / PII-surface change. The amounts were already exported to the same NUMERIC columns by the H.1.c design; this only fixes their numeric encoding. No new PII surface, no logger exposure (the no-PII AST + runtime guards remain green). (Not a `firestore.rules` change → devils-advocate not mandatory; an adversarial grader pass was still run.)

## VERDICT
`outcomes-grader` must return **PASS** / **PASS_WITH_WARNINGS** before `gh pr create`.
