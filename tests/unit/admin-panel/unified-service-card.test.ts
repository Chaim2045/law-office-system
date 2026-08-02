/**
 * U4 — UnifiedServiceCard (mode 'report-select').
 * ─────────────────────────────────────────────────────────────────────────────
 * docs/PLAN-ADMIN-MODAL-UNIFICATION-2026-07.md — PR-U4.
 *
 * Builds the selectable report cards from a ServiceCardModel card. Inherits the D1/D2
 * fixes (one unit per service / per active|completed stage, keyed by service.id — no
 * client-wide stage.id Map; never reads the ledger). DA-2: a legal_procedure with no
 * active/completed stage is NON-selectable (never emits a stage:'' legal selection).
 */
import { describe, it, expect } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).escapeHtml = (s: unknown): string => (s === null || s === undefined ? '' : String(s));

// @ts-ignore — classic admin-panel module
import '../../../apps/admin-panel/js/ui/UnifiedServiceCard.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const USC = (window as any).UnifiedServiceCard;

// A ServiceCardModel-shaped card.
const hoursCard = (o: Record<string, unknown> = {}) => ({
  serviceId: 'srv_h', name: 'שירות שעות', type: 'hours', pricingType: 'hourly',
  status: 'active', nonAggregating: false, isFixed: false,
  totalHours: 50, hoursUsed: 20, hoursRemaining: 30, overdraftResolved: null,
  packages: [], stages: [], ...o
});
const legalCard = (stages: unknown[], o: Record<string, unknown> = {}) => ({
  serviceId: 'srv_l', name: 'תביעה', type: 'legal_procedure', pricingType: 'hourly',
  status: 'active', nonAggregating: false, isFixed: false,
  totalHours: 0, hoursUsed: 0, hoursRemaining: 0, overdraftResolved: null,
  packages: [], stages, ...o
});

describe('U4 · UnifiedServiceCard.buildReportSelectCards — hours/fixed', () => {
  it('an hours service → 1 selectable card, stage:"" , dataset carries the contract', () => {
    const units = USC.buildReportSelectCards(hoursCard());
    expect(units).toHaveLength(1);
    expect(units[0].selection).toEqual({ service: 'שירות שעות', serviceId: 'srv_h', stage: '', type: 'hours' });
    const el = units[0].el;
    expect(el.getAttribute('role')).toBe('button');
    expect(el.dataset.serviceId).toBe('srv_h');
    expect(el.dataset.stage).toBe('');
    expect(el.dataset.serviceName).toBe('שירות שעות');
  });

  it('a fixed service → the .fixed variant + fixed badge', () => {
    const units = USC.buildReportSelectCards(hoursCard({ type: 'fixed', isFixed: true, name: 'קבוע' }));
    expect(units[0].el.classList.contains('fixed')).toBe(true);
    expect(units[0].selection.type).toBe('fixed');
  });

  it('an unresolved overdraft (hoursRemaining<0) → the .overdraft variant', () => {
    const units = USC.buildReportSelectCards(hoursCard({ hoursRemaining: -5, overdraftResolved: null }));
    expect(units[0].el.classList.contains('overdraft')).toBe(true);
  });
});

describe('U4 · UnifiedServiceCard — legal_procedure (D2 fix + DA-2)', () => {
  it('a legal service with 2 active stages → 2 selectable cards, both keyed by service.id + their own stage', () => {
    const units = USC.buildReportSelectCards(legalCard([
      { id: 'stage_a', name: 'כתב תביעה', status: 'active', totalHours: 50, hoursUsed: 46.8 },
      { id: 'stage_b', name: 'הוכחות', status: 'active', totalHours: 40, hoursUsed: 0 }
    ]));
    expect(units).toHaveLength(2);
    expect(units.map((u: { selection: { stage: string } }) => u.selection.stage)).toEqual(['stage_a', 'stage_b']);
    for (const u of units) {
      expect(u.selection.serviceId).toBe('srv_l');
      expect(u.selection.type).toBe('legal_procedure');
      expect(u.el.dataset.stage).toBeTruthy();
    }
  });

  it('active AND completed stages are both selectable (checkpoint: active+completed)', () => {
    const units = USC.buildReportSelectCards(legalCard([
      { id: 'stage_a', name: 'א', status: 'completed', totalHours: 10, hoursUsed: 10 },
      { id: 'stage_b', name: 'ב', status: 'active', totalHours: 20, hoursUsed: 5 },
      { id: 'stage_c', name: 'ג', status: 'pending', totalHours: 30, hoursUsed: 0 }
    ]));
    // pending is excluded; active + completed included.
    expect(units.map((u: { selection: { stage: string } }) => u.selection.stage)).toEqual(['stage_a', 'stage_b']);
  });

  it('with getStageName, the legal label + service use getStageName(stage.id) — old-report parity (not stage.name)', () => {
    const units = USC.buildReportSelectCards(
      legalCard([{ id: 'stage_a', name: 'כתב תביעה', status: 'active', totalHours: 50, hoursUsed: 46.8 }]),
      { getStageName: (id: string) => 'הליך משפטי - ' + id }
    );
    expect(units[0].selection.service).toBe('הליך משפטי - stage_a'); // NOT the stage.name "כתב תביעה"
    expect(units[0].el.dataset.serviceName).toBe('הליך משפטי - stage_a');
  });

  it('DA-2: a legal service with NO active/completed stage → 1 NON-selectable card, selection===null', () => {
    const units = USC.buildReportSelectCards(legalCard([
      { id: 'stage_a', name: 'א', status: 'pending', totalHours: 10, hoursUsed: 0 }
    ]));
    expect(units).toHaveLength(1);
    expect(units[0].selection).toBeNull();
    expect(units[0].el.classList.contains('report-service-card--disabled')).toBe(true);
    expect(units[0].el.getAttribute('role')).not.toBe('button'); // never a stage:'' legal selection
  });
});
