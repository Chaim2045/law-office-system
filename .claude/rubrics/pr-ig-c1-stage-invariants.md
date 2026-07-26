# Rubric — PR-IG-C1: pure stage-invariant semantic detector

**Branch:** `feat/ig-c1-stage-invariants` · **Commits:** `d347b76`, `b2cfe1c`
**App:** Functions · **Environment:** DEV (`main`) — CI deploys `functions` on push, but **nothing imports this module**, so it ships as inert code (no runtime effect until PR-IG-C2 wires it).
**Size:** MEDIUM · **High-stakes:** the module is the ONLY thing designed to catch the failure class that went undetected for five months. Its test suite is its sole evidence (no production signal). `devils-advocate` REQUIRED (ran — see Reviews).

---

## Intent

`functions/shared/stage-invariants.js` is a **detect-only semantic detector**. It exists because of a specific production failure: a `budget_task` stage pointer was stamped once at creation and never refreshed, so an open task kept deducting every future hour from a stage that had already closed. The deduction *succeeded* — every aggregate agreed with the ledger arithmetically — so all eight nightly arithmetic checks were blind to it. The books balanced perfectly, on the wrong page. Only a **semantic** check that asks *which stage should own this hour* can catch it. Measured: 75 entries / 101.60 hours across 6 clients landed on an already-completed stage, the earliest from February 2026, undetected for five months.

This module reconstructs, per client, which stage each timesheet entry *should* resolve to (service → stage precedence, canonical), and reports where the stored aggregates disagree — without blocking, throwing, or mutating anything. It is pure and side-effect-free. Wiring into the nightly job is a separate PR (PR-IG-C2).

---

## MUST (all required for PASS)

| # | Criterion | Verification |
|---|---|---|
| M1 | **It would have caught the February class.** | The production scenario (open task on a closed stage, aggregates arithmetically consistent) fires the detector. A positive-control test asserts a discrepancy IS produced with type/count/hours. Verified by an adversarial reviewer who reconstructed the scenario and ran it. |
| M2 | **Detect-only.** No `require('firebase-admin')`, no `async`/`await`, no assignment to any input, no throw into a caller. A malformed document cannot make it throw. | Read the module; the reviewer confirmed 7 malformed shapes → zero throws. |
| M3 | **Stage ids are keyed by a composite `serviceId::stageId`.** Stage ids are NOT unique across services; a bare-`stageId` accumulator silently merges unrelated services. | Verified at EVERY keyed site (maps, sorts), not just one. |
| M4 | **An unresolvable entry is COUNTED, never silently dropped.** Dropping reproduces, at a new grain, the census-that-lies defect. | Finding F-1 closed: `entry.serviceId.startsWith('stage_')` is treated as in-scope so the canonical legal-procedure entry shape is not dropped; a test asserts `unresolvedCount: 1` + sample for that shape. |
| M5 | **Archived services are not flagged.** Every writer deliberately stops maintaining an archived service's aggregates; comparing them to a live ledger is a false positive that trains people to ignore the detector. | Finding F-2 closed: imports the canonical `NON_AGGREGATING_STATUSES` (not a fourth copy) and skips archived; a test pins no-discrepancy for an archived service. |
| M6 | **No free-text (PII) in the output.** The repo is PUBLIC and CI logs world-readable; the module is destined for a nightly job. | Finding F-4 closed: `serviceName` (lawyer-typed, carries matter captions) removed entirely — ids and counts only; the PII test asserts no free-text field. |
| M7 | **Deterministic — same inputs, any order, byte-identical output.** | Finding F-5 closed: all three sort comparators reuse the composite `stageKey()`, not a bare concatenation. |
| M8 | **The detector goes silent-safe, not silent.** An unparseable date is counted, not dropped. | Finding F-6 closed: `skippedUnparseableDates` counter added at both sites. |
| M9 | **The test suite genuinely fires on absence.** A stub returning empty must fail a large majority of the detector-exercising tests. | Finding F-3 closed: measured — stubbing the detector to return nothing fails 29 of 54 tests (was 6). Positive controls added per anomaly variant. |
| M10 | **No regression, no wiring.** Full suite green; nothing imports the module. | `cd functions && npx jest` → 80 suites / 1444 tests. `git grep` confirms zero importers on `origin/main`. |

## SHOULD

| # | Criterion |
|---|---|
| S1 | The fixed/hourly field split (`totalHoursWorked` vs `hoursUsed`) is respected so hourly stages are not false-flagged and fixed stages are not skipped. |
| S2 | A hot-loop re-allocation is hoisted (F-7) — the module runs nightly over every client. |

---

## PRODUCT-GRADE GATES

- **G1 — N/A.** No customer-visible surface; the eventual audience (via PR-IG-C2) is Cloud Logging / the admin health screen.
- **G2 — PASS.** `git revert b2cfe1c d347b76` + redeploy. The module is inert (no importer), so revert is a no-op at runtime. No schema, no CF added/deleted, no rule, no scheduler.
- **G3 — N/A.** Read-only, pure function; no data mutation, no write path.
- **G4 — PASS.** Positive-control tests assert the detector FIRES on the real failure class (M1, M9), proven by mutation (stub → 29/54 fail).
- **G5 — N/A.** No user-facing string.
- **G6 — PASS.** Additive-only: a new pure module, imported by nothing. No contract, route, or data-shape change.
- **G7 — N/A.** No auth, rules, permissions touched. PII explicitly excluded from the output (M6).

## Reviews

**`devils-advocate` — VERDICT GO-WITH-CHANGES.** Confirmed the detector would have caught February (reconstructed + ran). Found 4 MAJOR + 3 MINOR: F-1 (a resolvable-looking entry dropped while `unresolvedCount` read 0 — the exact census-that-lies shape), F-2 (archived services flagged against the repo's own SSOT), F-3 (15 of 21 detector tests passed against a detector returning nothing — mutation-measured), F-4 (`serviceName` free-text egress to world-readable logs), plus F-5/F-6/F-7. **All closed in `b2cfe1c`**, verified: the F-3 stub-mutation now fails 29/54 (a large majority), the `NON_AGGREGATING_STATUSES` import is the canonical one, `serviceName` is gone.

VERDICT: PASS
