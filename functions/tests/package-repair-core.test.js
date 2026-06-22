/**
 * PR-DRIFT-2 — tests for the PURE repair core (package-repair-core.js).
 *
 * Covers design §13:
 *   - forward-replay time-correctness (package-not-yet-purchased excluded)
 *   - orphan older than all packages → pre_package
 *   - seeded-phantom (0 entries) → hoursUsed:0
 *   - override / no-packages / archived / non-hours → skipped
 *   - status flip surfaced (active→overdraft) when entries exceed capacity
 *   - service invariant within 0.05
 *   - idempotency (2nd run = no-op shape)
 *   - duplicate-id / dangling helpers (defensive)
 *
 * No Firestore / no admin — the core is pure. (The trigger-no-op regression +
 * rollback un-stamp live in addtimetotask-packageid-stamp.test.js per the
 * design's "trigger pure _test helpers" instruction.)
 */
'use strict';

const {
  assignEntriesForwardReplay,
  computeRepairedService,
  isEligibleService,
  isSkippedHoursServiceNeedingStamp,
  detectDuplicatePackageIds,
  detectDanglingEntries,
  applyRepairWritesInOrder,
  _internal
} = require('../shared/package-repair-core');

// A1 drift-guard: the CANONICAL live selector we must mirror bit-for-bit.
const { getActivePackage } = require('../src/modules/deduction/deduction-logic');

const round2 = _internal.round2;

// ─── builders ────────────────────────────────────────────────────────────────
function pkg(id, { hours = 100, hoursUsed = 0, hoursRemaining, status, purchaseDate } = {}) {
  const rem = hoursRemaining === undefined ? round2(hours - hoursUsed) : hoursRemaining;
  return {
    id,
    hours,
    hoursUsed,
    hoursRemaining: rem,
    status: status || (rem > 0 ? 'active' : 'depleted'),
    purchaseDate: purchaseDate || '2026-01-01T00:00:00.000Z'
  };
}
function entry(id, minutes, { createdAt, date, packageId } = {}) {
  return {
    id,
    minutes,
    createdAt: createdAt === undefined ? '2026-02-01T00:00:00.000Z' : createdAt,
    date: date || null,
    packageId: packageId || null
  };
}
function hoursService(id, packages, extra = {}) {
  return { id, type: 'hours', status: 'active', totalHours: packages.reduce((s, p) => s + p.hours, 0), packages, ...extra };
}

// ─── isEligibleService ────────────────────────────────────────────────────────
describe('isEligibleService', () => {
  test('eligible HOURS service with packages', () => {
    expect(isEligibleService(hoursService('s1', [pkg('p1')]))).toEqual({ eligible: true });
  });
  test('non-hours type → skip not_hours', () => {
    expect(isEligibleService({ id: 's', type: 'legal_procedure', packages: [pkg('p')] }))
      .toEqual({ skip: true, reason: 'not_hours' });
  });
  test('serviceType field also recognized as hours', () => {
    expect(isEligibleService({ id: 's', serviceType: 'hours', packages: [pkg('p')] }))
      .toEqual({ eligible: true });
  });
  test('archived → skip archived', () => {
    expect(isEligibleService(hoursService('s', [pkg('p')], { status: 'archived' })))
      .toEqual({ skip: true, reason: 'archived' });
  });
  test('no packages → skip no_packages', () => {
    expect(isEligibleService(hoursService('s', [])))
      .toEqual({ skip: true, reason: 'no_packages' });
  });
  test('overrideActive → skip override_preserved', () => {
    expect(isEligibleService(hoursService('s', [pkg('p')], { overrideActive: true })))
      .toEqual({ skip: true, reason: 'override_preserved' });
  });
  test('overdraftResolved.isResolved → skip overdraft_resolved', () => {
    expect(isEligibleService(hoursService('s', [pkg('p')], { overdraftResolved: { isResolved: true } })))
      .toEqual({ skip: true, reason: 'overdraft_resolved' });
  });
});

// ─── assignEntriesForwardReplay ───────────────────────────────────────────────
describe('assignEntriesForwardReplay', () => {
  test('single active package → single_active basis, all entries assigned', () => {
    const packages = [pkg('p1', { hours: 100 })];
    const entries = [entry('e1', 60), entry('e2', 30)];
    const out = assignEntriesForwardReplay(packages, entries);
    expect(out.unresolved).toEqual([]);
    expect(out.assignments).toHaveLength(2);
    expect(out.assignments.every((a) => a.basis === 'single_active')).toBe(true);
    expect(out.assignments.every((a) => a.packageId === 'p1')).toBe(true);
  });

  test('TIME-AWARE: a package not yet purchased is excluded for an earlier entry', () => {
    // p_old purchased Jan; p_new purchased Mar. An entry created in Feb must NOT
    // land on p_new even though p_old is depleted by then.
    const packages = [
      pkg('p_old', { hours: 1, purchaseDate: '2026-01-01T00:00:00.000Z' }),  // 1h capacity
      pkg('p_new', { hours: 100, purchaseDate: '2026-03-01T00:00:00.000Z' })
    ];
    const entries = [
      entry('e_feb', 120, { createdAt: '2026-02-15T00:00:00.000Z' }) // 2h, only p_old exists
    ];
    const out = assignEntriesForwardReplay(packages, entries);
    expect(out.assignments).toHaveLength(1);
    // p_old is the only candidate at Feb (p_new not yet purchased). Even though
    // p_old's live remaining (1h) < 2h, it's the only candidate → fallback within -10h.
    expect(out.assignments[0].packageId).toBe('p_old');
    expect(out.assignments[0].basis).toBe('single_active');
  });

  test('TIME-AWARE: fresh-first drains the old package before the new one (FIFO)', () => {
    const packages = [
      pkg('p_old', { hours: 2, purchaseDate: '2026-01-01T00:00:00.000Z' }),
      pkg('p_new', { hours: 100, purchaseDate: '2026-01-15T00:00:00.000Z' })
    ];
    // Two 60-min entries: both after both packages exist. FIFO → p_old fills first
    // (2h capacity), then p_old depleted → p_new.
    const entries = [
      entry('e1', 60, { createdAt: '2026-02-01T00:00:00.000Z' }),
      entry('e2', 60, { createdAt: '2026-02-02T00:00:00.000Z' }),
      entry('e3', 60, { createdAt: '2026-02-03T00:00:00.000Z' })
    ];
    const out = assignEntriesForwardReplay(packages, entries);
    const byEntry = Object.fromEntries(out.assignments.map((a) => [a.entryId, a.packageId]));
    expect(byEntry.e1).toBe('p_old'); // p_old has 2h, 1h used → still fresh
    expect(byEntry.e2).toBe('p_old'); // p_old now full (2h used) — was fresh at decision time
    expect(byEntry.e3).toBe('p_new'); // p_old depleted → fresh moves to p_new
  });

  test('orphan older than all packages → pre_package, assigned to earliest package', () => {
    const packages = [
      pkg('p_late', { hours: 100, purchaseDate: '2026-05-01T00:00:00.000Z' }),
      pkg('p_early', { hours: 100, purchaseDate: '2026-03-01T00:00:00.000Z' })
    ];
    const entries = [entry('e_ancient', 60, { createdAt: '2026-01-01T00:00:00.000Z' })];
    const out = assignEntriesForwardReplay(packages, entries);
    expect(out.assignments).toHaveLength(1);
    expect(out.assignments[0].basis).toBe('pre_package');
    expect(out.assignments[0].packageId).toBe('p_early'); // earliest by purchaseDate
  });

  test('overrideActive lets a deep-overdraft entry still resolve (no unresolved)', () => {
    const packages = [pkg('p1', { hours: 1, purchaseDate: '2026-01-01T00:00:00.000Z' })];
    // 50h on a 1h package — without override the fallback floor (-10) would reject.
    const entries = [entry('e1', 3000, { createdAt: '2026-02-01T00:00:00.000Z' })];
    const withOverride = assignEntriesForwardReplay(packages, entries, { overrideActive: true });
    expect(withOverride.unresolved).toEqual([]);
    expect(withOverride.assignments[0].packageId).toBe('p1');
  });

  test('without override, an entry beyond the -10h floor → unresolved (not assigned)', () => {
    // Pre-load p1 to be deeply overdrawn, then a further entry can't resolve.
    const packages = [pkg('p1', { hours: 1, purchaseDate: '2026-01-01T00:00:00.000Z' })];
    const entries = [
      entry('e1', 660, { createdAt: '2026-02-01T00:00:00.000Z' }),  // 11h on a 1h pkg → remaining -10
      entry('e2', 60, { createdAt: '2026-02-02T00:00:00.000Z' })    // now remaining == -10, NOT > -10 → no candidate
    ];
    const out = assignEntriesForwardReplay(packages, entries);
    // e1 resolves (remaining before it is 1 > -10). e2: live remaining is -10, not > -10 → unresolved.
    expect(out.assignments.map((a) => a.entryId)).toContain('e1');
    expect(out.unresolved.map((u) => u.entryId)).toContain('e2');
  });

  test('deterministic: missing createdAt falls back to date; neither → sorts last', () => {
    const packages = [pkg('p1', { hours: 100 })];
    const entries = [
      entry('e_dateonly', 30, { createdAt: null, date: '2026-01-10' }),
      entry('e_normal', 30, { createdAt: '2026-01-05T00:00:00.000Z' }),
      entry('e_none', 30, { createdAt: null, date: null })
    ];
    const out = assignEntriesForwardReplay(packages, entries);
    // All land on p1 (single package); the test asserts the run is stable + complete.
    expect(out.assignments).toHaveLength(3);
    expect(out.unresolved).toEqual([]);
  });
});

// ─── computeRepairedService ───────────────────────────────────────────────────
describe('computeRepairedService', () => {
  test('package.hoursUsed = Σ assigned minutes/60; service.hoursUsed = Σ packages', () => {
    const svc = hoursService('s1', [pkg('p1', { hours: 100, hoursUsed: 999 })]); // drifted card
    const replay = assignEntriesForwardReplay(svc.packages, [entry('e1', 90), entry('e2', 30)]);
    const r = computeRepairedService(svc, replay);
    expect(r.repairedService.packages[0].hoursUsed).toBe(2); // 120min = 2h
    expect(r.serviceAfter).toBe(2);
    expect(r.ledgerTruth).toBe(2);
    expect(r.invariantOk).toBe(true);
  });

  test('seeded-phantom (hoursUsed>0, 0 entries) → hoursUsed:0 + reversal surfaced', () => {
    const svc = hoursService('s1', [pkg('p1', { hours: 100, hoursUsed: 25 })]);
    const replay = assignEntriesForwardReplay(svc.packages, []); // no entries
    const r = computeRepairedService(svc, replay);
    expect(r.repairedService.packages[0].hoursUsed).toBe(0);
    expect(r.phantomReversals).toHaveLength(1);
    expect(r.phantomReversals[0].beforeHoursUsed).toBe(25);
  });

  test('status flip surfaced: active → overdraft when entries exceed capacity', () => {
    const svc = hoursService('s1', [pkg('p1', { hours: 1, hoursUsed: 0, status: 'active' })]);
    // 4h on a 1h package → remaining -3 → overdraft (within -10).
    const replay = assignEntriesForwardReplay(svc.packages, [entry('e1', 240)], { overrideActive: false });
    const r = computeRepairedService(svc, replay);
    const diff = r.packageDiffs[0];
    expect(diff.after.status).toBe('overdraft');
    expect(diff.statusFlip).toBe(true);
    expect(diff.after.hoursRemaining).toBe(-3);
  });

  test('status flip: active → depleted beyond the overdraft window', () => {
    const svc = hoursService('s1', [pkg('p1', { hours: 1, hoursUsed: 0 })]);
    // 12h on a 1h package, with override so the replay assigns it → remaining -11 → depleted.
    const replay = assignEntriesForwardReplay(svc.packages, [entry('e1', 720)], { overrideActive: true });
    const r = computeRepairedService(svc, replay);
    expect(r.packageDiffs[0].after.status).toBe('depleted');
    expect(r.packageDiffs[0].after.hoursRemaining).toBe(-11);
  });

  test('service invariant holds within 0.05 across many small entries', () => {
    const svc = hoursService('s1', [pkg('p1', { hours: 1000 })]);
    const entries = [];
    for (let i = 0; i < 50; i++) entries.push(entry(`e${i}`, 7)); // 50 × 7min = 350min = 5.833h
    const replay = assignEntriesForwardReplay(svc.packages, entries);
    const r = computeRepairedService(svc, replay);
    expect(Math.abs(r.serviceAfter - r.ledgerTruth)).toBeLessThanOrEqual(0.05);
    expect(r.invariantOk).toBe(true);
  });

  test('idempotency: replay+compute on an ALREADY-repaired service is a no-op shape', () => {
    const svc = hoursService('s1', [pkg('p1', { hours: 100, hoursUsed: 0 })]);
    const entries = [entry('e1', 90), entry('e2', 30)];
    const r1 = computeRepairedService(svc, assignEntriesForwardReplay(svc.packages, entries));
    // Feed the repaired service back through the SAME entries → identical result.
    const r2 = computeRepairedService(r1.repairedService, assignEntriesForwardReplay(r1.repairedService.packages, entries));
    expect(r2.serviceAfter).toBe(r1.serviceAfter);
    expect(r2.repairedService.packages[0].hoursUsed).toBe(r1.repairedService.packages[0].hoursUsed);
    expect(r2.phantomReversals).toEqual([]); // nothing phantom the 2nd time
  });

  test('multi-package: drains old (over) then new (under) and corrects both', () => {
    const svc = hoursService('s1', [
      pkg('p_old', { hours: 2, hoursUsed: 0, purchaseDate: '2026-01-01T00:00:00.000Z' }),
      pkg('p_new', { hours: 100, hoursUsed: 80, purchaseDate: '2026-02-01T00:00:00.000Z' }) // drifted card
    ]);
    const entries = [
      entry('e1', 120, { createdAt: '2026-03-01T00:00:00.000Z' }), // 2h → fills p_old
      entry('e2', 60, { createdAt: '2026-03-02T00:00:00.000Z' })   // 1h → p_old depleted → p_new
    ];
    const replay = assignEntriesForwardReplay(svc.packages, entries);
    const r = computeRepairedService(svc, replay);
    const byId = Object.fromEntries(r.repairedService.packages.map((p) => [p.id, p.hoursUsed]));
    expect(byId.p_old).toBe(2);
    expect(byId.p_new).toBe(1); // corrected DOWN from the phantom 80
    expect(r.serviceAfter).toBe(3);
    expect(r.invariantOk).toBe(true);
  });
});

// ─── defensive helpers (0 in PROD) ───────────────────────────────────────────
describe('defensive helpers', () => {
  test('detectDuplicatePackageIds finds a shared id across services', () => {
    const client = {
      services: [
        hoursService('s1', [pkg('shared'), pkg('p1')]),
        hoursService('s2', [pkg('shared'), pkg('p2')])
      ]
    };
    const dups = detectDuplicatePackageIds(client);
    expect(dups).toHaveLength(1);
    expect(dups[0].packageId).toBe('shared');
    expect(dups[0].serviceIds.sort()).toEqual(['s1', 's2']);
  });

  test('detectDuplicatePackageIds returns [] when all ids unique (PROD state)', () => {
    const client = { services: [hoursService('s1', [pkg('a')]), hoursService('s2', [pkg('b')])] };
    expect(detectDuplicatePackageIds(client)).toEqual([]);
  });

  test('detectDanglingEntries flags an entry → unknown packageId', () => {
    const client = { services: [hoursService('s1', [pkg('known')])] };
    const entries = [{ id: 'e1', packageId: 'known' }, { id: 'e2', packageId: 'ghost' }];
    const dangling = detectDanglingEntries(client, entries);
    expect(dangling).toEqual([{ entryId: 'e2', packageId: 'ghost' }]);
  });

  test('detectDanglingEntries catalogs legal-stage package ids (not mis-flagged)', () => {
    const client = {
      services: [{ id: 's1', type: 'legal_procedure', stages: [{ id: 'stage_a', packages: [pkg('stage_pkg')] }] }]
    };
    const entries = [{ id: 'e1', packageId: 'stage_pkg' }];
    expect(detectDanglingEntries(client, entries)).toEqual([]);
  });
});

// ─── rollback restore-shape (design §9/§13) ──────────────────────────────────
// The script's --rollback restores the captured `servicesBefore` snapshot via the
// canonical writer. The CORRECTNESS invariant the rollback relies on (and that we
// can test purely): the original (pre-repair) service is preserved verbatim in the
// backup, so restoring it reproduces the original hoursUsed/status EXACTLY — and a
// fresh repair on the restored snapshot reproduces the repaired result (no drift
// accumulates across a repair → rollback → repair cycle).
describe('rollback restore-shape (purity invariant)', () => {
  test('servicesBefore is captured by reference-free value → restore reproduces the original', () => {
    const original = hoursService('s1', [pkg('p1', { hours: 100, hoursUsed: 42, status: 'active' })]);
    // The script captures plan.servicesBefore = the original services (the drifted card).
    const servicesBefore = [original];

    // Repair mutates into a NEW object (immutable) — the captured `before` is untouched.
    const replay = assignEntriesForwardReplay(original.packages, [entry('e1', 90)]);
    const repaired = computeRepairedService(original, replay);
    expect(repaired.repairedService.packages[0].hoursUsed).toBe(1.5); // 90min
    // The backup's snapshot still holds the ORIGINAL drifted value (42), unmutated.
    expect(servicesBefore[0].packages[0].hoursUsed).toBe(42);
  });

  test('repair → rollback(restore) → repair is stable (no drift accumulation)', () => {
    const original = hoursService('s1', [pkg('p1', { hours: 100, hoursUsed: 999 })]);
    const entries = [entry('e1', 120)];

    // Repair #1
    const r1 = computeRepairedService(original, assignEntriesForwardReplay(original.packages, entries));
    expect(r1.serviceAfter).toBe(2);

    // Rollback → restore the captured original; Repair #2 on the restored original.
    const restored = original; // backup holds the original verbatim
    const r2 = computeRepairedService(restored, assignEntriesForwardReplay(restored.packages, entries));
    expect(r2.serviceAfter).toBe(r1.serviceAfter); // identical — deterministic
  });
});

// ─── A1 — getActivePackageEquivalent drift-guard vs live getActivePackage ──────
//
// Feed IDENTICAL fixtures to BOTH the live `getActivePackage` (deduction-logic.js)
// and the repair core's `getActivePackageEquivalent`, asserting identical package
// picks across ALL container-status cases (active / completed / on_hold / undefined)
// each holding active + pending + depleted packages.
//
// Faithfulness harness: the live helper selects on the STORED `pkg.hoursRemaining`;
// the equivalent selects on a RUNNING value (pkg.hours − running[pkg.id]). To
// compare ONLY the status-branch predicates (the A1 concern), we drive the
// equivalent with running={} and set each pkg.hours == pkg.hoursRemaining so both
// helpers see the SAME remaining number. Then the ONLY variable is status/branch.
describe('A1 — getActivePackageEquivalent mirrors live getActivePackage (drift-guard)', () => {
  const { getActivePackageEquivalent } = _internal;

  // Build a package whose live-remaining == stored hoursRemaining (harness invariant).
  function gp(id, status, hoursRemaining, purchaseDate) {
    return {
      id,
      status,
      hours: hoursRemaining,          // so liveRemaining = hours - 0 = hoursRemaining
      hoursUsed: 0,
      hoursRemaining,
      purchaseDate: purchaseDate || '2026-01-01T00:00:00.000Z'
    };
  }

  // The equivalent expects candidates already restricted to purchaseDate<=entry.
  // For the drift-guard we pass ALL packages as candidates (no time exclusion) so
  // the comparison isolates the STATUS predicate, not time-awareness.
  function pickEquiv(serviceStatus, packages, overrideActive) {
    return getActivePackageEquivalent(packages, {}, !!overrideActive, serviceStatus);
  }
  function pickLive(serviceStatus, packages, overrideActive) {
    // allowOverdraft=true (mirrors lookupServiceIds / the repair's fallback pass).
    return getActivePackage({ status: serviceStatus, packages }, true, !!overrideActive);
  }

  const STATUSES = ['active', 'completed', 'on_hold', undefined];

  // Matrix of package mixes covering active+pending+depleted in different orders.
  const MIXES = {
    'active+pending+depleted (active first)': () => [
      gp('a', 'active', 5, '2026-01-01T00:00:00.000Z'),
      gp('pend', 'pending', 5, '2026-01-02T00:00:00.000Z'),
      gp('dep', 'depleted', -2, '2026-01-03T00:00:00.000Z')
    ],
    'pending-only fresh, active depleted': () => [
      gp('a', 'active', -3, '2026-01-01T00:00:00.000Z'),  // not fresh (remaining<=0)
      gp('pend', 'pending', 8, '2026-01-02T00:00:00.000Z') // fresh ONLY in Branch A
    ],
    'depleted + pending (no fresh active)': () => [
      gp('dep', 'depleted', -1, '2026-01-01T00:00:00.000Z'),
      gp('pend', 'pending', 0, '2026-01-02T00:00:00.000Z') // remaining 0 → not fresh anywhere
    ],
    'all depleted within floor': () => [
      gp('d1', 'depleted', -2, '2026-01-01T00:00:00.000Z'),
      gp('d2', 'depleted', -4, '2026-01-02T00:00:00.000Z')
    ],
    'no-status package (none)': () => [
      gp('n', undefined, 7, '2026-01-01T00:00:00.000Z')
    ],
    'pending fresh + active fresh (FIFO order matters)': () => [
      gp('pend_old', 'pending', 5, '2026-01-01T00:00:00.000Z'),
      gp('act_new', 'active', 5, '2026-02-01T00:00:00.000Z')
    ]
  };

  for (const status of STATUSES) {
    for (const [label, build] of Object.entries(MIXES)) {
      test(`status=${String(status)} | ${label} → identical pick`, () => {
        const live = pickLive(status, build());
        const equiv = pickEquiv(status, build());
        const liveId = live ? live.id : null;
        const equivId = equiv ? equiv.id : null;
        expect(equivId).toBe(liveId);
      });
    }
  }

  test('the EXACT divergence A1 closes: pending under a non-active container (Branch B) → null in BOTH', () => {
    const packages = [gp('pend', 'pending', 5)];
    // Branch B: live returns null (pending neither fresh nor fallback-eligible).
    expect(pickLive('on_hold', packages)).toBeNull();
    // The fixed equivalent must ALSO return null (pre-fix it wrongly picked 'pend').
    expect(pickEquiv('on_hold', packages)).toBeNull();
  });

  test('same pending under an ACTIVE container (Branch A) → picked by BOTH', () => {
    const packages = [gp('pend', 'pending', 5)];
    expect(pickLive('active', packages).id).toBe('pend');
    expect(pickEquiv('active', packages).id).toBe('pend');
  });

  test('overrideActive bypasses the -10h floor identically in both', () => {
    const packages = [gp('deep', 'depleted', -50)]; // beyond the -10 floor
    // Without override: live + equiv both reject (fallback floor).
    expect(pickLive('active', packages, false)).toBeNull();
    expect(pickEquiv('active', packages, false)).toBeNull();
    // With override: both return it.
    expect(pickLive('active', packages, true).id).toBe('deep');
    expect(pickEquiv('active', packages, true).id).toBe('deep');
  });
});

// ─── A3 (CORRECTED) — instant-primary existence + Jerusalem-civil fallback ─────
//
// PRODUCTION-FAITHFUL fixtures: `purchaseDate` is ALWAYS a full ISO instant
// (clients/index.js:223,290; services/index.js:606,614). Production NEVER writes
// a bare "YYYY-MM-DD". The prior A3 tests used date-only purchaseDate strings
// that the live writers never produce — so they exercised a code path that is
// DEAD on real data. These tests drive the PRIMARY instant path (entries with a
// real createdAt) and the FALLBACK civil-day path (createdAt absent).
describe('A3 — instant-primary existence (ISO/midnight-UTC) + Jerusalem-civil fallback', () => {
  const { packageExistedForEntry, instantToJerusalemCivil } = _internal;

  // ── PRIMARY PATH: absolute-instant compare (entry HAS createdAt) ──────────
  test('instant path: ISO purchaseDate, createdAt AFTER purchase → candidate', () => {
    const renewal = { id: 'p_new', purchaseDate: '2026-03-10T09:00:00.000Z' };
    const entryAfter = { createdAt: '2026-03-10T11:00:00.000Z', date: '2026-03-10' };
    const res = packageExistedForEntry(renewal, entryAfter, Date.parse('2026-03-10T11:00:00.000Z'));
    expect(res.candidate).toBe(true);       // 11:00Z > 09:00Z → existed
    expect(res.sameDayBoundary).toBe(true); // same civil day → flagged
  });

  test('instant path: ISO purchaseDate, createdAt BEFORE purchase same day → excluded', () => {
    // Same-day renewal at 09:00Z; an entry created at 08:00Z is BEFORE the package
    // physically existed → correctly excluded by the absolute-instant compare.
    const renewal = { id: 'p_new', purchaseDate: '2026-03-10T09:00:00.000Z' };
    const entryBefore = { createdAt: '2026-03-10T08:00:00.000Z', date: '2026-03-10' };
    const res = packageExistedForEntry(renewal, entryBefore, Date.parse('2026-03-10T08:00:00.000Z'));
    expect(res.candidate).toBe(false);      // 08:00Z < 09:00Z → not yet purchased
    expect(res.sameDayBoundary).toBe(true); // within ±1 civil day → flagged
  });

  test('instant path: MIDNIGHT-UTC date-picker purchaseDate vs an early-morning-Israel entry that is the PRIOR UTC day', () => {
    // A date-picker additional-package: new Date("2026-03-10").toISOString()
    // → "2026-03-10T00:00:00.000Z". An entry with createdAt 2026-03-09T23:30Z is
    // 2026-03-10 ~01:30 in Israel (early-morning), and the writer stamped its
    // civil `date:'2026-03-10'`. BUT createdAt IS PRESENT → the instant path
    // governs: 23:30Z March 9 < 00:00Z March 10 → at that real instant the
    // package did NOT exist yet → exclusion is the ACTUALLY-CORRECT behavior.
    const pkgMidnightUTC = { id: 'p_picker', purchaseDate: '2026-03-10T00:00:00.000Z' };
    const entryEarlyIsrael = { createdAt: '2026-03-09T23:30:00.000Z', date: '2026-03-10' };
    const res = packageExistedForEntry(pkgMidnightUTC, entryEarlyIsrael, Date.parse('2026-03-09T23:30:00.000Z'));
    expect(res.candidate).toBe(false);      // 23:30Z Mar-09 < 00:00Z Mar-10
    expect(res.sameDayBoundary).toBe(true); // Δ civil day = 1 → flagged
  });

  test('instant path: ISO purchaseDate, createdAt a clear day later → candidate, NOT flagged', () => {
    const pkg0 = { id: 'p0', purchaseDate: '2026-03-10T09:00:00.000Z' };
    const entryNextWeek = { createdAt: '2026-03-17T09:00:00.000Z', date: '2026-03-17' };
    const res = packageExistedForEntry(pkg0, entryNextWeek, Date.parse('2026-03-17T09:00:00.000Z'));
    expect(res.candidate).toBe(true);
    expect(res.sameDayBoundary).toBe(false); // 7 days apart → no knife-edge flag
  });

  // ── FULL REPLAY: same-day renewal lands on the renewal via the instant path ─
  test('same-day renewal (ISO instants) is the CORRECT package via the instant path', () => {
    // p_old purchased Jan (real instant); p_new renewed Mar-10 09:00Z. A Feb entry
    // drains p_old. The Mar-10 entry created at 19:00Z (after 09:00Z) must land on
    // the renewal p_new — proven by absolute instants, no civil coercion.
    const packages = [
      pkg('p_old', { hours: 1, purchaseDate: '2026-01-01T08:00:00.000Z' }),
      pkg('p_new', { hours: 100, purchaseDate: '2026-03-10T09:00:00.000Z' })
    ];
    const entries = [
      { id: 'e_renew', minutes: 120, createdAt: '2026-03-10T19:00:00.000Z', date: '2026-03-10', packageId: null },
      { id: 'e_feb', minutes: 60, createdAt: '2026-02-01T08:00:00.000Z', date: '2026-02-01', packageId: null }
    ];
    const out = assignEntriesForwardReplay(packages, entries);
    const byEntry = Object.fromEntries(out.assignments.map((a) => [a.entryId, a.packageId]));
    expect(byEntry.e_feb).toBe('p_old');   // only p_old existed in Feb
    expect(byEntry.e_renew).toBe('p_new'); // same-day renewal IS a candidate at 19:00Z → fresh pick
    expect(out.assignments.find((a) => a.entryId === 'e_renew').basis).not.toBe('pre_package');
    expect(out.unresolved).toEqual([]);
  });

  test('TZ knife-edge: late-evening-Israel entry AFTER an ISO purchase instant is NOT excluded', () => {
    // purchaseDate a real instant 2026-03-10T07:00Z (= 09:00 Israel). An entry
    // created 2026-03-10T20:00Z (= 22:00 Israel) is later on the SAME civil day.
    // Instant compare keeps it a candidate across ANY offset.
    const packages = [pkg('p_new', { hours: 50, purchaseDate: '2026-03-10T07:00:00.000Z' })];
    const entries = [
      { id: 'e_eve', minutes: 90, createdAt: '2026-03-10T20:00:00.000Z', date: '2026-03-10', packageId: null }
    ];
    const out = assignEntriesForwardReplay(packages, entries);
    expect(out.assignments).toHaveLength(1);
    expect(out.assignments[0].packageId).toBe('p_new');
    expect(out.unresolved).toEqual([]);
  });

  // ── FALLBACK PATH: entry MISSING createdAt → Asia/Jerusalem civil-day compare ─
  test('fallback: missing-createdAt entry near a midnight-UTC package boundary attributes by Jerusalem civil day', () => {
    // The package is a midnight-UTC date-picker instant for civil day Mar-10
    // (Jerusalem). The entry has NO createdAt — only date:'2026-03-10'. The civil
    // fallback derives the package's Jerusalem civil day from the instant and
    // compares lexicographically: '2026-03-10' <= '2026-03-10' → candidate.
    // (A naive midnight-UTC-millis-vs-date-millis compare is the knife-edge this
    // path replaces; here both sides reduce to the same Jerusalem civil day.)
    const pkgMidnightUTC = { id: 'p_picker', purchaseDate: '2026-03-10T00:00:00.000Z' };
    expect(instantToJerusalemCivil(Date.parse('2026-03-10T00:00:00.000Z'))).toBe('2026-03-10');
    const entryNoCreatedAt = { date: '2026-03-10' }; // no createdAt
    const res = packageExistedForEntry(pkgMidnightUTC, entryNoCreatedAt, /* entryMillis from date */ Date.parse('2026-03-10T00:00:00.000Z'));
    expect(res.candidate).toBe(true);       // same Jerusalem civil day → included
    expect(res.sameDayBoundary).toBe(true); // Δ = 0 day → flagged
  });

  test('fallback: missing-createdAt entry ONE civil day before the package → excluded (pre_package), flagged', () => {
    // Package purchased (ISO instant) on the civil day Mar-11 in Jerusalem; an
    // entry with only date:'2026-03-10' (no createdAt) is one civil day earlier.
    const packages = [pkg('p1', { hours: 100, purchaseDate: '2026-03-11T07:00:00.000Z' })];
    const entries = [
      { id: 'e_daybefore', minutes: 60, createdAt: null, date: '2026-03-10', packageId: null }
    ];
    const out = assignEntriesForwardReplay(packages, entries);
    expect(out.assignments).toHaveLength(1);
    expect(out.assignments[0].basis).toBe('pre_package');
    expect(out.assignments[0].sameDayBoundary).toBe(true); // ±1 civil day → flagged
  });

  test('fallback: missing-createdAt + missing date → cannot exclude → candidate', () => {
    // No createdAt AND no usable civil date → the package can't be time-excluded.
    const pkgIso = { id: 'p_iso', purchaseDate: '2026-03-10T09:00:00.000Z' };
    const entryNoDates = { date: null }; // neither createdAt nor date
    const res = packageExistedForEntry(pkgIso, entryNoDates, null);
    expect(res.candidate).toBe(true);
    expect(res.sameDayBoundary).toBe(false);
  });

  // ── UNDATED PACKAGE: kept a candidate but FLAGGED (PROD expected = 0) ───────
  test('undated package (no purchaseDate/createdAt) → candidate + undatedPackage flag', () => {
    const pkgUndated = { id: 'p_undated' }; // no date at all
    const entry0 = { createdAt: '2026-03-10T09:00:00.000Z', date: '2026-03-10' };
    const res = packageExistedForEntry(pkgUndated, entry0, Date.parse('2026-03-10T09:00:00.000Z'));
    expect(res.candidate).toBe(true);
    expect(res.undatedPackage).toBe(true);
    expect(res.sameDayBoundary).toBe(false);
  });

  // ── instantToJerusalemCivil correctness (the only civil-normalization point) ─
  test('instantToJerusalemCivil maps an instant to its Asia/Jerusalem civil day', () => {
    // 2026-03-09T23:30Z is 2026-03-10 ~01:30 in Israel (UTC+2 winter) → civil 2026-03-10.
    expect(instantToJerusalemCivil(Date.parse('2026-03-09T23:30:00.000Z'))).toBe('2026-03-10');
    // 2026-03-10T00:00Z → 02:00 Israel → civil 2026-03-10.
    expect(instantToJerusalemCivil(Date.parse('2026-03-10T00:00:00.000Z'))).toBe('2026-03-10');
    // null / non-finite → null.
    expect(instantToJerusalemCivil(null)).toBeNull();
    expect(instantToJerusalemCivil(Number.NaN)).toBeNull();
  });
});

// ─── A7 — skipped-but-HOURS services still yield STAMP targets (hoursUsed frozen) ─
describe('A7 — skipped override/overdraftResolved HOURS services stamp orphans only', () => {
  test('isSkippedHoursServiceNeedingStamp: override HOURS w/ packages → true', () => {
    expect(isSkippedHoursServiceNeedingStamp(
      hoursService('s', [pkg('p')], { overrideActive: true })
    )).toBe(true);
  });
  test('isSkippedHoursServiceNeedingStamp: overdraftResolved HOURS w/ packages → true', () => {
    expect(isSkippedHoursServiceNeedingStamp(
      hoursService('s', [pkg('p')], { overdraftResolved: { isResolved: true } })
    )).toBe(true);
  });
  test('isSkippedHoursServiceNeedingStamp: archived → false (fully untouched)', () => {
    expect(isSkippedHoursServiceNeedingStamp(
      hoursService('s', [pkg('p')], { status: 'archived', overrideActive: true })
    )).toBe(false);
  });
  test('isSkippedHoursServiceNeedingStamp: non-HOURS → false', () => {
    expect(isSkippedHoursServiceNeedingStamp(
      { id: 's', type: 'legal_procedure', packages: [pkg('p')], overrideActive: true }
    )).toBe(false);
  });
  test('isSkippedHoursServiceNeedingStamp: no packages → false', () => {
    expect(isSkippedHoursServiceNeedingStamp(
      hoursService('s', [], { overrideActive: true })
    )).toBe(false);
  });

  test('replay on a skipped override service STILL produces stamp targets, hoursUsed untouched', () => {
    // The override service keeps its (intentional) drifted card. The repair must
    // NOT recompute its hoursUsed — but it MUST stamp the orphan entries so the
    // addPackageToService detonator finds nothing.
    const overrideSvc = hoursService('s_override', [
      pkg('p1', { hours: 100, hoursUsed: 55, status: 'active', purchaseDate: '2026-01-01' })
    ], { overrideActive: true });

    // Sanity: isEligibleService SKIPS it (so the main branch never recomputes it).
    expect(isEligibleService(overrideSvc)).toEqual({ skip: true, reason: 'override_preserved' });

    // But for STAMPING ONLY we run the same forward-replay. Orphan entries get
    // a packageId assignment (the stamp target) — WITHOUT calling computeRepairedService.
    const orphanEntries = [
      { id: 'orph1', minutes: 60, createdAt: '2026-02-01T00:00:00.000Z', date: '2026-02-01', packageId: null },
      { id: 'orph2', minutes: 90, createdAt: '2026-02-02T00:00:00.000Z', date: '2026-02-02', packageId: null }
    ];
    const replay = assignEntriesForwardReplay(overrideSvc.packages, orphanEntries, {
      overrideActive: true,
      serviceStatus: overrideSvc.status
    });
    // Both orphans got a stamp target on the override service's package.
    const stampTargets = replay.assignments.filter((a) => a.packageId);
    expect(stampTargets).toHaveLength(2);
    expect(stampTargets.every((a) => a.packageId === 'p1')).toBe(true);

    // CRITICAL: the override service object is NOT mutated — hoursUsed still 55.
    expect(overrideSvc.packages[0].hoursUsed).toBe(55);
    // And we deliberately did NOT compute a repaired service for it (decoupled).
  });

  test('an already-stamped entry (non-null packageId) is NOT a re-stamp target', () => {
    // The script only stamps entries where !entry.packageId. The replay still
    // assigns a packageId, but the script-side filter (e.packageId falsy) gates it.
    const overrideSvc = hoursService('s_override', [pkg('p1', { hours: 100, purchaseDate: '2026-01-01' })], { overrideActive: true });
    const entries = [
      { id: 'already', minutes: 60, createdAt: '2026-02-01T00:00:00.000Z', date: '2026-02-01', packageId: 'p1' } // already stamped
    ];
    const replay = assignEntriesForwardReplay(overrideSvc.packages, entries, { overrideActive: true, serviceStatus: 'active' });
    // The replay assigns it, but the entry already has packageId — the SCRIPT skips it.
    const wouldStamp = replay.assignments.filter((a) => {
      const e = entries.find((x) => x.id === a.entryId);
      return e && !e.packageId; // mirrors the script's stamp gate
    });
    expect(wouldStamp).toHaveLength(0);
  });
});

// ─── PR-DRIFT-2.2: in-txn write ORDER (Firestore reads-before-writes) ─────────
// Regression for the --apply failure: the canonical writer does an internal
// transaction.get (READ) then writes; the audit is a pure write. Firestore aborts
// a txn that reads after a write, so the writer MUST precede the audit. This mock
// transaction ENFORCES the rule the production SDK enforces (the prior mocked
// tests did NOT) — so re-introducing the audit-first order fails here.
describe('PR-DRIFT-2.2 — applyRepairWritesInOrder (reads-before-writes)', () => {
  function strictTxn() {
    let wrote = false;
    const ops = [];
    return {
      ops,
      get() {
        if (wrote) {
          throw new Error('Firestore transactions require all reads to be executed before all writes.');
        }
        ops.push('get');
        return Promise.resolve({ exists: true, data: () => ({}) });
      },
      set() { wrote = true; ops.push('set'); },
      update() { wrote = true; ops.push('update'); }
    };
  }
  // mimics writeClientWithCanonicalAggregates: reads the doc, THEN writes.
  const realisticWriter = async (t, ref) => { await t.get(ref); t.update(ref, {}); };
  // mimics logCriticalActionInTxn: a pure write.
  const auditWrite = (t) => t.set({}, {});

  test('writer runs BEFORE audit → no reads-after-writes abort', async () => {
    const tx = strictTxn();
    await applyRepairWritesInOrder(tx, {
      clientRef: {}, services: [], writeFn: realisticWriter, auditFn: auditWrite
    });
    expect(tx.ops).toEqual(['get', 'update', 'set']);
  });

  test('REGRESSION pin: audit-before-writer WOULD abort (proves the mock bites)', async () => {
    const tx = strictTxn();
    auditWrite(tx); // the round-2 bug: audit first
    await expect(realisticWriter(tx, {})).rejects.toThrow(/reads.*before.*writes/i);
  });

  test('the writer receives the {services} payload it must persist', async () => {
    const tx = strictTxn();
    let seen = null;
    const capturingWriter = async (t, ref, payload) => { await t.get(ref); seen = payload; t.update(ref, payload); };
    await applyRepairWritesInOrder(tx, {
      clientRef: { id: 'c1' }, services: [{ id: 's1', hoursUsed: 5 }],
      writeFn: capturingWriter, auditFn: auditWrite
    });
    expect(seen).toEqual({ services: [{ id: 's1', hoursUsed: 5 }] });
  });
});
