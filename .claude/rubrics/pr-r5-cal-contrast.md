# Rubric — PR-R5: report-tab flatpickr "today" cell hover contrast fix

**Track:** Report-tab polish follow-up. Haim reported (live DEV, post-R4): selecting a date range, hovering a day turns the NUMBER white → unreadable. Root cause verified against the vendored CSS: flatpickr's base `.flatpickr-day.today:hover,.flatpickr-day.today:focus{background:#959ea9;color:#fff}` — the "today" cell gets white text on a gray hover/focus background. PR-R4's scoped hover override lightened the background (`--gray-100`) but did NOT set a text color, so flatpickr's `color:#fff` survived → white-on-light = invisible number when the mouse passes over today's cell during range selection.
**Scope:** frontend-only, CSS-only. 2 files: `clients-modals.css` (add dark text to the `.report-detail` flatpickr hover/focus + a `.today:hover/:focus` override), `clients.html` (`?v=` bump on clients-modals.css only). No JS, no ReportTab.js, no vendored files.
**Type:** display contrast fix (WCAG). Trivial, LIGHT — no data/rules/logic → no devils-advocate.

## MUST (all required for PASS)

- **M1 — the exact culprit is fixed.** `.report-detail .flatpickr-day.today:hover, .report-detail .flatpickr-day.today:focus` now set `color: var(--gray-900)` (dark) on a `var(--gray-100)` background — overriding flatpickr's `.flatpickr-day.today:hover{color:#fff}` (our scoped selector = specificity 0,4,0 > flatpickr's 0,3,0, and loads later). The number is dark-on-light (readable) on hover/focus.
- **M2 — general hover keeps dark text.** `.report-detail .flatpickr-day:hover, :focus` now also sets `color: var(--gray-900)` (belt: any day's hover keeps a readable number, not just today's).
- **M3 — endpoints unchanged + no over-reach.** The range endpoints (`.selected/.startRange/.endRange`, white-on-blue, readable) and the `.inRange` band are UNTOUCHED. Only the hover/focus + today rules are added. Tokens only (no hardcoded hex).
- **M4 — `?v=` bump.** Only `clients-modals.css?v=` bumped (→ `20260804-r5-cal-contrast`); `ReportTab.js` + the vendored assets are unchanged so their `?v=` stay.
- **M5 — gates.** stylelint 0 problems; the admin-panel report-tab suite stays green (38); the clients.html contract pins unaffected by the `?v=` bump.

## PRODUCT-GRADE GATES (expected)

- **G1** PASS — no customer-facing strings; pure CSS; no undefined/NaN path.
- **G2** PASS — Rollback = single `git revert` (restores the R4 hover block + `?v=`).
- **G3** N/A — read-only display; no write path.
- **G4** PASS-with-manual-smoke — CSS contrast can't be asserted in jsdom (no layout). Manual DEV smoke: report tab → "מותאם" → click a start date → hover across days incl. TODAY → the number stays dark/readable (was white/invisible). The 38 report-tab tests confirm no structural regression.
- **G5** N/A — no strings.
- **G6** PASS (no breaking change) — display-only contrast fix; no behavior/data/contract/count/aggregate change.
- **G7** N/A — no auth/PII/permissions.
