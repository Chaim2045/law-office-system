# Rubric — Pre-H.1.0b (UI, User App): optional check-digit-validated `idNumber` (ת"ז) at client creation

**Title:** Capture an **optional**, check-digit-validated `idNumber` (ת"ז) in the LIVE User-App client-creation wizard — the UI producer for the cross-system join key (MASTER_PLAN §8.2.5). Backend half merged in #348 (Pre-H.1.0a).
**Branch:** `feat/pre-h-1-0b-idnumber-userapp`
**Base:** `main`
**App / Env:** User App (frontend) / DEV. No deploy in this PR.
**Effort:** MEDIUM (effort-scaler verdict 2026-06-03).

**Scope (Option A — approved at checkpoint 2026-06-03 over the devils-advocate STOP on `required`):**
- New `apps/user-app/js/modules/israeli-id.js` — exact frontend mirror of backend `isValidIsraeliId()` (check-digit + zero-pad), with a `window.IsraeliId` global (for the classic-script dialog) and an ESM `export` (for tests). NOT compiled to `dist` (hand-written module, served directly, like `tz-helper.js`).
- `apps/user-app/js/modules/case-creation/case-creation-dialog.js`:
  - New **optional** ת"ז `<input id="newClientIdNumber">` in `#step1_newClient` (no `*` required marker).
  - `validateCurrentStep()` (new/step-1): **validate-if-present** — if the user typed a ת"ז it must pass `window.IsraeliId.isValidIsraeliId`, else a Hebrew error; empty → allowed (no regression).
  - `collectFormData()` → `formData.client.idNumber`; `buildFirebaseData()` → `data.idNumber` (trimmed, default `''`).
- `apps/user-app/index.html` — load `israeli-id.js` before the dialog.
- `apps/user-app/js/schemas/index.ts` — reconcile the orphaned `idNumber` validator from `/^\d{9}$/` to a self-contained check-digit `.refine()` (corrected Hebrew message). **Documentation/drift-guard only** — this schema is NOT loaded at runtime; the runtime validator is `israeli-id.js`. `dist` intentionally NOT rebuilt (orphaned artifact; see Notes).
- Tests (root Vitest, run in CI): a cross-language drift-guard (frontend ≡ backend 11 vectors) + a PII source-guard over the dialog.

**Explicitly DEFERRED (documented, tracked, NOT in scope):** `required` enforcement + an `idType` model (ת"ז/passport/ח.פ.) with backend support; the `validation-script.js` browser harness fix (broken by #348 — Haim chose to defer); `clients` read-access tightening (G7); the Admin `SimpleClientDialog` unvalidated bypass; the ~127-doc backfill; the WhatsApp echo; the `logger.js` Error-branch sanitize hardening; frontend `dist` hygiene.

## MUST criteria (block on FAIL)

### M1 — `israeli-id.js` is an exact behavioral mirror of backend `isValidIsraeliId`
**Rule:** Pure module: type-guard (non-string → false), `/^\d{1,9}$/` after trim, `padStart(9,'0')`, all-zeros guard, weights `1,2,1,2…` with `-9` fold, `sum % 10 === 0`. Exposes `window.IsraeliId.isValidIsraeliId` + ESM export.
**Evidence:** `tests/unit/user-app/israeli-id-drift-guard.test.ts` — the same 11 vectors as backend `functions/tests/israeli-id-validator.test.js` (valid `123456782`, zero-pad `00000018`/`000000018`, wrong `123456789`, all-zeros, sentinels `SYSTEM-INTERNAL`/`TEST-…`, non-digit, >9 digits, empty, non-string) all agree. Green in CI.

### M2 — Optional, validate-if-present, in the LIVE validator + payload
**Rule:** ת"ז is **optional**. If non-empty it must pass the check-digit (Hebrew `invalid` message, value NOT echoed) before step advance; if empty/blank the wizard proceeds exactly as today (no regression). When provided+valid it is wired through `collectFormData` → `buildFirebaseData` → `createClient` as `idNumber` (trimmed). When absent → not sent (backend defaults `''`).
**Evidence:** diff of `validateCurrentStep` new/step-1 (validate-if-present block), `collectFormData` (`formData.client.idNumber`), `buildFirebaseData` (`data.idNumber`). Manual-smoke steps in the PR body (DOM-bound).

### M3 — NO `required`, NO regression on existing intake
**Rule:** No `*`/required marker; no path blocks creating a client without a ת"ז. Corporate (ח.פ.) / foreign (passport) clients can still be created (the live-data driver for Option A: ≥2 of 139 clients are companies/nonprofits). The field is purely additive.
**Evidence:** `git diff` shows no required gate; the validate block is guarded by `if (idNumber)`.

### M4 — ת"ז value never reaches logs (frontend PII guard)
**Rule:** No `console.*` / `Logger.*` call in `case-creation-dialog.js` carries an `idNumber` / `formData` / `firebaseData` value. (`logger.js` prod override nulls only `console.log/info/debug`; `console.error/warn/group/trace` survive — so a raw form/error dump would leak ת"ז in a PUBLIC-repo prod console.)
**Evidence:** `tests/unit/user-app/idnumber-pii-guard.test.ts` — static source-scan (comment-stripped) + positive-control. Green in CI.

### M5 — Cross-language drift-guard actually runs in CI
**Rule:** The drift-guard lives in `tests/unit/user-app/` (root Vitest) so `pull-request.yml` Job `test` (`npm test`) executes it on every PR; it pins BOTH `israeli-id.js` AND `ClientSchema` to the backend's 11-vector verdicts.
**Evidence:** test file path + a local `npm test` run showing it execute and pass.

### M6 — No scope creep
**Rule:** Diff touches ONLY: `israeli-id.js`, `case-creation-dialog.js`, `index.html`, `schemas/index.ts`, the 2 new test files, and this rubric. No `firestore.rules`, no backend, no migration, no `dist`, no `validation-script.js`, no unrelated files.
**Evidence:** `git diff --stat main..HEAD`.

### M7 — Lint + type-check clean
**Rule:** `npm run lint` → 0 errors; `npm run type-check` (tsc --noEmit) → 0 errors.
**Evidence:** command output, exit 0.

## SHOULD criteria (warning on FAIL)

### S1 — Honest framing of the orphaned Zod
**Rule:** PR body states the Zod reconciliation is documentation/drift-guard (schema not loaded at runtime), the real validator is `israeli-id.js`, and `dist` is intentionally not rebuilt — with reason.

### S2 — Deferred follow-ups enumerated
**Rule:** PR body lists every deferred item (required+idType, harness, read-access, bypass, backfill, WhatsApp, logger Error-branch, dist hygiene) so nothing is silently dropped.

### S3 — Immutability surfaced to the user
**Rule:** Because ת"ז is immutable after creation (backend `updateClient` rejects it), the field has helper text or placeholder making clear it should be entered correctly (mitigates the "wrong once = stuck" trap). (SHOULD — nice-to-have UX.)

## PRODUCT-GRADE GATES

- **G1 — Customer errors:** PASS — invalid ת"ז → Hebrew `"מספר תעודת הזהות אינו תקין"` inline (pre-submit), value never echoed; the backend rejection is a Hebrew toast backstop. No stack/`undefined`/English.
- **G2 — Rollback:** PASS — `git revert <merge-commit>` + redeploy. Code-only, additive optional field; nothing to migrate.
- **G3 — Monitoring:** N/A — no NEW data-write path (the existing `createClient` success log/audit is preserved; ת"ז deliberately NOT logged — that is correct posture, M4). The field rides the already-monitored create call.
- **G4 — Customer-scenario test:** PASS — drift-guard (valid accepted, invalid/wrong-check rejected with Hebrew, 8-digit zero-pad accepted, empty allowed) runs in CI; DOM-bound wizard interactions covered by documented manual-smoke in the PR body.
- **G5 — Hebrew UI:** PASS — field label + error message Hebrew (`"תעודת זהות"`, `"מספר תעודת הזהות אינו תקין"`).
- **G6 — Breaking change:** PASS (none) — purely additive optional field; no existing flow changes; `required` explicitly NOT introduced.
- **G7 — Security review:** PASS — `security-access-expert` reviewed (investigation): no `firestore.rules` change, no new reader, `clients` read already all-authenticated (unchanged); the only new PII channel is the form/console, closed by M4. Read-access tightening + the SimpleClientDialog bypass are real but DEFERRED + flagged.

VERDICT: (filled by grader)

## Rollback
```bash
git revert <merge-commit>
git push origin main
```
Code-only. No data migration. No PROD deploy in this PR.

## Test plan
**Automated (CI, root Vitest):** `npm test` → drift-guard (frontend ≡ backend 11 vectors, both `israeli-id.js` and `ClientSchema`) + PII source-guard. Full suite green (regression).
**Manual smoke (DEV, documented in PR body — DOM-bound, not auto-covered):**
1. New client + valid ת"ז (`123456782`) → advances + client created with `idNumber`.
2. New client + invalid ת"ז (`123456789`) → inline Hebrew error, blocked before submit.
3. New client + NO ת"ז → advances + creates (no regression; corporate/foreign intake preserved).
4. New client + 8-digit ת"ז (`00000018`) → accepted (zero-pad parity).

## Notes for grader
- **Option A** (optional) was Haim-approved at the 2026-06-03 checkpoint over the devils-advocate **STOP** on `required` (3 criticals: `required` silently breaks corporate-ח.פ./foreign-passport intake — verified live: ≥2/139 clients are companies; `required` incoherent without an absent `idType` model; PII console-survival gap). `required` + `idType` is deferred to a designed PR with backend support.
- The Zod change is on an **orphaned** schema (no runtime loader; grep: no HTML loads `dist/.../schemas/index.js`). It is delivered for contract/drift-guard correctness; the runtime enforcement is `israeli-id.js` via `validateCurrentStep`. `dist` is intentionally not rebuilt (the repo already tolerates dist drift; rebuilding would churn an unloaded artifact + sweep unrelated pre-existing drift).
- The check-digit appears in two places (`israeli-id.js` + the Zod `.refine()`); this controlled duplication is **pinned by the drift-guard test**, which asserts both agree with the backend's canonical 11 vectors — a stronger guarantee than a fragile cross-build-boundary import (classic-script dialog ↔ ESM schema ↔ CJS backend).
