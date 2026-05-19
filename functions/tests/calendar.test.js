/**
 * Tests for `functions/shared/calendar.js` (PR-G.1).
 *
 * Deterministic — uses real `@hebcal/core` (offline, no network).
 */

const {
  getHolidaysForYear,
  buildHolidaysMap,
  isWorkday,
  getDayInfo,
  HEBCAL_VERSION,
  _test
} = require('../shared/calendar');

describe('PR-G.1 — getHolidaysForYear', () => {
  test('returns a non-empty array for 2026', () => {
    const h = getHolidaysForYear(2026);
    expect(h.length).toBeGreaterThan(20);
    expect(h.length).toBeLessThan(80);
  });

  test('Rosh Hashana 2026 is on 2026-09-12 (5787) → closed', () => {
    const h = getHolidaysForYear(2026);
    const rh = h.find(x => x.date === '2026-09-12' && x.nameEn.includes('Rosh Hashana'));
    expect(rh).toBeDefined();
    expect(rh.isWorking).toBe(false);
    expect(rh.type).toBe('holiday');
  });

  test('Yom Kippur 2026 is on 2026-09-20 → closed (major fast)', () => {
    const h = getHolidaysForYear(2026);
    // Find non-Erev Yom Kippur entry
    const yk = h.find(x => x.nameEn === 'Yom Kippur');
    expect(yk).toBeDefined();
    expect(yk.date).toBe('2026-09-20');
    expect(yk.isWorking).toBe(false);
  });

  test('Pesach I 2026 (2026-04-01) is closed', () => {
    const h = getHolidaysForYear(2026);
    const pesachI = h.find(x => x.date === '2026-04-01' && x.nameEn === 'Pesach I');
    expect(pesachI).toBeDefined();
    expect(pesachI.isWorking).toBe(false);
  });

  test('Chol HaMoed Pesach is working (2026-04-03 to 2026-04-07)', () => {
    const h = getHolidaysForYear(2026);
    const cholHaMoed = h.find(x => x.date === '2026-04-04' && x.type === 'cholhamoed');
    expect(cholHaMoed).toBeDefined();
    expect(cholHaMoed.isWorking).toBe(true);
  });

  test('Erev Pesach is half-day', () => {
    const h = getHolidaysForYear(2026);
    const eve = h.find(x => x.type === 'eve' && x.eveOf === 'Pesach');
    expect(eve).toBeDefined();
    expect(eve.isHalfDay).toBe(true);
    expect(eve.isWorking).toBe(true);
  });

  test('Chanukah is a working holiday', () => {
    const h = getHolidaysForYear(2026);
    const chanukah = h.find(x => x.nameEn.toLowerCase().includes('chanukah'));
    expect(chanukah).toBeDefined();
    expect(chanukah.isWorking).toBe(true);
  });

  test('Yom HaAtzma\'ut 2026 → closed (modern memorial)', () => {
    const h = getHolidaysForYear(2026);
    const yha = h.find(x => x.nameEn.includes("Yom HaAtzma'ut") || x.nameEn.includes("Yom HaAtzma"));
    expect(yha).toBeDefined();
    expect(yha.isWorking).toBe(false);
    expect(yha.type).toBe('memorial');
  });

  test('Purim is closed (minor by Hebcal, closed by office policy)', () => {
    const h = getHolidaysForYear(2026);
    const purim = h.find(x => x.date === '2026-03-02' && x.nameEn === 'Purim');
    expect(purim).toBeDefined();
    expect(purim.isWorking).toBe(false);
  });

  test('Tu BiShvat (minor, not in office closed list) → working', () => {
    const h = getHolidaysForYear(2026);
    const tu = h.find(x => x.nameEn.includes('Tu BiShvat'));
    expect(tu).toBeDefined();
    expect(tu.isWorking).toBe(true);
  });

  test('rejects invalid year input', () => {
    expect(() => getHolidaysForYear(1800)).toThrow();
    expect(() => getHolidaysForYear('2026')).toThrow();
    expect(() => getHolidaysForYear(null)).toThrow();
  });

  test('HEBCAL_VERSION is defined string', () => {
    expect(typeof HEBCAL_VERSION).toBe('string');
    expect(HEBCAL_VERSION.length).toBeGreaterThan(0);
  });
});

describe('PR-G.1 — buildHolidaysMap', () => {
  test('returns a Map indexed by dateISO', () => {
    const h = getHolidaysForYear(2026);
    const m = buildHolidaysMap(h);
    expect(m instanceof Map).toBe(true);
    expect(m.get('2026-04-02')).toBeDefined();
  });

  test('closed entry wins over eve entry on the same date (if any)', () => {
    // Synthetic
    const m = buildHolidaysMap([
      { date: '2026-01-01', isWorking: true, isHalfDay: true, eveOf: 'Foo', type: 'eve' },
      { date: '2026-01-01', isWorking: false, isHalfDay: false, eveOf: null, type: 'holiday' }
    ]);
    expect(m.get('2026-01-01').isWorking).toBe(false);
  });
});

describe('PR-G.1 — isWorkday', () => {
  let map;

  beforeAll(() => {
    map = buildHolidaysMap(getHolidaysForYear(2026));
  });

  test('Monday workday (no holiday) → true', () => {
    // 2026-05-18 is Monday, no holiday
    expect(isWorkday('2026-05-18', map)).toBe(true);
  });

  test('Friday → false (weekend)', () => {
    // 2026-05-15 is Friday
    expect(isWorkday('2026-05-15', map)).toBe(false);
  });

  test('Saturday → false', () => {
    // 2026-05-16 is Saturday
    expect(isWorkday('2026-05-16', map)).toBe(false);
  });

  test('Rosh Hashana → false (closed holiday on a weekday)', () => {
    // 2026-09-12 is RH 1 (Saturday actually — but RH is closed in any case)
    expect(isWorkday('2026-09-12', map)).toBe(false);
  });

  test('Yom Kippur → false', () => {
    // 2026-09-20 is YK (Sunday)
    expect(isWorkday('2026-09-20', map)).toBe(false);
  });

  test('Chol HaMoed Pesach (Sunday) → true (working)', () => {
    // 2026-04-05 is Sunday, Chol HaMoed Pesach V
    expect(isWorkday('2026-04-05', map)).toBe(true);
  });

  test('Tu BiShvat on weekday → true (minor)', () => {
    // 2026-02-01 is Tu BiShvat (Sunday actually). Sun is workday in IL.
    const dow = _test._dayOfWeekUTC('2026-02-01');
    if (dow !== 5 && dow !== 6) {
      expect(isWorkday('2026-02-01', map)).toBe(true);
    }
  });

  test('Christmas (Gregorian) → true (not a holiday in IL)', () => {
    // 2026-12-25 is Friday → false because weekend
    // Use 2026-12-29 (Tuesday) instead
    expect(isWorkday('2026-12-29', map)).toBe(true);
  });

  test('without holidaysMap → only weekend check (no holiday detection)', () => {
    // 2026-09-22 (Tue, day after YK) — no holiday — fallback true
    expect(isWorkday('2026-09-22')).toBe(true);
    expect(isWorkday('2026-05-15')).toBe(false); // Friday is still false
  });
});

describe('PR-G.1 — getDayInfo', () => {
  let map;

  beforeAll(() => {
    map = buildHolidaysMap(getHolidaysForYear(2026));
  });

  test('Erev Pesach → type: eve, isHalfDay: true', () => {
    // 2026-03-31 is Erev Pesach (Tuesday)
    const info = getDayInfo('2026-03-31', map);
    expect(info.type).toBe('eve');
    expect(info.isHalfDay).toBe(true);
    expect(info.eveOf).toBe('Pesach');
  });

  test('Pesach I → type: holiday, isWorking: false', () => {
    // 2026-04-01 is Pesach I (Wednesday)
    const info = getDayInfo('2026-04-01', map);
    expect(info.type).toBe('holiday');
    expect(info.isWorking).toBe(false);
  });

  test('Chol HaMoed → type: cholhamoed, isWorking: true', () => {
    // 2026-04-02 is Pesach II / Chol HaMoed (Thursday)
    const info = getDayInfo('2026-04-02', map);
    expect(info.type).toBe('cholhamoed');
    expect(info.isWorking).toBe(true);
  });

  test('Friday → type: friday', () => {
    const info = getDayInfo('2026-05-15', map);
    expect(info.type).toBe('friday');
    expect(info.isWorking).toBe(false);
  });

  test('Saturday → type: saturday', () => {
    const info = getDayInfo('2026-05-16', map);
    expect(info.type).toBe('saturday');
    expect(info.isWorking).toBe(false);
  });

  test('Normal Monday → type: normal, isWorking: true', () => {
    const info = getDayInfo('2026-05-18', map);
    expect(info.type).toBe('normal');
    expect(info.isWorking).toBe(true);
  });
});

describe('PR-G.1 — forward years (5+ years ahead)', () => {
  test('2030 returns reasonable count', () => {
    const h = getHolidaysForYear(2030);
    expect(h.length).toBeGreaterThan(20);
  });

  test('2031 — major holidays present', () => {
    const h = getHolidaysForYear(2031);
    const rh = h.find(x => x.nameEn.includes('Rosh Hashana'));
    const yk = h.find(x => x.nameEn.includes('Yom Kippur'));
    expect(rh).toBeDefined();
    expect(yk).toBeDefined();
  });
});
