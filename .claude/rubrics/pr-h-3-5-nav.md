# Rubric — H.3 PR5: the רווחיות nav tab (closes H.3)

**Title:** Add the `רווחיות` (profitability) tab to the admin Navigation so the PR4 dashboard (`profitability.html`) is reachable from the nav bar (it was direct-URL-only). A ONE-ITEM additive change to `Navigation.js` `navItems`. The final piece of H.3.
**Branch:** `feat/h-3-pr5-nav`
**Base:** `main` (PR4 #374 merged + deployed)
**App / Env:** Admin Panel (frontend). DEV (`main`). Touches the shared `Navigation.js` (an admin-display change — additive only).
**Effort:** LIGHT (<10 lines). No formal checkpoint (decision-point: tiny change, no architectural impact); no devils-advocate (frontend-only, no rules/auth/schema). PR4 investigation already mapped the Navigation.js surface.

**Context:** `Navigation.js` renders a FIXED `navItems` array; a new page stays invisible until that array is edited (that edit IS this PR). `profitability.html` already calls `Navigation.init('profitability')` (PR4) → the new tab's `id` must be `'profitability'` for active-state to work.

## MUST criteria (block on FAIL)

### M1 — The nav item is correct + complete
**Rule:** `Navigation.js` `navItems` gains `{ id: 'profitability', label: 'רווחיות', icon: 'fa-money-bill-trend-up', href: 'profitability.html' }`. The `id` is exactly `'profitability'` (matches the page's `Navigation.init('profitability')` for active-state); the `href` is `'profitability.html'`; the `label` is Hebrew; the icon is a valid Font Awesome 6.5.1 class distinct from the existing tabs (workload uses `fa-chart-line`).
**Evidence:** the `Navigation.js` diff; the `navigation-profitability-tab.test.ts` static guard; `profitability.html` `Navigation.init('profitability')`.

### M2 — Additive only; no existing tab/behavior changed
**Rule:** The change ADDS one array entry; it does NOT modify/remove any existing tab (users/clients/workload/announcements), the nav buttons (approvals/audit-trail/settings/logout), the render template, the active-state logic, the approval-count listener, or the injected styles. No filtering/counts/states touched (ADMIN SAFETY).
**Evidence:** `git diff` shows ONLY the one-line insertion in `navItems`; the test asserts the existing 4 tabs still present.

### M3 — Scope clean; suite green
**Rule:** The diff touches ONLY `apps/admin-panel/js/ui/Navigation.js` + the new test + the rubric — no `functions/`, no `firestore.rules`, no other page, no CRLF/dist drift staged. Root vitest green; lint 0 on the changed JS.
**Evidence:** `git diff --name-only main...HEAD`; vitest + lint output.

## SHOULD criteria (warn on FAIL)
### S1 — Placement after `workload` (groups the analytical/management views); the page remains admin-gated by its own render gate (the nav tab is cosmetic — Navigation.js has no role-gating, so a non-admin clicking it still hits `profitability.html`'s fail-closed `role==='admin'` gate + the DB rule).
### S2 — A supervised post-merge click-smoke (admin → nav shows the רווחיות tab → click → lands on `profitability.html` with the tab active) is documented in the PR body.

## PRODUCT-GRADE GATES (G1–G7)
- **G1 errors:** N/A — no error path added (a static nav link; the target page owns its own error/empty/access states).
- **G2 rollback:** PASS — pure `git revert` (one additive array entry). ≤2 min, code-only.
- **G3 monitoring:** N/A — no data mutation (a nav link).
- **G4 customer test:** PASS — the static-scan test (the tab exists + correct href + id matches the page's active-state init + existing tabs intact) + a documented manual click-smoke.
- **G5 Hebrew UI:** PASS — the label `רווחיות` is Hebrew; RTL nav.
- **G6 breaking change:** PASS — additive (one nav item); no existing tab/route/behavior changed.
- **G7 security:** N/A — no auth/permissions/PII/rules change. The nav link is cosmetic; access control stays at `profitability.html`'s render gate (PR4) + the firestore.rules `client_profitability` gate (PR3). Navigation.js has no role-gating (pre-existing — a nav link is not access control).

## VERDICT
`outcomes-grader` must return **PASS** / **PASS_WITH_WARNINGS** before `gh pr create`. Closes H.3 (PR1–PR5 all done).
