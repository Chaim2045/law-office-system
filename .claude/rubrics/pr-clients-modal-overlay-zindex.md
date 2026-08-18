# Rubric — PR: raise ModalManager overlay above ClientManagementModal on clients.html (z-index)

**Branch:** `fix/clients-modal-overlay-zindex` (off `origin/main`) · **App:** Admin Panel · **Env:** DEV (`main`) → PROD (`production-stable`)
**Size:** LIGHT (1 scoped CSS rule + 1 `?v=` bump) · **High-stakes:** no (CSS-only, no rules/claims/schema/backend/JS) → no devils-advocate (§3.8.4).

---

## Intent

Third and final fix in the clients.html modal chain (after #470 loaded `Modals.js`, #472 fixed the currentClient-null crash). With both merged, the ModalManager sub-dialogs (purchase-date pencil, "חדש שעות") now open AND submit — but they render **behind** the ClientManagementModal because of a z-index inversion (flagged by the earlier frontend-fix-verifier):

- `.modal-overlay` (ModalManager, `components.css:762`) = **z-index 9999**
- `#clientManagementModal.modal` (`clients-modals.css:54`) = **z-index 10200**

A ModalManager dialog opened FROM the management modal is a 9999 overlay under a 10200 parent → visually behind / hard to interact with.

**Fix:** a single **scoped** override in `clients-modals.css` raising `.modal-overlay` to **10300** (above the 10200 parent, below `.quick-message-dialog` 10500). Scoped because `clients-modals.css` is loaded ONLY by `clients.html` (verified `grep -rl`) and AFTER `components.css` (line 75 vs 73) → the override wins on this page and touches no other page's ModalManager z-index.

---

## MUST (all required for PASS)

| # | Criterion | Verification |
|---|---|---|
| M1 | Exactly ONE scoped CSS rule added: `.modal-overlay { z-index: 10300; }` in `clients-modals.css`, with a comment explaining why. No value in `components.css` changed (global 9999 untouched → other 7 pages unaffected). | `git diff` = clients-modals.css (+rule) + clients.html (`?v=`). |
| M2 | 10300 is ABOVE the ClientManagementModal (10200) and BELOW `.quick-message-dialog` (10500) — verified those are the only competing z-indexes in play on clients.html; no stacking regression against TaskApprovalSidePanel (9998/9999, below) or the parent modal. | Read the three z-index values; 9998/9999 < 10200 < 10300 < 10500. |
| M3 | Scope proof — `clients-modals.css` is loaded by ONLY `clients.html` (so the override cannot leak to another page's ModalManager) and loads AFTER `components.css` (so same-specificity `.modal-overlay` override wins). | `grep -rl clients-modals.css *.html` = clients.html only; clients.html line order components(73) < clients-modals(75). |
| M4 | `?v=` cache-bust bumped on `clients-modals.css` in clients.html (mandatory before PROD — a CSS change is invisible behind a stale cache). | `?v=20260726-modaloverlay-zindex`. |
| M5 | Specificity is sufficient: the override is a bare `.modal-overlay` (single class, same as `components.css`) and wins purely by load order. No `!important`, no id-inflation — kept minimal + honest about the mechanism. | Read the rule + confirm load order (M3). |

## SHOULD

| # | Criterion |
|---|---|
| S1 | Comment names the exact competing selectors + values (10200 parent, 10500 quick-message) so a future z-index change elsewhere is caught. |
| S2 | Note that the global `.modal-overlay` (9999) is deliberately left alone — this is a page-local correction, not a system-wide z-index bump (which would risk the 7 other pages + side panels). |

---

## PRODUCT-GRADE GATES

- **G1 — N/A.** No error path; pure visual stacking correction.
- **G2 — PASS.** Rollback = `git revert <sha>` + redeploy (one CSS rule, no data).
- **G3 — N/A.** No data mutation — CSS only.
- **G4 — PASS (manual smoke).** A z-index stacking fix is inherently visual — no unit test can assert render order in jsdom. Manual DEV smoke: open the pencil / "חדש שעות" dialog and confirm it renders ABOVE the client modal and is clickable (plan below). This is the acceptable-when-integration-impractical path per G4.
- **G5 — N/A.** No strings changed.
- **G6 — PASS, behavioral (visual) change declared.** The sub-dialogs now stack above the parent modal on clients.html. No data / CF / rule / route / count / contract change; no other page's z-index changes (global 9999 untouched).
- **G7 — N/A.** No auth/PII/permissions/CSS-security surface.

## Test plan (DEV smoke — G4)

Hard-refresh clients.html on `main--admin-gh-law-office-system.netlify.app`:
1. Open a client → purchase-date ✏️ → the "עדכון תאריך רכישה" dialog renders **on top of** the client modal, centered, fully clickable (not dimmed behind it).
2. Service → "חדש שעות" → same: dialog on top, interactive.
3. Spot-check one OTHER page that uses ModalManager (e.g. `tasks.html` or `pending-clients.html`) → its dialogs still open normally (the global 9999 is untouched → no regression).

## Reviews

- **frontend-fix-verifier (Opus, read-only)** — flagged the z-index inversion (`.modal-overlay` 9999 vs `.modal` 10200) as a contributing defect during the currentClient-null investigation; this PR resolves it.
- **devils-advocate** — NOT required: CSS-only, no production-stable merge in this step, no schema/rules/security change, <100 lines (§3.8.4).

VERDICT: PASS
