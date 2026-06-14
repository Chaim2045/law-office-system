# Rubric — H.1.c retention/TTL follow-up (dead-letter TTL + BQ retention decision)

**Title:** Close the two retention gaps deferred at the H.1.c checkpoint (security + completeness): (1) document the BigQuery `law_office_analytics.sales_records` retention DECISION + apply the dataset time-travel mitigation; (2) bound the append-only `tofes_export_deadletter` collection with a Firestore TTL + a brief triage runbook. PII-at-rest hygiene under חוק הגנת הפרטיות.
**Branch:** `chore/h-1-c-retention-ttl`
**Base:** `main`
**App / Env:** Functions (backend) + docs. DEV (`main`). One additive field on the CF-only `tofes_export_deadletter` write; the TTL policy + BQ dataset time-travel are config-only (Haim, gcloud/Console). No customer-facing surface.
**Effort:** LIGHT (one ~5-line code change + test + docs). effort-scaler skipped (obviously LIGHT). Specialists consulted in investigation: security-access-expert (GO / GO-WITH-CONDITIONS) + backend-firebase-expert (GO both claims). Haim ratified 3 decisions at the 2026-06-14 checkpoint: 90d retention / include the PII payload lock / set time-travel=48h.

**Context:** H.1.c (PR #365) shipped `exportSalesToBigQuery` (hourly WRITE_TRUNCATE mirror) + the `tofes_export_deadletter` dead-letter. Two retention items were flagged + deferred. This PR resolves them. The full operational bridge runbook stays scheduled for H.9 (§8.11) — this is the focused retention note only.

## MUST criteria (block on FAIL)

### M1 — Dead-letter TTL targets `expireAt`, NOT `failedAt`
**Rule:** `deadLetter()` writes a new `expireAt = Timestamp.fromMillis(Date.now() + DEADLETTER_RETENTION_DAYS*86_400_000)` (a future instant), leaving `failedAt: serverTimestamp()` intact. The doc comment + `firestore.rules` comment explain WHY the TTL is on `expireAt` (failedAt is already in the past → a policy on it would purge immediately). `DEADLETTER_RETENTION_DAYS = 90`.
**Evidence:** the dead-letter test asserts `expireAt` is present + strictly `> Date.now()` and `failedAt === 'ts-sentinel'` (the two are distinct); the admin mock gains `Timestamp.fromMillis`.

### M2 — No-PII payload lock (security condition)
**Rule:** a static AST guard asserts the `deadLetter()` function body references NO PII identifier (`idNumber`/`clientName`/`amount*`/`phone`/`email`/`address`/`clientId`) — so a future edit adding PII to the dead-letter write fails CI, not silently at rest. The runtime no-PII scan over the dead-letter doc is preserved.
**Evidence:** the `dead-letter write references NO PII identifier (payload locked)` static test + the existing runtime `for (const v of Object.values(PII)) ... not.toContain(v)` on the dl doc.

### M3 — BQ retention DECISION documented + the right mitigation
**Rule:** `docs/PHASE_2_FOUNDATIONS.md` "Retention & TTL" documents the explicit decision (indefinite, source-bounded, ≤1h staleness; self-refreshing WRITE_TRUNCATE derived mirror → no independent retention obligation), names the liveness contingency (Scheduler-failure throw + the recommended Cloud Monitoring alert), applies `max_time_travel_hours=48` (with the `bq` command + the non-configurable ~7d fail-safe residual), and REJECTS a table default-expiration with the reason (create-if-not-exists re-materializes). H.8 carry-forward (hash id_number + drop name/phone/email) recorded.
**Evidence:** `git diff docs/PHASE_2_FOUNDATIONS.md`.

### M4 — TTL policy + triage runbook documented (config-only, Haim's hands)
**Rule:** the doc gives the exact `gcloud firestore fields ttl update expireAt --collection-group=tofes_export_deadletter` command (+ describe), states TTL is NOT expressible in `firestore.rules`/`firestore.indexes.json`/`firebase.json`, and a brief triage runbook: read via Console/Admin SDK (CF-only), re-fetch the live sale via `validateSalesRecordExists(salesRecordId)` (H.1.b), nothing to re-drive (hourly reload self-heals), recurring errorCode → fix the mapper. The durable `TOFES_BQ_EXPORT` audit + Scheduler throw are explicitly NEVER TTL'd.
**Evidence:** `git diff docs/PHASE_2_FOUNDATIONS.md`.

### M5 — Build + full suite + lint green; lib committed; no scope leak
**Rule:** `npm run build:ts` exit 0; recompiled `lib/tofes-mecher/export-sales-to-bigquery.js`+`.map` committed; full functions suite green (the new `expireAt` assertion + mock + AST guard pass); tsc 0; ESLint 0. The commit contains ONLY this task's files — NOT the other session's `dist/**` drift or `pr-h-3-2-employee-costs.md` (shared-working-tree discipline).
**Evidence:** `npx jest` green; `git show --stat HEAD` shows only the retention files.

## SHOULD criteria (warn on FAIL)

### S1 — Bookkeeping
**Rule:** MASTER_PLAN carry-note flipped to DONE + 1 new §10 Decisions-Locked row + 1 §14 plan-revision bullet. `firestore.rules` deadletter comment updated to the 5-field shape + TTL note (comment-only, no rule logic).
**Evidence:** `git diff docs/MASTER_PLAN.md firestore.rules`.

### S2 — Rollback documented
**Rule:** PR body "Rollback" = `git revert <merge-sha>` (drops `expireAt` from new writes; existing docs age out by their stamped value or via a one-off field-policy disable). The TTL policy + time-travel are reversible Console actions (`--disable-ttl`, `--max_time_travel_hours=168`).
**Evidence:** PR body "Rollback" section.

## PRODUCT-GRADE GATES (G1–G7)

- **G1 (errors):** N/A — no customer-facing surface (scheduled backend + docs). The added field is a Timestamp; no new error path.
- **G2 (rollback):** PASS — `git revert` drops the field; TTL/time-travel are reversible Console flags (S2).
- **G3 (monitoring):** PASS — the change is monitoring-adjacent: it bounds a forensic log without weakening the durable `TOFES_BQ_EXPORT` audit / Scheduler-failure throw (explicitly preserved); the doc recommends the Cloud Monitoring scheduler-error alert.
- **G4 (customer test):** PASS — the dead-letter integration test now asserts the `expireAt` TTL invariant + the static no-PII payload lock; full suite green.
- **G5 (Hebrew UI):** N/A — no customer-facing strings (developer-facing logs/comments/docs).
- **G6 (breaking change):** PASS — purely additive field on a CF-only collection; no existing reader of the dead-letter doc (default-deny rules); no contract changed. Declared in PR body.
- **G7 (security):** PASS — security-access-expert consulted (GO / GO-WITH-CONDITIONS); PII-at-rest under חוק הגנת הפרטיות is the subject; the dead-letter stays PII-free (now AST-locked); `firestore.rules` change is COMMENT-ONLY (no access-control logic) → no devils-advocate rule-change trigger.

## VERDICT
`outcomes-grader` (Lead Agent acting as grader — the project agent type is unavailable in this session) must return **PASS** / **PASS_WITH_WARNINGS** before `gh pr create`.
