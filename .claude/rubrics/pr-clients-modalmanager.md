# Rubric — PR: load Modals.js on clients.html (restore ModalManager)

**Branch:** `fix/clients-html-modalmanager` (off `origin/main` 62900bf) · **App:** Admin Panel · **Env:** DEV (`main`) → PROD (`production-stable`)
**Size:** LIGHT (1 line added to 1 file) · **High-stakes:** no (no rules/claims/schema/backend) → no devils-advocate required (§3.8.4).

---

## Intent

`apps/admin-panel/clients.html` loads `ClientManagementModal.js` but NOT `js/ui/Modals.js` — the sole definer of `window.ModalManager` / `window.ModalHelpers`. `ClientManagementModal.js` is loaded ONLY by clients.html, and TWO of its click-time flows call `window.ModalManager.create(...)`:
- `_editPackagePurchaseDate` (the package purchase-date edit pencil) → `TypeError: Cannot read properties of undefined (reading 'create')`
- `renewServiceHours` / `_submitRenewHours` (the "חדש שעות" add-hours dialog) → identical throw

Both flows have therefore NEVER worked on clients.html. This PR adds the single missing `<script defer>` include, restoring both dialogs.

**Root cause confirmed** by two independent read-only agents (frontend-fix-verifier + Fable 5 breakage audit): Modals.js is the ONLY definer; clients.html is the only page that loads ClientManagementModal without loading Modals.js; no other unguarded missing-global crash exists on the page (the P1 `NotificationsUI`→alert() and the P2 items are OUT OF SCOPE — a separate follow-up PR, per Haim's checkpoint decision "P0 now, P1+P2 later").

---

## MUST (all required for PASS)

| # | Criterion | Verification |
|---|---|---|
| M1 | Exactly ONE line of functional change: add `<script defer src="js/ui/Modals.js?v=...">` to clients.html, placed before `ClientManagementModal.js`. No other file touched (besides this rubric + PR body). | `git diff --stat` = clients.html only (1 script line + 1 comment). |
| M2 | The added script is `defer` (matches every neighbouring script) and carries a `?v=` cache-bust consistent with the page's date-descriptor convention (`?v=20260726-modalmanager-fix`). | Read the diff line. |
| M3 | Modals.js has NO load-time dependency on another global/DOM element (verified: self-contained IIFE; `new ModalManager()` at load touches only `document`/`console`; `typeof module` guard is browser-safe). Placement among the defer chain is therefore unconstrained. | frontend agent verified line-by-line; re-confirm by reading Modals.js top + the `new ModalManager()` site. |
| M4 | No CSS conflict / double-definition: the `.modal-overlay/.modal-container/.modal-show` classes ModalManager needs are already provided by `css/components.css` (loaded by clients.html); Modals.js is the ONLY assigner of `window.ModalManager`. | frontend agent verified; components.css present in clients.html `<head>`. |
| M5 | Behavioral change DECLARED (admin-panel BEHAVIORAL CHANGE RULE + G6): two previously-dead admin dialogs (edit purchase-date pencil, add-hours "חדש שעות") now function. No data/CF/rule/route/count/filter/contract changed — display/interaction only. | PR body "Breaking change" + "Behavioral change" sections. |
| M6 | Cache-bust present (mandatory before PROD per DEPLOYMENT RULES) so returning admins do not keep a cached clients.html that still lacks the script. | `?v=20260726-modalmanager-fix` on the include. |
| M7 | Verification plan names a DEV smoke of BOTH restored flows — the pencil opens the "עדכון תאריך רכישה" dialog AND submits; "חדש שעות" opens AND its submit (`addPackageToService`) succeeds — because renewServiceHours' submit path has never executed on this page (frontend agent's low-risk caveat). | PR body "Test plan". |

## SHOULD

| # | Criterion |
|---|---|
| S1 | A comment on the new script line explaining WHY it is there (so a future dead-code sweep doesn't remove it as "duplicate"). |
| S2 | Note in the PR body that clients.html was the ONLY page missing Modals.js among the 8 that use ModalManager (index/tasks/timesheet/pending-clients/profitability/employee-costs/reconciliation all load it) — i.e. this restores consistency, not a novel include. |

---

## PRODUCT-GRADE GATES

- **G1 — PASS.** The change REMOVES a customer-visible failure (an uncaught TypeError on a button click with zero feedback = an empty error state, a G1 violation). No new error surface added. The restored dialogs' own error paths are pre-existing Hebrew `showNotification` calls (unchanged).
- **G2 — PASS.** Rollback = `git revert <commit>` + redeploy (pure static HTML, one line). Reverting returns clients.html to the current (broken-pencil) state — no data to migrate.
- **G3 — N/A.** No write path, no data mutation — a `<script>` include only. The restored dialogs call existing, already-monitored CFs (`updatePackagePurchaseDate`, `addPackageToService`); this PR does not touch them.
- **G4 — PASS (manual smoke, integration test impractical for a script-include on a static HTML page).** Test plan in PR body exercises both customer flows end-to-end in DEV (pencil open+submit; add-hours open+submit). Rationale for manual: the defect is "script not loaded on the page", which no unit test on the JS module can catch — it is an HTML-wiring fact, verified by loading the page.
- **G5 — PASS.** No new user-facing strings. The dialogs the fix un-breaks are already fully Hebrew (`עדכון תאריך רכישה`, `הוספת שעות`, etc.).
- **G6 — PASS, breaking/behavioral change declared.** Two dead dialogs become live. No existing field/CF/rule/route/count/filter/return-shape changed; the external contract is unchanged. Declared in PR body.
- **G7 — N/A.** No auth/PII/permissions/rules touched. Modals.js is a generic UI modal helper (no data access). The page is already behind the admin auth-guard.

## Reviews

- **frontend-fix-verifier (Opus, read-only)** — VERDICT: YES, the one-line add is sufficient and safe. Confirmed sole-definer, no load-time dependency, unconstrained placement, no CSS conflict, and that `renewServiceHours` is ALSO broken by the same gap (so the fix repairs both). One low risk flagged: smoke renewServiceHours' submit in DEV (its downstream has never run on this page) → folded into M7.
- **Fable 5 breakage audit (read-only)** — confirmed ModalManager is the ONLY unguarded missing-global crash on clients.html; blast radius = exactly these two flows. All other missing globals (P1 `NotificationsUI`→alert(), P2 items) are guarded (silent degradation, not crashes) and are explicitly OUT OF SCOPE for this PR (Haim checkpoint: P0 now, P1+P2 follow-up).
- **devils-advocate** — NOT required: no merge-to-production-stable in this step, no schema/rules/security-rule change, <100 lines, no migration (§3.8.4).

VERDICT: PASS
