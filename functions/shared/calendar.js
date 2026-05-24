/**
 * Israeli Calendar — Holidays + workday classifier (PR-G.1, 2026-05-19)
 *
 * Wraps `@hebcal/core` (offline computation) and applies the law office's
 * own work policy to classify each event:
 *
 *   - CLOSED:   major holidays (Pesach I/VII, Shavuot, RH, YK, Sukkot, ShAtz,
 *               Simchat Torah), Yom HaAtzma'ut, Yom HaZikaron, Yom HaShoah,
 *               Purim, Tish'a B'Av, AND eves of those (per PR-G.3.12
 *               policy 2026-05-20: "אין עבודה בערב חג")
 *   - WORKING:  Chol HaMoed (intermediate days of Pesach/Sukkot), Chanukah,
 *               minor holidays (Tu BiShvat, Lag BaOmer, etc.), minor fasts
 *
 * Historical: eves were classified HALF-DAY through PR-G.3.11; flipped to
 * CLOSED in PR-G.3.12 per office policy change 2026-05-20.
 *
 * Policy mirrors `hachnasovitz/daily-reports/calendar.js` (the bot already
 * encodes this). DRY across repos is not feasible — both files stay in
 * sync manually if policy changes.
 *
 * Designed to be deterministic + offline: no HTTP, no network. The
 * `dailyInvariantCheck`-adjacent cron `holidaysCalendarSync` computes 6
 * years (current + 5 forward) every night at 03:00 IL and upserts to
 * Firestore `system_holidays/{year}`.
 *
 * Frontend NEVER calls this module directly — frontend reads from
 * Firestore. This module lives only in functions/.
 */

const { HebrewCalendar, flags } = require('@hebcal/core');

/**
 * PR-G.3.7 (2026-05-24): resolve `@hebcal/core` version via filesystem walkup
 * from the resolved entry-point path.
 *
 * Previously used `require('@hebcal/core/package.json')` — which throws
 * `ERR_PACKAGE_PATH_NOT_EXPORTED` on Node ≥22 because @hebcal/core@3.50.4
 * doesn't expose `./package.json` via the `exports` field. The silent
 * try/catch hid this — `HEBCAL_VERSION` reported `'unknown'` in production.
 *
 * Fix: walk up from `require.resolve('@hebcal/core')` (which resolves to the
 * entry main, often inside `dist/`) until we find a `package.json` whose
 * `name === '@hebcal/core'`. Capped at 5 levels for safety.
 */
const HEBCAL_VERSION = (() => {
  try {
    const path = require('path');
    const fs = require('fs');
    const corePath = require.resolve('@hebcal/core');
    let dir = path.dirname(corePath);
    for (let i = 0; i < 5; i++) {
      const pkgPath = path.join(dir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.name === '@hebcal/core') {
          return pkg.version;
        }
      }
      dir = path.dirname(dir);
    }
    return 'unknown';
  } catch (_e) {
    return 'unknown';
  }
})();

/**
 * PR-G.3.7 (2026-05-24): convert a Hebcal `HDate`'s Gregorian `Date` to
 * `YYYY-MM-DD` (Gregorian ISO date), timezone-safe.
 *
 * Bug fixed: previous implementation used `.toISOString().slice(0, 10)`
 * which converts to UTC. Hebcal builds Dates via `new Date(y, m, d)` —
 * local-midnight. On hosts NOT in UTC (e.g. Asia/Jerusalem UTC+3),
 * Apr 2 local-midnight becomes Apr 1 21:00 UTC; the slice then yields
 * `"2026-04-01"` (off by -1).
 *
 * Fix: read the local-time year/month/day fields back from the same Date
 * — this is the inverse of the `new Date(y, m, d)` constructor and is
 * TZ-invariant.
 *
 * @param {{ greg: () => Date }} hdate - Hebcal HDate (anything with .greg())
 * @returns {string} `YYYY-MM-DD`
 */
function _hdateToISO(hdate) {
  const g = hdate.greg();
  const y = g.getFullYear();
  const m = String(g.getMonth() + 1).padStart(2, '0');
  const d = String(g.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * PR-G.3.8 (2026-05-24): canonical "today in Asia/Jerusalem" helpers for
 * any Cloud Function or Node code that needs to query Firestore for IL
 * "today" data.
 *
 * Bug class: `new Date().toISOString().slice(0,10)` and
 * `new Date().setHours(0,0,0,0)` use the host's idea of "today" — which on
 * Cloud Functions (UTC) is wrong for Asia/Jerusalem between 00:00-03:00
 * local time (winter) or 00:00-04:00 (DST). Result: queries return
 * yesterday's data, or Timestamp ranges miss 3-4 hours of IL "today".
 *
 * Fix pattern:
 *   - For string `where('date','==',X)` queries → use `todayInJerusalemYMD()`
 *   - For Timestamp `where('approvedAt','>=',X)` queries → use `startOfTodayInJerusalem()`
 *
 * Implementation uses `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' })`
 * which yields `YYYY-MM-DD` regardless of host TZ. `en-CA` chosen over
 * `sv-SE` for broader Intl coverage.
 *
 * NEVER use `.toISOString().slice(0,10)` or `setHours(0,0,0,0)` on a
 * fresh `new Date()` for IL-tied logic — that's the bug this helper fixes.
 */

const _JERUSALEM_DATE_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jerusalem',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

/**
 * Return today's date in Asia/Jerusalem as `YYYY-MM-DD`.
 *
 * @returns {string} e.g. `'2026-05-24'`
 */
function todayInJerusalemYMD() {
  // en-CA formatter yields `YYYY-MM-DD` directly.
  return _JERUSALEM_DATE_FMT.format(new Date());
}

/**
 * Return a `Date` object representing 00:00:00 of today in Asia/Jerusalem,
 * suitable for Firestore Timestamp `where('field','>=',X)` queries.
 *
 * @returns {Date}
 */
function startOfTodayInJerusalem() {
  const ymd = todayInJerusalemYMD(); // 'YYYY-MM-DD'
  // Construct from local IL fields → produce instant for 00:00 IL.
  // We cannot trust `new Date('YYYY-MM-DDT00:00:00')` (parses as host-local),
  // so build the UTC instant manually: IL midnight = UTC midnight − offset.
  // Offset: derive from a probe date so we honor DST automatically.
  const [y, m, d] = ymd.split('-').map(Number);
  // Probe: noon IL is unambiguous (never crosses DST boundary within the
  // hour). Compute its UTC ms and derive the IL UTC offset for that day.
  const probeUTC = Date.UTC(y, m - 1, d, 12, 0, 0);
  const probeAsIL = _JERUSALEM_DATE_FMT.formatToParts(new Date(probeUTC));
  // We just need the offset. Re-format the probe as IL time-of-day.
  const ilHourFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = ilHourFmt.format(new Date(probeUTC)).split(':');
  const ilHour = Number(parts[0]);
  // probeUTC is 12:00 UTC. If IL shows e.g. "15:00", offset = +3h.
  const offsetHours = ilHour - 12;
  // IL midnight = UTC midnight − offsetHours
  return new Date(Date.UTC(y, m - 1, d, -offsetHours, 0, 0));
}

/**
 * Modern (Israel-state) days where the office is CLOSED.
 * Other modern days like Family Day, Hebrew Language Day, Yom HaAliyah,
 * Herzl Day, Yom Yerushalayim → not in this set → open by default.
 *
 * NOTE on Yom Yerushalayim: many firms close it; we currently keep open
 * to match the bot's HOLIDAY_GREETINGS list. Editable per-year in
 * Firestore `system_holidays/{year}` if the office changes policy.
 */
const CLOSED_MODERN_BASENAMES = new Set([
  'Yom HaAtzma\'ut',
  'Yom HaZikaron',
  'Yom HaShoah'
]);

/**
 * Minor holidays / non-major where office is CLOSED (overrides default
 * "minor = open" rule). Hebcal marks these as MINOR_HOLIDAY or similar.
 */
const CLOSED_MINOR_BASENAMES = new Set([
  'Purim'
  // Note: Tish'a B'Av carries MAJOR_FAST flag, caught separately
]);

// ───────────────────────────────────────────────────────────────
// Single-event classifier
// ───────────────────────────────────────────────────────────────

/**
 * Classify a single Hebcal `Event` into office-policy terms.
 *
 * @param {Object} e - Hebcal event
 * @returns {{type, isWorking, isHalfDay, eveOf}}
 */
function classifyEvent(e) {
  const f = e.getFlags();
  const isMajor = !!(f & flags.CHAG);
  const isModern = !!(f & flags.MODERN_HOLIDAY);
  const isEve = !!(f & flags.EREV);
  const isCholHaMoed = !!(f & flags.CHOL_HAMOED);
  const isMajorFast = !!(f & flags.MAJOR_FAST);
  const isChanukah = !!(f & flags.CHANUKAH_CANDLES);
  const basename = e.basename();

  // Chanukah — explicit working holiday. Check BEFORE Erev because
  // Hebcal flags "Chanukah: 1 Candle" with both CHANUKAH_CANDLES and EREV
  // (it's technically the eve of Chanukah light #1). Office policy: open.
  if (isChanukah) {
    return { type: 'modern', isWorking: true, isHalfDay: false, eveOf: null };
  }

  // PR-G.3.12 (office policy 2026-05-20): "אין עבודה בערב חג" — eves of
  // closed holidays are FULL non-working days (previously half-day).
  // The `eveOf` field is retained so consumers can still distinguish an
  // eve from a regular closed holiday in UI if desired.
  if (isEve) {
    return { type: 'eve', isWorking: false, isHalfDay: false, eveOf: basename };
  }

  // Chol HaMoed (intermediate Pesach/Sukkot days) — office open
  if (isCholHaMoed) {
    return { type: 'cholhamoed', isWorking: true, isHalfDay: false, eveOf: null };
  }

  // Major holiday (Pesach I/VII, Shavuot, Rosh Hashana, Sukkot, etc.)
  // OR major fast (Yom Kippur, Tish'a B'Av) → CLOSED
  if (isMajor || isMajorFast) {
    return {
      type: isMajorFast ? 'fast' : 'holiday',
      isWorking: false,
      isHalfDay: false,
      eveOf: null
    };
  }

  // Modern (Israel-state) days from the closed set
  if (isModern && CLOSED_MODERN_BASENAMES.has(basename)) {
    return { type: 'memorial', isWorking: false, isHalfDay: false, eveOf: null };
  }

  // Minor holidays from the office's closed set (Purim)
  if (CLOSED_MINOR_BASENAMES.has(basename)) {
    return { type: 'minor', isWorking: false, isHalfDay: false, eveOf: null };
  }

  // Default: open (Tu BiShvat, Lag BaOmer, Family Day, Yom Yerushalayim, ...)
  return { type: 'minor', isWorking: true, isHalfDay: false, eveOf: null };
}

// ───────────────────────────────────────────────────────────────
// Year computation
// ───────────────────────────────────────────────────────────────

/**
 * Return the canonical holidays array for a Gregorian year (Israel calendar).
 * Deterministic + offline — no Firestore, no HTTP.
 *
 * @param {number} year - 4-digit Gregorian year (e.g. 2026)
 * @returns {Array<{date, type, nameHe, nameEn, isWorking, isHalfDay, eveOf, hebcalFlags}>}
 */
function getHolidaysForYear(year) {
  if (!Number.isInteger(year) || year < 1900 || year > 2200) {
    throw new Error(`getHolidaysForYear: invalid year ${year}`);
  }

  const events = HebrewCalendar.calendar({
    year,
    isHebrewYear: false,
    candlelighting: false,
    sedrot: false,
    il: true,                  // Israel observance
    noMinorFast: false,
    noModern: false,
    noRoshChodesh: true,
    noSpecialShabbat: true
  });

  const holidays = [];
  for (const e of events) {
    // PR-G.3.7: TZ-safe via _hdateToISO. NEVER use toISOString().slice(0,10)
    // on a local-midnight Date — it converts to UTC and yields wrong day on
    // non-UTC hosts.
    const dateISO = _hdateToISO(e.getDate());
    const cls = classifyEvent(e);

    holidays.push({
      date: dateISO,
      type: cls.type,
      nameHe: e.render('he'),
      nameEn: e.render('en'),
      isWorking: cls.isWorking,
      isHalfDay: cls.isHalfDay,
      eveOf: cls.eveOf,
      hebcalFlags: e.getFlags()
    });
  }

  return holidays;
}

// ───────────────────────────────────────────────────────────────
// Per-date lookups
// ───────────────────────────────────────────────────────────────

/**
 * Build a Map<dateStr, Holiday> from a holidays array — convenience for fast lookup.
 * @param {Array} holidays
 * @returns {Map<string, Object>}
 */
function buildHolidaysMap(holidays) {
  const map = new Map();
  for (const h of holidays || []) {
    // If multiple events share a date (e.g. Erev + minor fast like
    // Ta'anit Bechorot), prefer the non-working classification.
    // PR-G.3.12: post-policy-update, eves are also closed (isWorking:false),
    // so the "closed wins" branch below handles both eves and yom tov; the
    // half-day tiebreaker is now dead code but retained as defensive guard
    // in case a future override carries `isHalfDay:true` on a working day.
    const existing = map.get(h.date);
    if (!existing) {
      map.set(h.date, h);
      continue;
    }
    // Closed beats half-day beats open
    if (!h.isWorking && existing.isWorking) {
      map.set(h.date, h);
    } else if (h.isHalfDay && !existing.isHalfDay && existing.isWorking) {
      map.set(h.date, h);
    }
  }
  return map;
}

/**
 * True if the given date is a workday for the office (not Friday/Saturday,
 * not a closed holiday).
 *
 * @param {string} dateISO - 'YYYY-MM-DD'
 * @param {Map<string, Object>} [holidaysMap] - optional pre-built map
 * @returns {boolean}
 */
function isWorkday(dateISO, holidaysMap) {
  // Friday(5), Saturday(6) — non-work in Israel
  const dow = _dayOfWeekUTC(dateISO);
  if (dow === 5 || dow === 6) {
    return false;
  }

  if (holidaysMap) {
    const h = holidaysMap.get(dateISO);
    if (h && !h.isWorking) {
      return false;
    }
  }

  return true;
}

/**
 * Rich info for a date — type, halfDay flag, eve info.
 *
 * @param {string} dateISO
 * @param {Map<string, Object>} [holidaysMap]
 * @returns {{type, isWorking, isHalfDay, eveOf, holiday?}}
 */
function getDayInfo(dateISO, holidaysMap) {
  const dow = _dayOfWeekUTC(dateISO);
  if (dow === 6) {
    return { type: 'saturday', isWorking: false, isHalfDay: false, eveOf: null };
  }
  if (dow === 5) {
    return { type: 'friday', isWorking: false, isHalfDay: false, eveOf: null };
  }

  if (holidaysMap) {
    const h = holidaysMap.get(dateISO);
    if (h) {
      return {
        type: h.type,
        isWorking: h.isWorking,
        isHalfDay: h.isHalfDay,
        eveOf: h.eveOf,
        holiday: h
      };
    }
  }

  return { type: 'normal', isWorking: true, isHalfDay: false, eveOf: null };
}

// ───────────────────────────────────────────────────────────────
// Internals
// ───────────────────────────────────────────────────────────────

function _dayOfWeekUTC(dateISO) {
  const [y, m, d] = dateISO.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// ───────────────────────────────────────────────────────────────
// Module
// ───────────────────────────────────────────────────────────────

module.exports = {
  HEBCAL_VERSION,
  getHolidaysForYear,
  buildHolidaysMap,
  isWorkday,
  getDayInfo,
  // PR-G.3.8: TZ-safe "today" helpers for Cloud Functions
  todayInJerusalemYMD,
  startOfTodayInJerusalem,
  // Exported for unit tests
  _test: {
    classifyEvent,
    _dayOfWeekUTC,
    _hdateToISO,  // PR-G.3.7
    todayInJerusalemYMD,        // PR-G.3.8
    startOfTodayInJerusalem,    // PR-G.3.8
    CLOSED_MODERN_BASENAMES,
    CLOSED_MINOR_BASENAMES
  }
};
