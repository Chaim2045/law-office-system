/**
 * Phone Call Timer Module
 * ========================
 * מודול לניהול טיימר שיחות טלפון עם רישום אוטומטי לשעתון
 *
 * @version 1.0.0
 * @created 2025-12-25
 *
 * תכונות:
 * - טיימר התחלה/עצירה
 * - שמירה ב-localStorage למקרה סגירת דפדפן
 * - מודל לבחירת לקוח/פנימי
 * - רישום אוטומטי לשעתון
 * - עיצוב מודרני ומהודק
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
   * Create the timer button in the sidebar
   */
  createButton() {
    const sidebar = document.getElementById('minimalSidebar');
    if (!sidebar) {
      console.error('❌ Sidebar not found');
      return;
    }

    const nav = sidebar.querySelector('.sidebar-nav');
    if (!nav) {
      console.error('❌ Sidebar nav not found');
      return;
    }

    // Find the divider before logout button
    const divider = nav.querySelector('.nav-divider');

    // Create button HTML
    const buttonHTML = `
      <button
        class="nav-item phone-call-btn"
        id="phoneCallTimerBtn"
        title="התחל/עצור שיחת טלפון"
      >
        <i class="fas fa-phone"></i>
        <span class="timer-text">שיחה</span>
        <span class="timer-display hidden">00:00</span>
      </button>
    `;

    // Insert before divider
    if (divider) {
      divider.insertAdjacentHTML('beforebegin', buttonHTML);
    } else {
      nav.insertAdjacentHTML('beforeend', buttonHTML);
    }

    // Get references
    this.button = document.getElementById('phoneCallTimerBtn');
    this.timerDisplay = this.button.querySelector('.timer-display');

    // Add event listener
    this.button.addEventListener('click', this.handleButtonClick);
  }

  /**
   * Handle button click - start or stop timer
   */
  handleButtonClick(event) {
    event.preventDefault();
    event.stopPropagation();

    if (this.isRunning) {
      this.stop();
    } else {
      this.start();
    }
  }

  /**
   * Start the timer
   */
  start() {
    this.startTime = Date.now();
    this.isRunning = true;
    this.elapsedSeconds = 0;

    // Update UI
    this.button.classList.add('active');
    this.button.querySelector('.timer-text').classList.add('hidden');
    this.timerDisplay.classList.remove('hidden');

    // Start interval
    this.intervalId = setInterval(this.updateDisplay, 1000);

    // Save to localStorage
    this.saveToStorage();

    // Show notification
    if (window.NotificationSystem) {
      window.NotificationSystem.show('⏱️ שיחת טלפון התחילה', 'success');
    }

    console.log('✅ Phone call timer started');
  }

  /**
   * Stop the timer and show dialog
   */
  stop() {
    // Stop interval
    clearInterval(this.intervalId);
    this.intervalId = null;

    // Calculate elapsed time
    const elapsedMs = Date.now() - this.startTime;
    const elapsedMinutes = Math.ceil(elapsedMs / 60000); // Round up to minutes

    // Reset timer state
    this.isRunning = false;

    // Update UI
    this.button.classList.remove('active');
    this.button.querySelector('.timer-text').classList.remove('hidden');
    this.timerDisplay.classList.add('hidden');

    // Clear localStorage
    this.clearStorage();

    console.log(`✅ Phone call timer stopped - ${elapsedMinutes} minutes`);

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

    // Update storage every 5 seconds
    if (this.elapsedSeconds % 5 === 0) {
      this.saveToStorage();
    }
  }

  /**
   * Show completion dialog
   */
  showCompletionDialog(elapsedMinutes) {
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay phone-call-overlay';
    overlay.innerHTML = `
      <div class="popup phone-call-popup">
        <div class="popup-header">
          <i class="fas fa-phone"></i>
          שיחת טלפון הסתיימה
        </div>

        <div class="popup-content">
          <!-- Timer Summary -->
          <div class="timer-summary">
            <div class="timer-icon">
              <i class="fas fa-stopwatch"></i>
            </div>
            <div class="timer-duration">
              <span class="duration-value">${elapsedMinutes}</span>
              <span class="duration-label">דקות</span>
            </div>
          </div>

          <!-- Call Type Selection -->
          <div class="call-type-section">
            <label class="section-label">סוג השיחה</label>
            <div class="call-type-buttons">
              <button
                class="call-type-btn active"
                data-type="client"
                onclick="phoneCallTimer.selectCallType('client')"
              >
                <i class="fas fa-user"></i>
                <span>שיחה עם לקוח</span>
              </button>
              <button
                class="call-type-btn"
                data-type="internal"
                onclick="phoneCallTimer.selectCallType('internal')"
              >
                <i class="fas fa-building"></i>
                <span>רישום פנימי</span>
              </button>
            </div>
          </div>

          <!-- Client Selection (shown only for client calls) -->
          <div class="client-selection-section" id="clientSelectionSection">
            <div class="form-group">
              <label for="phoneCallClient">
                <i class="fas fa-user"></i>
                בחר לקוח
                <span class="required">*</span>
              </label>
              <input
                type="text"
                id="phoneCallClient"
                class="modern-input"
                placeholder="התחל להקליד שם לקוח..."
                autocomplete="off"
              />
              <div class="client-search-results" id="phoneCallClientResults"></div>
            </div>

            <div class="form-group">
              <label for="phoneCallService">
                <i class="fas fa-briefcase"></i>
                בחר שירות
                <span class="required">*</span>
              </label>
              <select id="phoneCallService" class="modern-select" disabled>
                <option value="">בחר תחילה לקוח</option>
              </select>
            </div>
          </div>

          <!-- Description -->
          <div class="form-group">
            <label for="phoneCallDescription">
              <i class="fas fa-align-right"></i>
              תיאור השיחה
              <span class="required">*</span>
            </label>
            <textarea
              id="phoneCallDescription"
              class="modern-textarea"
              rows="3"
              placeholder="למשל: בירור לגבי..."
              required
            ></textarea>
            <small class="form-help">
              התיאור יישמר כ: "שיחת טלפון עם לקוח בעניין: ..."
            </small>
          </div>

          <!-- Time Adjustment -->
          <div class="form-group">
            <label for="phoneCallMinutes">
              <i class="fas fa-clock"></i>
              זמן (דקות)
            </label>
            <input
              type="number"
              id="phoneCallMinutes"
              class="modern-input time-input"
              value="${elapsedMinutes}"
              min="1"
              max="999"
            />
            <small class="form-help">
              ניתן לעדכן את הזמן במידת הצורך
            </small>
          </div>
        </div>

        <div class="popup-buttons">
          <button
            class="popup-btn popup-btn-secondary"
            onclick="phoneCallTimer.cancelDialog()"
          >
            <i class="fas fa-times"></i>
            ביטול
          </button>
          <button
            class="popup-btn popup-btn-primary"
            onclick="phoneCallTimer.saveToTimesheet()"
          >
            <i class="fas fa-save"></i>
            שמור לשעתון
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Initialize with "client" type selected
    this.currentCallType = 'client';
    this.selectedClient = null;
    this.selectedService = null;

    // Add client search functionality
    this.initClientSearch();

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

    // Update buttons
    const buttons = document.querySelectorAll('.call-type-btn');
    buttons.forEach(btn => {
      if (btn.dataset.type === type) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Show/hide client selection
    const clientSection = document.getElementById('clientSelectionSection');
    if (type === 'client') {
      clientSection.style.display = 'block';
    } else {
      clientSection.style.display = 'none';
    }
  }

  /**
   * Initialize client search
   */
  initClientSearch() {
    const clientInput = document.getElementById('phoneCallClient');
    const resultsDiv = document.getElementById('phoneCallClientResults');

    if (!clientInput) {
return;
}

    clientInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.trim();

      if (searchTerm.length < 2) {
        resultsDiv.innerHTML = '';
        resultsDiv.style.display = 'none';
        return;
      }

      // Get clients from manager
      const clients = this.manager.clients || [];
      const filtered = clients.filter(client =>
        client.fullName && client.fullName.includes(searchTerm)
      );

      if (filtered.length === 0) {
        resultsDiv.innerHTML = '<div class="no-results">לא נמצאו לקוחות</div>';
        resultsDiv.style.display = 'block';
        return;
      }

      // Render results
      resultsDiv.innerHTML = filtered
        .slice(0, 5)
        .map(client => `
          <div
            class="client-result-item"
            onclick="phoneCallTimer.selectClient('${client.id}', '${client.fullName}')"
          >
            <div class="client-name">${client.fullName}</div>
            <div class="client-file">${client.fileNumber || ''}</div>
          </div>
        `)
        .join('');

      resultsDiv.style.display = 'block';
    });

    // Close results when clicking outside
    document.addEventListener('click', (e) => {
      if (!clientInput.contains(e.target) && !resultsDiv.contains(e.target)) {
        resultsDiv.style.display = 'none';
      }
    });
  }

  /**
   * Select a client from search results
   */
  selectClient(clientId, clientName) {
    this.selectedClient = { id: clientId, name: clientName };

    const clientInput = document.getElementById('phoneCallClient');
    const resultsDiv = document.getElementById('phoneCallClientResults');
    const serviceSelect = document.getElementById('phoneCallService');

    clientInput.value = clientName;
    resultsDiv.style.display = 'none';

    // Load client services
    this.loadClientServices(clientId, serviceSelect);
  }

  /**
   * Load services for selected client
   */
  async loadClientServices(clientId, serviceSelect) {
    serviceSelect.disabled = true;
    serviceSelect.innerHTML = '<option value="">טוען שירותים...</option>';

    try {
      const db = window.firebaseDB;
      const snapshot = await db
        .collection('services')
        .where('clientId', '==', clientId)
        .where('isActive', '==', true)
        .get();

      if (snapshot.empty) {
        serviceSelect.innerHTML = '<option value="">לא נמצאו שירותים פעילים</option>';
        return;
      }

      const services = [];
      snapshot.forEach(doc => {
        services.push({ id: doc.id, ...doc.data() });
      });

      serviceSelect.innerHTML = '<option value="">בחר שירות</option>' +
        services.map(service =>
          `<option value="${service.id}">${service.serviceName || service.name}</option>`
        ).join('');

      serviceSelect.disabled = false;

      // Add change listener
      serviceSelect.addEventListener('change', (e) => {
        const selectedService = services.find(s => s.id === e.target.value);
        this.selectedService = selectedService || null;
      });

    } catch (error) {
      console.error('❌ Error loading services:', error);
      serviceSelect.innerHTML = '<option value="">שגיאה בטעינת שירותים</option>';
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

    if (this.currentCallType === 'client') {
      if (!this.selectedClient) {
        if (window.NotificationSystem) {
          window.NotificationSystem.show('נא לבחור לקוח', 'error');
        }
        return;
      }

      if (!this.selectedService) {
        if (window.NotificationSystem) {
          window.NotificationSystem.show('נא לבחור שירות', 'error');
        }
        return;
      }
    }

    // Build timesheet entry
    const timesheetData = {
      employee: this.manager.currentUser,
      date: new Date().toISOString(),
      minutes: minutes,
      action: `שיחת טלפון עם לקוח בעניין: ${description}`,
      notes: '',
      isPhoneCall: true,
      createdAt: new Date()
    };

    // Add client data if applicable
    if (this.currentCallType === 'client') {
      timesheetData.clientName = this.selectedClient.name;
      timesheetData.serviceName = this.selectedService.serviceName || this.selectedService.name;
      timesheetData.serviceId = this.selectedService.id;
      timesheetData.clientId = this.selectedClient.id;
    } else {
      timesheetData.clientName = 'רישום פנימי';
      timesheetData.action = `פעילות פנימית: ${description}`;
    }

    // Show loading
    const saveBtn = this.currentOverlay.querySelector('.popup-btn-primary');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> שומר...';

    try {
      // Save to Firebase
      await this.saveTimesheetEntry(timesheetData);

      // Success
      if (window.NotificationSystem) {
        window.NotificationSystem.show('✅ נשמר בהצלחה לשעתון', 'success');
      }

      // Close dialog
      this.cancelDialog();

      // Refresh timesheet if on that tab
      if (this.manager.currentTab === 'timesheet') {
        await this.manager.loadTimesheetEntries();
      }

    } catch (error) {
      console.error('❌ Error saving to timesheet:', error);

      if (window.NotificationSystem) {
        window.NotificationSystem.show('שגיאה בשמירה: ' + error.message, 'error');
      }

      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fas fa-save"></i> שמור לשעתון';
    }
  }

  /**
   * Save timesheet entry to Firebase
   */
  async saveTimesheetEntry(entryData) {
    try {
      const result = await callFunction('createTimesheetEntry', entryData);

      if (!result.success) {
        throw new Error(result.message || 'שגיאה בשמירת שעתון');
      }

      return result.entryId;
    } catch (error) {
      console.error('Firebase error:', error);
      throw error;
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
  }

  /**
   * Save timer state to localStorage
   */
  saveToStorage() {
    const state = {
      startTime: this.startTime,
      isRunning: this.isRunning,
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

      // Calculate elapsed time since start
      const now = Date.now();
      const elapsed = now - state.startTime;
      const elapsedSeconds = Math.floor(elapsed / 1000);

      // Check if more than 4 hours passed (probably forgotten)
      if (elapsedSeconds > 4 * 60 * 60) {
        this.clearStorage();
        if (window.NotificationSystem) {
          window.NotificationSystem.show(
            'טיימר שיחה ישן נמחק (יותר מ-4 שעות)',
            'warning'
          );
        }
        return;
      }

      // Ask user if they want to continue
      const shouldContinue = confirm(
        `נמצאה שיחת טלפון פעילה (${Math.floor(elapsedSeconds / 60)} דקות).\n\nהאם להמשיך?`
      );

      if (shouldContinue) {
        this.startTime = state.startTime;
        this.elapsedSeconds = elapsedSeconds;
        this.isRunning = true;

        // Update UI
        this.button.classList.add('active');
        this.button.querySelector('.timer-text').classList.add('hidden');
        this.timerDisplay.classList.remove('hidden');

        // Start interval
        this.intervalId = setInterval(this.updateDisplay, 1000);
        this.updateDisplay();

        if (window.NotificationSystem) {
          window.NotificationSystem.show('⏱️ שיחת טלפון התחדשה', 'success');
        }
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

  /**
   * Cleanup - called when user logs out
   */
  cleanup() {
    if (this.isRunning) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.clearStorage();

    if (this.button) {
      this.button.removeEventListener('click', this.handleButtonClick);
    }

    if (this.currentOverlay) {
      this.currentOverlay.remove();
    }
  }
}

/* ========================================
   EXPORT & GLOBAL ACCESS
   ======================================== */

// Export for module usage
export default PhoneCallTimer;

// Make available globally for onclick handlers
window.PhoneCallTimer = PhoneCallTimer;
