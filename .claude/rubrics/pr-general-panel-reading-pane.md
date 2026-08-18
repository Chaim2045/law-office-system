# Rubric — restyle the "כללי · פרטי לקוח" panel to the reading-pane line

**Scope:** frontend-only, DEV, admin-critical. The management modal's default "כללי" panel (`#cmGeneralDetail` on `clients.html` — fee-agreements list + upload + 4 quick actions) was the last piece of the unified client-card still on the OLD heavy surface (`.fee-agreement-*` rows, `.management-action-btn` card grid, `.management-section` headers). This PR restyles it to the same calm reading-pane `.gen-*` line the identity band / legal stepper / report tab already use. **DISPLAY ONLY** — every wired handler is preserved byte-for-byte.

**Change:** 4 files. `js/ui/ClientManagementModal.js` (`renderFeeAgreements` HTML templates only — empty state + row + list wrapper), `clients.html` (`#cmGeneralDetail` markup + `?v=` bump on `clients-modals.css` **and** `ClientManagementModal.js`), `css/clients-modals.css` (new `.gen-*` blocks + delete the old `.fee-agreement-*` / `.management-action*` / `.management-section*` blocks), `tests/unit/admin-panel/general-panel-reading-pane.test.ts` (new contract guard). **NO** backend / CF / rules / handler-logic change.

## MUST (all required for PASS)

- **M1 — every wired hook preserved (the crux).** The agreement action buttons keep BOTH `data-action="view|delete"` AND `data-agreement-id="${agreement.id}"` (read by `attachFeeAgreementActionListeners` inside `#feeAgreementsList`); every upload affordance still fires `document.getElementById('uploadFeeAgreementBtn').click()`; the 4 quick-action `data-action` values (`add-service`/`renew-hours`/`change-status`/`close-case`) are intact (read by the modal-wide `handleQuickAction` switch). The 3 wired ids survive: `#feeAgreementInput`, `#uploadFeeAgreementBtn`, `#feeAgreementsList`. **Proven:** `general-panel-reading-pane.test.ts` groups 1 + 3.
- **M2 — delete-old-not-layer.** The old template/CSS is REMOVED, not shadowed: `ClientManagementModal.js` emits zero `fee-agreement-item`/`fee-agreement-add-btn`/`fee-agreements-empty`/`empty-state-btn`; `#cmGeneralDetail` emits zero `management-section`/`management-action-btn`/`management-actions-grid`; `clients-modals.css` deletes the `.fee-agreement-*`, `.management-action*`, `.management-section*` rule blocks (grep-verified clients.html-only before deletion). **Proven:** test groups 2 + 4.
- **M3 — Design Bar: tokens only.** All new `.gen-*` CSS uses `design-system.css` tokens (`--gray-*`, `--space-*`, `--blue`/`--blue-dark`, `--green-dark`, `--red-dark`, `--radius-*`, `--text-*`, `--font-*`, `--transition-*`, `--letter-spacing-wide`); RTL logical props (`padding-inline-start`, `border-inline-start`, `text-align: start`); motion only via `--transition-*` (respects `prefers-reduced-motion`).
- **M4 — WCAG AA (Mechanical, non-overridable per MASTER_PLAN §2.0.2).** Every `.gen-*` text/icon clears AA: primary button = `#fff` on `--blue-dark` (5.17:1); destructive text = `--red-dark` (#dc2626 = 4.83:1) — NEVER `--red`(3.76:1)/`--blue`(3.68:1) as text; labels/meta = `--gray-500`(4.74:1)/`--gray-600`/`--gray-700`/`--gray-800`. Icon glyphs are decorative (`aria-hidden`) with real `aria-label` on icon-buttons. **Proven:** test group 5 pins `--blue-dark`/`--red-dark`; contrast values measured.
- **M5 — a11y.** `:focus-visible` ring on every interactive `.gen-*` element (`.gen-icon-btn`, `.gen-upload`, `.gen-act`); icon-buttons carry `aria-label`; decorative `<i>` carry `aria-hidden="true"`. **Proven:** test group 5.
- **M6 — guard + gates.** `general-panel-reading-pane.test.ts` green; stylelint 0; eslint 0 errors; `node --check` OK; `?v=` bumped on BOTH `clients-modals.css` and `ClientManagementModal.js`; `@keyframes spin` preserved (still used by `clients.css` + `AddPackageToStage`); no other admin test regressed.

## PRODUCT-GRADE GATES (expected)

- **G1** PASS — display-only; no new error path; no NaN/undefined/stack traces introduced.
- **G2** PASS — Rollback = single `git revert` (restores the old markup/CSS/templates + `?v=`). Code-only.
- **G3** N/A — read-only display; no write path, no data mutation.
- **G4** PASS — the contract guard (handlers preserved + old surface removed) + a real-CSS Playwright render of the live modal shown to Haim + a manual DEV smoke: open a client card → "כללי" → the agreements list + upload + 4 quick actions render in the calm line; view/delete/upload/add-service/renew/change-status/close-case all still fire.
- **G5** PASS — all customer-facing text stays Hebrew. The 4 quick-action labels + view/delete tooltips/aria-labels are unchanged; the empty-state title + upload labels were intentionally reworded to calmer copy (`"אין הסכמי שכר טרחה"` → `"אין הסכמי שכר טרחה עדיין"`; `"העלאת הסכם"` / `"הוסף הסכם נוסף"` → `"העלה הסכם"`) — all Hebrew, no English introduced.
- **G6** — **DISPLAY CHANGE (declared, ADMIN SAFETY).** The "כללי" panel's look changes; no count/filter/aggregate/state/permission change. Every handler + id + data-action is byte-preserved (M1). Scoped to `#cmGeneralDetail`; the per-service cards + injector anchors (`.management-service-card`, `.management-stage*`) are untouched.
- **G7** N/A — no auth/PII/permissions.

## Rollback

```bash
git revert <merge-commit-sha>   # restores the old .gen-*→fee-agreement/management-* markup, CSS, templates, and both ?v= tokens
```
