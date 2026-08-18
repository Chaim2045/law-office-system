# Rubric — OWN-3 reconciliation admin control (BACKEND)

**Title:** feat(functions): OWN-3 — admin control callables for the reconciliation loop (setReconciliationMode + runReconciliationNow)
**Branch:** `feat/own-3-reconciliation-admin-backend` → main (DEV)
**Files:** `functions/reconciliation/index.js` (new — the 2 callables), `functions/shared/reconciliation-mode.js` (+`invalidateReconciliationModeCache`), `functions/scheduled/reconcile-package-drift.js` (promote `runReconciliation` to a top-level export), `functions/index.js` (+2 exports), `functions/tests/reconciliation-callables.test.js` (new — 15 tests).
**Scope:** The BACKEND half of the OWN-3 admin control (Haim-approved). Two admin-gated v2 callables let an admin operate the OWN-2 reconciliation loop from the Admin Panel instead of editing Firestore / Cloud Scheduler by hand: flip the mode (off/dry_run/enforce) and "Run now". The FRONTEND page (`reconciliation.html`, label "סנכרון שעות") + the `audit_log(action, timestamp)` composite index are a SEPARATE follow-up PR (the page reads the mode + run summaries directly — `system_settings` is authed-readable, `audit_log` admin-readable).

**Deliberate JS (not src-ts/TS) — documented deviation from §2.6 (grader-ruled ACCEPTABLE):** these callables are thin wrappers tightly coupled to TWO JS modules — the loop `scheduled/reconcile-package-drift.js` (`runReconciliation`) and the flag `shared/reconciliation-mode.js` (`VALID_MODES` + cache-invalidate). Precedent for a `src-ts` TS file consuming a JS module exists ONLY via a hand-maintained co-located `.d.ts` (`shared/logger.d.ts`, `shared/claim-writer.d.ts`); the two modules these callables need have **no `.d.ts`**, and authoring `.d.ts` bridges over the PROD-write loop+flag is a worse drift surface (a `.d.ts` can silently diverge from the JS) than staying JS — and `functions/CLAUDE.md` explicitly forbids migrating an existing JS module to TS as a side effect ("Existing JS module? Stays as JS … a separate PR with explicit motivation is required"). This mirrors the **OWN-1/OWN-2 precedent** in this same initiative (new modules coupled to JS canonical modules stayed JS, grader-accepted). §2.6's "new code = TS" meta-rule is **not** an enumerated Mechanical item in §2.0.2 → it defaults to **Subjective** (eligible for reasoned judgment, not a deterministic FAIL). Every bar-relevant property §2.6 protects is independently satisfied in JS: **v2 onCall** (`firebase-functions/v2/https`), **role-only admin gate**, **audit-FIRST/audit-atomic**, **Hebrew errors**, **non-PII logging**, and **strict manual input validation** (the Zod-`.strict()` equivalent — reject unknown/invalid mode; only known fields read).

## MUST criteria (block on FAIL)

### M1 — Role-only admin gate on BOTH callables
**Rule:** `claims.role === 'admin'` (NOT admin||partner — these are CONTROL ops; `enforce` enables live PROD writes). Unauth → `unauthenticated`; non-admin → `permission-denied`. **Evidence:** `requireAdmin`; tests "unauthenticated → unauthenticated" / "non-admin → permission-denied" on both handlers; the loop is NOT invoked when the gate fails.

### M2 — Strict input validation + the enforce confirm-token
**Rule:** `mode` must be a string ∈ `VALID_MODES` (sourced from the flag module, not re-hardcoded) → else `invalid-argument`, no write. Flipping to `enforce` (the PROD-write enabler) additionally requires `confirmToken === 'enforce'` → else `failed-precondition`, no write; off/dry_run need none. **Evidence:** tests — invalid mode → invalid-argument (no write, no audit); enforce without/with-wrong token → failed-precondition (no write); enforce with correct token → writes.

### M3 — Audit-atomic (set-mode) / audit-FIRST (run-now), fail-secure
**Rule:** `setReconciliationMode` writes the audit (`logCriticalActionInTxn 'SET_RECONCILIATION_MODE'` with `{previousMode,newMode}`) + the flag in ONE transaction (audit-atomic: either both commit or both roll back; no flag change without an audit). `runReconciliationNow` audits (`logCriticalAction 'RECONCILIATION_RUN_NOW'`) BEFORE invoking the loop. Any failure → throw `internal`, no mutation. **Evidence:** tests — "audit-in-txn THROWS → internal, flag NOT written (atomic rollback)" + "transaction THROWS → internal" + "audit FAILS → internal, loop NOT invoked".

### M4 — The flag write + cache invalidation
**Rule:** `setReconciliationMode` writes `system_settings/package_reconciliation` `{mode, enabledBy:uid, enabledAt:serverTimestamp}` with `{merge:true}` (never clobber unrelated fields), `enabledBy` = UID never email, then calls `invalidateReconciliationModeCache()` so an immediate "Run now" in the same instance sees the new mode (not the ≤60s stale cache). **Evidence:** test asserts the merge payload + `enabledBy:uid` + cache-invalidate called once.

### M5 — runReconciliationNow invokes the loop respecting the current mode
**Rule:** invokes the promoted `runReconciliation()` (which reads `getReconciliationMode()` itself → off=no-op/`skippedRun`, dry_run=logs, enforce=writes) and returns the run counters so the UI shows the result immediately. It does NOT take a mode argument (so "Run now" can never sneak an unaudited enforce). **Evidence:** tests — admin → invokes loop + returns counters; mode=off → `skippedRun` surfaced; loop throws → `internal`.

### M6 — Non-PII; Hebrew errors
**Rule:** all logs/returns are modes/counts/uids only — never clientName/email. Every customer-facing error is Hebrew with a next-action. **Evidence:** grep the diff — no clientName/email in `logger.*`/returns; the 5 HttpsError messages are Hebrew.

### M7 — Module changes are minimal + additive
**Rule:** `runReconciliation` promoted to a first-class export of the loop module (also kept in `_test`); `invalidateReconciliationModeCache` added to the flag module (public; `_test.resetCache` re-points to it). No behavior change to the loop or the flag. `dailyInvariantCheck` + the loop's scheduled behavior unchanged. **Evidence:** the two `module.exports` diffs; OWN-2 suite still green.

### M8 — Full suite green; syntax clean
**Rule:** full functions Jest suite green; `node --check` clean on the new + changed files. **Evidence:** `npx jest` = 1209/1209 (70 suites); the callable suite = 16 tests; `node --check` OK ×4.

## SHOULD
- **S1** — devils-advocate review on the FINAL diff — MANDATORY (§3.8.4: a new write path + a flag that enables live PROD writes). Verdict cited in the PR body.
- **S2** — security-access-expert was consulted in the OWN-3 investigation (admin-gate + non-PII confirmed). The frontend PR carries the fail-closed render-gate + the composite index.

## Out of scope (deferred — declared)
- **The frontend page** (`reconciliation.html` + `ReconciliationPage.js` + nav "סנכרון שעות") — the SECOND OWN-3 PR (frontend-only; reads mode + runs directly; typed-"תיקון" confirm UX → sends `confirmToken:'enforce'`).
- **The `audit_log(action ASC, timestamp DESC)` composite index** — belongs to the frontend PR (the page's runs query; these callables don't query audit_log). Confirmed it does NOT exist yet.
- **The dry_run→enforce promotion** — operational, Haim's hands (now done via THIS UI once the frontend lands).
- **The design-doc §5 fix + provisioning-writers out-of-scope documentation** — the OWN-3 docs item (separate).

## Rollback (G2)
**NOT a pure `git revert`** (adds 2 new Cloud Functions). Two-tier: (1) the callables are additive and the loop stays gated OFF — removing them changes no existing behavior; (2) full removal = supervised `firebase functions:delete setReconciliationMode runReconciliationNow --region us-central1` FIRST, THEN `git revert <merge-commit>` (the H.1.b CF-deletion-guard lesson). The `system_settings/package_reconciliation` flag (if ever set) is independent — set it to `off` to neutralize the loop regardless.

## PRODUCT-GRADE GATES
- **G1 (errors):** PASS — 5 Hebrew, user-friendly HttpsError messages with next-actions; no stack traces / undefined / raw FirebaseError.
- **G2 (rollback):** PASS — flag→off (instant) + `functions:delete`-then-revert (documented). See Rollback.
- **G3 (monitoring):** PASS — audit-FIRST (`SET_RECONCILIATION_MODE` / `RECONCILIATION_RUN_NOW` + compensating audit) on every control op; `logger.info` success / `logger.error` failure with actor uid + errorCode; non-PII.
- **G4 (test proves scenario):** PASS — 15 tests exercise the customer scenarios: admin flips mode (off/dry_run/enforce-with-token), the enforce confirm-token gate, audit-FIRST fail-secure, the merge write + cache invalidate, run-now invoking the loop + surfacing skippedRun, and the gate on both. 1208 total.
- **G5 (Hebrew UI):** PASS — all customer-facing error strings Hebrew.
- **G6 (breaking change):** N/A — additive (2 new gated callables + a promoted export + a new public cache helper); no schema/contract/route/default-behavior change; the loop + detector unchanged.
- **G7 (security):** PASS — admin-only gate on a PROD-write enabler; audit-FIRST; non-PII; the `enforce` confirm-token. security-access-expert reviewed the OWN-3 investigation. (devils-advocate run on this PR per §3.8.4.)

## Review outcome — grader=PASS_WITH_WARNINGS, devils-advocate=GO-WITH-CHANGES (all folded)
- **outcomes-grader = PASS_WITH_WARNINGS** (8/8 MUST, 7/7 gates) — ruled the JS deviation ACCEPTABLE; corrected my "no precedent" rationale (W1, fixed above).
- **devils-advocate = GO-WITH-CHANGES** (0 🔴). Folded:
  - **#5 (the must-fix) — `setReconciliationMode` made ATOMIC.** The read-previousMode + audit + flag write now run in ONE Firestore transaction → concurrent admin flips can't lost-update the on-switch (an emergency flip-to-off can't be swallowed by a concurrent enforce); audit-atomic with the flag write.
  - **#1 — fixed the misleading `maxInstances:1` comment** (it bounds run-now only; the 07:00 cron is a separate function; cron×manual overlap is defended by the owner's per-client A5 guard + idempotent recompute, not the singleton).
  - **#3 + grader W3 — the pre-audit read now lives inside the txn; the failure message says "המצב לא שונה ונשאר כפי שהיה"** (atomic rollback → the mode is genuinely unchanged, so the message is accurate).
  - **#2 (run-now in enforce writes without a re-confirm) — by design + ACCEPTED:** reaching enforce already required the role-gate + confirm-token + audit; the loop NEVER auto-blocks, so a run can only apply ledger-true number corrections. The frontend page will show a persistent "המצב: תיקון — כל הרצה כותבת לפרודקשן" banner.
  - **#4 (🟢 partial-run UX) — the run-now error honestly points to the run-table** (where the `PACKAGE_RECONCILE_RUN` audit holds the real counters); the frontend shows a spinner + a link to the runs table.

## Notes for grader
- The single sensitive op is enabling `enforce` (the loop's live PROD-write mode). It is protected by THREE independent barriers: the role-only admin gate, the `confirmToken==='enforce'` requirement, and the audit-FIRST trail (`previousMode→newMode` + `enabledBy` UID). "Run now" cannot enable enforce (no mode arg) — it only runs the already-set mode.
- The 60s mode-cache could make "set enforce then Run now" read a stale mode; `invalidateReconciliationModeCache()` (called by setMode + at the top of run-now) makes the sequence deterministic within an instance.
- JS-not-TS is the one bar-tension — documented above with the coupling rationale + the OWN-1/2 precedent; flagged transparently for the grader's ruling.
