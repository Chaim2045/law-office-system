/* ========================================================================== */
/*                    ORGANIZED LAW OFFICE MANAGEMENT SYSTEM                 */
/*                          Version: 2025 - Clean & Structured               */
/* ========================================================================== */

/* === GLOBAL VARIABLES & CONSTANTS === */

const EMPLOYEES = {
  חיים: { password: "2025", name: "חיים" },
  גיא: { password: "2025", name: "גיא" },
  מרווה: { password: "2025", name: "מרווה" },
  אלומה: { password: "2025", name: "אלומה" },
  אורי: { password: "2025", name: "אורי" },
  ראיד: { password: "2025", name: "ראיד" },
  שחר: { password: "2025", name: "שחר" },
  מירי: { password: "2025", name: "מירי" },
  רועי: { password: "2025", name: "רועי" },
  עוזי: { password: "2025", name: "עוזי" },
};

const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxxpp8A3dLayMMZocATKGzlG9ARtl3xfAXY6P6Y8b2UoNBlTdpQlr_Tz5pzAE38vZU/exec";

// Global state variables
let currentActiveTab = "budget";
let isScrolled = false;

/* === CORE CLASSES === */

// הוסף לתחילת הקובץ script.js
class SmartLoadingManager {
  constructor() {
    this.activeOperations = new Map();
    this.createLoadingCSS(); // הוסף CSS אוטומטית
  }

  createLoadingCSS() {
    // הוסף CSS אוטומטית למסמך
    const style = document.createElement("style");
    style.textContent = `
            .smart-loading-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(15, 23, 42, 0.8);
                backdrop-filter: blur(8px);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .smart-loading-content {
                background: white;
                padding: 40px;
                border-radius: 20px;
                text-align: center;
                max-width: 400px;
                box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
            }

            .loading-spinner-modern {
                width: 60px;
                height: 60px;
                border: 4px solid #e2e8f0;
                border-top: 4px solid #3b82f6;
                border-radius: 50%;
                animation: spinModern 1s linear infinite;
                margin: 0 auto 20px;
            }

            .progress-bar-container {
                width: 100%;
                height: 8px;
                background: #e2e8f0;
                border-radius: 4px;
                margin: 20px 0;
                overflow: hidden;
            }

            .progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #3b82f6, #1d4ed8);
                border-radius: 4px;
                transition: width 0.5s ease;
                width: 0%;
            }

            @keyframes spinModern {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
    document.head.appendChild(style);
  }

  startOperation(operationId, estimatedTime = 5000) {
    const startTime = Date.now();
    this.activeOperations.set(operationId, { startTime, estimatedTime });

    this.showSmartLoading(operationId, estimatedTime);

    // עדכון אוטומטי כל שנייה
    const updateInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, estimatedTime - elapsed);

      if (remaining > 0) {
        this.updateLoadingProgress(operationId, elapsed, estimatedTime);
      } else {
        clearInterval(updateInterval);
      }
    }, 1000);

    return updateInterval;
  }

  showSmartLoading(operationId, estimatedTime) {
    const overlay = document.createElement("div");
    overlay.id = `loading-${operationId}`;
    overlay.className = "smart-loading-overlay";

    overlay.innerHTML = `
            <div class="smart-loading-content">
                <div class="loading-spinner-modern"></div>
                <h3 id="loading-title-${operationId}">מעבד פעולה...</h3>
                <p id="loading-subtitle-${operationId}">ממתין לגישה למערכת...</p>
                <div class="progress-bar-container">
                    <div class="progress-bar" id="progress-${operationId}"></div>
                </div>
                <span id="loading-time-${operationId}">זמן משוער: ${Math.ceil(
      estimatedTime / 1000
    )} שניות</span>
            </div>
        `;

    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";
  }

  updateLoadingProgress(operationId, elapsed, total) {
    const progress = Math.min((elapsed / total) * 100, 90); // מקסימום 90% עד סיום
    const remaining = Math.ceil((total - elapsed) / 1000);

    const progressBar = document.getElementById(`progress-${operationId}`);
    const timeEl = document.getElementById(`loading-time-${operationId}`);

    if (progressBar) progressBar.style.width = `${progress}%`;
    if (timeEl && remaining > 0)
      timeEl.textContent = `נותרו עוד ${remaining} שניות`;
  }

  finishOperation(operationId) {
    const overlay = document.getElementById(`loading-${operationId}`);
    if (overlay) {
      overlay.remove();
      document.body.style.overflow = "";
    }
    this.activeOperations.delete(operationId);
  }
}

// Loading Manager Class
class LoadingManager {
  constructor() {
    this.activeOperations = new Set();
    this.loadingOverlay = null;
    this.cssAdded = false;
    this.init();
  }

  init() {
    if (!this.cssAdded) {
      this.addRequiredCSS();
      this.cssAdded = true;
    }

    this.loadingOverlay = document.createElement("div");
    this.loadingOverlay.className = "global-loading-overlay hidden";
    this.loadingOverlay.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <div class="loading-text">מעבד...</div>
                <div class="loading-subtext">אנא המתן</div>
            </div>
        `;
    document.body.appendChild(this.loadingOverlay);
  }

  addRequiredCSS() {
    const style = document.createElement("style");
    style.textContent = `
            .global-loading-overlay {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.6); z-index: 9999;
                display: flex; align-items: center; justify-content: center;
                direction: rtl;
            }
            .global-loading-overlay.hidden { display: none !important; }
            .loading-content {
                background: white; padding: 30px; border-radius: 15px;
                text-align: center; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                min-width: 200px;
            }
            .loading-spinner {
                width: 40px; height: 40px; border: 4px solid #f3f3f3;
                border-top: 4px solid #1e40af; border-radius: 50%;
                animation: spin 1s linear infinite; margin: 0 auto 15px;
            }
            .loading-text { font-weight: bold; font-size: 16px; color: #1e40af; margin-bottom: 5px; }
            .loading-subtext { color: #666; font-size: 14px; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `;
    document.head.appendChild(style);
  }

  startOperation(operationId, message = "מעבד...", subtext = "אנא המתן") {
    if (this.activeOperations.has(operationId)) {
      console.warn(`⚠️ פעולה ${operationId} כבר פעילה - מונע כפילות`);
      return false;
    }

    this.activeOperations.add(operationId);
    this.showLoading(message, subtext);
    console.log(`🔄 התחיל: ${operationId}`);
    return true;
  }

  finishOperation(operationId, delay = 800) {
    setTimeout(() => {
      this.activeOperations.delete(operationId);
      if (this.activeOperations.size === 0) {
        this.hideLoading();
      }
      console.log(`✅ הסתיים: ${operationId}`);
    }, delay);
  }

  showLoading(message, subtext) {
    if (this.loadingOverlay) {
      this.loadingOverlay.querySelector(".loading-text").textContent = message;
      this.loadingOverlay.querySelector(".loading-subtext").textContent =
        subtext;
      this.loadingOverlay.classList.remove("hidden");
      document.body.style.overflow = "hidden";
    }
  }

  hideLoading() {
    if (this.loadingOverlay) {
      this.loadingOverlay.classList.add("hidden");
      document.body.style.overflow = "";
    }
  }

  isOperationActive(operationId) {
    return this.activeOperations.has(operationId);
  }
}

// Notification Bell System Class
class NotificationBellSystem {
  constructor() {
    this.notifications = [];
    this.isDropdownOpen = false;
    this.init();
  }

  init() {
    document.addEventListener("click", (e) => {
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
    });

    const dropdown = document.getElementById("notificationsDropdown");
    if (dropdown) {
      dropdown.addEventListener("click", (e) => {
        e.stopPropagation();
      });
    }
  }

  addNotification(type, title, description, urgent = false) {
    const notification = {
      id: Date.now() + Math.random(),
      type: type,
      title: title,
      description: description,
      time: new Date().toLocaleString("he-IL"),
      urgent: urgent,
    };

    this.notifications.unshift(notification);
    this.updateBell();
    this.renderNotifications();
    console.log("🔔 התראה חדשה נוספה:", notification);
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
    if (this.isDropdownOpen) {
      this.hideDropdown();
    } else {
      this.showDropdown();
    }
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

    container.innerHTML = this.notifications
      .map((notification) => {
        const iconMap = {
          blocked: "fas fa-ban",
          critical: "fas fa-exclamation-triangle",
          urgent: "fas fa-clock",
        };

        return `
                <div class="notification-item ${notification.type} ${
          notification.urgent ? "urgent" : ""
        }" id="notification-${notification.id}">
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
                            <div class="notification-title">${
                              notification.title
                            }</div>
                            <div class="notification-description">${
                              notification.description
                            }</div>
                            <div class="notification-time">${
                              notification.time
                            }</div>
                        </div>
                    </div>
                </div>
            `;
      })
      .join("");
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
      const overdueCount = urgentTasks.filter((task) => {
        const now = new Date();
        return new Date(task.deadline) <= now;
      }).length;

      if (overdueCount > 0) {
        this.addSystemNotification(
          "urgent",
          `${overdueCount} משימות באיחור`,
          "משימות שעבר תאריך היעד שלהן",
          true
        );
      }

      const upcomingCount = urgentTasks.length - overdueCount;
      if (upcomingCount > 0) {
        this.addSystemNotification(
          "urgent",
          `${upcomingCount} משימות דחופות`,
          "משימות שיעבור תאריך היעד בקרוב",
          false
        );
      }
    }
  }

  addSystemNotification(type, title, description, urgent) {
    const notification = {
      id: Date.now() + Math.random(),
      type: type,
      title: title,
      description: description,
      time: new Date().toLocaleString("he-IL"),
      urgent: urgent,
      isSystemGenerated: true,
    };

    this.notifications.unshift(notification);
    this.updateBell();
    this.renderNotifications();
  }
}

// Client Validation Class
class ClientValidation {
  constructor(manager) {
    this.manager = manager;
    this.blockedClients = new Set();
    this.criticalClients = new Set();
  }

  updateBlockedClients() {
    console.log("🔄 מעדכן רשימת לקוחות חסומים...");

    this.blockedClients.clear();
    this.criticalClients.clear();

    for (const client of this.manager.clients) {
      if (client.isBlocked) {
        this.blockedClients.add(client.fullName);
        console.log(`🚫 לקוח חסום: ${client.fullName}`);
      } else if (
        client.type === "hours" &&
        client.hoursRemaining <= 5 &&
        client.hoursRemaining > 0
      ) {
        this.criticalClients.add(client.fullName);
        console.log(
          `⚠️ לקוח קריטי: ${client.fullName} - ${client.hoursRemaining} שעות`
        );
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

      select.innerHTML = '<option value="">בחר לקוח...</option>';

      this.manager.clients.forEach((client) => {
        const option = document.createElement("option");
        option.value = client.fullName;

        if (this.blockedClients.has(client.fullName)) {
          option.textContent = `🚫 ${client.fullName} - נגמרו השעות`;
          option.disabled = true;
          option.className = "blocked-client";
        } else {
          let displayText = client.fullName;

          if (client.type === "hours") {
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

        select.appendChild(option);
      });
    });
  }

  updateNotificationBell() {
    const now = new Date();
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const urgentTasks = this.manager.budgetTasks.filter((task) => {
      return (
        task &&
        task.status !== "הושלם" &&
        task.deadline &&
        task.description &&
        new Date(task.deadline) <= oneDayFromNow
      );
    });

    notificationBell.updateFromSystem(
      this.blockedClients,
      this.criticalClients,
      urgentTasks
    );
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

    overlay.innerHTML = `
            <div class="popup blocked-client-popup">
                <div class="popup-header" style="color: #ef4444;">
                    <i class="fas fa-ban"></i>
                    לקוח חסום
                </div>
                
                <div class="blocked-client-message">
                    <div class="client-name">${clientName}</div>
                    <div class="reason">נגמרה יתרת השעות</div>
                    <div class="action-blocked">לא ניתן לבצע ${action} עבור לקוח זה</div>
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
/* === PAGINATION SYSTEM === */
class TablePagination {
  constructor(pageSize = 20) {
    this.pageSize = pageSize;
    this.currentPage = 1;
  }

  getPage(data, page = this.currentPage) {
    if (!data || !Array.isArray(data)) {
      return {
        data: [],
        currentPage: 1,
        totalPages: 0,
        totalItems: 0,
        hasNext: false,
        hasPrev: false,
      };
    }

    const startIndex = (page - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;

    return {
      data: data.slice(startIndex, endIndex),
      currentPage: page,
      totalPages: Math.ceil(data.length / this.pageSize),
      totalItems: data.length,
      hasNext: endIndex < data.length,
      hasPrev: page > 1,
    };
  }

  renderControls(containerId, paginationData, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container || paginationData.totalPages <= 1) {
      if (container) container.innerHTML = "";
      return;
    }

    let controlsHTML = `
      <div class="table-pagination">
        <button class="pagination-btn ${
          !paginationData.hasPrev ? "disabled" : ""
        }" 
                onclick="${onPageChange}(${paginationData.currentPage - 1})" 
                ${!paginationData.hasPrev ? "disabled" : ""}>
          <i class="fas fa-chevron-right"></i> הקודם
        </button>
    `;

    // מספרי עמודים (מקסימום 5)
    const maxButtons = 5;
    let startPage = Math.max(
      1,
      paginationData.currentPage - Math.floor(maxButtons / 2)
    );
    let endPage = Math.min(
      paginationData.totalPages,
      startPage + maxButtons - 1
    );

    if (endPage - startPage + 1 < maxButtons) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      controlsHTML += `
        <button class="pagination-btn page-number ${
          i === paginationData.currentPage ? "active" : ""
        }" 
                onclick="${onPageChange}(${i})">
          ${i}
        </button>
      `;
    }

    controlsHTML += `
        <button class="pagination-btn ${
          !paginationData.hasNext ? "disabled" : ""
        }" 
                onclick="${onPageChange}(${paginationData.currentPage + 1})" 
                ${!paginationData.hasNext ? "disabled" : ""}>
          הבא <i class="fas fa-chevron-left"></i>
        </button>
        
        <div class="pagination-info">
          עמוד ${paginationData.currentPage} מתוך ${paginationData.totalPages} 
          (${paginationData.totalItems} רשומות)
        </div>
      </div>
    `;

    container.innerHTML = controlsHTML;
  }
}

// Data Cache Class
class DataCache {
  constructor() {
    this.cache = new Map();
    this.lastUpdate = new Map();
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  }

  set(key, data) {
    this.cache.set(key, data);
    this.lastUpdate.set(key, Date.now());
    console.log(
      `💾 Cache: שמור ${key} עם ${
        Array.isArray(data) ? data.length : "נתונים"
      } רשומות`
    );
  }

  get(key) {
    const data = this.cache.get(key);
    const lastUpdate = this.lastUpdate.get(key);

    if (!data || !lastUpdate) {
      console.log(`🔍 Cache: ${key} לא נמצא`);
      return null;
    }

    if (Date.now() - lastUpdate > this.CACHE_TTL) {
      console.log(`⏰ Cache: ${key} פג תוקף`);
      this.invalidate(key);
      return null;
    }

    console.log(`✅ Cache: ${key} נמצא ותקף`);
    return data;
  }

  invalidate(key) {
    this.cache.delete(key);
    this.lastUpdate.delete(key);
    console.log(`🗑️ Cache: ${key} נמחק`);
  }

  invalidateAll() {
    this.cache.clear();
    this.lastUpdate.clear();
    console.log(`🗑️ Cache: נוקה כולו`);
  }

  updateItem(key, itemId, updatedItem) {
    const data = this.get(key);
    if (data && Array.isArray(data)) {
      const index = data.findIndex((item) => item.id === itemId);
      if (index !== -1) {
        data[index] = { ...data[index], ...updatedItem };
        this.set(key, data);
        console.log(`🔄 Cache: עודכן פריט ${itemId} ב-${key}`);
        return true;
      }
    }
    return false;
  }

  addItem(key, newItem) {
    const data = this.get(key);
    if (data && Array.isArray(data)) {
      data.push(newItem);
      this.set(key, data);
      console.log(`➕ Cache: נוסף פריט ל-${key}`);
      return true;
    }
    return false;
  }
}

// Data Manager Class
class DataManager {
  constructor() {
    this.SCRIPT_URL = SCRIPT_URL;
    this.cache = dataCache;
    this.connectionStatus = "unknown";
    this.localBackup = [];
  }

  async loadData(dataType, forceRefresh = false) {
    const cacheKey = dataType;

    try {
      if (!forceRefresh) {
        const cachedData = this.cache.get(cacheKey);
        if (cachedData) {
          console.log(`✅ ${dataType} נטען מה-Cache`);
          return { success: true, data: cachedData, fromCache: true };
        }
      }

      console.log(`🔄 טוען ${dataType} מהשרת...`);

      const response = await fetch(
        `${this.SCRIPT_URL}?action=get${this.capitalizeFirst(
          dataType
        )}&employee=${this.getCurrentUser()}`,
        {
          method: "GET",
          mode: "no-cors",
        }
      );

      const data = await this.parseResponse(response, dataType);
      this.cache.set(cacheKey, data);

      console.log(
        `✅ נטענו ${data.length} רשומות ${dataType} מהשרת ונשמרו ב-Cache`
      );
      return { success: true, data: data, fromCache: false };
    } catch (error) {
      console.error(`❌ שגיאה בטעינת ${dataType}:`, error);

      const cachedData = this.cache.get(cacheKey);
      if (cachedData) {
        console.log(`⚠️ נטען ${dataType} מ-Cache בגלל שגיאה`);
        return {
          success: true,
          data: cachedData,
          fromCache: true,
          offline: true,
        };
      }

      return { success: false, error: error.message };
    }
  }

  async saveData(action, data, maxRetries = 3) {
    const operationId = `save_${action}_${Date.now()}`;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 ניסיון ${attempt}/${maxRetries} - שולח: ${action}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 25000);

        const response = await fetch(this.SCRIPT_URL, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...data }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok && response.status !== 0) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        console.log("✅ נתונים נשמרו בגליון Google Sheets בהצלחה");
        this.connectionStatus = "connected";
        this.invalidateRelevantCache(action);

        return { success: true };
      } catch (error) {
        lastError = error;
        console.error(`❌ ניסיון ${attempt} נכשל:`, error.message);

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    console.warn(`⚠️ שמירה נכשלה - מוסיף לגיבוי מקומי: ${action}`);
    this.addToLocalBackup(action, data);

    return { success: false, error: lastError?.message || "שגיאה לא ידועה" };
  }

  invalidateRelevantCache(action) {
    console.log(`🔄 מבטל Cache רלוונטי לפעולה: ${action}`);

    switch (action) {
      case "createClientComplete":
      case "updateClient":
      case "deleteClient":
        this.cache.invalidate("clients");
        break;

      case "saveBudgetTaskToSheet":
      case "addTimeToTask":
      case "updateBudgetTask":
      case "completeBudgetTask":
      case "extendTaskDeadline":
        this.cache.invalidate("budgetTasks");
        break;

      case "saveTimesheetAndUpdateClient":
      case "updateTimesheet":
      case "deleteTimesheetEntry":
        this.cache.invalidate("timesheetEntries");
        this.cache.invalidate("clients");
        break;

      default:
        this.cache.invalidateAll();
        break;
    }
  }

  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  getCurrentUser() {
    if (window.manager && window.manager.currentUser) {
      return window.manager.currentUser;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const employee = urlParams.get("emp");

    if (employee) {
      return employee;
    }

    return "testUser";
  }

  async parseResponse(response, dataType) {
    return [];
  }

  addToLocalBackup(action, data) {
    this.localBackup.push({
      action,
      data,
      timestamp: Date.now(),
      attempts: 0,
      priority: this.getActionPriority(action),
    });
  }

  getActionPriority(action) {
    const highPriority = [
      "createClientComplete",
      "saveTimesheetAndUpdateClient",
    ];
    const mediumPriority = ["saveBudgetTaskToSheet", "updateClient"];

    if (highPriority.includes(action)) return "high";
    if (mediumPriority.includes(action)) return "medium";
    return "low";
  }
}

// Main Law Office Manager Class
class LawOfficeManager {
  constructor() {
    this.dataManager = dataManager;
    this.currentUser = null;
    this.clients = [];
    this.budgetTasks = [];
    this.timesheetEntries = [];
    this.connectionStatus = "unknown";
    this.currentTaskFilter = "active";
    this.currentTimesheetFilter = "month";
    this.currentBudgetView = "cards";
    this.currentTimesheetView = "table";
    this.filteredBudgetTasks = [];
    this.filteredTimesheetEntries = [];
    this.budgetSortField = null;
    this.budgetSortDirection = "asc";
    this.timesheetSortField = null;
    this.timesheetSortDirection = "asc";
    this.budgetPagination = new TablePagination(20);
    this.timesheetPagination = new TablePagination(20);
    this.currentBudgetPage = 1;
    this.currentTimesheetPage = 1;

    this.clientValidation = new ClientValidation(this);
    this.init();
  }

  init() {
    const urlParams = new URLSearchParams(window.location.search);
    const employee = urlParams.get("emp");

    console.log("🌐 URL:", window.location.href);
    console.log("🔍 Search params:", window.location.search);
    console.log("👤 Employee param:", employee);
    console.log("✅ Employee exists:", employee && EMPLOYEES[employee]);

    if (employee && EMPLOYEES[employee]) {
      this.targetEmployee = employee;
      this.showLogin();
    } else {
      this.showError("גישה לא מורשית - אנא השתמש בקישור הנכון");
      return;
    }

    this.setupEventListeners();
  }

  setupEventListeners() {
    console.log("🔧 מגדיר event listeners");

    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleLogin();
      });
    }

    const budgetForm = document.getElementById("budgetForm");
    if (budgetForm) {
      budgetForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.addBudgetTask();
      });
    }

    const timesheetForm = document.getElementById("timesheetForm");
    if (timesheetForm) {
      timesheetForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.addTimesheetEntry();
      });
    }

    const clientForm = document.getElementById("clientForm");
    if (clientForm) {
      clientForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.createClient();
      });
    }

    document.querySelectorAll('input[name="clientType"]').forEach((radio) => {
      radio.addEventListener("change", () => this.updateClientTypeDisplay());
    });

    const timesheetClientSelect = document.getElementById(
      "timesheetClientSelect"
    );
    if (timesheetClientSelect) {
      timesheetClientSelect.addEventListener("change", (e) => {
        const selectedClient = this.clients.find(
          (c) => c.fullName === e.target.value
        );
        const fileNumberField = document.getElementById("fileNumber");

        if (selectedClient && fileNumberField) {
          fileNumberField.value = selectedClient.fileNumber;
        } else if (fileNumberField) {
          fileNumberField.value = "";
        }
      });
    }

    const actionDate = document.getElementById("actionDate");
    if (actionDate) {
      const today = new Date().toISOString().split("T")[0];
      actionDate.value = today;
    }

    this.setupTableSorting();
  }

  setupTableSorting() {
    document.addEventListener("click", (e) => {
      if (e.target.closest("#budgetTable th.sortable")) {
        const th = e.target.closest("th");
        const sortField = th.dataset.sort;
        this.sortBudgetTable(sortField);
      }
    });

    document.addEventListener("click", (e) => {
      if (e.target.closest("#timesheetTable th.sortable")) {
        const th = e.target.closest("th");
        const sortField = th.dataset.sort;
        this.sortTimesheetTable(sortField);
      }
    });
  }

  showLogin() {
    const loginSection = document.getElementById("loginSection");
    const appContent = document.getElementById("appContent");

    if (loginSection) loginSection.classList.remove("hidden");
    if (appContent) appContent.classList.add("hidden");
  }

  handleLogin() {
    const password = document.getElementById("password").value;
    const employee = EMPLOYEES[this.targetEmployee];

    if (password === employee.password) {
      this.currentUser = employee.name;
      updateUserDisplay(this.currentUser);
      this.showApp();
      this.loadData();
    } else {
      const errorMessage = document.getElementById("errorMessage");
      if (errorMessage) {
        errorMessage.classList.remove("hidden");
        setTimeout(() => {
          errorMessage.classList.add("hidden");
        }, 3000);
      }
    }
  }

  showApp() {
    const loginSection = document.getElementById("loginSection");
    const appContent = document.getElementById("appContent");
    const interfaceElements = document.getElementById("interfaceElements");

    if (loginSection) loginSection.classList.add("hidden");
    if (appContent) appContent.classList.remove("hidden");
    if (interfaceElements) interfaceElements.classList.remove("hidden");

    const userInfo = document.getElementById("userInfo");
    if (userInfo) {
      userInfo.innerHTML = `
                <span>שלום ${this.currentUser}</span>
                <span id="connectionIndicator" style="margin-right: 15px; font-size: 14px;">🔄 מתחבר...</span>
            `;
      userInfo.classList.remove("hidden");
    }

    this.logUserLogin();

    setTimeout(() => {
      updateSidebarUser(this.currentUser);
      console.log("👤 משתמש עודכן בסרגל:", this.currentUser);
    }, 500);
  }

  async logUserLogin() {
    try {
      console.log("🔑 רושם כניסה למערכת...");

      const userAgent = navigator.userAgent || "לא זמין";
      const timestamp = new Date().toISOString();

      const loginData = {
        action: "userLogin",
        employee: this.currentUser,
        userAgent: userAgent,
        timestamp: timestamp,
        ipAddress: "לא זמין",
      };

      this.sendToGoogleSheets(loginData).catch((error) => {
        console.warn("⚠️ לא הצלחנו לרשום כניסה:", error);
      });

      console.log("✅ כניסה נרשמה בהצלחה");
    } catch (error) {
      console.error("⚠️ שגיאה ברישום כניסה:", error);
    }
  }

  async loadData() {
    try {
      await this.loadDataFromSheets();

      // 🎯 עדכון אוטומטי של התצוגה לאחר טעינת נתונים
      setTimeout(() => {
        this.applyBudgetTaskFilters();
        this.applyTimesheetFilters();
        this.renderBudgetTasks();
        this.renderTimesheetEntries();
        console.log("✅ נתונים נטענו והתצוגה עודכנה אוטומטית");
      }, 500);
    } catch (error) {
      console.error("❌ נכשלה טעינה מהגליון:", error);
      this.connectionStatus = "offline";
      this.updateConnectionStatus("🔴 שגיאה בחיבור");
    }
  }

  updateConnectionStatus(status) {
    const indicator = document.getElementById("connectionIndicator");
    if (indicator) {
      indicator.textContent = status;
    }
  }

  showActiveTabContent() {
    try {
      const activeTab = document.querySelector(".tab-button.active");

      // 🎯 עדכון אוטומטי של התצוגה הפעילה
      if (
        !activeTab ||
        activeTab.textContent.includes("תקצוב") ||
        activeTab.textContent.includes("משימות")
      ) {
        console.log("🎯 מציג טאב תקצוב");
        this.applyBudgetTaskFilters();
        this.renderBudgetTasks();
      } else if (
        activeTab.textContent.includes("שעתון") ||
        activeTab.textContent.includes("זמן")
      ) {
        console.log("🎯 מציג טאב שעתון");
        this.applyTimesheetFilters();
        this.renderTimesheetEntries();
      } else {
        console.log("🎯 טאב לא מזוהה - מציג תקצוב");
        this.applyBudgetTaskFilters();
        this.renderBudgetTasks();
      }
    } catch (error) {
      console.error("❌ שגיאה ב-showActiveTabContent:", error);
      this.applyBudgetTaskFilters();
      this.renderBudgetTasks();
    }
  }

  async loadDataFromSheets() {
    try {
      console.log("🔄 טוען נתונים מהגליון בפונקציות המקוריות...");
      this.showNotification("טוען נתונים מהשרת...", "info");

      await this.loadClientsFromSheetOriginal();
      await this.loadBudgetTasksFromSheetOriginal();
      await this.loadTimesheetEntriesFromSheetOriginal();

      this.connectionStatus = "connected";
      this.updateConnectionStatus?.("🟢 מחובר");

      this.showNotification("✅ נתונים נטענו בהצלחה!", "success");
      console.log("✅ טעינה הושלמה בפונקציות המקוריות");
    } catch (error) {
      console.error("❌ נכשלה טעינה:", error);
      this.connectionStatus = "offline";
      this.updateConnectionStatus?.("🔴 שגיאה בחיבור");
      this.showNotification("שגיאה בטעינת נתונים", "error");
    }
  }

  async loadClientsFromSheetOriginal(forceRefresh = false) {
    const cacheKey = "clients";

    if (!forceRefresh) {
      const cachedData = dataCache.get(cacheKey);
      if (cachedData) {
        this.clients = cachedData;
        this.updateClientsList();
        console.log("✅ לקוחות נטענו מה-Cache");
        return;
      }
    }

    try {
      console.log("📥 טוען לקוחות מהגליון (פונקציה מקורית)...");

      const url = `${SCRIPT_URL}?action=getClients`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.clients) {
        dataCache.set(cacheKey, result.clients);

        this.clients = result.clients;
        this.updateClientsList();
        console.log(
          `✅ נטענו ${this.clients.length} לקוחות מהגליון ונשמרו ב-Cache`
        );
      } else {
        throw new Error(result.message || "שגיאה בטעינת לקוחות");
      }
    } catch (error) {
      console.error("❌ שגיאה בטעינת לקוחות:", error);

      const cachedData = dataCache.get(cacheKey);
      if (cachedData) {
        this.clients = cachedData;
        this.updateClientsList();
        this.showNotification(
          "נטענו לקוחות מהמטמון (במצב לא מקוון)",
          "warning"
        );
      } else {
        throw error;
      }
    }
  }

  async loadBudgetTasksFromSheetOriginal(forceRefresh = false) {
    const cacheKey = "budgetTasks";

    if (!forceRefresh) {
      const cachedData = dataCache.get(cacheKey);
      if (cachedData) {
        this.budgetTasks = cachedData;
        this.applyBudgetTaskFilters();
        console.log("✅ משימות נטענו מה-Cache");
        return;
      }
    }

    try {
      console.log("📥 טוען משימות תקצוב מהגליון (פונקציה מקורית)...");

      const url = `${SCRIPT_URL}?action=getFilteredBudgetTasks&employee=${encodeURIComponent(
        this.currentUser
      )}&filter=${this.currentTaskFilter}`;
      const response = await fetch(url);
      const result = await response.json();

      if (result.success && result.tasks) {
        dataCache.set(cacheKey, result.tasks);

        this.budgetTasks = result.tasks;
        this.applyBudgetTaskFilters();
        console.log(
          `✅ נטענו ${this.budgetTasks.length} משימות תקצוב מהגליון ונשמרו ב-Cache`
        );
      } else {
        throw new Error(result.message || "שגיאה בטעינת משימות");
      }
    } catch (error) {
      console.error("❌ שגיאה בטעינת משימות:", error);

      const cachedData = dataCache.get(cacheKey);
      if (cachedData) {
        this.budgetTasks = cachedData;
        this.applyBudgetTaskFilters();
        this.showNotification(
          "נטענו משימות מהמטמון (במצב לא מקוון)",
          "warning"
        );
      } else {
        throw error;
      }
    }
  }

  async loadTimesheetEntriesFromSheetOriginal(forceRefresh = false) {
    const cacheKey = "timesheetEntries";

    if (!forceRefresh) {
      const cachedData = dataCache.get(cacheKey);
      if (cachedData) {
        this.timesheetEntries = cachedData;
        this.applyTimesheetFilters();
        console.log("✅ שעתון נטען מה-Cache");
        return;
      }
    }

    try {
      console.log("📥 טוען רשומות שעתון מהגליון (פונקציה מקורית)...");

      const url = `${SCRIPT_URL}?action=getFilteredTimesheetEntries&employee=${encodeURIComponent(
        this.currentUser
      )}&filter=${this.currentTimesheetFilter}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.entries) {
        dataCache.set(cacheKey, result.entries);

        this.timesheetEntries = result.entries;
        this.applyTimesheetFilters();
        console.log(
          `✅ נטענו ${this.timesheetEntries.length} רשומות שעתון מהגליון ונשמרו ב-Cache`
        );
      } else {
        throw new Error(result.message || "שגיאה בטעינת שעתון");
      }
    } catch (error) {
      console.error("❌ שגיאה בטעינת שעתון:", error);

      const cachedData = dataCache.get(cacheKey);
      if (cachedData) {
        this.timesheetEntries = cachedData;
        this.applyTimesheetFilters();
        this.showNotification("נטען שעתון מהמטמון (במצב לא מקוון)", "warning");
      } else {
        throw error;
      }
    }
  }

  updateClientSelects() {
    const budgetSelect = document.getElementById("budgetClientSelect");
    const timesheetSelect = document.getElementById("timesheetClientSelect");

    if (budgetSelect) {
      budgetSelect.innerHTML = '<option value="">בחר לקוח...</option>';
    }
    if (timesheetSelect) {
      timesheetSelect.innerHTML = '<option value="">בחר לקוח...</option>';
    }

    this.clients.forEach((client) => {
      let displayText = client.fullName;

      if (client.type === "hours" && client.hoursRemaining !== undefined) {
        const hoursText =
          client.hoursRemaining <= 5
            ? `🚨 ${client.hoursRemaining.toFixed(1)} שע' נותרות`
            : `${client.hoursRemaining.toFixed(1)} שע' נותרות`;
        displayText += ` (${hoursText})`;
      } else if (client.type === "fixed") {
        displayText += " (פיקס)";
      }

      if (budgetSelect) {
        const budgetOption = document.createElement("option");
        budgetOption.value = client.fullName;
        budgetOption.textContent = displayText;
        budgetSelect.appendChild(budgetOption);
      }

      if (timesheetSelect) {
        const timesheetOption = document.createElement("option");
        timesheetOption.value = client.fullName;
        timesheetOption.textContent = displayText;
        timesheetSelect.appendChild(timesheetOption);
      }
    });
  }

  updateClientTypeDisplay() {
    const hoursSelected = document.getElementById("typeHours")?.checked;
    const hoursSection = document.getElementById("hoursSection");
    const stagesSection = document.getElementById("stagesSection");
    const hoursAmount = document.getElementById("hoursAmount");

    if (hoursSelected) {
      if (hoursSection) hoursSection.classList.remove("hidden");
      if (stagesSection) stagesSection.classList.add("hidden");
      if (hoursAmount) hoursAmount.required = true;
    } else {
      if (hoursSection) hoursSection.classList.add("hidden");
      if (stagesSection) stagesSection.classList.remove("hidden");
      if (hoursAmount) hoursAmount.required = false;
    }
  }

  switchBudgetView(view) {
    this.currentBudgetView = view;

    // עדכון הטאבים הויזואליים
    document.querySelectorAll("#budgetTab .view-tab").forEach((tab) => {
      tab.classList.remove("active");
    });
    const activeTab = document.querySelector(
      `#budgetTab .view-tab[data-view="${view}"]`
    );
    if (activeTab) activeTab.classList.add("active");

    // החלפת הקונטיינרים
    if (view === "cards") {
      const budgetContainer = document.getElementById("budgetContainer");
      const budgetTableContainer = document.getElementById(
        "budgetTableContainer"
      );
      if (budgetContainer) budgetContainer.classList.remove("hidden");
      if (budgetTableContainer) budgetTableContainer.classList.add("hidden");
    } else {
      const budgetContainer = document.getElementById("budgetContainer");
      const budgetTableContainer = document.getElementById(
        "budgetTableContainer"
      );
      if (budgetContainer) budgetContainer.classList.add("hidden");
      if (budgetTableContainer) budgetTableContainer.classList.remove("hidden");
    }

    // 🎯 בדיקה והבטחה שיש נתונים לרינדור
    if (!this.budgetTasks || this.budgetTasks.length === 0) {
      console.log("🔄 טוען נתוני משימות לפני רינדור...");
      this.loadBudgetTasksFromSheetOriginal()
        .then(() => {
          this.applyBudgetTaskFilters();
          this.renderBudgetTasks();
          console.log("✅ נתונים נטענו ורונדרו בהצלחה");
        })
        .catch((error) => {
          console.error("❌ שגיאה בטעינת נתונים:", error);
          this.showNotification("שגיאה בטעינת נתונים", "error");
        });
    } else {
      // יש נתונים - צריך לוודא שהם ב-filtered array
      if (!this.filteredBudgetTasks || this.filteredBudgetTasks.length === 0) {
        this.applyBudgetTaskFilters();
      }
      this.renderBudgetTasks();
      console.log("✅ רינדור מיידי עם נתונים קיימים");
    }
  }

  switchTimesheetView(view) {
    this.currentTimesheetView = view;

    // עדכון הטאבים הויזואליים
    document.querySelectorAll("#timesheetTab .view-tab").forEach((tab) => {
      tab.classList.remove("active");
    });
    const activeTab = document.querySelector(
      `#timesheetTab .view-tab[data-view="${view}"]`
    );
    if (activeTab) activeTab.classList.add("active");

    // החלפת הקונטיינרים
    if (view === "cards") {
      const timesheetContainer = document.getElementById("timesheetContainer");
      const timesheetTableContainer = document.getElementById(
        "timesheetTableContainer"
      );
      if (timesheetContainer) timesheetContainer.classList.remove("hidden");
      if (timesheetTableContainer)
        timesheetTableContainer.classList.add("hidden");
    } else {
      const timesheetContainer = document.getElementById("timesheetContainer");
      const timesheetTableContainer = document.getElementById(
        "timesheetTableContainer"
      );
      if (timesheetContainer) timesheetContainer.classList.add("hidden");
      if (timesheetTableContainer)
        timesheetTableContainer.classList.remove("hidden");
    }

    // 🎯 בדיקה והבטחה שיש נתונים לרינדור
    if (!this.timesheetEntries || this.timesheetEntries.length === 0) {
      console.log("🔄 טוען נתוני שעתון לפני רינדור...");
      this.loadTimesheetEntriesFromSheetOriginal()
        .then(() => {
          this.applyTimesheetFilters();
          this.renderTimesheetEntries();
          console.log("✅ נתוני שעתון נטענו ורונדרו בהצלחה");
        })
        .catch((error) => {
          console.error("❌ שגיאה בטעינת נתוני שעתון:", error);
          this.showNotification("שגיאה בטעינת נתונים", "error");
        });
    } else {
      // יש נתונים - צריך לוודא שהם ב-filtered array
      if (
        !this.filteredTimesheetEntries ||
        this.filteredTimesheetEntries.length === 0
      ) {
        this.applyTimesheetFilters();
      }
      this.renderTimesheetEntries();
      console.log("✅ רינדור מיידי עם נתוני שעתון קיימים");
    }
  }

  searchBudgetTasks() {
    const searchBox = document.getElementById("budgetSearchBox");
    if (!searchBox) return;

    const searchTerm = searchBox.value.toLowerCase();

    if (!searchTerm) {
      this.filteredBudgetTasks = [...this.budgetTasks];
    } else {
      this.filteredBudgetTasks = this.budgetTasks.filter((task) => {
        return (
          task.clientName.toLowerCase().includes(searchTerm) ||
          task.description.toLowerCase().includes(searchTerm) ||
          (task.branch && task.branch.toLowerCase().includes(searchTerm)) ||
          (task.fileNumber &&
            task.fileNumber.toLowerCase().includes(searchTerm))
        );
      });
    }

    this.renderBudgetTasks();
  }

  searchTimesheetEntries() {
    const searchBox = document.getElementById("timesheetSearchBox");
    if (!searchBox) return;

    const searchTerm = searchBox.value.toLowerCase();

    if (!searchTerm) {
      this.filteredTimesheetEntries = [...this.timesheetEntries];
    } else {
      this.filteredTimesheetEntries = this.timesheetEntries.filter((entry) => {
        return (
          entry.clientName.toLowerCase().includes(searchTerm) ||
          entry.action.toLowerCase().includes(searchTerm) ||
          (entry.fileNumber &&
            entry.fileNumber.toLowerCase().includes(searchTerm)) ||
          (entry.notes && entry.notes.toLowerCase().includes(searchTerm))
        );
      });
    }

    this.renderTimesheetEntries();
  }

  sortBudgetTable(field) {
    if (this.budgetSortField === field) {
      this.budgetSortDirection =
        this.budgetSortDirection === "asc" ? "desc" : "asc";
    } else {
      this.budgetSortField = field;
      this.budgetSortDirection = "asc";
    }

    document.querySelectorAll("#budgetTable th").forEach((th) => {
      th.classList.remove("sort-asc", "sort-desc");
    });

    const currentTh = document.querySelector(
      `#budgetTable th[data-sort="${field}"]`
    );
    if (currentTh) {
      currentTh.classList.add(`sort-${this.budgetSortDirection}`);
    }

    this.filteredBudgetTasks.sort((a, b) => {
      let valueA = a[field];
      let valueB = b[field];

      if (field === "deadline") {
        valueA = new Date(valueA);
        valueB = new Date(valueB);
      } else if (field === "progress") {
        valueA =
          a.estimatedMinutes > 0
            ? (a.actualMinutes / a.estimatedMinutes) * 100
            : 0;
        valueB =
          b.estimatedMinutes > 0
            ? (b.actualMinutes / b.estimatedMinutes) * 100
            : 0;
      }

      if (valueA < valueB) return this.budgetSortDirection === "asc" ? -1 : 1;
      if (valueA > valueB) return this.budgetSortDirection === "asc" ? 1 : -1;
      return 0;
    });

    this.renderBudgetTasks();
  }

  sortTimesheetTable(field) {
    if (this.timesheetSortField === field) {
      this.timesheetSortDirection =
        this.timesheetSortDirection === "asc" ? "desc" : "asc";
    } else {
      this.timesheetSortField = field;
      this.timesheetSortDirection = "asc";
    }

    document.querySelectorAll("#timesheetTable th").forEach((th) => {
      th.classList.remove("sort-asc", "sort-desc");
    });

    const currentTh = document.querySelector(
      `#timesheetTable th[data-sort="${field}"]`
    );
    if (currentTh) {
      currentTh.classList.add(`sort-${this.timesheetSortDirection}`);
    }

    this.filteredTimesheetEntries.sort((a, b) => {
      let valueA = a[field];
      let valueB = b[field];

      if (field === "date") {
        valueA = new Date(valueA);
        valueB = new Date(valueB);
      } else if (field === "minutes") {
        valueA = Number(valueA) || 0;
        valueB = Number(valueB) || 0;
      }

      if (valueA < valueB)
        return this.timesheetSortDirection === "asc" ? -1 : 1;
      if (valueA > valueB)
        return this.timesheetSortDirection === "asc" ? 1 : -1;
      return 0;
    });

    this.renderTimesheetEntries();
  }

  async createClient() {
    const clientNameField = document.getElementById("clientName");
    const fileNumberField = document.getElementById("fileNumberInput");
    const descriptionField = document.getElementById("clientDescription");
    const clientTypeField = document.querySelector(
      'input[name="clientType"]:checked'
    );
    const hoursAmountField = document.getElementById("hoursAmount");

    if (!clientNameField || !fileNumberField) {
      this.showNotification("אנא מלא את כל השדות הנדרשים", "error");
      return;
    }

    const clientName = clientNameField.value.trim();
    const fileNumber = fileNumberField.value.trim();
    const description = descriptionField ? descriptionField.value.trim() : "";
    const clientType = clientTypeField ? clientTypeField.value : "hours";
    const hoursAmount = hoursAmountField ? hoursAmountField.value : "";

    if (!clientName || !fileNumber) {
      this.showNotification("אנא מלא את כל השדות הנדרשים", "error");
      return;
    }

    this.showNotification("בודק אם הלקוח קיים...", "info");
    try {
      await this.loadClientsFromSheetOriginal();
    } catch (error) {
      console.error("⚠️ לא הצלחנו לרענן רשימת לקוחות:", error);
    }

    if (this.clients.some((c) => c.fileNumber === fileNumber)) {
      this.showNotification(
        `❌ מספר תיק ${fileNumber} כבר קיים במערכת!`,
        "error"
      );

      const existingClient = this.clients.find(
        (c) => c.fileNumber === fileNumber
      );
      setTimeout(() => {
        this.showNotification(
          `הלקוח הקיים: ${existingClient.fullName}`,
          "warning"
        );
      }, 2000);
      return;
    }

    const fullName = description
      ? `${clientName} - ${description}`
      : clientName;

    if (
      this.clients.some(
        (c) => c.fullName.toLowerCase() === fullName.toLowerCase()
      )
    ) {
      this.showNotification(`❌ לקוח "${fullName}" כבר קיים במערכת!`, "error");
      return;
    }

    if (clientType === "hours") {
      if (!hoursAmount || hoursAmount < 1) {
        this.showNotification("אנא הזן כמות שעות תקינה", "error");
        return;
      }
    }

    const client = {
      id: Date.now(),
      clientName,
      fileNumber,
      description,
      fullName,
      type: clientType,
      createdAt: new Date(),
      createdBy: this.currentUser,
    };

    if (clientType === "hours") {
      client.totalHours = parseInt(hoursAmount);
      client.hoursRemaining = parseInt(hoursAmount);
      client.minutesRemaining = parseInt(hoursAmount) * 60;
    } else {
      client.stages = [
        { id: 1, name: "שלב 1", completed: false },
        { id: 2, name: "שלב 2", completed: false },
        { id: 3, name: "שלב 3", completed: false },
      ];
    }

    hideClientForm();

    const typeText =
      clientType === "hours" ? `${hoursAmount} שעות` : "פיקס (3 שלבים)";
    this.showNotification(
      `תיק "${fullName}" (${fileNumber}) נוצר בהצלחה! (${typeText})`,
      "success"
    );

    this.createClientComplete(client);
  }

  async addBudgetTask() {
    // וולידציות
    const validationResult = this.validateBudgetTaskForm();
    if (!validationResult.isValid) {
      this.showValidationErrors(validationResult.errors);
      return;
    }

    const clientName = document.getElementById("budgetClientSelect").value;
    const selectedClient = this.clients.find((c) => c.fullName === clientName);

    if (!selectedClient) {
      this.showNotification("אנא בחר לקוח תקין", "error");
      return;
    }

    const description = document
      .getElementById("budgetDescription")
      .value.trim();
    const branch = document.getElementById("budgetBranch").value;
    const estimatedTimeValue = document.getElementById("estimatedTime").value;
    const deadline = document.getElementById("budgetDeadline").value;

    const budgetTask = {
      id: Date.now(),
      clientName: selectedClient.fullName,
      fileNumber: selectedClient.fileNumber,
      branch,
      taskDescription: description, // ← שינוי כאן!
      estimatedMinutes: parseInt(estimatedTimeValue),
      actualMinutes: 0,
      deadline: deadline,
      status: "פעיל",
      createdAt: new Date().toLocaleString("he-IL"),
      history: [],
    };

    try {
      // הוסף למערכת מיידית (אופטימיסטי)
      this.budgetTasks.unshift(budgetTask);
      this.filteredBudgetTasks = [...this.budgetTasks];
      this.renderBudgetTasks();

      // שמור לשרת
      await this.saveBudgetTaskToSheet(budgetTask);

      this.showNotification("✅ המשימה נוספה בהצלחה", "success");
      this.clearBudgetForm();

      // רענן מהשרת
      setTimeout(() => {
        this.loadBudgetTasksFromSheetOriginal();
      }, 1000);
    } catch (error) {
      console.error("❌ שגיאה בהוספת משימה:", error);

      // הסר מה-UI במקרה של כשלון
      this.budgetTasks = this.budgetTasks.filter((t) => t.id !== budgetTask.id);
      this.filteredBudgetTasks = [...this.budgetTasks];
      this.renderBudgetTasks();

      this.showNotification("❌ שגיאה בהוספת משימה", "error");
    }
  }

  validateBudgetTaskForm() {
    const errors = [];

    const description = document
      .getElementById("budgetDescription")
      ?.value?.trim();
    if (!description || description.length < 3) {
      errors.push("תיאור המשימה חייב להכיל לפחות 3 תווים");
    }

    const clientSelect = document.getElementById("budgetClientSelect")?.value;
    if (!clientSelect) {
      errors.push("חובה לבחור לקוח");
    }

    const estimatedTime = document.getElementById("estimatedTime")?.value;
    if (!estimatedTime || parseInt(estimatedTime) <= 0) {
      errors.push("זמן משוער חייב להיות גדול מ-0");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  showValidationErrors(errors) {
    const errorHtml = errors.map((error) => `<li>${error}</li>`).join("");
    this.showNotification(
      `❌ שגיאות בטופס:<ul style="text-align: right; margin: 10px 0;">${errorHtml}</ul>`,
      "error"
    );
  }

  async addTimesheetEntry() {
    const actionDate = document.getElementById("actionDate");
    const actionMinutes = document.getElementById("actionMinutes");
    const timesheetClientSelect = document.getElementById(
      "timesheetClientSelect"
    );
    const fileNumber = document.getElementById("fileNumber");
    const actionDescription = document.getElementById("actionDescription");
    const actionNotes = document.getElementById("actionNotes");

    if (
      !actionDate ||
      !actionMinutes ||
      !timesheetClientSelect ||
      !fileNumber ||
      !actionDescription
    ) {
      this.showNotification("שדות הטופס לא נמצאו", "error");
      return;
    }

    const date = actionDate.value;
    const minutes = actionMinutes.value;
    const clientName = timesheetClientSelect.value;
    const fileNumberValue = fileNumber.value;
    const action = actionDescription.value;
    const notes = actionNotes ? actionNotes.value : "";

    if (!date || !minutes || !clientName || !fileNumberValue || !action) {
      this.showNotification("אנא מלא את כל השדות הנדרשים", "error");
      return;
    }

    if (
      !this.clientValidation.validateClientSelection(clientName, "רישום שעתון")
    ) {
      return;
    }

    const selectedClient = this.clients.find((c) => c.fullName === clientName);

    const tempEntry = {
      id: Date.now(),
      date,
      action,
      lawyer: this.currentUser,
      minutes: parseInt(minutes),
      clientName,
      fileNumber: fileNumberValue,
      notes: notes.trim(),
      createdAt: new Date().toLocaleString("he-IL"),
    };

    this.timesheetEntries.unshift(tempEntry);
    this.filteredTimesheetEntries = [...this.timesheetEntries];
    this.renderTimesheetEntries();

    this.clearTimesheetForm();
    this.showNotification("הפעולה נרשמה בשעתון בהצלחה");

    const timesheetEntry = {
      date,
      action,
      lawyer: this.currentUser,
      minutes: parseInt(minutes),
      clientName,
      fileNumber: fileNumberValue,
      notes: notes.trim(),
      clientType: selectedClient ? selectedClient.type : "unknown",
      updateHours: selectedClient && selectedClient.type === "hours",
    };

    await this.saveTimesheetAndUpdateClient(timesheetEntry);
    await this.loadDataFromSheets();
  }

  updateClientsList() {
    console.log(`📝 מעדכן רשימת לקוחות: ${this.clients.length} לקוחות`);

    if (this.clients && this.clients.length > 0) {
      console.log("✅ רשימת לקוחות עודכנה בהצלחה");
    }
  }

  applyBudgetTaskFilters() {
    console.log(`📝 מעדכן רשימת משימות: ${this.budgetTasks.length} משימות`);
    this.filteredBudgetTasks = [...this.budgetTasks];
  }

  applyTimesheetFilters() {
    console.log(`📝 מעדכן רשימת שעתון: ${this.timesheetEntries.length} רשומות`);
    this.filteredTimesheetEntries = [...this.timesheetEntries];
  }

  showAdvancedTimeDialog(taskId) {
    try {
      const task = this.budgetTasks.find((t) => t.id === taskId);
      if (!task) {
        this.showNotification("המשימה לא נמצאה", "error");
        return;
      }

      const overlay = document.createElement("div");
      overlay.className = "popup-overlay";

      overlay.innerHTML = `
                <div class="popup" style="max-width: 500px;">
                    <div class="popup-header">
                        <i class="fas fa-clock"></i>
                        הוספת זמן למשימה
                    </div>
                    
                    <div class="popup-content">
                        <div class="task-info-section">
                            <h4 style="color: #1e40af; margin-bottom: 10px;">פרטי המשימה:</h4>
                            <p><strong>לקוח:</strong> ${task.clientName}</p>
                            <p><strong>תיאור:</strong> ${task.description}</p>
                            <p><strong>זמן נוכחי:</strong> ${
                              task.actualMinutes
                            } דקות מתוך ${task.estimatedMinutes}</p>
                        </div>
                        
                        <form id="advancedTimeForm">
                            <div class="form-group">
                                <label for="workDate">תאריך העבודה</label>
                                <input type="date" id="workDate" required 
                                       value="${
                                         new Date().toISOString().split("T")[0]
                                       }">
                            </div>
                            
                            <div class="form-group">
                                <label for="workMinutes">דקות עבודה</label>
                                <input type="number" id="workMinutes" min="1" max="999" 
                                       placeholder="60" required>
                            </div>
                            
                            <div class="form-group">
                                <label for="workDescription">תיאור העבודה שבוצעה</label>
                                <textarea id="workDescription" rows="3" 
                                          placeholder="תיאור מפורט של העבודה שבוצעה..." required></textarea>
                            </div>
                        </form>
                    </div>
                    
                    <div class="popup-buttons">
                        <button class="popup-btn popup-btn-confirm" onclick="manager.submitTimeEntry(${taskId})">
                            <i class="fas fa-save"></i>
                            שמור זמן
                        </button>
                        <button class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()">
                            <i class="fas fa-times"></i>
                            ביטול
                        </button>
                    </div>
                </div>
            `;

      document.body.appendChild(overlay);

      setTimeout(() => {
        const workMinutes = document.getElementById("workMinutes");
        if (workMinutes) workMinutes.focus();
      }, 100);
    } catch (error) {
      console.error("❌ שגיאה בפתיחת דיאלוג זמן:", error);
      this.showNotification("שגיאה בפתיחת הדיאלוג", "error");
    }
  }

  submitTimeEntry(taskId) {
    try {
      const workDate = document.getElementById("workDate");
      const workMinutes = document.getElementById("workMinutes");
      const workDescription = document.getElementById("workDescription");

      if (!workDate || !workMinutes || !workDescription) {
        this.showNotification("שדות לא נמצאו", "error");
        return;
      }

      const date = workDate.value;
      const minutes = parseInt(workMinutes.value);
      const description = workDescription.value.trim();

      if (!date || !minutes || !description) {
        this.showNotification("אנא מלא את כל השדות", "error");
        return;
      }

      if (minutes < 1 || minutes > 999) {
        this.showNotification("מספר הדקות חייב להיות בין 1 ל-999", "error");
        return;
      }

      const timeData = {
        taskId: taskId,
        date: date,
        minutes: minutes,
        description: description,
      };

      this.addTimeToTask(timeData);

      const popup = document.querySelector(".popup-overlay");
      if (popup) popup.remove();
    } catch (error) {
      console.error("❌ שגיאה בשמירת זמן:", error);
      this.showNotification("שגיאה בשמירת הזמן", "error");
    }
  }

  showTaskHistory(taskId) {
    try {
      const task = this.budgetTasks.find((t) => t.id === taskId);
      if (!task) {
        this.showNotification("המשימה לא נמצאה", "error");
        return;
      }

      const overlay = document.createElement("div");
      overlay.className = "popup-overlay";

      let historyHtml = "";
      if (task.history && task.history.length > 0) {
        historyHtml = task.history
          .map(
            (entry) => `
                    <div class="history-entry">
                        <div class="history-header">
                            <span class="history-date">${this.formatDate(
                              entry.date
                            )}</span>
                            <span class="history-minutes">${
                              entry.minutes
                            } דקות</span>
                        </div>
                        <div class="history-description">${
                          entry.description
                        }</div>
                        <div class="history-timestamp">נוסף ב: ${
                          entry.timestamp
                        }</div>
                    </div>
                `
          )
          .join("");
      } else {
        historyHtml =
          '<div style="text-align: center; color: #6b7280; padding: 40px;">אין היסטוריה עדיין</div>';
      }

      overlay.innerHTML = `
                <div class="popup" style="max-width: 600px;">
                    <div class="popup-header">
                        <i class="fas fa-history"></i>
                        היסטוריית זמנים - ${task.clientName}
                    </div>
                    
                    <div class="popup-content">
                        <div class="task-summary">
                            <h4>${task.description}</h4>
                            <p>סה"כ זמן: ${task.actualMinutes} דקות מתוך ${task.estimatedMinutes}</p>
                        </div>
                        
                        <div class="history-container">
                            ${historyHtml}
                        </div>
                    </div>
                    
                    <div class="popup-buttons">
                        <button class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()">
                            <i class="fas fa-times"></i>
                            סגור
                        </button>
                    </div>
                </div>
            `;

      document.body.appendChild(overlay);
    } catch (error) {
      console.error("❌ שגיאה בהצגת היסטוריה:", error);
      this.showNotification("שגיאה בהצגת ההיסטוריה", "error");
    }
  }

  clearBudgetForm() {
    const budgetForm = document.getElementById("budgetForm");
    if (budgetForm) budgetForm.reset();
  }

  clearTimesheetForm() {
    const timesheetForm = document.getElementById("timesheetForm");
    if (timesheetForm) timesheetForm.reset();

    const actionDate = document.getElementById("actionDate");
    if (actionDate) {
      const today = new Date().toISOString().split("T")[0];
      actionDate.value = today;
    }
  }

  filterBudgetTasks() {
    const budgetTaskFilter = document.getElementById("budgetTaskFilter");
    if (budgetTaskFilter) {
      const filter = budgetTaskFilter.value;
      this.currentTaskFilter = filter;
      this.loadBudgetTasksFromSheetOriginal();
    }
  }

  filterTimesheetEntries() {
    const timesheetFilter = document.getElementById("timesheetFilter");
    if (timesheetFilter) {
      const filter = timesheetFilter.value;
      this.currentTimesheetFilter = filter;
      this.loadTimesheetEntriesFromSheetOriginal();
    }
  }

  renderBudgetTasks() {
    const budgetContainer = document.getElementById("budgetContainer");
    const tableContainer = document.getElementById("budgetTableContainer");

    if (!budgetContainer && !tableContainer) {
      console.warn("⚠️ לא נמצאו מיכלי תצוגת תקצוב");
      return;
    }

    // קבלת נתונים מסוננים (הלוגיקה הקיימת נשארת)
    const tasksToShow = this.filteredBudgetTasks || this.budgetTasks || [];

    // הוספת Pagination
    const paginationData = this.budgetPagination.getPage(
      tasksToShow,
      this.currentBudgetPage
    );
    const paginatedTasks = paginationData.data;

    // רינדור הכרטיסיות (הקוד הקיים נשאר זהה, רק עם paginatedTasks)
    if (budgetContainer && !budgetContainer.classList.contains("hidden")) {
      this.renderBudgetCards(paginatedTasks);
    }

    // רינדור הטבלה (הקוד הקיים נשאר זהה, רק עם paginatedTasks)
    if (tableContainer && !tableContainer.classList.contains("hidden")) {
      this.renderBudgetTable(paginatedTasks);
    }

    // הוספת Pagination Controls
    this.budgetPagination.renderControls(
      "budgetPaginationControls",
      paginationData,
      "window.manager.changeBudgetPage"
    );
  }

  // פונקציה חדשה לשינוי עמוד
  changeBudgetPage(page) {
    this.currentBudgetPage = page;
    this.budgetPagination.currentPage = page;
    this.renderBudgetTasks();
  }

  renderBudgetCards() {
    his.domCache = {
      budgetContainer: document.getElementById("budgetContainer"),
      budgetTableContainer: document.getElementById("budgetTableContainer"),
    };
    if (!container) return;

    const tasksHtml = this.filteredBudgetTasks
      .map((task) => this.createModernTaskCard(task))
      .join("");

    container.innerHTML = `
    <div class="modern-cards-header">
        <h3 class="modern-cards-title">
            <i class="fas fa-chart-bar"></i>
            משימות מתוקצבות
        </h3>
        <div class="modern-cards-subtitle">
            ${
              this.filteredBudgetTasks.length
            } משימות • ${this.getActiveTasksCount()} פעילות • ${this.getCompletedTasksCount()} הושלמו
        </div>
    </div>
    <div class="budget-cards-grid">
        ${tasksHtml}
    </div>
`;

    setTimeout(() => {
      const cards = container.querySelectorAll(".linear-minimal-card");
      cards.forEach((card, index) => {
        card.style.opacity = "0";
        card.style.transform = "translateY(20px)";
        setTimeout(() => {
          card.style.transition = "all 0.4s ease";
          card.style.opacity = "1";
          card.style.transform = "translateY(0)";
        }, index * 100);
      });
    }, 50);
  }

  calculateSimpleProgress(task) {
    if (!task.estimatedMinutes || task.estimatedMinutes <= 0) return 0;
    const progress = Math.round(
      ((task.actualMinutes || 0) / task.estimatedMinutes) * 100
    );
    return Math.min(progress, 100);
  }

  expandTaskCard(taskId, event) {
    event.stopPropagation();
    const task = this.filteredBudgetTasks.find((t) => t.id == taskId);
    if (!task) return;

    const cardElement = event.target.closest(".linear-minimal-card");
    if (!cardElement) return;

    // אנימציה של הרחבת הכרטיס
    this.showExpandedCard(cardElement, task);
  }

  showExpandedCard(cardElement, task) {
    const safeTask = this.sanitizeTaskData(task);
    const progressData = this.calculateProgress(safeTask);
    const cardStatus = this.getTaskCardStatus(safeTask);

    // יצירת תוכן מורחב
    const expandedContent = `
        <div class="linear-expanded-overlay" onclick="manager.closeExpandedCard(event)">
            <div class="linear-expanded-card" onclick="event.stopPropagation()">
                <div class="linear-expanded-header">
                    <h2 class="linear-expanded-title">${
                      safeTask.taskDescription || safeTask.description
                    }</h2>
                    <button class="linear-close-btn" onclick="manager.closeExpandedCard(event)">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="linear-expanded-body">
                    <div class="linear-info-grid">
                        <div class="linear-info-item">
                            <label>לקוח:</label>
                            <span>${safeTask.clientName}</span>
                        </div>
                        <div class="linear-info-item">
                            <label>סטטוס:</label>
                            <span class="status-badge ${
                              cardStatus.badgeClass
                            }">${cardStatus.text}</span>
                        </div>
                        <div class="linear-info-item">
                            <label>זמן מתוכנן:</label>
                            <span>${
                              Math.round(
                                (safeTask.estimatedMinutes / 60) * 10
                              ) / 10
                            } שעות</span>
                        </div>
                        <div class="linear-info-item">
                            <label>זמן בפועל:</label>
                            <span>${
                              Math.round((safeTask.actualMinutes / 60) * 10) /
                              10
                            } שעות</span>
                        </div>
                        <div class="linear-info-item">
                            <label>התקדמות:</label>
                            <span>${progressData.percentage}%</span>
                        </div>
                        <div class="linear-info-item">
                            <label>תאריך יעד:</label>
                            <span>${this.formatDateTime(
                              new Date(safeTask.deadline)
                            )}</span>
                        </div>
                    </div>
                    
                    <div class="linear-actions-section">
                        <button class="linear-action-btn primary" onclick="manager.showAdvancedTimeDialog(${
                          safeTask.id
                        })">
                            <i class="fas fa-plus"></i> הוסף זמן
                        </button>
                        <button class="linear-action-btn info" onclick="manager.showTaskHistory(${
                          safeTask.id
                        })">
                            <i class="fas fa-history"></i> היסטוריה
                        </button>
                        <button class="linear-action-btn warning" onclick="manager.showExtendDeadlineDialog(${
                          safeTask.id
                        })">
                            <i class="fas fa-calendar-plus"></i> הארך יעד
                        </button>
                        <button class="linear-action-btn success" onclick="manager.completeTask(${
                          safeTask.id
                        })">
                            <i class="fas fa-check"></i> סיים משימה
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // הוספה לDOM
    document.body.insertAdjacentHTML("beforeend", expandedContent);

    // אנימציה
    setTimeout(() => {
      const overlay = document.querySelector(".linear-expanded-overlay");
      if (overlay) {
        overlay.classList.add("active");
      }
    }, 10);
  }

  closeExpandedCard(event) {
    const overlay = document.querySelector(".linear-expanded-overlay");
    if (overlay) {
      overlay.classList.remove("active");
      setTimeout(() => {
        overlay.remove();
      }, 300);
    }
  }

  // פונקציה מעודכנת ומלאה לכרטיסיות תקצוב משימות
  createModernTaskCard(task) {
    const safeTask = this.sanitizeTaskData(task);
    const progress = this.calculateSimpleProgress(safeTask);

    // חישוב מחלקת צבע לבר התקדמות
    const progressClass =
      progress >= 100
        ? "progress-complete"
        : progress >= 85
        ? "progress-high"
        : progress >= 50
        ? "progress-medium"
        : "progress-low";

    // חישוב טקסט סטטוס התקדמות
    const progressStatus = this.getProgressStatusText(progress);

    // חישוב תאריך יעד ועוצמת דחיפות
    const now = new Date();
    const deadline = new Date(safeTask.deadline);
    const daysUntilDeadline = Math.ceil(
      (deadline - now) / (1000 * 60 * 60 * 24)
    );

    let deadlineClass = "";
    let deadlineIcon = "📅";

    if (daysUntilDeadline < 0) {
      deadlineClass = "overdue";
      deadlineIcon = "⚠️";
    } else if (daysUntilDeadline <= 1) {
      deadlineClass = "urgent";
      deadlineIcon = "🚨";
    } else if (daysUntilDeadline <= 3) {
      deadlineClass = "soon";
      deadlineIcon = "⏰";
    }

    // חישוב שעות עם דיוק
    const actualHours = Math.round((safeTask.actualMinutes / 60) * 10) / 10;
    const estimatedHours =
      Math.round((safeTask.estimatedMinutes / 60) * 10) / 10;
    const remainingMinutes = Math.max(
      0,
      safeTask.estimatedMinutes - safeTask.actualMinutes
    );
    const remainingHours = Math.round((remainingMinutes / 60) * 10) / 10;

    return `
        <div class="linear-minimal-card" data-task-id="${safeTask.id}">
            <div class="linear-card-content">
                <!-- כותרת מתוקנת עם tooltip -->
                <h3 class="linear-card-title" data-full-text="${
                  safeTask.description
                }" title="${safeTask.description}">
                    ${safeTask.description}
                </h3>
                
                <!-- קטע התקדמות ויזואלי מלא -->
                <div class="linear-progress-section">
                    <div class="linear-visual-progress">
                        <div class="linear-progress-text">
                            <span class="progress-percentage">${progress}%</span>
                            <span class="progress-status">${progressStatus}</span>
                        </div>
                        <div class="linear-progress-bar">
                            <div class="linear-progress-fill ${progressClass}" 
                                 style="width: ${Math.min(
                                   progress,
                                   100
                                 )}%"></div>
                        </div>
                    </div>
                    
                    <!-- מידע זמנים עם צבעים - השני ריבועים היפים -->
                    <div class="linear-time-info">
                        <div class="time-item actual">
                            <span class="time-value">${actualHours}h</span>
                            <span class="time-label">בפועל</span>
                        </div>
                        <div class="time-item estimated">
                            <span class="time-value">${estimatedHours}h</span>
                            <span class="time-label">מתוכנן</span>
                        </div>
                    </div>
                    
                    
                </div>
                
                <!-- מטא-נתונים - הטקסט שחורג -->
                <div class="linear-card-meta">
                    <div class="linear-client-row">
                        <span class="linear-client-label">לקוח:</span>
                        <span class="linear-client-name" title="${
                          safeTask.clientName
                        }">
                            ${
                              safeTask.clientName.length > 20
                                ? safeTask.clientName.substring(0, 20) + "..."
                                : safeTask.clientName
                            }
                        </span>
                    </div>
                    
                    <div class="linear-deadline-row">
                        <span class="linear-progress-label">יעד:</span>
                        <span class="deadline-info ${deadlineClass}" title="${this.formatDate(
      safeTask.deadline
    )}">
                            ${deadlineIcon} ${this.formatShort(
      safeTask.deadline
    )}
                        </span>
                    </div>
                    
                   
                </div>
            </div>
            
            <!-- כפתור הפלוס הקטן שמישהו אוהב -->
            <button class="linear-expand-btn" onclick="manager.expandTaskCard(${
              safeTask.id
            }, event)" title="הרחב פרטים">
                <i class="fas fa-plus"></i>
            </button>
        </div>
    `;
  }
  formatShort(date) {
    const d = new Date(date);
    return d.toLocaleDateString("he-IL", {
      day: "numeric",
      month: "short",
    });
  }
  // פונקציה חדשה לחישוב טקסט סטטוס התקדמות
  getProgressStatusText(progress) {
    if (progress >= 100) return "הושלם";
    if (progress >= 90) return "כמעט סיימת";
    if (progress >= 75) return "קרוב לסיום";
    if (progress >= 50) return "באמצע הדרך";
    if (progress >= 25) return "התחלנו";
    if (progress > 0) return "בתחילת הדרך";
    return "לא התחיל";
  }

  renderBudgetTable() {
    const tableContainer = document.getElementById("budgetTableContainer");
    if (!tableContainer) return;

    if (!this.filteredBudgetTasks || this.filteredBudgetTasks.length === 0) {
      tableContainer.innerHTML = this.createEmptyTableState();
      return;
    }

    const tableHtml = `
            <div class="modern-table-container">
                <div class="modern-table-header">
                    <h3 class="modern-table-title">
                        <i class="fas fa-chart-bar"></i>
                        משימות מתוקצבות
                    </h3>
                    <div class="modern-table-subtitle">
                        ${
                          this.filteredBudgetTasks.length
                        } משימות • ${this.getActiveTasksCount()} פעילות • ${this.getCompletedTasksCount()} הושלמו
                    </div>
                </div>
                
                <table class="modern-budget-table">
                    <thead>
                        <tr>
                            <th class="sortable" data-sort="clientName" onclick="manager.sortBudgetTable('clientName')">
                                לקוח
                                <i class="sort-icon"></i>
                            </th>
                            <th class="sortable" data-sort="description" onclick="manager.sortBudgetTable('description')">
                                תיאור משימה
                                <i class="sort-icon"></i>
                            </th>
                            <th class="sortable" data-sort="progress" onclick="manager.sortBudgetTable('progress')">
                                התקדמות
                                <i class="sort-icon"></i>
                            </th>
                            <th class="sortable" data-sort="deadline" onclick="manager.sortBudgetTable('deadline')">
                                תאריך יעד
                                <i class="sort-icon"></i>
                            </th>
                            <th class="sortable" data-sort="status" onclick="manager.sortBudgetTable('status')">
                                סטטוס
                                <i class="sort-icon"></i>
                            </th>
                            <th>פעולות</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.generateModernTableRows()}
                    </tbody>
                </table>
            </div>
        `;

    tableContainer.innerHTML = tableHtml;
    this.updateSortIndicators();

    setTimeout(() => {
      const rows = tableContainer.querySelectorAll("tbody tr");
      rows.forEach((row, index) => {
        row.style.opacity = "0";
        row.style.transform = "translateY(10px)";
        setTimeout(() => {
          row.style.transition = "all 0.3s ease";
          row.style.opacity = "1";
          row.style.transform = "translateY(0)";
        }, index * 50);
      });
    }, 100);
  }

  generateModernTableRows() {
    return this.filteredBudgetTasks
      .map((task) => {
        const safeTask = this.sanitizeTaskData(task);
        const progressData = this.calculateModernProgress(safeTask);
        const deadlineData = this.getModernDeadlineStatus(safeTask);
        const statusData = this.getModernStatus(safeTask);

        return `
                <tr data-task-id="${safeTask.id}" class="modern-table-row">
                    <td class="table-cell-client">
                        ${
                          safeTask.clientName.length > 12
                            ? safeTask.clientName.substring(0, 12) + "..."
                            : safeTask.clientName
                        }
                        ${
                          safeTask.fileNumber
                            ? `<br><small style="color: #94a3b8; font-weight: 400;">תיק: ${safeTask.fileNumber}</small>`
                            : ""
                        }
                    </td>
                    
<td class="table-cell-description ${
          this.shouldTruncateDescription(
            safeTask.taskDescription || safeTask.description
          )
            ? "truncated"
            : ""
        }" 
    title="${safeTask.taskDescription || safeTask.description}">
    ${safeTask.taskDescription || safeTask.description}
                        ${
                          safeTask.branch
                            ? `<br><small style="color: #94a3b8; font-weight: 400;">📍 ${safeTask.branch}</small>`
                            : ""
                        }
                    </td>
                    
                    
                    <td class="table-cell-progress">
                        ${this.createModernProgressBar(progressData, safeTask)}
                    </td>
                    
                    <td class="table-cell-deadline ${deadlineData.cssClass}">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            ${deadlineData.icon}
                            <span>${this.formatDateTime(
                              new Date(safeTask.deadline)
                            )}</span>
                        </div>
                    </td>
                    
                    <td class="table-cell-status">
                        <span class="modern-status-badge ${
                          statusData.cssClass
                        }">
                            <i class="${statusData.icon}"></i>
                            ${statusData.text}
                        </span>
                    </td>
                    
                    <td class="table-cell-actions">
                        ${this.createModernActionButtons(safeTask)}
                    </td>
                </tr>
            `;
      })
      .join("");
  }

  createModernProgressBar(progressData, task) {
    return `
            <div class="modern-progress-container">
                <div class="modern-progress-header">
                    <span class="modern-progress-label">התקדמות</span>
                    <span class="modern-progress-percentage">${
                      progressData.percentage
                    }%</span>
                </div>
                <div class="modern-progress-bar">
                    <div class="modern-progress-fill ${
                      progressData.colorClass
                    }" 
                         style="width: ${Math.min(
                           progressData.percentage,
                           100
                         )}%"></div>
                </div>
                <div class="modern-progress-details">
                    ${task.actualMinutes} מתוך ${task.estimatedMinutes} דק' • ${
      Math.round((task.actualMinutes / 60) * 10) / 10
    }h/${Math.round((task.estimatedMinutes / 60) * 10) / 10}h
                </div>
            </div>
        `;
  }

  createModernActionButtons(task) {
    const baseButtons = `
            <div class="modern-actions-group">
                <button class="modern-action-btn primary" 
                        onclick="manager.showAdvancedTimeDialog(${task.id})" 
                        title="הוסף זמן">
                    <i class="fas fa-plus"></i>
                </button>
                <button class="modern-action-btn info" 
                        onclick="manager.showTaskHistory(${task.id})" 
                        title="היסטוריה">
                    <i class="fas fa-history"></i>
                </button>
        `;

    const activeButtons =
      task.status === "פעיל"
        ? `
                <button class="modern-action-btn warning" 
                        onclick="manager.showExtendDeadlineDialog(${task.id})" 
                        title="הארך יעד">
                    <i class="fas fa-calendar-plus"></i>
                </button>
                <button class="modern-action-btn success" 
                        onclick="manager.completeTask(${task.id})" 
                        title="סיים משימה">
                    <i class="fas fa-check"></i>
                </button>
        `
        : "";

    return baseButtons + activeButtons + "</div>";
  }

  calculateModernProgress(task) {
    const percentage =
      task.estimatedMinutes > 0
        ? Math.round((task.actualMinutes / task.estimatedMinutes) * 100)
        : 0;

    let colorClass = "normal";
    if (percentage >= 100) {
      colorClass = "complete";
    } else if (percentage >= 85) {
      colorClass = "danger";
    } else if (percentage >= 70) {
      colorClass = "warning";
    }

    return { percentage, colorClass };
  }

  getModernDeadlineStatus(task) {
    const now = new Date();
    const deadline = new Date(task.deadline);
    const timeUntilDeadline = deadline - now;
    const oneDay = 24 * 60 * 60 * 1000;
    const threeDays = oneDay * 3;

    if (timeUntilDeadline < 0) {
      return {
        cssClass: "overdue",
        icon: '<i class="fas fa-exclamation-triangle" style="color: #ef4444;"></i>',
      };
    } else if (timeUntilDeadline < oneDay) {
      return {
        cssClass: "soon",
        icon: '<i class="fas fa-clock" style="color: #f59e0b;"></i>',
      };
    } else if (timeUntilDeadline < threeDays) {
      return {
        cssClass: "soon",
        icon: '<i class="fas fa-calendar-check" style="color: #f59e0b;"></i>',
      };
    }

    return {
      cssClass: "normal",
      icon: '<i class="fas fa-calendar-alt" style="color: #64748b;"></i>',
    };
  }

  getModernStatus(task) {
    const now = new Date();
    const deadline = new Date(task.deadline);
    const isOverdue = deadline < now;
    const isCompleted = task.status === "הושלם";

    if (isCompleted) {
      return {
        cssClass: "completed",
        icon: "fas fa-check-circle",
        text: "הושלם",
      };
    } else if (isOverdue) {
      return {
        cssClass: "overdue",
        icon: "fas fa-exclamation-triangle",
        text: "באיחור",
      };
    } else {
      return {
        cssClass: "active",
        icon: "fas fa-play-circle",
        text: "פעיל",
      };
    }
  }

  shouldTruncateDescription(description) {
    return description && description.length > 50;
  }

  getActiveTasksCount() {
    return this.filteredBudgetTasks.filter((task) => task.status === "פעיל")
      .length;
  }

  getCompletedTasksCount() {
    return this.filteredBudgetTasks.filter((task) => task.status === "הושלם")
      .length;
  }

  createEmptyTableState() {
    return `
            <div class="modern-table-container">
                <div class="modern-table-header">
                    <h3 class="modern-table-title">
                        <i class="fas fa-chart-bar"></i>
                        משימות מתוקצבות
                    </h3>
                    <div class="modern-table-subtitle">אין משימות להצגה</div>
                </div>
                <div style="padding: 60px 40px; text-align: center; color: #94a3b8;">
                    <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">
                        <i class="fas fa-chart-bar"></i>
                    </div>
                    <h4 style="color: #475569; margin-bottom: 8px;">אין משימות מתוקצבות</h4>
                    <p style="margin: 0; font-size: 14px;">הוסף משימה חדשה כדי להתחיל</p>
                </div>
            </div>
        `;
  }

  renderTimesheetEntries() {
    const timesheetContainer = document.getElementById("timesheetContainer");
    const tableContainer = document.getElementById("timesheetTableContainer");

    if (!timesheetContainer && !tableContainer) {
      console.warn("⚠️ לא נמצאו מיכלי תצוגת שעתון");
      return;
    }

    // קבלת נתונים מסוננים (הלוגיקה הקיימת נשארת)
    const entriesToShow =
      this.filteredTimesheetEntries || this.timesheetEntries || [];

    // הוספת Pagination
    const paginationData = this.timesheetPagination.getPage(
      entriesToShow,
      this.currentTimesheetPage
    );
    const paginatedEntries = paginationData.data;

    // רינדור הכרטיסיות (הקוד הקיים נשאר זהה, רק עם paginatedEntries)
    if (
      timesheetContainer &&
      !timesheetContainer.classList.contains("hidden")
    ) {
      this.renderTimesheetCards(paginatedEntries);
    }

    // רינדור הטבלה (הקוד הקיים נשאר זהה, רק עם paginatedEntries)
    if (tableContainer && !tableContainer.classList.contains("hidden")) {
      this.renderTimesheetTable(paginatedEntries);
    }

    // הוספת Pagination Controls
    this.timesheetPagination.renderControls(
      "timesheetPaginationControls",
      paginationData,
      "window.manager.changeTimesheetPage"
    );
  }

  // פונקציה חדשה לשינוי עמוד
  changeTimesheetPage(page) {
    this.currentTimesheetPage = page;
    this.timesheetPagination.currentPage = page;
    this.renderTimesheetEntries();
  }

  renderTimesheetTable() {
    const tableContainer = document.getElementById("timesheetTableContainer");
    if (!tableContainer) return;

    if (
      !this.filteredTimesheetEntries ||
      this.filteredTimesheetEntries.length === 0
    ) {
      tableContainer.innerHTML = this.createEmptyTimesheetState();
      return;
    }

    const tableHtml = `
            <div class="modern-table-container">
                <div class="modern-timesheet-header">
                    <h3 class="modern-timesheet-title">
                        <i class="fas fa-clock"></i>
                        רשומות שעתון
                    </h3>
                    <div class="modern-timesheet-subtitle">
                        ${
                          this.filteredTimesheetEntries.length
                        } רשומות • ${this.getTotalHoursTimesheet()} שעות סה"כ
                    </div>
                    <div class="timesheet-stats">
                        <div class="timesheet-stat">
                            <i class="fas fa-calendar-day"></i>
                            <span>היום: ${this.getTodayEntries()} רשומות</span>
                        </div>
                        <div class="timesheet-stat">
                            <i class="fas fa-chart-line"></i>
                            <span>השבוע: ${this.getWeekEntries()} רשומות</span>
                        </div>
                        <div class="timesheet-stat">
                            <i class="fas fa-users"></i>
                            <span>${this.getUniqueClientsCount()} לקוחות</span>
                        </div>
                    </div>
                </div>
                
                <table class="modern-timesheet-table">
                    <thead>
                        <tr>
                            <th class="sortable" data-sort="date" onclick="manager.sortTimesheetTable('date')">
                                תאריך
                                <i class="sort-icon"></i>
                            </th>
                            <th class="sortable" data-sort="action" onclick="manager.sortTimesheetTable('action')">
                                פעולה שבוצעה
                                <i class="sort-icon"></i>
                            </th>
                            <th class="sortable" data-sort="minutes" onclick="manager.sortTimesheetTable('minutes')">
                                זמן
                                <i class="sort-icon"></i>
                            </th>
                            <th class="sortable" data-sort="clientName" onclick="manager.sortTimesheetTable('clientName')">
                                לקוח
                                <i class="sort-icon"></i>
                            </th>
                            <th class="sortable" data-sort="fileNumber" onclick="manager.sortTimesheetTable('fileNumber')">
                                מס׳ תיק
                                <i class="sort-icon"></i>
                            </th>
                            <th>הערות</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.generateModernTimesheetRows()}
                    </tbody>
                </table>
            </div>
        `;

    tableContainer.innerHTML = tableHtml;
    this.updateTimesheetSortIndicators();

    setTimeout(() => {
      const rows = tableContainer.querySelectorAll("tbody tr");
      rows.forEach((row, index) => {
        row.style.opacity = "0";
        row.style.transform = "translateY(10px)";
        setTimeout(() => {
          row.style.transition = "all 0.3s ease";
          row.style.opacity = "1";
          row.style.transform = "translateY(0)";
        }, index * 30);
      });
    }, 100);
  }

  generateModernTimesheetRows() {
    return this.filteredTimesheetEntries
      .map((entry) => {
        const safeEntry = this.sanitizeTimesheetData(entry);

        return `
                <tr data-entry-id="${
                  safeEntry.id
                }" class="modern-timesheet-row">
                    <td class="timesheet-cell-date">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-calendar-alt" style="color: #16a34a;"></i>
                            <span>${this.formatDateModern(
                              safeEntry.date
                            )}</span>
                        </div>
                    </td>
                    
                    <td class="timesheet-cell-action ${
                      this.shouldTruncateAction(safeEntry.action)
                        ? "truncated"
                        : ""
                    }" 
                        title="${safeEntry.action}">
                        ${safeEntry.action}
                    </td>
                    
                    <td class="timesheet-cell-time">
                        ${this.createTimeBadge(safeEntry.minutes)}
                    </td>
                    
                    <td class="timesheet-cell-client">
                        ${safeEntry.clientName}
                        ${
                          safeEntry.lawyer
                            ? `<br><small style="color: #94a3b8; font-weight: 400;">👤 ${safeEntry.lawyer}</small>`
                            : ""
                        }
                    </td>
                    
                    <td class="timesheet-cell-file">
                        ${this.createFileBadge(safeEntry.fileNumber)}
                    </td>
                    
                    <td class="timesheet-cell-notes ${
                      safeEntry.notes ? "" : "empty"
                    } ${
          this.shouldTruncateNotes(safeEntry.notes) ? "truncated" : ""
        }" 
                        title="${safeEntry.notes || ""}">
                        ${safeEntry.notes || "—"}
                    </td>
                </tr>
            `;
      })
      .join("");
  }

  createTimeBadge(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    let timeDisplay = "";
    if (hours > 0) {
      timeDisplay = `<span class="time-hours">${hours}</span><span class="time-minutes">h</span>`;
      if (mins > 0) {
        timeDisplay += ` <span class="time-minutes">${mins}m</span>`;
      }
    } else {
      timeDisplay = `<span class="time-minutes">${mins}m</span>`;
    }

    return `
            <div class="time-badge">
                <i class="fas fa-clock"></i>
                ${timeDisplay}
            </div>
        `;
  }

  createFileBadge(fileNumber) {
    return `
            <div class="file-badge">
                <i class="fas fa-folder"></i>
                ${fileNumber}
            </div>
        `;
  }

  sanitizeTimesheetData(entry) {
    return {
      id: entry.id || Date.now(),
      date: entry.date || new Date().toISOString().split("T")[0],
      action: entry.action || "פעולה לא ידועה",
      minutes: Number(entry.minutes) || 0,
      clientName: entry.clientName || "לקוח לא ידוע",
      fileNumber: entry.fileNumber || "לא ידוע",
      notes: entry.notes || "",
      lawyer: entry.lawyer || "",
    };
  }

  formatDateModern(dateString) {
    try {
      const date = new Date(dateString);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (date.toDateString() === today.toDateString()) {
        return "היום";
      }

      if (date.toDateString() === yesterday.toDateString()) {
        return "אתמול";
      }

      return date.toLocaleDateString("he-IL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch (error) {
      return "תאריך לא תקין";
    }
  }

  shouldTruncateAction(action) {
    return action && action.length > 60;
  }

  shouldTruncateNotes(notes) {
    return notes && notes.length > 40;
  }

  getTotalHoursTimesheet() {
    const totalMinutes = this.filteredTimesheetEntries.reduce((sum, entry) => {
      return sum + (Number(entry.minutes) || 0);
    }, 0);
    return Math.round((totalMinutes / 60) * 10) / 10;
  }

  getTodayEntries() {
    const today = new Date().toISOString().split("T")[0];
    return this.filteredTimesheetEntries.filter((entry) => entry.date === today)
      .length;
  }

  getWeekEntries() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    return this.filteredTimesheetEntries.filter((entry) => {
      const entryDate = new Date(entry.date);
      return entryDate >= oneWeekAgo;
    }).length;
  }

  getUniqueClientsCount() {
    const uniqueClients = new Set(
      this.filteredTimesheetEntries.map((entry) => entry.clientName)
    );
    return uniqueClients.size;
  }

  updateTimesheetSortIndicators() {
    document.querySelectorAll("#timesheetTable th").forEach((th) => {
      th.classList.remove("sort-asc", "sort-desc");
    });

    if (this.timesheetSortField) {
      const currentTh = document.querySelector(
        `#timesheetTable th[data-sort="${this.timesheetSortField}"]`
      );
      if (currentTh) {
        currentTh.classList.add(`sort-${this.timesheetSortDirection}`);
      }
    }
  }

  createEmptyTimesheetState() {
    return `
            <div class="modern-table-container">
                <div class="modern-timesheet-header">
                    <h3 class="modern-timesheet-title">
                        <i class="fas fa-clock"></i>
                        רשומות שעתון
                    </h3>
                    <div class="modern-timesheet-subtitle">אין רשומות להצגה</div>
                </div>
                <div style="padding: 60px 40px; text-align: center; color: #94a3b8;">
                    <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.5; color: #16a34a;">
                        <i class="fas fa-clock"></i>
                    </div>
                    <h4 style="color: #475569; margin-bottom: 8px;">אין רשומות שעתון</h4>
                    <p style="margin: 0; font-size: 14px;">רשום את הפעולה הראשונה שלך</p>
                </div>
            </div>
        `;
  }

  async addTimeToTask(timeData) {
    const operationId = `addTime_${timeData.taskId}_${Date.now()}`;

    if (
      !loadingManager.startOperation(
        operationId,
        "רושם זמן למשימה...",
        "מעדכן את הגליון"
      )
    ) {
      this.showNotification("רישום זמן כבר בתהליך...", "warning");
      return;
    }

    try {
      const taskIndex = this.budgetTasks.findIndex(
        (t) => t.id === timeData.taskId
      );
      let originalTask = null;

      if (taskIndex !== -1) {
        originalTask = JSON.parse(JSON.stringify(this.budgetTasks[taskIndex]));

        this.budgetTasks[taskIndex].actualMinutes += timeData.minutes;
        this.budgetTasks[taskIndex].history.push({
          id: Date.now(),
          date: timeData.date,
          minutes: timeData.minutes,
          description: timeData.description,
          timestamp: new Date().toLocaleString("he-IL"),
          isPending: true,
        });

        this.filteredBudgetTasks = [...this.budgetTasks];
        this.renderBudgetTasks();

        this.showNotification("⏳ רושם זמן... (עדכון מיידי)", "info");
      }

      const data = {
        action: "addTimeToTask",
        employee: this.currentUser,
        timeEntry: {
          taskId: timeData.taskId,
          date: timeData.date,
          minutes: timeData.minutes,
          description: timeData.description,
          timestamp: new Date().toLocaleString("he-IL"),
        },
      };

      await this.sendToGoogleSheets(data);

      if (taskIndex !== -1) {
        const lastHistoryItem =
          this.budgetTasks[taskIndex].history[
            this.budgetTasks[taskIndex].history.length - 1
          ];
        if (lastHistoryItem && lastHistoryItem.isPending) {
          delete lastHistoryItem.isPending;
        }
      }

      this.showNotification("✅ זמן נוסף בהצלחה למשימה!", "success");

      setTimeout(() => {
        this.loadBudgetTasksFromSheetOriginal();
      }, 1000);
    } catch (error) {
      console.error("❌ שגיאה בהוספת זמן:", error);

      if (originalTask && taskIndex !== -1) {
        this.budgetTasks[taskIndex] = originalTask;
        this.filteredBudgetTasks = [...this.budgetTasks];
        this.renderBudgetTasks();
      }

      this.showNotification("❌ שגיאה ברישום זמן - נסה שוב", "error");
    } finally {
      loadingManager.finishOperation(operationId);
    }
  }

  async extendTaskDeadline(taskId, newDeadline, reason = "") {
    try {
      const data = {
        action: "extendTaskDeadline",
        employee: this.currentUser,
        taskId: taskId,
        newDeadline: newDeadline,
        reason: reason,
      };

      const taskIndex = this.budgetTasks.findIndex((t) => t.id === taskId);
      if (taskIndex !== -1) {
        this.budgetTasks[taskIndex].deadline = newDeadline;
        this.budgetTasks[taskIndex].extended = true;
        this.filteredBudgetTasks = [...this.budgetTasks];
        this.renderBudgetTasks();
      }

      await this.sendToGoogleSheets(data);
      this.showNotification("תאריך יעד הוארך בהצלחה", "success");

      await this.loadBudgetTasksFromSheetOriginal();
    } catch (error) {
      console.error("❌ שגיאה בהארכת יעד:", error);
      this.showNotification("שגיאה בהארכת יעד", "error");
    }
  }

  async completeTask(taskId) {
    const task = this.budgetTasks.find((t) => t.id === taskId);
    if (!task) {
      this.showNotification("המשימה לא נמצאה", "error");
      return;
    }

    const notes = prompt(
      `סיום משימה: ${task.description}\n\nהערות סיום (אופציונלי):`,
      ""
    );

    if (notes !== null) {
      try {
        const data = {
          action: "completeBudgetTask",
          employee: this.currentUser,
          taskId: taskId,
          completionNotes: notes || "",
        };

        const taskIndex = this.budgetTasks.findIndex((t) => t.id === taskId);
        if (taskIndex !== -1) {
          this.budgetTasks[taskIndex].status = "הושלם";
          this.budgetTasks[taskIndex].completedAt = new Date().toLocaleString(
            "he-IL"
          );
          this.filteredBudgetTasks = [...this.budgetTasks];
          this.renderBudgetTasks();
        }

        await this.sendToGoogleSheets(data);
        this.showNotification("המשימה הושלמה בהצלחה");

        await this.loadBudgetTasksFromSheetOriginal();
      } catch (error) {
        console.error("❌ שגיאה בהשלמת משימה:", error);
        this.showNotification("שגיאה בהשלמת המשימה", "error");
      }
    }
  }

  showExtendDeadlineDialog(taskId) {
    const task = this.budgetTasks.find((t) => t.id === taskId);
    if (!task) {
      this.showNotification("המשימה לא נמצאה", "error");
      return;
    }

    const overlay = document.createElement("div");
    overlay.className = "popup-overlay";

    const currentDeadline = new Date(task.deadline);
    const defaultNewDate = new Date(currentDeadline);
    defaultNewDate.setDate(defaultNewDate.getDate() + 1);

    const defaultDateValue = defaultNewDate.toISOString().split("T")[0];
    const defaultTimeValue = defaultNewDate.toTimeString().slice(0, 5);

    overlay.innerHTML = `
    <div class="popup" style="max-width: 550px;">
        <div class="popup-header">
            <i class="fas fa-calendar-plus"></i>
            הארכת תאריך יעד
            <button type="button" onclick="this.closest('.popup-overlay').remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        
        <div class="popup-content">
            <div class="popup-section">
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                    <h4 style="margin: 0 0 12px 0; color: #1e293b; font-size: 16px; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-tasks"></i> ${task.description}
                    </h4>
                    <div style="display: flex; justify-content: space-between; margin: 8px 0; font-size: 14px;">
                        <span style="color: #64748b;">לקוח:</span>
                        <span style="font-weight: 500;">${
                          task.clientName
                        }</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin: 8px 0; font-size: 14px;">
                        <span style="color: #64748b;">סניף:</span>
                        <span style="font-weight: 500;">${task.branch}</span>
                    </div>
                </div>
            </div>
            
            <form id="extendDeadlineForm">
                <div class="popup-section">
                    <label>תאריך יעד נוכחי:</label>
                    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 12px; font-weight: 500; color: #991b1b;">
                        ${this.formatDateTime(currentDeadline)}
                    </div>
                </div>
                
                <div class="popup-section">
                    <label for="newDeadlineDate">תאריך חדש:</label>
                    <input type="date" id="newDeadlineDate" value="${defaultDateValue}" required>
                </div>
                
                <div class="popup-section">
                    <label for="newDeadlineTime">שעה:</label>
                    <input type="time" id="newDeadlineTime" value="${defaultTimeValue}" required>
                </div>
                
                <div class="popup-section">
                    <label for="extensionReason">סיבת ההארכה (אופציונלי):</label>
                    <textarea id="extensionReason" rows="3" placeholder="הסבר קצר לסיבת ההארכה..." maxlength="200"></textarea>
                </div>
                
                <!-- סיכום השינוי -->
                <div class="popup-section">
                    <div style="background: #eff6ff; border: 1px solid #dbeafe; border-radius: 8px; padding: 16px;">
                        <div style="font-weight: 600; color: #1e40af; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-info-circle"></i> סיכום השינוי
                        </div>
                        
                        <div style="margin: 8px 0; font-size: 14px; border-bottom: 1px solid #dbeafe; padding-bottom: 8px;">
                            <div style="display: flex; justify-content: space-between;">
                                <span style="color: #64748b;">מ:</span>
                                <span id="currentDeadlineShow">${this.formatDateTime(
                                  currentDeadline
                                )}</span>
                            </div>
                        </div>
                        
                        <div style="margin: 8px 0; font-size: 14px; border-bottom: 1px solid #dbeafe; padding-bottom: 8px;">
                            <div style="display: flex; justify-content: space-between;">
                                <span style="color: #64748b;">ל:</span>
                                <span id="newDeadlineShow" style="font-weight: 600; color: #1e40af;">${this.formatDateTime(
                                  defaultNewDate
                                )}</span>
                            </div>
                        </div>
                        
                        <div style="margin: 8px 0; font-size: 14px;">
                            <div style="display: flex; justify-content: space-between;">
                                <span style="color: #64748b;">הבדל:</span>
                                <span id="timeDifferenceShow" style="font-weight: 600; color: #059669;">יום אחד קדימה</span>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </div>
        
        <div class="popup-buttons">
            <button type="button" class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()">
                <i class="fas fa-times"></i> ביטול
            </button>
            <button type="submit" class="popup-btn popup-btn-confirm" id="confirmExtendBtn" onclick="document.getElementById('extendDeadlineForm').dispatchEvent(new Event('submit'))">
                <i class="fas fa-calendar-check"></i> אשר הארכה
            </button>
        </div>
    </div>
`;
    document.body.appendChild(overlay);

    const dateInput = document.getElementById("newDeadlineDate");
    const timeInput = document.getElementById("newDeadlineTime");
    const newDeadlineShow = document.getElementById("newDeadlineShow");
    const timeDifferenceShow = document.getElementById("timeDifferenceShow");
    const confirmBtn = document.getElementById("confirmExtendBtn");

    // פונקציה לעדכון הסיכום
    const updateSummary = () => {
      const newDate = new Date(`${dateInput.value}T${timeInput.value}`);
      const formattedDate = this.formatDateTime(newDate);

      newDeadlineShow.textContent = formattedDate;

      const diffMs = newDate - currentDeadline;
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.round(diffMs / (1000 * 60 * 60));

      let timeDiffText;
      let colorClass = "#059669"; // ירוק - הארכה

      if (diffDays > 0) {
        timeDiffText = `${diffDays} ${diffDays === 1 ? "יום" : "ימים"} קדימה`;
      } else if (diffDays < 0) {
        timeDiffText = `${Math.abs(diffDays)} ${
          Math.abs(diffDays) === 1 ? "יום" : "ימים"
        } אחורה`;
        colorClass = "#dc2626"; // אדום - קיצור
      } else if (diffHours > 0) {
        timeDiffText = `${diffHours} ${diffHours === 1 ? "שעה" : "שעות"} קדימה`;
      } else if (diffHours < 0) {
        timeDiffText = `${Math.abs(diffHours)} ${
          Math.abs(diffHours) === 1 ? "שעה" : "שעות"
        } אחורה`;
        colorClass = "#dc2626";
      } else {
        timeDiffText = "אותו זמן";
        colorClass = "#6b7280"; // אפור
      }

      timeDifferenceShow.textContent = timeDiffText;
      timeDifferenceShow.style.color = colorClass;

      // שינוי טקסט הכפתור בהתאם
      if (diffMs > 0) {
        confirmBtn.innerHTML = '<i class="fas fa-calendar-plus"></i> אשר הארכה';
      } else if (diffMs < 0) {
        confirmBtn.innerHTML =
          '<i class="fas fa-calendar-minus"></i> אשר קיצור';
      } else {
        confirmBtn.innerHTML =
          '<i class="fas fa-calendar-check"></i> אשר שינוי';
      }
    };

    // האזנה לשינויים
    dateInput.addEventListener("change", updateSummary);
    timeInput.addEventListener("change", updateSummary);

    // הפעלת הטופס
    const form = overlay.querySelector("#extendDeadlineForm");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const newDeadline = `${dateInput.value}T${timeInput.value}`;
      const reason = document.getElementById("extensionReason").value.trim();

      const newDate = new Date(newDeadline);
      const confirmMessage = `האם אתה בטוח שברצונך לשנות את המשימה ל-${this.formatDateTime(
        newDate
      )}?`;

      if (confirm(confirmMessage)) {
        await this.extendTaskDeadline(taskId, newDeadline, reason);
        overlay.remove();
      }
    });

    // הצגת הפופ-אפ
    setTimeout(() => {
      overlay.classList.remove("hidden");
    }, 10);
  }

  showError(message) {
    document.body.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: linear-gradient(135deg, #f8f9ff 0%, #e8f4f8 50%, #f0f8ff 100%);">
                <div style="background: white; padding: 40px; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.1); text-align: center; max-width: 400px;">
                    <h2 style="color: #ef4444; margin-bottom: 20px;">שגיאה</h2>
                    <p style="color: #64748b; font-size: 16px;">${message}</p>
                </div>
            </div>
        `;
  }

  showNotification(message, type = "success") {
    try {
      const notification = document.getElementById("notification");
      if (!notification) return;

      notification.textContent = message;
      notification.className = `notification ${type}`;
      notification.classList.add("show");

      setTimeout(() => {
        notification.classList.remove("show");
      }, 4000);

      console.log(`📢 הודעה (${type}):`, message);
    } catch (error) {
      console.error("שגיאה בהצגת הודעה:", error);
    }
  }

  // Helper methods for rendering
  sanitizeTaskData(task) {
    return {
      id: task.id || Date.now(),
      clientName: task.clientName || "לקוח לא ידוע",
      description: task.description || "משימה ללא תיאור",
      estimatedMinutes: Number(task.estimatedMinutes) || 0,
      actualMinutes: Number(task.actualMinutes) || 0,
      deadline: task.deadline || new Date().toISOString(),
      status: task.status || "פעיל",
      branch: task.branch || "",
      fileNumber: task.fileNumber || "",
      history: task.history || [],
    };
  }

  getTaskCardStatus(task) {
    const now = new Date();
    const deadline = new Date(task.deadline);
    const isOverdue = deadline < now;
    const isCompleted = task.status === "הושלם";

    if (isCompleted) {
      return {
        cssClass: "completed",
        badgeClass: "completed",
        icon: "fas fa-check-circle",
        text: "הושלם",
      };
    } else if (isOverdue) {
      return {
        cssClass: "overdue",
        badgeClass: "overdue",
        icon: "fas fa-exclamation-triangle",
        text: "באיחור",
      };
    } else {
      return {
        cssClass: "active",
        badgeClass: "active",
        icon: "fas fa-play-circle",
        text: "פעיל",
      };
    }
  }

  calculateProgress(task) {
    const percentage =
      task.estimatedMinutes > 0
        ? Math.round((task.actualMinutes / task.estimatedMinutes) * 100)
        : 0;

    let statusClass = "normal";
    if (percentage >= 100) {
      statusClass = "completed";
    } else if (percentage > 80) {
      statusClass = "overdue";
    }

    return { percentage, statusClass };
  }

  getTaskMetaData(task) {
    const now = new Date();
    const deadline = new Date(task.deadline);
    const timeUntilDeadline = deadline - now;
    const oneDay = 24 * 60 * 60 * 1000;

    let deadlineData = {
      text: this.formatDateTime(deadline),
      class: "",
    };

    if (timeUntilDeadline < 0) {
      deadlineData.class = "deadline overdue";
      deadlineData.text = `⚠️ ${this.formatDateTime(deadline)}`;
    } else if (timeUntilDeadline < oneDay) {
      deadlineData.class = "deadline soon";
      deadlineData.text = `🚨 ${this.formatDateTime(deadline)}`;
    }

    return { deadline: deadlineData };
  }

  updateSortIndicators() {
    document.querySelectorAll("#budgetTable th").forEach((th) => {
      th.classList.remove("sort-asc", "sort-desc");
    });

    if (this.budgetSortField) {
      const currentTh = document.querySelector(
        `#budgetTable th[data-sort="${this.budgetSortField}"]`
      );
      if (currentTh) {
        currentTh.classList.add(`sort-${this.budgetSortDirection}`);
      }
    }
  }

  getTotalMinutes() {
    return this.filteredBudgetTasks.reduce((total, task) => {
      return total + (Number(task.actualMinutes) || 0);
    }, 0);
  }

  getAverageProgress() {
    if (this.filteredBudgetTasks.length === 0) return 0;

    const totalProgress = this.filteredBudgetTasks.reduce((total, task) => {
      const progress =
        task.estimatedMinutes > 0
          ? (task.actualMinutes / task.estimatedMinutes) * 100
          : 0;
      return total + progress;
    }, 0);

    return Math.round(totalProgress / this.filteredBudgetTasks.length);
  }

  formatDateTime(date) {
    try {
      return new Date(date).toLocaleString("he-IL", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      return "תאריך לא תקין";
    }
  }

  formatDate(dateString) {
    try {
      return new Date(dateString).toLocaleDateString("he-IL");
    } catch (error) {
      return "תאריך לא תקין";
    }
  }

  saveToLocalBackup(data) {
    try {
      if (!this.localBackup) {
        this.localBackup = [];
      }

      const backupEntry = {
        id: Date.now(),
        data: data,
        timestamp: new Date().toISOString(),
        attempts: 1,
        priority: this.getDataPriority(data.action),
      };

      this.localBackup.unshift(backupEntry);

      if (this.localBackup.length > 100) {
        this.localBackup = this.localBackup.slice(0, 100);
      }

      console.log(
        `💾 נתונים נשמרו בגיבוי מקומי (${this.localBackup.length} פעולות ממתינות)`
      );

      this.updateBackupIndicator?.();
    } catch (error) {
      console.error("❌ שגיאה בשמירת גיבוי מקומי:", error);
    }
  }

  getDataPriority(action) {
    const priorities = {
      saveBudgetTaskToSheet: "high",
      saveTimesheetAndUpdateClient: "high",
      addTimeToTask: "medium",
      completeBudgetTask: "medium",
      createClientComplete: "high",
      userLogin: "low",
    };

    return priorities[action] || "medium";
  }

  async waitForConnection() {
    console.log("🔄 ממתין לחזרת חיבור אינטרנט...");

    return new Promise((resolve) => {
      const checkConnection = () => {
        if (navigator.onLine) {
          console.log("🌐 חיבור אינטרנט חזר!");
          this.connectionStatus = "connected";
          this.updateConnectionStatus?.("🟢 מחובר");
          resolve();
        } else {
          setTimeout(checkConnection, 2000);
        }
      };

      checkConnection();
    });
  }

  async retryFailedOperations() {
    if (!this.localBackup || this.localBackup.length === 0) {
      console.log("📤 אין פעולות בגיבוי לשליחה מחדש");
      return;
    }

    console.log(`📤 שולח ${this.localBackup.length} פעולות מהגיבוי...`);

    const sortedBackup = [...this.localBackup].sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    let successCount = 0;
    const failedOperations = [];

    for (const operation of sortedBackup) {
      try {
        console.log(`📤 מנסה לשלוח מחדש: ${operation.data.action}`);

        const success = await this.sendToGoogleSheets(operation.data, 1);

        if (success) {
          successCount++;
          console.log(`✅ פעולה נשלחה מהגיבוי: ${operation.data.action}`);
        } else {
          operation.attempts++;
          if (operation.attempts < 5) {
            failedOperations.push(operation);
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        console.error("❌ נכשל בשליחה מחדש:", error);
        operation.attempts++;
        if (operation.attempts < 5) {
          failedOperations.push(operation);
        }
      }
    }

    this.localBackup = failedOperations;

    if (successCount > 0) {
      this.showNotification?.(
        `✅ ${successCount} פעולות נשלחו מהגיבוי`,
        "success"
      );
    }

    if (failedOperations.length > 0) {
      console.warn(`⚠️ ${failedOperations.length} פעולות עדיין בגיבוי`);
    }

    this.updateBackupIndicator?.();
  }
}

// Additional Classes for Advanced Features
class OfflineRecoveryManager {
  constructor() {
    this.failedOperations = [];
    this.maxRetries = 5;
    this.isRecovering = false;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // זיהוי חזרת חיבור
    window.addEventListener("online", () => {
      this.startRecovery();
    });

    // זיהוי איבוד חיבור
    window.addEventListener("offline", () => {
      this.showOfflineWarning();
    });
  }

  addFailedOperation(operation) {
    if (this.failedOperations.length > 50) {
      this.failedOperations.shift(); // הסר הישן ביותר
    }

    this.failedOperations.push({
      ...operation,
      failedAt: Date.now(),
      retryCount: 0,
    });

    console.warn(`💾 פעולה נשמרה לשחזור: ${operation.action}`);
  }

  async startRecovery() {
    if (this.isRecovering || this.failedOperations.length === 0) return;

    this.isRecovering = true;
    console.log(`🔄 מתחיל שחזור ${this.failedOperations.length} פעולות...`);

    const recoveryId = `recovery_${Date.now()}`;
    window.smartLoading.startOperation(
      recoveryId,
      this.failedOperations.length * 2000
    );

    let successCount = 0;
    const failedAgain = [];

    for (const operation of this.failedOperations) {
      try {
        const success = await this.retryOperation(operation);
        if (success) {
          successCount++;
        } else if (operation.retryCount < this.maxRetries) {
          operation.retryCount++;
          failedAgain.push(operation);
        }
      } catch (error) {
        console.error("❌ שגיאה בשחזור:", error);
        if (operation.retryCount < this.maxRetries) {
          operation.retryCount++;
          failedAgain.push(operation);
        }
      }

      // חכה בין פעולות
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    this.failedOperations = failedAgain;
    window.smartLoading.finishOperation(recoveryId);

    if (successCount > 0) {
      window.manager?.showNotification(
        `✅ שוחזרו ${successCount} פעולות בהצלחה`,
        "success"
      );
    }

    this.isRecovering = false;
  }

  async retryOperation(operation) {
    try {
      return await window.manager?.sendToGoogleSheets(operation.data);
    } catch (error) {
      return false;
    }
  }

  showOfflineWarning() {
    if (window.manager) {
      window.manager.showNotification(
        "⚠️ אין חיבור לאינטרנט - הפעולות יישמרו לשחזור מאוחר יותר",
        "warning"
      );
    }
  }
}

class SmartCacheManager {
  constructor() {
    this.cache = new Map();
    this.cacheTimestamps = new Map();
    this.cacheDuration = {
      clients: 5 * 60 * 1000, // 5 דקות
      budgetTasks: 2 * 60 * 1000, // 2 דקות
      timesheetEntries: 1 * 60 * 1000, // 1 דקה
    };
  }

  set(key, data, customDuration = null) {
    this.cache.set(key, data);
    this.cacheTimestamps.set(key, Date.now());

    // מחק אוטומטית אחרי זמן מוגדר
    const duration = customDuration || this.cacheDuration[key] || 60000;
    setTimeout(() => {
      this.invalidate(key);
    }, duration);
  }

  get(key) {
    if (!this.cache.has(key)) return null;

    const timestamp = this.cacheTimestamps.get(key);
    const duration = this.cacheDuration[key] || 60000;

    if (Date.now() - timestamp > duration) {
      this.invalidate(key);
      return null;
    }

    return this.cache.get(key);
  }

  invalidate(key) {
    this.cache.delete(key);
    this.cacheTimestamps.delete(key);
  }

  invalidateAll() {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }
}

class DataPagination {
  constructor(pageSize = 20) {
    this.pageSize = pageSize;
    this.currentPage = 1;
  }

  paginate(data, page = 1) {
    const startIndex = (page - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;

    return {
      data: data.slice(startIndex, endIndex),
      currentPage: page,
      totalPages: Math.ceil(data.length / this.pageSize),
      totalItems: data.length,
      hasNext: endIndex < data.length,
      hasPrev: page > 1,
    };
  }

  renderPaginationControls(containerId, result, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container || result.totalPages <= 1) return;

    container.innerHTML = `
            <div class="pagination-controls">
                <button ${!result.hasPrev ? "disabled" : ""} 
                        onclick="${onPageChange}(${result.currentPage - 1})">
                    « הקודם
                </button>
                <span>עמוד ${result.currentPage} מתוך ${
      result.totalPages
    }</span>
                <button ${!result.hasNext ? "disabled" : ""} 
                        onclick="${onPageChange}(${result.currentPage + 1})">
                    הבא »
                </button>
            </div>
        `;
  }
}

class SystemMonitor {
  constructor() {
    this.metrics = {
      operationsCount: 0,
      errorsCount: 0,
      averageResponseTime: 0,
      lastError: null,
    };
    this.startTime = Date.now();
  }

  recordOperation(duration, success = true) {
    this.metrics.operationsCount++;

    if (!success) {
      this.metrics.errorsCount++;
    }

    // חישוב ממוצע זמן תגובה
    this.metrics.averageResponseTime =
      (this.metrics.averageResponseTime * (this.metrics.operationsCount - 1) +
        duration) /
      this.metrics.operationsCount;
  }

  recordError(error) {
    this.metrics.lastError = {
      message: error.toString(),
      timestamp: new Date().toISOString(),
    };
    this.metrics.errorsCount++;
  }

  getSystemHealth() {
    const uptime = Date.now() - this.startTime;
    const errorRate =
      this.metrics.errorsCount / Math.max(1, this.metrics.operationsCount);

    return {
      uptime: Math.floor(uptime / 1000),
      operationsCount: this.metrics.operationsCount,
      errorRate: (errorRate * 100).toFixed(2),
      averageResponseTime: Math.round(this.metrics.averageResponseTime),
      status: errorRate < 0.1 ? "healthy" : "degraded",
    };
  }
}

/* === GLOBAL INSTANCES === */

// יצירת instance גלובלי
window.smartLoading = new SmartLoadingManager();

const loadingManager = new LoadingManager();
const dataCache = new DataCache();
const dataManager = new DataManager();
const notificationBell = new NotificationBellSystem();
const manager = new LawOfficeManager();
window.manager = manager;

// הוסף למערכת
window.recoveryManager = new OfflineRecoveryManager();

// החלף את הcache הקיים
window.smartCache = new SmartCacheManager();

window.systemMonitor = new SystemMonitor();

/* === GOOGLE APPS SCRIPT CALLS === */

// LawOfficeManager Methods for Google Sheets Integration
LawOfficeManager.prototype.createClientComplete = async function (client) {
  const data = {
    action: "createClientComplete",
    employee: this.currentUser,
    client: client,
  };

  await this.sendToGoogleSheets(data);
  console.log(`✅ נוצר לקוח מלא: ${client.fullName} עם טבלה אוטומטית`);

  await this.loadClientsFromSheetOriginal();
};

LawOfficeManager.prototype.saveBudgetTaskToSheet = async function (task) {
  const data = {
    action: "saveBudgetTaskToSheet",
    employee: this.currentUser,
    task: task,
  };

  await this.sendToGoogleSheets(data);
};

LawOfficeManager.prototype.saveTimesheetAndUpdateClient = async function (
  entry
) {
  const data = {
    action: "saveTimesheetAndUpdateClient",
    employee: this.currentUser,
    entry: entry,
  };

  await this.sendToGoogleSheets(data);
};

LawOfficeManager.prototype.sendToGoogleSheets = async function (
  data,
  maxRetries = 3
) {
  showSimpleLoading("שומר נתונים..."); // ← הוסף בהתחלה
  console.log(`🚀 שולח דרך DataManager: ${data.action}`);

  try {
    const result = await this.dataManager.saveData(
      data.action,
      data,
      maxRetries
    );

    if (result.success) {
      this.showNotification?.("נתונים נשמרו בהצלחה", "success");
      console.log("✅ שמירה בוצעה דרך DataManager");
      return true;
    } else {
      this.showNotification?.(`שגיאה בשמירה: ${result.error}`, "error");
      console.error("❌ שמירה נכשלה דרך DataManager:", result.error);
      return false;
    }
  } catch (error) {
    console.error("❌ שגיאה כללית ב-sendToGoogleSheets:", error);
    this.showNotification?.("שגיאה טכנית בשמירה", "error");
    return false;
  } finally {
    setTimeout(() => {
      hideSimpleLoading();
    });
  }
};

/* === UTILITIES === */

// פונקציות Loading פשוטות
function showSimpleLoading(message = "מעבד...") {
  const existing = document.getElementById("simple-loading");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "simple-loading";
  overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

  overlay.innerHTML = `
        <div style="text-align: center; background: white; color: #333; padding: 30px; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
            <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; animation: spin 1.5s linear infinite; margin: 0 auto 20px;"></div>
            <div style="font-size: 16px; font-weight: 500;">${message}</div>
        </div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;

  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";
}

function hideSimpleLoading() {
  const overlay = document.getElementById("simple-loading");
  if (overlay) {
    overlay.remove();
    document.body.style.overflow = "";
  }
}

window.showSimpleLoading = showSimpleLoading;
window.hideSimpleLoading = hideSimpleLoading;

function formatDateTime(date) {
  try {
    return new Date(date).toLocaleString("he-IL", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (error) {
    return "תאריך לא תקין";
  }
}

function formatDate(dateString) {
  try {
    return new Date(dateString).toLocaleDateString("he-IL");
  } catch (error) {
    return "תאריך לא תקין";
  }
}

function updateUserDisplay(userName) {
  const userDisplay = document.getElementById("currentUserDisplay");
  if (userDisplay && userName) {
    userDisplay.textContent = `${userName} - משרד עו"ד גיא הרשקוביץ`;
  }
}

function updatePlusTooltip() {
  try {
    const tooltip = document.getElementById("plusTooltip");

    if (!tooltip) {
      console.warn("⚠️ אלמנט plusTooltip לא נמצא");
      return;
    }

    const budgetTab = document.querySelector('[onclick*="budget"]');
    const timesheetTab = document.querySelector('[onclick*="timesheet"]');

    let tooltipText = "הוספת פריט חדש";

    if (budgetTab && budgetTab.classList.contains("active")) {
      tooltipText = "הוספת משימה חדשה";
    } else if (timesheetTab && timesheetTab.classList.contains("active")) {
      tooltipText = "הוספת רשומת שעתון";
    }

    tooltip.textContent = tooltipText;
    console.log("✅ Tooltip עודכן:", tooltipText);
  } catch (error) {
    console.error("❌ שגיאה ב-updatePlusTooltip:", error);
  }
}

function setActiveNavItem(itemName) {
  console.log("🎯 מעדכן פריט פעיל:", itemName);

  try {
    document.querySelectorAll(".nav-item").forEach((item) => {
      if (item && item.classList) {
        item.classList.remove("active");
      }
    });

    let activeItem = null;

    if (itemName === "תקצוב") {
      activeItem =
        document.querySelector('[onclick*="budget"]') ||
        document.querySelector('[onclick*="תקצוב"]');
    } else if (itemName === "שעתון") {
      activeItem =
        document.querySelector('[onclick*="timesheet"]') ||
        document.querySelector('[onclick*="שעתון"]');
    }

    if (activeItem && activeItem.classList) {
      activeItem.classList.add("active");
      console.log("✅ פריט הודגש בהצלחה:", itemName);
    } else {
      console.warn("⚠️ לא נמצא פריט להדגשה:", itemName);
    }
  } catch (error) {
    console.error("❌ שגיאה ב-setActiveNavItem:", error);
  }
}

function updateSidebarUser(userName) {
  console.log("👤 מעדכן משתמש בסרגל:", userName);

  const userAvatar = document.querySelector(".user-avatar");
  if (!userAvatar) {
    console.log("⚠️ לא נמצא avatar במערכת");
    return;
  }

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

    console.log(`✅ משתמש עודכן: ${userName}, צבע: ${colorIndex}`);
  }
}

// Connection Status Functions
function updateConnectionIndicator(status, message) {
  try {
    let indicator = document.getElementById("connectionIndicator");
    let text = document.getElementById("connectionText");

    if (!indicator) {
      console.log("🔧 יוצר אינדיקטור חיבור חדש");
      createConnectionIndicator();
      indicator = document.getElementById("connectionIndicator");
      text = document.getElementById("connectionText");
    }

    if (!indicator || !text) {
      console.warn("⚠️ לא הצלחתי ליצור אינדיקטור חיבור");
      return;
    }

    const dot = indicator.querySelector(".connection-dot");

    if (text) {
      text.textContent = message;
    }

    if (indicator.style) {
      indicator.style.borderColor = getStatusColor(status, 0.2);
      indicator.style.color = getStatusColor(status, 1);
    }

    if (dot && dot.style) {
      dot.style.background = getStatusColor(status, 1);
    }

    if (indicator.style) {
      indicator.style.transform = "scale(1.05)";
      setTimeout(() => {
        if (indicator.style) {
          indicator.style.transform = "scale(1)";
        }
      }, 200);
    }
  } catch (error) {
    console.error("❌ שגיאה ב-updateConnectionIndicator:", error);
  }
}

function createConnectionIndicator() {
  if (document.getElementById("connectionIndicator")) {
    return;
  }

  console.log("🆕 יוצר אינדיקטור חיבור חדש");

  const indicator = document.createElement("div");
  indicator.id = "connectionIndicator";
  indicator.className = "connection-indicator";
  indicator.innerHTML = `
        <div class="connection-dot"></div>
        <span id="connectionText">מאתחל...</span>
    `;

  indicator.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        background: white;
        padding: 8px 12px;
        border-radius: 20px;
        border: 2px solid #e5e7eb;
        font-size: 12px;
        font-weight: 600;
        color: #6b7280;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.3s ease;
    `;

  document.body.appendChild(indicator);

  const dot = indicator.querySelector(".connection-dot");
  if (dot) {
    dot.style.cssText = `
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #f59e0b;
        `;
  }
}

function getStatusColor(status, opacity) {
  const colors = {
    connected: `rgba(16, 185, 129, ${opacity})`,
    disconnected: `rgba(239, 68, 68, ${opacity})`,
    connecting: `rgba(245, 158, 11, ${opacity})`,
    error: `rgba(239, 68, 68, ${opacity})`,
  };
  return colors[status] || colors.connecting;
}

function updateConnectionStatus(status) {
  console.log("📡 עדכון סטטוס חיבור:", status);

  const possibleElements = [
    document.getElementById("connectionIndicator"),
    document.getElementById("connectionStatus"),
    document.querySelector(".connection-status"),
    document.querySelector(".connection-indicator"),
    document.querySelector('[class*="connection"]'),
  ];

  let found = false;
  possibleElements.forEach((element) => {
    if (element) {
      element.textContent = status;
      found = true;
      console.log("✅ עדכן אלמנט חיבור:", element.className || element.id);
    }
  });

  if (!found) {
    console.log("⚠️ לא נמצא אלמנט חיבור - יוצר חדש");
    createConnectionIndicator();
    updateConnectionIndicator("connecting", status);
  }
}

// Animation Functions
function handleResize() {
  const container = document.getElementById("appContainer");
  const sidebar = document.getElementById("minimalSidebar");

  if (window.innerWidth > 600 && sidebar) {
    sidebar.classList.remove("open");
    if (window.innerWidth > 1200 && container) {
      container.classList.add("sidebar-expanded");
    }
  }
}

function initializeSidebarAnimations() {
  console.log("🎨 מאתחל אנימציות סרגל");

  setTimeout(() => {
    const navItems = document.querySelectorAll(".nav-item");
    const sidebar = document.querySelector(".minimal-sidebar");

    if (!sidebar) {
      console.log("⚠️ סרגל לא נמצא - מדלג על אנימציות");
      return;
    }

    sidebar.style.transform = "translateX(100%)";
    sidebar.style.opacity = "0";

    setTimeout(() => {
      sidebar.style.transition = "all 0.6s cubic-bezier(0.4, 0, 0.2, 1)";
      sidebar.style.transform = "translateX(0)";
      sidebar.style.opacity = "1";
    }, 100);

    navItems.forEach((item, index) => {
      item.style.opacity = "0";
      item.style.transform = "translateX(20px)";

      setTimeout(() => {
        item.style.transition = "all 0.4s ease";
        item.style.opacity = "1";
        item.style.transform = "translateX(0)";
      }, 200 + index * 100);
    });

    console.log("✅ אנימציות הופעלו");
  }, 500);
}

function setupAdvancedHoverEffects() {
  console.log("✨ מגדיר אפקטי hover מתקדמים");

  const navItems = document.querySelectorAll(".nav-item");
  const sidebar = document.querySelector(".minimal-sidebar");

  if (!navItems.length || !sidebar) {
    console.log("⚠️ לא נמצאו אלמנטים לhover");
    return;
  }

  navItems.forEach((item, index) => {
    item.addEventListener("mouseenter", function (e) {
      const ripple = document.createElement("div");
      ripple.style.cssText = `
                position: absolute;
                background: rgba(59, 130, 246, 0.2);
                border-radius: 50%;
                width: 0;
                height: 0;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                pointer-events: none;
                animation: ripple 0.6s ease-out;
            `;

      this.style.position = "relative";
      this.appendChild(ripple);

      setTimeout(() => {
        if (ripple && ripple.parentNode) {
          ripple.parentNode.removeChild(ripple);
        }
      }, 600);

      this.style.transform = "translateX(-3px) scale(1.02)";
      this.style.zIndex = "10";
    });

    item.addEventListener("mouseleave", function () {
      this.style.transform = "";
      this.style.zIndex = "";
    });

    item.addEventListener("mousedown", function () {
      this.style.transform = "translateX(-2px) scale(0.98)";
    });

    item.addEventListener("mouseup", function () {
      this.style.transform = "translateX(-3px) scale(1.02)";
    });
  });

  if (!document.getElementById("ripple-animation")) {
    const style = document.createElement("style");
    style.id = "ripple-animation";
    style.textContent = `
            @keyframes ripple {
                from {
                    width: 0;
                    height: 0;
                    opacity: 1;
                }
                to {
                    width: 200px;
                    height: 200px;
                    opacity: 0;
                }
            }
        `;
    document.head.appendChild(style);
  }

  console.log("✅ אפקטי hover הוגדרו");
}

function initializeNewSidebar() {
  console.log("🚀 מאתחל סרגל מינימליסטי חדש...");

  window.addEventListener("resize", handleResize);
  window.addEventListener("load", handleResize);

  document.querySelectorAll(".nav-item").forEach((item) => {
    if (!item.onclick && !item.getAttribute("onclick")) {
      item.addEventListener("click", function () {
        document
          .querySelectorAll(".nav-item")
          .forEach((i) => i.classList.remove("active"));
        this.classList.add("active");
      });
    }
  });

  document.addEventListener("click", function (e) {
    if (!e.target.closest(".modern-client-search")) {
      document.querySelectorAll(".search-results").forEach((results) => {
        results.classList.remove("show");
      });
    }

    if (
      !e.target.closest(".notification-bell") &&
      !e.target.closest(".notifications-dropdown")
    ) {
      const dropdown = document.getElementById("notificationsDropdown");
      if (dropdown) {
        dropdown.classList.remove("show");
      }
    }

    if (
      window.innerWidth <= 600 &&
      !e.target.closest(".minimal-sidebar") &&
      !e.target.closest(".btn")
    ) {
      const sidebar = document.getElementById("minimalSidebar");
      if (sidebar && sidebar.classList.contains("open")) {
        sidebar.classList.remove("open");
      }
    }
  });

  console.log("✅ סרגל חדש מוכן!");
}

function enhanceFormExperience() {
  const timesheetDate = document.getElementById("timesheetDate");
  if (timesheetDate && !timesheetDate.value) {
    timesheetDate.value = new Date().toISOString().split("T")[0];
  }

  document.querySelectorAll("form").forEach((form) => {
    form.addEventListener("submit", function (e) {
      const requiredFields = form.querySelectorAll("[required]");
      let isValid = true;

      requiredFields.forEach((field) => {
        if (!field.value.trim()) {
          field.style.borderColor = "#ef4444";
          isValid = false;
        } else {
          field.style.borderColor = "#e5e7eb";
        }
      });

      if (!isValid) {
        e.preventDefault();
        console.warn("⚠️ אנא מלא את כל השדות הנדרשים");
      }
    });
  });

  document.querySelectorAll("input, textarea, select").forEach((input) => {
    input.addEventListener("focus", function () {
      this.style.transform = "translateY(-1px)";
    });

    input.addEventListener("blur", function () {
      this.style.transform = "translateY(0)";
    });
  });
}

function debugNewSystem() {
  console.log("🔍 בדיקת מערכת חדשה:");
  console.log("📱 גודל מסך:", window.innerWidth, "x", window.innerHeight);

  const elements = {
    appContainer: !!document.getElementById("appContainer"),
    sidebar: !!document.getElementById("minimalSidebar"),
    navItems: document.querySelectorAll(".nav-item").length,
    searchInputs: document.querySelectorAll(".search-input").length,
  };

  console.log("📊 אלמנטים:", elements);

  if (elements.appContainer && elements.sidebar && elements.navItems >= 4) {
    console.log("✅ המערכת החדשה עובדת תקין!");
    return true;
  } else {
    console.log("❌ יש בעיה במערכת החדשה");
    return false;
  }
}

function checkSidebarIntegrity() {
  console.log("🔍 בודק תקינות הסרגל החדש...");

  const sidebar = document.querySelector(".minimal-sidebar");
  const navItems = document.querySelectorAll(".nav-item");
  const userAvatar = document.querySelector(".user-avatar");

  const results = {
    sidebar: !!sidebar,
    navItems: navItems.length,
    userAvatar: !!userAvatar,
    isVisible: sidebar ? getComputedStyle(sidebar).display !== "none" : false,
  };

  console.log("📊 תוצאות בדיקה:", results);

  if (
    results.sidebar &&
    results.navItems >= 4 &&
    results.userAvatar &&
    results.isVisible
  ) {
    console.log("✅ הסרגל החדש עובד תקין!");
    return true;
  } else {
    console.log("❌ יש בעיה עם הסרגל החדש");
    console.log("🔧 בדוק שהקוד הועתק נכון לכל הקבצים");
    return false;
  }
}

function safeInitNavigation() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", safeInitNavigation);
    return;
  }

  setTimeout(() => {
    if (document.querySelector(".nav-item")) {
      setActiveNavItem("תקצוב");
      console.log("✅ ניווט אותחל בבטחה");
    } else {
      console.warn("⚠️ אלמנטי ניווט עדיין לא נטענו");
      setTimeout(() => safeInitNavigation(), 1000);
    }
  }, 300);
}

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

/* === UI FUNCTIONS === */

// Feedback Functions
function sendFeedback() {
  showFeedbackDialog();
}

function showFeedbackDialog() {
  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";

  overlay.innerHTML = `
        <div class="popup" style="max-width: 450px;">
            <div class="popup-header">
                <i class="fas fa-comments"></i>
                שתף את המשוב שלך
                <button type="button" onclick="this.closest('.popup-overlay').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="popup-content">
                <form id="feedbackForm">
                    <!-- שלב 1: בחירת קטגוריה -->
                    <div class="popup-section" id="categorySection">
                        <label>איזה חלק במערכת?</label>
                        <div class="feedback-categories">
                            <div class="category-option">
                                <input type="radio" id="cat-tasks" name="feedbackCategory" value="תקצוב משימות" class="category-radio">
                                <label for="cat-tasks" class="category-label">
                                    <i class="fas fa-tasks"></i> תקצוב משימות
                                </label>
                            </div>
                            <div class="category-option">
                                <input type="radio" id="cat-timesheet" name="feedbackCategory" value="שעתון" class="category-radio">
                                <label for="cat-timesheet" class="category-label">
                                    <i class="fas fa-clock"></i> שעתון
                                </label>
                            </div>
                            <div class="category-option">
                                <input type="radio" id="cat-clients" name="feedbackCategory" value="ניהול לקוחות" class="category-radio">
                                <label for="cat-clients" class="category-label">
                                    <i class="fas fa-users"></i> ניהול לקוחות
                                </label>
                            </div>
                            <div class="category-option">
                                <input type="radio" id="cat-interface" name="feedbackCategory" value="עיצוב וממשק" class="category-radio">
                                <label for="cat-interface" class="category-label">
                                    <i class="fas fa-palette"></i> עיצוב וממשק
                                </label>
                            </div>
                            <div class="category-option">
                                <input type="radio" id="cat-performance" name="feedbackCategory" value="ביצועים ומהירות" class="category-radio">
                                <label for="cat-performance" class="category-label">
                                    <i class="fas fa-tachometer-alt"></i> ביצועים ומהירות
                                </label>
                            </div>
                            <div class="category-option">
                                <input type="radio" id="cat-other" name="feedbackCategory" value="אחר" class="category-radio">
                                <label for="cat-other" class="category-label">
                                    <i class="fas fa-ellipsis-h"></i> אחר
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <!-- שלב 2: רמת דחיפות (מוסתר בהתחלה) -->
                    <div class="popup-section hidden" id="prioritySection">
                        <label>כמה דחוף זה?</label>
                        <div class="priority-options">
                            <div class="priority-option">
                                <input type="radio" id="priority-low" name="feedbackPriority" value="נמוך" class="priority-radio">
                                <label for="priority-low" class="priority-label">
                                    <i class="fas fa-arrow-down"></i> לא דחוף
                                </label>
                            </div>
                            <div class="priority-option">
                                <input type="radio" id="priority-medium" name="feedbackPriority" value="בינוני" class="priority-radio">
                                <label for="priority-medium" class="priority-label">
                                    <i class="fas fa-minus"></i> בינוני
                                </label>
                            </div>
                            <div class="priority-option">
                                <input type="radio" id="priority-high" name="feedbackPriority" value="גבוה" class="priority-radio">
                                <label for="priority-high" class="priority-label">
                                    <i class="fas fa-arrow-up"></i> דחוף
                                </label>
                            </div>
                            <div class="priority-option">
                                <input type="radio" id="priority-critical" name="feedbackPriority" value="קריטי" class="priority-radio">
                                <label for="priority-critical" class="priority-label">
                                    <i class="fas fa-exclamation-triangle"></i> קריטי
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <!-- שלב 3: המשוב עצמו (מוסתר בהתחלה) -->
                    <div class="popup-section hidden" id="textSection">
                        <label for="feedbackText">המשוב שלך:</label>
                        <textarea id="feedbackText" rows="4" placeholder="כתוב כאן את המשוב, ההצעות לשיפור או הבעיות שנתקלת בהן..." required></textarea>
                    </div>
                    
                    <!-- שלב 4: אופן התקשרות (מוסתר בהתחלה) -->
                    <div class="popup-section hidden" id="contactSection">
                        <label>איך תעדיף לקבל תגובה?</label>
                        <div class="contact-methods">
                            <div class="contact-option">
                                <input type="radio" id="contact-email" name="contactMethod" value="email" class="contact-radio" checked>
                                <label for="contact-email" class="contact-label">
                                    <i class="fas fa-envelope"></i> אימייל
                                </label>
                            </div>
                            <div class="contact-option">
                                <input type="radio" id="contact-whatsapp" name="contactMethod" value="whatsapp" class="contact-radio">
                                <label for="contact-whatsapp" class="contact-label">
                                    <i class="fab fa-whatsapp"></i> WhatsApp
                                </label>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
            
            <div class="popup-buttons">
                <button type="button" class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()">
                    <i class="fas fa-times"></i> ביטול
                </button>
                <button type="submit" class="popup-btn popup-btn-confirm hidden" id="submitBtn" onclick="document.getElementById('feedbackForm').dispatchEvent(new Event('submit'))">
                    <i class="fas fa-paper-plane"></i> שלח משוב
                </button>
            </div>
        </div>
    `;

  document.body.appendChild(overlay);

  // הפעלת Logic של השלבים
  setupFeedbackSteps();

  // הפעלת פונקציונליות הטופס
  const form = overlay.querySelector("#feedbackForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await handleFeedbackSubmission(form);
    overlay.remove();
  });

  // הצגת הפופ-אפ
  setTimeout(() => {
    overlay.classList.remove("hidden");
  }, 10);
}

function setupFeedbackSteps() {
  const categoryRadios = document.querySelectorAll(
    'input[name="feedbackCategory"]'
  );
  const priorityRadios = document.querySelectorAll(
    'input[name="feedbackPriority"]'
  );
  const textArea = document.getElementById("feedbackText");
  const contactRadios = document.querySelectorAll(
    'input[name="contactMethod"]'
  );

  const prioritySection = document.getElementById("prioritySection");
  const textSection = document.getElementById("textSection");
  const contactSection = document.getElementById("contactSection");
  const submitBtn = document.getElementById("submitBtn");

  // כשבוחרים קטגוריה - הראה דחיפות
  categoryRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      prioritySection.classList.remove("hidden");
    });
  });

  // כשבוחרים דחיפות - הראה טקסט
  priorityRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      textSection.classList.remove("hidden");
    });
  });

  // כשמקלידים טקסט - הראה אופן התקשרות
  textArea.addEventListener("input", () => {
    if (textArea.value.trim().length > 10) {
      contactSection.classList.remove("hidden");
    }
  });

  // כשבוחרים אופן התקשרות - הראה כפתור שלח
  contactRadios.forEach((radio) => {
    radio.addEventListener("change", () => {
      submitBtn.classList.remove("hidden");
    });
  });
}

async function handleFeedbackSubmission(form) {
  const formData = new FormData(form);
  const feedbackData = {
    category: formData.get("feedbackCategory"),
    priority: formData.get("feedbackPriority"),
    text: formData.get("feedbackText"),
    contactMethod: formData.get("contactMethod"),
    user: window.manager?.currentUser || "לא מזוהה",
    timestamp: new Date().toLocaleString("he-IL"),
    browser: navigator.userAgent.split(" ").slice(-2).join(" "),
    resolution: `${screen.width}x${screen.height}`,
  };

  const priorityEmojis = {
    נמוך: "🟢",
    בינוני: "🟡",
    גבוה: "🟠",
    קריטי: "🔴",
  };

  const categoryEmojis = {
    "תקצוב משימות": "📊",
    שעתון: "⏰",
    "ניהול לקוחות": "👥",
    "עיצוב וממשק": "🎨",
    "ביצועים ומהירות": "⚡",
    אחר: "💬",
  };

  const messageText = `
${priorityEmojis[feedbackData.priority]} *משוב מערכת ניהול* ${
    priorityEmojis[feedbackData.priority]
  }

${categoryEmojis[feedbackData.category]} *קטגוריה:* ${feedbackData.category}
🚨 *דחיפות:* ${feedbackData.priority}

💬 *המשוב:*
${feedbackData.text}

👤 *פרטי משתמש:*
• שם: ${feedbackData.user}
• תאריך: ${feedbackData.timestamp}
• דפדפן: ${feedbackData.browser}
• רזולוציה: ${feedbackData.resolution}

---
מערכת ניהול מתקדמת - משרד עו״ד גיא הרשקוביץ
    `.trim();

  try {
    if (feedbackData.contactMethod === "whatsapp") {
      const whatsappUrl = `https://wa.me/972549539238?text=${encodeURIComponent(
        messageText
      )}`;
      window.open(whatsappUrl, "_blank");

      if (window.manager) {
        window.manager.showNotification(
          "פותח WhatsApp לשליחת המשוב...",
          "success"
        );
      }
    } else {
      const subject = `משוב מערכת - ${feedbackData.category} (${feedbackData.priority})`;
      const emailBody = messageText.replace(/\*/g, "");

      const mailtoLink = `mailto:Haim@ghlawoffice.co.il?subject=${encodeURIComponent(
        subject
      )}&body=${encodeURIComponent(emailBody)}`;

      window.location.href = mailtoLink;

      if (window.manager) {
        window.manager.showNotification(
          "פותח אימייל לשליחת המשוב...",
          "success"
        );
      }
    }
  } catch (error) {
    console.error("שגיאה בשליחת משוב:", error);

    if (navigator.clipboard) {
      navigator.clipboard.writeText(messageText).then(() => {
        alert("המשוב הועתק ללוח! אנא שלח אותו ידנית.");
      });
    } else {
      alert(`אנא העתק ושלח ידנית:\n\n${messageText}`);
    }
  }
}

// Logout Functions
function logout() {
  showLogoutDialog();
}

function showLogoutDialog() {
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
                <p style="color: #6b7280; font-size: 16px; line-height: 1.5;">
                    כל הנתונים שלא נשמרו יאבדו.<br>
                    תצטרך להתחבר שוב כדי לגשת למערכת.
                </p>
            </div>
            
            <div class="popup-buttons">
                <button class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()" style="background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);">
                    <i class="fas fa-times"></i>
                    ביטול
                </button>
                <button class="popup-btn popup-btn-confirm" onclick="confirmLogout()" style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);">
                    <i class="fas fa-check"></i>
                    כן, צא מהמערכת
                </button>
            </div>
        </div>
    `;

  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.style.opacity = "1";
  }, 10);
}

function confirmLogout() {
  const interfaceElements = document.getElementById("interfaceElements");
  if (interfaceElements) interfaceElements.classList.add("hidden");

  if (window.manager) {
    window.manager.showNotification("מתנתק מהמערכת... להתראות! 👋", "info");
  }

  setTimeout(() => {
    location.reload();
  }, 1500);
}

// Client Form Functions
function showClientForm() {
  showPasswordDialog();
}

function showClientFormWithSidebar() {
  showPasswordDialog();
}

function showPasswordDialog(shouldCloseSidebar = false) {
  const overlay = document.createElement("div");
  overlay.className = "popup-overlay";

  overlay.innerHTML = `
        <div class="popup" style="max-width: 450px;">
            <div class="popup-header" style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
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
                <p style="color: #6b7280; font-size: 16px; line-height: 1.5; margin-bottom: 25px;">
                    מטעמי אבטחה, נדרשת סיסמה מיוחדת<br>
                    ליצירת לקוחות חדשים במערכת
                </p>
                
                <form id="passwordCheckForm" style="text-align: center;">
                    <div style="position: relative; margin-bottom: 20px;">
                        <input type="password" 
                               id="adminPassword" 
                               placeholder="הכנס סיסמת מנהל" 
                               style="width: 100%; padding: 15px 50px 15px 20px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 16px; text-align: center; letter-spacing: 2px; font-weight: bold; transition: all 0.3s ease;"
                               required>
                        <i class="fas fa-key" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #9ca3af; font-size: 18px;"></i>
                    </div>
                    
                    <div id="passwordError" class="error-message hidden" style="margin-bottom: 15px; color: #dc2626; font-weight: 600;">
                        <i class="fas fa-exclamation-triangle"></i>
                        סיסמה שגויה - נסה שוב
                    </div>
                    
                    <div class="popup-buttons" style="margin-top: 20px;">
                        <button type="button" class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()" style="background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);">
                            <i class="fas fa-times"></i>
                            ביטול
                        </button>
                        <button type="submit" class="popup-btn popup-btn-confirm" style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);">
                            <i class="fas fa-unlock"></i>
                            אמת סיסמה
                        </button>
                    </div>
                </form>
            </div>
            
            <div style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border-radius: 12px; padding: 15px; margin-top: 20px; border: 1px solid #fecaca;">
                <div style="display: flex; align-items: center; gap: 10px; color: #991b1b; font-size: 14px;">
                    <i class="fas fa-info-circle"></i>
                    <span><strong>הערה:</strong> פנה למנהל המערכת לקבלת הסיסמה</span>
                </div>
            </div>
        </div>
    `;

  document.body.appendChild(overlay);

  setTimeout(() => {
    const adminPassword = document.getElementById("adminPassword");
    if (adminPassword) adminPassword.focus();
  }, 100);

  const passwordInput = document.getElementById("adminPassword");
  if (passwordInput) {
    passwordInput.addEventListener("focus", () => {
      passwordInput.style.borderColor = "#dc2626";
      passwordInput.style.boxShadow = "0 0 0 3px rgba(220, 38, 38, 0.1)";
    });

    passwordInput.addEventListener("blur", () => {
      passwordInput.style.borderColor = "#e5e7eb";
      passwordInput.style.boxShadow = "none";
    });
  }

  const form = overlay.querySelector("#passwordCheckForm");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      checkAdminPassword(overlay, shouldCloseSidebar);
    });
  }

  if (passwordInput) {
    passwordInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        checkAdminPassword(overlay, shouldCloseSidebar);
      }
    });
  }
}

function checkAdminPassword(overlay, shouldCloseSidebar = false) {
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

    setTimeout(() => {
      openClientForm();
    }, 500);
  } else {
    errorDiv.classList.remove("hidden");

    adminPassword.style.animation = "shake 0.5s ease-in-out";
    adminPassword.style.borderColor = "#dc2626";
    adminPassword.value = "";
    adminPassword.focus();

    setTimeout(() => {
      adminPassword.style.animation = "";
      errorDiv.classList.add("hidden");
      adminPassword.style.borderColor = "#e5e7eb";
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

// Tab Functions
function switchTab(tabName) {
  console.log("🔄 מחליף טאב:", tabName);

  const budgetFormContainer = document.getElementById("budgetFormContainer");
  const timesheetFormContainer = document.getElementById(
    "timesheetFormContainer"
  );

  if (budgetFormContainer) budgetFormContainer.classList.add("hidden");
  if (timesheetFormContainer) timesheetFormContainer.classList.add("hidden");
  // הסרת מצב active מכפתור הפלוס כשעוברים בין טאבים
  const plusButton = document.getElementById("smartPlusBtn");
  if (plusButton) {
    plusButton.classList.remove("active");
  }
  document.querySelectorAll(".tab-button").forEach((btn) => {
    btn.classList.remove("active");
  });

  if (event && event.target) {
    event.target.classList.add("active");
  }

  document.querySelectorAll(".tab-content").forEach((content) => {
    content.classList.remove("active");
  });

  if (tabName === "budget") {
    const budgetTab = document.getElementById("budgetTab");
    if (budgetTab) budgetTab.classList.add("active");
    setActiveNavItem("תקצוב");
    console.log("✅ עבר לטאב תקצוב");
  } else if (tabName === "timesheet") {
    const timesheetTab = document.getElementById("timesheetTab");
    if (timesheetTab) timesheetTab.classList.add("active");
    setActiveNavItem("שעתון");

    const today = new Date().toISOString().split("T")[0];
    const dateField = document.getElementById("actionDate");
    if (dateField) {
      dateField.value = today;
    }
    console.log("✅ עבר לטאב שעתון");
    updatePlusTooltip();
  }
}

// Notification Functions
function toggleNotifications() {
  notificationBell.toggleDropdown();
}

function clearAllNotifications() {
  if (confirm("האם אתה בטוח שברצונך למחוק את כל ההתראות?")) {
    notificationBell.clearAllNotifications();
  }
}

// Form Functions
function resetBudgetForm() {
  const budgetForm = document.getElementById("budgetForm");
  if (budgetForm) budgetForm.reset();

  const searchResults = document.getElementById("budgetSearchResults");
  if (searchResults) searchResults.classList.remove("show");
}

function resetTimesheetForm() {
  const timesheetForm = document.getElementById("timesheetForm");
  if (timesheetForm) timesheetForm.reset();

  const searchResults = document.getElementById("timesheetSearchResults");
  if (searchResults) searchResults.classList.remove("show");

  const dateField = document.getElementById("actionDate");
  if (dateField) {
    dateField.value = new Date().toISOString().split("T")[0];
  }
}

// Client Search Functions
function searchClients(formType, query) {
  const resultsContainer = document.getElementById(`${formType}SearchResults`);

  if (!resultsContainer) {
    console.warn(`לא נמצא מיכל תוצאות: ${formType}SearchResults`);
    return;
  }

  if (query.length < 1) {
    resultsContainer.classList.remove("show");
    return;
  }

  const allClients = window.manager ? window.manager.clients : [];

  const matches = allClients
    .filter((client) => {
      const searchText =
        `${client.fullName} ${client.fileNumber}`.toLowerCase();
      return searchText.includes(query.toLowerCase());
    })
    .slice(0, 8);

  if (matches.length === 0) {
    resultsContainer.innerHTML =
      '<div class="no-results">לא נמצאו לקוחות מתאימים</div>';
  } else {
    resultsContainer.innerHTML = matches
      .map((client) => {
        const icon = client.type === "fixed" ? "📋" : "⏰";
        const details =
          client.type === "fixed"
            ? `שלב ${client.currentStage || 1} | פיקס`
            : `${client.hoursRemaining || 0} שעות נותרות`;

        return `
                <div class="search-result-item" onclick="selectClient('${formType}', '${client.fullName}', '${client.fileNumber}', '${client.type}')">
                    <div class="result-icon">${icon}</div>
                    <div class="result-text">
                        <div class="result-name">${client.fullName}</div>
                        <div class="result-details">תיק ${client.fileNumber} • ${details}</div>
                    </div>
                </div>
            `;
      })
      .join("");
  }

  resultsContainer.classList.add("show");
}

function selectClient(formType, clientName, fileNumber, clientType) {
  try {
    const searchInput = document.getElementById(`${formType}ClientSearch`);
    if (searchInput) {
      const icon = clientType === "fixed" ? "📋" : "⏰";
      searchInput.value = `${icon} ${clientName}`;
    }

    const hiddenField = document.getElementById(`${formType}ClientSelect`);
    if (hiddenField) {
      hiddenField.value = clientName;
    }

    if (formType === "timesheet") {
      const fileNumberField = document.getElementById("fileNumber");
      if (fileNumberField) {
        fileNumberField.value = fileNumber;
      }
    }

    const resultsElement = document.getElementById(`${formType}SearchResults`);
    if (resultsElement) {
      resultsElement.classList.remove("show");
    }
  } catch (error) {
    console.error("❌ שגיאה ב-selectClient:", error);
  }
}

function enhancedSearchClients(formType, query) {
  const resultsContainer = document.getElementById(`${formType}SearchResults`);

  if (!resultsContainer) {
    console.warn(`לא נמצא מיכל תוצאות: ${formType}SearchResults`);
    return;
  }

  if (query.length < 1) {
    resultsContainer.classList.remove("show");
    return;
  }

  const allClients = window.manager ? window.manager.clients : [];

  const matches = allClients
    .filter((client) => {
      const searchText = `${client.fullName} ${client.fileNumber} ${
        client.branch || ""
      }`.toLowerCase();
      return searchText.includes(query.toLowerCase());
    })
    .slice(0, 8);

  if (matches.length === 0) {
    resultsContainer.innerHTML =
      '<div class="no-results">לא נמצאו לקוחות מתאימים</div>';
  } else {
    resultsContainer.innerHTML = matches
      .map((client) => {
        const icon = client.type === "fixed" ? "📋" : "⏰";
        const status =
          client.remainingHours <= 0
            ? " (חסום)"
            : client.remainingHours <= 5
            ? " (קריטי)"
            : "";

        return `
                <div class="search-result-item" onclick="selectClientEnhanced('${formType}', '${
          client.id
        }', '${client.fullName}', '${client.fileNumber}')">
                    <span class="result-icon">${icon}</span>
                    <div class="result-text">
                        <div class="result-name">${
                          client.fullName
                        }${status}</div>
                        <div class="result-details">תיק: ${
                          client.fileNumber
                        } • ${
          client.type === "fixed" ? "פיקס" : client.remainingHours + " שעות"
        }</div>
                    </div>
                </div>
            `;
      })
      .join("");
  }

  resultsContainer.classList.add("show");
}

function selectClientEnhanced(formType, clientId, clientName, fileNumber) {
  const searchInput = document.getElementById(`${formType}ClientSearch`);
  const hiddenInput = document.getElementById(`${formType}ClientSelect`);
  const resultsContainer = document.getElementById(`${formType}SearchResults`);

  if (searchInput) searchInput.value = `${clientName} - תיק ${fileNumber}`;
  if (hiddenInput) hiddenInput.value = clientId;
  if (resultsContainer) resultsContainer.classList.remove("show");

  console.log(`✅ נבחר לקוח: ${clientName} (${clientId})`);
}

function openSmartForm() {
  const plusButton = document.getElementById("smartPlusBtn");
  const activeTab = document.querySelector(".tab-button.active");

  if (!activeTab) return;

  let currentForm;
  if (activeTab.onclick.toString().includes("budget")) {
    currentForm = document.getElementById("budgetFormContainer");
  } else if (activeTab.onclick.toString().includes("timesheet")) {
    currentForm = document.getElementById("timesheetFormContainer");
  }

  if (!currentForm) return;

  if (currentForm.classList.contains("hidden")) {
    currentForm.classList.remove("hidden");
    if (plusButton) plusButton.classList.add("active");
    console.log("🎯 פותח טופס");
  } else {
    currentForm.classList.add("hidden");
    if (plusButton) plusButton.classList.remove("active");
    console.log("❌ סוגר טופס");
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById("minimalSidebar");

  if (!sidebar) return;

  if (sidebar.style.display === "none") {
    sidebar.style.display = "flex";
    sidebar.style.animation = "fadeInScale 0.3s ease forwards";
  } else {
    sidebar.style.display = "none";
  }
}

function switchToTab(tabName) {
  console.log("🔄 מעבר לטאב:", tabName);

  currentActiveTab = tabName;

  document.querySelectorAll(".tab-button").forEach((btn) => {
    btn.classList.remove("active");
  });

  document.querySelectorAll(".tab-content").forEach((content) => {
    content.classList.remove("active");
  });

  if (tabName === "budget") {
    const budgetBtn = document.querySelector('[onclick*="budget"]');
    const budgetTab = document.getElementById("budgetTab");
    if (budgetBtn) budgetBtn.classList.add("active");
    if (budgetTab) budgetTab.classList.add("active");
  } else if (tabName === "timesheet") {
    const timesheetBtn = document.querySelector('[onclick*="timesheet"]');
    const timesheetTab = document.getElementById("timesheetTab");
    if (timesheetBtn) timesheetBtn.classList.add("active");
    if (timesheetTab) timesheetTab.classList.add("active");
  }

  // const targetTab = document.getElementById(tabName + "Tab");
  // if (targetTab) {
  //   targetTab.scrollIntoView({
  //     behavior: "smooth",
  //     block: "start",
  //   });
  // }
}

function toggleForm(formId) {
  const form = document.getElementById(formId);
  if (!form) return;

  const header = form.querySelector(".form-header");
  const content = form.querySelector(".form-content");
  const toggleBtn = form.querySelector(".form-toggle-btn");
  const toggleText = toggleBtn
    ? toggleBtn.querySelector(".form-toggle-text")
    : null;
  const toggleIcon = toggleBtn
    ? toggleBtn.querySelector(".form-toggle-icon")
    : null;

  const isExpanded = content ? content.classList.contains("expanded") : false;

  if (isExpanded) {
    if (header) header.classList.remove("active");
    if (content) content.classList.remove("expanded");
    form.classList.remove("active");
    form.classList.add("collapsing");

    if (toggleText) toggleText.textContent = toggleText.dataset.openText;
    if (toggleIcon)
      toggleIcon.className = "form-toggle-icon fas fa-chevron-down";

    console.log("📤 טופס מתכווץ:", formId);

    setTimeout(() => {
      form.classList.remove("collapsing");
    }, 400);
  } else {
    if (header) header.classList.add("active");
    if (content) content.classList.add("expanded");
    form.classList.add("active", "expanding");

    if (toggleText) toggleText.textContent = toggleText.dataset.closeText;
    if (toggleIcon) toggleIcon.className = "form-toggle-icon fas fa-chevron-up";

    console.log("📥 טופס מתרחב:", formId);

    setTimeout(() => {
      form.classList.remove("expanding");
    }, 400);

    closeOtherForms(formId);
  }
}

function closeOtherForms(currentFormId) {
  const allForms = document.querySelectorAll(".collapsible-form");
  allForms.forEach((form) => {
    if (form.id !== currentFormId) {
      const content = form.querySelector(".form-content");
      if (content && content.classList.contains("expanded")) {
        toggleForm(form.id);
      }
    }
  });
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById("minimalSidebar");
  if (window.innerWidth <= 768 && sidebar) {
    sidebar.classList.toggle("open");
  }
}

function updateFloatingTabs() {
  try {
    if (typeof currentActiveTab === "undefined") {
      currentActiveTab = "budget";
    }

    const floatingTabs = document.querySelectorAll(".floating-tab");
    if (floatingTabs.length === 0) {
      console.log("⚠️ לא נמצאו טאבים צפים");
      return;
    }

    floatingTabs.forEach((tab) => {
      if (tab && tab.classList) {
        tab.classList.remove("active");
      }
    });

    const activeFloatingTab = document.querySelector(
      `[data-tab="${currentActiveTab}"]`
    );
    if (activeFloatingTab && activeFloatingTab.classList) {
      activeFloatingTab.classList.add("active");
    }
  } catch (error) {
    console.error("❌ שגיאה ב-updateFloatingTabs:", error);
  }
}

/* === EVENT LISTENERS === */

// Main Event Listeners
document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    const sidebar = document.getElementById("sidebar");
    if (sidebar && sidebar.classList.contains("open")) {
      toggleSidebar();
    }

    if (notificationBell.isDropdownOpen) {
      notificationBell.hideDropdown();
    }
  }
});

window.addEventListener("resize", function () {
  const sidebar = document.getElementById("sidebar");
  if (
    window.innerWidth <= 768 &&
    sidebar &&
    sidebar.classList.contains("open")
  ) {
    toggleSidebar();
  }
});

document.addEventListener("click", function (event) {
  const searchContainers = document.querySelectorAll(".modern-client-search");
  searchContainers.forEach((container) => {
    if (!container.contains(event.target)) {
      const resultsInContainer = container.querySelector(".search-results");
      if (resultsInContainer) {
        resultsInContainer.classList.remove("show");
      }
    }
  });
});

document.addEventListener("DOMContentLoaded", function () {
  console.log("🚀 DOM נטען - מאתחל סרגל מינימליסטי");

  setTimeout(() => {
    const firstNavItem = document.querySelector(".nav-item");
    if (firstNavItem) {
      firstNavItem.classList.add("active");
      console.log("✅ פריט ראשון הודגש");
    }

    initializeSidebarAnimations();
    setupAdvancedHoverEffects();

    if (window.manager && window.manager.currentUser) {
      updateSidebarUser(window.manager.currentUser);
    }
  }, 200);
});

document.addEventListener("DOMContentLoaded", function () {
  console.log("🎯 מערכת נקייה נטענת");

  const dateField = document.getElementById("actionDate");
  if (dateField) {
    dateField.value = new Date().toISOString().split("T")[0];
  }

  document.addEventListener("click", function (e) {
    if (!e.target.closest(".modern-client-search")) {
      document.querySelectorAll(".search-results").forEach((results) => {
        results.classList.remove("show");
      });
    }

    if (
      !e.target.closest(".notification-bell") &&
      !e.target.closest(".notifications-dropdown")
    ) {
      const dropdown = document.getElementById("notificationsDropdown");
      if (dropdown) {
        dropdown.classList.remove("show");
      }
    }

    if (e.target.classList.contains("popup-overlay")) {
      e.target.remove();
    }
  });
});

// DUPLICATE? - same as above
document.addEventListener("DOMContentLoaded", function () {
  console.log("🎯 מאתחל ממשק חדש...");

  setTimeout(() => {
    if (
      document.readyState === "complete" ||
      document.readyState === "interactive"
    ) {
      setActiveNavItem("תקצוב");
    } else {
      document.addEventListener("DOMContentLoaded", () => {
        setTimeout(() => setActiveNavItem("תקצוב"), 200);
      });
    }
  }, 500);

  setTimeout(() => {
    updateConnectionIndicator("connected", "מערכת מוכנה");
  }, 2000);
});

// DUPLICATE? - same as above
document.addEventListener("DOMContentLoaded", function () {
  setTimeout(() => {
    initializeNewSidebar();
    enhanceFormExperience();
    debugNewSystem();

    console.log("🚀 המערכת החדשה מוכנה לשימוש!");
  }, 500);
});

window.addEventListener("beforeunload", function () {
  window.removeEventListener("scroll", handleScroll);
});

/* === INITIALIZATION === */

// Override original switchTab if exists
if (typeof switchTab !== "undefined") {
  const originalSwitchTab = window.switchTab;
  window.switchTab = function (tabName) {
    if (originalSwitchTab) {
      originalSwitchTab(tabName);
    }

    currentActiveTab = tabName;
    updateFloatingTabs();
  };
}

// Define missing functions for compatibility
if (typeof searchClients === "undefined") {
  window.searchClients = enhancedSearchClients;
}

if (typeof selectClient === "undefined") {
  window.selectClient = selectClientEnhanced;
}

// Mobile specific
if (window.innerWidth <= 600) {
  setTimeout(() => {
    if (!document.querySelector(".mobile-menu-btn")) {
      const headerActions = document.querySelector(".header-actions");
      if (headerActions) {
        const menuBtn = document.createElement("button");
        menuBtn.className = "btn btn-secondary mobile-menu-btn";
        menuBtn.innerHTML = '<i class="fas fa-bars"></i> תפריט';
        menuBtn.onclick = toggleSidebar;
        headerActions.insertBefore(menuBtn, headerActions.firstChild);
      }
    }
  }, 1000);
}

// Auto checks
setTimeout(() => {
  checkSidebarIntegrity();
}, 3000);

setTimeout(() => {
  updateConnectionIndicator("connecting", "מערכת מאתחלת...");
}, 1000);

safeInitNavigation();

// Update styles for animation
const style = document.createElement("style");
style.textContent = `
@keyframes fadeInScale {
    from {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.8);
    }
    to {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
    }
}
`;
document.head.appendChild(style);

/* === MISC === */

console.log("✅ פונקציות חיבור תוקנו");
console.log("✅ מערכת ניהול משרד עורכי דין - גרסה מסודרת נטענה בהצלחה");
console.log("🎉 המערכת המסודרת מוכנה לשימוש מלא!");
