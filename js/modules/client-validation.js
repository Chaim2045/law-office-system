/**
 * Client Validation Module
 * Handles client validation, blocked/critical client management, and notifications
 *
 * Created: 202תמ5
 * Part of Law Office Management System
 */

/**
 * ClientValidation class
 * Manages client validation, blocked clients, and critical hours warnings
 */
export class ClientValidation {
  constructor(manager) {
    this.manager = manager;
    this.blockedClients = new Set();
    this.criticalClients = new Set();
    this.blockedClientsData = []; // נתונים מלאים של לקוחות חסומים
    this.criticalClientsData = []; // נתונים מלאים של לקוחות קריטיים
  }

  updateBlockedClients() {
    this.blockedClients.clear();
    this.criticalClients.clear();
    this.blockedClientsData = [];
    this.criticalClientsData = [];

    if (!this.manager.clients || !Array.isArray(this.manager.clients)) {
      return;
    }

    for (const client of this.manager.clients) {
      if (!client) continue;

      if (client.isBlocked) {
        this.blockedClients.add(client.fullName);
        this.blockedClientsData.push({
          name: client.fullName,
          hoursRemaining: client.hoursRemaining || 0
        });
      } else if (
        client.type === "hours" &&
        typeof client.hoursRemaining === "number" &&
        client.hoursRemaining <= 5 &&
        client.hoursRemaining > 0
      ) {
        this.criticalClients.add(client.fullName);
        this.criticalClientsData.push({
          name: client.fullName,
          hoursRemaining: client.hoursRemaining
        });
      }
    }

    this.updateClientSelects();
    this.updateNotificationBell();
  }

  updateClientSelects() {
    const selects = ["budgetClientSelect", "timesheetClientSelect"];

    selects.forEach((selectId) => {
      const select = document.getElementById(selectId);
      if (!select) return;

      const fragment = document.createDocumentFragment();

      const defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.textContent = "בחר לקוח...";
      fragment.appendChild(defaultOption);

      if (!this.manager.clients) return;

      this.manager.clients.forEach((client) => {
        if (!client) return;

        const option = document.createElement("option");
        option.value = client.fullName;

        if (this.blockedClients.has(client.fullName)) {
          option.textContent = `🚫 ${client.fullName} - נגמרו השעות`;
          option.disabled = true;
          option.className = "blocked-client";
        } else {
          let displayText = client.fullName;
          if (
            client.type === "hours" &&
            typeof client.hoursRemaining === "number"
          ) {
            const hoursText =
              client.hoursRemaining <= 5
                ? `🚨 ${client.hoursRemaining.toFixed(1)} שע' נותרות`
                : `${client.hoursRemaining.toFixed(1)} שע' נותרות`;
            displayText += ` (${hoursText})`;
          } else if (client.type === "fixed") {
            displayText += " (פיקס)";
          }
          option.textContent = displayText;
        }

        fragment.appendChild(option);
      });

      select.innerHTML = "";
      select.appendChild(fragment);
    });
  }

  updateNotificationBell() {
    const now = new Date();
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const urgentTasks = (this.manager.budgetTasks || []).filter(
      (task) =>
        task &&
        task.status !== "הושלם" &&
        task.deadline &&
        task.description &&
        new Date(task.deadline) <= oneDayFromNow
    );

    // Assumes global notificationBell exists
    if (window.notificationBell) {
      window.notificationBell.updateFromSystem(
        this.blockedClientsData,  // שולח נתונים מלאים במקום Set
        this.criticalClientsData, // שולח נתונים מלאים במקום Set
        urgentTasks
      );
    }
  }

  validateClientSelection(clientName, action = "רישום") {
    if (this.blockedClients.has(clientName)) {
      this.showBlockedClientDialog(clientName, action);
      return false;
    }
    return true;
  }

  showBlockedClientDialog(clientName, action) {
    const overlay = document.createElement("div");
    overlay.className = "popup-overlay";

    const clientNameDiv = document.createElement("div");
    clientNameDiv.className = "client-name";
    clientNameDiv.textContent = clientName;

    const actionBlockedDiv = document.createElement("div");
    actionBlockedDiv.className = "action-blocked";
    actionBlockedDiv.textContent = `לא ניתן לבצע ${action} עבור לקוח זה`;

    overlay.innerHTML = `
      <div class="popup blocked-client-popup">
        <div class="popup-header" style="color: #ef4444;">
          <i class="fas fa-ban"></i>
          לקוח חסום
        </div>
        <div class="blocked-client-message">
          ${clientNameDiv.outerHTML}
          <div class="reason">נגמרה יתרת השעות</div>
          ${actionBlockedDiv.outerHTML}
        </div>
        <div class="solutions">
          <h4>פתרונות אפשריים:</h4>
          <ul>
            <li><i class="fas fa-phone"></i> צור קשר עם הלקוח לרכישת שעות נוספות</li>
            <li><i class="fas fa-dollar-sign"></i> עדכן את מערכת הביליטס</li>
            <li><i class="fas fa-user-tie"></i> פנה למנהל המשרד</li>
          </ul>
        </div>
        <div class="popup-buttons">
          <button class="popup-btn popup-btn-confirm" onclick="this.closest('.popup-overlay').remove()">
            <i class="fas fa-check"></i>
            הבנתי
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    setTimeout(() => {
      if (document.body.contains(overlay)) {
        overlay.remove();
      }
    }, 10000);
  }
}

export default ClientValidation;
