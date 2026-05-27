/**
 * Unit tests — shared/business-rules/service-classification.js (canonical)
 *
 * Truth table covered by this file:
 *
 *                                  | hours | fixed | LP-hourly | LP-fixed | null/undefined | malformed |
 *   isFixedService                 |   F   |   T   |     F     |    T     |       F        |     F     |
 *   isHourlyService                |   T   |   F   |     T     |    F     |       F        |     F     |
 *   isLegalProcedureService        |   F   |   F   |     T     |    T     |       F        |     F     |
 *
 * Total = 18 cells + 6 negative-input cells = 24 assertions.
 *
 * Created: 2026-05-26 as part of PR-2.1.1 (Phase 2 Step 1 — service-classification module).
 */

import { describe, it, expect } from 'vitest';

// @ts-ignore — CommonJS require from TypeScript ESM test
import * as canonical from '../../../shared/business-rules/service-classification.js';

const { isFixedService, isHourlyService, isLegalProcedureService } = canonical as {
  isFixedService: (svc: unknown) => boolean;
  isHourlyService: (svc: unknown) => boolean;
  isLegalProcedureService: (svc: unknown) => boolean;
};

const SHAPES = {
  hours: { type: 'hours', totalHours: 10 },
  fixed: { type: 'fixed', work: { totalMinutesWorked: 0 } },
  legalProcedureHourly: { type: 'legal_procedure', pricingType: 'hourly', stages: [] },
  legalProcedureFixed: { type: 'legal_procedure', pricingType: 'fixed', stages: [] }
};

describe('isFixedService — business classifier', () => {
  it('returns true for type=fixed', () => {
    expect(isFixedService(SHAPES.fixed)).toBe(true);
  });

  it('returns true for legal_procedure + pricingType=fixed', () => {
    expect(isFixedService(SHAPES.legalProcedureFixed)).toBe(true);
  });

  it('returns false for type=hours', () => {
    expect(isFixedService(SHAPES.hours)).toBe(false);
  });

  it('returns false for legal_procedure + pricingType=hourly', () => {
    expect(isFixedService(SHAPES.legalProcedureHourly)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isFixedService(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isFixedService(undefined)).toBe(false);
  });

  it('returns false for object missing type field', () => {
    expect(isFixedService({ pricingType: 'fixed' })).toBe(false);
  });

  it('returns false for non-object inputs', () => {
    expect(isFixedService('fixed')).toBe(false);
    expect(isFixedService(42)).toBe(false);
  });
});

describe('isHourlyService — business classifier', () => {
  it('returns true for type=hours', () => {
    expect(isHourlyService(SHAPES.hours)).toBe(true);
  });

  it('returns true for legal_procedure + pricingType=hourly', () => {
    expect(isHourlyService(SHAPES.legalProcedureHourly)).toBe(true);
  });

  it('returns false for type=fixed', () => {
    expect(isHourlyService(SHAPES.fixed)).toBe(false);
  });

  it('returns false for legal_procedure + pricingType=fixed', () => {
    expect(isHourlyService(SHAPES.legalProcedureFixed)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isHourlyService(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isHourlyService(undefined)).toBe(false);
  });

  it('returns false for legal_procedure with no pricingType (legacy data guard)', () => {
    expect(isHourlyService({ type: 'legal_procedure' })).toBe(false);
  });
});

describe('isLegalProcedureService — shape predicate', () => {
  it('returns true for legal_procedure + hourly', () => {
    expect(isLegalProcedureService(SHAPES.legalProcedureHourly)).toBe(true);
  });

  it('returns true for legal_procedure + fixed', () => {
    expect(isLegalProcedureService(SHAPES.legalProcedureFixed)).toBe(true);
  });

  it('returns false for type=hours', () => {
    expect(isLegalProcedureService(SHAPES.hours)).toBe(false);
  });

  it('returns false for type=fixed', () => {
    expect(isLegalProcedureService(SHAPES.fixed)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isLegalProcedureService(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isLegalProcedureService(undefined)).toBe(false);
  });
});

describe('predicates are mutually exclusive for fixed vs hourly classification', () => {
  it('every service shape is classified by exactly one of isFixedService XOR isHourlyService', () => {
    const allShapes = [SHAPES.hours, SHAPES.fixed, SHAPES.legalProcedureHourly, SHAPES.legalProcedureFixed];
    for (const svc of allShapes) {
      const fixed = isFixedService(svc);
      const hourly = isHourlyService(svc);
      expect(fixed !== hourly, `shape ${JSON.stringify(svc)} got fixed=${fixed} hourly=${hourly}`).toBe(true);
    }
  });
});
