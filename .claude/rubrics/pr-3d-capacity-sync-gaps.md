# RUBRIC — PR-3d: close the two synchronization gaps

**Scope:** Functions. **Env:** DEV (`main`) → production on merge.
**Branch:** `investigate/hours-capacity`.

## Why this PR exists

Haim asked whether the new field is genuinely synchronized with the system. It
was not, in two places — and both were the same mistake this track exists to
remove: **a derived number with nothing keeping it honest.**

## GAP 1 — new clients received nothing

`createClient` is the one intake route that does **not** go through
`writeClientWithCanonicalAggregates`. It writes with a direct `.create()` and
hand-stamps each derived field. `plan` was mirrored there — with a comment
reading *"so the two intake routes never drift"* — and `hoursCapacity` was not.

The gap bit hardest exactly where it mattered most: **a new legal_procedure case
opens with three stages, two of them `pending`, so it carries phantom capacity
from its first second.** It would have been the one shape guaranteed to have a
gap and guaranteed not to show it, until something unrelated rewrote the client.

## GAP 2 — nothing watched the field

The nightly drift check compared a fixed field list that did not include it.
`aggregates.js` spent a year **declaring** that `totalHours` reflects active
capacity while nothing enforced it; the result was the 1,804 phantom hours this
whole track exists to close. Shipping a replacement that is equally unwatched
would have repeated the mistake with a newer field.

## MUST

| # | Criterion | How verified |
|---|---|---|
| M1 | `createClient` stamps the field from the SAME SSOT, before the document is created | 5 assertions incl. ordering |
| M2 | The nightly check recomputes capacity from `services[]`, independently of whoever wrote it | `detectCapacityDrift` |
| M3 | **A MISSING field is NOT drift** — absent by design on exempt clients and on every pre-existing document | dedicated test |
| M4 | Malformed input is ignored and never throws — the nightly check must not die on one bad document | dedicated test |
| M5 | The existing flat-field drift detection is byte-unchanged | test asserts `totalHours` drift still caught |
| M6 | 🔴 Capacity findings **never** enter `discrepancies[]`, never affect `status`, never reach the outbox or the bot | separate `capacityDrift` field, `mode: 'detect_only'` |
| M7 | Suites green | functions 1763 |

## M6 is the one that was wrong first, and matters most

The first implementation pushed capacity findings into `discrepancies[]`.
`discrepanciesCount > 0` forces `status = FAIL`, and the outbox trigger forwards
any non-PASS run to the WhatsApp bot verbatim. **PR-IG-C2 set the precedent a
few hundred lines below in the same file** — stage-invariant findings live in
their own field and never touch `status` or the bot, deliberately, so a
coordinated bot change can come later.

A brand-new field must **earn** its way onto the alerting path rather than
arrive there by default — especially while the migration has run ahead of the
code, which guarantees a crop of stale-but-harmless values on day one.

A second attempt attached the findings to the returned array as an extra
property, to avoid touching the caller. **Six existing tests failed on
`toEqual([])`** — an array carrying an own property is not deep-equal to a bare
one. The contract of `detectAggregateDrift` is "returns a plain array", and it
stays that way; the capacity detector is a separate exported function.

## Known, stated plainly

There is a **third** writer of client aggregates that this PR does not touch:
`reconcile-package-drift.js` writes via `writeServiceWithCanonicalPackages`. Its
effect on `hoursCapacity` is nil today (that field derives from `stages[].status`,
not from `hoursUsed`), but "the two gaps, closed and guarded" is therefore a
statement about the **known** gaps, not a proof that no others exist.

## Rollback

Code-only, additive. `git revert <merge-sha>` + redeploy. Documents keep an
orphan `capacityDrift` block in the last nightly report; nothing reads it.
