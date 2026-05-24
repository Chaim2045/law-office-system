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

  test('Yom Kippur 2026 is on 2026-09-21 → closed (major fast)', () => {
    // PR-G.3.7: was '2026-09-20' (encoded the toISOString TZ bug on IL hosts).
    // Canonical: 10 Tishrei 5787 = Mon Sep 21, 2026 (per Chief Rabbinate luach).
    const h = getHolidaysForYear(2026);
    const yk = h.find(x => x.nameEn === 'Yom Kippur');
    expect(yk).toBeDefined();
    expect(yk.date).toBe('2026-09-21');
    expect(yk.isWorking).toBe(false);
  });

  test('Pesach I 2026 (2026-04-02) is closed', () => {
    // PR-G.3.7: was '2026-04-01' (TZ bug). Canonical: 15 Nisan 5786 = Thu Apr 2, 2026.
    const h = getHolidaysForYear(2026);
    const pesachI = h.find(x => x.date === '2026-04-02' && x.nameEn === 'Pesach I');
    expect(pesachI).toBeDefined();
    expect(pesachI.isWorking).toBe(false);
  });

  test('Chol HaMoed Pesach is working (2026-04-03 to 2026-04-07)', () => {
    // PR-G.3.7: Chol HaMoed window shifted by +1 day after TZ fix.
    const h = getHolidaysForYear(2026);
    const cholHaMoed = h.find(x => x.date === '2026-04-05' && x.type === 'cholhamoed');
    expect(cholHaMoed).toBeDefined();
    expect(cholHaMoed.isWorking).toBe(true);
  });

  test('Erev Pesach is FULL non-working day (PR-G.3.12 policy)', () => {
    // PR-G.3.12 (office policy 2026-05-20): "אין עבודה בערב חג".
    // Was: isHalfDay:true, isWorking:true (half-day).
    // Now: isHalfDay:false, isWorking:false (full closed).
    const h = getHolidaysForYear(2026);
    const eve = h.find(x => x.type === 'eve' && x.eveOf === 'Pesach');
    expect(eve).toBeDefined();
    expect(eve.isHalfDay).toBe(false);
    expect(eve.isWorking).toBe(false);
  });

  test('all eves of closed holidays are non-working (PR-G.3.12)', () => {
    const h = getHolidaysForYear(2026);
    const eves = h.filter(x => x.type === 'eve');
    expect(eves.length).toBeGreaterThan(3); // Pesach, Shavuot, RH, YK, Sukkot at minimum
    for (const eve of eves) {
      expect(eve.isWorking).toBe(false);
      expect(eve.isHalfDay).toBe(false);
    }
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
    // PR-G.3.7: was '2026-03-02' (TZ bug). Canonical: 14 Adar 5786 = Tue Mar 3, 2026.
    const h = getHolidaysForYear(2026);
    const purim = h.find(x => x.date === '2026-03-03' && x.nameEn === 'Purim');
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

  test('HEBCAL_VERSION is a real semver string', () => {
    // PR-G.3.7: previously could silently return 'unknown' when
    // require('@hebcal/core/package.json') failed under subpath-exports
    // restriction (Node ≥22). New impl uses fs walkup; must succeed.
    expect(typeof HEBCAL_VERSION).toBe('string');
    expect(HEBCAL_VERSION).not.toBe('unknown');
    expect(HEBCAL_VERSION).toMatch(/^\d+\.\d+\.\d+/);
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
    // PR-G.3.7: was '2026-09-20' (TZ bug). Canonical: YK 5787 = Mon Sep 21, 2026.
    expect(isWorkday('2026-09-21', map)).toBe(false);
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

  test('Erev Pesach → type: eve, FULL non-working (PR-G.3.12)', () => {
    // PR-G.3.7: was '2026-03-31' (TZ bug). Canonical: Erev Pesach = Wed Apr 1, 2026.
    // PR-G.3.12 (policy 2026-05-20): eve is FULL closed now (was half-day).
    const info = getDayInfo('2026-04-01', map);
    expect(info.type).toBe('eve');
    expect(info.isHalfDay).toBe(false);
    expect(info.isWorking).toBe(false);
    expect(info.eveOf).toBe('Pesach');
  });

  test('isWorkday: Erev Pesach → false (PR-G.3.12)', () => {
    // After PR-G.3.12, eves are non-working — isWorkday must reflect this.
    expect(isWorkday('2026-04-01', map)).toBe(false);
  });

  test('Pesach I → type: holiday, isWorking: false', () => {
    // PR-G.3.7: was '2026-04-01' (TZ bug). Canonical: Pesach I = Thu Apr 2, 2026.
    const info = getDayInfo('2026-04-02', map);
    expect(info.type).toBe('holiday');
    expect(info.isWorking).toBe(false);
  });

  test('Chol HaMoed → type: cholhamoed, isWorking: true', () => {
    // PR-G.3.7: was '2026-04-02' (TZ bug). Canonical: Pesach II/CHM = Fri Apr 3, 2026.
    // But Fri is "friday" — use Pesach III/CHM = Sat Apr 4... also weekend.
    // Pesach IV (CHM) = Sun Apr 5, 2026 — a working chol hamoed.
    const info = getDayInfo('2026-04-05', map);
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
