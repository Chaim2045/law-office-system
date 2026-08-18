# Rubric — PR-GOLDENS-2: characterization tests for createBudgetTask payload + adjustTaskBudget semantics + getBudgetTasks (budget-tasks)

**Scope:** Second package of the financial-correctness **goldens track** (post-cleanup REASSESS 2026-07-31; package 1 = completeTask+cancelBudgetTask, merged #500). Pins three under-covered `functions/budget-tasks/index.js` surfaces: (a) `createBudgetTask`'s WRITTEN task-doc + approval-record payloads (executed by the idempotency suite, but the payloads were **never asserted**); (b) `adjustTaskBudget`'s budget-change SEMANTICS (only its idempotency was tested, never the adjustment math/record); (c) `getBudgetTasks`, which had ZERO tests. **Test-only, additive — ZERO production-code change** (one new file: `functions/tests/budget-task-create-adjust-get.test.js`, 12 tests).

**Characterization discipline:** pins the CURRENT behavior AS-IS (quirks included), asserting what the code DOES — not what it "should". A characterization test that doesn't pass against current code is wrong; these were verified green (12/12) and cross-checked line-by-line against source.

## MUST
- **M1 — pins CURRENT behavior + green.** All assertions match `budget-tasks/index.js`: `createBudgetTask` taskData (:168-203) + approvalRecord (:279-293) + the `||` estimate coercion (:74-75); `adjustTaskBudget` adjustment/updateData (:1015-1037) + return (:1052-1059); `getBudgetTasks` query (:442-471). **12/12 pass** against this repo's code (legacy-js jest, sibling `node_modules` via `modulePaths` — this repo's `functions/node_modules` is partial; CI runs the real thing).
- **M2 — no production-code change.** Adds ONLY the one `.test.js` + this rubric. No `functions/**/*.js` (non-test) / rules / schema / config.
- **M3 — the named quirks are pinned** (with explicit comments):
  - `createBudgetTask` hardcodes `status:'פעיל'` + writes an approval record `status:'auto_approved'`/`autoApproved:true` (no approval is actually gated).
  - estimate coercion is `||`-based (`estimatedMinutes || estimatedHours*60`), pinned via the hours-only case (2h → 120m).
  - `originalEstimate` is a snapshot of `estimatedMinutes`; `employee` stores the EMAIL; actuals zeroed; array fields `[]`.
  - `adjustTaskBudget` records `type:'decrease'` when `addedMinutes === 0` (a no-op adjust is a "decrease").
  - `adjustTaskBudget` `reason` defaults to `'לא צוין'`; `updateData` never contains `originalEstimate`/`actualMinutes`; `estimatedHours = newEstimate/60`; the adjustment rides inside `FieldValue.arrayUnion(...)`.
  - `getBudgetTasks`: non-admin filtered by `where('employee','==',email)`; admin gets NO employee filter; `data.status` applied verbatim (no whitelist).
- **M4 — harness fidelity.** Mirrors `tests/budget-task-idempotency.test.js` (SDK-boundary mock, `_collection`-tagged write filters) + a chainable query fake (records `.where()` args + a configurable snapshot) for `getBudgetTasks`. `test/setup.js` untouched. Tests run with NO `idempotencyKey` so the create/adjust paths make a single read (client / task) — the payload is the subject, not the idempotency machinery (already covered).
- **M5 — characterization discipline.** Every assertion is the observed value; no "corrected"/idealized value. Covers the write payloads, the approval record, the adjustment record + its arrayUnion wrapper, the return shapes, the visibility query, and the `הושלם`-blocks-adjust reject path.

## PRODUCT-GRADE GATES
- **G1 (errors):** N/A — test-only, no customer path.
- **G2 (rollback):** `git revert <sha>` / delete the one file. Trivial.
- **G3 (monitoring):** N/A — mocks the SDK boundary; nothing writes to Firestore.
- **G4 (test proves scenario):** PASS — exercises the real handlers end-to-end (input → validation → transaction body / query → writes → return), mocking only the SDK boundary, not the logic (§2.3).
- **G5 (Hebrew UI):** N/A — Hebrew literals are pinned contract anchors from existing code (`'פעיל'`, `'auto_approved'`, `'לא צוין'`, the message string), not new customer text.
- **G6 (breaking change):** N/A — additive test file.
- **G7 (security):** N/A-with-note — pins `getBudgetTasks`'s admin-vs-employee visibility gate as a regression net; changes no auth code.

## Anti-premature-closure
- **devils-advocate declared-skip (justified):** test-only, additive, zero production-code change → not a §3.8.4 trigger. A mis-captured assertion self-fails against current code; run green (12/12) + grader source-verify are the gates.
- **Track progress:** package 1 (complete/cancel) #500 merged. This = package 2. Remaining: package 3 = extendTaskDeadline (direct-get/direct-update harness + the audit-throws-fails-call quirk) + the addTimeToTask wrapper. Then move to the next writer (timesheet/helpers — 0 tests) as its own package.
