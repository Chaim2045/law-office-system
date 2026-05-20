/**
 * Holidays Cache — frontend loader for `system_holidays/{year}` (PR-G.3.1, 2026-05-20).
 *
 * ⚠️ DUPLICATED FILE — keep byte-identical with the sibling at:
 *     apps/admin-panel/js/shared/holidays-cache.js
 *
 * Cross-app Netlify deploy boundary prevents true single-source. When this
 * file changes, update BOTH copies in the same PR.
 *
 * Purpose (Phase A of PR-G.3 split):
 *   On app boot, subscribe to Firestore `system_holidays/{Y-1,Y,Y+1}` via
 *   `onSnapshot` (real-time), merge all years into a single
 *   `Map<'YYYY-MM-DD', Holiday>` exposed at `window.WORK_HOURS_HOLIDAYS_MAP`.
 *   Consumers (added in PR-G.3.2) `await window.WORK_HOURS_HOLIDAYS_READY`
 *   before first paint — eliminates the sync-from-async race identified by
 *   devils-advocate.
 *
 * Why classic script (not ES module):
 *   Most consumers in this codebase are classic `<script>` tags assigning to
 *   `window`. A `window`-attached global reachable by every consumer
 *   (classic + module) is the simplest pattern. Matches the
 *   `work-hours-constants.js` (PR-G.2) pattern.
 *
 * Loading order requirement (verified in index.html / workload.html):
 *   firebase compat → firebase.initializeApp() → work-hours-constants.js → THIS → consumers.
 *
 * G.3.1 = infrastructure ONLY. No consumer changes. G.3.2 wires consumers.
 * G.3.3 splits cron `auto` vs admin `overrides`.
 */

(function () {
  'use strict';

  // ─── Configuration ─────────────────────────────────────────
  const COLLECTION = 'system_holidays';
  const FIRST_LOAD_TIMEOUT_MS = 5000;  // After this, fallback engages
  const YEAR_WINDOW = [-1, 0, 1];      // current year ±1

  // ─── State (private) ───────────────────────────────────────
  let _resolveReady = null;
  let _unsubs = [];
  let _yearsLoaded = new Set();
  const _holidaysByYear = new Map(); // year → holidays[]

  // ─── Public globals ────────────────────────────────────────
  /** @type {Map<string, Object>} */
  window.WORK_HOURS_HOLIDAYS_MAP = new Map();

  /** @type {Promise<void>} */
  window.WORK_HOURS_HOLIDAYS_READY = new Promise((resolve) => {
    _resolveReady = resolve;
  });

  /** @type {boolean} */
  window.WORK_HOURS_HOLIDAYS_FALLBACK_USED = false;

  // ─── Embedded fallback (R2 mitigation) ─────────────────────
  // Snapshot of `system_holidays/2026` as seeded by `functions/scripts/seedHolidays.js`
  // (PR-G.1). Covers ONE year only — used when Firestore unreachable / cold-start
  // / first-load timeout. Sufficient to keep the app usable for ~12 months;
  // re-fresh on next deploy.
  //
  // NOTE: This is a DEGRADED source of truth. If Firestore ever returns data,
  // the snapshot replaces this. `WORK_HOURS_HOLIDAYS_FALLBACK_USED = true`
  // signals to consumers + dev tools that the cache is degraded.
  const EMBEDDED_FALLBACK_2026 = [{'date':'2026-02-02','type':'minor','nameHe':'טוּ בִּשְׁבָט','nameEn':'Tu BiShvat','isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-02-17','type':'minor','nameHe':'יוֹם הַמִּשׁפָּחָה','nameEn':'Family Day','isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-03-02','type':'minor','nameHe':'תַּעֲנִית אֶסְתֵּר','nameEn':"Ta'anit Esther",'isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-03-02','type':'eve','nameHe':'עֶרֶב פּוּרִים','nameEn':'Erev Purim','isWorking':true,'isHalfDay':true,'eveOf':'Purim'},{'date':'2026-03-03','type':'minor','nameHe':'פּוּרִים','nameEn':'Purim','isWorking':false,'isHalfDay':false,'eveOf':null},{'date':'2026-03-04','type':'minor','nameHe':'שׁוּשָׁן פּוּרִים','nameEn':'Shushan Purim','isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-03-28','type':'minor','nameHe':'יוֹם הַעֲלִיָּה','nameEn':'Yom HaAliyah','isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-04-01','type':'minor','nameHe':'תַּעֲנִית בְּכוֹרוֹת','nameEn':"Ta'anit Bechorot",'isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-04-01','type':'eve','nameHe':'עֶרֶב פֶּסַח','nameEn':'Erev Pesach','isWorking':true,'isHalfDay':true,'eveOf':'Pesach'},{'date':'2026-04-02','type':'holiday','nameHe':'פֶּסַח א׳','nameEn':'Pesach I','isWorking':false,'isHalfDay':false,'eveOf':null},{'date':'2026-04-03','type':'cholhamoed','nameHe':'פֶּסַח ב׳ (חוה״מ)','nameEn':"Pesach II (CH''M)",'isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-04-04','type':'cholhamoed','nameHe':'פֶּסַח ג׳ (חוה״מ)','nameEn':"Pesach III (CH''M)",'isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-04-05','type':'cholhamoed','nameHe':'פֶּסַח ד׳ (חוה״מ)','nameEn':"Pesach IV (CH''M)",'isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-04-06','type':'cholhamoed','nameHe':'פֶּסַח ה׳ (חוה״מ)','nameEn':"Pesach V (CH''M)",'isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-04-07','type':'cholhamoed','nameHe':'פֶּסַח ו׳ (חוה״מ)','nameEn':"Pesach VI (CH''M)",'isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-04-08','type':'holiday','nameHe':'פֶּסַח ז׳','nameEn':'Pesach VII','isWorking':false,'isHalfDay':false,'eveOf':null},{'date':'2026-04-14','type':'memorial','nameHe':'יוֹם הַשּׁוֹאָה','nameEn':'Yom HaShoah','isWorking':false,'isHalfDay':false,'eveOf':null},{'date':'2026-04-21','type':'memorial','nameHe':'יוֹם הַזִּכָּרוֹן','nameEn':'Yom HaZikaron','isWorking':false,'isHalfDay':false,'eveOf':null},{'date':'2026-04-22','type':'memorial','nameHe':'יוֹם הָעַצְמָאוּת','nameEn':"Yom HaAtzma'ut",'isWorking':false,'isHalfDay':false,'eveOf':null},{'date':'2026-04-27','type':'minor','nameHe':'יוֹם הרצל','nameEn':'Herzl Day','isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-05-01','type':'minor','nameHe':'פֶּסַח שני','nameEn':'Pesach Sheni','isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-05-05','type':'minor','nameHe':'ל״ג בָּעוֹמֶר','nameEn':'Lag BaOmer','isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-05-15','type':'minor','nameHe':'יוֹם יְרוּשָׁלַיִם','nameEn':'Yom Yerushalayim','isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-05-21','type':'eve','nameHe':'עֶרֶב שָׁבוּעוֹת','nameEn':'Erev Shavuot','isWorking':true,'isHalfDay':true,'eveOf':'Shavuot'},{'date':'2026-05-22','type':'holiday','nameHe':'שָׁבוּעוֹת','nameEn':'Shavuot','isWorking':false,'isHalfDay':false,'eveOf':null},{'date':'2026-07-02','type':'minor','nameHe':'צוֹם תָּמוּז','nameEn':'Tzom Tammuz','isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-07-14','type':'minor','nameHe':'יוֹם ז׳בוטינסקי','nameEn':'Jabotinsky Day','isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-07-22','type':'eve','nameHe':'עֶרֶב תִּשְׁעָה בְּאָב','nameEn':"Erev Tish'a B'Av",'isWorking':true,'isHalfDay':true,'eveOf':"Tish'a B'Av"},{'date':'2026-07-23','type':'fast','nameHe':'תִּשְׁעָה בְּאָב','nameEn':"Tish'a B'Av",'isWorking':false,'isHalfDay':false,'eveOf':null},{'date':'2026-07-29','type':'minor','nameHe':'טוּ בְּאָב','nameEn':"Tu B'Av",'isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-08-14','type':'minor','nameHe':'רֹאשׁ הַשָּׁנָה לְמַעְשַׂר בְּהֵמָה','nameEn':'Rosh Hashana LaBehemot','isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-09-05','type':'minor','nameHe':'סליחות','nameEn':'Leil Selichot','isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-09-11','type':'eve','nameHe':'עֶרֶב רֹאשׁ הַשָּׁנָה','nameEn':'Erev Rosh Hashana','isWorking':true,'isHalfDay':true,'eveOf':'Rosh Hashana'},{'date':'2026-09-12','type':'holiday','nameHe':'רֹאשׁ הַשָּׁנָה 5787','nameEn':'Rosh Hashana 5787','isWorking':false,'isHalfDay':false,'eveOf':null},{'date':'2026-09-13','type':'holiday','nameHe':'רֹאשׁ הַשָּׁנָה ב׳','nameEn':'Rosh Hashana II','isWorking':false,'isHalfDay':false,'eveOf':null},{'date':'2026-09-14','type':'minor','nameHe':'צוֹם גְּדַלְיָה','nameEn':'Tzom Gedaliah','isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-09-20','type':'eve','nameHe':'עֶרֶב יוֹם כִּפּוּר','nameEn':'Erev Yom Kippur','isWorking':true,'isHalfDay':true,'eveOf':'Yom Kippur'},{'date':'2026-09-21','type':'fast','nameHe':'יוֹם כִּפּוּר','nameEn':'Yom Kippur','isWorking':false,'isHalfDay':false,'eveOf':null},{'date':'2026-09-25','type':'eve','nameHe':'עֶרֶב סוּכּוֹת','nameEn':'Erev Sukkot','isWorking':true,'isHalfDay':true,'eveOf':'Sukkot'},{'date':'2026-09-26','type':'holiday','nameHe':'סוּכּוֹת א׳','nameEn':'Sukkot I','isWorking':false,'isHalfDay':false,'eveOf':null},{'date':'2026-09-27','type':'cholhamoed','nameHe':'סוּכּוֹת ב׳ (חוה״מ)','nameEn':"Sukkot II (CH''M)",'isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-09-28','type':'cholhamoed','nameHe':'סוּכּוֹת ג׳ (חוה״מ)','nameEn':"Sukkot III (CH''M)",'isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-09-29','type':'cholhamoed','nameHe':'סוּכּוֹת ד׳ (חוה״מ)','nameEn':"Sukkot IV (CH''M)",'isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-09-30','type':'cholhamoed','nameHe':'סוּכּוֹת ה׳ (חוה״מ)','nameEn':"Sukkot V (CH''M)",'isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-10-01','type':'cholhamoed','nameHe':'סוּכּוֹת ו׳ (חוה״מ)','nameEn':"Sukkot VI (CH''M)",'isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-10-02','type':'cholhamoed','nameHe':'סוּכּוֹת ז׳ (הוֹשַׁעְנָא רַבָּה)','nameEn':'Sukkot VII (Hoshana Raba)','isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-10-03','type':'holiday','nameHe':'שְׁמִינִי עֲצֶרֶת','nameEn':'Shmini Atzeret','isWorking':false,'isHalfDay':false,'eveOf':null},{'date':'2026-10-18','type':'minor','nameHe':'שְׁמִירָת בֵּית הַסֵפֶר לְיוֹם הַעֲלִיָּה','nameEn':'Yom HaAliyah School Observance','isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-10-22','type':'minor','nameHe':'יוֹם הַזִּכָּרוֹן ליצחק רבין','nameEn':'Yitzhak Rabin Memorial Day','isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-11-09','type':'minor','nameHe':'סיגד','nameEn':'Sigd','isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-11-16','type':'minor','nameHe':'יוֹם בן־גוריון','nameEn':'Ben-Gurion Day','isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-12-04','type':'modern','nameHe':'חֲנוּכָּה: א׳ נֵר','nameEn':'Chanukah: 1 Candle','isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-12-05','type':'modern','nameHe':'חֲנוּכָּה: ב׳ נֵרוֹת','nameEn':'Chanukah: 2 Candles','isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-12-06','type':'modern','nameHe':'חֲנוּכָּה: ג׳ נֵרוֹת','nameEn':'Chanukah: 3 Candles','isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-12-07','type':'modern','nameHe':'חֲנוּכָּה: ד׳ נֵרוֹת','nameEn':'Chanukah: 4 Candles','isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-12-08','type':'modern','nameHe':'חֲנוּכָּה: ה׳ נֵרוֹת','nameEn':'Chanukah: 5 Candles','isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-12-09','type':'modern','nameHe':'חֲנוּכָּה: ו׳ נֵרוֹת','nameEn':'Chanukah: 6 Candles','isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-12-10','type':'minor','nameHe':'חַג הַבָּנוֹת','nameEn':'Chag HaBanot','isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-12-10','type':'modern','nameHe':'חֲנוּכָּה: ז׳ נֵרוֹת','nameEn':'Chanukah: 7 Candles','isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-12-11','type':'modern','nameHe':'חֲנוּכָּה: ח׳ נֵרוֹת','nameEn':'Chanukah: 8 Candles','isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-12-12','type':'minor','nameHe':'חֲנוּכָּה: יוֹם ח׳','nameEn':'Chanukah: 8th Day','isWorking':true,'isHalfDay':false,'eveOf':null},{'date':'2026-12-20','type':'minor','nameHe':'עֲשָׂרָה בְּטֵבֵת','nameEn':"Asara B'Tevet",'isWorking':true,'isHalfDay':false,'eveOf':null}];

  // ─── Helpers ───────────────────────────────────────────────

  /**
   * Pure: merge per-year holiday arrays into one Map<dateStr, Holiday>.
   * Conflict rule: closed-day (`isWorking: false`) wins over half-day eve;
   * half-day eve wins over open. Mirrors `functions/shared/calendar.js`
   * `buildHolidaysMap` logic. Exported for unit tests.
   *
   * @param {Array<Array<Object>>} yearArrays
   * @returns {Map<string, Object>}
   */
  function _mergeHolidaysArraysToMap(yearArrays) {
    const map = new Map();
    for (const arr of yearArrays || []) {
      if (!Array.isArray(arr)) {
        continue;
      }
      for (const h of arr) {
        if (!h || typeof h.date !== 'string') {
          continue;
        }
        const existing = map.get(h.date);
        if (!existing) {
          map.set(h.date, h);
          continue;
        }
        // Closed beats eve beats open
        if (!h.isWorking && existing.isWorking) {
          map.set(h.date, h);
        } else if (h.isHalfDay && existing.isWorking && !existing.isHalfDay) {
          map.set(h.date, h);
        }
      }
    }
    return map;
  }

  function _engageFallback(reason) {
    if (window.WORK_HOURS_HOLIDAYS_FALLBACK_USED) {
      return;
    }
    window.WORK_HOURS_HOLIDAYS_FALLBACK_USED = true;
    const map = _mergeHolidaysArraysToMap([EMBEDDED_FALLBACK_2026]);
    window.WORK_HOURS_HOLIDAYS_MAP = map;
    console.warn('[holidays-cache] engaged embedded fallback:', reason);
    if (_resolveReady) {
      _resolveReady();
      _resolveReady = null;
    }
  }

  function _rebuildMap() {
    const arrays = Array.from(_holidaysByYear.values());
    const map = _mergeHolidaysArraysToMap(arrays);
    window.WORK_HOURS_HOLIDAYS_MAP = map;
    window.WORK_HOURS_HOLIDAYS_FALLBACK_USED = false; // real data overrides fallback
    if (_resolveReady) {
      _resolveReady();
      _resolveReady = null;
    }
    // PR-G.3.2 (R2 mitigation): notify consumers so they can re-render with
    // the fresh holiday data. Fires on every snapshot update (admin edits etc).
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new Event('holidays:loaded'));
    }
  }

  // ─── Init ──────────────────────────────────────────────────

  function _init() {
    if (typeof window.firebase === 'undefined' || !window.firebase.apps || window.firebase.apps.length === 0) {
      // firebase not ready yet — retry in 100ms (firebase.initializeApp() is
      // an inline <script> later in HTML; this script may execute before init)
      setTimeout(_init, 100);
      return;
    }

    const db = window.firebase.firestore();
    const currentYear = new Date().getFullYear();
    const targetYears = YEAR_WINDOW.map((delta) => currentYear + delta);

    console.log('[holidays-cache] subscribing to years:', targetYears);

    for (const year of targetYears) {
      try {
        const unsub = db.collection(COLLECTION).doc(String(year)).onSnapshot(
          (snap) => {
            if (!snap.exists) {
              console.warn('[holidays-cache] system_holidays/' + year + ' missing');
              return;
            }
            const data = snap.data() || {};
            const holidays = Array.isArray(data.holidays) ? data.holidays : [];
            _holidaysByYear.set(year, holidays);
            _yearsLoaded.add(year);
            _rebuildMap();
            console.log('[holidays-cache] loaded ' + year + ' (' + holidays.length + ' entries)');
          },
          (err) => {
            console.error('[holidays-cache] subscribe error year ' + year + ':', err.message);
          }
        );
        _unsubs.push(unsub);
      } catch (err) {
        console.error('[holidays-cache] subscribe failed year ' + year + ':', err.message);
      }
    }

    // R2 mitigation: if no snapshot arrived within timeout, engage fallback.
    setTimeout(() => {
      if (_yearsLoaded.size === 0) {
        _engageFallback('first-load timeout (' + FIRST_LOAD_TIMEOUT_MS + 'ms) — Firestore unreachable?');
      }
      // PR-G.3.2 (R9 mitigation): next-year may be missing if cron hasn't
      // seeded it yet (rare — current+1 should always exist). Warn so ops
      // sees the issue in dev console.
      const nextYear = new Date().getFullYear() + 1;
      if (!_yearsLoaded.has(nextYear)) {
        console.warn('[holidays-cache] system_holidays/' + nextYear + ' not loaded after ' + FIRST_LOAD_TIMEOUT_MS + 'ms — cron may need re-seed for next-year boundary safety');
      }
    }, FIRST_LOAD_TIMEOUT_MS);
  }

  /**
   * Manual refresh — useful for tests + post-admin-edit + year-rollover.
   * Tears down existing listeners and re-subscribes.
   */
  window.WORK_HOURS_HOLIDAYS_REFRESH = function () {
    for (const unsub of _unsubs) {
      try {
 unsub();
} catch (e) { /* ignore */ }
    }
    _unsubs = [];
    _yearsLoaded = new Set();
    _holidaysByYear.clear();
    window.WORK_HOURS_HOLIDAYS_MAP = new Map();
    window.WORK_HOURS_HOLIDAYS_FALLBACK_USED = false;
    window.WORK_HOURS_HOLIDAYS_READY = new Promise((resolve) => {
      _resolveReady = resolve;
    });
    _init();
  };

  // Expose internals for testing
  window.WORK_HOURS_HOLIDAYS_CACHE = Object.freeze({
    _test: {
      mergeHolidaysArraysToMap: _mergeHolidaysArraysToMap,
      EMBEDDED_FALLBACK_2026: EMBEDDED_FALLBACK_2026,
      // PR-G.3.2 (R8 mitigation): vitest fixture injection — tests set a
      // synthetic holidays map without needing Firestore mocks. Resolves the
      // ready Promise so consumers awaiting it can proceed.
      setMap: function (map) {
        if (!(map instanceof Map)) {
          throw new Error('setMap requires a Map instance');
        }
        window.WORK_HOURS_HOLIDAYS_MAP = map;
        window.WORK_HOURS_HOLIDAYS_FALLBACK_USED = false;
        if (_resolveReady) {
          _resolveReady();
          _resolveReady = null;
        }
        if (typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(new Event('holidays:loaded'));
        }
      }
    }
  });

  // Boot
  _init();
})();
