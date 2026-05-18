/**
 * Repair-Aggregates Module — audit + repair for client aggregate drift.
 *
 * PR-D (2026-05-18): closes the loop on the 2026-05-13 isBlocked-corruption
 * incident. After PR-A (architectural gap closure) + PR-B (14 callsite
 * migrations to writeClientWithCanonicalAggregates), all NEW writes are
 * guaranteed canonical. This module gives Haim an on-demand way to:
 *   1. Detect any remaining drift left by pre-migration writes (audit).
 *   2. Repair a drifted client (repair).
 *
 * Why "repair = no-op touch via helper" works:
 *   The helper's contract is: after the write, client document state matches
 *   the canonical aggregate computation from its services[] array. So a write
 *   with empty caller payload still triggers the full canonical recompute —
 *   the document is rewritten with canonical aggregates, regardless of the
 *   prior stored values. Idempotent: repairing an already-canonical client
 *   is a no-op (same values written).
 *
 * Both callables are admin-only. There is intentionally NO batch endpoint —
 * Haim runs repair per-client after reviewing audit output, preventing mass-
 * write incidents.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { checkUserPermissions } = require('../shared/auth');
const { logAction } = require('../shared/audit');
const { SYSTEM_CONSTANTS } = require('../shared/constants');
const { calcClientAggregates } = require('../shared/aggregates');
const { writeClientWithCanonicalAggregates, _recomputeTotalHours } = require('../shared/client-writer');

const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;
const PT = SYSTEM_CONSTANTS.PRICING_TYPES;

const db = admin.firestore();

// Clients exempted from drift checks. Mirrors `dailyInvariantCheck`.
const SKIP_CLIENTS = ['internal_office'];

// Float tolerance for numeric aggregate comparisons. Matches dailyInvariantCheck.
const TOLERANCE = 0.02;

/**
 * Compute canonical aggregates from a client data snapshot.
 * Mirrors helper internals (recomputeTotalHours + calcClientAggregates).
 * Read-only — no side effects.
 */
function computeCanonical(clientData) {
  const services = Array.isArray(clientData.services)
    ? clientData.services.filter(Boolean)
    : [];
  const totalHours = _recomputeTotalHours(services);
  const agg = calcClientAggregates(services, totalHours);
  return {
    totalHours,
    hoursUsed: agg.hoursUsed,
    hoursRemaining: agg.hoursRemaining,
    minutesUsed: agg.minutesUsed,
    minutesRemaining: agg.minutesRemaining,
    isBlocked: agg.isBlocked,
    isCritical: agg.isCritical
  };
}

/**
 * Compare stored vs canonical and return a drift-field array.
 * Empty array = no drift.
 */
function diffFields(stored, canonical) {
  const drifts = [];
  const numericFields = [
    'totalHours',
    'hoursUsed',
    'hoursRemaining',
    'minutesUsed',
    'minutesRemaining'
  ];
  const booleanFields = ['isBlocked', 'isCritical'];

  for (const field of numericFields) {
    const cur = typeof stored[field] === 'number' ? stored[field] : 0;
    const can = canonical[field];
    const diff = Math.abs(cur - can);
    if (diff > TOLERANCE) {
      drifts.push({
        field,
        current: parseFloat(cur.toFixed(2)),
        canonical: parseFloat(can.toFixed(2)),
        diff: parseFloat(diff.toFixed(2))
      });
    }
  }

  for (const field of booleanFields) {
    const cur = stored[field] === true;
    const can = canonical[field] === true;
    if (cur !== can) {
      drifts.push({
        field,
        current: cur,
        canonical: can
      });
    }
  }

  return drifts;
}

// ═══════════════════════════════════════════════════════════════
// auditClientAggregates — read-only scan
// ═══════════════════════════════════════════════════════════════

/**
 * Admin-only callable. Scans clients and reports aggregate drift.
 *
 * @param {Object} data
 * @param {string[]} [data.clientIds] — optional filter. If omitted, scans all.
 * @returns {Object} { success, totalChecked, totalDrifts, drifts, scannedAt }
 */
exports.auditClientAggregates = functions.https.onCall(async (data, context) => {
  try {
    // ─── Auth ───
    const user = await checkUserPermissions(context);
    if (user.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'גישת מנהל נדרשת'
      );
    }

    // ─── Determine scan set ───
    const filterIds = Array.isArray(data && data.clientIds) ? data.clientIds : null;

    let docs;
    if (filterIds && filterIds.length > 0) {
      const results = await Promise.all(
        filterIds.map((id) => db.collection('clients').doc(id).get())
      );
      docs = results.filter((d) => d.exists);
    } else {
      const snapshot = await db.collection('clients').get();
      docs = snapshot.docs;
    }

    // ─── Compare each ───
    const drifts = [];
    let totalChecked = 0;

    for (const doc of docs) {
      const clientId = doc.id;
      if (SKIP_CLIENTS.includes(clientId)) {
        continue;
      }
      totalChecked++;

      const clientData = doc.data() || {};
      const stored = {
        totalHours: clientData.totalHours,
        hoursUsed: clientData.hoursUsed,
        hoursRemaining: clientData.hoursRemaining,
        minutesUsed: clientData.minutesUsed,
        minutesRemaining: clientData.minutesRemaining,
        isBlocked: clientData.isBlocked,
        isCritical: clientData.isCritical
      };
      const canonical = computeCanonical(clientData);
      const driftFields = diffFields(stored, canonical);

      if (driftFields.length > 0) {
        drifts.push({
          clientId,
          clientName: clientData.fullName || clientData.clientName || clientId,
          driftFields
        });
      }
    }

    return {
      success: true,
      totalChecked,
      totalDrifts: drifts.length,
      drifts,
      scannedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Error in auditClientAggregates:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError(
      'internal',
      `שגיאה ב-audit: ${error.message}`
    );
  }
});

// ═══════════════════════════════════════════════════════════════
// repairClientAggregates — single-client canonical repair
// ═══════════════════════════════════════════════════════════════

/**
 * Admin-only callable. Re-canonicalizes a single client via no-op write
 * through writeClientWithCanonicalAggregates. Idempotent.
 *
 * @param {Object} data
 * @param {string} data.clientId — required
 * @returns {Object} { success, clientId, before, after, changed }
 */
exports.repairClientAggregates = functions.https.onCall(async (data, context) => {
  try {
    // ─── Auth ───
    const user = await checkUserPermissions(context);
    if (user.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'גישת מנהל נדרשת'
      );
    }

    // ─── Validation ───
    if (!data || !data.clientId || typeof data.clientId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'מזהה לקוח חובה'
      );
    }
    if (SKIP_CLIENTS.includes(data.clientId)) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        `לקוח ${data.clientId} פטור מבדיקות drift`
      );
    }

    const clientRef = db.collection('clients').doc(data.clientId);

    const result = await db.runTransaction(async (transaction) => {
      const helperResult = await writeClientWithCanonicalAggregates(
        transaction,
        clientRef,
        // Empty partialUpdate — helper recomputes canonical from current
        // services. Idempotent: same values rewritten when already canonical.
        {},
        {
          caller: 'repairClientAggregates',
          auditMeta: { uid: user.uid, username: user.username }
        }
      );

      return {
        before: helperResult.previousAggregates,
        after: {
          totalHours: helperResult.aggregates.totalHours ?? helperResult.written.totalHours,
          hoursUsed: helperResult.aggregates.hoursUsed,
          hoursRemaining: helperResult.aggregates.hoursRemaining,
          minutesUsed: helperResult.aggregates.minutesUsed,
          minutesRemaining: helperResult.aggregates.minutesRemaining,
          isBlocked: helperResult.aggregates.isBlocked,
          isCritical: helperResult.aggregates.isCritical
        }
      };
    });

    // Did anything actually change?
    const changed = !aggregatesEqual(result.before, result.after);

    // ─── Audit log (post-transaction) ───
    try {
      await logAction('REPAIR_CLIENT_AGGREGATES', user.uid, user.username, {
        clientId: data.clientId,
        before: result.before,
        after: result.after,
        changed
      });
    } catch (auditError) {
      console.error('Audit log error (data already repaired):', auditError);
    }

    return {
      success: true,
      clientId: data.clientId,
      before: result.before,
      after: result.after,
      changed
    };
  } catch (error) {
    console.error('❌ Error in repairClientAggregates:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError(
      'internal',
      `שגיאה ב-repair: ${error.message}`
    );
  }
});

/**
 * Compare two aggregate snapshots. True if equal within TOLERANCE for
 * numeric fields and strict equality for booleans.
 */
function aggregatesEqual(a, b) {
  if (!a || !b) return false;
  const numericFields = [
    'totalHours',
    'hoursUsed',
    'hoursRemaining',
    'minutesUsed',
    'minutesRemaining'
  ];
  for (const field of numericFields) {
    const av = typeof a[field] === 'number' ? a[field] : 0;
    const bv = typeof b[field] === 'number' ? b[field] : 0;
    if (Math.abs(av - bv) > TOLERANCE) return false;
  }
  if ((a.isBlocked === true) !== (b.isBlocked === true)) return false;
  if ((a.isCritical === true) !== (b.isCritical === true)) return false;
  return true;
}

// Exported for unit testing only.
exports._test = {
  computeCanonical,
  diffFields,
  aggregatesEqual,
  SKIP_CLIENTS,
  TOLERANCE
};
