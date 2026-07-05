/**
 * forecast-aggregation — Phase 2 H.3 PR3 (the dynamic "Forecast" layer)
 * ─────────────────────────────────────────────────────────────────────────────
 * Computes each case's DYNAMIC "Forecast" — actual hours logged + actual cost
 * incurred — and stores it in the CF-only `client_profitability/{caseNumber}`
 * collection. This is the cost/profit aggregate the Plan layer (PR1) deliberately
 * kept OFF the world-readable `clients` doc (MASTER_PLAN §7.6 / §8.5 D-A): a
 * single-employee case's `actualCost ÷ actualHours` = that employee's exact
 * confidential cost-per-hour, so it must never sit where an employee can read it.
 *
 * ─── Mechanism (D-D, Haim-approved checkpoint 2026-06-10/14) ─────────────────
 * A DEDICATED scheduled aggregation job — the `dailyInvariantCheck` per-client
 * query shape — NOT the timesheet trigger (whose CREATE branch is skipped when
 * `deductedInTransaction === true`, so it would miss most costs). Per client:
 *   actualCost = Σ over its LIVE timesheet entries of (entry.minutes/60 × cost),
 * where `cost` is the snapshot in `timesheet_entry_costs/{entryId}` JOINED BY
 * `entryId` (the cost doc id == the entry id) — NEVER by the employee STRING (the
 * entry stores raw `user.email`, the cost doc lowercases it → a mixed-case email
 * would silently mismatch and drop the entry). The cost doc is write-once, so we
 * ALWAYS recompute `minutes/60 × cost` live (an edited entry's minutes change but
 * its cost snapshot doesn't — a stored product would go stale; D-D).
 *
 * ─── null ≠ 0 (load-bearing) ─────────────────────────────────────────────────
 * `costPerHour` is genuinely nullable (no `employee_costs` doc, a resolve error,
 * or a pre-H.2 entry with no cost doc at all → `costSource ∈ {employee_costs,
 * no_cost_doc, resolve_error, backfill_approx}`). An un-costed entry is EXCLUDED
 * from the cost Σ and surfaced via an explicit un-costed-coverage % — NEVER summed
 * as 0 (a 0 would fabricate a "this case costs nothing" signal — the exact false
 * reading the profitability layer exists to prevent). `actualCost` is `null` (not
 * 0) whenever NO entry is costed. Today (employee_costs = 0 docs, backfill un-run)
 * every entry is un-costed → the job ships an HONEST empty Forecast: actualCost
 * null, coverage ~0%.
 *
 * ─── Archived-service parity with Plan ───────────────────────────────────────
 * Entries belonging to an `archived` service are EXCLUDED from actualHours/Cost,
 * mirroring `client-plan.PLAN_SKIP_STATUSES` / `aggregates.NON_AGGREGATING_STATUSES`
 * (`['archived']`) — so Forecast and Plan cover the IDENTICAL active service subset
 * (else an archived service's hours would inflate the Forecast against a smaller
 * Plan baseline — a misleading delta).
 *
 * ─── Deferred to H.6 (D-C) ───────────────────────────────────────────────────
 * `paidRevenue` has NO live source (no invoices/payments collection) → stored as
 * explicit `null` (never 0), and `projectedProfit` is NOT computed against a
 * revenue ≈ 0. Both are H.6 seams (filled when the payments source lands). The
 * Plan-side expected* numbers stay on `client.plan` (PR1) — PR4 JOINs them by
 * caseNumber; we do NOT snapshot the plan in here (a 2nd copy would drift from the
 * canonical `client.plan`).
 *
 * ─── Scale + freshness (devils-advocate hardening) ───────────────────────────
 * The scheduled run reads the client list once, then reads ONLY each client's own
 * entries + their cost docs (bounded memory — NOT the whole `timesheet_entry_costs`
 * collection, which grows one-doc-per-entry forever). The daily run is the SSOT;
 * `recomputeProfitability` is a best-effort on-demand "refresh now" (last-writer-wins
 * on a rare overlap, self-heals next run — the cost INPUT changes monthly, so
 * intra-day drift is immaterial). A SYSTEMIC failure rate (≥ FORECAST_MAX_FAILURE_RATE)
 * THROWS so Cloud Scheduler alerts — a handful of malformed clients are tolerated
 * (per-client isolation + logged), but a majority failure must not look green.
 */
import * as admin from 'firebase-admin';
import { onSchedule, type ScheduledEvent } from 'firebase-functions/v2/scheduler';

import { REGION } from '../config';
import { TIMESHEET_ENTRY_COSTS_COLLECTION } from '../employee-costs/resolve-employee-cost';
import { logCriticalAction } from '../audit-critical';
import * as logger from '../../shared/logger';

/** The CF-only collection holding the per-case Forecast aggregate (D-A). */
export const CLIENT_PROFITABILITY_COLLECTION = 'client_profitability';

const CLIENTS_COLLECTION = 'clients';
const TIMESHEET_ENTRIES_COLLECTION = 'timesheet_entries';

/** Doc schema version — matches the rest of the H.2/H.3 layer (bump on field changes). */
export const FORECAST_SCHEMA_VERSION = 1;

/** Stable audit action + system actor for the scheduled run (non-PII payload only). */
const AUDIT_ACTION = 'PROFITABILITY_AGGREGATE';
const SYS_ACTOR = 'sys:cron-profitability';

/**
 * Service statuses excluded from the Forecast — mirrors
 * `aggregates.NON_AGGREGATING_STATUSES` / `client-plan.PLAN_SKIP_STATUSES`
 * (`['archived']`) so Forecast and Plan sum the SAME active subset.
 */
const FORECAST_SKIP_STATUSES: readonly string[] = ['archived'];

/**
 * CLIENT-level statuses excluded from the Forecast entirely (no aggregate doc is
 * written). Distinct from FORECAST_SKIP_STATUSES above, which is a SERVICE-status
 * filter inside a live client — do NOT conflate the two.
 *
 * H.6.c-2: a `pending_signature` client (created by `createClientFromSalesRecord`
 * in a two-phase signature gate — service `status:'pending'`, `activeServices:0`)
 * is not yet a live case. It must NOT get a `client_profitability/{caseNumber}`
 * doc: it has no live services to forecast, and surfacing it in the admin
 * dashboard before the signature is confirmed would be misleading. When the
 * client is later activated, the next scheduled run (or an on-demand recompute)
 * materialises its Forecast normally.
 */
const CLIENT_SKIP_STATUSES: readonly string[] = ['pending_signature'];

/** Client-level Forecast skip predicate — a client with this status gets no aggregate doc. */
function shouldSkipClientForForecast(status: unknown): boolean {
  return CLIENT_SKIP_STATUSES.includes(String(status ?? 'active'));
}

/** A minimal view of a timesheet entry — only the fields the Forecast needs. */
export interface ForecastEntry {
  /** the timesheet entry id (== the timesheet_entry_costs doc id — the JOIN key). */
  id: string;
  minutes: unknown;
  serviceId?: unknown;
  parentServiceId?: unknown;
}

/** The computed per-case Forecast (the doc-stored shape, minus computedAt/status/seams). */
export interface ClientForecast {
  caseNumber: string;
  /** Σ minutes/60 over in-scope (non-archived) live entries. */
  actualHours: number;
  /** Σ (minutes/60 × costPerHour) over COSTED in-scope entries; `null` when none costed (NEVER 0). */
  actualCost: number | null;
  /** # in-scope entries with a finite costPerHour. */
  costedEntryCount: number;
  /** # in-scope (non-archived) live entries — the coverage DENOMINATOR (all live entries). */
  totalEntryCount: number;
  /** round2(100 × (total − costed) / total) — % of logged work with UNKNOWN cost; `null` when 0 entries. */
  unCostedCoveragePercent: number | null;
  schemaVersion: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function finiteNum(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * PURE compute (no I/O) — the testable heart. Joins entries to costs BY entryId,
 * excludes archived-service entries (Plan parity) and null-cost entries (never 0),
 * and emits the coverage signal. Exported for direct unit testing.
 *
 * @param services the client's `services[]` (for the archived-status filter).
 * @param entries  the client's live timesheet entries (minimal view).
 * @param costByEntryId entryId → costPerHour (or null for a known-but-unknown cost).
 *        A MISSING key (pre-H.2 entry with no cost doc) is treated as un-costed too.
 */
export function computeForecastForClient(
  caseNumber: string,
  services: unknown,
  entries: ForecastEntry[],
  costByEntryId: Map<string, number | null>
): ClientForecast {
  const archivedServiceIds = new Set<string>(
    (Array.isArray(services) ? services : [])
      .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
      .filter((s) => FORECAST_SKIP_STATUSES.includes(String(s.status ?? 'active')))
      .map((s) => String(s.id ?? ''))
      .filter((id) => id.length > 0)
  );

  let actualMinutes = 0;
  let actualCost = 0;
  let costedEntryCount = 0;
  let totalEntryCount = 0;

  for (const entry of entries) {
    const effectiveServiceId = String(
      (entry.parentServiceId as string) || (entry.serviceId as string) || ''
    );
    // Mirror Plan's ['archived'] filter — an archived service's entries are out of
    // scope. An entry with NO effectiveServiceId is COUNTED (it is real logged time on
    // the CASE) — the locked "coverage denominator = ALL live entries" choice, and an
    // intentional divergence from dailyInvariantCheck, which groups by SERVICE and so
    // drops service-less entries (it cannot attribute them to a service; the case-level
    // Forecast can, and does).
    if (effectiveServiceId.length > 0 && archivedServiceIds.has(effectiveServiceId)) {
      continue;
    }

    const minutes = finiteNum(entry.minutes) ?? 0;
    totalEntryCount += 1;
    actualMinutes += minutes;

    // JOIN strictly by entryId (the cost doc id), NEVER the employee string.
    const cost = costByEntryId.get(entry.id);
    if (typeof cost === 'number' && Number.isFinite(cost)) {
      // A finite cost — INCLUDING a real 0 (free/intern) — is a KNOWN cost (counts as
      // costed, adds its value). NOTE: the only writer today, resolveEmployeeCost, nulls
      // any non-positive cost (`cph > 0`), so a stored 0 is not produced in production
      // yet — this 0-is-known branch is defensive/forward-compat (a future backfill or
      // resolver change could emit a genuine 0). It must stay distinct from null
      // (= unknown), which is excluded below.
      costedEntryCount += 1;
      actualCost += (minutes / 60) * cost;
    }
    // null / undefined cost → un-costed: counted in totalEntryCount, excluded from
    // the cost Σ (NEVER added as 0). Surfaced via unCostedCoveragePercent below.
  }

  return {
    caseNumber,
    actualHours: round2(actualMinutes / 60),
    // null (not 0) when NO entry is costed — distinguishes "unknown cost" from "free".
    actualCost: costedEntryCount > 0 ? round2(actualCost) : null,
    costedEntryCount,
    totalEntryCount,
    unCostedCoveragePercent:
      totalEntryCount === 0
        ? null
        : round2((100 * (totalEntryCount - costedEntryCount)) / totalEntryCount),
    schemaVersion: FORECAST_SCHEMA_VERSION
  };
}

// ─── I/O helpers ────────────────────────────────────────────────────────────

type Db = admin.firestore.Firestore;

/** Reads cost docs for a specific set of entry ids (per-client, bounded — used by
 * BOTH the scheduled scan and the single-case recompute, so neither holds the whole
 * timesheet_entry_costs collection in memory). */
async function readCostsForEntries(
  db: Db,
  entryIds: string[]
): Promise<Map<string, number | null>> {
  const map = new Map<string, number | null>();
  if (entryIds.length === 0) return map;
  const refs = entryIds.map((id) =>
    db.collection(TIMESHEET_ENTRY_COSTS_COLLECTION).doc(id)
  );
  const CHUNK = 300; // getAll handles large fan-ins; chunk defensively.
  for (let i = 0; i < refs.length; i += CHUNK) {
    const snaps = await db.getAll(...refs.slice(i, i + CHUNK));
    for (const snap of snaps) {
      // A MISSING cost doc (pre-H.2 entry) is intentionally left OUT of the map →
      // the join returns undefined → un-costed (honest), never a fabricated 0.
      if (snap.exists) {
        map.set(snap.id, finiteNum((snap.data() ?? {}).costPerHour));
      }
    }
  }
  return map;
}

/** Reads one client's live timesheet entries (minimal view). */
async function readEntriesForClient(db: Db, caseNumber: string): Promise<ForecastEntry[]> {
  const snap = await db
    .collection(TIMESHEET_ENTRIES_COLLECTION)
    .where('clientId', '==', caseNumber)
    .get();
  return snap.docs.map((d) => {
    const e = d.data() ?? {};
    return {
      id: d.id,
      minutes: e.minutes,
      serviceId: e.serviceId,
      parentServiceId: e.parentServiceId
    };
  });
}

/** Full-overwrite write (idempotent — re-runs converge; NEVER FieldValue.increment). */
async function writeForecast(
  db: Db,
  forecast: ClientForecast,
  status: string
): Promise<void> {
  await db
    .collection(CLIENT_PROFITABILITY_COLLECTION)
    .doc(forecast.caseNumber)
    .set({
      ...forecast,
      status, // mirror client.status so PR4 can filter without a 2nd read
      paidRevenue: null, // H.6 seam (D-C): no live payments source yet — NEVER 0
      projectedProfit: null, // H.6 seam (D-C): needs paidRevenue — not computed vs ~0 revenue
      computedAt: admin.firestore.FieldValue.serverTimestamp()
    });
}

/**
 * Computes one client's Forecast — reads ONLY this client's entries + their cost
 * docs (bounded memory; no full-collection cost scan, so the job scales with
 * entries-per-client, not total cost-doc count). A per-client read failure is
 * isolated by the caller's try/catch (fails just that client, not the run).
 */
async function aggregateOneClient(
  db: Db,
  clientDoc: admin.firestore.QueryDocumentSnapshot | admin.firestore.DocumentSnapshot
): Promise<ClientForecast> {
  const caseNumber = clientDoc.id;
  const data = clientDoc.data() ?? {};
  const entries = await readEntriesForClient(db, caseNumber);
  const costByEntryId = await readCostsForEntries(db, entries.map((e) => e.id));
  return computeForecastForClient(caseNumber, data.services, entries, costByEntryId);
}

/** Best-effort run audit (never masks the run result; logs on its own failure). */
async function safeRunAudit(payload: Record<string, unknown>): Promise<void> {
  try {
    await logCriticalAction(AUDIT_ACTION, SYS_ACTOR, payload);
  } catch (err: unknown) {
    const error = err as { code?: string };
    logger.error('profitability_aggregate.audit_failed', { errorCode: error.code });
  }
}

/**
 * Daily-job failure-rate ceiling. If at least this SHARE of scanned clients fail, the
 * run THROWS so Cloud Scheduler records an alertable failed execution. A few malformed
 * clients are tolerated (per-client isolation → logged + audited); a SYSTEMIC failure
 * (a quota/permission/code regression hitting many clients) must page — the H.1.c
 * lesson: a job that "succeeds" while silently failing en masse is worse than a hard
 * failure for a financial aggregate feeding partner decisions.
 */
export const FORECAST_MAX_FAILURE_RATE = 0.1;

/**
 * Pure alert decision (exported for unit testing): true when the failed share of
 * scanned clients reaches FORECAST_MAX_FAILURE_RATE. Subsumes the total-failure case
 * (rate 1.0). false for an empty system (scanned === 0).
 */
export function exceedsFailureThreshold(scanned: number, failed: number): boolean {
  if (scanned <= 0) return false;
  return failed / scanned >= FORECAST_MAX_FAILURE_RATE;
}

export interface AggregateResult {
  ok: boolean;
  clientsScanned: number;
  clientsWritten: number;
  clientsFailed: number;
}

/**
 * The scheduled-job handler — exported separately for direct unit/integration
 * testing (no scheduler wrapping needed). Reads the client list once, then per-client
 * (isolated try/catch — one bad client never aborts the run) reads ONLY that client's
 * entries + their cost docs (bounded memory — no full-collection cost scan), computes
 * + writes the Forecast. Writes a durable run audit on success AND failure, and THROWS
 * when the failure RATE reaches FORECAST_MAX_FAILURE_RATE so a SYSTEMIC failure is
 * alertable (not only a 0-written total failure). PII (cost/email) never logged.
 */
export async function aggregateClientProfitabilityHandler(): Promise<AggregateResult> {
  const db = admin.firestore();
  let clientsScanned = 0;
  let clientsWritten = 0;
  let clientsFailed = 0;

  // ─── (1) Read the client list (the one read the run cannot proceed without) ──
  let clientDocs: Array<admin.firestore.QueryDocumentSnapshot>;
  try {
    const clientsSnap = await db.collection(CLIENTS_COLLECTION).get();
    clientDocs = clientsSnap.docs;
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    logger.error('profitability_aggregate.read_aborted', { errorCode: code });
    await safeRunAudit({ ok: false, phase: 'read' });
    throw new Error('profitability aggregate read aborted');
  }

  // ─── (2) Per-client compute + write (isolated failures; bounded per-client reads)
  for (const clientDoc of clientDocs) {
    clientsScanned += 1;
    try {
      const data = clientDoc.data() ?? {};
      // H.6.c-2: skip pending_signature clients entirely — no aggregate doc is
      // written for a case whose signature gate has not yet been confirmed.
      if (shouldSkipClientForForecast(data.status)) {
        continue;
      }
      const forecast = await aggregateOneClient(db, clientDoc);
      await writeForecast(db, forecast, String(data.status ?? 'active'));
      clientsWritten += 1;
    } catch (clientErr: unknown) {
      clientsFailed += 1;
      const code = (clientErr as { code?: string }).code ?? 'aggregate_error';
      // caseNumber is a non-PII business id; cost/email NEVER logged.
      logger.error('profitability_aggregate.client_failed', {
        caseNumber: clientDoc.id,
        errorCode: code
      });
    }
  }

  // ─── (3) Reconciliation log + durable run audit ──────────────────────────────
  const result: AggregateResult = {
    ok: clientsFailed === 0,
    clientsScanned,
    clientsWritten,
    clientsFailed
  };
  logger.info('profitability_aggregate.complete', { ...result });
  await safeRunAudit({ ...result });

  // ─── (4) Throw on a SYSTEMIC failure rate (alertable). A few bad clients are
  // tolerated (logged + audited above); a majority failure pages Cloud Scheduler so a
  // 99%-failed-but-2-written run can never look green.
  if (exceedsFailureThreshold(clientsScanned, clientsFailed)) {
    throw new Error(
      `profitability aggregate: failure rate ${clientsFailed}/${clientsScanned} ` +
      `reached threshold ${FORECAST_MAX_FAILURE_RATE}`
    );
  }
  return result;
}

/**
 * On-demand recompute for ONE case (the `recomputeProfitability` callable target +
 * the PR4 "refresh now" path). Returns the freshly-written Forecast, or `null` when
 * the client does not exist. Mutates `client_profitability/{caseNumber}`.
 */
export async function recomputeProfitabilityForCase(
  caseNumber: string
): Promise<ClientForecast | null> {
  const db = admin.firestore();
  const clientSnap = await db.collection(CLIENTS_COLLECTION).doc(caseNumber).get();
  if (!clientSnap.exists) {
    return null;
  }
  // H.6.c-2: a pending_signature client has no live Forecast — treat an on-demand
  // recompute as a clean no-op (return null → the callable resolves {found:false},
  // never writing a client_profitability doc for a not-yet-confirmed case).
  if (shouldSkipClientForForecast((clientSnap.data() ?? {}).status)) {
    return null;
  }
  const forecast = await aggregateOneClient(db, clientSnap);
  await writeForecast(db, forecast, String((clientSnap.data() ?? {}).status ?? 'active'));
  return forecast;
}

// ─── v2 Scheduled Cloud Function wrapper (daily 06:30 — staggered after the
// dailyInvariantCheck 06:00 full-client scan; explicit timeout + memory because a
// per-client entry scan can exceed the 60s onSchedule default). ────────────────
export const aggregateClientProfitability = onSchedule(
  {
    schedule: '30 6 * * *',
    timeZone: 'Asia/Jerusalem',
    region: REGION,
    timeoutSeconds: 300,
    memory: '512MiB'
  },
  async (_event: ScheduledEvent): Promise<void> => {
    await aggregateClientProfitabilityHandler();
  }
);

/** Exposed for the archived-filter drift-guard test (pins to aggregates.NON_AGGREGATING_STATUSES). */
export const _FORECAST_SKIP_STATUSES = FORECAST_SKIP_STATUSES;

/** Exposed for the H.6.c-2 client-skip test (pending_signature never gets an aggregate doc). */
export const _CLIENT_SKIP_STATUSES = CLIENT_SKIP_STATUSES;
export { shouldSkipClientForForecast as _shouldSkipClientForForecast };
