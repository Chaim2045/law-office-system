/**
 * reconciliation-format.js — pure render-decision helpers for the OWN-3 "סנכרון
 * שעות" (Hours Reconciliation) admin control page. NO DOM, NO Firebase — the
 * LOAD-BEARING display rules (mode labels, run-row display strings, run status
 * level, client-side sort) are extracted here so they are unit-tested directly.
 * Dual-export: window.ReconciliationFormat + CommonJS (so
 * tests/unit/admin-panel/reconciliation-format.test.ts can require it).
 *
 * ─── Backend contract (#401, LIVE — do not re-derive) ────────────────────────
 *  Mode flag doc system_settings/package_reconciliation.mode ∈
 *    {'off','dry_run','enforce'} (missing doc → treat as 'off', fail-safe).
 *  Recent runs: audit_log where action=='PACKAGE_RECONCILE_RUN'. Each doc:
 *    { action, userId, username, timestamp, details:{ mode, clientsScanned,
 *      servicesScanned, repaired, wouldRepair, skipped, blockFlipsDeferred,
 *      invariantFailures, failed, scanErrors, netHoursDelta, deferrals:[...],
 *      deferralsCount, schemaVersion } }.
 *
 * NOTE: this module formats NON-PII operational metadata (modes / counts / ids
 * only). The reconciliation run docs never carry clientName — only clientId /
 * serviceId (a non-PII business id), so nothing here touches §7.6 cost PII.
 */
(function () {
  'use strict';

  const VALID_MODES = ['off', 'dry_run', 'enforce'];

  // Hebrew mode labels (the literal mode VALUES stay English — they are the
  // backend contract; only the DISPLAY is Hebrew).
  const MODE_LABELS = {
    off: 'כבוי',
    dry_run: 'צפייה (ללא כתיבה)',
    enforce: 'תיקון (כותב לפרודקשן)'
  };

  // Short labels for the dense runs table (one cell per row).
  const MODE_LABELS_SHORT = {
    off: 'כבוי',
    dry_run: 'צפייה',
    enforce: 'תיקון'
  };

  function isFiniteNum(v) {
    return typeof v === 'number' && isFinite(v);
  }

  function isValidMode(mode) {
    return VALID_MODES.indexOf(mode) !== -1;
  }

  /** Full Hebrew label for a mode. Unknown → 'לא ידוע'. */
  function modeLabel(mode) {
    return MODE_LABELS[mode] || 'לא ידוע';
  }

  /** Short Hebrew label for a mode (runs table). Unknown → 'לא ידוע'. */
  function modeLabelShort(mode) {
    return MODE_LABELS_SHORT[mode] || 'לא ידוע';
  }

  /** Integer with thousands grouping, e.g. 1234 -> "1,234". null/non-finite -> '0'. */
  function formatInt(v) {
    if (!isFiniteNum(v)) {
      return '0';
    }
    const rounded = Math.round(v);
    const sign = rounded < 0 ? '-' : '';
    const digits = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return sign + digits;
  }

  /**
   * Net hours delta — a SIGNED hours number (the loop's running sum of every
   * repaired service's after-before). +0.0 for a clean run. 1-decimal, explicit
   * sign so "+1.5h fixed" vs "-2.0h fixed" reads at a glance. null -> "0.0".
   */
  function formatHoursDelta(v) {
    if (!isFiniteNum(v)) {
      return '0.0';
    }
    const rounded = Math.round(v * 10) / 10;
    const sign = rounded > 0 ? '+' : (rounded < 0 ? '' : ''); // negative carries its own '-'
    return sign + rounded.toFixed(1);
  }

  /**
   * runStatusLevel — the row color signal for a run.
   *  - failed > 0 OR invariantFailures > 0          -> 'error'   (a write failed / a service couldn't be safely repaired)
   *  - blockFlipsDeferred > 0 OR scanErrors > 0      -> 'warning' (something needs a human look, but nothing failed)
   *  - otherwise                                     -> 'ok'      (clean)
   * Reads defensively (missing field treated as 0).
   * @param {object} details
   * @returns {'ok'|'warning'|'error'}
   */
  function runStatusLevel(details) {
    const d = details || {};
    const failed = isFiniteNum(d.failed) ? d.failed : 0;
    const invariantFailures = isFiniteNum(d.invariantFailures) ? d.invariantFailures : 0;
    const blockFlipsDeferred = isFiniteNum(d.blockFlipsDeferred) ? d.blockFlipsDeferred : 0;
    const scanErrors = isFiniteNum(d.scanErrors) ? d.scanErrors : 0;
    if (failed > 0 || invariantFailures > 0) {
      return 'error';
    }
    if (blockFlipsDeferred > 0 || scanErrors > 0) {
      return 'warning';
    }
    return 'ok';
  }

  /** Hebrew label for a run status level. */
  function runStatusLabel(level) {
    switch (level) {
      case 'error':
        return 'נכשל';
      case 'warning':
        return 'דורש בדיקה';
      default:
        return 'תקין';
    }
  }

  /**
   * formatRunRow — the full set of display strings for ONE run's table row.
   * Pure: takes the audit doc's `details` (+ a Date for the timestamp) and
   * returns ready-to-render strings + the status level. The number that was
   * actually WRITTEN depends on mode: in dry_run nothing is written (wouldRepair
   * counts the candidates); in enforce `repaired` is the real write count.
   * @param {object} details  the audit_log doc `details`
   * @returns {{
   *   mode:string, modeLabel:string, clientsScanned:string, servicesScanned:string,
   *   wouldRepair:string, repaired:string, failed:string, invariantFailures:string,
   *   blockFlipsDeferred:string, scanErrors:string, netHoursDelta:string,
   *   deferralsCount:string, level:'ok'|'warning'|'error', levelLabel:string }}
   */
  function formatRunRow(details) {
    const d = details || {};
    const level = runStatusLevel(d);
    const deferralsCount = isFiniteNum(d.deferralsCount)
      ? d.deferralsCount
      : (Array.isArray(d.deferrals) ? d.deferrals.length : 0);
    return {
      mode: d.mode || '',
      modeLabel: modeLabelShort(d.mode),
      clientsScanned: formatInt(d.clientsScanned),
      servicesScanned: formatInt(d.servicesScanned),
      wouldRepair: formatInt(d.wouldRepair),
      repaired: formatInt(d.repaired),
      failed: formatInt(d.failed),
      invariantFailures: formatInt(d.invariantFailures),
      blockFlipsDeferred: formatInt(d.blockFlipsDeferred),
      scanErrors: formatInt(d.scanErrors),
      netHoursDelta: formatHoursDelta(d.netHoursDelta),
      deferralsCount: formatInt(deferralsCount),
      level: level,
      levelLabel: runStatusLabel(level)
    };
  }

  /**
   * sortRunsDesc — client-side sort of the PACKAGE_RECONCILE_RUN docs by
   * `timestamp` DESCENDING (newest first). ⚠️ The page does NOT use Firestore
   * .orderBy() (would need a composite index) — it fetches the matching docs and
   * sorts here. `timestamp` is a Firestore Timestamp ({seconds,nanoseconds} or a
   * .toMillis()/.toDate() object) OR a raw millis number OR an ISO/Date string —
   * this normalizes all of them. Returns a NEW array (does not mutate input).
   * Docs with an unreadable timestamp sort last (treated as 0).
   * @param {Array<{timestamp?:any}>} docs
   * @returns {Array}
   */
  function sortRunsDesc(docs) {
    if (!Array.isArray(docs)) {
      return [];
    }
    return docs.slice().sort(function (a, b) {
      return tsToMillis(b && b.timestamp) - tsToMillis(a && a.timestamp);
    });
  }

  /** Normalize any Firestore-ish timestamp to millis. Unreadable -> 0. */
  function tsToMillis(ts) {
    if (ts === null || ts === undefined) {
      return 0;
    }
    if (typeof ts === 'number') {
      return isFinite(ts) ? ts : 0;
    }
    if (typeof ts.toMillis === 'function') {
      try {
        const m = ts.toMillis();
        return isFinite(m) ? m : 0;
      } catch (e) {
        return 0;
      }
    }
    if (typeof ts.toDate === 'function') {
      try {
        const t = ts.toDate().getTime();
        return isFinite(t) ? t : 0;
      } catch (e) {
        return 0;
      }
    }
    if (typeof ts.seconds === 'number') {
      const ms = ts.seconds * 1000 + (typeof ts.nanoseconds === 'number' ? Math.floor(ts.nanoseconds / 1e6) : 0);
      return isFinite(ms) ? ms : 0;
    }
    // ISO string / Date-parseable.
    const parsed = new Date(ts).getTime();
    return isFinite(parsed) ? parsed : 0;
  }

  /**
   * formatDeferral — display fields for one deferred block-flip (NON-PII).
   * A deferral is { clientId, serviceId, serviceBefore?, serviceAfter? }. We show
   * ONLY the ids + the before/after hours (never a name). Missing id -> '—'.
   * @returns {{ clientId:string, serviceId:string, before:string, after:string }}
   */
  function formatDeferral(deferral) {
    const d = deferral || {};
    return {
      clientId: d.clientId !== null && d.clientId !== undefined && d.clientId !== '' ? String(d.clientId) : '—',
      serviceId: d.serviceId !== null && d.serviceId !== undefined && d.serviceId !== '' ? String(d.serviceId) : '—',
      before: isFiniteNum(d.serviceBefore) ? formatHoursValue(d.serviceBefore) : '—',
      after: isFiniteNum(d.serviceAfter) ? formatHoursValue(d.serviceAfter) : '—'
    };
  }

  /** Plain 1-decimal hours (no sign), for the before/after columns. */
  function formatHoursValue(v) {
    if (!isFiniteNum(v)) {
      return '—';
    }
    return (Math.round(v * 10) / 10).toFixed(1);
  }

  const api = {
    VALID_MODES: VALID_MODES,
    isValidMode: isValidMode,
    modeLabel: modeLabel,
    modeLabelShort: modeLabelShort,
    formatInt: formatInt,
    formatHoursDelta: formatHoursDelta,
    formatHoursValue: formatHoursValue,
    runStatusLevel: runStatusLevel,
    runStatusLabel: runStatusLabel,
    formatRunRow: formatRunRow,
    sortRunsDesc: sortRunsDesc,
    formatDeferral: formatDeferral
  };

  // Expose to window — admin-panel pattern (classic <script> load).
  if (typeof window !== 'undefined') {
    window.ReconciliationFormat = api;
  }

  // CommonJS export — for vitest tests under Node.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
