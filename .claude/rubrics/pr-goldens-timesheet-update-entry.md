# Rubric — PR-GOLDENS-timesheet-update-entry: characterization tests for updateTimesheetEntry (validation + payload + editHistory + auth + errors)

**Scope:** Third **timesheet** package of the financial-correctness goldens track (budget-tasks closed via #500/#501/#502; timesheet/helpers.js #503; getTimesheetEntries #504). Pins `updateTimesheetEntry` (`functions/timesheet/index.js:1327`) — a complex WRITE callable (transaction). Its **−10h overdraft guard** is ALREADY covered by `tests/update-guard.test.js` (9 tests across hours + legal_procedure); this package pins the parts that focus does NOT assert. **Test-only, additive — ZERO production-code change** (one new file: `functions/tests/timesheet-update-entry-payload.test.js`, 17 tests + this rubric).

**Characterization discipline:** pins the CURRENT behavior AS-IS (quirks included). Verified green (17/17) + cross-checked against source (`timesheet/index.js:1327-1622`, read in full before writing) + the real shared/calendar `normalizeDateToYMD` (`shared/calendar.js:162-193`, string branch = `input.substring(0,10)`, deterministic → no TZ flake).

## MUST
- **M1 — pins CURRENT behavior + green.** Assertions match the source:
  - the 5 pre-transaction guards (`:1332`/`:1339`/`:1349-1353`/`:1355`/`:1362`): missing entryId → `'חסר מזהה רשומה'`; missing date → `'חסר תאריך'`; unparseable date → the surfaced `normalizeDateToYMD` message; `typeof minutes !== 'number' || minutes <= 0` → `'דקות חייבות להיות מספר חיובי'` (both `0` and the string `'90'`); non-array editHistory → `'חסרה היסטוריית עריכה'` — each `HttpsError('invalid-argument', …)`.
  - auth: entryDoc `!exists` → `'not-found'` (`:1400`); non-admin editing another's entry → `'permission-denied'` (`:1410`), no write; admin edits anyone's (`:1410` gate).
  - entry payload (`:1533-1545`, `:1591`): `date` normalized, `minutes`, `hours = minutes/60`, `lastEditedAt = serverTimestamp`, `lastEditedBy = user.username`, `action` present ONLY when `data.action !== undefined`.
  - editHistory normalization (`:1503-1530`): ISO string → `Timestamp.fromDate`; serverTimestamp placeholder → `Timestamp.now()`; existing `{seconds,nanoseconds}` → passthrough UNCHANGED; anything else → `Timestamp.now()`.
  - task mirror (`:1548-1582`, `:1596`): matching `entryId` in `task.timeEntries` refreshed (minutes/hours/`action||entry.action`/lastEditedAt), non-matching untouched, `lastActivity` stamped.
  - catch (`:1613-1620`): HttpsError rethrown verbatim; else `HttpsError('internal', 'שגיאה בעדכון רשומת שעתון: …')`.
  **17/17 pass** (legacy-js jest, sibling `node_modules` via `modulePaths`; CI runs the real thing).
- **M2 — no production-code change.** Adds ONLY the one `.test.js` + this rubric. `functions/timesheet/index.js` is byte-unchanged.
- **M3 — no overlap with update-guard.test.js.** The tests deliberately pass **NO `data.clientId`** → `clientDoc2` is null → the blocked-service + −10h overdraft blocks are skipped, so this suite exercises the validation/payload/editHistory/auth/task/error surface WITHOUT re-testing the guard update-guard.test.js owns.
- **M4 — the security gate is pinned.** The owner-or-admin edit gate (`user.role !== 'admin' && entryData.employee !== user.email` → permission-denied) is pinned in both directions (intruder blocked + no write; admin allowed) — a rewrite that drops it fails a golden.
- **M5 — harness fidelity.** Mirrors `tests/update-guard.test.js` (same SDK-boundary mock set mounting the whole `timesheet/index.js` graph; the rest — incl. the REAL `shared/calendar` — loads as real modules), with the doc refs `_collection`-tagged to separate the entry write from the task write, and order-keyed `mockTransaction.get.mockResolvedValueOnce`. Mocks the SDK boundary, not the logic (§2.3). `test/setup.js` untouched.

## PRODUCT-GRADE GATES
- **G1 (errors):** N/A — test-only. (The suite PINS the customer-facing Hebrew strings for all 5 guards + not-found + permission-denied + the `שגיאה בעדכון רשומת שעתון` wrap — guarding G1 against a rewrite.)
- **G2 (rollback):** `git revert <sha>` / delete the one file. Trivial.
- **G3 (monitoring):** N/A — the suite adds no write path (it characterizes an existing one).
- **G4 (test proves scenario):** PASS — exercises the REAL exported `updateTimesheetEntry` end-to-end (every guard, owner vs intruder vs admin, the entry + task writes, all 4 editHistory branches, both error branches), mocking only the SDK boundary.
- **G5 (Hebrew UI):** N/A — no customer-facing strings added.
- **G6 (breaking change):** N/A — additive test file.
- **G7 (security):** N/A to change, RELEVANT to coverage — pins the owner-or-admin edit gate (M4), the confidentiality/authorization invariant a JS→TS rewrite must not drift.

## Anti-premature-closure
- **devils-advocate declared-skip (justified):** test-only, additive, zero production-code change → not a §3.8.4 trigger. A mis-captured assertion self-fails against current code; run green (17/17) + grader source-verify are the gates.
- **Coverage-sweep alignment:** `updateTimesheetEntry` payload/delta was named unasserted in `pr-goldens-timesheet-get-entries.md`. This closes its validation/payload/editHistory/auth/task/error surface; the −10h guard stays owned by `update-guard.test.js`. **NEXT goldens:** the create-CF shape gaps — `createQuickLogEntry` / `createTimesheetEntry_v2` / `addTimeToTaskWithTransaction` deduction across service types (fixed / legal_procedure+fixed currently thinner than HOURS) — each its own package.
