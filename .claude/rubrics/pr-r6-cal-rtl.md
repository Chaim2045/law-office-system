# Rubric — PR-R6: report-tab flatpickr calendar RTL grid

**Track:** Report-tab polish follow-up. During the post-merge smoke of R4/R5 (jsdom can't render a calendar), a faithful browser repro (Playwright, real vendored flatpickr 4.6.13 + real `clients-modals.css` + `dir="rtl"` + `locale:'he'`) revealed the calendar renders **LTR** inside the Hebrew (RTL) admin: weekdays ran ראשון(א)→שבת(ש) **left-to-right**, dates flowed left-to-right, prev/next LTR. Root cause verified: `flatpickr.min.css` hardcodes `direction:ltr` on `.flatpickr-calendar`, and NO stylesheet (grepped all of `apps/admin-panel/css/`) overrode it → the LTR is real in prod, not a repro artifact. Haim approved the fix.
**Scope:** frontend-only, CSS-only. 2 files: `clients-modals.css` (one scoped grid-only RTL rule), `clients.html` (`?v=` bump on clients-modals.css only). No JS, no `ReportTab.js`, no vendored files.
**Type:** display RTL fix (Design Bar §2.4 RTL). Trivial, LIGHT — no data/rules/logic → no devils-advocate. Effort-scaler skipped (obviously LIGHT).

## MUST (all required for PASS)

- **M1 — the grid flips to RTL.** `.report-detail .flatpickr-weekdaycontainer, .report-detail .dayContainer { direction: rtl; }` → the weekday header row + the day grid render right-to-left: ראשון(א) rightmost, שבת(ש) leftmost, dates flow right-to-left. **Verified in the real-CSS repro:** `weekdayDir:"rtl"`, `sundayIsRightmost:true`, weekdays `א@977 … ש@713`, first row `26@980 … 1@716`.
- **M2 — header + arrows untouched (no glitch).** Only `.flatpickr-weekdaycontainer` + `.dayContainer` are flipped; the month/year header (`.flatpickr-current-month`) + prev/next arrows are NOT touched → the header stays intact (flipping the whole `.flatpickr-calendar` re-orders the month-dropdown and glitches its chevron — the rejected approach). **Verified:** `headerDir:"ltr"`.
- **M3 — scoped + no over-reach.** The rule is scoped to `.report-detail` (the only flatpickr instance in the admin — grepped; no other `.flatpickr-*` consumer). `direction` keyword only — no color/hex/token added or changed. The R3/R5 rules (selected/inRange/hover/today-hover/focus) are UNTOUCHED.
- **M4 — `?v=` bump.** Only `clients-modals.css?v=` bumped (→ `20260805-r6-cal-rtl`); `ReportTab.js` + the vendored assets are unchanged so their `?v=` stay. No test pins the version string (grepped `tests/`).
- **M5 — gates.** stylelint 0 problems; the admin-panel report-tab suite stays green (report-tab 38 + preview-contract 13 + modal-unification-report 11 + management-contracts/injector-safety 25 = 87); `ReportTab.js` untouched so `getFormData` byte-identity + the injector `management-*`=0 invariant are unaffected.

## PRODUCT-GRADE GATES (expected)

- **G1** PASS — no customer-facing strings; pure CSS; no undefined/NaN path.
- **G2** PASS — Rollback = single `git revert` (removes the RTL block + restores the `?v=`).
- **G3** N/A — read-only display; no write path.
- **G4** PASS-with-manual-smoke — CSS RTL layout can't be asserted in jsdom (no layout engine). Verified instead via a faithful Playwright repro against the REAL vendored flatpickr + REAL `clients-modals.css` (rule sourced from `clients-modals.css`, not injected): `weekdayDir:rtl`, `sundayIsRightmost:true`, `headerDir:ltr`. The 87 report-tab tests confirm no structural regression. Manual DEV smoke after merge: report tab → open the calendar → ראשון on the right, dates flow right-to-left, month header + arrows intact.
- **G5** N/A — no strings.
- **G6** PASS (no breaking change) — display-only RTL flip; no behavior/data/contract/count/aggregate change; `ReportTab.js` (incl. `getFormData`) untouched.
- **G7** N/A — no auth/PII/permissions.
