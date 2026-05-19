/**
 * System Reports Outbox Trigger — PR-C.2-fns (2026-05-18)
 *
 * Fires on every `system_health_checks` document creation. If the health
 * check reports a FAIL (discrepancies > 0), writes a `system_reports_outbox`
 * doc that the hachnasovitz WhatsApp bot consumes (PR-C.2-bot) and forwards
 * to the "דיווחי מערכת" group.
 *
 * Why outbox (not HTTP webhook):
 *   The bot already connects to law-office-system Firestore (via service
 *   account in `daily-reports/law-office-key.json`, read-only). Extending
 *   that connection to read+write on `system_reports_outbox` is simpler
 *   than exposing a new HTTP endpoint:
 *     • Durable — bot restart preserves pending docs
 *     • Idempotent via status field
 *     • Retryable via attempts counter
 *     • Auditable — full history persisted
 *     • No new ports / firewall / auth-token rotation
 *
 * Bot consumption pattern (PR-C.2-bot):
 *   1. Listen on `system_reports_outbox` where `status == 'pending'`
 *   2. Format Hebrew message from `discrepancies[]`
 *   3. Send to WhatsApp group "דיווחי מערכת"
 *   4. On success: update doc with `status: 'sent'`, `sentAt: now`
 *   5. On failure: update doc with `status: 'failed'`, `errorMessage: ...`,
 *      increment `attempts`. Can be retried by flipping back to 'pending'.
 *
 * Bot owns Hebrew formatting — this side stays generic. Future health-check
 * sources beyond `dailyInvariantCheck` can write to `system_health_checks`
 * and automatically flow through.
 *
 * Cloud Functions triggers have at-least-once delivery. Duplicate outbox
 * writes are tolerated because the bot's `status: 'pending' → sent` flip
 * is naturally idempotent — even if two outbox docs result from one health
 * check, the bot would send twice (acceptable for an alert) rather than
 * skipping silently. If duplication becomes a problem in prod, add a
 * dedup-by-source-doc-id query before write.
 */

const admin = require('firebase-admin');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');

const db = admin.firestore();

const onSystemHealthCheckCreated = onDocumentCreated({
  document: 'system_health_checks/{docId}',
  region: 'us-central1'
}, async (event) => {
  const docId = event.params.docId;
  const snap = event.data;
  if (!snap) {
    console.warn(`[system-reports-outbox] No snapshot for ${docId} — skipping`);
    return null;
  }

  const data = snap.data() || {};

  // Only emit on FAIL with non-empty discrepancies.
  const status = data.status;
  const discrepanciesCount = typeof data.discrepanciesCount === 'number'
    ? data.discrepanciesCount
    : Array.isArray(data.discrepancies) ? data.discrepancies.length : 0;

  if (status !== 'FAIL' || discrepanciesCount === 0) {
    console.log(`[system-reports-outbox] ${docId} status=${status} count=${discrepanciesCount} — no outbox write`);
    return null;
  }

  const discrepancies = Array.isArray(data.discrepancies) ? data.discrepancies : [];

  try {
    const outboxRef = await db.collection('system_reports_outbox').add({
      type: 'system_health_check',
      severity: 'warning',
      source: 'dailyInvariantCheck',
      healthCheckDocId: docId,
      discrepanciesCount,
      discrepancies,
      status: 'pending',
      attempts: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      sentAt: null,
      errorMessage: null
    });

    console.log(`[system-reports-outbox] ${docId} FAIL × ${discrepanciesCount} → outbox/${outboxRef.id}`);
  } catch (err) {
    console.error(`[system-reports-outbox] Failed to write outbox for ${docId}:`, err);
    throw err; // let Cloud Functions retry
  }

  return null;
});

module.exports = {
  onSystemHealthCheckCreated
};
