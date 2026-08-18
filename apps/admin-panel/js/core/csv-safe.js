/**
 * csv-safe.js — shared SSOT encoder for CSV/Excel cell values (OWASP CSV /
 * Formula Injection defense). Admin-panel exports build CSVs that an admin opens
 * in Excel / Google Sheets; a cell whose value STARTS with a formula trigger
 * (= + - @) or a control char (TAB 0x09 / CR 0x0D / LF 0x0A) is EVALUATED as a
 * formula by the spreadsheet → data exfiltration / command execution.
 * `cell(value)` neutralizes it by prefixing a single quote — the spreadsheet
 * "force text" marker — so the value renders as inert text, never a live formula.
 *
 * Two independent layers — the CALLER still wraps the returned string in "...":
 *   1. OWASP formula-injection — leading-trigger → prefix `'`. The outer RFC-4180
 *      transport quotes do NOT defeat this: the spreadsheet's CSV parser strips
 *      the transport "..." BEFORE the cell reaches the formula engine, and the
 *      leading `'` then marks the field as text. Order is load-bearing: prefix
 *      FIRST, then quote-double (the `'` is part of the logical value at pos 0).
 *   2. RFC-4180 — double any embedded double-quote.
 *
 * Returns the INNER cell content (NOT wrapped in "..."), matching the contract the
 * existing inline encoders use (the caller adds the transport quotes), so the
 * sibling ReportGenerator.csvCell (PR-SEC-3) can later delegate here unchanged.
 *
 * Trigger set /^[=+\-@\t\r\n]/ is a strict SUPERSET of PR-SEC-3's inline copy
 * (adds LF 0x0A for parity with CR). The future CSV-dedup follow-up routes the
 * LIVE sinks — ReportGenerator, ClientsTable, DataManager — through THIS one
 * canonical home (tracked separately; out of scope for this PR).
 *
 * Pattern mirrors js/core/budget-status.js (classic <script> load + dual-export).
 * Created: 2026-06-17 — security/sms-csv-injection (PR-SMS-CSV-INJECTION).
 */
(function () {
  'use strict';

  // OWASP formula-injection triggers: = + - @ , plus TAB / CR / LF control chars.
  // Anchored to the FIRST char — only the leading char drives the formula engine.
  // (`\-` is an escaped literal hyphen inside the class, not a range.)
  const FORMULA_TRIGGER = /^[=+\-@\t\r\n]/;

  /**
   * Neutralize one value for safe inclusion inside a CSV cell. The caller is
   * responsible for the outer "..." transport quoting.
   * @param {*} value raw cell value (any type; null/undefined → '')
   * @returns {string} inner cell content (formula-guarded + quote-doubled, NOT wrapped)
   */
  function cell(value) {
    const s = String(value === undefined || value === null ? '' : value);
    const neutralized = FORMULA_TRIGGER.test(s) ? "'" + s : s;
    return neutralized.replace(/"/g, '""');
  }

  const api = { cell: cell };

  // Expose to window — admin-panel pattern (classic <script> load).
  if (typeof window !== 'undefined') {
    window.CsvSafe = api;
  }

  // CommonJS export — for vitest tests under Node.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
