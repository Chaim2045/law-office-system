/**
 * Tests for `syncHolidaysForYear` after PR-G.3.3.
 *
 * Verifies that cron writes via `set({merge: true})` semantics — preserving
 * any existing `holidaysOverrides` on the doc.
 */

// Mock firebase-admin BEFORE requiring scheduled module
const mockDocRef = {
  get: jest.fn(),
  set: jest.fn().mockResolvedValue(undefined)
};
const mockDb = {
  collection: jest.fn().mockReturnValue({
    doc: jest.fn().mockReturnValue(mockDocRef)
  })
};

jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  firestore: Object.assign(jest.fn(() => mockDb), {
    FieldValue: { serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'), increment: jest.fn() },
    Timestamp: { fromDate: jest.fn((d) => ({ _date: d.toISOString() })) }
  })
}));

jest.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: jest.fn((config, handler) => handler)
}));

const scheduled = require('../scheduled');
const { syncHolidaysForYear, _hashHolidays } = scheduled._test;

describe('PR-G.3.3 — syncHolidaysForYear writes holidaysAuto with merge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDocRef.get.mockReset();
    mockDocRef.set.mockReset().mockResolvedValue(undefined);
  });

  it('writes holidaysAuto field, NOT holidays field', async () => {
    mockDocRef.get.mockResolvedValue({ exists: false, data: () => null });
    await syncHolidaysForYear(2026);
    expect(mockDocRef.set).toHaveBeenCalledTimes(1);
    const payload = mockDocRef.set.mock.calls[0][0];
    expect(payload).toHaveProperty('holidaysAuto');
    expect(payload).not.toHaveProperty('holidays');
    expect(Array.isArray(payload.holidaysAuto)).toBe(true);
    expect(payload.holidaysAuto.length).toBeGreaterThan(20);
  });

  it('uses merge: true write semantics (never destroys overrides)', async () => {
    mockDocRef.get.mockResolvedValue({ exists: false, data: () => null });
    await syncHolidaysForYear(2026);
    const opts = mockDocRef.set.mock.calls[0][1];
    expect(opts).toEqual({ merge: true });
  });

  it('skips write when contentHash matches existing doc', async () => {
    const calendarLib = require('../shared/calendar');
    const sampleHolidays = calendarLib.getHolidaysForYear(2026);
    const matchingHash = _hashHolidays(sampleHolidays);
    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => ({ contentHash: matchingHash })
    });
    const result = await syncHolidaysForYear(2026);
    expect(mockDocRef.set).not.toHaveBeenCalled();
    expect(result.status).toBe('unchanged');
  });

  it('contentHash covers ONLY holidaysAuto (not overrides)', async () => {
    const calendarLib = require('../shared/calendar');
    const expectedHash = _hashHolidays(calendarLib.getHolidaysForYear(2026));
    mockDocRef.get.mockResolvedValue({ exists: false, data: () => null });
    await syncHolidaysForYear(2026);
    const payload = mockDocRef.set.mock.calls[0][0];
    expect(payload.contentHash).toBe(expectedHash);
  });

  it('payload contains required metadata fields', async () => {
    mockDocRef.get.mockResolvedValue({ exists: false, data: () => null });
    await syncHolidaysForYear(2027);
    const payload = mockDocRef.set.mock.calls[0][0];
    expect(payload.year).toBe(2027);
    expect(payload.generatedAt).toBe('SERVER_TIMESTAMP');
    expect(payload.source).toMatch(/^@hebcal\/core@/);
    expect(payload.contentHash).toBeDefined();
  });
});
