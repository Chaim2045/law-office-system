/**
 * ═══════════════════════════════════════════════════════════════
 * TZ Helper — Asia/Jerusalem-canonical date utilities (frontend)
 * ═══════════════════════════════════════════════════════════════
 *
 * PR-G.3.10 (2026-05-25): centralizes the "today in IL" logic so
 * frontend readers compare like-for-like against backend writes
 * (Firestore `timesheet_entries.date` is YYYY-MM-DD string).
 *
 * Bug class fixed (G.3.7/G.3.8/G.3.9/G.3.10 family):
 *   `.toISOString().slice(0,10)` returns UTC date. In browsers running
 *   outside Asia/Jerusalem TZ (vacation abroad, etc.) OR at the IL
 *   midnight boundary, this returns YESTERDAY's date string — causing
 *   stats/filters to miss or misplace entries.
 *
 * SSOT note: mirrors `functions/shared/calendar.js` `todayInJerusalemYMD()`
 * + `normalizeDateToYMD()`. Backend is CJS (Cloud Functions); frontend is
 * ES modules (browser). Cross-runtime sync is manual — if you change one,
 * sync the other. Logic must stay byte-identical in semantics.
 *
 * Browser compat: `Intl.DateTimeFormat` with `timeZone` + `en-CA` locale
 * (yields YYYY-MM-DD) is supported in all evergreen browsers we target.
 */

const _JERUSALEM_DATE_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jerusalem',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

/**
 * Today's date in Asia/Jerusalem as `YYYY-MM-DD`.
 * @returns {string}
 */
export function todayInJerusalemYMD() {
  return _JERUSALEM_DATE_FMT.format(new Date());
}

/**
 * Normalize any caller-supplied date input to `YYYY-MM-DD` in
 * Asia/Jerusalem. Accepts:
 *   - String (`'YYYY-MM-DD'` or full ISO) — returns the input prefix
 *     (preserves the YMD the caller already chose).
 *   - JS `Date` instance — converted via IL TZ formatter.
 *   - Firestore `Timestamp` (object with `.toDate()`) — converted via IL TZ.
 *
 * Returns `''` (empty) on null/undefined/unrecognized to match the
 * existing `getDateString` contract in `main.js` (defensive UI code).
 *
 * @param {*} input
 * @returns {string} `YYYY-MM-DD` or `''`
 */
export function dateToJerusalemYMD(input) {
  if (input === null || input === undefined) {
    return '';
  }
  if (typeof input === 'string') {
    // Preserve input prefix. Both 'YYYY-MM-DD' and full ISO yield same first 10.
    return input.slice(0, 10);
  }
  if (typeof input === 'object') {
    if (typeof input.toDate === 'function') {
      const d = input.toDate();
      if (d instanceof Date && !Number.isNaN(d.getTime())) {
        return _JERUSALEM_DATE_FMT.format(d);
      }
      return '';
    }
    if (input instanceof Date) {
      if (Number.isNaN(input.getTime())) {
        return '';
      }
      return _JERUSALEM_DATE_FMT.format(input);
    }
  }
  return '';
}

/**
 * Offset a YYYY-MM-DD date string by `days` (positive or negative).
 * Pure date arithmetic — does not depend on host TZ.
 *
 * Used by week-range / month-boundary computations where we already
 * have an IL date string and need IL-relative day arithmetic.
 *
 * @param {string} ymd - 'YYYY-MM-DD'
 * @param {number} days - integer offset
 * @returns {string} 'YYYY-MM-DD'
 */
export function addDaysYMD(ymd, days) {
  const [y, m, d] = ymd.split('-').map(Number);
  // Construct as UTC to avoid TZ drift in arithmetic; format back via UTC.
  const t = Date.UTC(y, m - 1, d) + days * 86400000;
  const dt = new Date(t);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Day-of-week (0=Sun..6=Sat) for a YYYY-MM-DD date string. TZ-invariant.
 *
 * @param {string} ymd - 'YYYY-MM-DD'
 * @returns {number} 0..6
 */
export function dayOfWeekYMD(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Return the start-of-month YYYY-MM-DD for a given YYYY-MM-DD.
 *
 * @param {string} ymd - 'YYYY-MM-DD'
 * @returns {string} `YYYY-MM-01`
 */
export function startOfMonthYMD(ymd) {
  return `${ymd.slice(0, 7)}-01`;
}

/**
 * PR-G.3.11: format a Date as `YYYY-MM-DDTHH:mm` in Asia/Jerusalem.
 * Suitable for `<input type="datetime-local">` `.value` assignments.
 *
 * Bug fixed: was `date.toISOString().slice(0, 16)` which yields UTC
 * (e.g. for IL 17:00 winter, UTC is 15:00, so the picker default jumps
 * back 2-3h for IL users; worse for users abroad).
 *
 * @param {Date} date - JS Date instance
 * @returns {string} `YYYY-MM-DDTHH:mm` or `''` on invalid input
 */
const _JERUSALEM_DATETIME_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jerusalem',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

export function dateTimeToJerusalemLocalInput(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }
  // en-CA + above options yields parts in form 'YYYY-MM-DD, HH:mm' on Chrome
  // and 'YYYY-MM-DD, HH:mm' on Firefox. Use formatToParts for stable output.
  const parts = _JERUSALEM_DATETIME_FMT.formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  const y = get('year');
  const m = get('month');
  const d = get('day');
  let h = get('hour');
  const min = get('minute');
  // Some engines emit '24' for midnight under hour12:false — normalize to '00'.
  if (h === '24') {
    h = '00';
  }
  return `${y}-${m}-${d}T${h}:${min}`;
}

// ─────────────────────────────────────────────────────────────────
// Window mirror — for non-module consumers (matches dates.js pattern)
// ─────────────────────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  window.TZHelper = {
    todayInJerusalemYMD,
    dateToJerusalemYMD,
    addDaysYMD,
    dayOfWeekYMD,
    startOfMonthYMD,
    dateTimeToJerusalemLocalInput
  };
}
