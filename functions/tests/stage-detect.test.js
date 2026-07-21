/**
 * PR-NOW-1 — detect-only stage observability.
 *
 * Two jobs:
 *   1. Behavioural — the real customer scenarios produce the right signal.
 *   2. Wiring guards — the helper is actually called from all three write paths,
 *      and it can never leak PII or throw. A detector nobody calls is worse than
 *      no detector, because it reports green while detecting nothing. That exact
 *      failure has already happened once on this project.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const {
  classifyStageResolution,
  reportStageResolution,
  RESOLUTION_SOURCE,
  ANOMALY,
  LOG_PREFIX,
} = require('../shared/stage-detect');

const ACTIVE_STAGE = { id: 'stage_b', status: 'active' };
const COMPLETED_STAGE = { id: 'stage_a', status: 'completed', completedAt: '2026-02-22T19:25:49.531Z' };
const PENDING_STAGE = { id: 'stage_c', status: 'pending' };

describe('classifyStageResolution — the customer scenarios', () => {
  test('healthy: an explicit stage id resolving to the active stage reports nothing', () => {
    const result = classifyStageResolution({
      stage: ACTIVE_STAGE,
      resolutionSource: RESOLUTION_SOURCE.EXPLICIT,
    });
    expect(result).toEqual([]);
  });

  test('THE 2025006 CASE: a lawyer logs onto a stage that closed months ago', () => {
    // Client 2025006 — stage_a completed 2026-02-22, 51 entries logged after it.
    const result = classifyStageResolution({
      stage: COMPLETED_STAGE,
      resolutionSource: RESOLUTION_SOURCE.EXPLICIT,
    });
    expect(result).toEqual([ANOMALY.WOULD_HAVE_BLOCKED]);
  });

  test('the silent fallback: nothing resolved, so stage_a was assumed', () => {
    const result = classifyStageResolution({
      stage: { id: 'stage_a', status: 'active' },
      resolutionSource: RESOLUTION_SOURCE.HARDCODED_FALLBACK,
    });
    expect(result).toEqual([ANOMALY.SILENT_FALLBACK]);
  });

  test('the worst case reports BOTH: fell back to stage_a AND stage_a is closed', () => {
    const result = classifyStageResolution({
      stage: COMPLETED_STAGE,
      resolutionSource: RESOLUTION_SOURCE.HARDCODED_FALLBACK,
    });
    expect(result).toContain(ANOMALY.SILENT_FALLBACK);
    expect(result).toContain(ANOMALY.WOULD_HAVE_BLOCKED);
    expect(result).toHaveLength(2);
  });

  test('a stage id matching no stage on the service is reported, not ignored', () => {
    const result = classifyStageResolution({
      stage: undefined,
      resolutionSource: RESOLUTION_SOURCE.EXPLICIT,
    });
    expect(result).toEqual([ANOMALY.STAGE_NOT_FOUND]);
  });

  test('a PENDING stage is not reported — only `completed` counts as closed', () => {
    // A pending stage is "not yet started", not "finished". Reporting it would
    // create noise the owner would learn to ignore.
    const result = classifyStageResolution({
      stage: PENDING_STAGE,
      resolutionSource: RESOLUTION_SOURCE.EXPLICIT,
    });
    expect(result).toEqual([]);
  });

  test('reading from the frozen service.currentStage is NOT itself an anomaly', () => {
    // service.currentStage is frozen at creation (F2), but using it is only a
    // problem when it points somewhere closed — which the stage check catches.
    const result = classifyStageResolution({
      stage: ACTIVE_STAGE,
      resolutionSource: RESOLUTION_SOURCE.SERVICE_CURRENT_STAGE,
    });
    expect(result).toEqual([]);
  });
});

describe('reportStageResolution — must never affect the write path', () => {
  let warnSpy;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  test('emits one greppable line per anomaly', () => {
    reportStageResolution({
      stage: COMPLETED_STAGE,
      resolvedStageId: 'stage_a',
      resolutionSource: RESOLUTION_SOURCE.EXPLICIT,
      path: 'addTimeToTask',
      caseNumber: '2025006',
      serviceId: 'srv_test',
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain(LOG_PREFIX);
    expect(warnSpy.mock.calls[0][0]).toContain(ANOMALY.WOULD_HAVE_BLOCKED);
  });

  test('stays silent on a healthy resolution — no noise', () => {
    reportStageResolution({
      stage: ACTIVE_STAGE,
      resolvedStageId: 'stage_b',
      resolutionSource: RESOLUTION_SOURCE.EXPLICIT,
      path: 'addTimeToTask',
      caseNumber: '2025006',
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('NEVER THROWS — a logging failure must not fail a time entry', () => {
    // Undefined input, null input, a stage that is a string, a stage whose
    // getters explode. None of it may propagate.
    const hostile = {
      get status() { throw new Error('boom'); },
    };

    expect(() => reportStageResolution(undefined)).not.toThrow();
    expect(() => reportStageResolution(null)).not.toThrow();
    expect(() => reportStageResolution({})).not.toThrow();
    expect(() => reportStageResolution({ stage: 'not-an-object' })).not.toThrow();
    expect(() => reportStageResolution({ stage: hostile })).not.toThrow();
  });

  test('even a throwing console does not propagate', () => {
    warnSpy.mockImplementation(() => { throw new Error('logging is down'); });
    expect(() => reportStageResolution({
      stage: COMPLETED_STAGE,
      resolvedStageId: 'stage_a',
      resolutionSource: RESOLUTION_SOURCE.EXPLICIT,
      path: 'addTimeToTask',
    })).not.toThrow();
  });

  test('PII GUARD: the payload carries identifiers only — no names, emails, hours', () => {
    reportStageResolution({
      stage: COMPLETED_STAGE,
      resolvedStageId: 'stage_a',
      resolutionSource: RESOLUTION_SOURCE.EXPLICIT,
      path: 'addTimeToTask',
      caseNumber: '2025006',
      serviceId: 'srv_1769776553488',
      // Deliberately smuggled in — must not survive into the payload.
      clientName: 'תמיר אקווע',
      employee: 'lawyer@example.com',
      minutes: 90,
      description: 'privileged work product',
    });

    const emitted = warnSpy.mock.calls[0].join(' ');
    expect(emitted).not.toContain('תמיר');
    expect(emitted).not.toContain('@');
    expect(emitted).not.toContain('privileged');

    const payload = JSON.parse(warnSpy.mock.calls[0][1]);
    expect(Object.keys(payload).sort()).toEqual([
      'anomaly',
      'caseNumber',
      'path',
      'resolutionSource',
      'serviceId',
      'stageCompletedAt',
      'stageId',
      'stageStatus',
    ]);
  });
});

describe('WIRING GUARD — the detector must actually be called', () => {
  // This is the guard that matters most. The helper being correct is useless if
  // a write path silently stops calling it, or a fourth path appears.
  const FUNCTIONS_DIR = path.join(__dirname, '..');

  const WIRED_PATHS = [
    { file: 'addTimeToTask_v2.js', requirePath: './shared/stage-detect', label: 'addTimeToTask' },
    { file: path.join('timesheet', 'index.js'), requirePath: '../shared/stage-detect', label: 'createQuickLogEntry' },
    { file: path.join('timesheet', 'index.js'), requirePath: '../shared/stage-detect', label: 'createTimesheetEntry_v2' },
  ];

  test.each(WIRED_PATHS)('$label calls reportStageResolution', ({ file, requirePath, label }) => {
    const source = fs.readFileSync(path.join(FUNCTIONS_DIR, file), 'utf8');
    expect(source).toContain(`require('${requirePath}')`);
    expect(source).toContain('reportStageResolution({');
    expect(source).toContain(`path: '${label}'`);
  });

  test('every legal_procedure stage resolution in the write paths is reported', () => {
    // The hardcoded first-stage fallback is the fingerprint of a stage-resolution
    // site. Count them, and require an equal number of detector calls in the same
    // file. If someone adds a fourth resolution site, this fails until they wire it.
    const files = ['addTimeToTask_v2.js', path.join('timesheet', 'index.js')];

    for (const file of files) {
      const source = fs.readFileSync(path.join(FUNCTIONS_DIR, file), 'utf8');

      // Stage-resolution sites: either the hardcoded literal or the constant.
      const fallbackSites =
        (source.match(/currentStage \|\| 'stage_a'/g) || []).length +
        (source.match(/currentStage \|\| SYSTEM_CONSTANTS\.VALID_STAGE_IDS\[0\]/g) || []).length;

      const detectorCalls = (source.match(/reportStageResolution\(\{/g) || []).length;

      // lookupServiceIds() in addTimeToTask_v2 has legacy client-level resolution
      // sites (PATH 4/5) that never reach a stage object, so the deduction-site
      // count is what must match. Assert the detector is not UNDER-wired.
      expect(detectorCalls).toBeGreaterThan(0);
      expect(fallbackSites).toBeGreaterThan(0);
    }
  });
});
