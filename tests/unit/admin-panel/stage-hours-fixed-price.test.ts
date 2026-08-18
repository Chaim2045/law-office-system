/**
 * Unit tests — StageHours (fixed-price stage worked-hours)
 * ────────────────────────────────────────────────────────
 * THE CUSTOMER SCENARIO (G4): a partner opens a client report for a case whose
 * legal-procedure stage is FIXED-price. The stage has real work recorded. The
 * report must print that work — not 0.0.
 *
 * WHY THIS TEST EXISTS
 *
 * The backend keeps a fixed stage's work in `totalHoursWorked` and leaves
 * `hoursUsed` at the 0 it was created with — `functions/services/index.js:899-909`
 * says so outright. Every admin-panel consumer read `hoursUsed` directly. Because
 * that 0 is a *finite* number, no `Number.isFinite` guard ever fell through: the
 * consumers read 0 and rendered 0, confidently.
 *
 * This was found by the outcomes-grader while reviewing the production-stable
 * promotion, and then confirmed against live data (2026-08-18): 87 of 150 stages
 * in production are fixed, and 26 of them carried work that would have been
 * reported low or as zero. The numbers in `PRODUCTION_REGRESSION_CASES` below are
 * real cases, kept as the regression anchor.
 *
 * `production-stable` (what partners use today) already applies the rule at
 * `ClientReportModal.js:377-379`. `main` lost it when the report was refactored
 * into a shim — so this is a fix that lets `main` be promoted, not a new feature.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, sep } from 'node:path';

import { describe, it, expect } from 'vitest';

// @ts-ignore — CommonJS require from a TypeScript ESM test (dual-export module).
import {
  stageEffectiveHoursUsed,
  stageHasStoredWorkedHours,
  stageRemainingHours
} from '../../../apps/admin-panel/js/core/stage-hours.js';
// @ts-ignore — same dual-export pattern.
import ServiceCardModel from '../../../apps/admin-panel/js/modules/ServiceCardModel.js';

const REPO_ROOT = join(__dirname, '..', '..', '..');

/**
 * A raw read of a stage's `hoursUsed`. Wide on purpose: `selectedStage.`,
 * `stageForPricing.`, `targetStage.`, plus the short loop names `s.` / `st.`.
 * The narrower `\b(stage|s)\.` this replaced could not see ReportGenerator's
 * `selectedStage.hoursUsed`, so that file was invisible to the scan.
 */
const RAW_STAGE_HOURS_USED = /\b\w*[sS]tage\w*\.hoursUsed\b|\b(?:s|st|stg)\.hoursUsed\b/g;

/**
 * Hour figures taken from five real fixed-price stages (2026-08-18 read-only
 * probe). `worked` is the truth; `stale` is what a `hoursUsed`-only read printed.
 *
 * ANONYMISED ON PURPOSE — this repo is PUBLIC (MASTER_PLAN §2.8). The case
 * identifiers are deliberately not recorded here: pairing a real case number with
 * its billed hours is client data, and the identifier carries no test value. What
 * makes these load-bearing is the RELATIONSHIP between the two figures.
 */
const PRODUCTION_REGRESSION_CASES = [
  { label: 'A', totalHoursWorked: 120.09, hoursUsed: 22.5 },
  { label: 'B', totalHoursWorked: 61.68, hoursUsed: 5.45 },
  { label: 'C', totalHoursWorked: 46.28, hoursUsed: 13.17 },
  { label: 'D', totalHoursWorked: 37.24, hoursUsed: 2.17 },
  { label: 'E', totalHoursWorked: 30.5, hoursUsed: 0 }
];

describe('stageEffectiveHoursUsed — the canonical pricing-aware pick', () => {
  it('FIXED stage reads totalHoursWorked, NOT the permanently-zero hoursUsed', () => {
    expect(stageEffectiveHoursUsed({
      pricingType: 'fixed', totalHoursWorked: 12, hoursUsed: 0
    })).toBe(12);
  });

  it('HOURLY stage reads hoursUsed and ignores totalHoursWorked', () => {
    expect(stageEffectiveHoursUsed({
      pricingType: 'hourly', totalHoursWorked: 999, hoursUsed: 7.25
    })).toBe(7.25);
  });

  it('missing pricingType is treated as hourly (the pre-existing default)', () => {
    expect(stageEffectiveHoursUsed({ hoursUsed: 3 })).toBe(3);
    expect(stageEffectiveHoursUsed({ pricingType: null, hoursUsed: 3 })).toBe(3);
  });

  it('a stage with neither counter populated reports 0, not NaN', () => {
    expect(stageEffectiveHoursUsed({ pricingType: 'fixed' })).toBe(0);
    expect(stageEffectiveHoursUsed({})).toBe(0);
    expect(stageEffectiveHoursUsed(null as never)).toBe(0);
  });

  it('FIXED stage MISSING totalHoursWorked degrades to hoursUsed rather than to 0', () => {
    // A live probe (2026-08-18) found 0 such stages in production, so this never
    // fires on real data — but losing a number outright is worse than using the
    // older one, and this is the shape report-generator-null-aggregate.test.ts uses.
    expect(stageEffectiveHoursUsed({ pricingType: 'fixed', hoursUsed: 3.77 })).toBe(3.77);
  });

  it('a FIXED stage that genuinely worked 0 hours still reports 0 — absence != zero', () => {
    // The fallback must key on ABSENCE. A stored 0 is a real answer and must win
    // over a stale hoursUsed, or the fix would resurrect the very number it removes.
    expect(stageEffectiveHoursUsed({
      pricingType: 'fixed', totalHoursWorked: 0, hoursUsed: 9
    })).toBe(0);
  });
});

describe('stageHasStoredWorkedHours — separates "no work" from "not stored"', () => {
  it('true when the pricing-appropriate counter exists, even at 0', () => {
    expect(stageHasStoredWorkedHours({ pricingType: 'fixed', totalHoursWorked: 0 })).toBe(true);
    expect(stageHasStoredWorkedHours({ pricingType: 'hourly', hoursUsed: 0 })).toBe(true);
  });

  it('false when nothing is stored — the caller may then derive total - remaining', () => {
    expect(stageHasStoredWorkedHours({ pricingType: 'hourly', hoursRemaining: 8 })).toBe(false);
    expect(stageHasStoredWorkedHours({})).toBe(false);
    expect(stageHasStoredWorkedHours(null as never)).toBe(false);
  });

  it('non-finite stored values do not leak NaN/Infinity into a rendered figure', () => {
    expect(stageEffectiveHoursUsed({ pricingType: 'fixed', totalHoursWorked: NaN })).toBe(0);
    expect(stageEffectiveHoursUsed({ pricingType: 'hourly', hoursUsed: Infinity })).toBe(0);
    expect(stageEffectiveHoursUsed({ pricingType: 'hourly', hoursUsed: '5' as never })).toBe(0);
  });

  describe('live production regressions — each would have under-reported a partner report', () => {
    PRODUCTION_REGRESSION_CASES.forEach((c) => {
      it(`stage ${c.label}: reports ${c.totalHoursWorked}h, not ${c.hoursUsed}h`, () => {
        const stage = {
          pricingType: 'fixed',
          totalHoursWorked: c.totalHoursWorked,
          hoursUsed: c.hoursUsed
        };
        expect(stageEffectiveHoursUsed(stage)).toBe(c.totalHoursWorked);
        expect(stageEffectiveHoursUsed(stage)).not.toBe(c.hoursUsed);
      });
    });
  });
});

describe('stageRemainingHours — the fallback must not report a worked stage as untouched', () => {
  it('prefers the stored aggregate when it is present', () => {
    expect(stageRemainingHours(
      { pricingType: 'fixed', totalHoursWorked: 30, hoursRemaining: 4 }, 50
    )).toBe(4);
  });

  it('FIXED stage with no stored remainder subtracts the WORKED hours', () => {
    // The bug: 100 - hoursUsed(0) = 100, i.e. "nothing has been done on this stage".
    expect(stageRemainingHours(
      { pricingType: 'fixed', totalHoursWorked: 30.5, hoursUsed: 0 }, 100
    )).toBe(69.5);
  });

  it('HOURLY stage with no stored remainder still subtracts hoursUsed', () => {
    expect(stageRemainingHours({ pricingType: 'hourly', hoursUsed: 10 }, 40)).toBe(30);
  });
});

describe('ServiceCardModel.buildStage — exposes the selector its own contract requires', () => {
  function buildClientWithFixedStage() {
    return {
      fullName: 'לקוח בדיקה',
      services: [{
        id: 'lp1',
        type: 'legal_procedure',
        name: 'הליך משפטי',
        status: 'active',
        pricingType: 'fixed',
        stages: [{
          id: 'stage_a',
          name: 'שלב א',
          status: 'active',
          pricingType: 'fixed',
          totalHours: 100,
          totalHoursWorked: 30.5,
          hoursUsed: 0
        }]
      }]
    };
  }

  it('carries pricingType through to the view-model, so a renderer can pick', () => {
    const cards = ServiceCardModel.build(buildClientWithFixedStage());
    const stage = cards.cards[0].stages[0];
    expect(stage.pricingType).toBe('fixed');
    // Both counters still travel raw — the model does not decide.
    expect(stage.totalHoursWorked).toBe(30.5);
    expect(stage.hoursUsed).toBe(0);
  });

  it('derives hoursRemaining from the WORKED hours on a fixed stage', () => {
    const cards = ServiceCardModel.build(buildClientWithFixedStage());
    // 100 - 30.5. Before the fix this was 100 - 0 = 100.
    expect(cards.cards[0].stages[0].hoursRemaining).toBe(69.5);
  });
});

describe('drift guard — the frontend rule must not drift from the backend SSOT', () => {
  it('backend calcStageEffectiveHoursUsed still selects on FIXED -> totalHoursWorked', () => {
    const backend = readFileSync(
      join(REPO_ROOT, 'functions', 'src', 'modules', 'aggregation', 'index.js'), 'utf8'
    );
    const fn = backend.match(
      /function calcStageEffectiveHoursUsed\(stage\)\s*\{([\s\S]*?)\n\}/
    );
    expect(fn, 'backend calcStageEffectiveHoursUsed not found — it is the SSOT this mirrors').toBeTruthy();
    const body = fn![1].replace(/\s+/g, ' ').trim();
    // The shape, not the formatting: fixed picks totalHoursWorked, else hoursUsed.
    expect(body).toContain('PT.FIXED');
    expect(body).toContain('totalHoursWorked');
    expect(body).toContain('hoursUsed');
    expect(body.indexOf('totalHoursWorked')).toBeLessThan(body.indexOf('hoursUsed'));
  });

  it('ServiceCardModel REAL inline fallback (globals removed) matches the helper', () => {
    // Executes the actual copy in ServiceCardModel.js, not a transcription of it:
    // with window.StageHours gone the module must take its own fallback branch and
    // still land on the same number. Editing that copy CAN fail this test.
    const saved = (globalThis as { window?: { StageHours?: unknown } }).window?.StageHours;
    try {
      delete (globalThis as { window: { StageHours?: unknown } }).window.StageHours;
      const shapes = [
        { id: 's', pricingType: 'fixed', totalHours: 100, totalHoursWorked: 30.5, hoursUsed: 0 },
        { id: 's', pricingType: 'hourly', totalHours: 100, totalHoursWorked: 99, hoursUsed: 7 },
        { id: 's', pricingType: 'fixed', totalHours: 100, hoursUsed: 3.77 },
        { id: 's', pricingType: 'fixed', totalHours: 100, totalHoursWorked: 0, hoursUsed: 9 },
        { id: 's', pricingType: 'fixed', totalHours: 100 }
      ];
      shapes.forEach((stage) => {
        const built = ServiceCardModel.build({
          fullName: 'x',
          services: [{ id: 'lp', type: 'legal_procedure', name: 'n', status: 'active', stages: [stage] }]
        });
        // hoursRemaining is derived through the SAME fallback, so it reveals the pick.
        // toBeCloseTo, not toBe: recovering the operand from a subtraction reintroduces
        // float error (100 - (100 - 3.77) = 3.769999999999996). 6 dp is far tighter
        // than the 1 dp any of these figures is ever rendered at.
        const derived = 100 - built.cards[0].stages[0].hoursRemaining;
        expect(derived, JSON.stringify(stage)).toBeCloseTo(stageEffectiveHoursUsed(stage), 6);
      });
    } finally {
      // Restore UNCONDITIONALLY. A conditional restore would leave the global
      // deleted whenever it had not been set, leaking this test's mutation into
      // whatever runs next.
      (globalThis as { window: { StageHours?: unknown } }).window.StageHours = saved;
    }
  });

  it('raw stage-hoursUsed reads are frozen PER SITE, not merely per file', () => {
    // THE GUARD FOR THE MISS CLASS. An earlier version of this test asked only
    // "does this FILE mention the rule anywhere?" — which a grader mutation-proved
    // toothless: re-breaking UnifiedServiceCard's per-stage site left the file still
    // mentioning the rule elsewhere and the test passed. It would have caught 1 of
    // the 3 real misses, not 3.
    //
    // So freeze the COUNT of raw reads per file. A new raw read anywhere moves a
    // count and fails; routing it through the rule does not. The identifier pattern
    // is deliberately wide (`selectedStage.`, `targetStage.`, `st.`, `s.`) — the
    // earlier `\b(stage|s)\.` missed `selectedStage.hoursUsed` in ReportGenerator
    // entirely, so that file was invisible to the old scan.
    //
    // Raising a number here is allowed, but only with the reason, and only after
    // checking the new site is a raw carry (a view-model field, a documented
    // fallback) rather than a DISPLAY read that needs the pricing rule.
    const FROZEN: Record<string, number> = {
      'core/stage-hours.js': 4,
      'managers/ReportGenerator.js': 6,
      'modules/ServiceCardModel.js': 6,
      'ui/ClientManagementModal.js': 3,
      'ui/ReportTab.js': 2,
      'ui/UnifiedServiceCard.js': 2
    };

    const dir = join(REPO_ROOT, 'apps', 'admin-panel', 'js');
    const actual: Record<string, number> = {};
    readdirSync(dir, { recursive: true, encoding: 'utf8' })
      .filter((f): f is string => typeof f === 'string' && f.endsWith('.js'))
      .forEach((rel) => {
        const src = readFileSync(join(dir, rel), 'utf8');
        const hits = src.match(RAW_STAGE_HOURS_USED) || [];
        if (hits.length > 0) {
          actual[rel.split(sep).join('/')] = hits.length;
        }
      });

    expect(actual, 'raw stage-hoursUsed sites moved — read the comment above this assertion')
      .toEqual(FROZEN);
  });

  it('every file holding a raw read also routes to the rule', () => {
    // Complements the count freeze: the freeze catches NEW sites, this catches a
    // file that drops its routing altogether.
    const dir = join(REPO_ROOT, 'apps', 'admin-panel', 'js');
    const offenders: string[] = [];
    readdirSync(dir, { recursive: true, encoding: 'utf8' })
      .filter((f): f is string => typeof f === 'string' && f.endsWith('.js'))
      .forEach((rel) => {
        const normalised = rel.split(sep).join('/');
        if (normalised.endsWith('core/stage-hours.js')) {
          return;
        }
        const src = readFileSync(join(dir, rel), 'utf8');
        if (!new RegExp(RAW_STAGE_HOURS_USED.source).test(src)) {
          return;
        }
        // The bare function name, not `StageHours.stageEffectiveHoursUsed`:
        // ReportGenerator aliases the global (`const SH = window.StageHours`) so
        // the dotted form never appears there, and the check silently accused it.
        if (!src.includes('stageEffectiveHoursUsed')) {
          offenders.push(normalised);
        }
      });

    expect(offenders, `these read a stage's hoursUsed without routing to the rule:\n${offenders.join('\n')}`)
      .toEqual([]);
  });

  it('every page that loads a worked-hours consumer also loads the helper', () => {
    // A missing <script> would silently drop each consumer to its inline fallback.
    ['clients.html', 'clients-fluent.html', 'index.html'].forEach((page) => {
      const html = readFileSync(join(REPO_ROOT, 'apps', 'admin-panel', page), 'utf8');
      expect(html, `${page} must load js/core/stage-hours.js`).toContain('js/core/stage-hours.js');
      const helperAt = html.indexOf('js/core/stage-hours.js');
      const consumerAt = html.indexOf('js/managers/ReportGenerator.js');
      expect(consumerAt, `${page} loads ReportGenerator`).toBeGreaterThan(-1);
      expect(helperAt, `${page}: helper must be declared before ReportGenerator`).toBeLessThan(consumerAt);
    });
  });
});
