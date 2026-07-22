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

  // PR-IG-A1-FIX1 (2026-07-22, adversarial-review response): the deployed bot
  // formatter (hachnasovitz/system-reports/formatter.js) reads exactly six
  // fields — createdAt, severity, source, discrepanciesCount, discrepancies,
  // healthCheckDocId. It does NOT read healthCheckStatus/healthCheckMessage/
  // clientsScanErrored/clientsScanChecked/clientsTotal — every field PR-IG-A1
  // added. So a PARTIAL or ERROR run (0% or partial data examined) with
  // discrepanciesCount===0 would render "📊 0 פערים זוהו" (0 gaps / all
  // clean) and still print the fixed "run auditClientAggregates /
  // repairClientAggregates" footer — the WhatsApp alert would say the
  // opposite of the truth on exactly the two statuses this PR exists to
  // surface.
  //
  // Verified in formatter.js before choosing this mechanism:
  //   - `count = data.discrepanciesCount || (data.discrepancies||[]).length || 0`
  //     — when discrepanciesCount is 0 (falsy), the fallback is the ARRAY
  //     LENGTH, not literal 0. So an item appended to the array (without
  //     touching discrepanciesCount) flips a "0 gaps" render to non-zero.
  //   - `formatItem()`'s `default:` branch renders ANY unrecognized `type` as
  //     `JSON.stringify(d)` instead of dropping it, and `groupByType()`
  //     labels an unrecognized type with the raw string (`TYPE_LABEL[t] || t`)
  //     — so a synthetic, non-PII entry is guaranteed to render as a visible
  //     group, not silently discarded.
  // This confirms the reviewer's suggested mechanism actually renders on the
  // bot exactly as deployed today — chosen over alternatives (e.g. inflating
  // discrepanciesCount itself) because that would violate "must not corrupt
  // discrepanciesCount for real discrepancies": leaving discrepanciesCount
  // untouched means a PARTIAL-with-real-discrepancies run still shows its
  // true count on the summary line; only the truthful zero-count case is
  // affected, via the array-length fallback above.
  //
  // Applies to every non-FAIL status (PARTIAL, ERROR, and any future status
  // that isn't exactly 'FAIL') — a genuine FAIL run's discrepancies array is
  // untouched, so its payload is byte-identical to pre-fix behavior.
  //
  // FOLLOW-UP (cross-repo, not in this PR): the proper fix is for the bot's
  // formatter.js to read healthCheckStatus/healthCheckMessage directly and
  // render its own PARTIAL/ERROR-specific message instead of relying on this
  // synthetic discrepancies[] entry. That requires a hachnasovitz-repo change
  // + manual SSH deploy, tracked separately — this PR only makes the payload
  // truthful against the bot AS CURRENTLY DEPLOYED.
  const outboxDiscrepancies = discrepancies.slice();
  if (healthStatus !== 'FAIL') {
    outboxDiscrepancies.push({
      type: 'scan_incomplete',
      healthCheckStatus: healthStatus,
      clientsScanChecked: typeof data.clientsScanChecked === 'number' ? data.clientsScanChecked : null,
      clientsScanErrored: typeof data.clientsScanErrored === 'number' ? data.clientsScanErrored : null,
      clientsTotal: typeof data.clientsTotal === 'number' ? data.clientsTotal : null,
      message: typeof data.message === 'string' ? data.message : null
    });
  }

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
      // PR-IG-A1-FIX1: outboxDiscrepancies, not the raw `discrepancies` — see
      // above. The source `system_health_checks` doc (`data`) is never
      // mutated; this array only exists on the outbox doc the bot reads.
      discrepancies: outboxDiscrepancies,
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
