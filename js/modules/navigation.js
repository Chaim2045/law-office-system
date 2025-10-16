/**
 * Navigation Module
 * Handles tab switching, smart form toggling, and navigation-related functions
 *
 * Created: 2025
 * Part of Law Office Management System
 */

import { currentActiveTab } from './core-utils.js';

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

  // Update global state (imported as reference, but we need to update the original)
  // This will be handled by the importing module
  window.currentActiveTab = tabName;
}

function toggleNotifications() {
  if (window.notificationBell) {
    window.notificationBell.toggleDropdown();
  }
}

function clearAllNotifications() {
  if (confirm("האם אתה בטוח שברצונך למחוק את כל ההתראות?")) {
    if (window.notificationBell) {
      window.notificationBell.clearAllNotifications();
    }
  }
}

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

// Exports
export {
  switchTab,
  toggleNotifications,
  clearAllNotifications,
  openSmartForm
};
