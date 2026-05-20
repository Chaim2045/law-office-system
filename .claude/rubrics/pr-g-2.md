# Rubric — PR-G.2

**Title:** refactor: shared `DEFAULT_DAILY_TARGET` ES module — kill 11 hardcoded 8.45 sites
**Branch:** feat/shared-work-hours-constant-pr-g-2
**Base:** main
**Scope:** Phase B of PR-G series. Consolidates the hardcoded fallback `8.45` daily-hours target into a single ES module per app. Both apps already use `<script type="module">` natively, so imports work without bundler changes. **Approach pivoted from original Firestore proposal** after devils-advocate review identified race conditions, async-on-init complexity, offline fallback chain still requiring hardcoded literal, and slippery-slope risk (8.45 is a fallback constant, not a configurable global).

**Predecessor:** PR-G.1 (#307 — Hebrew calendar Firestore sync). G.3 will handle dynamic data (holidays) via Firestore reads; G.2 handles static constant (8.45) via code.

## Why this approach

| Criterion | Firestore (rejected) | ES module shared (chosen) |
|-----------|----------------------|---------------------------|
| Race on first render | possible (async init) | impossible (sync import) |
| Network round-trip | yes | no |
| Migration cost | high (mock tests, async retrofit 7+ sites) | low (find/replace + import) |
| Offline fallback | still requires hardcoded literal | works always |
| Drift risk | 0 sources | 2 copies (one per app) — mitigated by tiny file (~20 lines) |
| Admin runtime edit | possible | requires deploy (acceptable — 8.45 has not changed in 2+ years) |
| Slippery slope | adds god-collection | none |

Cross-app deploy boundary: `apps/user-app/` and `apps/admin-panel/` are independent Netlify sites. Cannot share a single file at runtime without build infrastructure. Acceptable compromise: **duplicate the small constants file** in both apps. Matches existing duplication pattern (`work-hours-calculator.js` already byte-identical between apps).

## Discovery (from navigator agent)

**11 sites** with hardcoded `8.45` (prior count "7" was undercount):

| Category | Sites | Notes |
|----------|-------|-------|
| DEFINE | 4 | `daily-meter.js:17`, `WorkloadConstants.js:101`, `work-hours-calculator.js:11` (×2 byte-identical) |
| READ with fallback | 2 | `UserDetailsModal.js:2130 + 6394` |
| COMPARE against literal | 3 | `statistics.js:426`, `work-hours-calculator.js:248` (×2) |
| UI copy / placeholder / FAQ | 4 | `UserForm.js:255+261` placeholder/hint, `smart-faq-bot.js:3113` answer, `WorkloadCalculator.js` comments-only |

## MUST criteria (block on FAIL)

### M1 — Shared constants module created in BOTH apps
**Rule:** Two byte-identical files:
- `apps/user-app/js/shared/work-hours-constants.js`
- `apps/admin-panel/js/shared/work-hours-constants.js`

Each exports:
```js
export const DEFAULT_DAILY_TARGET = 8.45;
export const DEFAULT_MONTHLY_HOURS = 186;
// Optional: holiday-eve target reduction factor, weekly-target divisor, etc.
```

**Evidence required:** Files exist + identical (`diff -q` = empty).

### M2 — Single source within each app
**Rule:** All 7 DEFINE/READ/COMPARE sites in each app import from the shared module. No remaining hardcoded `8.45` literal in non-comment / non-UI-string lines outside the shared module.

**Sites to migrate (per app):**

User-app:
- `apps/user-app/js/modules/components/sidebar/daily-meter.js:17` — import + use
- `apps/user-app/js/modules/work-hours-calculator.js:11 + 248` — import + use (replace `|| 8.45` and `!== 8.45`)
- `apps/user-app/js/modules/statistics.js:426` — import + use in `!== DEFAULT_DAILY_TARGET` check

Admin-panel:
- `apps/admin-panel/js/workload-analytics/WorkloadConstants.js:101` — re-export from shared or reference
- `apps/admin-panel/js/modules/work-hours-calculator.js:11 + 248` — same as user-app version
- `apps/admin-panel/js/ui/UserDetailsModal.js:2130 + 6394` — import + use

**Evidence required:** `grep -n "8\.45" apps/user-app/js apps/admin-panel/js | grep -v shared/work-hours-constants.js | grep -v "// "` returns ZERO matches in code lines. UI copy / placeholders / FAQ-string interpolation handled in M3.

### M3 — UI copy strings interpolated from constant
**Rule:** User-facing text that references "8.45" must read from the constant at render-time, not hardcoded string. Specifically:
- `apps/admin-panel/js/ui/UserForm.js:255` — `placeholder="${DEFAULT_DAILY_TARGET}"` (template literal at render)
- `apps/admin-panel/js/ui/UserForm.js:261` — Hebrew hint `ברירת מחדל: ${DEFAULT_DAILY_TARGET} שעות/יום` interpolated
- `apps/user-app/js/modules/smart-faq-bot.js:3113` — FAQ string `${h.workDaysTotal} ימי עבודה × ${DEFAULT_DAILY_TARGET} שעות`
- `apps/admin-panel/js/ui/UserDetailsModal.js:2136` — log string `'default (${DEFAULT_DAILY_TARGET})'`

**Evidence required:** No `'8.45'` or `"8.45"` literal in user-facing strings except inside the shared module.

### M4 — Comments allowed to keep "8.45"
**Rule:** Inline comments and dev-facing log messages explaining math (e.g., `// 34.8 / 8.45 = 4 workdays`) MAY keep the literal for readability. These don't affect runtime.

**Evidence required:** Diff shows comment lines retained.

### M5 — Module path conventions
**Rule:** All imports use relative paths from each app's directory:
- User-app: `import { DEFAULT_DAILY_TARGET } from '<relative>/shared/work-hours-constants.js'`
- Admin-panel: `import { DEFAULT_DAILY_TARGET } from '<relative>/shared/work-hours-constants.js'`

No imports cross app boundaries. No `../../admin-panel/...` from user-app or vice versa.

**Evidence required:** `grep -rn "shared/work-hours-constants" apps/` shows only intra-app paths.

### M6 — Existing tests unchanged in behavior
**Rule:** Vitest + Jest tests still pass. Tests that previously compared against the literal `8.45` may need to import the constant — minor adjustment, but assertion logic stays the same.

**Evidence required:** Test runner output green.

### M7 — Documentation comment in both files
**Rule:** Top of each shared file documents the duplication contract:
```js
/**
 * ⚠️ DUPLICATED CONSTANT FILE — keep byte-identical with the sibling at:
 *   apps/<other-app>/js/shared/work-hours-constants.js
 *
 * Cross-app deploy boundary (Netlify) prevents true single-source via
 * runtime imports. This constant rarely changes. When it does, update
 * both copies in the same PR.
 */
```

**Evidence required:** Comment block present in both files.

### M8 — All other tests pass + lint zero
**Rule:** Functions Jest + root Vitest green. `npm run lint` 0 errors.

**Evidence required:** Test runner output.

## SHOULD criteria

### S1 — Optional helper export
**Rule:** Shared module exports `getEmployeeDailyTarget(employee)` helper: `return (typeof employee?.dailyHoursTarget === 'number' ? employee.dailyHoursTarget : DEFAULT_DAILY_TARGET)`. Single canonical fallback resolution. Sites that use `user.dailyHoursTarget || 8.45` migrate to the helper.

**Evidence required:** Helper exported + at least the 2 UserDetailsModal sites use it.

### S2 — Migration comment per modified file
**Rule:** Each modified file gets a comment at the top of the changed block: `// PR-G.2: DEFAULT_DAILY_TARGET centralized — see shared/work-hours-constants.js`.

**Evidence required:** Comments visible in diff.

### S3 — PR description names devils-advocate pivot
**Rule:** PR body acknowledges the original Firestore proposal was pivoted after devils-advocate review. Documents the trade-off table.

**Evidence required:** PR body.

### S4 — No behavioral change
**Rule:** Same defaults, same fallback logic, same UI output. Pure refactor — `git diff` should show only structural changes (import + literal-replaced-by-constant), no logic deltas.

**Evidence required:** Manual diff review.

## Out of scope

- Firestore `system_settings/work_hours_defaults` (rejected by devils-advocate analysis)
- Holiday calendar integration in daily-meter (PR-G.3)
- Removing duplicated `work-hours-calculator.js` (it's a class with non-trivial logic — separate refactor)
- Build step to deduplicate the shared constant file (deferred until business need for single-edit, not speculative)
- Per-employee target UI (admin already has it via `UserForm`)

## Rollback

`git revert <merge-commit>` → constants module disappears, hardcoded literals re-introduced. No data corruption. UI behaves identically.

## Notes for grader

- ES modules already widely used in both apps via `<script type="module">` — verified in `index.html` and `clients.html`.
- The duplication contract (M7) is enforced by code review only — no automated check. Acceptable given file size + change frequency.
- `WorkloadConstants.js:101` already has `DEFAULT_DAILY_HOURS: 8.45` — that's a named constant inside an existing constants object, not a free literal. The refactor in admin-panel can either (a) make this object import from the shared module, or (b) keep it as the admin's local naming layer that re-exports from shared. Option (a) preferred — true single source.
