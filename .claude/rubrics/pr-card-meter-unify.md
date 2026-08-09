# Rubric — PR-2 · Unified client-card meter (threshold + color SSOT)

**Scope:** `apps/admin-panel` — frontend-only, DEV, admin-critical. Closing polish of the
modal-unification design track: make the hours meter read IDENTICALLY on both tabs of the
unified client card (management `#clientManagementModal` + report `ReportTab`), which both
already read from the SAME `ServiceCardModel` data source. This PR unifies the *display* half.

**Files:** `js/ui/UnifiedServiceCard.js` (`meterStatus`, `buildIdentityBand`, `buildManageHeader`),
`css/clients-modals.css` (`.msc-*` + `.usc-identity-*` meter palette), `clients.html` (2 `?v` bumps),
3 test files.

**No** backend / Cloud Function / firestore.rules / schema / claim / data change.

## MUST (any FAIL → grader FAIL)

- **M1 — one shared threshold.** The meter state is chosen by a SINGLE relative `meterStatus(used, total, rem)`
  (`over` rem<0 · `high` used/total≥0.85 · `good` else). The separate `manageMeterStatus` is REMOVED; BOTH
  `buildIdentityBand` (report band) and `buildManageHeader` (management) call the one function.
- **M2 — behavior proven on the report band.** `report-tab.test.ts` pins the RELATIVE behavior with a
  divergent-zone case (rem 9 but 82% used → `good`, and NOT `--high`) — a case the OLD absolute `≤10=high`
  would have mis-painted. The over(rem<0)/on-budget(rem 0→high)/good cases still pass.
- **M3 — color SSOT.** `meter-color-ssot.test.ts` proves, for good/high/over, that the management
  `.msc-*` tokens EQUAL the report band `.usc-identity-*` tokens (fill: green/orange/red; rem text:
  green-dark/orange-darker/red-dark). A real render (both tabs, 4 threshold cases) confirms it visually.
- **M4 — WCAG AA.** The `high` rem text uses `--orange-darker` (#c2410c, 5.18:1) on BOTH tabs — never
  `--orange-dark` (#ea580c, 3.56:1, fails AA). (This PR fixes the band's pre-existing `--orange-dark` miss.)
- **M5 — injector contract byte-untouched.** `buildStagesHtml`, `buildActions`, `buildOverride`,
  `buildPackagesBreakdown` and every injector anchor are UNCHANGED: `.management-service-card[data-service-id]`,
  `.management-stage`/`.management-stage-name`(=`stage.name`)/`.management-stage-info`, the 5 `data-service-action`,
  `.override-btn`+data-*, `.edit-pkg-date-btn`+data-*. `ReportTab` still emits ZERO `.management-*`.
- **M6 — admin-safety: display-only.** No count / filter / sort / aggregate / status logic changes. The change
  is which COLOR a meter shows for a given used/total — no data, no visibility, no selectable-unit change.
- **M7 — green gates.** Full admin-panel vitest suite passes; stylelint 0; eslint 0; `node --check` OK;
  `?v` bumped on both `UnifiedServiceCard.js` and `clients-modals.css`.

## SHOULD

- **S1** Comments at `meterStatus` + the `.msc-*--good`/`.usc-identity-rem--high` rules explain the shared-SSOT intent.
- **S2** No hardcoded transition durations added (reduced-motion safety net preserved) — this PR adds none.
- **S3** The describe/comment that previously documented the OLD absolute threshold is re-anchored to the relative one (no stale "≤10" left claiming to be current).

## Gate notes

- **G6 (breaking/behavioral):** DECLARED display-behavior change on the report band — the meter threshold is now
  relative (a service with few absolute hours left but low % used reads `good`, not `high`) and the `high` rem
  text is darker. Haim-approved ("unify the meter to a shared relative threshold across both tabs — restores full
  display consistency"). No data/contract/route change → no migration needed; rollback = `git revert`.
- **G7 (security):** N/A — no auth / PII / permissions / rules touched.
- **devils-advocate:** NOT triggered per §3.8.4 — frontend display-only, <100 lines, no rules/schema/claims/
  migration/injector change (the injector-heavy stepper work was deferred to a separate PR).
