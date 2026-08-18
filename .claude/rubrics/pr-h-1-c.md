# Rubric — H.1.c: `exportSalesToBigQuery` (Pattern D — hourly BigQuery analytical export)

**Title:** Ship the Pattern-D analytical export — a scheduled (hourly) v2 CF that reads the tofes-mecher `sales_records` collection (cross-project) and WRITE_TRUNCATE-loads the BigQuery mirror `law_office_analytics.sales_records` (MAIN project). Hardened per the devils-advocate STOP: all-or-nothing read, never-truncate-to-empty, reconciliation + run-level audit, dead-letter, no-PII-in-logs. The LAST H.1 slice — completes the tofes-mecher bridge.
**Branch:** `feat/h-1-c-bigquery-export`
**Base:** `main`
**App / Env:** Functions (backend). DEV (`main`). Cross-project READ (tofes-mecher) + BigQuery WRITE (MAIN, via runtime SA ADC) + a CF-only `tofes_export_deadletter` Firestore write. New dep `@google-cloud/bigquery` (lazy-imported).
**Effort:** HEAVY. Investigation: backend (GO) + security (GO-conditional) + data-investigator (mapping) + ops (GO + prerequisites) + completeness (2🔴/4🟡/3🟢) + devils-advocate (**STOP → resolved**: all 3🔴 folded into the design).

**Context:** H.1.a proved the wiring; H.1.b shipped the live read. H.1.c is the analytical mirror that feeds H.6 discovery (DLR §8.2.5 #6) + H.8 AI chat. Checkpoint (Haim-approved 2026-06-09): **OMIT raw_json (19 typed columns)** + **full hardened scope**. The devils-advocate STOP (3🔴: WRITE_TRUNCATE+partial-read silent loss; dead-letter theater; silent first-run IAM failure) is closed in the design — this rubric verifies each closure.

## MUST criteria (block on FAIL)

### M1 — ALL-OR-NOTHING read (🔴-1): a partial read can NEVER replace the good mirror
**Rule:** The whole `sales_records` collection is read in ONE `.get()` inside a single try. If the read throws, the handler logs (errorCode only), writes a `{ok:false, phase:'read'}` run-audit, and **THROWS** — the BigQuery table is NOT touched (no `createWriteStream`, no `createTable`). No per-item swallow on the READ.
**Evidence:** the "all-or-nothing read" test (read rejects → throws, `writeStreamMeta` length 0, createTable not called, failure audit phase:'read').

### M2 — NEVER truncate to empty (🔴-1b)
**Rule:** WRITE_TRUNCATE runs ONLY when `rowsMapped >= 1`. A read returning 0 docs, OR a total mapping failure, logs + writes a `{ok:false, phase:'guard'}` audit and THROWS without loading — the mirror is never wiped (the collection is known to hold data, H.1.a `sawAtLeastOneDoc:true`).
**Evidence:** the "never truncate to empty" test (0 docs → throws, no load, audit phase:'guard').

### M3 — Reconciliation + dead-letter (🔴-2): failures are visible, not silent
**Rule:** Per-row map failures are counted (`rowsFailed`), logged (salesRecordId + errorCode, non-PII), and written to a `tofes_export_deadletter` Firestore doc (`{salesRecordId, errorCode, failedAt}` — NEVER the row body / PII). The good rows still load. The handler returns + logs `{rowsRead, rowsMapped, rowsFailed}`.
**Evidence:** the "dead-letter + reconciliation" test (1 bad row → `{rowsRead:2, rowsMapped:1, rowsFailed:1}`, good row loaded, deadletter doc has no PII).

### M4 — Run-level audit (🔴-4): durable, queryable, non-PII; THROW on hard failure
**Rule:** Every run writes a `TOFES_BQ_EXPORT` `audit_log` entry (sys actor `sys:cron-export-sales-bq`, payload = counts/phase/errorCode only — NO PII) on success AND failure. Hard failures (read abort, 0-rows guard, load failure) THROW so Cloud Scheduler records a failed execution (alertable). The audit is best-effort (never masks the export result).
**Evidence:** success-audit test (`{ok:true, rowsRead, rowsMapped, rowsFailed}`, no PII); read/guard/load failure tests assert the matching `{ok:false, phase}` audit.

### M5 — Field minimization: 19 typed columns, NO raw_json; snapshot-never-re-derive
**Rule:** The BQ schema const = exactly the 19 documented columns in order; `raw_json` is OMITTED; `sales_record_id` + `synced_at` are REQUIRED, the rest NULLABLE. Mapping is RAW: the only transforms are Timestamp→ISO and the two string→INT64 coercions (`paymentsCount`/`monthsCount`, empty/non-numeric → null, NEVER 0). No VAT math, no fee-pick, no date reformat. A drift-guard test pins the column list.
**Evidence:** schema drift-guard test (19 columns in order, no raw_json, REQUIRED set); `mapDocToRow` tests (string→int empty→null, 0 amount stays 0, Timestamp→ISO, missing id throws).

### M6 — No PII in logs / dead-letter (G7) — static + runtime guard
**Rule:** No `idNumber`/`clientName`/`amount*`/`phone`/`email`/`address` ever reaches `logger.*` or the dead-letter; only counts, errorCode, errorName, salesRecordId. Static AST guard + runtime serialization scan. `@google-cloud/bigquery` is **lazy-imported** (no top-level import) — verified by the AST guard.
**Evidence:** static AST guards (no-PII-in-logger loop; lazy-import; WRITE_TRUNCATE; no raw_json; sys-actor audit) + the runtime no-PII scan across success/dead-letter/load-fail paths.

### M7 — firestore.rules: explicit CF-only deny for the new collection
**Rule:** `tofes_export_deadletter` gets an explicit `allow read, write: if false` block (mirroring `employee_costs`), not just the catch-all. (Security-rules change → devils-advocate was run + G7.)
**Evidence:** `git diff firestore.rules` shows the new match block with `if false`.

### M8 — Build + full suite + lint green; lib + lockfile committed
**Rule:** `@google-cloud/bigquery` added to `package.json` AND `package-lock.json` (both committed — else `npm ci` breaks CI). `npm run build:ts` exit 0; new `lib/tofes-mecher/export-sales-to-bigquery.js`+`.map` + `lib/config/index.js` committed; fresh build = zero further drift. Full suite green; tsc 0; ESLint 0; export wired in `functions/index.js`.
**Evidence:** `npx jest` 836/836; `git diff --numstat functions/lib/`; `git status` shows package-lock.json modified + committed; `npx eslint` 0.

## SHOULD criteria (warn on FAIL)

### S1 — Doc drift fixed in-PR
**Rule:** `docs/PHASE_2_FOUNDATIONS.md` BigQuery-schema table updated: `raw_json` row struck + a note explaining the H.1.c omission (20→19 columns). (MASTER_PLAN status-flip is a post-merge docs commit.)
**Evidence:** `git diff docs/PHASE_2_FOUNDATIONS.md`.

### S2 — Rollback + the CF-deletion lesson documented
**Rule:** PR body documents: `git revert <merge-sha>` removes the function + its Cloud Scheduler job on redeploy — but this re-triggers the **CF-deletion guard** (CI aborts auto-delete), so rollback needs the supervised `firebase functions:delete exportSalesToBigQuery --region us-central1` (carried from the H.1.b lesson). Optional `bq rm -t` drops the mirror (derived/re-derivable). The dead-letter is append-only.
**Evidence:** PR body "Rollback" section.

## PRODUCT-GRADE GATES (G1–G7)

- **G1 (errors):** PASS — sanitized errorCode-only logging; no raw GCP/FirebaseError to logs; the function has no customer-facing UI (scheduled). N/A for Hebrew UI strings.
- **G2 (rollback):** PASS — git revert + supervised CF-delete; the BQ mirror is derived (re-run self-heals); dead-letter append-only (S2).
- **G3 (monitoring):** PASS — this is THE monitoring-heavy PR: reconciliation counts + a durable run-level `TOFES_BQ_EXPORT` audit on every run + THROW-on-failure (Cloud Scheduler failure metric) + dead-letter. (The Cloud Monitoring alert on the scheduler error-rate is a recommended Console follow-up — noted in the PR.)
- **G4 (customer test):** PASS — 836/836; the new suite exercises the full path + every hardening (all-or-nothing, never-empty, dead-letter, load-fail, no-PII). The "customer scenario" = the hourly export + the post-merge Run-now smoke (PR body).
- **G5 (Hebrew UI):** N/A — no customer-facing strings (scheduled backend; logs are developer-facing English).
- **G6 (breaking change):** PASS — net-new function + net-new BQ table + net-new Firestore collection. No existing contract changed. The documented `raw_json` column is dropped *before first creation* (the table doesn't exist yet) → no migration. Declared in PR body.
- **G7 (security):** PASS — security-access-expert reviewed (GO-conditional; all conditions met): raw_json OMITTED, no-PII-in-logs (static+runtime), CF-only deadletter rules block, lazy-import. **Console prerequisites (Haim, before first run):** runtime SA needs `bigquery.dataEditor`+`jobUser`; principal-scoped `dataViewer` lock (Haim/Guy) before data lands. PII-at-rest under Israeli Privacy Law — IAM is the control.

## VERDICT
`outcomes-grader` must return **PASS** / **PASS_WITH_WARNINGS** before `gh pr create`.
