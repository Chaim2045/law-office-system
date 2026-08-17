# RUBRIC — PR-2: a stage advance is recorded as a capacity movement

**Scope:** Functions + Admin Panel. **Env:** DEV (`main`).
**Branch:** `investigate/hours-capacity`. **Plan:** `docs/PLAN-HOURS-CAPACITY-DEFINITION-2026-08.md`.

## Why this is small — and honest about it

The plan originally justified PR-2 as a 🔴 staleness fix: the belief that the
new `hoursCapacity` field would go stale at the exact moment a stage advances.
**A review disproved that** — `moveToNextStage` routes through
`writeClientWithCanonicalAggregates` (`functions/services/index.js`), which
re-derives the field from the services array it is handed. The field updates
automatically.

What remains is genuine but modest: under the capacity rule, advancing a stage
**moves available hours without anyone adding or removing one**. The closing
stage's budget stops counting; the opening stage's budget starts. That is the
instant the number the office makes decisions on changes — and nothing recorded
it. `docs/PLAN-HOURS-STAGE-INTEGRITY-2026-07.md` (F8) already noted that nobody
is even notified on stage advance.

## MUST

| # | Criterion | How verified |
|---|---|---|
| M1 | The `MOVE_TO_NEXT_STAGE` audit carries before/after/delta of available capacity | Test: 100 → 50 records `availableHoursDelta: -50` |
| M2 | Existing audit fields are preserved, not replaced | Test asserts `fromStageId`/`toStageId`/`serviceId` still present |
| M3 | The audit can never carry `NaN` into a permanent record | Test with malformed stage hours asserts all three figures finite |
| M4 | The capacity read is read-only and cannot affect the write | `computeServiceCapacity` is pure and total (PR-1); computed from in-memory objects |
| M5 | The admin is told, before confirming, that capacity is about to move | Confirm dialog names the unused balance and the opening budget |
| M6 | Both suites green, nothing pre-existing disturbed | `npm test` 1729 · `vitest run` 1247 |

## Two different numbers, deliberately — do not "unify" them

| surface | quantity | why |
|---|---|---|
| audit `availableHoursBefore/After` | **budget** of active stages (Σ `totalHours`) | must agree with `hoursCapacity.activeHours` from PR-1, or the trail contradicts the field |
| confirm dialog | **unused balance** of the closing stage (`hoursRemaining`) | what the admin actually needs to weigh: "you are about to strand 70 unused hours" |

They answer different questions and are both correct. A future reader tempted
to make them the same number should read this row first.

## Rollback

Additive, code-only. `git revert <merge-sha>` + redeploy. Audit rows already
written keep three extra fields nothing reads.

## Out of scope

The `moveToNextStage:1170` first-match-on-stage-status defect (from the PR-A
review) is untouched here — it is an identity bug, not a capacity one, and
carries its own follow-up.
