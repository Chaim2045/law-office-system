/**
 * Unit tests for isValidIsraeliId (functions/shared/validators.js) — Pre-H.1.0.
 *
 * The Israeli ת"ז check-digit validator is the foundation of the cross-system
 * join key to tofes-mecher (MASTER_PLAN §8.2.5). These tests pin the official
 * check-digit algorithm + the edge cases the investigation surfaced:
 *  - 8-digit IDs that must be zero-padded to 9 before checksum
 *  - non-numeric sentinels that already live in the data (SYSTEM-INTERNAL, TEST-…)
 *  - the all-zeros guard
 *  - non-string / out-of-range input
 *
 * Pure function — no firebase, no mocks.
 */
'use strict';

const { isValidIsraeliId } = require('../shared/validators');

describe('isValidIsraeliId — valid IDs (correct check digit)', () => {
  it('accepts a valid 9-digit ת"ז', () => {
    expect(isValidIsraeliId('123456782')).toBe(true);
  });

  it('accepts a valid ID that requires leading-zero padding (8 digits → 9)', () => {
    // '00000018' padded to '000000018' has a valid check digit.
    expect(isValidIsraeliId('00000018')).toBe(true);
    expect(isValidIsraeliId('000000018')).toBe(true);
  });

  it('trims surrounding whitespace before validating', () => {
    expect(isValidIsraeliId('  123456782  ')).toBe(true);
  });
});

describe('isValidIsraeliId — invalid IDs (wrong check digit)', () => {
  it('rejects a 9-digit number with an incorrect check digit', () => {
    expect(isValidIsraeliId('123456789')).toBe(false);
  });

  it('rejects all-zeros (passes the raw algorithm but is not a real ID)', () => {
    expect(isValidIsraeliId('000000000')).toBe(false);
  });
});

describe('isValidIsraeliId — malformed / out-of-range input', () => {
  it('rejects non-numeric sentinels already present in the data', () => {
    expect(isValidIsraeliId('SYSTEM-INTERNAL')).toBe(false); // internal-case.js:43
    expect(isValidIsraeliId('TEST-123456')).toBe(false); // validation-script.js
  });

  it('rejects strings with non-digit characters', () => {
    expect(isValidIsraeliId('12345678a')).toBe(false);
    expect(isValidIsraeliId('123-456-78')).toBe(false);
  });

  it('rejects more than 9 digits', () => {
    expect(isValidIsraeliId('1234567890')).toBe(false);
  });

  it('rejects empty / whitespace-only', () => {
    expect(isValidIsraeliId('')).toBe(false);
    expect(isValidIsraeliId('   ')).toBe(false);
  });

  it('rejects non-string input (number, null, undefined, object)', () => {
    expect(isValidIsraeliId(123456782)).toBe(false);
    expect(isValidIsraeliId(null)).toBe(false);
    expect(isValidIsraeliId(undefined)).toBe(false);
    expect(isValidIsraeliId({})).toBe(false);
  });
});
