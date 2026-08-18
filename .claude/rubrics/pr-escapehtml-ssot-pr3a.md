# Rubric — PR-ESCAPEHTML-SSOT-PR3a

**Title:** escapeHtml SSOT consolidation — PR3a: the mechanical remainder (route the live temp-div copies + delete the dead one)
**App:** Admin Panel · **Env:** DEV · **Frontend-only, refactor (SSOT-preserving) + dead-code deletion, admin-critical**

**Scope:** PR3a of the escapeHtml-dedup PR3 (Haim-approved decomposition 2026-06-21 — "PR3a now, PR3c after"; PR3a = the low-risk mechanical half, the behavioral onclick→addEventListener refactors are PR3c). Routes the remaining LIVE temp-div escapers to the SSOT `window.escapeHtml` (`apps/admin-panel/js/core/escape-html.js`) and deletes the dead one:
- **`service-card-renderer.js`** — replace `const escapeHtml = window.safeText || <temp-div fallback>` with `const escapeHtml = window.escapeHtml;` (drops the dead fallback: `window.safeText` is never defined in the admin panel → the fallback always won). LIVE on clients.html, which ALREADY loads escape-html.js before it (PR1).
- **`WorkloadCard.js`** — route the `sanitize` METHOD BODY (`div.textContent=x; return div.innerHTML` → `return window.escapeHtml(text)`); ADD `escape-html.js` to **workload.html** before WorkloadCard.js (currently absent). Routing the method (not per-call-site) keeps the id-coupled `id="${cat}-${sanitize(email)}"` / `onclick=…toggleCategory(…,'${sanitize(email)}')` pairs consistent (both sides call the same method). The onclick JS-string apostrophe hazard is PRE-EXISTING (3-entity also leaves `'` intact → unchanged) and is fixed properly in PR3c.
- **`notification-bell.js`** — route the 3 HTML-TEXT sites (`notification-title/description/time`) to `window.escapeHtml`; KEEP `safeText` for the onclick JS-string site (openReplyModal at :456 — its `.replace(/'/g,"\\'")` depends on `safeText` leaving `'` intact; PR3c / the notification PR refactors it to data-attr). index.html already loads escape-html.js before notification-bell.js (PR2).
- **DELETE `js/modules/case-form-validator.js`** — DEAD admin copy: loaded by ZERO admin HTML pages, zero `window.CaseFormValidator` reads in admin JS (the live validator is the user-app copy). Deleted because dead + unreferenced (NOT because "duplicate" — the two files are NOT byte-identical; per the "verify content hash, never dedup by name" rule the deletion is justified by deadness, proven, not by equality).

**Excluded → PR3c / separate:** WorkloadCard's 6 onclick + 4 coupled-id + 3 attr sites' delegation refactor + deleting `sanitize`; notification-bell's onclick refactor + deleting `safeText`; the user-app notification-bell twin (needs a user-app SSOT first); `ClientsTable data-tooltip-html` + `ClientManagementModal data-name` (permanent excludes).

## MUST (block on FAIL)
- **M1** — `service-card-renderer.js` aliases `escapeHtml` to `window.escapeHtml` and the `window.safeText ||` fallback expression is removed. `WorkloadCard.sanitize` body delegates to `window.escapeHtml` (temp-div removed). notification-bell's 3 text sites route to `window.escapeHtml`. "Route, never copy."
- **M2** — load-order: `escape-html.js` is added to **workload.html** BEFORE WorkloadCard.js (the new dependency — else `window.escapeHtml` is undefined at render → TypeError, a G1 failure). clients.html (service-card-renderer) + index.html (notification-bell) already load it before their consumers (PR1/PR2) — verified, unchanged.
- **M3** — the dead `case-form-validator.js` is deleted AND no admin-panel HTML/JS references it (zero `<script src>`, zero `window.CaseFormValidator` read). Deletion justified by deadness (proven), not by a false byte-identity claim.
- **M4** — scope discipline: `safeText` is KEPT in notification-bell (the onclick site still needs it; PR3c); `sanitize` is KEPT in WorkloadCard only as the now-routed thin wrapper (its onclick/id-coupled call-sites + the method deletion are PR3c); the permanent excludes (ClientsTable tooltip, ClientManagementModal data-name) untouched.
- **M5** — behavior change DECLARED (G6): the temp-div copies go 3-entity → 5-entity (now also escape `"`/`'`) — inert in HTML-TEXT, a security improvement in WorkloadCard's attribute sinks (`data-email`/`title`/`data-tooltip`); the `if(!text)`/`||`-fallback null-guards narrow to null/undefined-only. WorkloadCard's onclick sites: output unchanged for normal emails; an apostrophe email's onclick was already broken under the 3-entity escaper (PRE-EXISTING, not a regression — fixed in PR3c). No non-HTML/`.value`/string-compare sink regresses.
- **M6** — the routing-guard test (`escapehtml-ssot-pr3a-routing.test.ts`) proves: the deletion (file absent + unreferenced across all admin HTML), the 3 routes, the workload.html + clients.html load-order, that `safeText` is kept for the onclick site, and the SSOT 5-entity contract. Full admin-panel suite green.

## SHOULD
- **S1** — each routed body/comment points to the SSOT + notes the 3→5-entity + null-guard behavior; the WorkloadCard comment notes the onclick hazard is pre-existing + deferred to PR3c.
- **S2** — `escape-html.js` added to workload.html with a manual `?v=20260621-escapehtml-pr3a`; the 3 changed consumers (WorkloadCard, notification-bell on their pages) get a bumped `?v=`.

## Test plan
`tests/unit/admin-panel/escapehtml-ssot-pr3a-routing.test.ts` (9 tests): case-form-validator deleted + unreferenced (2), service-card-renderer routed + clients.html load-order (2), WorkloadCard.sanitize delegates + workload.html load-order (2), notification-bell 3 text sites routed + safeText kept for onclick (2), SSOT 5-entity contract (1). Full admin-panel suite **183/183** (174 prior + 9). The full root run's only failure is the worktree-only `user-app/israeli-id-drift-guard` zod-resolution artifact (this PR touches ZERO user-app/zod files; passes in CI). Local ESLint via `eslint --config <main>/eslint.config.js`: **0 errors** on the changed files (warnings = pre-existing no-console/no-alert in untouched WorkloadCard lines + 1 `any` in the test, within the 2200 CI budget). devils-advocate NOT run: the actual refactor is ~25 lines (the 398-line diff is a dead-code deletion), frontend-only, no rules/claims/migration, no behavioral regression (onclick hazard pre-existing) — below the §3.8.4 >100-line-refactor threshold; the behavioral onclick refactor (PR3c) gets the mandatory devils-advocate.

## Rollback
`git revert <merge-commit>` + redeploy (frontend; Netlify). No data migration, no schema/rule change. Reverting restores the 3 local escapers + the deleted file + removes the workload.html `<script>` tag.

## PRODUCT-GRADE GATES
- **G1 PASS** — SSOT returns `''` for null/undefined; workload.html now loads escape-html.js before WorkloadCard.js so `window.escapeHtml` is defined at render (no TypeError); the temp-div `undefined`→`'undefined'` quirk is removed.
- **G2 PASS** — `git revert` rollback (code-only, no data/schema/rule).
- **G3 N/A** — no data mutation (pure display-string escaping refactor + dead-code deletion).
- **G4 PASS** — routing-guard test (routes + load-order + deletion + safeText-kept) + the SSOT 5-entity contract; full admin suite green.
- **G5 PASS** — escaper maps only `& < > " '`; Hebrew + all other text passes through unchanged.
- **G6 PASS (declared)** — behavior change: 3→5 entity (inert in text, safer in WorkloadCard attrs); null-guard narrowing; the deleted file was DEAD (no consumer) so its removal breaks nothing; the onclick apostrophe break is pre-existing (not introduced). No customer-visible regression for benign input.
- **G7 PASS** — XSS hardening (3 live temp-div escapers onto the audited SSOT; WorkloadCard attr sinks upgraded 3→5-entity closing latent `"`-breakout); the onclick JS-string hazard (notification-bell + WorkloadCard) correctly KEPT on the local helper rather than naively routed (PR3c does the real data-attr fix); URL/CSS-unsafe caveat already in the SSOT header.

VERDICT: PASS
