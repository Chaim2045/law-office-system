/**
 * package-repair-core.js — PURE core for PR-DRIFT-2 (repairPackageAggregates).
 * ─────────────────────────────────────────────────────────────────────────────
 * NO Firestore, NO firebase-admin, NO Date.now()/Math.random(). Deterministic.
 * Exported via `_test` (for the test suite) and consumed by the supervised
 * script `functions/scripts/repair-package-aggregates.js`.
 *
 * WHAT THIS DOES (design §5–§7):
 *   Reconstructs the per-package consumption of a drifted HOURS service by
 *   FORWARD-REPLAYing its timesheet entries (createdAt ASC) through the live
 *   `getActivePackage` selection priority — TIME-AWARE: a package is only a
 *   candidate for an entry created on/after the package's purchaseDate.
 *
 *   The OUTPUT totals (service.hoursUsed → client rollup → billing/blocking)
 *   become EXACTLY the ledger truth (Σ assigned-entry-minutes / 60). The
 *   per-package ATTRIBUTION of historical orphans is a current-logic-correct
 *   reconstruction, NOT a bit-exact historical reproduction (§1 "Precision
 *   contract").
 *
 * SELECTION PRIORITY — bit-faithful to `functions/src/modules/deduction/deduction-logic.js`
 *   `getActivePackage` across BOTH branches. DO NOT reinvent. The HOURS service is
 *   the container (packages live directly on it, no stage layer), so the service's
 *   own `status` selects the branch (A1 fix — see isContainerBranchA):
 *     • Branch A (service.status active/completed):
 *         fresh status ∈ {active, pending, none};   eligible ∈ {active, pending, overdraft, depleted, none}
 *     • Branch B (legacy — any other/undefined status):
 *         fresh status ∈ {active, none} (pending NOT fresh);
 *         eligible ∈ {active, overdraft, depleted, none} (pending NOT eligible)
 *     1. Fresh pass: oldest package (purchaseDate/createdAt ASC) with a LIVE
 *        hoursRemaining > 0 AND a branch-fresh status.
 *     2. Fallback pass: first branch-eligible package within the -10h floor
 *        (override bypasses the floor).
 *   The ONLY differences from the live helper: here `hoursRemaining` is the
 *   RUNNING value computed from entries assigned so far in the replay (not the
 *   stored drifted value), and candidates are first restricted to packages that
 *   EXISTED at the entry's time (time-awareness, A3). Existence is tested by
 *   `packageExistedForEntry`: PRIMARY = absolute-instant compare
 *   `toMillis(purchaseDate) <= entry.createdAt` (TZ-safe for the real-instant
 *   purchaseDate PROD always stores); FALLBACK (createdAt absent) = civil-day
 *   compare in Asia/Jerusalem. The selection PREDICATES are identical per branch.
 *
 * STATUS DERIVATION — mirrors `deductHoursFromPackage` (deduction-logic.js:241-246):
 *   remaining < 0 && >= -10  → 'overdraft'
 *   remaining <= 0           → 'depleted'
 *   else                     → 'active'
 *   (the -10 overdraft window the spec asks for; NOT applyHoursDelta's
 *   coarser <=0→depleted rule.)
 */
'use strict';

// ── Constants ────────────────────────────────────────────────────────────────
// Service / pricing types. Inlined string literals (NOT a require) to keep this
// core dependency-free per the design ("keep the core dependency-free"). These
// MUST match functions/shared/constants.js SYSTEM_CONSTANTS.SERVICE_TYPES.
const SERVICE_TYPE_HOURS = 'hours';

// Non-aggregating service statuses — MUST mirror aggregates.js NON_AGGREGATING_STATUSES.
// Inlined (not required) to keep the core pure/dependency-free.
const NON_AGGREGATING_STATUSES = Object.freeze(['archived']);

// The overdraft floor from getActivePackage's fallback pass (deduction-logic.js:133).
const OVERDRAFT_FLOOR = -10;

// Service-level invariant tolerance — unified with Check 7 / design §8 (0.05),
// NOT repair-aggregates' 0.02.
const SERVICE_INVARIANT_TOLERANCE = 0.05;

// Assignment basis values surfaced per entry (design §5).
const BASIS = Object.freeze({
  REPLAY: 'replay',
  SINGLE_ACTIVE: 'single_active',
  PRE_PACKAGE: 'pre_package',
  UNRESOLVED: 'unresolved'
});

// ── Local pure helpers (no external deps) ────────────────────────────────────

/** round2 — local copy (design: inline to keep the core dependency-free). */
function round2(n) {
  return Math.round((n || 0) * 100) / 100;
}

/**
 * Parse a timestamp-ish value to epoch millis. Tolerates:
 *   - ISO strings
 *   - { seconds, nanoseconds } / { _seconds } Firestore Timestamp plain shapes
 *   - { toMillis() } / { toDate() } Timestamp instances (defensive)
 *   - numbers (already millis)
 * Returns a finite number, or null if unparseable.
 */
function toMillis(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'string') {
    const t = new Date(raw).getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof raw === 'object') {
    if (typeof raw.toMillis === 'function') {
      const t = raw.toMillis();
      return Number.isFinite(t) ? t : null;
    }
    if (typeof raw.toDate === 'function') {
      const d = raw.toDate();
      const t = d && typeof d.getTime === 'function' ? d.getTime() : NaN;
      return Number.isFinite(t) ? t : null;
    }
    if (typeof raw.seconds === 'number') {
      return raw.seconds * 1000 + Math.floor((raw.nanoseconds || 0) / 1e6);
    }
    if (typeof raw._seconds === 'number') {
      return raw._seconds * 1000 + Math.floor((raw._nanoseconds || 0) / 1e6);
    }
  }
  return null;
}

/** Ascending sort key for a package by purchaseDate || createdAt (FIFO). */
function packageOrderKey(pkg) {
  const t = toMillis(pkg.purchaseDate || pkg.createdAt);
  return t === null ? Number.POSITIVE_INFINITY : t;
}

// One civil day in millis (used by both the instant ±1-day boundary flag and
// the civil-day-difference helper).
const DAY_MS = 24 * 60 * 60 * 1000;

// Deterministic Asia/Jerusalem civil-day formatter. `new Date(explicitInstant)`
// + `Intl.DateTimeFormat` with an explicit `timeZone` is PURE and deterministic
// (no host-TZ dependence, no Date.now()) — allowed by the core's purity rule.
// Mirrors functions/shared/calendar.js `_JERUSALEM_DATE_FMT` (en-CA → YYYY-MM-DD);
// NOT required-in to keep the core dependency-free.
const _JERUSALEM_DATE_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jerusalem',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

/**
 * Convert an absolute instant (epoch millis) to its civil "YYYY-MM-DD" day in
 * Asia/Jerusalem. Deterministic — the timeZone is explicit, so the result does
 * NOT depend on the host's local TZ. This is the ONLY place civil-day
 * normalization belongs (the createdAt-absent fallback path).
 *
 * Why NOT reuse calendar.js `normalizeDateToYMD`: that helper does a TZ-UNSAFE
 * `input.substring(0, 10)` for string inputs — for a midnight-UTC date-picker
 * purchaseDate ("2026-03-10T00:00:00.000Z") it would yield "2026-03-10", but
 * for the same instant the Asia/Jerusalem civil day is "2026-03-10" only by
 * luck of the +2/+3 offset; for instants near the UTC-midnight boundary the
 * substring and the true Jerusalem day DIVERGE. The Intl path is exact.
 *
 * @param {number|null} instantMillis
 * @returns {string|null} "YYYY-MM-DD" in Asia/Jerusalem, or null if unparseable
 */
function instantToJerusalemCivil(instantMillis) {
  if (instantMillis === null || !Number.isFinite(instantMillis)) return null;
  return _JERUSALEM_DATE_FMT.format(new Date(instantMillis));
}

/**
 * Civil-day difference between two "YYYY-MM-DD" strings (absolute, in days).
 * Parsed at UTC-midnight on BOTH sides so the subtraction is TZ-neutral (the
 * inputs are already civil dates — no time-of-day to skew it).
 */
function civilDayDiff(aCivil, bCivil) {
  const a = Date.parse(`${aCivil}T00:00:00.000Z`);
  const b = Date.parse(`${bCivil}T00:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY;
  return Math.abs(a - b) / DAY_MS;
}

/**
 * A3 (CORRECTED) — "did this package exist on/before this entry?" predicate.
 *
 * ROOT CAUSE of the prior (inert) implementation: PRODUCTION `purchaseDate` is
 * ALWAYS a full ISO instant (clients/index.js:223,290 `new Date().toISOString()`;
 * services/index.js:606,614 `parsed.toISOString()` / `new Date().toISOString()`)
 * — NEVER a bare "YYYY-MM-DD". The old `civilDate()` returned null for any
 * string containing 'T', so the "civil-date lexicographic" Path 1 was DEAD on
 * real data and EVERYTHING silently fell to a millis path. The midnight-UTC
 * knife-edge therefore survived for entries lacking `createdAt`, where an
 * entry's civil `date` was coerced to midnight-UTC and compared against a
 * real-time-of-day `purchaseDate` instant.
 *
 * CORRECTED preference order:
 *   1. PRIMARY (the common, correct path) — when `entry.createdAt` is present
 *      (→ entryMillis is its instant): compare ABSOLUTE INSTANTS
 *      `toMillis(purchaseDate) <= entry.createdAt-millis`. This is inherently
 *      TZ-safe for ALL purchaseDate formats (ISO real-instant, midnight-UTC
 *      date-picker, Firestore Timestamp). No civil coercion — the two values
 *      are points on the same physical timeline.
 *   2. FALLBACK (entry.createdAt ABSENT) — compare CIVIL DAYS in Asia/Jerusalem:
 *      derive the package's civil day from its purchaseDate instant via
 *      `instantToJerusalemCivil`, compare lexicographically to `entry.date`
 *      (already an Asia/Jerusalem civil "YYYY-MM-DD"). This is the ONLY place
 *      civil normalization belongs, and it correctly resolves the
 *      midnight-UTC-vs-early-morning-Israel boundary.
 *
 * Undated package (no parseable purchaseDate/createdAt) → CANNOT establish
 * existence. The live `getActivePackage` sorts a missing date LAST but still
 * treats it as eligible, so we KEEP it a candidate (do NOT silently widen by
 * forcing it in regardless) and FLAG it via `undatedPackage` so the script
 * surfaces it. In PROD every package has a purchaseDate, so this is expected to
 * be 0 (documented, not load-bearing).
 *
 * @param {Object} pkg    package {purchaseDate?, createdAt?}
 * @param {Object} entry  entry {createdAt?, date?}
 * @param {number|null} entryMillis  the entry's createdAt (or date-fallback)
 *   instant in millis, as computed by the replay sorter. When the entry HAS a
 *   createdAt this is its real instant; when it lacks createdAt this is the
 *   `date`-derived millis (the sorter's fallback) and we DON'T trust it for the
 *   instant path — we route to the civil fallback instead.
 * @returns {{candidate:boolean, sameDayBoundary:boolean, undatedPackage?:boolean}}
 *   sameDayBoundary=true when the decision was within ±1 civil day of the
 *   package's purchaseDate (a knife-edge a same-day renewal would hit — the
 *   script flags it for operator review).
 */
function packageExistedForEntry(pkg, entry, entryMillis) {
  const pkgMillis = toMillis(pkg.purchaseDate || pkg.createdAt);

  // Undated package — cannot establish existence. Keep it a candidate (live
  // helper treats a missing date as eligible) but FLAG it for the report.
  if (pkgMillis === null) {
    return { candidate: true, sameDayBoundary: false, undatedPackage: true };
  }

  const hasCreatedAt = !!(entry && entry.createdAt !== undefined && entry.createdAt !== null);

  // ── PRIMARY: absolute-instant compare (TZ-safe, the common path) ───────────
  // Only when the entry actually carries a createdAt — entryMillis is then its
  // real deduction instant. purchaseDate (any format) → instant via toMillis.
  if (hasCreatedAt && entryMillis !== null) {
    const candidate = pkgMillis <= entryMillis;
    // Boundary flag on the civil day to stay consistent with the fallback's
    // unit (so "within ±1 day" means the same thing on both paths).
    const pkgCivil = instantToJerusalemCivil(pkgMillis);
    const entryCivil = entry.date && /^\d{4}-\d{2}-\d{2}$/.test(entry.date)
      ? entry.date
      : instantToJerusalemCivil(entryMillis);
    const sameDayBoundary = (pkgCivil !== null && entryCivil !== null)
      ? civilDayDiff(pkgCivil, entryCivil) <= 1
      : (Math.abs(pkgMillis - entryMillis) <= DAY_MS);
    return { candidate, sameDayBoundary };
  }

  // ── FALLBACK: civil-day compare in Asia/Jerusalem (createdAt ABSENT) ───────
  // Derive the package's civil day from its instant; compare to the entry's
  // civil `date` (already Asia/Jerusalem). This is the knife-edge-correct path.
  const pkgCivil = instantToJerusalemCivil(pkgMillis);
  const entryCivil = (entry && typeof entry.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.date))
    ? entry.date
    : null;

  if (pkgCivil === null || entryCivil === null) {
    // No civil day on the entry side (no createdAt AND no usable date) → cannot
    // time-exclude → candidate (matches "undated entry can't be excluded").
    return { candidate: true, sameDayBoundary: false };
  }

  const candidate = pkgCivil <= entryCivil; // ISO civil days sort chronologically
  const sameDayBoundary = civilDayDiff(pkgCivil, entryCivil) <= 1;
  return { candidate, sameDayBoundary };
}

/**
 * Derive a package status from a remaining-hours value.
 * Mirrors deductHoursFromPackage (deduction-logic.js:241-246).
 */
function deriveStatus(hoursRemaining) {
  if (hoursRemaining < 0 && hoursRemaining >= OVERDRAFT_FLOOR) return 'overdraft';
  if (hoursRemaining <= 0) return 'depleted';
  return 'active';
}

/**
 * isContainerBranchA — mirrors the branch split in deduction-logic.js
 * getActivePackage: Branch A is taken when the CONTAINER (here: the HOURS
 * service, which holds packages directly with no stage layer) has
 * status === 'active' || status === 'completed'; otherwise the legacy
 * Branch B path is used.
 *
 * A1 fix (drift-faithfulness): the live helper's two branches use DIFFERENT
 * fresh/eligible predicates — Branch A treats 'pending' as fresh AND eligible;
 * Branch B does NOT ('pending' is neither fresh nor fallback-eligible there).
 * The previous core always used Branch-A semantics, so for a HOURS service whose
 * status is NOT active/completed (e.g. on_hold, or undefined) holding a
 * 'pending' package, the replay would pick that package fresh while the LIVE
 * deduction (Branch B) would not — wrong attribution. This restores the split.
 *
 * @param {string|undefined} serviceStatus
 * @returns {boolean} true → Branch A predicates; false → Branch B predicates
 */
function isContainerBranchA(serviceStatus) {
  return serviceStatus === 'active' || serviceStatus === 'completed';
}

/**
 * getActivePackageEquivalent — the time-aware, running-state mirror of
 * deduction-logic.js getActivePackage. Bit-faithful across ALL container
 * status cases: it replicates the Branch-A-vs-Branch-B predicate split keyed
 * on the HOURS service's own status (the service is the container — a HOURS
 * service holds packages directly, no stage layer). See isContainerBranchA.
 *
 * The ONLY intended difference from the live helper (per design §5): here
 * `hoursRemaining` is the RUNNING value computed from entries assigned so far
 * in the replay, NOT the stored drifted value; and `candidates` are pre-filtered
 * to purchaseDate <= entry time (time-awareness). The SELECTION PREDICATES are
 * identical to the live helper for the matching branch.
 *
 * @param {Array} candidates - packages already filtered to purchaseDate <= entry.createdAt
 * @param {Object} running   - { [pkgId]: hoursUsed } accumulated so far in the replay
 * @param {boolean} overrideActive - service.overrideActive (bypasses the -10h floor)
 * @param {string} [serviceStatus] - the HOURS service's status (selects Branch A/B).
 *   Treated EXACTLY as the live helper treats stage.status: ONLY the literal
 *   'active'/'completed' take Branch A; undefined/any-other takes Branch B (this
 *   faithfulness is load-bearing — see the A1 drift-guard test).
 * @returns {Object|null} the selected package object, or null if none eligible
 */
function getActivePackageEquivalent(candidates, running, overrideActive, serviceStatus) {
  if (!candidates || candidates.length === 0) return null;

  // Faithful to the live helper: undefined → Branch B (NOT coerced to 'active').
  const branchA = isContainerBranchA(serviceStatus);

  const liveRemaining = (pkg) => {
    const used = running[pkg.id] || 0;
    return round2((pkg.hours || 0) - used);
  };

  // Pass 1 (fresh): LIVE hoursRemaining > 0 AND a branch-specific fresh status.
  //   Branch A (live :116): !status || 'active' || 'pending'
  //   Branch B (live :155): !status || 'active'           (pending NOT fresh)
  const isFreshStatus = (s) => branchA
    ? (!s || s === 'active' || s === 'pending')
    : (!s || s === 'active');
  const fresh = candidates.filter((pkg) => isFreshStatus(pkg.status) && liveRemaining(pkg) > 0);
  if (fresh.length > 0) {
    // FIFO tie-break by purchaseDate/createdAt ASC; deterministic secondary by id.
    fresh.sort((a, b) => {
      const ka = packageOrderKey(a);
      const kb = packageOrderKey(b);
      if (ka !== kb) return ka - kb;
      return String(a.id).localeCompare(String(b.id));
    });
    return fresh[0];
  }

  // Pass 2 (fallback): branch-specific eligible status within the -10h floor
  // (override bypasses the floor — same as the live helper).
  //   Branch A (live :109): !s || 'active' || 'pending' || 'overdraft' || 'depleted'
  //   Branch B (live :150): !s || 'active' ||              'overdraft' || 'depleted'
  const eligibleStatus = (s) => branchA
    ? (!s || s === 'active' || s === 'pending' || s === 'overdraft' || s === 'depleted')
    : (!s || s === 'active' || s === 'overdraft' || s === 'depleted');
  const fallback = candidates.find((pkg) => {
    if (!eligibleStatus(pkg.status)) return false;
    return overrideActive || liveRemaining(pkg) > OVERDRAFT_FLOOR;
  });
  return fallback || null;
}

// ── isEligibleService (design §5 eligibility) ────────────────────────────────

/**
 * @param {Object} service
 * @returns {{eligible:true}} OR {{skip:true, reason:string}}
 *   reason ∈ {'not_hours','archived','no_packages','override_preserved','overdraft_resolved'}
 */
function isEligibleService(service) {
  if (!service || typeof service !== 'object') {
    return { skip: true, reason: 'no_packages' };
  }
  // type can be on svc.type OR svc.serviceType (design §5).
  const type = service.type || service.serviceType;
  if (type !== SERVICE_TYPE_HOURS) {
    return { skip: true, reason: 'not_hours' };
  }
  if (NON_AGGREGATING_STATUSES.includes(service.status || 'active')) {
    return { skip: true, reason: 'archived' };
  }
  if (!Array.isArray(service.packages) || service.packages.length === 0) {
    return { skip: true, reason: 'no_packages' };
  }
  if (service.overrideActive === true) {
    return { skip: true, reason: 'override_preserved' };
  }
  if (service.overdraftResolved && service.overdraftResolved.isResolved === true) {
    return { skip: true, reason: 'overdraft_resolved' };
  }
  return { eligible: true };
}

/**
 * A7 — classify a service that isEligibleService SKIPPED. Distinguishes:
 *   - skipped-but-HOURS WITH packages (override_preserved / overdraft_resolved):
 *     its orphan entries (packageId:null) still need STAMPING so each entry is
 *     attributable by packageId (single-owner / forward-replay) — WITHOUT
 *     recomputing its hoursUsed/packages/aggregates (the override/resolution is
 *     intentional). [OWN-0(c) removed the addPackageToService orphan-reseed that
 *     used to re-count these; stamping stays correct for attribution.]
 *   - fully-untouched (archived / non-HOURS / no-packages): leave entirely alone.
 *
 * @param {Object} service
 * @returns {boolean} true → stamp its orphans (but DON'T recompute hoursUsed)
 */
function isSkippedHoursServiceNeedingStamp(service) {
  if (!service || typeof service !== 'object') return false;
  const type = service.type || service.serviceType;
  if (type !== SERVICE_TYPE_HOURS) return false;                 // non-HOURS → untouched
  if (NON_AGGREGATING_STATUSES.includes(service.status || 'active')) return false; // archived → untouched
  if (!Array.isArray(service.packages) || service.packages.length === 0) return false; // no packages → nothing to stamp to
  // The ONLY skip reasons that reach here with HOURS+packages are
  // override_preserved / overdraft_resolved — both keep their packages and
  // accumulated orphans. Those orphans must be stamped (for packageId attribution)
  // but the service's hoursUsed/packages stay frozen.
  const isOverride = service.overrideActive === true;
  const isResolved = !!(service.overdraftResolved && service.overdraftResolved.isResolved === true);
  return isOverride || isResolved;
}

// ── assignEntriesForwardReplay (design §5) ───────────────────────────────────

/**
 * Sort entries deterministically: createdAt ASC, tie → docId ASC. Entries with
 * a missing createdAt fall back to `date`; if neither parses they sort LAST and
 * are flagged (`_missingCreatedAt`).
 *
 * @returns {Array} entries with attached `_sortMillis` and `_missingCreatedAt`
 */
function sortEntriesForReplay(entries) {
  const decorated = (entries || []).map((e) => {
    const createdMillis = toMillis(e.createdAt);
    const dateMillis = createdMillis === null ? toMillis(e.date) : null;
    const sortMillis = createdMillis !== null ? createdMillis : dateMillis;
    return {
      entry: e,
      sortMillis, // null if neither createdAt nor date parsed
      missingCreatedAt: createdMillis === null
    };
  });
  decorated.sort((a, b) => {
    const am = a.sortMillis;
    const bm = b.sortMillis;
    // Nulls sort last (Infinity).
    const ka = am === null ? Number.POSITIVE_INFINITY : am;
    const kb = bm === null ? Number.POSITIVE_INFINITY : bm;
    if (ka !== kb) return ka - kb;
    // tie-break: docId ASC (stable, deterministic)
    return String(a.entry.id).localeCompare(String(b.entry.id));
  });
  return decorated;
}

/**
 * Forward-replay a single service's entries onto its packages.
 *
 * @param {Array} packages - service.packages (each {id, hours, purchaseDate?, status?})
 * @param {Array} entries  - timesheet entries for this service
 *   (each {id, minutes, createdAt?, date?})
 * @param {Object} [opts]
 * @param {boolean} [opts.overrideActive=false] - service.overrideActive
 * @param {string} [opts.serviceStatus] - the HOURS service's status, selecting
 *   the live helper's Branch A vs Branch B predicate split (A1). Passed through
 *   raw; undefined/non-'active'/'completed' → Branch B (NOT coerced to 'active').
 * @returns {{assignments:Array, unresolved:Array}}
 *   assignments: [{entryId, packageId, basis, minutes, sameDayBoundary?}]
 *   unresolved:  [{entryId, minutes, reason, sameDayBoundary?}]
 */
function assignEntriesForwardReplay(packages, entries, opts) {
  const overrideActive = !!(opts && opts.overrideActive);
  // A1 faithfulness: pass the service status THROUGH (raw) to the selector, which
  // mirrors the live helper's branch split — ONLY 'active'/'completed' take Branch
  // A; undefined/anything-else takes Branch B. We do NOT coerce undefined to
  // 'active' (that would wrongly treat a 'pending' package as fresh under a legacy
  // statusless service). opts.serviceStatus is the service's own status.
  const serviceStatus = (opts && typeof opts.serviceStatus === 'string')
    ? opts.serviceStatus
    : undefined;
  const pkgs = Array.isArray(packages) ? packages.filter(Boolean) : [];

  // Running per-package consumed hours (the replay state).
  const running = {};
  for (const p of pkgs) running[p.id] = 0;

  // Earliest package (by purchaseDate ASC) — the destination for pre_package
  // entries (older than every package). Deterministic.
  const earliest = pkgs.length > 0
    ? [...pkgs].sort((a, b) => {
        const ka = packageOrderKey(a);
        const kb = packageOrderKey(b);
        if (ka !== kb) return ka - kb;
        return String(a.id).localeCompare(String(b.id));
      })[0]
    : null;

  const sorted = sortEntriesForReplay(entries);
  const assignments = [];
  const unresolved = [];

  for (const { entry, sortMillis } of sorted) {
    const minutes = typeof entry.minutes === 'number' ? entry.minutes : 0;
    const entryMillis = sortMillis; // createdAt (or date fallback) millis, or null

    // Time-aware candidate set: packages that existed at entry time (A3 —
    // CORRECTED). packageExistedForEntry uses the absolute-instant compare
    // `toMillis(purchaseDate) <= entry.createdAt` when the entry has a createdAt
    // (the common PROD path, TZ-safe for the real-instant purchaseDate), and the
    // Asia/Jerusalem civil-day compare only when createdAt is absent.
    // A package with no parseable date is treated as "always existed" — matches
    // getActivePackage which sorts a missing date last but still eligible.
    // Track whether ANY excluded package was within ±1 day of this entry — that
    // is the knife-edge a same-day renewal would hit; the script flags it.
    const candidates = [];
    let nearBoundaryExcluded = false;
    for (const p of pkgs) {
      const { candidate, sameDayBoundary } = packageExistedForEntry(p, entry, entryMillis);
      if (candidate) {
        candidates.push(p);
      } else if (sameDayBoundary) {
        nearBoundaryExcluded = true;
      }
    }

    if (candidates.length === 0) {
      // Entry predates every package OR no candidate at all.
      if (earliest) {
        // pre_package: assign to the earliest package (design §5 decision).
        // A3: flag when an excluded package was within ±1 day — a same-day
        // renewal that the day-filter still routed to pre_package (operator review).
        assignments.push({
          entryId: entry.id,
          packageId: earliest.id,
          basis: BASIS.PRE_PACKAGE,
          minutes,
          sameDayBoundary: nearBoundaryExcluded
        });
        running[earliest.id] += minutes / 60;
      } else {
        unresolved.push({ entryId: entry.id, minutes, reason: 'no_packages' });
      }
      continue;
    }

    const pick = getActivePackageEquivalent(candidates, running, overrideActive, serviceStatus);
    if (!pick) {
      // Candidates existed but none eligible (all beyond the -10h floor, no override).
      unresolved.push({
        entryId: entry.id,
        minutes,
        reason: 'no_eligible_package',
        sameDayBoundary: nearBoundaryExcluded
      });
      continue;
    }

    const basis = candidates.length === 1 ? BASIS.SINGLE_ACTIVE : BASIS.REPLAY;
    assignments.push({ entryId: entry.id, packageId: pick.id, basis, minutes });
    running[pick.id] += minutes / 60;
  }

  return { assignments, unresolved };
}

// ── computeRepairedService (design §5 COMPUTE + §7 diff) ─────────────────────

/**
 * Given a service and the replay assignments, return the corrected service +
 * a structured before/after diff and the service-level invariant.
 *
 * @param {Object} service - the (drifted) service object
 * @param {{assignments:Array, unresolved:Array}} replay - output of assignEntriesForwardReplay
 * @returns {{
 *   repairedService: Object,
 *   packageDiffs: Array,          // per package {packageId, before, after, delta, statusFlip}
 *   serviceBefore: number,        // service.hoursUsed before
 *   serviceAfter: number,         // service.hoursUsed after
 *   ledgerTruth: number,          // Σ ALL entry minutes / 60 — assigned + unresolved (the true total)
 *   invariantOk: boolean,         // |serviceAfter - ledgerTruth| <= 0.05 — FALSE when entries are unresolved
 *   phantomReversals: Array,      // packages zeroed (seeded-phantom), with before.hoursUsed
 *   unresolvedMinutes: number     // minutes the replay could not attribute (>0 ⇒ invariantOk false)
 * }}
 */
function computeRepairedService(service, replay) {
  const assignments = (replay && replay.assignments) || [];
  const pkgs = Array.isArray(service.packages) ? service.packages.filter(Boolean) : [];

  // Σ assigned minutes per package.
  const assignedMinutes = {};
  for (const p of pkgs) assignedMinutes[p.id] = 0;
  for (const a of assignments) {
    if (Object.prototype.hasOwnProperty.call(assignedMinutes, a.packageId)) {
      assignedMinutes[a.packageId] += a.minutes;
    }
  }

  const packageDiffs = [];
  const phantomReversals = [];

  const repairedPackages = pkgs.map((pkg) => {
    const beforeUsed = round2(pkg.hoursUsed || 0);
    const beforeRemaining = round2(
      typeof pkg.hoursRemaining === 'number'
        ? pkg.hoursRemaining
        : (pkg.hours || 0) - (pkg.hoursUsed || 0)
    );
    const beforeStatus = pkg.status || 'active';

    const minutes = assignedMinutes[pkg.id] || 0;
    let afterUsed = round2(minutes / 60);

    // Seeded-phantom: card shows hoursUsed > 0 but ZERO entries assigned →
    // zero it (the reversal). Surfaced explicitly if >= 20h (design §7).
    const isPhantom = beforeUsed > 0 && minutes === 0;
    if (isPhantom) {
      afterUsed = 0;
      phantomReversals.push({
        packageId: pkg.id,
        beforeHoursUsed: beforeUsed,
        afterHoursUsed: 0
      });
    }

    const afterRemaining = round2((pkg.hours || 0) - afterUsed);
    const afterStatus = deriveStatus(afterRemaining);

    packageDiffs.push({
      packageId: pkg.id,
      before: { hoursUsed: beforeUsed, hoursRemaining: beforeRemaining, status: beforeStatus },
      after: { hoursUsed: afterUsed, hoursRemaining: afterRemaining, status: afterStatus },
      delta: round2(afterUsed - beforeUsed),
      statusFlip: beforeStatus !== afterStatus
    });

    return {
      ...pkg,
      hoursUsed: afterUsed,
      hoursRemaining: afterRemaining,
      status: afterStatus
    };
  });

  // Service-level rollup = Σ packages.hoursUsed.
  const serviceBefore = round2(service.hoursUsed || 0);
  const serviceAfter = round2(
    repairedPackages.reduce((sum, p) => sum + (p.hoursUsed || 0), 0)
  );
  const serviceTotal = typeof service.totalHours === 'number' ? service.totalHours : 0;
  const serviceRemaining = round2(serviceTotal - serviceAfter);

  // Ledger truth = Σ ALL entry minutes / 60 — assigned PLUS unresolved. The
  // unresolved minutes (entries the replay could NOT attribute to any package —
  // e.g. an overdrawn service past the -10h floor with no override) are REAL hours
  // in the ledger. Including them here is load-bearing: when entries cannot be
  // fully attributed, serviceAfter (Σ attributable) < ledgerTruth (the true total),
  // so invariantOk goes FALSE → the live loop (reconcile-package-drift) SKIPS the
  // service ('invariant_failed') and the owner (service-writer) REFUSES to write,
  // instead of silently persisting an UNDER-COUNT that would pass a (wrongly) clean
  // invariant.
  // ⚠️ The OFFLINE supervised script (repair-package-aggregates.js) is NOT part of
  // this refusal: it REPORTS unresolved + invariantFailures in its summary but does
  // NOT gate its `--apply` write on invariantOk (it writes servicesAfter when
  // `!skip`). So an operator MUST NOT `--apply` a client whose report shows
  // invariantFailures > 0 — that would persist this same under-count. (Gating the
  // script on invariantOk like the live paths is a tracked follow-up.)
  // [fix: own-2 unresolved silent under-count]
  const unresolvedMinutes = (replay && Array.isArray(replay.unresolved))
    ? replay.unresolved.reduce((sum, u) => sum + (typeof u.minutes === 'number' ? u.minutes : 0), 0)
    : 0;
  const ledgerTruth = round2(
    (assignments.reduce((sum, a) => sum + a.minutes, 0) + unresolvedMinutes) / 60
  );
  const invariantOk = Math.abs(serviceAfter - ledgerTruth) <= SERVICE_INVARIANT_TOLERANCE;

  const repairedService = {
    ...service,
    packages: repairedPackages,
    hoursUsed: serviceAfter,
    hoursRemaining: serviceRemaining
  };

  return {
    repairedService,
    packageDiffs,
    serviceBefore,
    serviceAfter,
    ledgerTruth,
    invariantOk,
    phantomReversals,
    unresolvedMinutes // entries the replay could NOT attribute (drives invariantOk=false); observability for the loop/script
  };
}

// ── Defensive helpers (PROD has 0 of each; spec the branches) ─────────────────

/**
 * detectDuplicatePackageIds — same package id appearing on >1 service of a client.
 * @param {Object} client - {services:[...]}
 * @returns {Array} [{packageId, serviceIds:[...]}]  (empty in current PROD)
 */
function detectDuplicatePackageIds(client) {
  const seen = new Map(); // pkgId -> Set(serviceId)
  const services = (client && Array.isArray(client.services)) ? client.services.filter(Boolean) : [];
  for (const svc of services) {
    const pkgs = Array.isArray(svc.packages) ? svc.packages.filter(Boolean) : [];
    for (const pkg of pkgs) {
      if (!pkg || pkg.id === undefined || pkg.id === null) continue;
      if (!seen.has(pkg.id)) seen.set(pkg.id, new Set());
      seen.get(pkg.id).add(svc.id);
    }
  }
  const dups = [];
  for (const [packageId, serviceIds] of seen.entries()) {
    if (serviceIds.size > 1) {
      dups.push({ packageId, serviceIds: [...serviceIds] });
    }
  }
  return dups;
}

/**
 * detectDanglingEntries — entries pointing to a packageId that exists NOWHERE
 * on the client (defensive; 0 in PROD). Legal-stage package ids ARE catalogued.
 * @param {Object} client - {services:[...]}
 * @param {Array} entries - [{id, packageId}]
 * @returns {Array} [{entryId, packageId}]
 */
function detectDanglingEntries(client, entries) {
  const known = new Set();
  const services = (client && Array.isArray(client.services)) ? client.services.filter(Boolean) : [];
  for (const svc of services) {
    for (const pkg of (Array.isArray(svc.packages) ? svc.packages : [])) {
      if (pkg && pkg.id !== undefined && pkg.id !== null) known.add(pkg.id);
    }
    for (const stage of (Array.isArray(svc.stages) ? svc.stages : [])) {
      for (const pkg of (Array.isArray(stage.packages) ? stage.packages : [])) {
        if (pkg && pkg.id !== undefined && pkg.id !== null) known.add(pkg.id);
      }
    }
  }
  const dangling = [];
  for (const e of (entries || [])) {
    if (e && e.packageId && !known.has(e.packageId)) {
      dangling.push({ entryId: e.id, packageId: e.packageId });
    }
  }
  return dangling;
}

/**
 * Perform the two in-transaction writes in the ONLY Firestore-legal order.
 *
 * Firestore requires ALL reads before ALL writes within a single transaction.
 * The canonical client writer (`writeFn`) does an internal `transaction.get`
 * (a READ) and then writes; the audit (`auditFn` → logCriticalActionInTxn) is a
 * pure WRITE. Therefore the writer MUST run BEFORE the audit — if the audit
 * write is enqueued first, the writer's subsequent read aborts the whole txn
 * with "Firestore transactions require all reads to be executed before all
 * writes." (This regressed once: PR-DRIFT-2 round-2 placed the audit first and
 * every --apply client failed; mocked-SDK unit tests did NOT enforce the rule.)
 *
 * Pure + dependency-injected (no firebase-admin import) so the ordering is
 * regression-tested with a reads-before-writes-enforcing mock transaction.
 * The audit still commits ATOMICALLY with the mutation (same txn) — "audit-FIRST"
 * is preserved as "audit-atomic": either both land or both roll back.
 *
 * @param {Object} tx Firestore transaction
 * @param {Object} args { clientRef, services, writeFn(tx, ref, {services}), auditFn(tx) }
 */
async function applyRepairWritesInOrder(tx, { clientRef, services, writeFn, auditFn }) {
  await writeFn(tx, clientRef, { services }); // 1) reads-then-writes — its read precedes every write
  auditFn(tx);                                // 2) pure write — strictly AFTER the writer's read
}

module.exports = {
  // PURE core API (script + tests)
  assignEntriesForwardReplay,
  computeRepairedService,
  isEligibleService,
  isSkippedHoursServiceNeedingStamp,
  detectDuplicatePackageIds,
  detectDanglingEntries,
  applyRepairWritesInOrder,
  // exposed for tests / script reuse
  _internal: {
    round2,
    toMillis,
    deriveStatus,
    getActivePackageEquivalent,
    isContainerBranchA,
    instantToJerusalemCivil,
    civilDayDiff,
    packageExistedForEntry,
    sortEntriesForReplay,
    packageOrderKey,
    BASIS,
    NON_AGGREGATING_STATUSES,
    SERVICE_INVARIANT_TOLERANCE,
    OVERDRAFT_FLOOR
  }
};
