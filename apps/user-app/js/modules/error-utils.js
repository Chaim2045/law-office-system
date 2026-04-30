/**
 * Error Utilities — שימור error.details אחרי FirebaseService wrapping
 *
 * Backend (functions/shared/errors.js → buildAppError) מצרף envelope לכל HttpsError:
 *   error.details = { code, userMessage, devMessage, ...payload }
 *
 * FirebaseService מסיר את ה-Error המקורי ומחזיר { success, error, errorDetails }.
 * כדי ש-ui-components.js handler יוכל לחלץ code + userMessage, צריך לזרוק Error
 * שעדיין נושא details. ה-helper הזה בונה Error כזה.
 *
 * @module apps/user-app/js/modules/error-utils
 */

/**
 * Build an Error from a FirebaseService failure result that preserves backend details.
 *
 * @param {Object} result - FirebaseService response ({ success: false, error, errorDetails })
 * @param {string} fallbackMessage - Fallback if neither result.error nor result.message exists
 * @returns {Error} Error with .details = result.errorDetails (if present)
 */
export function buildErrorFromResult(result, fallbackMessage = 'שגיאה לא ידועה') {
  const message = (result && (result.message || result.error)) || fallbackMessage;
  const err = new Error(message);
  if (result && result.errorDetails) {
    err.details = result.errorDetails;
  }
  return err;
}
