/**
 * setEmployeeCost — Pre-H.0.0.G (admin-gated write of per-employee cost-per-hour)
 * ─────────────────────────────────────────────────────────────────────────────
 * Writes/overwrites `employee_costs/{email}` (single-doc model). Cost-per-hour
 * is sourced from the external accountant. SENSITIVE FINANCIAL PII.
 *
 * ─── Design contract (mirrors set-admin-claims.ts; Pre-H.0.0.G checkpoint) ──
 *  1. v2 `onCall` — handler exported separately for direct unit testing.
 *  2. Role-only admin gate — `claims.role === 'admin'`. The legacy `admin:true`
 *     branch was removed in the Pre-H.0.0.E follow-up (2026-06-05).
 *  3. Zod `.strict()` input validation `{email, costPerHour, currency?,
 *     validFrom?, source?}`.
 *  4. Email normalized to lowercase ONCE — the SAME key is used for the
 *     employees-existence check AND the cost write, so they can never address
 *     different docs (devils-advocate Attack #1).
 *  5. Existence proof — the `employees/{email}` doc must exist (not-found else).
 *  6. Audit-FIRST via `logCriticalAction('SET_EMPLOYEE_COST', ...)` BEFORE the
 *     write. If audit fails, the cost is NOT written (fail-secure). Compensating
 *     audit on write failure.
 *  7. PII discipline — cost figures go in the audit_log payload (admin-read,
 *     forensic necessity) but NEVER in `logger.*`. `updatedBy` = admin UID.
 *
 * ⚠️ audit_log now carries salary-adjacent PII for SET_EMPLOYEE_COST. The H.8
 *    BigQuery export (MASTER_PLAN §8.11) MUST redact these details.
 */
import * as admin from 'firebase-admin';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';

import {
  setEmployeeCostInputSchema,
  type SetEmployeeCostInput,
  EMPLOYEE_COSTS_COLLECTION,
  EMPLOYEE_COST_SCHEMA_VERSION
} from './schemas/employee-cost';
import { logCriticalAction } from './audit-critical';
import * as logger from '../shared/logger';

const EMPLOYEES_COLLECTION = 'employees';

export interface SetEmployeeCostResponse {
  success: true;
  email: string;
  costPerHour: number;
  currency: 'ILS';
  auditDocId: string;
}

/**
 * Internal handler — exported separately so tests invoke it without the v2
 * wrapping + region routing.
 */
export async function setEmployeeCostHandler(
  request: CallableRequest<unknown>
): Promise<SetEmployeeCostResponse> {
  // ─── (1) Auth gate ─────────────────────────────────────────────────────────
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'נדרשת התחברות למערכת.');
  }
  const claims = (request.auth.token ?? {}) as { role?: string };
  const isAdmin = claims.role === 'admin';
  if (!isAdmin) {
    throw new HttpsError(
      'permission-denied',
      'רק מנהל מערכת רשאי לעדכן עלות עובד.'
    );
  }
  const callerUid = request.auth.uid;

  // ─── (2) Input validation (Zod, strict) ───────────────────────────────────
  const parsed = setEmployeeCostInputSchema.safeParse(request.data);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const fieldPath = firstIssue?.path?.join('.') ?? 'unknown';
    logger.warn('employee_cost.set.invalid_input', {
      actor: { uid: callerUid },
      issueField: fieldPath
      // NOTE: never log the cost value or the email here (PII discipline).
    });
    throw new HttpsError(
      'invalid-argument',
      `נתונים לא תקינים: שדה "${fieldPath}". אנא ודא שהפרטים תקינים ונסה שוב.`
    );
  }
  const input: SetEmployeeCostInput = parsed.data;
  // email is already lowercased by the schema's .toLowerCase() transform.
  const email = input.email;

  const db = admin.firestore();

  // ─── (3) Existence proof — employee must exist (same key as the write) ────
  const employeeRef = db.collection(EMPLOYEES_COLLECTION).doc(email);
  const employeeSnap = await employeeRef.get();
  if (!employeeSnap.exists) {
    logger.warn('employee_cost.set.employee_not_found', {
      actor: { uid: callerUid }
      // email omitted from logs (PII)
    });
    throw new HttpsError(
      'not-found',
      'העובד המבוקש לא נמצא במערכת. ודא שכתובת המייל תקינה ונסה שוב.'
    );
  }

  // ─── (4) Read previous cost (for the audit trail) ─────────────────────────
  const costRef = db.collection(EMPLOYEE_COSTS_COLLECTION).doc(email);
  const previousSnap = await costRef.get();
  const previousCost = previousSnap.exists
    ? (previousSnap.data()?.costPerHour ?? null)
    : null;

  // ─── (5) Audit FIRST — if this fails, the cost is NOT written ─────────────
  // Cost figures live here (admin-read audit_log) for forensic completeness.
  // NEVER in logger.* (Cloud Logging). See file header + Attack #3.
  let auditDocId: string;
  try {
    auditDocId = await logCriticalAction('SET_EMPLOYEE_COST', callerUid, {
      targetEmail: email,
      previousCost,
      newCost: input.costPerHour,
      currency: input.currency,
      source: input.source
    });
  } catch (err: unknown) {
    const error = err as { code?: string };
    logger.error('employee_cost.set.audit_write_failed', {
      actor: { uid: callerUid },
      errorCode: error.code
    });
    throw new HttpsError(
      'internal',
      'שגיאה בכתיבת לוג ביקורת. העלות לא נשמרה. אנא נסה שוב מאוחר יותר או פנה לתמיכה.'
    );
  }

  // ─── (6) Write the cost doc (overwrite — single-doc model) ────────────────
  const validFrom = input.validFrom
    ? admin.firestore.Timestamp.fromDate(new Date(input.validFrom))
    : admin.firestore.FieldValue.serverTimestamp();
  try {
    await costRef.set({
      email,
      costPerHour: input.costPerHour,
      currency: input.currency,
      validFrom,
      validUntil: null, // single-doc = always the current rate
      updatedBy: callerUid, // admin UID, never email
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      source: input.source,
      schemaVersion: EMPLOYEE_COST_SCHEMA_VERSION
    });
  } catch (err: unknown) {
    const error = err as { code?: string };
    logger.error('employee_cost.set.write_failed', {
      actor: { uid: callerUid },
      auditDocId,
      errorCode: error.code
    });
    // Compensating audit — the SET audit said "changed" but the write failed.
    try {
      await logCriticalAction('SET_EMPLOYEE_COST_FAILED', callerUid, {
        targetEmail: email,
        originalAuditDocId: auditDocId,
        errorCode: error.code
      });
    } catch {
      logger.error('employee_cost.set.compensating_audit_failed', {
        actor: { uid: callerUid },
        auditDocId
      });
    }
    throw new HttpsError(
      'internal',
      'שגיאה בשמירת עלות העובד. הנתון לא נשמר. אנא נסה שוב או פנה לתמיכה עם מזהה האירוע.'
    );
  }

  // ─── (7) Success log (NO cost value — PII) + return ───────────────────────
  logger.info('employee_cost.set.success', {
    actor: { uid: callerUid },
    auditDocId
    // costPerHour + email intentionally omitted from Cloud Logging (PII).
  });

  return {
    success: true,
    email,
    costPerHour: input.costPerHour,
    currency: input.currency,
    auditDocId
  };
}

// ─── v2 Cloud Function wrapper ──────────────────────────────────────────────
export const setEmployeeCost = onCall<unknown, Promise<SetEmployeeCostResponse>>(
  { region: 'us-central1' },
  setEmployeeCostHandler
);
