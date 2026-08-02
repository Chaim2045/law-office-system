# Rubric — PR-U2: `ServiceCardModel` — the pure service-card view-model (dead code)

**Track:** Admin modal-unification (`docs/WORK-PLAN-MODAL-UNIFICATION.md`, PR-U2; spec `docs/PLAN-ADMIN-MODAL-UNIFICATION-2026-07.md` §PR-U2).
**Scope:** frontend-only, ADDITIVE — one NEW module `apps/admin-panel/js/modules/ServiceCardModel.js` + its test. **NOT loaded by any page** (dead code). Zero change to any existing file. Zero `functions/**`/rules/claims/callable.
**Type:** dead code → **zero behavioral change** (nothing renders it yet). U4/U5 adopt it.

## What it is

`window.ServiceCardModel.build(client, {getStageName}) → { cards, meta }`. A PURE function of the client document's `services[]`: one card per service (identity = `service.id`), stored aggregates read directly. It is the structural fix for both live bugs, pinned by tests before any live surface adopts it:
- **D2** — identity `service.id` (no `stage.id`-keyed Map) → two legal procedures each owning a `stage_a` never collide; both survive as distinct cards.
- **D1** — reads `services[]` only, never the timesheet ledger → cannot fabricate the nameless total-0 phantom the ClientReportModal fallback invents.

## MUST (all required for PASS)

- **M1 — one card per service, identity `service.id`.** `build` iterates `client.services[]`, emits one card per element keyed by `service.id`; no per-stage Map. D2 fixture (two legal procedures, each `stage_a`+`stage_b`) → exactly 2 cards, serviceIds `[srv_tviaa, srv_hagana]`, each with its own 2 stages.
- **M2 — no phantom, ever.** The model never reads the ledger; D1 fixture (mixed client, name-logged legal service) → exactly 1 card, no nameless card — even with a contradictory ledger injected via `window.ClientsDataManager`.
- **M3 — numbers are the document.** Stored `hoursUsed`/`hoursRemaining`/`totalHours` are read verbatim; `Number.isFinite` respects a real stored 0; a negative remainder is NEVER clamped; both-absent → creation defaults (used 0, remaining = total). Proven against an injected contradictory ledger.
- **M4 — canonical `isFixed`.** Uses `window.ClientTypeDisplay.isFixedService` (client-type-display.js:37-43) with a same-predicate inline fallback (identical `type==='fixed'` / `legal_procedure+pricingType==='fixed'` tests, expressed as an early return) so the model resolves without the global (tests). fixed / legal+fixed → true; hours → false.
- **M5 — archived parity.** `status === 'archived'` → `nonAggregating: true` (still emits a card, for the "בארכיון" badge), matching `NON_AGGREGATING_STATUSES` semantics.
- **M6 — static purity guard.** A source-level test asserts the module does NOT contain: a ledger read (`getClientTimesheetEntries`), an entry-duration read (`.minutes`), `Math.max(0,`, or a `stage.id`-keyed `.set(`. And DOES key by `service.id`.
- **M7 — dead code / zero behavioral change.** The module is loaded by NO page; no existing file changed; no `?v=` bump (nothing to cache-bust). Verified by the diff = 3 new files only.
- **M8 — gates.** ESLint 0 errors (the one `no-restricted-syntax` inline-classification hit is on the sanctioned byte-identical `isFixed` fallback, disabled with justification); `node --check` clean; tests green.

## SHOULD

- **S1** — `meta.unassignedHours` declared as a `null` seam (the D1-phantom replacement info-row; the pure model has no ledger, so U4 fills it).
- **S2** — `getStageName` injected as an option (no `window.SystemConstantsHelpers` dependency → the model stays pure/testable).
- **S3 (SEC-2)** — no PII in any (there are no) logs; the model is silent (no `console.*`).

## PRODUCT-GRADE GATES (expected)

- **G1** N/A (no error path; no UI). **G2** PASS (`git revert` — single squash, deletes 3 new files). **G3** N/A (read-only pure function, no write path). **G4** PASS (17 behavioral + static tests). **G5** N/A (no new customer-facing strings; the one Hebrew default "שלב" is a stage-name fallback, matching the current modals). **G6** PASS — no breaking change (dead code, nothing consumes it). **G7** N/A (no auth/PII/permissions).
