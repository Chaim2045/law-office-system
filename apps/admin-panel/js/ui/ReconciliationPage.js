/**
 * Hours Reconciliation Control (OWN-3 — "סנכרון שעות")
 * ====================================================
 * Admin-only control page for the package/service hours reconciliation loop
 * (#401 backend, already merged). It lets an admin:
 *   - SEE the current reconciliation mode (off / dry_run / enforce).
 *   - FLIP the mode: off / dry_run immediately; enforce behind a typed-confirm.
 *   - RUN the loop on demand (`runReconciliationNow`) + see the result counters.
 *   - REVIEW recent PACKAGE_RECONCILE_RUN audit docs (client-side sorted desc).
 *   - INSPECT the latest run's deferred block-flips (id/before/after only).
 * This is the UI through which dry_run→enforce is promoted instead of the
 * Firebase console.
 *
 * ─── Mirrors the gold-standard ProfitabilityPage / EmployeeCostsPage ─────────
 *  - `window.ReconciliationPage = { init(sectionId), teardown() }` (IIFE, strict)
 *  - Fail-CLOSED admin render gate (the HTML shell checks role==='admin' BEFORE
 *    init; this module is defensive but renders nothing sensitive on its own).
 *  - `_escapeHtml` on EVERY interpolated value (routed to window.escapeHtml SSOT).
 *  - Hebrew error-by-code (`_errorMessage`) for every callable failure — never a
 *    raw FirebaseError / English / stack.
 *  - ModalManager for the enforce typed-confirm dialog (no inline modal).
 *  - ON-DEMAND reads only — NO onSnapshot. `teardown()` clears the in-flight flag.
 *
 * ─── Backend contract (#401, LIVE — do not change) ───────────────────────────
 *  setReconciliationMode({ mode, confirmToken }) →
 *    { success:true, mode, previousMode, auditDocId }.
 *    mode ∈ {'off','dry_run','enforce'}. Flipping to 'enforce' REQUIRES
 *    confirmToken === 'enforce' (the LITERAL string 'enforce', NOT the Hebrew
 *    word — the typed Hebrew "תיקון" only gates the UI button). Admin-only.
 *  runReconciliationNow() → { success:true, ...counters }.
 *  Reads (direct admin client-SDK, mirrors how ProfitabilityPage reads):
 *    - current mode: system_settings/package_reconciliation.mode
 *      (missing doc → 'off', fail-safe default).
 *    - recent runs: audit_log where action=='PACKAGE_RECONCILE_RUN' — NO
 *      .orderBy(), NO composite index; fetched then SORTED CLIENT-SIDE desc.
 */

(function () {
  'use strict';

  const SETTINGS_COLLECTION = 'system_settings';
  const SETTINGS_DOC = 'package_reconciliation';
  const AUDIT_COLLECTION = 'audit_log';
  const RUN_ACTION = 'PACKAGE_RECONCILE_RUN';
  const RUNS_LIMIT = 20; // how many recent run docs to fetch (few exist)

  // The literal token the backend requires to flip to enforce. The admin types
  // the Hebrew "תיקון" only to UNLOCK the button — this is what we actually send.
  const ENFORCE_CONFIRM_TOKEN = 'enforce';
  // The Hebrew word the admin must TYPE to unlock the enforce button.
  const ENFORCE_TYPED_WORD = 'תיקון';

  const ReconciliationPage = {
    container: null,
    mode: 'off', // current mode (fail-safe default until the read resolves)
    runs: [], // recent PACKAGE_RECONCILE_RUN docs (sorted desc)
    lastResult: null, // counters from the most recent on-demand run (this session)
    flipping: false, // a setReconciliationMode call is in flight
    running: false, // a runReconciliationNow call is in flight
    loadError: false,

    /**
     * Entry point — called AFTER auth + the explicit admin role gate pass
     * (the HTML shell guarantees role==='admin' before calling this). Reads the
     * current mode + the recent runs once, then renders. NO live listener.
     */
    init: function (sectionId) {
      const self = this;
      this.container = document.getElementById(sectionId);
      if (!this.container) {
        console.error('ReconciliationPage: container not found:', sectionId);
        return;
      }

      this._renderLoading();

      this._loadAll()
        .then(function () {
          self.render();
        })
        .catch(function (err) {
          // errorCode only — never the underlying data.
          console.error('❌ [Reconciliation] initial load failed:', err && err.code);
          self.loadError = true;
          self._renderLoadError();
        });
    },

    /** Tear down — no live listener to drop; clear the in-flight flags. */
    teardown: function () {
      this.flipping = false;
      this.running = false;
    },

    // ═══════════════════════════════════════════
    // Data — on-demand reads (mode flag + recent runs)
    // ═══════════════════════════════════════════

    _loadAll: function () {
      const self = this;
      return Promise.all([this._loadMode(), this._loadRuns()]).then(function (res) {
        self.mode = res[0];
        self.runs = res[1];
      });
    },

    /**
     * Read the current mode from system_settings/package_reconciliation.
     * Missing doc / missing field → 'off' (the fail-safe default — the backend
     * treats a missing flag as off). An invalid stored value also degrades to
     * 'off' so the UI never shows a mode the switch can't represent.
     */
    _loadMode: function () {
      const db = window.firebaseDB;
      if (!db) {
        return Promise.reject({ code: 'no-db' });
      }
      const F = window.ReconciliationFormat;
      return db.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC).get().then(function (snap) {
        if (!snap.exists) {
          return 'off';
        }
        const data = snap.data() || {};
        const mode = data.mode;
        return (F && F.isValidMode(mode)) ? mode : 'off';
      });
    },

    /**
     * Read recent PACKAGE_RECONCILE_RUN docs. ⚠️ NO .orderBy() + NO composite
     * index — fetch the matching docs (there are few) and sort client-side desc.
     */
    _loadRuns: function () {
      const db = window.firebaseDB;
      if (!db) {
        return Promise.reject({ code: 'no-db' });
      }
      const F = window.ReconciliationFormat;
      return db.collection(AUDIT_COLLECTION)
        .where('action', '==', RUN_ACTION)
        .limit(RUNS_LIMIT)
        .get()
        .then(function (snap) {
          const docs = [];
          snap.forEach(function (doc) {
            const d = doc.data() || {};
            docs.push({
              id: doc.id,
              userId: d.userId || '',
              username: d.username || '',
              timestamp: d.timestamp || null,
              details: d.details || {}
            });
          });
          return F ? F.sortRunsDesc(docs) : docs;
        });
    },

    /** Re-read mode + runs after a mutation, then repaint. */
    _refresh: function () {
      const self = this;
      return this._loadAll()
        .then(function () {
          self.render();
        })
        .catch(function (err) {
          console.error('❌ [Reconciliation] refresh failed:', err && err.code);
          // Keep the page usable; surface a non-fatal toast.
          self._toast('error', 'שגיאה ברענון הנתונים. נסה לרענן את הדף.');
        });
    },

    // ═══════════════════════════════════════════
    // Render
    // ═══════════════════════════════════════════

    _renderLoading: function () {
      this.container.innerHTML =
        '<div class="rc-page"><div class="rc-state" role="status" aria-live="polite">' +
        '<div class="rc-spinner" aria-hidden="true"></div><p>טוען נתוני סנכרון...</p>' +
        '</div></div>';
    },

    _renderLoadError: function () {
      this.container.innerHTML =
        '<div class="rc-page"><div class="rc-load-error" role="alert">' +
        '<i class="fas fa-exclamation-triangle" aria-hidden="true"></i>' +
        '<h1>שגיאה בטעינת נתונים</h1>' +
        '<p>לא ניתן לטעון את נתוני הסנכרון כעת. בדוק את החיבור לאינטרנט ונסה שוב.</p>' +
        '<button type="button" class="rc-btn rc-btn--secondary" onclick="window.location.reload()" aria-label="רענון הדף">רענון הדף</button>' +
        '</div></div>';
    },

    render: function () {
      this.container.innerHTML =
        '<div class="rc-page">' +
        '  <header class="rc-header">' +
        '    <h1><i class="fas fa-scale-balanced" aria-hidden="true"></i> סנכרון שעות</h1>' +
        '    <p class="rc-subtitle">בקרת לולאת סנכרון השעות (חבילות → שירות → לקוח). שינוי המצב והרצה ידנית — למנהלי מערכת בלבד.</p>' +
        '  </header>' +
        this._enforceBanner() +
        this._modePanel() +
        this._runPanel() +
        this._runsPanel() +
        this._deferralsPanel() +
        '</div>';

      this._bindEvents();
    },

    /** Persistent warning banner — shown ONLY when the live mode is enforce. */
    _enforceBanner: function () {
      if (this.mode !== 'enforce') {
        return '';
      }
      return '<div class="rc-banner rc-banner--enforce" role="alert">' +
        '<i class="fas fa-triangle-exclamation" aria-hidden="true"></i>' +
        '<span>המצב: תיקון — כל הרצה כותבת לפרודקשן.</span>' +
        '</div>';
    },

    /** The 3-way mode switch + the always-visible kill-switch. */
    _modePanel: function () {
      const F = window.ReconciliationFormat;
      const self = this;
      const current = this.mode;
      const modes = [
        { value: 'off', icon: 'fa-power-off', desc: 'כבוי — הלולאה אינה רצה כלל.' },
        { value: 'dry_run', icon: 'fa-eye', desc: 'צפייה — מזהה ומדווח, ללא כתיבה לפרודקשן.' },
        { value: 'enforce', icon: 'fa-wrench', desc: 'תיקון — מתקן בפועל וכותב לפרודקשן.' }
      ];

      const cards = modes.map(function (m) {
        const active = current === m.value;
        const busy = self.flipping;
        return '' +
          '<button type="button" class="rc-mode-card' + (active ? ' rc-mode-card--active' : '') +
          ' rc-mode-card--' + self._escapeHtml(m.value) + '"' +
          ' data-action="set-mode" data-mode="' + self._escapeHtml(m.value) + '"' +
          (busy ? ' disabled' : '') +
          ' aria-pressed="' + (active ? 'true' : 'false') + '"' +
          ' aria-label="' + self._escapeHtml('בחר מצב ' + F.modeLabel(m.value)) + '">' +
          '  <i class="fas ' + self._escapeHtml(m.icon) + '" aria-hidden="true"></i>' +
          '  <span class="rc-mode-card-title">' + self._escapeHtml(F.modeLabelShort(m.value)) + '</span>' +
          '  <span class="rc-mode-card-desc">' + self._escapeHtml(m.desc) + '</span>' +
          (active ? '<span class="rc-mode-card-badge">המצב הנוכחי</span>' : '') +
          '</button>';
      }).join('');

      return '<section class="rc-panel" aria-labelledby="rc-mode-h">' +
        '  <div class="rc-panel-head">' +
        '    <h2 id="rc-mode-h">מצב הסנכרון</h2>' +
        '    <span class="rc-current-mode rc-current-mode--' + this._escapeHtml(current) + '">' +
        '      <span class="rc-current-mode-dot" aria-hidden="true"></span>' +
        this._escapeHtml('מצב נוכחי: ' + F.modeLabel(current)) +
        '    </span>' +
        '  </div>' +
        '  <div class="rc-mode-grid">' + cards + '</div>' +
        '  <div class="rc-killswitch">' +
        '    <button type="button" class="rc-btn rc-btn--danger" data-action="kill"' +
        (this.flipping ? ' disabled' : '') +
        (current === 'off' ? ' disabled' : '') +
        ' aria-label="כבה את הסנכרון מיידית">' +
        '      <i class="fas fa-power-off" aria-hidden="true"></i> כבה (off)' +
        '    </button>' +
        '    <span class="rc-killswitch-hint">כיבוי מיידי — אינו דורש אישור מוקלד. רק הפעלת "תיקון" דורשת אישור.</span>' +
        '  </div>' +
        '</section>';
    },

    /** "הרץ עכשיו" + the counters from the most recent on-demand run. */
    _runPanel: function () {
      const busy = this.running;
      return '<section class="rc-panel" aria-labelledby="rc-run-h">' +
        '  <div class="rc-panel-head"><h2 id="rc-run-h">הרצה ידנית</h2></div>' +
        '  <p class="rc-panel-note">ההרצה מתבצעת לפי המצב הנוכחי: כבוי — לא עושה דבר; צפייה — מדווח בלבד; תיקון — כותב לפרודקשן.</p>' +
        '  <button type="button" class="rc-btn rc-btn--primary" data-action="run-now"' +
        (busy ? ' disabled' : '') + ' aria-label="הרץ סנכרון עכשיו">' +
        (busy
          ? '<span class="rc-spinner rc-spinner--inline" aria-hidden="true"></span> מריץ...'
          : '<i class="fas fa-play" aria-hidden="true"></i> הרץ עכשיו') +
        '  </button>' +
        this._lastResultBlock() +
        '</section>';
    },

    /** The result counters of the LAST on-demand run in this session (if any). */
    _lastResultBlock: function () {
      const r = this.lastResult;
      if (!r) {
        return '';
      }
      const F = window.ReconciliationFormat;
      const row = F.formatRunRow(r);
      const self = this;
      const items = [
        ['מצב', F.modeLabel(r.mode)],
        ['לקוחות שנסרקו', row.clientsScanned],
        ['שירותים שנסרקו', row.servicesScanned],
        ['מועמדים לתיקון', row.wouldRepair],
        ['תוקנו', row.repaired],
        ['נכשלו', row.failed],
        ['כשלי אינוריאנט', row.invariantFailures],
        ['נדחו (חסימה)', row.blockFlipsDeferred],
        ['שינוי שעות נטו', row.netHoursDelta]
      ];
      const dts = items.map(function (it) {
        return '<div class="rc-result-item"><dt>' + self._escapeHtml(it[0]) + '</dt>' +
          '<dd dir="ltr">' + self._escapeHtml(it[1]) + '</dd></div>';
      }).join('');
      return '<div class="rc-result rc-result--' + this._escapeHtml(row.level) + '" role="status" aria-live="polite">' +
        '<div class="rc-result-head"><i class="fas fa-circle-check" aria-hidden="true"></i> תוצאת ההרצה האחרונה' +
        ' <span class="rc-badge rc-level-' + this._escapeHtml(row.level) + '">' + this._escapeHtml(row.levelLabel) + '</span></div>' +
        '<dl class="rc-result-grid">' + dts + '</dl>' +
        '</div>';
    },

    /** The runs table — recent PACKAGE_RECONCILE_RUN docs, sorted desc. */
    _runsPanel: function () {
      return '<section class="rc-panel" aria-labelledby="rc-runs-h">' +
        '  <div class="rc-panel-head"><h2 id="rc-runs-h">הרצות אחרונות</h2></div>' +
        '  <div class="rc-list-wrap">' +
        '    <table class="rc-table">' +
        '      <thead><tr>' +
        '        <th scope="col">זמן</th>' +
        '        <th scope="col">מצב</th>' +
        '        <th scope="col">לקוחות</th>' +
        '        <th scope="col">שירותים</th>' +
        '        <th scope="col">מועמדים</th>' +
        '        <th scope="col">תוקנו</th>' +
        '        <th scope="col">נכשלו</th>' +
        '        <th scope="col">כשלי אינוריאנט</th>' +
        '        <th scope="col">נדחו</th>' +
        '        <th scope="col">שעות נטו</th>' +
        '        <th scope="col">סטטוס</th>' +
        '      </tr></thead>' +
        '      <tbody>' + this._renderRunRows() + '</tbody>' +
        '    </table>' +
        '  </div>' +
        '</section>';
    },

    _renderRunRows: function () {
      const self = this;
      const F = window.ReconciliationFormat;
      if (!this.runs || this.runs.length === 0) {
        return '<tr class="rc-empty-row"><td colspan="11"><div class="rc-empty">' +
          '<i class="fas fa-clock-rotate-left" aria-hidden="true"></i>' +
          '<p>אין הרצות להצגה עדיין. ההרצה היומית מתבצעת ב-07:00, או הרץ ידנית.</p>' +
          '</div></td></tr>';
      }
      return this.runs.map(function (run) {
        const row = F.formatRunRow(run.details);
        const when = self._tsToRelative(run.timestamp);
        return '<tr>' +
          '<td class="rc-when">' + self._escapeHtml(when) + '</td>' +
          '<td><span class="rc-mode-pill rc-mode-pill--' + self._escapeHtml(row.mode || 'unknown') + '">' + self._escapeHtml(row.modeLabel) + '</span></td>' +
          '<td class="rc-num" dir="ltr">' + self._escapeHtml(row.clientsScanned) + '</td>' +
          '<td class="rc-num" dir="ltr">' + self._escapeHtml(row.servicesScanned) + '</td>' +
          '<td class="rc-num" dir="ltr">' + self._escapeHtml(row.wouldRepair) + '</td>' +
          '<td class="rc-num" dir="ltr">' + self._escapeHtml(row.repaired) + '</td>' +
          '<td class="rc-num" dir="ltr">' + self._escapeHtml(row.failed) + '</td>' +
          '<td class="rc-num" dir="ltr">' + self._escapeHtml(row.invariantFailures) + '</td>' +
          '<td class="rc-num" dir="ltr">' + self._escapeHtml(row.blockFlipsDeferred) + '</td>' +
          '<td class="rc-num" dir="ltr">' + self._escapeHtml(row.netHoursDelta) + '</td>' +
          '<td><span class="rc-badge rc-level-' + self._escapeHtml(row.level) + '">' + self._escapeHtml(row.levelLabel) + '</span></td>' +
          '</tr>';
      }).join('');
    },

    /** Deferrals panel — the LATEST run's deferred block-flips (non-PII ids). */
    _deferralsPanel: function () {
      const self = this;
      const latest = (this.runs && this.runs.length > 0) ? this.runs[0] : null;
      const details = (latest && latest.details) || {};
      const deferrals = Array.isArray(details.deferrals) ? details.deferrals : [];
      const total = (typeof details.deferralsCount === 'number') ? details.deferralsCount : deferrals.length;

      let body;
      if (deferrals.length === 0) {
        body = '<div class="rc-empty rc-empty--small"><i class="fas fa-circle-check" aria-hidden="true"></i>' +
          '<p>אין דחיות בהרצה האחרונה.</p></div>';
      } else {
        const F = window.ReconciliationFormat;
        const rows = deferrals.map(function (d) {
          const f = F.formatDeferral(d);
          return '<tr>' +
            '<td class="rc-mono" dir="ltr">' + self._escapeHtml(f.clientId) + '</td>' +
            '<td class="rc-mono" dir="ltr">' + self._escapeHtml(f.serviceId) + '</td>' +
            '<td class="rc-num" dir="ltr">' + self._escapeHtml(f.before) + '</td>' +
            '<td class="rc-num" dir="ltr">' + self._escapeHtml(f.after) + '</td>' +
            '</tr>';
        }).join('');
        const more = (total > deferrals.length)
          ? '<p class="rc-panel-note">מוצגות ' + self._escapeHtml(String(deferrals.length)) +
            ' דחיות מתוך ' + self._escapeHtml(String(total)) + '.</p>'
          : '';
        body = '<div class="rc-list-wrap"><table class="rc-table">' +
          '<thead><tr><th scope="col">מזהה לקוח</th><th scope="col">מזהה שירות</th>' +
          '<th scope="col">לפני (שעות)</th><th scope="col">אחרי (שעות)</th></tr></thead>' +
          '<tbody>' + rows + '</tbody></table></div>' + more;
      }

      return '<section class="rc-panel" aria-labelledby="rc-def-h">' +
        '  <div class="rc-panel-head"><h2 id="rc-def-h">דחיות (חסימות שנדחו)</h2></div>' +
        '  <p class="rc-panel-note">תיקונים שהיו גורמים לחסימת לקוח ולכן נדחו לבדיקה ידנית. מזהים בלבד (ללא שמות).</p>' +
        body +
        '</section>';
    },

    // ═══════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════

    _bindEvents: function () {
      const self = this;
      const root = this.container;

      root.querySelectorAll('[data-action="set-mode"]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          self._onSetMode(btn.getAttribute('data-mode'));
        });
      });

      const kill = root.querySelector('[data-action="kill"]');
      if (kill) {
        kill.addEventListener('click', function () {
          self._onSetMode('off');
        });
      }

      const run = root.querySelector('[data-action="run-now"]');
      if (run) {
        run.addEventListener('click', function () {
          self._onRunNow();
        });
      }
    },

    // ═══════════════════════════════════════════
    // Set mode (setReconciliationMode)
    // ═══════════════════════════════════════════

    /**
     * Mode-card / kill-switch handler. off + dry_run flip immediately; enforce
     * routes through the typed-confirm modal. A no-op if already in that mode.
     */
    _onSetMode: function (mode) {
      const F = window.ReconciliationFormat;
      if (this.flipping || !F.isValidMode(mode)) {
        return;
      }
      if (mode === this.mode) {
        return; // already there — nothing to do
      }
      if (mode === 'enforce') {
        this._openEnforceConfirm();
        return;
      }
      this._commitMode(mode, null);
    },

    /**
     * Typed-confirm modal for enforce. The button is disabled until the admin
     * types the Hebrew word "תיקון" exactly. On confirm we send the LITERAL
     * 'enforce' token (the typed Hebrew only gated the UI button).
     */
    _openEnforceConfirm: function () {
      const self = this;
      const modalId = window.ModalManager.create({
        title: 'הפעלת מצב "תיקון"',
        size: 'small',
        content: '' +
          '<div class="rc-confirm">' +
          '  <div class="rc-confirm-warn" role="alert">' +
          '    <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>' +
          '    <p>מצב "תיקון" מפעיל כתיבה חיה לפרודקשן. כל הרצה (ידנית או יומית) תתקן נתונים בפועל.</p>' +
          '  </div>' +
          '  <label class="rc-confirm-label" for="rc-confirm-input">להמשך, הקלד <strong>תיקון</strong>:</label>' +
          '  <input type="text" id="rc-confirm-input" class="rc-input" autocomplete="off" ' +
          '    dir="rtl" aria-describedby="rc-confirm-hint" />' +
          '  <p id="rc-confirm-hint" class="rc-confirm-hint">הכפתור ייפתח רק לאחר הקלדת המילה במדויק.</p>' +
          '</div>',
        footer: '' +
          '<button type="button" class="rc-btn rc-btn--secondary" data-action="rc-cancel" aria-label="ביטול">ביטול</button>' +
          '<button type="button" class="rc-btn rc-btn--danger" data-action="rc-enforce" disabled aria-label="הפעל מצב תיקון">' +
          '<i class="fas fa-wrench" aria-hidden="true"></i> הפעל תיקון</button>',
        onOpen: function () {
          const el = window.ModalManager.getElement(modalId);
          if (!el) {
            return;
          }
          const input = el.querySelector('#rc-confirm-input');
          const confirmBtn = el.querySelector('[data-action="rc-enforce"]');
          const cancelBtn = el.querySelector('[data-action="rc-cancel"]');

          if (input) {
            input.focus();
            input.addEventListener('input', function () {
              const ok = input.value.trim() === ENFORCE_TYPED_WORD;
              if (confirmBtn) {
                confirmBtn.disabled = !ok;
              }
            });
          }
          if (cancelBtn) {
            cancelBtn.addEventListener('click', function () {
              window.ModalManager.close(modalId);
            });
          }
          if (confirmBtn) {
            confirmBtn.addEventListener('click', function () {
              // Re-check the typed word at click-time (defence in depth).
              if (!input || input.value.trim() !== ENFORCE_TYPED_WORD) {
                return;
              }
              window.ModalManager.close(modalId);
              // Send the LITERAL 'enforce' token — the typed Hebrew only unlocked UI.
              self._commitMode('enforce', ENFORCE_CONFIRM_TOKEN);
            });
          }
        }
      });
    },

    /** Actually call setReconciliationMode. confirmToken is null except enforce. */
    _commitMode: function (mode, confirmToken) {
      const self = this;
      const F = window.ReconciliationFormat;
      this.flipping = true;
      // Reflect the busy state immediately (disables the cards/kill-switch).
      this.render();

      const payload = { mode: mode };
      if (confirmToken) {
        payload.confirmToken = confirmToken;
      }

      const fn = window.firebase.functions().httpsCallable('setReconciliationMode');
      fn(payload)
        .then(function (result) {
          self.flipping = false;
          const data = (result && result.data) || {};
          // Trust the server's returned mode as the new truth.
          if (data.mode && F.isValidMode(data.mode)) {
            self.mode = data.mode;
          }
          self._toast('success', 'המצב עודכן ל: ' + F.modeLabel(self.mode) + '.');
          // Re-read to confirm (mode + runs) and repaint.
          self._refresh();
        })
        .catch(function (error) {
          self.flipping = false;
          self.render();
          self._toast('error', self._errorMessage(error));
        });
    },

    // ═══════════════════════════════════════════
    // Run now (runReconciliationNow)
    // ═══════════════════════════════════════════

    _onRunNow: function () {
      const self = this;
      if (this.running) {
        return;
      }
      this.running = true;
      this.render();

      const fn = window.firebase.functions().httpsCallable('runReconciliationNow');
      fn({})
        .then(function (result) {
          self.running = false;
          const data = (result && result.data) || {};
          // The counters come back as { success:true, ...counters }.
          self.lastResult = data;
          self._toast('success', 'ההרצה הסתיימה.');
          // Refresh the runs table (the run wrote a new audit doc) + repaint.
          self._refresh();
        })
        .catch(function (error) {
          self.running = false;
          self.render();
          self._toast('error', self._errorMessage(error));
        });
    },

    // ═══════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════

    /** Firestore-ish timestamp → short relative Hebrew time. null → '—'. */
    _tsToRelative: function (ts) {
      const F = window.ReconciliationFormat;
      // Reuse the format module's normalizer via a tiny local read.
      let ms = 0;
      if (ts && typeof ts.toMillis === 'function') {
        try {
          ms = ts.toMillis();
        } catch (e) {
          ms = 0;
        }
      } else if (ts && typeof ts.toDate === 'function') {
        try {
          ms = ts.toDate().getTime();
        } catch (e) {
          ms = 0;
        }
      } else if (ts && typeof ts.seconds === 'number') {
        ms = ts.seconds * 1000;
      } else if (typeof ts === 'number') {
        ms = ts;
      } else if (ts) {
        ms = new Date(ts).getTime();
      }
      if (!ms || isNaN(ms)) {
        return '—';
      }
      void F; // F intentionally unused here; sort uses it.
      return this._msToRelative(ms);
    },

    _msToRelative: function (ms) {
      const diffMs = Date.now() - ms;
      const min = Math.floor(diffMs / 60000);
      if (min < 1) {
        return 'לפני רגע';
      }
      if (min < 60) {
        return 'לפני ' + min + ' דק׳';
      }
      const hr = Math.floor(min / 60);
      if (hr < 24) {
        return 'לפני ' + hr + ' שע׳';
      }
      const days = Math.floor(hr / 24);
      if (days < 30) {
        return 'לפני ' + days + ' ימים';
      }
      return new Date(ms).toLocaleDateString('he-IL');
    },

    /**
     * Hebrew error message by HttpsError code (mirrors ProfitabilityPage /
     * EmployeeCostsPage). NEVER exposes a raw FirebaseError / English / stack.
     */
    _errorMessage: function (error) {
      const code = error && error.code ? String(error.code) : '';
      switch (code) {
        case 'unauthenticated':
        case 'functions/unauthenticated':
          return 'נדרשת התחברות מחדש למערכת. אנא התחבר ונסה שוב.';
        case 'permission-denied':
        case 'functions/permission-denied':
          return 'רק מנהל מערכת רשאי לבצע פעולה זו.';
        case 'failed-precondition':
        case 'functions/failed-precondition':
          return 'הפעלת מצב "תיקון" דורשת אישור מפורש. אנא נסה שוב והקלד את מילת האישור.';
        case 'invalid-argument':
        case 'functions/invalid-argument':
          return 'המצב שנבחר אינו תקין. נסה שוב.';
        case 'unavailable':
        case 'functions/unavailable':
        case 'deadline-exceeded':
        case 'functions/deadline-exceeded':
          return 'השרת אינו זמין כעת. בדוק את החיבור לאינטרנט ונסה שוב.';
        case 'internal':
        case 'functions/internal':
          return 'אירעה שגיאה בשרת. ייתכן שחלק מהפעולה בוצע — בדוק את טבלת ההרצות. נסה שוב או פנה לתמיכה.';
        default:
          // Backend Hebrew message (the callables return Hebrew HttpsError text)
          // — surface it only if it is actually Hebrew, never a raw English one.
          if (error && error.message && /[֐-׿]/.test(error.message)) {
            return error.message;
          }
          return 'אירעה שגיאה בעת ביצוע הפעולה. אנא נסה שוב או פנה לתמיכה.';
      }
    },

    _toast: function (type, message) {
      // message is a fixed Hebrew string — operational metadata only, no PII.
      if (window.notify && typeof window.notify[type] === 'function') {
        window.notify[type](message);
        return;
      }
      if (window.NotificationsUI) {
        if (type === 'success' && window.NotificationsUI.showSuccess) {
          window.NotificationsUI.showSuccess(message);
          return;
        }
        if (window.NotificationsUI.showError) {
          window.NotificationsUI.showError(message);
          return;
        }
      }
    },

    _escapeHtml: function (str) {
      // Routed to the shared SSOT escaper (js/core/escape-html.js).
      return window.escapeHtml(str);
    }
  };

  window.ReconciliationPage = ReconciliationPage;
})();
