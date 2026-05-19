/**
 * Unit tests for the daily-meter week-view pure helper (PR-F).
 *
 * Tests the `_groupByDay` logic in isolation — no DOM, no Firestore.
 * The component itself integrates with real-time `window.manager.timesheetEntries`,
 * but the grouping logic is pure and testable.
 */

import { describe, it, expect } from 'vitest';

import { _test } from '../../../apps/user-app/js/modules/components/sidebar/daily-meter.js';

const { groupByDay } = _test;

/**
 * Build a fixture week range Sun..Sat starting from given date string.
 */
function makeRange(startStr) {
  const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const [y, m, d] = startStr.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  // Ensure start is a Sunday
  expect(start.getDay()).toBe(0);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(start);
    dt.setDate(start.getDate() + i);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    days.push({
      dateStr: `${yy}-${mm}-${dd}`,
      dayOfWeek: dt.getDay(),
      label: `${DAY_NAMES[dt.getDay()]} ${dd}/${mm}`
    });
  }
  return { startStr: days[0].dateStr, days };
}

describe('daily-meter _groupByDay (PR-F)', () => {
  // 2026-05-17 = Sunday
  const range = makeRange('2026-05-17');

  it('empty entries → 7 days each with zero hours, no clients', () => {
    const result = groupByDay([], range);
    expect(result).toHaveLength(7);
    for (const day of result) {
      expect(day.totalHours).toBe(0);
      expect(day.clients).toEqual([]);
    }
  });

  it('entries on a single day → that day populated, others zero', () => {
    const entries = [
      { date: '2026-05-19', minutes: 60, clientName: 'לקוח א' },
      { date: '2026-05-19', minutes: 30, clientName: 'לקוח א' },
      { date: '2026-05-19', minutes: 45, clientName: 'לקוח ב' }
    ];
    const result = groupByDay(entries, range);
    const tuesday = result.find(d => d.dateStr === '2026-05-19');
    expect(tuesday.totalHours).toBe((60 + 30 + 45) / 60);
    expect(tuesday.clients).toHaveLength(2);

    // Other days untouched
    const otherDays = result.filter(d => d.dateStr !== '2026-05-19');
    for (const day of otherDays) {
      expect(day.totalHours).toBe(0);
    }
  });

  it('entries across multiple days → each day has correct totals', () => {
    const entries = [
      { date: '2026-05-17', minutes: 60, clientName: 'A' },   // Sun: 1h
      { date: '2026-05-18', minutes: 120, clientName: 'B' },  // Mon: 2h
      { date: '2026-05-19', minutes: 30, clientName: 'C' },   // Tue: 0.5h
      { date: '2026-05-21', minutes: 90, clientName: 'D' }    // Thu: 1.5h
    ];
    const result = groupByDay(entries, range);
    expect(result.find(d => d.dateStr === '2026-05-17').totalHours).toBe(1);
    expect(result.find(d => d.dateStr === '2026-05-18').totalHours).toBe(2);
    expect(result.find(d => d.dateStr === '2026-05-19').totalHours).toBe(0.5);
    expect(result.find(d => d.dateStr === '2026-05-20').totalHours).toBe(0);
    expect(result.find(d => d.dateStr === '2026-05-21').totalHours).toBe(1.5);
  });

  it('internal entries grouped separately from client entries', () => {
    const entries = [
      { date: '2026-05-19', minutes: 60, clientName: 'לקוח א' },
      { date: '2026-05-19', minutes: 30, isInternal: true }
    ];
    const result = groupByDay(entries, range);
    const tuesday = result.find(d => d.dateStr === '2026-05-19');
    expect(tuesday.clients).toHaveLength(2);
    const internal = tuesday.clients.find(c => c.isInternal);
    const client = tuesday.clients.find(c => !c.isInternal);
    expect(internal.name).toBe('זמן פנימי');
    expect(internal.hours).toBe(0.5);
    expect(client.hours).toBe(1);
  });

  it('entries OUTSIDE the week range → ignored (no leak into adjacent week)', () => {
    const entries = [
      { date: '2026-05-15', minutes: 60, clientName: 'A' },   // Fri prior week
      { date: '2026-05-25', minutes: 60, clientName: 'B' },   // Next week
      { date: '2026-05-19', minutes: 30, clientName: 'C' }    // In-range
    ];
    const result = groupByDay(entries, range);
    const totalAcrossWeek = result.reduce((s, d) => s + d.totalHours, 0);
    expect(totalAcrossWeek).toBe(0.5);  // only the in-range entry
  });

  it('handles entries with no date field → skipped without throwing', () => {
    const entries = [
      { minutes: 60, clientName: 'A' },                   // no date
      { date: null, minutes: 30, clientName: 'B' },       // null date
      { date: '2026-05-19', minutes: 45, clientName: 'C' }
    ];
    const result = groupByDay(entries, range);
    const tuesday = result.find(d => d.dateStr === '2026-05-19');
    expect(tuesday.totalHours).toBe(0.75);
  });

  it('handles Firestore-timestamp-style date object', () => {
    const fakeFirestoreDate = {
      toDate: () => new Date('2026-05-19T12:00:00Z')
    };
    const entries = [
      { date: fakeFirestoreDate, minutes: 60, clientName: 'A' }
    ];
    const result = groupByDay(entries, range);
    const tuesday = result.find(d => d.dateStr === '2026-05-19');
    expect(tuesday.totalHours).toBe(1);
  });

  it('handles ISO datetime string (with time portion)', () => {
    const entries = [
      { date: '2026-05-19T14:30', minutes: 60, clientName: 'A' }
    ];
    const result = groupByDay(entries, range);
    const tuesday = result.find(d => d.dateStr === '2026-05-19');
    expect(tuesday.totalHours).toBe(1);
  });
});
