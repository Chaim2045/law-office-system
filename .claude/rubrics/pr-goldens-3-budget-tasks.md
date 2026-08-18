# Rubric — PR-GOLDENS-3: characterization tests for extendTaskDeadline + addTimeToTask (closes budget-tasks)

**Scope:** Third + final budget-tasks package of the financial-correctness **goldens track** (post-cleanup REASSESS 2026-07-31; #500 complete/cancel, #501 create/adjust/get). Pins the two remaining zero-tested CFs: `extendTaskDeadline` (the structural odd-one-out — NON-transactional direct get/update) + the `addTimeToTask` validation/delegation wrapper. **With this, all 7 budget-tasks CFs are characterization-covered.** **Test-only, additive — ZERO production-code change** (one new file: `functions/tests/budget-task-extend-addtime.test.js`, 15 tests).

**Characterization discipline:** pins the CURRENT behavior AS-IS (quirks included), asserting what the code DOES. Verified green (15/15) + cross-checked line-by-line against source.

## MUST
- **M1 — pins CURRENT behavior + green.** All assertions match `budget-tasks/index.js`: `addTimeToTask` (:491-519 — 3 guards + delegation), `extendTaskDeadline` (:1145-1241). **15/15 pass** against this repo's code (legacy-js jest, sibling `node_modules` via `modulePaths`; CI runs the real thing).
- **M2 — no production-code change.** Adds ONLY the one `.test.js` + this rubric.
- **M3 — the named quirks are pinned** (with explicit comments):
  - `extendTaskDeadline` is NON-transactional — a direct `db.collection('budget_tasks').doc(id).get()` then a direct `.update(...)` (no `runTransaction`), hence a distinct harness (direct-get config + direct-update spy).
  - completed-task block checks BOTH `'הושלם'` AND `'completed'` (Hebrew+English) — pinned via both statuses.
  - `originalDeadline = originalDeadline || deadline || newDeadlineDate` → a task with NEITHER prior date gets the NEW deadline stamped as its "original" (the `instanceof Date` case).
  - the extension record's `extendedAt` uses `Timestamp.now()` (a fixed `'NOW'` in the fake), NOT `serverTimestamp()`.
  - the audit call is NOT try/caught → a failed audit throws `'internal'` and FAILS the call EVEN THOUGH the non-transactional update already committed (the update is NOT rolled back) — the one budget-tasks CF where a post-write audit failure surfaces an error (contrast complete/cancel/create/adjust, which swallow audit errors).
  - `addTimeToTask` is a thin wrapper: 3 validation guards (taskId / positive-number minutes / date), then forwards `(db, data, user)` to `addTimeToTaskWithTransaction` and returns its result verbatim.
- **M4 — harness fidelity.** Same SDK-boundary mocks as the sibling budget-task suites, adapted for the non-txn path: a configurable `mockDirectGet` + a `mockDirectUpdate` spy on `db.collection().doc()` (extendTaskDeadline never uses `transaction.*`). `addTimeToTaskWithTransaction` mocked at the boundary (its real logic is separately tested). `test/setup.js` untouched.
- **M5 — characterization discipline.** Every assertion is the observed value; no "corrected"/idealized value. Covers the reject paths (exact Hebrew + HttpsError code), the happy-path update payload + the extension record, the return shape, and the audit-failure-fails-call quirk.

## PRODUCT-GRADE GATES
- **G1 (errors):** N/A — test-only, no customer path.
- **G2 (rollback):** `git revert <sha>` / delete the one file. Trivial.
- **G3 (monitoring):** N/A — mocks the SDK boundary; nothing writes to Firestore.
- **G4 (test proves scenario):** PASS — exercises the real handlers end-to-end (input → validation → direct get/update or delegation → return), mocking only the SDK/delegate boundary, not the logic (§2.3).
- **G5 (Hebrew UI):** N/A — Hebrew literals are pinned contract anchors from existing code, not new customer text.
- **G6 (breaking change):** N/A — additive test file.
- **G7 (security):** N/A-with-note — pins `extendTaskDeadline`'s owner-or-admin gate as a regression net; changes no auth code.

## Anti-premature-closure
- **devils-advocate declared-skip (justified):** test-only, additive, zero production-code change → not a §3.8.4 trigger. A mis-captured assertion self-fails against current code; run green (15/15) + grader source-verify are the gates.
- **🏁 budget-tasks characterization CLOSED** across 3 packages (#500 complete/cancel · #501 create/adjust/get · this extend/addTime). **NEXT writer = `timesheet/index.js` + `timesheet/helpers.js`** (helpers = 0 tests, mocked everywhere; getTimesheetEntries = 0; updateTimesheetEntry payload unasserted) — Tier-3 "characterization-tests-first" per the coverage sweep, its own package(s).
