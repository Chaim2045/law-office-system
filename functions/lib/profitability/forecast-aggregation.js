"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports._FORECAST_SKIP_STATUSES = exports.aggregateClientProfitability = exports.FORECAST_SCHEMA_VERSION = exports.CLIENT_PROFITABILITY_COLLECTION = void 0;
exports.computeForecastForClient = computeForecastForClient;
exports.aggregateClientProfitabilityHandler = aggregateClientProfitabilityHandler;
exports.recomputeProfitabilityForCase = recomputeProfitabilityForCase;
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
 */
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const config_1 = require("../config");
const resolve_employee_cost_1 = require("../employee-costs/resolve-employee-cost");
const audit_critical_1 = require("../audit-critical");
const logger = __importStar(require("../../shared/logger"));
/** The CF-only collection holding the per-case Forecast aggregate (D-A). */
exports.CLIENT_PROFITABILITY_COLLECTION = 'client_profitability';
const CLIENTS_COLLECTION = 'clients';
const TIMESHEET_ENTRIES_COLLECTION = 'timesheet_entries';
/** Doc schema version — matches the rest of the H.2/H.3 layer (bump on field changes). */
exports.FORECAST_SCHEMA_VERSION = 1;
/** Stable audit action + system actor for the scheduled run (non-PII payload only). */
const AUDIT_ACTION = 'PROFITABILITY_AGGREGATE';
const SYS_ACTOR = 'sys:cron-profitability';
/**
 * Service statuses excluded from the Forecast — mirrors
 * `aggregates.NON_AGGREGATING_STATUSES` / `client-plan.PLAN_SKIP_STATUSES`
 * (`['archived']`) so Forecast and Plan sum the SAME active subset.
 */
const FORECAST_SKIP_STATUSES = ['archived'];
function round2(n) {
    return Math.round(n * 100) / 100;
}
function finiteNum(v) {
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
function computeForecastForClient(caseNumber, services, entries, costByEntryId) {
    const archivedServiceIds = new Set((Array.isArray(services) ? services : [])
        .filter((s) => !!s && typeof s === 'object')
        .filter((s) => FORECAST_SKIP_STATUSES.includes(String(s.status ?? 'active')))
        .map((s) => String(s.id ?? ''))
        .filter((id) => id.length > 0));
    let actualMinutes = 0;
    let actualCost = 0;
    let costedEntryCount = 0;
    let totalEntryCount = 0;
    for (const entry of entries) {
        const effectiveServiceId = String(entry.parentServiceId || entry.serviceId || '');
        // Mirror Plan's ['archived'] filter — an archived service's entries are out of scope.
        if (effectiveServiceId.length > 0 && archivedServiceIds.has(effectiveServiceId)) {
            continue;
        }
        const minutes = finiteNum(entry.minutes) ?? 0;
        totalEntryCount += 1;
        actualMinutes += minutes;
        // JOIN strictly by entryId (the cost doc id), NEVER the employee string.
        const cost = costByEntryId.get(entry.id);
        if (typeof cost === 'number' && Number.isFinite(cost)) {
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
        unCostedCoveragePercent: totalEntryCount === 0
            ? null
            : round2((100 * (totalEntryCount - costedEntryCount)) / totalEntryCount),
        schemaVersion: exports.FORECAST_SCHEMA_VERSION
    };
}
/** Reads ALL cost docs once into entryId → costPerHour|null (for the full scan). */
async function readAllCostsMap(db) {
    const map = new Map();
    const snap = await db.collection(resolve_employee_cost_1.TIMESHEET_ENTRY_COSTS_COLLECTION).get();
    snap.forEach((doc) => {
        map.set(doc.id, finiteNum((doc.data() ?? {}).costPerHour));
    });
    return map;
}
/** Reads cost docs for a specific set of entry ids (for the single-case recompute). */
async function readCostsForEntries(db, entryIds) {
    const map = new Map();
    if (entryIds.length === 0)
        return map;
    const refs = entryIds.map((id) => db.collection(resolve_employee_cost_1.TIMESHEET_ENTRY_COSTS_COLLECTION).doc(id));
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
async function readEntriesForClient(db, caseNumber) {
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
async function writeForecast(db, forecast, status) {
    await db
        .collection(exports.CLIENT_PROFITABILITY_COLLECTION)
        .doc(forecast.caseNumber)
        .set({
        ...forecast,
        status, // mirror client.status so PR4 can filter without a 2nd read
        paidRevenue: null, // H.6 seam (D-C): no live payments source yet — NEVER 0
        projectedProfit: null, // H.6 seam (D-C): needs paidRevenue — not computed vs ~0 revenue
        computedAt: admin.firestore.FieldValue.serverTimestamp()
    });
}
/** Computes one client's Forecast. `costMap` is supplied for the full scan; omitted → reads per-entry. */
async function aggregateOneClient(db, clientDoc, costMap) {
    const caseNumber = clientDoc.id;
    const data = clientDoc.data() ?? {};
    const entries = await readEntriesForClient(db, caseNumber);
    const map = costMap ?? (await readCostsForEntries(db, entries.map((e) => e.id)));
    return computeForecastForClient(caseNumber, data.services, entries, map);
}
/** Best-effort run audit (never masks the run result; logs on its own failure). */
async function safeRunAudit(payload) {
    try {
        await (0, audit_critical_1.logCriticalAction)(AUDIT_ACTION, SYS_ACTOR, payload);
    }
    catch (err) {
        const error = err;
        logger.error('profitability_aggregate.audit_failed', { errorCode: error.code });
    }
}
/**
 * The scheduled-job handler — exported separately for direct unit/integration
 * testing (no scheduler wrapping needed). Reads all clients + all cost docs once,
 * then per-client (isolated try/catch — one bad client never aborts the run)
 * computes + writes the Forecast. Writes a durable run audit on success AND
 * failure, and THROWS on a TOTAL failure (scanned > 0 but 0 written) so Cloud
 * Scheduler records an alertable failed execution. PII (cost/email) never logged.
 */
async function aggregateClientProfitabilityHandler() {
    const db = admin.firestore();
    let clientsScanned = 0;
    let clientsWritten = 0;
    let clientsFailed = 0;
    // ─── (1) ALL-OR-NOTHING reads (clients + cost docs) ──────────────────────────
    let clientDocs;
    let costMap;
    try {
        const clientsSnap = await db.collection(CLIENTS_COLLECTION).get();
        clientDocs = clientsSnap.docs;
        costMap = await readAllCostsMap(db);
    }
    catch (err) {
        const code = err.code;
        logger.error('profitability_aggregate.read_aborted', { errorCode: code });
        await safeRunAudit({ ok: false, phase: 'read' });
        throw new Error('profitability aggregate read aborted');
    }
    // ─── (2) Per-client compute + write (isolated failures) ──────────────────────
    for (const clientDoc of clientDocs) {
        clientsScanned += 1;
        try {
            const data = clientDoc.data() ?? {};
            const forecast = await aggregateOneClient(db, clientDoc, costMap);
            await writeForecast(db, forecast, String(data.status ?? 'active'));
            clientsWritten += 1;
        }
        catch (clientErr) {
            clientsFailed += 1;
            const code = clientErr.code ?? 'aggregate_error';
            // caseNumber is a non-PII business id; cost/email NEVER logged.
            logger.error('profitability_aggregate.client_failed', {
                caseNumber: clientDoc.id,
                errorCode: code
            });
        }
    }
    // ─── (3) Reconciliation log + durable run audit ──────────────────────────────
    const result = {
        ok: clientsFailed === 0,
        clientsScanned,
        clientsWritten,
        clientsFailed
    };
    logger.info('profitability_aggregate.complete', { ...result });
    await safeRunAudit({ ...result });
    // ─── (4) Throw on TOTAL failure only (alertable) — partial failures are logged.
    if (clientsScanned > 0 && clientsWritten === 0) {
        throw new Error('profitability aggregate: 0 clients written (total failure)');
    }
    return result;
}
/**
 * On-demand recompute for ONE case (the `recomputeProfitability` callable target +
 * the PR4 "refresh now" path). Returns the freshly-written Forecast, or `null` when
 * the client does not exist. Mutates `client_profitability/{caseNumber}`.
 */
async function recomputeProfitabilityForCase(caseNumber) {
    const db = admin.firestore();
    const clientSnap = await db.collection(CLIENTS_COLLECTION).doc(caseNumber).get();
    if (!clientSnap.exists) {
        return null;
    }
    const forecast = await aggregateOneClient(db, clientSnap);
    await writeForecast(db, forecast, String((clientSnap.data() ?? {}).status ?? 'active'));
    return forecast;
}
// ─── v2 Scheduled Cloud Function wrapper (daily 06:30 — staggered after the
// dailyInvariantCheck 06:00 full-client scan; explicit timeout + memory because a
// per-client entry scan can exceed the 60s onSchedule default). ────────────────
exports.aggregateClientProfitability = (0, scheduler_1.onSchedule)({
    schedule: '30 6 * * *',
    timeZone: 'Asia/Jerusalem',
    region: config_1.REGION,
    timeoutSeconds: 300,
    memory: '512MiB'
}, async (_event) => {
    await aggregateClientProfitabilityHandler();
});
/** Exposed for the archived-filter drift-guard test (pins to aggregates.NON_AGGREGATING_STATUSES). */
exports._FORECAST_SKIP_STATUSES = FORECAST_SKIP_STATUSES;
//# sourceMappingURL=forecast-aggregation.js.map