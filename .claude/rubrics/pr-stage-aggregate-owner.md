# Rubric — PR: stop stage/service hoursUsed aggregate-ownership collisions

**Branch:** `fix/stage-aggregate-owner` · **Commits:** `34ad388`, `eac0c04`, `6327e57`
**App:** Functions · **Environment:** DEV (`main`) — **note: CI deploys `functions` on push to `main`, so this reaches the PRODUCTION backend.**
**Size:** MEDIUM · **High-stakes:** live transaction write path that computes billable hours. `devils-advocate` REQUIRED (ran three rounds — see Reviews).

---

## Intent

For a `legal_procedure` service, hours are normally deducted from a **package** inside a **stage**. When no active package exists, the system records hours **directly on the stage** (`applyLegalProcedureDeltaStageOnly`) — real, ledger-confirmed "orphan" hours with no package behind them. Two write paths then recomputed `stage.hoursUsed = Σ packages.hoursUsed`, **erasing those orphan hours**:

- `functions/services/index.js` `addHoursPackageToStage` — fires when a package is added.
- `functions/src/modules/aggregation/index.js` `applyLegalProcedureDelta` — fires on **every ordinary package-backed timesheet entry** (create/edit/delete).

Separately, the service-level rollup summed `Σ stage.hoursUsed` while the canonical rule (`aggregation/index.js:169-174`) is pricing-aware and forces `hoursRemaining = null` for fixed — a second collision re-introducing drift.

A read-only production census (2026-07-23) confirmed **no destruction has occurred yet**, but one loaded case exists: client 2025366 `stage_a`, `stage.hoursUsed = 67.58` vs `Σ packages = 65.58` (ledger confirms 67.58 correct) — 2 orphan hours that the next ordinary deduction on that stage would erase.

The fix: both recompute sites preserve orphan hours via an **additive offset** — `orphan = max(0, oldHoursUsed − Σ oldPackages)` captured pre-delta, then `newHoursUsed = orphan + Σ newPackages` — extracted as the shared `recomputeStageHoursUsedPreservingOrphan` helper. The service rollup is made pricing-aware (FIXED → `totalHoursWorked`, else `hoursUsed`).

---

## MUST (all required for PASS)

| # | Criterion | Verification |
|---|---|---|
| M1 | Orphan hours survive an ordinary package-backed deduction and a package-add. | Tests build the measured shape (stage 67.58 / pkg 65.58) and assert the 2h survive; fail against pre-change code (verified by stash-and-rerun). |
| M2 | The rule is **idempotent** — the orphan is re-derived every call, never stored, so repeated application does not double-count. | Reviewer applied the helper 5× on 67.58/65.58 → 67.58 every time. |
| M3 | **Cannot over- or under-bill on any reachable input.** | Reviewer traced every writer that can raise `hoursUsed` above `Σ packages`; confirmed NO code path anywhere in `functions/` removes a package from a stage, and the edit/delete trigger never reaches `addHoursPackageToStage` (`onCall`-only). Negative deltas still decrease. |
| M4 | Fixed-price stages are correct — `totalHoursWorked` untouched, `hoursUsed` not written, `hoursRemaining` stays `null`. 87 of 150 prod stages are fixed. | Verified at both call sites + the service rollup. |
| M5 | Reads precede writes in the transaction; no new Firestore call introduced. | `['get','get','update']`; the helper is pure in-memory. |
| M6 | No third writer uses the orphan-erasing rule. | `functions/src/modules/deduction/aggregators.js` (a dead `Σ packages` writer, unimported in `functions/`) deleted; the user-app copy is a separate live file, untouched. |
| M7 | No decorative test. | Test 4-hourly's tautological assertion (compared output to the helper the code calls) replaced with a hard literal `toBe(4)`; whole file scanned for the same shape. |
| M8 | The derived-orphan repair hazard is recorded where the next author will see it. | A comment on `recomputeStageHoursUsedPreservingOrphan` states, with worked numbers, that a future ledger-replay repair (DRIFT-3) must reset `stage.hoursUsed` in the same write or the offset becomes permanent inflation. |
| M9 | No regression. | `cd functions && npx jest` → 81 suites / 1419 tests. ESLint from repo root → 0 errors. |
| M10 | No PII. | The one new `console.warn` (guard engaged) carries `caseId`/`stageId`/counts only — no names. |

## SHOULD

| # | Criterion |
|---|---|
| S1 | The rule lives in ONE shared helper, used by both recompute sites — no hand-copied ternary. |
| S2 | The `console.warn` fires only when the guard actually preserves/raises (`orphan > 0`), never on healthy calls. |

---

## PRODUCT-GRADE GATES

- **G1 — N/A.** No customer-visible surface; the audience is Cloud Logging.
- **G2 — PASS.** `git revert 6327e57 eac0c04 34ad388` + redeploy. No schema, no CF added/deleted (the deleted `aggregators.js` was dead, unimported — not a deployed function), no rule, no scheduler.
- **G3 — PASS.** Write path: the guard emits a `console.warn` with ids + counts when it engages; the three counters from the earlier commits (`repointed`/`stranded`/`skipped`) are preserved.
- **G4 — PASS.** Tests build the real measured production shape and were proven to fail against pre-change code (stash-and-rerun) — not mocked into un-failability.
- **G5 — N/A.** No user-facing string.
- **G6 — PASS, behavioural change declared.** `stage.hoursUsed` can now stay ABOVE `Σ packages` where it previously collapsed to the sum — this is the correct billing of orphan hours, not a new number out of nowhere. Return shapes unchanged; no consumer contract altered.
- **G7 — N/A.** No auth, rules, permissions, or PII surface touched.

## Reviews

**`devils-advocate` — three rounds.** R1 (on `34ad388`) → GO-WITH-CHANGES, closed the second door (`eac0c04`). R2 (on `eac0c04`) → GO-WITH-CHANGES; confirmed the additive-offset is idempotent and cannot over/under-bill (grepped for any package-removal path — none exists). R3 (findings closure) → the three non-blocking findings closed in `6327e57`, re-verified.

VERDICT: PASS
