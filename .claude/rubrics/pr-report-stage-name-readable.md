# Rubric — make the report-tab stage-picker name always readable (no truncation)

**Scope:** frontend-only, DEV, admin-critical. In the report tab's V3 side-by-side layout, when the calendar is open the stage column is narrow (`.report-body` grid = `minmax(0,1fr) 348px`). The stage row packed name + status + hours on ONE flex line, so the name flexed to ~40px and truncated to an unreadable "ש…" (Haim's screenshot). This stacks the name on its OWN full-width line with status + hours beneath — always readable — plus a `title` carrying the verbose stage name for hover context. **DISPLAY ONLY.**

**Change:** 4 files. `js/ui/ReportTab.js` (`_stageRowHtml` markup only — wrap the name in `.report-stage-body` + `.report-stage-meta`, add `title=getStageName`), `css/clients-modals.css` (`.report-stage-name` drops nowrap/ellipsis/flex; new `.report-stage-body` column + `.report-stage-meta` row), `clients.html` (`?v=` bump on `clients-modals.css` + `ReportTab.js`), `tests/unit/admin-panel/report-stage-name-readable.test.ts` (new guard). **NO** selection-contract / handler / backend change.

## MUST (all required for PASS)

- **M1 — name never truncates.** `_stageRowHtml` stacks the name in `.report-stage-body` (a `flex-direction: column`) with `.report-stage-meta` (status + hours) beneath; `.report-stage-name` no longer carries `white-space: nowrap` / `text-overflow: ellipsis` / `flex: 1 1 auto`, so it takes the full column width and wraps if long. **Proven:** `report-stage-name-readable.test.ts` group 1 + the before/after real-CSS render.
- **M2 — selection contract byte-preserved.** The interactive row keeps `role="radio"`, `tabindex="0"`, `aria-checked`, and `data-stage-id="'+esc(stage.id)+'"` (the click/keyboard handlers read `data-stage-id`); `_setStageSelection` / `getFormData` still use the VERBOSE `getStageName` ("הליך משפטי - …") for the `service` byte-match — untouched. Only the picker ROW display changed. **Proven:** test group 2.
- **M3 — hover reveals the full name.** The `.report-stage-name` carries `title="'+esc(getStageName(stage.id))+'"` → hover shows "הליך משפטי - שלב א'". Escaped at the sink. **Proven:** test group 1.
- **M4 — Design Bar.** design-system.css tokens only (`--space-2`, `--text-*`, `--gray-*`); the `2px` inner gap is the only literal (no token for a hairline gap, consistent with the grandfathered idiom); motion unaffected; the row's existing `:focus-visible` + `--blue` outline preserved.
- **M5 — guard + gates.** `report-stage-name-readable.test.ts` green; `report-tab.test.ts` 38/38 unchanged (no structure pin broke); stylelint 0; eslint 0 errors; `node --check` OK; `?v=` bumped on `clients-modals.css` + `ReportTab.js`; no other admin test regressed.

## PRODUCT-GRADE GATES (expected)

- **G1** PASS — display-only; no new error path; the name/`title` are escaped (`esc`), hours are numeric `.toFixed`.
- **G2** PASS — Rollback = single `git revert` (restores the single-line row + `?v=`). Code-only.
- **G3** N/A — read-only display; no write path.
- **G4** PASS — the guard (structure + selection contract) + a before/after real-CSS Playwright render (narrow column: "ש…" → full name) shown to Haim + a manual DEV smoke: open the report tab on a legal service with the calendar open → every stage name is fully readable; picking a stage still drives the report.
- **G5** PASS — no strings changed (stage names come from `getStageName`/`stageShortName`, Hebrew, unchanged).
- **G6** — **DISPLAY CHANGE (declared).** The stage row's layout changes (1 line → 2 lines); no count/filter/aggregate/selection/data change; `data-stage-id` + verbose-name selection contract byte-preserved. Scoped to `.report-stage*`; emits 0 `.management-*` (no injector collision).
- **G7** N/A — no auth/PII/permissions.

## Rollback

```bash
git revert <merge-commit-sha>   # restores the single-line stage row + the ?v= tokens
```
