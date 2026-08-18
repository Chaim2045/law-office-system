# Rubric — PR-T2-3: legal stages vertical stepper (reading-pane + the invisible-✓ fix)

**Track:** Track-2 (reading-pane for the management card), PR-3 of the approved sequence — the significant VISIBLE change. The legal service's stage list changes from a cramped horizontal 3-dot timeline into a calm VERTICAL stepper (numbered pending steps, an accent-ringed current step, a green ✓ done step, joined by a progress rail). It also fixes the bug Haim caught in a screenshot: the completed marker filled with `var(--success-green)` — a token defined NOWHERE in the admin CSS — so the green never applied and the white `fa-check` sat on the base white circle and vanished ("עיגול לבן, ה-V הלבן לא נראה").

**Scope:** frontend-only, DEV, admin-critical. **CSS-ONLY** — 3 files: `css/clients-modals.css` (the `.management-stages*`/`.management-stage*` block rewritten to the vertical stepper), `clients.html` (`?v=` bump → `20260806-t2-3-legal-stepper`), `tests/unit/admin-panel/legal-stepper-css.test.ts` (new CSS-contract guard). **NO JS change** — `buildStagesHtml` (live) and `ClientManagementModal.renderStages` (dead fallback) are byte-unchanged, so the injector markup + the two renderers stay identical by construction.

**Type:** admin-critical display restructure. **devils-advocate MANDATORY** (admin-critical surface + a declared behavioral display change; the two stage-injectors' contract is load-bearing).

## MUST (all required for PASS)

- **M1 — the invisible-✓ bug is FIXED.** The stepper region no longer uses `var(--success-green)` (an undefined token). `.management-stage.completed .management-stage-icon` now fills with `var(--green)` (a real design-system token) + `color:#fff` → the ✓ is visible (proven by the real-CSS render + `legal-stepper-css.test.ts`).
- **M2 — injector contract byte-identical.** ZERO JS change → `buildStagesHtml` still emits `.management-stage` / `.management-stage-name` (textContent === `stage.name`) / `.management-stage-info` on every stage row. `AddPackageToStage` (scans `.management-stage`, matches `.management-stage-name`===name, sets `data-pricing-type`, appends `.add-package-btn` into `.management-stage-info`) and `ServiceOverdraftResolution` (`.management-service-card[data-service-id]`, `.override-btn`) are unaffected. **Proven:** `manage-detail-equality` 7 green (stage count, names===name, info count), `modal-unification-management-contracts` 25 green.
- **M3 — vertical, not horizontal.** `.management-stages-list` is `flex-direction: column` + `counter-reset: usc-step` (was `flex row; justify-content: space-between`). Pending/current markers show the step number via `content: counter(usc-step)`; the done marker keeps its ✓. A connecting rail (`.management-stage:not(:last-child)::before`) joins markers, greened (`var(--green)`) below completed steps.
- **M4 — tokens only, RTL-correct, calm.** Every colour/space/size is a real design-system or `--cm-*` token (no undefined tokens, no raw rgba — the active ring is `var(--cm-active-surface)`). The marker column sits inline-start (`inset-inline-start`) so RTL renders markers on the right. The redundant horizontal `.management-stages-progress` bar is suppressed (one progress signal — the rail — not two).
- **M5 — report tab untouched.** `.report-stage*` CSS is not touched; `report-tab.test.ts` 38 byte-identical.
- **M6 — CSS-contract guard added.** `legal-stepper-css.test.ts` pins: no `var(--success-green)` in the stepper region; done marker → `var(--green)`; list vertical + counter; number-via-counter + ✓-suppressed-on-non-completed; active accent + `--cm-active-surface` ring; the rail + its green completed segment.
- **M7 — gates.** stylelint 0; eslint 0 errors; `?v=` bumped (`clients-modals.css` only — CSS-only change); vitest green (legal-stepper-css 6 + manage-detail-equality 7 + management-contracts 25 + report-tab 38).

## PRODUCT-GRADE GATES (expected)

- **G1** PASS — this REMOVES a display defect (the invisible ✓ from an undefined token). No NaN/undefined/`[object Object]` path; the stepper is pure display of already-computed stage data.
- **G2** PASS — Rollback = single `git revert` (restores the old horizontal timeline CSS + `?v=`). Code-only, no data/schema.
- **G3** N/A — read-only display; no write/update/delete path.
- **G4** PASS — `legal-stepper-css.test.ts` (the fix + the vertical transformation) + the injector-guard suites (manage-detail-equality / management-contracts) + a real-CSS Playwright render shown to Haim (done/done/active/pending + the injected "הוסף שעות" chip on the active hourly stage). Manual DEV smoke after merge: open a client's legal service → the vertical stepper renders, the ✓ is visible on completed steps, "הוסף שעות" still injects on the active hourly stage.
- **G5** PASS — Hebrew unchanged (שלבי ההליך + the stage names, which are data). No new strings.
- **G6** — **BEHAVIORAL/DISPLAY CHANGE (declared, ADMIN SAFETY).** The legal stage list is restructured horizontal→vertical and the completed marker's colour is fixed. **No count/filter/aggregate/injector/data change** — display-only; the same stages, names, and hours render, in a new layout. Deliberate visual change to an admin-trusted screen, per apps/admin-panel/CLAUDE.md.
- **G7** N/A — no auth/PII/permissions surface.

## Out of scope (surfaced, tracked for the later "calm overdraft" PR)

The same orphaned undefined-token family (`--success-green`, `--danger-red`, `--warning-yellow` — none defined in the admin CSS) still appears in the **info-block** (`.management-service-info-value.success/.blocked`, whose `.success`/`.blocked` modifier classes aren't even emitted → dead) and the **hours body** (`.management-hours-progress-fill.*`, `.management-hours-stat-value.*`). Those surfaces belong to the later calm-overdraft/hours-body PR (PR-5), where they will be re-tokenised or deleted with the right semantics. Fixing them here would expand PR-3 beyond the stepper.
