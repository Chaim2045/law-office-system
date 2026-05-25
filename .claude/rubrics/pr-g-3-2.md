# Rubric — PR-G.3.2

**Title:** feat(frontend): wire consumers to holidays cache — daily-meter + work-hours-calculator (PR-G.3.2)
**Branch:** feat/holidays-consumers-pr-g-3-2
**Base:** main
**Scope:** Phase B of split PR-G.3. Wires frontend consumers to `window.WORK_HOURS_HOLIDAYS_MAP` (PR-G.3.1 infra). Behavioral changes: holidays + eves no longer show "missing" badge; weekly/monthly quota excludes eves AND holidays. PR-G.3.3 deferred (cron `auto` vs `overrides` split).

**Predecessor:** PR-G.3.1 (#311).

## New office policy (Tommy 2026-05-20)

**אין עבודה בערב חג.** Holiday eves are NO LONGER half-day. Treated as full non-working days, same as the holiday itself. Both removed from workday counts and target calcs.

This is a **behavioral change** per `apps/user-app/CLAUDE.md` rules. Documented in PR body + inline comments.

## Implementation rule

Frontend treats any holiday entry where `!h.isWorking || h.isHalfDay` as a **non-working day**.
- `h.isWorking === false` → holiday (always non-working)
- `h.isHalfDay === true` → eve (per new policy: non-working)

Source data (Firestore `system_holidays`) keeps original Hebcal semantics. The OFFICE INTERPRETATION lives in the frontend.

## MUST criteria (block on FAIL)

### M1 — `work-hours-calculator.js` (×2) rewrite
**Rule:**
- DELETE hardcoded `holidays2024`, `holidays2025`, `holidays2026`, `allHolidays` arrays in constructor.
- `isHoliday(date)` reads `window.WORK_HOURS_HOLIDAYS_MAP` LIVE on every call (no caching) — handles late population + real-time admin edits.
- `isHoliday()` returns `true` when map entry has `!h.isWorking || h.isHalfDay`.
- `isWorkDay()` returns `false` when `Fri || Sat || isHoliday`.
- `getHolidayName(date)` returns `h.nameHe` from map.
- Constructor signature unchanged: `(dailyHoursTarget = null)`.
- Files BYTE-IDENTICAL (`diff -q`).
- Inline comment notes the live-read rationale (R1 mitigation).

**Evidence required:** Reading the diff.

### M2 — `daily-meter.js` `_renderWeekBody` holiday awareness
**Rule:**
- For each day in the week range, look up `window.WORK_HOURS_HOLIDAYS_MAP.get(dateStr)`.
- If entry exists AND `!h.isWorking || h.isHalfDay`:
  - Day class: `'holiday'` (new CSS state — yellow/gold subtle tint)
  - Badge: `fa-star-of-david` cream icon
  - Label suffix: holiday Hebrew name
  - **No "missing" badge** even on zero-entry day
  - Day counts as non-workday in `workdayCountElapsed`
- Existing Fri/Sat detection unchanged (weekend wins display, but isHoliday on Sun-Thu still flags).
- Tooltip on holiday day: `nameHe`.

**Evidence required:** Reading the code; new CSS class added.

### M3 — `statistics.js:339-362` fix
**Rule:** Replace inline `dayOfWeek !== 5 && dayOfWeek !== 6` loop with `calculator.isWorkDay(date)` (instance already at line 333). The Hebrew comment ("מוריד שישי-שבת וחגים") becomes truthful.

**Evidence required:** Reading the diff.

### M4 — `statistics-calculator.js:381-404` fix
**Rule:** Instantiate `new window.WorkHoursCalculator(employeeData.dailyHoursTarget)` mirroring `statistics.js:333`; replace inline loop with `calculator.isWorkDay(date)`.

**Evidence required:** Reading the diff. (NOTE: monthlyGoal=160 hardcode in same file is **out of scope** — defer to G.4 per Tommy.)

### M5 — `holidays-cache.js` minor improvements
**Rule:**
- Add `window.dispatchEvent(new Event('holidays:loaded'))` after first `_rebuildMap()` resolves (R2 mitigation — consumers can listen + re-render).
- Add `console.warn` if `currentYear+1` not in `_yearsLoaded` after 5s timeout (R9 mitigation).
- Add `window.WORK_HOURS_HOLIDAYS_CACHE._test.setMap(map)` exposed for fixture injection in vitest (R8 mitigation).

**Evidence required:** Reading the diff; cache file remains byte-identical between the two apps.

### M6 — New "חג" badge in daily-meter.css
**Rule:** New CSS class `.gh-daily-meter-popup-day.holiday`:
- Distinct background tint (gold/yellow, NOT red like missing)
- Badge icon style (`.gh-daily-meter-popup-day-badge.holiday`) — cream FA icon
- Tooltip-friendly

**Evidence required:** CSS diff.

### M7 — `WorkloadCalculator.js:1722-1730` fallback cleanup
**Rule:** The Fri/Sat-only fallback when `workHoursCalculator` is null becomes unnecessary (calculator always works after wiring). Either DELETE the fallback OR keep with a comment that says "should never fire — calculator construction never throws now".

**Evidence required:** Reading the code.

### M8 — Tests cover new behavior
**Rule:** New vitest test file `tests/unit/user-app/holidays-consumer-isworkday.test.ts`:
- WorkHoursCalculator.isWorkDay returns false for known holiday from map (e.g. Pesach I 2026-04-02)
- isWorkDay returns false for known eve from map (e.g. Erev Pesach 2026-04-01)
- isWorkDay returns true for normal weekday with no map entry
- isWorkDay returns false for Friday/Saturday regardless of map content
- Constructor does NOT throw when map is empty
- Test fixture injects via `window.WORK_HOURS_HOLIDAYS_CACHE._test.setMap(...)`

**Evidence required:** Test file + Vitest output.

### M9 — Existing tests still pass
**Rule:** All PR-F daily-meter tests (216 from prior) + PR-G.3.1 tests (13) still green. Plus the new tests from M8.

**Evidence required:** Test runner output.

### M10 — Lint zero + Vitest green
**Rule:** `npm run lint` → 0 errors. `npx vitest run` → 229+ tests pass.
**Evidence required:** Output.

## SHOULD criteria

### S1 — Migration comments tagged PR-G.3.2
**Evidence required:** Comments in every modified file.

### S2 — Behavioral change note in PR body
**Rule:** PR description explicitly calls out: "אין עבודה בערב חג — new policy 2026-05-20. Eves no longer show as 'missing'/half-day. They're full non-working days now."
**Evidence required:** PR body.

### S3 — Tooltip on daily-meter holiday badge
**Rule:** Hover the new "חג" badge → shows Hebrew holiday name.
**Evidence required:** Reading the code.

### S4 — Friday-eve precedence comment
**Rule:** Inline comment notes: when a date is both Friday AND eve (e.g. Erev RH 2026 = Fri Sept 11), weekend wins display priority. Behavior unchanged from G.3.1.
**Evidence required:** Comment.

## Out of scope (deferred)

- **G.3.3:** Firestore schema split (`system_holidays/{year}/auto` + `/overrides`).
- **G.4:** `statistics-calculator.js` `monthlyGoal=160` hardcode fix.
- HOLIDAY_EVE_TARGET constant — kept in shared file with DEPRECATED comment but no consumer.
- Per-employee target × eve ratio (made moot by new policy).
- Mobile UX (popup `display:none` ≤ 768px — unchanged).

## Rollback

`git revert <merge-commit>` → consumers go back to ignoring holidays. Behavior reverts to "Fri/Sat-only" which the old code already does. Holidays Map still populated (G.3.1 infra) but unread. Zero data corruption.

## Notes for grader

- R1 (stale calculator) fully mitigated by live-read pattern — no caching in constructor or methods.
- R2 (sync vs async) — `holidays:loaded` event dispatch lets consumers re-render once map ready. For first-paint accuracy, daily-meter's lazy nature (popup opens on click, by then map is ready) sidesteps the issue.
- R3 (`allHolidays` external readers) — navigator confirmed NO external consumers. Safe to delete.
- R6 (Friday-eve precedence) — weekend wins display, but `isHoliday()` still returns true. `_renderWeekBody` shows "שישי" (weekend label) not "ערב חג" — minor visual quirk acceptable.
- R7 (behavioral change visible) — Yom Kippur 2026 (Sun) currently shows red "missing"; post-PR shows yellow "חג". Tommy approved as policy change.
