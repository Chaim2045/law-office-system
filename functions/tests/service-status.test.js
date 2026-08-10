/**
 * Unit tests for the SSOT helper functions/shared/service-status.js.
 *
 * Covers:
 *   - HOURS_LOCKED_STATUSES value + immutability (the closed set)
 *   - serviceAcceptsHours: default-active, the boolean per status
 *   - assertServiceAcceptsHours: throws failed-precondition (default HttpsError)
 *     for closed, no-throw for open; override-ignoring; makeError factory path
 *   - the thrown message is the exact Hebrew SSOT string, with NO PII
 */

// firebase-functions is mocked so the DEFAULT throw path builds the mock
// HttpsError (mirrors every sibling CF test harness).
jest.mock('firebase-functions', () => {
  class HttpsError extends Error {
    constructor(code, message, details) {
      super(message);
      this.code = code;
      this.details = details;
    }
  }
  return { https: { HttpsError } };
});

const {
  HOURS_LOCKED_STATUSES,
  HOURS_LOCKED_CODE,
  HOURS_LOCKED_MESSAGE,
  serviceAcceptsHours,
  assertServiceAcceptsHours
} = require('../shared/service-status');

describe('service-status — HOURS_LOCKED_STATUSES (the closed set)', () => {
  test('is exactly [archived, completed]', () => {
    expect(HOURS_LOCKED_STATUSES).toEqual(['archived', 'completed']);
  });

  test('is frozen (immutable)', () => {
    expect(Object.isFrozen(HOURS_LOCKED_STATUSES)).toBe(true);
  });

  test('does NOT lock on_hold (temporary pause stays OPEN)', () => {
    expect(HOURS_LOCKED_STATUSES).not.toContain('on_hold');
  });

  test('is a SEPARATE constant from aggregates NON_AGGREGATING_STATUSES', () => {
    const { NON_AGGREGATING_STATUSES } = require('../shared/aggregates');
    // Aggregation excludes only 'archived'; the hours-lock set adds 'completed'.
    expect(NON_AGGREGATING_STATUSES).toEqual(['archived']);
    expect(HOURS_LOCKED_STATUSES).not.toEqual(NON_AGGREGATING_STATUSES);
  });
});

describe('service-status — serviceAcceptsHours (boolean)', () => {
  test('active service accepts', () => {
    expect(serviceAcceptsHours({ status: 'active' })).toBe(true);
  });

  test('on_hold service accepts (temporary pause)', () => {
    expect(serviceAcceptsHours({ status: 'on_hold' })).toBe(true);
  });

  test('archived service does NOT accept', () => {
    expect(serviceAcceptsHours({ status: 'archived' })).toBe(false);
  });

  test('completed service does NOT accept', () => {
    expect(serviceAcceptsHours({ status: 'completed' })).toBe(false);
  });

  test('missing status defaults to active → accepts', () => {
    expect(serviceAcceptsHours({})).toBe(true);
  });

  test('empty-string status defaults to active → accepts', () => {
    expect(serviceAcceptsHours({ status: '' })).toBe(true);
  });

  test('null / undefined service defaults to active → accepts', () => {
    expect(serviceAcceptsHours(null)).toBe(true);
    expect(serviceAcceptsHours(undefined)).toBe(true);
  });

  test('overrideActive does NOT make a closed service accept', () => {
    expect(serviceAcceptsHours({ status: 'archived', overrideActive: true })).toBe(false);
    expect(serviceAcceptsHours({ status: 'completed', overrideActive: true })).toBe(false);
  });
});

describe('service-status — assertServiceAcceptsHours (default HttpsError)', () => {
  test('active → does not throw', () => {
    expect(() => assertServiceAcceptsHours({ status: 'active' })).not.toThrow();
  });

  test('on_hold → does not throw', () => {
    expect(() => assertServiceAcceptsHours({ status: 'on_hold' })).not.toThrow();
  });

  test('missing status → does not throw', () => {
    expect(() => assertServiceAcceptsHours({})).not.toThrow();
  });

  test('archived → throws failed-precondition with the Hebrew SSOT message', () => {
    expect(() => assertServiceAcceptsHours({ status: 'archived' })).toThrow(
      expect.objectContaining({
        code: HOURS_LOCKED_CODE,
        message: HOURS_LOCKED_MESSAGE
      })
    );
  });

  test('completed → throws failed-precondition', () => {
    expect(() => assertServiceAcceptsHours({ status: 'completed' })).toThrow(
      expect.objectContaining({ code: 'failed-precondition' })
    );
  });

  test('archived + overrideActive:true → STILL throws (override does not bypass)', () => {
    expect(() => assertServiceAcceptsHours({ status: 'archived', overrideActive: true })).toThrow(
      expect.objectContaining({ code: 'failed-precondition' })
    );
  });

  test('the thrown message carries NO PII (no id/name/amount interpolation)', () => {
    let thrown;
    try {
      assertServiceAcceptsHours({ status: 'completed', id: 'srv_secret', name: 'לקוח סודי' });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeDefined();
    expect(thrown.message).toBe(HOURS_LOCKED_MESSAGE);
    expect(thrown.message).not.toContain('srv_secret');
    expect(thrown.message).not.toContain('לקוח סודי');
  });
});

describe('service-status — assertServiceAcceptsHours (makeError factory path)', () => {
  test('closed service → calls makeError(code, message) and throws its result', () => {
    const madeError = new Error('custom');
    const makeError = jest.fn(() => madeError);

    expect(() => assertServiceAcceptsHours({ status: 'archived' }, makeError)).toThrow(madeError);
    expect(makeError).toHaveBeenCalledWith('failed-precondition', HOURS_LOCKED_MESSAGE);
  });

  test('open service → makeError is NOT called', () => {
    const makeError = jest.fn(() => new Error('should not be built'));
    expect(() => assertServiceAcceptsHours({ status: 'active' }, makeError)).not.toThrow();
    expect(makeError).not.toHaveBeenCalled();
  });
});
