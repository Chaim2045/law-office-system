# Rubric — PR-U5b: management-modal cutover to master-detail (adopt the unified renderer)

**Track:** Admin modal-unification (`docs/WORK-PLAN-MODAL-UNIFICATION.md`, PR-U5, split — Haim-approved: U5a built + PROVED the renderer as dead code; **U5b is the cutover**). High-stakes / admin-critical / refactor >100 lines → **devils-advocate MANDATORY** (§3.8.4).
**Scope:** frontend-only. `ClientManagementModal.js` (`renderServices` rewritten to master-detail via `ServiceCardModel`+`UnifiedServiceCard`; accordion→rail-selection; the old renderer cluster no longer wired), `clients.html` (`#cmManagePanel` → `cm-split` rail+detail; fee-agreements + quick-actions moved verbatim into the "כללי" detail panel), `clients-modals.css` (rail/detail/selection CSS), tests. Zero `functions/**`/rules/claims/callable.
**Type:** behavioral change (the management panel layout changes accordion→master-detail) — NOT a "visual-only tweak" (ADMIN SAFETY RULE). No data/contract/route/count-key change.

## MUST (all required for PASS)

- **M1 — the cutover.** The LIVE management panel renders services through `ServiceCardModel.build(client)` (manage mode, NO getStageName) → `UnifiedServiceCard.buildManageDetail`/`buildRailRow`. The panel no longer *invokes* its own `renderServiceCard`/`getServiceInfo`/`renderStages`/`getServiceActions`/`_renderPackagesBreakdown` in the live path; `attachServiceToggleListeners` is deleted.
- **M2 — injector DOM contract (THE crux).** `#managementServicesList` keeps its exact `id` + `.management-services-list` class; ALL `buildManageDetail` cards are present in the DOM at once (appended as elements) so `ServiceOverdraftResolution` (`.management-services-list .management-service-card[data-service-id]`) + `AddPackageToStage` (`.management-stage-name` textContent===`stage.name`, inject into `.management-stage-info`) still find + inject into every card — including ones hidden via `display:none` (querySelectorAll ignores CSS visibility; the injectors must not depend on layout measurement). The `#clientManagementModal` `style.display` gating is unchanged.
- **M3 — actions preserved.** `attachServiceActionListeners` is UNCHANGED and binds all 5 `data-service-action` (renew/next-stage/change-status/complete/delete per type) + `.override-btn` (data-active/data-name/data-service-id) + `.edit-pkg-date-btn` (data-service-id/data-package-id/data-current-date) on the new cards. All 14 callables (updateClient/setServiceOverride/addServiceToClient/changeClientStatus/closeCase/updatePackagePurchaseDate/addPackageToService/moveToNextStage/completeService/changeServiceStatus/deleteService/uploadFeeAgreement/getFeeAgreementUrl/deleteFeeAgreement) + `_editPackagePurchaseDate` intact.
- **M4 — rail selection replaces the accordion.** Default = "כללי". Clicking a service rail row shows ONLY that card (body revealed) + hides the others + hides the "כללי" panel; clicking "כללי" shows fee-agreements + quick-actions + hides the service list. Rail rows are native `<button>`s (keyboard Enter/Space), `role="tab"`, `aria-selected` maintained, `:focus-visible`. After a post-action re-render (`renderServices` runs from the 8 action handlers) the selection is restored; if the selected service was deleted, selection falls back to "כללי" (no crash).
- **M5 — VAL-2.** `renderServices()` + `renderFeeAgreements()` run on modal `open()` regardless of `initialTab` (even opening straight to the report tab), so the injectors always have their DOM.
- **M6 — "כללי" panel intact.** The fee-agreements section (`#feeAgreementsSection`/`#feeAgreementInput`/`#uploadFeeAgreementBtn`/`#feeAgreementsList` ids byte-preserved) + the 4 `data-action` quick-action buttons moved verbatim into `#cmGeneralDetail`; `renderFeeAgreements` + the quick-action handlers still work.
- **M7 — SEC-1 + no PII.** All dynamic strings escaped at the sink via `window.escapeHtml` (the unified renderer already does — no regression; escaped `title`, `data-name`, override fields, package description). No PII in tests/fixtures/logs.
- **M8 — dead-code cluster resolved explicitly.** The old `renderServiceCard`+helpers are either (a) DELETED in this PR (with the 3 dependent tests retargeted onto the unified renderer), or (b) RETAINED as a **documented, deliberate parity-oracle** with the byte-delete tracked for the delete-last step — NOT left as ambiguous, unexplained dead code. Whichever: stated in the PR body with the rationale.
- **M9 — gates.** Full admin-panel vitest suite green (incl. the updated equality test + the new `manage-cutover.test.ts` proving the master-detail scenario); ESLint 0 errors; `node --check` clean; `?v=` bumped on the touched assets.

## SHOULD

- **S1** — Emil-calm design-eng: semantic `design-system.css` tokens, `var(--transition-*)` (no hardcoded ms → reduced-motion safe), RTL-aware (rail on the right), `:focus-visible` on every rail row; the vestigial accordion affordance (header-click cursor/hover) neutralized in the detail context, not layered over.
- **S2** — responsive: on narrow widths the rail stays usable (stacks / horizontal-scroll), no body horizontal scroll.
- **S3** — the new cards are byte-identical to the U5a-proven `buildManageDetail` output (the equality test still passes), so the cutover is a drop-in with zero contract drift.

## PRODUCT-GRADE GATES (expected)

- **G1** N/A→PASS (no new error path; the Hebrew empty-state "אין שירותים פעילים" is preserved; no undefined/NaN in output).
- **G2** PASS (rollback = `git revert` the single squash-merge — frontend-only, no data/migration; the old renderer path returns).
- **G3** N/A (pure render restructure — no `transaction.set`/`update`/`.delete()`; the 14 mutating callables are UNCHANGED, their existing logging preserved).
- **G4** PASS (`manage-cutover.test.ts` drives the LIVE `ClientManagementModal` through the master-detail scenario — rail populate + select + injector-anchor + action-binding + empty-state — not just a helper; the equality oracle still pins parity).
- **G5** PASS (Hebrew customer-facing text verbatim; "כללי · פרטי לקוח" Hebrew).
- **G6** PASS-with-declaration (BEHAVIORAL: the management panel layout changes accordion→master-detail — declared in the PR body; NO breaking change to data schema / callable contracts / routes / the `overdraftResolved.isResolved` or any count/filter key; no migration needed — no persisted state depends on the accordion).
- **G7** N/A→PASS (no auth/PII/permissions; display-only; SEC-1 escape-at-sink is a strict improvement over the old renderer).
