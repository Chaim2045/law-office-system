/**
 * Unit tests — ProfitabilityFormat (H.3 PR4)
 * ──────────────────────────────────────────
 * The LOAD-BEARING dashboard render rules as pure functions (no DOM/Firebase):
 * null≠0 cost rendering, the coverage badge, the hours-vs-Plan color signal, and
 * the un-priced flag. This is the "customer scenario" test (G4): "actualCost=null
 * shows 'עלות לא זמינה', NEVER ₪0".
 */
import { describe, it, expect } from 'vitest';

// @ts-ignore — CommonJS require from a TypeScript ESM test (dual-export module).
import {
  formatShekel,
  formatHours,
  formatActualCost,
  coverageBadge,
  hoursStatus,
  planRevenue,
  COST_UNAVAILABLE
} from '../../../apps/admin-panel/js/core/profitability-format.js';

describe('formatActualCost — null ≠ 0 (the #1 render rule)', () => {
  it('null → "עלות לא זמינה" (NEVER ₪0), available:false', () => {
    expect(formatActualCost(null)).toEqual({ text: COST_UNAVAILABLE, available: false });
  });

  it('undefined → "עלות לא זמינה", available:false', () => {
    expect(formatActualCost(undefined)).toEqual({ text: COST_UNAVAILABLE, available: false });
  });

  it('a real 0 (free/intern) → "₪0", available:true (a KNOWN cost, distinct from null)', () => {
    expect(formatActualCost(0)).toEqual({ text: '₪0', available: true });
  });

  it('a real cost → grouped ₪, available:true', () => {
    expect(formatActualCost(9375)).toEqual({ text: '₪9,375', available: true });
  });
});

describe('formatShekel + formatHours', () => {
  it('formatShekel groups thousands; null → empty string', () => {
    expect(formatShekel(40000)).toBe('₪40,000');
    expect(formatShekel(1234567)).toBe('₪1,234,567');
    expect(formatShekel(null)).toBe('');
  });

  it('formatHours: null → dash, 0 → "0.0" (a real value), 4.92 → "4.9"', () => {
    expect(formatHours(null)).toBe('—');
    expect(formatHours(0)).toBe('0.0');
    expect(formatHours(4.92)).toBe('4.9');
  });
});

describe('coverageBadge — un-costed coverage signal', () => {
  it('no entries → neutral "אין רישומים"', () => {
    expect(coverageBadge(null, 0)).toEqual({ level: 'neutral', label: 'אין רישומים' });
  });

  it('0% un-costed (fully costed) → success "מתומחר מלא"', () => {
    expect(coverageBadge(0, 5)).toEqual({ level: 'success', label: 'מתומחר מלא' });
  });

  it('100% un-costed (TODAY: no costs entered) → danger "עלות טרם הוזנה"', () => {
    expect(coverageBadge(100, 5)).toEqual({ level: 'danger', label: 'עלות טרם הוזנה' });
  });

  it('partial coverage → warning "X% לא מתומחר"', () => {
    expect(coverageBadge(66.67, 3)).toEqual({ level: 'warning', label: '67% לא מתומחר' });
  });
});

describe('hoursStatus — the ONLY color signal in PR4 (hours vs Plan; cost null today)', () => {
  it('no/zero expectedHours (e.g. fixed-price) → neutral "אין תכנון"', () => {
    expect(hoursStatus(5, 0).level).toBe('neutral');
    expect(hoursStatus(5, null).level).toBe('neutral');
  });

  it('well within plan (ratio ≤ 0.85) → success', () => {
    expect(hoursStatus(5, 10).level).toBe('success');
  });

  it('approaching the cap (0.85 < ratio ≤ 1.0) → warning', () => {
    expect(hoursStatus(9, 10).level).toBe('warning');
  });

  it('over the planned hours (ratio > 1.0) → danger', () => {
    expect(hoursStatus(11, 10).level).toBe('danger');
  });

  it('null actualHours with a plan → treated as 0 hours → success', () => {
    expect(hoursStatus(null, 10).level).toBe('success');
  });
});

describe('planRevenue — un-priced flagging (never a bare ₪0)', () => {
  it('fully priced → value, no flag', () => {
    expect(planRevenue({ expectedRevenue: 40000, pricingComplete: true, pricingMissingCount: 0 }))
      .toEqual({ text: '₪40,000', flag: false, flagLabel: '' });
  });

  it('pricingMissingCount>0 → flagged "תמחור חסר (N)"', () => {
    const r = planRevenue({ expectedRevenue: 40000, pricingComplete: false, pricingMissingCount: 2 });
    expect(r.flag).toBe(true);
    expect(r.flagLabel).toBe('תמחור חסר (2)');
  });

  it('no plan → dash, no flag', () => {
    expect(planRevenue(null)).toEqual({ text: '—', flag: false, flagLabel: '' });
  });
});
