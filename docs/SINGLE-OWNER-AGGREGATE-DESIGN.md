# Single-Owner Aggregate Redesign — Design Doc

**Status:** v2 — **APPROVED by Haim; OWN-0/1/2 + #401 + #402 merged & deployed to PROD (gated-safe); `dry_run` LIVE 2026-06-28 (clean).** devils-advocate run (verdict: REWORK; binding changes folded in below). _See the **EXECUTION REALITY** block below — it supersedes the stale v1 lines (§0/§4/§5 "Σ by packageId", §7 "open decisions", §8 "OWN-3 = reroute")._
**Branch:** `docs/single-owner-aggregate-design` (worktree `lo-single-owner`, from origin/main `533242c` / #397)
**Author:** Lead Agent, with Haim (Product Owner)
**Predecessors:** PR-DRIFT-0 (injector fix), PR-DRIFT-1 (Check-7 detect), PR-DRIFT-2/2.1/2.2 (offline repair, done + applied to PROD)
**Driving principle (Haim):** *"כל שירות צריך לעמוד לגופו בלבד"* — every aggregate must stand on its own, a pure function of its own ledger rows.

---

## ✅ EXECUTION REALITY (2026-06-28) — what actually shipped (supersedes the stale v1 lines below)

This doc's v1 body (§0/§4/§5 "Σ by packageId", §7 "open decisions", §8 "OWN-3 = reroute the 11 sites") was written BEFORE execution. The build then diverged in **two Haim-approved ways** — the **OWN-3 re-scope** + the **audit-driven P0 (#402)** — and BC-1..BC-5 already corrected the math premise. The stale lines are kept below with `SUPERSEDED` markers to preserve the audit trail (the BC-1..BC-5 discipline). The authoritative current state:

| Phase | PR | Status |
|---|---|---|
| OWN-0 — stop minting orphans + Check-7 detect | #398 | ✅ merged + PROD |
| OWN-1 — the owner `writeServiceWithCanonicalPackages` (dead code) | #399 | ✅ merged + PROD |
| OWN-2 — `reconcilePackageDrift` reconciliation loop (gated, **default OFF**) | #400 | ✅ merged + PROD |
| Admin-control backend (`setReconciliationMode` / `runReconciliationNow`) | #401 | ✅ merged |
| P0 fix — `unresolved` silent under-count | #402 | ✅ merged |
| §14 `MASTER_PLAN` sync | #403 | 🔄 open |
| **`dry_run` LIVE + clean, nightly 07:00, monitored before `enforce`** | — | **✅ live 2026-06-28** — first run: clientsScanned=140, servicesScanned=191, wouldRepair=0, repaired=0, failed=0, invariantFailures=0, blockFlipsDeferred=0; **zero writes to client data** |
| OWN-4 — retire the incremental writers | — | ⏳ deferred (only after `enforce`) |

**OWN-3 was RE-SCOPED (Haim-approved Option A, 2026-06-25):** "single owner" = the OWN-1 owner + OWN-2 in `enforce` as the **standing owner-of-record**; the 11 live `+=delta` writers **STAY** (provisional numbers the loop reconciles to ledger-truth). The literal "reroute the 11 writers" = **Option B, DEFERRED**. `addPackageToService` + the provisioning writers + legal_procedure stage *repair* are **OUT-OF-SCOPE BY DESIGN** (not "not yet done") — rerouting/reseeding them would re-detonate the PR #174 orphan-reseed double-count.

**Load-bearing invariants that must never regress** (re-stated so a future rewrite can't drop them): forward-replay attribution (NOT Σ-by-packageId) · fail-safe flag **default OFF** · **never auto-blocks** a client · invariant **fail-closed** · H.3 profitability **fully decoupled** (computes from the ledger, never reads `service.hoursUsed`) · `totalHours`/`ratePerHour`/`fixedPrice` are **read-only intake** · the owner is the **sole backend writer** of these aggregates; the frontends only *trigger* it.

---

## ⚠ Devils-Advocate Outcome — v2 BINDING CHANGES (2026-06-24)

A ruthless Opus devils-advocate attacked this design against the live code (#397). **Verdict: REWORK.** The *architecture survived* — single-owner is confirmed the right choice; reuse of the client-owner pattern (`client-writer.js`) + `computeRepairedService` ledger-math is verified; the cross-app seam and profitability decoupling are confirmed clean. **But the v1 draft's load-bearing premise was FALSE against the code.** These binding changes are now part of the design:

**BC-1 (fatal premise fix) — the owner ATTRIBUTES via forward-replay, NOT naive group-by.**
v1 said `package.hoursUsed = Σ entries WHERE packageId=X`. The live code STILL mints `packageId:null` orphans on overage/depleted services: create paths stamp `null` when no package resolves (`timesheet/index.js:312-314→420`, `:805-807→933`; `addTimeToTask_v2.js:248-250→513-515`), AND the trigger resolves a fallback package, increments it, but **never writes `resolvedPackageId` onto the entry** (`timesheet-trigger.js:437-441` apply vs. `:582-588` Write-2 writes only `isOverage`/`overageMinutes` — the live "Write-2 leak"). A naive `Σ`-by-`packageId` would DROP those overage hours → systematically UNDER-COUNT (under-bill) every overage client, on the exact metric the product protects. **∴ the owner MUST use the existing, PROD-tested `assignEntriesForwardReplay` (`package-repair-core.js`)** — the engine that repaired 55 PROD clients — to attribute EVERY entry incl. orphans, not raw group-by. **D1 is DECIDED:** not "(a) naive sum"; forward-replay attribution + a prerequisite PR (OWN-0) that fixes the trigger Write-2 to persist `resolvedPackageId` and gives overage-on-depleted a real bucket, so new orphans stop being minted.

**BC-2 — D2 nested lock DECIDED: unconditional in-owner overwrite.** The owner overwrites every nested `services[].packages[].hoursUsed/hoursRemaining` from its own recompute regardless of caller payload (mirroring `client-writer.js:223-227` for top-level). "sanitizeServiceAggregates by convention" is REJECTED — it recreates the forget-a-guard fragility that caused the drift.

**BC-3 — migration REORDERED (repair-first was unsafe).** Running Check-7 repair (Σ recompute) while orphans + incremental writers are still live causes a NIGHTLY FLIP-FLOP on overage clients (repair drops the unattributed overage at night; writers re-push it by day → `isBlocked`/badges oscillate, billing depends on time-of-day). New order: **OWN-0** (orphan elimination + neutralize `addPackageToService` orphan-reseed at `services/index.js:311-326,367`) → **OWN-1** (owner) → **OWN-2** (Check-7 repair live) → **OWN-3** (RE-SCOPED 2026-06-25 — OWN-2-as-owner-of-record + supervised dry_run→enforce + Admin-panel control; the literal "reroute writers" = DEFERRED Option B) → **OWN-4** (retire incremental). The detonator is neutralized in/before the repair-on PR, not three steps later.

**BC-4 — stage DETECTION pulled into v1.** Check-7 currently EXCLUDES `legal_procedure` stage packages (`scheduled/index.js:322-323`). Shipping the owner for HOURS-only would leave a LIVE, UNDETECTED stage-drift path = a consistency regression for a product sold on correctness. v1 must at least DETECT stage drift; stage *repair* may defer to DRIFT-3.

**BC-5 — reader impact is a DECLARED behavior change (needs partner sign-off).** When the owner first runs, `service.hoursUsed` for orphan-bearing/overage services will CHANGE to its true ledger attribution (may go down where there was double-count, up where under-counted). It is rendered as SSOT in `ClientReportModal.js:451`. Hours = billing → requires Haim/partner acknowledgement before cutover, not just a smoke-test.

**Minor:** specify the in-txn read order (entries-query → client `get` → writes) + a pagination threshold; add the trigger-desync evidence (`:437`→`:582`) as the concrete killer-argument against the harden-incremental alternative in §10.

> Sections below are the original v1 reasoning, now governed by the BC-1..BC-5 above where they conflict (esp. §5 owner contract → forward-replay; §7 D1/D2 → decided; §8 order → OWN-0 first).

---

## 0. One-paragraph summary

Replace the ~11 incremental writers of `package.hoursUsed` with **one backend owner** —
`writeServiceWithCanonicalPackages` — that, on every entry change, **recomputes** each
package's hours from the ledger (`package.hoursUsed = Σ entries.minutes by packageId / 60`),
then `service.hoursUsed = Σ packages`, then delegates the client roll-up to the **existing**
client owner. Close the loop by adding a **repair half** to Check-7 (it already detects drift;
make it heal). The ledger (`timesheet_entries` + `timesheet_entry_costs`) stays the single
source of truth — so the Profitability (H.3) module and every other consumer are unaffected.
This is the textbook "materialized-view-done-right" answer to denormalized-aggregate drift,
and it **reuses two already-proven pieces of this codebase**: the client-level owner pattern
and the `computeRepairedService` ledger-math (battle-tested on 55 PROD clients).

> **⚠ SUPERSEDED (BC-1 / EXECUTION REALITY):** the "`package.hoursUsed = Σ entries by packageId`" framing in this summary is the v1 model. The shipped owner attributes via **forward-replay** (`assignEntriesForwardReplay`) over EVERY entry incl. orphans — a naive Σ-by-packageId under-counts overage clients.

---

## 1. The problem (why drift recurs)

`package.hoursUsed` is the bottom rung of the aggregate chain:

```
timesheet_entry.minutes → package.hoursUsed → service.hoursUsed → client.hoursUsed/totalHours/isBlocked
```

It is written **incrementally** (`newHoursUsed = (pkg.hoursUsed||0) + hoursDelta`,
`functions/src/modules/aggregation/index.js`) by **two shared functions**
(`applyHoursDelta`, `applyLegalProcedureDelta`) across **~11 live call-sites**, plus
**3 direct seeders** (`addPackageToService` — non-zero orphan seed, `addServiceToClient`,
`addHoursPackageToStage`). **There is no single owner and no live recompute-from-ledger.**

An incremental writer is correct only if every `±delta` is applied **exactly once, to the
right package**. The system violates that in two documented ways:

1. **Double-fire race** — the in-transaction CREATE path and the trigger fallback both apply
   the delta, gated only by the `deductedInTransaction` flag. A desync ⇒ double-count.
2. **Orphan re-count (the detonator)** — when hours are logged as overage / on a depleted
   package, the entry can end up `packageId:null` (an *orphan*). Later, `addPackageToService`
   re-scans orphans and seeds a new package from them — counting the same hours twice.

Because every write is `prev + delta` (never `= Σ ledger`), an error **persists forever**
(nothing recomputes) and **propagates up faithfully** (`service = Σ packages`,
`client = Σ services` both sum the wrong number). The only ledger-truth comparison is
**Check-7** (`functions/scheduled/index.js`, `detectPackageInvariants`) — **detect-only, no write.**

**The cross-app seam.** The writers split across two frontends:
- **User App = CONSUMER** (logs *used* hours): `createQuickLogEntry` (`apps/user-app/js/quick-log.js`), `addTimeToTask`, `createTimesheetEntry`.
- **Admin Panel = PROVISIONER + overage-approver** (adds *available* hours): `addServiceToClient`, `addPackageToService` (the detonator), `addHoursPackageToStage`, `setServiceOverdraftResolved`, `setServiceOverride`.

The drift literally lives **on the seam**: User App seeds the orphan, Admin Panel detonates it.
Neither app owns the number → the owner **must** live in the backend (the one neutral place
both apps route through). Neither frontend should ever write `package.hoursUsed` again.

---

## 2. Commercial context — the bar

The system is going to **sale to multiple law offices** (multi-tenant SaaS). Hours = billing = money.
This moves the requirement from *"detect drift and repair manually"* (what we did with the
supervised `--apply`) to:

> **It must be impossible to drift in the first place — and if it somehow does, it must auto-heal without a human.**

You cannot run a supervised migration on N customers' production data every time drift appears.
A sold product needs **provable correctness** (`number == Σ its ledger rows`, assertable on
every write, deterministically testable) and **self-healing** (the reconciliation loop).

---

## 3. The pattern

The classic professional answer to denormalized-aggregate drift:

> Keep the fast denormalized read model, but make **every stored aggregate a pure function of
> the ledger**, written by **one owner that RECOMPUTES from source (never `+= delta`)**, plus a
> **reconciliation loop** that re-derives and heals on a schedule.

This is exactly what the **client level already does** (`writeClientWithCanonicalAggregates`,
`functions/shared/client-writer.js`): it recomputes from children + strips `RESTRICTED_KEYS`
so callers cannot set the aggregate. We extend that proven pattern **one level down**, to the
package/service.

**Key nuance (verified):** the client owner recomputes from its **children** (`Σ services[].hoursUsed`),
not from the entry ledger. So it is canonical-but-not-corrective — it faithfully propagates a
wrong package number. The new owner must recompute from the **entry ledger** itself. That is the
missing piece.

---

## 4. Architecture

```
   ┌─────────────── User App ───────────────┐   ┌────────── Admin Panel ──────────┐
   │ log time · quick-log · break (CONSUMER) │   │ add service/package · approve   │
   │                                         │   │ overage · override (PROVISIONER)│
   └───────────────────┬─────────────────────┘   └──────────────┬──────────────────┘
                       │  (both only TRIGGER the backend; neither writes the number)
                       ▼                                          ▼
   ┌──────────────────────────────────────────────────────────────────────────────┐
   │ LAYER 1 — ASSIGNMENT ("the brain")                                             │
   │ decides entry.packageId (which bucket the row belongs to). Selection logic     │
   │ (active-package pick, overdraft floor) UNCHANGED from today's deduction code.  │
   └───────────────────────────────────┬──────────────────────────────────────────┘
                                       ▼  writes the entry
   ┌──────────────────────────────────────────────────────────────────────────────┐
   │ LEDGER (single source of truth): timesheet_entries (+ timesheet_entry_costs)   │
   │ each row carries its packageId. Counted exactly once.                          │
   └───────────────────────────────────┬──────────────────────────────────────────┘
                                       ▼  triggers
   ┌──────────────────────────────────────────────────────────────────────────────┐
   │ LAYER 2 — OWNER ("the bookkeeper"): writeServiceWithCanonicalPackages          │
   │   package.hoursUsed = Σ(entries.minutes WHERE packageId=X) / 60   (RECOMPUTE)   │
   │   service.hoursUsed = Σ packages.hoursUsed                                      │
   │   → delegates client roll-up to EXISTING writeClientWithCanonicalAggregates    │
   │   nested-field lock + invariant assert. THE ONLY WRITER of these numbers.       │
   └───────────────────────────────────┬──────────────────────────────────────────┘
                                       ▼
   stored: package.hoursUsed · service.hoursUsed · client.hoursUsed   (all = ledger)
                                       ▲
   ┌───────────────────────────────────┴──────────────────────────────────────────┐
   │ RECONCILIATION LOOP — Check-7 (detect, exists) + REPAIR half (new):            │
   │   nightly: if stored ≠ Σ ledger → call the SAME owner to heal. Self-correcting.│
   │ + optional CLAUDE INSPECTOR (advisory): reads Check-7 output, explains drift in │
   │   plain Hebrew, flags risky patterns, proposes — never writes the number.       │
   └────────────────────────────────────────────────────────────────────────────────┘
```

> **⚠ SUPERSEDED (BC-1):** the diagram's `package.hoursUsed = Σ(entries WHERE packageId=X)` is the v1 model. The owner runs **forward-replay** (`assignEntriesForwardReplay`) to attribute EVERY entry incl. orphans, then sums the attributed result — a naive Σ-by-packageId under-counts overage clients.

**Two-layer separation is the heart:** the *brain* (which bucket?) is one decision, made once,
recorded on the entry. The *bookkeeper* (how many in each bucket?) is pure arithmetic over the
ledger. Today these are tangled (the deduction both picks AND increments); separating them is
what makes the number un-driftable.

---

## 5. The owner contract

```
writeServiceWithCanonicalPackages(tx, { clientRef, clientData, serviceId, entriesForService })
```

**Behavior (mirrors the client owner's contract):**
1. **Recompute, never increment.** For each package in the service:
   `package.hoursUsed = round2( Σ(entry.minutes for entries WHERE packageId == package.id) / 60 )`,
   `package.hoursRemaining = round2(package.hours - package.hoursUsed)`.
   Then `service.hoursUsed = round2(Σ packages.hoursUsed)`.
   (Legal-procedure: per-stage, `stage.hoursUsed = Σ its packages`, `service = Σ stages`.)
   `// SUPERSEDED by BC-1` — the owner does NOT naive-Σ by packageId; it runs forward-replay (`assignEntriesForwardReplay`) to attribute EVERY entry incl. orphans, then sums the attributed result. Naive Σ-by-packageId under-counts overage clients (orphans dropped).
2. **Read-before-write (Firestore rule, the DRIFT-2.2 lesson).** All `tx.get`/queries first,
   all writes after. **Aggregation `sum()` is NOT available inside a transaction** → the owner
   reads the service's entry docs (≤185/service at current scale; p95≈56) and sums **in code**.
   No reliance on aggregation-in-txn.
3. **Nested-field lock.** `RESTRICTED_KEYS` today locks *top-level* client fields; package
   aggregates are nested in `services[].packages[].hoursUsed`. The owner OWNS the `services[]`
   write for those fields: any caller payload's nested `hoursUsed`/`hoursRemaining` is stripped
   and overwritten from the recompute. Other writers to `services[]` (status, override,
   intake fields) must not touch the aggregate fields.
4. **Read-only intake inputs (compatibility constraint).** The owner writes ONLY the `hoursUsed`
   *consumption* aggregates. It treats `services[].totalHours`, `ratePerHour`, `fixedPrice`,
   `pricingType`, `status` as **read-only intake** (Profitability's Plan depends on them —
   `functions/lib/profitability/client-plan.js`).
5. **Invariant assert.** Before commit, assert `service.hoursUsed == Σ packages.hoursUsed` and
   each `package.hoursUsed == Σ its entries / 60` (within rounding epsilon). Fail-closed on
   violation (log + abort, never write a known-bad number).
   **→ Strengthened by #402:** `ledgerTruth` now = Σ(assigned + **unresolved**) minutes / 60 — an overdrawn service's unresolved minutes (no eligible package past the −10h floor) can no longer pass a false-clean invariant; they flip `invariantOk` false → the owner throws / the OWN-2 loop skips (`reconcile-package-drift.js` `invariant_failed`).
6. **Delegate client roll-up.** After writing the service, call the existing
   `writeClientWithCanonicalAggregates` (writer-before-audit order, per DRIFT-2.2).

**Callers** feed the owner the `serviceId` (and let it pull the entries). The deduction
**selection** logic (which package) is unchanged — it just stamps `entry.packageId`; the owner
counts. The 11 call-sites become callers of the one owner instead of incrementers.

> **⚠ SUPERSEDED by the OWN-3 re-scope (2026-06-25):** the 11 call-sites **STAY incremental** (a provisional `+=delta`); **OWN-2 running in `enforce`** reconciles them to ledger-truth as the standing owner-of-record. Rerouting the call-sites to call the owner per-write = **Option B (DEFERRED)** — it swaps incremental-drift for a race-drift class, doesn't cover the trigger (UPDATE/DELETE), and would rewrite the overdraft-blocking guard.

---

## 6. Compatibility & blast radius (verified, code-grounded)

**Profitability / H.3 = ✅ COMPATIBLE — fully decoupled.** It never reads any `hoursUsed`
aggregate. `functions/lib/profitability/forecast-aggregation.js` computes
`actualHours = Σ entries.minutes/60` and `actualCost = Σ(entry_costs by entryId)` from the
**ledger itself**; the cost doc is keyed by entryId, independent of packageId. Cashflow/תזרים
and Workload analytics are also independent (`budget_tasks`-based). The refactor's invariant —
*"don't touch minutes / costs / ratePerHour"* — is exactly the set of inputs profitability
depends on, so the contract is preserved by construction.

**Real blast radius = the `hoursUsed` READERS** (must smoke-test that the recompute produces
equal-or-better values; the design changes the *writer*, not the read shape):
- `apps/admin-panel/js/modules/service-card-renderer.js` (progress bar / חריגה)
- `apps/admin-panel/js/ui/ClientReportModal.js` (declares `service.hoursUsed` the SSOT — most sensitive)
- `apps/admin-panel/js/managers/ReportGenerator.js` (package + stage level)
- `apps/admin-panel/js/ui/ClientManagementModal.js` (consumes `clientAggregates.hoursUsed` from CF responses)
- `apps/admin-panel/js/fluent/FluentDataGrid.js` (client KPI roll-up)

---

## 7. Design decisions — RESOLVED

> All three (D1/D2/D3) are now DECIDED (see the per-item markers below). Titled "open" in v1; resolved by BC-1/BC-2 + the OWN-3 re-scope before any owner write went live.

**D1 — Overage representation.** When logged hours exceed a package's capacity, where do the
overage minutes live so the owner can count them without an orphan?
- **(a)** Entries keep their real `packageId`; `package.hoursUsed` is allowed to exceed
  `package.hours` (overdraft shown as negative `hoursRemaining`). Simplest; the owner just sums.
- **(b)** A synthetic "overage bucket" per service.
- **(c)** A separate `service.overageHours` field.
- *Leaning (a)* — it keeps every entry attributable to a real package, eliminates orphans by
  construction, and preserves the intentional-overage signal. DA to challenge.
- **→ DECIDED (BC-1):** leaning **(a)** adopted — entries keep a real `packageId`; OWN-0 stops minting new orphans + **forward-replay** attributes any residual orphan; the owner sums the attributed result. `#402` then folded `unresolved` minutes into `ledgerTruth` so an un-attributable overage can't pass a false-clean invariant.

**D2 — Nested-lock mechanism.** How exactly to prevent other `services[]` writers from
clobbering the aggregate fields — a shared `sanitizeServiceAggregates(service)` helper applied
by every `services[]` writer, vs. routing all `services[]` writes through the owner. Trade-off:
enforcement strength vs. blast radius of the change.
- **→ DECIDED (BC-2):** **unconditional in-owner overwrite** — the owner strips any caller-supplied nested `hoursUsed`/`hoursRemaining` and recomputes from the ledger (mirrors `client-writer.js`'s top-level `RESTRICTED_KEYS`). "sanitize-by-convention" rejected (recreates the forget-a-guard fragility).

**D3 — Migration sequencing & flag.** Order of routing the 11 call-sites; feature-flag
granularity (global vs. per-path); whether Check-7-repair goes live *before* any writer is
rerouted (recommended — safety net first).
- **→ DECIDED (OWN-3 re-scope):** the safety net (OWN-2) shipped FIRST, gated `default OFF`; the architecture is **OWN-2-as-owner-of-record** promoted `dry_run → enforce` (NOT a per-write reroute). Flag is its own `system_settings/package_reconciliation` doc, `off|dry_run|enforce`. **`dry_run` is LIVE + clean since 2026-06-28**, monitored before `enforce`.

---

## 8. Migration plan (incremental, no big-bang)

> **The table below reflects the EXECUTED reality** (PR# + status). The v1 ordering's "OWN-3 = reroute the 11 sites" is SUPERSEDED by the re-scope (see the EXECUTION REALITY block at top).

| Phase | PR | What | Status |
|---|---|---|---|
| −1 — Stop minting orphans | OWN-0 (#398) | Fix trigger Write-2 to persist `resolvedPackageId`; give overage-on-depleted a real bucket; neutralize `addPackageToService` orphan-reseed; Check-7 DETECT for the uncovered classes. | ✅ merged + PROD |
| 0 — Foundation | OWN-1 (#399) | Build `writeServiceWithCanonicalPackages` (owner) + nested lock + invariant + tests. **Wired to nothing** (dead code). | ✅ merged + PROD |
| 1 — Safety net (the reconciliation loop) | OWN-2 (#400) | `reconcilePackageDrift` scheduled loop — detect drift → call the owner → heal. Own `system_settings/package_reconciliation` flag, **default OFF**; never auto-blocks. | ✅ merged + PROD; **`dry_run` LIVE + clean 2026-06-28** |
| — Engine P0 fix | #402 | `ledgerTruth = Σ(assigned + unresolved)` so an overdrawn service's un-attributable minutes can't pass a false-clean invariant (the `enforce` prerequisite). | ✅ merged |
| 2 — Owner-of-record (RE-SCOPED — was "reroute the 11 sites") | OWN-3 | (a) supervised **`dry_run → enforce`** promotion of OWN-2; (b) **Admin-Panel control**: backend #401 ✅ + frontend (pending); (c) doc sync (#403 §14 + this design-doc sync). **Reroute the 11 sites = Option B, DEFERRED.** | 🟡 in progress |
| 3 — Retire incremental | OWN-4 | Clean up the now-provisional incremental writers; owner-of-record is canonical. | ⏳ deferred (only after `enforce`) |
| 4 — Commercial hardening | OWN-5 + DRIFT-3 | Claude-inspector advisory over Check-7; extend the owner to legal_procedure stages. | ⏳ deferred |

> **⚠ OUT-OF-SCOPE BY DESIGN (not "not yet done"):** `addPackageToService` + the provisioning writers (`addServiceToClient`, `addHoursPackageToStage`, `setServiceOverdraftResolved`, `setServiceOverride`) + legal_procedure stage **repair** are intentionally NOT rerouted/reseeded. Re-routing or re-seeding them would **re-detonate the PR #174 orphan-reseed double-count**. A future session must NOT "finish" them — they are correct as provisional writers reconciled by OWN-2 in `enforce`.

Each PR: rubric + **devils-advocate** + grader; small; DEV → smoke → PROD; post-merge deploy
verification. Branch from latest origin/main; coordinate with the active `lo-package-fix` worktree
(also touches `functions/`).

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Touches core write path (hours = money) | Incremental migration behind a flag; safety-net (Check-7 repair) live first; invariant-assert fail-closed; devils-advocate each PR. |
| Recompute reads entries in-txn (contention/limits) | ≤185 entries/service (p95≈56); reads-before-writes; if a service ever grows huge, paginate — not a concern at current or 10× scale. |
| A reader depended on incremental *timing* | §6 smoke-tests; the value is equal-or-more-correct, not different in shape. |
| Mocked-SDK tests pass but Firestore semantics differ (the DRIFT-2.2 trap) | Use the reads-before-writes-enforcing mock; verify on DEV with real Firestore before PROD. |
| Stage/legal_procedure aggregates out of v1 scope | Explicitly deferred to DRIFT-3; owner handles `hours` services first, stages second. |

---

## 10. Alternatives considered & rejected

- **Keep incremental + harden (idempotency/dedup/guards).** Defense-by-more-guards; the same
  bug class recurred repeatedly; cannot *prove* no-drift. Rejected — doesn't remove the fragility.
- **Full Event-Sourcing / CQRS.** Right idea, wrong dose: huge rewrite of a live, pre-launch
  system; discards the working read model; over-engineered for 3,137 entries. Rejected.
- **Compute-on-read, store nothing (`sum()` per read).** Trades drift for read-cost/latency at
  the worst layer for a dashboard-heavy multi-tenant product; some logic needs the value at
  write time. Rejected.
- **★ Single-owner recompute-from-ledger (this doc).** Reuses two proven pieces of the codebase,
  free at this scale, keeps the read model, delivers self-healing + provable correctness.

---

## 11. What the devils-advocate must attack

1. Is single-owner genuinely the best for THIS system, or is a rejected alternative actually better given the launch deadline? Steelman the strongest competitor.
2. D1/D2/D3 — pick holes in the leanings; find a failure mode.
3. The `entriesForService` read in-txn — contention, hot-spots, Firestore limits, cost at multi-tenant scale.
4. The nested-lock — can a `services[]` writer still clobber an aggregate field? Find the gap.
5. Legal-procedure / stages — does deferring them leave a live drift path?
6. The cross-app seam — does any frontend still write the number directly after migration?
7. Compatibility — any consumer (beyond profitability) that breaks under recompute?
8. Migration safety — can any single PR in §8 leave PROD in a worse state than today?
```
