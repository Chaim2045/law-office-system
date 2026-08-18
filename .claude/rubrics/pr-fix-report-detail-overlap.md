# Rubric — fix: report detail overlap (date/preset/calendar section over the stage list)

**Type:** admin-critical layout bug fix, frontend-only, DEV. **CSS-ONLY** — 3 files: `css/clients-modals.css` (one declaration: `flex-shrink: 0` on `.report-service-detail`), `clients.html` (`?v=` bump), `tests/unit/admin-panel/report-detail-overlap-css.test.ts` (new CSS-contract guard).

**The bug (reproduced + measured, not guessed):** On a legal service with multiple stages, opening "מותאם אישית" (the inline flatpickr range calendar) made the period section — "תקופת הדוח" label + the preset chips + the live date line — render ON TOP of the last stage rows (שלב ג' / שלב ד'). Real-CSS Playwright repro + `getBoundingClientRect`: `.report-period` top = 164 while `.report-stage-list` bottom = 280 → ~116px overlap. Haim observed it live and flagged it.

**Root cause:** `.report-detail` is BOTH a flex column (`display:flex; flex-direction:column`) AND the `.cm-detail` scroll container (`max-height:60vh; overflow-y:auto`). Its child `.report-service-detail` (the stage-list pane) carries an explicit `min-height:96px`, which overrides flex's default `min-height:auto`. So when the stage list + the open calendar push the total past 60vh, the flex algorithm SHRINKS the pane toward 96px instead of letting the container scroll — and the stage rows (`overflow:visible`) spill DOWN over the period section.

**The fix:** `flex-shrink:0` on `.report-service-detail` → the pane keeps its content height and can no longer collapse below it; overflow then happens on `.cm-detail` (scroll), exactly as the container was designed for. Post-fix re-measure: `.report-period` top = 296 sits below the stage-list bottom = 280 → `overlap:false`.

## MUST (all required for PASS)

- **M1 — the fix.** `.report-service-detail` gains `flex-shrink: 0`; its `min-height: 96px` is kept (it reserves the empty-state height before a service is picked). No other rule changed.
- **M2 — the mechanism is intact.** `.cm-detail` still has `max-height: 60vh` + `overflow-y: auto` (the scroll the fix relies on). The fix converts a child-collapse-and-spill into a container-scroll — no content is hidden.
- **M3 — no overlap, proven.** Real-CSS Playwright repro (multi-stage legal service + open calendar): before = 116px overlap; after = period top (296) below stage-list bottom (280), `overlap:false`. Screenshot shown to Haim.
- **M4 — report tab otherwise unchanged.** No markup / JS change; `report-tab.test.ts` 38 green. No `.report-*` selector other than `.report-service-detail` touched.
- **M5 — CSS-contract guard added.** `report-detail-overlap-css.test.ts` pins `.report-service-detail { flex-shrink:0; min-height:96px }` + `.cm-detail { max-height:60vh; overflow-y:auto }`.
- **M6 — gates.** stylelint 0; eslint 0; `?v=` bumped on `clients-modals.css` (→ `20260806-fix-report-overlap`); vitest green.

## PRODUCT-GRADE GATES (expected)

- **G1** PASS — REMOVES a display defect (overlapping text). No NaN/undefined path; pure layout.
- **G2** PASS — Rollback = single `git revert` (restores the overlapping layout + `?v=`). Code-only.
- **G3** N/A — read-only display; no write path.
- **G4** PASS — real-CSS Playwright repro measuring the box overlap before/after (the customer scenario: multi-stage legal + open calendar) + the CSS-contract guard; documented manual DEV smoke (open a report on a multi-stage legal service → open "מותאם" → the calendar/presets sit below the stages, the detail scrolls if tall).
- **G5** PASS — no strings changed.
- **G6** — display-only layout fix; no count/filter/aggregate/data/contract change. (Declared per apps/admin-panel ADMIN SAFETY, though this touches no counts.)
- **G7** N/A — no auth/PII/permissions.
