/**
 * Israeli Calendar — Holidays + workday classifier (PR-G.1, 2026-05-19)
 *
 * Wraps `@hebcal/core` (offline computation) and applies the law office's
 * own work policy to classify each event:
 *
 *   - CLOSED:   major holidays (Pesach I/VII, Shavuot, RH, YK, Sukkot, ShAtz,
 *               Simchat Torah), Yom HaAtzma'ut, Yom HaZikaron, Yom HaShoah,
 *               Purim, Tish'a B'Av
 *   - HALF-DAY: erev (eve) of any closed day
 *   - WORKING:  Chol HaMoed (intermediate days of Pesach/Sukkot), Chanukah,
 *               minor holidays (Tu BiShvat, Lag BaOmer, etc.), minor fasts
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

const HEBCAL_VERSION = (() => {
  try {
    return require('@hebcal/core/package.json').version;
  } catch (e) {
    return 'unknown';
  }
})();

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

  // Erev (eve) — half-day regardless of category
  if (isEve) {
    return { type: 'eve', isWorking: true, isHalfDay: true, eveOf: basename };
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
    const dateISO = e.getDate().greg().toISOString().slice(0, 10);
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
    // If multiple events share a date (e.g. Erev + Yom Tov), prefer the
    // non-working classification (closed wins over eve, eve wins over open)
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
  // Exported for unit tests
  _test: {
    classifyEvent,
    _dayOfWeekUTC,
    CLOSED_MODERN_BASENAMES,
    CLOSED_MINOR_BASENAMES
  }
};
