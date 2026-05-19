# Rubric — PR-G.1

**Title:** feat(functions): Hebrew calendar infrastructure — `@hebcal/core` + cron sync + `system_holidays` collection
**Branch:** feat/holidays-calendar-sync-pr-g-1
**Base:** main
**Files:** new `functions/shared/calendar.js` + addition to `functions/scheduled/index.js` + `functions/package.json` dep + tests + rubric
**Scope:** Infrastructure layer for PR-G series. Adds offline Israeli holiday calendar (`@hebcal/core` npm), daily cron that computes 6 years of holidays (current + 5 forward), writes to `system_holidays/{year}` Firestore collection. **Backward-compatible** — nothing in existing code reads from this collection yet. PR-G.2 will wire frontend; PR-G.3 will wire daily-meter.

## Why now

- Existing `apps/{user-app,admin-panel}/js/modules/work-hours-calculator.js` hardcodes holidays for 2024-2026 only → **system breaks January 2027** for any monthly-quota computation.
- Daily-meter (PR-F) only knows Fri/Sat → marks holiday workdays as missing.
- hachnasovitz bot uses `Hebcal API` correctly — but only for the bot. Frontend has zero infrastructure.
- Single source of truth (`system_holidays/{year}` in Firestore) closes the gap with PR-A/B/D pattern (canonical write, derived reads).

## Why offline `@hebcal/core` not Hebcal API

- Deterministic: same input → same output, no network dependency
- Cron reliable: doesn't depend on hebcal.com uptime at 03:00 IL
- No CSP/CORS concern for frontend (frontend reads Firestore, not Hebcal)
- Version-pinned via npm — API changes are opt-in
- ~1ms compute vs ~200-500ms HTTP
- Firestore-stored output enables ADMIN manual override (mark Yom Atzma'ut as half-day, etc.)

## Risk profile

**Low.** Additive only. No existing code reads from `system_holidays`. Cron failures don't affect any user flow. New npm dep is well-maintained (Hebcal.com official package, MIT, 5k+ downloads/week).

## MUST criteria (block on FAIL)

### M1 — `@hebcal/core` added to functions/package.json
**Rule:** Dependency added with a pinned version (caret-pinned to current major). Latest stable at time of writing.
**Evidence required:** Diff of `functions/package.json` + `package-lock.json` mention.

### M2 — `functions/shared/calendar.js` module created
**Rule:** Exports:
- `getHolidaysForYear(year: number): Holiday[]` — returns canonical array of holiday objects for the requested Gregorian year, deterministic + offline.
- `isWorkday(dateISO: string, holidaysMap?: Map): boolean` — true unless Fri/Sat/holiday.
- `getDayInfo(dateISO: string, holidaysMap?: Map): DayInfo` — `{ type, holiday?, isHolidayEve, isHalfDay, eveOf?, isWorking }`.
- `_test` export with internal helpers for unit testing.

**Holiday object shape:**
```js
{
  date: '2026-09-12',
  type: 'holiday' | 'eve' | 'memorial' | 'fast' | 'modern',
  nameHe: 'ראש השנה',
  nameEn: 'Rosh Hashana',
  isWorking: false,    // true for Chanukah-style "holiday but office open"
  isHalfDay: false,    // true for holiday eves where office closes early
  eveOf: null          // 'Rosh Hashana' if this is "Erev Rosh Hashana"
}
```

**Evidence required:** File exists, exports listed.

### M3 — Cron `holidaysCalendarSync` registered
**Rule:** New `onSchedule` in `functions/scheduled/index.js`:
- Schedule: `'0 3 * * *'` (03:00 IL)
- Timezone: `'Asia/Jerusalem'`
- Region: `'us-central1'` (matches existing crons)
- For each year in `[currentYear ... currentYear + 5]`:
  - Compute `holidays` via `getHolidaysForYear(year)`
  - Upsert to `system_holidays/{year}` (write only if hash differs — avoid useless writes)
- Exported from `functions/index.js`.

**Evidence required:** Code + export + diff confirms cron schedule + 6-year range.

### M4 — Firestore `system_holidays/{year}` schema
**Rule:** Each year document:
```js
{
  year: <number>,
  generatedAt: serverTimestamp(),
  source: '@hebcal/core@x.y.z',
  holidays: Holiday[],  // M2 shape
  contentHash: <SHA1 hex of holidays JSON>  // for change detection
}
```
**Evidence required:** Reading the cron code; doc shape matches.

### M5 — Idempotent writes (avoid daily churn)
**Rule:** Cron computes `contentHash` for new holidays array. Reads current Firestore doc. If hash matches → skip write. Otherwise → upsert. Logged either way.
**Evidence required:** Code + comment.

### M6 — Initial seed before cron's first run
**Rule:** A `seedHolidays.js` script in `functions/scripts/` that can be run manually with admin credentials to populate `system_holidays/{2026}..{2031}` immediately. Documented in PR body. Optional — admin can also wait 24h for first cron tick.
**Evidence required:** Script + comment.

### M7 — Tests cover calendar logic
**Rule:** `functions/tests/calendar.test.js`:
- `getHolidaysForYear(2026)` returns Rosh Hashana on 2026-09-12 (known)
- `getHolidaysForYear(2027)` returns reasonable count (>15, <30)
- `isWorkday('2026-09-12')` → false (Rosh Hashana)
- `isWorkday('2026-09-13')` → false (Rosh Hashana day 2)
- `isWorkday('2026-09-14')` → true (workday Monday after RH)
- `isWorkday('2026-12-25')` → true (Gregorian Christmas, irrelevant)
- `isWorkday('2026-05-22')` → false (Friday)
- `isWorkday('2026-12-26')` → false (Saturday)
- `getDayInfo('2026-09-11')` → `{ type: 'eve', isHolidayEve: true, eveOf: 'Rosh Hashana' }`
- `getDayInfo('2026-12-08')` → `{ type: 'holiday' or 'modern', isWorking: true }` (Chanukah, working)

**Evidence required:** Test file + Jest output.

### M8 — Nothing existing breaks
**Rule:** No changes to JS source code outside additions. All existing tests still pass. Existing `dailyInvariantCheck` cron unchanged.
**Evidence required:** Jest + Vitest + lint output.

### M9 — Existing `dailyInvariantCheck` does NOT yet consume holidays
**Rule:** PR-G.1 stays infrastructure-only. `dailyInvariantCheck` Check 6 (PR-C.1) does not start reading holidays. That's deferred to a follow-up.
**Evidence required:** Code diff confirms.

### M10 — Lint zero + Jest green
**Rule:** functions Jest + root Vitest green. `npm run lint` 0 errors.
**Evidence required:** Output.

## SHOULD criteria

### S1 — Doc comment on each export explains canonical behavior
**Rule:** JSDoc on `getHolidaysForYear`, `isWorkday`, `getDayInfo` with examples + edge cases (Chanukah is working, holiday eves are half-day).
**Evidence required:** Comments.

### S2 — Seed script documented in PR body
**Rule:** PR description shows how to run `node functions/scripts/seedHolidays.js` with admin credentials.
**Evidence required:** PR body.

### S3 — PR description names PR-F predecessor + PR-G.2/G.3 follow-up + offline rationale
**Evidence required:** PR body.

### S4 — Firestore Rules note in PR body
**Rule:** PR body notes that `system_holidays/{year}` should be readable by authenticated users (`allow read: if request.auth != null`). Write = admin SDK only. Rules update is FUTURE work — not in G.1 (G.1 is admin-SDK-only writes; reads start in G.2).
**Evidence required:** PR body.

## Out of scope

- Frontend reads (PR-G.2)
- daily-meter holiday integration (PR-G.3)
- Removing hardcoded 2024-2026 in `apps/*/work-hours-calculator.js` (PR-G.2.1 cleanup after G.2 stable)
- hachnasovitz bot changes (Skip — see PR-G discussion; bot works correctly with Hebcal API)
- Firestore Rules changes for `system_holidays` reads (PR-G.2)
- Admin UI for manual holiday override (future, separate)
- `dailyInvariantCheck` consuming holidays (separate)

## Rollback

`git revert <merge-commit>` → cron disappears, `system_holidays` collection orphans. No data corruption. New npm dep stays in package-lock until next install — harmless.

## Notes for grader

- `@hebcal/core` is the official Hebcal library. Same calendar data as Hebcal.com but offline.
- Holiday classification per `@hebcal/core`: `Yom Tov` (full holiday), `Erev` (eve), `Cholha-Moed` (intermediate days). Halacha-driven, accurate.
- Chanukah is a "working holiday" — we mark `isWorking: true` so frontend treats it as a normal workday (but with badge).
- Holiday eves (`Erev`) we mark `isHalfDay: true` — office closes early. daily-meter (PR-G.3) will use this to reduce daily target.
- The 6-year forward window covers compute + 5 forward years. Roughly 5KB per year in Firestore = ~30KB total. Negligible.
