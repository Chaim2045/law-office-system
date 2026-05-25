/**
 * PR-G.3.9: tests for `normalizeDateToYMD(input)` — accepts string /
 * {seconds, nanoseconds} / Timestamp object; returns YYYY-MM-DD in
 * Asia/Jerusalem TZ regardless of host TZ.
 *
 * Critical case: local-midnight {seconds} input from a caller in
 * Asia/Jerusalem yields the IL date, NOT the UTC date. This is the latent
 * trap that PR-G.3.9 closes in functions/timesheet/index.js:160, 166.
 */

const { normalizeDateToYMD } = require('../shared/calendar');

describe('normalizeDateToYMD — string inputs', () => {
  test('YYYY-MM-DD short string → same string', () => {
    expect(normalizeDateToYMD('2026-04-02')).toBe('2026-04-02');
  });

  test('ISO 8601 string → date prefix', () => {
    expect(normalizeDateToYMD('2026-04-02T00:00:00.000Z')).toBe('2026-04-02');
  });

  test('ISO string with TZ offset → prefix (no TZ shift)', () => {
    // The existing contract: extract the input prefix verbatim. Caller
    // already chose the YMD when they constructed the string.
    expect(normalizeDateToYMD('2026-04-02T23:59:59.999Z')).toBe('2026-04-02');
  });

  test('invalid string → throws', () => {
    expect(() => normalizeDateToYMD('not-a-date')).toThrow(/invalid date string/);
  });
});

describe('normalizeDateToYMD — {seconds, nanoseconds} inputs (Asia/Jerusalem)', () => {
  test('UTC midnight seconds → same UTC day (offset = +2/+3, still same day)', () => {
    // 2026-04-02T00:00:00.000Z = 2026-04-02 03:00 IL DST → same day either way
    const seconds = Math.floor(new Date('2026-04-02T00:00:00.000Z').getTime() / 1000);
    expect(normalizeDateToYMD({ seconds, nanoseconds: 0 })).toBe('2026-04-02');
  });

  test('CRITICAL: local-IL-midnight seconds yields IL date, not UTC yesterday', () => {
    // Caller in Asia/Jerusalem does `new Date(2026, 3, 2).getTime() / 1000`
    // = epoch for 2026-04-02 00:00 IL = 2026-04-01T21:00:00.000Z (DST UTC+3).
    // Old buggy code: `d.toISOString().substring(0,10)` = "2026-04-01" ❌
    // New helper: returns IL date "2026-04-02" ✅
    const seconds = Math.floor(new Date('2026-04-01T21:00:00.000Z').getTime() / 1000);
    expect(normalizeDateToYMD({ seconds, nanoseconds: 0 })).toBe('2026-04-02');
  });

  test('22:30 UTC = 01:30 IL DST next day → returns IL day', () => {
    // 2026-05-24T22:30:00.000Z = 2026-05-25 01:30 IL (UTC+3 DST)
    const seconds = Math.floor(new Date('2026-05-24T22:30:00.000Z').getTime() / 1000);
    expect(normalizeDateToYMD({ seconds, nanoseconds: 0 })).toBe('2026-05-25');
  });

  test('winter (no DST) — 22:30 UTC = 00:30 IL next day → returns IL day', () => {
    // 2026-01-15T22:30:00.000Z = 2026-01-16 00:30 IL (UTC+2 winter)
    const seconds = Math.floor(new Date('2026-01-15T22:30:00.000Z').getTime() / 1000);
    expect(normalizeDateToYMD({ seconds, nanoseconds: 0 })).toBe('2026-01-16');
  });

  test('nanoseconds field is tolerated (ignored)', () => {
    const seconds = Math.floor(new Date('2026-04-02T12:00:00.000Z').getTime() / 1000);
    expect(normalizeDateToYMD({ seconds, nanoseconds: 500000000 })).toBe('2026-04-02');
  });
});

describe('normalizeDateToYMD — Timestamp object (.toDate)', () => {
  test('Timestamp.toDate() returning a Date → IL YMD', () => {
    const fakeTimestamp = {
      toDate: () => new Date('2026-04-02T12:00:00.000Z')
    };
    expect(normalizeDateToYMD(fakeTimestamp)).toBe('2026-04-02');
  });

  test('Timestamp built from local-IL-midnight → IL date', () => {
    // Same bug pattern as the {seconds} case
    const fakeTimestamp = {
      toDate: () => new Date('2026-04-01T21:00:00.000Z') // 2026-04-02 00:00 IL DST
    };
    expect(normalizeDateToYMD(fakeTimestamp)).toBe('2026-04-02');
  });

  test('.toDate() returning an invalid Date → throws', () => {
    const bad = { toDate: () => new Date('invalid') };
    expect(() => normalizeDateToYMD(bad)).toThrow(/valid Date/);
  });
});

describe('normalizeDateToYMD — invalid inputs', () => {
  test('null → throws', () => {
    expect(() => normalizeDateToYMD(null)).toThrow(/null\/undefined/);
  });

  test('undefined → throws', () => {
    expect(() => normalizeDateToYMD(undefined)).toThrow(/null\/undefined/);
  });

  test('number → throws (unsupported type)', () => {
    expect(() => normalizeDateToYMD(12345)).toThrow(/unsupported type/);
  });

  test('plain object with neither .seconds nor .toDate → throws', () => {
    expect(() => normalizeDateToYMD({ foo: 'bar' })).toThrow(/no recognized shape/);
  });
});

describe('normalizeDateToYMD — TZ invariance under different host TZ', () => {
  // Confirms the {seconds} / Timestamp branches use Intl with timeZone:
  // Asia/Jerusalem, so the answer is the same on UTC hosts (Cloud Functions)
  // and on Asia/Jerusalem hosts (developer machines).
  const TZS = ['UTC', 'Asia/Jerusalem', 'America/Los_Angeles', 'Pacific/Kiritimati'];

  function runUnderTZ(tz, fn) {
    const original = process.env.TZ;
    process.env.TZ = tz;
    try {
      jest.resetModules();
      return fn();
    } finally {
      process.env.TZ = original;
      jest.resetModules();
    }
  }

  test.each(TZS)('local-IL-midnight {seconds} → "2026-04-02" under TZ=%s', (tz) => {
    runUnderTZ(tz, () => {
      const { normalizeDateToYMD: helper } = require('../shared/calendar');
      const seconds = Math.floor(new Date('2026-04-01T21:00:00.000Z').getTime() / 1000);
      expect(helper({ seconds, nanoseconds: 0 })).toBe('2026-04-02');
    });
  });
});
