# RUBRIC — PR-3a: characterization of ClientsDataManager's hours recomputation

**Scope:** Admin Panel, tests only. **Env:** DEV (`main`). **Behaviour change: none.**
**Branch:** `investigate/hours-capacity`. **Plan:** `docs/PLAN-HOURS-CAPACITY-DEFINITION-2026-08.md`.

## Why this exists before any reader migrates

`ClientsDataManager.loadClients()` overwrites `client.totalHours` and
`client.hoursRemaining` in memory with its own calculation. The partners'
primary screen — hours cell, progress bar, warning icons, the "דורש תשומת לב"
counter, the status filter, the sort order and the CSV export — all flow from
those two functions.

**They had zero test coverage.** Verified: each name appears only at its
definition and its single call site. So there was no way to demonstrate that a
migration had not silently moved a number an admin acts on — the exact hazard
the plan records ("that screen will look identical after the fix, masking both
success and regression").

## MUST

| # | Criterion | Verified by |
|---|---|---|
| M1 | Both calculators pinned over every production shape: staged hourly, staged fixed, plain hours, `type:'fixed'`, archived, completed, legacy `.hours`, empty `services[]`, status-less stage | 14 assertions |
| M2 | `needsAttention` pinned on both arms and on its eligibility gate | 5 assertions |
| M3 | The frontend mirror of `NON_AGGREGATING_STATUSES` is drift-guarded against the server SSOT | 5 assertions, parsing `functions/shared/aggregates.js` |
| M4 | Zero behaviour change — tests only | diff is one new test file |
| M5 | Root suite green | `npx vitest run` → 1273 passed (+26) |

## Quirks deliberately pinned as-is

Characterization means the test fails when behaviour changes — whether the
change is a fix or a regression — so the change has to be argued for. Each is
labelled `QUIRK` in the file with the disagreement spelled out:

| Pinned behaviour | Disagrees with |
|---|---|
| a `type:'fixed'` service **is** counted | both server functions exclude fixed — a `mixed` client's on-screen total is inflated today |
| a `legal_procedure` priced **fixed** enters the stages branch | the branch predicate never checks `pricingType` |
| a **completed** service is still counted | agrees with `recomputeTotalHours`, disagrees with the capacity rule (a closed service accepts no hours) |
| legacy `service.hours` fallback | the server has never had this field |
| with no services, the **stored** server value is returned | the overwrite silently becomes a no-op |
| the raw unrounded sum is returned | the server applies `round2` |
| `hoursRemaining` sums **stored** per-entity fields | the server derives `totalHours − hoursUsed` |

## The finding that came out of writing them

The two `needsAttention` arms are OR-ed, and **on a large contract the ratio arm
does all the work**. Shrinking the denominator raises the ratio and the alert
goes **quiet**. An alert that stops firing leaves no trace — which is why PR-3
must not swap this denominator, and why that interaction now has its own test.

(The first draft of the absolute-arm test used `10/1000` and failed: 1% trips
the ratio arm, so the test proved nothing about the arm it named. The fixture
was wrong, not the code — recorded here because a characterization suite whose
fixtures are wrong is worse than none.)

## Rollback

`git revert <merge-sha>`. Tests only; nothing to redeploy.
