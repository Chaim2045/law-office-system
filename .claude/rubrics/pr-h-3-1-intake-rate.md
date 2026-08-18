# Rubric — H.3 PR1-followup: reconcile legal-hourly `ratePerHour` across the two intake routes

**Title:** Make `createClient` and `addServiceToClient` store a legal-hourly service's `ratePerHour` CONSISTENTLY — an explicitly-elected positive rate is stored; an un-elected rate stays ABSENT (the legacy silent `|| 800` default is removed) so the static Plan reports `pricing_missing`, never a fabricated 800×hours. Closes the intake asymmetry the H.3 PR1 grader flagged (2026-06-11).
**Branch:** `fix/pr-h-3-1-intake-rate`
**Base:** `main`
**App / Env:** Functions (`clients/index.js` + `services/index.js`) + User App & Admin Panel intake dialogs. DEV (`main`). Additive / data-shape fix.
**Effort:** LIGHT–MEDIUM. Investigation: backend + data (this session) + Haim checkpoint (2026-06-11, Option B: un-elected placeholder; backfill deferred to a separate PR).

**Context:** MASTER_PLAN §8.5 **D-B** (locked 2026-06-10, re-confirmed 2026-06-11) + the H.3 PR1 rubric **M2** both mandate "NEVER a silent 800". The Plan helper already honors this (it never fabricates a rate). The bug is upstream intake-data asymmetry: `createClient:422` baked `ratePerHour: data.ratePerHour || 800` while `addServiceToClient` set no rate → the same legal-hourly case yielded `expectedRevenue = 800×hours` via one route and `null + pricing_missing` via the other. Both intake UIs hardcoded `data.ratePerHour = 800` ("default") with no rate input field; nothing reads `service.ratePerHour` except the new Plan helper (repo-wide verified). The real rate is sourced from the tofes `amountBeforeVat` snapshot at H.6 (§8.2.5 D1).

## MUST criteria (block on FAIL)

### M1 — Symmetric storage: store an elected rate, omit an un-elected one, on BOTH routes
**Rule:** `createClient` (legal_procedure HOURLY) stores `ratePerHour` ONLY when `data.ratePerHour` is a positive finite number; the `|| 800` default is removed. `addServiceToClient` (legal_procedure HOURLY) stores `ratePerHour` under the identical condition (previously stored none). Neither route ever writes a default rate.
**Evidence:** `git diff` of `clients/index.js` + `services/index.js`; tests B + the elected-rate cases.

### M2 — No silent default → absent rate yields `pricing_missing` (D-B / PR1 M2)
**Rule:** A legal-hourly service created with no elected rate carries NO `ratePerHour`; `computeServicePlan` returns `expectedRevenue:null` + `revenueSource:'unknown'`, and the client Plan increments `pricingMissingCount` / flips `pricingComplete:false`. NEVER 800×hours, NEVER 0-for-unknown.
**Evidence:** `legal-hourly-rate-reconciliation.test.js` A1/B1 assert `plan.expectedRevenue===0` (null-aware sum), `pricingMissingCount===1`.

### M3 — Intake UIs no longer hardcode 800
**Rule:** Neither `apps/user-app/js/modules/case-creation/case-creation-dialog.js` nor `apps/admin-panel/js/modules/case-creation-dialog.js` assigns `data.ratePerHour = 800`. (Admin dialog is the dead path — changed for drift-prevention.)
**Evidence:** `git diff` of both dialogs; repo grep for `ratePerHour = 800` returns nothing.

### M4 — Additive; hours SSOT + Plan helper untouched; no regression
**Rule:** No change to hours/minutes/aggregate computation, the canonical writer's derivation, or `client-plan.ts/.js`. Full functions suite green.
**Evidence:** `git diff` touches no aggregate/helper logic; full functions suite **880/880** (was 870 → +10 new).

### M5 — Reconciliation proven by test
**Rule:** A test asserts that identical no-rate legal-hourly input produces an IDENTICAL Plan from both routes (the grader-flagged seam), plus: elected rate honored (rate_x_hours) and malformed elected rate rejected.
**Evidence:** `legal-hourly-rate-reconciliation.test.js` group C (both routes equal) + A/B.

## SHOULD criteria (warn on FAIL)

### S1 — Malformed elected rate rejected, not silently dropped
**Rule:** A present-but-invalid `ratePerHour` (non-number / ≤0 / non-finite) throws `invalid-argument` with a Hebrew message, on both routes.

### S2 — Forward seam to H.6 noted
**Rule:** Code/comments mark that the authoritative rate is the tofes `amountBeforeVat` snapshot swapped in at H.6 (§8.2.5 D1), and that existing-data backfill is a separate PR.

## PRODUCT-GRADE GATES (G1–G7)
- **G1 errors:** PASS — the only new customer-facing path is the validate-if-present throw, a Hebrew `invalid-argument` ("תעריף שעתי חייב להיות מספר חיובי"); no stack trace / undefined / English.
- **G2 rollback:** PASS — `git revert <sha>` restores the prior code; the only effect is new legal-hourly intakes regaining a stored rate. Existing docs untouched. Code-only, ≤5 min.
- **G3 monitoring:** PASS — no new mutation path. createClient still audits `CREATE_CLIENT`; addServiceToClient still writes via the canonical writer + audits `ADD_SERVICE_TO_CLIENT`. The change only omits one fabricated field; no write/log behavior added or removed.
- **G4 customer test:** PASS — `legal-hourly-rate-reconciliation.test.js` exercises BOTH real callables end-to-end (the written `.create`/`transaction.update` payload incl. the real `computeClientPlan`); 10 tests; full suite 880/880.
- **G5 Hebrew UI:** PASS — new validation message is Hebrew; dialog comments Hebrew; no rendered string changed (no rate UI exists).
- **G6 breaking change:** PASS — documented behavioral change, consumer-safe. The legal-hourly default behavior changes (no more silent 800). The ONLY reader of `service.ratePerHour` is the Plan helper (repo-wide verified), which is by-design tolerant of absence (→ pricing_missing). No field is renamed/removed from any consumed contract; callable return shapes carry one fewer (fabricated) field that no caller reads. Existing data is forward-only (untouched); the ~existing-cohort backfill is a Haim-approved SEPARATE PR. See the PR-body "Behavioral change" section.
- **G7 security:** N/A — no auth / PII / permissions / `firestore.rules` change. `ratePerHour` is non-PII billing metadata already on the (world-readable) client doc; no new surface. devils-advocate NOT mandatory (no rules/security/migration/new-collection; same basis as PR1) — adversarial review applied inline (sole-consumer verification, malformed-rate rejection, dead-dialog drift landmine).

## VERDICT
`outcomes-grader` must return **PASS** / **PASS_WITH_WARNINGS** before `gh pr create`.
