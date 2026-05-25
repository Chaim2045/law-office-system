/**
 * PR-DED-1 (2026-05-25) — getActivePackage selection priority.
 *
 * Tests the canonical exported function (not an inline mock). Covers:
 *   - Bug repro: depleted initial + fresh additional → returns fresh
 *   - BC: single package, depleted within -10h → returns it (allowOverdraft)
 *   - BC: single package, active hours>0 → returns it
 *   - All depleted past -10h → null
 *   - allowOverdraft=false → strict mode, only fresh packages
 *   - overrideActive + depleted past -10h → returns it
 *   - overrideActive + depleted+fresh → returns FRESH (priority preserved)
 *   - FIFO tie-break by purchaseDate ascending
 *   - Stage status BC branch (no stage.status field)
 *   - Branch A: pending status eligible when stage.status='active'
 *
 * Imports the real module to prevent fossil tests.
 */

const { getActivePackage } = require('../src/modules/deduction/deduction-logic');

describe('getActivePackage — PR-DED-1 selection priority', () => {

  // ─── Bug repro: Miri Daniel (2026065) Stage A ───
  test('Bug repro: depleted initial + fresh additional → returns fresh additional', () => {
    const stage = {
      id: 'stage_a',
      status: 'active',
      packages: [
        {
          id: 'pkg_initial_a_1777470303951',
          type: 'initial',
          status: 'depleted',
          hours: 24.5,
          hoursUsed: 32.1,
          hoursRemaining: -7.6,
          purchaseDate: '2025-06-01T00:00:00.000Z'
        },
        {
          id: 'pkg_additional_stage_a_1779705754049',
          type: 'additional',
          status: 'active',
          hours: 35.5,
          hoursUsed: 0,
          hoursRemaining: 35.5,
          purchaseDate: '2026-05-25T00:00:00.000Z'
        }
      ]
    };

    const result = getActivePackage(stage, true, false);
    expect(result).not.toBeNull();
    expect(result.id).toBe('pkg_additional_stage_a_1779705754049');
    expect(result.type).toBe('additional');
  });

  // ─── BC: single depleted package within -10h ───
  test('BC: single package, status=active, hoursRemaining=-5 → returns it (allowOverdraft fallback)', () => {
    const stage = {
      // no stage.status — BC branch
      packages: [
        { id: 'pkg_only', status: 'active', hoursRemaining: -5 }
      ]
    };

    const result = getActivePackage(stage, true, false);
    expect(result).not.toBeNull();
    expect(result.id).toBe('pkg_only');
  });

  // ─── BC: single active with positive hours ───
  test('BC: single package, status=active, hoursRemaining=10 → returns it (fresh pass)', () => {
    const stage = {
      packages: [
        { id: 'pkg_only', status: 'active', hoursRemaining: 10 }
      ]
    };

    const result = getActivePackage(stage, true, false);
    expect(result).not.toBeNull();
    expect(result.id).toBe('pkg_only');
  });

  // ─── All depleted past -10h ───
  test('all packages past -10h → returns null without override', () => {
    const stage = {
      status: 'active',
      packages: [
        { id: 'pkg_1', status: 'depleted', hoursRemaining: -12 },
        { id: 'pkg_2', status: 'depleted', hoursRemaining: -15 }
      ]
    };

    const result = getActivePackage(stage, true, false);
    expect(result).toBeNull();
  });

  // ─── overrideActive: bypass -10h floor ───
  test('overrideActive=true + only depleted past -10h → returns depleted', () => {
    const stage = {
      status: 'active',
      packages: [
        { id: 'pkg_only', status: 'depleted', hoursRemaining: -20 }
      ]
    };

    const result = getActivePackage(stage, true, /* overrideActive */ true);
    expect(result).not.toBeNull();
    expect(result.id).toBe('pkg_only');
  });

  // ─── overrideActive does NOT bypass fresh-first priority ───
  test('overrideActive=true + depleted+fresh → returns FRESH (priority preserved)', () => {
    const stage = {
      status: 'active',
      packages: [
        { id: 'depleted_pkg', status: 'depleted', hoursRemaining: -20 },
        { id: 'fresh_pkg', status: 'active', hoursRemaining: 10 }
      ]
    };

    const result = getActivePackage(stage, true, /* overrideActive */ true);
    expect(result).not.toBeNull();
    expect(result.id).toBe('fresh_pkg');
  });

  // ─── allowOverdraft=false: strict mode ───
  test('allowOverdraft=false + only depleted → returns null', () => {
    const stage = {
      status: 'active',
      packages: [
        { id: 'pkg_only', status: 'depleted', hoursRemaining: -5 }
      ]
    };

    const result = getActivePackage(stage, /* allowOverdraft */ false, false);
    expect(result).toBeNull();
  });

  test('allowOverdraft=false + active hours>0 → returns it', () => {
    const stage = {
      status: 'active',
      packages: [
        { id: 'pkg_only', status: 'active', hoursRemaining: 5 }
      ]
    };

    const result = getActivePackage(stage, /* allowOverdraft */ false, false);
    expect(result).not.toBeNull();
    expect(result.id).toBe('pkg_only');
  });

  // ─── FIFO tie-break: two fresh packages, oldest wins ───
  test('two fresh packages → returns oldest by purchaseDate ASC', () => {
    const stage = {
      status: 'active',
      packages: [
        {
          id: 'newer',
          status: 'active',
          hoursRemaining: 10,
          purchaseDate: '2026-05-25T00:00:00.000Z'
        },
        {
          id: 'older',
          status: 'active',
          hoursRemaining: 10,
          purchaseDate: '2026-01-01T00:00:00.000Z'
        }
      ]
    };

    const result = getActivePackage(stage, true, false);
    expect(result).not.toBeNull();
    expect(result.id).toBe('older');
  });

  // ─── FIFO with createdAt fallback ───
  test('two fresh packages — uses createdAt when purchaseDate missing', () => {
    const stage = {
      status: 'active',
      packages: [
        { id: 'newer', status: 'active', hoursRemaining: 10, createdAt: '2026-05-25T00:00:00.000Z' },
        { id: 'older', status: 'active', hoursRemaining: 10, createdAt: '2026-01-01T00:00:00.000Z' }
      ]
    };

    const result = getActivePackage(stage, true, false);
    expect(result.id).toBe('older');
  });

  // ─── Pending packages eligible in modern branch ───
  test('Branch A (stage.status=active): pending package with hours>0 is eligible', () => {
    const stage = {
      status: 'active',
      packages: [
        { id: 'pending_pkg', status: 'pending', hoursRemaining: 15 }
      ]
    };

    const result = getActivePackage(stage, true, false);
    expect(result).not.toBeNull();
    expect(result.id).toBe('pending_pkg');
  });

  // ─── Empty / null edge cases ───
  test('null stage → null', () => {
    expect(getActivePackage(null)).toBeNull();
  });

  test('stage without packages → null', () => {
    expect(getActivePackage({ packages: [] })).toBeNull();
  });

  test('stage with undefined packages → null', () => {
    expect(getActivePackage({})).toBeNull();
  });

  // ─── Boundary: exactly -10h (inclusive of -10 ineligible per > -10) ───
  test('package with hoursRemaining=-10 exactly is INELIGIBLE without override', () => {
    const stage = {
      status: 'active',
      packages: [
        { id: 'edge', status: 'depleted', hoursRemaining: -10 }
      ]
    };
    expect(getActivePackage(stage, true, false)).toBeNull();
  });

  test('package with hoursRemaining=-9.99 IS eligible (fallback)', () => {
    const stage = {
      status: 'active',
      packages: [
        { id: 'edge', status: 'depleted', hoursRemaining: -9.99 }
      ]
    };
    const r = getActivePackage(stage, true, false);
    expect(r).not.toBeNull();
    expect(r.id).toBe('edge');
  });

  // ─── Mixed: fresh > 0 wins over older active with 0 ───
  test('older active with 0 hours + newer active with hours → returns newer (fresh-first)', () => {
    const stage = {
      status: 'active',
      packages: [
        {
          id: 'empty_old',
          status: 'active',
          hoursRemaining: 0,
          purchaseDate: '2026-01-01T00:00:00.000Z'
        },
        {
          id: 'fresh_new',
          status: 'active',
          hoursRemaining: 5,
          purchaseDate: '2026-05-25T00:00:00.000Z'
        }
      ]
    };

    const result = getActivePackage(stage, true, false);
    expect(result.id).toBe('fresh_new');
  });

  // ─── Status 'overdraft' is fallback-only, not fresh ───
  test('overdraft status with positive hoursRemaining → still treated as overdraft (fallback)', () => {
    // Edge case: rare. Confirms we don't accidentally promote 'overdraft' to fresh tier.
    const stage = {
      status: 'active',
      packages: [
        { id: 'overdraft_pkg', status: 'overdraft', hoursRemaining: 5 },
        { id: 'active_pkg', status: 'active', hoursRemaining: 3 }
      ]
    };
    // Both are eligible; active_pkg wins fresh pass.
    const result = getActivePackage(stage, true, false);
    expect(result.id).toBe('active_pkg');
  });
});
