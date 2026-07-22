# Rubric — PR-IG-A1: truthful-run hardening of `dailyInvariantCheck`

**Branch:** `feat/ig-a1-truthful-run` · **Commit:** `b625b15`
**Plan:** `docs/PLAN-INTEGRITY-GUARD-LAYER-2026-07.md` (PR-IG-A1 — the first item)
**App:** Functions · **Environment:** DEV (`main`) · **Size:** MEDIUM
**High-stakes:** behavioural change to the system's primary integrity guard + its only human alert path. `devils-advocate` REQUIRED.

---

## Intent

`dailyInvariantCheck` runs nightly at 06:00 and executes eight integrity checks across all clients. It is the system's primary guard. Three defects made its output untrustworthy:

**(a) A crashed scan reported green.** Per-client errors were swallowed (`catch → continue`) with no counter. If every client read failed, the run wrote `PASS` with an empty discrepancy list — a check that examined 0% of the data reporting "all clean".

**(b) A total failure alerted nobody.** The function wrote a `status:'ERROR'` document and returned normally without rethrowing, so Cloud Scheduler's failure metric never fired.

**(c) The alert path was narrower than anyone believed.** The outbox trigger emitted only on `status === 'FAIL' && discrepanciesCount > 0` — so `ERROR` was silent, and so was a `FAIL` with zero discrepancies.

Context: a production measurement found 75 entries / 101.60 hours across 6 clients on an already-completed stage, the earliest from February 2026 — undetected for five months. The audit's conclusion was that the deeper failure was not a missing check but that **no check's silence was ever distinguishable from health.**

**Explicitly NOT in scope** (the plan assigns these elsewhere): the stage-grain check (Check-8); the admin screen; any `firestore.rules` change; the `mode:'log_only'` override in the timesheet trigger; consolidating the divergent skip-lists or tolerance constants.

---

## MUST (all required for PASS)

| # | Criterion | How to verify |
|---|---|---|
| M1 | **A run that failed to scan can never report PASS.** `PASS` requires `clientsScanErrored === 0`. Errors with zero discrepancies must yield `PARTIAL`. | This is the headline defect. A test must exist that fails against the pre-commit code. |
| M2 | **A total failure throws.** The ERROR document is written AND the function rethrows, so Cloud Scheduler observes it. | Read the top-level catch. Verify the rethrow is after the write, not instead of it. |
| M3 | **The alert fires on everything that is not PASS.** FAIL (any discrepancy count), PARTIAL, and ERROR all reach the outbox; PASS does not. | Read the trigger's new condition. A test must pin each of the four cases separately. |
| M4 | **The external consumer is not broken.** `type: 'invariant_check'` preserved; changes to both documents are additive only; the outbox document's own delivery-lifecycle `status` field — which the bot filters on (`where('status','==','pending')`) — is byte-untouched. | Diff both documents' field sets. The implementer reported nearly renaming that field and catching it; verify the final state. |
| M5 | **No behaviour change to the eight checks themselves.** This PR changes what the run reports *about itself*, not what it detects. A check that passed yesterday passes today on identical data. | Verify no check's predicate, tolerance, or skip logic was altered. |
| M6 | **The result document carries a truthful census** — `clientsTotal`, `clientsScanChecked`, `clientsSkippedConfig`, `clientsEmptySkipped`, `clientsScanErrored`, `checksExecuted`, `entriesRead`, `durationMs`, `discrepanciesCount`, `schemaVersion: 2`. Internally consistent: checked + errored + skips === total. | A test must assert the arithmetic, not merely the presence of keys. |
| M7 | **The document cannot exceed Firestore's 1 MiB limit.** A mass-drift event previously risked the FAIL document itself failing to write — the ultimate silent failure. The embedded array is capped and the true count carried separately. | Verify the cap mirrors the existing precedent in `functions/scheduled/reconcile-package-drift.js` rather than inventing a new pattern. |
| M8 | **No PII.** Identifiers and counts only. The repo is PUBLIC and CI logs are world-readable. | Read every new field and log line. |
| M9 | **JS stays JS.** `functions/CLAUDE.md` forbids opportunistic TypeScript migration of existing modules. | grep the diff. |
| M10 | **No regression.** Full suite green, ESLint 0. | `cd functions && npx jest` — baseline on `origin/main` is 1390 tests / 79 suites. |

## SHOULD

| # | Criterion |
|---|---|
| S1 | Tests that previously pinned the defective behaviour are flipped with a comment explaining why, not silently deleted. |
| S2 | The status vocabulary is expressed as named constants, so the screen (PR-IG-B) and any future consumer can import rather than re-declare. |
| S3 | The census makes "0 because healthy" distinguishable from "0 because nothing was scanned" without opening a second tool. |

---

## PRODUCT-GRADE GATES (author's claims — the grader assesses)

| Gate | Claim | Justification |
|---|---|---|
| **G1** | N/A | No customer-visible surface. The audience is an admin WhatsApp group and Cloud Logging. |
| **G2** | PASS | `git revert b625b15` + redeploy. No schema, no migration, no CF added or deleted, no scheduler job change. |
| **G3** | PASS | This PR *is* monitoring: it is the change that makes the monitoring truthful. |
| **G4** | PASS | The headline test (all clients fail → not PASS) must fail against the pre-commit code. |
| **G5** | N/A | No user-facing string added. The bot's Hebrew formatting lives in a different repo. |
| **G6** | **Assess — behavioural, declared** | Runs that previously reported PASS will now report PARTIAL; the function now throws where it previously returned; alerts now fire in cases that were previously silent. Per `functions/CLAUDE.md` BEHAVIORAL CHANGE RULE this must be declared, not presented as a small fix. **External coordination:** the WhatsApp bot in the `hachnasovitz` repo consumes these documents. It was independently verified (read-only, both repos) to never read `healthCheckStatus`, the census fields, or `schemaVersion`, and to branch only on `severity` — so PARTIAL and ERROR render as ordinary warning/critical messages with no bot change required. Verdict was SAFE TO MERGE AS-IS. |
| **G7** | N/A | No auth, rules, permissions, or PII surface touched. |

---

## Anti-premature-closure

- Does this fix the February class? **No.** It makes the guard's own silence readable. The semantic check that would catch that class is PR-IG-C, not this.
- Known-open and deliberately untouched: the `mode:'log_only'` override on the busiest write path (disabled since 2026-05-18); the repair loop's default-`off` flag; `system_health_checks` still unreadable by any UI (that is PR-IG-B, and it requires a rules change).
- Residual after this ships: the alert still transits an external bot whose own outages are invisible from this repo, and a failed send is marked `failed` without auto-retry and without a dead-letter alert.
