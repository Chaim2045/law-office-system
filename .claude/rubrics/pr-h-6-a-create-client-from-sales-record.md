# Rubric — H.6.a: `createClientFromSalesRecord` (the cutover core)

**Title:** A NEW admin-gated v2 callable that DETERMINISTICALLY creates a law-office-system client + a single fixed-price service FROM a tofes-mecher `sales_record`. The agreed fee = the sale's pre-VAT amount (DLR §8.2.5 D1). The financial snapshot is written to a NEW CF-only `sales_record_links/{salesRecordId}` doc, OFF the world-readable `clients` doc.
**Branch:** `feat/h-6a-create-client-from-sales-record`
**Base:** `main`
**App / Env:** Functions (backend) + `firestore.rules`. DEV (`main`). A NEW privileged write path (creates a client + a CF-only link + an audit) + a `firestore.rules` change (a new CF-only collection) → **devils-advocate MANDATORY** (§3.8.4) + the `firestore.rules.test` drift-guard + the deny-suite.
**Effort:** HEAVY (LARGE — a new cross-project-sourced production write path).

**Context:** §8.8 (H.6) governed by §8.2.5 (DLR). The sale is accountant-verified and is the source of truth for the fee. Intake is deterministic: read the sale (Pattern A live read) → create the client+service exactly as `createClient`'s `fixed` branch → record the link+snapshot. `clients` is world-readable (`firestore.rules:147`) → the agreed fee must NOT sit on the client doc (§7.6 / DLR D-A); it lives in the CF-only link. **Option A:** this PR does NOT gate on the H.5 signature/PDF check — that gate is a later H.6 increment; NO PDF/AI egress here.

## MUST criteria (block on FAIL)

### M1 — 🔴 Admin-gate (role-only); rejects unauth + non-admin + legacy `admin:true`
**Rule:** `if (!request.auth) → unauthenticated`; `if (claims.role !== 'admin') → permission-denied`. The legacy `admin:true`-only token is NOT admin (Pre-H.0.0.E consumer-contraction). No PII read / no transaction runs before the gate passes.
**Evidence:** the auth-gate tests (unauth, employee, `admin:true`-only rejected, canonical `role:admin` accepted) + the static AST guard (`claims.role !== 'admin'`, no `.admin === true`).

### M2 — 🔴 Idempotency: one salesRecordId → ≤1 client
**Rule:** the idempotency read (`sales_record_links/{salesRecordId}`) + the create happen in ONE `db.runTransaction`. If the link already exists → return `{ created:false, caseNumber }` (the existing case) and `transaction.create` is NOT called a second time (no duplicate client, no counter bump, no second link, no audit). The link doc id == the salesRecordId (the natural idempotency key).
**Evidence:** the idempotency tests ("2nd call → created:false, same case, no create", "no-op writes no audit").

### M3 — 🔴 Financials OFF the world-readable client doc
**Rule:** the agreed fee is written to the CF-only `sales_record_links/{salesRecordId}` (`agreedFeeSnapshot`, `feeFieldUsed:'amountBeforeVat'`, `confirmedBy`, `state:'matched'`, `schemaVersion`). The `clients` doc carries the fee ONLY as the service's intrinsic `fixedPrice` + the non-PII `salesRecordId` on the service element — NEVER a raw `amount`/`agreedFee` field at the client root.
**Evidence:** the "no financial PII on the clients doc" test (no `amount*`/`agreedFee*` at root) + the link-record test (snapshot present in the CF-only doc).

### M4 — 🔴 Audit-FIRST, NON-PII, in the create transaction
**Rule:** `logCriticalActionInTxn(txn, 'CREATE_CLIENT_FROM_SALES_RECORD', adminUid, { salesRecordId, caseNumber, serviceId })` is written INSIDE the same transaction, BEFORE `transaction.create(clients/…)`, so a created client can never lack its forensic record (atomic commit). The payload is NON-PII — business ids only, NEVER the amount/clientName/idNumber.
**Evidence:** the "audit runs before create" ordering test + the "audit payload is non-PII" test.

### M5 — 🔴 Rule + deny-tests + drift-guard for the new CF-only collection
**Rule:** `match /sales_record_links/{linkId} { allow read, write: if false; }` in BOTH `firestore.rules` AND `firestore.rules.test` (byte-identical rule lines). Fully CF-only (like employee_costs / timesheet_entry_costs). `tests/rules/salesRecordLinks.test.ts` asserts ALL contexts (unauth/employee/admin/partner) are DENIED read AND write. The `rules-drift-guard` `GATED_COLLECTIONS` is EXTENDED to cover the new match block.
**Evidence:** the rules diff (both files) + `salesRecordLinks.test.ts` (8 deny scenarios) + the extended drift-guard.

### M6 — Fixed clientData mirrors createClient; SSOT reuse; Hebrew errors
**Rule:** the created client is built EXACTLY as `functions/clients/index.js createClient`'s `procedureType==='fixed'` branch — base object (clientName + fullName + idNumber + caseTitle + procedureType:'fixed' + status:'active' + priority:'medium' + the management identity + isOnHold:false), the `srv_fixed_*` service (`type:'fixed'`, `fixedPrice = amountBeforeVat`, `work:{0,0}`, `completedAt:null`, `status:'active'`), `totalServices/activeServices:1`, and `plan = computeClientPlan(services)` (the same helper the other two intake routes use — no drift). The live sale is read through the SSOT `readSalesRecordSnapshot` (the SAME named-app read + 9-field projection `validateSalesRecordExists` uses — no duplicate business logic). Fail-closed: sale not found → `failed-precondition`; `amountBeforeVat` null/non-finite → `failed-precondition`. All customer-facing errors are Hebrew-by-code; no PII to `logger.*` (static + runtime guard).
**Evidence:** the happy-path shape test + the plan-stamped test + the SSOT refactor (`readSalesRecordSnapshot`/`projectSalesRecord` exported, the existing validate handler refactored to use the projection, its tests still green) + the precondition tests + the no-PII-in-logs guards.

**Documented intentional deltas from `createClient` (devils-advocate adjudicated — "mirror" = the fixed-create SHAPE + these named deltas, NOT byte-identical):**
- **serviceId is deterministic** (`srv_fixed_${salesRecordId}` vs createClient's `srv_fixed_${Date.now()}`) — required so a transaction retry / concurrent same-sale call converges to the SAME service id (idempotency) + ties the service to its source sale. Additive `salesRecordId` on the service element (traceability, NEVER the amount).
- **`clientName`/`caseTitle` stored RAW** (createClient runs `sanitizeString`). The tofes source is accountant-billing-verified; `sanitizeString` only strips `<>` (incomplete for attribute-context payloads) and lives in a `.js` shared module with no `.d.ts` (would need new shared infra in a strict `allowJs:false` project). The COMPLETE fix is escaping at the render sink (`ReportGenerator.js:226/482` interpolate `client.fullName` raw while the same file escapes other fields) — spun off as a tracked task (`task_fbcdaa1a`); the CF relies on sink escaping. The PR body adjudicates this explicitly.
- **`idNumber` stored RAW** (createClient runs `isValidIsraeliId`). §8.2.5 makes the sale authoritative, and `validateSalesRecordExists`/`readSalesRecordSnapshot` are contractually "RAW values, no computation". Validating here would REJECT legitimate corporate (ח.פ.)/foreign (passport) sales (Pre-H.1.0b deliberately chose OPTIONAL-not-required for this reason; the `idType` model is deferred to Pre-H.1.0c). Acceptable as-is — documented, not silent.
- **`salesRecordTimestampIso` = the SALE's own `timestampIso`** (NOT the wall-clock) — the link's drift-detection field the future DLR drift job (§8.2.5 #7) compares against the live sale. A unit test pins the exact value (not `expect.any(String)`).

## SHOULD criteria (warn on FAIL)
### S1 — `amountBeforeVat:0` is a VALID fee (a free fixed service is created), distinct from null/missing (which fails closed). A unit test pins both.
### S2 — caseNumber is allocated atomically INSIDE the transaction by replicating the `_system/caseNumberCounter` logic (`generateCaseNumberWithTransaction` runs its OWN txn and cannot nest) — `.create()` (not `.set()`) on the client doc so a counter collision aborts rather than silently overwrites. The 999/year hard limit is preserved (→ `resource-exhausted`).
### S3 — the service element carries the non-PII `salesRecordId` for traceability (NEVER the amount). The link record carries `feeFieldUsed` so a future tofes schema change is detectable (DLR #5).

## PRODUCT-GRADE GATES (G1–G7)
- **G1 errors:** PASS — Hebrew HttpsError-by-code on every path (unauth/permission/invalid-argument/failed-precondition/unavailable/internal/resource-exhausted); no stack/`undefined`/`NaN`/English in customer-facing strings. The `amountBeforeVat` missing-amount message tells the admin the next action ("יש להזין ידנית").
- **G2 rollback:** **NOT a pure `git revert`** (same class as H.3 PR3 / the H.1.b CF-deletion incident): a revert DELETES a deployed CF, and the prod pipeline's `firebase deploy --only ...,functions` runs WITHOUT `--force` → it ABORTS rather than auto-delete. Correct sequence: **(1)** supervised `firebase functions:delete createClientFromSalesRecord --region us-central1` (Haim's hands); **(2)** `git revert <commit>` + redeploy for the rules block + lib cleanup. Any `sales_record_links` / `clients` docs already created are real client data — a revert does NOT delete them (they are legitimate cases); only the create PATH is removed. ~5–10 min supervised. The exact steps go in the PR-body Rollback section.
- **G3 monitoring:** PASS — every create writes a durable `CREATE_CLIENT_FROM_SALES_RECORD` audit (in-txn, atomic) + a non-PII `cutover.create_client.completed` success log ({uid, salesRecordId, caseNumber, created}); failure paths log {uid, salesRecordId, errorCode}. NO amount/name/idNumber ever logged.
- **G4 customer test:** PASS — 31 unit tests covering the customer scenario (admin approves a sale → a fixed client+service is created) + idempotency + fail-closed preconditions + audit-FIRST ordering + no-financial-PII-on-clients + the 8-scenario rules deny-suite. Listed in the PR Test plan.
- **G5 Hebrew UI:** PASS — every customer-facing callable string is Hebrew (this is backend; the H.6 approval UI is a later increment).
- **G6 breaking change:** PASS — additive (a NEW callable + a NEW CF-only collection + an additive rules block + a behavior-preserving SSOT extraction in validate-sales-record). No existing collection/rule/callable/field changed or removed; the existing `validateSalesRecordExists` output shape is unchanged (its tests stay green).
- **G7 security:** **security-access-expert reviewed + devils-advocate MANDATORY** (a new privileged write path that creates a client from a SECOND project's data + a firestore.rules change). Verified: admin-only gate (no legacy `admin:true`); the agreed fee off the world-readable clients doc (the §7.6 leak this design prevents — employee/admin read DENY on the link); audit-FIRST atomic; idempotency (a replay cannot mint a duplicate client); fee taken from the signed sale's `amountBeforeVat` snapshot, never a typed number; no PII to logs (static + runtime guard); the SA key never logged (sanitized credential error). The devils-advocate verdict + its 🔴 resolutions are cited in the PR body.

## VERDICT
`outcomes-grader` must return **PASS** / **PASS_WITH_WARNINGS** before `gh pr create`. **devils-advocate must run + its 🔴 attacks be resolved before the PR opens** (a new privileged cross-project-sourced write path + a firestore.rules change, §3.8.4).
