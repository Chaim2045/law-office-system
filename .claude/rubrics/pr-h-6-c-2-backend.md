# Rubric — H.6.c-2-backend: teach the Forecast job + the unlinked-sales lister about `pending_signature`

**Scope:** Backend correctness only. Two CF-only read/aggregate paths learn about the `pending_signature` client status that c-1 (#422) introduced. NO frontend, NO firestore.rules, NO change to `FORECAST_SKIP_STATUSES`. The `pending_signature` client visibility/PII question (world-readable + main-list) is **out of scope — deferred to c-3** by Haim at the 2026-07-05 checkpoint.

**Type:** Feature increment (backend). Splits from the original single c-2 into c-2-backend (this) + c-2-frontend (badges), Haim-approved at the 2026-07-05 checkpoint.

**Files:**
- `functions/src-ts/profitability/forecast-aggregation.ts` (+ compiled `functions/lib/profitability/forecast-aggregation.js`)
- `functions/src-ts/tofes-mecher/list-unlinked-sales-records.ts` (+ compiled `functions/lib/tofes-mecher/list-unlinked-sales-records.js`)
- `functions/src-ts/__tests__/forecast-aggregation.test.ts`
- `functions/src-ts/__tests__/list-unlinked-sales-records.test.ts` (new)

## MUST

- **M1 — Forecast skips pending clients at the CLIENT level.** `aggregateClientProfitabilityHandler` skips a client whose `status === 'pending_signature'` with a `continue` placed BEFORE any per-client entries/costs read — no `client_profitability` doc is minted for it. Skipped count is tracked (`clientsSkippedPending`) and surfaced in the run summary + run audit.
- **M2 — `FORECAST_SKIP_STATUSES` is UNCHANGED.** That constant is a SERVICE-status set (`['archived']`) pinned by a drift-guard to `aggregates.NON_AGGREGATING_STATUSES`; `pending_signature` is a CLIENT status. The drift-guard test still passes.
- **M3 — Lister excludes sales that already hold a `pending_signature_intents` marker.** `listUnlinkedSalesRecordsHandler` reads the `pending_signature_intents` collection (id-only `.select()`, same MAIN-project `admin.firestore()` ADC pattern as the existing `sales_record_links` read — NO new cross-project/IAM/secret surface) and unions those ids with `linkedIds` into the exclusion set. Both collections are keyed by `salesRecordId`, so the id-set union is exact.
- **M4 — Counts stay distinct, not conflated.** `pendingCount` is added separately from `linkedCount` across the response interface, the non-PII audit payload, and the structured log — never summed into one number.
- **M5 — The new read is fail-closed with a Hebrew error.** If the `pending_signature_intents` read throws, the handler throws an `HttpsError('unavailable', …)` with a Hebrew, user-friendly message (mirrors the existing `sales_record_links` read-failure path) — it is NOT silently ignored (which would let a pending sale leak back as unlinked).
- **M6 — Tests mirror the customer scenarios + regression is green.** Forecast: pending client skipped (no doc) / active client still written / mixed run with distinct counts. Lister: pending-only sale excluded / links-only sale still excluded / neither returned as unlinked / both-collections edge counted once / audit carries `linkedCount`+`pendingCount` separately / Hebrew-unavailable thrown on each read failure. Full `src-ts` suite passes (no regression).

## SHOULD

- **S1 — Structured logging preserved.** `clientsSkippedPending` in the forecast run summary/audit; `pendingCount` in the lister log + audit.
- **S2 — Intent documented.** Comments explain the client-status vs service-status axis (why the skip is NOT in `FORECAST_SKIP_STATUSES`) and why the lister needs the second exclusion set.

## PRODUCT-GRADE GATES

- **G1 (errors):** PASS — lister read-failure → Hebrew user-friendly `HttpsError`; no raw error surfaced.
- **G2 (rollback):** PASS — code-only; `git revert <sha>` + redeploy functions.
- **G3 (monitoring):** PASS — forecast run-audit gains `clientsSkippedPending`; lister audit gains `pendingCount`. Net effect on the write path is FEWER `client_profitability` writes (pending skipped), logged.
- **G4 (customer test):** PASS — 30 tests across the two modules mirror the real scenarios; full src-ts regression green.
- **G5 (Hebrew):** PASS — the one new customer-facing string (lister read-fail) is Hebrew.
- **G6 (breaking change):** PASS — additive `pendingCount` response field (consumers ignore unknown fields; `pending-clients.js` reads `unlinkedRecords` only). Pending clients no longer receive a `client_profitability` doc — they never should have (harmless-empty before); no active-client aggregate changes. Declared: no breaking change.
- **G7 (security):** PASS — the c-2 read-only investigation confirmed the `pending_signature_intents` read is same-project ADC (no new cross-project/IAM/secret surface); `pending_signature_intents` is CF-only (`if false`) and the Admin SDK bypasses rules as before. No auth/rules/PII-shape change. The world-readable-pending-client concern is explicitly deferred to c-3 (not regressed here).

## Self-grade

To be completed by the independent `outcomes-grader` (separate context).
