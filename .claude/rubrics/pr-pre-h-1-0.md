# Rubric — Pre-H.1.0 (backend): validated/immutable `idNumber` (ת"ז) on client creation

**Title:** Add an optional, check-digit-validated, immutable `idNumber` (ת"ז) to `createClient` — the cross-system join key foundation for the DLR architecture (MASTER_PLAN §8.2.5).
**Branch:** `feat/pre-h-1-0-idnumber-backend`
**Base:** `main`
**App / Env:** Functions (backend) / DEV. No deploy in this PR.
**Effort:** MEDIUM (effort-scaler verdict 2026-06-02).

**Scope (backend-first, approved at checkpoint 2026-06-02 over the devils-advocate STOP on the full slice):**
- `functions/shared/validators.js` — new `isValidIsraeliId()` (official ת"ז check-digit, zero-pad to 9), exported.
- `functions/clients/index.js` `createClient` — accept **optional** `idNumber`; if present, validate (reject invalid with a generic Hebrew `invalid-argument`, value never echoed); store on the client doc (default `''`). **Not unique** (client = case → one ת"ז on many docs).
- `functions/clients/index.js` `updateClient` — **explicitly reject** any `idNumber` (immutable-from-creation; was silently ignored).
- Tests: validator unit vectors + `createClient`/`updateClient` integration + a PII source-guard.

**Explicitly DEFERRED to separate PRs (documented, not in scope):** the User-App UI field; `required` enforcement; `clients` read-access tightening (G7 open decision); the `SimpleClientDialog` direct-write bypass; the ~127-doc backfill migration; the WhatsApp plaintext-echo fix; the frontend Zod (`/^\d{9}$/`) reconciliation.

## MUST criteria (block on FAIL)

### M1 — `isValidIsraeliId` implements the official check-digit (incl. zero-pad)
**Rule:** Pure validator in `functions/shared/validators.js`, exported. Pads <9-digit input with leading zeros, applies the 1/2-weight mod-10 algorithm, rejects non-string / non-digit / >9 digits / all-zeros.
**Evidence:** `functions/tests/israeli-id-validator.test.js` — 11 assertions incl. valid `123456782`, zero-pad `00000018`, wrong-check-digit `123456789`, sentinels `SYSTEM-INTERNAL`/`TEST-…`, all-zeros, non-string. All green.

### M2 — `createClient` validates-if-present + stores; absent → `''`
**Rule:** `idNumber` is optional. If non-empty, it must pass `isValidIsraeliId` or the call throws `invalid-argument` with a Hebrew message; the rejected value is NOT in the error. If valid, it is written to the client doc. If absent/blank, the doc stores `''`.
**Evidence:** `functions/tests/client-idnumber.test.js` A (valid stored), B (invalid → Hebrew throw, value not in message, write aborted), C/C2 (absent/blank → `''`).

### M3 — `idNumber` is immutable via the CF
**Rule:** `updateClient` rejects any request carrying `idNumber` (explicit `invalid-argument`, Hebrew), and never writes it.
**Evidence:** `client-idnumber.test.js` D + D2 (throws; `update` not called).

### M4 — ת"ז value never reaches logs/audit
**Rule:** No `console.*` / `logger.*` / `logAction(...)` call in the touched files carries an `idNumber` value (repo is PUBLIC; `audit_log` is forensic; ת"ז is sensitive PII — §8.2.5 #8).
**Evidence:** `functions/tests/client-idnumber-pii-guard.test.js` — static source-scan (comment-stripped) over `clients/index.js` + `validators.js`, plus a positive-control that the guard regex catches a violation.

### M5 — NOT unique (client = case)
**Rule:** No uniqueness constraint / unique-index assumption / "find THE client by ת"ז" is introduced. Duplicates are allowed (data-investigator confirmed multiple case docs per person).
**Evidence:** `git diff` shows no uniqueness check; validator docblock + createClient comment state non-uniqueness explicitly.

### M6 — No regression, no scope creep
**Rule:** Full `functions` Jest suite green; the diff touches ONLY `functions/shared/validators.js`, `functions/clients/index.js`, the 3 new test files, and this rubric. No `firestore.rules`, no UI, no migration, no unrelated files.
**Evidence:** `npx jest` → 47 suites / 746 tests pass. `git diff --stat main..HEAD` = the listed files only.

### M7 — Lint clean (the #347 lesson)
**Rule:** `npm run lint -- --max-warnings=2200` → **0 errors**, exit 0.
**Evidence:** verified 2026-06-02 (`✖ 1850 problems (0 errors, …)`, exit 0).

## SHOULD criteria (warning on FAIL)

### S1 — Behavioral change documented
**Rule:** `updateClient` going from silently-ignoring `idNumber` to explicitly-rejecting it is called out as a (safe) tightening; no known caller sends `idNumber` to `updateClient` (ClientManagementModal sends only `caseOpenDate`; SimpleClientDialog uses direct `.set()`).
**Evidence:** PR body "Behavioral change" note.

### S2 — Deferred follow-ups enumerated
**Rule:** The PR body lists every deferred item (UI/required/read-access/bypass/backfill/WhatsApp/Zod) so nothing is silently dropped.

## PRODUCT-GRADE GATES

- **G1 — Customer errors:** PASS — invalid ת"ז → generic Hebrew `"מספר תעודת הזהות אינו תקין"`; no value, no stack, no `[object Object]`. Validation throws a hand-built `HttpsError`, so it short-circuits the pre-existing `${error.message}` catch (the catch leak is grandfathered, out of scope).
- **G2 — Rollback:** PASS — `git revert <merge-commit>` + redeploy. Code-only; the field is optional and additive, so no data migration to undo. Any ת"ז stored between merge and revert remains valid client data (harmless).
- **G3 — Monitoring:** PASS — `createClient` already logs success (`caseNumber`, `clientName`) + writes a `CREATE_CLIENT` audit entry; the create path remains monitored. The new field is **deliberately not logged** (PII) — that is the correct posture, not a gap (M4).
- **G4 — Customer-scenario test:** PASS — 19 tests: 4 CF integration scenarios (create-with-valid, create-with-invalid, create-without, update-immutable) + 11 validator vectors + 3 PII-guard.
- **G5 — Hebrew UI:** PASS — both customer-facing errors are Hebrew (`"מספר תעודת הזהות אינו תקין"`, `"לא ניתן לעדכן תעודת זהות לאחר יצירת הלקוח"`).
- **G6 — Breaking change:** PASS (no breaking change) — `idNumber` is a new optional field; no existing caller sends it to `createClient`; legacy docs without it are tolerated everywhere (stored default `''`). The `updateClient` reject is a tightening of a previously-silent no-op with no real caller (S1).
- **G7 — Security review:** PASS — `security-access-expert` reviewed in the investigation phase (verdict: backend path is safe; idNumber kept out of logs; the **read-access widening** and the **SimpleClientDialog bypass** are real but DEFERRED to separate PRs and explicitly flagged). This PR adds NO Firestore-rules change and NO new reader (the field was already read by `ClientsDataManager` / written by `SimpleClientDialog`). Plaintext storage is consistent with the system's access-control-not-encryption model.

VERDICT: (filled by grader)

## Rollback
```bash
git revert <merge-commit>
git push origin main
```
Code-only. No data migration. No PROD deploy in this PR.

## Test plan
**Automated (this PR):** `cd functions && npx jest tests/israeli-id-validator tests/client-idnumber` → 19 pass; full `npx jest` → 746 pass (regression).
**Manual:** none required — no deploy, no UI. The field has no live producer until the UI PR; existing flows are unaffected (optional, additive).

## Notes for grader
- Devils-advocate (2026-06-02) issued STOP on the FULL slice (dead UI surface, SimpleClientDialog bypass, "required" incoherence). This PR is the **narrowed backend-first** scope Haim approved at checkpoint — it deliberately makes `idNumber` OPTIONAL (not required) and touches NO UI, which neutralizes all three criticals. The deferred items are tracked, not dropped.
- The cross-language frontend Zod reconciliation was intentionally deferred to the UI PR (an orphaned validator + cross-lang drift-guard now would add risk to a clean backend PR).
