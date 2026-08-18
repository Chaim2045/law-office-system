# Rubric — PR-GOLDENS-timesheet-helpers: characterization tests for the timesheet/helpers.js reservation + event primitives

**Scope:** First **timesheet** package of the financial-correctness goldens track (budget-tasks closed via #500/#501/#502). Pins the FOUR LIVE primitives in `functions/timesheet/helpers.js` — `createTimeEvent`, `createReservation`, `commitReservation`, `rollbackReservation` — the ones `timesheet/index.js` actually calls (:731/:1169/:1202/:1229/:1242). helpers.js had ZERO direct tests (it is jest.mocked in every suite that touches index.js), so its behavior was entirely unpinned. **Test-only, additive — ZERO production-code change** (one new file: `functions/tests/timesheet-helpers.test.js`, 7 tests).

**Characterization discipline:** pins the CURRENT behavior AS-IS (quirks included). Verified green (7/7) + cross-checked against source.

## MUST
- **M1 — pins CURRENT behavior + green.** Assertions match `timesheet/helpers.js`: `createTimeEvent` (:57-101), `createReservation` (:125-152), `commitReservation` (:158-165), `rollbackReservation` (:171-179). **7/7 pass** against this repo's code (legacy-js jest, sibling `node_modules` via `modulePaths`; CI runs the real thing).
- **M2 — no production-code change.** Adds ONLY the one `.test.js` + this rubric.
- **M3 — the quirks are pinned** (with comments):
  - `createTimeEvent`/`createReservation` generate ids via `Date.now()+Math.random()` (`'evt_'`/`'rsv_'` prefixes) → non-deterministic → tests pin the PREFIX + the written doc shape, not an exact id.
  - `rollbackReservation` stores `error.message || 'Unknown error'` → an error object with no `.message` is recorded as the literal `'Unknown error'`.
  - the optional-entity-id defaults (`serviceId/stageId/packageId/taskId/timesheetEntryId → null`, `data/before/after → {}`, `processingErrors → []`) + `processed:true` on every event; `status:'pending'`→`'committed'`/`'rolled_back'` transitions.
- **M4 — harness fidelity.** helpers.js captures `const db = admin.firestore()` at module load → the firebase-admin mock is installed before require; `db.collection().doc()` exposes `set`/`update` spies. No timesheet-CF orchestration (this is the leaf module). `test/setup.js` untouched.
- **M5 — scope honesty + characterization discipline.** The fifth export `checkVersionAndLock` is **deliberately NOT tested** — a repo-wide grep (`functions/**/*.js`) found ZERO callers (dead code). Dead code is removed, not pinned; it was flagged as a **separate cleanup task** (chip `task_cf402912`), NOT ported into this goldens net. Every assertion is the observed value; no idealized value.

## PRODUCT-GRADE GATES
- **G1 (errors):** N/A — test-only, no customer path.
- **G2 (rollback):** `git revert <sha>` / delete the one file. Trivial.
- **G3 (monitoring):** N/A — mocks the SDK boundary; nothing writes to Firestore.
- **G4 (test proves scenario):** PASS — exercises the REAL exported helpers end-to-end (input → the actual doc write → return), mocking only the SDK boundary, not the logic (§2.3).
- **G5 (Hebrew UI):** N/A — no customer-facing strings added (the helpers write English/machine fields; their console logs are internal).
- **G6 (breaking change):** N/A — additive test file.
- **G7 (security):** N/A — no auth/PII/permissions surface (event/reservation bookkeeping helpers).

## Anti-premature-closure
- **devils-advocate declared-skip (justified):** test-only, additive, zero production-code change → not a §3.8.4 trigger. A mis-captured assertion self-fails against current code; run green (7/7) + grader source-verify are the gates.
- **Coverage-sweep alignment:** timesheet/helpers.js was named a Tier-3 "characterization-tests-FIRST" target (0 tests, mocked everywhere). This pins the live primitives; `checkVersionAndLock` dead-code removal is the spun-off chip. **NEXT timesheet packages:** `getTimesheetEntries` (read, 0 tests) + `updateTimesheetEntry` payload/guard, then the create-CF shape gaps (fixed / legal_procedure+fixed deduction, currently HOURS-only) — each its own small package.
