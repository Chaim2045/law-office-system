/**
 * Tests for package-drift invariants — guard against the bug fixed in commit
 * 974152d (renewServiceHours pre-2026-02-19 updated service.totalHours but
 * skipped pushing the new package, causing service-level vs package-level drift).
 *
 * Coverage:
 *   A. addPackageToService — invariant violation on drifted incoming state
 *   B. dailyInvariantCheck — Check 5 (package_drift) detection logic
 */

// ─── Pure-logic copies (no firebase-admin import) ─────────────────────────

function round2(n) { return Math.round(n * 100) / 100; }

/**
 * Mirrors the invariant guard added to functions/services/index.js
 * (addPackageToService transaction body, after package push + aggregate update).
 */
function checkPackageInvariant(service) {
  const sumPkgHours = round2(
    (service.packages || []).reduce((sum, pkg) => sum + (pkg.hours || 0), 0)
  );
  const drift = round2((service.totalHours || 0) - sumPkgHours);
  if (Math.abs(drift) > 0.05) {
    return {
      ok: false,
      drift,
      totalHours: service.totalHours,
      sumPkgHours
    };
  }
  return { ok: true, drift };
}

/**
 * Mirrors Check 5 in functions/scheduled/index.js (dailyInvariantCheck).
 */
function detectPackageDrift(client, ST = { HOURS: 'hours' }) {
  const PKG_DRIFT_TOLERANCE = 0.05;
  const findings = [];
  (client.services || []).forEach(svc => {
    const isHours = svc.type === ST.HOURS || svc.serviceType === ST.HOURS;
    if (!isHours) return;
    const packages = Array.isArray(svc.packages) ? svc.packages : [];
    if (packages.length === 0) return;
    const sumPkgHours = packages.reduce((sum, p) => sum + (p.hours || 0), 0);
    const totalHours = svc.totalHours || 0;
    const drift = Math.abs(totalHours - sumPkgHours);
    if (drift > PKG_DRIFT_TOLERANCE) {
      findings.push({
        serviceId: svc.id,
        totalHours: parseFloat(totalHours.toFixed(2)),
        sumPkgHours: parseFloat(sumPkgHours.toFixed(2)),
        drift: parseFloat(drift.toFixed(2))
      });
    }
  });
  return findings;
}

// ─── A. addPackageToService invariant ─────────────────────────────────────

describe('addPackageToService — invariant guard', () => {
  test('PASSES on consistent state: totalHours == Σ(pkg.hours)', () => {
    const service = {
      id: 'srv_1',
      type: 'hours',
      totalHours: 50,
      packages: [
        { id: 'pkg_1', hours: 20 },
        { id: 'pkg_2', hours: 30 }
      ]
    };
    expect(checkPackageInvariant(service).ok).toBe(true);
  });

  test('FAILS when totalHours > Σ(pkg.hours) (pre-2026-02-19 bug pattern)', () => {
    const service = {
      id: 'srv_drifted',
      type: 'hours',
      totalHours: 50,
      packages: [{ id: 'pkg_1', hours: 20 }] // missing renewal of 30h
    };
    const result = checkPackageInvariant(service);
    expect(result.ok).toBe(false);
    expect(result.drift).toBe(30);
  });

  test('FAILS when totalHours < Σ(pkg.hours) (reverse drift)', () => {
    const service = {
      id: 'srv_reverse',
      type: 'hours',
      totalHours: 20,
      packages: [
        { id: 'pkg_1', hours: 20 },
        { id: 'pkg_2', hours: 30 }
      ]
    };
    const result = checkPackageInvariant(service);
    expect(result.ok).toBe(false);
    expect(result.drift).toBe(-30);
  });

  test('TOLERATES rounding noise within 0.05h', () => {
    const service = {
      id: 'srv_round',
      type: 'hours',
      totalHours: 50.03,
      packages: [
        { id: 'pkg_1', hours: 20 },
        { id: 'pkg_2', hours: 30 }
      ]
    };
    expect(checkPackageInvariant(service).ok).toBe(true);
  });

  test('FAILS just above tolerance', () => {
    const service = {
      id: 'srv_edge',
      type: 'hours',
      totalHours: 50.06,
      packages: [
        { id: 'pkg_1', hours: 20 },
        { id: 'pkg_2', hours: 30 }
      ]
    };
    expect(checkPackageInvariant(service).ok).toBe(false);
  });

  test('PASSES on empty packages array (legacy case — separate concern)', () => {
    const service = {
      id: 'srv_empty',
      type: 'hours',
      totalHours: 0,
      packages: []
    };
    expect(checkPackageInvariant(service).ok).toBe(true);
  });
});

// ─── B. dailyInvariantCheck — Check 5 (package_drift) ─────────────────────

describe('dailyInvariantCheck — package_drift detection', () => {
  test('detects drift on hours service (the original 2025306 bug pattern)', () => {
    const client = {
      id: '2025306',
      services: [{
        id: 'srv_1766393421154',
        type: 'hours',
        totalHours: 50,
        packages: [{ id: 'pkg_initial', hours: 20 }]
      }]
    };
    const findings = detectPackageDrift(client);
    expect(findings).toHaveLength(1);
    expect(findings[0].drift).toBe(30);
    expect(findings[0].serviceId).toBe('srv_1766393421154');
  });

  test('returns empty for consistent client', () => {
    const client = {
      id: 'good',
      services: [{
        id: 'srv_1',
        type: 'hours',
        totalHours: 50,
        packages: [
          { id: 'pkg_1', hours: 20 },
          { id: 'pkg_2', hours: 30 }
        ]
      }]
    };
    expect(detectPackageDrift(client)).toEqual([]);
  });

  test('skips legal_procedure services', () => {
    const client = {
      id: 'mixed',
      services: [{
        id: 'srv_legal',
        type: 'legal_procedure',
        totalHours: 100,
        packages: [{ id: 'pkg_x', hours: 20 }] // would be drift if checked
      }]
    };
    expect(detectPackageDrift(client)).toEqual([]);
  });

  test('skips services with empty packages (legacy/separate concern)', () => {
    const client = {
      id: 'no-packages',
      services: [{
        id: 'srv_empty',
        type: 'hours',
        totalHours: 50,
        packages: []
      }]
    };
    expect(detectPackageDrift(client)).toEqual([]);
  });

  test('handles client with multiple services — flags only drifted ones', () => {
    const client = {
      id: 'multi',
      services: [
        {
          id: 'srv_good',
          type: 'hours',
          totalHours: 30,
          packages: [{ id: 'pkg_a', hours: 30 }]
        },
        {
          id: 'srv_drift',
          type: 'hours',
          totalHours: 50,
          packages: [{ id: 'pkg_b', hours: 20 }]
        }
      ]
    };
    const findings = detectPackageDrift(client);
    expect(findings).toHaveLength(1);
    expect(findings[0].serviceId).toBe('srv_drift');
  });

  test('respects 0.05 tolerance for rounding (within tolerance)', () => {
    const client = {
      id: 'rounding',
      services: [{
        id: 'srv_x',
        type: 'hours',
        totalHours: 22.30,
        packages: [
          { id: 'pkg_1', hours: 22.27 }
        ]
      }]
    };
    expect(detectPackageDrift(client)).toEqual([]);
  });
});
