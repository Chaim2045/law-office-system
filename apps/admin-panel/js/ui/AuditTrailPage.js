/**
 * Audit Trail Page — User Profiles
 * ==================================
 * Two views:
 *   1. Profile list — all employees from Firestore
 *   2. Profile detail — activity log for a single user
 *
 * Data sources:
 *   - employees collection (profile list)
 *   - audit_log + activity_log (user activity)
 */

(function() {
  'use strict';

  const PAGE_SIZE = 50;

  // ═══════════════════════════════════════════
  // Action Categories & Labels (kept from original)
  // ═══════════════════════════════════════════

  const ACTION_CATEGORIES = {
    create: ['USER_CREATED', 'create_task', 'create_timesheet', 'create_client', 'CREATE_USER',
      'CREATE_TASK', 'CREATE_CLIENT', 'CREATE_CASE', 'CREATE_TIMESHEET_ENTRY', 'CREATE_TIMESHEET_ENTRY_V2',
      'ADD_SERVICE_TO_CLIENT', 'ADD_SERVICE_TO_CASE', 'ADD_SERVICE', 'ADD_PACKAGE',
      'ADD_PACKAGE_TO_SERVICE', 'ADD_PACKAGE_TO_STAGE', 'CREATE_QUICK_LOG_ENTRY',
      'UPLOAD_FEE_AGREEMENT', 'ADD_TIME_TO_TASK'],
    update: ['USER_UPDATED', 'edit_task', 'edit_timesheet', 'edit_client', 'UPDATE_USER',
      'extend_deadline', 'update_progress', 'COMPLETE_TASK', 'EXTEND_TASK_DEADLINE',
      'ADJUST_BUDGET', 'UPDATE_CLIENT', 'CHANGE_CLIENT_STATUS', 'CLOSE_CASE',
      'UPDATE_TASK_BY_ADMIN', 'TASK_UPDATED_BY_ADMIN', 'MOVE_TO_NEXT_STAGE',
      'CHANGE_SERVICE_STATUS', 'COMPLETE_SERVICE', 'SET_SERVICE_OVERRIDE',
      'REMOVE_SERVICE_OVERRIDE', 'RESOLVE_SERVICE_OVERDRAFT', 'UNRESOLVE_SERVICE_OVERDRAFT',
      'complete_task', 'CANCEL_TASK',
      'MIGRATE_CLIENTS_TO_CASES', 'MIGRATE_CASES_TO_CLIENTS'],
    delete: ['USER_DELETED', 'delete_task', 'delete_timesheet', 'delete_client',
      'DELETE_USER', 'delete_user_data_selective', 'DELETE_CLIENT', 'DELETE_SERVICE',
      'DELETE_FEE_AGREEMENT'],
    block: ['USER_BLOCKED', 'USER_UNBLOCKED', 'block_client', 'unblock_client'],
    login: ['login', 'logout'],
    config: ['system_config_updated', 'system_config_rollback']
  };

  const ACTION_LABELS = {
    'login': '\u05db\u05e0\u05d9\u05e1\u05d4',
    'logout': '\u05d9\u05e6\u05d9\u05d0\u05d4',
    'create_task': '\u05d9\u05e6\u05d9\u05e8\u05ea \u05de\u05e9\u05d9\u05de\u05d4',
    'edit_task': '\u05e2\u05e8\u05d9\u05db\u05ea \u05de\u05e9\u05d9\u05de\u05d4',
    'delete_task': '\u05de\u05d7\u05d9\u05e7\u05ea \u05de\u05e9\u05d9\u05de\u05d4',
    'complete_task': '\u05d4\u05e9\u05dc\u05de\u05ea \u05de\u05e9\u05d9\u05de\u05d4',
    'extend_deadline': '\u05d4\u05d0\u05e8\u05db\u05ea \u05d3\u05d3\u05dc\u05d9\u05d9\u05df',
    'update_progress': '\u05e2\u05d3\u05db\u05d5\u05df \u05d4\u05ea\u05e7\u05d3\u05de\u05d5\u05ea',
    'create_timesheet': '\u05e8\u05d9\u05e9\u05d5\u05dd \u05e9\u05e2\u05d5\u05ea',
    'edit_timesheet': '\u05e2\u05e8\u05d9\u05db\u05ea \u05e9\u05e2\u05d5\u05ea',
    'delete_timesheet': '\u05de\u05d7\u05d9\u05e7\u05ea \u05e9\u05e2\u05d5\u05ea',
    'create_client': '\u05d9\u05e6\u05d9\u05e8\u05ea \u05dc\u05e7\u05d5\u05d7',
    'edit_client': '\u05e2\u05e8\u05d9\u05db\u05ea \u05dc\u05e7\u05d5\u05d7',
    'delete_client': '\u05de\u05d7\u05d9\u05e7\u05ea \u05dc\u05e7\u05d5\u05d7',
    'block_client': '\u05d7\u05e1\u05d9\u05de\u05ea \u05dc\u05e7\u05d5\u05d7',
    'unblock_client': '\u05d1\u05d9\u05d8\u05d5\u05dc \u05d7\u05e1\u05d9\u05de\u05ea \u05dc\u05e7\u05d5\u05d7',
    'generate_report': '\u05d4\u05e4\u05e7\u05ea \u05d3\u05d5\u05d7',
    'export_data': '\u05d9\u05d9\u05e6\u05d5\u05d0 \u05e0\u05ea\u05d5\u05e0\u05d9\u05dd',
    'USER_CREATED': '\u05d9\u05e6\u05d9\u05e8\u05ea \u05de\u05e9\u05ea\u05de\u05e9',
    'USER_UPDATED': '\u05e2\u05d3\u05db\u05d5\u05df \u05de\u05e9\u05ea\u05de\u05e9',
    'USER_DELETED': '\u05de\u05d7\u05d9\u05e7\u05ea \u05de\u05e9\u05ea\u05de\u05e9',
    'USER_BLOCKED': '\u05d7\u05e1\u05d9\u05de\u05ea \u05de\u05e9\u05ea\u05de\u05e9',
    'USER_UNBLOCKED': '\u05d1\u05d9\u05d8\u05d5\u05dc \u05d7\u05e1\u05d9\u05de\u05d4',
    'CREATE_USER': '\u05d9\u05e6\u05d9\u05e8\u05ea \u05de\u05e9\u05ea\u05de\u05e9',
    'UPDATE_USER': '\u05e2\u05d3\u05db\u05d5\u05df \u05de\u05e9\u05ea\u05de\u05e9',
    'DELETE_USER': '\u05de\u05d7\u05d9\u05e7\u05ea \u05de\u05e9\u05ea\u05de\u05e9',
    'VIEW_USER_DETAILS': '\u05e6\u05e4\u05d9\u05d9\u05d4 \u05d1\u05e4\u05e8\u05d8\u05d9 \u05de\u05e9\u05ea\u05de\u05e9',
    'CREATE_TASK': '\u05d9\u05e6\u05d9\u05e8\u05ea \u05de\u05e9\u05d9\u05de\u05d4',
    'COMPLETE_TASK': '\u05d4\u05e9\u05dc\u05de\u05ea \u05de\u05e9\u05d9\u05de\u05d4',
    'ADJUST_BUDGET': '\u05d4\u05ea\u05d0\u05de\u05ea \u05ea\u05e7\u05e6\u05d9\u05d1',
    'EXTEND_TASK_DEADLINE': '\u05d4\u05d0\u05e8\u05db\u05ea \u05d3\u05d3\u05dc\u05d9\u05d9\u05df',
    'CREATE_CLIENT': '\u05d9\u05e6\u05d9\u05e8\u05ea \u05dc\u05e7\u05d5\u05d7',
    'UPDATE_CLIENT': '\u05e2\u05d3\u05db\u05d5\u05df \u05dc\u05e7\u05d5\u05d7',
    'DELETE_CLIENT': '\u05de\u05d7\u05d9\u05e7\u05ea \u05dc\u05e7\u05d5\u05d7',
    'CHANGE_CLIENT_STATUS': '\u05e9\u05d9\u05e0\u05d5\u05d9 \u05e1\u05d8\u05d8\u05d5\u05e1 \u05dc\u05e7\u05d5\u05d7',
    'CLOSE_CASE': '\u05e1\u05d2\u05d9\u05e8\u05ea \u05ea\u05d9\u05e7',
    'ADD_SERVICE': '\u05d4\u05d5\u05e1\u05e4\u05ea \u05e9\u05d9\u05e8\u05d5\u05ea',
    'ADD_PACKAGE': '\u05d4\u05d5\u05e1\u05e4\u05ea \u05d7\u05d1\u05d9\u05dc\u05d4',
    'delete_user_data_selective': '\u05de\u05d7\u05d9\u05e7\u05ea \u05e0\u05ea\u05d5\u05e0\u05d9 \u05de\u05e9\u05ea\u05de\u05e9',
    'UPLOAD_FEE_AGREEMENT': '\u05d4\u05e2\u05dc\u05d0\u05ea \u05d4\u05e1\u05db\u05dd \u05e9\u05db"\u05d8',
    'DELETE_FEE_AGREEMENT': '\u05de\u05d7\u05d9\u05e7\u05ea \u05d4\u05e1\u05db\u05dd \u05e9\u05db"\u05d8',
    'ADD_TIME_TO_TASK': '\u05d4\u05d5\u05e1\u05e4\u05ea \u05e9\u05e2\u05d5\u05ea \u05dc\u05de\u05e9\u05d9\u05de\u05d4',
    'ADD_SERVICE_TO_CLIENT': '\u05d4\u05d5\u05e1\u05e4\u05ea \u05e9\u05d9\u05e8\u05d5\u05ea \u05dc\u05dc\u05e7\u05d5\u05d7',
    'CREATE_QUICK_LOG_ENTRY': '\u05e8\u05d9\u05e9\u05d5\u05dd \u05e9\u05e2\u05d5\u05ea \u05de\u05d4\u05d9\u05e8',
    'CANCEL_TASK': '\u05d1\u05d9\u05d8\u05d5\u05dc \u05de\u05e9\u05d9\u05de\u05d4',
    'MOVE_TO_NEXT_STAGE': '\u05de\u05e2\u05d1\u05e8 \u05dc\u05e9\u05dc\u05d1 \u05d4\u05d1\u05d0',
    'ADD_PACKAGE_TO_SERVICE': '\u05d4\u05d5\u05e1\u05e4\u05ea \u05d7\u05d1\u05d9\u05dc\u05d4 \u05dc\u05e9\u05d9\u05e8\u05d5\u05ea',
    'CHANGE_SERVICE_STATUS': '\u05e9\u05d9\u05e0\u05d5\u05d9 \u05e1\u05d8\u05d8\u05d5\u05e1 \u05e9\u05d9\u05e8\u05d5\u05ea',
    'COMPLETE_SERVICE': '\u05d4\u05e9\u05dc\u05de\u05ea \u05e9\u05d9\u05e8\u05d5\u05ea',
    'DELETE_SERVICE': '\u05de\u05d7\u05d9\u05e7\u05ea \u05e9\u05d9\u05e8\u05d5\u05ea',
    'SET_SERVICE_OVERRIDE': '\u05d1\u05d9\u05d8\u05d5\u05dc \u05d7\u05e1\u05d9\u05de\u05ea \u05e9\u05d9\u05e8\u05d5\u05ea',
    'REMOVE_SERVICE_OVERRIDE': '\u05d4\u05e1\u05e8\u05ea \u05d1\u05d9\u05d8\u05d5\u05dc \u05d7\u05e1\u05d9\u05de\u05d4',
    'RESOLVE_SERVICE_OVERDRAFT': '\u05e4\u05ea\u05e8\u05d5\u05df \u05d7\u05e8\u05d9\u05d2\u05ea \u05e9\u05d9\u05e8\u05d5\u05ea',
    'UNRESOLVE_SERVICE_OVERDRAFT': '\u05d1\u05d9\u05d8\u05d5\u05dc \u05e4\u05ea\u05e8\u05d5\u05df \u05d7\u05e8\u05d9\u05d2\u05d4',
    'CREATE_TIMESHEET_ENTRY_V2': '\u05e8\u05d9\u05e9\u05d5\u05dd \u05e9\u05e2\u05d5\u05ea',
    'CREATE_TIMESHEET_ENTRY': '\u05e8\u05d9\u05e9\u05d5\u05dd \u05e9\u05e2\u05d5\u05ea (\u05d2\u05e8\u05e1\u05d4 \u05e7\u05d5\u05d3\u05de\u05ea)',
    'ADD_SERVICE_TO_CASE': '\u05d4\u05d5\u05e1\u05e4\u05ea \u05e9\u05d9\u05e8\u05d5\u05ea \u05dc\u05ea\u05d9\u05e7',
    'UPDATE_TASK_BY_ADMIN': '\u05e2\u05d3\u05db\u05d5\u05df \u05de\u05e9\u05d9\u05de\u05d4 \u05e2"\u05d9 \u05de\u05e0\u05d4\u05dc',
    'TASK_UPDATED_BY_ADMIN': '\u05e2\u05d3\u05db\u05d5\u05df \u05de\u05e9\u05d9\u05de\u05d4 \u05e2"\u05d9 \u05de\u05e0\u05d4\u05dc',
    'CREATE_CASE': '\u05d9\u05e6\u05d9\u05e8\u05ea \u05ea\u05d9\u05e7',
    'MIGRATE_CLIENTS_TO_CASES': '\u05d4\u05e2\u05d1\u05e8\u05ea \u05dc\u05e7\u05d5\u05d7\u05d5\u05ea \u05dc\u05ea\u05d9\u05e7\u05d9\u05dd',
    'MIGRATE_CASES_TO_CLIENTS': '\u05d4\u05e2\u05d1\u05e8\u05ea \u05ea\u05d9\u05e7\u05d9\u05dd \u05dc\u05dc\u05e7\u05d5\u05d7\u05d5\u05ea',
    'ADD_PACKAGE_TO_STAGE': '\u05d4\u05d5\u05e1\u05e4\u05ea \u05d7\u05d1\u05d9\u05dc\u05d4 \u05dc\u05e9\u05dc\u05d1',
    'system_config_updated': '\u05e2\u05d3\u05db\u05d5\u05df \u05d4\u05d2\u05d3\u05e8\u05d5\u05ea',
    'system_config_rollback': '\u05e9\u05d7\u05d6\u05d5\u05e8 \u05d4\u05d2\u05d3\u05e8\u05d5\u05ea',
    'VIEW_USER_ACTIVITY': '\u05e6\u05e4\u05d9\u05d9\u05d4 \u05d1\u05e4\u05e2\u05d9\u05dc\u05d5\u05ea \u05de\u05e9\u05ea\u05de\u05e9'
  };

  const DETAIL_KEY_LABELS = {
    'targetEmail': '\u05de\u05e9\u05ea\u05de\u05e9',
    'targetName': '\u05e9\u05dd',
    'targetRole': '\u05ea\u05e4\u05e7\u05d9\u05d3',
    'clientId': '\u05dc\u05e7\u05d5\u05d7',
    'clientName': '\u05dc\u05e7\u05d5\u05d7',
    'caseNumber': '\u05ea\u05d9\u05e7',
    'estimatedHours': '\u05e9\u05e2\u05d5\u05ea \u05de\u05d5\u05e2\u05e8\u05db\u05d5\u05ea',
    'actualMinutes': '\u05d3\u05e7\u05d5\u05ea \u05d1\u05e4\u05d5\u05e2\u05dc',
    'minutes': '\u05d6\u05de\u05df',
    'gapPercent': '\u05d7\u05e8\u05d9\u05d2\u05d4',
    'oldEstimate': '\u05d4\u05e2\u05e8\u05db\u05d4 \u05e7\u05d5\u05d3\u05de\u05ea',
    'newEstimate': '\u05d4\u05e2\u05e8\u05db\u05d4 \u05d7\u05d3\u05e9\u05d4',
    'addedMinutes': '\u05d3\u05e7\u05d5\u05ea \u05e9\u05e0\u05d5\u05e1\u05e4\u05d5',
    'reason': '\u05e1\u05d9\u05d1\u05d4',
    'note': '\u05d4\u05e2\u05e8\u05d4',
    'role': '\u05ea\u05e4\u05e7\u05d9\u05d3',
    'status': '\u05e1\u05d8\u05d8\u05d5\u05e1',
    'message': '\u05d4\u05d5\u05d3\u05e2\u05d4',
    'username': '\u05e9\u05dd',
    'changes': '\u05e9\u05d9\u05e0\u05d5\u05d9\u05d9\u05dd',
    'fileName': '\u05e7\u05d5\u05d1\u05e5',
    'fileSize': '\u05d2\u05d5\u05d3\u05dc',
    'serviceName': '\u05e9\u05d9\u05e8\u05d5\u05ea',
    'serviceType': '\u05e1\u05d5\u05d2 \u05e9\u05d9\u05e8\u05d5\u05ea',
    'procedureType': '\u05e1\u05d5\u05d2 \u05d4\u05dc\u05d9\u05da',
    'newDeadline': '\u05d3\u05d3\u05dc\u05d9\u05d9\u05df \u05d7\u05d3\u05e9',
    'oldDeadline': '\u05d3\u05d3\u05dc\u05d9\u05d9\u05df \u05e7\u05d5\u05d3\u05dd',
    'date': '\u05ea\u05d0\u05e8\u05d9\u05da',
    'isInternal': '\u05e4\u05e0\u05d9\u05de\u05d9',
    'fromStageName': '\u05de\u05e9\u05dc\u05d1',
    'toStageName': '\u05dc\u05e9\u05dc\u05d1',
    'overrideActive': '\u05d7\u05e1\u05d9\u05de\u05d4 \u05de\u05d1\u05d5\u05d8\u05dc\u05ea',
    'resolved': '\u05e0\u05e4\u05ea\u05e8'
  };

  const DETAIL_SKIP_KEYS = [
    'entityId', 'loginTime', 'isCritical', '_seconds', '_nanoseconds',
    'targetEmail', 'targetUser', 'clientName', 'agreementId',
    'fileType', 'userAgent', 'ipAddress',
    'taskId', 'entryId', 'autoTimesheetCreated', 'clientUpdated',
    'idempotencyKey', 'reservationId', 'version',
    'serviceId', 'fromStageId', 'toStageId'
  ];

  const ROLE_LABELS = {
    'admin': '\u05de\u05e0\u05d4\u05dc',
    'lawyer': '\u05e2\u05d5"\u05d3',
    'employee': '\u05e2\u05d5\u05d1\u05d3'
  };

  // ═══════════════════════════════════════════
  // Main Page Object
  // ═══════════════════════════════════════════

  const AuditTrailPage = {
    container: null,
    db: null,
    view: 'profiles', // 'profiles' | 'detail'
    profiles: [],
    filteredProfiles: [],
    selectedProfile: null,
    entries: [],
    currentPage: 1,
    loading: false,
    roleFilter: 'all',
    searchQuery: '',
    detailFilters: {
      action: '',
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
        this.container.innerHTML = '<p>\u05e9\u05d2\u05d9\u05d0\u05d4: Firestore \u05dc\u05d0 \u05de\u05d0\u05d5\u05ea\u05d7\u05dc</p>';
        return;
      }

      this._renderProfilesView();
      this._loadProfiles();
    },

    // ═══════════════════════════════════════════
    // View: Profile List
    // ═══════════════════════════════════════════

    _renderProfilesView: function() {
      this.view = 'profiles';
      this.container.innerHTML =
        '<div class="audit-page">' +
          '<div class="audit-header">' +
            '<h1><i class="fas fa-users"></i> \u05dc\u05d5\u05d2 \u05e4\u05e2\u05d9\u05dc\u05d5\u05ea</h1>' +
          '</div>' +
          '<div class="audit-profiles-toolbar">' +
            '<div class="audit-search-box">' +
              '<i class="fas fa-search"></i>' +
              '<input type="text" id="profile-search" placeholder="\u05d7\u05d9\u05e4\u05d5\u05e9 \u05dc\u05e4\u05d9 \u05e9\u05dd \u05d0\u05d5 \u05de\u05d9\u05d9\u05dc..." dir="rtl">' +
            '</div>' +
            '<div class="audit-role-filter" id="role-filter">' +
              '<button class="audit-role-btn active" data-role="all">\u05d4\u05db\u05dc</button>' +
              '<button class="audit-role-btn" data-role="admin">\u05de\u05e0\u05d4\u05dc\u05d9\u05dd</button>' +
              '<button class="audit-role-btn" data-role="lawyer">\u05e2\u05d5"\u05d3</button>' +
              '<button class="audit-role-btn" data-role="employee">\u05e2\u05d5\u05d1\u05d3\u05d9\u05dd</button>' +
            '</div>' +
            '<span class="audit-profiles-count" id="profiles-count"></span>' +
          '</div>' +
          '<div id="profiles-grid" class="audit-profiles-grid">' +
            '<div class="audit-loading"><i class="fas fa-spinner fa-spin"></i> \u05d8\u05d5\u05e2\u05df \u05de\u05e9\u05ea\u05de\u05e9\u05d9\u05dd...</div>' +
          '</div>' +
        '</div>';

      this._bindProfilesEvents();
    },

    _bindProfilesEvents: function() {
      const self = this;

      // Search
      const searchInput = document.getElementById('profile-search');
      if (searchInput) {
        searchInput.addEventListener('input', function() {
          self.searchQuery = searchInput.value.trim().toLowerCase();
          self._filterAndRenderProfiles();
        });
      }

      // Role filter buttons
      document.querySelectorAll('.audit-role-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          document.querySelectorAll('.audit-role-btn').forEach(function(b) {
 b.classList.remove('active');
});
          btn.classList.add('active');
          self.roleFilter = btn.dataset.role;
          self._filterAndRenderProfiles();
        });
      });
    },

    _loadProfiles: async function() {
      try {
        const snapshot = await this.db.collection('employees').get();
        this.profiles = [];
        const self = this;

        snapshot.forEach(function(doc) {
          const data = doc.data();
          self.profiles.push({
            id: doc.id,
            email: data.email || doc.id,
            displayName: data.displayName || data.name || data.username || doc.id,
            username: data.username || '',
            role: data.role || 'employee',
            isActive: data.isActive !== false && !data.disabled,
            lastLogin: data.lastLogin || null,
            authUID: data.authUID || ''
          });
        });

        // Sort alphabetically by displayName
        this.profiles.sort(function(a, b) {
          return a.displayName.localeCompare(b.displayName, 'he');
        });

        this._filterAndRenderProfiles();
      } catch (error) {
        console.error('Error loading profiles:', error);
        const grid = document.getElementById('profiles-grid');
        if (grid) {
          grid.innerHTML = '<div class="audit-empty"><i class="fas fa-exclamation-triangle"></i><p>\u05e9\u05d2\u05d9\u05d0\u05d4 \u05d1\u05d8\u05e2\u05d9\u05e0\u05ea \u05de\u05e9\u05ea\u05de\u05e9\u05d9\u05dd</p></div>';
        }
      }
    },

    _filterAndRenderProfiles: function() {
      const self = this;
      this.filteredProfiles = this.profiles.filter(function(p) {
        // Role filter
        if (self.roleFilter !== 'all' && p.role !== self.roleFilter) {
 return false;
}
        // Search filter
        if (self.searchQuery) {
          const searchable = (p.displayName + ' ' + p.email + ' ' + p.username).toLowerCase();
          if (!searchable.includes(self.searchQuery)) {
 return false;
}
        }
        return true;
      });

      this._renderProfileCards();
    },

    _renderProfileCards: function() {
      const grid = document.getElementById('profiles-grid');
      const countEl = document.getElementById('profiles-count');
      if (!grid) {
 return;
}

      if (countEl) {
        countEl.textContent = this.filteredProfiles.length + ' \u05de\u05e9\u05ea\u05de\u05e9\u05d9\u05dd';
      }

      if (this.filteredProfiles.length === 0) {
        grid.innerHTML = '<div class="audit-empty"><i class="fas fa-users"></i><p>\u05dc\u05d0 \u05e0\u05de\u05e6\u05d0\u05d5 \u05de\u05e9\u05ea\u05de\u05e9\u05d9\u05dd</p></div>';
        return;
      }

      const self = this;
      let html = '';

      this.filteredProfiles.forEach(function(profile) {
        const initial = _getInitial(profile.displayName);
        const roleClass = profile.role;
        const roleLabel = ROLE_LABELS[profile.role] || profile.role;
        const statusClass = profile.isActive ? 'active' : 'blocked';
        const statusTitle = profile.isActive ? '\u05e4\u05e2\u05d9\u05dc' : '\u05d7\u05e1\u05d5\u05dd';
        const lastLoginStr = _formatLastLogin(profile.lastLogin);

        html +=
          '<div class="audit-profile-card" data-email="' + _escapeHtml(profile.email) + '">' +
            '<div class="audit-profile-card-header">' +
              '<div class="audit-profile-avatar ' + roleClass + '">' + _escapeHtml(initial) + '</div>' +
              '<div class="audit-profile-info">' +
                '<div class="audit-profile-name">' + _escapeHtml(profile.displayName) + '</div>' +
                '<div class="audit-profile-email">' + _escapeHtml(profile.email) + '</div>' +
              '</div>' +
            '</div>' +
            '<div class="audit-profile-meta">' +
              '<div class="audit-profile-badges">' +
                '<span class="audit-role-badge ' + roleClass + '">' + _escapeHtml(roleLabel) + '</span>' +
                '<span class="audit-status-dot ' + statusClass + '" title="' + statusTitle + '"></span>' +
              '</div>' +
              '<span class="audit-profile-last-login">' + lastLoginStr + '</span>' +
            '</div>' +
            '<i class="fas fa-chevron-left audit-profile-arrow"></i>' +
          '</div>';
      });

      grid.innerHTML = html;

      // Bind click events on cards
      grid.querySelectorAll('.audit-profile-card').forEach(function(card) {
        card.addEventListener('click', function() {
          const email = card.dataset.email;
          const profile = self.profiles.find(function(p) {
 return p.email === email;
});
          if (profile) {
            self._openProfile(profile);
          }
        });
      });
    },

    // ═══════════════════════════════════════════
    // View: Profile Detail (Activity Log)
    // ═══════════════════════════════════════════

    _openProfile: function(profile) {
      this.view = 'detail';
      this.selectedProfile = profile;
      this.entries = [];
      this.currentPage = 1;
      this.detailFilters = { action: '', dateFrom: '', dateTo: '' };

      const roleClass = profile.role;
      const roleLabel = ROLE_LABELS[profile.role] || profile.role;
      const statusClass = profile.isActive ? 'active' : 'blocked';
      const statusLabel = profile.isActive ? '\u05e4\u05e2\u05d9\u05dc' : '\u05d7\u05e1\u05d5\u05dd';
      const initial = _getInitial(profile.displayName);

      this.container.innerHTML =
        '<div class="audit-page">' +
          '<button class="audit-back-btn" id="btn-back"><i class="fas fa-arrow-right"></i> \u05d7\u05d6\u05e8\u05d4 \u05dc\u05e8\u05e9\u05d9\u05de\u05d4</button>' +
          '<div class="audit-profile-detail-header">' +
            '<div class="audit-detail-avatar ' + roleClass + '">' + _escapeHtml(initial) + '</div>' +
            '<div class="audit-detail-info">' +
              '<h2>' + _escapeHtml(profile.displayName) + '</h2>' +
              '<div class="audit-detail-email">' + _escapeHtml(profile.email) + '</div>' +
              '<div class="audit-detail-badges">' +
                '<span class="audit-role-badge ' + roleClass + '">' + _escapeHtml(roleLabel) + '</span>' +
                '<span class="audit-status-dot ' + statusClass + '" title="' + statusLabel + '"></span>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="audit-detail-filters">' +
            '<div class="audit-filter-group">' +
              '<label>\u05e4\u05e2\u05d5\u05dc\u05d4:</label>' +
              '<select class="audit-filter-select" id="detail-filter-action">' +
                '<option value="">\u05d4\u05db\u05dc</option>' +
              '</select>' +
            '</div>' +
            '<div class="audit-filter-group">' +
              '<label>\u05de:</label>' +
              '<input type="date" class="audit-filter-input" id="detail-filter-from" lang="en">' +
            '</div>' +
            '<div class="audit-filter-group">' +
              '<label>\u05e2\u05d3:</label>' +
              '<input type="date" class="audit-filter-input" id="detail-filter-to" lang="en">' +
            '</div>' +
            '<button class="audit-filter-btn" id="btn-detail-filter"><i class="fas fa-search"></i> \u05e1\u05e0\u05df</button>' +
            '<button class="audit-filter-btn secondary" id="btn-detail-reset"><i class="fas fa-undo"></i> \u05e0\u05e7\u05d4</button>' +
          '</div>' +
          '<div class="audit-table-wrapper">' +
            '<div id="detail-table-content">' +
              '<div class="audit-loading"><i class="fas fa-spinner fa-spin"></i> \u05d8\u05d5\u05e2\u05df \u05e4\u05e2\u05d9\u05dc\u05d5\u05ea...</div>' +
            '</div>' +
          '</div>' +
        '</div>';

      this._bindDetailEvents();
      this._loadUserActivity();
    },

    _bindDetailEvents: function() {
      const self = this;

      // Back button
      document.getElementById('btn-back').addEventListener('click', function() {
        self._renderProfilesView();
        self._filterAndRenderProfiles();
      });

      // Filter
      document.getElementById('btn-detail-filter').addEventListener('click', function() {
        self._applyDetailFilters();
      });

      // Reset
      document.getElementById('btn-detail-reset').addEventListener('click', function() {
        document.getElementById('detail-filter-action').value = '';
        document.getElementById('detail-filter-from').value = '';
        document.getElementById('detail-filter-to').value = '';
        self.detailFilters = { action: '', dateFrom: '', dateTo: '' };
        self.currentPage = 1;
        self._loadUserActivity();
      });
    },

    _applyDetailFilters: function() {
      this.detailFilters.action = document.getElementById('detail-filter-action').value;
      this.detailFilters.dateFrom = document.getElementById('detail-filter-from').value;
      this.detailFilters.dateTo = document.getElementById('detail-filter-to').value;
      this.currentPage = 1;
      this._loadUserActivity();
    },

    _loadUserActivity: async function() {
      if (this.loading) {
 return;
}
      this.loading = true;

      const content = document.getElementById('detail-table-content');
      if (content) {
        content.innerHTML = '<div class="audit-loading"><i class="fas fa-spinner fa-spin"></i> \u05d8\u05d5\u05e2\u05df \u05e4\u05e2\u05d9\u05dc\u05d5\u05ea...</div>';
      }

      const profile = this.selectedProfile;
      const uid = profile.authUID;
      const email = profile.email;
      const actionFilter = this.detailFilters.action;

      try {
        // Query both collections — by userId (indexed) or email fallback
        const queries = [];

        if (uid) {
          queries.push(this._queryUserCollection('audit_log', 'userId', uid));
          queries.push(this._queryUserCollection('activity_log', 'userId', uid));
        } else {
          // No authUID — fallback to email-based queries
          queries.push(this._queryUserCollection('audit_log', 'adminEmail', email));
          queries.push(this._queryUserCollection('activity_log', 'userEmail', email));
        }

        const allResults = await Promise.all(queries);

        // Merge and deduplicate by document id
        const seen = {};
        let results = [];

        allResults.forEach(function(docs) {
          docs.forEach(function(item) {
            if (!seen[item.id]) {
              seen[item.id] = true;
              results.push(item);
            }
          });
        });

        // Sort by timestamp desc
        results.sort(function(a, b) {
          return b.tsMillis - a.tsMillis;
        });

        this.entries = results;

        // Build action dropdown from actual data
        this._buildActionDropdown(results);

        // Apply action filter if set
        if (actionFilter) {
          results = results.filter(function(e) {
            return e.action === actionFilter;
          });
          this.entries = results;
        }

        this._renderActivityTable();

      } catch (error) {
        console.error('Error loading user activity:', error);
        if (content) {
          content.innerHTML = '<div class="audit-empty"><i class="fas fa-exclamation-triangle"></i><p>\u05e9\u05d2\u05d9\u05d0\u05d4 \u05d1\u05d8\u05e2\u05d9\u05e0\u05ea \u05e4\u05e2\u05d9\u05dc\u05d5\u05ea</p></div>';
        }
      }

      this.loading = false;
    },

    _queryUserCollection: async function(collectionName, field, value) {
      let query = this.db.collection(collectionName)
        .where(field, '==', value)
        .orderBy('timestamp', 'desc')
        .limit(200);

      // Date filters
      if (this.detailFilters.dateFrom) {
        const from = new Date(this.detailFilters.dateFrom);
        from.setHours(0, 0, 0, 0);
        query = query.where('timestamp', '>=', from);
      }

      if (this.detailFilters.dateTo) {
        const to = new Date(this.detailFilters.dateTo);
        to.setHours(23, 59, 59, 999);
        query = query.where('timestamp', '<=', to);
      }

      try {
        const snapshot = await query.get();
        const results = [];

        snapshot.forEach(function(doc) {
          const data = doc.data();
          const det = _parseDetails(data.details);
          const target = data.targetUser || data.targetUserEmail || det.targetEmail || det.targetUser || det.clientName || '';

          results.push({
            id: doc.id,
            source: collectionName === 'audit_log' ? 'audit' : 'activity',
            action: data.action || data.type || '',
            target: target,
            details: data.details || '',
            severity: data.severity || 'info',
            timestamp: data.timestamp,
            timestampLocal: data.timestampLocal || null,
            tsMillis: data.timestamp?.toMillis?.() || 0
          });
        });

        return results;
      } catch (e) {
        // Index might not exist for some field combinations — return empty
        console.warn('Query failed for ' + collectionName + '.' + field + ':', e.message);
        return [];
      }
    },

    _buildActionDropdown: function(entries) {
      const actionCounts = {};
      entries.forEach(function(e) {
        if (e.action) {
          actionCounts[e.action] = (actionCounts[e.action] || 0) + 1;
        }
      });

      const select = document.getElementById('detail-filter-action');
      if (!select) {
 return;
}

      // Keep the "all" option
      let html = '<option value="">\u05d4\u05db\u05dc (' + entries.length + ')</option>';

      // Sort by count desc
      const actions = Object.keys(actionCounts).sort(function(a, b) {
        return actionCounts[b] - actionCounts[a];
      });

      actions.forEach(function(action) {
        const label = ACTION_LABELS[action] || action;
        html += '<option value="' + _escapeHtml(action) + '">' + _escapeHtml(label) + ' (' + actionCounts[action] + ')</option>';
      });

      select.innerHTML = html;

      // Restore filter selection if set
      if (this.detailFilters.action) {
        select.value = this.detailFilters.action;
      }
    },

    _renderActivityTable: function() {
      const content = document.getElementById('detail-table-content');
      if (!content) {
 return;
}

      if (this.entries.length === 0) {
        content.innerHTML = '<div class="audit-empty"><i class="fas fa-clipboard-list"></i><p>\u05dc\u05d0 \u05e0\u05de\u05e6\u05d0\u05d5 \u05e8\u05e9\u05d5\u05de\u05d5\u05ea</p></div>';
        return;
      }

      // Pagination
      const totalPages = Math.ceil(this.entries.length / PAGE_SIZE);
      const start = (this.currentPage - 1) * PAGE_SIZE;
      const pageEntries = this.entries.slice(start, start + PAGE_SIZE);

      let rows = '';
      pageEntries.forEach(function(entry) {
        const cat = _getActionCategory(entry.action);
        const actionLabel = ACTION_LABELS[entry.action] || entry.action;
        const timeStr = _formatTimestamp(entry.timestamp, entry.timestampLocal);
        const detailsStr = _formatDetails(entry.details);
        const sourceIcon = entry.source === 'audit'
          ? '<i class="fas fa-shield-alt" style="color:#9333ea;font-size:11px" title="\u05e4\u05e2\u05d5\u05dc\u05ea \u05de\u05e0\u05d4\u05dc"></i>'
          : '<i class="fas fa-user" style="color:#6b7280;font-size:11px" title="\u05e4\u05e2\u05d9\u05dc\u05d5\u05ea \u05de\u05e9\u05ea\u05de\u05e9"></i>';

        const targetCls = entry.target && entry.target.includes('@') ? 'audit-target-cell email-cell' : 'audit-target-cell';

        rows += '<tr>' +
          '<td style="text-align:center">' + sourceIcon + '</td>' +
          '<td class="audit-time-cell">' + timeStr + '</td>' +
          '<td><span class="audit-action-badge ' + cat + '">' + _escapeHtml(actionLabel) + '</span></td>' +
          '<td class="' + targetCls + '" title="' + _escapeHtml(entry.target || '') + '">' + _escapeHtml(entry.target || '') + '</td>' +
          '<td class="audit-details" title="' + _escapeHtml(detailsStr) + '">' + detailsStr + '</td>' +
          '</tr>';
      });

      content.innerHTML =
        '<table class="audit-table">' +
          '<thead>' +
            '<tr>' +
              '<th style="width:4%">\u05e1\u05d5\u05d2</th>' +
              '<th style="width:10%">\u05d6\u05de\u05df</th>' +
              '<th style="width:16%">\u05e4\u05e2\u05d5\u05dc\u05d4</th>' +
              '<th style="width:18%">\u05e0\u05d5\u05d2\u05e2 \u05dc</th>' +
              '<th style="width:52%">\u05e4\u05e8\u05d8\u05d9\u05dd</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table>' +
        this._renderPagination(totalPages);

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

      const rangeStart = (self.currentPage - 1) * PAGE_SIZE + 1;
      const rangeEnd = Math.min(self.currentPage * PAGE_SIZE, self.entries.length);

      return '<div class="audit-pagination">' +
        '<span class="audit-pagination-info">' + rangeStart + '-' + rangeEnd + ' \u05de\u05ea\u05d5\u05da ' + self.entries.length + '</span>' +
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
          self._renderActivityTable();
          const wrapper = document.querySelector('.audit-table-wrapper');
          if (wrapper) {
 wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
        });
      });
    }
  };

  // ═══════════════════════════════════════════
  // Utility Functions
  // ═══════════════════════════════════════════

  function _getInitial(name) {
    if (!name) {
 return '?';
}
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return parts[0].charAt(0) + parts[1].charAt(0);
    }
    return parts[0].charAt(0);
  }

  function _formatLastLogin(ts) {
    if (!ts) {
 return '';
}
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts);
      const now = new Date();
      const diff = now - date;
      const days = Math.floor(diff / 86400000);
      if (days === 0) {
 return '\u05d4\u05d9\u05d5\u05dd';
}
      if (days === 1) {
 return '\u05d0\u05ea\u05de\u05d5\u05dc';
}
      if (days < 7) {
 return '\u05dc\u05e4\u05e0\u05d9 ' + days + ' \u05d9\u05de\u05d9\u05dd';
}
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return day + '/' + month + '/' + date.getFullYear();
    } catch (e) {
      return '';
    }
  }

  function _getActionCategory(action) {
    for (const cat in ACTION_CATEGORIES) {
      if (ACTION_CATEGORIES[cat].indexOf(action) !== -1) {
 return cat;
}
    }
    return 'other';
  }

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
      const date = ts && ts.toDate ? ts.toDate() : new Date(localStr);
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
      if (DETAIL_SKIP_KEYS.indexOf(key) !== -1) {
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
        return m > 0 ? h + ' \u05e9\u05e2\u05d5\u05ea ' + m + ' \u05d3\u05e7\u05d5\u05ea' : h + ' \u05e9\u05e2\u05d5\u05ea';
      }
      return val + ' \u05d3\u05e7\u05d5\u05ea';
    }
    if (key === 'estimatedHours' && typeof val === 'number') {
      return Math.round(val * 10) / 10 + ' \u05e9\u05e2\u05d5\u05ea';
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
    if (key === 'serviceType' || key === 'procedureType') {
      if (window.SystemConstantsHelpers) {
        const label = window.SystemConstantsHelpers.getServiceTypeLabel(val);
        if (label !== val) {
 return label;
}
      }
    }
    if (typeof val === 'boolean') {
      return val ? '\u05db\u05df' : '\u05dc\u05d0';
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
  console.warn('AuditTrailPage loaded (user profiles)');

})();
