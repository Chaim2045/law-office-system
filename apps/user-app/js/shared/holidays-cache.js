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
  // PR-G.3.6 (2026-05-24): wait window for `firebase.auth()` to resolve to a
  // non-null user before engaging embedded fallback. Chosen at 6000ms because
  // SESSION persistence restores from IndexedDB (local), typically <500ms.
  // If `onAuthStateChanged` hasn't produced a user by 6s, the user is on the
  // login screen (no consumer of holidays there) or auth is broken — fallback
  // is the right answer.
  const AUTH_WAIT_TIMEOUT_MS = 6000;
  // Cap on firebase-init polling to prevent infinite retry on broken init.
  const MAX_BOOT_POLL_ATTEMPTS = 50;   // 5s total at 100ms intervals

  // ─── State (private) ───────────────────────────────────────
  let _resolveReady = null;
  let _unsubs = [];
  let _yearsLoaded = new Set();
  const _holidaysByYear = new Map(); // year → holidays[]
  // PR-G.3.6: auth-gating state
  let _authUnsub = null;                // captured onAuthStateChanged unsub
  let _fallbackTimer = null;            // safety-net timer for auth timeout
  let _lastUserUid = null;              // skip same-user re-emits (defense)

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
   * Conflict rule (auto-only merge): closed-day (`isWorking: false`) wins
   * over half-day eve; half-day eve wins over open. Mirrors
   * `functions/shared/calendar.js` `buildHolidaysMap` logic.
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

  /**
   * PR-G.3.3: merge `holidaysAuto + holidaysOverrides` per-year per the new
   * schema. Overrides win by date. `_suppress: true` removes the matching
   * auto entry (admin can cancel a Hebcal-determined holiday).
   *
   * Backward compat: if `holidaysAuto` missing, falls back to `data.holidays`
   * (PR-G.3.1 shape). Kept for one deploy cycle; removed in G.3.5 cleanup.
   *
   * @param {Array<{holidaysAuto?: Array, holidaysOverrides?: Array, holidays?: Array}>} yearDocs
   * @returns {Map<string, Object>}
   */
  function _mergeAutoAndOverrides(yearDocs) {
    // 1. Collect auto entries from all years
    const autoArrays = [];
    const overrideArrays = [];
    for (const data of yearDocs || []) {
      if (!data) {
        continue;
      }
      const auto = Array.isArray(data.holidaysAuto)
        ? data.holidaysAuto
        : (Array.isArray(data.holidays) ? data.holidays : []);  // BC fallback
      autoArrays.push(auto);
      if (Array.isArray(data.holidaysOverrides)) {
        overrideArrays.push(data.holidaysOverrides);
      }
    }

    // 2. Build auto map via existing logic
    const map = _mergeHolidaysArraysToMap(autoArrays);

    // 3. Apply overrides: override wins by date; `_suppress: true` removes
    for (const overrides of overrideArrays) {
      for (const o of overrides) {
        if (!o || typeof o.date !== 'string') {
          continue;
        }
        if (o._suppress === true) {
          map.delete(o.date);
          continue;
        }
        if (!o._overrideMeta) {
          console.warn('[holidays-cache] override missing _overrideMeta:', o.date, '— still applied');
        }
        map.set(o.date, o);
      }
    }

    return map;
  }

  function _engageFallback(reason) {
    if (window.WORK_HOURS_HOLIDAYS_FALLBACK_USED) {
      return;
    }
    window.WORK_HOURS_HOLIDAYS_FALLBACK_USED = true;
    // PR-G.3.3: route through the new merger for consistency (no overrides
    // available offline — only auto fallback). The merger handles single-array.
    const map = _mergeAutoAndOverrides([{ holidaysAuto: EMBEDDED_FALLBACK_2026 }]);
    window.WORK_HOURS_HOLIDAYS_MAP = map;
    console.warn('[holidays-cache] engaged embedded fallback:', reason);
    if (_resolveReady) {
      _resolveReady();
      _resolveReady = null;
    }
  }

  function _rebuildMap() {
    // PR-G.3.3: pass full year docs (with both holidaysAuto + holidaysOverrides)
    // to the new merge. Each entry in `_holidaysByYear` is now the full doc
    // data object, not just an array. See `_init()` snapshot handler.
    const docs = Array.from(_holidaysByYear.values());
    const map = _mergeAutoAndOverrides(docs);
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
            // PR-G.3.3: store FULL doc (both holidaysAuto + holidaysOverrides
            // + BC fallback `holidays`). Merge logic in `_mergeAutoAndOverrides`.
            _holidaysByYear.set(year, data);
            _yearsLoaded.add(year);
            _rebuildMap();
            const autoCount = Array.isArray(data.holidaysAuto)
              ? data.holidaysAuto.length
              : (Array.isArray(data.holidays) ? data.holidays.length : 0);
            const ovCount = Array.isArray(data.holidaysOverrides) ? data.holidaysOverrides.length : 0;
            console.log('[holidays-cache] loaded ' + year + ' (auto=' + autoCount + ', overrides=' + ovCount + ')');
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
      mergeAutoAndOverrides: _mergeAutoAndOverrides,  // PR-G.3.3
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

  // ─── PR-G.3.6 helpers (auth-gated boot) ─────────────────────

  /**
   * Reset the `WORK_HOURS_HOLIDAYS_READY` promise so consumers that await it
   * AFTER logout get a fresh promise that will resolve on next login. Without
   * this, the original promise stays resolved with whatever state it had at
   * resolution time — silently misleading new awaiters.
   */
  function _resetReadyPromise() {
    window.WORK_HOURS_HOLIDAYS_READY = new Promise(function (resolve) {
      _resolveReady = resolve;
    });
  }

  /**
   * Tear down all active Firestore subscriptions and clear loaded-years
   * tracking. Safe to call repeatedly. Swallowed errors per existing pattern.
   */
  function _tearDownSubs() {
    for (const u of _unsubs) {
      try {
 u();
} catch (_e) { /* ignore */ }
    }
    _unsubs = [];
    _yearsLoaded = new Set();
  }

  /**
   * PR-G.3.6 boot: defer Firestore subscription until `firebase.auth()`
   * resolves to a non-null user. Rules require `isAuthenticated()` → if we
   * subscribe pre-auth, `onSnapshot` silently fails with permission-denied
   * and the 5s timeout engages embedded fallback (bug fixed by this PR).
   *
   * Behavior:
   * - Polls for firebase init (max 5s); engages fallback on timeout.
   * - Subscribes to `onAuthStateChanged` once; captures unsub to prevent leak.
   * - On user resolve: clears prior subs, resets state, calls `_init()`.
   * - On user null (logout / pre-auth): tears down subs, resets ready promise.
   * - On same-user re-emit (defense vs token-refresh): no-op.
   * - Safety net: if no user within `AUTH_WAIT_TIMEOUT_MS`, engages fallback
   *   (real data still wins later via `_rebuildMap` → FALLBACK_USED=false).
   */
  function _bootWhenAuthReady(attempts) {
    attempts = attempts || 0;
    if (typeof window.firebase === 'undefined' ||
        !window.firebase.apps ||
        window.firebase.apps.length === 0) {
      if (attempts >= MAX_BOOT_POLL_ATTEMPTS) {
        console.error('[holidays-cache] firebase never initialized after ' +
          (MAX_BOOT_POLL_ATTEMPTS * 100) + 'ms');
        _engageFallback('firebase init timeout');
        return;
      }
      setTimeout(function () {
 _bootWhenAuthReady(attempts + 1);
}, 100);
      return;
    }

    let auth;
    try {
      auth = window.firebase.auth();
    } catch (err) {
      console.error('[holidays-cache] firebase.auth() threw:', err.message);
      _engageFallback('auth() unavailable');
      return;
    }

    // Capture unsub to prevent listener leak (reviewer BLOCKER #2).
    _authUnsub = auth.onAuthStateChanged(function (user) {
      if (user) {
        // Defense vs same-user re-emit (token refresh, etc) — reviewer MINOR.
        if (user.uid === _lastUserUid && _unsubs.length > 0) {
          return;
        }
        _lastUserUid = user.uid;

        // Cancel pending fallback timer so it can't fire after auth resolved
        // (reviewer MAJOR #4 — prevents double-source on slow auth).
        if (_fallbackTimer) {
          clearTimeout(_fallbackTimer);
          _fallbackTimer = null;
        }

        // Tear down any prior subs (different user / fresh boot).
        _tearDownSubs();
        _holidaysByYear.clear();

        // Reset READY promise if it was already resolved (e.g. fallback fired
        // first). New consumers awaiting fresh data get a fresh promise.
        if (!_resolveReady) {
          _resetReadyPromise();
        }

        _init();
      } else {
        // Logout / pre-auth: tear down + reset state. Prevents
        // permission-denied console spam on logged-in→logged-out transition.
        _tearDownSubs();
        _lastUserUid = null;
        _holidaysByYear.clear();
        _resetReadyPromise();  // reviewer BLOCKER #1
      }
    });

    // Safety net: if auth never resolves with a user, engage fallback.
    _fallbackTimer = setTimeout(function () {
      if (_yearsLoaded.size === 0 && !window.WORK_HOURS_HOLIDAYS_FALLBACK_USED) {
        _engageFallback('auth not resolved with user within ' +
          AUTH_WAIT_TIMEOUT_MS + 'ms');
      }
      _fallbackTimer = null;
    }, AUTH_WAIT_TIMEOUT_MS);
  }

  // Boot — PR-G.3.6: auth-gated. See `_bootWhenAuthReady` JSDoc.
  _bootWhenAuthReady();
})();
