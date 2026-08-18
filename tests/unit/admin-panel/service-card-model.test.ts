/**
 * U2 — ServiceCardModel: the PURE service-card view-model.
 * ─────────────────────────────────────────────────────────────────────────────
 * docs/PLAN-ADMIN-MODAL-UNIFICATION-2026-07.md — PR-U2.
 *
 * The unified renderer (U4/U5) will build its cards from this model. It is the fix for
 * BOTH live bugs, proven here BEFORE any live surface adopts it:
 *   - D2 (קובי): identity is `service.id` (one card per service), so two legal procedures
 *     that each own a `stage_a` no longer collide — both survive as distinct cards. The
 *     current ClientReportModal keys a client-wide Map by `stage.id` and drops one.
 *   - D1 (חליבה): the model reads ONLY `client.services[]` — it never touches the
 *     timesheet ledger, so it can never fabricate the nameless total-0 phantom card the
 *     ClientReportModal timesheet-fallback invents for an unmatched ledger row.
 *
 * The suite deliberately injects a CONTRADICTORY ledger via window.ClientsDataManager to
 * prove the model ignores it: its numbers are a pure function of the document.
 */
import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect, beforeEach } from 'vitest';

// A ledger stub that, if the model ever read it (it must not), would corrupt the output.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).ClientsDataManager = {
  getClientTimesheetEntries: (): unknown[] => [
    { serviceName: 'ביה"ד לעבודה', minutes: 3672 }, // 61.2h under a NAME — the D1 trap
    { serviceName: 'שירות רפאים', minutes: 9999 }
  ]
};

// @ts-ignore — classic admin-panel module, no type declarations
import '../../../apps/admin-panel/js/modules/ServiceCardModel.js';

const ADMIN = path.resolve(__dirname, '../../../apps/admin-panel');
const SRC = fs.readFileSync(path.resolve(ADMIN, 'js/modules/ServiceCardModel.js'), 'utf8');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const model = (window as any).ServiceCardModel;

// ── fixtures (same shapes the U0 characterization pins) ──────────────────────
// Two DISTINCT legal procedures, each with its own stage_a + stage_b — the D2 shape.
function twoLegalProceduresClient() {
  return {
    fullName: 'לקוח דו-הליכי',
    procedureType: 'legal_procedure',
    services: [
      {
        id: 'srv_tviaa', name: 'תביעה', type: 'legal_procedure', pricingType: 'hourly',
        stages: [
          { id: 'stage_a', status: 'active', totalHours: 50, hoursUsed: 46.8 },
          { id: 'stage_b', status: 'active', totalHours: 40, hoursUsed: 0 }
        ]
      },
      {
        id: 'srv_hagana', name: 'כתב הגנה', type: 'legal_procedure', pricingType: 'hourly',
        stages: [
          { id: 'stage_a', status: 'active', totalHours: 45, hoursUsed: 22.1 },
          { id: 'stage_b', status: 'active', totalHours: 30, hoursUsed: 0 }
        ]
      }
    ]
  };
}

// Mixed client (top-level hours) + a legal service whose hours are logged under its NAME —
// the D1 shape. In the report this fabricates a phantom; the model must not.
function mixedHoursLegalClient() {
  return {
    fullName: 'לקוח מעורב',
    procedureType: 'hours',
    services: [
      {
        id: 'srv_beitdin', name: 'ביה"ד לעבודה', type: 'legal_procedure', pricingType: 'hourly',
        stages: [{ id: 'stage_a', status: 'active', totalHours: 79.5, hoursUsed: 61.2 }]
      }
    ]
  };
}

const hoursService = (over: Record<string, unknown>) => ({
  id: 'srv_hours', name: 'שירות שעות', type: 'hours', pricingType: 'hourly', ...over
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const build = (client: unknown, opts?: unknown) => model.build(client, opts as any);

beforeEach(() => {
  // restore the trap ledger each test (defensive — nothing should ever consume it)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).ClientsDataManager.getClientTimesheetEntries = (): unknown[] => [
    { serviceName: 'ביה"ד לעבודה', minutes: 3672 },
    { serviceName: 'שירות רפאים', minutes: 9999 }
  ];
});

// ── D2 — both legal procedures survive as distinct cards ─────────────────────
describe('U2 · D2 fix — one card per service.id, no stage.id collision', () => {
  it('two legal procedures (each with stage_a+stage_b) → 2 distinct cards, both kept', () => {
    const { cards } = build(twoLegalProceduresClient());
    expect(cards).toHaveLength(2);
    expect(cards.map((c: { serviceId: string }) => c.serviceId)).toEqual(['srv_tviaa', 'srv_hagana']);
    // "תביעה" is NOT dropped (the D2 bug drops it and shows srv_hagana twice).
    expect(cards.some((c: { serviceId: string }) => c.serviceId === 'srv_tviaa')).toBe(true);
  });

  it('each card carries all of its own stages (nothing overwritten)', () => {
    const { cards } = build(twoLegalProceduresClient());
    expect(cards[0].stages.map((s: { id: string }) => s.id)).toEqual(['stage_a', 'stage_b']);
    expect(cards[1].stages.map((s: { id: string }) => s.id)).toEqual(['stage_a', 'stage_b']);
    // stored numbers survive per stage; remaining derived from the complement.
    expect(cards[0].stages[0]).toMatchObject({ totalHours: 50, hoursUsed: 46.8 });
    expect(cards[0].stages[0].hoursRemaining).toBeCloseTo(3.2, 5);
  });
});

// ── D1 — no phantom, ever (the model ignores the ledger) ─────────────────────
describe('U2 · D1 fix — model reads services[] only, never the ledger', () => {
  it('mixed client with a name-logged legal service → exactly 1 card, no nameless phantom', () => {
    const { cards } = build(mixedHoursLegalClient());
    expect(cards).toHaveLength(1);
    expect(cards[0].serviceId).toBe('srv_beitdin');
    // no fabricated card: every card has a real serviceId, none is nameless.
    expect(cards.every((c: { serviceId: string; name: string }) => !!c.serviceId)).toBe(true);
  });

  it('a contradictory ledger (a "שירות רפאים" row) never becomes a card', () => {
    const { cards } = build(mixedHoursLegalClient());
    expect(cards.some((c: { name: string }) => c.name === 'שירות רפאים')).toBe(false);
  });
});

// ── numbers are the document, even when the ledger disagrees ──────────────────
describe('U2 · numbers == the document (ledger is irrelevant to the model)', () => {
  it('stored used/remaining/total are taken verbatim, ignoring the injected 99h+ ledger', () => {
    const client = { services: [hoursService({ totalHours: 50, hoursRemaining: 30, hoursUsed: 20 })] };
    const { cards } = build(client);
    expect(cards[0]).toMatchObject({ totalHours: 50, hoursUsed: 20, hoursRemaining: 30 });
  });

  it('Number.isFinite respects a real stored 0 (not treated as absent)', () => {
    const client = { services: [hoursService({ totalHours: 50, hoursRemaining: 40, hoursUsed: 0 })] };
    const { cards } = build(client);
    expect(cards[0].hoursUsed).toBe(0);
    expect(cards[0].hoursRemaining).toBe(40);
  });

  it('a negative remainder is NEVER clamped (an overdrawn service reads as overdrawn)', () => {
    const client = { services: [hoursService({ totalHours: 50, hoursRemaining: -5, hoursUsed: 55 })] };
    const { cards } = build(client);
    expect(cards[0].hoursRemaining).toBe(-5);
  });

  it('both aggregates absent → creation defaults (used 0, remaining = total)', () => {
    const client = { services: [hoursService({ totalHours: 12 })] };
    const { cards } = build(client);
    expect(cards[0]).toMatchObject({ hoursUsed: 0, hoursRemaining: 12 });
  });
});

// ── card metadata: isFixed SSOT, archived parity, stage naming, meta seam ─────
describe('U2 · card metadata', () => {
  it('isFixed uses the canonical rule (fixed / legal+fixed → true; hours → false)', () => {
    const { cards } = build({
      services: [
        hoursService({}),
        { id: 'f1', name: 'קבוע', type: 'fixed' },
        { id: 'lf', name: 'הליך קבוע', type: 'legal_procedure', pricingType: 'fixed' }
      ]
    });
    expect(cards.map((c: { isFixed: boolean }) => c.isFixed)).toEqual([false, true, true]);
  });

  it('archived service → nonAggregating:true (still gets a card, for the "בארכיון" badge)', () => {
    const { cards } = build({ services: [hoursService({ status: 'archived' })] });
    expect(cards[0].nonAggregating).toBe(true);
    expect(cards).toHaveLength(1);
  });

  it('stage name prefers stored stage.name, else the injected getStageName', () => {
    const client = {
      services: [{
        id: 's', name: 'הליך', type: 'legal_procedure', pricingType: 'hourly',
        stages: [
          { id: 'stage_a', status: 'active', name: 'כתב תביעה' },
          { id: 'stage_b', status: 'pending' }
        ]
      }]
    };
    const { cards } = build(client, { getStageName: (id: string) => `שלב:${id}` });
    expect(cards[0].stages[0].name).toBe('כתב תביעה'); // stored name wins
    expect(cards[0].stages[1].name).toBe('שלב:stage_b'); // else the injected resolver
  });

  it('meta carries serviceCount + the unassignedHours seam (null in the pure model)', () => {
    const { meta } = build(twoLegalProceduresClient());
    expect(meta).toMatchObject({ serviceCount: 2, unassignedHours: null });
  });

  it('null / empty client → empty cards, no throw', () => {
    expect(build(null).cards).toEqual([]);
    expect(build({}).cards).toEqual([]);
    expect(build({ services: [] }).cards).toEqual([]);
  });
});

// ── static purity guard: the model must not regrow the bug mechanisms ─────────
describe('U2 · source purity (the model stays pure — no ledger, no clamp, no stage.id map)', () => {
  it('never reads the timesheet ledger', () => {
    expect(SRC).not.toContain('getClientTimesheetEntries');
    expect(SRC, 'no entry-duration read').not.toMatch(/\.minutes\b/);
  });
  it('never clamps a remainder with Math.max(0, …)', () => {
    expect(SRC).not.toContain('Math.max(0,');
  });
  it('never keys a map by the service-local stage.id (the D2 mechanism)', () => {
    expect(SRC).not.toMatch(/servicesMap\.set\(\s*stage\.id/);
    expect(SRC).not.toMatch(/\.set\(\s*stage\.id\s*,/);
  });
  it('identity is service.id (one card per service)', () => {
    expect(SRC).toContain('serviceId: service.id');
  });
});
