# Rubric — PR-G.3.7: fix timezone bug in calendar.js date conversion

**Scope:** `functions/shared/calendar.js` + tests. Backend-only (no frontend, no firestore.rules). Discovered during PR-G.3.3 DEV smoke (2026-05-24) when local `seedHolidays.js` execution on Asia/Jerusalem produced dates off by -1 day vs canonical Israeli observance.

**Bug:** `e.getDate().greg().toISOString().slice(0, 10)` converts local-midnight Date to UTC. On Asia/Jerusalem (UTC+3) hosts, Apr 2 local-midnight → Apr 1 21:00 UTC → slice yields `"2026-04-01"` (wrong). Cloud Functions in UTC produces correct output by coincidence.

**Secondary bug:** `HEBCAL_VERSION` constant silently returns `'unknown'` because `require('@hebcal/core/package.json')` throws `ERR_PACKAGE_PATH_NOT_EXPORTED` on Node ≥22 (hebcal v3.50.4 doesn't expose subpath in `exports` field). Try/catch hid the failure.

## MUST (10) — blocking

1. **`_hdateToISO()` helper added + used.** New private function in `calendar.js`. Replaces inline `toISOString().slice(0, 10)` at the one production callsite. Uses `getFullYear/Month/Date` (local Date field readers) — TZ-invariant. *Evidence:* grep `calendar.js` shows zero `toISOString().slice` after fix; `_hdateToISO` called from line 153 area.

2. **`HEBCAL_VERSION` reports real version on Node ≥22.** New implementation walks up from `require.resolve('@hebcal/core')` until finding `package.json` with `name === '@hebcal/core'`. *Evidence:* test `HEBCAL_VERSION is a real semver string` passes; asserts `!== 'unknown'` and matches `/^\d+\.\d+\.\d+/`.

3. **TZ-matrix tests prove invariance.** New `functions/tests/calendar-tz.test.js` runs `getHolidaysForYear(2026)` under 4 simulated timezones (UTC, Asia/Jerusalem, America/Los_Angeles, Pacific/Kiritimati) via `jest.isolateModules` + `process.env.TZ`. *Evidence:* test file exists; 12 TZ-specific tests + 2 cross-TZ equality tests all pass.

4. **Canonical dates asserted (not hebcal tautology).** Tests use dates verified against Chief Rabbinate luach: Pesach I = 2026-04-02, Yom Kippur = 2026-09-21, Purim = 2026-03-03. *Evidence:* `calendar-tz.test.js` has `CANONICAL_2026` constant block with source attribution.

5. **Existing `calendar.test.js` assertions updated to canonical.** Previously encoded the TZ bug (e.g. Pesach I = 2026-04-01). After fix, those dates are wrong. *Evidence:* `git diff functions/tests/calendar.test.js` shows date corrections with `PR-G.3.7` comment explaining each shift.

6. **`_hdateToISO` exported via `_test`.** For unit testing the helper in isolation. *Evidence:* `module.exports._test._hdateToISO` defined; test asserts `typeof _hdateToISO === 'function'`.

7. **All existing tests pass.** No regression in Jest functions suite or root Vitest. *Evidence:* CI green; Jest 549+ pass (was 531 + new); Vitest unchanged.

8. **No `firestore.rules` changes.** Frontend-only TZ fix to a backend module. *Evidence:* `git diff` shows zero rule changes.

9. **No frontend changes (apps/).** EMBEDDED_FALLBACK_2026 already correct (UTC origin); no change needed. *Evidence:* `git diff apps/` is empty.

10. **No new dependencies added.** Fix uses Node stdlib `fs` + `path` only. *Evidence:* `git diff functions/package.json` empty.

## SHOULD (4) — non-blocking

1. **Inline comment at fix site warns against `.toISOString().slice(0,10)`.** Helps future maintainers. *Evidence:* comment at line 153-area says "NEVER use toISOString().slice(0,10) on a local-midnight Date".

2. **JSDoc on `_hdateToISO`.** Explains the bug, the fix, and the invariant. *Evidence:* JSDoc block present.

3. **JSDoc on `HEBCAL_VERSION` walkup explains Node ≥22 subpath-exports issue.** *Evidence:* comment block before constant.

4. **Helper-level unit tests for `_hdateToISO`.** Cover month boundary + zero-padding edge cases. *Evidence:* 3 helper tests in `calendar-tz.test.js`.

## Out of scope (deferred to follow-up PRs)

- ESLint `no-restricted-syntax` rule banning `.toISOString().slice(0,N)` repo-wide → **PR-G.3.11** (task #15)
- Same TZ bug class in WhatsAppBot today-lookup → **PR-G.3.8** (task #12)
- Same TZ bug class in daily-meter today filter → **PR-G.3.9** (task #13)
- Same TZ bug class in main.js stats grouping → **PR-G.3.10** (task #14)
- Cloud Function redeploy (already-deployed cron in UTC produces correct output; cosmetic redeploy when next PR-G.x merges to production-stable)

## Test outputs required

- Jest: `npx jest` PASS for all suites. New `calendar-tz.test.js` adds ~18 tests.
- Vitest: unchanged (no frontend touched).
- Lint: 0 errors.
- Manual: re-run `node scripts/seedHolidays.js` locally on Asia/Jerusalem → produces canonical dates (Pesach I = 2026-04-02).
