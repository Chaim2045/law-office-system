/**
 * Tests for the pure `_mergeHolidaysArraysToMap` helper in
 * `apps/user-app/js/shared/holidays-cache.js` (PR-G.3.1).
 *
 * The cache itself is a classic script that subscribes to Firestore on boot.
 * Direct testing of the subscription path requires Firebase mocks — out of
 * scope for vitest unit tests. We test the merging helper only.
 *
 * Loaded into the test by evaluating the IIFE in a happy-dom window context
 * and reading the exposed `window.WORK_HOURS_HOLIDAYS_CACHE._test`.
 */

import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect, beforeAll } from 'vitest';

declare global {

  var WORK_HOURS_HOLIDAYS_CACHE: any;

  var WORK_HOURS_HOLIDAYS_MAP: Map<string, any>;

  var WORK_HOURS_HOLIDAYS_FALLBACK_USED: boolean;

  var firebase: any;
}

let merge: (arrays: Array<Array<any>>) => Map<string, any>;

beforeAll(() => {
  // Provide a stub firebase global so the IIFE's _init() bails out cleanly
  // (no Firestore subscribe attempt — but _test export still attached).
  (globalThis as any).firebase = undefined;

  const srcPath = path.resolve(
    process.cwd(),
    'apps/user-app/js/shared/holidays-cache.js'
  );
  const src = fs.readFileSync(srcPath, 'utf8');
  // Evaluate the IIFE in this context. The script attaches to window/global.
  // We use a Function constructor so it doesn't pollute module scope.

  new Function(src)();
  merge = (globalThis as any).WORK_HOURS_HOLIDAYS_CACHE._test.mergeHolidaysArraysToMap;
});

describe('PR-G.3.1 — _mergeHolidaysArraysToMap', () => {
  it('returns empty Map for empty input', () => {
    const m = merge([]);
    expect(m).toBeInstanceOf(Map);
    expect(m.size).toBe(0);
  });

  it('handles single-year arrays', () => {
    const arr = [
      { date: '2026-04-02', type: 'holiday', isWorking: false, isHalfDay: false, eveOf: null },
      { date: '2026-02-02', type: 'minor', isWorking: true, isHalfDay: false, eveOf: null }
    ];
    const m = merge([arr]);
    expect(m.size).toBe(2);
    expect(m.get('2026-04-02').isWorking).toBe(false);
    expect(m.get('2026-02-02').isWorking).toBe(true);
  });

  it('merges multiple years into one Map', () => {
    const arr2026 = [{ date: '2026-04-02', type: 'holiday', isWorking: false, isHalfDay: false, eveOf: null }];
    const arr2027 = [{ date: '2027-04-22', type: 'holiday', isWorking: false, isHalfDay: false, eveOf: null }];
    const m = merge([arr2026, arr2027]);
    expect(m.size).toBe(2);
    expect(m.get('2026-04-02')).toBeDefined();
    expect(m.get('2027-04-22')).toBeDefined();
  });

  it('closed-day wins over open-day on same date', () => {
    const arr = [
      { date: '2026-04-02', type: 'minor', isWorking: true, isHalfDay: false, eveOf: null },
      { date: '2026-04-02', type: 'holiday', isWorking: false, isHalfDay: false, eveOf: null }
    ];
    const m = merge([arr]);
    expect(m.get('2026-04-02').isWorking).toBe(false);
    expect(m.get('2026-04-02').type).toBe('holiday');
  });

  it('eve (half-day) wins over open-day on same date', () => {
    const arr = [
      { date: '2026-03-02', type: 'minor', isWorking: true, isHalfDay: false, eveOf: null },
      { date: '2026-03-02', type: 'eve', isWorking: true, isHalfDay: true, eveOf: 'Purim' }
    ];
    const m = merge([arr]);
    expect(m.get('2026-03-02').isHalfDay).toBe(true);
    expect(m.get('2026-03-02').eveOf).toBe('Purim');
  });

  it('closed-day wins over eve on same date', () => {
    const arr = [
      { date: '2026-04-01', type: 'eve', isWorking: true, isHalfDay: true, eveOf: 'Pesach' },
      { date: '2026-04-01', type: 'holiday', isWorking: false, isHalfDay: false, eveOf: null }
    ];
    const m = merge([arr]);
    expect(m.get('2026-04-01').isWorking).toBe(false);
    expect(m.get('2026-04-01').type).toBe('holiday');
  });

  it('ignores null/undefined arrays and entries', () => {
    const m = merge([null as any, [{ date: '2026-04-02', isWorking: false } as any], undefined as any, [null as any]]);
    expect(m.size).toBe(1);
  });

  it('skips entries without date string', () => {
    const arr = [
      { date: '2026-04-02', isWorking: false } as any,
      { isWorking: true } as any,
      { date: null } as any,
      { date: 123 } as any
    ];
    const m = merge([arr]);
    expect(m.size).toBe(1);
  });
});

describe('PR-G.3.1 — embedded fallback', () => {
  it('EMBEDDED_FALLBACK_2026 is non-empty array', () => {
    const fb = (globalThis as any).WORK_HOURS_HOLIDAYS_CACHE._test.EMBEDDED_FALLBACK_2026;
    expect(Array.isArray(fb)).toBe(true);
    expect(fb.length).toBeGreaterThan(40);
  });

  it('fallback includes Pesach I (closed)', () => {
    const fb = (globalThis as any).WORK_HOURS_HOLIDAYS_CACHE._test.EMBEDDED_FALLBACK_2026;
    const pesachI = fb.find((h: any) => h.nameEn === 'Pesach I');
    expect(pesachI).toBeDefined();
    expect(pesachI.isWorking).toBe(false);
  });

  it('fallback includes Yom Kippur (closed)', () => {
    const fb = (globalThis as any).WORK_HOURS_HOLIDAYS_CACHE._test.EMBEDDED_FALLBACK_2026;
    const yk = fb.find((h: any) => h.nameEn === 'Yom Kippur');
    expect(yk).toBeDefined();
    expect(yk.isWorking).toBe(false);
  });

  it('fallback includes Yom HaAtzma\'ut (closed memorial)', () => {
    const fb = (globalThis as any).WORK_HOURS_HOLIDAYS_CACHE._test.EMBEDDED_FALLBACK_2026;
    const yha = fb.find((h: any) => h.nameEn.includes('Yom HaAtzma'));
    expect(yha).toBeDefined();
    expect(yha.isWorking).toBe(false);
  });

  it('fallback includes Chanukah (working holiday)', () => {
    const fb = (globalThis as any).WORK_HOURS_HOLIDAYS_CACHE._test.EMBEDDED_FALLBACK_2026;
    const chanukah = fb.find((h: any) => h.nameEn.toLowerCase().includes('chanukah'));
    expect(chanukah).toBeDefined();
    expect(chanukah.isWorking).toBe(true);
  });
});
