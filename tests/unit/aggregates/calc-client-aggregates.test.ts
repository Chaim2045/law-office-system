/**
 * Unit Tests - calcClientAggregates (canonical)
 *
 * Tests the canonical implementation in functions/shared/aggregates.js.
 *
 * Critical invariants tested:
 *   1. billable.length === 0 → isBlocked=false (even if totalHours=null/0)
 *   2. overrideActive → isBlocked=false (bypass)
 *   3. overdraftResolved.isResolved → isBlocked=false (bypass)
 *   4. legal_procedure + pricingType=fixed → treated as fixed (not billable)
 *   5. legal_procedure + pricingType=hourly → treated as billable
 *
 * Also runs verification against 21 real production client fixtures
 * (the 21 blocked-by-bug clients identified in audit 2026-05-13).
 *
 * Created: 2026-05-13 as part of refactor for blocked-clients-bug fix.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { describe, it, expect } from 'vitest';

// @ts-ignore — CommonJS require from TypeScript ESM test
import {
  calcClientAggregates,
  isFixedService,
  assertClientAggregateInvariants
} from '../../../functions/shared/aggregates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== Firestore REST → plain JS helper =====
function unwrap(v: any): any {
  if (!v || typeof v !== 'object') {
return v;
}
  if ('stringValue' in v) {
return v.stringValue;
}
  if ('integerValue' in v) {
return parseInt(v.integerValue, 10);
}
  if ('doubleValue' in v) {
return parseFloat(v.doubleValue);
}
  if ('booleanValue' in v) {
return v.booleanValue;
}
  if ('timestampValue' in v) {
return v.timestampValue;
}
  if ('nullValue' in v) {
return null;
}
  if ('arrayValue' in v) {
return (v.arrayValue.values || []).map(unwrap);
}
  if ('mapValue' in v) {
    const obj: any = {};
    for (const [k, val] of Object.entries(v.mapValue.fields || {})) {
      obj[k] = unwrap(val);
    }
    return obj;
  }
  return v;
}

function parseFirestoreDoc(rawDoc: any): any {
  const client: any = {};
  for (const [k, v] of Object.entries(rawDoc.fields || {})) {
    client[k] = unwrap(v);
  }
  return client;
}

describe('calcClientAggregates — INVARIANT: billable.length === 0 → isBlocked=false', () => {
  it('returns isBlocked=false for client with no services at all', () => {
    const result = calcClientAggregates([], 0);
    expect(result.isBlocked).toBe(false);
    expect(result.isCritical).toBe(false);
  });

  it('returns isBlocked=false for client with only fixed services (type=fixed)', () => {
    const services = [
      { type: 'fixed', fixedPrice: 5000, hoursUsed: 0 },
      { type: 'fixed', fixedPrice: 3000, hoursUsed: 0 }
    ];
    const result = calcClientAggregates(services, 0);
    expect(result.isBlocked).toBe(false);
  });

  it('returns isBlocked=false for legal_procedure + pricingType=fixed (Binyamingold case)', () => {
    const services = [
      {
        type: 'legal_procedure',
        pricingType: 'fixed',
        stages: [
          { fixedPrice: 35000 },
          { fixedPrice: 35000 },
          { fixedPrice: 35000 }
        ]
      }
    ];
    const result = calcClientAggregates(services, 0);
    expect(result.isBlocked).toBe(false);
  });

  it('returns isBlocked=false for mix of fixed types when no billable hours', () => {
    const services = [
      { type: 'fixed', fixedPrice: 2000 },
      { type: 'legal_procedure', pricingType: 'fixed', stages: [{ fixedPrice: 30000 }] }
    ];
    const result = calcClientAggregates(services, 0);
    expect(result.isBlocked).toBe(false);
  });

  it('handles client.totalHours=null without crashing', () => {
    const services = [{ type: 'fixed', fixedPrice: 5000 }];
    const result = calcClientAggregates(services, null as any);
    expect(result.isBlocked).toBe(false);
  });

  it('handles client.totalHours=undefined without crashing', () => {
    const services = [{ type: 'fixed', fixedPrice: 5000 }];
    const result = calcClientAggregates(services, undefined as any);
    expect(result.isBlocked).toBe(false);
  });
});

describe('calcClientAggregates — BILLABLE SERVICES', () => {
  it('returns isBlocked=true when billable service has no remaining hours', () => {
    const services = [{ type: 'hours', totalHours: 10, hoursUsed: 10 }];
    const result = calcClientAggregates(services, 10);
    expect(result.isBlocked).toBe(true);
    expect(result.hoursRemaining).toBe(0);
  });

  it('returns isBlocked=false when billable service has remaining hours', () => {
    const services = [{ type: 'hours', totalHours: 70, hoursUsed: 0 }];
    const result = calcClientAggregates(services, 70);
    expect(result.isBlocked).toBe(false);
    expect(result.hoursRemaining).toBe(70);
  });

  it('returns isCritical=true when remainingHours <= 5 but > 0', () => {
    const services = [{ type: 'hours', totalHours: 10, hoursUsed: 7 }];
    const result = calcClientAggregates(services, 10);
    expect(result.isBlocked).toBe(false);
    expect(result.isCritical).toBe(true);
  });
});

describe('calcClientAggregates — OVERRIDE BYPASS', () => {
  it('overrideActive=true bypasses isBlocked even when hours depleted', () => {
    const services = [{
      type: 'hours',
      totalHours: 10,
      hoursUsed: 10,
      overrideActive: true
    }];
    const result = calcClientAggregates(services, 10);
    expect(result.isBlocked).toBe(false);
  });

  it('overdraftResolved.isResolved=true bypasses isBlocked', () => {
    const services = [{
      type: 'hours',
      totalHours: 10,
      hoursUsed: 12,
      overdraftResolved: { isResolved: true }
    }];
    const result = calcClientAggregates(services, 10);
    expect(result.isBlocked).toBe(false);
  });
});

describe('assertClientAggregateInvariants — fail-fast guard', () => {
  it('throws on I1 violation: no billable services but isBlocked=true', () => {
    const services = [{ type: 'fixed', fixedPrice: 5000 }];
    expect(() => assertClientAggregateInvariants(
      services,
      { isBlocked: true, isCritical: false },
      'test'
    )).toThrow(/invariant_violation:I1_no_billable_but_blocked/);
  });

  it('throws on I1 violation: no billable services but isCritical=true', () => {
    const services: any[] = [];
    expect(() => assertClientAggregateInvariants(
      services,
      { isBlocked: false, isCritical: true },
      'test'
    )).toThrow(/invariant_violation:I1_no_billable_but_critical/);
  });

  it('throws on I2 violation: override active but isBlocked=true', () => {
    const services = [
      { type: 'hours', totalHours: 10, hoursUsed: 15, overrideActive: true }
    ];
    expect(() => assertClientAggregateInvariants(
      services,
      { isBlocked: true, isCritical: false },
      'test'
    )).toThrow(/invariant_violation:I2_override_active_but_blocked/);
  });

  it('throws on I4 violation: both isBlocked=true and isCritical=true', () => {
    const services = [{ type: 'hours', totalHours: 10, hoursUsed: 10 }];
    expect(() => assertClientAggregateInvariants(
      services,
      { isBlocked: true, isCritical: true },
      'test'
    )).toThrow(/invariant_violation:I4_blocked_and_critical/);
  });

  it('passes for valid state: billable service depleted, no override, blocked=true', () => {
    const services = [{ type: 'hours', totalHours: 10, hoursUsed: 10 }];
    expect(() => assertClientAggregateInvariants(
      services,
      { isBlocked: true, isCritical: false },
      'test'
    )).not.toThrow();
  });

  it('passes for valid state: fixed-only client, blocked=false', () => {
    const services = [{ type: 'fixed', fixedPrice: 5000 }];
    expect(() => assertClientAggregateInvariants(
      services,
      { isBlocked: false, isCritical: false },
      'test'
    )).not.toThrow();
  });

  it('canonical output always passes invariant check (round-trip test)', () => {
    const testCases = [
      { services: [], totalHours: 0 },
      { services: [{ type: 'fixed' }], totalHours: 0 },
      { services: [{ type: 'hours', totalHours: 10, hoursUsed: 5 }], totalHours: 10 },
      { services: [{ type: 'hours', totalHours: 10, hoursUsed: 10 }], totalHours: 10 },
      { services: [{ type: 'hours', totalHours: 10, hoursUsed: 10, overrideActive: true }], totalHours: 10 },
      { services: [
          { type: 'fixed' },
          { type: 'legal_procedure', pricingType: 'fixed' }
        ], totalHours: 0 }
    ];

    for (const tc of testCases) {
      const agg = calcClientAggregates(tc.services as any, tc.totalHours);
      expect(() => assertClientAggregateInvariants(
        tc.services as any,
        agg,
        'round-trip'
      )).not.toThrow();
    }
  });
});

describe('calcClientAggregates — REAL PRODUCTION FIXTURES (21 blocked clients)', () => {
  const fixturesDir = path.join(__dirname, '..', '..', '..', 'test-fixtures', 'problem-clients');
  const hasFixtures = fs.existsSync(fixturesDir);

  // Fixtures contain real production client data (case numbers, names, hours).
  // They are gitignored — not committed. To regenerate locally:
  //   See test-fixtures/README.md (or the audit doc).
  // CI runs without fixtures; these tests skip cleanly.

  it.skipIf(!hasFixtures)('20 of 21 production fixtures will be unblocked by canonical (no regressions)', () => {
    const files = fs.readdirSync(fixturesDir).filter(f => f.endsWith('.json'));

    expect(files.length).toBe(21);

    let unblocked = 0;
    let stillBlocked = 0;
    let regressions = 0;

    for (const file of files) {
      const raw = JSON.parse(fs.readFileSync(path.join(fixturesDir, file), 'utf-8'));
      const client = parseFirestoreDoc(raw);
      const dbIsBlocked = client.isBlocked === true;

      const agg = calcClientAggregates(client.services || [], client.totalHours);
      const canonicalIsBlocked = agg.isBlocked === true;

      if (dbIsBlocked && !canonicalIsBlocked) {
unblocked++;
} else if (dbIsBlocked && canonicalIsBlocked) {
stillBlocked++;
} else if (!dbIsBlocked && canonicalIsBlocked) {
regressions++;
}
    }

    expect(regressions).toBe(0);    // critical: no client newly blocked
    expect(unblocked).toBe(20);     // 20 fixed-only clients get unblocked
    expect(stillBlocked).toBe(1);   // Binyamingold (needs data fix)
  });

  it.skipIf(!hasFixtures)('Binyamingold (2025996) still blocked due to client.totalHours=null bug', () => {
    const raw = JSON.parse(fs.readFileSync(
      path.join(fixturesDir, '2025996.json'),
      'utf-8'
    ));
    const client = parseFirestoreDoc(raw);

    // client.totalHours is missing from the document (not even set to null);
    // canonical treats undefined as 0 (safeTotalHours fallback).
    const isNullish = client.totalHours === null || client.totalHours === undefined;
    expect(isNullish).toBe(true);
    expect(client.services.length).toBe(2);

    const billable = client.services.filter((s: any) => !isFixedService(s));
    expect(billable.length).toBe(1);  // הליך ביהמש עליון
    expect(billable[0].totalHours).toBe(70);

    const agg = calcClientAggregates(client.services, client.totalHours);
    expect(agg.isBlocked).toBe(true);  // confirmed: still blocked

    // The fix for him is at the data level: client.totalHours must be 70 (sum of billable.totalHours).
    // This test documents the bug for the reconciliation step.
  });
});
