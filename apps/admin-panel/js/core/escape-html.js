/**
 * Shared HTML-escape SSOT — apps/admin-panel/js/core/escape-html.js
 *
 * The ONE canonical HTML-entity escaper for the Admin Panel. Consolidates the
 * duplicated escapeHtml / escapeHTML / _escapeHtml copies (escapeHtml SSOT dedup,
 * 3-PR plan — this is PR1, the string-replace → innerHTML family) into a single
 * 5-entity escaper exposed as `window.escapeHtml`.
 *
 * Escapes & < > " ' → &amp; &lt; &gt; &quot; &#039; — safe for HTML TEXT and for
 * quoted ATTRIBUTE values. NOT URL/CSS-safe (no `javascript:` protection) — never
 * use it for href / src / style / inline-event sinks.
 *
 * Guard: null / undefined → '' (only). A literal 0 / false is escaped to its
 * string form, NOT blanked — the stricter, safer guard (vs the `if (!text)` form
 * some copies used, which silently dropped a legitimate 0).
 *
 * Mirrors the js/core/ encoder pattern (csv-safe.js / budget-status.js):
 * classic IIFE + window global + a module.exports guard so vitest can import it.
 */
(function () {
  'use strict';

  const MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };

  function escapeHtml(text) {
    if (text === null || text === undefined) {
      return '';
    }
    return String(text).replace(/[&<>"']/g, function (ch) {
      return MAP[ch];
    });
  }

  if (typeof window !== 'undefined') {
    window.escapeHtml = escapeHtml;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { escapeHtml: escapeHtml };
  }
})();
