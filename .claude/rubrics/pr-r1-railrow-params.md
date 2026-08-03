# Rubric — PR-R1: parameterize `buildRailRow(card, opts)` for report-tab reuse

**Track:** Report-tab **master-detail rebuild** (frontend-ui-expert change-map, 2026-08-03) — the live "הפקת דוח" tab was built as a flat form and diverged from the approved master-detail mockup (artifact 227d1403, source `<scratchpad>/modal-masterdetail.html`), whose report tab is a rail + detail like the manage tab. Haim-approved: rebuild the report tab first (before P2–P4), reusing the shipped P1 rail. **PR-R1 is the safe, isolated first step**: make `buildRailRow` reusable by BOTH tabs, WITHOUT touching the live manage tab. PR-R2 (next) does the ReportTab rewrite.
**Scope:** **frontend-only, additive.** ONE function — `UnifiedServiceCard.buildRailRow` — gains an optional `opts` param (`role` / `ariaControls`); the manage default is byte-identical. New pin test `railrow-params.test.ts`. **No other file changed.** Dead-code-additive: the radio variant has **no live caller** until PR-R2 (mirrors the U1/U2/U5a additive-first pattern).
**Type:** additive parameterization. The ONE risk is a regression of the manage rail (ADMIN SAFETY — `buildRailRow` drives which management service-card `ClientManagementModal._selectRail` shows); mechanically pinned + the full manage-cutover suite green.

## MUST (all required for PASS)

- **M1 — manage default byte-stable (THE crux).** `buildRailRow(card)` (no opts) emits `role="tab"` + `aria-selected="false"` + `aria-controls="managementServicesList"` and **NO** `aria-checked` — identical to pre-PR-R1. Verified by the pin test + the full `manage-cutover.test.ts` (which drives the real `ClientManagementModal` rail and asserts `.cm-rail-row[aria-selected="true"]` selection) staying green.
- **M2 — report radio variant.** `buildRailRow(card, {role:'radio', ariaControls:'<id>'})` emits `role="radio"` + `aria-checked="false"` + the custom `aria-controls`, and **NO** `aria-selected`. When `ariaControls` is omitted it defaults to `managementServicesList`.
- **M3 — no other DOM/behavior change.** The P1 rail visuals are intact — status dot (green `--ok` / orange `--attention`), name, sum-over-stages ratio, and **no** `.cm-rail-row-icon` on service rows. Injector safety unchanged: the row still emits NO `.management-*` classes (DA-3).
- **M4 — dead-code-additive.** The radio variant has no live caller yet; the manage tab is the only live caller and uses the default (no opts). No production call site changed.
- **M5 — gates.** Full admin-panel vitest green (453, was 449 + 4 new pin cases); ESLint 0 errors on the touched files.

## SHOULD

- **S1** — the pin test asserts the mutual exclusivity (manage default has NO `aria-checked`; the radio variant has NO `aria-selected`) so a future regression that mixes the two semantics is caught.

## PRODUCT-GRADE GATES (expected)

- **G1** PASS — no customer-facing text or error path changed (the sole Hebrew string is a test fixture name).
- **G2** PASS — Rollback = a single `git revert` restores the one-argument `buildRailRow` (+ removes the test).
- **G3** N/A — no write/mutation path; a pure DOM builder.
- **G4** PASS — the pin test proves both the manage-default contract (ADMIN SAFETY) and the report-variant contract; the manage-cutover integration suite proves the live manage rail is unregressed.
- **G5** N/A — no customer-facing strings added/changed.
- **G6** PASS — additive + backward-compatible: `opts` is optional; the manage default output is byte-identical → no breaking change, no migration.
- **G7** N/A — no auth/PII/permissions.
