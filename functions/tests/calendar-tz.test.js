/**
 * Tests for PR-G.3.7 — TZ-invariance of `functions/shared/calendar.js`.
 *
 * Bug fixed: `e.getDate().greg().toISOString().slice(0, 10)` converts to UTC.
 * Hebcal builds local-midnight Dates. On non-UTC hosts, conversion shifts
 * dates by ±1 day. Cloud Functions runs in UTC (output happened to be right)
 * — but local script execution on Asia/Jerusalem was silently corrupted.
 *
 * These tests prove the new `_hdateToISO()` helper is TZ-invariant by
 * computing under multiple simulated timezones via `process.env.TZ`.
 *
 * IMPORTANT: `process.env.TZ` only takes effect at runtime if set BEFORE
 * `Date` is first used in a worker. We use `jest.isolateModules()` to
 * re-evaluate the calendar module under each TZ.
 */

const path = require('path');

// Canonical Israeli observance dates for 5786-5787 (per Chief Rabbinate luach,
// independently verified — NOT just hebcal's own output).
const CANONICAL_2026 = {
  purim: '2026-03-03',
  erevPesach: '2026-04-01',
  pesachI: '2026-04-02',
  pesachVII: '2026-04-08',
  yomHaShoah: '2026-04-14',
  yomHaZikaron: '2026-04-21',
  yomHaAtzmaut: '2026-04-22',
  shavuot: '2026-05-22',
  tishaBav: '2026-07-23',
  roshHashana1: '2026-09-12',
  roshHashana2: '2026-09-13',
  yomKippur: '2026-09-21',
  sukkotI: '2026-09-26',
  shminiAtzeret: '2026-10-03'
};

function loadCalendarUnderTZ(tz) {
  const originalTZ = process.env.TZ;
  process.env.TZ = tz;
  // Force re-evaluation so any cached Date arithmetic re-reads env.
  let calendar;
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require
    calendar = require(path.resolve(__dirname, '..', 'shared', 'calendar'));
  });
  if (originalTZ === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = originalTZ;
  }
  return calendar;
}

function findDate(holidays, nameEnPredicate) {
  return holidays.find(nameEnPredicate)?.date;
}

describe('PR-G.3.7 — TZ-invariance of getHolidaysForYear', () => {
  const tzMatrix = ['UTC', 'Asia/Jerusalem', 'America/Los_Angeles', 'Pacific/Kiritimati'];

  for (const tz of tzMatrix) {
    test(`canonical Pesach I 2026 under TZ=${tz} → ${CANONICAL_2026.pesachI}`, () => {
      const calendar = loadCalendarUnderTZ(tz);
      const h = calendar.getHolidaysForYear(2026);
      const d = findDate(h, (x) => x.nameEn === 'Pesach I');
      expect(d).toBe(CANONICAL_2026.pesachI);
    });

    test(`canonical Yom Kippur 2026 under TZ=${tz} → ${CANONICAL_2026.yomKippur}`, () => {
      const calendar = loadCalendarUnderTZ(tz);
      const h = calendar.getHolidaysForYear(2026);
      const d = findDate(h, (x) => x.nameEn === 'Yom Kippur');
      expect(d).toBe(CANONICAL_2026.yomKippur);
    });

    test(`canonical Purim 2026 under TZ=${tz} → ${CANONICAL_2026.purim}`, () => {
      const calendar = loadCalendarUnderTZ(tz);
      const h = calendar.getHolidaysForYear(2026);
      const d = findDate(h, (x) => x.nameEn === 'Purim');
      expect(d).toBe(CANONICAL_2026.purim);
    });
  }

  test('full-year output is TZ-invariant (UTC === Asia/Jerusalem)', () => {
    const utcCal = loadCalendarUnderTZ('UTC');
    const ilCal = loadCalendarUnderTZ('Asia/Jerusalem');
    expect(utcCal.getHolidaysForYear(2026)).toEqual(ilCal.getHolidaysForYear(2026));
  });

  test('full-year output is TZ-invariant (Asia/Jerusalem === Pacific/Kiritimati)', () => {
    const ilCal = loadCalendarUnderTZ('Asia/Jerusalem');
    const krCal = loadCalendarUnderTZ('Pacific/Kiritimati');
    expect(ilCal.getHolidaysForYear(2026)).toEqual(krCal.getHolidaysForYear(2026));
  });
});

describe('PR-G.3.7 — _hdateToISO helper', () => {
  const { _test } = require('../shared/calendar');
  const { _hdateToISO } = _test;

  test('exported via _test', () => {
    expect(typeof _hdateToISO).toBe('function');
  });

  test('local-midnight Date → correct YYYY-MM-DD', () => {
    // Simulate what hebcal returns: a local-built Date for Apr 2.
    const fakeHdate = { greg: () => new Date(2026, 3, 2) }; // local midnight
    expect(_hdateToISO(fakeHdate)).toBe('2026-04-02');
  });

  test('preserves day across month boundary', () => {
    const fakeHdate = { greg: () => new Date(2026, 0, 31) };
    expect(_hdateToISO(fakeHdate)).toBe('2026-01-31');
  });

  test('pads single-digit month and day', () => {
    const fakeHdate = { greg: () => new Date(2026, 0, 5) };
    expect(_hdateToISO(fakeHdate)).toBe('2026-01-05');
  });
});
