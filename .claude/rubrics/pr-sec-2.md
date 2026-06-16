# Rubric — PR-SEC-2 (signed-URL cutover + ACL-revocation migration)

**Title:** feat(security): cutover fee agreements to signed URLs — remove makePublic + ACL-revocation migration
**Branch:** security/fee-agreement-cutover-pr-sec-2
**Base:** main (after PR-SEC-1 #379 merged)
**Scope:** The CUTOVER half of the 2-PR remediation. (1) Removes `file.makePublic()` + the permanent public `downloadUrl` from BOTH upload paths so NEW signed-PDF uploads are private. (2) Switches the admin viewer (`ClientManagementModal.viewFeeAgreement`) to fetch a short-lived signed URL on demand via the PR-SEC-1 `getFeeAgreementUrl` callable instead of opening a stored public URL. (3) Adds a one-time migration script that revokes the public ACL on EXISTING agreement objects (clients/ + cases/, incl. orphans) and nulls the stale stored `downloadUrl`. The `--apply` run is a SEPARATE supervised step (Haim's hands), AFTER deploy + the getFeeAgreementUrl live-smoke.

## MUST criteria (block on FAIL)

### M1 — makePublic removed from BOTH upload paths
**Rule:** Neither `functions/fee-agreements/index.js` nor `functions/src/whatsapp-bot/WhatsAppBot.js` calls `file.makePublic()` anymore; new uploads stay private.
**Evidence:** the two diffs; AST guard test "does NOT call makePublic()" (both files).

### M2 — No permanent public downloadUrl stored
**Rule:** Neither upload path constructs a `storage.googleapis.com` URL or writes a `downloadUrl` field into the agreement record; `storagePath` is preserved.
**Evidence:** the diffs; AST guard "does NOT store a permanent public downloadUrl" (both files).

### M3 — Viewer fetches a fresh signed URL via the callable
**Rule:** `viewFeeAgreement` calls `getFeeAgreementUrl({entity:'clients', entityId, agreementId})` and opens the returned URL; it no longer reads `agreement.downloadUrl`. Popup-safe (opens the tab inside the click gesture, before the await). Hebrew error on failure.
**Evidence:** `ClientManagementModal.js` diff; AST guard "viewFeeAgreement calls getFeeAgreementUrl, not a stored downloadUrl".

### M4 — Migration is safe (dry-run default, backup, idempotent, per-record)
**Rule:** `revoke-fee-agreement-public-acls.js` is DRY-RUN by default (`--apply` to mutate); writes a durable local JSON backup of the OLD state (rollback key) BEFORE any mutation; `makePrivate()` is idempotent (already-private = no-op); per-record try/catch; batched Firestore writes; NO PII in console.
**Evidence:** the script; `planDocRevocation` unit tests; the gitignored `functions/security-migration-backups/` entry.

### M5 — Old docs stay viewable with zero data backfill
**Rule:** Every existing agreement record already carries `storagePath` (both writers wrote it), so the callable resolves the URL for historical docs without any backfill. Nulling `downloadUrl` does not remove `storagePath`.
**Evidence:** `planDocRevocation` preserves storagePath (test "strips downloadUrl, preserves storagePath"); the callable resolves from storagePath (PR-SEC-1).

### M6 — Tests: pure planner + AST regression guards
**Rule:** Unit tests for `planDocRevocation` (strip/preserve/prefix/garbage/multi) + AST guards locking the leak out (makePublic absent, no downloadUrl stored, viewer uses the callable).
**Evidence:** `functions/tests/revoke-fee-agreement-acls.test.js` — 11 tests pass.

### M7 — No behavior regression
**Rule:** Full functions test suite stays green; the upload flow still stores the agreement record + updates the doc (minus downloadUrl); rendering/badges unaffected (they never used downloadUrl).
**Evidence:** full functions suite green; `renderFeeAgreements`/`ClientsTable`/`ClientsDataManager` use only id/length/meta (verified).

## SHOULD criteria (warning on FAIL)

### S1 — Migration backup is gitignored (no PII committed)
**Evidence:** `.gitignore` `functions/security-migration-backups/` entry (old arrays embed clientId/caseId + storagePath).

### S2 — Migration script is testable (require.main guard + exported pure core)
**Evidence:** `module.exports = { planDocRevocation, expectedPrefix }` + `if (require.main === module)` guard — requiring it does NOT run main / init admin.

### S3 — Popup-blocker-safe viewer
**Evidence:** opens `window.open('', '_blank')` synchronously, sets `.location` after the await; falls back if blocked.

## Out of scope (deliberately deferred / supervised)

- The migration `--apply` execution — a supervised step (Haim's hands), AFTER PR-SEC-2 deploys + getFeeAgreementUrl is live-smoked. This PR ships the SCRIPT only.
- The `roles/iam.serviceAccountTokenCreator` signBlob grant + `iamcredentials.googleapis.com` enable — Haim's PR-SEC-1 runtime prerequisite (gates the live-smoke that in turn gates this PR's merge).
- Restricting client-SDK writes to `feeAgreements` (firestore.rules / client-writer.js) — devils-advocate #2 follow-up. The PR-SEC-1 confused-deputy prefix-pin already neutralizes the read-oracle; this is extra defense-in-depth, tracked separately.
- Storage-rules emulator harness — none exists (pre-existing gap).

## Rollback

- **Code:** `git revert <sha>` + `firebase deploy --only functions` + redeploy admin-panel (Netlify). Restores makePublic + the stored downloadUrl going forward.
- **Migration (if `--apply` was run):** from the backup JSON (`functions/security-migration-backups/revoke-acls-plan-*.json`): re-`set` each doc's `feeAgreements` to `oldAgreements` and `file.makePublic()` each path. NOTE: this re-opens the leak — only do it under a genuine regression, and prefer fixing forward.

## Notes for grader

- **DEPLOY-ORDER GATE (critical):** PR-SEC-2 must NOT merge/deploy until PR-SEC-1's `getFeeAgreementUrl` is live AND live-smoked (which needs Haim's signBlob IAM grant). If PR-SEC-2 deploys before the callable can sign, the admin viewer breaks (G1). PR-SEC-1 is merged + deployed (callable live); the IAM grant + smoke are Haim's pending steps. STOP before merge regardless (Haim merges).
- **Residual-leak window (intended):** after PR-SEC-2 deploys, NEW uploads are private + the viewer uses signed URLs, but EXISTING objects stay public until the supervised `--apply` migration revokes their ACLs. Full closure = PR-SEC-2 deploy + migration `--apply`. This is the approved sequence.
- **G6 breaking change:** the upload callable's returned `agreement` + the stored record no longer include `downloadUrl`. Verified safe — the ONLY reader was `viewFeeAgreement` (now uses the callable); `renderFeeAgreements`/table/badges never read it. Migration plan covers existing docs.
- **Specialists:** security-access-expert (investigation: signed-URL + revoke+null migration) + devils-advocate (MANDATORY — runs before merge; makePublic removal + PROD migration).
