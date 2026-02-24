/**
 * TaskTimeline Component
 * Displays a unified timeline of task history including:
 * - Time entries
 * - Budget adjustments
 * - Deadline extensions
 * - Task creation
 *
 * Design: Ultra-minimal style matching existing system
 */

class TaskTimeline {
  constructor() {
    this.overlayId = 'taskTimelineOverlay';
    this.currentTask = null;
  }

  /**
   * Show timeline for a specific task
   * @param {Object} task - The task object with history data
   */
  show(task) {
    if (!task) {
      console.error('TaskTimeline: No task provided');
      return;
    }

    this.currentTask = task;
    this.render();
    this.open();
  }

  /**
   * Build unified timeline from multiple sources
   * @param {Object} task - Task object
   * @returns {Array} Sorted timeline events
   */
  buildTimeline(task) {
    const events = [];

    // 1. Task creation event
    if (task.createdAt) {
      events.push({
        type: 'created',
        date: this.parseDate(task.createdAt),
        data: {
          estimatedMinutes: task.originalEstimate || task.estimatedMinutes || 0,
          deadline: this.parseDate(task.originalDeadline || task.deadline),
          createdBy: task.createdBy || task.lawyer || 'לא ידוע'
        }
      });
    }

    // 2. Time entries (from history or timeEntries)
    const timeEntries = Array.isArray(task.history) ? task.history :
                        Array.isArray(task.timeEntries) ? task.timeEntries : [];
    timeEntries.forEach(entry => {
      events.push({
        type: 'time-entry',
        date: this.parseDate(entry.addedAt || entry.date),
        data: {
          minutes: entry.minutes || 0,
          hours: entry.hours || (entry.minutes / 60),
          description: entry.description || '',
          addedBy: entry.addedBy || 'לא ידוע'
        }
      });
    });

    // 3. Budget adjustments
    const budgetAdjustments = Array.isArray(task.budgetAdjustments) ? task.budgetAdjustments : [];
    budgetAdjustments.forEach(adjustment => {
      events.push({
        type: 'budget-adjustment',
        date: this.parseDate(adjustment.date || adjustment.adjustedAt),
        data: {
          oldBudget: adjustment.oldEstimate || 0,
          newBudget: adjustment.newEstimate || 0,
          reason: adjustment.reason || '',
          adjustedBy: adjustment.adjustedBy || 'לא ידוע'
        }
      });
    });

    // 4. Deadline extensions
    const deadlineExtensions = Array.isArray(task.deadlineExtensions) ? task.deadlineExtensions : [];
    deadlineExtensions.forEach(extension => {
      events.push({
        type: 'deadline-extension',
        date: this.parseDate(extension.date || extension.extendedAt),
        data: {
          oldDeadline: this.parseDate(extension.oldDeadline),
          newDeadline: this.parseDate(extension.newDeadline),
          reason: extension.reason || '',
          extendedBy: extension.extendedBy || 'לא ידוע'
        }
      });
    });

    // Filter out events with invalid dates, then sort by date (newest first)
    return events
      .filter(event => {
        if (!event.date) {
return false;
}
        const d = new Date(event.date);
        return !isNaN(d.getTime());
      })
      .sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB - dateA;
      });
  }

  /**
   * Parse date from various formats
   * @param {*} date - Date in various formats (Firebase Timestamp, Date object, string, number)
   * @returns {Date|null} JavaScript Date object or null if invalid
   */
  parseDate(date) {
    if (!date) {
return null;
}

    // Already a Date object
    if (date instanceof Date) {
      return isNaN(date.getTime()) ? null : date;
    }

    // Firebase Timestamp with toDate() method
    if (date.toDate && typeof date.toDate === 'function') {
      try {
        return date.toDate();
      } catch (e) {
        console.warn('Failed to convert Firebase Timestamp:', e);
        return null;
      }
    }

    // Firebase Timestamp with seconds property
    if (date.seconds !== undefined) {
      try {
        return new Date(date.seconds * 1000);
      } catch (e) {
        console.warn('Failed to convert Firebase Timestamp seconds:', e);
        return null;
      }
    }

    // String or number
    if (typeof date === 'string' || typeof date === 'number') {
      const parsed = new Date(date);
      return isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  }

  /**
   * Format date for display
   * @param {Date} date - JavaScript Date
   * @returns {string} Formatted date string
   */
  formatDate(date) {
    if (!date) {
return 'לא הוגדר';
}
    const d = new Date(date);
    if (isNaN(d.getTime())) {
return 'תאריך לא תקין';
}
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} • ${hours}:${minutes}`;
  }

  /**
   * Format date for deadline display (date only)
   * @param {Date} date - JavaScript Date
   * @returns {string} Formatted date string
   */
  formatDateOnly(date) {
    if (!date) {
return 'לא הוגדר';
}
    const d = new Date(date);
    if (isNaN(d.getTime())) {
return 'תאריך לא תקין';
}
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Create HTML for a timeline item
   * @param {Object} event - Timeline event
   * @param {number} index - Event index (for animation delay)
   * @returns {string} HTML string
   */
  createTimelineItem(event, index) {
    const configs = {
      'created': {
        icon: 'fa-plus-circle',
        bgColor: '#d1fae5',
        color: '#10b981',
        badgeClass: 'created-badge',
        badgeText: 'משימה נוצרה'
      },
      'time-entry': {
        icon: 'fa-clock',
        bgColor: '#eff6ff',
        color: '#3b82f6',
        badgeClass: 'time-badge',
        badgeText: `${event.data.minutes} דקות`
      },
      'budget-adjustment': {
        icon: 'fa-edit',
        bgColor: '#fffbeb',
        color: '#f59e0b',
        badgeClass: 'budget-badge',
        badgeText: `${event.data.oldBudget} → ${event.data.newBudget} דקות`
      },
      'deadline-extension': {
        icon: 'fa-calendar-plus',
        bgColor: '#f3e8ff',
        color: '#a855f7',
        badgeClass: 'deadline-badge',
        badgeText: `${this.formatDateOnly(event.data.oldDeadline)} → ${this.formatDateOnly(event.data.newDeadline)}`
      }
    };

    const config = configs[event.type] || configs['time-entry'];
    const description = this.getEventDescription(event);
    const footer = this.getEventFooter(event);

    return `
      <div class="timeline-item" data-type="${event.type}" style="animation-delay: ${index * 50}ms;">
        <div class="timeline-icon" style="background: ${config.bgColor}; color: ${config.color};">
          <i class="fas ${config.icon}"></i>
        </div>
        <div class="timeline-content">
          <div class="timeline-header">
            <span class="timeline-date">${this.formatDate(event.date)}</span>
            <span class="timeline-badge ${config.badgeClass}">${config.badgeText}</span>
          </div>
          <div class="timeline-description">${description}</div>
          <div class="timeline-footer">
            <span class="timeline-user">${footer}</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get description text for event
   * @param {Object} event - Timeline event
   * @returns {string} Description text
   */
  getEventDescription(event) {
    switch (event.type) {
      case 'created':
        const deadlineText = event.data.deadline ? `יעד: ${this.formatDateOnly(event.data.deadline)}` : '';
        const budgetText = `תקציב ראשוני: ${event.data.estimatedMinutes || 0} דקות`;
        return deadlineText ? `${budgetText} • ${deadlineText}` : budgetText;
      case 'time-entry':
        return event.data.description || 'עבודה על המשימה';
      case 'budget-adjustment':
        return event.data.reason || 'עדכון תקציב הזמן';
      case 'deadline-extension':
        return event.data.reason || 'הארכת תאריך יעד';
      default:
        return '';
    }
  }

  /**
   * Get footer text for event
   * @param {Object} event - Timeline event
   * @returns {string} Footer text
   */
  getEventFooter(event) {
    switch (event.type) {
      case 'created':
        return `נוצר על ידי: ${event.data.createdBy}`;
      case 'time-entry':
        return `נוסף על ידי: ${event.data.addedBy}`;
      case 'budget-adjustment':
        return `עודכן על ידי: ${event.data.adjustedBy}`;
      case 'deadline-extension':
        return `עודכן על ידי: ${event.data.extendedBy}`;
      default:
        return '';
    }
  }

  /**
   * Render the timeline overlay
   */
  render() {
    const task = this.currentTask;
    const timeline = this.buildTimeline(task);

    const timelineItemsHtml = timeline.length > 0
      ? timeline.map((event, index) => this.createTimelineItem(event, index)).join('')
      : this.createEmptyState();

    const html = `
      <div class="popup-overlay" id="${this.overlayId}" style="display: none;">
        <div class="popup" style="direction: rtl;">

          <!-- Header -->
          <div class="popup-header" style="display: flex; flex-direction: column; align-items: stretch; direction: rtl;">
            <!-- Top row: close button and title -->
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #f1f5f9;">
              <button class="popup-close-btn timeline-close-btn" onclick="window.TaskTimelineInstance.close()">
                <i class="fas fa-times"></i>
              </button>
              <div style="display: flex; align-items: center; gap: 12px;">
                <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #0f172a;">
                  היסטוריית משימה
                </h3>
                <i class="fas fa-history" style="color: #3b82f6; font-size: 20px;"></i>
              </div>
            </div>

            <!-- Task Info inside Header - Floating Card -->
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; max-width: 85%; margin: 0 auto; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);">
              <div style="font-size: 13px; font-weight: 600; color: #0f172a; margin-bottom: 3px;">
                ${task.description || 'ללא תיאור'}
              </div>
              <div style="font-size: 12px; color: #6b7280;">
                לקוח: ${task.clientName || 'לא ידוע'} • תיק: ${task.caseNumber || 'לא ידוע'}
              </div>
            </div>
          </div>

          <!-- Timeline Content -->
          <div class="popup-content" style="padding: 16px 24px 24px 24px;">
            <div class="timeline-container">
              ${timelineItemsHtml}
            </div>
          </div>

          <!-- Footer Buttons -->
          <div class="popup-buttons">
            <button class="popup-btn popup-btn-cancel" onclick="window.TaskTimelineInstance.close()">
              סגור
            </button>
          </div>

        </div>
      </div>
    `;

    // Remove existing overlay if present
    const existing = document.getElementById(this.overlayId);
    if (existing) {
      existing.remove();
    }

    // Insert new overlay
    document.body.insertAdjacentHTML('beforeend', html);

    // Add click-outside-to-close
    setTimeout(() => {
      const overlay = document.getElementById(this.overlayId);
      if (overlay) {
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) {
            this.close();
          }
        });
      }
    }, 100);
  }

  /**
   * Create empty state HTML
   * @returns {string} Empty state HTML
   */
  createEmptyState() {
    return `
      <div class="timeline-empty" style="text-align: center; padding: 60px 20px; color: #9ca3af;">
        <i class="fas fa-history" style="font-size: 48px; color: #d1d5db; margin-bottom: 16px; display: block;"></i>
        <div style="font-size: 16px; font-weight: 500; color: #6b7280; margin-bottom: 8px;">
          אין היסטוריה עדיין
        </div>
        <div style="font-size: 14px; color: #9ca3af;">
          פעולות על המשימה יופיעו כאן
        </div>
      </div>
    `;
  }

  /**
   * Open the timeline overlay
   */
  open() {
    const overlay = document.getElementById(this.overlayId);
    if (overlay) {
      // Prevent body scroll
      document.body.classList.add('timeline-open');

      overlay.style.display = 'flex';
      // Trigger animation
      setTimeout(() => {
        overlay.classList.add('active');
      }, 10);
    }
  }

  /**
   * Close the timeline overlay
   */
  close() {
    const overlay = document.getElementById(this.overlayId);
    if (overlay) {
      // Re-enable body scroll
      document.body.classList.remove('timeline-open');

      overlay.classList.remove('active');
      setTimeout(() => {
        overlay.style.display = 'none';
      }, 250);
    }
  }
}

// Initialize global instance
window.TaskTimelineInstance = new TaskTimeline();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TaskTimeline;
}
