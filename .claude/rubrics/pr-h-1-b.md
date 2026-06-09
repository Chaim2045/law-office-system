# Rubric — H.1.b: `validateSalesRecordExists` (Pattern A live cross-project read) + delete connectivity-check

**Title:** Ship the Pattern-A bridge read — a new admin-gated v2 callable that reads ONE specific `sales_records` doc from the tofes-mecher project via the cross-project named app and returns a FIELD-MINIMIZED snapshot for the H.6 cutover flow, with a NON-PII access audit on every lookup. Delete the H.0 `tofesMecherConnectivityCheck` (its REPURPOSE-OR-DELETE debt) — `validateSalesRecordExists` proves the identical wiring + does real work.
**Branch:** `feat/h-1-b-validate-sales-record`
**Base:** `main`
**App / Env:** Functions (backend). DEV (`main`). **Cross-project READ** (tofes-mecher) — no write to either project; the only main-project write is the non-PII access audit (`audit_log`).
**Effort:** MEDIUM. Investigation: backend (GO) + security (GO-conditional) + data-investigator (contract) + completeness (0🔴/6🟡/3🟢) + devils-advocate (PROCEED WITH CAUTION, 2🔴 both resolved).

**Context:** H.1.a proved the wiring live (`reachable:true`). H.1.b is the real bridge read — the Pattern-A "commit" of the DLR (§8.2.5 #6: discover via the Pattern-D mirror, commit via one live read). It is the FIRST function returning tofes-mecher PII (ת"ז/amounts/clientName) to the browser, so security discipline is the spine. Checkpoint (Haim-approved 2026-06-09): **minimal 9-field return** + **non-PII access audit on every lookup**. Consumer = H.6 only.

## MUST criteria (block on FAIL)

### M1 — Read contract: point read by 20-char auto-id; `{exists:false}` not throw
**Rule:** Reads `getTofesMecherApp(TOFES_KEY.value()).firestore().collection(TOFES_SALES_COLLECTION).doc(salesRecordId).get()` — a single point read; collection HARD-CODED from the config const, never caller-supplied. Not-found returns `{ exists: false, salesRecordId }` (a legitimate H.6 discovery state) + a distinct non-PII `logger.warn` (mirror/live divergence, DLR #6/#7) — NOT a thrown `not-found`.
**Evidence:** `validate-sales-record.ts` read block; not-found test returns `{exists:false}` + emits `tofes_mecher.validate.not_found`.

### M2 — Field minimization: EXACTLY the 9-field allowlist (default-deny)
**Rule:** Returns ONLY `{exists, salesRecordId, clientName, idNumber, amountBeforeVat, vatAmount, amountWithVat, amount, transactionType, timestampIso}`. EXCLUDES address/phone/email/clientId and all instrument/routing/installment fields. Server-side allowlist projection — NEVER `return snap.data()` (Firestore is schemaless; a future tofes field must not leak).
**Evidence:** the `found` test asserts `toEqual` the exact 9-field object + asserts phone/email/address/clientId are absent; static guard `not.toMatch(/return\s+snap\.data\(\)/)`.

### M3 — snapshot-never-re-derive: RAW values, ONE transform
**Rule:** No computation on any field — no VAT math (already decomposed), no fee-pick (consumer picks `amountBeforeVat`), no `parseInt` of string-numerics, no date parsing. The ONLY transform is `timestamp` (Firestore Timestamp) → ISO 8601 string. Absent strings → `''`; absent amounts → `null` (0 is a valid fee, must stay distinct from missing).
**Evidence:** `asString`/`asNumberOrNull`/`asTimestampIso` helpers; the "absent → ''/null, 0 stays 0" test; the `timestampIso` ISO assertion.

### M4 — Non-PII access audit is a disclosure PRECONDITION (fail-secure)
**Rule:** Every lookup calls `logCriticalAction('VALIDATE_SALES_RECORD', uid, { salesRecordId, found })` — NO ת"ז/amounts/name in the payload. If the audit write fails, the handler throws `internal` and does NOT return the PII (fail-secure). The audit fires for both found + not-found.
**Evidence:** audit test asserts the `{salesRecordId, found}` payload + no PII; the FAIL-SECURE test (audit rejects → throws `internal`, `res.exists` undefined); not-found audit test (`found:false`).

### M5 — Auth gate role-only + Zod `.strict()` bounded
**Rule:** Role-only admin gate (`claims.role !== 'admin'` → reject); rejects unauth + non-admin + legacy `admin:true`-only. Zod `.strict()` input `{ salesRecordId: /^[A-Za-z0-9]{20}$/ }` (the auto-id shape; also hard-bounds path safety). Rejected input → `invalid-argument`, NO read, NO audit.
**Evidence:** the 4 auth-gate tests (incl. reject-`admin:true`); the schema test (wrong-length/non-alnum/extra-field/missing rejected); "invalid id → invalid-argument, no read, no audit".

### M6 — No PII in logs (G7) — static + runtime dual guard
**Rule:** No `idNumber`/`clientName`/`amount*`/`phone`/`email`/`address`/`snap.data()` ever reaches `logger.*`; only uid, salesRecordId, errorCode, found-bool, errorName. Sanitized credential errors (no key fragment) via `getTofesMecherApp`. Hebrew customer-facing errors on every throw (G1/G5).
**Evidence:** the static AST guard (forbidden-identifier loop) + the runtime serialization scan (PII sentinels + `sa-key` + `SECRET-FRAGMENT` never in `loggerCalls`); the credential-init/read-fail Hebrew tests.

### M7 — connectivity-check fully deleted (REPURPOSE-OR-DELETE resolved); coverage migrated
**Rule:** All 5 edit points: (1) `functions/index.js` swaps the export (`validateSalesRecordExists` in, `tofesMecherConnectivityCheck` out — export count stays 67); (2) `connectivity-check.ts` deleted; (3) `lib/tofes-mecher/connectivity-check.js`+`.map` deleted; (4) `connectivity-check.test.ts` deleted; (5) `claim-shape-contraction-guard.test.ts` const (`:48`) + it.each row (`:185`) swapped to `validate-sales-record.ts`. The deleted test's named-app/credential/no-PII-log coverage is re-established in `validate-sales-record.test.ts` (so `app.ts` retains test coverage).
**Evidence:** `git diff --stat`; the migrated `getTofesMecherApp` credential/singleton describe-block; contraction-guard group-5 passes against the new file.

### M8 — Build + full suite + lint green; lib committed in sync
**Rule:** `npm run build:ts` exit 0; new `lib/tofes-mecher/validate-sales-record.js`+`.map` committed; a fresh build produces zero further content drift (CRLF-only touches restored). Full functions suite green; `tsc` 0; ESLint 0 errors.
**Evidence:** `npx jest` 817/817; `git diff --numstat functions/lib/` shows only the new file + the deletion; `npx eslint` 0 (from repo root).

## SHOULD criteria (warn on FAIL)

### S1 — Doc drift fixed in-PR
**Rule:** `docs/PHASE_2_FOUNDATIONS.md` — the rotation-runbook command (was `--only functions:tofesMecherConnectivityCheck`, now actively WRONG) points at `validateSalesRecordExists`; the "Verifying the wiring" + "Files shipped by H.0" sections note the deletion. (MASTER_PLAN status-flip is a post-merge docs commit, matching H.1.a.)
**Evidence:** `git diff docs/PHASE_2_FOUNDATIONS.md`.

### S2 — Rollback documented
**Rule:** PR body documents the rollback: `git revert <merge-sha>` restores connectivity-check + removes validate. Read-only function; the only write is the append-only audit (no rollback needed — audit entries are immutable forensic records). <5 min.
**Evidence:** PR body "Rollback" section.

## PRODUCT-GRADE GATES (G1–G7)

- **G1 (errors):** PASS — every throw is Hebrew, user-friendly; errorCode-only logging; no stack/`undefined` leakage.
- **G2 (rollback):** PASS — `git revert` + redeploy; read-only; audit is append-only (S2).
- **G3 (monitoring):** PASS — the access audit (uid + salesRecordId + found) IS the monitoring for this PII-disclosure path; success/failure also `logger.*`-logged. (This is the one data-write — the audit — and it has its own failure log via `logCriticalAction`.)
- **G4 (customer test):** PASS — 817/817; the new suite exercises the full path (admin → id → projected snapshot / `{exists:false}` / fail-secure). H.6 is the UI consumer (future).
- **G5 (Hebrew UI):** PASS — all customer-facing errors Hebrew.
- **G6 (breaking change):** PASS — `tofesMecherConnectivityCheck` is REMOVED, but it has ZERO production/UI consumers (it was an admin-console diagnostic; grep-confirmed only index.js + tests referenced it). Declared in PR body. `validateSalesRecordExists` is net-new (no prior shape to break).
- **G7 (security):** PASS — security-access-expert reviewed (GO-conditional; all conditions met: 9-field minimization, raw-idNumber justified, dual no-PII guard, Zod strict, role-only gate, hard-scoped collection, non-PII access audit). Returns PII to the browser but field-minimized + audited; rules untouched (cross-project read bypasses rules).

## VERDICT
`outcomes-grader` must return **PASS** / **PASS_WITH_WARNINGS** (all MUST satisfied + all gates PASS/N/A) before `gh pr create`.
