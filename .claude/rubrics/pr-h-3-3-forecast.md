# Rubric — H.3 PR3: the Forecast layer (cost/profit aggregate)

**Title:** A NEW CF-only `client_profitability/{caseNumber}` collection holding each case's DYNAMIC Forecast (`actualHours`, `actualCost`, un-costed-coverage %), written by a dedicated scheduled aggregation job + an on-demand recompute callable, and read by an admin||partner `getProfitability` callable. The cost/profit aggregate the Plan layer (PR1) deliberately kept OFF the world-readable `clients` doc.
**Branch:** `feat/h-3-pr3-forecast`
**Base:** `main`
**App / Env:** Functions (backend) + `firestore.rules`. DEV (`main`). A `firestore.rules` change + the FIRST production `isPartner()` consumer → **devils-advocate MANDATORY** (§3.8.4) + the `firestore.rules.test` drift-guard + the 8/9-scenario deny-suite.
**Effort:** HEAVY. Investigation: 5-lens workflow (aggregation/data-model/security/callable/completeness, 2026-06-14) + Haim checkpoint (cadence / read-path+audit / doc-shape / CI-hardening — all 4 recommendations approved).

**Context:** §8.5 PR3 D-A…D-E (locked). `clients` is world-readable (`firestore.rules:147`) → a single-employee case's `actualCost÷actualHours` = that employee's confidential cost-per-hour, so the aggregate lives in a SEPARATE collection gated `read: isAdmin()||isPartner()` (the gate enables the PR4 onSnapshot dashboard WITHOUT leaking to employees). `employee_costs` = 0 docs today → the job must ship an HONEST empty Forecast (actualCost `null`, coverage ~0%), never a fabricated 0.

## MUST criteria (block on FAIL)

### M1 — 🔴 null ≠ 0 (the load-bearing cost contract)
**Rule:** `actualCost` is `null` (NOT 0) whenever no in-scope entry has a finite cost. An un-costed entry (no cost doc / `costPerHour:null` / a pre-H.2 entry with no doc) is EXCLUDED from the cost Σ and counted toward `totalEntryCount` (the honest denominator) + surfaced via `unCostedCoveragePercent` — NEVER summed as 0. A real cost of 0 (free/intern) is a KNOWN cost (counts as costed). Today (employee_costs=0) the whole system reads actualCost=null, coverage ~100% un-costed — and that is correct.
**Evidence:** `computeForecastForClient` (forecast-aggregation.ts) + the unit tests "NO entry costed → null", "mixed coverage", "cost of 0 is known".

### M2 — 🔴 JOIN strictly by entryId (never the employee string)
**Rule:** cost is looked up as `costByEntryId.get(entry.id)` — the `timesheet_entry_costs` doc id == the timesheet entry id. NEVER joined/grouped on the `employee` string (the entry stores raw `user.email`; the cost doc lowercases it → a mixed-case email would silently drop the entry's cost). A unit test proves a cost keyed to a different id does NOT attach.
**Evidence:** the join site in `computeForecastForClient`; the "JOIN is strictly by entryId" test.

### M3 — 🔴 Rule + first production isPartner(); CF-only write; §7.6 no employee leak
**Rule:** `match /client_profitability/{caseNumber} { allow read: if isAdmin() || isPartner(); allow write: if false; }` in BOTH `firestore.rules` AND `firestore.rules.test`. Reuses the EXISTING `isAdmin()`/`isPartner()` helpers (does not redefine them). The cost aggregate never touches the world-readable `clients` doc. `tests/rules/clientProfitability.test.ts` asserts the POSITIVES (admin read ALLOW, partner read ALLOW) AND the negatives (employee read DENY — the §7.6 crux, unauth read DENY, no-role read DENY, ALL writes DENY) — NOT a blind copy of the deny-all `timesheetEntryCosts` template.
**Evidence:** the rules diff (both files) + `clientProfitability.test.ts` (9 scenarios, assertSucceeds for admin/partner read).

### M4 — Dedicated aggregation job (not the timesheet trigger); archived parity; idempotent
**Rule:** a NEW v2 `onSchedule` job (daily, staggered after `dailyInvariantCheck`) — NOT the timesheet trigger (its CREATE branch is skipped when `deductedInTransaction===true`). Per-client isolated try/catch (one bad client never aborts the run). Excludes `['archived']`-service entries to mirror Plan / `aggregates.NON_AGGREGATING_STATUSES` (a drift-guard test pins it). Recompute-and-SET (idempotent — never `FieldValue.increment`). Explicit `timeoutSeconds`+`memory` (not the 60s default). Cost is recomputed live (`minutes/60 × snapshot cost`) — never a stored product (write-once cost doc goes stale on entry edit).
**Evidence:** `aggregateClientProfitabilityHandler` + the archived-filter drift-guard test + the per-client try/catch.

### M5 — Callables gated admin||partner; audited; Hebrew; null-safe wire shape
**Rule:** `getProfitability` (read) + `recomputeProfitability` (write) are v2 `onCall`, handler exported for tests, gated `claims.role==='admin'||'partner'` (legacy `admin:true` NOT accepted), Zod `.strict()` `{caseNumber:/^\d{7}$/}`. `getProfitability` writes a non-PII access audit as a PRECONDITION for disclosure (mirrors validateSalesRecordExists) and returns `{exists:false}` (not a throw) on a missing doc. `recomputeProfitability` is audit-FIRST (it mutates). `actualCost` stays `number|null` on the wire. Cost VALUES never reach `logger.*`. All customer-facing errors Hebrew-by-code.
**Evidence:** the two callable files; the audit-first/precondition pattern; no cost value in any logger line.

### M6 — H.6 seams; suite + lint + build green; clean diff
**Rule:** `paidRevenue`/`projectedProfit` stored as explicit `null` (D-C — no live source; NEVER 0; not computed vs ~0 revenue); `schemaVersion:1`. The diff stages ONLY PR3 paths — NOT the pre-existing CRLF/rebuild drift in `functions/lib/*` / `apps/user-app/dist/*`. Functions jest + root vitest green; ESLint 0 on the new TS; TS build clean; the new `lib/` outputs committed.
**Evidence:** `git diff --name-only main...HEAD` (only PR3 files); the 3 committed `lib/profitability/*`; test+lint output in the PR body.

## SHOULD criteria (warn on FAIL)
### S1 — CI hardening: the rules deny-suite added to `ci-cd-production.yml` (setup-java + test:rules:emulator) so a push-to-main deploy of `firestore:rules` runs the deny tests, not just the PR gate (Haim-approved).
### S2 — Doc shape is Forecast-only (no plan snapshot) — PR4 JOINs `client.plan` by caseNumber (avoids a 2nd drift source). `status` mirrored onto the doc so PR4 filters without a 2nd read.
### S3 — The rules drift-guard is EXTENDED in this PR (devils-advocate rules-leak finding) to assert the `client_profitability` match block is string-equal (comments stripped) between `firestore.rules` and `firestore.rules.test` — closing the Pre-H.0.0.G S3 blind spot for this gated collection. The emulator deny-suite is CI-verified (Java not on the local Windows box; it runs in pull-request.yml JOB 5 + the deploy job this PR hardened). The backfill (employee_costs population) is a SEPARATE supervised step.

## PRODUCT-GRADE GATES (G1–G7)
- **G1 errors:** PASS — Hebrew HttpsError-by-code on every callable path; missing doc → `{exists:false}` empty state (not an error toast); no stack/`undefined`/`NaN`/English in customer-facing strings.
- **G2 rollback:** PASS — **NOT a pure `git revert`** (devils-advocate 🔴, resolved): a revert DELETES 3 deployed CFs, and the prod pipeline's `firebase deploy --only ...,functions` runs WITHOUT `--force` → it ABORTS rather than auto-delete (the documented H.1.b CF-deletion incident, MASTER_PLAN §8.3). Correct sequence: **(1)** supervised `firebase functions:delete aggregateClientProfitability recomputeProfitability getProfitability --region us-central1` (Haim's hands — also tears down the scheduled job's Cloud Scheduler entry); **(2)** `git revert <commit>` + redeploy for the rules block + lib cleanup. Data is fully DERIVED (recompute-from-source) → orphaned `client_profitability` docs are harmless (CF-only, unread once the rule/callable are gone). ~10 min supervised. The exact steps are in the PR-body Rollback section.
- **G3 monitoring:** PASS — the scheduled run writes a durable `PROFITABILITY_AGGREGATE` run audit (sys actor, non-PII counts) on success AND failure + THROWS on total failure (Cloud Scheduler alert); each callable audits; reconciliation counts logged. NO cost value ever logged.
- **G4 customer test:** PASS — 9 aggregation unit tests (the null≠0 / join-by-entryId / coverage% / archived-parity / honest-empty invariants) + the 9-scenario rules deny/allow suite (the customer-security scenario). Listed in the PR Test plan.
- **G5 Hebrew UI:** PASS — every customer-facing callable string is Hebrew (this is backend; the PR4 dashboard is the UI surface).
- **G6 breaking change:** PASS — additive (a new collection + new job + 2 new callables + an additive rules block); no existing collection/rule/callable/field changed or removed. Plan layer (PR1) untouched.
- **G7 security:** PASS — **security-access-expert reviewed (5-lens investigation)** + **devils-advocate DONE** (4 adversarial lenses, 2026-06-14): rules-leak verdict **GO** (gate correct, byte-identical mirror, 9-scenario suite proves it with correct polarity); the 1 RED (rollback) is FIXED in G2; the cost-race / scale / partial-failure yellows are fixed-or-documented. Read gated admin||partner at the rule AND both callables; write CF-only; the §7.6 employee-leak prevented (employee read DENY test); cost stays off the world-readable clients doc; cost VALUES never client-logged.

## VERDICT
`outcomes-grader` must return **PASS** / **PASS_WITH_WARNINGS** before `gh pr create`. **devils-advocate must run + its 🔴 attacks be resolved before the PR opens** (firestore.rules + first isPartner() consumer).
