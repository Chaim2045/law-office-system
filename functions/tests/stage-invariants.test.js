/**
 * PR-IG-C1 — tests for the pure stage-invariant detector
 * (`functions/shared/stage-invariants.js`).
 *
 * The module is pure (no I/O), so every scenario here is a plain unit test:
 * build a client doc + an entries array, call `detectStageInvariants`,
 * assert on the returned discrepancies/unresolved counters.
 */

'use strict';

const {
  DISCREPANCY_TYPE,
  STAGE_HOURS_TOLERANCE,
  resolveEntryToStage,
  indexLegalProcedureServices,
  detectStageInvariants,
} = require('../shared/stage-invariants');

// ─── builders ────────────────────────────────────────────────────────────

function makePackage(id, { hours = 100, hoursUsed = 0 } = {}) {
  return {
    id,
    hours,
    hoursUsed,
    hoursRemaining: hours - hoursUsed,
    status: 'active',
  };
}

function makeHourlyStage(id, { order = 1, status = 'active', completedAt = null, hoursUsed = 0, packages = null } = {}) {
  return {
    id,
    order,
    pricingType: 'hourly',
    status,
    completedAt,
    totalHours: 100,
    hoursUsed,
    hoursRemaining: 100 - hoursUsed,
    packages: packages === null ? [makePackage(`${id}_pkg`, { hoursUsed })] : packages,
  };
}

function makeFixedStage(id, { order = 1, status = 'active', completedAt = null, totalHoursWorked = 0 } = {}) {
  return {
    id,
    order,
    pricingType: 'fixed',
    status,
    completedAt,
    totalHoursWorked,
  };
}

function makeLegalProcedureService(id, stages, { name } = {}) {
  return {
    id,
    type: 'legal_procedure',
    name: name || `שירות ${id}`,
    stages,
  };
}

function makeClient(services) {
  return { clientName: 'לקוח בדיקה', services };
}

function makeEntry(overrides) {
  return {
    id: `entry_${Math.random().toString(36).slice(2, 8)}`,
    minutes: 60,
    date: '2026-03-01',
    ...overrides,
  };
}

// ─── (ii) the February class + same-day boundary ──────────────────────────

describe('detectStageInvariants — entries on a closed stage (variant ii)', () => {
  test('THE FEBRUARY CLASS: a completed stage with entries logged months after completedAt is flagged, with the correct hours total', () => {
    const stage = makeHourlyStage('stage_a', {
      status: 'completed',
      completedAt: '2026-02-01T10:00:00.000Z',
      hoursUsed: 3, // 2h resolved here + 1h pre-existing baseline noise, doesn't matter for (ii)
    });
    const svc = makeLegalProcedureService('svc1', [stage, makeHourlyStage('stage_b', { order: 2 })]);
    const client = makeClient([svc]);

    const entries = [
      makeEntry({ parentServiceId: 'svc1', stageId: 'stage_a', date: '2026-07-01', minutes: 90 }), // 1.5h, months later
      makeEntry({ parentServiceId: 'svc1', stageId: 'stage_a', date: '2026-06-15', minutes: 30 }), // 0.5h, months later
      makeEntry({ parentServiceId: 'svc1', stageId: 'stage_b', date: '2026-07-01', minutes: 60 }), // unrelated active stage
    ];

    const result = detectStageInvariants(client, entries);

    const closedStageFindings = result.discrepancies.filter(
      (d) => d.type === DISCREPANCY_TYPE.ENTRY_ON_CLOSED_STAGE
    );
    expect(closedStageFindings).toHaveLength(1);
    expect(closedStageFindings[0]).toMatchObject({
      serviceId: 'svc1',
      stageId: 'stage_a',
      entriesCount: 2,
      hours: 2, // 90+30 minutes = 2h
      latestEntryDate: '2026-07-01',
    });
  });

  test('SAME-DAY BOUNDARY: an entry dated exactly on completedAt is NOT flagged', () => {
    const stage = makeHourlyStage('stage_a', {
      status: 'completed',
      completedAt: '2026-02-22T19:25:49.531Z',
    });
    const svc = makeLegalProcedureService('svc1', [stage]);
    const client = makeClient([svc]);

    const entries = [
      makeEntry({ parentServiceId: 'svc1', stageId: 'stage_a', date: '2026-02-22', minutes: 45 }),
    ];

    const result = detectStageInvariants(client, entries);
    const closedStageFindings = result.discrepancies.filter(
      (d) => d.type === DISCREPANCY_TYPE.ENTRY_ON_CLOSED_STAGE
    );
    expect(closedStageFindings).toHaveLength(0);
  });

  test('wording is neutral — never claims the entry is "wrong"', () => {
    const stage = makeHourlyStage('stage_a', {
      status: 'completed',
      completedAt: '2026-02-01T00:00:00.000Z',
    });
    const svc = makeLegalProcedureService('svc1', [stage]);
    const client = makeClient([svc]);
    const entries = [makeEntry({ parentServiceId: 'svc1', stageId: 'stage_a', date: '2026-05-01' })];

    const result = detectStageInvariants(client, entries);
    const json = JSON.stringify(result.discrepancies);
    expect(json).not.toMatch(/שגוי|wrong|incorrect/i);
  });

  test('a stage without a usable completedAt is never flagged by variant (ii)', () => {
    const stage = makeHourlyStage('stage_a', { status: 'completed', completedAt: null });
    const svc = makeLegalProcedureService('svc1', [stage]);
    const client = makeClient([svc]);
    const entries = [makeEntry({ parentServiceId: 'svc1', stageId: 'stage_a', date: '2026-07-01' })];

    const result = detectStageInvariants(client, entries);
    expect(result.discrepancies.filter((d) => d.type === DISCREPANCY_TYPE.ENTRY_ON_CLOSED_STAGE)).toHaveLength(0);
  });
});

// ─── (i) stage-level hours vs the ledger ──────────────────────────────────

describe('detectStageInvariants — stage hours vs ledger (variant i)', () => {
  test('WRONG-BUT-ACTIVE STAGE: an active stage whose stored hours disagree with resolved entries is flagged', () => {
    const stage = makeHourlyStage('stage_b', { status: 'active', hoursUsed: 5 }); // stored says 5h
    const svc = makeLegalProcedureService('svc1', [stage]);
    const client = makeClient([svc]);

    // Ledger says only 1h landed here (a smaller amount than stored — a
    // real mismatch, not rounding noise).
    const entries = [makeEntry({ parentServiceId: 'svc1', stageId: 'stage_b', minutes: 60 })];

    const result = detectStageInvariants(client, entries);
    const findings = result.discrepancies.filter((d) => d.type === DISCREPANCY_TYPE.STAGE_HOURS_MISMATCH);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      serviceId: 'svc1',
      stageId: 'stage_b',
      storedHours: 5,
      ledgerHours: 1,
    });
    expect(findings[0].gap).toBeGreaterThan(STAGE_HOURS_TOLERANCE);
  });

  test('a stage whose stored hours match the ledger within tolerance is not flagged', () => {
    const stage = makeHourlyStage('stage_b', { status: 'active', hoursUsed: 1.01 });
    const svc = makeLegalProcedureService('svc1', [stage]);
    const client = makeClient([svc]);
    const entries = [makeEntry({ parentServiceId: 'svc1', stageId: 'stage_b', minutes: 60 })]; // 1h

    const result = detectStageInvariants(client, entries);
    expect(result.discrepancies.filter((d) => d.type === DISCREPANCY_TYPE.STAGE_HOURS_MISMATCH)).toHaveLength(0);
  });
});

// ─── the fixed-vs-hourly field split ───────────────────────────────────────

describe('detectStageInvariants — pricingType field split (V12)', () => {
  test('a fixed stage compares against totalHoursWorked and is NOT flagged merely for lacking hoursUsed', () => {
    const stage = makeFixedStage('stage_a', { totalHoursWorked: 2 }); // no hoursUsed field at all
    expect(stage.hoursUsed).toBeUndefined();
    const svc = makeLegalProcedureService('svc1', [stage]);
    const client = makeClient([svc]);
    const entries = [makeEntry({ parentServiceId: 'svc1', stageId: 'stage_a', minutes: 120 })]; // 2h

    const result = detectStageInvariants(client, entries);
    expect(result.discrepancies.filter((d) => d.type === DISCREPANCY_TYPE.STAGE_HOURS_MISMATCH)).toHaveLength(0);
  });

  test('an hourly stage compares against hoursUsed, not totalHoursWorked', () => {
    const stage = makeHourlyStage('stage_a', { hoursUsed: 2 });
    expect(stage.totalHoursWorked).toBeUndefined();
    const svc = makeLegalProcedureService('svc1', [stage]);
    const client = makeClient([svc]);
    const entries = [makeEntry({ parentServiceId: 'svc1', stageId: 'stage_a', minutes: 120 })]; // 2h

    const result = detectStageInvariants(client, entries);
    expect(result.discrepancies.filter((d) => d.type === DISCREPANCY_TYPE.STAGE_HOURS_MISMATCH)).toHaveLength(0);
  });

  test('using totalHoursWorked for an hourly stage would false-flag it — the guard against that regression', () => {
    // An hourly stage's totalHoursWorked is undefined (→0); if the detector
    // ever regressed to reading that field for hourly stages, a healthy
    // stage with real hoursUsed would falsely appear to have 0 stored hours
    // against a nonzero ledger. This test locks in the correct behaviour:
    // no false flag.
    const stage = makeHourlyStage('stage_a', { hoursUsed: 3 });
    const svc = makeLegalProcedureService('svc1', [stage]);
    const client = makeClient([svc]);
    const entries = [makeEntry({ parentServiceId: 'svc1', stageId: 'stage_a', minutes: 180 })]; // 3h

    const result = detectStageInvariants(client, entries);
    expect(result.discrepancies).toHaveLength(0);
  });
});

// ─── the trap that broke prior measurements: duplicate stage ids across services ──

describe('detectStageInvariants — two legal_procedure services, both with stage_a', () => {
  test('each entry resolves to its own service; neither stage absorbs the other\'s hours', () => {
    const stageA1 = makeHourlyStage('stage_a', { hoursUsed: 1 });
    const stageA2 = makeHourlyStage('stage_a', { hoursUsed: 2 });
    const svc1 = makeLegalProcedureService('svcA', [stageA1]);
    const svc2 = makeLegalProcedureService('svcB', [stageA2]);
    const client = makeClient([svc1, svc2]);

    const entries = [
      makeEntry({ parentServiceId: 'svcA', stageId: 'stage_a', minutes: 60 }), // 1h → svcA.stage_a
      makeEntry({ parentServiceId: 'svcB', stageId: 'stage_a', minutes: 120 }), // 2h → svcB.stage_a
    ];

    const result = detectStageInvariants(client, entries);

    // Both stages match their own stored hours exactly — zero discrepancies.
    // If service-anchoring were done AFTER stage lookup (the bug that
    // produced the wrong "120" measurement), the two 'stage_a' buckets
    // would collide into one 3h sum and BOTH stages would appear wrong.
    expect(result.discrepancies).toHaveLength(0);
    expect(result.unresolvedCount).toBe(0);
  });

  test('a mismatch on one service\'s stage_a does not leak into the other', () => {
    const stageA1 = makeHourlyStage('stage_a', { hoursUsed: 5 }); // wrong — ledger will say 1h
    const stageA2 = makeHourlyStage('stage_a', { hoursUsed: 2 }); // correct — ledger says 2h
    const svc1 = makeLegalProcedureService('svcA', [stageA1]);
    const svc2 = makeLegalProcedureService('svcB', [stageA2]);
    const client = makeClient([svc1, svc2]);

    const entries = [
      makeEntry({ parentServiceId: 'svcA', stageId: 'stage_a', minutes: 60 }),
      makeEntry({ parentServiceId: 'svcB', stageId: 'stage_a', minutes: 120 }),
    ];

    const result = detectStageInvariants(client, entries);
    const findings = result.discrepancies.filter((d) => d.type === DISCREPANCY_TYPE.STAGE_HOURS_MISMATCH);
    expect(findings).toHaveLength(1);
    expect(findings[0].serviceId).toBe('svcA');
  });
});

// ─── each resolution path exercised separately ─────────────────────────────

describe('resolveEntryToStage — each resolution path', () => {
  test('resolves via entry.parentServiceId + entry.stageId', () => {
    const svc = makeLegalProcedureService('svc1', [makeHourlyStage('stage_a')]);
    const idx = indexLegalProcedureServices(makeClient([svc]));
    const entry = { parentServiceId: 'svc1', stageId: 'stage_a' };
    expect(resolveEntryToStage(entry, idx)).toEqual({ serviceId: 'svc1', stageId: 'stage_a' });
  });

  test('resolves via entry.serviceId naming the service directly + entry.stageId', () => {
    const svc = makeLegalProcedureService('svc1', [makeHourlyStage('stage_a')]);
    const idx = indexLegalProcedureServices(makeClient([svc]));
    const entry = { serviceId: 'svc1', stageId: 'stage_a' };
    expect(resolveEntryToStage(entry, idx)).toEqual({ serviceId: 'svc1', stageId: 'stage_a' });
  });

  test('resolves the STAGE via entry.serviceId when it startsWith("stage_") (service already anchored via parentServiceId)', () => {
    const svc = makeLegalProcedureService('svc1', [makeHourlyStage('stage_a')]);
    const idx = indexLegalProcedureServices(makeClient([svc]));
    const entry = { parentServiceId: 'svc1', serviceId: 'stage_a' }; // no stageId field at all
    expect(resolveEntryToStage(entry, idx)).toEqual({ serviceId: 'svc1', stageId: 'stage_a' });
  });

  test('resolves BOTH service and stage via entry.packageId only (no parentServiceId/serviceId/stageId at all)', () => {
    const pkg = makePackage('pkg_x');
    const stage = makeHourlyStage('stage_a', { packages: [pkg] });
    const svc = makeLegalProcedureService('svc1', [stage]);
    const idx = indexLegalProcedureServices(makeClient([svc]));
    const entry = { packageId: 'pkg_x' };
    expect(resolveEntryToStage(entry, idx)).toEqual({ serviceId: 'svc1', stageId: 'stage_a' });
  });

  test('service-anchor precedence: parentServiceId wins over a stale/wrong entry.serviceId', () => {
    const svcReal = makeLegalProcedureService('svcReal', [makeHourlyStage('stage_a')]);
    const svcOther = makeLegalProcedureService('svcOther', [makeHourlyStage('stage_a')]);
    const idx = indexLegalProcedureServices(makeClient([svcReal, svcOther]));
    const entry = { parentServiceId: 'svcReal', serviceId: 'svcOther', stageId: 'stage_a' };
    expect(resolveEntryToStage(entry, idx)).toEqual({ serviceId: 'svcReal', stageId: 'stage_a' });
  });
});

// ─── unresolvable entries are counted, not dropped ─────────────────────────

describe('detectStageInvariants — unresolved entries', () => {
  test('an entry naming a legal_procedure service but an unknown stageId is counted as unresolved, not silently dropped', () => {
    const svc = makeLegalProcedureService('svc1', [makeHourlyStage('stage_a')]);
    const client = makeClient([svc]);
    const entries = [
      makeEntry({ parentServiceId: 'svc1', stageId: 'stage_zzz_does_not_exist' }),
    ];

    const result = detectStageInvariants(client, entries);
    expect(result.unresolvedCount).toBe(1);
    expect(result.unresolvedSamples).toHaveLength(1);
    expect(result.unresolvedSamples[0]).toMatchObject({ parentServiceId: 'svc1' });
  });

  test('an entry whose packageId matches no package anywhere on a legal_procedure client is counted as unresolved', () => {
    const svc = makeLegalProcedureService('svc1', [makeHourlyStage('stage_a')]);
    const client = makeClient([svc]);
    const entries = [makeEntry({ packageId: 'pkg_ghost' })];

    const result = detectStageInvariants(client, entries);
    expect(result.unresolvedCount).toBe(1);
  });

  test('unresolved count is bounded in samples but not in the counter itself', () => {
    const svc = makeLegalProcedureService('svc1', [makeHourlyStage('stage_a')]);
    const client = makeClient([svc]);
    const entries = Array.from({ length: 30 }, (_, i) =>
      makeEntry({ parentServiceId: 'svc1', stageId: `unknown_${i}` })
    );

    const result = detectStageInvariants(client, entries);
    expect(result.unresolvedCount).toBe(30);
    expect(result.unresolvedSamples.length).toBeLessThan(30);
    expect(result.unresolvedSamples.length).toBeGreaterThan(0);
  });

  test('an entry belonging to a different (non-legal_procedure) service is out of scope, not unresolved', () => {
    const hoursSvc = { id: 'hoursSvc', type: 'hours', name: 'שירות שעות' };
    const legalSvc = makeLegalProcedureService('svc1', [makeHourlyStage('stage_a')]);
    const client = makeClient([hoursSvc, legalSvc]);
    const entries = [makeEntry({ parentServiceId: 'hoursSvc' })];

    const result = detectStageInvariants(client, entries);
    expect(result.unresolvedCount).toBe(0);
    expect(result.discrepancies).toHaveLength(0);
  });

  test('an entry with no service/stage/package anchor at all is out of scope, not unresolved', () => {
    const svc = makeLegalProcedureService('svc1', [makeHourlyStage('stage_a')]);
    const client = makeClient([svc]);
    const entries = [makeEntry({})]; // no parentServiceId/serviceId/packageId

    const result = detectStageInvariants(client, entries);
    expect(result.unresolvedCount).toBe(0);
  });
});

// ─── healthy client — no false positives ───────────────────────────────────

describe('detectStageInvariants — a healthy client produces zero discrepancies', () => {
  test('multiple services, multiple stages, all matching, all active — zero findings', () => {
    const stageA = makeHourlyStage('stage_a', { status: 'completed', completedAt: '2026-01-01T00:00:00.000Z', hoursUsed: 2 });
    const stageB = makeHourlyStage('stage_b', { status: 'active', hoursUsed: 1 });
    const fixedStage = makeFixedStage('stage_c', { status: 'active', totalHoursWorked: 4 });
    const svc = makeLegalProcedureService('svc1', [stageA, stageB]);
    const svc2 = makeLegalProcedureService('svc2', [fixedStage]);
    const client = makeClient([svc, svc2]);

    const entries = [
      makeEntry({ parentServiceId: 'svc1', stageId: 'stage_a', date: '2025-12-15', minutes: 120 }), // before closure
      makeEntry({ parentServiceId: 'svc1', stageId: 'stage_b', date: '2026-03-01', minutes: 60 }),
      makeEntry({ parentServiceId: 'svc2', stageId: 'stage_c', date: '2026-03-01', minutes: 240 }),
    ];

    const result = detectStageInvariants(client, entries);
    expect(result.discrepancies).toEqual([]);
    expect(result.unresolvedCount).toBe(0);
  });

  test('a client with no legal_procedure services at all produces zero discrepancies and zero unresolved', () => {
    const hoursSvc = { id: 'h1', type: 'hours', name: 'שירות שעות' };
    const client = makeClient([hoursSvc]);
    const entries = [makeEntry({ parentServiceId: 'h1', minutes: 60 })];

    const result = detectStageInvariants(client, entries);
    expect(result.discrepancies).toEqual([]);
    expect(result.unresolvedCount).toBe(0);
  });

  test('empty entries array — zero discrepancies, zero unresolved', () => {
    const svc = makeLegalProcedureService('svc1', [makeHourlyStage('stage_a')]);
    const client = makeClient([svc]);
    const result = detectStageInvariants(client, []);
    expect(result.discrepancies).toEqual([]);
    expect(result.unresolvedCount).toBe(0);
  });
});

// ─── determinism ────────────────────────────────────────────────────────────

describe('detectStageInvariants — determinism', () => {
  test('the same inputs shuffled into a different order produce identical output', () => {
    const stageA = makeHourlyStage('stage_a', { status: 'completed', completedAt: '2026-02-01T00:00:00.000Z', hoursUsed: 5 });
    const stageB = makeHourlyStage('stage_b', { status: 'active', hoursUsed: 9 });
    const svc1 = makeLegalProcedureService('svcA', [stageA]);
    const svc2 = makeLegalProcedureService('svcB', [stageB]);
    const client = makeClient([svc1, svc2]);

    const entries = [
      makeEntry({ parentServiceId: 'svcA', stageId: 'stage_a', date: '2026-07-01', minutes: 60, id: 'e1' }),
      makeEntry({ parentServiceId: 'svcA', stageId: 'stage_a', date: '2026-06-01', minutes: 30, id: 'e2' }),
      makeEntry({ parentServiceId: 'svcB', stageId: 'stage_b', date: '2026-03-01', minutes: 90, id: 'e3' }),
      makeEntry({ parentServiceId: 'svcB', stageId: 'unknownStage', date: '2026-03-01', minutes: 15, id: 'e4' }),
    ];

    const shuffled = [entries[3], entries[1], entries[0], entries[2]];
    const clientShuffled = makeClient([svc2, svc1]); // services in reverse order too

    const resultA = detectStageInvariants(client, entries);
    const resultB = detectStageInvariants(clientShuffled, shuffled);

    expect(resultB.discrepancies).toEqual(resultA.discrepancies);
    expect(resultB.unresolvedCount).toEqual(resultA.unresolvedCount);
    expect(resultB.unresolvedSamples).toEqual(resultA.unresolvedSamples);
  });
});

// ─── no PII in output ───────────────────────────────────────────────────────

describe('detectStageInvariants — no PII in returned discrepancies', () => {
  test('output never contains a client name field', () => {
    const stage = makeHourlyStage('stage_a', { status: 'completed', completedAt: '2026-01-01T00:00:00.000Z' });
    const svc = makeLegalProcedureService('svc1', [stage]);
    const client = makeClient([svc]);
    const entries = [makeEntry({ parentServiceId: 'svc1', stageId: 'stage_a', date: '2026-06-01' })];

    const result = detectStageInvariants(client, entries);
    const json = JSON.stringify(result);
    expect(json).not.toContain('לקוח בדיקה');
  });
});
