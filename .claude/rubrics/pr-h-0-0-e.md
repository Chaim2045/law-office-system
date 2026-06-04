# Rubric — Pre-H.0.0.E: Admin claim-shape contraction (writers → `{role:'admin'}`)

**Title:** Retire the legacy `{admin:true}` field from all four admin-claim WRITERS so every writer emits the single canonical shape `{role:'admin'}` (revoke → `{}`). Writer-contraction ONLY — consumer reads + auth gates stay (deferred §7.4 follow-up).
**Branch:** `feat/pre-h-0-0-e-claim-shape-contraction`
**Base:** `main`
**App / Env:** Functions (backend) / DEV (`main`). Touches Auth custom-claim WRITE payloads.
**Effort:** MEDIUM (4 writer files + 2 lib rebuilds + 3 test files + 2 docs + this rubric).

**Context (verified — MASTER_PLAN §7.4):** After Pre-H.0.0.B, four writers minted a dual-shape claim `{admin:true, role:'admin'}` (or `{admin:false}` on revoke). The PROD pre-flight `verifyClaims` captured `admin_boolean_only:0, both_shapes:0, role_string_only:11` — **nobody depends on `admin:true` as their sole grant**, so contracting the writers to `role`-only is safe and the data-migration is a no-op (no `migrate-claim-shape.js`). This is the EXPAND-already-done → CONTRACT-writers step of a zero-downtime expand/contract; the consumer `admin:true` reads are removed in a SEPARATE follow-up PR after a token-refresh window (removing them here would strand a not-yet-refreshed legacy token — a §2.0 bar violation).

## MUST criteria (block on FAIL)

### M1 — All four writers emit `{role:'admin'}` only (no `admin:true` write)
**Rule:** Every `setCustomUserClaims` GRANT payload is `{role:'admin'}` with no `admin:true` field, in all four writers: `functions/auth/index.js` (v1 `setAdminClaim`), `functions/src-ts/set-admin-claims.ts`, `functions/src-ts/initialize-admin-claims.ts`, `functions/scripts/grant-admin-emergency.js`.
**Evidence:** `claim-shape-contraction-guard.test.ts` group (1) asserts role-only write + `not.toMatch(setCustomUserClaims(...admin:true))` for each writer. `git grep` shows zero `setCustomUserClaims(... admin: true ...)`.

### M2 — Revoke writes `{}` (full removal), not `{admin:false}`
**Rule:** The v1 `setAdminClaim` revoke branch resolves to `{}` (setCustomUserClaims is a full replace → clears `role` too). The legacy `{admin:false}` object literal is gone from code.
**Evidence:** guard test group (2): asserts the contracted ternary `isAdmin === true ? {role:'admin'} : {}` + `not.toMatch({admin:false})` (comment-stripped source). This is the previously-missing revoke test (§7.4 step 3).

### M3 — Idempotency guards contracted ATOMICALLY with the writers
**Rule:** Both writer-side idempotency checks on the TARGET's existing claims are `role`-only: `initialize-admin-claims.ts` (`existingClaims.role === 'admin'`) + `grant-admin-emergency.js` (`existing.role === 'admin'`). If left as `admin===true && role==='admin'`, every init/break-glass run post-contraction would re-write all `role`-only admins (audit spam + forced token refresh).
**Evidence:** source shows `role`-only checks; `initialize-admin-claims.test.ts` idempotency static-guard asserts presence of `existingClaims.role === 'admin'` and **absence** of `existingClaims.admin === true`; the "only legacy `{admin:true}`" runtime test now expects a `{role:'admin'}` re-write.

### M4 — Auth GATES + consumer reads are UNCHANGED (no scope creep into the deferred follow-up)
**Rule:** The caller-token acceptance gates (`claims.admin === true || claims.role === 'admin'`) in `set-admin-claims.ts:75`, `initialize-admin-claims.ts:69`, the v2 cost callables, `connectivity-check.ts`, the `verifyClaims` gate, AND `apps/admin-panel/js/core/auth.js` are NOT touched. The `verifyClaims` `adminBoolean` diagnostic is preserved.
**Evidence:** `git diff --stat` shows NO change to `apps/admin-panel/**`, no change to the gate lines (the dual-shape token tests at `*.test.ts` "accepts admin via legacy {admin:true} token shape" still pass unchanged). Diff is confined to the four writers + their lib/tests/docs/rubric.

### M5 — lib/ rebuilt for exactly the two changed TS writers
**Rule:** `functions/lib/set-admin-claims.js`(+`.map`) and `functions/lib/initialize-admin-claims.js`(+`.map`) are recompiled and committed; no other `lib/` file has a real content change (line-ending-only churn excluded).
**Evidence:** `git diff --numstat functions/lib/` shows nonzero +/- ONLY for those two `.js` + two `.map`. Build: `npm run build:ts` clean; `tsc --noEmit` exit 0.

### M6 — Tests + lint + typecheck green
**Rule:** Full `functions` Jest suite passes (legacy-js + src-ts projects); the 8 writer-side AST guards updated to the role-only literal; the new cross-writer guard passes; ESLint 0 errors on changed TS; `tsc --noEmit` clean.
**Evidence:** `cd functions && npx jest` → 754/754 pass. `npx eslint <changed>` (run from repo root) → 0 errors. `npx tsc --noEmit --project src-ts/tsconfig.json` → exit 0.

### M7 — PII guard: no email / claim object into `logger.*`
**Rule:** No writer passes an employee email (incl. `empDoc.id`, which IS an email) or a raw claims object into `logger.*` (world-readable; public repo). Forensic identity stays in `audit_log` (`targetEmail`) only.
**Evidence:** guard test group (3) asserts no forbidden token in any `logger.*` call for both TS writers. The pre-existing leak at `initialize-admin-claims.ts` (`email_fallback` warn logged `empDoc.id`) is redacted in this PR (G7 hardening surfaced by the step-6 guard).

## SHOULD criteria

### S1 — Docblocks + recovery docs reflect role-only canonical
**Rule:** The four writer docblocks, `docs/ADMIN_CLAIMS_RECOVERY.md` (Console paste → `{"role":"admin"}`; verify `role_string_only`), and `docs/PARTNER_CLAIM_DIAGNOSTIC.md` (shape attributions) describe the post-E canonical shape while noting the gates still accept legacy for one refresh window.

### S2 — Follow-up + final-verify are named
**Rule:** PR body names (a) the §7.4 FOLLOW-UP PR (remove `auth.js:426` consumer read + gate halves WITH a consumer-rejection test, after ≥1h refresh window) and (b) the supervised final `verifyClaims` at merge-moment confirming `admin_boolean_only` stays 0 (G6 evidence; Haim's hands).

## PRODUCT-GRADE GATES

- **G1 — Customer errors:** N/A — admin-only claim writers; existing Hebrew error messages unchanged.
- **G2 — Rollback:** PASS — `git revert <merge-commit>` + `npm run build:ts`; restores the dual-shape writers. No data migration to reverse (writers only; existing tokens unaffected until refresh). Documented in PR "Rollback".
- **G3 — Monitoring:** PASS — audit-FIRST `logCriticalAction` on every grant path is preserved (now records `newClaims:{role:'admin'}`); success/failure `logger.*` lines preserved. No mutation path lost its audit/log.
- **G4 — Customer-scenario test:** PASS — the scenario "an admin is granted/revoked and the written claim is single-shape" is covered by the updated runtime handler tests + the new cross-writer source guard (incl. the previously-untested revoke→`{}`).
- **G5 — Hebrew UI:** N/A — no UI strings changed (error throws unchanged).
- **G6 — Breaking change:** PASS (managed) — the claim WRITE shape changes, but `verifyClaims` proved `admin_boolean_only:0`/`both_shapes:0`, and consumers/gates still READ both shapes, so no live session is demoted. Expand/contract ordering honored: contract writers now, remove consumer reads in the follow-up after a token-refresh window. Supervised final `verifyClaims` is the merge-moment evidence.
- **G7 — Security review:** PASS — `security-access-expert` + `devils-advocate` reviewed the E scope (GO-WITH-CHANGES, recorded §7.4). This PR ADDS a PII hardening (redacts an email out of `logger.*`) and removes the redundant boolean grant; it does not widen any surface. The auth gates (the only authz decision points) are untouched.

VERDICT: (filled by grader)

## Rollback
```bash
git revert <merge-commit>
cd functions && npm run build:ts   # restore prior compiled lib/
git add functions/lib && git commit --amend --no-edit   # if lib differs
git push origin main
```
Writers only — no data migration to undo. Existing tokens keep working (gates still read both shapes).

## Test plan
**Automated:** `cd functions && npx jest` (754/754, both projects) covers: the four writers' role-only write, the v1 revoke→`{}` (new), role-only idempotency, the unchanged dual-shape GATES, and the PII guard. `tsc --noEmit` + ESLint (repo root) clean.
**Supervised (Haim, merge-moment — NOT this diff):** after merge + PROD deploy, run `verifyClaims` and confirm `claimShapeBreakdown.admin_boolean_only === 0` and `both_shapes === 0` hold (no writer reintroduced the legacy field). This is the G6 evidence.

## Notes for grader
- LOCKED SCOPE = GO-WITH-SPLIT (writer-contraction only). Removing the consumer `admin:true` reads in THIS PR is explicitly OUT OF SCOPE (§7.4) and would be a §2.0 bar violation (strands not-yet-refreshed legacy tokens).
- DEFERRED TO F (§7.5): the 7 redundant `{role:'lawyer'}` claims (dormant escalation via `firestore.rules:239` `toRoles`). Not in E.
- The PII redaction (`email_fallback` warn) is a small in-scope G7 win surfaced by the mandated step-6 PII guard — keeping a guard that passes over a known email-in-logs leak would lower the bar (forbidden).
- **CARRY-FORWARD TO F (devils-advocate #2, code review of the actual diff):** the v1 `setAdminClaim` revoke writes `{}` (full claim replace), which is correct TODAY (admins hold `role` only). The MOMENT F introduces a `partner`/composite claim, a blanket `{}` revoke would silently wipe the user's OTHER claims. F MUST convert the revoke path to read-merge-write (or a targeted `role` delete) AND add a test proving `{}`-style revoke does not clobber a non-admin claim — mirror the revoke→`{}` test added here. Recorded so it is not lost.
- **Regression-guard coverage (devils-advocate #4):** the contraction guard's group (4) is a repo-wide backstop asserting NO `setCustomUserClaims` payload in any of the 5 known claim-writing files (incl. `admin/master-admin-wrappers.js`) emits `admin:true` — closing the gap where a future edit to an already-compliant writer could reintroduce the boolean and still pass CI.
