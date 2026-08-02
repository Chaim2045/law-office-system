# Rubric — PR-U4: report tab (additive) inside the unified ClientManagementModal

**Track:** Admin modal-unification (`docs/WORK-PLAN-MODAL-UNIFICATION.md`, PR-U4; spec §PR-U4 + §12/§13).
**Scope:** frontend-only, ADDITIVE. NEW `UnifiedServiceCard.js` (mode `report-select`) + `ReportTab.js` + `clients.html` (tab-bar + panels + 3 script tags + `?v=`) + `ClientManagementModal.js` (`open(client, dm, opts)` + tab-switching) + `clients-modals.css` (tab/panel/report-tab CSS) + tests. Zero `functions/**`/rules/claims/callable. clients-fluent.html untouched (no management modal there).
**Haim-approved decomposition:** report tab additive now; the management master-detail (rail+detail) adoption is U5. **devils-advocate MANDATORY.**

## MUST (all required for PASS)

- **M1 — additive, nothing existing changes behavior.** The old "הפק דוח" table button still opens the old `ClientReportModal`. The tab is reachable only from within the unified modal. `open()`'s existing 2-arg callers keep working (`opts` defaults to `{}`).
- **M2 — VAL-2 / injector contract (THE #1 risk).** `open()` calls `renderServices()` + `renderFeeAgreements()` UNCONDITIONALLY, even when opening straight to the report tab. Both panels stay in the DOM (CSS toggle, not removal), so `ServiceOverdraftResolution` (`.management-service-card[data-service-id]`) + `AddPackageToStage` (`.management-stage`/`.management-stage-name`) keep firing on the hidden management panel. The report cards use `.report-*` classes (NEVER `.management-*`), so the injectors never touch them.
- **M3 — DA-1 radio-name isolation.** The tab's format radios use `name="mgmtReportFormat"` and `getFormData` reads them SCOPED to the tab root — never the global `input[name="reportFormat"]` the old modal owns. A rogue global `reportFormat=excel` does not bleed into the tab.
- **M4 — formData bit-identical.** `ReportTab.getFormData()` returns exactly `{clientId, clientName, startDate, endDate, service, serviceId, stage, reportType, reportFormat}` (the ClientReportModal contract); `reportType` is always `'hours'`; the selection fills `service`/`serviceId`/`stage`. **Legal-stage parity (devils-advocate F1):** a legal selection's `service` label uses `getStageName(stage.id)` — byte-matching the old modal's label — so the generated report reads identically regardless of surface (hours were already stage-id-keyed).
- **M5 — D1/D2 fixed in the tab.** Cards come from `ServiceCardModel` (U2) → `UnifiedServiceCard` (report-select). D2: two legal procedures both render as selectable (the old modal drops one). D1: no phantom (the model never reads the ledger).
- **M6 — DA-2 empty-stage legal.** A legal_procedure is selectable ONLY via a concrete active/completed stage; `UnifiedServiceCard` never emits a `stage:''` legal selection (a non-selectable muted card instead), and `ReportTab._validateSelection` refuses to generate one.
- **M7 — the two actions.** [הפק דוח] → `window.ReportPreview.showForFormData(formData)`; [הפק ושלח במייל] → `window.ReportGenerator.generateAndEmail(formData)` — behind explicit buttons, with a selection guard.
- **M8 — open mechanism preserved.** The unified modal still opens via the plain inline `style.display='flex'` (NOT ModalManager / a class toggle) — the injectors key off `#clientManagementModal`'s `style.display`.
- **M9 — dependency wiring + cache-bust.** `ServiceCardModel.js` + `UnifiedServiceCard.js` + `ReportTab.js` script tags added to clients.html (after escape-html.js, which `UnifiedServiceCard` uses); `ClientManagementModal.js` `?v=` bumped.
- **M10 — Design Bar.** Tab/panel CSS uses design-system tokens (`--transition-*`, `--gray-*`, `--blue*`, `--space-*`, `--radius-*`) — no hardcoded transition ms (reduced-motion honored via tokens); `:focus-visible` on tabs; ARIA tablist/tab/tabpanel + `aria-selected`; RTL-clean.
- **M11 — gates.** ESLint 0 errors (alert/console warnings inherited from the codebase pattern); `node --check` clean; full admin-panel suite green.

## SHOULD

- **S1** — `meta.unassignedHours` info-row ("שעות ללא שיוך") DEFERRED (computing it would re-introduce ledger-matching, the D1 class); the D1 fix (no phantom) is achieved without it. Declared.
- **S2** — the report tab is (re)rendered for the current client on each switch (no stale-client bug across opens).
- **S3 (SEC)** — all tofes/client strings escaped at the sink (`UnifiedServiceCard` routes names through `window.escapeHtml`).

## PRODUCT-GRADE GATES (expected)

- **G1** — PASS (Hebrew alerts with next-action; no stack traces/undefined in UI). **G2** — PASS (`git revert` — single squash; the tab + scripts revert together). **G3** — N/A (no write path; the report generation reuses the existing engine unchanged). **G4** — PASS (16 behavioral + source-contract tests; manual-smoke plan in the PR). **G5** — PASS (Hebrew UI). **G6** — PASS — additive (the old path is primary; no data/schema/contract change; `open`'s 3rd arg is optional). **G7** — N/A→PASS (display only; the SEC escaping is preserved).
