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

  /**
   * H.6.c-3: builds a Hebrew explanation of a FAILED/borderline signature verdict
   * from the two presence booleans ONLY — NEVER the model's free-text `reasoning`
   * (the CF never returns it on a failed verdict, and this function never accepts
   * it as a parameter, so there is nothing to leak here by construction).
   */
  function signatureFailureMessage(verdict) {
    const v = verdict || {};
    const clientOk = v.clientSignaturePresent === true;
    const lawyerOk = v.lawyerSignaturePresent === true;
    if (!clientOk && !lawyerOk) {
      return 'בדיקת החתימה לא זיהתה חתימת לקוח וחתימת עורך דין במסמך.';
    }
    if (!clientOk) {
      return 'בדיקת החתימה לא זיהתה חתימת לקוח במסמך.';
    }
    if (!lawyerOk) {
      return 'בדיקת החתימה לא זיהתה חתימת עורך דין במסמך.';
    }
    return 'בדיקת החתימה לא עברה את סף הביטחון הנדרש.';
  }

  /**
   * H.6.c-3: Hebrew message-by-HttpsError-code for releaseClientFromPendingSignature
   * failures (mirrors the ProfitabilityPage / EmployeeCostsPage pattern). NEVER a
   * raw FirebaseError / English / stack trace.
   */
  function releaseErrorMessage(error) {
    const code = error && error.code ? String(error.code) : '';
    switch (code) {
      case 'unauthenticated':
      case 'functions/unauthenticated':
        return 'נדרשת התחברות מחדש למערכת. אנא התחבר ונסה שוב.';
      case 'permission-denied':
      case 'functions/permission-denied':
        return 'אין לך הרשאה לאשר לקוח לאחר בדיקת חתימה. רק מנהל מערכת רשאי.';
      case 'not-found':
      case 'functions/not-found':
        return 'הלקוח או רשומת ההמתנה לחתימה לא נמצאו.';
      case 'failed-precondition':
      case 'functions/failed-precondition': {
        const msg = error && error.message;
        return typeof msg === 'string' && /[֐-׿]/.test(msg)
          ? msg
          : 'לא ניתן לשחרר את הלקוח כעת. יש לבדוק את פרטי הלקוח.';
      }
      case 'unavailable':
      case 'functions/unavailable':
      case 'deadline-exceeded':
      case 'functions/deadline-exceeded':
        return 'השרת אינו זמין כעת. בדוק את החיבור לאינטרנט ונסה שוב.';
      default: {
        const m = error && error.message;
        if (typeof m === 'string' && /[֐-׿]/.test(m)) {
          return m;
        }
        return 'אירעה שגיאה בעת אישור הלקוח. אנא נסה שוב או פנה לתמיכה.';
      }
    }
  }

  const api = {
    formatAmount: formatAmount,
    formatDate: formatDate,
    signatureFailureMessage: signatureFailureMessage,
    releaseErrorMessage: releaseErrorMessage,
    MISSING: MISSING
  };

  if (typeof window !== 'undefined') {
    window.PendingClientsFormat = api;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
