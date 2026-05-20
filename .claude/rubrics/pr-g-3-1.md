# Rubric — PR-G.3.1

**Title:** infra(frontend): holidays-cache loader — read `system_holidays/{year}` to `window.WORK_HOURS_HOLIDAYS_MAP`
**Branch:** feat/holidays-cache-pr-g-3-1
**Base:** main
**Scope:** Phase A of split PR-G.3. **Infrastructure only — no consumer code changes yet.** Loads 3 years (current ±1) of holidays from Firestore `system_holidays/{year}` via `onSnapshot` (real-time), merges into a global `Map`, exposes a ready Promise + degraded-fallback flag. G.3.2 wires consumers. G.3.3 handles cron override-vs-auto split.

## Why split into G.3.1 / G.3.2 / G.3.3

devils-advocate identified 5 critical risks in the original "G.3 monolithic" plan:
1. Sync-from-async paint race
2. Bundled fallback JSON mandatory
3. Multi-year boundary (Dec→Jan)
4. Cron overwrites admin override
5. Real-time `onSnapshot` not `get()`

Splitting lets each phase ship independently, rollback independently, and grader-pass independently — same playbook as PR-A/B.

## MUST criteria (block on FAIL)

### M1 — `holidays-cache.js` script in BOTH apps (byte-identical)
**Rule:** Two byte-identical files:
- `apps/user-app/js/shared/holidays-cache.js`
- `apps/admin-panel/js/shared/holidays-cache.js`

**Evidence required:** `diff -q` of the two files returns empty.

### M2 — Loads 3 years on init (current ±1)
**Rule:** On script execution: compute `now.getFullYear()`. Subscribe to `system_holidays/{Y-1}`, `system_holidays/{Y}`, `system_holidays/{Y+1}` via Firestore `onSnapshot`. Merges all returned `holidays[]` arrays into a single `Map<'YYYY-MM-DD', Holiday>`.

**Evidence required:** Reading the code.

### M3 — Real-time updates (`onSnapshot`, not `get()`)
**Rule:** Uses `firebase.firestore().collection('system_holidays').doc(year).onSnapshot(...)` per year. If admin edits a holiday doc in Firestore Console, frontend Map reflects within ~1 sec.

**Evidence required:** Reading the code; method signature is `onSnapshot`.

### M4 — Bundled fallback JSON for offline / cold-start
**Rule:** Inline constant `EMBEDDED_FALLBACK_HOLIDAYS` containing at minimum current Gregorian year of holidays (extracted from the seeded `system_holidays/2026` doc). If Firestore unreachable OR first snapshot timeout (5 sec), Map is populated from fallback + `window.WORK_HOURS_HOLIDAYS_FALLBACK_USED = true` flag set. Fallback is partial — covers ~ current year only, not the full ±1 window. Comment clearly notes the fallback is a degradation, not the source of truth.

**Evidence required:** Reading the code.

### M5 — Exposes ready Promise + globals
**Rule:** Script exposes:
- `window.WORK_HOURS_HOLIDAYS_MAP` — `Map<dateStr, Holiday>`. Empty Map initially; populated after first snapshot OR fallback.
- `window.WORK_HOURS_HOLIDAYS_READY` — `Promise<void>`. Resolves after first snapshot from at least one year, OR after fallback kicks in. Never rejects.
- `window.WORK_HOURS_HOLIDAYS_FALLBACK_USED` — boolean; `false` initially; `true` if first-load timed out.
- `window.WORK_HOURS_HOLIDAYS_REFRESH()` — optional manual refresh function (forces re-fetch, useful for tests + Year-rollover edge).

**Evidence required:** Globals visible after script load.

### M6 — Year-rollover safety
**Rule:** Comment notes: if app stays open across Dec 31 → Jan 1, the 3-year window becomes stale (currentYear-1 = old, currentYear+1 = next-next). Mitigation acknowledged as out-of-scope for G.3.1 (rare edge, refresh on reload solves). G.3.2 may add a midnight tick.

**Evidence required:** Comment.

### M7 — No consumer changes
**Rule:** This PR adds the cache module + script tag wiring ONLY. NO file in `apps/user-app/js/modules/*` or `apps/admin-panel/js/{modules,ui,workload-analytics}/*` is modified to consume the cache. G.3.2 does that.

**Evidence required:** `git diff --name-only` shows only the new shared files + index.html + workload.html script-tag additions.

### M8 — Script tag wired in HTML, loaded EARLY
**Rule:** `<script src="js/shared/holidays-cache.js?v=…">` added to:
- `apps/user-app/index.html` — AFTER firebase compat scripts but BEFORE work-hours-calculator.js
- `apps/admin-panel/index.html` — same constraints
- `apps/admin-panel/workload.html` — same constraints

Load order verified: firebase compat → firebase init inline → `work-hours-constants.js` (PR-G.2) → `holidays-cache.js` (this PR) → consumers.

**Evidence required:** Reading the HTML diffs.

### M9 — Pure helpers exported for testing
**Rule:** Script exposes (via `window.WORK_HOURS_HOLIDAYS_CACHE._test`) pure helpers that can be unit-tested:
- `_mergeHolidaysArraysToMap(yearArrays)` — pure function
- `_isInDateRange(dateStr, startStr, endStr)` — pure helper if needed

**Evidence required:** Globals visible; vitest test covering `_mergeHolidaysArraysToMap` exists.

### M10 — Tests pass + lint zero
**Rule:** Vitest green. Lint 0 errors.

**Evidence required:** Test runner output.

## SHOULD criteria

### S1 — Inline doc + duplication contract
**Rule:** File header documents (a) WHY this is a classic script not a module (consumers mixed), (b) the duplication contract with the sibling file, (c) loading-order requirement.

**Evidence required:** Comment block.

### S2 — Cache invalidation/Refresh hook
**Rule:** `window.WORK_HOURS_HOLIDAYS_REFRESH()` exists for manual force-refresh. Useful for tests + post-admin-edit flush + year-rollover.

**Evidence required:** Reading the code.

### S3 — Diagnostic logging on dev only
**Rule:** Console logs prefixed `[holidays-cache]` for: init, snapshot updates, fallback engaged, errors. NOT noisy in prod (no logs in steady state).

**Evidence required:** Reading the code.

### S4 — PR description names devils-advocate findings R1-R5 + how each is mitigated
**Evidence required:** PR body.

## Out of scope (defer to later PRs)

- **G.3.2:** consumer integration (daily-meter, statistics, statistics-calculator, work-hours-calculator) — none touched in G.3.1
- **G.3.3:** cron `auto` vs `overrides` Firestore doc split (PR-G.1 amendment)
- Year-rollover midnight tick (rare edge — accept refresh-on-reload as mitigation)
- Tooltip on daily-meter ring "ערב חג" (UX polish — G.3.2)
- CI lint check for load-order regression (nice-to-have — separate)

## Rollback

`git revert <merge-commit>` → script files + HTML tags disappear. No consumer reads them yet (G.3.1 is infra only). Zero behavior change.

## Notes for grader

- Cannot easily unit-test the Firestore subscription itself in vitest without complex SDK mocks. Tests focus on the **pure merging helper** (`_mergeHolidaysArraysToMap`).
- Map keys are date strings `YYYY-MM-DD`. Collision handling: closed-day wins over eve-day if both exist for the same date (mirrors `functions/shared/calendar.js` `buildHolidaysMap` rule).
- Fallback JSON intentionally tiny — covers `2026` only. If app boots in 2027 and Firestore fails, fallback returns empty (G.3.2 consumers should treat empty Map as "Fri/Sat only" — same as today's behavior, no worse). Comment clearly notes this.
- The Promise pattern (M5) is the **R1 mitigation** — consumers in G.3.2 will `await window.WORK_HOURS_HOLIDAYS_READY` before first paint, eliminating the race.
