/**
 * Profitability Dashboard (H.3 PR4)
 * =================================
 * Admin-only real-time per-case Profitability dashboard. Reads the CF-only
 * `client_profitability` collection LIVE via onSnapshot (PR3 rule allows an
 * admin/partner listener) and JOINs each Forecast doc to `client.plan` (PR1,
 * carried on the world-readable clients doc) by caseNumber. FRONTEND ONLY — no
 * backend / rules / claims change (PR3 built the rule + the callables).
 *
 * ─── Mirrors the PR2 gold-standard (EmployeeCostsPage.js) ─────────────────────
 *  - `window.ProfitabilityPage = { init(sectionId), teardown() }`
 *  - `_escapeHtml` on every interpolated value; Hebrew-error-by-code (`_errorMessage`)
 *  - ModalManager loading→content for the per-case detail drawer
 *
 * ─── 🔴 COST/PROFIT PII DISCIPLINE (§7.6, PUBLIC repo) — #1 never-regress ──────
 *  The cost/profit VALUE must NEVER escape this client surface:
 *   - NO console.* of actualCost / projectedProfit / paidRevenue or any
 *     onSnapshot doc / getProfitability result (log only counts + caseNumber +
 *     error.code).
 *   - NEVER put a cost/profit into a toast / error string / a data- attribute /
 *     localStorage / sessionStorage / a URL.
 *  Row buttons carry only `data-case` (the 7-digit caseNumber, a non-PII business
 *  id). Error TOASTS carry only the Hebrew message-by-code.
 *
 * ─── Backend contracts (PR3, LIVE — do not change) ───────────────────────────
 *  client_profitability/{caseNumber} (onSnapshot): { caseNumber, actualHours,
 *    actualCost:number|null (null=un-costed, NEVER 0), costedEntryCount,
 *    totalEntryCount, unCostedCoveragePercent:number|null, paidRevenue:null,
 *    projectedProfit:null, status, schemaVersion, computedAt:Timestamp }.
 *  getProfitability({caseNumber}) → {exists:false} | {exists:true, ...snapshot, computedAtIso}.
 *  recomputeProfitability({caseNumber}) → {success, caseNumber, found} (audit-first mutation).
 *
 * Color signal: HOURS-vs-Plan only (actualCost is system-wide null today → no
 * profit alert; the X% threshold is deferred to when costs exist — §8.5 PR4).
 */

(function () {
  'use strict';

  const PROFITABILITY_COLLECTION = 'client_profitability';
  const CLIENTS_COLLECTION = 'clients';

  // Status vocabulary (mirrors the clients table semantics).
  const STATUS_LABELS = {
    active: 'פעיל',
    inactive: 'לא פעיל',
    archived: 'בארכיון',
    on_hold: 'מוקפא',
    blocked: 'חסום'
  };

  const ProfitabilityPage = {
    container: null,
    // caseNumber -> { name, status, plan } (the Plan/name JOIN source).
    clientsByCase: {},
    // caseNumber -> forecast doc (from the live onSnapshot).
    forecastsByCase: {},
    unsub: null,
    listening: false,
    loadError: false,
    searchTerm: '',
    statusFilter: 'active',
    sortKey: 'caseNumber',
    sortDir: 'asc',
    recomputing: {},

    /**
     * Entry point — called AFTER auth + the explicit admin role gate pass.
     * Loads the clients (for the Plan JOIN), renders the shell, then attaches
     * the live client_profitability onSnapshot.
     */
    init: function (sectionId) {
      const self = this;
      this.container = document.getElementById(sectionId);
      if (!this.container) {
        console.error('ProfitabilityPage: container not found:', sectionId);
        return;
      }

      this._renderLoading();

      this._loadClients()
        .then(function () {
          self.render();
          self._attachListener();
        })
        .catch(function (err) {
          // errorCode only — never the underlying data.
          console.error('❌ [Profitability] clients load failed:', err && err.code);
          self.loadError = true;
          self._renderLoadError();
        });
    },

    /** Tear down the live listener (called on logout / page leave). */
    teardown: function () {
      if (typeof this.unsub === 'function') {
        try {
          this.unsub();
        } catch (e) {
          // ignore
        }
      }
      this.unsub = null;
      this.listening = false;
    },

    // ═══════════════════════════════════════════
    // Data: clients (Plan JOIN source) + live forecast listener
    // ═══════════════════════════════════════════

    /**
     * Loads the clients list once (the Plan/name JOIN source). Mirrors
     * ClientsDataManager.loadClients filter — excludes internal cases so the
     * dashboard set matches the rest of the admin UI. Carries client.plan via
     * the doc spread. NO cost data here (clients is world-readable).
     */
    _loadClients: function () {
      const self = this;
      const db = window.firebaseDB;
      if (!db) {
        return Promise.reject({ code: 'no-db' });
      }
      return db.collection(CLIENTS_COLLECTION).get().then(function (snap) {
        const map = {};
        snap.forEach(function (doc) {
          const d = doc.data() || {};
          // Same internal-client filter as ClientsDataManager (SOT for the set).
          if (d.isInternal || d.clientType === 'internal') {
            return;
          }
          map[doc.id] = {
            caseNumber: doc.id,
            name: d.fullName || d.clientName || doc.id,
            status: d.status || 'active',
            plan: d.plan || null
          };
        });
        self.clientsByCase = map;
      });
    },

    /**
     * Attaches the live onSnapshot on client_profitability. The rule permits an
     * admin listener; this runs ONLY after the page's admin gate passed.
     * 🔴 PII: the snapshot docs carry actualCost — never console.* them.
     */
    _attachListener: function () {
      const self = this;
      const db = window.firebaseDB;
      if (!db || this.listening) {
        return;
      }
      this.listening = true;
      this.unsub = db.collection(PROFITABILITY_COLLECTION).onSnapshot(
        function (snap) {
          const map = {};
          snap.forEach(function (doc) {
            map[doc.id] = doc.data() || {};
          });
          self.forecastsByCase = map;
          self._refreshGrid();
        },
        function (error) {
          // errorCode only — never the data. Render a Hebrew error banner.
          console.error('❌ [Profitability] live listener error:', error && error.code);
          self._renderListenerError();
        }
      );
    },

    // ═══════════════════════════════════════════
    // Render
    // ═══════════════════════════════════════════

    _renderLoading: function () {
      this.container.innerHTML =
        '<div class="pf-page"><div class="pf-state" role="status" aria-live="polite">' +
        '<div class="pf-spinner" aria-hidden="true"></div><p>טוען נתוני רווחיות...</p>' +
        '</div></div>';
    },

    _renderLoadError: function () {
      this.container.innerHTML =
        '<div class="pf-page"><div class="pf-load-error" role="alert">' +
        '<i class="fas fa-exclamation-triangle" aria-hidden="true"></i>' +
        '<h1>שגיאה בטעינת נתונים</h1>' +
        '<p>לא ניתן לטעון את רשימת התיקים כעת. בדוק את החיבור לאינטרנט ונסה שוב.</p>' +
        '<button type="button" class="pf-btn pf-btn--secondary" onclick="window.location.reload()" aria-label="רענון הדף">רענון הדף</button>' +
        '</div></div>';
    },

    _renderListenerError: function () {
      const banner = document.getElementById('pf-listener-error');
      if (banner) {
        banner.classList.add('pf-banner--show');
      }
    },

    render: function () {
      const hasAnyForecast = Object.keys(this.forecastsByCase).length > 0;
      const emptyBanner = hasAnyForecast ? '' :
        '<div class="pf-banner pf-banner--info" role="status">' +
        '<i class="fas fa-clock" aria-hidden="true"></i>' +
        '<span>נתוני הרווחיות מחושבים אוטומטית — חישוב יומי ב-06:30. ניתן לחשב תיק מסוים ידנית בכפתור "חשב מחדש".</span>' +
        '</div>';

      this.container.innerHTML =
        '<div class="pf-page">' +
        '  <header class="pf-header">' +
        '    <h1><i class="fas fa-chart-line" aria-hidden="true"></i> רווחיות תיקים</h1>' +
        '    <p class="pf-subtitle">תכנון מול ביצוע לכל תיק — שעות ועלות. נתון פיננסי רגיש, נגיש למנהלים בלבד. רווח יוצג בהמשך (H.6).</p>' +
        '  </header>' +
        '  <div id="pf-listener-error" class="pf-banner pf-banner--error" role="alert">' +
        '    <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>' +
        '    <span>החיבור החי לנתוני הרווחיות נכשל. רענן את הדף כדי לנסות שוב.</span>' +
        '  </div>' +
        emptyBanner +
        '  <div class="pf-toolbar">' +
        '    <label class="pf-search" for="pf-search-input">' +
        '      <i class="fas fa-search" aria-hidden="true"></i>' +
        '      <input type="search" id="pf-search-input" class="pf-search-input" placeholder="חיפוש לפי שם או מספר תיק..." aria-label="חיפוש תיק לפי שם או מספר" autocomplete="off">' +
        '    </label>' +
        '    <label class="pf-filter" for="pf-status-filter">' +
        '      <span class="pf-filter-label">סטטוס:</span>' +
        '      <select id="pf-status-filter" class="pf-select" aria-label="סינון לפי סטטוס תיק">' +
        '        <option value="active">פעילים</option>' +
        '        <option value="all">הכל</option>' +
        '        <option value="archived">בארכיון</option>' +
        '      </select>' +
        '    </label>' +
        '    <span class="pf-count" id="pf-count" aria-live="polite"></span>' +
        '  </div>' +
        '  <div class="pf-list-wrap">' +
        '    <table class="pf-table">' +
        '      <thead><tr>' +
        this._th('caseNumber', 'מס׳ תיק') +
        this._th('name', 'לקוח') +
        '        <th scope="col">סטטוס</th>' +
        this._th('expectedHours', 'שעות מתוכננות') +
        '        <th scope="col">הכנסה צפויה</th>' +
        this._th('actualHours', 'שעות בפועל') +
        '        <th scope="col">עלות בפועל</th>' +
        '        <th scope="col">כיסוי עלות</th>' +
        '        <th scope="col" class="pf-num-col">עודכן</th>' +
        '        <th scope="col" class="pf-actions-col">פעולות</th>' +
        '      </tr></thead>' +
        '      <tbody id="pf-tbody">' + this._renderRows() + '</tbody>' +
        '    </table>' +
        '  </div>' +
        '</div>';

      // Restore the status filter selection + bind events.
      const sel = document.getElementById('pf-status-filter');
      if (sel) {
        sel.value = this.statusFilter;
      }
      this._bindEvents();
      this._updateCount();
    },

    _th: function (key, label) {
      const active = this.sortKey === key;
      const arrow = active ? (this.sortDir === 'asc' ? ' ▲' : ' ▼') : '';
      const ariaSort = active ? (this.sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
      return '<th scope="col" class="pf-sortable" data-sort="' + key + '" role="columnheader" aria-sort="' + ariaSort + '" tabindex="0">' +
        this._escapeHtml(label) + '<span class="pf-sort-arrow" aria-hidden="true">' + arrow + '</span></th>';
    },

    /** The rows: every visible client (JOIN to its forecast doc, which may be absent). */
    _rows: function () {
      const self = this;
      const term = this.searchTerm.trim().toLowerCase();
      let rows = Object.keys(this.clientsByCase).map(function (caseNumber) {
        const client = self.clientsByCase[caseNumber];
        const forecast = self.forecastsByCase[caseNumber] || null;
        return { caseNumber: caseNumber, client: client, forecast: forecast };
      });

      // Status filter (active default; archived; all).
      rows = rows.filter(function (r) {
        if (self.statusFilter === 'all') {
          return true;
        }
        const status = (r.forecast && r.forecast.status) || r.client.status || 'active';
        if (self.statusFilter === 'archived') {
          return status === 'archived';
        }
        // 'active' = everything that is not archived/inactive.
        return status !== 'archived' && status !== 'inactive';
      });

      // Search by name or caseNumber.
      if (term) {
        rows = rows.filter(function (r) {
          const name = (r.client.name || '').toLowerCase();
          return name.indexOf(term) !== -1 || r.caseNumber.toLowerCase().indexOf(term) !== -1;
        });
      }

      // Sort.
      const key = this.sortKey;
      const dir = this.sortDir === 'asc' ? 1 : -1;
      rows.sort(function (a, b) {
        const av = self._sortValue(a, key);
        const bv = self._sortValue(b, key);
        if (av < bv) {
 return -1 * dir;
}
        if (av > bv) {
 return 1 * dir;
}
        return 0;
      });
      return rows;
    },

    _sortValue: function (r, key) {
      if (key === 'caseNumber') {
 return r.caseNumber;
}
      if (key === 'name') {
 return (r.client.name || '').toLowerCase();
}
      if (key === 'expectedHours') {
        return (r.client.plan && typeof r.client.plan.expectedHours === 'number') ? r.client.plan.expectedHours : -1;
      }
      if (key === 'actualHours') {
        return (r.forecast && typeof r.forecast.actualHours === 'number') ? r.forecast.actualHours : -1;
      }
      return r.caseNumber;
    },

    _renderRows: function () {
      const self = this;
      const rows = this._rows();
      if (rows.length === 0) {
        return '<tr class="pf-empty-row"><td colspan="10"><div class="pf-empty">' +
          '<i class="fas fa-folder-open" aria-hidden="true"></i>' +
          '<p>' + (this.searchTerm ? 'לא נמצאו תיקים התואמים לחיפוש.' : 'אין תיקים להצגה.') + '</p>' +
          '</div></td></tr>';
      }
      const F = window.ProfitabilityFormat;
      return rows.map(function (r) {
        return self._renderRow(r, F);
      }).join('');
    },

    /** One row — JOIN the live forecast to the in-memory plan. */
    _renderRow: function (r, F) {
      const self = this;
      const caseNumber = r.caseNumber;
      const client = r.client;
      const plan = client.plan || null;
      const forecast = r.forecast;

      const status = (forecast && forecast.status) || client.status || 'active';
      const statusLabel = STATUS_LABELS[status] || status;

      const expectedHours = (plan && typeof plan.expectedHours === 'number') ? F.formatHours(plan.expectedHours) : '—';
      const rev = F.planRevenue(plan);

      const hasForecast = !!forecast;
      const actualHoursVal = hasForecast ? forecast.actualHours : null;
      const actualHours = hasForecast ? F.formatHours(actualHoursVal) : '<span class="pf-muted">טרם חושב</span>';

      // The hours-vs-Plan color signal (the only signal — cost is null today).
      const hStatus = hasForecast ? F.hoursStatus(actualHoursVal, plan && plan.expectedHours)
        : { level: 'neutral', label: '' };
      const hoursCellClass = 'pf-hours pf-level-' + hStatus.level;

      // actualCost — null≠0 (today: "עלות לא זמינה").
      let costCell;
      if (hasForecast) {
        const c = F.formatActualCost(forecast.actualCost);
        costCell = c.available
          ? '<span class="pf-cost" dir="ltr">' + self._escapeHtml(c.text) + '</span>'
          : '<span class="pf-cost pf-muted">' + self._escapeHtml(c.text) + '</span>';
      } else {
        costCell = '<span class="pf-muted">טרם חושב</span>';
      }

      // Coverage badge.
      let covCell;
      if (hasForecast) {
        const cov = F.coverageBadge(forecast.unCostedCoveragePercent, forecast.totalEntryCount);
        covCell = '<span class="pf-badge pf-level-' + cov.level + '">' + self._escapeHtml(cov.label) + '</span>';
      } else {
        covCell = '<span class="pf-muted">—</span>';
      }

      const updated = hasForecast ? self._relativeTime(forecast.computedAt) : '—';

      const revCell = rev.flag
        ? '<span dir="ltr">' + self._escapeHtml(rev.text) + '</span> <span class="pf-badge pf-level-warning">' + self._escapeHtml(rev.flagLabel) + '</span>'
        : '<span dir="ltr">' + self._escapeHtml(rev.text) + '</span>';

      const busy = this.recomputing[caseNumber];
      const recomputeBtn = '<button type="button" class="pf-row-btn" data-action="recompute" data-case="' + self._escapeHtml(caseNumber) + '"' +
        (busy ? ' disabled' : '') + ' aria-label="חשב מחדש תיק ' + self._escapeHtml(caseNumber) + '">' +
        (busy ? '<span class="pf-spinner pf-spinner--inline" aria-hidden="true"></span>' : '<i class="fas fa-rotate" aria-hidden="true"></i>') +
        '</button>';
      const detailBtn = '<button type="button" class="pf-row-btn" data-action="detail" data-case="' + self._escapeHtml(caseNumber) + '" aria-label="פרטי רווחיות לתיק ' + self._escapeHtml(caseNumber) + '"><i class="fas fa-circle-info" aria-hidden="true"></i></button>';

      return '<tr>' +
        '<td class="pf-case" dir="ltr">' + self._escapeHtml(caseNumber) + '</td>' +
        '<td class="pf-name">' + self._escapeHtml(client.name) + '</td>' +
        '<td><span class="pf-status pf-status--' + self._escapeHtml(status) + '">' + self._escapeHtml(statusLabel) + '</span></td>' +
        '<td class="pf-num" dir="ltr">' + self._escapeHtml(expectedHours) + '</td>' +
        '<td class="pf-num">' + revCell + '</td>' +
        '<td class="' + hoursCellClass + '" dir="ltr">' + actualHours + '</td>' +
        '<td class="pf-num">' + costCell + '</td>' +
        '<td>' + covCell + '</td>' +
        '<td class="pf-num pf-updated">' + self._escapeHtml(updated) + '</td>' +
        '<td class="pf-actions-col">' + detailBtn + recomputeBtn + '</td>' +
        '</tr>';
    },

    _refreshGrid: function () {
      // If the shell isn't rendered yet (first snapshot before render), render it.
      if (!document.getElementById('pf-tbody')) {
        this.render();
        return;
      }
      const tbody = document.getElementById('pf-tbody');
      if (tbody) {
        tbody.innerHTML = this._renderRows();
        this._bindRowButtons();
      }
      this._updateCount();
      // Hide the "no data yet" info banner once any forecast arrives.
      const info = this.container.querySelector('.pf-banner--info');
      if (info && Object.keys(this.forecastsByCase).length > 0) {
        info.classList.add('pf-banner--hidden');
      }
    },

    _updateCount: function () {
      const count = document.getElementById('pf-count');
      if (count) {
        const n = this._rows().length;
        count.textContent = n === 1 ? 'תיק אחד' : n + ' תיקים';
      }
    },

    // ═══════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════

    _bindEvents: function () {
      const self = this;
      const search = document.getElementById('pf-search-input');
      if (search) {
        search.addEventListener('input', function (e) {
          self.searchTerm = e.target.value || '';
          self._refreshGrid();
        });
      }
      const filter = document.getElementById('pf-status-filter');
      if (filter) {
        filter.addEventListener('change', function (e) {
          self.statusFilter = e.target.value || 'active';
          self._refreshGrid();
        });
      }
      // Sortable headers (click + keyboard).
      this.container.querySelectorAll('.pf-sortable').forEach(function (th) {
        const apply = function () {
          const key = th.getAttribute('data-sort');
          if (self.sortKey === key) {
            self.sortDir = self.sortDir === 'asc' ? 'desc' : 'asc';
          } else {
            self.sortKey = key;
            self.sortDir = 'asc';
          }
          self.render();
        };
        th.addEventListener('click', apply);
        th.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            apply();
          }
        });
      });
      this._bindRowButtons();
    },

    _bindRowButtons: function () {
      const self = this;
      const tbody = document.getElementById('pf-tbody');
      if (!tbody) {
        return;
      }
      tbody.querySelectorAll('[data-action="detail"]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          self._openDetail(btn.getAttribute('data-case'));
        });
      });
      tbody.querySelectorAll('[data-action="recompute"]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          self._recompute(btn.getAttribute('data-case'));
        });
      });
    },

    // ═══════════════════════════════════════════
    // Per-case detail drawer (getProfitability — the AUDITED single-case fetch)
    // ═══════════════════════════════════════════

    _openDetail: function (caseNumber) {
      const self = this;
      if (!caseNumber) {
        return;
      }
      const client = this.clientsByCase[caseNumber] || { name: caseNumber, plan: null };
      const modalId = window.ModalManager.create({
        title: 'רווחיות — ' + this._escapeHtml(client.name || caseNumber),
        size: 'medium',
        content: '<div class="pf-state" role="status" aria-live="polite"><div class="pf-spinner" aria-hidden="true"></div><p>טוען פרטי רווחיות...</p></div>',
        footer: null
      });

      const fn = window.firebase.functions().httpsCallable('getProfitability');
      fn({ caseNumber: caseNumber })
        .then(function (result) {
          // 🔴 PII: NEVER console.* the result — it carries actualCost.
          const data = (result && result.data) || {};
          window.ModalManager.updateContent(modalId, self._renderDetail(caseNumber, client, data));
          self._bindDetailButtons(modalId, caseNumber);
        })
        .catch(function (error) {
          window.ModalManager.updateContent(modalId,
            '<div class="pf-state pf-state--error" role="alert"><i class="fas fa-exclamation-triangle" aria-hidden="true"></i>' +
            '<p>' + self._escapeHtml(self._errorMessage(error)) + '</p>' +
            '<button type="button" class="pf-btn pf-btn--secondary" data-action="pf-close" aria-label="סגור">סגור</button></div>');
          const el = window.ModalManager.getElement(modalId);
          const close = el && el.querySelector('[data-action="pf-close"]');
          if (close) {
            close.addEventListener('click', function () {
 window.ModalManager.close(modalId);
});
          }
        });
    },

    _renderDetail: function (caseNumber, client, data) {
      const F = window.ProfitabilityFormat;
      const plan = client.plan || null;

      if (!data.exists) {
        return '<div class="pf-detail">' +
          '<div class="pf-detail-empty" role="status"><i class="fas fa-clock" aria-hidden="true"></i>' +
          '<p>הרווחיות לתיק זה טרם חושבה. לחץ "חשב מחדש" כדי לחשב כעת, או המתן לחישוב היומי (06:30).</p></div>' +
          self._detailPlanBlock(plan, F) +
          '<div class="pf-detail-actions"><button type="button" class="pf-btn pf-btn--primary" data-action="pf-recompute" aria-label="חשב מחדש"><i class="fas fa-rotate" aria-hidden="true"></i> חשב מחדש</button></div>' +
          '</div>';
      }

      const cost = F.formatActualCost(data.actualCost);
      const cov = F.coverageBadge(data.unCostedCoveragePercent, data.totalEntryCount);
      const costedCount = (typeof data.costedEntryCount === 'number') ? data.costedEntryCount : 0;
      const totalCount = (typeof data.totalEntryCount === 'number') ? data.totalEntryCount : 0;

      return '<div class="pf-detail">' +
        '<dl class="pf-detail-grid">' +
        self._dt('שעות בפועל', '<span dir="ltr">' + self._escapeHtml(F.formatHours(data.actualHours)) + '</span>') +
        self._dt('עלות בפועל', '<span dir="ltr" class="' + (cost.available ? '' : 'pf-muted') + '">' + self._escapeHtml(cost.text) + '</span>') +
        self._dt('כיסוי עלות', '<span class="pf-badge pf-level-' + cov.level + '">' + self._escapeHtml(cov.label) + '</span>') +
        self._dt('רישומים מתומחרים', '<span dir="ltr">' + self._escapeHtml(costedCount + ' / ' + totalCount) + '</span>') +
        self._dt('רווח', '<span class="pf-muted">בהמשך (H.6)</span>') +
        self._dt('חושב לאחרונה', self._escapeHtml(self._isoToRelative(data.computedAtIso))) +
        '</dl>' +
        self._detailPlanBlock(plan, F) +
        '<div class="pf-detail-actions"><button type="button" class="pf-btn pf-btn--primary" data-action="pf-recompute" aria-label="חשב מחדש"><i class="fas fa-rotate" aria-hidden="true"></i> חשב מחדש</button></div>' +
        '</div>';
    },

    _detailPlanBlock: function (plan, F) {
      if (!plan) {
        return '';
      }
      const rev = F.planRevenue(plan);
      return '<div class="pf-detail-plan"><h3>תכנון (Plan)</h3><dl class="pf-detail-grid">' +
        this._dt('שעות מתוכננות', '<span dir="ltr">' + this._escapeHtml(typeof plan.expectedHours === 'number' ? F.formatHours(plan.expectedHours) : '—') + '</span>') +
        this._dt('הכנסה צפויה', '<span dir="ltr">' + this._escapeHtml(rev.text) + '</span>' + (rev.flag ? ' <span class="pf-badge pf-level-warning">' + this._escapeHtml(rev.flagLabel) + '</span>' : '')) +
        '</dl></div>';
    },

    _dt: function (label, valueHtml) {
      return '<div class="pf-dt"><dt>' + this._escapeHtml(label) + '</dt><dd>' + valueHtml + '</dd></div>';
    },

    _bindDetailButtons: function (modalId, caseNumber) {
      const self = this;
      const el = window.ModalManager.getElement(modalId);
      if (!el) {
        return;
      }
      const btn = el.querySelector('[data-action="pf-recompute"]');
      if (btn) {
        btn.addEventListener('click', function () {
          window.ModalManager.close(modalId);
          self._recompute(caseNumber);
        });
      }
    },

    // ═══════════════════════════════════════════
    // Recompute (recomputeProfitability — audit-first mutation)
    // ═══════════════════════════════════════════

    _recompute: function (caseNumber) {
      const self = this;
      if (!caseNumber || this.recomputing[caseNumber]) {
        return;
      }
      this.recomputing[caseNumber] = true;
      this._refreshGrid();

      const fn = window.firebase.functions().httpsCallable('recomputeProfitability');
      fn({ caseNumber: caseNumber })
        .then(function (result) {
          self.recomputing[caseNumber] = false;
          const found = result && result.data && result.data.found;
          // The onSnapshot will repaint with the fresh doc; toast carries NO cost.
          if (found === false) {
            self._toast('error', 'התיק לא נמצא לחישוב.');
          } else {
            self._toast('success', 'חישוב הרווחיות עודכן.');
          }
          self._refreshGrid();
        })
        .catch(function (error) {
          self.recomputing[caseNumber] = false;
          self._refreshGrid();
          // Hebrew message-by-code; never a cost value.
          self._toast('error', self._errorMessage(error));
        });
    },

    // ═══════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════

    /** Firestore Timestamp → short relative Hebrew time. null → '—'. */
    _relativeTime: function (ts) {
      if (!ts || typeof ts.toDate !== 'function') {
        return '—';
      }
      try {
        return this._dateToRelative(ts.toDate());
      } catch (e) {
        return '—';
      }
    },

    _isoToRelative: function (iso) {
      if (!iso) {
        return '—';
      }
      const d = new Date(iso);
      if (isNaN(d.getTime())) {
        return '—';
      }
      return this._dateToRelative(d);
    },

    _dateToRelative: function (date) {
      const diffMs = Date.now() - date.getTime();
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
      return date.toLocaleDateString('he-IL');
    },

    /**
     * Hebrew error message by HttpsError code (mirrors EmployeeCostsPage). NEVER
     * exposes a raw FirebaseError / English / stack, and never a cost value.
     */
    _errorMessage: function (error) {
      const code = error && error.code ? String(error.code) : '';
      switch (code) {
        case 'unauthenticated':
        case 'functions/unauthenticated':
          return 'נדרשת התחברות מחדש למערכת. אנא התחבר ונסה שוב.';
        case 'permission-denied':
        case 'functions/permission-denied':
          return 'אין לך הרשאה לצפות בנתוני רווחיות. רק מנהל מערכת רשאי.';
        case 'invalid-argument':
        case 'functions/invalid-argument':
          return 'מספר התיק אינו תקין. נסה שוב.';
        case 'unavailable':
        case 'functions/unavailable':
        case 'deadline-exceeded':
        case 'functions/deadline-exceeded':
          return 'השרת אינו זמין כעת. בדוק את החיבור לאינטרנט ונסה שוב.';
        default:
          if (error && error.message && /[֐-׿]/.test(error.message)) {
            return error.message;
          }
          return 'אירעה שגיאה בעת ביצוע הפעולה. אנא נסה שוב או פנה לתמיכה.';
      }
    },

    _toast: function (type, message) {
      // message is a fixed Hebrew string by-code — NEVER a cost/profit value.
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
      // Behavior change: the apostrophe now encodes as &#039; (was &#39;) — same render.
      return window.escapeHtml(str);
    }
  };

  window.ProfitabilityPage = ProfitabilityPage;
})();
