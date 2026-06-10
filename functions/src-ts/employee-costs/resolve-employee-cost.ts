/**
 * resolveEmployeeCost — Phase 2 H.2 (internal server-side cost resolver)
 * ─────────────────────────────────────────────────────────────────────────────
 * Resolves an employee's cost-per-hour for COST-STAMPING timesheet entries. Reads
 * `employee_costs/{email}` via the Admin SDK (the collection is `if false` —
 * CF-only — and the Admin SDK bypasses Security Rules). This is the deferred-to-H.2
 * helper named in `get-employee-cost.ts` (the admin-gated CALLABLE cannot be used
 * inside a write path — the employee is non-admin, and it throws not-found).
 *
 * ─── Design contract (H.2 checkpoint, Haim-approved 2026-06-10) ──────────────
 *  1. INTERNAL read — NO auth gate (the caller is a trusted CF write path running
 *     as the employee; the cost is resolved server-side, never returned to them).
 *  2. NEVER throws — a missing cost doc OR a read failure must NOT crash timesheet
 *     entry creation. Degrades to `{ costPerHour: null, costSource: ... }`.
 *  3. NEVER 0-as-default — a missing/invalid cost returns `null`, never `0`. `0`
 *     is a real (free/intern) cost; defaulting blanks to 0 would silently
 *     understate H.3's `forecast.actualCost = Σ(cost × hours)`. `null` = "unknown"
 *     (H.3 excludes it from the sum + surfaces an un-costed coverage signal).
 *  4. PII — the cost VALUE never reaches logger.* (only errorCode). Public repo.
 *
 * ─── Storage note (Option A — the leak fix) ─────────────────────────────────
 * The resolved cost is written by the caller into a SEPARATE CF-only collection
 * `timesheet_entry_costs/{entryId}` (`if false`), NOT onto the timesheet entry doc
 * — because `timesheet_entries` is employee-readable (firestore.rules) and a flat
 * field would leak the employee's own confidential cost rate (violating the locked
 * §7.6 "NOT exposed to employee self"). See MASTER_PLAN §10 (2026-06-10 revision).
 */
import * as admin from 'firebase-admin';

import { EMPLOYEE_COSTS_COLLECTION } from '../schemas/employee-cost';
import * as logger from '../../shared/logger';

export type CostSource = 'employee_costs' | 'no_cost_doc' | 'resolve_error';

export interface ResolvedCost {
  /** The cost-per-hour, or null when unknown (no doc / invalid / read error). NEVER 0-by-default. */
  costPerHour: number | null;
  /** Provenance — lets H.3 + a future reconciliation distinguish unknown vs error. */
  costSource: CostSource;
}

/**
 * Resolves the cost-per-hour for `email`. Never throws; returns a null cost on any
 * absence/error so the caller's entry creation always proceeds.
 */
export async function resolveEmployeeCost(email: string): Promise<ResolvedCost> {
  const key = (typeof email === 'string' ? email : '').toLowerCase().trim();
  if (!key) {
    return { costPerHour: null, costSource: 'no_cost_doc' };
  }
  try {
    const snap = await admin.firestore().collection(EMPLOYEE_COSTS_COLLECTION).doc(key).get();
    if (!snap.exists) {
      return { costPerHour: null, costSource: 'no_cost_doc' };
    }
    const cph = (snap.data() ?? {}).costPerHour;
    if (typeof cph === 'number' && Number.isFinite(cph) && cph > 0) {
      return { costPerHour: cph, costSource: 'employee_costs' };
    }
    // Doc exists but cost is absent/invalid → unknown (never coerce to 0).
    return { costPerHour: null, costSource: 'no_cost_doc' };
  } catch (err: unknown) {
    // A transient read failure must NOT block hour-logging. Degrade to null +
    // a distinct source so a reconciliation can retry these later. errorCode only.
    const error = err as { code?: string };
    logger.error('employee_cost.resolve_failed', { errorCode: error.code });
    return { costPerHour: null, costSource: 'resolve_error' };
  }
}

/** The CF-only collection holding per-entry cost snapshots (Option A — see header). */
export const TIMESHEET_ENTRY_COSTS_COLLECTION = 'timesheet_entry_costs';

/** Backfill marks its (approximate, current-cost-on-historical) stamps distinctly. */
export type StoredCostSource = CostSource | 'backfill_approx';

export interface EntryCostDoc {
  /** = the timesheet entry id (also the doc key in TIMESHEET_ENTRY_COSTS_COLLECTION). */
  entryId: string;
  /** lowercased employee email — for the H.3 join + coverage reconciliation. */
  employee: string;
  /** the snapshotted cost-per-hour, or null when unknown. Immutable thereafter. */
  costPerHour: number | null;
  costSource: StoredCostSource;
  schemaVersion: number;
  stampedAt: admin.firestore.FieldValue;
}

/**
 * Builds the `timesheet_entry_costs/{entryId}` doc. Written ATOMICALLY in the SAME
 * transaction as the timesheet entry (so an entry can never exist without its cost
 * doc — closes the devils-advocate atomicity 🔴). CF-only; never client-read.
 */
export function buildEntryCostDoc(
  entryId: string,
  employee: string,
  resolved: { costPerHour: number | null; costSource: StoredCostSource }
): EntryCostDoc {
  return {
    entryId,
    employee: (typeof employee === 'string' ? employee : '').toLowerCase().trim(),
    costPerHour: resolved.costPerHour,
    costSource: resolved.costSource,
    schemaVersion: 1,
    stampedAt: admin.firestore.FieldValue.serverTimestamp()
  };
}
