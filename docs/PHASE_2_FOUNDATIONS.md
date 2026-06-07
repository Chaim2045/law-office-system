# Phase 2 H.0 — Foundations (tofes-mecher cross-project bridge)

**Status:** H.0 ships the CODE scaffolding (config + named-app init + connectivity-check). The CONSOLE actions below are performed by an admin (Haim) — the agent cannot access the tofes-mecher project's IAM/Secret Manager.

**What H.0 is:** prove the cross-project wiring works end-to-end in the real deployed environment (Secret Manager → service-account key → second firebase-admin app → one read of tofes-mecher Firestore).

**What H.0 is NOT:** the actual bridge logic (Pattern A `validateSalesRecordExists`, Pattern D BigQuery sync) — that's **H.1**. The BigQuery client code (`@google-cloud/bigquery`) is also **H.1**.

---

## ⚠️ DEPLOY PREREQUISITE (read first)

The connectivity-check function declares `defineSecret('TOFES_MECHER_SA_KEY')`. **`defineSecret` requires the secret to exist in Secret Manager BEFORE `firebase deploy`.** If the secret is missing, the deploy fails **for the ENTIRE functions codebase** — not just this function — blocking all function updates in production.

**Therefore: complete Console Step 2 (set the secret) BEFORE merging/deploying H.0, or before the next unrelated function deploy.**

---

## Console actions (Haim — admin/owner)

### Step 1 — Create the read-only service account in tofes-mecher
In the **tofes-mecher** project (`law-office-sales-form`) → IAM & Admin → Service Accounts:
1. Create a service account, e.g. name `cross-project-reader`.
2. Grant it the role **`roles/datastore.viewer`** (read-only).
   - ⚠️ **NOT `roles/datastore.user`** (that adds write — the bridge never writes to tofes-mecher; least privilege).
   - ⚠️ **Over-read caveat:** `datastore.viewer` is **project-level** — Firestore/Datastore IAM has NO collection-level scoping, and a service account **bypasses Firestore Security Rules entirely**. So this SA can read **every** collection in tofes-mecher, not only `sales_records`. The real control is **key custody + rotation** (below), NOT IAM scoping. Treat the key as a full read-credential to the tofes-mecher project.
3. Create a JSON key for it → download. This is `<TOFES_MECHER_SA_KEY_JSON>` below. **Never commit it.**

### Step 2 — Store the key as a Cloud Functions secret (MAIN project)
From the repo root, against the **MAIN** project (`law-office-system-e4801`):
```
firebase functions:secrets:set TOFES_MECHER_SA_KEY
```
Paste the **entire** JSON key file contents when prompted. (Stored in GCP Secret Manager; never in the repo.)

**Do this BEFORE the next deploy** (see DEPLOY PREREQUISITE).

### Step 3 — Local development key (optional, for local testing only)
Place the same JSON at:
```
functions/secrets/tofes-mecher-sa.json
```
The whole `functions/secrets/` directory is gitignored (a directory-scoped rule in `.gitignore`, so ANY filename under it is safe — not only `service-account*`-prefixed names). **Verify before any commit:** `git check-ignore functions/secrets/tofes-mecher-sa.json` must print the path (= ignored). Never commit it.

### Step 4 — Provision the BigQuery dataset (MAIN project)
In **BigQuery** (project `law-office-system-e4801`) create an EMPTY dataset:
- Dataset ID: **`law_office_analytics`**
- IAM: grant **`roles/bigquery.dataViewer`** to **specific principals only** — Haim, Guy, and (later) the H.8 AI-chat service account. **Do NOT** leave it inheriting project-wide `viewer`. The dataset will hold PII (customer names, fee amounts).

H.0 does NOT create tables — the schema is documented below; H.1's exporter creates the table.

---

## Rotation runbook (if the SA key is compromised)
1. In tofes-mecher Console → Service Accounts → create a NEW JSON key for `cross-project-reader`.
2. `firebase functions:secrets:set TOFES_MECHER_SA_KEY` (paste the new key — creates a new secret version).
3. Redeploy the function: `firebase deploy --only functions:tofesMecherConnectivityCheck`.
4. In tofes-mecher Console → delete the OLD key.

(Optional cleanup if the bridge is ever removed: `firebase functions:secrets:destroy TOFES_MECHER_SA_KEY`.)

---

## Verifying the wiring (after Steps 1-2 + deploy)
From the MAIN Admin Panel browser console, logged in as an admin:
```js
const check = firebase.functions().httpsCallable('tofesMecherConnectivityCheck');
const r = await check({});
console.log(r.data); // { ok: true, reachable: true, sawAtLeastOneDoc: <bool> }
```
- `ok: true, reachable: true` → IAM + secret + cross-project read all work. **This is the H.0 success criterion.**
- `sawAtLeastOneDoc: false` is NOT a failure — it may mean the assumed collection name is wrong (see UNVERIFIED below) or the project is empty. Reachability is already proven.

---

## BigQuery schema (documented for H.1 — not created in H.0)

Dataset `law_office_analytics`, table **`sales_records`** (synced by H.1):

| column | type | mode | PII | source field |
|---|---|---|---|---|
| `sales_record_id` | STRING | REQUIRED | no | doc id (auto-id 20) |
| `id_number` | STRING | NULLABLE | **PII** | `idNumber` (ת"ז — cross-system join key) |
| `client_name` | STRING | NULLABLE | **PII** | `clientName` |
| `phone` | STRING | NULLABLE | **PII** | `phone` |
| `email` | STRING | NULLABLE | **PII** | `email` |
| `tofes_client_id` | STRING | NULLABLE | no | `clientId` (tofes-internal ref) |
| `transaction_type` | STRING | NULLABLE | no | `transactionType` |
| `amount_before_vat` | NUMERIC | NULLABLE | **PII** (financial — net revenue, §1.3) | `amountBeforeVat` |
| `vat_amount` | NUMERIC | NULLABLE | **PII** (financial) | `vatAmount` |
| `amount_with_vat` | NUMERIC | NULLABLE | **PII** (financial — gross) | `amountWithVat` |
| `amount` | NUMERIC | NULLABLE | **PII** (financial — charged) | `amount` |
| `payment_method` | STRING | NULLABLE | no | `paymentMethod` |
| `payments_count` | INT64 | NULLABLE | no | `paymentsCount` (string→int) |
| `months_count` | INT64 | NULLABLE | no | `monthsCount` (string→int) |
| `attorney` | STRING | NULLABLE | no | `attorney` |
| `branch` | STRING | NULLABLE | no | `branch` |
| `record_date` | STRING | NULLABLE | no | `date` (format TBD) |
| `record_timestamp` | TIMESTAMP | NULLABLE | no | `timestamp` |
| `synced_at` | TIMESTAMP | REQUIRED | no | (export time) |
| `raw_json` | JSON/STRING | NULLABLE | mixed — future-proofs the other ~20 fields | full doc |

- **No partitioning/clustering** — <1,000 rows expected (200+ clients, 6 months). Revisit only at 6-7 figure volume.
- **Binding obligation for H.1 (carried from Pre-H.0.0.G):** the `SET_EMPLOYEE_COST` audit_log entries hold salary figures and **MUST be redacted before any BigQuery export.** Likewise `client_name`/`id_number`/`phone`/`email` and all four amount columns (`amount_before_vat`/`vat_amount`/`amount_with_vat`/`amount`) here are PII — the H.8 AI chat that queries this dataset must respect the principal-scoped IAM (Step 4).

---

## ✅ VERIFIED — tofes-mecher `sales_records` schema (2026-06-01, read-only probe)

Confirmed by a one-time **read-only** schema probe against `law-office-sales-form`, using the developer machine's existing Application Default Credentials (NOT the production SA; the probe printed **field names + types + string lengths only — zero PII values**). This SUPERSEDES the earlier inferred assumptions — **two of which were wrong** (marked ❗).

**Collection:** `sales_records` — ✅ exactly as assumed in `TOFES_SALES_COLLECTION`. **Top-level, flat documents**, no subcollections. Doc id = Firestore auto-id (20 chars).

**Fields (37) — the identity + money fields H.1 needs:**

| field | type | role |
|---|---|---|
| `clientName` | string | PII — customer name |
| `idNumber` | string(9) | PII — **Israeli ID; the cross-system join-key candidate** |
| `phone` / `email` / `address` | string | PII |
| `clientId` | string(20) | ❗ tofes-mecher **internal** client ref (its own `clients` collection) — NOT the main-CRM client id |
| `date` | string(10) | form date (exact format = non-PII follow-up) |
| `transactionType` / `transactionDescription` | string | deal classification |
| `amountBeforeVat` | number | net revenue |
| `vatAmount` | number | VAT — **broken out, no inference needed** |
| `amountWithVat` | number | gross |
| `amount` | number | charged amount |
| `paymentMethod` | string | enum (TBD) |
| `paymentsCount` / `monthlyCharge` / `monthsCount` | string | installments (explicit) |
| `creditCardStatus`, `checksCount`, `checksTotalAmount`, `depositDetails`, `temporaryCreditDetails`, `checkWillChange`, `checkReplacementDetails` | string | payment-instrument detail |
| `attorney` / `branch` / `caseNumber` | string | routing |
| `invoiceNumber` / `receiptNumber` | string | accounting links |
| `formFillerName` | string | who filled the form |
| `clientStatus` | string | enum (TBD) |
| `hoursQuantity` / `hourlyRate` | string | hourly-deal fields (often empty) |
| `timestamp` | Timestamp | server write time |

**The 6 prior unknowns — now resolved:**
1. **Collection name** → `sales_records` ✅ (config const was correct).
2. **Field names + types** → table above (37 fields) ✅.
3. **`customer` shape** → ❗**FLAT fields** (`clientName`/`phone`/`email`/`idNumber`/`address`) — NOT a nested `customer` object. Prior assumption was **wrong**.
4. **Join key** → `clientId` references tofes-mecher's **own** `clients`, NOT the main CRM. The cross-system join must use a **natural key — `idNumber` (recommended) or `phone`**. ⏳ DECISION PENDING: confirm how the main `law-office-system` `clients` store `idNumber` (presence + format) before locking the join.
5. **Flat vs subcollections** → **flat, top-level docs** ✅.
6. **`fee`/VAT/installment semantics** → ❗**fully decomposed already** (`amountBeforeVat` + `vatAmount` + `amountWithVat` + `amount`) plus explicit installment fields. No gross/net inference needed ✅.

**Remaining non-PII follow-up before H.1 code (safe — not PII):** exact `date` string format; enum value-sets for `transactionType` / `paymentMethod` / `clientStatus` / `creditCardStatus`; field-consistency across N>1 docs (Firestore is schemaless — one sample is not a guarantee).

> **Probe provenance:** ad-hoc `functions/.tofes-probe.tmp.js` (firebase-admin + ADC, `listCollections` + `limit(1)` + recursive type-print), run once and **deleted** — never committed. Re-runnable any time the schema needs re-confirmation.

---

## Files shipped by H.0
- `functions/src-ts/config/index.ts` — typed cross-project constants
- `functions/src-ts/tofes-mecher/app.ts` — concurrency-safe named-app init (sanitized credential errors)
- `functions/src-ts/tofes-mecher/connectivity-check.ts` — admin-gated v2 onCall (logger only, Hebrew errors, no key/PII in logs)
- `functions/src-ts/__tests__/{config,connectivity-check}.test.ts` — 24 mocked tests (no real cross-project call)
- `functions/index.js` wiring + compiled `functions/lib/` (committed)

**Deferred to H.1:** `@google-cloud/bigquery` dependency + client (⚠️ **lazy-import it** when added — it's a large dependency and this `functions/index.js` is shared by ~40 functions; a top-level import would bloat cold-start for all of them), Pattern A/D logic, real BigQuery table creation.
