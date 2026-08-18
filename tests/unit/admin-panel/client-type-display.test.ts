/**
 * Unit Tests — ClientTypeDisplay
 *
 * Tests the new computeClientTypeDisplay() function that replaces the
 * legacy `client.type || 'hours'` default which was causing every fixed
 * client to display as 'שעות' in the admin clients table.
 *
 * Created: 2026-05-14 as part of feature/admin-table-mixed-type-display.
 */

import { describe, it, expect } from 'vitest';

// renderTypeTooltip's leaf-text escaper now delegates to the shared SSOT
// window.escapeHtml (escapeHtml-dedup PR1) — import it first so the global is
// defined when the tooltip renders.
// @ts-ignore — classic admin-panel script, no type declarations
import '../../../apps/admin-panel/js/core/escape-html.js';

// @ts-ignore — CommonJS require from TypeScript ESM test
import {
  computeClientTypeDisplay,
  renderTypeTooltip,
  renderTypeForCsv,
  isFixedService,
  isServiceActive
} from '../../../apps/admin-panel/js/core/client-type-display.js';

describe('isFixedService — canonical fixed-service check', () => {
  it('returns true for type=fixed', () => {
    expect(isFixedService({ type: 'fixed' })).toBe(true);
  });

  it('returns true for legal_procedure + pricingType=fixed', () => {
    expect(isFixedService({ type: 'legal_procedure', pricingType: 'fixed' })).toBe(true);
  });

  it('returns false for type=hours', () => {
    expect(isFixedService({ type: 'hours' })).toBe(false);
  });

  it('returns false for legal_procedure + pricingType=hourly', () => {
    expect(isFixedService({ type: 'legal_procedure', pricingType: 'hourly' })).toBe(false);
  });

  it('returns false for null/undefined input', () => {
    expect(isFixedService(null)).toBe(false);
    expect(isFixedService(undefined)).toBe(false);
  });
});

describe('isServiceActive — service status check', () => {
  it('returns true for status=active', () => {
    expect(isServiceActive({ status: 'active' })).toBe(true);
  });

  it('returns false for status=completed', () => {
    expect(isServiceActive({ status: 'completed' })).toBe(false);
  });

  it('returns true for missing status (backward compat with legacy data)', () => {
    expect(isServiceActive({ type: 'hours' })).toBe(true);
  });

  it('returns false for null/undefined', () => {
    expect(isServiceActive(null)).toBe(false);
    expect(isServiceActive(undefined)).toBe(false);
  });
});

describe('computeClientTypeDisplay — kind/label/icon', () => {
  it('returns "none" for empty services array', () => {
    const result = computeClientTypeDisplay([]);
    expect(result.kind).toBe('none');
    expect(result.label).toBe('ללא');
    expect(result.icon).toBe('fa-question-circle');
  });

  it('returns "none" for undefined services', () => {
    const result = computeClientTypeDisplay(undefined);
    expect(result.kind).toBe('none');
  });

  it('returns "none" for non-array input', () => {
    const result = computeClientTypeDisplay('not an array' as any);
    expect(result.kind).toBe('none');
  });

  it('returns "hours" for client with only hours services', () => {
    const services = [
      { type: 'hours', name: 'תוכנית 1', status: 'active' },
      { type: 'hours', name: 'תוכנית 2', status: 'active' }
    ];
    const result = computeClientTypeDisplay(services);
    expect(result.kind).toBe('hours');
    expect(result.label).toBe('שעות');
    expect(result.icon).toBe('fa-clock');
  });

  it('returns "fixed" for client with only fixed services', () => {
    const services = [
      { type: 'fixed', name: 'הסכם 1', status: 'active' },
      { type: 'legal_procedure', pricingType: 'fixed', name: 'הליך', status: 'active' }
    ];
    const result = computeClientTypeDisplay(services);
    expect(result.kind).toBe('fixed');
    expect(result.label).toBe('פיקס');
    expect(result.icon).toBe('fa-file-invoice-dollar');
  });

  it('returns "mixed" for client with both hours AND fixed active services (Binyamingold)', () => {
    const services = [
      { type: 'legal_procedure', pricingType: 'fixed', name: 'הליך מחוזי', status: 'active' },
      { type: 'hours', name: 'הליך ביהמש עליון', status: 'active', totalHours: 70 }
    ];
    const result = computeClientTypeDisplay(services);
    expect(result.kind).toBe('mixed');
    expect(result.label).toBe('מעורב');
    expect(result.icon).toBe('fa-layer-group');
  });

  it('treats legal_procedure + pricingType=hourly as hours (billable)', () => {
    const services = [
      { type: 'legal_procedure', pricingType: 'hourly', name: 'הליך שעתי', status: 'active' }
    ];
    const result = computeClientTypeDisplay(services);
    expect(result.kind).toBe('hours');
  });
});

describe('computeClientTypeDisplay — active-only logic', () => {
  it('ignores completed services when computing kind', () => {
    const services = [
      { type: 'hours', name: 'שעות סגור', status: 'completed' },
      { type: 'fixed', name: 'פיקס פעיל', status: 'active' }
    ];
    const result = computeClientTypeDisplay(services);
    // Only fixed is active → kind=fixed (not mixed)
    expect(result.kind).toBe('fixed');
  });

  it('returns "none" when all services are completed', () => {
    const services = [
      { type: 'hours', name: 'שעות סגור', status: 'completed' },
      { type: 'fixed', name: 'פיקס סגור', status: 'completed' }
    ];
    const result = computeClientTypeDisplay(services);
    expect(result.kind).toBe('none');
  });

  it('breakdown includes ALL services regardless of active status', () => {
    const services = [
      { type: 'hours', name: 'A', status: 'active' },
      { type: 'fixed', name: 'B', status: 'completed' }
    ];
    const result = computeClientTypeDisplay(services);
    expect(result.breakdown.length).toBe(2);
    expect(result.breakdown[0].isActive).toBe(true);
    expect(result.breakdown[1].isActive).toBe(false);
  });
});

describe('computeClientTypeDisplay — breakdown structure', () => {
  it('marks isFixed correctly per service', () => {
    const services = [
      { type: 'hours', name: 'h', status: 'active' },
      { type: 'fixed', name: 'f', status: 'active' },
      { type: 'legal_procedure', pricingType: 'fixed', name: 'lpf', status: 'active' },
      { type: 'legal_procedure', pricingType: 'hourly', name: 'lph', status: 'active' }
    ];
    const result = computeClientTypeDisplay(services);
    expect(result.breakdown[0].isFixed).toBe(false);  // hours
    expect(result.breakdown[1].isFixed).toBe(true);   // fixed
    expect(result.breakdown[2].isFixed).toBe(true);   // legal+fixed
    expect(result.breakdown[3].isFixed).toBe(false);  // legal+hourly
  });

  it('handles service with missing name (fallback to ללא שם)', () => {
    const services = [{ type: 'hours', status: 'active' }];
    const result = computeClientTypeDisplay(services);
    expect(result.breakdown[0].name).toBe('(ללא שם)');
  });
});

describe('renderTypeTooltip — HTML output', () => {
  it('returns "אין שירותים" for empty breakdown', () => {
    expect(renderTypeTooltip([])).toContain('אין שירותים');
  });

  it('lists active services under פעילים', () => {
    const breakdown = [
      { name: 'הליך מחוזי', isActive: true, isFixed: true }
    ];
    const html = renderTypeTooltip(breakdown);
    expect(html).toContain('פעילים:');
    expect(html).toContain('הליך מחוזי');
    expect(html).toContain('פיקס');
  });

  it('lists completed services separately under סגורים', () => {
    const breakdown = [
      { name: 'שעות סגור', isActive: false, isFixed: false }
    ];
    const html = renderTypeTooltip(breakdown);
    expect(html).toContain('סגורים:');
    expect(html).toContain('שעות (סגור)');
  });

  it('escapes HTML in service names (XSS prevention)', () => {
    const breakdown = [
      { name: '<script>alert(1)</script>', isActive: true, isFixed: false }
    ];
    const html = renderTypeTooltip(breakdown);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('renderTypeForCsv — CSV-safe label', () => {
  it('returns "ללא" for empty', () => {
    expect(renderTypeForCsv([])).toBe('ללא');
  });

  it('returns "שעות + פיקס" for mixed', () => {
    const breakdown = [
      { isActive: true, isFixed: false },
      { isActive: true, isFixed: true }
    ];
    expect(renderTypeForCsv(breakdown)).toBe('שעות + פיקס');
  });

  it('returns "שעות" for hours-only', () => {
    expect(renderTypeForCsv([{ isActive: true, isFixed: false }])).toBe('שעות');
  });

  it('returns "פיקס" for fixed-only', () => {
    expect(renderTypeForCsv([{ isActive: true, isFixed: true }])).toBe('פיקס');
  });

  it('ignores completed when computing CSV label', () => {
    const breakdown = [
      { isActive: false, isFixed: false },  // completed hours
      { isActive: true, isFixed: true }     // active fixed
    ];
    expect(renderTypeForCsv(breakdown)).toBe('פיקס');
  });
});
