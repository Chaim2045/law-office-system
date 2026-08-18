# Rubric — H.2: Cost foundation (`costPerHourAtEntry` snapshot per timesheet entry)

**Title:** Stamp the employee cost-per-hour on every timesheet entry at write time — stored in a SEPARATE CF-only `timesheet_entry_costs/{entryId}` collection (Option A, the §7.6 leak fix), written ATOMICALLY in the same transaction as the entry. Plus a one-time backfill of historical entries. Begins the profitability layer (feeds H.3).
**Branch:** `feat/h-2-cost-foundation`
**Base:** `main`
**App / Env:** Functions (backend) — SSOT-critical (timesheet write paths) + a new CF-only collection + a `firestore.rules` change. DEV (`main`).
**Effort:** MEDIUM→HEAVY. Investigation: backend (GO) + security (GO, Option A) + data-investigator (mapping) + completeness (1🔴/4🟡) + devils-advocate (PROCEED WITH CAUTION, 2🔴 — both closed). Checkpoint (Haim-approved 2026-06-10): Option A + full hardened scope + §10 revision.

**Context:** H.2 feeds H.3's `forecast.actualCost = Σ(cost × hours)`. The crux: cost-per-hour is confidential HR data (`employee_costs` is CF-only `if false`), and `timesheet_entries` is employee-readable — so storing cost on the entry would leak it (violating the locked §7.6). Resolved via Option A: a separate CF-only collection, recorded as a §10 Decisions-Locked revision (2026-06-10).

## MUST criteria (block on FAIL)

### M1 — Cost stored in the SEPARATE CF-only collection, NEVER on the entry doc
**Rule:** The cost snapshot is written to `timesheet_entry_costs/{entryId}` (the locked const `TIMESHEET_ENTRY_COSTS_COLLECTION`), NOT as a field on the `timesheet_entries` doc. The entry doc is byte-unchanged in shape (no cost field added). `firestore.rules` gives the new collection `allow read, write: if false` (mirroring `employee_costs`).
**Evidence:** `git diff` — no cost field on the entry objects; the new rules block; the AST guard asserts the writes target `collection(TIMESHEET_ENTRY_COSTS_COLLECTION)`.

### M2 — Atomic same-transaction write (🔴-2): no entry can exist without its cost doc
**Rule:** The cost doc is written via `transaction.set(...)` in the SAME transaction as the entry create — for ALL THREE create paths (`createQuickLogEntry`, `createTimesheetEntry_v2`, `addTimeToTaskWithTransaction`). The cost is resolved BEFORE the transaction (a plain `employee_costs` read, independent of the txn docs; in the retry-loop path, resolved once before the loop).
**Evidence:** `git diff` shows `transaction.set(db.collection(TIMESHEET_ENTRY_COSTS_COLLECTION).doc(entryId), buildEntryCostDoc(...))` adjacent to each entry `transaction.set`; the AST guard counts ≥2 stamps in timesheet/index.js + 1 in addTimeToTask_v2.js.

### M3 — `resolveEmployeeCost` never throws, never 0-by-default
**Rule:** The shared `resolveEmployeeCost(email)` reads `employee_costs/{email}` via the Admin SDK (no auth gate — internal). On absent email / absent doc / invalid-or-0 cost / read error it returns `{ costPerHour: null, costSource: ... }` — NEVER throws (would crash entry creation) and NEVER coerces a blank to `0` (would corrupt H.3's Σ). A read error degrades to `costSource: 'resolve_error'` (distinct, retryable).
**Evidence:** `resolve-employee-cost.test.ts` (empty/absent → null; 0/invalid → null; read-error → null+resolve_error, never throws).

### M4 — No-stamp guard (🔴/🟡-5): a future write path cannot silently skip the cost
**Rule:** A static AST guard asserts every entry-create path resolves the cost AND writes the cost doc (so a new writer that forgets the stamp fails CI). This is the enforcement the design relies on (the 7-task/6-day double-count precedent showed key-discipline alone is insufficient).
**Evidence:** `resolve-employee-cost.test.ts` cost-stamping-guard describe block.

### M5 — Cost is inert to the hours SSOT; immutable thereafter
**Rule:** The change adds NO hours/aggregate computation and does not touch `minutes`/`hours`. The cost is never re-derived: no entry-update path (the `updateTimesheetEntry` allowlist, the trigger's `{isOverage,overageMinutes}` self-write) writes the cost doc. The trigger NEVER stamps cost.
**Evidence:** the full suite still 836→ green (no aggregate test perturbed); `git diff` touches no aggregate logic; the cost write exists only in the 3 create paths.

### M6 — PII: no cost VALUE in logs / no client exposure (G7)
**Rule:** The cost value never reaches `logger.*`/`console.*` (only counts / errorCode). The new collection is CF-only (no client read). An 8-scenario deny suite proves it (unauth/employee/admin/partner × read/write — all DENY), mirroring `employeeCosts.test.ts`, with the `firestore.rules.test` mirror updated.
**Evidence:** `resolve-employee-cost.test.ts` no-value-in-logs assertion; `tests/rules/timesheetEntryCosts.test.ts` (8 DENY); `firestore.rules.test` diff.

### M7 — Backfill is safe (dry-run default, idempotent, approximation-marked, backed up)
**Rule:** `functions/scripts/backfill-cost-per-hour.js`: DRY-RUN default + `--apply` (non-interactive); idempotent (skips entries that already have a cost doc); stamps the CURRENT cost marked `costSource: 'backfill_approx'`; `null` for no-cost-doc employees (never 0); batched (≤450); per-record-safe; a durable local JSON plan backup; never console-logs a cost value. Never touches `minutes`/`hours`.
**Evidence:** the script source.

### M8 — §10 plan revision recorded; build/suite/lint green; lib committed
**Rule:** MASTER_PLAN §10 has the 2026-06-10 Decisions-Locked revision recording Option A (deviation from "on the entry") + the rejected alternatives. `npm run build:ts` exit 0; new `lib/employee-costs/resolve-employee-cost.js`(+map) committed; full functions suite green; `tsc` 0; ESLint 0.
**Evidence:** MASTER_PLAN diff; `npx jest`; `git diff --numstat functions/lib/`; `npx eslint`.

## SHOULD criteria (warn on FAIL)

### S1 — Doc/plan wording updated
**Rule:** The §5.4 bud + §8.4/§1.3.7 "on the entry" wording are reconciled with Option A (cost in `timesheet_entry_costs`, visible only via Admin SDK). (Can be folded into the §10 revision note.)
### S2 — Rollback documented
**Rule:** PR body: `git revert` removes the stamping (a code-only change; the cost docs become orphaned but harmless — CF-only, ignored by H.3 if absent). The backfill rollback = delete `timesheet_entry_costs` docs (or `costSource:'backfill_approx'` ones).

## PRODUCT-GRADE GATES (G1–G7)
- **G1 errors:** PASS — cost-resolve never throws (degrades to null); existing entry-creation errors unchanged; no new customer-facing error path.
- **G2 rollback:** PASS — code-only revert; orphaned CF-only cost docs are inert (S2).
- **G3 monitoring:** PASS — the cost write is part of the entry transaction (atomic, logged with the entry); `resolve_failed` logs errorCode; the backfill reports counts.
- **G4 customer test:** PASS — full suite green; new unit + AST + 8-scenario deny tests; the customer scenario (logging hours still works + the cost lands off-entry) is covered.
- **G5 Hebrew UI:** N/A — backend; no new customer-facing strings.
- **G6 breaking change:** PASS — additive (new collection; entry doc shape unchanged; the 3 callables keep their return shapes). No client contract changed.
- **G7 security:** PASS — security-access-expert reviewed (Option A): the leak is closed (cost off the employee-readable entry); new collection is CF-only with an 8-scenario deny suite + rules-test mirror; no cost value in logs. **This is a `firestore.rules` change → devils-advocate was run (mandatory).**

## VERDICT
`outcomes-grader` must return **PASS** / **PASS_WITH_WARNINGS** before `gh pr create`.
