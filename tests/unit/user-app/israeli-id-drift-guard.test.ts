/**
 * Cross-language drift-guard (Pre-H.1.0b) for the Israeli ID (ת"ז) validator.
 *
 * The frontend ת"ז check MUST agree with the backend `isValidIsraeliId`
 * (functions/shared/validators.js, #348) — ת"ז is the cross-system join key to
 * tofes-mecher (MASTER_PLAN §8.2.5). This test pins BOTH frontend impls — the
 * runtime helper (js/modules/israeli-id.js, used by the wizard) AND the orphaned
 * Zod ClientSchema — to the SAME canonical vectors the backend test uses
 * (functions/tests/israeli-id-validator.test.js). Any divergence fails CI.
 *
 * Runs in CI via root Vitest ("Run Vitest (root, non-rules)" in pull-request.yml).
 */
import { describe, it, expect } from 'vitest';

import { isValidIsraeliId } from '../../../apps/user-app/js/modules/israeli-id.js';
import { ClientSchema } from '../../../apps/user-app/js/schemas/index';

// Canonical [input, expected] vectors — identical set to the backend test
// functions/tests/israeli-id-validator.test.js.
const STRING_VECTORS: Array<[string, boolean]> = [
  ['123456782', true], // valid 9-digit
  ['00000018', true], // 8-digit → zero-padded to a valid ID
  ['000000018', true], // explicit 9-digit zero-pad
  ['  123456782  ', true], // surrounding whitespace trimmed
  ['123456789', false], // wrong check digit
  ['000000000', false], // all-zeros guard
  ['SYSTEM-INTERNAL', false], // sentinel present in legacy data
  ['TEST-123456', false], // harness sentinel
  ['12345678a', false], // non-digit char
  ['123-456-78', false], // dashes
  ['1234567890', false], // more than 9 digits
  ['', false], // empty
  ['   ', false] // whitespace-only
];

// Non-string inputs the runtime helper must reject. (The Zod path rejects these
// at z.string() before the refine, so they are asserted only on the helper.)
const NON_STRING_VECTORS: unknown[] = [123456782, null, undefined, {}];

describe('israeli-id.js (frontend runtime helper) ≡ backend isValidIsraeliId', () => {
  it.each(STRING_VECTORS)('isValidIsraeliId(%j) === %s', (input, expected) => {
    expect(isValidIsraeliId(input)).toBe(expected);
  });

  it('rejects non-string input (number, null, undefined, object)', () => {
    for (const v of NON_STRING_VECTORS) {
      expect(isValidIsraeliId(v as never)).toBe(false);
    }
  });

  it('exposes a window.IsraeliId mirror for the classic-script dialog', () => {
    const g = globalThis as Record<string, unknown>;
    const scope = (g.window ?? g) as Record<string, unknown>;
    const mirror = scope.IsraeliId as { isValidIsraeliId?: unknown } | undefined;
    expect(typeof mirror?.isValidIsraeliId).toBe('function');
  });
});

describe('ClientSchema.idNumber (orphaned Zod) ≡ the same check-digit verdicts', () => {
  const IdOnly = ClientSchema.pick({ idNumber: true });

  // For NON-EMPTY strings the refine applies the check digit — must match the helper.
  const checkDigitVectors = STRING_VECTORS.filter(([s]) => s.trim() !== '');

  it.each(checkDigitVectors)('safeParse({ idNumber: %j }).success === %s', (input, expected) => {
    expect(IdOnly.safeParse({ idNumber: input }).success).toBe(expected);
  });

  it('treats absent (undefined) and blank string as valid (OPTIONAL semantics)', () => {
    expect(IdOnly.safeParse({}).success).toBe(true); // not provided
    expect(IdOnly.safeParse({ idNumber: '' }).success).toBe(true); // blank = not provided
    expect(IdOnly.safeParse({ idNumber: '   ' }).success).toBe(true);
  });

  it('rejects an invalid ת"ז with the Hebrew message (value not echoed)', () => {
    const res = IdOnly.safeParse({ idNumber: '123456789' });
    expect(res.success).toBe(false);
    if (!res.success) {
      const msg = res.error.issues[0]?.message ?? '';
      expect(msg).toBe('מספר תעודת הזהות אינו תקין');
      expect(msg).not.toContain('123456789'); // no PII / value in the message
    }
  });
});
