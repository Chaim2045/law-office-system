/**
 * PR-R1 — buildRailRow(card, opts) parameterization.
 * ─────────────────────────────────────────────────────────────────────────────
 * The master-detail RAIL is reused by BOTH the manage tab and (in PR-R2) the report
 * tab; only the ARIA wiring differs. This suite PINS two things:
 *   1. the MANAGE default (no opts) is BYTE-STABLE — role="tab" + aria-selected +
 *      aria-controls="managementServicesList", NO aria-checked. This is the ADMIN
 *      SAFETY guard: buildRailRow drives which management service-card is shown
 *      (ClientManagementModal._selectRail), so a regression here would break the
 *      live manage rail.
 *   2. the REPORT variant (opts.role="radio") emits radio semantics — role="radio" +
 *      aria-checked + a custom aria-controls, NO aria-selected — while keeping the
 *      SAME visual component (dot + name + ratio).
 */
import { describe, it, expect } from 'vitest';

// A REAL 5-entity escaper (mirrors the SSOT) — buildRailRow escapes the name at the sink.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).escapeHtml = (s: unknown): string =>
  (s === null || s === undefined ? '' : String(s))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).SYSTEM_CONSTANTS = {
  SERVICE_TYPES: { HOURS: 'hours', LEGAL_PROCEDURE: 'legal_procedure', FIXED: 'fixed' },
  PRICING_TYPES: { HOURLY: 'hourly', FIXED: 'fixed' }
};

// @ts-ignore — classic admin-panel script, no type declarations
import '../../../apps/admin-panel/js/ui/UnifiedServiceCard.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const UC = (window as any).UnifiedServiceCard;

// A legal-procedure card whose hours live on the stages (ratio = sum-over-stages).
const card = () => ({
  serviceId: 'srv_x',
  name: 'תביעה',
  type: 'legal_procedure',
  status: 'active',
  totalHours: 0,
  hoursUsed: 0,
  stages: [{ id: 'stage_a', status: 'active', totalHours: 50, hoursUsed: 46.8 }]
});

describe('PR-R1 · buildRailRow — manage default is byte-stable', () => {
  it('no opts → role="tab", aria-selected="false", aria-controls="managementServicesList", NO aria-checked', () => {
    const el = UC.buildRailRow(card()) as HTMLElement;
    expect(el.tagName).toBe('BUTTON');
    expect(el.getAttribute('role')).toBe('tab');
    expect(el.getAttribute('aria-selected')).toBe('false');
    expect(el.getAttribute('aria-controls')).toBe('managementServicesList');
    expect(el.hasAttribute('aria-checked')).toBe(false);
    expect((el as HTMLElement).dataset.rail).toBe('srv_x');
  });

  it('the P1 rail visuals are intact (status dot + name + sum-over-stages ratio)', () => {
    const el = UC.buildRailRow(card()) as HTMLElement;
    expect(el.className).toBe('cm-rail-row');
    expect(el.querySelector('.cm-rail-row-status')).not.toBeNull();
    expect(el.querySelector('.cm-rail-row-name')?.textContent).toBe('תביעה');
    expect(el.querySelector('.cm-rail-row-ratio')?.textContent).toBe('46.8/50.0');
    // the type icon stays dropped from service rows (mockup parity, P1)
    expect(el.querySelector('.cm-rail-row-icon')).toBeNull();
  });
});

describe('PR-R1 · buildRailRow — report radio variant', () => {
  it('opts.role="radio" → role="radio", aria-checked="false", custom aria-controls, NO aria-selected', () => {
    const el = UC.buildRailRow(card(), { role: 'radio', ariaControls: 'cmReportServiceDetail' }) as HTMLElement;
    expect(el.getAttribute('role')).toBe('radio');
    expect(el.getAttribute('aria-checked')).toBe('false');
    expect(el.getAttribute('aria-controls')).toBe('cmReportServiceDetail');
    expect(el.hasAttribute('aria-selected')).toBe(false);
  });

  it('the radio variant reuses the SAME visual component (dot + name + ratio)', () => {
    const el = UC.buildRailRow(card(), { role: 'radio' }) as HTMLElement;
    expect(el.className).toBe('cm-rail-row');
    expect(el.querySelector('.cm-rail-row-name')?.textContent).toBe('תביעה');
    expect(el.querySelector('.cm-rail-row-ratio')?.textContent).toBe('46.8/50.0');
    // default aria-controls when the caller omits it
    expect(el.getAttribute('aria-controls')).toBe('managementServicesList');
  });
});
