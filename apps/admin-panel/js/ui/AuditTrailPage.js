/**
 * Audit Trail Page
 * =================
 * Displays activity_log and audit_log entries in a filterable table.
 * Reads directly from Firestore collections.
 */

(function() {
  'use strict';

  const PAGE_SIZE = 50;

  // Action categories for badge colors
  const ACTION_CATEGORIES = {
    create: ['USER_CREATED', 'create_task', 'create_timesheet', 'create_client', 'CREATE_USER'],
    update: ['USER_UPDATED', 'edit_task', 'edit_timesheet', 'edit_client', 'UPDATE_USER', 'extend_deadline', 'update_progress'],
    delete: ['USER_DELETED', 'delete_task', 'delete_timesheet', 'delete_client', 'DELETE_USER', 'delete_user_data_selective'],
    block: ['USER_BLOCKED', 'USER_UNBLOCKED', 'block_client', 'unblock_client'],
    login: ['login', 'logout'],
    config: ['system_config_updated', 'system_config_rollback']
  };

  function getActionCategory(action) {
    for (const [cat, actions] of Object.entries(ACTION_CATEGORIES)) {
      if (actions.includes(action)) {
 return cat;
}
    }
    return 'other';
  }

  // Hebrew action labels
  const ACTION_LABELS = {
    // User activity (lowercase)
    'login': 'כניסה',
    'logout': 'יציאה',
    'create_task': 'יצירת משימה',
    'edit_task': 'עריכת משימה',
    'delete_task': 'מחיקת משימה',
    'complete_task': 'השלמת משימה',
    'extend_deadline': 'הארכת דדליין',
    'update_progress': 'עדכון התקדמות',
    'create_timesheet': 'רישום שעות',
    'edit_timesheet': 'עריכת שעות',
    'delete_timesheet': 'מחיקת שעות',
    'create_client': 'יצירת לקוח',
    'edit_client': 'עריכת לקוח',
    'delete_client': 'מחיקת לקוח',
    'block_client': 'חסימת לקוח',
    'unblock_client': 'ביטול חסימת לקוח',
    'generate_report': 'הפקת דוח',
    'export_data': 'ייצוא נתונים',
    // Admin actions (UPPERCASE — from audit_log)
    'USER_CREATED': 'יצירת משתמש',
    'USER_UPDATED': 'עדכון משתמש',
    'USER_DELETED': 'מחיקת משתמש',
    'USER_BLOCKED': 'חסימת משתמש',
    'USER_UNBLOCKED': 'ביטול חסימה',
    'CREATE_USER': 'יצירת משתמש',
    'UPDATE_USER': 'עדכון משתמש',
    'DELETE_USER': 'מחיקת משתמש',
    'VIEW_USER_DETAILS': 'צפייה בפרטי משתמש',
    'CREATE_TASK': 'יצירת משימה',
    'COMPLETE_TASK': 'השלמת משימה',
    'ADJUST_BUDGET': 'התאמת תקציב',
    'EXTEND_TASK_DEADLINE': 'הארכת דדליין',
    'CREATE_CLIENT': 'יצירת לקוח',
    'UPDATE_CLIENT': 'עדכון לקוח',
    'DELETE_CLIENT': 'מחיקת לקוח',
    'CHANGE_CLIENT_STATUS': 'שינוי סטטוס לקוח',
    'CLOSE_CASE': 'סגירת תיק',
    'ADD_SERVICE': 'הוספת שירות',
    'ADD_PACKAGE': 'הוספת חבילה',
    'delete_user_data_selective': 'מחיקת נתוני משתמש',
    'UPLOAD_FEE_AGREEMENT': 'העלאת הסכם שכ"ט',
    'DELETE_FEE_AGREEMENT': 'מחיקת הסכם שכ"ט',
    'ADD_TIME_TO_TASK': 'הוספת שעות למשימה',
    'ADD_SERVICE_TO_CLIENT': 'הוספת שירות ללקוח',
    'CREATE_QUICK_LOG_ENTRY': 'רישום שעות מהיר',
    'CANCEL_TASK': 'ביטול משימה',
    'MOVE_TO_NEXT_STAGE': 'מעבר לשלב הבא',
    'ADD_PACKAGE_TO_SERVICE': 'הוספת חבילה לשירות',
    'CHANGE_SERVICE_STATUS': 'שינוי סטטוס שירות',
    'COMPLETE_SERVICE': 'השלמת שירות',
    'DELETE_SERVICE': 'מחיקת שירות',
    'SET_SERVICE_OVERRIDE': 'ביטול חסימת שירות',
    'system_config_updated': 'עדכון הגדרות',
    'system_config_rollback': 'שחזור הגדרות'
  };

  // Hebrew labels for detail keys
  const DETAIL_KEY_LABELS = {
    'targetEmail': 'משתמש',
    'clientId': 'לקוח',
    'clientName': 'לקוח',
    'caseNumber': 'תיק',
    'estimatedHours': 'שעות מוערכות',
    'actualMinutes': 'דקות בפועל',
    'minutes': 'זמן',
    'gapPercent': 'חריגה',
    'oldEstimate': 'הערכה קודמת',
    'newEstimate': 'הערכה חדשה',
    'addedMinutes': 'דקות שנוספו',
    'reason': 'סיבה',
    'role': 'תפקיד',
    'status': 'סטטוס',
    'message': 'הודעה',
    'username': 'שם',
    'changes': 'שינויים',
    'fileName': 'קובץ',
    'fileSize': 'גודל',
    'serviceName': 'שירות',
    'serviceType': 'סוג שירות',
    'newDeadline': 'דדליין חדש',
    'oldDeadline': 'דדליין קודם',
    'date': 'תאריך'
  };

  // Keys to skip in details (shown elsewhere or internal/technical)
  const DETAIL_SKIP_KEYS = [
    'entityId', 'loginTime', 'isCritical', '_seconds', '_nanoseconds',
    'targetEmail', 'targetUser', 'clientName', 'agreementId',
    'fileType', 'userAgent', 'ipAddress',
    'taskId', 'entryId', 'autoTimesheetCreated', 'clientUpdated'
  ];

  const AuditTrailPage = {
    container: null,
    db: null,
    entries: [],
    filteredEntries: [],
    currentPage: 1,
    totalLoaded: 0,
    loading: false,
    source: 'all', // 'all', 'activity', 'audit'
    filters: {
      action: '',
      user: '',
      dateFrom: '',
      dateTo: ''
    },

    init: function(containerId) {
      this.container = document.getElementById(containerId);
      if (!this.container) {
 return;
}

      this.db = window.firebaseDB;
      if (!this.db) {
        this.container.innerHTML = '<p>שגיאה: Firestore לא מאותחל</p>';
        return;
      }

      this.render();
      this.loadData();
    },

    render: function() {
      this.container.innerHTML = `
        <div class="audit-page">
          <div class="audit-header">
            <h1><i class="fas fa-history"></i> לוג פעילות</h1>
            <div class="audit-stats" id="audit-stats"></div>
          </div>

          <div class="audit-filters">
            <div class="audit-source-tabs" id="source-tabs">
              <button class="audit-source-tab active" data-source="all">הכל</button>
              <button class="audit-source-tab" data-source="activity">פעילות משתמשים</button>
              <button class="audit-source-tab" data-source="audit">פעולות מנהל</button>
            </div>

            <div class="audit-filter-group">
              <label>פעולה:</label>
              <select class="audit-filter-select" id="filter-action">
                <option value="">הכל</option>
                <optgroup label="כניסה/יציאה">
                  <option value="login">כניסה</option>
                  <option value="logout">יציאה</option>
                </optgroup>
                <optgroup label="משימות">
                  <option value="create_task">יצירת משימה</option>
                  <option value="edit_task">עריכת משימה</option>
                  <option value="delete_task">מחיקת משימה</option>
                  <option value="complete_task">השלמת משימה</option>
                </optgroup>
                <optgroup label="שעתון">
                  <option value="create_timesheet">רישום שעות</option>
                  <option value="edit_timesheet">עריכת שעות</option>
                  <option value="delete_timesheet">מחיקת שעות</option>
                </optgroup>
                <optgroup label="לקוחות">
                  <option value="create_client">יצירת לקוח</option>
                  <option value="edit_client">עריכת לקוח</option>
                  <option value="delete_client">מחיקת לקוח</option>
                </optgroup>
                <optgroup label="ניהול משתמשים">
                  <option value="USER_CREATED">יצירת משתמש</option>
                  <option value="USER_UPDATED">עדכון משתמש</option>
                  <option value="USER_DELETED">מחיקת משתמש</option>
                  <option value="USER_BLOCKED">חסימת משתמש</option>
                </optgroup>
                <optgroup label="מערכת">
                  <option value="system_config_updated">עדכון הגדרות</option>
                </optgroup>
              </select>
            </div>

            <div class="audit-filter-group">
              <label>משתמש:</label>
              <input type="text" class="audit-filter-input" id="filter-user" placeholder="מייל או שם..." dir="ltr">
            </div>

            <div class="audit-filter-group">
              <label>מ:</label>
              <input type="date" class="audit-filter-input" id="filter-date-from">
            </div>
            <div class="audit-filter-group">
              <label>עד:</label>
              <input type="date" class="audit-filter-input" id="filter-date-to">
            </div>

            <button class="audit-filter-btn" id="btn-apply-filters"><i class="fas fa-search"></i> סנן</button>
            <button class="audit-filter-btn secondary" id="btn-reset-filters"><i class="fas fa-undo"></i> נקה</button>
          </div>

          <div class="audit-table-wrapper">
            <div id="audit-table-content">
              <div class="audit-loading"><i class="fas fa-spinner fa-spin"></i> טוען נתונים...</div>
            </div>
          </div>
        </div>
      `;

      this._bindEvents();
    },

    _bindEvents: function() {
      const self = this;

      // Source tabs
      document.querySelectorAll('.audit-source-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
          document.querySelectorAll('.audit-source-tab').forEach(function(t) {
 t.classList.remove('active');
});
          tab.classList.add('active');
          self.source = tab.dataset.source;
          self.currentPage = 1;
          self.loadData();
        });
      });

      // Apply filters
      document.getElementById('btn-apply-filters').addEventListener('click', function() {
        self._applyFilters();
      });

      // Reset filters
      document.getElementById('btn-reset-filters').addEventListener('click', function() {
        document.getElementById('filter-action').value = '';
        document.getElementById('filter-user').value = '';
        document.getElementById('filter-date-from').value = '';
        document.getElementById('filter-date-to').value = '';
        self.filters = { action: '', user: '', dateFrom: '', dateTo: '' };
        self.currentPage = 1;
        self.loadData();
      });

      // Enter key on user filter
      document.getElementById('filter-user').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
 self._applyFilters();
}
      });
    },

    _applyFilters: function() {
      this.filters.action = document.getElementById('filter-action').value;
      this.filters.user = document.getElementById('filter-user').value.trim().toLowerCase();
      this.filters.dateFrom = document.getElementById('filter-date-from').value;
      this.filters.dateTo = document.getElementById('filter-date-to').value;
      this.currentPage = 1;
      this.loadData();
    },

    // ═══════════════════════════════════════════
    // Data Loading
    // ═══════════��═══════════════════════════════

    loadData: async function() {
      if (this.loading) {
 return;
}
      this.loading = true;

      const content = document.getElementById('audit-table-content');
      content.innerHTML = '<div class="audit-loading"><i class="fas fa-spinner fa-spin"></i> טוען נתונים...</div>';

      try {
        const results = [];

        // Load from activity_log
        if (this.source === 'all' || this.source === 'activity') {
          const activityDocs = await this._queryCollection('activity_log');
          activityDocs.forEach(function(doc) {
            const data = doc.data();
            // Prefer username (Hebrew) over email, never show raw UID
            const displayUser = data.username || data.userEmail || _emailFromUid(data.userId) || '';
            results.push({
              id: doc.id,
              source: 'activity',
              action: data.action || data.type || '',
              user: displayUser,
              username: data.username || '',
              target: data.targetUser || '',
              details: data.details || '',
              severity: data.severity || 'info',
              timestamp: data.timestamp,
              timestampLocal: data.timestampLocal || null
            });
          });
        }

        // Load from audit_log
        if (this.source === 'all' || this.source === 'audit') {
          const auditDocs = await this._queryCollection('audit_log');
          auditDocs.forEach(function(doc) {
            const data = doc.data();
            // Prefer name (Hebrew) over email, never show raw UID
            const displayUser = data.performedByName || data.username || data.performedBy || data.adminEmail || _emailFromUid(data.userId) || '';
            // Extract target from details if not in top-level field
            const det = _parseDetails(data.details);
            let target = data.targetUser || data.targetUserEmail || '';
            if (!target) {
              target = det.targetEmail || det.targetUser || det.clientName || '';
            }
            results.push({
              id: doc.id,
              source: 'audit',
              action: data.action || '',
              user: displayUser,
              username: data.performedByName || data.username || '',
              target: target,
              details: data.details || '',
              severity: data.severity || 'info',
              timestamp: data.timestamp,
              timestampLocal: data.timestampLocal || null
            });
          });
        }

        // Sort by timestamp desc
        results.sort(function(a, b) {
          const ta = a.timestamp?.toMillis?.() || 0;
          const tb = b.timestamp?.toMillis?.() || 0;
          return tb - ta;
        });

        this.entries = results;
        this.totalLoaded = results.length;
        this._renderTable();
        this._renderStats();

      } catch (error) {
        console.error('Error loading audit data:', error);
        content.innerHTML = '<div class="audit-empty"><i class="fas fa-exclamation-triangle"></i><p>שגיאה בטעינת נתונים</p></div>';
      }

      this.loading = false;
    },

    _queryCollection: async function(collectionName) {
      let query = this.db.collection(collectionName)
        .orderBy('timestamp', 'desc')
        .limit(500);

      // Date filters
      if (this.filters.dateFrom) {
        const from = new Date(this.filters.dateFrom);
        from.setHours(0, 0, 0, 0);
        query = query.where('timestamp', '>=', from);
      }

      if (this.filters.dateTo) {
        const to = new Date(this.filters.dateTo);
        to.setHours(23, 59, 59, 999);
        query = query.where('timestamp', '<=', to);
      }

      const snapshot = await query.get();
      const docs = [];

      snapshot.forEach(function(doc) {
 docs.push(doc);
});

      // Client-side filtering (action and user)
      return docs.filter(function(doc) {
        const data = doc.data();

        if (this.filters.action) {
          const docAction = data.action || data.type || '';
          if (docAction !== this.filters.action) {
 return false;
}
        }

        if (this.filters.user) {
          const searchTerm = this.filters.user;
          const userFields = [
            data.userEmail, data.userId, data.username,
            data.performedBy, data.adminEmail, data.performedByName,
            data.targetUser, data.targetUserEmail
          ].filter(Boolean).join(' ').toLowerCase();

          if (!userFields.includes(searchTerm)) {
 return false;
}
        }

        return true;
      }.bind(this));
    },

    // ═══════════════════════════════════════════
    // Rendering
    // ═══════════════════════════════════════════

    _renderStats: function() {
      const statsEl = document.getElementById('audit-stats');
      if (!statsEl) {
 return;
}

      const actCount = this.entries.filter(function(e) {
 return e.source === 'activity';
}).length;
      const audCount = this.entries.filter(function(e) {
 return e.source === 'audit';
}).length;

      statsEl.innerHTML =
        '<span class="audit-stat"><strong>' + this.entries.length + '</strong> רשומות</span>' +
        '<span class="audit-stat"><strong>' + actCount + '</strong> פעילות</span>' +
        '<span class="audit-stat"><strong>' + audCount + '</strong> ניהול</span>';
    },

    _renderTable: function() {
      const content = document.getElementById('audit-table-content');
      if (!content) {
 return;
}

      if (this.entries.length === 0) {
        content.innerHTML = '<div class="audit-empty"><i class="fas fa-clipboard-list"></i><p>לא נמצאו רשומות</p></div>';
        return;
      }

      // Pagination
      const totalPages = Math.ceil(this.entries.length / PAGE_SIZE);
      const start = (this.currentPage - 1) * PAGE_SIZE;
      const pageEntries = this.entries.slice(start, start + PAGE_SIZE);

      let rows = '';
      pageEntries.forEach(function(entry) {
        const cat = getActionCategory(entry.action);
        const actionLabel = ACTION_LABELS[entry.action] || entry.action;
        const timeStr = _formatTimestamp(entry.timestamp, entry.timestampLocal);
        const detailsStr = _formatDetails(entry.details);
        const sourceIcon = entry.source === 'audit'
          ? '<i class="fas fa-shield-alt" style="color:#9333ea;font-size:11px" title="פעולת מנהל"></i>'
          : '<i class="fas fa-user" style="color:#6b7280;font-size:11px" title="פעילות משתמש"></i>';

        rows += '<tr>' +
          '<td>' + sourceIcon + '</td>' +
          '<td class="audit-time-cell">' + timeStr + '</td>' +
          '<td><span class="audit-action-badge ' + cat + '">' + _escapeHtml(actionLabel) + '</span></td>' +
          '<td class="audit-user-cell">' + _escapeHtml(entry.user) + '</td>' +
          '<td class="audit-user-cell">' + _escapeHtml(entry.target || '') + '</td>' +
          '<td class="audit-details">' + detailsStr + '</td>' +
          '</tr>';
      });

      content.innerHTML = `
        <table class="audit-table">
          <thead>
            <tr>
              <th style="width:30px"></th>
              <th>זמן</th>
              <th>פעולה</th>
              <th>בוצע ע"י</th>
              <th>יעד</th>
              <th>פרטים</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        ${this._renderPagination(totalPages)}
      `;

      // Bind pagination
      this._bindPagination();
    },

    _renderPagination: function(totalPages) {
      if (totalPages <= 1) {
 return '';
}

      const self = this;
      let btns = '';

      btns += '<button class="audit-page-btn" data-page="prev" ' + (self.currentPage <= 1 ? 'disabled' : '') + '><i class="fas fa-chevron-right"></i></button>';

      const startPage = Math.max(1, self.currentPage - 2);
      const endPage = Math.min(totalPages, startPage + 4);

      for (let i = startPage; i <= endPage; i++) {
        btns += '<button class="audit-page-btn ' + (i === self.currentPage ? 'active' : '') + '" data-page="' + i + '">' + i + '</button>';
      }

      btns += '<button class="audit-page-btn" data-page="next" ' + (self.currentPage >= totalPages ? 'disabled' : '') + '><i class="fas fa-chevron-left"></i></button>';

      const start = (self.currentPage - 1) * PAGE_SIZE + 1;
      const end = Math.min(self.currentPage * PAGE_SIZE, self.entries.length);

      return '<div class="audit-pagination">' +
        '<span class="audit-pagination-info">' + start + '-' + end + ' מתוך ' + self.entries.length + '</span>' +
        '<div class="audit-pagination-btns">' + btns + '</div>' +
        '</div>';
    },

    _bindPagination: function() {
      const self = this;
      const totalPages = Math.ceil(self.entries.length / PAGE_SIZE);

      document.querySelectorAll('.audit-page-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          const page = btn.dataset.page;
          if (page === 'prev' && self.currentPage > 1) {
            self.currentPage--;
          } else if (page === 'next' && self.currentPage < totalPages) {
            self.currentPage++;
          } else if (page !== 'prev' && page !== 'next') {
            self.currentPage = parseInt(page);
          }
          self._renderTable();
          // Scroll to top of table
          document.querySelector('.audit-table-wrapper')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    }
  };

  // ═══════════════════════════════════════════
  // Utility Functions
  // ═══════════════════════════════════════════

  /**
   * If a field contains a raw Firebase UID (no @ sign, long alphanumeric),
   * return empty string so we don't show it to the user.
   */
  function _emailFromUid(val) {
    if (!val) {
 return '';
}
    // If it looks like an email, return it
    if (val.includes('@')) {
 return val;
}
    // Raw UID — don't display it
    return '';
  }

  /**
   * Parse details field — can be string (JSON) or object
   */
  function _parseDetails(details) {
    if (!details) {
 return {};
}
    if (typeof details === 'object') {
 return details;
}
    if (typeof details === 'string') {
      try {
 return JSON.parse(details);
} catch (e) {
 return {};
}
    }
    return {};
  }

  function _formatTimestamp(ts, localStr) {
    if (!ts && !localStr) {
 return '-';
}

    try {
      const date = ts?.toDate?.() || new Date(localStr);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return day + '/' + month + ' ' + hours + ':' + minutes;
    } catch (e) {
      return '-';
    }
  }

  function _formatDetails(details) {
    if (!details) {
 return '';
}
    const obj = _parseDetails(details);
    if (typeof obj === 'object' && Object.keys(obj).length > 0) {
      return _escapeHtml(_summarizeObject(obj));
    }
    if (typeof details === 'string') {
      return _escapeHtml(details.substring(0, 80));
    }
    return '';
  }

  function _summarizeObject(obj) {
    if (!obj) {
 return '';
}
    if (obj.message) {
 return obj.message;
}
    const keys = Object.keys(obj);
    if (keys.length === 0) {
 return '';
}
    const parts = [];
    keys.forEach(function(key) {
      if (DETAIL_SKIP_KEYS.includes(key)) {
 return;
}
      if (parts.length >= 3) {
 return;
}
      let val = obj[key];
      if (val === null || val === undefined) {
 return;
}
      if (typeof val === 'object') {
 return;
}
      val = _formatValue(key, val);
      const label = DETAIL_KEY_LABELS[key] || key;
      parts.push(label + ': ' + val);
    });
    return parts.join(' | ');
  }

  function _formatValue(key, val) {
    if (key === 'fileSize' && typeof val === 'number') {
      return val > 1048576 ? (val / 1048576).toFixed(1) + ' MB' : Math.round(val / 1024) + ' KB';
    }
    if ((key === 'minutes' || key === 'actualMinutes' || key === 'addedMinutes' || key === 'oldEstimate' || key === 'newEstimate') && typeof val === 'number') {
      if (val >= 60) {
        const h = Math.floor(val / 60);
        const m = val % 60;
        return m > 0 ? h + ' שעות ' + m + ' דקות' : h + ' שעות';
      }
      return val + ' דקות';
    }
    if (key === 'estimatedHours' && typeof val === 'number') {
      return Math.round(val * 10) / 10 + ' שעות';
    }
    if (key === 'gapPercent' && typeof val === 'number') {
      return val + '%';
    }
    if ((key === 'date' || key === 'newDeadline' || key === 'oldDeadline') && typeof val === 'string') {
      try {
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
          return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
        }
      } catch (e) { /* fall through */ }
    }
    if (key === 'serviceType' && window.SystemConstantsHelpers) {
      const label = window.SystemConstantsHelpers.getServiceTypeLabel(val);
      if (label !== val) {
 return label;
}
    }
    return val;
  }

  function _escapeHtml(str) {
    if (!str) {
 return '';
}
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.AuditTrailPage = AuditTrailPage;
  console.log('✅ Audit Trail Page loaded');

})();
