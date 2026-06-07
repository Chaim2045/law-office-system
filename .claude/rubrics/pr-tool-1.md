# Rubric — PR-TOOL-1: repair `validation-script.js` createClient harness broken by Pre-H.1.0a (#348)

**Title:** fix(tooling): drop `idNumber`/`idType` from the `testCreateNewClient` dev-diagnostic payload so it stops failing `createClient`'s ת"ז validation.
**Branch:** `fix/validation-harness-idnumber-pr-tool-1`
**Base:** `main`
**App / Env:** User App / DEV — but the touched file is a **browser-console-only diagnostic** (`window.ValidationScript`), never auto-run, never in CI, never on a user flow. No deploy-critical path.
**Effort:** LIGHT (single file, single object literal, 2-line removal + rationale comment). Effort-scaler skipped — obviously LIGHT per feature-protocol.md.

**Scope:** `apps/user-app/js/validation-script.js` `testCreateNewClient()` (Test 3, the "Live Test") builds a `testData` payload and calls the real `createClient` Cloud Function. Pre-H.1.0a (#348) added ת"ז validation in `functions/clients/index.js:106-115`: a **non-empty** `idNumber` must pass `isValidIsraeliId` (`functions/shared/validators.js`) or the call throws `invalid-argument` "מספר תעודת הזהות אינו תקין". The harness was sending `idNumber: 'TEST-' + Date.now()` (fails `/^\d{1,9}$/`) plus `idType: 'passport'` (the backend never reads `idType`), so Test 3 fails on **every** run since #348 merged. Fix: remove both fields. `idNumber` is OPTIONAL on the backend (defaults to `''`, validation skipped when empty/absent), so the diagnostic again creates its test client successfully — and no synthetic ת"ז is written into the live DB or exposed in a public repo.

**Why option (a) — drop both fields — over option (b) (synthetic valid ת"ז `123456782`):** both are correct; (a) is the simplest and strictly safer. Dropping the field means the live test-client document carries no ID-like value at all, so the "never write / never log a ת"ז" PII concern is fully eliminated rather than merely satisfied. The harness's purpose is to prove `createClient` works end-to-end, not to exercise ת"ז validation (that path is covered by #348's own 19 backend tests).

**Explicitly OUT of scope (documented, not dropped):**
- The 27 pre-existing `no-console` warnings in this file (it is a console diagnostic — `console.log` is its entire job). Not introduced or worsened here.
- The harness creating a **real** client in the live DB and being browser-console-gated — that is existing, intended behavior; this PR does not change the gating model (it remains a manually-invoked `window.ValidationScript` global, not auto-run).
- Pre-H.1.0b (#353) UI work (the required ת"ז field in the User-App wizard) — separate, open PR. This fix was explicitly **deferred** from #353 at Haim's 2026-06-03 checkpoint and ships standalone.

## MUST criteria (block on FAIL)

### M1 — Harness no longer trips ת"ז validation
**Rule:** The `testData` payload sent to `createClient` contains neither `idNumber` nor `idType`. With `idNumber` absent, `createClient` (`functions/clients/index.js:107`) sets `validatedIdNumber = ''` and skips `isValidIsraeliId` entirely — no throw.
**Evidence:** diff removes both keys; backend guard at `index.js:107` only validates when `idNumber` is non-empty.

### M2 — No synthetic/real ת"ז introduced anywhere
**Rule:** The fix does NOT substitute a fake ת"ז (e.g. `123456782`) into the payload, logs, or comments-as-data. No ID value is sent.
**Evidence:** diff — fields removed, not replaced with a value.

### M3 — No behavior change to the rest of Test 3 or the other tests
**Rule:** `clientName`/`procedureType`/`totalHours` (the fields `createClient` actually requires) are unchanged; the post-create verification (`clientDoc.exists`, `id === caseNumber`) is unchanged. Tests 1 and 2 untouched.
**Evidence:** `git diff` shows only the two removed lines + a comment inside the one `testData` literal.

### M4 — Lint clean (no NEW errors)
**Rule:** `eslint apps/user-app/js/validation-script.js` reports 0 errors (pre-existing `no-console` warnings unchanged at 27).
**Evidence:** baseline = 27 warnings / 0 errors; post-edit = 27 warnings / 0 errors. `lint-staged` (`eslint --fix`) passes on commit.

### M5 — Scope discipline
**Rule:** The diff touches ONLY `apps/user-app/js/validation-script.js` and this rubric.
**Evidence:** `git diff --stat main..HEAD`.

## SHOULD criteria (warning on FAIL)

### S1 — Rationale comment present
**Rule:** A comment at the removal site explains WHY (the #348 validation + `idNumber` optional + `idType` unread + the don't-write-a-ת"ז-to-live-DB reason) so a future editor does not re-add the fields and re-break the harness.
**Evidence:** 6-line comment added in place of the two removed lines.

## PRODUCT-GRADE GATES

- **G1 — Customer-visible errors:** N/A — output is developer `console.*` in a browser-console diagnostic; never a customer code path. No customer-facing error string is added or changed (the `createClient` Hebrew errors from #348 are unchanged).
- **G2 — Rollback:** PASS — `git revert <merge-commit>` + push; code-only, no deploy/migration/data to undo. Documented in Rollback below.
- **G3 — Monitoring:** N/A — this PR adds/changes no write path. The underlying `createClient` mutation and its server-side logging are untouched; the diff only removes two fields from a test payload.
- **G4 — Test proves the scenario:** N/A (manual) — the harness is browser-console-only and by design never runs in CI; there is no automated test surface for it and adding one is out of scope. Manual smoke documented in Test plan (run `ValidationScript.runAll()` in a DEV browser console; Test 3 must now PASS instead of throwing `invalid-argument`).
- **G5 — Hebrew UI:** N/A — no customer-facing strings changed. The only added text is an English code comment (explicitly allowed by G5).
- **G6 — Breaking change:** PASS (none) — removes an OPTIONAL field (`idNumber`) and an IGNORED field (`idType`) from a dev test payload; the `createClient` contract is unchanged. No schema/API/route/return-shape change.
- **G7 — Security review:** PASS — this PR strictly **reduces** PII surface: it removes an ID-like value from a payload in a PUBLIC repo so no ת"ז (real or synthetic) is sent, written to the live DB, or at risk of being logged. No auth/permissions/PII-storage logic touched. Net surface decreases.

VERDICT: PASS — Lead Agent self-assessment (2026-06-03): M1-M5 PASS, S1 PASS, gates G1/G3/G4/G5 N/A (justified) + G2/G6/G7 PASS, zero blocking issues. Root cause verified against `functions/clients/index.js:106-115` + `functions/shared/validators.js`. **No separate outcomes-grader agent run** — Haim explicitly waived the Feature Protocol cycle for this LIGHT dev-tooling fix (§3.8.3 tiny-change exemption); the verdict rests on mechanically verifiable facts (lint 0 errors, 2-line removal, confirmed backend guard).

## Rollback
```bash
git revert <merge-commit>
git push origin main
```
Code-only (a single dev-diagnostic file). No data migration, no deploy dependency. Reverting restores the prior payload (which would re-break Test 3 against the #348 backend — so revert only if the removal itself is the problem).

## Test plan
**Static:** `eslint apps/user-app/js/validation-script.js` → 0 errors. `git diff --stat main..HEAD` → only this file + rubric.
**Manual (DEV browser console, optional — creates a real test client):** load the User App in DEV, open the console, run `await ValidationScript.runAll()`. Pre-fix: Test 3 throws `invalid-argument` / "מספר תעודת הזהות אינו תקין". Post-fix: Test 3 logs "✅ Client created successfully!" and the verification (`id === caseNumber`) passes.

## Notes for grader
- This is a **spun-off dev-tooling task** (deferred from Pre-H.1.0b / PR #353 at Haim's 2026-06-03 checkpoint), NOT a numbered Phase-1/2 PR. No MASTER_PLAN row is added (§11 requires Haim approval for new rows); §8.2.5 already tracks the Pre-H.1.0 family.
- devils-advocate NOT invoked: not a §3.8.4 high-stakes trigger (no `firestore.rules`/schema/PROD-merge/>100-line refactor/migration/new claim writer/new PII surface). Flag if you disagree.
- The harness still creates a REAL client in the live DB on each Test-3 run — that is pre-existing, intended diagnostic behavior, left unchanged by this fix.
