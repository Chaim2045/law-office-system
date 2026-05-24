# Rubric — PR-G.3.8: fix TZ bug in WhatsApp Bot today-lookup

**Scope:** `functions/src/whatsapp-bot/WhatsAppBot.js` (3 sites) + new helpers in `functions/shared/calendar.js` + tests. Backend-only (Cloud Function `whatsappWebhook`). No firestore.rules, no frontend, no migrations.

**Origin:** Surfaced by `completeness-checker` during PR-G.3.7 investigation 2026-05-24. Same antipattern class as PR-G.3.7 (calendar.js TZ bug), different module + different shape.

**Bug:**
- `WhatsAppBot.js:996` (`showAllEmployeesTimesheets`) + `:1069` (`showEmployeeTimesheets`): `new Date().toISOString().substring(0, 10)` returns UTC date. Cloud Functions runs in UTC; between 00:00–03:00 IL (winter) / 00:00–04:00 IL (DST), query returns yesterday's date → "אין רישומי שעות להיום" wrongly.
- `WhatsAppBot.js:652` (`showStats`): `new Date().setHours(0,0,0,0)` produces UTC midnight; Firestore Timestamp `where('approvedAt','>=',today)` skews `approvedToday`/`rejectedToday` counts by 3–4h.

**Risk:** Zero data risk (read-only Firestore queries). Worst-case wrong fix = wrong response text. No writes, no aggregates, no audit.

## MUST (10) — blocking

1. **`todayInJerusalemYMD()` helper added + exported.** New function in `functions/shared/calendar.js` using `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' })`. *Evidence:* function defined; exported in `module.exports` and `_test`.

2. **`startOfTodayInJerusalem()` helper added + exported.** New function returning `Date` for IL midnight, suitable for Timestamp `>=` queries. Honors DST via probe-derived offset (not hardcoded). *Evidence:* function defined + exported.

3. **`WhatsAppBot.js:996` fixed.** `showAllEmployeesTimesheets` uses `todayInJerusalemYMD()`. *Evidence:* grep file shows zero `.toISOString().substring` / `.toISOString().slice` after fix.

4. **`WhatsAppBot.js:1069` fixed.** `showEmployeeTimesheets` uses `todayInJerusalemYMD()`. *Evidence:* same grep.

5. **`WhatsAppBot.js:652` (showStats) fixed.** Uses `startOfTodayInJerusalem()`. *Evidence:* grep file shows zero `setHours(0,0,0,0)` after fix.

6. **WhatsAppBot.js imports helpers.** `const { todayInJerusalemYMD, startOfTodayInJerusalem } = require('../../shared/calendar');` at top of file. *Evidence:* require line present near other requires.

7. **TZ-matrix tests prove invariance.** New `functions/tests/whatsapp-bot-tz.test.js` runs helpers under simulated UTC, Asia/Jerusalem, America/Los_Angeles, Pacific/Kiritimati. Critical case: 00:30 IL after UTC midnight returns IL today, not UTC yesterday. *Evidence:* file exists; tests pass.

8. **Existing tests in `quicklog-date-type.test.js` no longer encode the bug.** 4 assertions (`new Date().toISOString().substring(0,10)` as expected-value) rewritten to use the new helper as source of truth. *Evidence:* `git diff functions/tests/quicklog-date-type.test.js` shows replacements with `PR-G.3.8` comment.

9. **All existing tests pass.** Jest + Vitest unchanged. No regression in functions suite. *Evidence:* `npx jest` green.

10. **No data migration, no schema change.** Read-only fix on production query path. *Evidence:* `git diff` shows zero changes to Firestore schemas, rules, or migration scripts.

## SHOULD (4) — non-blocking

1. **Inline comment at import warns against UTC antipattern.** Helps future maintainers see why helper exists. *Evidence:* comment block above `require('../../shared/calendar')` in WhatsAppBot.js.

2. **JSDoc on `todayInJerusalemYMD` + `startOfTodayInJerusalem`.** Explain the bug class and the fix pattern. *Evidence:* JSDoc blocks above each function.

3. **Header at `WhatsAppBot.js:1035` stays consistent with query.** Header uses `toLocaleDateString('he-IL')` (already TZ-correct via locale default); after fix, header day == query day. *Evidence:* no change to line 1035 (already correct).

4. **PR body documents 3 sibling PRs deferred.** G.3.9 (functions/timesheet/index.js WRITE path — HIGH severity), G.3.10 (apps/user-app readers), G.3.11 (ESLint ban + remaining admin sites). *Evidence:* PR body has "Sibling PRs" section.

## Out of scope (deferred)

- **G.3.9** — `functions/timesheet/index.js:160,166` (WRITE path, HIGH severity) — different module + different review weight
- **G.3.10** — `apps/user-app/js/main.js`, `daily-meter.js`, `ai-context-builder.js` — frontend, different deploy path (Netlify, not Cloud Functions)
- **G.3.11** — ESLint `no-restricted-syntax` rule banning `.toISOString().slice(0,N)` + remaining sites in `functions/src/deletion/audit.js`, `functions/admin/master-admin-wrappers.js`, `apps/admin-panel/`
- WhatsApp dist artifacts (rebuilt by deploy)
- Cron / changefeed redeploys (none affected)

## Test outputs required

- Jest: `npx jest` PASS for all suites. New `whatsapp-bot-tz.test.js` adds ~6 tests.
- Vitest: unchanged (no frontend touched).
- Lint: 0 errors.
- Manual smoke (post-deploy): from admin WhatsApp number after 00:00 IL, send "תפריט" → choose timesheets menu → verify response shows TODAY's entries (not yesterday's).
