/**
 * Static AST/source guard — every hour-admitting write path must IMPORT and CALL
 * the SSOT status gate `assertServiceAcceptsHours` (functions/shared/service-status.js).
 *
 * This is a regression backstop: if a future refactor drops a gate call from any
 * write path, this fails even if that path's behavioral test was also removed.
 * Mirrors the fs.readFileSync source-scan house pattern (serviceId-validation.test.js).
 */

const fs = require('fs');
const path = require('path');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

// Extract a single exported/handler block from `code` starting at `startMarker`
// up to the next top-level `exports.` (approximation good enough for a call scan).
function block(code, startMarker) {
  const start = code.indexOf(startMarker);
  if (start === -1) {
    return '';
  }
  const next = code.indexOf('\nexports.', start + startMarker.length);
  return code.substring(start, next > start ? next : code.length);
}

function countCalls(src) {
  return (src.match(/assertServiceAcceptsHours\s*\(/g) || []).length;
}

describe('service-hours-locked — every write path imports the gate', () => {
  test('addTimeToTask_v2.js requires service-status', () => {
    expect(read('addTimeToTask_v2.js')).toContain("require('./shared/service-status')");
  });
  test('timesheet/index.js requires service-status', () => {
    expect(read('timesheet/index.js')).toContain("require('../shared/service-status')");
  });
  test('services/index.js requires service-status', () => {
    expect(read('services/index.js')).toContain("require('../shared/service-status')");
  });
});

describe('service-hours-locked — every write path CALLS the gate', () => {
  test('addTimeToTaskWithTransaction calls assertServiceAcceptsHours', () => {
    const src = block(read('addTimeToTask_v2.js'), 'async function addTimeToTaskWithTransaction');
    expect(src).toContain('assertServiceAcceptsHours(');
  });

  test('createQuickLogEntry calls assertServiceAcceptsHours', () => {
    const src = block(read('timesheet/index.js'), 'exports.createQuickLogEntry');
    expect(src).toContain('assertServiceAcceptsHours(');
  });

  test('createTimesheetEntry_v2 calls assertServiceAcceptsHours', () => {
    const src = block(read('timesheet/index.js'), 'exports.createTimesheetEntry_v2');
    expect(src).toContain('assertServiceAcceptsHours(');
  });

  test('updateTimesheetEntry calls assertServiceAcceptsHours', () => {
    const src = block(read('timesheet/index.js'), 'exports.updateTimesheetEntry');
    expect(src).toContain('assertServiceAcceptsHours(');
  });

  test('timesheet/index.js has all 3 gate calls', () => {
    expect(countCalls(read('timesheet/index.js'))).toBe(3);
  });

  test('addPackageToService calls assertServiceAcceptsHours', () => {
    const src = block(read('services/index.js'), 'exports.addPackageToService');
    expect(src).toContain('assertServiceAcceptsHours(');
  });

  test('addHoursPackageToStage gates on the SERVICE only (stage-level lock DEFERRED — Q2)', () => {
    const src = block(read('services/index.js'), 'exports.addHoursPackageToStage');
    // SERVICE-level gate is the locked requirement…
    expect(src).toContain('assertServiceAcceptsHours(legalProcedure)');
    // …and the STAGE is deliberately NOT gated here (Haim 2026-08-10: service-level
    // only; the office tops up completed stages + no reopen-stage path exists yet).
    expect(src).not.toContain('assertServiceAcceptsHours(targetStage)');
  });
});
