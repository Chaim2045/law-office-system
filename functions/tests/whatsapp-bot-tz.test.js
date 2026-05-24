/**
 * PR-G.3.8: TZ-invariance tests for WhatsApp Bot "today" helpers.
 *
 * The helpers `todayInJerusalemYMD()` and `startOfTodayInJerusalem()` live
 * in `functions/shared/calendar.js`. They must produce the SAME logical
 * Asia/Jerusalem day regardless of the host process timezone (process.env.TZ).
 *
 * Tests run the helpers under simulated TZs:
 *   - UTC                  (Cloud Functions default)
 *   - Asia/Jerusalem       (developer machine)
 *   - America/Los_Angeles  (UTC-7/-8, behind IL)
 *   - Pacific/Kiritimati   (UTC+14, ahead of IL)
 *
 * Edge case validated: when host clock is on day N but IL clock is on day
 * N+1 (or N-1), the helper returns the IL day — not the host day. This is
 * the exact bug fixed in WhatsAppBot.js:996, :1069, :652.
 */

describe('todayInJerusalemYMD() — TZ invariance', () => {
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

  test.each(TZS)('returns YYYY-MM-DD string under TZ=%s', (tz) => {
    runUnderTZ(tz, () => {
      const { todayInJerusalemYMD } = require('../shared/calendar');
      const out = todayInJerusalemYMD();
      expect(typeof out).toBe('string');
      expect(out).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  test('all TZs produce the SAME IL day for the same UTC instant', () => {
    // Pin "now" to a specific UTC instant — we'll mock Date for each TZ.
    // 2026-05-24T22:30:00Z = 2026-05-25 01:30 in Asia/Jerusalem (DST, UTC+3).
    // Under UTC the host thinks it's still 2026-05-24, but IL is already 2026-05-25.
    const PINNED_UTC = new Date('2026-05-24T22:30:00.000Z');

    const results = TZS.map((tz) => {
      return runUnderTZ(tz, () => {
        // Override Date constructor to return the pinned instant.
        const RealDate = Date;
        global.Date = class extends RealDate {
          constructor(...args) {
            if (args.length === 0) {
              super(PINNED_UTC.getTime());
            } else {
              super(...args);
            }
          }
          static now() { return PINNED_UTC.getTime(); }
        };
        try {
          const { todayInJerusalemYMD } = require('../shared/calendar');
          return { tz, out: todayInJerusalemYMD() };
        } finally {
          global.Date = RealDate;
        }
      });
    });

    // All four must agree, and all must say 2026-05-25 (the IL day for that UTC instant).
    const unique = new Set(results.map((r) => r.out));
    expect(unique.size).toBe(1);
    expect(results[0].out).toBe('2026-05-25');
  });

  test('CRITICAL: 00:30 IL after UTC midnight returns IL today, not UTC yesterday', () => {
    // Exact bug scenario: between 00:00-03:00 IL (winter) / 04:00 (DST),
    // host UTC clock is still on previous day. Old code returned UTC date.
    // New code must return IL date.
    //
    // 2026-01-15T22:30:00Z (winter) = 2026-01-16 00:30 IL (UTC+2, no DST).
    const PINNED_UTC = new Date('2026-01-15T22:30:00.000Z');

    runUnderTZ('UTC', () => {
      const RealDate = Date;
      global.Date = class extends RealDate {
        constructor(...args) {
          if (args.length === 0) super(PINNED_UTC.getTime());
          else super(...args);
        }
        static now() { return PINNED_UTC.getTime(); }
      };
      try {
        const { todayInJerusalemYMD } = require('../shared/calendar');
        const out = todayInJerusalemYMD();
        // Buggy old impl would return '2026-01-15' (UTC day).
        // Fixed impl returns '2026-01-16' (IL day).
        expect(out).toBe('2026-01-16');
      } finally {
        global.Date = RealDate;
      }
    });
  });
});

describe('startOfTodayInJerusalem() — produces correct IL midnight Date', () => {
  test('returns a Date object', () => {
    const { startOfTodayInJerusalem } = require('../shared/calendar');
    const d = startOfTodayInJerusalem();
    expect(d).toBeInstanceOf(Date);
    expect(Number.isFinite(d.getTime())).toBe(true);
  });

  test('IL midnight is exactly the start of the IL day (DST winter 2026-01)', () => {
    // 2026-01-15 IL midnight = 2026-01-14T22:00:00Z (UTC+2 winter).
    // We pin a UTC instant during 2026-01-15 IL, expect that exact UTC ms.
    const PINNED_UTC = new Date('2026-01-15T12:00:00.000Z'); // 14:00 IL
    const RealDate = Date;
    global.Date = class extends RealDate {
      constructor(...args) {
        if (args.length === 0) super(PINNED_UTC.getTime());
        else super(...args);
      }
      static now() { return PINNED_UTC.getTime(); }
      static UTC = RealDate.UTC;
    };
    try {
      jest.resetModules();
      const { startOfTodayInJerusalem } = require('../shared/calendar');
      const d = startOfTodayInJerusalem();
      // Expected: 2026-01-14T22:00:00Z (IL midnight in winter UTC+2).
      expect(d.toISOString()).toBe('2026-01-14T22:00:00.000Z');
    } finally {
      global.Date = RealDate;
      jest.resetModules();
    }
  });

  test('IL midnight in DST summer 2026-07 is UTC-3 offset', () => {
    // 2026-07-15 IL midnight = 2026-07-14T21:00:00Z (UTC+3 DST).
    const PINNED_UTC = new Date('2026-07-15T12:00:00.000Z'); // 15:00 IL DST
    const RealDate = Date;
    global.Date = class extends RealDate {
      constructor(...args) {
        if (args.length === 0) super(PINNED_UTC.getTime());
        else super(...args);
      }
      static now() { return PINNED_UTC.getTime(); }
      static UTC = RealDate.UTC;
    };
    try {
      jest.resetModules();
      const { startOfTodayInJerusalem } = require('../shared/calendar');
      const d = startOfTodayInJerusalem();
      expect(d.toISOString()).toBe('2026-07-14T21:00:00.000Z');
    } finally {
      global.Date = RealDate;
      jest.resetModules();
    }
  });

  test('IL midnight matches the YMD from todayInJerusalemYMD', () => {
    // Sanity: both helpers must agree on the IL day.
    const { todayInJerusalemYMD, startOfTodayInJerusalem } = require('../shared/calendar');
    const ymd = todayInJerusalemYMD();
    const midnight = startOfTodayInJerusalem();
    // Read back the YMD of midnight via the IL formatter — must equal `ymd`.
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    expect(fmt.format(midnight)).toBe(ymd);
  });
});
