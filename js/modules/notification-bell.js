/**
 * Notification Bell System Module
 * Handles notification management, display, and user interactions
 *
 * Created: 2025
 * Part of Law Office Management System
 */

import { safeText } from './core-utils.js';

/**
 * NotificationBellSystem class
 * Manages the notification bell UI, dropdown, and notification list
 */
export class NotificationBellSystem {
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

export default NotificationBellSystem;
