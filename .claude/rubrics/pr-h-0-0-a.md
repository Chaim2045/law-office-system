# Rubric — PR-H.0.0.A

**Title:** Read-only claim diagnostic (`verifyClaims`)
**Branch:** `feat/verify-claims-pr-h-0-0-a`
**Base:** `main`
**Scope:** Add a read-only callable Cloud Function `verifyClaims` that inspects the current state of Firebase Auth custom claims vs the `employees` collection `role` field, plus scans `messages` for any doc with `'partner'` in `toRoles`. Pure observability. Zero writes. First PR in the Pre-H.0.0 series — provides the ground-truth diagnostic that every subsequent PR in Pre-H.0.0 (claim sync, claim shape consolidation, partner-role helper) will depend on.

## MUST criteria (block on FAIL)

### M1 — Pure read-only
**Rule:** The PR introduces ZERO writes (no `set()`, `update()`, `delete()`, no `setCustomUserClaims`, no batch). The diagnostic ONLY reads.
**Evidence required:** `git diff main..HEAD -- functions/` grep for `\.set(\|\.update(\|\.delete(\|setCustomUserClaims` → expected match count: **0** in the new `verifyClaims` body.

### M2 — Auth gate accepts BOTH legacy and current claim shapes
**Rule:** Caller is admin if `context.auth.token.role === 'admin'` OR `context.auth.token.admin === true`. Neither shape alone causes lockout. Unauthenticated → unauthenticated error in Hebrew. Non-admin → permission-denied error in Hebrew.
**Evidence required:** `functions/auth/index.js` — both conditions present in the auth check. Hebrew error strings present.

### M3 — Report contains all required sections
**Rule:** The returned object includes: `schemaVersion`, `generatedAt`, `triggeredBy`, `employees[]` (per-employee detail), `claimShapeBreakdown` (5 buckets), `mismatches[]`, `messagesWithPartnerToRoles`, `summary`, `notes[]`.
**Evidence required:** `functions/auth/index.js:verifyClaims` body explicitly populates each field.

### M4 — Per-employee error isolation
**Rule:** If `auth.getUserByEmail(email)` throws for one employee, the diagnostic continues for the rest. The failed employee is recorded with `authError`. No whole-run abort on a single bad row.
**Evidence required:** `try/catch` around the per-employee auth lookup; the loop continues after catch.

### M5 — Hebrew user-facing errors (G1)
**Rule:** Every `HttpsError` thrown to the caller has a Hebrew message. No raw FirebaseError leaks, no stack traces.
**Evidence required:** All three `HttpsError` throws have Hebrew `message` argument.

### M6 — Structured observability log (G3)
**Rule:** Exactly one structured `console.log` at successful completion, including `triggeredBy`, `schemaVersion`, `summary`. Failure paths log `console.error` with context.
**Evidence required:** Grep `[verifyClaims]` tag in the diff.

### M7 — No breaking change (G6)
**Rule:** The PR does not modify any existing function signature, response shape, or rule. `setAdminClaims`, `initializeAdminClaims`, `isAdmin()` rule are unchanged.
**Evidence required:** Diff against `main` touches only: (a) new function appended to `functions/auth/index.js`, (b) one new export line in `functions/index.js`, (c) new files (`docs/PARTNER_CLAIM_DIAGNOSTIC.md`, `.claude/rubrics/pr-h-0-0-a.md`).

### M8 — Security gate consulted (G7)
**Rule:** This PR returns claim shapes — adjacent to PII auth surface. Security agent verdict referenced in PR body.
**Evidence required:** PR body includes "security agent" mention + verdict line.

## SHOULD criteria (warning on FAIL, doesn't block)

### S1 — Messages scan is non-fatal
**Rule:** Failure to query `messages` (missing collection, missing index) does NOT cause the function to error out. It records the failure inside the report and continues.
**Evidence required:** `try/catch` around the messages query; report still returns successfully.

### S2 — Limit messages scan to 100 docs
**Rule:** The `messages` scan uses `.limit(100)` and notes if the limit was hit (full count unknown).
**Evidence required:** `.limit(100)` in the messages query; condition added to `notes[]` if `size === 100`.

### S3 — Diagnostic doc written
**Rule:** `docs/PARTNER_CLAIM_DIAGNOSTIC.md` exists, explains how to invoke from the browser console, how to interpret each field in the returned report, and what each `mismatch` kind means.
**Evidence required:** File exists; covers invocation + interpretation.

## Out of scope

What this PR explicitly does NOT do (grader: do NOT downgrade for absence):

- Setting any custom claim — handled by future PR-H.0.0.F (`syncRoleClaims`)
- Adding `isPartner()` helper to firestore.rules — handled by future PR-H.0.0.D
- Adding `logCriticalAction` audit primitive — handled by future PR-H.0.0.C
- Locking down the existing `setAdminClaims` HTTP endpoint — handled by future PR-H.0.0.B
- Adding `employee_costs` collection — handled by future PR-H.0.0.G
- Frontend UI to call this diagnostic — invocation is via browser console / Cloud Functions shell. UI is future scope.
- Tests (Jest/Vitest) — manual smoke is acceptable for read-only diagnostic; full test scaffold lands with PR-H.0.0.F when writes appear.

## Rollback

If this PR lands in DEV and behaves unexpectedly:

1. `git revert <merge-commit>` on `main`
2. Redeploy functions: `firebase deploy --only functions:verifyClaims --project law-office-system-e4801`
3. After revert deploy, the `verifyClaims` callable is removed from the production endpoint surface.
4. No data rollback needed — the function performs zero writes.

## Test plan (G4 manual smoke is acceptable for read-only)

1. Deploy to DEV functions
2. From DEV admin panel browser console, while logged in as Haim:
   ```js
   const verify = firebase.functions().httpsCallable('verifyClaims');
   const result = await verify({});
   console.log(JSON.stringify(result.data, null, 2));
   ```
3. Verify report includes: all 10 known employees (per `add-employee-phones.js`), claim shape breakdown, summary stats.
4. Verify the function returns within 30 seconds (no timeout).
5. Verify `console.log('[verifyClaims] Diagnostic completed', ...)` appears in Firebase Functions logs.
6. As a non-admin user (test account): invocation should fail with Hebrew `permission-denied`.
7. Unauthenticated (no login): invocation should fail with Hebrew `unauthenticated`.
8. Verify the diagnostic itself does NOT modify any document — re-run twice in 60 seconds and confirm Firestore audit shows no writes from the function.

## Notes for grader

- This is the FIRST PR in the Pre-H.0.0 series. It deliberately does nothing other than observe. Every subsequent Pre-H.0.0 PR depends on the diagnostic output of this one.
- The auth gate intentionally accepts BOTH `{role:'admin'}` and `{admin:true}` because the whole point of running this diagnostic is to detect the claim-shape drift between these two forms. Locking the gate to one shape only would prevent diagnosing the other shape's holders.
- `messages.toRoles` scan exists because devils-advocate flagged that `firestore.rules:239` does dynamic `request.auth.token.role in resource.data.toRoles` matching — so the presence of any doc with `'partner'` in `toRoles` is critical context before any future partner-claim write.
- No `logCriticalAction` is used (it does not exist yet — PR-H.0.0.C). Standard `console.log` is sufficient for a read-only diagnostic per G3 (`N/A if PR is read-only`).
