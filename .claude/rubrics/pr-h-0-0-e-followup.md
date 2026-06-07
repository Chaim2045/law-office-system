# Rubric — Pre-H.0.0.E FOLLOW-UP: consumer/gate contraction (retire the `admin:true` READS)

**Title:** Complete the claim-shape consolidation end-to-end — remove the legacy `claims.admin === true` acceptance from every consumer READ + auth GATE, leaving `{role:'admin'}` as the single shape everywhere. Adds consumer-rejection tests so the guarantee can't silently regress. KEEPS the `verifyClaims adminBoolean` diagnostic.
**Branch:** `fix/pre-h-0-0-e-followup-consumer-contraction`
**Base:** `main`
**App / Env:** Functions (6 callable/v1 gates) + Admin Panel (Layer-1 read) + dev tooling / DEV (`main`).
**Effort:** MEDIUM (6 gate files + admin-panel + dev script + 6 test suites + 5 lib rebuilds + this rubric).

**Context (verified):** Pre-H.0.0.E (PR #357) contracted the WRITERS to `{role:'admin'}` and was deployed + G6-verified in PROD (2026-06-05: `admin_boolean_only:0, both_shapes:0`). §7.4 deliberately deferred the consumer-read removal to this follow-up, after a token-refresh window, so a not-yet-refreshed legacy token could not be stranded. **security-access-expert verdict: GO** — all 7 consumers also read `role==='admin'`, the store is 100% role-only, and Firebase ID tokens (≤1h TTL) issued before the E deploy expired ~24h before the snapshot; `firestore.rules`/`storage.rules` are already boolean-free. Removing the boolean halves strands zero of the 11 admins.

## MUST criteria (block on FAIL)

### M1 — All 6 backend gates are role-only
**Rule:** The auth gate in each of these reads `claims.role === 'admin'` ONLY (no `|| claims.admin === true`): `functions/src-ts/set-admin-claims.ts`, `initialize-admin-claims.ts`, `get-employee-cost.ts`, `set-employee-cost.ts`, `tofes-mecher/connectivity-check.ts`, and `functions/auth/index.js` (verifyClaims gate).
**Evidence:** `git grep "claims.admin === true"` returns ZERO matches in those gate lines (comments excluded). `claim-shape-contraction-guard.test.ts` group (5) asserts no `.admin === true` in the 5 TS gates + the verifyClaims gate is role-only.

### M2 — Admin-panel Layer-1 read is role-only
**Rule:** `apps/admin-panel/js/core/auth.js` `checkIfAdmin` Layer-1 no longer reads `tokenResult.claims.admin === true`; it gates on `role === ADMIN` only. Layers 2-3 (email list, Firestore) are untouched deprecated fallbacks (so no admin is stranded even pathologically).
**Evidence:** group (5) asserts `admin-panel/auth.js` (comment-stripped) has no `.admin === true`. ADMIN SAFETY: this is a behavioral change to admin verification, but a no-op for all 11 role-based admins (verifyClaims `role_string_only:11`).

### M3 — `verifyClaims adminBoolean` DIAGNOSTIC is KEPT
**Rule:** The verifyClaims report still measures the boolean shape (`adminBoolean`, `claimShapeBreakdown.admin_boolean_only`/`both_shapes`) — only the GATE's boolean half is removed. The diagnostic is the permanent regression sensor that detects any future re-introduction (e.g., a manual Console grant).
**Evidence:** group (5) `verifyClaims gate is role-only BUT keeps the adminBoolean diagnostic` test. `auth/index.js:400-460` adminBoolean fields preserved.

### M4 — Consumer-rejection tests exist (the §7.4 "or the guard is silently lost" requirement)
**Rule:** For each of the 5 callable gates, the prior "accepts legacy `{admin:true}` token" test is FLIPPED to assert a `{admin:true}`-only token is REJECTED (`permission-denied`); `{role:'admin'}` still passes. Plus the group (5) AST backstop preventing the fallback from creeping back.
**Evidence:** the 5 `REJECTS legacy admin:true-only token` runtime tests + group (5). All assert behavior, not just source.

### M5 — Dev tooling cleaned
**Rule:** Both dev diagnostics drop the legacy boolean: `devtools/debug-scripts/browser-check-guy.js` no longer reads/prints `claims.admin === true`, and `devtools/debug-scripts/check-guy-admin.js` no longer ACCEPTS `customClaims.admin === true` as an admin signal (role-only + Firestore-fallback now). Dev-only scripts; ride this PR per §7.4 + devils-advocate/grader review.
**Evidence:** `git grep "admin === true" -- devtools/debug-scripts/` returns only an explanatory comment (no code read). Remaining hits live in `devtools/docs/*.md` (dated historical investigation archives — intentionally NOT rewritten).

### M6 — lib/ rebuilt for exactly the 5 changed TS gates
**Rule:** `functions/lib/{set-admin-claims,initialize-admin-claims,get-employee-cost,set-employee-cost,tofes-mecher/connectivity-check}.js` (+ `.map`) recompiled + committed; no other lib file has a real content change (CRLF-only churn excluded).
**Evidence:** `git diff --numstat functions/lib/` nonzero ONLY for those 5 `.js` + 5 `.map`. `tsc --noEmit` exit 0.

### M7 — Tests + lint + typecheck green
**Rule:** Full `functions` Jest suite green (766/766); root vitest green (frontend, admin-panel touched); ESLint 0 errors on changed TS; `tsc --noEmit` clean.
**Evidence:** `cd functions && npx jest` → 766/766. `npx vitest run` → 398 passed / 2 skipped / 0 failed (1 unrelated pre-existing teardown-timer warning in `holidays-consumer-isworkday.test.ts`). ESLint exit 0.

## SHOULD criteria

### S1 — Docblocks reflect role-only end-to-end
**Rule:** The gate-file docblocks (set-admin-claims point 2/6, initialize point 1/5, set-employee-cost point 2) + the admin-panel migration comment describe the role-only gate and that the legacy shape is fully retired (no "dual-shape", no "still accept for one refresh window").

### S2 — Closes the §7.4 saga
**Rule:** PR body states this completes Pre-H.0.0.E end-to-end (writers in #357 + consumers here); one claim shape `{role:'admin'}` system-wide; the F-revoke read-merge-write prerequisite (§7.5) is still tracked.

## PRODUCT-GRADE GATES

- **G1 — Customer errors:** N/A — admin-only gates; existing Hebrew permission-denied messages unchanged.
- **G2 — Rollback:** PASS — `git revert <merge-commit>` + `npm run build:ts` restores the dual-read gates. Code-only; no data. (Safe to revert anytime — re-adding the boolean read is harmless since the store is role-only.)
- **G3 — Monitoring:** PASS — no write path changed; the verifyClaims diagnostic (the monitoring surface) is explicitly preserved (M3).
- **G4 — Customer-scenario test:** PASS — "an admin with `{role:'admin'}` is accepted; a legacy `{admin:true}`-only token is rejected" covered by the 5 flipped runtime tests + group (5) source backstop.
- **G5 — Hebrew UI:** N/A — no customer-facing strings changed (admin-panel console.log is developer-only).
- **G6 — Breaking change:** PASS (managed) — removing the `admin:true` read IS a contract tightening, but PROD `verifyClaims` proved `admin_boolean_only:0` + ≥1h/≥24h token-refresh window elapsed → every live token is role-shaped; all consumers retain the `role` read; rules/storage already boolean-free. No admin stranded. The retained diagnostic detects any regression.
- **G7 — Security review:** PASS — `security-access-expert` reviewed the exact scope (GO; all 7 consumers + completeness of the consumer list verified) and `devils-advocate` reviewed the diff before PR. Auth gates tightened (attack surface reduced), nothing widened.

VERDICT: (filled by grader)

## Rollback
```bash
git revert <merge-commit>
cd functions && npm run build:ts   # restore prior compiled lib/
git add functions/lib && git commit --amend --no-edit   # if lib differs
git push origin main
```
Code-only; reverting re-adds the (harmless) dual-read. No data migration.

## Test plan
**Automated:** `cd functions && npx jest` (766/766) — incl. the 5 consumer-rejection tests + group (5) gate backstop + the kept-diagnostic assertion. `npx vitest run` (398 pass). `tsc --noEmit` + ESLint clean.
**Supervised (Haim, post-merge):** confirm `ci-cd-production` Deploy-to-Production + Health-Check go green (incident lesson), then a PROD smoke: admin login to Admin Panel still works (role-only Layer-1), and `verifyClaims` still responds (role-only gate).

## Notes for grader
- This is the deferred SECOND half of Pre-H.0.0.E (writers shipped in #357, G6-verified 2026-06-05). Together they make `{role:'admin'}` the single claim shape end-to-end.
- KEEPING the verifyClaims `adminBoolean` diagnostic is a MUST (M3), not an oversight — it is the regression sensor for any future manual-Console boolean grant.
- Still tracked, NOT in this PR: §7.5 (F) revoke read-merge-write prerequisite; the 7 redundant `{role:'lawyer'}` claims (F).
