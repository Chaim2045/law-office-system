/**
 * Employee Costs Page (H.3 PR2)
 * =============================
 * Admin-only page for entering each employee's cost-per-hour. Populates the
 * CF-only `employee_costs/{email}` collection via the already-wired, already
 * admin-gated `setEmployeeCost` / `getEmployeeCost` callables. FRONTEND ONLY —
 * no backend / rules / claims change.
 *
 * ─── Mirrors the gold-standard SystemSettingsPage.js ─────────────────────────
 *  - `window.EmployeeCostsPage = { init(sectionId) }` lifecycle
 *  - `_callSet` / `_showStatus` / Hebrew-error-by-code (mirrors `_callUpdate`)
 *  - `_escapeHtml` for every interpolated value
 *
 * ─── 🔴 COST-VALUE PII DISCIPLINE (§7.6, PUBLIC repo) — #1 never-regress ──────
 *  The cost value MUST NEVER escape this client surface:
 *   - NO console.* of `costPerHour` or the `getEmployeeCost` response
 *   - NEVER put a cost into a toast / error string / any data- attribute
 *   - NEVER write a cost to localStorage / sessionStorage / a URL
 *   - The cost <input> is CLEARED on every modal close
 *  Treat the cost as untrusted-to-leak. Error TOASTS carry only the Hebrew
 *  message-by-code (never the value). The server already never logs the cost —
 *  the client is the unproven surface this file is responsible for.
 *
 * ─── Backend contracts (LIVE — do not change) ────────────────────────────────
 *  setEmployeeCost({ email, costPerHour, currency:'ILS', source }) → success
 *    or HttpsError (Hebrew message-by-code). OVERWRITE (single-doc model).
 *  getEmployeeCost({ email }) → cost doc, or throws `not-found`
 *    ('לא נמצאה עלות מוגדרת לעובד זה.') — the NORMAL "טרם הוגדרה עלות" empty state.
 *  Employee list: DataManager.getAllUsers() — send the canonical doc.id/email
 *  (NEVER a typed string) to avoid email-casing false not-found.
 */

(function() {
  'use strict';

  // Cost bounds — mirror the Zod bound in
  // functions/src-ts/schemas/employee-cost.ts (positive().min(1).max(20000)).
  const COST_MIN = 1;
  const COST_MAX = 20000;

  // Allowed provenance — mirror COST_SOURCES in the schema (closed set).
  const SOURCE_OPTIONS = [
    { value: 'manual', label: 'הזנה ידנית' },
    { value: 'accountant', label: 'רואה חשבון' },
    { value: 'import', label: 'ייבוא מקובץ' }
  ];
  const DEFAULT_SOURCE = 'manual';

  const EmployeeCostsPage = {
    container: null,
    employees: [],
    searchTerm: '',
    saving: false,
    activeModalId: null,

    /**
     * Entry point. Called from the page shell AFTER auth + the explicit admin
     * role gate have passed and DataManager has loaded the employee list.
     * @param {string} sectionId - id of the container element to render into.
     */
    init: function(sectionId) {
      this.container = document.getElementById(sectionId);
      if (!this.container) {
        console.error('EmployeeCostsPage: container not found:', sectionId);
        return;
      }

      // Active employees only — DataManager.loadUsers() already excludes
      // inactive/suspended; defensively re-filter on status here too.
      const all = (window.DataManager && typeof window.DataManager.getAllUsers === 'function')
        ? window.DataManager.getAllUsers()
        : [];
      this.employees = all.filter(function(u) {
        return u && u.email && u.status !== 'inactive' && u.status !== 'suspended';
      });

      this.render();
    },

    // ═══════════════════════════════════════════
    // Render
    // ═══════════════════════════════════════════

    render: function() {
      const rows = this._renderEmployeeRows();
      const countText = this.employees.length === 1
        ? 'עובד אחד'
        : this.employees.length + ' עובדים';

      this.container.innerHTML = `
        <div class="ec-page">
          <header class="ec-header">
            <h1><i class="fas fa-coins" aria-hidden="true"></i> עלות עובדים</h1>
            <p class="ec-subtitle">הזנת עלות לשעה לכל עובד. הנתון משמש לחישוב רווחיות תיקים בלבד — מידע פיננסי רגיש, נגיש למנהלים בלבד.</p>
          </header>

          <div class="ec-toolbar">
            <label class="ec-search" for="ec-search-input">
              <i class="fas fa-search" aria-hidden="true"></i>
              <input
                type="search"
                id="ec-search-input"
                class="ec-search-input"
                placeholder="חיפוש לפי שם או מייל..."
                aria-label="חיפוש עובד לפי שם או כתובת מייל"
                autocomplete="off"
              >
            </label>
            <span class="ec-count" id="ec-count" aria-live="polite">${countText}</span>
          </div>

          <div class="ec-list-wrap">
            <table class="ec-table">
              <thead>
                <tr>
                  <th scope="col">עובד</th>
                  <th scope="col">כתובת מייל</th>
                  <th scope="col" class="ec-actions-col">פעולה</th>
                </tr>
              </thead>
              <tbody id="ec-tbody">
                ${rows}
              </tbody>
            </table>
          </div>
        </div>
      `;

      this._bindEvents();
    },

    _renderEmployeeRows: function() {
      const term = this.searchTerm.trim().toLowerCase();
      const filtered = this.employees.filter(function(u) {
        if (!term) {
          return true;
        }
        const name = (u.displayName || u.username || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        return name.indexOf(term) !== -1 || email.indexOf(term) !== -1;
      });

      if (filtered.length === 0) {
        return `
          <tr class="ec-empty-row">
            <td colspan="3">
              <div class="ec-empty">
                <i class="fas fa-user-slash" aria-hidden="true"></i>
                <p>${term ? 'לא נמצאו עובדים התואמים לחיפוש.' : 'אין עובדים פעילים להצגה.'}</p>
              </div>
            </td>
          </tr>
        `;
      }

      const self = this;
      return filtered.map(function(u) {
        const name = u.displayName || u.username || u.email;
        // u.email is the canonical doc.id from DataManager — the employee_costs
        // key. Pass it on the button (data-email), NEVER a typed/display string.
        return `
          <tr>
            <td class="ec-name-cell">${self._escapeHtml(name)}</td>
            <td class="ec-email-cell" dir="ltr">${self._escapeHtml(u.email)}</td>
            <td class="ec-actions-col">
              <button
                type="button"
                class="ec-set-btn"
                data-email="${self._escapeHtml(u.email)}"
                data-name="${self._escapeHtml(name)}"
                aria-label="הגדרת עלות לשעה עבור ${self._escapeHtml(name)}"
              >
                <i class="fas fa-pen" aria-hidden="true"></i> הגדר עלות
              </button>
            </td>
          </tr>
        `;
      }).join('');
    },

    _bindEvents: function() {
      const self = this;

      const search = document.getElementById('ec-search-input');
      if (search) {
        search.addEventListener('input', function(e) {
          self.searchTerm = e.target.value || '';
          self._refreshRows();
        });
      }

      this._bindRowButtons();
    },

    _bindRowButtons: function() {
      const self = this;
      const tbody = document.getElementById('ec-tbody');
      if (!tbody) {
        return;
      }
      tbody.querySelectorAll('.ec-set-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          // The email comes from DataManager's canonical doc.id (data-email),
          // never from a free-typed field — avoids email-casing false not-found.
          self._openCostModal(btn.dataset.email, btn.dataset.name);
        });
      });
    },

    _refreshRows: function() {
      const tbody = document.getElementById('ec-tbody');
      if (tbody) {
        tbody.innerHTML = this._renderEmployeeRows();
        this._bindRowButtons();
      }
      const count = document.getElementById('ec-count');
      if (count) {
        const term = this.searchTerm.trim().toLowerCase();
        const shown = this.employees.filter(function(u) {
          if (!term) {
            return true;
          }
          const name = (u.displayName || u.username || '').toLowerCase();
          const email = (u.email || '').toLowerCase();
          return name.indexOf(term) !== -1 || email.indexOf(term) !== -1;
        }).length;
        count.textContent = shown === 1 ? 'עובד אחד' : shown + ' עובדים';
      }
    },

    // ═══════════════════════════════════════════
    // Cost Modal — mandatory getEmployeeCost pre-fill FIRST
    // ═══════════════════════════════════════════

    /**
     * Open the set-cost modal for one employee. ALWAYS calls getEmployeeCost
     * first so we either show the current cost (before an OVERWRITE) or the
     * "טרם הוגדרה עלות" empty state. A `not-found` HttpsError is the NORMAL
     * empty state — NOT an error toast.
     * @param {string} email - canonical employee email (DataManager doc.id).
     * @param {string} name  - display name (for the modal title only).
     */
    _openCostModal: function(email, name) {
      const self = this;

      if (!email) {
        return;
      }

      const modalId = window.ModalManager.create({
        title: 'עלות לשעה — ' + this._escapeHtml(name || email),
        size: 'small',
        content: this._renderModalLoading(),
        footer: null,
        onClose: function() {
          // 🔴 PII: clear the cost field on EVERY modal close so no cost value
          // lingers in a detached DOM node / autofill cache.
          self._clearCostField();
          self.activeModalId = null;
        }
      });
      this.activeModalId = modalId;

      // Mandatory pre-fill: getEmployeeCost FIRST.
      const getFn = window.firebase.functions().httpsCallable('getEmployeeCost');
      getFn({ email: email })
        .then(function(result) {
          // 🔴 PII: NEVER console.* the result — it carries costPerHour.
          const data = (result && result.data) || {};
          self._renderModalForm(modalId, email, name, {
            hasCurrent: true,
            currentCost: data.costPerHour,
            currentSource: data.source
          });
        })
        .catch(function(error) {
          if (error && error.code === 'not-found') {
            // NORMAL empty state — employee_costs is ~0 docs today, so a first
            // pick legitimately returns not-found. NOT an error toast.
            self._renderModalForm(modalId, email, name, { hasCurrent: false });
          } else {
            // A real error (network / permission / etc). Hebrew message-by-code.
            // NO cost value involved here — the read failed before any value.
            self._renderModalError(modalId, self._errorMessage(error));
          }
        });
    },

    _renderModalLoading: function() {
      return `
        <div class="ec-modal-state" role="status" aria-live="polite">
          <div class="ec-spinner" aria-hidden="true"></div>
          <p>טוען עלות נוכחית...</p>
        </div>
      `;
    },

    _renderModalError: function(modalId, message) {
      window.ModalManager.updateContent(modalId, `
        <div class="ec-modal-state ec-modal-state--error" role="alert">
          <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
          <p>${this._escapeHtml(message)}</p>
          <button type="button" class="ec-btn ec-btn--secondary" data-action="ec-close" aria-label="סגור">סגור</button>
        </div>
      `);
      const el = window.ModalManager.getElement(modalId);
      const closeBtn = el && el.querySelector('[data-action="ec-close"]');
      if (closeBtn) {
        closeBtn.addEventListener('click', function() {
          window.ModalManager.close(modalId);
        });
      }
    },

    /**
     * Render the actual set-cost form inside the (already open) modal.
     * @param {Object} current - { hasCurrent, currentCost?, currentSource? }
     */
    _renderModalForm: function(modalId, email, name, current) {
      const self = this;

      const currentBlock = current.hasCurrent
        ? `<div class="ec-current" role="status">
             <span class="ec-current-label">עלות נוכחית</span>
             <span class="ec-current-value" dir="ltr">${self._escapeHtml(self._formatCost(current.currentCost))} <span class="ec-currency">ILS</span></span>
           </div>`
        : `<div class="ec-current ec-current--empty" role="status">
             <i class="fas fa-info-circle" aria-hidden="true"></i>
             <span>טרם הוגדרה עלות לעובד זה.</span>
           </div>`;

      const defaultSourceValue = current.hasCurrent && current.currentSource
        ? current.currentSource
        : DEFAULT_SOURCE;

      const sourceOptions = SOURCE_OPTIONS.map(function(opt) {
        const selected = opt.value === defaultSourceValue ? ' selected' : '';
        return '<option value="' + opt.value + '"' + selected + '>' + self._escapeHtml(opt.label) + '</option>';
      }).join('');

      const formHtml = `
        <form class="ec-form" id="ec-form" novalidate>
          ${currentBlock}

          <div class="ec-field">
            <label for="ec-cost-input">עלות לשעה <span class="ec-req" aria-hidden="true">*</span></label>
            <div class="ec-cost-input-wrap">
              <input
                type="number"
                id="ec-cost-input"
                class="ec-input"
                inputmode="numeric"
                min="${COST_MIN}"
                max="${COST_MAX}"
                step="1"
                dir="ltr"
                required
                aria-required="true"
                aria-describedby="ec-cost-hint ec-form-error"
                autocomplete="off"
              >
              <span class="ec-input-suffix" aria-hidden="true">ILS</span>
            </div>
            <span class="ec-hint" id="ec-cost-hint">מספר שלם בין ${COST_MIN} ל-${COST_MAX} (₪ לשעה).</span>
          </div>

          <div class="ec-field">
            <label for="ec-source-select">מקור הנתון</label>
            <select id="ec-source-select" class="ec-input ec-select" aria-label="מקור נתון העלות">
              ${sourceOptions}
            </select>
          </div>

          <p class="ec-currency-note">המטבע קבוע: שקל חדש (ILS).</p>

          <div class="ec-form-error" id="ec-form-error" role="alert" aria-live="assertive"></div>

          <div class="ec-form-actions">
            <button type="button" class="ec-btn ec-btn--secondary" data-action="ec-cancel" aria-label="ביטול">ביטול</button>
            <button type="submit" class="ec-btn ec-btn--primary" id="ec-save-btn">
              <i class="fas fa-save" aria-hidden="true"></i> שמירה
            </button>
          </div>
        </form>
      `;

      window.ModalManager.updateContent(modalId, formHtml);

      const el = window.ModalManager.getElement(modalId);
      if (!el) {
        return;
      }

      const form = el.querySelector('#ec-form');
      const costInput = el.querySelector('#ec-cost-input');
      const cancelBtn = el.querySelector('[data-action="ec-cancel"]');

      if (costInput) {
        // Focus the field for fast entry; do NOT pre-fill the value (overwrite
        // semantics — the admin types the new cost deliberately).
        costInput.focus();
      }
      if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
          window.ModalManager.close(modalId);
        });
      }
      if (form) {
        form.addEventListener('submit', function(e) {
          e.preventDefault();
          self._onSubmit(modalId, email);
        });
      }
    },

    // ═══════════════════════════════════════════
    // Validate + Save (OVERWRITE)
    // ═══════════════════════════════════════════

    _onSubmit: function(modalId, email) {
      const self = this;
      if (this.saving) {
        return;
      }

      const el = window.ModalManager.getElement(modalId);
      if (!el) {
        return;
      }
      const costInput = el.querySelector('#ec-cost-input');
      const sourceSelect = el.querySelector('#ec-source-select');
      const raw = costInput ? costInput.value.trim() : '';

      // Client-validate 1..20000 (mirror the Zod bound; integer; Hebrew error).
      // 🔴 PII: the validation error text NEVER echoes the entered value.
      if (raw === '') {
        this._showFormError(el, 'יש להזין עלות לשעה.');
        return;
      }
      const cost = Number(raw);
      if (!Number.isFinite(cost) || !Number.isInteger(cost)) {
        this._showFormError(el, 'העלות חייבת להיות מספר שלם.');
        return;
      }
      if (cost < COST_MIN || cost > COST_MAX) {
        this._showFormError(el, 'העלות חייבת להיות בין ' + COST_MIN + ' ל-' + COST_MAX + ' ₪ לשעה.');
        return;
      }

      const source = (sourceSelect && sourceSelect.value) || DEFAULT_SOURCE;

      this._clearFormError(el);
      this.saving = true;
      this._setSaving(el, true);

      // setEmployeeCost is a single-doc OVERWRITE. currency is the fixed literal
      // 'ILS' (z.literal). email is the canonical DataManager doc.id.
      const setFn = window.firebase.functions().httpsCallable('setEmployeeCost');
      setFn({ email: email, costPerHour: cost, currency: 'ILS', source: source })
        .then(function() {
          // 🔴 PII: success toast carries NO cost value.
          self.saving = false;
          window.ModalManager.close(modalId);
          self._toast('success', 'העלות נשמרה בהצלחה.');
        })
        .catch(function(error) {
          self.saving = false;
          self._setSaving(el, false);
          // Hebrew message-by-code; NEVER includes the cost value.
          self._showFormError(el, self._errorMessage(error));
        });
    },

    _setSaving: function(el, isSaving) {
      const btn = el.querySelector('#ec-save-btn');
      const costInput = el.querySelector('#ec-cost-input');
      const sourceSelect = el.querySelector('#ec-source-select');
      if (btn) {
        btn.disabled = isSaving;
        btn.innerHTML = isSaving
          ? '<span class="ec-spinner ec-spinner--inline" aria-hidden="true"></span> שומר...'
          : '<i class="fas fa-save" aria-hidden="true"></i> שמירה';
      }
      if (costInput) {
        costInput.disabled = isSaving;
      }
      if (sourceSelect) {
        sourceSelect.disabled = isSaving;
      }
    },

    _showFormError: function(el, message) {
      const errEl = el.querySelector('#ec-form-error');
      if (errEl) {
        errEl.textContent = message; // textContent → no HTML injection
        errEl.classList.add('ec-form-error--show');
      }
    },

    _clearFormError: function(el) {
      const errEl = el.querySelector('#ec-form-error');
      if (errEl) {
        errEl.textContent = '';
        errEl.classList.remove('ec-form-error--show');
      }
    },

    // ═══════════════════════════════════════════
    // PII hygiene
    // ═══════════════════════════════════════════

    /**
     * 🔴 PII: clear the cost <input> so no cost value survives a modal close.
     * Called from the modal's onClose callback for EVERY close path (save,
     * cancel, backdrop, ESC, X).
     */
    _clearCostField: function() {
      // The modal node may already be detaching; guard defensively.
      const input = document.getElementById('ec-cost-input');
      if (input) {
        input.value = '';
      }
    },

    // ═══════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════

    /**
     * Hebrew error message by HttpsError code (mirrors SystemSettingsPage
     * error-by-code). The backend already returns Hebrew messages, but we map
     * by CODE so a transport/unknown error still renders a friendly Hebrew line
     * (never a raw FirebaseError, English, or a stack trace).
     */
    _errorMessage: function(error) {
      const code = error && error.code ? String(error.code) : '';
      switch (code) {
        case 'unauthenticated':
        case 'functions/unauthenticated':
          return 'נדרשת התחברות מחדש למערכת. אנא התחבר ונסה שוב.';
        case 'permission-denied':
        case 'functions/permission-denied':
          return 'אין לך הרשאה לבצע פעולה זו. רק מנהל מערכת רשאי לעדכן עלות עובד.';
        case 'not-found':
        case 'functions/not-found':
          return 'העובד המבוקש לא נמצא במערכת. ודא שכתובת המייל תקינה ונסה שוב.';
        case 'invalid-argument':
        case 'functions/invalid-argument':
          return 'הנתונים שהוזנו אינם תקינים. ודא את הערכים ונסה שוב.';
        case 'unavailable':
        case 'functions/unavailable':
        case 'deadline-exceeded':
        case 'functions/deadline-exceeded':
          return 'השרת אינו זמין כעת. בדוק את החיבור לאינטרנט ונסה שוב.';
        default:
          // Last resort: prefer the backend's Hebrew message if present and
          // Hebrew; otherwise a generic Hebrew line. NEVER expose a raw error.
          if (error && error.message && /[֐-׿]/.test(error.message)) {
            return error.message;
          }
          return 'אירעה שגיאה בעת ביצוע הפעולה. אנא נסה שוב או פנה לתמיכה.';
      }
    },

    /**
     * Format a cost value for DISPLAY of an EXISTING cost only. This value came
     * back from getEmployeeCost and is shown inside the admin-only modal — it is
     * never logged, never put in a toast, never stored.
     */
    _formatCost: function(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return '—';
      }
      return String(value);
    },

    _toast: function(type, message) {
      // message is a fixed Hebrew string by-code — NEVER a cost value.
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
      // No notification system available — silently no-op (the modal already
      // closed on success / showed the inline error on failure).
    },

    _escapeHtml: function(str) {
      // Routed to the shared SSOT escaper (js/core/escape-html.js).
      // Behavior change: the apostrophe now encodes as &#039; (was &#39;) — same render.
      return window.escapeHtml(str);
    }
  };

  window.EmployeeCostsPage = EmployeeCostsPage;

})();
