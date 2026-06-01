# Rubric — Phase 2 H.0 (tofes-mecher foundations)

**Scope:** Code scaffolding for the cross-project tofes-mecher bridge: typed config module, concurrency-safe named-app init, an admin-gated connectivity-check v2 callable, mocked tests, docs (Console instructions), MASTER_PLAN §8.2 revision. The actual bridge logic (Pattern A/D) + BigQuery client are deferred to H.1. Console actions (IAM, secret, BQ dataset) are Haim's.

**Branch:** `feat/h-0-foundations-tofes-mecher`. **First PR touching a SECOND Firebase project + first live `defineSecret` usage.**

## MUST (block on fail)

- **M1 — typed config module.** `functions/src-ts/config/index.ts` exports `MAIN_PROJECT_ID`, `TOFES_MECHER_PROJECT_ID='law-office-sales-form'`, `REGION`, `TOFES_MECHER_SA_KEY_SECRET`, `TOFES_MECHER_APP_NAME`, `TOFES_SALES_COLLECTION`, `BIGQUERY_DATASET`. No side effects. Project IDs hardcoded (not env — they're not secrets). Evidence: file + config.test.ts asserting the two project IDs differ.

- **M2 — concurrency-safe named-app singleton (devils-advocate #1).** `tofes-mecher/app.ts` uses a module-level `cachedApp` memo with an `if (cachedApp) return` guard, NOT try/catch-as-control-flow for init. The synchronous `cachedApp = admin.initializeApp(...)` has no `await` before it. Evidence: AST test asserts `let cachedApp` + `if (cachedApp)`; runtime test asserts second call does NOT re-init.

- **M3 — sanitized credential errors (devils-advocate #2, PUBLIC-log leak).** `JSON.parse` + `cert` are wrapped in try/catch that re-throws `TofesMecherCredentialError` (message `'tofes-mecher credential init failed'`) carrying NO input fragment. Evidence: AST test asserts the sanitized re-throw; runtime test passes a `SECRET-FRAGMENT` input and asserts it's NOT in the error message.

- **M4 — NO key / PII / raw error in logs (devils-advocate #2).** Neither callable nor app.ts passes the SA key, `.value()`, `err.message`, or `err.stack` to any `logger.*` call. Failure logs carry actor uid + `errorCode`/`errorName` only. Evidence: AST guards (`logger\.\w+\([^)]*\.message` etc. = 0 matches on stripped code) + a runtime test that serializes ALL logger args across success + read-fail + credential-fail paths and asserts neither `sa-key` nor `SECRET-FRAGMENT` appears.

- **M5 — admin-gated v2 onCall, dual-shape.** `connectivity-check.ts` is `onCall({region, secrets:[TOFES_KEY]})`, gate `claims.role==='admin' || claims.admin===true`. Unauthenticated→`unauthenticated`, non-admin→`permission-denied`. Evidence: runtime tests for all four (unauth/employee/role-admin/legacy-admin).

- **M6 — read-only → logger, NOT logCriticalAction (G3 N/A).** The connectivity check writes nothing; it uses `logger.*`, not `logCriticalAction`. Evidence: AST test asserts no `logCriticalAction` in the source.

- **M7 — Hebrew customer-facing errors (G1, G5).** Every `HttpsError` message is Hebrew + actionable. Evidence: grep — 3 throws (unauthenticated, permission-denied, internal/unavailable), all Hebrew.

- **M8 — collection name is a config const, marked UNVERIFIED (devils-advocate bonus).** `sales_records` is NOT an inline string in the handler — it's `TOFES_SALES_COLLECTION` from config, with a doc comment flagging it unverified. Evidence: connectivity-check imports it; config has the UNVERIFIED comment.

- **M9 — index.js wiring intact + DEPLOY PREREQUISITE documented.** `functions/index.js` adds `exports.tofesMecherConnectivityCheck` via `require('./lib/...')`, retains ALL prior exports, and carries a comment about the secret-before-deploy prerequisite + the repurpose-or-delete-in-H.1 note. Evidence: `node --check functions/index.js` passes; grep shows prior exports present.

- **M10 — docs with Console instructions + placeholders only.** `docs/PHASE_2_FOUNDATIONS.md` exists with: Step-by-step Console actions (datastore.viewer, secrets:set, BQ dataset), the DEPLOY PREREQUISITE, rotation runbook, BQ schema, UNVERIFIED list. NO real SA email, NO key value, NO secret. Evidence: file exists; grep finds no `@law-office-sales-form.iam` literal + no key material.

- **M11 — datastore.viewer not .user (security #1).** Docs + §8.2 specify `roles/datastore.viewer` (read-only), with the over-read project-level caveat documented. Evidence: PHASE_2_FOUNDATIONS.md + MASTER_PLAN §8.2.

- **M12 — BigQuery deferral coherent.** H.0 ships NO `@google-cloud/bigquery` dep and NO BQ client code; the dataset is Console-provisioned + schema-documented. Evidence: `functions/package.json` has no `@google-cloud/bigquery`; docs state the split.

- **M13 — no new CI job (completeness contraction).** No change to `.github/workflows/pull-request.yml`; the mocked tests run in the existing `functions/ npm test`. Evidence: workflow file unchanged in the diff.

- **M14 — §8.2 governance (devils-advocate #5).** MASTER_PLAN §8.2 revised + a §14 plan-revision row added, explicitly classifying the edit as §14 (plan) NOT §15 (bar). Evidence: §14 has the 2026-05-31 H.0 row stating the §14-not-§15 classification.

- **M15 — tests pass, lib committed + matches.** `npm run typecheck:ts` 0 errors; `npm run test:ts` all pass (incl. 24 new H.0 tests); `npm run build:ts` + `git diff functions/lib/` clean; eslint 0 errors on the 5 H.0 files. Evidence: local runs.

## SHOULD (warn on fail)

- **S1 — lazy BigQuery note.** Docs note that when H.1 adds `@google-cloud/bigquery`, it should be lazy-imported (large dep, shared codebase cold-start). Evidence: PHASE_2_FOUNDATIONS.md.
- **S2 — SET_EMPLOYEE_COST redaction carry.** Docs carry the binding obligation that H.1's BQ export must redact the employee-cost audit PII (from Pre-H.0.0.G). Evidence: docs.
- **S3 — UNVERIFIED list complete.** The 6 tofes-mecher unknowns (collection name, field names, customer shape, join key, flat-vs-subcollection, fee semantics) are listed for H.1. Evidence: docs.

## PRODUCT-GRADE GATES

- **G1 errors:** PASS — Hebrew HttpsError, actionable; correlation via logger actor uid.
- **G2 rollback:** PASS — `git revert` + remove the export + redeploy. `defineSecret` leaves no orphaned binding (unreferenced secret is harmless; optional `secrets:destroy`). No data mutation.
- **G3 monitoring:** N/A — read-only connectivity probe, no data write. logger.info on success / logger.error on failure are present for observability.
- **G4 customer test:** PASS — 24 mocked tests (auth gates, credential sanitization, singleton, reachability, no-key-in-logs runtime scan).
- **G5 Hebrew:** PASS.
- **G6 breaking change:** PASS — purely additive (new function + new config + new dir). No existing contract changed.
- **G7 security:** PASS — security-access-expert (4 changes) + devils-advocate MANDATORY (6 changes, cross-project IAM+secrets+new-infra) both consulted; all applied.

## Out of scope (do NOT downgrade for absence)
- The real bridge logic (Pattern A `validateSalesRecordExists`, Pattern D BQ sync) → H.1.
- `@google-cloud/bigquery` dependency + client → H.1.
- Real BigQuery table creation (H.0 documents the schema; Haim creates the empty dataset).
- Confirming the tofes-mecher schema/collection/join-key → blocks H.1, not H.0.
- A real cross-project read in CI (mocked only; real read is a manual smoke).

## Rollback
```
git revert <merge-commit>
firebase deploy --only functions:tofesMecherConnectivityCheck
```
(Optional secret cleanup: `firebase functions:secrets:destroy TOFES_MECHER_SA_KEY`.) No data migration — the bridge only reads, and H.0 reads nothing in CI/tests.

## Notes for grader
- This is the FIRST live `defineSecret` usage in the repo — verify the deploy-ordering prerequisite is documented loudly (a missing secret fails the WHOLE deploy).
- The connectivity-check is intentionally a deployed function (not a local script): only a deployed function exercises the real Secret Manager + cross-project IAM path, which is the whole point of a foundations PR. It's tracked as repurpose-or-delete debt for H.1.
- The most safety-critical claim is M4 (no key in logs). The runtime test serializes every logged arg across all three code paths — verify it actually exercises the credential-failure path with a sentinel string.
