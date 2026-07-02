/**
 * pending-clients-format.js — pure display helpers for the Pending Clients page
 * (H.6 PR2). NO DOM, NO Firebase. The load-bearing display rules — money is
 * grouped with a ₪ prefix, and null/undefined/NaN render as an em-dash "—"
 * (NEVER "₪NaN" / "₪0" for a missing value) — are extracted here so the customer
 * scenario is unit-tested directly (tests/unit/admin-panel/pending-clients-format.test.ts).
 *
 * Grouping + date formatting are done manually (NOT toLocaleString) so the output
 * is deterministic across Node/browser ICU builds — the visible result is the
 * same he-IL convention (comma thousands separator, DD/MM/YYYY date).
 *
 * Dual-export: window.PendingClientsFormat (classic <script> load) + CommonJS
 * (so the vitest suite can require it under Node).
 */
(function () {
  'use strict';

  const MISSING = '—';

  /**
   * Money → grouped ₪ string, up to 2 decimals (trailing zeros trimmed).
   * null / undefined / non-finite → "—" (NEVER "₪0" / "₪NaN").
   * e.g. 8260 -> "₪8,260"; 9747.15 -> "₪9,747.15"; 0 -> "₪0".
   */
  function formatAmount(amount) {
    if (amount === null || amount === undefined) {
      return MISSING;
    }
    const n = Number(amount);
    if (!Number.isFinite(n)) {
      return MISSING;
    }
    const neg = n < 0;
    const rounded = Math.round(Math.abs(n) * 100) / 100;
    const parts = String(rounded).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + '₪' + parts.join('.');
  }

  /**
   * ISO timestamp string → DD/MM/YYYY (Israeli convention). The date portion is
   * read directly from the ISO string (TZ-independent); a non-ISO string falls
   * back to a UTC parse. Empty / invalid / non-string → "—".
   */
  function formatDate(isoString) {
    if (!isoString || typeof isoString !== 'string') {
      return MISSING;
    }
    const m = isoString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      return m[3] + '/' + m[2] + '/' + m[1];
    }
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) {
      return MISSING;
    }
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    return dd + '/' + mm + '/' + d.getUTCFullYear();
  }

  const api = {
    formatAmount: formatAmount,
    formatDate: formatDate,
    MISSING: MISSING
  };

  if (typeof window !== 'undefined') {
    window.PendingClientsFormat = api;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
