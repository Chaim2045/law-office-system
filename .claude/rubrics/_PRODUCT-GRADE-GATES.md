# PRODUCT-GRADE GATES — global rubric extension

**Status:** every per-PR rubric in `.claude/rubrics/` inherits these gates. Every `outcomes-grader` evaluation MUST address each relevant gate. Every PR body MUST include a `PRODUCT-GRADE GATES` section with status per gate.

**Why this exists:** the law-office-system is being prepared for commercial sale. Internal-tool standards (manual smoke, console errors are OK if rare, missing monitoring "we'll add it later") do NOT survive a paying customer. These gates are the minimum bar that commercial-grade work must clear.

**Inspired by:** Anthropic's Claude Code Auto Mode (2026-03) — two-layer safety classifier pattern. Native implementation in this repo via hooks + outcomes-grader.

---

## The 7 Gates

### G1 — Customer-visible errors are professional
**Question:** if a paying customer triggers this code path and sees the error message, is it acceptable?

**Forbidden in customer-facing output:**
- Stack traces (`at functionName (file.js:42:13)`)
- `undefined`, `null`, `[object Object]`, `NaN`
- English error messages where the rest of the UI is Hebrew
- Database technical error verbatim (`FirebaseError: 7 PERMISSION_DENIED`)
- Empty error states (button does nothing, no feedback)

**Required:**
- Hebrew, user-friendly text
- Action the user can take next (retry, contact support, etc.)
- Error ID / correlation ID logged server-side (so support can trace)

**Verifiable:** grep the diff for forbidden patterns. Check that error paths have user-friendly Hebrew messages.

---

### G2 — Rollback path documented
**Question:** if this PR is merged and the customer reports a regression within 24h, can we roll back in under 5 minutes?

**Acceptable rollback paths:**
- `git revert <commit>` + redeploy (trivial — code-only changes)
- Feature flag flip (UI/UX changes)
- Migration rollback script (schema/data changes)
- Manual Firestore document edit (one-off data corrections — must include exact path + values to restore)

**Required in PR body:**
- A section titled "Rollback" with the exact command(s) or steps
- If rollback requires data migration: the inverse migration script attached + tested

**Verifiable:** PR body grep for "Rollback" header + presence of actionable steps.

---

### G3 — Monitoring touched if data-mutating
**Question:** does this PR write, update, or delete data? If yes — how do we know if it's working correctly in production?

**For write paths:**
- `console.log` (with structured key/value, parseable by log search) on success
- `console.error` (with error context) on failure
- Increment a counter or write a metric document if rate-aware

**For DELETE paths:**
- Audit log entry (who, what, when, why)
- Soft-delete preferred over hard-delete where reversible

**Required:**
- Success log includes: action name, entity ID, user ID, timestamp
- Failure log includes: action name, error code, error message, user ID

**Verifiable:** every `transaction.set` / `transaction.update` / `.delete()` has an adjacent log statement (in this PR's diff, or already present and preserved).

**N/A if:** PR is read-only OR purely refactor (no behavior change).

---

### G4 — Test proves the customer scenario
**Question:** does the test suite include a test that mirrors what the customer actually does? Not just "the helper returns the right string" but "user does X → sees Y".

**Acceptable:**
- Vitest/Jest integration test that exercises the full path (input → output)
- Manual smoke test plan with exact steps + expected results (when integration test is impractical)
- E2E Playwright test (highest confidence)

**NOT acceptable:**
- Unit test only of an internal helper, no integration coverage of the calling site
- Test that mocks every dependency such that it can't fail in production

**Required in PR body:** "Test plan" section listing the customer scenarios verified.

**Verifiable:** grep diff for `test(`, `it(`, or `describe(` — count integration-style tests (test names mentioning user actions, not just function names). Verify at least one exists for new code paths.

---

### G5 — Hebrew customer-facing text
**Question:** any string the customer can see — is it in Hebrew?

**Forbidden in customer-facing strings:**
- English error messages (`"Invalid input"`)
- English button labels (`"Submit"`, `"Cancel"`)
- English status text (`"Loading..."`, `"Success"`)
- Mixed Hebrew + English in same sentence (`"שגיאה: Permission denied"`)

**Acceptable English:**
- Internal log messages (admins read those, not customers)
- Code identifiers (variable names, function names)
- Comments
- Developer tooltips on admin-only screens

**Verifiable:** grep diff for string literals; check that user-facing ones contain Hebrew characters or are documented as developer-only.

---

### G6 — No breaking change without migration plan
**Question:** does this PR change anything that existing customers depend on (data schema, API contract, URL routes, default behavior)? If yes — how do existing customers transition?

**Breaking change examples:**
- Removing a Firestore field that frontend reads
- Renaming a Cloud Function (URL changes)
- Changing default value of a config option
- Removing a feature flag
- Changing the shape of a callable function's return value

**Required for any breaking change:**
- Section in PR body titled "Breaking change" listing what changed and who's affected
- Migration plan: how existing data/config/code transitions
- Backward-compat shim if migration is partial (read both old + new format for N weeks)

**Verifiable:** completeness-checker explicitly evaluates this gate. PR body must declare "no breaking change" OR include the migration plan.

---

### G7 — Security agent reviewed if PII / auth / permissions touched
**Question:** does this PR touch authentication, authorization, PII handling, or permissions? If yes — has the `security` sub-agent reviewed?

**Trigger for security review:**
- Changes to `functions/shared/auth.js` or any `checkUserPermissions`
- Changes to Firestore security rules
- New PII field added to a document
- New endpoint that returns user data
- Changes to JWT / token handling
- Changes to CORS / CSP headers
- WhatsApp webhook signature verification logic

**Required:**
- `security` agent consulted in this PR's investigation phase
- Agent verdict referenced in PR body (PASS / WARNINGS / FAIL)
- If FAIL: must be addressed before merge

**Verifiable:** PR body grep for "security agent" mention + verdict.

**N/A if:** PR touches only display, refactor, or non-PII data (e.g., color picker change).

---

## How outcomes-grader evaluates these gates

For each gate, the grader returns one of:
- **PASS** — gate evaluated, criteria met
- **N/A** — gate not relevant to this PR's scope (must justify why)
- **FAIL** — gate relevant, criteria not met (blocks PR)

**Total verdict:**
- All gates PASS or N/A → grader CAN return PASS / PASS_WITH_WARNINGS based on per-PR MUST/SHOULD
- Any gate FAIL → grader MUST return FAIL regardless of per-PR criteria

The per-PR rubric still defines the specific MUST/SHOULD; these gates are global gates that apply on top.

## How pre-PR hook enforces

`.claude/hooks/require-outcomes-pass.sh` validates the PR body contains:
1. `VERDICT: PASS` or `PASS_WITH_WARNINGS` (existing behavior)
2. A `PRODUCT-GRADE GATES` section with status per gate (G1-G7) — either PASS, N/A, or FAIL
3. Any gate marked FAIL → hook blocks `gh pr create`

## How CLAUDE.md surfaces this

The `PRODUCT-GRADE RULE` section in `CLAUDE.md` references this file. Every new chat session loads CLAUDE.md → agent is aware of the gates from message 1.

## Migration / grandfathering

**PRs opened BEFORE PR-META-3 merged** are grandfathered — the rule applies to new PRs only. We do not retroactively block / re-grade already-merged PRs. The `outcomes-grader` evaluating an older rubric should still check the gates (best practice going forward) but the hook only enforces on `gh pr create`.

**PRs in flight** (opened but not merged when PR-META-3 lands): when re-running grader for any reason, add the gates section. No need to amend already-pushed PRs unless they're being re-reviewed.
