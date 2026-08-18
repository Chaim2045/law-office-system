/**
 * repair-stamp-trigger-noop.test.js — MANDATORY regression (devils-advocate A4;
 * design PR-DRIFT-2 §6 / §13).
 *
 * PINS THE INVARIANT THE WHOLE REPAIR MIGRATION DEPENDS ON:
 *   The repair script (functions/scripts/repair-package-aggregates.js) stamps
 *   historical orphan timesheet entries with
 *       { packageId, repairStampedAt, repairRunId }
 *   minutes UNCHANGED, serviceId UNCHANGED. The Firestore onUpdate trigger
 *   (functions/triggers/timesheet-trigger.js) MUST treat this as a ZERO-hours
 *   mutation no-op (early return) — otherwise the repair would re-deduct and
 *   re-corrupt the very drift it is fixing. The rollback un-stamp
 *       { packageId: null, repairStampedAt: <delete>, repairRunId: <delete> }
 *   is the same shape (minutes/serviceId unchanged) → also a no-op.
 *
 * MECHANISM (house pattern — mirrors tests/pr-drift-1-check7.test.js):
 *   We test the PURE predicates exported via `_test`:
 *     - getMinutesDelta(eventType, before, after)        → after.minutes - before.minutes
 *     - isServiceTransferChange(eventType, before, after) → serviceId before vs after
 *     - isZeroHoursMutationNoOp(eventType, before, after) → the trigger's early-return decision
 *   These mirror, byte-for-byte, the handler's inline guard at
 *   timesheet-trigger.js:281-284. A DRIFT-GUARD test (group 4) asserts the
 *   handler source still carries the identical inline expressions so the pure
 *   predicates can never silently diverge from the runtime path.
 *
 *   No Firestore emulator. Unit-level only.
 */
'use strict';

// ── Mocks required just to require() the trigger module ──────────────────────
// (requiring timesheet-trigger.js runs admin.firestore() + onDocumentWritten at
//  module load — mirror the canonical-helper test's mocks so the require works.)
const mockDb = {
  collection: jest.fn(() => ({ doc: jest.fn((id) => ({ id: id || 'auto_id' })) })),
  runTransaction: jest.fn()
};

jest.mock('firebase-admin', () => {
  const FieldValue = {
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
    increment: jest.fn((n) => ({ _increment: n }))
  };
  const Timestamp = {
    now: jest.fn(() => 'NOW'),
    fromDate: jest.fn((d) => ({ _date: d.toISOString() }))
  };
  return {
    initializeApp: jest.fn(),
    firestore: Object.assign(() => mockDb, { FieldValue, Timestamp })
  };
});

jest.mock('firebase-functions/v2/firestore', () => ({
  onDocumentWritten: jest.fn((config, fn) => fn)
}));

jest.mock('../shared/client-writer', () => ({
  writeClientWithCanonicalAggregates: jest.fn(),
  RESTRICTED_KEYS: []
}));

const fs = require('fs');
const path = require('path');

const { _test } = require('../triggers/timesheet-trigger');
const { getMinutesDelta, isServiceTransferChange, isZeroHoursMutationNoOp } = _test;

// ── Fixtures: the EXACT stamp / un-stamp shapes from repair-package-aggregates.js
// Forward stamp: orphan entry (packageId:null) → packageId:'PKG1' + repair tags.
const STAMP_BEFORE = {
  minutes: 60, serviceId: 'S1', parentServiceId: 'S1', packageId: null
};
const STAMP_AFTER = {
  minutes: 60, serviceId: 'S1', parentServiceId: 'S1',
  packageId: 'PKG1', repairStampedAt: 'SERVER_TIMESTAMP', repairRunId: 'run-x'
};

// Rollback un-stamp: packageId back to null, repair tags removed.
const UNSTAMP_BEFORE = {
  minutes: 60, serviceId: 'S1', packageId: 'PKG1', repairRunId: 'run-x'
};
const UNSTAMP_AFTER = {
  minutes: 60, serviceId: 'S1', packageId: null
};

describe('repair-stamp trigger no-op invariant (devils-advocate A4 / PR-DRIFT-2 §6,§13)', () => {
  // ════════════════════════════════════════════════════════════════════════
  // 1. Forward stamp no-op
  // ════════════════════════════════════════════════════════════════════════
  describe('1. Forward stamp no-op', () => {
    test('packageId:null → PKG1 (+ repair tags), minutes/serviceId unchanged → NO-OP', () => {
      // The two facts the guard rests on:
      expect(getMinutesDelta('UPDATE', STAMP_BEFORE, STAMP_AFTER)).toBe(0);
      expect(isServiceTransferChange('UPDATE', STAMP_BEFORE, STAMP_AFTER)).toBe(false);

      // The decisive predicate: trigger MUST early-return (zero-hours mutation).
      expect(isZeroHoursMutationNoOp('UPDATE', STAMP_BEFORE, STAMP_AFTER)).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // 2. Rollback un-stamp no-op
  // ════════════════════════════════════════════════════════════════════════
  describe('2. Rollback un-stamp no-op', () => {
    test('packageId:PKG1 → null (repair tags removed), minutes/serviceId unchanged → NO-OP', () => {
      expect(getMinutesDelta('UPDATE', UNSTAMP_BEFORE, UNSTAMP_AFTER)).toBe(0);
      expect(isServiceTransferChange('UPDATE', UNSTAMP_BEFORE, UNSTAMP_AFTER)).toBe(false);

      expect(isZeroHoursMutationNoOp('UPDATE', UNSTAMP_BEFORE, UNSTAMP_AFTER)).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // 3. Guard sanity (negative control) — a REAL minutes change must NOT skip
  // ════════════════════════════════════════════════════════════════════════
  describe('3. Guard sanity (negative control)', () => {
    test('minutes 60 → 90, same serviceId → minutesDelta===30 → NOT a no-op', () => {
      const before = { minutes: 60, serviceId: 'S1', parentServiceId: 'S1', packageId: 'PKG1' };
      const after = { minutes: 90, serviceId: 'S1', parentServiceId: 'S1', packageId: 'PKG1' };

      expect(getMinutesDelta('UPDATE', before, after)).toBe(30);
      expect(isServiceTransferChange('UPDATE', before, after)).toBe(false);

      // Proves the test would CATCH a regression that removed the no-op guard:
      // a real hours change must proceed, not early-return.
      expect(isZeroHoursMutationNoOp('UPDATE', before, after)).toBe(false);
    });

    test('service transfer with zero minutes still proceeds (transfer exception)', () => {
      // A serviceId change with equal minutes is NOT a no-op (the guard exempts
      // service transfers) — pins the `&& !isServiceTransfer` half of the guard.
      const before = { minutes: 60, serviceId: 'S1', packageId: 'PKG1' };
      const after = { minutes: 60, serviceId: 'S2', packageId: 'PKG2' };

      expect(getMinutesDelta('UPDATE', before, after)).toBe(0);
      expect(isServiceTransferChange('UPDATE', before, after)).toBe(true);
      expect(isZeroHoursMutationNoOp('UPDATE', before, after)).toBe(false);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // 4. Drift guard — the pure predicates must stay byte-identical to the
  //    handler's inline guard (so this test can never silently pin a copy that
  //    diverged from the runtime path).
  // ════════════════════════════════════════════════════════════════════════
  describe('4. Drift guard (pure predicate ⇔ handler inline guard)', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'triggers', 'timesheet-trigger.js'),
      'utf8'
    );

    test('handler still carries the inline service-transfer expression', () => {
      expect(src).toContain('beforeData.serviceId !== afterData.serviceId');
    });

    test('handler still carries the inline zero-delta early-return guard', () => {
      expect(src).toContain("eventType === 'UPDATE' && minutesDelta === 0 && !isServiceTransfer");
    });
  });
});
