/**
 * Unit tests — PendingClientsFormat (H.6 PR2)
 * ───────────────────────────────────────────
 * The load-bearing display rules of the Pending Clients page as pure functions
 * (no DOM/Firebase): money renders grouped with a ₪ prefix, and a MISSING value
 * (null/undefined/NaN) renders "—" — NEVER "₪0" / "₪NaN". This is the customer
 * scenario (G4): "a sale with a missing amount shows —, and a real amount shows
 * a grouped ₪ figure that matches the confirm dialog".
 */
import { describe, it, expect } from 'vitest';

// @ts-ignore — CommonJS require from a TypeScript ESM test (dual-export module).
import {
  formatAmount,
  formatDate,
  signatureFailureMessage,
  releaseErrorMessage,
  MISSING
} from '../../../apps/admin-panel/js/core/pending-clients-format.js';

describe('formatAmount — missing ≠ ₪0 (the #1 render rule)', () => {
  it('null → "—" (NEVER ₪0 / ₪NaN)', () => {
    expect(formatAmount(null)).toBe(MISSING);
  });

  it('undefined → "—"', () => {
    expect(formatAmount(undefined)).toBe(MISSING);
  });

  it('NaN → "—"', () => {
    expect(formatAmount(NaN)).toBe(MISSING);
  });

  it('a real 0 → "₪0" (a KNOWN amount, distinct from missing)', () => {
    expect(formatAmount(0)).toBe('₪0');
  });
});

describe('formatAmount — grouped ₪ (deterministic, no ICU dependency)', () => {
  it('groups thousands with a comma', () => {
    expect(formatAmount(8260)).toBe('₪8,260');
  });

  it('preserves agorot and trims trailing zeros', () => {
    expect(formatAmount(9747.15)).toBe('₪9,747.15');
    expect(formatAmount(8260.3)).toBe('₪8,260.3');
  });

  it('groups millions', () => {
    expect(formatAmount(1234567)).toBe('₪1,234,567');
  });

  it('handles a negative amount', () => {
    expect(formatAmount(-8260)).toBe('-₪8,260');
  });
});

describe('formatDate — DD/MM/YYYY, TZ-independent', () => {
  it('a full ISO timestamp → DD/MM/YYYY from the date portion', () => {
    expect(formatDate('2026-05-28T10:30:00.000Z')).toBe('28/05/2026');
  });

  it('a date-only ISO string → DD/MM/YYYY', () => {
    expect(formatDate('2026-12-01')).toBe('01/12/2026');
  });

  it('empty string → "—"', () => {
    expect(formatDate('')).toBe(MISSING);
  });

  it('a non-date string → "—"', () => {
    expect(formatDate('not-a-date')).toBe(MISSING);
  });
});

describe('signatureFailureMessage — H.6.c-3, NEVER the model reasoning (booleans only)', () => {
  it('both missing → a combined Hebrew message', () => {
    expect(signatureFailureMessage({ clientSignaturePresent: false, lawyerSignaturePresent: false }))
      .toBe('בדיקת החתימה לא זיהתה חתימת לקוח וחתימת עורך דין במסמך.');
  });

  it('only client missing', () => {
    expect(signatureFailureMessage({ clientSignaturePresent: false, lawyerSignaturePresent: true }))
      .toBe('בדיקת החתימה לא זיהתה חתימת לקוח במסמך.');
  });

  it('only lawyer missing', () => {
    expect(signatureFailureMessage({ clientSignaturePresent: true, lawyerSignaturePresent: false }))
      .toBe('בדיקת החתימה לא זיהתה חתימת עורך דין במסמך.');
  });

  it('both present but confidence below threshold', () => {
    expect(signatureFailureMessage({ clientSignaturePresent: true, lawyerSignaturePresent: true }))
      .toBe('בדיקת החתימה לא עברה את סף הביטחון הנדרש.');
  });

  it('accepts no `reasoning` field at all — the function signature has no such parameter', () => {
    // The verdict shape only ever carries the two booleans + confidence; passing
    // an extra reasoning field (as a defensive caller might) must not surface it.
    const msg = signatureFailureMessage({
      clientSignaturePresent: false,
      lawyerSignaturePresent: true,
      // @ts-expect-error — extra field the CF never sends on a failed verdict
      reasoning: 'PII-SENTINEL-SHOULD-NEVER-APPEAR'
    });
    expect(msg).not.toContain('PII-SENTINEL-SHOULD-NEVER-APPEAR');
  });
});

describe('releaseErrorMessage — Hebrew, by HttpsError code, never a raw FirebaseError', () => {
  it('permission-denied', () => {
    expect(releaseErrorMessage({ code: 'permission-denied' }))
      .toBe('אין לך הרשאה לאשר לקוח לאחר בדיקת חתימה. רק מנהל מערכת רשאי.');
  });

  it('not-found', () => {
    expect(releaseErrorMessage({ code: 'not-found' }))
      .toBe('הלקוח או רשומת ההמתנה לחתימה לא נמצאו.');
  });

  it('failed-precondition with a Hebrew server message passes it through', () => {
    expect(releaseErrorMessage({ code: 'failed-precondition', message: 'סכום העסקה שונה.' }))
      .toBe('סכום העסקה שונה.');
  });

  it('failed-precondition with no Hebrew message falls back to a generic Hebrew line', () => {
    expect(releaseErrorMessage({ code: 'failed-precondition', message: 'FirebaseError: 9 FAILED_PRECONDITION' }))
      .toBe('לא ניתן לשחרר את הלקוח כעת. יש לבדוק את פרטי הלקוח.');
  });

  it('unavailable', () => {
    expect(releaseErrorMessage({ code: 'unavailable' }))
      .toBe('השרת אינו זמין כעת. בדוק את החיבור לאינטרנט ונסה שוב.');
  });

  it('unknown code with no message → generic Hebrew fallback (never English/stack)', () => {
    const msg = releaseErrorMessage({ code: 'internal', message: 'Error: boom at foo.js:12:3' });
    expect(msg).toBe('אירעה שגיאה בעת אישור הלקוח. אנא נסה שוב או פנה לתמיכה.');
  });
});
