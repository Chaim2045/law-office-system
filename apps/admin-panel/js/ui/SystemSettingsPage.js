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
            <h1><i class="fas fa-cog"></i> הגדרות מערכת</h1>
            <p>ניהול הגדרות מרכזיות למערכת משרד עורכי הדין</p>
            ${this.version ? '<span class="settings-version">גרסה ' + this.version + '</span>' : ''}
          </div>

          ${this._renderAdminEmailsSection()}
          ${this._renderBusinessLimitsSection()}
          ${this._renderIdleTimeoutSection()}
          ${this._renderServiceTypesSection()}
          ${this._renderRolesSection()}
          ${this._renderStagesSection()}
        </div>
      `;

      this._bindEvents();
    },

    // ═══════════════════════════════════════════
    // Section Renderers
    // ═══════════════════════════════════════════

    _renderAdminEmailsSection: function() {
      const emails = this.config.adminEmails || this.config.ADMIN_EMAILS || [];
      const items = emails.map(function(email, i) {
        return '<li class="email-list-item">' +
          '<span class="email-text">' + _escapeHtml(email) + '</span>' +
          '<button class="email-remove-btn" data-index="' + i + '" title="הסר"><i class="fas fa-times"></i></button>' +
          '</li>';
      }).join('');

      return `
        <div class="settings-section" id="section-admin-emails">
          <div class="settings-section-header">
            <div class="settings-section-icon red"><i class="fas fa-shield-alt"></i></div>
            <span class="settings-section-title">מיילים של מנהלים</span>
          </div>
          <ul class="email-list" id="admin-email-list">${items}</ul>
          <div class="settings-input-row">
            <input type="email" class="settings-input" id="new-admin-email" placeholder="הוסף מייל מנהל..." dir="ltr">
            <button class="settings-add-btn" id="add-email-btn"><i class="fas fa-plus"></i> הוסף</button>
          </div>
          <button class="settings-save-btn" id="save-emails-btn"><i class="fas fa-save"></i> שמור</button>
          <div class="settings-status" id="emails-status"></div>
        </div>
      `;
    },

    _renderBusinessLimitsSection: function() {
      const limits = this.config.businessLimits || this.config.BUSINESS_LIMITS || {};
      return `
        <div class="settings-section" id="section-business-limits">
          <div class="settings-section-header">
            <div class="settings-section-icon orange"><i class="fas fa-sliders-h"></i></div>
            <span class="settings-section-title">מגבלות עסקיות</span>
          </div>
          <div class="settings-form-group">
            <label>מקסימום שעות לחבילה</label>
            <input type="number" class="settings-input" id="limit-max-hours" value="${limits.maxPackageHours || limits.MAX_PACKAGE_HOURS || 500}" min="1" max="10000">
          </div>
          <div class="settings-form-group">
            <label>מקסימום שעות לשלב</label>
            <input type="number" class="settings-input" id="limit-max-stage-hours" value="${limits.maxStageHours || limits.MAX_STAGE_HOURS || 1000}" min="1" max="10000">
          </div>
          <div class="settings-form-group">
            <label>מקסימום מחיר קבוע (₪)</label>
            <input type="number" class="settings-input" id="limit-max-fixed-price" value="${limits.maxFixedPrice || limits.MAX_FIXED_PRICE || 1000000}" min="1" max="10000000">
          </div>
          <button class="settings-save-btn" id="save-limits-btn"><i class="fas fa-save"></i> שמור</button>
          <div class="settings-status" id="limits-status"></div>
        </div>
      `;
    },

    _renderIdleTimeoutSection: function() {
      const timeout = this.config.idleTimeout || this.config.IDLE_TIMEOUT || {};
      const idleMinutes = Math.round((timeout.idleMs || timeout.IDLE_MS || 600000) / 60000);
      const warningMinutes = Math.round((timeout.warningMs || timeout.WARNING_MS || 300000) / 60000);
      return `
        <div class="settings-section" id="section-idle-timeout">
          <div class="settings-section-header">
            <div class="settings-section-icon blue"><i class="fas fa-clock"></i></div>
            <span class="settings-section-title">זמן אי-פעילות</span>
          </div>
          <div class="settings-form-group">
            <label>זמן אי-פעילות לפני אזהרה (דקות)</label>
            <input type="number" class="settings-input" id="idle-minutes" value="${idleMinutes}" min="1" max="60">
          </div>
          <div class="settings-form-group">
            <label>זמן אזהרה לפני ניתוק (דקות)</label>
            <input type="number" class="settings-input" id="warning-minutes" value="${warningMinutes}" min="1" max="30">
          </div>
          <button class="settings-save-btn" id="save-timeout-btn"><i class="fas fa-save"></i> שמור</button>
          <div class="settings-status" id="timeout-status"></div>
        </div>
      `;
    },

    _renderServiceTypesSection: function() {
      const types = this.config.serviceTypes || this.config.SERVICE_TYPE_LABELS || {};
      let rows = '';

      if (this.config.serviceTypes) {
        Object.keys(types).forEach(function(key) {
          const t = types[key];
          rows += '<tr><td class="key-cell">' + _escapeHtml(key) + '</td>' +
            '<td><input type="text" class="settings-input" data-service-key="' + key + '" value="' + _escapeHtml(t.label || key) + '"></td>' +
            '<td>' + (t.active !== false ? '<i class="fas fa-check" style="color:#16a34a"></i>' : '<i class="fas fa-times" style="color:#dc2626"></i>') + '</td></tr>';
        });
      } else {
        Object.keys(types).forEach(function(key) {
          rows += '<tr><td class="key-cell">' + _escapeHtml(key) + '</td>' +
            '<td>' + _escapeHtml(types[key]) + '</td>' +
            '<td><i class="fas fa-check" style="color:#16a34a"></i></td></tr>';
        });
      }

      return `
        <div class="settings-section" id="section-service-types">
          <div class="settings-section-header">
            <div class="settings-section-icon green"><i class="fas fa-layer-group"></i></div>
            <span class="settings-section-title">סוגי שירות</span>
          </div>
          <table class="settings-table">
            <thead><tr><th>מפתח</th><th>תווית</th><th>פעיל</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <button class="settings-save-btn" id="save-service-types-btn" style="margin-top: var(--space-3)"><i class="fas fa-save"></i> שמור תוויות</button>
          <div class="settings-status" id="service-types-status"></div>
        </div>
      `;
    },

    _renderRolesSection: function() {
      const roles = this.config.roles || this.config.ROLE_LABELS || {};
      let rows = '';

      if (this.config.roles) {
        Object.keys(roles).forEach(function(key) {
          const r = roles[key];
          rows += '<tr><td class="key-cell">' + _escapeHtml(key) + '</td>' +
            '<td><input type="text" class="settings-input" data-role-key="' + key + '" value="' + _escapeHtml(r.label || key) + '"></td></tr>';
        });
      } else {
        Object.keys(roles).forEach(function(key) {
          rows += '<tr><td class="key-cell">' + _escapeHtml(key) + '</td>' +
            '<td>' + _escapeHtml(roles[key]) + '</td></tr>';
        });
      }

      return `
        <div class="settings-section" id="section-roles">
          <div class="settings-section-header">
            <div class="settings-section-icon purple"><i class="fas fa-user-tag"></i></div>
            <span class="settings-section-title">תפקידים</span>
          </div>
          <table class="settings-table">
            <thead><tr><th>מפתח</th><th>תווית</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <button class="settings-save-btn" id="save-roles-btn" style="margin-top: var(--space-3)"><i class="fas fa-save"></i> שמור תוויות</button>
          <div class="settings-status" id="roles-status"></div>
        </div>
      `;
    },

    _renderStagesSection: function() {
      const stages = this.config.legalProcedureStages || this.config.STAGE_NAMES || {};
      let rows = '';

      if (this.config.legalProcedureStages) {
        Object.keys(stages).forEach(function(key) {
          const s = stages[key];
          rows += '<tr><td class="key-cell">' + _escapeHtml(key) + '</td>' +
            '<td>' + _escapeHtml(s.name || key) + '</td>' +
            '<td>' + (s.order || '') + '</td></tr>';
        });
      } else {
        Object.keys(stages).forEach(function(key) {
          rows += '<tr><td class="key-cell">' + _escapeHtml(key) + '</td>' +
            '<td>' + _escapeHtml(stages[key]) + '</td>' +
            '<td></td></tr>';
        });
      }

      return `
        <div class="settings-section" id="section-stages">
          <div class="settings-section-header">
            <div class="settings-section-icon blue"><i class="fas fa-list-ol"></i></div>
            <span class="settings-section-title">שלבי הליך משפטי</span>
          </div>
          <div class="settings-readonly-notice">
            <i class="fas fa-lock"></i>
            שלבי הליך הם קבועים ולא ניתנים לשינוי — שינוי מבנה השלבים דורש data migration
          </div>
          <table class="settings-table">
            <thead><tr><th>מפתח</th><th>שם</th><th>סדר</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    },

    // ═══════════════════════════════════════════
    // Event Binding
    // ═══════════════════════════════════════════

    _bindEvents: function() {
      const self = this;

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
      const removeButtons = document.querySelectorAll('.email-remove-btn');
      removeButtons.forEach(function(btn) {
        btn.addEventListener('click', function() {
          const index = parseInt(btn.dataset.index);
          self._removeEmail(index);
        });
      });

      // Save buttons
      const saveEmails = document.getElementById('save-emails-btn');
      if (saveEmails) {
 saveEmails.addEventListener('click', function() {
 self._saveEmails();
});
}

      const saveLimits = document.getElementById('save-limits-btn');
      if (saveLimits) {
 saveLimits.addEventListener('click', function() {
 self._saveLimits();
});
}

      const saveTimeout = document.getElementById('save-timeout-btn');
      if (saveTimeout) {
 saveTimeout.addEventListener('click', function() {
 self._saveTimeout();
});
}

      const saveServiceTypes = document.getElementById('save-service-types-btn');
      if (saveServiceTypes) {
 saveServiceTypes.addEventListener('click', function() {
 self._saveServiceTypes();
});
}

      const saveRoles = document.getElementById('save-roles-btn');
      if (saveRoles) {
 saveRoles.addEventListener('click', function() {
 self._saveRoles();
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

      // Rebind remove buttons
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
      const emails = this._getCurrentEmails();
      this._callUpdate({ adminEmails: emails }, 'emails-status');
    },

    _saveLimits: function() {
      const maxHours = parseInt(document.getElementById('limit-max-hours').value);
      const maxStageHours = parseInt(document.getElementById('limit-max-stage-hours').value);
      const maxFixedPrice = parseInt(document.getElementById('limit-max-fixed-price').value);

      this._callUpdate({
        businessLimits: {
          maxPackageHours: maxHours,
          maxStageHours: maxStageHours,
          maxFixedPrice: maxFixedPrice
        }
      }, 'limits-status');
    },

    _saveTimeout: function() {
      const idleMinutes = parseInt(document.getElementById('idle-minutes').value);
      const warningMinutes = parseInt(document.getElementById('warning-minutes').value);

      this._callUpdate({
        idleTimeout: {
          idleMs: idleMinutes * 60 * 1000,
          warningMs: warningMinutes * 60 * 1000
        }
      }, 'timeout-status');
    },

    _saveServiceTypes: function() {
      const inputs = document.querySelectorAll('[data-service-key]');
      const serviceTypes = {};
      inputs.forEach(function(input) {
        serviceTypes[input.dataset.serviceKey] = {
          label: input.value.trim(),
          active: true
        };
      });
      this._callUpdate({ serviceTypes: serviceTypes }, 'service-types-status');
    },

    _saveRoles: function() {
      const inputs = document.querySelectorAll('[data-role-key]');
      const roles = {};
      inputs.forEach(function(input) {
        roles[input.dataset.roleKey] = {
          label: input.value.trim(),
          active: true
        };
      });
      this._callUpdate({ roles: roles }, 'roles-status');
    },

    _callUpdate: function(data, statusId) {
      const self = this;
      if (self.saving) {
 return;
}
      self.saving = true;

      // Add expected version for optimistic locking
      data._expectedVersion = self.version;

      const updateFn = window.firebase.functions().httpsCallable('updateSystemConfig');

      self._showStatus(statusId, 'success', 'שומר...');

      updateFn(data)
        .then(function() {
          self._showStatus(statusId, 'success', 'נשמר בהצלחה');
          self.saving = false;
          // Reload config to get new version
          if (window.SystemConfigLoader) {
            window.SystemConfigLoader.loaded = false;
            window.SystemConfigLoader.load().then(function() {
              self.version = window.SystemConfigLoader.getVersion();
              // Update version display
              const versionEl = self.container.querySelector('.settings-version');
              if (versionEl && self.version) {
                versionEl.textContent = 'גרסה ' + self.version;
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
      if (type === 'success' && message !== 'שומר...') {
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
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  window.SystemSettingsPage = SystemSettingsPage;
  console.log('✅ System Settings Page loaded');

})();
