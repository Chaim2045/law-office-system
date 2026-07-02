# Rubric — PR-H.6.1 (listUnlinkedSalesRecords CF registration + compiled output)

**Title:** H.6 PR1: Register listUnlinkedSalesRecords CF in index.js + compiled lib
**Branch:** feature/h6-pending-clients
**Base:** main
**Scope:** Wire the already-written `list-unlinked-sales-records.ts` CF into `functions/index.js` (2-line require+export), compile the TS to `functions/lib/`, and commit. This is a LIGHT additive PR — no new business logic, no rules change, no UI.

## MUST criteria (block on FAIL)

### M1 — Registration lines present
**Rule:** `functions/index.js` must contain `require('./lib/tofes-mecher/list-unlinked-sales-records')` and `exports.listUnlinkedSalesRecords`.
**Evidence required:** grep of `functions/index.js` showing both lines.

### M2 — Compiled JS output committed
**Rule:** `functions/lib/tofes-mecher/list-unlinked-sales-records.js` (+ `.js.map`) must exist and be committed.
**Evidence required:** `git diff --cached --name-only` or `git status` showing the files staged.

### M3 — Source TS file present
**Rule:** `functions/src-ts/tofes-mecher/list-unlinked-sales-records.ts` must exist.
**Evidence required:** file existence check.

### M4 — No unrelated changes
**Rule:** The PR diff must only touch `functions/index.js`, add `functions/lib/tofes-mecher/list-unlinked-sales-records.{js,js.map}`, and add `functions/src-ts/tofes-mecher/list-unlinked-sales-records.ts`. No other files modified.
**Evidence required:** `git diff --stat` showing only these files.

### M5 — Registration follows existing pattern
**Rule:** The require/export pair must follow the exact same pattern as adjacent tofes-mecher registrations (e.g., `exportSalesToBigQuery`).
**Evidence required:** visual comparison of adjacent lines.

## SHOULD criteria (warning on FAIL, doesn't block)

### S1 — Blank line separation
**Rule:** The new registration block should be separated from adjacent blocks by a blank line, matching existing style.
**Evidence required:** context view of surrounding lines.

## Out of scope

- The CF implementation itself (already written in the TS file, reviewed in a prior session)
- Tests (the CF's test suite is part of a separate step)
- Admin panel UI (PR2)
- Navigation entry (PR3)

## Rollback

- `git revert <commit>` — removes the 2 registration lines + the compiled output. No data or schema impact.
