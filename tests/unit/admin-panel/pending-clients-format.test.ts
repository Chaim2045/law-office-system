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
