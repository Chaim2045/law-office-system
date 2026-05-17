# Rubric — PR-A.6

**Title:** feat(security): invariant enforcement mode kill-switch (system_settings/invariant_enforcement)
**Branch:** feat/invariant-enforcement-mode-pr-a-6
**Base:** main
**Scope:** Add a centralized config-driven kill-switch for the canonical helper's invariant assertion. Three modes:

- `enforce` (default) — current behavior: assertion throws + violation logged + write aborted
- `log_only` — write proceeds with canonical aggregates; violation logged but no throw
- `disabled` — assertion skipped entirely; no log, no throw (emergency only)

Toggled via a single Firestore document at `system_settings/invariant_enforcement`. No deploy required to flip. 60-second cache per CF instance to keep Firestore read overhead negligible.

## MUST criteria (block on FAIL)

### M1 — Config document path + shape defined
**Rule:** Helper reads from `system_settings/invariant_enforcement` with shape:
```js
{ mode: 'enforce' | 'log_only' | 'disabled', updatedAt: Timestamp, updatedBy: string }
```
Missing document OR invalid `mode` value → default to `'enforce'`. Default-on-failure is the safe default.
**Evidence required:** Helper code + a small `getEnforcementMode()` function that handles all three paths.

### M2 — Three modes implemented in helper
**Rule:** Helper behavior by mode:
- `enforce`: try assertion → on throw, log violation + re-throw (current behavior, unchanged)
- `log_only`: try assertion → on throw, log violation + emit `mode_log_only` Cloud Logging entry + DO NOT re-throw. Transaction proceeds with canonical aggregates.
- `disabled`: skip assertion entirely. No log, no throw.
**Evidence required:** Code path covers all three modes. Tests for each.

### M3 — Cache strategy with bounded TTL
**Rule:** Helper caches the mode at module level for **60 seconds (or configurable via env)** to avoid per-call Firestore reads. Cache miss → read doc → cache result. Cache hit → use cached value. Default to `'enforce'` on read failure.
**Evidence required:** Cache module + tests covering: cache miss → read; cache hit → no extra read; expired cache → re-read.

### M4 — Per-call override (testability + emergency local override)
**Rule:** Helper accepts `options.mode` to override the global config per call. Useful for: unit tests (no Firestore mocking needed), emergency code-side override.
**Evidence required:** `options.mode` honored if provided; fall-through to cached global if omitted.

### M5 — Tests cover all three modes
**Rule:** At least 6 new tests:
- `enforce` happy path (no violation) → no log, write OK
- `enforce` violation → throw + log
- `log_only` violation → log + write proceeds + NO throw
- `log_only` happy path → no log, write OK
- `disabled` violation → write proceeds + NO log + NO throw
- `disabled` happy path → write OK
**Evidence required:** Test file shows all six cases.

### M6 — Cache tests
**Rule:** At least 2 tests:
- First call after fresh start → reads config doc
- Second call within TTL → no additional read
**Evidence required:** Mock of the config reader + invocation count assertions.

### M7 — Existing helper tests still pass
**Rule:** All 33 prior tests in `write-client-canonical-aggregates.test.js` pass unchanged.
**Evidence required:** Jest output.

### M8 — Firestore Rules permit admin read of the config doc
**Rule:** `system_settings/invariant_enforcement` is readable by `isAuthenticated()` (current rule for `system_settings/{settingId}` already covers this). NO new rule needed for read. Write remains CF-only (admin toggles via Firebase Console using Admin SDK).
**Evidence required:** Reference to existing rule. No change to `firestore.rules`.

### M9 — Default safety
**Rule:** Helper defaults to `'enforce'` mode in ALL of these cases:
- Document doesn't exist
- Document exists but `mode` field missing
- `mode` field is invalid value
- Firestore read fails (network, permission, etc.)
**Evidence required:** Test for each.

### M10 — Lint + all tests pass
**Rule:** `npm run lint` returns 0 errors. `cd functions && npm test` AND root `npm test` both pass.
**Evidence required:** Output.

## SHOULD criteria (warning on FAIL)

### S1 — Docs explain how to toggle
**Rule:** `docs/CLIENTS_SYSTEM_REPORT.md` or new short doc explains how an admin toggles the mode via Firebase Console: navigate to Firestore → `system_settings` → `invariant_enforcement` → edit `mode` field. Effect takes hold within 60 seconds.
**Evidence required:** Diff of doc file.

### S2 — Cloud Logging entry includes mode in violation record
**Rule:** The `functions.logger.error('invariant_violation', ...)` entry includes the current `mode` so post-hoc analysis distinguishes "was enforce, write was aborted" from "was log_only, write proceeded".
**Evidence required:** Helper code + test.

### S3 — Audit recommendation
**Rule:** PR description recommends that admins **never leave the system in `disabled` mode** longer than a single incident window. Mode is observable but no automated alerting in this PR — PR-C will add alerts.
**Evidence required:** PR description.

### S4 — Backward compat for existing callers
**Rule:** Callers that DON'T pass `options.mode` get the global config behavior. No caller breaks. Existing tests pass without modification.
**Evidence required:** Existing test count unchanged (33 → 33 baseline pre-PR-A.6 work).

## Out of scope

- Admin UI for toggling mode (Firebase Console suffices — this is an emergency tool, not a daily operation)
- WhatsApp / SMS alert when mode changes (PR-C)
- Auto-reset to `enforce` after N hours (could add later — risk of admin forgetting and leaving in log_only)
- Per-client mode override (over-engineered)

## Rollback

`git revert <merge-commit>` on main → CI redeploys. The config document `system_settings/invariant_enforcement` stays in Firestore as an orphan (harmless). Helper reverts to PR-A.5 behavior (enforce only, no mode reading). No data corruption possible.

## Notes for grader

- This is the LAST defensive layer of PR-A series. After this, PR-B starts migrating the other 13 CFs.
- Cache TTL of 60s means toggling takes effect within a minute — acceptable for emergency use. Document this clearly.
- Default to `enforce` everywhere is the **safe default**. Misconfiguration must never silently downgrade safety.
- The `disabled` mode is intentionally available for **extreme emergency** (assertion itself has a bug causing false positives in production). Admin must consciously set it to that value.
