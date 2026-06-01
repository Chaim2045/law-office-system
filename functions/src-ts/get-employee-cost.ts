/**
 * getEmployeeCost — Pre-H.0.0.G (admin-gated read of per-employee cost-per-hour)
 * ─────────────────────────────────────────────────────────────────────────────
 * Read-side API for the CF-only `employee_costs/{email}` collection. Because the
 * collection is `allow read, write: if false` (no client SDK access), this
 * callable is the ONLY way to read a cost — including for `setEmployeeCost`'s own
 * round-trip and the future H.2 cost-stamping consumer.
 *
 * ─── Design contract (Pre-H.0.0.G checkpoint) ──────────────────────────────
 *  1. v2 `onCall` — handler exported separately for direct unit testing.
 *  2. Dual-shape admin gate — `claims.role==='admin' || claims.admin===true`.
 *  3. NO self-read carve-out — an employee may NOT read their own cost. The gate
 *     is admin-only with no `targetEmail === caller.email` exception. An
 *     employee's internal cost-rate is confidential HR data (security req #4 /
 *     MASTER_PLAN §7.6 "NOT exposed to employee self").
 *  4. Read-only — no audit entry (audit is for mutations; reads get a logger
 *     line only, WITHOUT the cost value — PII discipline).
 *
 * Consumer note: H.2 (cost foundation) will add a shared `resolveEmployeeCost`
 * helper for the timesheet-trigger path; that is deferred to H.2 (YAGNI now).
 * This callable is the admin-facing read.
 */
import * as admin from 'firebase-admin';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';

import {
  getEmployeeCostInputSchema,
  type GetEmployeeCostInput,
  EMPLOYEE_COSTS_COLLECTION
} from './schemas/employee-cost';
import * as logger from '../shared/logger';

export interface GetEmployeeCostResponse {
  success: true;
  email: string;
  costPerHour: number;
  currency: string;
  source: string;
  validFrom: unknown;
  validUntil: null;
}

/**
 * Internal handler — exported separately for direct unit testing.
 */
export async function getEmployeeCostHandler(
  request: CallableRequest<unknown>
): Promise<GetEmployeeCostResponse> {
  // ─── (1) Auth gate ─────────────────────────────────────────────────────────
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'נדרשת התחברות למערכת.');
  }
  const claims = (request.auth.token ?? {}) as { role?: string; admin?: boolean };
  const isAdmin = claims.role === 'admin' || claims.admin === true;
  // NO self-read carve-out — admin-only, even for one's own cost.
  if (!isAdmin) {
    throw new HttpsError(
      'permission-denied',
      'רק מנהל מערכת רשאי לצפות בעלות עובד.'
    );
  }
  const callerUid = request.auth.uid;

  // ─── (2) Input validation (Zod, strict) ───────────────────────────────────
  const parsed = getEmployeeCostInputSchema.safeParse(request.data);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const fieldPath = firstIssue?.path?.join('.') ?? 'unknown';
    logger.warn('employee_cost.get.invalid_input', {
      actor: { uid: callerUid },
      issueField: fieldPath
    });
    throw new HttpsError(
      'invalid-argument',
      `נתונים לא תקינים: שדה "${fieldPath}". אנא ודא שהפרטים תקינים ונסה שוב.`
    );
  }
  const input: GetEmployeeCostInput = parsed.data;
  const email = input.email; // already lowercased by schema transform

  // ─── (3) Read the cost doc ─────────────────────────────────────────────────
  const db = admin.firestore();
  const snap = await db.collection(EMPLOYEE_COSTS_COLLECTION).doc(email).get();
  if (!snap.exists) {
    logger.info('employee_cost.get.not_found', {
      actor: { uid: callerUid }
    });
    throw new HttpsError(
      'not-found',
      'לא נמצאה עלות מוגדרת לעובד זה.'
    );
  }
  const data = snap.data() ?? {};

  // ─── (4) Read log (NO cost value — PII) + return ──────────────────────────
  logger.info('employee_cost.get.success', {
    actor: { uid: callerUid }
    // costPerHour + email intentionally omitted from Cloud Logging (PII).
  });

  return {
    success: true,
    email,
    costPerHour: data.costPerHour,
    currency: data.currency,
    source: data.source,
    validFrom: data.validFrom ?? null,
    validUntil: data.validUntil ?? null
  };
}

// ─── v2 Cloud Function wrapper ──────────────────────────────────────────────
export const getEmployeeCost = onCall<unknown, Promise<GetEmployeeCostResponse>>(
  { region: 'us-central1' },
  getEmployeeCostHandler
);
