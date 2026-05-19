# Rubric — PR-F (Daily Meter Week View)

**Title:** feat(user-app): week view + missing-day detection in daily meter popup
**Branch:** feat/daily-meter-week-view
**Base:** main
**Files:** `apps/user-app/js/modules/components/sidebar/daily-meter.js` + `.css` only
**Scope:** Extend existing sidebar daily-meter popup with a tab toggle (היום / השבוע). Week view shows last 7 days grouped by date, per-client breakdown per day, and flags workdays with zero reports. Closes the "silent miss" gap identified in deep audit (TIME-TRACKING-FLOW.md Section "Open Issues").

## Why now

- Existing meter shows TODAY only. Users can't verify week-level coverage.
- "Silent miss" failure mode: user submits but network fails before response → may not know it never registered. Week view exposes missing days visually.
- Existing component already wires `window.manager.timesheetEntries` real-time. Extension reuses the same data source — zero backend, zero new fetch.
- Ring icon stays unchanged — no UX surprise.

## Risk profile

**Low.** Frontend-only. Same data source. No new state outside component. No new dependencies. No tsconfig change. Mobile-only-hidden popup unchanged in behavior.

## MUST criteria (block on FAIL)

### M1 — Tab toggle in popup header
**Rule:** Popup header gets two pill buttons "היום" / "השבוע". Active tab visually distinct. Default tab on open: "היום" (current behavior preserved).
**Evidence required:** Code + CSS class for `.gh-daily-meter-popup-tabs`.

### M2 — "השבוע" tab renders last 7 days
**Rule:** Computes Sunday..Saturday range based on `Asia/Jerusalem` current week. For each day, render:
- Date label in Hebrew (e.g. "ראשון 18/05")
- Total hours for that day
- Day status badge: `✓` (met target), `~` (partial), `⚠️` (workday + zero entries), nothing (Fri/Sat)
- Per-client breakdown (same row format as today view), collapsed by default behind a chevron toggle
**Evidence required:** Code.

### M3 — Workday/weekend logic
**Rule:** Friday (`getDay() === 5`) + Saturday (`getDay() === 6`) NEVER flagged as missing. They show with hours if reported, blank if not. Holidays are out of scope (no detection — keep current behavior). Comment notes this limitation.
**Evidence required:** Reading the code.

### M4 — Weekly total bar
**Rule:** Below day list: "סה"כ השבוע: X / Y" where X = sum of week hours, Y = effective workdays × daily target (5 workdays Sun-Thu × daily target; future Fri/Sat days do not count toward target).
**Evidence required:** Code.

### M5 — Today view unchanged
**Rule:** Switching to "היום" tab renders identical content to current popup. No regression on:
- Per-client list
- Per-client internal-time grouping
- Total / target line
- Status line (normal/almost/done/over)
- Outside-click close behavior
- Real-time refresh on `update()`

**Evidence required:** Manual verification + side-by-side comparison.

### M6 — Edge cases handled per user-app CLAUDE.md
**Rule:**
- Empty state (Sunday morning, zero entries): both tabs render "אין דיווחים" without errors
- Large data (50+ entries spread across week): popup still renders within max-height with internal scroll
- Date crossing midnight: `_todayStr` recomputed on every `update()` (already in current code)
- Internal time: shown separately within each day's breakdown
**Evidence required:** Reading the code + comments.

### M7 — No backend / no new dependencies
**Rule:** Diff touches ONLY `daily-meter.js` + `daily-meter.css`. No imports added. No `package.json` change. No call to any callable / Firestore reader.
**Evidence required:** `git diff --stat`.

### M8 — Mobile behavior preserved
**Rule:** `@media (width <= 768px)` rule that hides popup unchanged. Mobile users continue to see only the ring.
**Evidence required:** CSS diff.

### M9 — All other tests pass + lint zero
**Rule:** Root Vitest green. ESLint 0 errors.
**Evidence required:** Test runner output.

## SHOULD criteria

### S1 — Pure helper exported for testing
**Rule:** A pure function `_groupByDay(entries, weekStart, weekEnd)` exported via `_test` export (mirrors the existing `_test` pattern in timesheet-trigger.js + scheduled/index.js). Allows future unit test without DOM.
**Evidence required:** Export.

### S2 — Inline comment tagged PR-F + reference to deep audit
**Rule:** Comment block above new render path notes: "PR-F: week view — addresses silent-miss gap from TIME-TRACKING-FLOW.md".
**Evidence required:** Comment.

### S3 — Workday calculation tolerant of partial week
**Rule:** If today is Wednesday, weekly target = 3 × dailyTarget (not 5). Avoids "you're at 60% of week" alarm on Wednesday morning.
**Evidence required:** Code.

### S4 — PR description names existing daily-meter + deep audit + how this closes a specific gap
**Evidence required:** PR body.

## Out of scope

- Holiday/eve detection (not in current daily-meter — separate concern)
- Per-entry detail view (just per-client per-day — entry-level detail = future PR)
- Backend sync indicator ("was server-acknowledged?" badge) — separate audit feature
- Search / filter
- Export
- Admin Panel changes
- New page / new tab in sidebar nav (extend existing popup only)
- Mobile-specific UI (mobile keeps current ring-only behavior)

## Rollback

`git revert <merge-commit>`. Component reverts to today-only popup. Real-time listener wiring unchanged. Zero data corruption.

## Notes for grader

- Existing `daily-meter.js` uses ES6 class + private `_methods`. New methods follow same convention.
- CSS prefix is `gh-daily-meter-*`. New classes follow same prefix.
- Component owns its CSS injection via `_injectCSS()` — no global CSS file changes.
- `window.manager.timesheetEntries` is the source. Already a real-time Firestore snapshot. Extension reads but does NOT mutate.
- The "silent miss" detection is BEST-EFFORT: a workday with zero entries appears flagged. It does NOT detect "entry was attempted but failed" — that's a separate concern (would need UI-side submission tracking).
