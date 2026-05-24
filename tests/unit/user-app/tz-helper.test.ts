/**
 * PR-G.3.10: unit tests for the frontend TZ helper
 * (`apps/user-app/js/modules/tz-helper.js`).
 *
 * The helper centralizes "today in Asia/Jerusalem" + YYYY-MM-DD
 * normalization so frontend readers compare like-for-like against the
 * backend writes (Firestore `timesheet_entries.date` is a YYYY-MM-DD
 * string anchored to IL by PR-G.3.9).
 */

import { describe, it, expect } from 'vitest';

import {
  todayInJerusalemYMD,
  dateToJerusalemYMD,
  addDaysYMD,
  dayOfWeekYMD,
  startOfMonthYMD
} from '../../../apps/user-app/js/modules/tz-helper.js';

describe('todayInJerusalemYMD', () => {
  it('returns a YYYY-MM-DD string', () => {
    const out = todayInJerusalemYMD();
    expect(typeof out).toBe('string');
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('CRITICAL: 22:30 UTC pinned = 01:30 IL next day → returns IL day', () => {
    // 2026-05-24T22:30:00Z = 2026-05-25 01:30 IL (UTC+3 DST)
    const RealDate = Date;
    const PINNED = new RealDate('2026-05-24T22:30:00.000Z');
    // @ts-expect-error - override Date constructor for test isolation
    globalThis.Date = class extends RealDate {
      constructor(...args: ConstructorParameters<typeof Date>) {
        if (args.length === 0) {
          super(PINNED.getTime());
        } else {
          super(...args);
        }
      }

      static now() {
        return PINNED.getTime();
      }
    };
    try {
      expect(todayInJerusalemYMD()).toBe('2026-05-25');
    } finally {
      globalThis.Date = RealDate;
    }
  });

  it('winter (no DST): 22:30 UTC = 00:30 IL next day → returns IL day', () => {
    const RealDate = Date;
    const PINNED = new RealDate('2026-01-15T22:30:00.000Z'); // UTC+2 winter
    // @ts-expect-error - override Date
    globalThis.Date = class extends RealDate {
      constructor(...args: ConstructorParameters<typeof Date>) {
        if (args.length === 0) {
          super(PINNED.getTime());
        } else {
          super(...args);
        }
      }

      static now() {
        return PINNED.getTime();
      }
    };
    try {
      expect(todayInJerusalemYMD()).toBe('2026-01-16');
    } finally {
      globalThis.Date = RealDate;
    }
  });
});

describe('dateToJerusalemYMD', () => {
  it('null → empty string (matches defensive UI contract)', () => {
    expect(dateToJerusalemYMD(null)).toBe('');
  });

  it('undefined → empty string', () => {
    expect(dateToJerusalemYMD(undefined)).toBe('');
  });

  it('YYYY-MM-DD string → same string', () => {
    expect(dateToJerusalemYMD('2026-04-02')).toBe('2026-04-02');
  });

  it('ISO 8601 string → date prefix', () => {
    expect(dateToJerusalemYMD('2026-04-02T15:30:00.000Z')).toBe('2026-04-02');
  });

  it('Date instance (UTC midnight) → IL day', () => {
    expect(dateToJerusalemYMD(new Date('2026-04-02T12:00:00.000Z'))).toBe('2026-04-02');
  });

  it('CRITICAL: Date built from local-IL-midnight → IL date, not UTC-1', () => {
    // 2026-04-02 00:00 IL (UTC+3 DST) = 2026-04-01T21:00:00Z
    // Old buggy code: `.toISOString().slice(0,10)` = '2026-04-01' ❌
    expect(dateToJerusalemYMD(new Date('2026-04-01T21:00:00.000Z'))).toBe('2026-04-02');
  });

  it('Firestore Timestamp (object with .toDate()) → IL day', () => {
    const fakeTs = { toDate: () => new Date('2026-04-02T12:00:00.000Z') };
    expect(dateToJerusalemYMD(fakeTs)).toBe('2026-04-02');
  });

  it('Timestamp.toDate() returning invalid Date → empty', () => {
    const fakeTs = { toDate: () => new Date('invalid') };
    expect(dateToJerusalemYMD(fakeTs)).toBe('');
  });

  it('plain object with neither .toDate nor Date → empty', () => {
    expect(dateToJerusalemYMD({ foo: 'bar' })).toBe('');
  });
});

describe('addDaysYMD', () => {
  it('add 0 → same date', () => {
    expect(addDaysYMD('2026-05-25', 0)).toBe('2026-05-25');
  });

  it('add 1 → next day', () => {
    expect(addDaysYMD('2026-05-25', 1)).toBe('2026-05-26');
  });

  it('subtract 1 → previous day', () => {
    expect(addDaysYMD('2026-05-25', -1)).toBe('2026-05-24');
  });

  it('crosses month boundary forward', () => {
    expect(addDaysYMD('2026-05-31', 1)).toBe('2026-06-01');
  });

  it('crosses month boundary backward', () => {
    expect(addDaysYMD('2026-06-01', -1)).toBe('2026-05-31');
  });

  it('crosses year boundary', () => {
    expect(addDaysYMD('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('handles leap year Feb 29', () => {
    expect(addDaysYMD('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDaysYMD('2024-02-29', 1)).toBe('2024-03-01');
  });

  it('add 7 → same day of week next week', () => {
    expect(addDaysYMD('2026-05-25', 7)).toBe('2026-06-01');
  });
});

describe('dayOfWeekYMD', () => {
  it('2026-05-25 was a Monday (1)', () => {
    expect(dayOfWeekYMD('2026-05-25')).toBe(1);
  });

  it('2026-05-24 was a Sunday (0)', () => {
    expect(dayOfWeekYMD('2026-05-24')).toBe(0);
  });

  it('2026-05-30 was a Saturday (6)', () => {
    expect(dayOfWeekYMD('2026-05-30')).toBe(6);
  });

  it('result invariant of host TZ', () => {
    // Pure string arithmetic, no host-Date involved in semantics.
    expect(dayOfWeekYMD('2026-01-01')).toBe(4);  // Thursday
    expect(dayOfWeekYMD('2026-12-31')).toBe(4);  // Thursday
  });
});

describe('startOfMonthYMD', () => {
  it('returns first day of same month', () => {
    expect(startOfMonthYMD('2026-05-25')).toBe('2026-05-01');
    expect(startOfMonthYMD('2026-12-31')).toBe('2026-12-01');
    expect(startOfMonthYMD('2026-01-01')).toBe('2026-01-01');
  });
});

describe('integration: week-range computation (mirror of daily-meter logic)', () => {
  it('Sunday todayStr → startStr is same Sunday, 7 days Sun..Sat', () => {
    const todayStr = '2026-05-24'; // Sunday
    const dow = dayOfWeekYMD(todayStr);
    expect(dow).toBe(0);
    const startStr = addDaysYMD(todayStr, -dow);
    expect(startStr).toBe('2026-05-24');
    const days = Array.from({ length: 7 }, (_, i) => addDaysYMD(startStr, i));
    expect(days).toEqual([
      '2026-05-24', '2026-05-25', '2026-05-26', '2026-05-27',
      '2026-05-28', '2026-05-29', '2026-05-30'
    ]);
  });

  it('Wednesday todayStr → startStr rewinds to Sunday', () => {
    const todayStr = '2026-05-27'; // Wednesday
    const dow = dayOfWeekYMD(todayStr);
    expect(dow).toBe(3);
    const startStr = addDaysYMD(todayStr, -dow);
    expect(startStr).toBe('2026-05-24');
  });
});
