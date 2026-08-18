# Rubric — PR-GOLDENS-timesheet-get-entries: characterization tests for getTimesheetEntries

**Scope:** Second **timesheet** package of the financial-correctness goldens track (budget-tasks closed via #500/#501/#502; timesheet/helpers.js via #503). Pins `getTimesheetEntries` (`functions/timesheet/index.js:1269`) — a pure READ callable that had ZERO direct tests. It builds a `timesheet_entries` query, applies an admin-vs-employee visibility filter + optional clientId/date filters, and returns `{success, entries}`. **Test-only, additive — ZERO production-code change** (one new file: `functions/tests/timesheet-get-entries.test.js`, 8 tests + this rubric).

**Characterization discipline:** pins the CURRENT behavior AS-IS (quirks included). Verified green (8/8) + cross-checked against source (`timesheet/index.js:1269-1321`, read in full before writing).

## MUST
- **M1 — pins CURRENT behavior + green.** Assertions match the source: non-admin → `where('employee','==',user.email)`; admin → no employee filter; `data.clientId`→`where('clientId','==',v)`; `data.startDate`→`where('date','>=',v)`; `data.endDate`→`where('date','<=',v)`; return `{success:true, entries:[{id,...data}]}`; catch rethrows an `HttpsError` verbatim, wraps anything else as `HttpsError('internal', 'שגיאה בטעינת רישומי שעות: …')`. **8/8 pass** (legacy-js jest, sibling `node_modules` via `modulePaths`; CI runs the real thing).
- **M2 — no production-code change.** Adds ONLY the one `.test.js` + this rubric. `functions/timesheet/index.js` is byte-unchanged.
- **M3 — the security-critical gate is pinned.** The employee-scoping `where('employee','==',email)` is the confidentiality boundary (a non-admin must never see another employee's entries). Two tests pin it: non-admin APPLIES it, admin does NOT — so a future rewrite that drops or inverts the gate fails a golden.
- **M4 — quirks pinned** (with comments): filters applied verbatim (no whitelist/validation/normalization at this layer); the catch-rethrow-vs-wrap contract (HttpsError passes through; any other error → `internal` + the exact Hebrew prefix).
- **M5 — harness fidelity.** Mounts the whole `timesheet/index.js` require graph the way `tests/update-guard.test.js` does (same SDK-boundary mock set: firebase-admin / firebase-functions / firebase-functions/v2/firestore / shared-auth / shared-audit / shared-validators — the rest of the graph loads as REAL modules, not mocked, so the read path is exercised end-to-end), plus a chainable query fake (mirrors `tests/budget-task-create-adjust-get.test.js`) that records every `.where()`. Mocks the SDK boundary, not the logic (§2.3). `test/setup.js` untouched.

## PRODUCT-GRADE GATES
- **G1 (errors):** N/A — test-only, no customer path. (The suite itself PINS the customer-facing Hebrew error prefix `שגיאה בטעינת רישומי שעות`, guarding G1 against a future rewrite.)
- **G2 (rollback):** `git revert <sha>` / delete the one file. Trivial.
- **G3 (monitoring):** N/A — read-only CF; the suite adds no write path.
- **G4 (test proves scenario):** PASS — exercises the REAL exported `getTimesheetEntries` end-to-end (admin vs employee, filtered vs unfiltered, happy + both error branches), mocking only the SDK boundary.
- **G5 (Hebrew UI):** N/A — no customer-facing strings added.
- **G6 (breaking change):** N/A — additive test file.
- **G7 (security):** N/A to change, but RELEVANT to coverage — the suite pins the `where('employee','==',email)` visibility gate (M3), which is exactly the confidentiality invariant a JS→TS rewrite must not drift.

## Anti-premature-closure
- **devils-advocate declared-skip (justified):** test-only, additive, zero production-code change → not a §3.8.4 trigger. A mis-captured assertion self-fails against current code; run green (8/8) + grader source-verify are the gates.
- **Coverage-sweep alignment:** `getTimesheetEntries` was named the NEXT timesheet goldens target in `pr-goldens-timesheet-helpers.md` (§Coverage-sweep). **NEXT timesheet package:** `updateTimesheetEntry` (`:1327`) — a complex WRITE path (transaction + a −10h guard across 3 service types + editHistory-timestamp normalization + delta write); its guard is partially covered by `update-guard.test.js` but the update PAYLOAD/delta is unasserted → its own dedicated package. Then the create-CF shape gaps (fixed / legal_procedure+fixed deduction, currently HOURS-only).
