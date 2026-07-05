# PR H.6.c-2 — teach downstream consumers about pending_signature (phase 2 of the signature gate)

**Scope:** Make every `clients`-reading surface handle the `pending_signature` status c-1 introduced, BEFORE c-3/c-4 re-enable creation — so the moment a pending client can exist, no consumer mishandles it. No pending client can exist yet (create button disabled in c-1), so this is a pre-positioned safety layer.

## MUST criteria

### M1 — Profitability skips pending_signature (one owner)
`forecast-aggregation.ts` MUST skip `pending_signature` clients from the daily all-clients scan AND from `recomputeProfitabilityForCase`, via a single shared predicate (`shouldSkipClientForForecast` / `CLIENT_SKIP_STATUSES`) distinct from the SERVICE-level `FORECAST_SKIP_STATUSES`. `getProfitability`/`recomputeProfitability` MUST resolve a pending client to a clean `{exists:false}`/`{found:false}` with NO `client_profitability` write. The skip MUST NOT over-exclude any legitimate client (undefined/null status → treated as active).

### M2 — Admin badge, no regression
`ClientsTable.js` `getStatusBadge` MUST render an explicit Hebrew "ממתין לחתימה" badge for `pending_signature` (escape-safe), placed so the lifecycle status wins over a derived "no hours" badge. NO existing status's badge may change (exact-string equality on a new status value).

### M3 — User-App selectability guard (test)
A vitest guard MUST pin the pre-existing `status=='active'` query + filter in `client-case-selector.js`, proving a `pending_signature` client is NOT selectable for time entry.

### M4 — listUnlinkedSalesRecords union, fail-closed
`listUnlinkedSalesRecords.linkedIds` MUST be the UNION of `sales_record_links` ids AND `pending_signature_intents` ids (parallel reads, `Set` dedup), so a pending sale drops out of the unlinked queue (no double-create). The reads MUST fail-closed (a read failure throws a Hebrew `unavailable`, never a partial/under-counted "linked" set).

### M5 — Green
`npm run build:ts` 0 errors; functions ts-jest green (incl. the pending-skip + union + list-unlinked tests); root vitest green (incl. the admin badge + user-app guard tests); ESLint 0 on changed files (no NEW warnings on touched lines).

## SHOULD criteria

### S1 — Forward-constraints captured (devils-advocate GO-WITH-CHANGES)
The PR body MUST record the two forward-constraints as explicit c-3/c-5 requirements: (a) **c-3 MUST add a RUNTIME `pending_signature` exclusion at the user-app selector** (defense-in-depth beyond the test) before creation goes live — the `clients` rule is world-readable, so a test alone is not sufficient once pending clients are creatable; (b) **c-5's sweep MUST delete the `pending_signature_intents` marker AND the client atomically** (same txn) — else the union would permanently hide a sale with no client.

### S2 — Accepted behavior named
The PR body SHOULD name "a stuck-pending case never appears in the profitability dashboard" as accepted behavior (it appears in the pending-clients queue + the ClientsTable badge; a pending case has activeServices:0 so has nothing to forecast), with c-5 as the future owner of stuck-pending alerting.
