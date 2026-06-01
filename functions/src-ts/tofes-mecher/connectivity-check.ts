/**
 * tofesMecherConnectivityCheck — Phase 2 H.0 (foundation proof)
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin-gated v2 callable that proves the cross-project bridge is wired:
 * Secret Manager → service-account key → named firebase-admin app →
 * ONE read of the tofes-mecher Firestore. Returns whether the project is
 * reachable and whether at least one sales record was seen.
 *
 * This is the ONLY thing that exercises the DEPLOYED secret-binding + the real
 * cross-project IAM grant — a local script cannot prove those. That is the
 * entire point of an H.0 "foundations" PR (devils-advocate #3 defense).
 *
 * ⚠️ REPURPOSE-OR-DELETE IN H.1 (devils-advocate H.0 Attack #3): after H.1
 * ships the real `validateSalesRecordExists`, this function is dead weight
 * holding a tofes-mecher secret binding. H.1 must EITHER repurpose this file
 * into the real bridge OR delete this export. Tracked in MASTER_PLAN §8.2.
 *
 * ─── Design contract ────────────────────────────────────────────────────────
 *  1. v2 `onCall` with `{ secrets: [TOFES_KEY] }` — defineSecret is v2-only.
 *  2. Dual-shape admin gate (`claims.role==='admin' || claims.admin===true`).
 *  3. Read-only → `logger.*`, NOT `logCriticalAction` (G3 N/A for reads;
 *     audit-on-read would invent a precedent not in the bar).
 *  4. NO PII / NO key material in any log: success logs actor uid only;
 *     failure logs actor uid + error code/name only — never the key, never the
 *     original error message/stack (which could carry a key fragment), never
 *     any sales data.
 *  5. Hebrew customer-facing errors (G1, G5).
 */
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

import {
  REGION,
  TOFES_MECHER_SA_KEY_SECRET,
  TOFES_SALES_COLLECTION
} from '../config';
import { getTofesMecherApp, TofesMecherCredentialError } from './app';
import * as logger from '../../shared/logger';

const TOFES_KEY = defineSecret(TOFES_MECHER_SA_KEY_SECRET);

export interface ConnectivityCheckResponse {
  ok: true;
  reachable: true;
  /**
   * Whether the assumed sales collection returned at least one doc. FALSE does
   * NOT mean failure — it may mean the collection name (TOFES_SALES_COLLECTION)
   * is wrong (unverified) OR the project is simply empty. `reachable:true`
   * already proves the IAM+secret path works.
   */
  sawAtLeastOneDoc: boolean;
}

/**
 * Internal handler — exported separately for direct unit testing (no v2
 * wrapping / region routing needed in tests).
 */
export async function connectivityCheckHandler(
  request: CallableRequest<unknown>
): Promise<ConnectivityCheckResponse> {
  // ─── (1) Auth gate ─────────────────────────────────────────────────────────
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'נדרשת התחברות למערכת.');
  }
  const claims = (request.auth.token ?? {}) as { role?: string; admin?: boolean };
  const isAdmin = claims.role === 'admin' || claims.admin === true;
  if (!isAdmin) {
    throw new HttpsError(
      'permission-denied',
      'רק מנהל מערכת רשאי לבדוק את חיבור טופס המכר.'
    );
  }
  const callerUid = request.auth.uid;

  // ─── (2) Init the named app (sanitized credential errors) ─────────────────
  let app;
  try {
    app = getTofesMecherApp(TOFES_KEY.value());
  } catch (err: unknown) {
    // TofesMecherCredentialError is already sanitized (no key fragment). Log
    // only the error name — never `.message`/`.stack` (could carry a fragment).
    const name = err instanceof TofesMecherCredentialError
      ? err.name
      : 'unknown_init_error';
    logger.error('tofes_mecher.connectivity.init_failed', {
      actor: { uid: callerUid },
      errorName: name
    });
    throw new HttpsError(
      'internal',
      'שגיאה באתחול החיבור לטופס המכר. ודא שהמפתח הוגדר כראוי ונסה שוב, או פנה לתמיכה.'
    );
  }

  // ─── (3) ONE read to prove reachability ───────────────────────────────────
  let sawAtLeastOneDoc = false;
  try {
    const snap = await app.firestore()
      .collection(TOFES_SALES_COLLECTION)
      .limit(1)
      .get();
    sawAtLeastOneDoc = !snap.empty;
  } catch (err: unknown) {
    const error = err as { code?: string };
    // errorCode only — never the message (could echo project/collection detail)
    // and never any document data.
    logger.error('tofes_mecher.connectivity.read_failed', {
      actor: { uid: callerUid },
      errorCode: error.code
    });
    throw new HttpsError(
      'unavailable',
      'לא ניתן להתחבר לטופס המכר כעת. ודא שלחשבון השירות יש הרשאת קריאה ונסה שוב.'
    );
  }

  // ─── (4) Success log (uid only — no PII, no data) + return ────────────────
  logger.info('tofes_mecher.connectivity.ok', {
    actor: { uid: callerUid },
    sawAtLeastOneDoc
  });

  return { ok: true, reachable: true, sawAtLeastOneDoc };
}

// ─── v2 Cloud Function wrapper ──────────────────────────────────────────────
export const connectivityCheck = onCall<unknown, Promise<ConnectivityCheckResponse>>(
  { region: REGION, secrets: [TOFES_KEY] },
  connectivityCheckHandler
);
