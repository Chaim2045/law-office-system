# PLAN — Hours Capacity Definition (the phantom-capacity fix)

**Status:** planned, not built. Checkpoint approved by Haim 2026-08-16.
**Base:** `origin/main` @ `6c0821b`, worktree `lo-capacity`, branch `investigate/hours-capacity`.
**App:** Admin Panel + Functions. **Env:** DEV (`main`).

---

## 1. The problem, stated precisely

`client.totalHours` is presented as available capacity. It is not. For a
`legal_procedure` service, `svc.totalHours` is the sum of **all** its stages —
including stages with `status:'pending'` (never opened) and `status:'completed'`
(closed). Neither of the two server-side derivations looks at stage status:

- `functions/shared/client-writer.js:86-95` `recomputeTotalHours`
- `functions/shared/aggregates.js:96-99` `calcClientAggregates`

Both filter only on **service** status (`NON_AGGREGATING_STATUSES = ['archived']`)
and on service type (fixed). Neither knows stages exist.

`aggregates.js:57-60` declares invariant I5 — *"client.totalHours reflects ACTIVE
billable capacity"*. The declaration is false at stage resolution, and I5 is
never asserted anywhere. A gate that does not exist cannot fail.

**The professional name:** a deviation from fund accounting. Funds are not
transferable. Here, separate funds (stages, services) are presented as one pool.

---

## 2. Product rulings (Haim)

| # | Ruling | Date |
|---|---|---|
| P1 | No hours transfer between stages or between services. Every service stands on its own. | 2026-08-16 |
| P2 | A client exposed as over-drawn is displayed as over-drawn. No new automatic blocking. | 2026-08-16 |
| P3 | Available capacity = an **active stage on a service that still accepts hours** (inherits `HOURS_LOCKED_STATUSES`). | 2026-08-16 |
| P4 | Phase 1 is **display-only**. The new field does not feed `hoursRemaining` / `isBlocked`. | 2026-08-16 |
| P5 | Cross-service subsidy: narrow the override scan to billable services + add a per-service self-sufficiency flag for display. No new auto-block. | 2026-08-16 |
| P6 | Materialize via a dedicated script, dry-run first, no client cap. | 2026-08-16 |

---

## 3. Why `svc.totalHours` itself must NOT change

`functions/src-ts/profitability/client-plan.ts:91` (compiled to
`functions/lib/profitability/client-plan.js:66`) reads `svc.totalHours` as
**contracted scope at intake** and multiplies it by `ratePerHour` to produce
`expectedRevenue`. For the H.3 Plan, all-stages is the *correct* number.

`svc.totalHours` therefore carries a legitimate second meaning. The fix adds a
new field for available capacity; it does not redefine the existing one. This is
also what keeps the live per-service write gate
(`functions/timesheet/index.js:267` and siblings, which read
`service.hoursRemaining`) untouched in phase 1.

---

## 4. The numerator/denominator constraint (load-bearing)

`functions/src/modules/aggregation/index.js:49-52`
`calcServiceHoursUsedFromStages` sums **all** stages regardless of status, and
`aggregates.js:87-89` computes `hoursRemaining = totalHours − Σ svc.hoursUsed`
with no stage filter.

Filtering only the numerator and feeding it into `hoursRemaining` would give a
client on stage C `activeCapacity − (a+b+c consumed)` → deeply negative →
`isBlocked = true`. **A one-sided fix converts the bug into a production
outage.** Hence P4: numerator and denominator move together, in PR-5, or not at
all.

---

## 5. Design

### 5.1 New SSOT module — `functions/shared/stage-capacity.js`

**Correction (devils-advocate, verified):** the earlier claim that the codebase
has *no* stage-status helper was **false**. `functions/shared/stage-invariants.js`
is a backend stage-semantics module and is wired live at
`functions/scheduled/index.js:20` / `:714` (detect-only). It already solves stage
indexing and the composite stage key. What it measures is **consumption**; this
module measures **capacity** — a genuinely different question, but the two must
share vocabulary or we create the very multi-SSOT condition this plan condemns.

**Binding:** `stage-capacity.js` reuses `stage-invariants.js`'s service indexing
and its pricing-type convention, and a drift-guard test pins the two — exactly as
`client-plan.ts` is pinned to `NON_AGGREGATING_STATUSES`
(`functions/lib/profitability/client-plan.js:116-117`).

```
ACTIVE_STAGE_STATUSES = ['active']
isActiveStage(stage)              // strict === 'active'; unknown → neither bucket
computeServiceActiveCapacity(svc) // stages present → Σ active; else svc.totalHours
computeClientActiveCapacity(services)
```

**No `DEFAULT_STAGE_STATUS`.** A default was rejected: `ClientsDataManager.js:206-212`
— the partners' primary screen — already uses strict `=== 'active'`, so defaulting
a status-less stage to active would make the new server field *higher* than the
number already on screen and would bias `phantomHours` downward. Instead a stage
with no status goes to a **third bucket**, `unknownStatusHours`, counted in
neither. A read-only probe (PR-0) establishes the real count first; the code
strongly suggests it is zero, since every stage-creating path writes an explicit
status (`services/index.js:206`, `clients/index.js:362/388/414`).

**Pricing-type exclusion:** `legal_procedure` + `pricingType:'fixed'` is excluded
entirely, mirroring `client-writer.js:92`. Its stages carry `fixedPrice` and no
`totalHours` — emitting a `phantomHours` figure for a service that has no hours
contract would be fabricated drift. Note `services/index.js:799` records that
**87 of 150 production stages are fixed-priced**, so this is the majority shape.

Service eligibility reuses the existing SSOT, it does not invent a set:
`serviceAcceptsHours` / `HOURS_LOCKED_STATUSES` (`functions/shared/service-status.js:35`)
plus `isFixedService`.

### 5.1.1 Fail-open — the single most important rule in PR-1

The new computation lands in `client-writer.js` step 7, **outside every kill
switch**: the try/catch and all three enforcement modes at `client-writer.js:254`
wrap only the invariant assertion. The trigger's deliberate `mode:'log_only'`
(`functions/triggers/timesheet-trigger.js:593`) does not protect one line upward.
A throw on a malformed stage would therefore break `createQuickLogEntry`,
`addTimeToTask`, `moveToNextStage`, `closeCase` and the trigger — an employee
could not log 30 minutes.

Therefore: **total by construction** (`filter(Boolean)` on stages, `finiteNum()`
on every numeric read, `null` never `NaN`/`undefined` — mirroring `client-plan.ts`,
which has run on every client write since 2026-06-11 without incident), **and**
wrapped in its own try/catch that on failure **omits `hoursCapacity` and logs**
rather than aborting the write. A display field must never be able to block a
billing write. `ignoreUndefinedProperties` is set nowhere in `functions/`, so a
stray `undefined` rejects the whole commit.

### 5.2 New derived field — one nested key

On the client document:

```
hoursCapacity: {
  activeHours,           // Σ active-stage capacity over eligible services
  contractHours,         // the existing all-stages number, for the delta
  phantomHours,          // contractHours − activeHours (the over-presentation)
  unknownStatusHours,    // stages carrying no status — counted in neither
  unknownStatusStageCount,
  rule: 'active_stage_on_hours_accepting_service',
  ruleVersion: 1,
  schemaVersion: 1
}
```

**No `computedAt`.** A mutable timestamp would falsify the documented idempotency
contract at `functions/admin/repair-aggregates.js:16-17` (*"repairing an
already-canonical client is a no-op — same values written"*), producing a new
document version and `lastModifiedAt` churn on every nightly repair.
`ruleVersion` + `schemaVersion` carry the provenance signal instead.

**One nested key** so exactly one entry is added to `RESTRICTED_KEYS`
(`client-writer.js:64-73`) and to `clientAggregateKeys()` (`firestore.rules:140-144`).

**Also add `plan`.** Verified: `plan` is in `RESTRICTED_KEYS` (`client-writer.js:72`)
but is **absent** from `clientAggregateKeys()` — the 8-key list is
`isBlocked, isCritical, services, totalHours, hoursUsed, hoursRemaining,
minutesUsed, minutesRemaining`. H.3 PR1 shipped that gap. Since this plan cites
the rules entry as protection against the bypass class behind the 23-client
`isBlocked` corruption, adding only `hoursCapacity` would ratify the
inconsistency. Both go in, same PR, gap named in the PR body.

This is the rule+version stamp that no hours aggregate carries today. Without it
there is no way to read a document and know which rule produced its numbers.

### 5.3 Per-service self-sufficiency (P5)

On each service object: `selfSufficient: boolean` — whether the service covers
its own consumption without borrowing from a sibling. Display only. Never gates.

And `aggregates.js:113` narrows: `activeServices.some(...)` → `billableServices.some(...)`.
Today an override on a **fixed** service — one contributing zero hours — suppresses
blocking for the entire client, and `setServiceOverdraftResolved`
(`functions/clients/index.js:1365`) has no type restriction, so it is reachable.

---

## 6. PR sequence (expand-contract)

| PR | Scope | Writes? | devils-advocate |
|---|---|---|---|
| **PR-0** | Baseline script — freezes old + new numbers for all ~150 clients, read-only, no cap. **Plus three probes** (below). §7 must be corrected before this runs — PR-0 freezes the baseline everything else is measured against. | no | no |
| **PR-1** | `stage-capacity.js` SSOT + `hoursCapacity` written by the canonical writer + `RESTRICTED_KEYS` + `firestore.rules` + drift check for the uncovered `service.totalHours` vs Σ stages layer. **Nobody reads it.** | yes | **MANDATORY** |
| **PR-2** 🟢 | Audit payload carries before/after capacity; confirm text states the change. **Re-scoped down** — see §8. | yes | no |
| **PR-3** | Readers migrate, one screen at a time. `apps/user-app/js/cases.js:316` first — the label employees see. | no | no |
| **PR-4** | Delete the three parallel calculations. Only after the server is right. | no | no |
| **PR-5** | Contract: `hoursRemaining` / `isBlocked` move to the new basis **with a matching active-only `hoursUsed`** + the override narrowing. | yes | **MANDATORY** |

`PR-1` also fixes the two known stale headers it touches
(`service-writer.js:5-7` still says "DEAD CODE… wired to NOTHING" while
`reconcile-package-drift.js:196` calls it).

---

## 7. Measurable success criterion (corrected)

The brief defined success as *"recompute from the ledger and compare returns a
zero difference."* That is the right test for **consumption** and the wrong test
for **capacity**. `timesheet_entries` records how much was worked, not how much
was sold. The ledger cannot recompute capacity.

**The correct chain is `stages → service → client`:**

1. **Scoped explicitly** — for every service where `type === 'legal_procedure'`
   **and** `pricingType === 'hourly'` **and** `Array.isArray(stages) && stages.length > 0`:
   `svc.totalHours` equals Σ of its stages' `totalHours` (tolerance 0.05).
   The predicate is load-bearing: an `ST.HOURS` service is built with `packages[]`
   and **no `stages` array at all** (`services/index.js:173-191`), and an
   `ST.FIXED` service has neither. Without the scope, the check reports drift on
   every hours service and every fixed service in the office, forever — noise on
   day one, and the one signal that matters gets muted with it.
   **This layer has no check today** — Check-5 returns early on `if (!isHours)`
   (`functions/scheduled/index.js:871-872`), so it never reaches stages.
1b. **Stage-id uniqueness per client across `legal_procedure` services.** The
   totals check structurally cannot catch misattribution: if capacity lands on
   the wrong service, both `stage.totalHours` and `service.totalHours` are
   recomputed together on that wrong service (`services/index.js:789`, `:874`),
   so §7.1 passes cleanly on both and the books balance on the wrong page.
   `stage-invariants.js:56-58` records as verified fact that a client can hold two
   `legal_procedure` services each with a `stage_a`.
2. For every client: `hoursCapacity.activeHours` equals Σ active-stage capacity
   over eligible services. Recomputed independently of the writer.
3. `phantomHours` reconciles: `contractHours − activeHours − unknownStatusHours`,
   summing to the measured office-wide figure.

Check-6 (`functions/scheduled/index.js:41-88`) cannot serve as this proof: it
compares `client.totalHours` against `_recomputeTotalHours` — **the same function
that writes it**. It is a `client↔services` consistency check and will keep
returning zero even if the layer below is wrong.

---

## 8. Known hazards carried into the build

### 8.0 Three PR-0 probes (must run before the baseline is frozen)

| Probe | Question | Why it gates |
|---|---|---|
| **A** | How many stages carry no `status`? | Decides whether `unknownStatusHours` is a real bucket or a dead constant. |
| **B** | Does any client hold **two** `legal_procedure` services? | `addHoursPackageToStage` locates its target with `services.findIndex(s => s.type === ST.LEGAL_PROCEDURE)` — **first match, ignoring serviceId** (`functions/services/index.js:724`, verified). If B > 0, capacity has been landing on the wrong matter and that is a live money bug outranking this plan. Same first-match class as the report-identity bug fixed in #544. |
| **C** | For how many services does `svc.totalHours` already diverge from Σ its stages? | Pre-existing drift must be separated from drift this change introduces. |

### 8.1 Hazards

| Sev | Hazard | Evidence |
|---|---|---|
| ~~🔴~~ → 🟢 | **CORRECTED.** The earlier claim that the new field would go stale on stage advance was **wrong**. `moveToNextStage` does route through the canonical writer (`functions/services/index.js:1322`, verified), which derives the field from the passed `services[]` — so it recomputes automatically on every stage advance. `svc.totalHours` itself stays all-stages, which is intended. PR-2 therefore carries no staleness fix; PR-1 stands alone safely. | `functions/services/index.js:1322-1334` |
| 🔴 | Aggregates are persisted, not computed on read; there is deliberately no batch endpoint. Untouched clients read `0`, indistinguishable from a real zero. | `functions/admin/repair-aggregates.js:18-21` |
| 🔴 | The nightly reconciliation owner spreads intake fields through unchanged — it would not own the new field. Live in `enforce` since 2026-07-31. | `functions/shared/service-writer.js:97-101` |
| 🔴 | No CI staleness guard on `functions/lib/`; the guard covers only `functions/shared/*.js`. Editing `client-plan.ts` without `build:ts` ships stale code with green CI. | `.github/workflows/pull-request.yml:216-227` |
| 🔴 | The admin clients list overwrites `totalHours`/`hoursRemaining` in memory from its own rule — that screen will look identical after the fix, masking both success and regression. Those two functions have zero test coverage. | `apps/admin-panel/js/managers/ClientsDataManager.js:262-266` |
| 🟡 | Stage C is never marked `completed` by any code path, and `completeService`/`closeCase` never touch `stages[]`. Handled by P3's service-eligibility condition. | `functions/services/index.js:1105-1110`, `:1588` |
| 🟡 | `add-service-to-client.test.js:293` asserts `totalHours === 18 // 5+10+3` — encodes the old rule as intent. Must be updated deliberately, not silently. | verified |
| 🟡 | `reopenStage` (PR-B-1) carries an **unresolved owner decision** on whether two stages may be active simultaneously. If yes, "Σ active stages" spans two stages. | `docs/PLAN-HOURS-STAGE-INTEGRITY-2026-07.md:166` |
| 🟡 | `service-card-renderer.js` is emitted from `shared-web/src/`; editing a copy directly fails CI. | `shared-web/emit.js:110` |
| 🟡 | `addServiceToClient` never validates `stage.hours`; `{hours: undefined}` reaches Firestore and throws at commit. Dummy 1h/₪1 stages are legal on both intake paths. | `functions/services/index.js:107-113` |

---

## 9. Not verified — must not be asserted as fact

- **Why 2025897 (−6.55h) escaped blocking.** The cited cross-service-subsidy
  attribution is unverified. Four candidates: the service is
  `legal_procedure+hourly` (no service-level gate exists for it); `overrideActive`
  is set; the stored `hoursRemaining` has drifted; or the overrun accumulated via
  `applyHoursDeltaServiceOnly` (`functions/timesheet/index.js:349`), which has no
  ceiling at all. A data check precedes any claim about the mechanism.
- Whether all historical timesheet entries carry `stageId`.
- Whether any client has two simultaneously-`active` stages.
- The live value of `system_settings/invariant_enforcement`.
