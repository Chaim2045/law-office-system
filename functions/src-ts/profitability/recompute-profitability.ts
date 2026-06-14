/**
 * recomputeProfitability — Phase 2 H.3 PR3 (admin||partner on-demand recompute)
 * ─────────────────────────────────────────────────────────────────────────────
 * The "refresh now" path: recomputes ONE case's Forecast immediately instead of
 * waiting for the daily scheduled `aggregateClientProfitability` run (Haim
 * checkpoint 2026-06-14: daily scheduled writer + this on-demand callable). The
 * PR4 dashboard calls it on open / on a refresh button; its onSnapshot listener
 * then sees the fresh write.
 *
 * ─── Design contract ────────────────────────────────────────────────────────
 *  1. v2 `onCall`; handler exported separately for direct unit testing.
 *  2. D-E gate — `claims.role === 'admin' || claims.role === 'partner'` (dormant
 *     partner consumer; resolves admin-only today; fail-secure).
 *  3. Zod `.strict()` input `{ caseNumber: /^\d{7}$/ }`.
 *  4. This MUTATES `client_profitability/{caseNumber}` → AUDIT-FIRST via
 *     logCriticalAction (the mutation aborts if the audit write fails). The
 *     payload is non-PII (caseNumber only — never cost values).
 *  5. Returns `{ found:false }` (not a throw) when the case doesn't exist, so the
 *     dashboard renders a clean "no such case" state.
 */
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { z } from 'zod';

import { REGION } from '../config';
import { logCriticalAction } from '../audit-critical';
import * as logger from '../../shared/logger';
import { recomputeProfitabilityForCase } from './forecast-aggregation';

/** Stable audit action (non-PII payload: caseNumber). */
const AUDIT_ACTION = 'RECOMPUTE_PROFITABILITY';

/** Input schema — strict. caseNumber is the 7-digit `clients` doc id (YYYYNNN). */
export const recomputeProfitabilityInputSchema = z
  .object({
    caseNumber: z.string().regex(/^\d{7}$/, 'מספר תיק אינו תקין.')
  })
  .strict();

export interface RecomputeProfitabilityResponse {
  success: boolean;
  caseNumber: string;
  found: boolean;
}

/** Internal handler — exported separately for direct unit testing. */
export async function recomputeProfitabilityHandler(
  request: CallableRequest<unknown>
): Promise<RecomputeProfitabilityResponse> {
  // ─── (1) Auth gate (admin || partner) ──────────────────────────────────────
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'נדרשת התחברות למערכת.');
  }
  const claims = (request.auth.token ?? {}) as { role?: string };
  if (claims.role !== 'admin' && claims.role !== 'partner') {
    throw new HttpsError(
      'permission-denied',
      'רק מנהל מערכת או שותף רשאי לחשב נתוני רווחיות.'
    );
  }
  const callerUid = request.auth.uid;

  // ─── (2) Input validation (Zod, strict) ────────────────────────────────────
  const parsed = recomputeProfitabilityInputSchema.safeParse(request.data);
  if (!parsed.success) {
    const fieldPath = parsed.error.issues[0]?.path?.join('.') ?? 'caseNumber';
    logger.warn('profitability.recompute.invalid_input', {
      actor: { uid: callerUid },
      issueField: fieldPath
    });
    throw new HttpsError(
      'invalid-argument',
      `נתונים לא תקינים: שדה "${fieldPath}". אנא נסה שוב.`
    );
  }
  const { caseNumber } = parsed.data;

  // ─── (3) Audit-FIRST (this WRITES client_profitability — a mutation) ────────
  try {
    await logCriticalAction(AUDIT_ACTION, callerUid, { caseNumber });
  } catch {
    throw new HttpsError(
      'internal',
      'לא ניתן לתעד את פעולת החישוב כעת. אנא נסה שוב או פנה לתמיכה.'
    );
  }

  // ─── (4) Recompute + write ──────────────────────────────────────────────────
  let forecast;
  try {
    forecast = await recomputeProfitabilityForCase(caseNumber);
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    logger.error('profitability.recompute.failed', {
      actor: { uid: callerUid },
      caseNumber,
      errorCode: code
    });
    throw new HttpsError(
      'internal',
      'חישוב הרווחיות נכשל כעת. אנא נסה שוב או פנה לתמיכה.'
    );
  }

  if (forecast === null) {
    logger.warn('profitability.recompute.client_not_found', {
      actor: { uid: callerUid },
      caseNumber
    });
    return { success: false, caseNumber, found: false };
  }

  logger.info('profitability.recompute.ok', {
    actor: { uid: callerUid },
    caseNumber
    // actualCost intentionally omitted from Cloud Logging (§7.6 PII).
  });
  return { success: true, caseNumber, found: true };
}

// ─── v2 Cloud Function wrapper ──────────────────────────────────────────────
export const recomputeProfitability = onCall<
  unknown,
  Promise<RecomputeProfitabilityResponse>
>({ region: REGION }, recomputeProfitabilityHandler);
