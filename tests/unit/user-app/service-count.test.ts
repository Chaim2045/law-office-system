/**
 * Unit tests — countSelectableServices (wrong-service-prevention §4.3/§4.4)
 * ─────────────────────────────────────────────────────────────────────────
 * The LOAD-BEARING gating decision as a pure function (no DOM/Firebase): given
 * a client's case doc, how many services/stages are ACTIVE right now? This
 * number decides whether `apps/user-app/js/main.js`'s `addBudgetTask()` fires
 * the wrong-service confirmation dialog (>=2) or stays silent (1, auto-selected
 * — the confirmation would be pure noise per NN/g confirmation-fatigue).
 *
 * Added per the adversarial review of commit aaf6006 (Finding 1): the count was
 * a private class method (`_countActiveServicesOnClient`) with zero tests. It is
 * now a pure, exported helper (`countSelectableServices`) that both the
 * `main.js` method and this test call — same extraction pattern as
 * `budget-crossing.js` (H.4 PR-b).
 *
 * Mirrors the exact-one-vs-ambiguous logic in
 * `ClientCaseSelector.renderServiceCards` (client-case-selector.js): a legacy
 * case (no services/stages) auto-selects; exactly one active hours/fixed
 * service or legal_procedure stage auto-selects; two or more forces a
 * conscious choice.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { countSelectableServices } from '../../../apps/user-app/js/modules/service-count.js';

describe('countSelectableServices — 2 active hours services → confirmation SHOULD fire', () => {
  it('two active hours services count as 2', () => {
    const caseData = {
      services: [
        { id: 's1', type: 'hours', status: 'active', name: 'שירות א' },
        { id: 's2', type: 'hours', status: 'active', name: 'שירות ב' }
      ]
    };
    expect(countSelectableServices(caseData)).toBe(2);
  });
});

describe('countSelectableServices — 1 active service → confirmation must NOT fire', () => {
  it('a single active hours service counts as 1', () => {
    const caseData = {
      services: [{ id: 's1', type: 'hours', status: 'active', name: 'שירות יחיד' }]
    };
    expect(countSelectableServices(caseData)).toBe(1);
  });

  it('a single active fixed service counts as 1', () => {
    const caseData = {
      services: [{ id: 's1', type: 'fixed', status: 'active', name: 'שירות קבוע' }]
    };
    expect(countSelectableServices(caseData)).toBe(1);
  });
});

describe('countSelectableServices — legal_procedure stage counting', () => {
  it('a legal_procedure with 2 active stages counts as 2 (per active stage)', () => {
    const caseData = {
      services: [
        {
          id: 'srv1',
          type: 'legal_procedure',
          status: 'active',
          name: 'הליך משפטי',
          stages: [
            { id: 'stage_a', status: 'active' },
            { id: 'stage_b', status: 'active' }
          ]
        }
      ]
    };
    expect(countSelectableServices(caseData)).toBe(2);
  });

  it('a legal_procedure with 1 active + 2 pending stages counts as 1', () => {
    const caseData = {
      services: [
        {
          id: 'srv1',
          type: 'legal_procedure',
          status: 'active',
          name: 'הליך משפטי',
          stages: [
            { id: 'stage_a', status: 'active' },
            { id: 'stage_b', status: 'pending' },
            { id: 'stage_c', status: 'pending' }
          ]
        }
      ]
    };
    expect(countSelectableServices(caseData)).toBe(1);
  });
});

describe('countSelectableServices — legacy shapes', () => {
  it('a legacy case (no services, no stages) counts as 1 (implicit single service)', () => {
    expect(countSelectableServices({})).toBe(1);
    expect(countSelectableServices({ id: 'case1', caseTitle: 'תיק ראשי' })).toBe(1);
  });

  it('legacy top-level stages are counted ONLY when procedureType === legal_procedure (mirrors renderServiceCards gate)', () => {
    const gated = {
      procedureType: 'legal_procedure',
      services: [],
      stages: [
        { id: 'stage_a', status: 'active' },
        { id: 'stage_b', status: 'active' }
      ]
    };
    expect(countSelectableServices(gated)).toBe(2);

    // Same top-level stages, but procedureType is NOT legal_procedure — the gate
    // must hold and these stages must NOT be counted. Note: services.length===0
    // and legacyStages.length>0 here, so this does NOT hit the "legacy case"
    // fallback (that only fires when BOTH are empty) — it falls through to 0.
    const ungated = {
      procedureType: 'hours',
      services: [],
      stages: [
        { id: 'stage_a', status: 'active' },
        { id: 'stage_b', status: 'active' }
      ]
    };
    expect(countSelectableServices(ungated)).toBe(0);
  });
});

describe('countSelectableServices — archived/non-active services are not counted', () => {
  it('an archived hours service is excluded from the count', () => {
    const caseData = {
      services: [
        { id: 's1', type: 'hours', status: 'active', name: 'שירות פעיל' },
        { id: 's2', type: 'hours', status: 'archived', name: 'שירות בארכיון' }
      ]
    };
    expect(countSelectableServices(caseData)).toBe(1);
  });

  it('an archived legal_procedure stage is excluded from the stage count', () => {
    const caseData = {
      services: [
        {
          id: 'srv1',
          type: 'legal_procedure',
          status: 'active',
          name: 'הליך משפטי',
          stages: [
            { id: 'stage_a', status: 'active' },
            { id: 'stage_b', status: 'archived' }
          ]
        }
      ]
    };
    expect(countSelectableServices(caseData)).toBe(1);
  });
});

describe('countSelectableServices — edge cases', () => {
  it('null/undefined caseData counts as 0', () => {
    expect(countSelectableServices(null as never)).toBe(0);
    expect(countSelectableServices(undefined as never)).toBe(0);
  });

  it('a service with no status field defaults to active (backward compatibility)', () => {
    const caseData = {
      services: [{ id: 's1', type: 'hours', name: 'שירות ללא סטטוס' }]
    };
    expect(countSelectableServices(caseData)).toBe(1);
  });

  it('mixed hours + fixed + legal_procedure services all count together', () => {
    const caseData = {
      services: [
        { id: 's1', type: 'hours', status: 'active', name: 'שעות' },
        { id: 's2', type: 'fixed', status: 'active', name: 'קבוע' },
        {
          id: 's3',
          type: 'legal_procedure',
          status: 'active',
          name: 'הליך',
          stages: [{ id: 'stage_a', status: 'active' }]
        }
      ]
    };
    expect(countSelectableServices(caseData)).toBe(3);
  });
});

describe('countSelectableServices — classification routes through window.BUSINESS_RULES when present', () => {
  const original = (globalThis as typeof globalThis & { window?: { BUSINESS_RULES?: unknown } })
    .window?.BUSINESS_RULES;

  beforeEach(() => {
    // Mirrors apps/user-app/js/shared/business-rules-adapter.js exactly — proves
    // the primary (house-predicate) path produces the SAME counts as the
    // documented inline fallback used when window.BUSINESS_RULES is absent.
    (window as typeof window & { BUSINESS_RULES: unknown }).BUSINESS_RULES = {
      isFixedService: (svc: { type?: string; pricingType?: string }) =>
        !!svc && (svc.type === 'fixed' || (svc.type === 'legal_procedure' && svc.pricingType === 'fixed')),
      isHourlyService: (svc: { type?: string; pricingType?: string }) =>
        !!svc && (svc.type === 'hours' || (svc.type === 'legal_procedure' && svc.pricingType === 'hourly')),
      isLegalProcedureService: (svc: { type?: string }) => !!svc && svc.type === 'legal_procedure'
    };
  });

  afterEach(() => {
    (window as typeof window & { BUSINESS_RULES?: unknown }).BUSINESS_RULES = original;
  });

  it('2 active hours services still count as 2 via window.BUSINESS_RULES', () => {
    const caseData = {
      services: [
        { id: 's1', type: 'hours', status: 'active', name: 'שירות א' },
        { id: 's2', type: 'hours', status: 'active', name: 'שירות ב' }
      ]
    };
    expect(countSelectableServices(caseData)).toBe(2);
  });

  it('a legal_procedure with 2 active stages still counts as 2 via window.BUSINESS_RULES', () => {
    const caseData = {
      services: [
        {
          id: 'srv1',
          type: 'legal_procedure',
          status: 'active',
          name: 'הליך משפטי',
          stages: [
            { id: 'stage_a', status: 'active' },
            { id: 'stage_b', status: 'active' }
          ]
        }
      ]
    };
    expect(countSelectableServices(caseData)).toBe(2);
  });
});
