/**
 * Task Approval Panel
 * פאנל אישור משימות
 */

import { taskApprovalService } from './services/task-approval-service.js';
import { TaskApprovalDialog } from './TaskApprovalDialog.js';
import * as helpers from './utils/approval-helpers.js';

export class TaskApprovalPanel {
  constructor(options) {
    this.options = options;
    this.db = options.db;
    this.currentUser = options.currentUser;
    this.container = null;
    this.dialog = null;
    this.approvals = [];
    this.filteredApprovals = [];
    this.currentFilter = 'pending';
    this.searchTerm = '';
    this.sortBy = 'date-desc';
    this.realtimeUnsubscribe = null;
  }

  init() {
    console.log('📊 Initializing TaskApprovalPanel...');

    taskApprovalService.init(this.db, this.currentUser);

    this.container = document.getElementById(this.options.containerId);
    if (!this.container) {
      throw new Error(`Container #${this.options.containerId} not found`);
    }

    this.dialog = new TaskApprovalDialog({
      db: this.db,
      currentUser: this.currentUser,
      onApprove: () => this.loadApprovals(),
      onReject: () => this.loadApprovals()
    });

    this.render();
    this.attachEventListeners();
    this.loadApprovals();
    this.startRealtimeListener();
  }

  render() {
    this.container.innerHTML = `
      <div class="approval-panel">
        <div class="panel-header">
          <h1>אישורי תקציב משימות</h1>
          <div class="panel-actions">
            <input type="search" id="searchInput" placeholder="חיפוש...">
            <button id="refreshBtn" class="btn-refresh">
              <i class="fas fa-sync-alt"></i>
            </button>
          </div>
        </div>

        <div class="panel-filters">
          <button class="filter-btn active" data-filter="pending">ממתין</button>
          <button class="filter-btn" data-filter="approved">אושר</button>
          <button class="filter-btn" data-filter="rejected">נדחה</button>
          <button class="filter-btn" data-filter="all">הכל</button>
        </div>

        <div class="panel-content">
          <div id="approvalsList" class="approvals-list">
            <div class="loading">טוען...</div>
          </div>
        </div>
      </div>
    `;
  }

  attachEventListeners() {
    // Filter buttons
    const filterBtns = this.container.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        filterBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentFilter = e.target.dataset.filter;
        this.loadApprovals();
      });
    });

    // Search
    const searchInput = this.container.querySelector('#searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchTerm = e.target.value;
        this.applyFiltersAndSort();
      });
    }

    // Refresh
    const refreshBtn = this.container.querySelector('#refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadApprovals());
    }
  }

  async loadApprovals() {
    try {
      this.approvals = await taskApprovalService.getApprovalsByStatus(this.currentFilter);
      this.applyFiltersAndSort();
    } catch (error) {
      console.error('Error loading approvals:', error);
      this.renderError();
    }
  }

  applyFiltersAndSort() {
    let filtered = [...this.approvals];

    if (this.searchTerm) {
      filtered = helpers.filterApprovalsBySearch(filtered, this.searchTerm);
    }

    filtered = helpers.sortApprovals(filtered, this.sortBy);
    this.filteredApprovals = filtered;
    this.renderApprovals();
  }

  renderApprovals() {
    const listContainer = this.container.querySelector('#approvalsList');
    const purify = (v) => window.DOMPurify ? DOMPurify.sanitize(String(v ?? '')) : String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    if (this.filteredApprovals.length === 0) {
      listContainer.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>אין בקשות אישור</p></div>';
      return;
    }

    // Group by user
    const groupedByUser = this.filteredApprovals.reduce((groups, approval) => {
      const user = approval.requestedBy;
      if (!groups[user]) {
        groups[user] = {
          name: approval.requestedByName,
          email: user,
          requests: []
        };
      }
      groups[user].requests.push(approval);
      return groups;
    }, {});

    // Render user groups
    listContainer.innerHTML = Object.values(groupedByUser).map(userGroup => `
      <div class="user-group">
        <div class="user-group-header">
          <div class="user-info">
            <div class="user-avatar">${purify(userGroup.name).charAt(0)}</div>
            <div class="user-details">
              <h3>${purify(userGroup.name)}</h3>
              <p>${purify(userGroup.email)}</p>
            </div>
          </div>
          <span class="requests-count">${userGroup.requests.length}</span>
        </div>

        <table class="requests-table">
          <thead>
            <tr>
              <th>משימה</th>
              <th>לקוח</th>
              <th>תקציב</th>
              <th>זמן</th>
              <th>סטטוס</th>
            </tr>
          </thead>
          <tbody>
            ${userGroup.requests.map(approval => `
              <tr data-id="${approval.id}" class="approval-row">
                <td class="task-desc">${purify(approval.taskData.description)}</td>
                <td class="task-client">${purify(approval.taskData.clientName)}</td>
                <td class="task-budget">${helpers.formatMinutesToHoursText(approval.taskData.estimatedMinutes)}</td>
                <td class="task-time">${helpers.formatRelativeTime(approval.requestedAt)}</td>
                <td><span class="task-status ${approval.status}">${helpers.getStatusText(approval.status)}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `).join('');

    // Attach click handlers
    this.container.querySelectorAll('.approval-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.dataset.id;
        const approval = this.filteredApprovals.find(a => a.id === id);
        if (approval && approval.status === 'pending') {
          this.dialog.show(approval);
        }
      });
    });
  }

  renderError() {
    const listContainer = this.container.querySelector('#approvalsList');
    listContainer.innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-circle"></i>
        <p>שגיאה בטעינת הנתונים</p>
        <button onclick="location.reload()">רענן דף</button>
      </div>
    `;
  }

  startRealtimeListener() {
    this.realtimeUnsubscribe = taskApprovalService.listenToPendingApprovals((approvals) => {
      if (this.currentFilter === 'pending') {
        this.approvals = approvals;
        this.applyFiltersAndSort();
      }
    });
  }

  cleanup() {
    if (this.realtimeUnsubscribe) {
      this.realtimeUnsubscribe();
    }
  }
}
