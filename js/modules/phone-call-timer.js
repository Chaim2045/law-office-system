/**
 * Phone Call Timer Module - REFACTORED
 * ========================
 * מודול לניהול טיימר שיחות טלפון עם רישום אוטומטי לשעתון
 *
 * @version 2.0.0
 * @updated 2025-12-26
 *
 * שינויים בגרסה 2.0:
 * - שימוש ב-ClientCaseSelector במקום קוד מותאם אישי
 * - תמיכה במשימות "שיחות טלפון" אוטומטיות
 * - רישום נכון על לקוחות (מקזז שעות)
 * - תמיכה ברישומים פנימיים (ללא קיזוז)
 */

/* ========================================
   TIMER CLASS
   ======================================== */

class PhoneCallTimer {
  constructor(manager) {
    this.manager = manager;
    this.startTime = null;
    this.isRunning = false;
    this.intervalId = null;
    this.elapsedSeconds = 0;

    // DOM Elements
    this.button = null;
    this.timerDisplay = null;

    // Storage key
    this.STORAGE_KEY = 'phoneCallTimer';

    // Selection state
    this.clientCaseSelector = null;
    this.currentCallType = 'client';
    this.currentOverlay = null;

    // Bind methods
    this.handleButtonClick = this.handleButtonClick.bind(this);
    this.updateDisplay = this.updateDisplay.bind(this);
  }

  /**
   * Initialize the timer module
   */
  init() {
    // Create and inject the button
    this.createButton();

    // Restore from localStorage if exists
    this.restoreFromStorage();
  }

  /**
   * Create timer button in sidebar
   */
  createButton() {
    const sidebar = document.querySelector('.sidebar nav');
    if (!sidebar) {
      console.error('❌ Sidebar not found');
      return;
    }

    // Create button HTML
    const buttonHtml = `
      <button class="nav-item phone-call-btn" id="phoneCallTimerBtn">
        <i class="fas fa-phone"></i>
        <span class="timer-text">שיחה</span>
        <span class="timer-display" style="display: none;">00:00</span>
      </button>
    `;

    // Insert before the first nav item
    const firstItem = sidebar.querySelector('.nav-item');
    if (firstItem) {
      firstItem.insertAdjacentHTML('beforebegin', buttonHtml);
    } else {
      sidebar.insertAdjacentHTML('afterbegin', buttonHtml);
    }

    // Get references
    this.button = document.getElementById('phoneCallTimerBtn');
    this.timerDisplay = this.button.querySelector('.timer-display');

    // Attach click listener
    this.button.addEventListener('click', this.handleButtonClick);
  }

  /**
   * Handle button click
   */
  handleButtonClick() {
    if (this.isRunning) {
      this.stop();
    } else {
      this.start();
    }
  }

  /**
   * Start timer
   */
  start() {
    this.isRunning = true;
    this.startTime = Date.now();
    this.elapsedSeconds = 0;

    // Update UI
    this.button.classList.add('active');
    this.button.querySelector('.timer-text').style.display = 'none';
    this.timerDisplay.style.display = 'inline';

    // Start interval
    this.intervalId = setInterval(this.updateDisplay, 1000);

    // Save to storage
    this.saveToStorage();

    console.log('📞 Timer started');
  }

  /**
   * Stop timer
   */
  stop() {
    this.isRunning = false;

    // Stop interval
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Update UI
    this.button.classList.remove('active');
    this.button.querySelector('.timer-text').style.display = 'inline';
    this.timerDisplay.style.display = 'none';
    this.timerDisplay.textContent = '00:00';

    // Clear storage
    this.clearStorage();

    // Calculate elapsed minutes
    const elapsedMinutes = Math.max(1, Math.round(this.elapsedSeconds / 60));

    console.log(`📞 Timer stopped - ${elapsedMinutes} minutes`);

    // Show completion dialog
    this.showCompletionDialog(elapsedMinutes);
  }

  /**
   * Update timer display
   */
  updateDisplay() {
    if (!this.isRunning) {
      return;
    }

    this.elapsedSeconds++;
    const minutes = Math.floor(this.elapsedSeconds / 60);
    const seconds = this.elapsedSeconds % 60;

    const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    this.timerDisplay.textContent = display;

    // Update storage
    this.saveToStorage();
  }

  /**
   * Show completion dialog
   */
  showCompletionDialog(elapsedMinutes) {
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay phone-call-overlay';
    overlay.innerHTML = `
      <div class="popup phone-call-popup tailwind-modal">
        <div class="tailwind-header">
          <h3>
            <i class="fas fa-phone" style="color: #3b82f6;"></i>
            הוספת שיחת טלפון
          </h3>
          <button class="tailwind-close-btn" onclick="phoneCallTimer.cancelDialog()" aria-label="סגור">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="tailwind-content">
          <form id="phoneCallForm">
            <!-- Type + Time in grid -->
            <div class="tailwind-form-row">
              <div class="tailwind-form-group">
                <label class="tailwind-label">
                  סוג השיחה
                  <span class="required">*</span>
                </label>
                <select id="phoneCallType" class="tailwind-select" onchange="phoneCallTimer.selectCallType(this.value)">
                  <option value="client">שיחה עם לקוח</option>
                  <option value="internal">רישום פנימי</option>
                </select>
              </div>

              <div class="tailwind-form-group">
                <label for="phoneCallMinutes" class="tailwind-label">
                  זמן (דקות)
                </label>
                <input
                  type="number"
                  id="phoneCallMinutes"
                  class="tailwind-input"
                  value="${elapsedMinutes}"
                  min="1"
                  max="999"
                  required
                />
                <small class="tailwind-helper">ניתן לעדכן במידת הצורך</small>
              </div>
            </div>

            <!-- Client + Service selector (using ClientCaseSelector) -->
            <div id="clientSelectionSection">
              <div id="phoneCallClientSelector"></div>
            </div>

            <!-- Description - full width -->
            <div class="tailwind-form-group full-width">
              <label for="phoneCallDescription" class="tailwind-label">
                <i class="fas fa-align-right"></i>
                תיאור השיחה
                <span class="required">*</span>
              </label>
              <textarea
                id="phoneCallDescription"
                class="tailwind-textarea"
                rows="3"
                placeholder="למשל: בירור לגבי..."
                required
              ></textarea>
              <small class="tailwind-helper">יישמר כ: "שיחת טלפון עם לקוח בעניין: ..."</small>
            </div>
          </form>
        </div>

        <div class="tailwind-footer">
          <button
            class="tailwind-btn tailwind-btn-primary"
            onclick="phoneCallTimer.saveToTimesheet()"
          >
            <i class="fas fa-save"></i>
            שמור
          </button>
          <button
            class="tailwind-btn tailwind-btn-secondary"
            onclick="phoneCallTimer.cancelDialog()"
          >
            <i class="fas fa-times"></i>
            ביטול
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Initialize with "client" type selected
    this.currentCallType = 'client';
    this.clientCaseSelector = null;

    // Initialize ClientCaseSelector for client/service selection
    this.initClientCaseSelector();

    // Show overlay
    setTimeout(() => overlay.classList.add('show'), 10);

    // Store overlay reference
    this.currentOverlay = overlay;
  }

  /**
   * Select call type (client or internal)
   */
  selectCallType(type) {
    this.currentCallType = type;

    // Show/hide client selection
    const clientSection = document.getElementById('clientSelectionSection');
    if (type === 'client') {
      clientSection.style.display = 'block';
      // Re-initialize ClientCaseSelector if needed
      if (!this.clientCaseSelector) {
        this.initClientCaseSelector();
      }
    } else {
      clientSection.style.display = 'none';
    }
  }

  /**
   * Initialize ClientCaseSelector
   */
  initClientCaseSelector() {
    // Check if ClientCaseSelector is available
    if (typeof window.ClientCaseSelector === 'undefined') {
      console.error('❌ ClientCaseSelector not loaded');
      return;
    }

    // Initialize selector
    this.clientCaseSelector = new window.ClientCaseSelector('phoneCallClientSelector', {
      placeholder: 'חפש לקוח...',
      required: true,
      hideServiceCards: false // Show service cards for selection
    });
  }

  /**
   * Get or create "Phone Calls" task for service
   */
  async getOrCreatePhoneTask(serviceId, serviceName) {
    try {
      const db = window.firebaseDB;

      // Search for existing "Phone Calls" task for this service
      const tasksSnapshot = await db.collection('budget_tasks')
        .where('serviceId', '==', serviceId)
        .where('description', '==', 'שיחות טלפון')
        .where('status', '!=', 'הושלם')
        .limit(1)
        .get();

      if (!tasksSnapshot.empty) {
        const existingTask = tasksSnapshot.docs[0];
        console.log(`✅ Found existing phone task: ${existingTask.id}`);
        return existingTask.id;
      }

      // No existing task - create new one
      console.log(`📞 Creating new phone task for service ${serviceId}...`);

      const result = await window.callFunction('createBudgetTask', {
        serviceId: serviceId,
        serviceName: serviceName,
        description: 'שיחות טלפון',
        estimatedMinutes: 30, // Default estimate
        category: 'תקשורת'
      });

      if (result && result.taskId) {
        console.log(`✅ Created phone task: ${result.taskId}`);
        return result.taskId;
      } else {
        throw new Error('Failed to create phone task');
      }

    } catch (error) {
      console.error('❌ Error getting/creating phone task:', error);
      throw error;
    }
  }

  /**
   * Save to timesheet
   */
  async saveToTimesheet() {
    const description = document.getElementById('phoneCallDescription').value.trim();
    const minutes = parseInt(document.getElementById('phoneCallMinutes').value);

    // Validation
    if (!description) {
      if (window.NotificationSystem) {
        window.NotificationSystem.show('נא למלא תיאור', 'error');
      }
      return;
    }

    if (!minutes || minutes < 1) {
      if (window.NotificationSystem) {
        window.NotificationSystem.show('זמן לא תקין', 'error');
      }
      return;
    }

    try {
      let timesheetData;

      if (this.currentCallType === 'client') {
        // Client call - must select client and service
        if (!this.clientCaseSelector) {
          if (window.NotificationSystem) {
            window.NotificationSystem.show('שגיאה: בורר לקוח לא זמין', 'error');
          }
          return;
        }

        const selected = this.clientCaseSelector.getSelectedValues();

        if (!selected.clientId || !selected.serviceId) {
          if (window.NotificationSystem) {
            window.NotificationSystem.show('נא לבחור לקוח ושירות', 'error');
          }
          return;
        }

        // Get or create "Phone Calls" task for this service
        const taskId = await this.getOrCreatePhoneTask(selected.serviceId, selected.serviceName);

        // Build timesheet entry for client
        timesheetData = {
          clientId: selected.clientId,
          clientName: selected.clientName,
          caseNumber: selected.caseNumber,
          serviceId: selected.serviceId,
          serviceName: selected.serviceName,
          serviceType: selected.serviceType,
          parentServiceId: selected.parentServiceId,
          taskId: taskId, // ✅ Phone task ID
          date: new Date().toISOString().split('T')[0],
          minutes: minutes,
          action: `שיחת טלפון עם לקוח בעניין: ${description}`,
          isInternal: false, // ✅ Client call - counts towards hours
          isPhoneCall: true
        };

      } else {
        // Internal call - no client/service needed
        timesheetData = {
          date: new Date().toISOString().split('T')[0],
          minutes: minutes,
          action: `שיחה פנימית: ${description}`,
          isInternal: true, // ✅ Internal - does NOT count towards client hours
          isPhoneCall: true
        };
      }

      // Show loading
      if (window.NotificationSystem) {
        window.NotificationSystem.show('שומר...', 'info', 1000);
      }

      // Save to Firestore
      await window.callFunction('createTimesheetEntry', timesheetData);

      // Success
      if (window.NotificationSystem) {
        window.NotificationSystem.show('✅ שיחה נרשמה בהצלחה', 'success');
      }

      // Close dialog
      this.cancelDialog();

      // Refresh timesheet if visible
      if (window.timesheetManager && typeof window.timesheetManager.loadData === 'function') {
        await window.timesheetManager.loadData();
      }

    } catch (error) {
      console.error('❌ Error saving phone call:', error);
      if (window.NotificationSystem) {
        window.NotificationSystem.show(`שגיאה: ${error.message}`, 'error');
      }
    }
  }

  /**
   * Cancel dialog
   */
  cancelDialog() {
    if (this.currentOverlay) {
      this.currentOverlay.remove();
      this.currentOverlay = null;
    }
    this.clientCaseSelector = null;
  }

  /**
   * Save state to localStorage
   */
  saveToStorage() {
    const state = {
      isRunning: this.isRunning,
      startTime: this.startTime,
      elapsedSeconds: this.elapsedSeconds
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
  }

  /**
   * Restore timer state from localStorage
   */
  restoreFromStorage() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (!saved) {
      return;
    }

    try {
      const state = JSON.parse(saved);

      if (!state.isRunning) {
        this.clearStorage();
        return;
      }

      // Check if timer is too old (> 4 hours)
      const now = Date.now();
      const elapsed = now - state.startTime;
      const maxAge = 4 * 60 * 60 * 1000; // 4 hours

      if (elapsed > maxAge) {
        console.warn('⚠️ Timer too old, clearing');
        this.clearStorage();
        return;
      }

      // Ask user if they want to continue
      const continueTimer = confirm('נמצאה שיחה פעילה. להמשיך?');

      if (continueTimer) {
        this.startTime = state.startTime;
        this.elapsedSeconds = state.elapsedSeconds;
        this.isRunning = true;

        // Update UI
        this.button.classList.add('active');
        this.button.querySelector('.timer-text').style.display = 'none';
        this.timerDisplay.style.display = 'inline';

        // Start interval
        this.intervalId = setInterval(this.updateDisplay, 1000);

        console.log('📞 Timer restored from storage');
      } else {
        this.clearStorage();
      }

    } catch (error) {
      console.error('❌ Error restoring timer:', error);
      this.clearStorage();
    }
  }

  /**
   * Clear localStorage
   */
  clearStorage() {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}

/* ========================================
   INITIALIZATION
   ======================================== */

// Create global instance
window.phoneCallTimer = null;

// Initialize when DOM is ready and user is authenticated
document.addEventListener('DOMContentLoaded', () => {
  // Wait for authentication
  window.addEventListener('userAuthenticated', (e) => {
    const manager = e.detail;

    if (!window.phoneCallTimer) {
      window.phoneCallTimer = new PhoneCallTimer(manager);
      window.phoneCallTimer.init();
      console.log('✅ Phone Call Timer initialized');
    }
  });
});

// Export for module usage
export { PhoneCallTimer };
