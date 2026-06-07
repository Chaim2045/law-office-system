# Rubric — Deploy-unblock incident fix: un-export `tofesMecherConnectivityCheck`

**Title:** Restore PROD functions deployability by un-exporting the H.0 connectivity-check (whose unset `defineSecret('TOFES_MECHER_SA_KEY')` has aborted every PROD functions deploy since #346).
**Branch:** `fix/unexport-connectivity-check-deploy-unblock`
**Base:** `main`
**App / Env:** Functions (backend) / affects PROD deploy. **This is part 1 of a verified production incident remediation.**
**Effort:** LIGHT (comment out 2 lines + comment).

**Incident context (verified against live `gh` logs + repo + git history):**
- CI `deploy-production` (`ci-cd-production.yml` JOB 8, on every push to `main`) runs `firebase deploy --only hosting,firestore:rules,functions` and has FAILED since 2026-05-28 (#339).
- **Two stacked blockers:** (A) `setAdminClaims` + `initializeAdminClaims` 1st→2nd Gen upgrade conflict (since #339); (B) `no value for the secret: TOFES_MECHER_SA_KEY` (since H.0 #346) — fires first, masking A.
- Consequence: ~6 days of backend + `firestore.rules` un-deployed to PROD, INCLUDING the hardened auth endpoints that retire a **live unauthenticated `setAdminClaims` onRequest** (zero-auth admin-claim grant).
- This PR clears **Blocker B only**. Blocker A is cleared by Haim deleting the two legacy functions in PROD (the supervised step). The full release + smoke is the separate supervised deploy.

**Scope (this PR):** comment out the `require` + `export` of `tofesMecherConnectivityCheck` in `functions/index.js` so the module is never loaded and its top-level `defineSecret` never runs → the deploy no longer requires the secret. The `.ts`/`lib/` source stays in the tree; re-enabled in H.1 once the SA + secret are provisioned.

## MUST criteria (block on FAIL)

### M1 — Secret dependency removed from the deploy graph
**Rule:** `functions/index.js` no longer loads `lib/tofes-mecher/connectivity-check` (both the `require` AND the `exports.tofesMecherConnectivityCheck` are commented). With the module unloaded, the top-level `defineSecret('TOFES_MECHER_SA_KEY')` never executes, so `firebase deploy` no longer fails on the missing secret.
**Evidence:** `git diff` shows lines 104-105 commented; grep confirms no remaining live `require`/`export` of the connectivity-check in `index.js`.

### M2 — No regression to the functions suite
**Rule:** The full `functions` Jest suite passes unchanged. No test imported the index.js export (the connectivity-check has its own direct-module test that is unaffected).
**Evidence:** `cd functions && npx jest` green (same count as before). `grep tofesMecherConnectivityCheck` shows zero test references to the index export.

### M3 — Reversible + documented
**Rule:** The change is a comment-out (not a deletion) with an inline note explaining WHY (the incident), and an explicit RE-ENABLE instruction for H.1. The `.ts` source + compiled `lib/` are untouched.
**Evidence:** the comment block at `functions/index.js` + this rubric.

### M4 — No scope creep
**Rule:** Diff touches ONLY `functions/index.js` (the two commented lines + comment) and this rubric. No other functions, no `firestore.rules`, no deletion of the connectivity-check source, no unrelated files.
**Evidence:** `git diff --stat main..HEAD`.

## SHOULD criteria

### S1 — The remaining blocker is named
**Rule:** PR body states this clears Blocker B only; Blocker A (delete `setAdminClaims` + `initializeAdminClaims` in PROD) + the supervised chunked release + smoke are the separate steps, so a reviewer/merger does not expect green PROD deploy from this PR alone.

## PRODUCT-GRADE GATES

- **G1 — Customer errors:** N/A — no customer-facing code path changed (removes an admin-only diagnostic export).
- **G2 — Rollback:** PASS — re-enable the two lines (`git revert` of this commit) restores the export; only safe to do AFTER the secret exists (else the deploy re-breaks). Documented in PR body.
- **G3 — Monitoring:** N/A — no data-mutating path; this removes an unused (never-deployed) diagnostic from the deploy graph.
- **G4 — Customer-scenario test:** PASS — the customer scenario here is "PROD functions deploy succeeds"; verified by the full Jest suite staying green + the reasoned removal of the secret-binding (the actual deploy is the supervised step, evidenced in the incident runbook). The connectivity-check's own module test is unaffected.
- **G5 — Hebrew UI:** N/A — no UI.
- **G6 — Breaking change:** PASS (none) — `tofesMecherConnectivityCheck` was NEVER successfully deployed to PROD (its first-ever deploy is the one that's been failing), so un-exporting it removes nothing live and breaks no caller (admin-gated diagnostic, zero callers).
- **G7 — Security review:** PASS — `security-access-expert` reviewed the incident (verdict: GO to delete the legacy endpoints; this un-export is the deploy-unblock that lets the hardened replacements deploy). This PR adds no new surface; it restores the ability to ship the security fix. `devils-advocate` reviewed the full remediation (GO-WITH-CHANGES; all 5 changes folded into the runbook).

VERDICT: (filled by grader)

## Rollback
```bash
git revert <merge-commit>   # re-enables the connectivity-check export
```
⚠️ Only re-enable AFTER `TOFES_MECHER_SA_KEY` exists in Secret Manager (H.1), else PROD functions deploy re-breaks.

## Test plan
**Automated:** `cd functions && npx jest` → full suite green (no regression). `grep` confirms zero callers/test-refs of the index export.
**Supervised (separate, Haim + Lead Agent — the incident runbook, NOT this PR):** pre-flight `verifyClaims` in PROD (confirm haim@/guy@ are admin) → `firebase functions:delete setAdminClaims initializeAdminClaims` → `firebase deploy --only firestore:rules` → `firebase deploy --only functions` → PROD smoke (admin login, grant test claim via new v2 callable, load a `system_holidays` page, console clean).

## Notes for grader
- This is the smallest reversible unblock for Blocker B, chosen by Haim at checkpoint over "set the secret now" (devils-advocate #4 noted the trade-off: un-export defers H.0's wiring validation to H.1 — logged as debt, not a clean win).
- It deliberately does NOT delete the connectivity-check source (re-enabled in H.1) and does NOT touch the gen-collision functions (that is a PROD-console action by Haim, not a code change).
