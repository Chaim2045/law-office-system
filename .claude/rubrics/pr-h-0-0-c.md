# Rubric — Pre-H.0.0.C

**Title:** Canonical `logCriticalAction` audit primitive
**Branch:** `feat/pre-h-0-0-c-log-critical-action`
**Base:** `main`
**Scope:** Extract the duplicated `writeAuditOrThrow` helper from Pre-H.0.0.B into a canonical shared `functions/src-ts/audit-critical.ts` module. Two exports (non-transactional + transactional) prevent the compensating-audit-in-txn mistake by type. Refactor 2 callers (`set-admin-claims.ts`, `initialize-admin-claims.ts`). Update `docs/ENGINEERING_BAR.md:106` to drop the "forthcoming" placeholder. Add `schemaVersion:1` forward-compat anchor + `actorUid` validation (Firebase Auth UID OR `sys:<name>` system actor) + logger discipline (no `error.message` leakage).

## MUST criteria (block on FAIL)

### M1 — Canonical helper file exists with required exports
**Rule:** `functions/src-ts/audit-critical.ts` exports `logCriticalAction(action, actorUid, payload)` AND `logCriticalActionInTxn(txn, action, actorUid, payload)`. Both are documented (TSDoc).
**Evidence required:** grep diff for `export async function logCriticalAction` and `export function logCriticalActionInTxn`. AST test in `audit-critical.test.ts` asserts both.

### M2 — Two exports prevent compensating-audit-in-txn mistake (Attack #2)
**Rule:** Non-transactional variant returns `Promise<string>` from `collection.add()`. Transactional variant uses `collection.doc()` to pre-allocate + `txn.set(docRef, doc)`. Type system makes mixing them mechanical.
**Evidence required:** test `does NOT call collection.add` proves txn variant bypasses `.add`; test `uses txn.set with pre-allocated doc ref` proves non-txn behavior.

### M3 — `actorUid` validation accepts both human + system actors (Attack #3)
**Rule:** Helper validates: (a) non-empty trimmed string, (b) `sys:`-prefix matches `/^sys:[a-z][a-z0-9-]{2,60}$/`, (c) otherwise `/^[\w-]{6,128}$/`. Throws on any failure with descriptive message.
**Evidence required:** tests reject empty, whitespace, short UID, invalid chars (colon, slash, space in human UID), malformed sys: actor. Test ACCEPTS canonical Firebase Auth UID + `sys:cron-sync-role-claims`.

### M4 — `schemaVersion: 1` forward-compat anchor (Attack #5)
**Rule:** Every audit doc written includes `schemaVersion: 1`. Source defines `SCHEMA_VERSION = 1` constant; both write paths use it.
**Evidence required:** AST test asserts `SCHEMA_VERSION = 1` literal + `schemaVersion: SCHEMA_VERSION` write. Runtime test asserts payload includes `schemaVersion: 1`.

### M5 — NO `error.message` in logger calls (Attack #4 PII discipline)
**Rule:** `audit-critical.ts` source MUST NOT contain `error.message` or `err.message` inside any `logger.*` call. Firestore errors can contain rule paths (e.g. "PERMISSION_DENIED on /audit_log/..."); leaking those to Cloud Logging exposes security boundaries.
**Evidence required:** AST test fails if `/logger\.(?:error|warn|info|debug)\([^)]*error\.message/` matches.

### M6 — Logger emits `audit_critical.write_failed` BEFORE rethrowing
**Rule:** Firestore failure path emits `logger.error('audit_critical.write_failed', {actorUid, action, errorCode})` and then rethrows the original error so the caller can inspect `error.code` for compensating logic.
**Evidence required:** AST test asserts the literal log key. Runtime test asserts the rejected error is the SAME object passed (not a wrapped version).

### M7 — Both callers refactored, no local clones remain
**Rule:** `set-admin-claims.ts` and `initialize-admin-claims.ts` import `logCriticalAction` from `./audit-critical`. Neither contains `function writeAuditOrThrow` or `const AUDIT_COLLECTION`. Existing AST tests in both `__tests__` files are updated to assert the new invariants (Attack #1 fix).
**Evidence required:** grep diff for `writeAuditOrThrow` → 0 hits in `src-ts/**/*.ts`. Updated tests pass.

### M8 — All 72 tests pass (51 Pre-H.0.0.B + 21 new audit-critical)
**Rule:** `npm run test:ts` reports 4 suites, 72 tests, 0 failures. The 51 Pre-H.0.0.B handler tests must STILL PASS unchanged (same behavior) — proving the refactor is behavior-preserving.
**Evidence required:** test output. Specifically: `set-admin-claims.test.ts` and `initialize-admin-claims.test.ts` retain ALL their existing test names + each adds the new "uses canonical logCriticalAction helper" AST test.

### M9 — `docs/ENGINEERING_BAR.md:106` updated (closes forward-reference)
**Rule:** The line that currently says "(forthcoming PR-H.0.0.C)" is updated to reference the canonical module + describe the helper's contract (audit-FIRST, fail-secure, `schemaVersion:1`, `actorUid` validation, no `writeAuditOrThrow` clones permitted).
**Evidence required:** diff shows the line change.

### M10 — `functions/CLAUDE.md` canonical examples list updated
**Rule:** "Where to find canonical examples" section adds a line for `functions/src-ts/audit-critical.ts` as the audit-FIRST primitive.
**Evidence required:** diff shows the addition.

### M11 — `docs/MASTER_PLAN.md` §7.1 + §7.2 status flipped
**Rule:** Row C in §7.1 table moves from `⏸️ pending` → `🟡 in progress`. §7.2 "Locked decisions" + "Implementation status" sections reflect the 5 devils-advocate fixes incorporated (two exports, schemaVersion, actorUid regex+sys:, no error.message, lib/ commit).
**Evidence required:** diff shows both updates.

### M12 — Build artifacts (`functions/lib/`) committed
**Rule:** Per Pre-H.0.0.B decision, compiled output ships with the PR. `functions/lib/audit-critical.js` exists; the re-emitted `set-admin-claims.js` + `initialize-admin-claims.js` match a fresh `npm run build:ts` bit-for-bit.
**Evidence required:** `npm run build:ts && git diff functions/lib/` is empty.

### M13 — Hebrew customer-visible errors (G1, G5)
**Rule:** Any `HttpsError` reaching the customer remains Hebrew with actionable next step. The helper's own throws (validation errors) are INTERNAL (caller catches + re-wraps with Hebrew HttpsError) — those English messages are acceptable per G5 "Acceptable English: Internal log messages".
**Evidence required:** grep diff for HttpsError. Existing 51 Pre-H.0.0.B tests confirm Hebrew customer paths unchanged.

### M14 — ESLint 0 errors
**Rule:** `npx eslint functions/src-ts/` returns 0 errors. Warnings acceptable.
**Evidence required:** lint output.

### M15 — Devils-advocate findings addressed
**Rule:** All 5 attacks from the devils-advocate review are addressed in code or explicitly out-of-scope with rationale:
- Attack #1 (AST tests would fail): FIXED — existing tests updated to new invariants.
- Attack #2 (txn? invites mistake): FIXED — two separate exports.
- Attack #3 (length-≥20 too strict): FIXED — regex + sys: prefix.
- Attack #4 (error.message leakage): FIXED — AST test forbids it.
- Attack #5 (schema lock too tight): FIXED — `schemaVersion:1` anchor.
- Bonus #6 (lib/ commit hides regression): rubric reviewer-checklist line added (this rubric §S2).
**Evidence required:** rubric section per attack mapping.

## SHOULD criteria (warning on FAIL)

### S1 — JSDoc PII policy documented in helper
**Rule:** The file header JSDoc documents ALLOWED / DISCOURAGED / FORBIDDEN payload contents (security investigation §2).
**Evidence required:** grep diff for "PII policy" or equivalent in `audit-critical.ts`.

### S2 — Reviewer checklist for `lib/` spot-check (bonus #6)
**Rule:** PR body includes a line: "Reviewer: spot-check `lib/audit-critical.js` matches `src-ts/audit-critical.ts` 1:1 in logic". Defends against silent TS-compile regressions hiding in generated output.
**Evidence required:** PR body grep.

### S3 — `legacy JS clones documented as out-of-scope`
**Rule:** Rubric or PR body explicitly lists `functions/shared/audit.js#logAction`, `functions/admin/master-admin-wrappers.js`, and `functions/src/deletion/audit.js` as OUT-OF-SCOPE — those use swallow-on-fail semantics (different contract).
**Evidence required:** this section + PR body mention.

## PRODUCT-GRADE GATES

- **G1 — Customer errors**: PASS — helper validation throws internal English (caller catches). Hebrew customer paths unchanged in 2 refactored callers (their 51 tests still pass).
- **G2 — Rollback**: PASS — `git revert <merge-commit>` removes the new helper file + reverts caller refactor + reverts lib/ + reverts docs. The pre-Pre-H.0.0.C state is fully restored.
- **G3 — Monitoring**: PASS — helper logs `audit_critical.write_failed` on failure with `actorUid`/`action`/`errorCode`. No auto-success log (callers log success contextually).
- **G4 — Customer-scenario test**: PASS — 72 tests across 4 suites. Tests prove: success returns id, failure rethrows + logs, validation rejects/accepts the right inputs, txn variant uses txn.set, no error.message in logger.
- **G5 — Hebrew UI**: PASS — refactor preserves all Hebrew HttpsError messages in callers; helper internal validation errors are admin-facing English (acceptable per G5).
- **G6 — Breaking change**: PASS — the helper is purely additive. The 2 caller refactors are behavior-preserving (51 tests pass unchanged). No external API change.
- **G7 — Security review**: PASS — security-access-expert consulted in investigation phase, 7 concrete requirements adopted: actorUid validation, JSDoc PII policy, logger.error before rethrow, no auto-success log, no hardcoded emails, hardcoded collection name, schema lock + forward-compat anchor.

## Out of scope (do not downgrade for absence)

- Migrating `functions/shared/audit.js#logAction` consumers — that helper has swallow-on-fail semantics by design (39 legacy call sites depend on that contract). Different helper, different consumers.
- Migrating `functions/admin/master-admin-wrappers.js` audit clone — same rationale.
- Migrating `functions/src/deletion/audit.js` parallel audit subsystem — separate scope.
- Adding `correlationId`, `severity`, or other top-level audit fields — explicitly deferred to the PR that needs them (per Attack #5 defense: `schemaVersion:1` anchor lets future PRs bump cleanly).
- Pre-PR hook enforcement that PR body contains the reviewer checklist line — process commitment, not blocker.

## Rollback

```bash
git revert <merge-commit>
git push origin main
```

The 3 source files (`audit-critical.ts` + 2 refactored callers) + 2 test files + 3 doc files + lib/ all revert cleanly. 72 tests return to 51 (the new 21 audit-critical tests are removed; the 2 modified AST assertions revert to checking `writeAuditOrThrow`). No data, no users affected.

## Test plan

**Automated (this PR):**
1. `cd functions && npm run typecheck:ts` → 0 errors
2. `cd functions && npm run test:ts` → 72 tests pass (4 suites)
3. `cd functions && npm run test:legacy` → 600 tests pass (no regression on legacy JS)
4. `cd functions && npm run build:ts` → produces `functions/lib/` matching committed
5. `cd .. && npm run type-check && npm run compile-ts` → 0 errors (ROOT — Pre-H.0.0.B lesson)
6. `npx eslint functions/src-ts/` → 0 errors

**Manual smoke** (post-deploy DEV):
7. From DEV admin panel, invoke `setAdminClaims` for a test target → confirm dual-shape claim + audit_log entry with `schemaVersion: 1`.
8. Inspect Cloud Logging for `audit_critical.write_failed` events (should be 0 in healthy state).
9. Confirm no `error.message` in any new Cloud Logging entry.

## Notes for grader

- The 51 Pre-H.0.0.B tests + 21 new audit-critical tests = 72 total. The 51 must remain UNCHANGED in pass/fail status. The grader's anti-premature-closure check should verify this — refactor is behavior-preserving.
- The two-exports decision (Attack #2) is the most architecturally significant. A reviewer who challenges "why not just one signature with optional `txn?`" should be pointed to devils-advocate Attack #2: the compensating-audit-in-txn footgun.
- This PR is the **canonical anchor** for every future critical write path. Pre-H.0.0.F (syncRoleClaims), Pre-H.0.0.G (employee_costs), and Phase 2 H.2 / H.4 / H.6 / H.8 will all use `logCriticalAction`. A bug here propagates everywhere — hence the comprehensive test coverage.
