# Rubric — H.3 PR4: the Profitability Dashboard UI

**Title:** A NEW admin-only `apps/admin-panel/profitability.html` — the FIRST major visible bud: a real-time per-case Profitability dashboard. Reads the CF-only `client_profitability` collection LIVE via `onSnapshot` (PR3's rule permits an admin listener) and JOINs each Forecast doc to `client.plan` (PR1) by caseNumber. Per-row recompute + a per-case detail drawer via the audited `getProfitability` callable. FRONTEND-ONLY.
**Branch:** `feat/h-3-pr4-dashboard`
**Base:** `main` (PR3 #373 merged + deployed)
**App / Env:** Admin Panel (frontend). DEV (`main`). A NEW page (NOT grandfathered → full Design Bar). NO backend/rules/claims change → **devils-advocate NOT required** (verified by the security lens: zero `.rules`/auth/claims/schema/PII-surface-on-doc change; PR3 built the rule + callables).
**Effort:** MEDIUM. Investigation: 4-lens H.3-PR4 workflow (frontend/data/security/completeness, 2026-06-15) + Haim checkpoint (4 locked decisions).

**Context:** §8.5 PR4. The dashboard renders confidential cost data to an admin; the new client JS is the unproven PII surface — the cost/profit VALUE must never reach the client console/log/DOM-storage/URL (§7.6, public repo). `client_profitability` is empty + `actualCost` system-wide `null` today (employee_costs=0, backfill un-run) → the dashboard MUST ship **honest-empty** (never ₪0/null/NaN).

## MUST criteria (block on FAIL)

### M1 — 🔴 null ≠ 0 (the load-bearing cost render rule)
**Rule:** `actualCost===null` renders a clear Hebrew "עלות לא זמינה" / dash — NEVER ₪0 (a 0 would fabricate a "this case costs nothing" signal). A real 0 (free) IS shown as ₪0 (known). A client with no forecast doc shows "טרם חושב". `paidRevenue`/`projectedProfit` are null → the profit column is HIDDEN ("בהמשך H.6"), never computed against ~0 revenue. `actualHours=0` (a real value, "0.0") is distinct from `actualCost=null` (unknown, dash).
**Evidence:** `profitability-format.js` `formatActualCost`/`coverageBadge`; the `profitability-format.test.ts` null≠0 + coverage tests; the row render in `ProfitabilityPage.js`.

### M2 — Admin-only fail-closed render gate (not just authentication)
**Rule:** After `initAuthGuard` (authentication-only), the page re-verifies `getIdTokenResult().claims.role === 'admin'` BEFORE attaching the `onSnapshot` listener or calling any callable. The gate FAILS CLOSED (any token error → non-admin → `renderAccessDenied`). The page gate is `role==='admin'` — STRICTER than the rule's `admin||partner` (the UI stays admin-only per D-E; a partner must not get the page). The listener is torn down on logout (`teardown()`).
**Evidence:** `profitability.html` gate (mirrors employee-costs.html:132-149); the listener attaches only inside `ProfitabilityPage.init` (post-gate); `teardown()` unsubscribes.

### M3 — 🔴 No cost/profit VALUE escapes the client (§7.6 never-regress)
**Rule:** The new client JS NEVER `console.*`/`Logger.*` an `actualCost`/`projectedProfit`/`paidRevenue` value, the onSnapshot doc, or the `getProfitability` result; never writes one to `localStorage`/`sessionStorage`/a URL/a `data-` attribute; never echoes one into a toast/error (Hebrew message-by-code only). Row buttons carry only `data-case` (the non-PII caseNumber). A static PII source-guard (WIDENED COST_REF for cost AND profit AND revenue) enforces it over `ProfitabilityPage.js` + `profitability-format.js`.
**Evidence:** `profitability-pii-guard.test.ts` (static scan, sanity cases incl. the page-name non-match); manual grep of the diff for `console`/`localStorage` near a value identifier.

### M4 — Live onSnapshot + in-memory JOIN (no 2nd listener, no plan snapshot)
**Rule:** ONE `onSnapshot` on `client_profitability`; the Plan/name comes from an in-memory clients load (`window.firebaseDB.collection('clients').get()`, with the SAME internal-client filter as `ClientsDataManager`) JOINed by caseNumber — NO 2nd live listener and NO plan copy into the forecast doc. The grid re-renders on each snapshot delta. The onSnapshot `onError` renders a Hebrew banner (never a raw FirebaseError).
**Evidence:** `_attachListener` (single listener + unsub handle) + `_loadClients` (internal filter) + `_renderRow` (JOIN by caseNumber).

### M5 — Design Bar: tokens only, ModalManager, RTL, a11y; honest-empty/loading/error states
**Rule:** `profitability.html` mirrors the PR2 shell (RTL `lang="he" dir="rtl"`, `noindex`, the auth-guard + Navigation lifecycle); the detail drawer is a `ModalManager` modal (no inline `<div class="modal">`); CSS uses `design-system.css` tokens ONLY (color tints via the sanctioned channel-derivation with the explanatory comment + `-dark` accent text for AA — no new hex beyond that + `#fff`); every interactive element (sort headers, search, filter, row buttons, drawer) has a `:focus-visible` style + accessible name; one `<h1>`; transitions via `--transition-*`. Explicit LOADING (spinner), HONEST-EMPTY (banner "חישוב יומי 06:30" + per-row "טרם חושב"), and Hebrew ERROR states.
**Evidence:** the 4 new files; grep the CSS for hex/px beyond the documented tints; grep for `class="modal"` (none).

### M6 — Color on HOURS-vs-Plan only; per-row recompute; scope clean; suite + lint green
**Rule:** The only color signal is hours-vs-Plan (`hoursStatus`) — NO cost/profit alert + NO invented X% threshold (cost is null today; deferred). Recompute is per-row `recomputeProfitability(caseNumber)` ONLY (no bulk callable) + a "חושב לאחרונה" timestamp; the onSnapshot repaints. The diff touches ONLY `apps/admin-panel/**` + the 2 tests + the rubric — no `functions/`, no `firestore.rules`, no claims; no CRLF/dist drift staged. Root vitest green; lint 0 on the new JS/CSS.
**Evidence:** `git diff --name-only main...HEAD`; the `hoursStatus` usage; the per-row recompute; vitest + lint output in the PR body.

## SHOULD criteria (warn on FAIL)
### S1 — Sortable columns (caseNumber/name/expectedHours/actualHours), search, status filter (active default); works on first use (0 forecast docs) without looking broken.
### S2 — The `רווחיות` nav tab is DEFERRED to PR5 (the page is reachable directly by URL meanwhile); the H.2 backfill `--apply` is a SEPARATE supervised step (does NOT gate the merge); the dashboard ships honest-empty until costs are entered.
### S3 — A supervised post-merge live-smoke (admin opens `profitability.html` → sees the honest-empty grid → clicks "חשב מחדש" on a case → the row repaints) is documented in the PR body Test plan (the H.1.c "deploys-green-can-fail-at-runtime" lesson; client_profitability is empty until the job/recompute runs).

## PRODUCT-GRADE GATES (G1–G7)
- **G1 errors:** PASS — Hebrew loading/empty/error/access-denied states; `null` actualCost → "עלות לא זמינה" (never ₪0/NaN/undefined); onSnapshot/callable errors → Hebrew-by-code, never a raw FirebaseError/stack.
- **G2 rollback:** PASS — `git revert` removes the new page + JS/CSS + tests (additive; no existing page/route/collection changed). Code-only, ≤5 min. (No CF/rules to delete — PR4 is pure frontend.)
- **G3 monitoring:** N/A — the page only READS (onSnapshot) + INVOKES the existing audited callables (`getProfitability` audits server-side; `recomputeProfitability` is audit-first server-side); the client adds no data-mutation path of its own. No cost value may be client-logged (M3).
- **G4 customer test:** PASS — the `profitability-format` unit tests (the null≠0 / coverage / hours-status customer-render rules) + the PII source-guard + a documented manual live-smoke (admin → honest-empty grid → recompute → repaint). Listed in the PR Test plan.
- **G5 Hebrew UI:** PASS — every customer-facing string Hebrew, RTL; this is the heart of the gate for a new page.
- **G6 breaking change:** PASS — additive (a new page + new JS/CSS); no existing page, route, callable, collection, or token changed/removed.
- **G7 security:** PASS — **security-access-expert reviewed (4-lens investigation)**: admin-only at the render gate (fail-closed `role==='admin'`, stricter than the admin||partner rule) + the rule blocks non-admin/non-partner at the DB; the cost/profit VALUE never reaches the client console/log/DOM-storage/URL (M3, enforced by the widened guard); cost stays off the world-readable clients doc (PR4 only reads it). NO `firestore.rules`/auth/claims/PII-surface-on-doc change → **devils-advocate NOT required** (like PR2).

## VERDICT
`outcomes-grader` must return **PASS** / **PASS_WITH_WARNINGS** before `gh pr create`.
