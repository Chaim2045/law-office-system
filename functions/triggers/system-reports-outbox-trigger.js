/**
 * System Reports Outbox Trigger — PR-C.2-fns (2026-05-18)
 *
 * Fires on every `system_health_checks` document creation. Writes a
 * `system_reports_outbox` doc that the hachnasovitz WhatsApp bot consumes
 * (PR-C.2-bot) and forwards to the "דיווחי מערכת" group.
 *
 * PR-IG-A1 (2026-07-22) — BEHAVIORAL CHANGE: widened from "FAIL with
 * discrepancies > 0" to "any status !== 'PASS'" (FAIL / PARTIAL / ERROR all
 * emit now). Before this change, a FAIL with zero discrepancies (an internal
 * consistency signal) and every ERROR (a crashed run) were silently dropped —
 * the two defects that made a crashed or partial nightly scan indistinguishable
 * from a healthy one. See `functions/scheduled/index.js` `dailyInvariantCheck`
 * for the producing side of this contract.
 *
 * PR-IG-A1-FIX1 (2026-07-22) injected a synthetic `scan_incomplete` entry into
 * this doc's `discrepancies[]` array on any non-FAIL status, as a workaround
 * for the bot's formatter not reading the new census fields. REMOVED
 * (2026-07-22, follow-up): the bot-side fix has shipped and is LIVE in
 * production (`hachnasovitz` repo, `system-reports/formatter.js`) — it now
 * reads `healthCheckStatus`/`healthCheckMessage`/`clientsScanChecked`/
 * `clientsScanErrored`/`clientsTotal` directly and renders proper Hebrew for
 * PARTIAL/ERROR, and defensively filters out any stray `scan_incomplete`
 * entry. The workaround was also independently found harmful on its own terms
 * (round-2 review): it produced a nonzero gap count where zero gaps existed,
 * printed an English type key + a JSON.stringify blob into a Hebrew RTL
 * message, and pushed a raw English exception string into the group. The
 * outbox document's `discrepancies` array below is now exactly what the
 * health-check document held — no injection, no mutation.
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

  // PR-IG-A1: emit on any status !== 'PASS' — FAIL (with or without
  // discrepancies), PARTIAL, and ERROR all reach the outbox now. Only a clean
  // PASS is silent.
  const healthStatus = data.status;
  const discrepanciesCount = typeof data.discrepanciesCount === 'number'
    ? data.discrepanciesCount
    : Array.isArray(data.discrepancies) ? data.discrepancies.length : 0;

  if (healthStatus === 'PASS') {
    console.log(`[system-reports-outbox] ${docId} status=PASS — no outbox write`);
    return null;
  }

  const discrepancies = Array.isArray(data.discrepancies) ? data.discrepancies : [];
  // ERROR (a crashed run) is the more urgent case for whoever reads severity.
  const severity = healthStatus === 'ERROR' ? 'critical' : 'warning';

  try {
    const outboxRef = await db.collection('system_reports_outbox').add({
      type: 'system_health_check',
      severity,
      source: 'dailyInvariantCheck',
      healthCheckDocId: docId,
      // PR-IG-A1: additive context so the bot can distinguish "the data is
      // dirty" from "the scan itself was incomplete/crashed". IMPORTANT: this
      // is the health-check's own status (PASS/FAIL/PARTIAL/ERROR) — do NOT
      // confuse with the outbox delivery-lifecycle `status` field below
      // ('pending'/'sent'/'failed'), which the bot queries on and which stays
      // byte-identical to preserve the existing consumption contract.
      //
      // PR-IG-A1-FIX6 (2026-07-22, adversarial-review response): guarded like
      // its four immediate siblings below. `admin.initializeApp()` sets no
      // `ignoreUndefinedProperties`, so an undefined healthStatus would make
      // this whole `.add()` reject and the alert would be lost entirely —
      // latent today (only one writer exists) but exactly the class the
      // widened non-PASS predicate opens up.
      healthCheckStatus: typeof healthStatus === 'string' ? healthStatus : null,
      discrepanciesCount,
      // Exactly what the health-check document held — no injection, no
      // mutation (see the FIX1-removal note in the file header). The source
      // `system_health_checks` doc (`data`) is never mutated either way.
      discrepancies,
      clientsScanErrored: typeof data.clientsScanErrored === 'number' ? data.clientsScanErrored : null,
      clientsScanChecked: typeof data.clientsScanChecked === 'number' ? data.clientsScanChecked : null,
      clientsTotal: typeof data.clientsTotal === 'number' ? data.clientsTotal : null,
      // PR-IG-A1-FIX5: passthrough of the capped errored-client-id list — ids
      // only, no names.
      clientsScanErroredIds: Array.isArray(data.clientsScanErroredIds) ? data.clientsScanErroredIds : [],
      healthCheckMessage: typeof data.message === 'string' ? data.message : null,
      status: 'pending',
      attempts: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      sentAt: null,
      errorMessage: null
    });

    console.log(`[system-reports-outbox] ${docId} ${healthStatus} × ${discrepanciesCount} → outbox/${outboxRef.id}`);
  } catch (err) {
    console.error(`[system-reports-outbox] Failed to write outbox for ${docId}:`, err);
    throw err; // let Cloud Functions retry
  }

  return null;
});

module.exports = {
  onSystemHealthCheckCreated
};
