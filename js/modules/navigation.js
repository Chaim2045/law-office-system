/**
 * Navigation Module
 * Handles tab switching, smart form toggling, and navigation-related functions
 *
 * Created: 2025
 * Part of Law Office Management System
 */

import { currentActiveTab } from './core-utils.js';
// NotificationSystem is available globally on window object

function switchTab(tabName) {
  const budgetFormContainer = document.getElementById('budgetFormContainer');
  const timesheetFormContainer = document.getElementById(
    'timesheetFormContainer'
  );

  if (budgetFormContainer) {
budgetFormContainer.classList.add('hidden');
}
  if (timesheetFormContainer) {
timesheetFormContainer.classList.add('hidden');
}

  const plusButton = document.getElementById('smartPlusBtn');
  if (plusButton) {
    plusButton.classList.remove('active');
  }

  // Restore plus container by default (beit-midrash overrides below)
  const plusContainer = document.querySelector('.plus-container-new');
  if (plusContainer) {
    plusContainer.style.display = '';
  }

  // הסרת active מכל הכפתורים והתכנים
  document.querySelectorAll('.tab-button, .top-nav-btn').forEach((btn) => {
    btn.classList.remove('active');
  });

  document.querySelectorAll('.tab-content').forEach((content) => {
    content.classList.remove('active');
  });

  // Beit Midrash — separate flow (lazy init, hide plus)
  if (tabName === 'beit-midrash') {
    const bmTab = document.getElementById('beitMidrashTab');
    if (bmTab) {
      bmTab.classList.add('active');
    }
    if (plusContainer) {
      plusContainer.style.display = 'none';
    }
    if (window.initBeitMidrash) {
      window.initBeitMidrash();
    }
    window.currentActiveTab = tabName;
    return;
  }

  // הוספת active לכפתור ולתוכן הנכונים
  if (tabName === 'budget') {
    const budgetTab = document.getElementById('budgetTab');
    if (budgetTab) {
budgetTab.classList.add('active');
}

    // הוספת active לכפתור התקצוב (כולל הכפתור בסרגל העליון)
    document.querySelectorAll('.tab-button[onclick*="budget"], .top-nav-btn[onclick*="budget"]').forEach(btn => {
      btn.classList.add('active');
    });
  } else if (tabName === 'timesheet') {
    const timesheetTab = document.getElementById('timesheetTab');
    if (timesheetTab) {
timesheetTab.classList.add('active');
}

    // הוספת active לכפתור השעתון (כולל הכפתור בסרגל העליון)
    document.querySelectorAll('.tab-button[onclick*="timesheet"], .top-nav-btn[onclick*="timesheet"]').forEach(btn => {
      btn.classList.add('active');
    });

    // Let Flatpickr handle the date field initialization
    // Don't set value directly - it conflicts with Flatpickr
    const dateField = document.getElementById('actionDate');
    if (dateField && window.manager && window.manager.timesheetCalendar) {
      // Use Flatpickr API instead of direct value assignment
      const now = new Date();
      window.manager.timesheetCalendar.setDate(now, false);
    }
  } else if (tabName === 'reports') {
    const reportsTab = document.getElementById('reportsTab');
    if (reportsTab) {
reportsTab.classList.add('active');
}

    // הוספת active לכפתור הדוחות
    document.querySelectorAll('.tab-button[onclick*="reports"], .nav-item[onclick*="reports"]').forEach(btn => {
      btn.classList.add('active');
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
  const notificationSystem = window.notificationSystem || new NotificationSystem();

  notificationSystem.confirm(
    'כל ההתראות יימחקו ולא ניתן יהיה לשחזר אותן.',
    () => {
      // אישור - מחק הכל
      if (window.notificationBell) {
        window.notificationBell.clearAllNotifications();
        notificationSystem.show('כל ההתראות נמחקו בהצלחה', 'success');
      }
    },
    () => {
      // ביטול - לא עושים כלום
      Logger.log('ביטול מחיקת התראות');
    },
    {
      title: '⚠️ מחיקת כל ההתראות',
      confirmText: 'מחק הכל',
      cancelText: 'ביטול',
      type: 'warning'
    }
  );
}

function openSmartForm() {
  const plusButton = document.getElementById('smartPlusBtn');
  const activeTab = window.currentActiveTab || 'budget';

  let currentForm;
  let formType;

  if (activeTab === 'budget') {
    currentForm = document.getElementById('budgetFormContainer');
    formType = 'budget';
  } else if (activeTab === 'timesheet') {
    currentForm = document.getElementById('timesheetFormContainer');
    formType = 'timesheet';
  }

  if (!currentForm) {
return;
}

  if (currentForm.classList.contains('hidden')) {
    currentForm.classList.remove('hidden');
    if (plusButton) {
plusButton.classList.add('active');
}

    // ✅ Initialize the appropriate ClientCaseSelector when form opens
    if (window.ClientCaseSelectorsManager) {
      if (formType === 'budget') {
        Logger.log('🎯 Opening budget form - initializing selectors...');
        window.ClientCaseSelectorsManager.initializeBudget();
        window.ClientCaseSelectorsManager.clearBudgetDescription(); // ✅ Clear first (no last-used for new tasks)
        window.ClientCaseSelectorsManager.initializeBudgetDescription(); // ✅ Initialize description selector
      } else if (formType === 'timesheet') {
        Logger.log('🎯 Opening timesheet form - initializing selector...');
        window.ClientCaseSelectorsManager.initializeTimesheet();
      }
    }

    // ✅ Smooth scroll to form - only if not already visible
    setTimeout(() => {
      const formRect = currentForm.getBoundingClientRect();
      const isVisible = formRect.top >= 0 && formRect.bottom <= window.innerHeight;

      // Only scroll if form is not fully visible
      if (!isVisible) {
        // Scroll with offset to account for header/navbar
        const yOffset = -80; // 80px offset from top
        const y = currentForm.getBoundingClientRect().top + window.pageYOffset + yOffset;

        window.scrollTo({
          top: y,
          behavior: 'smooth'
        });
      }
    }, 100);
  } else {
    currentForm.classList.add('hidden');
    if (plusButton) {
plusButton.classList.remove('active');
}
  }
}

// Exports
export {
  switchTab,
  toggleNotifications,
  clearAllNotifications,
  openSmartForm
};
