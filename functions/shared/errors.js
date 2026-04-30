/**
 * Error Helper — שגיאות אפליקציה עם קוד יציב והודעה ידידותית למשתמש
 *
 * Source of truth: functions/shared/errors.js
 *
 * Backward compatibility (CRITICAL):
 *   - HttpsError.message stays IDENTICAL to legacy text — old clients (quick-log.js,
 *     admin panel, future integrations) keep parsing the same string.
 *   - HttpsError.details adds envelope: { code, userMessage, devMessage, ...payload }
 *     New clients (ActionFlowManager) read `userMessage` for friendlier UX +
 *     `code` for ERR-XXXX badge.
 *   - String-matching tests (`expect.stringContaining('בחריגה')`) keep passing
 *     because legacy `message` is unchanged.
 *
 * @module functions/shared/errors
 */

const functions = require('firebase-functions');

/**
 * Catalog of stable error codes.
 * Format: ERR-XXXX
 * - 1xxx = client/billing
 * - 2xxx = task lifecycle
 * - 3xxx = timesheet
 * - 9xxx = system
 *
 * Each spec carries:
 *   - code:        stable identifier (never changes once assigned)
 *   - httpsCode:   Firebase HttpsError code
 *   - message:     legacy backend message (kept identical for backward compat)
 *   - userMessage: friendly text for UI (richer than message)
 */
const ERROR_CODES = {
  CLIENT_OVERDRAFT_SOFT: {
    code: 'ERR-1001',
    httpsCode: 'resource-exhausted',
    message: 'הלקוח בחריגה נא לעדכן בהקדם את גיא',
    userMessage: 'הלקוח חרג ממכסת השעות. נא לפנות לגיא לעדכון החבילה לפני המשך רישום השעות.'
  },
  CLIENT_OVERDRAFT_SEVERE: {
    code: 'ERR-1002',
    httpsCode: 'resource-exhausted',
    message: 'הלקוח בחריגה חמורה — כל החבילות מוצו מעבר למגבלה',
    userMessage: 'הלקוח בחריגה חמורה — כל החבילות מוצו מעבר למגבלה. נא לפנות לגיא לעדכון.'
  },
  CLIENT_OVERDRAFT_EDIT: {
    code: 'ERR-1003',
    httpsCode: 'resource-exhausted',
    message: 'הלקוח בחריגה — העריכה תגרום לחריגה מעבר למגבלת -10 שעות',
    userMessage: 'העריכה תגרום לחריגה מעבר למגבלה המותרת. נא לפנות לגיא לעדכון החבילה.'
  }
};

/**
 * Build app error with stable code + friendly message.
 *
 * @param {Object} spec - Error spec (use ERROR_CODES.X)
 * @param {string} spec.code - Stable code (ERR-XXXX)
 * @param {string} spec.httpsCode - Firebase HttpsError code
 * @param {string} spec.message - Legacy backend message (HttpsError.message)
 * @param {string} spec.userMessage - User-facing Hebrew message (in details)
 * @param {Object} [payload] - Additional context for logs/details
 * @returns {functions.https.HttpsError}
 */
function buildAppError(spec, payload = {}) {
  if (!spec || !spec.code || !spec.httpsCode || !spec.message || !spec.userMessage) {
    throw new Error('buildAppError: invalid spec');
  }

  const details = Object.assign(
    {
      code: spec.code,
      userMessage: spec.userMessage,
      devMessage: payload.devMessage || spec.message
    },
    payload
  );

  return new functions.https.HttpsError(
    spec.httpsCode,
    spec.message,
    details
  );
}

module.exports = {
  ERROR_CODES,
  buildAppError
};