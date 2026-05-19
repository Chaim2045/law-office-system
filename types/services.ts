/**
 * Service Types — Discriminated Union
 * ====================================
 *
 * Canonical TypeScript representation of the `services[]` array on a client
 * document. Source-of-truth shape mirrors what the canonical helper
 * (`functions/shared/client-writer.js`) enforces at runtime via
 * `calcClientAggregates` + invariant assertions I1-I4.
 *
 * Three service types, discriminated by the `type` field:
 *   - 'hours'           — pure hour bank with one or more `packages`
 *   - 'fixed'           — flat-fee service; tracks work time but never blocks
 *   - 'legal_procedure' — multi-stage legal case; each `Stage` may be
 *                         hourly (with packages) or fixed
 *
 * IMPORTANT invariants enforced at runtime (functions/shared/aggregates.js):
 *   - `FixedService.totalHours` is 0 (excluded from billable aggregates)
 *   - `LegalProcedureService` with `pricingType: 'fixed'` is excluded from
 *     billable aggregates (treated like a fixed service for accounting)
 *   - `HoursService.hoursRemaining = totalHours - hoursUsed`
 *   - `Stage.hoursRemaining = Σ packages.hoursRemaining` (when hourly)
 *
 * Created: 2026-05-18 (PR-E). Zero runtime impact — TypeScript erased at
 * compile time. Existing JS code unaffected.
 */

/* ===== Nested types ===== */

/**
 * חבילת שעות — hours package nested inside HoursService.packages[]
 * or inside Stage.packages[] (when stage is hourly).
 */
export interface HoursPackage {
  id: string;
  type: 'initial' | 'additional';
  hours: number;
  hoursUsed: number;
  hoursRemaining: number;
  status: 'active' | 'pending' | 'overdraft' | 'depleted';
  purchaseDate?: string;
  createdAt?: string;
  createdBy?: string;
  description?: string;
}

/**
 * שלב במסלול משפטי — Stage nested inside LegalProcedureService.stages[].
 * Discriminated internally by `pricingType` (hourly stages have packages,
 * fixed stages track totalHoursWorked).
 */
export interface Stage {
  id: string;
  name: string;
  status: 'active' | 'completed' | 'pending';
  pricingType: 'hourly' | 'fixed';
  order: number;
  totalHours?: number;
  hoursUsed?: number;
  hoursRemaining?: number;
  packages?: HoursPackage[];
  /** Only present on fixed-price stages — tracks work time for reporting */
  totalHoursWorked?: number;
}

/**
 * מעקב עבודה — present on FixedService for reporting (not billing).
 */
export interface WorkTracker {
  totalMinutesWorked: number;
  entriesCount: number;
}

/**
 * Override blob — set when an admin allows continued work despite hours
 * depletion. When present + `isResolved: true`, helper invariant I1
 * permits `isBlocked: false` even at `hoursRemaining <= 0`.
 */
export interface OverdraftResolved {
  isResolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  reason?: string;
}

/* ===== Service union ===== */

/**
 * Fields shared by all three service variants.
 */
export interface BaseService {
  id: string;
  name: string;
  status: 'active' | 'completed' | 'pending' | 'cancelled';
  createdAt?: string;
  createdBy?: string;
  completedAt?: string;
  description?: string;
}

/**
 * שירות שעות — pure hour bank. One or more packages; canonical aggregates
 * recomputed from packages.
 */
export interface HoursService extends BaseService {
  type: 'hours';
  totalHours: number;
  hoursUsed: number;
  hoursRemaining: number;
  packages: HoursPackage[];
  /** Admin-set: when true, hours-depleted does NOT block the client */
  overrideActive?: boolean;
  /** Override blob — alternate to overrideActive for explicit resolution */
  overdraftResolved?: OverdraftResolved;
}

/**
 * שירות קבוע — flat-fee service. Tracks work time via `work` but never
 * contributes to client billable totals. By canonical recompute rules,
 * `totalHours` must remain `0`.
 */
export interface FixedService extends BaseService {
  type: 'fixed';
  /** Always 0 by canonical recompute — kept for shape compat with helpers */
  totalHours: 0;
  /** Work tracker for reporting (totalMinutesWorked, entriesCount) */
  work: WorkTracker;
}

/**
 * הליך משפטי — multi-stage case. `pricingType` controls whether the
 * service-level aggregates count toward client billable totals:
 *   - 'hourly': included (stages have their own packages)
 *   - 'fixed':  excluded (treated like FixedService for accounting)
 */
export interface LegalProcedureService extends BaseService {
  type: 'legal_procedure';
  pricingType: 'hourly' | 'fixed';
  stages: Stage[];
  totalHours: number;
  hoursUsed: number;
  hoursRemaining: number;
  currentStage?: string;
}

/**
 * Discriminated union over all three service variants.
 * Use type guards below for narrowing.
 */
export type Service = HoursService | FixedService | LegalProcedureService;

/* ===== Type guards ===== */

/**
 * Narrows `s` to `HoursService`. Runtime check on the `type` discriminator
 * mirrors the canonical helper's classification.
 */
export function isHoursService(s: Service): s is HoursService {
  return s.type === 'hours';
}

/**
 * Narrows `s` to `FixedService`.
 */
export function isFixedService(s: Service): s is FixedService {
  return s.type === 'fixed';
}

/**
 * Narrows `s` to `LegalProcedureService`.
 */
export function isLegalProcedureService(s: Service): s is LegalProcedureService {
  return s.type === 'legal_procedure';
}

/**
 * Helper to check whether a service is excluded from billable aggregates.
 * Matches `functions/shared/aggregates.js` `isFixedService` semantics:
 * FixedService OR LegalProcedureService+pricingType='fixed'.
 */
export function isNonBillableService(s: Service): boolean {
  if (isFixedService(s)) {
    return true;
  }
  if (isLegalProcedureService(s) && s.pricingType === 'fixed') {
    return true;
  }
  return false;
}

/* ===== Exhaustiveness helper ===== */

/**
 * Compile-time exhaustiveness check helper for switch statements over the
 * Service union. Throws at runtime if reached, but the TypeScript compiler
 * surfaces the error first.
 *
 * @example
 *   switch (svc.type) {
 *     case 'hours': return handleHours(svc);
 *     case 'fixed': return handleFixed(svc);
 *     case 'legal_procedure': return handleLegal(svc);
 *     default: return assertNever(svc); // catches missing case at compile time
 *   }
 */
export function assertNever(x: never): never {
  throw new Error('Unexpected Service variant: ' + JSON.stringify(x));
}

/* ===== Client v2 ===== */

/**
 * ClientV2 — superset of the legacy `Client` interface (in `./index.ts`)
 * that reflects the actual Firestore document shape after PR-A + PR-B.
 *
 * Legacy `Client` is intentionally preserved in `./index.ts` for backward
 * compatibility with existing tests + any unmigrated callers. Migrate to
 * `ClientV2` opt-in.
 *
 * Canonical aggregate fields (totalHours, hoursUsed, hoursRemaining,
 * minutesUsed, minutesRemaining, isBlocked, isCritical) are RESTRICTED:
 * only the canonical helper (`functions/shared/client-writer.js`) may set
 * them. Treat as read-only in application code.
 */
export interface ClientV2 {
  id?: string;
  fullName: string;
  clientName?: string;
  fileNumber?: string;

  /** Discriminated-union services array */
  services: Service[];

  /* ---- Canonical aggregates (read-only — helper-derived) ---- */
  totalHours: number;
  hoursUsed: number;
  hoursRemaining: number;
  minutesUsed: number;
  minutesRemaining: number;
  isBlocked: boolean;
  isCritical: boolean;

  /* ---- Status + metadata ---- */
  status?: 'active' | 'inactive' | 'מוקפא ידנית';
  isArchived?: boolean;
  /** Manual freeze — separate from derived isBlocked */
  isOnHold?: boolean;
  archivedAt?: string;

  /* ---- Counters ---- */
  totalServices?: number;
  activeServices?: number;

  /* ---- Optimistic locking + audit ---- */
  _version?: number;
  _lastModified?: unknown;
  _modifiedBy?: string;
  lastActivity?: unknown;
  lastModifiedAt?: unknown;
  lastModifiedBy?: string;
}
