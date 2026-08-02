# Rubric — PR-U5a: `manage-detail` renderer (dead code) + DOM-equality proof

**Track:** Admin modal-unification (`docs/WORK-PLAN-MODAL-UNIFICATION.md`, PR-U5, split — Haim-approved). U5a builds + PROVES the renderer as dead code; **U5b** does the cutover (delete the old renderer + master-detail + rewire) and carries the **mandatory devils-advocate**.
**Scope:** frontend-only, ADDITIVE. `UnifiedServiceCard.js` gains `buildManageDetail` + `buildRailRow` (+ helpers); `ServiceCardModel.js` gains 7 raw manage-mode fields; NEW `manage-detail-equality.test.ts`. **NOT wired into ClientManagementModal** — the live panel still uses its own `renderServiceCard`. Zero `functions/**`/rules/claims/callable. clients.html/CSS untouched.
**Type:** dead code → **zero behavioral change** on any live surface.

## MUST (all required for PASS)

- **M1 — DOM-equality (THE crux).** For the same fixtures, `UnifiedServiceCard.buildManageDetail(ServiceCardModel card)` emits the SAME contract-bearing DOM as the old `ClientManagementModal.renderServiceCard(service)`: the `.management-service-card[data-service-id]`, the 5 `data-service-action` values (renew/next-stage/change-status/complete/delete, per type), the `.override-btn` (data-active/data-name), the `.edit-pkg-date-btn` (data-service-id/data-package-id/data-current-date), the `.management-hours-stat` values (נרכשו/נוצלו/נותרו), the type + status badges, and the truncated name-badge. Proven by driving BOTH renderers and `toEqual` on the extracted facts.
- **M2 — `.management-stage-name` === `stage.name`.** For a legal_procedure, each `.management-stage-name` textContent is EXACTLY the stage name (resolved as `stage.name || stage.description || 'שלב'`, matching the old `renderStages`) — the exact string AddPackageToStage matches on. The model is built WITHOUT `getStageName` so the resolution is identical. `.management-stage` + `.management-stage-info` present per stage.
- **M3 — injector anchors present.** The new card is a `.management-service-card` with `data-service-id`; legal services carry `.management-stage`/`.management-stage-name`/`.management-stage-info` — the exact selectors ServiceOverdraftResolution + AddPackageToStage scan.
- **M4 — SEC-1 escape-at-sink.** The name is escaped into the `title` attribute (not just the text); `data-name`, `overrideApprovedBy`, `overrideNote`, and the package `description` route through `window.escapeHtml` — the unified renderer does NOT inherit the old renderer''s raw-attribute-injection gaps.
- **M5 — model extension is additive + raw.** `ServiceCardModel.buildCard` carries `startedAt`/`createdAt`/`fixedPrice`/`overrideActive`/`overrideApprovedAt`/`overrideApprovedBy`/`overrideNote` raw (overrideApprovedAt keeps the `{seconds}` shape); the U2 tests still pass (they use `toMatchObject`).
- **M6 — dead code / no cutover.** `ClientManagementModal.js` still calls its own `renderServiceCard` and does NOT reference `buildManageDetail` (asserted). No live page renders the new manage-mode output. `rail-row` carries NO `.management-*` classes (DA-3 — so the injectors never match a rail row).
- **M7 — DA-3 not locked.** The equality test does NOT assert the AddPackageToStage first-legal-procedure-only defect as correct behavior (it only pins the DOM the injector reads).
- **M8 — gates.** ESLint 0 errors; `node --check` clean; full admin-panel suite green.

## SHOULD

- **S1** — `report-select` mode (U4) unchanged; the manage helpers are separate + only reached via the new exports.
- **S2** — the reproduction mirrors the old exactly incl. the (intentional) double-nested `.management-service-info` + the per-stage hours format, so U5b''s cutover is a drop-in.

## PRODUCT-GRADE GATES (expected)

- **G1** N/A (no error path; dead code). **G2** PASS (`git revert` — deletes the additions). **G3** N/A (read-only pure builders). **G4** PASS (the equality proof IS the customer-scenario test — it pins the exact DOM the injectors + 14 callables depend on). **G5** N/A→PASS (Hebrew strings reproduced verbatim). **G6** PASS (dead code; the model fields are additive/raw; no contract change). **G7** N/A→PASS (SEC-1 escaping is a strict improvement over the old renderer; no auth/PII/permissions).
