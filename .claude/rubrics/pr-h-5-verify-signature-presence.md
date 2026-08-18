# Rubric — H.5: verifySignaturePresence (AI signature-presence check)

**Scope:** Functions (backend, TypeScript `functions/src-ts/`). Phase 2 H.5 (§8.7).
**App/Env:** Functions · DEV (`main`). **No live consumer until H.6 — ships as PLUMBING.**

**What this PR does:** a NEW admin-gated v2 callable `verifySignaturePresence({clientId, agreementId, collection?})` that downloads a stored fee-agreement document (PDF/image) from Firebase Storage (Admin SDK) and asks Claude whether the page VISUALLY contains a client signature AND a lawyer signature (PRESENCE only, not fraud), returning `{clientSignaturePresent, lawyerSignaturePresent, confidence, reasoning, passed}`. The FIRST Anthropic integration + FIRST Storage read in the codebase.

**Checkpoint-locked (Haim, 2026-06-16):** build as plumbing now; real PII egress gated on H.6 + a DPA. The `makePublic()` world-readable-PDF defect = a SEPARATE remediation track (spawned task), not this PR.

**devils-advocate = MANDATORY** (§3.8.4: new Cloud Function with a PII surface + first external-API egress).

---

## MUST (all required for PASS)

- **M1 — Admin-only gate, role-string only.** The handler rejects unauth (`unauthenticated`) and any non-`role==='admin'` token (`permission-denied`), including a legacy `{admin:true}`-only token. This is the ONLY effective caller gate (the Admin SDK bypasses Storage rules).
  *Verify:* the two `HttpsError` throws at the top of the handler; the test cases for unauth + `{admin:true}`.

- **M2 — AUDIT-FIRST, egress-second (fail-secure).** `logCriticalAction('VERIFY_SIGNATURE_PRESENCE', uid, {clientId, agreementId, collection})` is awaited BEFORE the document is downloaded or sent to Anthropic. If the audit write throws, NO document leaves the system (no download, no model call).
  *Verify:* the order test (`['audit','download','model']`) + the audit-rejects test (download + model NOT called).

- **M3 — No PII / no secret to logs or audit.** The PDF bytes/base64, the model's free-text `reasoning`, the client name, and the API key NEVER reach `logger.*` or the `audit_log` payload. Only uid, business ids, model id, token counts, booleans, errorCode/errorName.
  *Verify:* the PII-guard test (serialized `logger` calls contain none of: base64, reasoning, client name, key) + the audit-payload-shape test.

- **M4 — Trusted source path, charset-bounded input.** Input is Zod `.strict()`; `clientId`/`agreementId` are charset-bounded (block `.doc()` traversal). The document is read from the STORED `feeAgreements[].storagePath` (trusted), never a caller-supplied path and never the public `downloadUrl`.
  *Verify:* the `.strict()` schema + the malformed-id test; the storagePath resolution from the entity doc.

- **M5 — Professional Hebrew errors; sanitized SDK errors.** Every customer-facing throw is Hebrew with a next action (G1/G5); the Anthropic init/call error path logs `errorName` only and never the key or raw SDK message; a bad/missing key surfaces as the sanitized `AnthropicClientError`.
  *Verify:* grep the throws for Hebrew; the SDK-throws test asserts the key is absent from logs.

- **M6 — Derived gate + clamp correctness.** `passed = clientPresent && lawyerPresent && confidence >= SIGNATURE_CONFIDENCE_THRESHOLD`; `confidence` is clamped to `[0,1]` (non-finite → 0). The threshold + model id + max-tokens live in `config/index.ts` (tunable, not magic strings in the handler).
  *Verify:* the passed-true/one-missing/below-threshold/clamp tests; the config consts.

- **M7 — Lazy SDK import; deploy-prerequisite documented; no real egress in tests.** `@anthropic-ai/sdk` is lazy-imported inside the call (not a top-level import). The `ANTHROPIC_API_KEY` deploy-blocking-secret prerequisite + the H.6 DPA privacy gate are documented (PHASE_2_FOUNDATIONS.md + the index.js export comment). Tests mock the SDK boundary — no document egresses in DEV/CI.
  *Verify:* `await import('@anthropic-ai/sdk')` in anthropic-client.ts; the doc section; the test mocks.

## SHOULD

- **S1** — The Anthropic client init is a SHARED reusable helper (`anthropic-client.ts`) so H.8 reuses it (lens-5 recommendation), not inlined.
- **S2** — Structured output (`output_config.format` json_schema) forces the 4-field verdict shape; a non-JSON / malformed model output is handled with a Hebrew `internal` error, not a crash.
- **S3** — Supports both PDF (document block) and image (image block) media types (signed agreements are often photographed), bounded to the upload allow-list.

---

## PRODUCT-GRADE GATES

- **G1 — errors:** PASS. Every throw is Hebrew + next-action; never a raw FirebaseError / SDK message / key / stack; confidence clamped (never NaN); bad model output → Hebrew internal error.
- **G2 — rollback:** PASS — code-only (a CF + config + dep). Rollback = supervised `firebase functions:delete verifySignaturePresence --region us-central1` FIRST (a deployed CF removed from source aborts the CI deploy — the H.1.b lesson), THEN `git revert`. Documented in the PR body.
- **G3 — monitoring:** PASS — the access is recorded via `logCriticalAction` (audit-FIRST, who/which-agreement) + a non-PII `logger.info('signature.verify.completed', {usage, booleans, passed})` success line + `logger.error` (errorCode/errorName) on every failure branch. No Firestore mutation (read-only on app data; the only write is the audit).
- **G4 — customer test:** PASS — 18 ts-jest tests exercise the handler end-to-end with a mocked SDK (the documented pattern for an external-API CF with no live consumer, exactly as validateSalesRecordExists was graded): both-present→passed, one-missing→not-passed, below-threshold, clamp, not-found, auth, audit-first-fail-secure, PII-guard. Plus the documented post-merge supervised live-smoke.
- **G5 — Hebrew UI:** PASS — all customer-facing throws Hebrew; the model is instructed to return a Hebrew `reasoning`.
- **G6 — breaking change:** PASS — purely additive (a new callable + a new config const + a new dep). No field/route/contract/collection removed or changed.
- **G7 — security:** PASS — `security-access-expert` + **devils-advocate** consulted (MANDATORY §3.8.4: new CF + PII surface + first external egress). The verdicts are referenced in the PR body. Closes: admin-only gate, audit-FIRST fail-secure, no-PII/secret-in-logs, trusted-path-only (no public URL, no caller path), lazy import, the DPA privacy gate deferred to H.6 with no real egress shipping now.

---

## Test plan (for PR body)

- `cd functions && npx jest --selectProjects src-ts --testPathPattern verify-signature-presence` → 18/18.
- `cd functions && npx jest` → full suite green (no regression).
- `cd functions && npm run build:ts` → tsc 0 errors; `npx eslint` (root) on the new files → 0 errors.
- **Supervised post-merge live-smoke (Haim's hands — Firebase-auth + a real stored agreement; gated on the `ANTHROPIC_API_KEY` secret being set):** an admin calls `verifySignaturePresence` with a real `{clientId, agreementId}` → receives the two booleans + confidence + Hebrew reasoning + `passed`; an `audit_log` `VERIFY_SIGNATURE_PRESENCE` entry exists (non-PII). **Do this only after the H.6 DPA gate is satisfied** (real PII egress).
