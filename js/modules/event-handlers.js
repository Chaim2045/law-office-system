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
// ✅ REMOVED - Client creation is now handled by CasesManager in cases.js
// Old functions removed: showClientForm, showPasswordDialog, checkAdminPassword, openClientForm, hideClientForm
// Use casesManager.showCreateCaseDialog() instead

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

    // גלילה חלקה למעלה לטופס
    setTimeout(() => {
      // First, try to scroll the form into view
      currentForm.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'start'
      });

      // Then scroll up a bit more to show the form header
      setTimeout(() => {
        const formPosition = currentForm.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo({
          top: formPosition - 20,
          behavior: 'smooth'
        });
      }, 100);
    }, 50);
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
  window.logout = logout;
  window.confirmLogout = confirmLogout;
  window.openSmartForm = openSmartForm;

  // ✅ Client form functions removed - use casesManager.showCreateCaseDialog() instead
}

console.log('[Event Handlers] Module loaded successfully - v4.34.0');
