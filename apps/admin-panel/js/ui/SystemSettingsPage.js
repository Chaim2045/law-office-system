/**
 * System Settings Page
 * =====================
 * Admin panel page for managing system configuration.
 * Reads from window.SYSTEM_CONFIG (loaded by config-loader.js).
 * Writes via updateSystemConfig Cloud Function.
 */

(function() {
  'use strict';

  const SystemSettingsPage = {
    container: null,
    config: null,
    version: null,
    saving: false,
    collapsedSections: {},

    init: function(containerId) {
      this.container = document.getElementById(containerId);
      if (!this.container) {
        console.error('Settings container not found:', containerId);
        return;
      }

      this.config = window.SYSTEM_CONFIG || window.SYSTEM_CONSTANTS;
      this.version = window.SystemConfigLoader?.getVersion?.() || null;
      this.render();
    },

    render: function() {
      const config = this.config;
      if (!config) {
        this.container.innerHTML = '<p>שגיאה בטעינת הגדרות</p>';
        return;
      }

      this.container.innerHTML = `
        <div class="settings-page">
          <div class="settings-header">
            <div class="settings-header-top">
              <h1><i class="fas fa-cog"></i> הגדרות מערכת</h1>
              ${this.version ? '<span class="settings-version">v' + this.version + '</span>' : ''}
            </div>
            <p class="settings-subtitle">הגדרות מרכזיות למערכת משרד עורכי הדין. שינויים כאן משפיעים על כל המשתמשים.</p>
          </div>

          ${this._renderSection('admin-emails', 'fa-shield-alt', 'red', 'הרשאות מנהלים', 'רשימת כתובות המייל שמזוהות כמנהלי מערכת. רק מנהלים יכולים לגשת לפאנל הזה.', this._renderAdminEmailsContent(), true)}

          <div class="settings-grid-2col">
            ${this._renderSection('business-limits', 'fa-sliders-h', 'orange', 'מגבלות עסקיות', 'גבולות עליונים ליצירת חבילות שעות ושלבים. מגנים מפני טעויות הקלדה — לא משפיעים על נתונים קיימים.', this._renderBusinessLimitsContent(), true)}
            ${this._renderSection('idle-timeout', 'fa-clock', 'blue', 'זמן אי-פעילות', 'כמה זמן עד שמשתמש שלא פעיל מקבל אזהרה ומנותק. משפיע על User App ו-Admin Panel.', this._renderIdleTimeoutContent(), true)}
          </div>

          <div class="settings-grid-2col">
            ${this._renderSection('service-types', 'fa-layer-group', 'green', 'סוגי שירות', 'שמות התצוגה של סוגי השירות במערכת. ניתן לשנות תוויות בלבד — המפתחות (hours, legal_procedure, fixed) קבועים.', this._renderServiceTypesContent(), true)}
            ${this._renderSection('description-limits', 'fa-text-width', 'teal', 'מגבלות תווים לתיאורים', 'מספר התווים המרבי שמשתמש יכול להקליד בשדות תיאור. משפיע על טופס משימה חדשה ועל רישום שעות. טווח מותר: 10–200.', this._renderDescriptionLimitsContent(), true)}
          </div>

          <div class="settings-grid-2col">
            ${this._renderSection('roles', 'fa-user-tag', 'purple', 'תפקידים', 'שמות התצוגה של תפקידי המשתמשים. ניתן לשנות תוויות בלבד — המפתחות קבועים.', this._renderRolesContent(), true)}
            ${this._renderSection('stages', 'fa-list-ol', 'gray', 'שלבי הליך משפטי', 'השלבים של הליך משפטי (א, ב, ג). לא ניתנים לשינוי — שינוי מבנה דורש העברת נתונים.', this._renderStagesContent(), false)}
          </div>
        </div>
      `;

      this._bindEvents();
    },

    // ═══════════════════════════════════════════
    // Generic Section Wrapper
    // ═══════════════════════════════════════════

    _renderSection: function(id, icon, color, title, description, content, editable) {
      const collapsed = this.collapsedSections[id] || false;
      const editBadge = editable
        ? '<span class="settings-badge editable"><i class="fas fa-pen"></i> ניתן לעריכה</span>'
        : '<span class="settings-badge readonly"><i class="fas fa-lock"></i> קריאה בלבד</span>';

      return `
        <div class="settings-section ${collapsed ? 'collapsed' : ''} ${!editable ? 'readonly' : ''}" id="section-${id}">
          <div class="settings-section-header" data-toggle="${id}">
            <div class="settings-section-icon ${color}"><i class="fas ${icon}"></i></div>
            <div class="settings-section-header-text">
              <span class="settings-section-title">${title}</span>
              ${editBadge}
            </div>
            <i class="fas fa-chevron-down settings-chevron"></i>
          </div>
          <div class="settings-section-body">
            <p class="settings-description">${description}</p>
            ${content}
          </div>
        </div>
      `;
    },

    // ═══════════════════════════════════════════
    // Section Content Renderers
    // ═══════════════════════════════════════════

    _renderAdminEmailsContent: function() {
      const emails = this.config.adminEmails || this.config.ADMIN_EMAILS || [];
      const items = emails.map(function(email, i) {
        return '<li class="email-list-item">' +
          '<span class="email-text">' + _escapeHtml(email) + '</span>' +
          '<button class="email-remove-btn" data-index="' + i + '" title="הסר"><i class="fas fa-times"></i></button>' +
          '</li>';
      }).join('');

      return `
        <ul class="email-list" id="admin-email-list">${items}</ul>
        <div class="settings-input-row">
          <input type="email" class="settings-input" id="new-admin-email" placeholder="הוסף מייל מנהל חדש..." dir="ltr">
          <button class="settings-add-btn" id="add-email-btn"><i class="fas fa-plus"></i> הוסף</button>
        </div>
        <div class="settings-footer">
          <button class="settings-save-btn" id="save-emails-btn"><i class="fas fa-save"></i> שמור שינויים</button>
          <div class="settings-status" id="emails-status"></div>
        </div>
      `;
    },

    _renderBusinessLimitsContent: function() {
      const limits = this.config.businessLimits || this.config.BUSINESS_LIMITS || {};
      return `
        <div class="settings-form-group">
          <label>מקסימום שעות לחבילה</label>
          <input type="number" class="settings-input" id="limit-max-hours" value="${limits.maxPackageHours || limits.MAX_PACKAGE_HOURS || 500}" min="1" max="10000">
          <span class="settings-hint">הגבלה ליצירת חבילת שעות חדשה</span>
        </div>
        <div class="settings-form-group">
          <label>מקסימום שעות לשלב</label>
          <input type="number" class="settings-input" id="limit-max-stage-hours" value="${limits.maxStageHours || limits.MAX_STAGE_HOURS || 1000}" min="1" max="10000">
          <span class="settings-hint">הגבלה לשלב בודד בהליך משפטי</span>
        </div>
        <div class="settings-form-group">
          <label>מקסימום מחיר קבוע (₪)</label>
          <input type="number" class="settings-input" id="limit-max-fixed-price" value="${limits.maxFixedPrice || limits.MAX_FIXED_PRICE || 1000000}" min="1" max="10000000">
          <span class="settings-hint">הגבלת מחיר לשירות במחיר קבוע</span>
        </div>
        <div class="settings-footer">
          <button class="settings-save-btn" id="save-limits-btn"><i class="fas fa-save"></i> שמור</button>
          <div class="settings-status" id="limits-status"></div>
        </div>
      `;
    },

    _renderIdleTimeoutContent: function() {
      const timeout = this.config.idleTimeout || this.config.IDLE_TIMEOUT || {};
      const idleMinutes = Math.round((timeout.idleMs || timeout.IDLE_MS || 600000) / 60000);
      const warningMinutes = Math.round((timeout.warningMs || timeout.WARNING_MS || 300000) / 60000);
      return `
        <div class="settings-form-group">
          <label>דקות עד אזהרה</label>
          <input type="number" class="settings-input" id="idle-minutes" value="${idleMinutes}" min="1" max="60">
          <span class="settings-hint">אחרי כמה דקות בלי פעולה — תופיע אזהרה</span>
        </div>
        <div class="settings-form-group">
          <label>דקות עד ניתוק</label>
          <input type="number" class="settings-input" id="warning-minutes" value="${warningMinutes}" min="1" max="30">
          <span class="settings-hint">אחרי האזהרה — כמה דקות עד ניתוק אוטומטי</span>
        </div>
        <div class="settings-footer">
          <button class="settings-save-btn" id="save-timeout-btn"><i class="fas fa-save"></i> שמור</button>
          <div class="settings-status" id="timeout-status"></div>
        </div>
      `;
    },

    _renderDescriptionLimitsContent: function() {
      const limits = this.config.descriptionLimits || this.config.DESCRIPTION_LIMITS || {};
      const taskDesc = limits.taskDescription || limits.TASK_DESCRIPTION || 50;
      const tsDesc = limits.timesheetDescription || limits.TIMESHEET_DESCRIPTION || 50;
      return `
        <div class="settings-form-group">
          <label>תיאור משימה — מקסימום תווים</label>
          <input type="number" class="settings-input" id="limit-task-description" value="${taskDesc}" min="10" max="200">
          <span class="settings-hint">מגבלת תווים לשדה תיאור בטופס יצירת משימה חדשה</span>
        </div>
        <div class="settings-form-group">
          <label>תיאור רישום שעות — מקסימום תווים</label>
          <input type="number" class="settings-input" id="limit-timesheet-description" value="${tsDesc}" min="10" max="200">
          <span class="settings-hint">מגבלת תווים לשדה תיאור ברישום שעות</span>
        </div>
        <div class="settings-footer">
          <button class="settings-save-btn" id="save-description-limits-btn"><i class="fas fa-save"></i> שמור</button>
          <div class="settings-status" id="description-limits-status"></div>
        </div>
      `;
    },

    _renderServiceTypesContent: function() {
      const types = this.config.serviceTypes || this.config.SERVICE_TYPE_LABELS || {};
      let rows = '';

      if (this.config.serviceTypes) {
        Object.keys(types).forEach(function(key) {
          const t = types[key];
          rows += '<tr>' +
            '<td class="key-cell"><code>' + _escapeHtml(key) + '</code></td>' +
            '<td><input type="text" class="settings-input settings-input-compact" data-service-key="' + key + '" value="' + _escapeHtml(t.label || key) + '"></td>' +
            '<td class="status-cell">' + (t.active !== false ? '<i class="fas fa-check-circle" style="color:#16a34a"></i>' : '<i class="fas fa-times-circle" style="color:#dc2626"></i>') + '</td>' +
            '</tr>';
        });
      } else {
        Object.keys(types).forEach(function(key) {
          rows += '<tr>' +
            '<td class="key-cell"><code>' + _escapeHtml(key) + '</code></td>' +
            '<td>' + _escapeHtml(types[key]) + '</td>' +
            '<td class="status-cell"><i class="fas fa-check-circle" style="color:#16a34a"></i></td>' +
            '</tr>';
        });
      }

      return `
        <table class="settings-table">
          <thead><tr><th>מפתח (קבוע)</th><th>שם תצוגה</th><th>פעיל</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="settings-footer">
          <button class="settings-save-btn" id="save-service-types-btn"><i class="fas fa-save"></i> שמור תוויות</button>
          <div class="settings-status" id="service-types-status"></div>
        </div>
      `;
    },

    _renderRolesContent: function() {
      const roles = this.config.roles || this.config.ROLE_LABELS || {};
      let rows = '';

      if (this.config.roles) {
        Object.keys(roles).forEach(function(key) {
          const r = roles[key];
          rows += '<tr>' +
            '<td class="key-cell"><code>' + _escapeHtml(key) + '</code></td>' +
            '<td><input type="text" class="settings-input settings-input-compact" data-role-key="' + key + '" value="' + _escapeHtml(r.label || key) + '"></td>' +
            '</tr>';
        });
      } else {
        Object.keys(roles).forEach(function(key) {
          rows += '<tr>' +
            '<td class="key-cell"><code>' + _escapeHtml(key) + '</code></td>' +
            '<td>' + _escapeHtml(roles[key]) + '</td>' +
            '</tr>';
        });
      }

      return `
        <table class="settings-table">
          <thead><tr><th>מפתח (קבוע)</th><th>שם תצוגה</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="settings-footer">
          <button class="settings-save-btn" id="save-roles-btn"><i class="fas fa-save"></i> שמור תוויות</button>
          <div class="settings-status" id="roles-status"></div>
        </div>
      `;
    },

    _renderStagesContent: function() {
      const stages = this.config.legalProcedureStages || this.config.STAGE_NAMES || {};
      let rows = '';

      if (this.config.legalProcedureStages) {
        Object.keys(stages).forEach(function(key) {
          const s = stages[key];
          rows += '<tr>' +
            '<td class="key-cell"><code>' + _escapeHtml(key) + '</code></td>' +
            '<td>' + _escapeHtml(s.name || key) + '</td>' +
            '<td class="status-cell">' + (s.order || '') + '</td>' +
            '</tr>';
        });
      } else {
        Object.keys(stages).forEach(function(key) {
          rows += '<tr>' +
            '<td class="key-cell"><code>' + _escapeHtml(key) + '</code></td>' +
            '<td>' + _escapeHtml(stages[key]) + '</td>' +
            '<td class="status-cell"></td>' +
            '</tr>';
        });
      }

      return `
        <table class="settings-table">
          <thead><tr><th>מפתח</th><th>שם</th><th>סדר</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    },

    // ═══════════════════════════════════════════
    // Event Binding
    // ═══════════════════════════════════════════

    _bindEvents: function() {
      const self = this;

      // Collapsible sections
      document.querySelectorAll('[data-toggle]').forEach(function(header) {
        header.addEventListener('click', function() {
          const sectionId = header.dataset.toggle;
          const section = document.getElementById('section-' + sectionId);
          if (section) {
            section.classList.toggle('collapsed');
            self.collapsedSections[sectionId] = section.classList.contains('collapsed');
          }
        });
      });

      // Add email
      const addBtn = document.getElementById('add-email-btn');
      if (addBtn) {
        addBtn.addEventListener('click', function() {
 self._addEmail();
});
      }
      const emailInput = document.getElementById('new-admin-email');
      if (emailInput) {
        emailInput.addEventListener('keypress', function(e) {
          if (e.key === 'Enter') {
 self._addEmail();
}
        });
      }

      // Remove email buttons
      document.querySelectorAll('.email-remove-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          self._removeEmail(parseInt(btn.dataset.index));
        });
      });

      // Save buttons
      this._bindSave('save-emails-btn', '_saveEmails');
      this._bindSave('save-limits-btn', '_saveLimits');
      this._bindSave('save-description-limits-btn', '_saveDescriptionLimits');
      this._bindSave('save-timeout-btn', '_saveTimeout');
      this._bindSave('save-service-types-btn', '_saveServiceTypes');
      this._bindSave('save-roles-btn', '_saveRoles');
    },

    _bindSave: function(btnId, method) {
      const self = this;
      const btn = document.getElementById(btnId);
      if (btn) {
 btn.addEventListener('click', function() {
 self[method]();
});
}
    },

    // ═══════════════════════════════════════════
    // Email Management
    // ═══════════════════════════════════════════

    _addEmail: function() {
      const input = document.getElementById('new-admin-email');
      const email = input.value.trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        this._showStatus('emails-status', 'error', 'מייל לא תקין');
        return;
      }

      const emails = this._getCurrentEmails();
      if (emails.includes(email)) {
        this._showStatus('emails-status', 'error', 'מייל כבר קיים ברשימה');
        return;
      }

      emails.push(email);
      this._updateEmailList(emails);
      input.value = '';
    },

    _removeEmail: function(index) {
      const emails = this._getCurrentEmails();
      if (emails.length <= 1) {
        this._showStatus('emails-status', 'error', 'חייב להיות לפחות מנהל אחד');
        return;
      }
      emails.splice(index, 1);
      this._updateEmailList(emails);
    },

    _getCurrentEmails: function() {
      const items = document.querySelectorAll('#admin-email-list .email-text');
      return Array.from(items).map(function(el) {
 return el.textContent.trim();
});
    },

    _updateEmailList: function(emails) {
      const list = document.getElementById('admin-email-list');
      list.innerHTML = emails.map(function(email, i) {
        return '<li class="email-list-item">' +
          '<span class="email-text">' + _escapeHtml(email) + '</span>' +
          '<button class="email-remove-btn" data-index="' + i + '" title="הסר"><i class="fas fa-times"></i></button>' +
          '</li>';
      }).join('');

      const self = this;
      list.querySelectorAll('.email-remove-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          self._removeEmail(parseInt(btn.dataset.index));
        });
      });
    },

    // ═══════════════════════════════════════════
    // Save Operations
    // ═══════════════════════════════════════════

    _saveEmails: function() {
      this._callUpdate({ adminEmails: this._getCurrentEmails() }, 'emails-status');
    },

    _saveLimits: function() {
      this._callUpdate({
        businessLimits: {
          maxPackageHours: parseInt(document.getElementById('limit-max-hours').value),
          maxStageHours: parseInt(document.getElementById('limit-max-stage-hours').value),
          maxFixedPrice: parseInt(document.getElementById('limit-max-fixed-price').value)
        }
      }, 'limits-status');
    },

    _saveDescriptionLimits: function() {
      const taskVal = parseInt(document.getElementById('limit-task-description').value);
      const tsVal = parseInt(document.getElementById('limit-timesheet-description').value);

      if (isNaN(taskVal) || taskVal < 10 || taskVal > 200 || isNaN(tsVal) || tsVal < 10 || tsVal > 200) {
        this._showStatus('description-limits-status', 'error', 'ערך חייב להיות מספר שלם בין 10 ל-200');
        return;
      }

      this._callUpdate({
        descriptionLimits: {
          taskDescription: taskVal,
          timesheetDescription: tsVal
        }
      }, 'description-limits-status');
    },

    _saveTimeout: function() {
      this._callUpdate({
        idleTimeout: {
          idleMs: parseInt(document.getElementById('idle-minutes').value) * 60 * 1000,
          warningMs: parseInt(document.getElementById('warning-minutes').value) * 60 * 1000
        }
      }, 'timeout-status');
    },

    _saveServiceTypes: function() {
      const serviceTypes = {};
      document.querySelectorAll('[data-service-key]').forEach(function(input) {
        serviceTypes[input.dataset.serviceKey] = { label: input.value.trim(), active: true };
      });
      this._callUpdate({ serviceTypes: serviceTypes }, 'service-types-status');
    },

    _saveRoles: function() {
      const roles = {};
      document.querySelectorAll('[data-role-key]').forEach(function(input) {
        roles[input.dataset.roleKey] = { label: input.value.trim(), active: true };
      });
      this._callUpdate({ roles: roles }, 'roles-status');
    },

    _callUpdate: function(data, statusId) {
      const self = this;
      if (self.saving) {
 return;
}
      self.saving = true;

      data._expectedVersion = self.version;

      const updateFn = window.firebase.functions().httpsCallable('updateSystemConfig');
      self._showStatus(statusId, 'saving', 'שומר...');

      updateFn(data)
        .then(function() {
          self._showStatus(statusId, 'success', 'נשמר בהצלחה');
          self.saving = false;
          if (window.SystemConfigLoader) {
            window.SystemConfigLoader.loaded = false;
            window.SystemConfigLoader.load().then(function() {
              self.version = window.SystemConfigLoader.getVersion();
              const versionEl = self.container.querySelector('.settings-version');
              if (versionEl && self.version) {
                versionEl.textContent = 'v' + self.version;
              }
            });
          }
        })
        .catch(function(error) {
          console.error('Save error:', error);
          let msg = error.message || 'שגיאה בשמירה';
          if (error.code === 'aborted') {
            msg = 'ההגדרות עודכנו על ידי מנהל אחר. רענן את הדף ונסה שוב.';
          }
          self._showStatus(statusId, 'error', msg);
          self.saving = false;
        });
    },

    _showStatus: function(elementId, type, message) {
      const el = document.getElementById(elementId);
      if (!el) {
 return;
}
      el.className = 'settings-status ' + type;
      el.textContent = message;
      if (type === 'success') {
        setTimeout(function() {
 el.className = 'settings-status';
}, 3000);
      }
    }
  };

  function _escapeHtml(str) {
    if (!str) {
 return '';
}
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.SystemSettingsPage = SystemSettingsPage;
  console.log('✅ System Settings Page loaded');

})();
