/**
 * Health-Check Status Vocabulary — shared between `dailyInvariantCheck`
 * (the producer, `functions/scheduled/index.js`) and the outbox trigger
 * (the consumer, `functions/triggers/system-reports-outbox-trigger.js`).
 *
 * PR-IG-A1 (2026-07-22) introduced the four-value vocabulary as raw string
 * literals duplicated across both files. SHOULD S2 (adversarial-review
 * follow-up) centralizes it here so a future consumer (PR-IG-B, the admin
 * screen) imports rather than re-declares — the exact class of drift this
 * module exists to prevent.
 *
 * Pure refactor: the emitted string values are byte-identical to what
 * shipped in PR-IG-A1. The external contract (the `hachnasovitz` bot's
 * `system-reports/formatter.js`, which branches on these exact strings) is
 * unaffected — see `.claude/rubrics/pr-ig-a1-truthful-run.md` G6.
 *
 * @module functions/shared/health-check-status
 */

'use strict';

/**
 * The four values a `system_health_checks` document's `status` field can
 * hold. `PASS` requires `clientsScanErrored === 0` — see the producer for
 * the full decision table.
 */
const HEALTH_CHECK_STATUS = Object.freeze({
  /** Every client was scanned, zero discrepancies found. */
  PASS: 'PASS',
  /** Every client was scanned; at least one discrepancy was found. */
  FAIL: 'FAIL',
  /** At least one client's scan phase errored — the run is incomplete. */
  PARTIAL: 'PARTIAL',
  /** The run crashed before completing (top-level catch). */
  ERROR: 'ERROR'
});

module.exports = {
  HEALTH_CHECK_STATUS
};
