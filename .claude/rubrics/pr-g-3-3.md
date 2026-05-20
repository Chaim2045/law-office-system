# Rubric — PR-G.3.3

**Title:** feat(functions+frontend): split holidays into auto + overrides + Firestore Rules (PR-G.3.3)
**Branch:** feat/holidays-overrides-pr-g-3-3
**Base:** main
**Scope:** Final phase of PR-G.3 split. Backend amendment + frontend merge logic + Firestore Rules. Resolves devils-advocate **R4** (cron clobbers admin override) by splitting Firestore schema into two disjoint field sets that cron + admin write independently. Frontend merges on read.

**Predecessor:** PR-G.3.2 (#312).

## Schema (devils-advocate recommended, after holes were found in original plan)

```
system_holidays/{year}:
  year:               number
  source:             '@hebcal/core@x.y.z'
  generatedAt:        serverTimestamp
  contentHash:        sha1 of holidaysAuto
  holidaysAuto:       Holiday[]              ← cron writes (via UPDATE, not SET)
  holidaysOverrides:  HolidayOverride[]      ← admin writes manually (Console / future UI)
```

**`HolidayOverride` shape:**
```js
{
  date:           'YYYY-MM-DD',
  type:           'holiday' | 'eve' | 'memorial' | 'fast' | 'cholhamoed' | 'minor' | 'modern',
  nameHe:         string,
  nameEn:         string,
  isWorking:      boolean,
  isHalfDay:      boolean,
  eveOf:          string | null,
  _suppress:      true,                       // optional — when present, removes the corresponding auto entry
  _overrideMeta: {
    by:           string,                     // employee email/uid
    at:           ISO timestamp,
    reason:       string                      // free-text justification
  }
}
```

**The `holidays` field is GONE.** Frontend merges `holidaysAuto + holidaysOverrides` on read.

## MUST criteria (block on FAIL)

### M1 — Cron writes `holidaysAuto` via `update()` not `set()`
**Rule:** `functions/scheduled/index.js` `syncHolidaysForYear()`:
- Writes `{ holidaysAuto, contentHash, source, generatedAt, year }` via `docRef.update(...)` OR `docRef.set(..., { merge: true })`. NEVER `set()` without merge — that would erase `holidaysOverrides`.
- `contentHash` covers `holidaysAuto` only.
- Idempotency check unchanged: skip write if hash matches.
- **`holidays` field NOT written** (deprecated; frontend merges).

**Evidence required:** Reading the code; commit message confirms.

### M2 — `seedHolidays.js` uses merge write
**Rule:** `functions/scripts/seedHolidays.js` writes `{merge: true}` so re-seeding does NOT destroy `holidaysOverrides`.

**Evidence required:** Reading the code.

### M3 — Frontend `holidays-cache.js` merges auto + overrides
**Rule:** Both apps' `holidays-cache.js` updated to:
- Read both `data.holidaysAuto` AND `data.holidaysOverrides`
- Merge per-date: override wins
- `_suppress: true` → remove the matching auto entry
- Backward compat: if `holidaysAuto` missing, fall back to `data.holidays` (single deploy cycle)
- After merge: same `_mergeHolidaysArraysToMap` to build the final Map

**Evidence required:** Reading the code; byte-identical between apps.

### M4 — Firestore Rules added for `system_holidays`
**Rule:** `firestore.rules` adds:
```
match /system_holidays/{year} {
  allow read: if request.auth != null;
  allow write: if false;  // Admin SDK + manual Console only
}
```
- Read: any authenticated user
- Write: explicitly denied via Web SDK (Admin SDK bypasses; Console writes pass when admin authenticated)
- Captures the rule state in code (previously may have been added out-of-band in Console)

**Evidence required:** Reading the diff.

### M5 — `_suppress` sentinel implemented
**Rule:** Frontend merge logic: an override with `_suppress: true` REMOVES the corresponding auto entry from the merged Map. Allows admin to cancel a Hebcal-determined holiday (e.g. "this year ראש השנה II falls on Saturday, no special handling needed").

**Evidence required:** Reading the code; unit test covers it.

### M6 — `_overrideMeta` audit fields
**Rule:** Override entries SHOULD carry `_overrideMeta: { by, at, reason }`. Frontend merge accepts entries without `_overrideMeta` (backward compat / manual Console edits without metadata) but emits `console.warn` to surface them. Admin UI (future) will enforce.

**Evidence required:** Reading the code.

### M7 — No `holidays` field written anywhere new
**Rule:** Search `functions/` for `holidays:` writes — only `holidaysAuto` and `holidaysOverrides` appear in writers. Existing references in tests / docs left as-is (read paths use field directly).

**Evidence required:** Grep the diff.

### M8 — Tests cover new merge + suppress behavior
**Rule:** New vitest test cases in `tests/unit/user-app/holidays-cache-merge.test.ts` (extend existing file from G.3.1) or new file:
- override wins by date
- `_suppress: true` removes auto entry
- no override → falls through to auto

Plus new jest test in `functions/tests/`:
- `syncHolidaysForYear` uses `update()` (or `set({merge: true})`), not `set()`
- contentHash hashes only `holidaysAuto`

**Evidence required:** Tests + Vitest/Jest output.

### M9 — Backward compat one deploy cycle
**Rule:** Frontend reads `data.holidaysAuto || data.holidays || []` so if there's a moment in deployment where cron hasn't updated yet, old `data.holidays` is still understood. Cron next tick fixes it.

**Evidence required:** Reading the code; inline comment with cleanup PR-G.3.4 note.

### M10 — Lint + tests green
**Rule:** Jest + Vitest green. Lint 0 errors.

**Evidence required:** Output.

## SHOULD criteria

### S1 — Inline PR-G.3.3 comments in all modified files
**Evidence required:** Comments visible.

### S2 — README / migration note for admin
**Rule:** Add inline comment block at the top of `holidays-cache.js` explaining how an admin would add an override via Firestore Console:
```
system_holidays/2026 → add to holidaysOverrides array:
{
  "date": "2026-04-22",
  "type": "modern",
  "nameHe": "יום העצמאות",
  "nameEn": "Yom HaAtzma'ut",
  "isWorking": true,
  "isHalfDay": false,
  "eveOf": null,
  "_overrideMeta": { "by": "haim@gh", "at": "2026-04-15T10:00:00Z", "reason": "Office decided to work" }
}
```

**Evidence required:** Comment block.

### S3 — Orphan-override detection (R6) — deferred to PR-G.3.4
**Rule:** Document in PR body that R6 (override on date that Hebcal later drops) is NOT in this PR. Suggested follow-up.

**Evidence required:** PR body mention.

### S4 — Out-of-window override rejection (R7) — deferred to PR-G.3.4
**Rule:** Document that overrides outside `currentYear .. currentYear+5` cannot be saved (would land on non-existent year doc). Deferred.

**Evidence required:** PR body mention.

## Out of scope

- **R6:** Orphan override detection — PR-G.3.4
- **R7:** Out-of-window override rejection — PR-G.3.4
- **Admin UI for managing overrides** — future PR (today admin uses Firestore Console)
- **Migration of existing `holidays` field** — kept as backward-compat fallback in reader for one deploy cycle, then removed in PR-G.3.5 cleanup

## Rollback

`git revert <merge-commit>` →
- Cron reverts to writing `holidays` via `set()`. Any `holidaysOverrides` saved during the failed period are NOT deleted from Firestore (admin SDK doesn't touch them on revert), but they become dead data (nobody reads them).
- `firestore.rules` revert may break frontend read; mitigate by keeping rules even on revert OR ensuring rules were already added in Console.
- No data corruption.

## Notes for grader

- This PR closes the final R-level risk (R4) from the original devils-advocate review of PR-G.3.
- After PR-G.3.3, all 5 devils-advocate risks are mitigated. The G.3 series is functionally complete.
- The orphan detection (R6) + window-bound rejection (R7) are non-blocking UX features deferred to G.3.4 because they require admin UX decisions Tommy hasn't yet made.
