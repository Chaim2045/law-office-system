# Rubric — Pre-H.0.0.F: `syncRoleClaims` + uniform read-merge-write claim discipline

**Title:** Ship `syncRoleClaims` — the role-claim reconciler that writes the first `{role:'partner'}` claims (Haim+Guy) and removes the residual `{role:'lawyer'}` claims — and convert ALL existing role-claim mutators to read-merge-write (the §7.5 no-clobber prerequisite). Closes Phase 1.
**Branch:** `feat/pre-h-0-0-f-sync-role-claims`
**Base:** `main`
**App / Env:** Functions (backend) + Admin Panel (one writer). DEV (`main`). Writes Auth custom claims.
**Effort:** MEDIUM (effort-scaler verdict; 4 parallel investigators + devils-advocate).

**Context:** D defined `isPartner()` (read side, no writer). E closed the claim shape end-to-end (single `{role}`; PROD `verifyClaims` `admin_boolean_only:0`). F is the matched WRITE side: it reconciles each employee's Auth role claim to the `employees.role` SSOT. It is the first-ever `{role:'partner'}` writer and the remover of the dormant `{role:'lawyer'}` escalation (§7.4). Investigation: backend + security (both GO-WITH-CONDITIONS) + data + testing + completeness (2🔴/5🟡/3🟢). Haim checkpoint approved: FULL scope (read-merge-write in all writers), console-only invocation, extend verifyClaims to scan `'lawyer'`.

## MUST criteria (block on FAIL)

### M1 — Reconciles to the SSOT correctly
**Rule:** `sync-role-claims.ts` derives the desired claim from `employees.role` (SSOT): `admin`/`partner` → `{role:<that>}`; every other role → role claim removed. Never derives desired state from the existing Auth claim. Missing `employees.role` → `skipped_no_role` (never blind-clears).
**Evidence:** role-transition tests (grant/no-change/remove/drift/skipped_no_role) in `sync-role-claims.test.ts`.

### M2 — read-merge-write everywhere (no-clobber, §7.5)
**Rule:** A shared pure primitive (`functions/shared/claim-writer.js` `mergeRoleClaim`/`removeRoleClaim`) edits ONLY the `role` field. ALL role-claim mutators of EXISTING users use it: `sync-role-claims.ts`, the v1 `setAdminClaim` grant+revoke (`auth/index.js`), `master-admin-wrappers.js` updateUser. (New-user creators `createUser`/`createAuthUser` keep direct writes — no prior claims to preserve — documented.)
**Evidence:** `claim-writer.test.js` (preserve/remove/no-mutate); the no-clobber runtime tests; the contraction-guard 2a assertion updated to the merge form.

### M3 — DRY-RUN default + strict apply gate
**Rule:** Zod `.strict()`, `apply` defaults `false`; writes happen ONLY on `parsed.data.apply === true` (never truthiness). Non-boolean `apply` → `invalid-argument`.
**Evidence:** dry-run/apply-gate tests (default dry-run; `'true'`/`1` rejected; only `true` writes); static guard asserts `.apply === true` and absence of `apply !== false`.

### M4 — partner-grant gated on messages.toRoles
**Rule:** Before any `apply`, F probes `messages` for `'partner'` (and `'lawyer'`) in `toRoles`. If `partnerCount > 0` and `ackMessagesGrant !== true`, apply ABORTS (`failed-precondition`). Writing `{role:'partner'}` grants immediate read via `firestore.rules` dynamic membership — this gate is load-bearing, not advisory.
**Evidence:** messages-gate tests (abort without ack; proceeds with ack; dry-run not blocked).

### M5 — Audit-FIRST + idempotent + locked
**Rule:** Per employee: `logCriticalAction` BEFORE `setCustomUserClaims`; audit failure ⇒ claim NOT written; claim failure ⇒ compensating audit. No-drift employees produce no write and no audit (idempotent). Lock doc (`system/role_claims_sync_lock`, 5-min TTL) serializes runs; released in `finally`.
**Evidence:** audit-FIRST/ordering/compensating tests; idempotency test (no write, no audit); lock tests (fresh rejects / stale proceeds / released on success + throw).

### M6 — PII-safe
**Rule:** No email (incl. `empDoc.id`) or claim object reaches `logger.*`. Emails/claim values live in `audit_log` only. F is added to the cross-writer PII/admin:true backstop.
**Evidence:** F's own PII static guard; `claim-shape-contraction-guard.test.ts` group (4) includes `sync-role-claims.ts`.

### M7 — Tests + lint + typecheck green; lib rebuilt
**Rule:** Full `functions` suite green; `tsc --noEmit` exit 0; ESLint 0 errors; `lib/` rebuilt for the new TS (`sync-role-claims.js`+`.js.map`; the project sets `declaration:false`, so NO lib `.d.ts` is emitted — the hand-written `shared/claim-writer.d.ts` provides the JS-module typing); export wired in `functions/index.js`.
**Evidence:** `npx jest` 809/809; `tsc` 0; `eslint` 0; `git diff --numstat functions/lib/`.

### M8 — verifyClaims extended to scan 'lawyer'
**Rule:** `verifyClaims` reports `messagesWithLawyerToRoles` alongside the partner scan (observability for what F removes). The `adminBoolean` diagnostic is untouched.
**Evidence:** the new report field + scan block in `auth/index.js`.

## SHOULD criteria

### S1 — Docs reflect F
**Rule:** `PARTNER_CLAIM_DIAGNOSTIC.md` documents F as the actual partner writer + the lawyer scan; `ADMIN_CLAIMS_RECOVERY.md` stale dual-shape line corrected. (MASTER_PLAN §7.5/§7.7/§8.2 status updated post-merge, per the established pattern.)

### S2 — Supervised --apply named
**Rule:** PR body states the first real `--apply` (writing partner to Haim+Guy + clearing lawyer) is a Haim-approved PROD-Auth action (shared project), run after a clean messages probe.

## PRODUCT-GRADE GATES
- **G1 — Customer errors:** N/A — admin-only callable; Hebrew error messages.
- **G2 — Rollback:** PASS — `git revert` + `npm run build:ts`. The claims F writes are reverted by re-running with corrected `employees.role` or a manual claim edit; documented. No schema migration.
- **G3 — Monitoring:** PASS — per-employee `logCriticalAction` audit; structured `logger.info` completion (counts only); `verifyClaims` is the before/after observability.
- **G4 — Customer-scenario test:** PASS — the partner-grant + lawyer-removal + no-clobber + idempotency scenarios are runtime-tested.
- **G5 — Hebrew UI:** N/A — console-only; no customer UI.
- **G6 — Breaking change:** PASS (managed) — additive claim writer; read-merge-write means no existing claim field is clobbered; first partner write is gated + supervised. Existing role claims unchanged unless they drift from SSOT.
- **G7 — Security review:** PASS — security-access-expert GO-WITH-CONDITIONS (all 9 must-guards implemented); devils-advocate MANDATORY (§3.8.4 — new claims writer) run before PR; verdict in PR body.

VERDICT: (filled by grader)

## Rollback
```bash
git revert <merge-commit>
cd functions && npm run build:ts
git add functions/lib && git commit --amend --no-edit   # if lib differs
git push origin main
```
The `--apply` partner/lawyer claim changes (if already run) are reverted by re-running sync after correcting `employees.role`, or a manual Console claim edit (documented in ADMIN_CLAIMS_RECOVERY.md). read-merge-write means revert touches only the `role` field.

## Test plan
**Automated:** `cd functions && npx jest` (809/809 — sync-role-claims runtime matrix + claim-writer pure tests + contraction-guard backstop). `tsc --noEmit` 0. `eslint` 0.
**Supervised (Haim, post-merge — NOT this diff):** (1) deploy verifies `ci-cd-production` Deploy-to-Production green; (2) run `syncRoleClaims` DRY-RUN in PROD, review the plan + the messages probe; (3) confirm `messagesWithPartnerToRoles === 0` (or ack consciously); (4) run `--apply` (Haim-approved); (5) `verifyClaims` confirms Haim+Guy hold `{role:'partner'}` and zero `{role:'lawyer'}` remain.

## Notes for grader
- Scope was Haim-approved at checkpoint (FULL read-merge-write; console-only; extend verifyClaims). The `master-admin-wrappers`/v1-revoke read-merge-write retrofit is IN scope by that decision (completeness 🔴), not silent creep.
- New-user creators intentionally excluded from read-merge-write (no prior claims) — documented in `claim-writer.js`.
- Phase 1 CLOSES on F merge **+ the supervised --apply** (the partner claims must actually be written for §7.7's "partner infrastructure in claim writers" to be satisfied).
