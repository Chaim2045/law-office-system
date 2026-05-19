# Rubric — PR-A.5

**Title:** feat(security): tighten clients Firestore Rules + clientInvariantViolations collection + structured violation logging
**Branch:** feat/firestore-rules-violations-pr-a-5
**Base:** main
**Scope:** Three coordinated defenses around the canonical client-write boundary:

1. **Firestore Rules tightening:** split the `clients` collection rule into `create`/`update`/`delete` with a field-level deny on aggregate fields (`isBlocked`, `isCritical`, `services`, `totalHours`, `hoursUsed/Remaining`, `minutesUsed/Remaining`). Admins writing directly from the browser can no longer set those fields — they must go through a Cloud Function (which uses Admin SDK and bypasses rules).
2. **`clientInvariantViolations` collection:** rules + write path. When `assertClientAggregateInvariants` throws inside the canonical helper, write a structured violation record so admins see it in a dashboard later (PR-C).
3. **Violation logging in `writeClientWithCanonicalAggregates`:** catch the assertion error, fire-and-forget the violation record outside the failed transaction, also emit a structured `functions.logger.error('invariant_violation', ...)` for Cloud Logging.

## MUST criteria (block on FAIL)

### M1 — `clients` rules split into create/update/delete with field-level allowlist
**Rule:** `firestore.rules` `/clients/{clientId}` rule is rewritten so that:
- `read`: unchanged (`isAuthenticated()`)
- `create`: admin only, AND `request.resource.data.keys()` does NOT include any of the restricted keys
- `update`: admin only, AND `request.resource.data.diff(resource.data).affectedKeys()` does NOT include any restricted key
- `delete`: admin only

Restricted keys: `isBlocked`, `isCritical`, `services`, `totalHours`, `hoursUsed`, `hoursRemaining`, `minutesUsed`, `minutesRemaining`.

**Evidence required:** `firestore.rules` shows the new structure. Cloud Function flows (which use Admin SDK) are unaffected.

### M2 — `clientInvariantViolations` collection rules added
**Rule:** New `match /clientInvariantViolations/{violationId}` rule:
- `read`: admin only
- `write`: false (Cloud Functions Admin SDK only)
**Evidence required:** `firestore.rules` shows the new block.

### M3 — Helper writes a violation record on assertion failure
**Rule:** `functions/shared/client-writer.js` catches the throw from `assertClientAggregateInvariants`. Before re-throwing, the helper:
- Writes a structured document to `clientInvariantViolations` collection (fire-and-forget, does NOT block the throw or extend transaction)
- Emits a structured `functions.logger.error('invariant_violation', { caller, clientId, error, ... })` for Cloud Logging
- Re-throws the original error so the caller still fails

Violation document fields (minimum): `timestamp` (server), `caller`, `clientId`, `error` (message), `proposedAggregates` (isBlocked/isCritical/totalHours/hoursRemaining proposed at the moment of failure), `servicesSummary` (id + type + pricingType per service for diagnosis), `auditMeta` (if provided).
**Evidence required:** New code path in `client-writer.js` + test asserting the write was attempted.

### M4 — Violation logger is dependency-injectable for tests
**Rule:** The helper accepts an optional `violationLogger` option (function). Defaults to the real Firestore write. Tests pass a jest.fn() to verify it was called with the right payload, without depending on the firebase-admin mock supporting `.add()`.
**Evidence required:** Helper signature includes the option; test uses it.

### M5 — Existing helper tests still pass
**Rule:** All 29 prior tests in `functions/tests/write-client-canonical-aggregates.test.js` pass unchanged. The violation-logging logic must not break any happy path.
**Evidence required:** Jest output.

### M6 — New tests cover both violation paths
**Rule:** At least 2 new tests:
- Assertion fails → violation logger called once with expected fields → original error re-thrown
- Assertion passes → violation logger NOT called
**Evidence required:** Test file + Jest output.

### M7 — All other tests pass
**Rule:** `cd functions && npm test` and root `npm test` both pass. Test count grows, doesn't shrink.
**Evidence required:** Test runner output.

### M8 — Lint zero errors
**Rule:** `npm run lint` returns 0 errors.
**Evidence required:** Lint output.

## SHOULD criteria (warning on FAIL)

### S1 — Rules test plan documented
**Rule:** PR description includes a test plan covering: (a) admin browser console attempt to write `isBlocked` directly → expect permission-denied (b) CF still succeeds (uses Admin SDK)
**Evidence required:** PR description.

### S2 — Documentation updated
**Rule:** `docs/CLIENTS_SYSTEM_REPORT.md` (or `docs/architecture/SERVICE_TYPES.md`) mentions the new `clientInvariantViolations` collection and the rules tightening.
**Evidence required:** Diff of doc files.

### S3 — Existing direct-write call sites verified safe
**Rule:** PR description confirms that known direct-write call sites (`SimpleClientDialog.js`) do NOT touch any restricted fields, so they continue to work after rules tighten.
**Evidence required:** PR description.

### S4 — Violation record carries diagnosable context
**Rule:** The violation document includes enough context that a future debugger can reconstruct what happened: caller name, services snapshot (at least id/type/pricingType per service), proposed aggregate values, auditMeta if any. NOT just the error message.
**Evidence required:** Code review of the violation document shape.

## Out of scope

- WhatsApp alert on violation (PR-C).
- Daily scheduled scanner (PR-C).
- Admin dashboard UI for the violations collection (PR-C).
- Feature flag for log-only vs enforce mode (PR-A.6).
- Migrating SimpleClientDialog.js to createClient CF (separate cleanup).
- Repair callable for the 23 victims (PR-D).

## Rollback

`git revert <merge-commit>` on main → CI redeploys. Firestore Rules return to the prior permissive `allow write: if isAdmin();`. The `clientInvariantViolations` collection stays in Firestore as an empty collection (harmless; rule reverts so nothing else can write). Helper reverts to the version without violation logging. No data corruption possible.

## Notes for grader

The Firestore Rules change is the riskiest part. The grader should verify:
- The deny is on `affectedKeys()` (not on whole-doc replacement) — admin can still update orthogonal fields like `fullName`, `phone`, `notes`, `assignedTo`, `isOnHold`.
- The create rule uses `request.resource.data.keys()` because `resource.data` is null on create.
- The grader does NOT have to spin up the Firestore Rules emulator to grade. Static rule inspection + the test plan suffice.

The violation-logging change is additive: the helper still throws as before. The only new behavior is the side-effect write to `clientInvariantViolations` + the structured log. Tests should isolate this via dependency injection (M4).
