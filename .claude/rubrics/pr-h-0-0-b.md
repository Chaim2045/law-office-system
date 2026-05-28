# Rubric — Pre-H.0.0.B

**Title:** Admin-claim endpoint lockdown — TS port + dual-write + audit-first
**Branch:** `feat/pre-h-0-0-b-admin-claims-lockdown`
**Base:** `main`
**Scope:** Close the most acute security hole in the codebase: the public `setAdminClaims` HTTPS endpoint with zero auth. Replace three admin-claim entry points with a hardened TS implementation:
  1. `setAdminClaims` (was `onRequest`, unauthenticated) → v2 `onCall` with dual-shape admin gate, Zod input, audit-first / claim-second, self-elevation blocked, written in `functions/src-ts/`.
  2. `initializeAdminClaims` (was `onCall` but skipped admin check — any logged-in user could re-promote) → v2 `onCall`, admin-gated, lock-doc, idempotent.
  3. `setAdminClaim` (legacy singular, was using undefined `logActivity`) → keep legacy JS but fix the crash bug, add self-elevation block, dual-write `{admin:true, role:'admin'}` on grant. Out-of-scope: revoke flow stays as `{admin:false}` for now.

This is the FIRST production PR using the `functions/src-ts/` TS infrastructure landed by PR-META-6.

## MUST criteria (block on FAIL)

### M1 — Legacy `setAdminClaims` HTTP endpoint REMOVED
**Rule:** The `functions.https.onRequest` handler at `functions/auth/index.js:329-353` (pre-PR) is deleted. The export wiring in `functions/index.js` now routes `setAdminClaims` to the compiled TS module under `./lib/`. The vulnerability is closed.
**Evidence required:** `git diff main..HEAD -- functions/auth/index.js` shows the deletion. `functions/index.js` requires `./lib/set-admin-claims`. No `onRequest` remains for this endpoint.

### M2 — New TS `setAdminClaims` is admin-gated (dual-shape)
**Rule:** The new v2 `onCall` in `functions/src-ts/set-admin-claims.ts` rejects: (a) unauthenticated → `unauthenticated`, (b) non-admin → `permission-denied`. Admin check accepts BOTH `{role:'admin'}` and `{admin:true}` token shapes.
**Evidence required:** Source contains `claims.role === 'admin' || claims.admin === true`. Tests assert both legacy and canonical shapes are accepted; non-admin rejected.

### M3 — Self-elevation BLOCKED everywhere
**Rule:** In all three endpoints (new TS x2 + legacy singular), `callerUid !== targetUid` is enforced. Self-elevation attempt → `permission-denied` Hebrew error. Claim NOT written.
**Evidence required:** Each endpoint has the self-elevation check. Test asserts claim mock not called when caller === target. Hebrew message present.

### M4 — Zod input validation on the new endpoints
**Rule:** `setAdminClaims` requires `{targetUid: string(20-128), role: 'admin'}` via `.strict()` schema. Missing field, wrong role, short UID, extra fields → `invalid-argument`.
**Evidence required:** `z.object(...).strict()` in source. Tests assert each rejection case.

### M5 — Audit FIRST, claim SECOND, compensating-doc on failure
**Rule:** `audit_log` doc is written BEFORE `setCustomUserClaims`. If audit write fails → claim NOT written, `HttpsError('internal')` thrown. If claim write fails after audit succeeded → compensating audit doc is attempted (best-effort).
**Evidence required:** Source order. Tests assert (a) audit failure aborts the claim, (b) claim failure triggers a second audit write.

### M6 — Dual-write claim shape on grant
**Rule:** Every grant path writes the literal `{admin: true, role: 'admin'}`. This preserves `apps/admin-panel/js/core/auth.js:424` which reads `claims.admin === true` while also satisfying `firestore.rules` which reads `token.role`.
**Evidence required:** Static AST test asserts the dual-shape literal exists in both new TS files. Runtime test asserts `mockSetCustomUserClaims` is called with the dual shape.

### M7 — `initializeAdminClaims` is admin-gated AND idempotent AND locked
**Rule:** (a) Admin check before scanning employees (CRITICAL — legacy version explicitly skipped this). (b) Per-employee idempotency: if existing claim already dual-shape, skip without re-write. (c) Lock doc at `system/admin_claims_init_lock` with 5-min TTL prevents parallel runs.
**Evidence required:** Source has admin check before the lock acquire. Source has `alreadyGranted` check. Tests assert: non-admin rejected, fresh lock blocks, stale lock overridden, parallel call protection.

### M8 — `initializeAdminClaims` prefers `employees.authUID` over email lookup
**Rule:** When an employee doc has `authUID`, use `auth.getUser(authUID)`. Only fall back to `auth.getUserByEmail` when `authUID` is missing, and emit `admin_claims.initialize.email_fallback` warning when doing so (per devils-advocate concern about email drift).
**Evidence required:** Source has the conditional. Tests assert email-fallback path is taken only when authUID absent and the warning log is emitted.

### M9 — Legacy `setAdminClaim` (singular) bug fix + dual-write
**Rule:** The undefined `logActivity(...)` call (was a latent crash) is replaced by `logAction(...)` from `shared/audit.js`. Grant path writes dual-shape `{admin:true, role:'admin'}`. Revoke path preserves legacy `{admin:false}`. Self-elevation blocked.
**Evidence required:** Diff shows `logActivity` removed and `logAction` used. Diff shows `newClaims = isAdmin === true ? {...dual...} : {admin:false}`. Self-elevation check present.

### M10 — Hebrew customer-visible errors (G1, G5)
**Rule:** Every `HttpsError` thrown to the caller has a Hebrew message with an actionable suggestion. No raw FirebaseError leaks, no English error strings, no stack traces.
**Evidence required:** Grep diff for `HttpsError(`, every match has Hebrew text.

### M11 — Structured logging via `shared/logger` shim (G3)
**Rule:** New TS files use `require('../shared/logger')` (via the `.d.ts`-typed import). No `console.*` calls. Success and failure paths have structured logs with `actor.uid` (NOT email — PUBLIC-repo PII discipline).
**Evidence required:** ESLint `no-restricted-syntax` rule passes (0 console.* calls). `logger.info`/`.warn`/`.error` calls present at the audit-success / failure points.

### M12 — Test coverage proves the customer scenarios (G4)
**Rule:** Tests under `functions/src-ts/__tests__/` exercise: unauthenticated, non-admin, dual-shape admin acceptance, self-elevation, Zod validation, target-user not found, audit-failure abort, claim-failure compensating doc, dual-shape claim literal, idempotency, lock contention, email fallback.
**Evidence required:** `npm run test:ts` passes 100% (3 suites, ≥45 tests). Static AST guards + runtime mocks both exist for both new files.

### M13 — Build artifacts (`functions/lib/`) committed
**Rule:** Per checkpoint decision, the compiled TS output ships with the PR (no `predeploy` hook). `functions/lib/set-admin-claims.js` and `functions/lib/initialize-admin-claims.js` exist in the diff and match `npm run build:ts` output bit-for-bit.
**Evidence required:** Files exist. `npm run build:ts && git diff functions/lib/` is empty (clean rebuild matches commit).

### M14 — G7 security agent grep documented in PR body
**Rule:** Pre-PR security verification: `firestore.rules` + `storage.rules` have ZERO `token.admin` reads (confirmed via grep). Admin-panel `auth.js:424` is the lone consumer of legacy `{admin:true}` — dual-write justified by this consumer; cleanup deferred to a separate PR.
**Evidence required:** PR body documents the grep + cites the lone consumer. Security agent verdict referenced.

### M15 — Recovery playbook + emergency script
**Rule:** `docs/ADMIN_CLAIMS_RECOVERY.md` exists with three recovery paths (Firebase Console / local script / Firestore restore). `functions/scripts/grant-admin-emergency.js` exists, defaults to dry-run, refuses to run without `--apply`, uses gitignored service-account JSON.
**Evidence required:** Both files exist. Recovery doc has the three paths + verification step. Script enforces `--apply` flag.

## SHOULD criteria (warning on FAIL, doesn't block)

### S1 — System map updated
**Rule:** `SYSTEM_MAP.md` lines 49, 58, 535-537 reflect the new endpoint location + type (`callable (v2)` not `http`).
**Evidence required:** Diff touches `SYSTEM_MAP.md`.

### S2 — Stale comments in `apps/admin-panel/js/core/auth.js` refreshed
**Rule:** Comments at lines ~420, 435, 439, 456 referencing "set-admin-claims.js script" (a script that never existed) are updated to point at the canonical callable.
**Evidence required:** Diff touches those comment lines.

### S3 — Engineering Bar compliance documented
**Rule:** PR body lists the META-6 Engineering Bar items this PR clears (strict TS, ESLint 0 errors, logger shim, Zod, v2 callables).
**Evidence required:** PR body has a "META-6 Engineering Bar clearance" section.

## Out of scope

What this PR explicitly does NOT do (grader: do NOT downgrade for absence):

- Cleaning up `apps/admin-panel/js/core/auth.js:424` `claims.admin === true` consumer — deferred to a separate post-merge PR once all writers are dual-shape and a grep across User App + rules confirms the legacy field is unused.
- Adding `partner` claim handling — handled by future Pre-H.0.0.D / E / F (`isPartner()` helper, claim shape consolidation, `syncRoleClaims`).
- Adding `logCriticalAction` audit primitive that throws on audit-write failure — handled by future Pre-H.0.0.C. This PR uses a local `writeAuditOrThrow` helper that bridges the gap.
- Migrating the legacy `setAdminClaim` (singular) to TS — out of scope. Only the latent crash bug + dual-write on grant are fixed.
- Adding `employee_costs` collection — handled by future Pre-H.0.0.G.
- Removing the legacy `{admin:true}` claim shape across all users — requires a separate migration PR after this PR's dual-write has propagated.

## Rollback

If this PR lands in DEV and behaves unexpectedly:

1. `git revert <merge-commit-of-commit-B> && git revert <merge-commit-of-commit-A>` on `main`.
2. Redeploy functions: `firebase deploy --only functions:setAdminClaims,functions:initializeAdminClaims,functions:setAdminClaim`.
3. The revert restores the legacy JS code paths AND removes the new TS handlers from the deployed surface (because `functions/index.js` `require('./lib/...')` references go away with the revert).
4. The committed `functions/lib/*.js` artifacts come back to the legacy state automatically — no extra build step needed.
5. **CAUTION:** revert restores the original vulnerability (`setAdminClaims` unauth'd HTTP endpoint). Disable it manually via Firebase Console BEFORE deploying the revert if the bug is being actively exploited.

## Test plan (G4)

Automated (this PR):
1. `npm run test:ts` → 51 tests across 3 suites, all pass.
2. `npm run lint` → 0 errors on new TS files.
3. `npm run typecheck:ts` → 0 errors.
4. `npm run build:ts` → produces `functions/lib/` that matches the committed artifacts.

Manual smoke (DEV, post-deploy):
5. From DEV admin panel browser console (logged in as Haim — already admin):
   ```js
   const setClaim = firebase.functions().httpsCallable('setAdminClaims');
   await setClaim({ targetUid: '<some-test-uid>', role: 'admin' });
   ```
   Verify dual-shape claim written + audit_log entry exists.
6. Repeat the call with `targetUid` = Haim's own UID → expect `permission-denied`.
7. Log out, attempt to call `setAdminClaims` from an anonymous browser session → expect `unauthenticated`.
8. Run `initializeAdminClaims` from admin console → verify idempotency (re-run yields all "already_granted").
9. Run `verifyClaims` (from PR-H.0.0.A) → confirm `claimShapeBreakdown.both_shapes` ≥ existing admins.

## Notes for grader

- This PR INTENTIONALLY does dual-write (`{admin:true, role:'admin'}`) even though `firestore.rules` only reads `token.role`. The reason: `apps/admin-panel/js/core/auth.js:424` reads `claims.admin === true`. Cleaning that consumer up + retiring the legacy field is a separate PR after all writers are converged.
- The PR deliberately does NOT touch `partner` claim handling. The current state (no partner claim writer exists) is correct for this scope; partner claim work begins with Pre-H.0.0.D.
- `functions/lib/` is committed by design (checkpoint decision). The first TS PR sets the precedent. If a future PR adds a `predeploy: npm run build:ts` to `firebase.json`, the committed artifacts become redundant but not harmful.
- The legacy `setAdminClaim` (singular) was carrying a latent crash bug (`logActivity` undefined). The fix is included here because we touched the function anyway for the dual-write change.
- The `writeAuditOrThrow` helper duplicates a small slice of `shared/audit.js#logAction` because the canonical helper swallows errors (correct for non-critical paths, wrong for admin-claim grants). Pre-H.0.0.C will formalize this as `logCriticalAction`.
