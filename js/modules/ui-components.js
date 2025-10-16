/**
 * UI Components Module
 * Provides DOM management, notification system, and UI interaction helpers
 *
 * Created: 2025
 * Part of Law Office Management System
 */

import { safeText } from './core-utils.js';
import { globalListeners } from './core-utils.js';

/* === Utility Classes === */

/**
 * DOM elements cache
 */
class DOMCache {
  constructor() {
    this.elements = new Map();
  }

  getElementById(id) {
    if (this.elements.has(id)) {
      return this.elements.get(id);
    }
    const element = document.getElementById(id);
    if (element) {
      this.elements.set(id, element);
    }
    return element;
  }

  querySelector(selector) {
    if (this.elements.has(selector)) {
      return this.elements.get(selector);
    }
    const element = document.querySelector(selector);
    if (element) {
      this.elements.set(selector, element);
    }
    return element;
  }
}

/**
 * Notification bell system
 */
class NotificationBellSystem {
  constructor() {
    this.notifications = [];
    this.isDropdownOpen = false;
    this.clickHandler = null;
    this.init();
  }

  init() {
    this.clickHandler = (e) => {
      const bell = document.getElementById("notificationBell");
      const dropdown = document.getElementById("notificationsDropdown");
      if (
        bell &&
        dropdown &&
        !bell.contains(e.target) &&
        !dropdown.contains(e.target)
      ) {
        this.hideDropdown();
      }
    };
    globalListeners.notificationClick = this.clickHandler;
    document.addEventListener("click", this.clickHandler);
  }

  cleanup() {
    if (this.clickHandler) {
      document.removeEventListener("click", this.clickHandler);
    }
  }

  addNotification(type, title, description, urgent = false) {
    const notification = {
      id: Date.now() + Math.random(),
      type,
      title,
      description,
      time: new Date().toLocaleString("he-IL"),
      urgent,
    };
    this.notifications.unshift(notification);
    this.updateBell();
    this.renderNotifications();
  }

  removeNotification(id) {
    this.notifications = this.notifications.filter((n) => n.id !== id);
    this.updateBell();
    this.renderNotifications();
  }

  clearAllNotifications() {
    this.notifications = [];
    this.updateBell();
    this.renderNotifications();
  }

  updateBell() {
    const bell = document.getElementById("notificationBell");
    const count = document.getElementById("notificationCount");
    if (bell && count) {
      if (this.notifications.length > 0) {
        bell.classList.add("has-notifications");
        count.classList.remove("hidden");
        count.textContent = this.notifications.length;
      } else {
        bell.classList.remove("has-notifications");
        count.classList.add("hidden");
      }
    }
  }

  showDropdown() {
    const dropdown = document.getElementById("notificationsDropdown");
    if (dropdown) {
      dropdown.classList.add("show");
      this.isDropdownOpen = true;
    }
  }

  hideDropdown() {
    const dropdown = document.getElementById("notificationsDropdown");
    if (dropdown) {
      dropdown.classList.remove("show");
      this.isDropdownOpen = false;
    }
  }

  toggleDropdown() {
    this.isDropdownOpen ? this.hideDropdown() : this.showDropdown();
  }

  renderNotifications() {
    const container = document.getElementById("notificationsContent");
    if (!container) return;

    if (this.notifications.length === 0) {
      container.innerHTML = `
        <div class="no-notifications">
          <div class="no-notifications-icon"><i class="fas fa-bell-slash"></i></div>
          <h4>אין התראות</h4>
          <p>כל ההתראות יופיעו כאן</p>
        </div>
      `;
      return;
    }

    const iconMap = {
      blocked: "fas fa-ban",
      critical: "fas fa-exclamation-triangle",
      urgent: "fas fa-clock",
    };

    const notificationsHtml = this.notifications
      .map((notification) => {
        const notificationDiv = document.createElement("div");
        notificationDiv.className = `notification-item ${notification.type} ${
          notification.urgent ? "urgent" : ""
        }`;
        notificationDiv.id = `notification-${notification.id}`;

        notificationDiv.innerHTML = `
          <button class="notification-close" onclick="notificationBell.removeNotification(${
            notification.id
          })">
            <i class="fas fa-times"></i>
          </button>
          <div class="notification-content">
            <div class="notification-icon ${notification.type}">
              <i class="${
                iconMap[notification.type] || "fas fa-info-circle"
              }"></i>
            </div>
            <div class="notification-text">
              <div class="notification-title">${safeText(
                notification.title
              )}</div>
              <div class="notification-description">${safeText(
                notification.description
              )}</div>
              <div class="notification-time">${safeText(
                notification.time
              )}</div>
            </div>
          </div>
        `;
        return notificationDiv.outerHTML;
      })
      .join("");

    container.innerHTML = notificationsHtml;
  }

  updateFromSystem(blockedClients, criticalClients, urgentTasks) {
    this.notifications = this.notifications.filter((n) => !n.isSystemGenerated);

    if (blockedClients.size > 0) {
      this.addSystemNotification(
        "blocked",
        `${blockedClients.size} לקוחות חסומים`,
        `לקוחות ללא שעות: ${Array.from(blockedClients).join(", ")}`,
        true
      );
    }

    if (criticalClients.size > 0) {
      this.addSystemNotification(
        "critical",
        `${criticalClients.size} לקוחות קריטיים`,
        `לקוחות עם מעט שעות: ${Array.from(criticalClients).join(", ")}`,
        false
      );
    }

    if (urgentTasks.length > 0) {
      const overdueCount = urgentTasks.filter(
        (task) => new Date(task.deadline) <= new Date()
      ).length;
      if (overdueCount > 0) {
        this.addSystemNotification(
          "urgent",
          `${overdueCount} משימות באיחור`,
          "משימות שעבר תאריך היעד שלהן",
          true
        );
      }
    }
  }

  addSystemNotification(type, title, description, urgent) {
    const notification = {
      id: Date.now() + Math.random(),
      type,
      title,
      description,
      time: new Date().toLocaleString("he-IL"),
      urgent,
      isSystemGenerated: true,
    };
    this.notifications.unshift(notification);
    this.updateBell();
    this.renderNotifications();
  }
}

/* === Public API Functions === */

function updateUserDisplay(userName) {
  const userDisplay = document.getElementById("currentUserDisplay");
  if (userDisplay && userName) {
    userDisplay.textContent = `${userName} - משרד עו"ד גיא הרשקוביץ`;
  }
}

function updateSidebarUser(userName) {
  const userAvatar = document.querySelector(".user-avatar");
  if (!userAvatar) return;

  if (userName) {
    userAvatar.setAttribute("title", `מחובר: ${userName}`);
    userAvatar.setAttribute("data-user", userName);

    const colors = [
      "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
      "linear-gradient(135deg, #10b981 0%, #059669 100%)",
      "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
      "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
      "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
      "linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)",
      "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
      "linear-gradient(135deg, #84cc16 0%, #65a30d 100%)",
    ];

    const colorIndex = userName.charCodeAt(0) % colors.length;
    userAvatar.style.background = colors[colorIndex];
    userAvatar.style.transform = "scale(1.05)";
    setTimeout(() => {
      userAvatar.style.transform = "";
    }, 300);
  }
}

function showClientForm() {
  showPasswordDialog();
}

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

function showNotification(message, type = "success") {
  try {
    const notification = document.getElementById("notification");
    if (!notification) return;

    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.add("show");

    setTimeout(() => {
      notification.classList.remove("show");
    }, 3000);
  } catch (error) {
    console.error("Notification error:", error);
  }
}

// Exports
export {
  DOMCache,
  NotificationBellSystem,
  updateUserDisplay,
  updateSidebarUser,
  showClientForm,
  showPasswordDialog,
  checkAdminPassword,
  openClientForm,
  hideClientForm,
  showNotification
};
