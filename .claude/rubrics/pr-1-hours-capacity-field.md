# RUBRIC — PR-1: the capacity SSOT + the `hoursCapacity` derived field

**Scope:** Functions + `firestore.rules`. **Env:** DEV (`main`).
**Branch:** `investigate/hours-capacity`.
**Plan:** `docs/PLAN-HOURS-CAPACITY-DEFINITION-2026-08.md`.
**Measured baseline:** `PR-0` (`c774059`) — 164 clients, **1,804h phantom**, 16 clients affected, 5 shown solvent while genuinely negative.

## What this PR does — and deliberately does NOT do

Adds a NEW derived field beside the existing one. It does **not** redefine
`totalHours`, and it does **not** feed any gate.

| | today | after PR-1 |
|---|---|---|
| `totalHours` | Σ all stages — the CONTRACT | unchanged |
| `hoursCapacity.activeHours` | — | Σ active stages on hours-accepting services — the AVAILABLE figure |
| `hoursRemaining` / `isBlocked` | from `totalHours` | **unchanged** |

**Why `totalHours` must not move (P4 / plan §3):** H.3's Plan reads
`svc.totalHours` as the scope agreed at intake and multiplies it by
`ratePerHour` for `expectedRevenue`. Redefining it in place would corrupt the
revenue forecast of every hourly client.

**Why nothing is wired to a gate yet (plan §4):** `hoursUsed` also sums ALL
stages (`aggregation/index.js` `calcServiceHoursUsedFromStages`). Filtering only
the numerator and feeding it to `hoursRemaining` would give a client on stage C
`activeCapacity − (a+b+c consumed)` → deeply negative → `isBlocked`. Numerator
and denominator move together in PR-5, or not at all.

## MUST

| # | Criterion | How verified |
|---|---|---|
| M1 | One SSOT for "is this stage open" — no fifth competing definition | `shared/stage-capacity.js`; strict `=== 'active'`, no default |
| M2 | The rule includes the service-eligibility half (inherits `HOURS_LOCKED_STATUSES`) | Test: a closed service with an active stage yields 0 |
| M3 | **FAIL-OPEN.** The computation can never abort a client write | Two tests: hostile stage data commits with correct money aggregates; a forced throw still commits with the field omitted |
| M4 | Total by construction — never throws, never NaN, never undefined | 9-case `test.each` over malformed shapes |
| M5 | `totalHours`, `hoursRemaining`, `isBlocked` are byte-unchanged | Test asserts `hoursRemaining` still derives from the contract figure |
| M6 | Callers cannot inject the field | `RESTRICTED_KEYS` + a stripped-and-recomputed test |
| M7 | The field is not browser-writable, and the pre-existing `plan` gap is closed with it | `firestore.rules` `clientAggregateKeys()` + a new drift-guard test |
| M8 | Every derived figure carries rule + version provenance | Test asserts `rule` / `ruleVersion` / `schemaVersion` |
| M9 | Fixed-priced procedures excluded — no fabricated phantom | Test: `pricingType:'fixed'` yields zeros |
| M10 | Both suites green, no pre-existing test disturbed | `npm test` (functions) + `npx vitest run` (root) |

## SHOULD

| # | Criterion |
|---|---|
| S1 | Status-less stages counted in neither bucket, surfaced via `unknownStatusStageCount` (measured 0 in prod) rather than silently defaulted |
| S2 | Vocabulary shared with `stage-invariants.js` (capacity vs consumption stated explicitly in the module header) |
| S3 | Rounding matches the rest of the aggregate chain (`round2`) |

## The `plan` gap closed here (found by review, not by design)

`plan` was in `RESTRICTED_KEYS` since H.3 PR1 but never in
`clientAggregateKeys()` — so the profitability Plan was browser-writable. Same
bypass class as the 23 wrongly-blocked clients of the 2026-05-13 audit. Fixed in
the same rules edit, and the new drift-guard makes the next omission fail CI.

**The drift-guard caught its own parser bug on first run:** a naive "first `]`
after the marker" scan stopped inside a comment containing `services[]`,
truncating the key list. A guard that parses wrongly passes while proving
nothing — the parser now strips comments first.

## Known, reported, NOT fixed here

Adding one test file to the root vitest run surfaces a **pre-existing latent
race** in `tests/unit/user-app/holidays-cache-merge.test.ts`: it boots
`apps/user-app/js/shared/holidays-cache.js` via `new Function(src)()`, that
module self-schedules a `_bootWhenAuthReady` retry timer, and nothing cancels
it — so it fires after the environment tears down and throws
`ReferenceError: window is not defined`.

Proven by bisection, not assumed:

| run | files | tests | unhandled errors |
|---|---|---|---|
| baseline (pre-PR) | 77 | 1243 | 0 |
| PR-1 without the new root test | 77 | 1243 | 0 |
| PR-1 complete | 78 | 1247 | 1 |

**All tests pass in every configuration** — this is an unhandled-error warning,
not a failure. The defect is in that test, not in this PR; any future test file
would expose it. Deliberately NOT fixed here (unrelated file, mid-PR scope
expansion). **Follow-up:** fake timers or an `afterAll` teardown in that test.

## Out of scope (follow-ups, filed not fixed)

- `moveToNextStage:1170` — first-match on stage status, write path (from PR-A review)
- `ClientsDataManager:499` — low-hours alert blind to a second procedure (from PR-A review)
- PR-3 onward: migrating readers onto the new field
- PR-5: the contraction, with numerator and denominator paired

## Rollback

Additive and code-only. No migration, no CF added or deleted.

```
git revert <merge-sha>
```
Then redeploy functions and the rules. Documents already carrying
`hoursCapacity` keep a harmless orphan field that nothing reads; the next write
under the reverted code simply stops refreshing it.
