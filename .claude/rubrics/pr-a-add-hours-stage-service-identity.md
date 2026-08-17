# RUBRIC — PR-A: `addHoursPackageToStage` resolves its target by explicit service identity

**Scope:** Functions + Admin Panel. **Env:** DEV (`main`).
**Branch:** `investigate/hours-capacity`.
**Related:** `docs/PLAN-HOURS-CAPACITY-DEFINITION-2026-08.md` §8.0 probe B.

## The defect

`addHoursPackageToStage` located its target with:

```js
services.findIndex(s => s.type === ST.LEGAL_PROCEDURE)
```

First match on **type alone**. The admin dialog knew which procedure was
selected (`currentServiceId`, set in `openDialog` from the card's
`data-service-id`) and even logged it — but never put it in the callable
payload. The CF therefore could not know, and always took the first.

A read-only production probe (2026-08-16, `scripts/measure-hours-capacity-2026-08-16.js`)
measured the exposure: **9 clients hold 2-3 `legal_procedure` services, and every
one of them carries colliding stage ids** (`stage_a/b/c` on each procedure). So
the stage lookup succeeded on the wrong service and the hours landed on the
wrong matter, silently.

**Why no arithmetic check could ever catch it:** `services/index.js:789` and
`:874` recompute the stage total and the service total together on the same
(wrong) service. Every sum reconciles. The books balance on the wrong page.
Only an identity assertion can detect this. Same failure class as the
report-identity bug fixed in #544.

**Blast radius, measured not assumed:** office-wide there are **5**
`pkg_additional_*` packages across **3** clients (2025006, 2025018, 2026065) —
**none of them among the 9**. Each of those 3 holds exactly one
`legal_procedure`, so first-match happened to be correct. **The bug has never
fired.** This PR closes a live landmine; it does not repair damage.

## MUST (all required to pass)

| # | Criterion | How verified |
|---|---|---|
| M1 | The CF resolves its target by explicit `serviceId`, never by first-match on type | Read the resolution block; test "hours go to the SECOND procedure" |
| M2 | The untouched sibling procedure is **byte-for-byte unchanged** after a write | Assertions on both the writer input and `transaction.update` payload |
| M3 | Ambiguity (no `serviceId` + >1 procedure) is **refused**, not guessed | Test asserts `failed-precondition` and that nothing was written |
| M4 | Backward compatibility: a legacy payload on a single-procedure case still succeeds | Dedicated test; the pre-existing `add-hours-package-to-stage-canonical-helper.test.js` suite stays green untouched |
| M5 | The audit trail identifies the matter **by id** — `procedureName` is not an identity (2026066 holds two procedures with the same name) | Test asserts `logAction` payload contains `serviceId` |
| M6 | A service with no usable `id` cannot be matched by a stringified-nothing literal, and is refused with a distinct message | Tests for `'undefined'` / `'null'` literals and the id-less shape |
| M7 | Every new customer-facing message is Hebrew with a next action | G1/G5 review of the 5 new throw sites |
| M8 | Frontend sends the identity it already holds, and cannot submit without it | Read `AddPackageToStage.js`; guard + payload |
| M9 | Full functions suite green, no pre-existing test disturbed | `npm test` from `functions/` |

## SHOULD

| # | Criterion |
|---|---|
| S1 | Tests that cannot fail on a reverted fix are labelled as positive controls, not counted as regression coverage |
| S2 | Each transactional read returns an independent snapshot, so the suite can detect a writer that merges instead of replaces |
| S3 | JSDoc documents `serviceId` and states that stage ids are not unique per client |
| S4 | Cache-bust bumped so a stale admin bundle cannot keep posting without the identity |

## Out of scope (deliberately NOT expanded here)

- `moveToNextStage:1170` — `stages.findIndex(s => s.status === 'active')`, first-match
  on status. Same class, write path, one function below. **Follow-up PR.**
- `ClientsDataManager:499` — `find(s => s.type === 'legal_procedure')` then first
  active stage. Read path; makes the low-hours alert blind to a second procedure
  running dry, on exactly these 9 clients. **Follow-up PR.**
- The phantom-capacity fix itself (`PR-1` onward in the plan).

## Rollback

Code-only. No schema change, no data migration, no CF added or deleted — so no
supervised `firebase functions:delete` is needed (unlike #452 / H.1.b).

```
git revert <merge-sha>
```
then redeploy. The frontend reverts with it; a browser holding the new bundle
would post `serviceId` to the old CF, which ignores unknown fields — harmless.
