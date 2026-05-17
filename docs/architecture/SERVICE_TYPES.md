# Service Types — Disambiguation Reference

**Audience:** every future developer or AI agent touching service-related code.
**Purpose:** lock the distinction between four service shapes so they don't get confused. Confusion here is the root cause of recurring bugs (see PR #257, #260, #266, #267, #276, #277).

---

## The four shapes

A `service` object lives inside `client.services[]`. There are exactly **four** valid shapes today, distinguished by `type` + `pricingType`:

| # | type | pricingType | Has stages? | Display name | Use case |
|---|------|-------------|-------------|--------------|----------|
| 1 | `'hours'` | — | No | "שעות" | Standard hourly billing with packages |
| 2 | `'fixed'` | — (ignored) | No | "שירות קבוע" | Flat-fee service. Single charge. No progression. |
| 3 | `'legal_procedure'` | `'hourly'` | **Yes** | "הליך משפטי שעתי" | Legal procedure where each stage bills by hours |
| 4 | `'legal_procedure'` | `'fixed'` | **Yes** | "הליך משפטי פיקס" | Legal procedure with a fixed price per stage |

**Critical:** shape 2 (`type='fixed'`) and shape 4 (`legal_procedure + fixed`) are BOTH "fixed price" semantically, but they are NOT the same structurally. One is flat. The other is multi-stage. Mixing them up is the bug class that took down 23 clients in May 2026.

---

## Three levels of distinction

When writing code that touches services, ask **which level** you need:

### Level 1 — Semantic ("is this billable for hours?")

Use the canonical helper:

```js
// Frontend (admin-panel):
window.ClientTypeDisplay.isFixedService(svc)

// Backend (functions/):
const { isFixedService } = require('./shared/aggregates');
```

Returns `true` for shapes 2 + 4. Use this to:
- Exclude from `hoursUsed` / `hoursRemaining` aggregates
- Skip the `isBlocked` derivation
- Mark client as fixed-only / mixed in `ClientsDataManager`

**Do not** write your own version. The mirror across frontend and backend is intentional and tested (`tests/unit/admin-panel/client-type-display.test.ts`, `functions/tests/fixed-service-type.test.js`).

### Level 2 — Structural ("does it have stages?")

```js
const hasStages = svc.type === 'legal_procedure' && Array.isArray(svc.stages);
```

Use this when:
- Rendering a stage progression UI
- Deducting time from a specific stage
- Advancing to the next stage
- Marking a stage as completed

**Shape 2 (`type='fixed'`) has no `stages` array.** Calling `svc.stages[0]` on it crashes. Always gate stage-aware code with the check above.

### Level 3 — Visual (which badge?)

The Client Report modal (`apps/admin-panel/js/ui/ClientReportModal.js:createServiceCard`) renders distinct badges so admins see at a glance:

| Shape | Badge text | Icon | CSS class |
|-------|-----------|------|-----------|
| 1 — hours | "שעות" | `fa-clock` | `report-card-badge hours` |
| 2 — fixed | "פיקס" | `fa-dollar-sign` | `report-card-badge fixed` |
| 3 — legal_procedure + hourly | "שעתי" | `fa-gavel` | `report-card-badge legal-hourly` |
| 4 — legal_procedure + fixed | "פיקס" | `fa-gavel` | `report-card-badge fixed` |

Note that shapes 2 and 4 both show "פיקס" text — they're disambiguated by **icon**. Shape 2 uses `$`, shape 4 uses `⚖`. Keep this convention in any future UI.

---

## Common mistakes (caught in past PRs)

1. **`pricingType === 'fixed'` as the only fixed check** — misses shape 2 entirely. (Fixed in PR-A.4.1 — `ClientReportModal.js`.)
2. **`type === 'hours' || procedureType === 'legal_procedure'`** — legacy disjunction. Stale `procedureType` field on client root, NOT on service. Still present in `ReportGenerator.js` — flagged for follow-up.
3. **Reading `svc.totalHours` on shape 2** — always `undefined` or `0`. Shape 2 has no `totalHours`. Use `svc.fixedPrice` for price, or `svc.work.totalMinutesWorked` for time tracking (informational only — does not affect billing).
4. **Computing `client.totalHours` by summing all services** — must exclude shapes 2 + 4 (use `isFixedService`). Sum is for billable hours only.
5. **Using `type === 'legal_procedure'` to detect fixed pricing** — wrong, that's structural. Use `isFixedService(svc)` for "is this fixed?".

---

## Where the source-of-truth definitions live

| File | Purpose |
|------|---------|
| `functions/shared/constants.js` | `SYSTEM_CONSTANTS.SERVICE_TYPES` (`HOURS`, `FIXED`, `LEGAL_PROCEDURE`) + `PRICING_TYPES` (`HOURLY`, `FIXED`) |
| `functions/shared/aggregates.js:23-26` | `isFixedService` canonical implementation |
| `apps/admin-panel/js/core/client-type-display.js:29-35` | Frontend mirror (must stay in sync) |
| `functions/shared/client-writer.js:_recomputeTotalHours` | Uses both to decide billable inclusion |

If you change `isFixedService` in one place, change it in the other. There is a test that locks the parity (`tests/unit/aggregates/calc-client-aggregates.test.ts` — shape 4 case at the end).

---

## When you add a new shape

If a future product need adds a fifth shape (e.g. subscriptions, retainers):

1. Update this doc — table at top.
2. Update `SYSTEM_CONSTANTS.SERVICE_TYPES`.
3. Update `isFixedService` in BOTH files if the new shape is fixed.
4. Add a case to `ClientTypeDisplay.computeClientTypeDisplay` so the admin table renders it.
5. Add a badge case to `ClientReportModal.createServiceCard`.
6. Add tests covering all aggregate paths (`calcClientAggregates`, `assertClientAggregateInvariants`).
7. Run the migration story: does any existing client need backfill?

Without all seven, you've created shape #6's bug class.
