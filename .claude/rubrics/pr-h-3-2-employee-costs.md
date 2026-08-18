# Rubric — H.3 PR2: the employee cost-entry admin page

**Title:** A NEW admin-only page (`employee-costs.html`) where an admin/accountant enters each employee's cost-per-hour, populating the (empty) `employee_costs` collection via the already-wired + admin-gated `setEmployeeCost`/`getEmployeeCost` callables. FRONTEND-ONLY. The data-population prerequisite that unblocks the H.2 backfill + the H.3 Forecast.
**Branch:** `feat/h-3-pr2-employee-costs`
**Base:** `main`
**App / Env:** Admin Panel (frontend). DEV (`main`). A NEW page (NOT grandfathered → full Design Bar). NO backend/rules/claims change → **devils-advocate NOT required** (verified: zero `.rules`/auth/claims/PII-surface change).
**Effort:** MEDIUM. Investigation: 4-lens H.3-PR2 workflow (frontend/backend-data/security/completeness, 2026-06-11) + Haim checkpoint (dedicated page + the scope bundle).

**Context:** §8.5 PR2. `employee_costs/{email}` is CF-only (`if false`); the page reaches cost ONLY through the two admin-gated callables. The new client JS is the unproven PII surface — the cost VALUE must never reach the client console/logs/DOM-storage (§7.6, public repo). Server is already disciplined.

## MUST criteria (block on FAIL)

### M1 — Dedicated page via the mandated primitives (Design Bar)
**Rule:** New `apps/admin-panel/employee-costs.html` mirrors `settings.html` (RTL `lang="he" dir="rtl"`, `noindex`, the auth-guard + Navigation lifecycle); the set-cost FORM is a `ModalManager` modal (no inline `<div class="modal">`); CSS uses `design-system.css` tokens ONLY (no hardcoded hex/px, no `fluent-design.css`, no `feature-flags.html` patterns); every interactive element has a `:focus-visible` style + accessible name; one `<h1>`; transitions via `--transition-*` tokens (no hardcoded ms).
**Evidence:** `git diff` of the 3 new files; grep the new CSS for hex/px literals (should be none beyond tokens); grep for `class="modal"` (none).

### M2 — Admin ROLE gate at render (not just authentication)
**Rule:** After `initAuthGuard` (authentication-only), the page re-verifies `getIdTokenResult().claims.role === 'admin'` before rendering ANY cost UI or calling `getEmployeeCost`. A non-admin sees a Hebrew access-denied state, never a cost surface. (Defense-in-depth — the callables also reject non-admins server-side; `employee_costs` is CF-only.)
**Evidence:** the page JS role-check before render; no cost call on the non-admin path.

### M3 — 🔴 No cost VALUE escapes the client (the §7.6 never-regress)
**Rule:** The new client JS NEVER `console.*` a `costPerHour` or the `getEmployeeCost` response; never writes cost to `localStorage`/`sessionStorage`/a URL/`data-` attribute; never echoes cost into a toast/error string; CLEARS the cost field on modal close. A static PII source-guard test enforces it (mirroring the repo's existing frontend PII guard, e.g. Pre-H.1.0b).
**Evidence:** the PII guard test (static scan of `EmployeeCostsPage.js`); manual grep of the diff for `console`/`localStorage`/`sessionStorage` near cost.

### M4 — Mandatory pre-fill; not-found = empty state; canonical email key
**Rule:** Selecting an employee calls `getEmployeeCost({email})` FIRST; a `not-found` renders the normal empty "טרם הוגדרה עלות" state (NOT an error toast) — because `employee_costs` is ~0 docs, every first pick is not-found. On success the current cost is shown before the overwrite (`setEmployeeCost` is a single-doc overwrite). The email sent is the canonical `DataManager` doc.id/email (never a typed/display string) → no casing false-not-found.
**Evidence:** the page JS select→getEmployeeCost→pre-fill flow; the not-found branch renders the empty state; the email source is `getAllUsers()` doc data, not an input.

### M5 — Field validation mirrors the Zod contract; Hebrew errors
**Rule:** `costPerHour` required, client-validated `1..20000` (min 1, NOT 0) with a Hebrew message; `source` a Hebrew-labelled `<select>` of exactly `['accountant','manual','import']` (default 'manual'); currency a FIXED 'ILS' label (no picker); `validFrom` not exposed. `setEmployeeCost` errors surface as Hebrew-by-code (mirror `SystemSettingsPage.js` `_callUpdate`). No English/stack/`undefined`/`NaN` in any customer-facing string.
**Evidence:** the form markup + validation; the callable error handling.

### M6 — No backend/rules/claims change; suite + lint green
**Rule:** The diff touches ONLY `apps/admin-panel/**` (+ the rubric + the guard test) — no `functions/`, no `firestore.rules`, no claims. The relevant test suite green; lint 0 on the new JS/CSS. (Backend is already live; PR2 is pure client.)
**Evidence:** `git diff --name-only main...HEAD`; lint output; the test runner.

## SHOULD criteria (warn on FAIL)
### S1 — Loading/empty/error/stale states are professional Hebrew; search/filter on the employee list; works on first use (0 costs) without looking broken.
### S2 — The `רווחיות` nav tab is DEFERRED to PR5 (the page is reachable directly meanwhile); the H.2 backfill `--apply` is a SEPARATE supervised step (documented in the PR body, does NOT gate the merge).

## PRODUCT-GRADE GATES (G1–G7)
- **G1 errors:** PASS — professional Hebrew loading/empty/error/access-denied states; no stack/`undefined`/`NaN`/English; the not-found is a normal empty state, not an error.
- **G2 rollback:** PASS — `git revert` removes the new page (additive; no existing page/route changed). Code-only, ≤5 min.
- **G3 monitoring:** N/A — the page only INVOKES the existing audited callables (`setEmployeeCost` is audit-first server-side); the client adds no data-mutation path of its own. (No cost value may be client-logged — M3.)
- **G4 customer test:** PASS — the PII source-guard test + (the customer scenario) a documented manual smoke (admin opens the page → picks an employee → not-found empty state → enters a cost → saves → re-open shows it) since this is a UI page; listed in the PR body Test plan.
- **G5 Hebrew UI:** PASS — every customer-facing string Hebrew, RTL; this is the gate's heart for a new page.
- **G6 breaking change:** PASS — additive (a new page + new JS/CSS); no existing page, route, callable, or token changed/removed.
- **G7 security:** PASS — **security-access-expert reviewed (H.3-PR2 investigation)**: admin-only at 3 layers (render-time role gate + both callables server-gated + `employee_costs` CF-only); the cost VALUE never reaches the client console/log/DOM-storage (M3, enforced by a guard). No `firestore.rules`/auth/claims/PII-surface change → devils-advocate NOT required. The cost is shown only to the authorized admin entering it.

## VERDICT
`outcomes-grader` must return **PASS** / **PASS_WITH_WARNINGS** before `gh pr create`.
