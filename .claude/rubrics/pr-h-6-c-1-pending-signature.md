# PR H.6.c-1 — pending_signature create + intent marker (phase 1 of the signature gate)

**Scope:** Backend + a frontend safety-disable. `createClientFromSalesRecord` now creates a `pending_signature` client (phase 1 of the two-phase H.6.c signature gate) instead of an `active` one, repoints idempotency to a new CF-only `pending_signature_intents` collection, and DEFERS the permanent `sales_record_links` write to the c-3 activation CF. The live approve-and-create button is DISABLED so DEV is never left in a broken/bypassable state. No client can be created until c-3/c-4 ship the gated flow.

## MUST criteria

### M1 — Pending client shape
The created client MUST be `status:'pending_signature'`, its one `srv_fixed_*` service `status:'pending'`, `activeServices:0`, `totalServices:1`, and a `sourceSalesRecordId` at the client root (for c-3 activation + c-5 sweep). Plan is still stamped (safe — `computeClientPlan` skips only `archived`).

### M2 — Idempotency via a CF-only marker, exactly-once
Idempotency MUST key on a NEW `pending_signature_intents/{salesRecordId}` doc, written via `transaction.create()` inside the SAME `db.runTransaction` as the client create + counter + audit. A concurrent double-call MUST yield EXACTLY ONE client + ONE caseNumber (no orphan marker-without-client or client-without-marker). Re-call with an existing intent → `{created:false}`.

### M3 — No fee snapshot / no link at create
The `sales_record_links` fee-snapshot write MUST be REMOVED from the create txn (it moves to c-3, which re-reads the live sale — the SSOT). No `agreedFeeSnapshot`/`feeFieldUsed` persisted in c-1; no dangling reference to the removed fields.

### M4 — Rules CF-only + guards
`firestore.rules` + `firestore.rules.test` MUST gain a byte-identical `match /pending_signature_intents/{salesRecordId} { allow read, write: if false; }` block; the rules drift-guard MUST cover it; a deny-suite (`tests/rules/pendingSignatureIntents.test.ts`) MUST exist.

### M5 — No broken/bypassable DEV state
The live approve-and-create button MUST be disabled (no callable wiring to `createClientFromSalesRecord` remains in the page), with a Hebrew "under construction (H.6.c)" affordance. Listing/table rendering intact. The gate is NOT bypassable from the shipped UI.

### M6 — Audit + Breaking-change disclosure (G6)
The audit action rename `CREATE_CLIENT_FROM_SALES_RECORD` → `CREATE_PENDING_CLIENT_FROM_SALES_RECORD` MUST be disclosed in the PR body's Breaking-change section (a forensic query must now match both literals).

### M7 — Green
TypeScript build 0 errors; the `create-client-from-sales-record` ts-jest suite green (incl. new pending-shape + intent-marker + no-link assertions); ESLint 0; rules drift-guard green. (Emulator deny-suite runs in CI where Java exists.)

## SHOULD criteria

### S1 — c-2/c-3 tracking captured
The PR body SHOULD record the two devils-advocate tracking items as explicit c-2/c-3 prerequisites: (a) `listUnlinkedSalesRecords.linkedIds` must union `sales_record_links` + `pending_signature_intents` (else a pending sale re-appears as unlinked); (b) before c-3/c-4 re-enables creation, `aggregateClientProfitability` (all-clients scan, no status filter) + every `clients`-reading surface must handle/exclude `pending_signature` / `activeServices:0`.

### S2 — Non-PII audit preserved
The audit payload stays non-PII (`salesRecordId, caseNumber, serviceId`); no amount/clientName/idNumber to logger or audit.
