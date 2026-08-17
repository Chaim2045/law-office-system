/**
 * PR-3d — the two synchronization gaps, closed and guarded.
 *
 * Haim asked the sharp question: "is it not fully synchronized with the
 * system?" It wasn't, in two places, and both were the same mistake this whole
 * track exists to remove — a derived number with nothing keeping it honest.
 *
 *  GAP 1 — NEW CLIENTS. `createClient` is the one intake route that does NOT go
 *  through `writeClientWithCanonicalAggregates`; it writes with a direct
 *  `.create()` and hand-stamps each derived field. `plan` was mirrored there
 *  (with a comment saying "so the two intake routes never drift") and
 *  `hoursCapacity` was not. That gap bit hardest exactly where it mattered
 *  most: a new legal_procedure case opens with three stages, two `pending`, so
 *  it carries phantom capacity from its first second — and would have been the
 *  one shape guaranteed to have a gap and guaranteed not to show it.
 *
 *  GAP 2 — NO DRIFT DETECTION. The nightly check compares a fixed field list
 *  that did not include the new field. `aggregates.js` spent a year DECLARING
 *  that totalHours reflects active capacity while nothing enforced it; the
 *  result was 1,804 phantom hours nobody could see. Shipping a replacement that
 *  is equally unwatched would repeat the mistake with a newer field.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Same harness the existing daily-invariant-check tests use — the detector is
// pure, but the module it lives in pulls in the Firebase runtime at load.
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  firestore: Object.assign(() => ({ collection: jest.fn() }), {
    FieldValue: { serverTimestamp: jest.fn(), increment: jest.fn() },
    Timestamp: { now: jest.fn() }
  })
}));

jest.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: jest.fn((config, fn) => fn)
}));

const { _test } = require('../scheduled');
const { detectAggregateDrift } = _test;

const { computeClientCapacity } = require('../shared/stage-capacity');
const { SYSTEM_CONSTANTS } = require('../shared/constants');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;

// ═══════════════════════════════════════════════════════════════
// GAP 1 — the direct-create intake route
// ═══════════════════════════════════════════════════════════════

describe('gap 1 — createClient stamps the capacity field like it stamps the Plan', () => {
  const SRC = fs.readFileSync(
    path.join(__dirname, '..', 'clients', 'index.js'),
    'utf8'
  );

  test('the direct .create() payload carries hoursCapacity', () => {
    expect(SRC).toMatch(/clientData\.hoursCapacity\s*=\s*computeClientCapacity\(/);
  });

  test('it is derived from the SAME SSOT the canonical writer uses', () => {
    // Not a second implementation — the whole point of the module.
    expect(SRC).toMatch(/require\(['"]\.\.\/shared\/stage-capacity['"]\)/);
  });

  test('it is stamped BEFORE the document is created, not after', () => {
    const stamp = SRC.indexOf('clientData.hoursCapacity');
    const create = SRC.indexOf(".doc(caseNumber).create(clientData)");
    expect(stamp).toBeGreaterThan(-1);
    expect(create).toBeGreaterThan(-1);
    expect(stamp).toBeLessThan(create);
  });

  test('both derived fields are stamped on this route — plan AND capacity', () => {
    // If a future field is added to the canonical writer and not here, the two
    // intake routes drift. This asserts the pair that exists today.
    expect(SRC).toMatch(/clientData\.plan\s*=/);
    expect(SRC).toMatch(/clientData\.hoursCapacity\s*=/);
  });

  test('a fresh 3-stage case genuinely carries phantom from creation', () => {
    // The shape the gap would have hidden: opened with stage A active and
    // B/C pending, so two thirds of its contracted hours are locked on day one.
    const services = [{
      id: 'lp1', type: ST.LEGAL_PROCEDURE, pricingType: 'hourly', status: 'active',
      totalHours: 300,
      stages: [
        { id: 'stage_a', status: 'active', totalHours: 100 },
        { id: 'stage_b', status: 'pending', totalHours: 100 },
        { id: 'stage_c', status: 'pending', totalHours: 100 }
      ]
    }];

    expect(computeClientCapacity(services)).toMatchObject({
      contractHours: 300,
      activeHours: 100,
      phantomHours: 200
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// GAP 2 — the nightly drift check
// ═══════════════════════════════════════════════════════════════

describe('gap 2 — the nightly check watches the capacity field', () => {
  const staged = () => ([{
    id: 'lp1', type: ST.LEGAL_PROCEDURE, pricingType: 'hourly', status: 'active',
    totalHours: 300, hoursUsed: 0, hoursRemaining: 300,
    stages: [
      { id: 'stage_a', status: 'active', totalHours: 100, hoursUsed: 0, hoursRemaining: 100 },
      { id: 'stage_b', status: 'pending', totalHours: 200, hoursUsed: 0, hoursRemaining: 200 }
    ]
  }]);

  /** A client whose flat aggregates are already correct, so only capacity varies. */
  const client = (hoursCapacity) => ({
    services: staged(),
    totalHours: 300, hoursUsed: 0, hoursRemaining: 300,
    minutesUsed: 0, minutesRemaining: 18000,
    hoursCapacity
  });

  test('a CORRECT capacity field reports no drift', () => {
    const correct = computeClientCapacity(staged());
    const drifts = detectAggregateDrift(client(correct));
    expect(drifts.filter((d) => d.field.startsWith('hoursCapacity'))).toEqual([]);
  });

  test('a WRONG activeHours is caught, with both values', () => {
    const drifts = detectAggregateDrift(
      client({ activeHours: 300, contractHours: 300, phantomHours: 0 })
    );
    const found = drifts.find((d) => d.field === 'hoursCapacity.activeHours');
    expect(found).toBeDefined();
    expect(found.current).toBe(300);
    expect(found.canonical).toBe(100);
  });

  test('a WRONG phantomHours is caught — the number the office reads', () => {
    const drifts = detectAggregateDrift(
      client({ activeHours: 100, contractHours: 300, phantomHours: 0 })
    );
    expect(drifts.some((d) => d.field === 'hoursCapacity.phantomHours')).toBe(true);
  });

  test('a MISSING field is NOT drift — absence is by design, not an error', () => {
    // internal_office is exempt, and any document written before the field
    // existed simply lacks it. Flagging those would produce noise on exactly
    // the clients we deliberately chose not to touch.
    expect(detectAggregateDrift(client(undefined))).toEqual([]);
    expect(detectAggregateDrift(client(null))).toEqual([]);
  });

  test('a malformed field is not drift either, and never throws', () => {
    expect(() => detectAggregateDrift(client('nonsense'))).not.toThrow();
    expect(detectAggregateDrift(client('nonsense'))).toEqual([]);
    expect(() => detectAggregateDrift(client({}))).not.toThrow();
  });

  test('the existing flat-field drift detection still works, untouched', () => {
    const c = client(computeClientCapacity(staged()));
    c.totalHours = 999; // deliberate drift on the OLD field
    const drifts = detectAggregateDrift(c);
    expect(drifts.some((d) => d.field === 'totalHours')).toBe(true);
  });
});
