/**
 * Type-level + runtime tests for the Service discriminated union.
 *
 * Demonstrates:
 *   - Type guards correctly identify each variant at runtime
 *   - TypeScript narrows inside `if (isXxxService(s))` blocks
 *   - Exhaustiveness via `assertNever` (compile-time + runtime)
 *   - `isNonBillableService` matches canonical aggregate rules
 *   - Fixture-shaped data conforms to the interfaces
 *
 * These tests are TS-only — they validate the type design. They do NOT
 * test the JS runtime aggregates (covered separately by
 * `tests/unit/aggregates/calc-client-aggregates.test.ts`).
 */

import { describe, it, expect } from 'vitest';

import type {
  Service,
  HoursService,
  FixedService,
  LegalProcedureService,
  HoursPackage,
  ClientV2
} from '../../../types/services';
import {
  isHoursService,
  isFixedService,
  isLegalProcedureService,
  isNonBillableService,
  assertNever
} from '../../../types/services';

// ─── Fixtures ───────────────────────────────────────────────────

function makeHoursPackage(id: string, hours: number, hoursUsed: number = 0): HoursPackage {
  return {
    id,
    type: 'initial',
    hours,
    hoursUsed,
    hoursRemaining: hours - hoursUsed,
    status: 'active'
  };
}

function makeHoursService(id: string): HoursService {
  return {
    id,
    name: `שירות שעות ${id}`,
    status: 'active',
    type: 'hours',
    totalHours: 10,
    hoursUsed: 3,
    hoursRemaining: 7,
    packages: [makeHoursPackage(`${id}_pkg`, 10, 3)]
  };
}

function makeFixedService(id: string): FixedService {
  return {
    id,
    name: `שירות קבוע ${id}`,
    status: 'active',
    type: 'fixed',
    totalHours: 0,
    work: { totalMinutesWorked: 0, entriesCount: 0 }
  };
}

function makeLegalProcedureService(id: string, pricingType: 'hourly' | 'fixed' = 'hourly'): LegalProcedureService {
  return {
    id,
    name: `הליך משפטי ${id}`,
    status: 'active',
    type: 'legal_procedure',
    pricingType,
    stages: [
      {
        id: 'stage_a',
        name: "שלב א'",
        status: 'active',
        pricingType: 'hourly',
        order: 1,
        totalHours: 20,
        hoursUsed: 5,
        hoursRemaining: 15,
        packages: [makeHoursPackage('stage_a_pkg', 20, 5)]
      }
    ],
    totalHours: 20,
    hoursUsed: 5,
    hoursRemaining: 15
  };
}

// ═══════════════════════════════════════════════════════════════
// A. Type guards
// ═══════════════════════════════════════════════════════════════

describe('A. Type guards', () => {
  it('isHoursService → true for hours service, false for others', () => {
    expect(isHoursService(makeHoursService('s1'))).toBe(true);
    expect(isHoursService(makeFixedService('s1'))).toBe(false);
    expect(isHoursService(makeLegalProcedureService('s1'))).toBe(false);
  });

  it('isFixedService → true for fixed service only', () => {
    expect(isFixedService(makeFixedService('s1'))).toBe(true);
    expect(isFixedService(makeHoursService('s1'))).toBe(false);
    expect(isFixedService(makeLegalProcedureService('s1'))).toBe(false);
  });

  it('isLegalProcedureService → true for legal_procedure only', () => {
    expect(isLegalProcedureService(makeLegalProcedureService('s1'))).toBe(true);
    expect(isLegalProcedureService(makeHoursService('s1'))).toBe(false);
    expect(isLegalProcedureService(makeFixedService('s1'))).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// B. Compile-time narrowing
// ═══════════════════════════════════════════════════════════════

describe('B. TypeScript narrowing', () => {
  it('inside isHoursService block, access to packages is type-safe', () => {
    const services: Service[] = [
      makeHoursService('h1'),
      makeFixedService('f1'),
      makeLegalProcedureService('l1')
    ];

    let totalPackages = 0;
    for (const s of services) {
      if (isHoursService(s)) {
        // TS narrows s to HoursService here — .packages is HoursPackage[]
        totalPackages += s.packages.length;
      }
    }
    expect(totalPackages).toBe(1);
  });

  it('inside isFixedService block, .work is type-safe', () => {
    const s: Service = makeFixedService('f1');
    if (isFixedService(s)) {
      // s.work narrowed to WorkTracker
      expect(s.work.totalMinutesWorked).toBe(0);
      expect(s.work.entriesCount).toBe(0);
    } else {
      throw new Error('should have narrowed');
    }
  });

  it('inside isLegalProcedureService block, .stages is type-safe', () => {
    const s: Service = makeLegalProcedureService('l1');
    if (isLegalProcedureService(s)) {
      expect(s.stages).toHaveLength(1);
      expect(s.stages[0].name).toBe("שלב א'");
      expect(s.pricingType).toBe('hourly');
    } else {
      throw new Error('should have narrowed');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// C. Exhaustiveness via assertNever
// ═══════════════════════════════════════════════════════════════

describe('C. Exhaustiveness check', () => {
  it('switch over Service.type covers all variants', () => {
    function summarize(s: Service): string {
      switch (s.type) {
        case 'hours': return 'h:' + s.totalHours;
        case 'fixed': return 'f:' + s.work.totalMinutesWorked;
        case 'legal_procedure': return 'l:' + s.stages.length;
        default: return assertNever(s);
      }
    }
    expect(summarize(makeHoursService('a'))).toBe('h:10');
    expect(summarize(makeFixedService('b'))).toBe('f:0');
    expect(summarize(makeLegalProcedureService('c'))).toBe('l:1');
  });

  it('assertNever throws when fed an unexpected value at runtime', () => {
    expect(() => assertNever({} as never)).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════
// D. isNonBillableService matches canonical aggregate rules
// ═══════════════════════════════════════════════════════════════

describe('D. isNonBillableService — mirrors aggregates.js isFixedService', () => {
  it('FixedService → non-billable', () => {
    expect(isNonBillableService(makeFixedService('f1'))).toBe(true);
  });

  it('LegalProcedureService with pricingType=fixed → non-billable', () => {
    expect(isNonBillableService(makeLegalProcedureService('l1', 'fixed'))).toBe(true);
  });

  it('LegalProcedureService with pricingType=hourly → billable', () => {
    expect(isNonBillableService(makeLegalProcedureService('l1', 'hourly'))).toBe(false);
  });

  it('HoursService → billable', () => {
    expect(isNonBillableService(makeHoursService('h1'))).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// E. ClientV2 — structural shape
// ═══════════════════════════════════════════════════════════════

describe('E. ClientV2 shape', () => {
  it('accepts a fully-typed client with mixed services', () => {
    const client: ClientV2 = {
      id: 'c1',
      fullName: 'לקוח טסט',
      clientName: 'לקוח טסט',
      services: [
        makeHoursService('h1'),
        makeFixedService('f1'),
        makeLegalProcedureService('l1', 'hourly')
      ],
      totalHours: 30,
      hoursUsed: 8,
      hoursRemaining: 22,
      minutesUsed: 480,
      minutesRemaining: 1320,
      isBlocked: false,
      isCritical: false,
      status: 'active',
      _version: 5
    };

    expect(client.services).toHaveLength(3);
    expect(client.services.filter(isHoursService)).toHaveLength(1);
    expect(client.services.filter(isFixedService)).toHaveLength(1);
    expect(client.services.filter(isLegalProcedureService)).toHaveLength(1);
  });

  it('ClientV2 isBlocked / isCritical are typed booleans (helper-derived)', () => {
    // This compiles only because they are typed as boolean.
    // A non-boolean here would be a TS error.
    const isBlocked: boolean = true;
    const isCritical: boolean = false;
    const client: ClientV2 = {
      fullName: 'x',
      services: [],
      totalHours: 0,
      hoursUsed: 0,
      hoursRemaining: 0,
      minutesUsed: 0,
      minutesRemaining: 0,
      isBlocked,
      isCritical
    };
    expect(client.isBlocked).toBe(true);
    expect(client.isCritical).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// F. Filter helper using narrowing
// ═══════════════════════════════════════════════════════════════

describe('F. Array.filter with type-guard preserves narrowing', () => {
  it('filter(isHoursService) returns HoursService[]', () => {
    const services: Service[] = [
      makeHoursService('h1'),
      makeFixedService('f1'),
      makeHoursService('h2'),
      makeLegalProcedureService('l1')
    ];

    // TS narrows the returned array to HoursService[].
    const hoursOnly = services.filter(isHoursService);
    // Sum across hours-services packages — works because we have HoursService[].
    const totalPkgs = hoursOnly.reduce((sum, s) => sum + s.packages.length, 0);
    expect(totalPkgs).toBe(2);
  });
});
