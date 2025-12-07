/**
 * Task Approval Dialog
 * דיאלוג אישור משימה
 */

import { taskApprovalService } from './services/task-approval-service.js';
import * as helpers from './utils/approval-helpers.js';

export class TaskApprovalDialog {
  constructor(options) {
    this.options = options;
    this.db = options.db;
    this.currentUser = options.currentUser;
    this.currentApproval = null;
    this.overlay = null;
  }

  show(approval) {
    this.currentApproval = approval;
    this.createDialog();
    this.attachEventListeners();
  }

  createDialog() {
    if (this.overlay) {
      this.overlay.remove();
    }

    const approval = this.currentApproval;
    const requestedMinutes = approval.taskData.estimatedMinutes;

    this.overlay = document.createElement('div');
    this.overlay.className = 'task-approval-dialog-overlay active';
    this.overlay.innerHTML = `
      <div class="task-approval-dialog">
        <div class="dialog-header">
          <h3>אישור תקציב משימה</h3>
          <button class="btn-close" id="closeDialog">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="dialog-content">
          <div class="task-details">
            <div class="detail-row">
              <span class="detail-label">עובד:</span>
              <span class="detail-value">${approval.requestedByName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">לקוח:</span>
              <span class="detail-value">${approval.taskData.clientName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">תיאור:</span>
              <span class="detail-value">${approval.taskData.description}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">תקציב מבוקש:</span>
              <span class="detail-value">${helpers.formatMinutesToHoursText(requestedMinutes)}</span>
            </div>
          </div>

          <div class="budget-control">
            <label class="budget-label">
              <strong>תקציב לאישור:</strong> (מבוקש: ${requestedMinutes} דקות)
            </label>
            <div class="budget-input-wrapper">
              <input
                type="number"
                id="budgetInput"
                class="budget-input"
                value="${requestedMinutes}"
                min="1"
                max="480"
                step="15"
              >
              <span class="budget-hint">דקות</span>
            </div>
            <div class="budget-presets">
              <button class="preset-btn" data-minutes="30">30 דק׳</button>
              <button class="preset-btn" data-minutes="60">60 דק׳</button>
              <button class="preset-btn" data-minutes="90">90 דק׳</button>
              <button class="preset-btn" data-minutes="120">120 דק׳</button>
            </div>
          </div>

          <div class="admin-notes">
            <label class="notes-label">הערות למשתמש (אופציונלי):</label>
            <textarea
              id="adminNotes"
              class="notes-textarea"
              placeholder="הוסף הערות..."
              maxlength="500"
            ></textarea>
          </div>

          <div id="dialogError" class="dialog-error hidden"></div>
        </div>

        <div class="dialog-actions">
          <button id="btnApproveFull" class="btn-approve-full">
            <i class="fas fa-check"></i>
            אשר תקציב מלא
          </button>
          <button id="btnApproveModified" class="btn-approve-modified">
            <i class="fas fa-edit"></i>
            אשר עם תקציב מעודכן
          </button>
          <button id="btnReject" class="btn-reject">
            <i class="fas fa-times"></i>
            דחה בקשה
          </button>
        </div>

        <div id="dialogLoading" class="dialog-loading hidden">
          <div class="spinner"></div>
          <p>מעבד בקשה...</p>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);
  }

  attachEventListeners() {
    // Close
    this.overlay.querySelector('#closeDialog').addEventListener('click', () => this.hide());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });

    // Budget presets
    this.overlay.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const minutes = parseInt(btn.dataset.minutes);
        this.overlay.querySelector('#budgetInput').value = minutes;
      });
    });

    // Approve full
    this.overlay.querySelector('#btnApproveFull').addEventListener('click', () => {
      const requestedMinutes = this.currentApproval.taskData.estimatedMinutes;
      this.handleApprove(requestedMinutes);
    });

    // Approve modified
    this.overlay.querySelector('#btnApproveModified').addEventListener('click', () => {
      const approvedMinutes = parseInt(this.overlay.querySelector('#budgetInput').value);
      this.handleApprove(approvedMinutes);
    });

    // Reject
    this.overlay.querySelector('#btnReject').addEventListener('click', () => {
      this.handleReject();
    });
  }

  async handleApprove(approvedMinutes) {
    const adminNotes = this.overlay.querySelector('#adminNotes').value;

    const error = helpers.validateApproval(approvedMinutes);
    if (error) {
      this.showError(error);
      return;
    }

    this.showLoading();

    try {
      await taskApprovalService.approveRequest(
        this.currentApproval.id,
        approvedMinutes,
        adminNotes
      );

      if (window.NotificationSystem) {
        window.NotificationSystem.show('✅ המשימה אושרה בהצלחה!', 'success');
      }

      if (this.options.onApprove) {
        this.options.onApprove();
      }

      this.hide();
    } catch (error) {
      console.error('Error approving:', error);
      this.showError('שגיאה באישור המשימה');
      this.hideLoading();
    }
  }

  async handleReject() {
    const adminNotes = this.overlay.querySelector('#adminNotes').value;

    const error = helpers.validateRejection(adminNotes);
    if (error) {
      this.showError(error);
      return;
    }

    if (!confirm('האם אתה בטוח שברצונך לדחות את הבקשה?')) {
      return;
    }

    this.showLoading();

    try {
      await taskApprovalService.rejectRequest(
        this.currentApproval.id,
        adminNotes
      );

      if (window.NotificationSystem) {
        window.NotificationSystem.show('המשימה נדחתה', 'info');
      }

      if (this.options.onReject) {
        this.options.onReject();
      }

      this.hide();
    } catch (error) {
      console.error('Error rejecting:', error);
      this.showError('שגיאה בדחיית המשימה');
      this.hideLoading();
    }
  }

  showError(message) {
    const errorEl = this.overlay.querySelector('#dialogError');
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }

  showLoading() {
    this.overlay.querySelector('#dialogLoading').classList.remove('hidden');
  }

  hideLoading() {
    this.overlay.querySelector('#dialogLoading').classList.add('hidden');
  }

  hide() {
    if (this.overlay) {
      this.overlay.classList.remove('active');
      setTimeout(() => {
        this.overlay.remove();
        this.overlay = null;
      }, 300);
    }
  }
}
