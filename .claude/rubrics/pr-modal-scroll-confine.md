# Rubric — confine the client-modal scroll to its content (kill the whole-screen scroll)

**Scope:** frontend-only, DEV, admin-critical. The client modal (`#clientManagementModal` — the unified management + report card on `clients.html`) scrolled the WHOLE overlay up and down (a "whole-screen" scroll) on top of the content's own scroll, on both large and small screens. Root cause (independent read-only agent, zero-context): the base `.modal` overlay is itself a scroll container (`overflow-y: auto`, `clients-modals.css:55`) that centers a `max-height: 90vh` box under `2rem` padding — 90vh + 4rem > 100vh, so the centered box overflows the padded overlay and the overlay's own scroll engages. The fix confines the scroll to the content, id-scoped to this one modal.

**Change:** 3 files. `css/clients-modals.css` (2 id-scoped rules + 1 mobile mirror), `clients.html` (`?v=` bump → `20260806-modal-scroll-confine`), `tests/unit/admin-panel/modal-scroll-confine-css.test.ts` (new CSS-contract guard). **NO** JS / markup / base-class change.

## MUST (all required for PASS)

- **M1 — overlay no longer scrolls.** `#clientManagementModal { overflow: hidden }` — id-specificity beats the base `.modal { overflow-y: auto }`, so the whole-screen scroll is gone. **Proven:** the measured repro sets `overlay.scrollTop = 999` → stays `0` (`overflow-y` computes `hidden`).
- **M2 — content fits, never clips.** `#clientManagementModal .modal-content.modal-large { max-height: calc(100vh - 4rem) }` (desktop; = fit inside the overlay's `2rem` top+bottom padding) + the `@media (width <= 768px)` mirror `calc(100vh - 2rem)` (mobile overlay padding is `1rem`). The box's existing `overflow-y: auto` then scrolls the content internally. **Proven:** the box fits the viewport (`boxFitsViewport: true`, header/close visible) and `box_scrolls_internally: true`.
- **M3 — scoped, NO base ripple.** The shared base `.modal { overflow-y: auto }` rule is UNCHANGED; the override is `#clientManagementModal`-only, never applied to the bare `.modal` or `#addServiceModal` (the sibling modal on the same page). The other ~11 admin pages use the separate ModalManager (`.modal-overlay`/`.modal-container`, `components.css`) — untouched. **Proven:** `modal-scroll-confine-css.test.ts` group 4 (base `.modal` keeps `overflow-y:auto`; no `#addServiceModal { overflow:hidden }`).
- **M4 — measured, not asserted.** A real-CSS Playwright repro (tall 2200px modal) measured: `overlay_overflowY: "hidden"`, `overlay scrollTop after a scroll attempt: 0`, `boxFitsViewport: true`, `box_maxHeight: 656px` (= 720 − 64 at a 720px viewport), `box_scrolls_internally: true`.
- **M5 — guard + gates.** `modal-scroll-confine-css.test.ts` 4 green (the fix + the scoping); stylelint 0; eslint 0 errors; `?v=` bumped on `clients-modals.css`. No other admin test regressed (the change is additive scoped CSS).

## PRODUCT-GRADE GATES (expected)

- **G1** PASS — removes a UX annoyance (nested/whole-screen scroll); no error path, no NaN/undefined; the fixed pattern (overlay-doesn't-scroll / body-scrolls) already exists in-repo (ModalManager).
- **G2** PASS — Rollback = single `git revert` (restores the overlay scroll + `?v=`). Code-only.
- **G3** N/A — read-only display/layout; no write path.
- **G4** PASS — the CSS-contract guard + the measured Playwright repro (overlay can't scroll, content scrolls, box fits) + a manual DEV smoke: open a client card with a tall service list → the modal fits the screen, the background/overlay doesn't slide, only the content scrolls.
- **G5** PASS — no strings changed.
- **G6** — **BEHAVIORAL/DISPLAY CHANGE (declared, ADMIN SAFETY).** The client modal's scroll behaviour changes (the overlay no longer whole-screen-scrolls; scroll is confined to the content box). No count/filter/aggregate/data change; all content stays reachable (the content box scrolls). Scoped to `#clientManagementModal` only.
- **G7** N/A — no auth/PII/permissions.
