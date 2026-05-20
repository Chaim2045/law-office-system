/**
 * Tests for WorkHoursCalculator.isWorkDay after PR-G.3.2 integration.
 *
 * Verifies that:
 *   - isWorkDay returns false for closed holidays (Pesach I, Yom Kippur)
 *   - isWorkDay returns false for eves (per policy 2026-05-20: אין עבודה בערב חג)
 *   - isWorkDay returns true for working holidays (Chanukah)
 *   - isWorkDay returns false for Friday/Saturday regardless of map
 *   - isWorkDay returns true for normal weekdays with no map entry
 *   - Constructor does not throw with empty map (graceful degradation)
 *
 * Loaded by evaluating both classic-script files (holidays-cache.js + work-hours-calculator.js)
 * in the test context.
 */

import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect, beforeAll } from 'vitest';

declare global {

  var WorkHoursCalculator: any;

  var WORK_HOURS_HOLIDAYS_MAP: Map<string, any>;

  var WORK_HOURS_HOLIDAYS_CACHE: any;

  var WORK_HOURS_CONSTANTS: any;

  var firebase: any;
}

beforeAll(() => {
  // Stub firebase so holidays-cache._init() bails out cleanly (no real subscription)
  (globalThis as any).firebase = undefined;

  const root = process.cwd();
  // Order matters: constants → cache → calculator
  const constants = fs.readFileSync(
    path.resolve(root, 'apps/user-app/js/shared/work-hours-constants.js'),
    'utf8'
  );
  const cache = fs.readFileSync(
    path.resolve(root, 'apps/user-app/js/shared/holidays-cache.js'),
    'utf8'
  );
  const calculator = fs.readFileSync(
    path.resolve(root, 'apps/user-app/js/modules/work-hours-calculator.js'),
    'utf8'
  );


  new Function(constants)();

  new Function(cache)();

  new Function(calculator)();
});

describe('PR-G.3.2 — WorkHoursCalculator.isWorkDay with holidays map', () => {
  it('constructor does not throw with empty holidays map', () => {
    // Empty map state (no setMap called)
    expect((globalThis as any).WORK_HOURS_HOLIDAYS_MAP.size).toBe(0);
    expect(() => new (globalThis as any).WorkHoursCalculator()).not.toThrow();
  });

  it('isWorkDay returns true for normal weekday with empty map', () => {
    const c = new (globalThis as any).WorkHoursCalculator();
    // 2026-05-18 is Monday — no entry in (empty) map → workday
    expect(c.isWorkDay(new Date(2026, 4, 18))).toBe(true);
  });

  it('isWorkDay returns false for Friday regardless of map', () => {
    const c = new (globalThis as any).WorkHoursCalculator();
    // 2026-05-15 is Friday
    expect(c.isWorkDay(new Date(2026, 4, 15))).toBe(false);
  });

  it('isWorkDay returns false for Saturday regardless of map', () => {
    const c = new (globalThis as any).WorkHoursCalculator();
    // 2026-05-16 is Saturday
    expect(c.isWorkDay(new Date(2026, 4, 16))).toBe(false);
  });

  it('isWorkDay returns false for closed holiday after setMap', () => {
    const map = new Map();
    map.set('2026-04-02', { date: '2026-04-02', nameHe: 'פֶּסַח א׳', nameEn: 'Pesach I', isWorking: false, isHalfDay: false, eveOf: null });
    (globalThis as any).WORK_HOURS_HOLIDAYS_CACHE._test.setMap(map);
    const c = new (globalThis as any).WorkHoursCalculator();
    // 2026-04-02 (Thursday) — Pesach I
    expect(c.isWorkDay(new Date(2026, 3, 2))).toBe(false);
  });

  it('isWorkDay returns false for eve (per policy 2026-05-20: אין עבודה בערב חג)', () => {
    const map = new Map();
    map.set('2026-04-01', { date: '2026-04-01', nameHe: 'עֶרֶב פֶּסַח', nameEn: 'Erev Pesach', isWorking: true, isHalfDay: true, eveOf: 'Pesach' });
    (globalThis as any).WORK_HOURS_HOLIDAYS_CACHE._test.setMap(map);
    const c = new (globalThis as any).WorkHoursCalculator();
    // 2026-04-01 (Wednesday) — Erev Pesach
    expect(c.isWorkDay(new Date(2026, 3, 1))).toBe(false);
  });

  it('isWorkDay returns true for working holiday (Chanukah)', () => {
    const map = new Map();
    map.set('2026-12-08', { date: '2026-12-08', nameHe: 'חֲנוּכָּה', nameEn: 'Chanukah: 5 Candles', isWorking: true, isHalfDay: false, eveOf: null });
    (globalThis as any).WORK_HOURS_HOLIDAYS_CACHE._test.setMap(map);
    const c = new (globalThis as any).WorkHoursCalculator();
    // 2026-12-08 (Tuesday) — Chanukah, working
    expect(c.isWorkDay(new Date(2026, 11, 8))).toBe(true);
  });

  it('isHoliday + getHolidayName work for closed holiday', () => {
    const map = new Map();
    map.set('2026-09-21', { date: '2026-09-21', nameHe: 'יוֹם כִּפּוּר', nameEn: 'Yom Kippur', isWorking: false, isHalfDay: false, eveOf: null });
    (globalThis as any).WORK_HOURS_HOLIDAYS_CACHE._test.setMap(map);
    const c = new (globalThis as any).WorkHoursCalculator();
    expect(c.isHoliday(new Date(2026, 8, 21))).toBe(true);
    expect(c.getHolidayName(new Date(2026, 8, 21))).toBe('יוֹם כִּפּוּר');
  });

  it('isHoliday returns false + getHolidayName returns null for normal weekday', () => {
    const map = new Map();
    map.set('2026-04-02', { date: '2026-04-02', nameHe: 'פֶּסַח א׳', nameEn: 'Pesach I', isWorking: false, isHalfDay: false, eveOf: null });
    (globalThis as any).WORK_HOURS_HOLIDAYS_CACHE._test.setMap(map);
    const c = new (globalThis as any).WorkHoursCalculator();
    // 2026-05-18 — Monday, not a holiday
    expect(c.isHoliday(new Date(2026, 4, 18))).toBe(false);
    expect(c.getHolidayName(new Date(2026, 4, 18))).toBeNull();
  });

  it('live-read: instance picks up map updates without re-construction', () => {
    const map1 = new Map();
    (globalThis as any).WORK_HOURS_HOLIDAYS_CACHE._test.setMap(map1);
    const c = new (globalThis as any).WorkHoursCalculator();
    // No entry yet → workday
    expect(c.isWorkDay(new Date(2026, 8, 21))).toBe(true);

    // Admin "edits" — fresh map with YK
    const map2 = new Map();
    map2.set('2026-09-21', { date: '2026-09-21', nameHe: 'יוֹם כִּפּוּר', isWorking: false, isHalfDay: false, eveOf: null });
    (globalThis as any).WORK_HOURS_HOLIDAYS_CACHE._test.setMap(map2);

    // Same instance — should now return false (live-read pattern)
    expect(c.isWorkDay(new Date(2026, 8, 21))).toBe(false);
  });
});

describe('PR-G.3.2 — holidays:loaded event', () => {
  it('setMap fires holidays:loaded event', () => {
    const listener = (): void => {
      received = true;
    };
    let received = false;
    (globalThis as any).addEventListener('holidays:loaded', listener);
    const map = new Map();
    map.set('2027-01-01', { date: '2027-01-01', isWorking: false, isHalfDay: false });
    (globalThis as any).WORK_HOURS_HOLIDAYS_CACHE._test.setMap(map);
    (globalThis as any).removeEventListener('holidays:loaded', listener);
    expect(received).toBe(true);
  });
});
