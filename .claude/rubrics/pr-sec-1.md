# Rubric — PR-SEC-1 (signed-URL access for fee agreements — ADDITIVE half)

**Title:** feat(security): admin-gated getFeeAgreementUrl callable + cases/ storage rule (additive)
**Branch:** security/fee-agreement-signed-url-pr-sec-1
**Base:** main
**Scope:** The ADDITIVE half of a Haim-approved 2-PR remediation of the world-readable
fee-agreement PDF vulnerability (signed PDFs were `makePublic()`-ed → permanent public
ACL that bypasses storage.rules). This PR adds — but does NOT yet wire in — a new
admin-gated v2 TS callable `getFeeAgreementUrl` that mints a SHORT-LIVED (15 min) V4
signed URL on demand, derived from the agreement's server-stored `storagePath`; plus a
`cases/{caseId}/agreements/` storage.rules block (defense-in-depth mirror of the clients/
block). NOTHING calls the callable yet; the upload paths still `makePublic()`; existing
public URLs still work. The cutover (frontend switch + makePublic removal + ACL-revocation
migration) is PR-SEC-2.

## MUST criteria (block on FAIL)

### M1 — Admin-only, role-canonical gate
**Rule:** The callable rejects unauthenticated, non-admin, AND the legacy `admin:true`-only token; admits only `claims.role === 'admin'`.
**Evidence:** `functions/src-ts/fee-agreements/get-fee-agreement-url.ts` auth block; tests "auth gates" (4 cases) pass.

### M2 — IDOR-safe + confused-deputy-safe path resolution
**Rule:** The `storagePath` signed is RESOLVED server-side from the named doc's `feeAgreements[]` by matching `agreementId` — never a caller-supplied path. `entity` is allowlisted to `{clients, cases}`; ids are charset-bounded (blocks `.doc()` traversal). AND the resolved path is pinned to `${entity}/${entityId}/agreements/` before signing — because the Admin SDK bypasses Storage rules and `feeAgreements[]` is admin-writable via the client SDK (not in RESTRICTED_KEYS / clientAggregateKeys), a poisoned in-doc `storagePath` could otherwise make the CF sign an arbitrary bucket object (devils-advocate 🔴 — mirrors `verify-signature-presence.ts:227-240`).
**Evidence:** Zod `.strict()` schema + `list.find(a => a.id === agreementId)` + `expectedPrefix`/`startsWith` guard (`failed-precondition`); tests "input validation" + "happy path signs the STORED storagePath" + "not found / IDOR contract" (incl. 2 poisoned-path cases: cross-tenant `clients/9999/...` and arbitrary `private/...` both rejected, NO sign).

### M3 — Short-lived signed URL, no public ACL
**Rule:** Issues a V4 `action:'read'` signed URL with TTL ≤ 15 min. No `makePublic` anywhere in the new code.
**Evidence:** `SIGNED_URL_TTL_MS = 15*60*1000`; static AST guard "signs a v4 READ url (not a long-lived public url)" + "TTL is short".

### M4 — Non-PII access audit as disclosure precondition (fail-secure)
**Rule:** Every issuance writes `logCriticalAction('GET_FEE_AGREEMENT_URL', uid, {entity, entityId, agreementId, found})` (no name/ת"ז/amounts). If the audit write fails, NO URL is minted.
**Evidence:** audit block precedes signing; tests "audits the issuance" + "FAIL-SECURE: audit write failure → internal, NO url minted".

### M5 — No PII / secret / raw error in logs
**Rule:** No PII value, secret, or `error.message`/`.stack` reaches `logger.*`. Failures log errorCode only.
**Evidence:** static AST guards "NEVER passes PII…" / "NEVER logs raw error.message/.stack"; runtime "no PII in logs" scan.

### M6 — Additive / non-breaking
**Rule:** No existing behavior changes: no consumer is wired to the callable, the upload paths still produce working URLs, no Firestore data is mutated (beyond the audit_log entry). Existing tests stay green.
**Evidence:** `git diff` = new files + `index.js` export wiring + storage.rules cases block only; full functions suite 976/976 green.

### M7 — storage.rules cases/ block mirrors clients/ (admin-only)
**Rule:** `match /cases/{caseId}/agreements/{fileName}` grants read/write/delete to `isAdmin()` only, identical to the clients/ block, with an audit comment (who/when/why).
**Evidence:** `storage.rules` cases block diff.

## SHOULD criteria (warning on FAIL)

### S1 — Mirrors the canonical v2 TS callable pattern
**Rule:** Structure mirrors `functions/src-ts/tofes-mecher/validate-sales-record.ts` (handler exported for tests, REGION from config, Hebrew HttpsError, logCriticalAction-as-precondition).
**Evidence:** side-by-side structure.

### S2 — lib/ compiled + committed
**Rule:** `functions/lib/fee-agreements/get-fee-agreement-url.js` committed (per the project's commit-lib decision); unrelated lib drift NOT swept in.
**Evidence:** `git status` shows only the new lib file; `build:ts` exits 0.

### S3 — Dual AST + runtime test pattern
**Rule:** Tests include static-source AST invariants AND mocked-runtime behavior (mirrors verify-claims/validate-sales-record).
**Evidence:** 22 tests, two describe groups.

## Out of scope (deliberately deferred to PR-SEC-2 / supervised steps)

- Removing `makePublic()` from the two upload paths (`functions/fee-agreements/index.js:119`, `functions/src/whatsapp-bot/WhatsAppBot.js:1905`) — PR-SEC-2.
- Switching the frontend `ClientManagementModal.viewFeeAgreement` to call the callable — PR-SEC-2.
- The one-time ACL-revocation migration (`makePrivate` on existing objects) + nulling the stored `downloadUrl` — PR-SEC-2 ships the script; `--apply` is a supervised step (Haim's hands).
- A storage-rules emulator test harness — none exists in the repo (firebase.json has firestore+auth emulators only; `tests/rules/` is firestore-only). The cases/ block is a verified 1:1 mirror of the deployed clients/ block; manual emulator smoke is the G4 fallback. Adding a storage-emulator harness would be its own infra PR.

## Rollback

Additive and trivial to undo:
- `git revert <sha>` + `firebase deploy --only functions` (removes the dormant callable) and `firebase deploy --only storage` (restores the prior rules). No data migration in this PR, so no inverse migration needed.

## Notes for grader

- **2-PR split (Haim-approved checkpoint).** PR-SEC-1 is intentionally inert: it adds capability without changing any flow, so the cutover (PR-SEC-2) can deploy the callable, grant IAM, and live-smoke it BEFORE any public URL is removed — avoiding a view-breakage window.
- **Runtime IAM prerequisite (Haim's hands, before PR-SEC-2 cutover):** V4 signing from the CF runtime needs `roles/iam.serviceAccountTokenCreator` on the runtime SA (itself) + `iamcredentials.googleapis.com` enabled. Until granted, `getSignedUrl` fails at runtime (deploy-green/runtime-fail trap) → a supervised live-smoke is mandatory. The handler's sign-failure path returns a Hebrew error and logs errorCode only.
- **G3 framing:** this callable mutates no business data; its only write is the `audit_log` access entry (which carries its own success/failure logging). G3 is satisfied by the audit + logger lines.
- **Specialists consulted (G7):** security-access-expert (vuln confirmed; signed-URL + 15min TTL; IDOR resolve-by-doc; cases/ rule gap; HIGH severity / חוק הגנת הפרטיות) + backend-firebase-expert (signBlob IAM prerequisite; v2 TS; deploy ordering). devils-advocate runs before merge (mandatory — storage.rules change).
