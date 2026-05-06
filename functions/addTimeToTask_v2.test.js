/**
 * Unit tests for addTimeToTask_v2 pure functions.
 *
 * Currently covers computeFixedDeduction (extracted in PR #259 / Level 2 hardening).
 * Regression guard for PR #257 — the FIXED branch was missing entirely, which led to
 * deductionResult=null → deductedInTransaction=false → trigger ran fallback CREATE
 * path → actualMinutes double-counted on 7 tasks.
 *
 * Invariant: for any supported serviceType, the deduction function MUST return a
 * non-null deductionResult when the service exists. Returning null would re-introduce
 * the double-count class of bug.
 */

// Mock firebase-admin and functions before requiring the module
jest.mock('firebase-admin', () => ({
  firestore: () => ({}),
  initializeApp: jest.fn()
}));
jest.mock('firebase-functions', () => ({
  https: { onCall: jest.fn(() => jest.fn()), HttpsError: class extends Error {} },
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));
jest.mock('firebase-functions/v2/https', () => ({
  onCall: jest.fn(() => jest.fn())
}));

const { _test: { computeFixedDeduction } } = require('./addTimeToTask_v2');

describe('computeFixedDeduction', () => {
  function makeFixedService(id, work = null) {
    return { id, type: 'fixed', ...(work !== null && { work }) };
  }

  test('returns non-null with incremented work tracking when service exists', () => {
    const services = [
      makeFixedService('svc_other'),
      makeFixedService('svc_target', { totalMinutesWorked: 120, entriesCount: 4 }),
      makeFixedService('svc_third')
    ];

    const result = computeFixedDeduction(services, 'svc_target', 30);

    expect(result).not.toBeNull();
    expect(result.isOverage).toBe(false);
    expect(result.overageMinutes).toBe(0);
    const updated = result.updatedServices.find(s => s.id === 'svc_target');
    expect(updated.work.totalMinutesWorked).toBe(150);
    expect(updated.work.entriesCount).toBe(5);
  });

  test('initialises work object when missing on the service', () => {
    const services = [makeFixedService('svc_target')];
    const result = computeFixedDeduction(services, 'svc_target', 45);

    expect(result).not.toBeNull();
    const updated = result.updatedServices[0];
    expect(updated.work.totalMinutesWorked).toBe(45);
    expect(updated.work.entriesCount).toBe(1);
  });

  test('treats undefined totalMinutesWorked / entriesCount as zero', () => {
    const services = [makeFixedService('svc_target', {})];
    const result = computeFixedDeduction(services, 'svc_target', 60);

    expect(result.updatedServices[0].work.totalMinutesWorked).toBe(60);
    expect(result.updatedServices[0].work.entriesCount).toBe(1);
  });

  test('does NOT mutate the original services array or service object', () => {
    const original = [makeFixedService('svc_target', { totalMinutesWorked: 100, entriesCount: 2 })];
    const snapshot = JSON.parse(JSON.stringify(original));

    computeFixedDeduction(original, 'svc_target', 10);

    expect(original).toEqual(snapshot);
    expect(original[0].work.totalMinutesWorked).toBe(100);
    expect(original[0].work.entriesCount).toBe(2);
  });

  test('returns null when target service id is missing — caller must handle', () => {
    const services = [makeFixedService('svc_a'), makeFixedService('svc_b')];
    expect(computeFixedDeduction(services, 'svc_missing', 30)).toBeNull();
  });

  test('returns null when services is not an array', () => {
    expect(computeFixedDeduction(null, 'svc_target', 30)).toBeNull();
    expect(computeFixedDeduction(undefined, 'svc_target', 30)).toBeNull();
    expect(computeFixedDeduction({}, 'svc_target', 30)).toBeNull();
  });

  test('handles negative delta (DELETE / correction) without going below zero count', () => {
    const services = [makeFixedService('svc_target', { totalMinutesWorked: 50, entriesCount: 2 })];
    const result = computeFixedDeduction(services, 'svc_target', -20);

    expect(result.updatedServices[0].work.totalMinutesWorked).toBe(30);
    // entriesCount increments regardless — caller decides when to use this function
    expect(result.updatedServices[0].work.entriesCount).toBe(3);
  });

  test('rounds totalMinutesWorked to 2 decimals', () => {
    const services = [makeFixedService('svc_target', { totalMinutesWorked: 0.1, entriesCount: 0 })];
    const result = computeFixedDeduction(services, 'svc_target', 0.2);

    expect(result.updatedServices[0].work.totalMinutesWorked).toBe(0.3);
  });

  test('CRITICAL REGRESSION GUARD: never returns null when target service exists', () => {
    // If this test ever fails, the ST.FIXED double-count bug from PR #257 has returned.
    const services = [makeFixedService('svc_target')];
    const result = computeFixedDeduction(services, 'svc_target', 1);
    expect(result).not.toBeNull();
    expect(result.updatedServices).toBeDefined();
    expect(result.updatedServices.length).toBe(services.length);
  });
});
