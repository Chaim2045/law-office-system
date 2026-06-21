# PR-DRIFT-2 — `repairPackageAggregates` — Final Corrected Design (ready-to-code)

> **Status:** DESIGN LOCKED, pre-code. Produced after: root-cause proof (file:line), a read-only PROD audit, and three sub-agent rounds (backend + data-investigator + **devils-advocate = STOP on the first design**). This document folds every devils-advocate 🔴 defense. The next session codes from this doc directly, then runs grader + a final devils-advocate re-review before any `--apply`.
>
> **Public-repo discipline (§2.8):** this doc contains NO client case-numbers — only aggregate counts. The per-client worklist is generated at runtime by the dry-run; the specific worst-client ids live only in the Lead-Agent local memory.

## 1. Goal

Repair the existing package-level consumption drift so that, for every eligible HOURS service:

- **`package.hoursUsed == Σ(entries pointing to that package).minutes / 60`** (each package matches its entries), AND
- **`service.hoursUsed == Σ(all the service's entries).minutes / 60`** (the BILLING number is exactly the ledger truth), AND
- every orphan entry (`packageId: null`) is assigned a real `packageId` so the data is self-consistent and the `addPackageToService` detonator is **permanently defused** (no orphans left to double-count).

**Precision contract (honest):** the **totals** (service-level → client-level → billing/blocking) become **exactly** the ledger truth. The **per-package attribution** of the 613 historical orphans is a **forward-replay reconstruction** (current-logic-correct, defensible) — NOT a bit-exact historical reproduction, which is impossible (the historical selection state is not fully recoverable). This is acceptable because billing/blocking is service-grain, not package-grain.

## 2. Verified footprint (read-only PROD audit, 2026-06-21 — aggregate only)

- **613 orphan entries** (`packageId:null` on packaged HOURS services), 987.65h, across **50 clients**. ALL > 30 days old (0 in last 30d), `deductedInTransaction` absent on all 613, ~98% carry a `taskId` (addTimeToTask path). **The injector is DORMANT** — repair is not racing an active writer.
- **76 drifted packages**: 67 OVER / 9 UNDER, **net +873.91h**. Top-10 clients = 66% of net.
- **20 "seeded-phantom" packages** (`hoursUsed>0`, ZERO entries point to them) = **+308h** — `addPackageToService` seeding (`services/index.js:367`).
- **Duplicate package ids = 0. Dangling entries = 0.** (Spec the skip branches defensively; they're empty sets in current PROD.)
- **The model invariant `service.hoursUsed == Σ(packages.hoursUsed)` holds for 124/125 services** — confirming the model does NOT carry orphan hours at service level independently of packages → orphans MUST be assigned to packages.
- **2 services have legitimate `overrideActive` service-level overage** (−91h, −12h) that is NOT drift → must be preserved.

## 3. The framing correction (load-bearing — changes PR-DRIFT-0)

The premise that `serviceIds.packageId` is "strict getActivePackage, null when depleted" is **WRONG**. `lookupServiceIds` calls `getActivePackage(service, true, ...)` with **`allowOverdraft=true`** (`addTimeToTask_v2.js:249`), so it accepts depleted/overdraft packages within the −10h floor. Therefore `serviceIds.packageId` and the deduction's `resolvedPackageId` **already agree** except in a narrow deep-overdraft window. **Consequence:** PR-DRIFT-0's marginal value is small; and its naive form would stamp the **depleted-fallback** id, violating our own fresh-only constraint. See §10 for the corrected PR-DRIFT-0.

## 4. The 6 devils-advocate 🔴 — and how each is folded

| # | Attack | Fold (this design) |
|---|---|---|
| **2-A** | FIFO-at-`createdAt` reconstruction non-deterministic (missing `purchaseDate` → all to package[0]; entry older than all packages = undefined) | **Forward-replay** through the live `getActivePackage` selection, time-aware (only packages with `purchaseDate ≤ entry.createdAt`); per-entry `assignmentBasis ∈ {replay, single_active, pre_package, unresolved}`; `unresolved` → manual-review, never auto-assign (§5) |
| **2-B** | Reassignment can push a package > `hours` → wrong status flip → spurious client block | Surface EVERY status flip (active↔depleted/overdraft) in the dry-run, before/after; a replay-driven overdraft is legitimate but flagged (§7) |
| **2-C / X-2** | Stamping `packageId` on an entry fires the trigger UPDATE; safe today only by the incidental zero-delta guard | **Pin the no-op with a mandatory regression test** ("packageId-only UPDATE → trigger writes nothing"); stamp also writes `repairStampedAt` (idempotency + audit); NO trigger change needed (zero-delta guard already skips, minutes unchanged) (§6) |
| **2-D** | `writeClientWithCanonicalAggregates` recomputes `isBlocked`/`isCritical`/`plan` → repair can silently (un)block a live client (the 9 UNDER packages repair UP) | Dry-run computes + surfaces before/after `isBlocked`/`isCritical`/`plan` per client; **any `isBlocked` FLIP requires explicit per-client Haim approval**; `--apply` honors a `--skip-clients` hold-list (§7, §8) |
| **2-E** | Override-vs-drift discrimination unreliable (`overrideActive` alone insufficient; `overdraftResolved` omitted) | Reconcile ONLY services with packages AND `!overrideActive` AND `!overdraftResolved?.isResolved`; SKIP the rest, flag `override_preserved` / `no_packages` (§5) |
| **2-H** | No inverse-apply for a partially-applied migration (G2 violation) | Ship `--rollback <backup.json>`: restores each client `services[]` + un-stamps entries conditionally (only if still == repaired value); tested on a sample BEFORE any PROD `--apply` (§9) |
| **X-1** | DRIFT-0 alone leaves the `addPackageToService` detonation armed on the 613 legacy orphans | Repair STAMPS all orphans → `addPackageToService`'s `!packageId` query finds nothing → detonator defused by the repair itself. Until `--apply` completes: do NOT add packages to the 50 affected clients (operational note), OR ship the optional `addPackageToService` guard (§11) |

## 5. The algorithm — forward-replay

Per client → per service (eligibility-filtered) → replay:

```
ELIGIBILITY (per service):
  include IFF: type===HOURS (svc.type/serviceType)
           AND status not in NON_AGGREGATING_STATUSES (skip 'archived')
           AND svc.packages.length > 0
           AND svc.overrideActive !== true
           AND svc.overdraftResolved?.isResolved !== true
  else: emit {action:'skip', reason: 'archived'|'no_packages'|'override_preserved'}

FORWARD-REPLAY (per eligible service):
  entries := all timesheet_entries where (clientId, effectiveServiceId===svc.id)   // effectiveServiceId = parentServiceId || serviceId
  sort entries by createdAt ASC   // ties: docId ASC (stable); missing createdAt -> fallback to `date`, else sort last + flag
  running := { [pkg.id]: 0 } for pkg in svc.packages
  for each entry:
     candidates := svc.packages where purchaseDate <= entry.createdAt   // time-aware: package must have existed
     pick := getActivePackageEquivalent(candidates, running)            // fresh-first by purchaseDate ASC (hoursRemaining>0); else overdraft fallback within -10h ; mirror deduction-logic.js getActivePackage
     basis := pick ? (candidates length===1 ? 'single_active' : 'replay')
                   : (candidates empty ? 'pre_package' : 'unresolved')
     if basis==='unresolved': record for MANUAL REVIEW, do NOT assign, do NOT count
     else:
        assignedPackageId[entry.id] := pick.id (or, for pre_package, the earliest package)
        running[pick.id] += entry.minutes/60

COMPUTE (per package):
  package.hoursUsed     := round2(Σ minutes of entries assigned to it / 60)   // sum-minutes-first
  package.hoursRemaining:= round2(package.hours - package.hoursUsed)
  package.status        := derive (depleted if remaining<=0, overdraft if -10<remaining<=0, else active)  // mirror deduction-logic
  seeded-phantom (hoursUsed>0, 0 entries assigned) -> hoursUsed:=0  (the reversal; surface if >=20h)

COMPUTE (per service):
  service.hoursUsed     := round2(Σ packages.hoursUsed)
  service.hoursRemaining:= round2(service.totalHours - service.hoursUsed)
  // INVARIANT CHECK: service.hoursUsed must == round2(Σ all-assigned-entries/60) within 0.05 ; else abort this client + report
```

`getActivePackageEquivalent` is extracted/mirrored from the canonical `functions/src/modules/deduction/deduction-logic.js` `getActivePackage` (do NOT re-implement the selection priority — import or mirror with a drift-guard test, per the codebase's mirror convention).

## 6. The stamp + trigger safety (fold 2-C/X-2)

After the per-client aggregate write commits, stamp `packageId` (+ `repairStampedAt: serverTimestamp`, + `repairRunId`) onto each assigned orphan entry, in batches ≤500, **conditionally** (`if (!entry.packageId)` re-checked — idempotent on re-run; never overwrite a non-null packageId).

**Trigger interaction:** a `packageId`-only (+ `repairStampedAt`) UPDATE leaves `minutes` unchanged → `getMinutesDelta==0` → `serviceId` unchanged → not a service-transfer → the trigger's zero-delta guard (`timesheet-trigger.js:281-284`) returns early. **No re-deduction.** This is currently safe but INCIDENTAL → **MANDATORY regression test** pins it: "an UPDATE that changes only `packageId`/`repairStampedAt` produces zero hours mutation." (Optional hardening, deferred: add `repairStampedAt` to the self-write skip set `:205` — but the zero-delta guard already covers it, so a trigger change is NOT required for v1.)

## 7. Dry-run output (what `--apply=false` MUST surface)

A structured report (and a written JSON), per client:

- per package: `{packageId, before:{hoursUsed,hoursRemaining,status}, after:{...}, delta, statusFlip:bool}`
- per service: `{serviceId, before/after service.hoursUsed, ledgerTruth, invariantOk:bool}`
- **client-level:** `{before/after isBlocked, isCritical, plan.expectedHours, plan.expectedRevenue}` + **`blockFlip:bool`**
- orphan assignment summary: counts by `assignmentBasis`; the `unresolved` list (manual review)
- **≥20h package reversals** (the seeded-phantom zeroing) — listed explicitly for sign-off
- **`blockFlip:true` clients** — listed explicitly; `--apply` REFUSES them unless in an `--approve-block-flips` allow-list

## 8. Safety wrapper

- **Dry-run default**; `--apply===true` required to write (callable input flag OR script arg, mirror `migrate-claim-shape.js` / `backfill-cost-per-hour.js`).
- **Per-client isolation:** one `runTransaction` per client; **retry on `aborted`** (concurrent live write) with a FRESH read each attempt (mirror `addTimeToTask_v2.js:675` retry); read `services` inside the txn and apply only the package-level corrections (do NOT blind-overwrite a `services[]` snapshot read outside the txn — avoids clobbering a concurrent live deduction, defense 2-G).
- **Maintenance window:** run `--apply` off-hours (operational note) to minimize concurrency.
- **Idempotent:** `repairRunId` + conditional stamp; a re-run re-derives the same cards (Σ entries unchanged) → no-op.
- **audit-FIRST:** `logCriticalAction('REPAIR_PACKAGE_AGGREGATES', sys-or-uid, {clientId, packagesRepaired, netDeltaHours, blockFlip})` BEFORE each client mutation — non-PII (ids/counts/hours only).
- **Continue-on-error** with a failed-clients report; one bad client never aborts the run.
- **Client rollup** delegated to `writeClientWithCanonicalAggregates` (RESTRICTED_KEYS strips client aggregates; the writer derives them) — repair sets `service.hoursUsed` (the writer reads it as-is) but NEVER sets client aggregates directly.
- **tolerance = 0.05** (unify with Check 7, not repair-aggregates' 0.02).
- Admin-gated; `--apply` supervised (Haim's hands).

## 9. Inverse rollback (fold 2-H)

`repairPackageAggregates --rollback <backupFile> [--apply]`:
- Backup (written before the forward `--apply`): per affected client `{clientId, services-before, isBlocked-before, ...}` + per stamped entry `{entryId, packageId-before(=null), repairRunId}` → gitignored JSON.
- Rollback restores each client's `services[]` (via the canonical writer) + un-stamps entries **conditionally** (`if entry.packageId === <repaired value> && entry.repairRunId === <runId>` → set `packageId: null`, clear `repairStampedAt`).
- The un-stamp UPDATE is the same zero-delta no-op (safe). **Test the rollback on a sample client BEFORE any PROD `--apply`.**

## 10. PR-DRIFT-0 — corrected (ships WITH DRIFT-2)

Given the framing correction (§3), DRIFT-0 shrinks to: in `addTimeToTask_v2.js`, stamp the entry with the **fresh-resolved** package id, and **leave `null` when the deduction fell to the depleted/overdraft fallback** (fresh-only, fold 🔴-1A). Bind the id assignment to the **deduction call site** (not a hoisted "resolution" variable, fold 1-B/1-C). Keep `stageId` consistent with the package's stage or scope DRIFT-0 to HOURS-only (fold 1-E). 3 tests: fresh→stamped, depleted-fallback→null, FIXED-stage→null. **Note:** because the repair (DRIFT-2) clears + stamps all existing orphans and defuses the detonator, and the injector is dormant, DRIFT-0's marginal value is small — it is hygiene to prevent a future re-arming. Ship together; if scope pressure, DRIFT-0 can fold into the same PR as a 4th file.

## 11. Optional detonator hardening (belt-and-suspenders)

`addPackageToService`'s orphan-backfill (`services/index.js:311-330,367,387-390`) is the detonator. After DRIFT-2 there are no orphans to sweep, so it's defused. OPTIONAL: add a guard that the orphan-backfill refuses (or logs-and-skips) if it would sweep entries older than a cutoff / flagged `repairStampedAt`, so a stale orphan can never re-detonate. Decide at the DRIFT-2 checkpoint; not required for v1 if DRIFT-2 + DRIFT-0 ship together.

## 12. Files

- NEW `functions/admin/repair-package-aggregates.js` (or `functions/src-ts/` per the TS bar — but mirror `repair-aggregates.js` which is legacy JS; decide at code time) — the dry-run + apply + rollback callable/script.
- NEW `functions/tests/repair-package-aggregates.test.js` — unit tests on the pure replay/compute helpers + the trigger-no-op regression test.
- (DRIFT-0) `functions/addTimeToTask_v2.js` — the fresh-only stamp.
- `.claude/rubrics/pr-drift-2.md` — the rubric.
- gitignore the backup JSON path.

## 13. Test plan

Pure helpers (replay + compute), via `_test`:
- replay assigns entries to the time-correct package; package not yet purchased is excluded.
- orphan older than all packages → `pre_package` (earliest) or `unresolved` (per decision).
- seeded-phantom (0 entries) → hoursUsed=0.
- override service / no-packages service / archived → skipped.
- status flip surfaced (active→overdraft) when entries genuinely exceed capacity.
- service invariant: `service.hoursUsed == Σ assigned-entries/60` within 0.05.
- idempotency: second run = no-op.
- **trigger no-op:** packageId-only UPDATE → zero hours mutation (regression pin).
- rollback restores services + un-stamps conditionally.
- duplicate-id / dangling → skip+report (defensive, empty in PROD).

## 14. PRODUCT-GRADE GATES (pre-fill)

- G1: Hebrew, professional errors on the admin trigger surface (dry-run report is admin-only).
- G2: **inverse `--rollback` script (§9) + the JSON backup** — the migration rollback (NOT a git revert).
- G3: `logCriticalAction` audit-FIRST per client + structured success/fail logs.
- G4: the test plan (§13) incl. the customer scenario (a drifted client → repaired to ledger truth) + the trigger-no-op regression.
- G5: N/A (no customer UI; admin-only).
- G6: behavioral — the dry-run→apply migration; declared; the block-flip approvals are the migration's human gate.
- G7: security — admin-gated, audit-first, no PII in logs/audit; data-investigator + (final) devils-advocate consulted.

## 15. Rollback (G2)

`repairPackageAggregates --rollback <backup.json> --apply` (§9). Tested on a sample first. NOT a `git revert` — it's a data inverse-migration.

## 16. Execution order (next sharp session)

1. Read this doc + the local memory `project_package_hours_drift.md`.
2. Code DRIFT-0 (fresh-only stamp) + DRIFT-2 (this design) — together.
3. Grader (rubric `.claude/rubrics/pr-drift-2.md`) + **final devils-advocate re-review** of the CODE (the migration earns a second adversarial pass on the actual implementation).
4. PR → merge to main (DEV) → CI green.
5. **Supervised dry-run on PROD** → review the block-flips + ≥20h reversals + unresolved list with Haim.
6. Per-client block-flip approvals → **supervised `--apply`** (Haim's hands) → verify Check 7 reports clean next run.
7. Then PR-DRIFT-3 (legal stages) + PR-REPORT-1 (the report symptom).
