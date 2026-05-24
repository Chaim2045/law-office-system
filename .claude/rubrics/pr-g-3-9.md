# Rubric — PR-G.3.9: TZ-safe date normalization in timesheet write paths

**Scope:** `functions/timesheet/index.js` (3 write paths: createQuickLogEntry, createTimesheetEntry_v2, updateTimesheetEntry) + new shared helper `normalizeDateToYMD()` in `functions/shared/calendar.js` + tests. Backend-only.

**Origin:** Surfaced as G.3.8 sibling. Refined by navigator 2026-05-25: bug is THEORETICAL for current frontend (`apps/user-app/js/quick-log.js` always sends ISO string → string path is TZ-safe) but a latent trap for any future caller sending Timestamp / `{seconds, nanoseconds}` constructed from local-IL-midnight.

**Bug class (G.3.7/G.3.8/G.3.9 family):** `d.toISOString().substring(0, 10)` on a Date built from local-midnight → returns UTC date, off by -1.

**Behavioral change (per `functions/CLAUDE.md`):** `createTimesheetEntry_v2` + `updateTimesheetEntry` previously wrote `data.date` raw (stored as whatever caller sent — string OR object). Now: always normalized to `YYYY-MM-DD` string. **Consistency improvement**, not a fallback loosening. Current production frontend already sends strings, so no observable difference; future callers cannot accidentally persist a Timestamp object.

## MUST (10) — blocking

1. **`normalizeDateToYMD(input)` helper added + exported.** New function in `functions/shared/calendar.js`. Accepts string / `{seconds, nanoseconds}` / `{toDate()}` / throws on invalid. *Evidence:* function defined; exported in `module.exports` and `_test`.

2. **`createQuickLogEntry` date-parsing block replaced.** Previous ~30-line block (lines 140-174) replaced with call to `normalizeDateToYMD()`. *Evidence:* `git diff functions/timesheet/index.js` shows block deleted, single normalize call inserted.

3. **`createQuickLogEntry` audit log uses normalized value.** Line 510 (`details.date`) changed from `data.date` (raw) → `dateString` (normalized). *Evidence:* diff shows the change.

4. **`createTimesheetEntry_v2` normalizes `data.date` at top.** After validation, before transaction. *Evidence:* `data.date = normalizeDateToYMD(data.date)` in createTimesheetEntry_v2 function body; error path raises `invalid-argument` HttpsError.

5. **`updateTimesheetEntry` normalizes `data.date` at top.** Same pattern. *Evidence:* same code in updateTimesheetEntry.

6. **timesheet/index.js imports helper.** `const { normalizeDateToYMD } = require('../shared/calendar');` at top with explanatory comment. *Evidence:* require line + comment present.

7. **New `normalize-date-ymd.test.js` covers all input shapes.** Tests: string (YYYY-MM-DD, full ISO, ISO with offset, invalid) + {seconds} (UTC midnight, **local-IL-midnight critical case**, winter no-DST, DST summer, nanoseconds tolerated) + Timestamp.toDate() (valid, local-IL-midnight, invalid Date) + invalid inputs (null, undefined, number, unrecognized object) + 4-TZ matrix proving the local-IL-midnight critical case yields `'2026-04-02'` under UTC / Asia/Jerusalem / America/Los_Angeles / Pacific/Kiritimati. *Evidence:* test file exists; all tests pass.

8. **All existing tests pass.** Jest suite. Existing `quicklog-date-type.test.js` (which mocks createQuickLogEntry inputs) still green — output format unchanged. *Evidence:* `npx jest` PASS for full suite.

9. **No `firestore.rules`, no schema, no migration.** Output to Firestore unchanged (still `YYYY-MM-DD` string). No back-fill needed; existing entries keep their format. *Evidence:* `git diff` confined to `functions/`.

10. **No frontend changes.** `apps/user-app/js/quick-log.js` already sends ISO string; no change needed. *Evidence:* `git diff apps/` empty.

## SHOULD (4) — non-blocking

1. **Explanatory comments at import + helper.** JSDoc on `normalizeDateToYMD` explains the bug class + accepted shapes. Inline comment in timesheet/index.js warns against UTC antipattern. *Evidence:* JSDoc + comments present.

2. **Behavioral change documented in PR body.** Explicit statement that createTimesheetEntry_v2 / updateTimesheetEntry now normalize (previously raw). Confirms no observable difference for current frontend. *Evidence:* "Behavioral change" section in PR body.

3. **Error path uses HttpsError with invalid-argument code.** Mirrors existing pattern in same file. *Evidence:* try/catch wraps the normalize call in each function.

4. **Helper-level tests use TZ matrix.** Proves the critical case independently of host TZ (not just CI-default UTC). *Evidence:* `test.each(TZS)` block in test file.

## Out of scope (deferred)

- **G.3.10** — `apps/user-app/js/main.js`, `daily-meter.js`, `ai-context-builder.js` (frontend readers)
- **G.3.11** — ESLint `no-restricted-syntax` ban on `.toISOString().slice/substring(0,N)` + remaining admin sites + audit
- `apps/user-app/js/modules/firebase-server-adapter.js` etc. — frontend callers of createTimesheetEntry_v2/updateTimesheetEntry are out of scope (this PR only normalizes backend receive-side)
- `functions/admin/master-admin-wrappers.js`, `functions/src/deletion/audit.js` — G.3.11 candidates

## Test outputs required

- Jest: `npx jest` PASS. New `normalize-date-ymd.test.js` adds ~20 tests.
- Vitest: unchanged.
- Lint: 0 errors.
- Manual: no smoke required — refactor + helper addition with full test coverage. Existing frontend behavior unchanged.
