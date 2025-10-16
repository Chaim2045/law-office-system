/**
 * Event Handlers Module
 * =====================
 * Global event handlers that are called directly from HTML via onclick, onchange, oninput attributes.
 *
 * Extracted from script.js (v4.34.0)
 *
 * Dependencies:
 * - window.manager (LawOfficeManager instance)
 * - window.notificationBell (NotificationBellSystem instance)
 * - window.UserTracker
 * - firebase
 *
 * @version 4.34.0
 * @date 2025-10-15
 */

// ==================== TAB SWITCHING ====================
// Lines: 4035-4108

/**
 * Switch between main tabs (budget, timesheet, reports)
 * Called from: index.html onclick="switchTab('budget')" etc.
 *
 * @param {string} tabName - The tab to switch to: 'budget', 'timesheet', or 'reports'
 */
function switchTab(tabName) {
  const budgetFormContainer = document.getElementById("budgetFormContainer");
  const timesheetFormContainer = document.getElementById(
    "timesheetFormContainer"
  );

  if (budgetFormContainer) budgetFormContainer.classList.add("hidden");
  if (timesheetFormContainer) timesheetFormContainer.classList.add("hidden");

  const plusButton = document.getElementById("smartPlusBtn");
  if (plusButton) {
    plusButton.classList.remove("active");
  }

  // הסרת active מכל הכפתורים והתכנים
  document.querySelectorAll(".tab-button").forEach((btn) => {
    btn.classList.remove("active");
  });

  document.querySelectorAll(".tab-content").forEach((content) => {
    content.classList.remove("active");
  });

  // הוספת active לכפתור ולתוכן הנכונים
  if (tabName === "budget") {
    const budgetTab = document.getElementById("budgetTab");
    if (budgetTab) budgetTab.classList.add("active");

    // הוספת active לכפתור התקצוב
    document.querySelectorAll('.tab-button[onclick*="budget"]').forEach(btn => {
      btn.classList.add("active");
    });
  } else if (tabName === "timesheet") {
    const timesheetTab = document.getElementById("timesheetTab");
    if (timesheetTab) timesheetTab.classList.add("active");

    // הוספת active לכפתור השעתון
    document.querySelectorAll('.tab-button[onclick*="timesheet"]').forEach(btn => {
      btn.classList.add("active");
    });

    const dateField = document.getElementById("actionDate");
    if (dateField) {
      dateField.value = new Date().toISOString().split("T")[0];
    }
  } else if (tabName === "reports") {
    const reportsTab = document.getElementById("reportsTab");
    if (reportsTab) reportsTab.classList.add("active");

    // הוספת active לכפתור הדוחות
    document.querySelectorAll('.tab-button[onclick*="reports"], .nav-item[onclick*="reports"]').forEach(btn => {
      btn.classList.add("active");
    });

    // הסתרת כפתור הפלוס בטאב דוחות - לא רלוונטי
    if (plusButton) {
      plusButton.style.display = 'none';
    }

    // Initialize reports form on first load
    if (typeof manager !== 'undefined' && manager.initReportsForm) {
      manager.initReportsForm();
    }
  }

  // הצגת כפתור הפלוס בטאבים אחרים
  if (tabName !== 'reports' && plusButton) {
    plusButton.style.display = '';
    plusButton.style.visibility = 'visible';
    plusButton.style.opacity = '1';
  }

  currentActiveTab = tabName;
}

// ==================== NOTIFICATIONS ====================
// Lines: 4110-4118

/**
 * Toggle notifications dropdown
 * Called from: index.html onclick="toggleNotifications()"
 */
function toggleNotifications() {
  notificationBell.toggleDropdown();
}

/**
 * Clear all notifications with confirmation
 * Called from: index.html onclick="clearAllNotifications()"
 */
function clearAllNotifications() {
  if (confirm("האם אתה בטוח שברצונך למחוק את כל ההתראות?")) {
    notificationBell.clearAllNotifications();
  }
}

// ==================== CLIENT FORM ====================
// Lines: 4120-4217

/**
 * Show client form (with password protection)
 * Called from: index.html onclick="showClientForm();"
 */
function showClientForm() {
  showPasswordDialog();
}

/**
 * Show password dialog for adding new client
 * Internal helper function
 */
function showPasswordDialog() {
  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";
  overlay.innerHTML = `
    <div class="popup" style="max-width: 450px;">
      <div class="popup-header">
        <i class="fas fa-shield-alt"></i>
        אזור מוגן
      </div>
      <div style="text-align: center; padding: 30px 20px;">
        <div style="font-size: 48px; margin-bottom: 20px; color: #dc2626;">
          <i class="fas fa-lock"></i>
        </div>
        <h3 style="color: #1f2937; margin-bottom: 15px; font-size: 20px;">
          הוספת לקוח חדש מוגנת בסיסמה
        </h3>
        <form id="passwordCheckForm">
          <input type="password" id="adminPassword" placeholder="הכנס סיסמת מנהל"
                 style="width: 100%; padding: 15px; border: 2px solid #e5e7eb; border-radius: 12px; margin-bottom: 20px;" required>
          <div id="passwordError" class="error-message hidden" style="margin-bottom: 15px; color: #dc2626;">
            <i class="fas fa-exclamation-triangle"></i> סיסמה שגויה
          </div>
          <div class="popup-buttons">
            <button type="button" class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()">
              <i class="fas fa-times"></i> ביטול
            </button>
            <button type="submit" class="popup-btn popup-btn-confirm">
              <i class="fas fa-unlock"></i> אמת סיסמה
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const form = overlay.querySelector("#passwordCheckForm");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    checkAdminPassword(overlay);
  });
}

/**
 * Check admin password for client form access
 * Internal helper function
 *
 * @param {HTMLElement} overlay - The password dialog overlay element
 */
function checkAdminPassword(overlay) {
  const adminPassword = document.getElementById("adminPassword");
  const errorDiv = document.getElementById("passwordError");

  if (!adminPassword || !errorDiv) return;

  const password = adminPassword.value;

  if (password === "9668") {
    overlay.remove();
    if (window.manager) {
      window.manager.showNotification(
        "אומת בהצלחה! פותח טופס הוספת לקוח...",
        "success"
      );
    }
    setTimeout(openClientForm, 500);
  } else {
    errorDiv.classList.remove("hidden");
    adminPassword.value = "";
    adminPassword.focus();

    setTimeout(() => {
      errorDiv.classList.add("hidden");
    }, 2000);
  }
}

/**
 * Open client form after password validation
 * Internal helper function
 */
function openClientForm() {
  const clientFormOverlay = document.getElementById("clientFormOverlay");
  if (clientFormOverlay) {
    clientFormOverlay.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    if (window.manager) {
      window.manager.updateClientTypeDisplay();
    }
  }
}

/**
 * Hide client form and reset
 * Called from: index.html onclick="hideClientForm()"
 */
function hideClientForm() {
  const clientFormOverlay = document.getElementById("clientFormOverlay");
  const clientForm = document.getElementById("clientForm");

  if (clientFormOverlay) clientFormOverlay.classList.add("hidden");
  document.body.style.overflow = "auto";
  if (clientForm) clientForm.reset();
  if (window.manager) {
    window.manager.updateClientTypeDisplay();
  }
}

// ==================== LOGOUT ====================
// Lines: 4221-4270

/**
 * Show logout confirmation dialog
 * Called from: index.html onclick="logout();"
 */
function logout() {
  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";
  overlay.innerHTML = `
    <div class="popup" style="max-width: 450px;">
      <div class="popup-header" style="color: #dc2626;">
        <i class="fas fa-power-off"></i>
        יציאה מהמערכת
      </div>
      <div style="text-align: center; padding: 20px 0;">
        <div style="font-size: 48px; margin-bottom: 20px;">👋</div>
        <h3 style="color: #1f2937; margin-bottom: 15px; font-size: 20px;">
          האם אתה בטוח שברצונך לצאת?
        </h3>
        <p style="color: #6b7280; font-size: 16px;">
          כל הנתונים שלא נשמרו יאבדו.
        </p>
      </div>
      <div class="popup-buttons">
        <button class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()">
          <i class="fas fa-times"></i> ביטול
        </button>
        <button class="popup-btn popup-btn-confirm" onclick="confirmLogout()">
          <i class="fas fa-check"></i> כן, צא מהמערכת
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

/**
 * Confirm logout and sign out from Firebase
 * Called from: logout() function inline onclick
 */
async function confirmLogout() {
  const interfaceElements = document.getElementById("interfaceElements");
  if (interfaceElements) interfaceElements.classList.add("hidden");

  if (window.manager) {
    window.manager.showNotification("מתנתק מהמערכת... להתראות! 👋", "info");
  }

  // Track logout in Firebase
  if (window.UserTracker) {
    await window.UserTracker.trackLogout();
  }

  // התנתק מ-Firebase Auth
  await firebase.auth().signOut();

  // רענן דף - Auth State Listener יזהה שהמשתמש התנתק ויציג מסך התחברות
  setTimeout(() => location.reload(), 1500);
}

// ==================== SMART FORM ====================
// Lines: 4272-4295

/**
 * Open/close smart form based on active tab
 * Called from: index.html onclick="openSmartForm()"
 */
function openSmartForm() {
  const plusButton = document.getElementById("smartPlusBtn");
  const activeTab = document.querySelector(".tab-button.active");
  if (!activeTab) return;

  let currentForm;
  if (activeTab.onclick && activeTab.onclick.toString().includes("budget")) {
    currentForm = document.getElementById("budgetFormContainer");
  } else if (
    activeTab.onclick &&
    activeTab.onclick.toString().includes("timesheet")
  ) {
    currentForm = document.getElementById("timesheetFormContainer");
  }

  if (!currentForm) return;
  if (currentForm.classList.contains("hidden")) {
    currentForm.classList.remove("hidden");
    if (plusButton) plusButton.classList.add("active");
  } else {
    currentForm.classList.add("hidden");
    if (plusButton) plusButton.classList.remove("active");
  }
}

// ==================== EXPORTS ====================

// Make functions globally available for HTML onclick attributes
if (typeof window !== 'undefined') {
  window.switchTab = switchTab;
  window.toggleNotifications = toggleNotifications;
  window.clearAllNotifications = clearAllNotifications;
  window.showClientForm = showClientForm;
  window.hideClientForm = hideClientForm;
  window.logout = logout;
  window.confirmLogout = confirmLogout;
  window.openSmartForm = openSmartForm;

  // Internal helper functions (not exposed but kept for compatibility)
  window.showPasswordDialog = showPasswordDialog;
  window.checkAdminPassword = checkAdminPassword;
  window.openClientForm = openClientForm;
}

console.log('[Event Handlers] Module loaded successfully - v4.34.0');
