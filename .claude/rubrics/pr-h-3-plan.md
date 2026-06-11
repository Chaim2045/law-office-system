# Rubric — H.3 PR1: the static "Plan" layer (`client.plan`)

**Title:** Stamp a static per-case **Plan** (`expectedHours` + `expectedRevenue`, locked at intake) on every client write, derived from `services[]` through a CENTRALIZED path so the two intake routes never drift. The FIRST of the 5 H.3 PRs (the independent, additive bud).
**Branch:** `feat/h-3-plan`
**Base:** `main`
**App / Env:** Functions (backend) — touches the canonical client write path (`writeClientWithCanonicalAggregates`, the SSOT route for 14 callsites) + `createClient`. DEV (`main`). Additive.
**Effort:** MEDIUM. Investigation: the 5-lens H.3 workflow (backend/data/frontend/security/completeness) + Haim checkpoint (2026-06-10). **PR1 scope re-confirmed at a mid-build checkpoint (2026-06-11):** cost/profit deferred to PR3 (Haim-approved "מאשר כפי שנבנה").

**Context:** H.3 PR1 (MASTER_PLAN §8.5). The H.3 investigation found `clients` is world-readable (`firestore.rules:147`) + read by the User App, so cost/profit MUST stay off it (§7.6 / D-A). PR1 therefore stamps ONLY the non-confidential Plan inputs; `expectedCost`/`expectedProfit` (cost-derived) are deferred to the CF-only `client_profitability` collection in PR3. Revenue rules per D-B.

## MUST criteria (block on FAIL)

### M1 — `plan` derived from `services[]`, stamped at BOTH intake routes, drift-free
**Rule:** `computeClientPlan(services)` produces `client.plan` and is wired into (a) `createClient` (just before `.create()`, covering all 4 service-construction branches) AND (b) `writeClientWithCanonicalAggregates` (in `finalPayload`, alongside the hours aggregates) — so `addServiceToClient` + all canonical-writer callsites recompute it. `plan` is in `RESTRICTED_KEYS` (a caller can never inject it — derived-only).
**Evidence:** `git diff` of `clients/index.js` + `client-writer.js`; the integration test asserts the written payload includes `plan` and a caller-supplied `plan` is stripped + recomputed.

### M2 — Revenue rules (D-B): never 0-for-unknown, never a defaulted rate
**Rule:** Per service — an explicit fixed price (`fixedPrice`/`totalFixedPrice`/`totalPrice`) wins; else a stored hourly `ratePerHour` × budgeted hours; else `expectedRevenue = null` + `revenueSource:'unknown'` (the `pricing_missing` case). NEVER 0-for-unknown, NEVER the deduction-time 800 default. `expectedHours` = `totalHours` for hourly services, `null` for fixed-price. Client-level: null-aware sums + `pricingComplete`/`pricingMissingCount`. A `fixedPrice` of exactly 0 is a KNOWN 0 (pro-bono), not null.
**Evidence:** `client-plan.test.ts` — every type×pricing permutation, the "never hours×800" test, the 0-fixedPrice test.

### M3 — NO cost/profit on the client doc (D-A / §7.6)
**Rule:** `client.plan` contains ONLY `expectedHours`, `expectedRevenue`, `pricingComplete`, `pricingMissingCount`, `serviceCount`, `schemaVersion`. `expectedCost` / `expectedProfit` are DELIBERATELY ABSENT (cost-derived → confidential → CF-only `client_profitability` at PR3). No cost value reaches the world-readable `clients` doc.
**Evidence:** the `client-plan` invariant test (`Object.keys` excludes cost/profit) + the canonical-writer test (`captured.payload.plan.expectedCost` undefined, no `actualCost`).

### M4 — Additive; the hours SSOT is untouched; no regression
**Rule:** No change to `minutes`/hours/aggregate computation. The archived-skip set mirrors `aggregates.NON_AGGREGATING_STATUSES` (drift-guarded). The existing canonical-writer-dependent tests still pass with `plan` added to the payload.
**Evidence:** full functions suite 870/870 (was 849 → +21 new; the ~12 canonical-helper tests unchanged); the drift-guard test; `git diff` touches no aggregate logic.

### M5 — Build / suite / lint green; lib committed
**Rule:** `npm run build:ts` exit 0; full suite green; `tsc` 0; ESLint 0; the compiled `lib/profitability/client-plan.js`(+map) is committed and matches source.
**Evidence:** build/test/lint output; `git diff --numstat functions/lib/`.

## SHOULD criteria (warn on FAIL)

### S1 — Plan is "locked at intake" semantics documented
**Rule:** The Plan recomputes from current `services[]` on every write (so adding a service updates it), but its inputs (fixedPrice/hours) are intake-time values that don't change post-creation — so it reflects the intake expectation. (Per-service plan snapshots can be added later if needed; PR1 is client-level.)

### S2 — Forward seam for H.6 revenue + PR3 cost noted
**Rule:** Code comments mark (a) the tofes `amountBeforeVat` swap-in at H.6 (§8.2.5 D1) and (b) that cost/profit land in `client_profitability` at PR3.

## PRODUCT-GRADE GATES (G1–G7)
- **G1 errors:** PASS — backend-only, additive; no new customer-facing error path; `computeClientPlan` is total + tolerant (malformed/empty services → safe zeros/null).
- **G2 rollback:** PASS — `git revert` of the 3 commits removes the stamping; the orphaned `client.plan` field is inert (additive; nothing reads it until PR4). Code-only, ≤5 min.
- **G3 monitoring:** PASS — `plan` is written as part of the existing client write (the write paths already log via the canonical writer / createClient audit); no new standalone mutation path; no behavior change to the hours write.
- **G4 customer test:** PASS — `client-writer-plan.test.js` exercises the real canonical write path (plan stamped + caller-plan stripped + no cost on doc); 17 unit tests cover the derivation; full suite 870/870.
- **G5 Hebrew UI:** N/A — backend-only; `plan` is data, not a rendered string. The dashboard that renders it is PR4 (Hebrew there).
- **G6 breaking change:** PASS — additive: a NEW `plan` object on the client doc; no existing field changed/removed; callable return shapes unchanged; the User App reads the doc and tolerates an extra field (no contract broken). Existing clients simply lack `plan` until their next write (read-tolerant; the dashboard treats absent plan as "not yet computed").
- **G7 security:** PASS — **security-access-expert reviewed in the H.3 investigation (D-A)**: the confidential cost/profit are deliberately kept OFF the world-readable `clients` doc; `plan` holds only `expectedHours`/`expectedRevenue` (non-confidential — fees are already on the doc). No `firestore.rules`/auth/claims change → devils-advocate NOT mandatory for PR1 (it IS mandatory for PR3's rules change). No new PII surface; no cost value in any log.

## VERDICT
`outcomes-grader` must return **PASS** / **PASS_WITH_WARNINGS** before `gh pr create`.
