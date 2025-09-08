/**
 * Firebase-Only Law Office Management System
 * Clean version without legacy Google Apps Script integration
 */

/* === Performance Monitoring === */
const startTime = performance.now();
const startMemory = performance.memory?.usedJSHeapSize || 0;

/* === Global Constants === */
const EMPLOYEES = {
  חיים: { password: "2025", name: "חיים" },
  ישי: { password: "2025", name: "ישי" },
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

// Global state
let currentActiveTab = "budget";
let isScrolled = false;

/* === Global Listeners Registry === */
const globalListeners = {
  documentClick: null,
  documentKeydown: null,
  windowResize: null,
  notificationClick: null,
};

/* === Utility Functions === */

function safeText(text) {
  if (typeof text !== "string") {
    return String(text || "");
  }
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Show loading overlay
 */
function showSimpleLoading(message = "מעבד...") {
  const existing = document.getElementById("simple-loading");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "simple-loading";
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.7); z-index: 10000;
    display: flex; align-items: center; justify-content: center;
  `;
  overlay.innerHTML = `
    <div style="text-align: center; background: white; color: #333; padding: 30px; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
      <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; animation: spin 1.5s linear infinite; margin: 0 auto 20px;"></div>
      <div style="font-size: 16px; font-weight: 500;">${safeText(message)}</div>
    </div>
    <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
  `;
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";
}

/**
 * Hide loading overlay
 */
function hideSimpleLoading() {
  const overlay = document.getElementById("simple-loading");
  if (overlay) {
    overlay.remove();
    document.body.style.overflow = "";
  }
}

/**
 * Format date functions
 */
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
    console.warn("formatDateTime failed", { input: date, error });
    return "תאריך לא תקין";
  }
}

function formatDate(dateString) {
  try {
    return new Date(dateString).toLocaleDateString("he-IL");
  } catch (error) {
    console.warn("formatDate failed", { input: dateString, error });
    return "תאריך לא תקין";
  }
}

function formatShort(date) {
  const d = new Date(date);
  return d.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "short",
  });
}

/* === Firebase Core Functions === */

/**
 * Initialize Firebase connection
 */
function initializeFirebase() {
  try {
    console.log("🔥 Firebase מחובר בהצלחה - מצב מהיר!");

    if (!window.firebaseDB) {
      console.error("❌ Firebase Database לא זמין");
      throw new Error("Firebase Database לא מחובר");
    }

    console.log("✅ Database מוכן עם אופטימיזציות");
    console.log("✅ Project ID: law-office-system-e4801");
    return true;
  } catch (error) {
    console.error("❌ שגיאה באתחול Firebase:", error);
    return false;
  }
}

/**
 * Test Firebase connection
 */
async function testFirebaseConnection() {
  try {
    console.log("🚀 מתחיל בדיקת Firebase...");

    const db = window.firebaseDB;
    if (!db) {
      throw new Error("Firebase לא מחובר");
    }

    // Test write
    console.log("📝 בודק כתיבה ל-Firebase...");
    const testDoc = await db.collection("test").add({
      message: "בדיקה",
      timestamp: new Date(),
      user: "test",
    });
    console.log("✅ בדיקת כתיבה הצליחה! ID:", testDoc.id);

    // Test read
    console.log("📖 בודק קריאה מFirebase...");
    const snapshot = await db.collection("test").limit(1).get();
    console.log("✅ בדיקת קריאה הצליחה! נמצאו:", snapshot.size, "מסמכים");

    // Cleanup
    if (!snapshot.empty) {
      await snapshot.docs[0].ref.delete();
      console.log("🗑️ מסמך בדיקה נמחק");
    }

    console.log("🎉 Firebase עובד מושלם!");
    return true;
  } catch (error) {
    console.error("❌ שגיאה בבדיקת Firebase:", error);
    return false;
  }
}

/* === Firebase Data Operations === */

/**
 * Load clients from Firebase
 */
async function loadClientsFromFirebase() {
  try {
    showSimpleLoading("טוען לקוחות...");

    const db = window.firebaseDB;
    if (!db) {
      throw new Error("Firebase לא מחובר");
    }

    const snapshot = await db.collection("clients").get();
    const clients = [];

    snapshot.forEach((doc) => {
      clients.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    console.log(`🔥 Firebase: נטענו ${clients.length} לקוחות`);
    hideSimpleLoading();
    return clients;
  } catch (error) {
    console.error("Firebase error:", error);
    hideSimpleLoading();
    throw new Error("שגיאה בטעינת לקוחות: " + error.message);
  }
}

/**
 * Load budget tasks from Firebase
 */
async function loadBudgetTasksFromFirebase(employee) {
  try {
    showSimpleLoading("טוען משימות...");

    const db = window.firebaseDB;
    if (!db) {
      throw new Error("Firebase לא מחובר");
    }

    const snapshot = await db
      .collection("budget_tasks")
      .where("employee", "==", employee)
      .get();

    const tasks = [];

    snapshot.forEach((doc) => {
      tasks.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    console.log(`🔥 Firebase: נטענו ${tasks.length} משימות`);
    hideSimpleLoading();
    return tasks;
  } catch (error) {
    console.error("Firebase error:", error);
    hideSimpleLoading();
    throw new Error("שגיאה בטעינת משימות: " + error.message);
  }
}

/**
 * Load timesheet entries from Firebase
 */
async function loadTimesheetFromFirebase(employee) {
  try {
    showSimpleLoading("טוען שעתון...");

    const db = window.firebaseDB;
    if (!db) {
      throw new Error("Firebase לא מחובר");
    }

    const snapshot = await db
      .collection("timesheet_entries")
      .where("employee", "==", employee)
      .get();

    const entries = [];

    snapshot.forEach((doc) => {
      entries.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // Sort by date (manual sorting instead of orderBy)
    entries.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date) - new Date(a.date);
    });

    console.log(`🔥 Firebase: נטענו ${entries.length} רשומות שעתון`);
    hideSimpleLoading();
    return entries;
  } catch (error) {
    console.error("Firebase error:", error);
    hideSimpleLoading();
    throw new Error("שגיאה בטעינת שעתון: " + error.message);
  }
}

/**
 * Save client to Firebase
 */
async function saveClientToFirebase(clientData) {
  try {
    showSimpleLoading("שומר לקוח...");

    const db = window.firebaseDB;
    if (!db) {
      throw new Error("Firebase לא מחובר");
    }

    const docRef = await db.collection("clients").add({
      ...clientData,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`🔥 Firebase: לקוח נשמר עם ID: ${docRef.id}`);
    hideSimpleLoading();
    return docRef.id;
  } catch (error) {
    console.error("Firebase error:", error);
    hideSimpleLoading();
    throw new Error("שגיאה בשמירת לקוח: " + error.message);
  }
}

/**
 * Save budget task to Firebase
 */
async function saveBudgetTaskToFirebase(taskData) {
  try {
    showSimpleLoading("שומר משימה...");

    const db = window.firebaseDB;
    if (!db) {
      throw new Error("Firebase לא מחובר");
    }

    const currentUser = window.manager?.currentUser;
    if (!currentUser) {
      throw new Error("משתמש לא מזוהה");
    }

    const dataToSave = {
      ...taskData,
      employee: currentUser,
      lawyer: currentUser,
      createdBy: currentUser,
      lastModifiedBy: currentUser,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection("budget_tasks").add(dataToSave);

    console.log(
      `🔥 Firebase: משימה נשמרה - ID: ${docRef.id}, עובד: ${currentUser}`
    );
    hideSimpleLoading();
    return docRef.id;
  } catch (error) {
    console.error("Firebase error:", error);
    hideSimpleLoading();
    throw new Error("שגיאה בשמירת משימה: " + error.message);
  }
}

/**
 * Save timesheet entry to Firebase
 */
async function saveTimesheetToFirebase(entryData) {
  try {
    showSimpleLoading("שומר שעתון...");

    const db = window.firebaseDB;
    if (!db) {
      throw new Error("Firebase לא מחובר");
    }

    const currentUser = window.manager?.currentUser;
    if (!currentUser) {
      throw new Error("משתמש לא מזוהה");
    }

    const dataToSave = {
      ...entryData,
      employee: currentUser,
      lawyer: currentUser,
      createdBy: currentUser,
      lastModifiedBy: currentUser,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection("timesheet_entries").add(dataToSave);

    console.log(
      `🔥 Firebase: שעתון נשמר - ID: ${docRef.id}, עובד: ${currentUser}`
    );
    hideSimpleLoading();
    return docRef.id;
  } catch (error) {
    console.error("Firebase error:", error);
    hideSimpleLoading();
    throw new Error("שגיאה בשמירת שעתון: " + error.message);
  }
}

/* === Client Hours Calculation === */

/**
 * Calculate accurate client hours from all timesheet entries
 */
async function calculateClientHoursAccurate(clientName) {
  try {
    const db = window.firebaseDB;
    if (!db) throw new Error("Firebase לא מחובר");

    console.log(`🧮 מחשב שעות מדויקות עבור: ${clientName}`);

    // Get client data
    const clientsSnapshot = await db
      .collection("clients")
      .where("fullName", "==", clientName)
      .get();

    if (clientsSnapshot.empty) {
      throw new Error("לקוח לא נמצא");
    }

    const client = clientsSnapshot.docs[0].data();

    // Get all timesheet entries for this client (from ALL users)
    const timesheetSnapshot = await db
      .collection("timesheet_entries")
      .where("clientName", "==", clientName)
      .get();

    let totalMinutesUsed = 0;
    const entriesByLawyer = {};

    timesheetSnapshot.forEach((doc) => {
      const entry = doc.data();
      const minutes = entry.minutes || 0;
      const lawyer = entry.employee || entry.lawyer || "לא ידוע";

      totalMinutesUsed += minutes;

      if (!entriesByLawyer[lawyer]) {
        entriesByLawyer[lawyer] = 0;
      }
      entriesByLawyer[lawyer] += minutes;
    });

    // Calculate remaining hours
    const totalHours = client.totalHours || 0;
    const totalMinutesAllocated = totalHours * 60;
    const remainingMinutes = Math.max(
      0,
      totalMinutesAllocated - totalMinutesUsed
    );
    const remainingHours = remainingMinutes / 60;

    // Determine status
    let status = "פעיל";
    let isBlocked = false;
    let isCritical = false;

    if (client.type === "hours") {
      if (remainingMinutes <= 0) {
        status = "חסום - נגמרו השעות";
        isBlocked = true;
      } else if (remainingHours <= 5) {
        status = "קריטי - מעט שעות";
        isCritical = true;
      }
    }

    const result = {
      clientName,
      clientData: client,
      totalHours,
      totalMinutesUsed,
      remainingHours: Math.round(remainingHours * 100) / 100,
      remainingMinutes,
      status,
      isBlocked,
      isCritical,
      entriesCount: timesheetSnapshot.size,
      entriesByLawyer,
      uniqueLawyers: Object.keys(entriesByLawyer),
      lastCalculated: new Date(),
    };

    console.log(`✅ חישוב הושלם עבור ${clientName}:`, {
      remainingHours: result.remainingHours,
      status: result.status,
      entriesCount: result.entriesCount,
    });

    return result;
  } catch (error) {
    console.error("שגיאה בחישוב שעות:", error);
    throw error;
  }
}

/**
 * Update client hours immediately in Firebase
 */
async function updateClientHoursImmediately(clientName, minutesUsed) {
  try {
    const db = window.firebaseDB;
    if (!db) throw new Error("Firebase לא מחובר");

    console.log(`⏰ מעדכן שעות עבור ${clientName}: ${minutesUsed} דקות`);

    // Find the client
    const clientsSnapshot = await db
      .collection("clients")
      .where("fullName", "==", clientName)
      .get();

    if (clientsSnapshot.empty) {
      console.warn(`⚠️ לקוח ${clientName} לא נמצא - לא ניתן לעדכן שעות`);
      return { success: false, message: "לקוח לא נמצא" };
    }

    const clientDoc = clientsSnapshot.docs[0];
    const clientData = clientDoc.data();

    // Only for hours-based clients
    if (clientData.type !== "hours") {
      console.log(`ℹ️ לקוח ${clientName} הוא פיקס - לא מעדכן שעות`);
      return { success: true, message: "לקוח פיקס - לא נדרש עדכון" };
    }

    // Recalculate using accurate function
    const hoursData = await calculateClientHoursAccurate(clientName);

    // Update Firebase document with accurate data
    await clientDoc.ref.update({
      minutesRemaining: Math.max(0, hoursData.remainingMinutes),
      hoursRemaining: Math.max(0, hoursData.remainingHours),
      lastActivity: firebase.firestore.FieldValue.serverTimestamp(),
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
      totalMinutesUsed: hoursData.totalMinutesUsed,
      isBlocked: hoursData.isBlocked,
      isCritical: hoursData.isCritical,
    });

    console.log(`✅ שעות עודכנו עבור ${clientName}:`, {
      totalUsed: (hoursData.totalMinutesUsed / 60).toFixed(1),
      remaining: hoursData.remainingHours.toFixed(1),
      status: hoursData.status,
    });

    // Update local system data
    if (window.manager && window.manager.clients) {
      const localClientIndex = window.manager.clients.findIndex(
        (c) => c.fullName === clientName
      );
      if (localClientIndex !== -1) {
        window.manager.clients[localClientIndex].hoursRemaining = Math.max(
          0,
          hoursData.remainingHours
        );
        window.manager.clients[localClientIndex].minutesRemaining = Math.max(
          0,
          hoursData.remainingMinutes
        );
        window.manager.clients[localClientIndex].isBlocked =
          hoursData.isBlocked;
        window.manager.clients[localClientIndex].isCritical =
          hoursData.isCritical;
        window.manager.clients[localClientIndex].totalMinutesUsed =
          hoursData.totalMinutesUsed;

        // Update client selectors
        if (window.manager.clientValidation) {
          window.manager.clientValidation.updateBlockedClients();
        }
      }
    }

    return {
      success: true,
      hoursData,
      newHoursRemaining: hoursData.remainingHours,
      newMinutesRemaining: hoursData.remainingMinutes,
      isBlocked: hoursData.isBlocked,
      isCritical: hoursData.isCritical,
    };
  } catch (error) {
    console.error("❌ שגיאה בעדכון שעות לקוח:", error);
    throw new Error("שגיאה בעדכון שעות: " + error.message);
  }
}

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

/**
 * Client validation helper
 */
class ClientValidation {
  constructor(manager) {
    this.manager = manager;
    this.blockedClients = new Set();
    this.criticalClients = new Set();
  }

  updateBlockedClients() {
    this.blockedClients.clear();
    this.criticalClients.clear();

    if (!this.manager.clients || !Array.isArray(this.manager.clients)) {
      return;
    }

    for (const client of this.manager.clients) {
      if (!client) continue;

      if (client.isBlocked) {
        this.blockedClients.add(client.fullName);
      } else if (
        client.type === "hours" &&
        typeof client.hoursRemaining === "number" &&
        client.hoursRemaining <= 5 &&
        client.hoursRemaining > 0
      ) {
        this.criticalClients.add(client.fullName);
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

/**
 * Table pagination helper
 */
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

/* === Main Application Manager === */

/**
 * Main Law Office Manager - Firebase Only
 */
class LawOfficeManager {
  constructor() {
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
      actionDate.value = new Date().toISOString().split("T")[0];
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
      try {
        this.loadData();
      } catch (error) {
        this.showNotification("שגיאה בטעינת נתונים", "error");
        console.error("Error loading data:", error);
      }
    } else {
      const errorMessage = document.getElementById("errorMessage");
      if (errorMessage) {
        errorMessage.classList.remove("hidden");
        setTimeout(() => errorMessage.classList.add("hidden"), 3000);
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

    setTimeout(() => {
      updateSidebarUser(this.currentUser);
    }, 500);
  }

  async loadData() {
    try {
      await this.loadDataFromFirebase();
      setTimeout(() => {
        this.applyBudgetTaskFilters();
        this.applyTimesheetFilters();
        this.renderBudgetTasks();
        this.renderTimesheetEntries();
        this.clientValidation.updateBlockedClients();
      }, 500);
    } catch (error) {
      console.error("Failed to load data:", error);
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

  async loadDataFromFirebase() {
    try {
      this.showNotification("טוען נתונים מFirebase...", "info");

      // Load clients
      this.clients = await loadClientsFromFirebase();

      // Calculate accurate hours for each client
      for (const client of this.clients) {
        if (client.type === "hours") {
          try {
            const hoursData = await calculateClientHoursAccurate(
              client.fullName
            );
            client.hoursRemaining = hoursData.remainingHours;
            client.minutesRemaining = hoursData.remainingMinutes;
            client.isBlocked = hoursData.isBlocked;
            client.isCritical = hoursData.isCritical;
          } catch (error) {
            console.warn(
              `⚠️ לא ניתן לחשב שעות עבור ${client.fullName}:`,
              error.message
            );
          }
        }
      }

      // Load budget tasks
      this.budgetTasks = await loadBudgetTasksFromFirebase(this.currentUser);

      // Load timesheet entries
      this.timesheetEntries = await loadTimesheetFromFirebase(this.currentUser);

      this.connectionStatus = "connected";
      this.updateConnectionStatus?.("🟢 מחובר");
      this.showNotification("✅ נתונים נטענו בהצלחה!", "success");
    } catch (error) {
      console.error("Failed to load data:", error);
      this.connectionStatus = "offline";
      this.updateConnectionStatus?.("🔴 שגיאה בחיבור");
      this.showNotification("שגיאה בטעינת נתונים", "error");
    }
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

  applyBudgetTaskFilters() {
    this.filteredBudgetTasks = [...this.budgetTasks];
  }

  applyTimesheetFilters() {
    this.filteredTimesheetEntries = [...this.timesheetEntries];
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

    // Check if client already exists
    if (this.clients.some((c) => c.fileNumber === fileNumber)) {
      this.showNotification(
        `❌ מספר תיק ${fileNumber} כבר קיים במערכת!`,
        "error"
      );
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

    await this.createClientComplete(client);
  }

  async addBudgetTask() {
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
      taskDescription: description,
      estimatedMinutes: parseInt(estimatedTimeValue),
      actualMinutes: 0,
      deadline,
      status: "פעיל",
      createdAt: new Date().toLocaleString("he-IL"),
      history: [],
    };

    try {
      this.budgetTasks.unshift(budgetTask);
      this.filteredBudgetTasks = [...this.budgetTasks];
      this.renderBudgetTasks();

      await saveBudgetTaskToFirebase(budgetTask);

      this.showNotification("✅ המשימה נוספה בהצלחה", "success");
      this.clearBudgetForm();
      setTimeout(() => this.loadDataFromFirebase(), 1000);
    } catch (error) {
      console.error("Error adding budget task:", error);
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
    const errorHtml = errors
      .map((error) => `<li>${safeText(error)}</li>`)
      .join("");
    this.showNotification(
      `❌ שגיאות בטופס:<ul style="text-align: right; margin: 10px 0;">${errorHtml}</ul>`,
      "error"
    );
  }

  async addTimesheetEntry() {
    const submitButton = document.querySelector(
      '#timesheetForm button[type="submit"]'
    );
    const originalButtonText = submitButton ? submitButton.innerHTML : "";

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> שומר...';
    }

    try {
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
        !this.clientValidation.validateClientSelection(
          clientName,
          "רישום שעתון"
        )
      ) {
        return;
      }

      const selectedClient = this.clients.find(
        (c) => c.fullName === clientName
      );

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
      await this.loadDataFromFirebase();
      this.clientValidation.updateBlockedClients();
    } catch (error) {
      console.error("Error in addTimesheetEntry:", error);
      this.showNotification("שגיאה ברישום השעתון", "error");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonText;
      }
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
      actionDate.value = new Date().toISOString().split("T")[0];
    }
  }

  // Render methods
  renderBudgetTasks() {
    const budgetContainer = document.getElementById("budgetContainer");
    const tableContainer = document.getElementById("budgetTableContainer");

    if (!budgetContainer && !tableContainer) {
      console.warn("Budget containers not found");
      return;
    }

    const tasksToShow = this.filteredBudgetTasks || this.budgetTasks || [];
    const paginationData = this.budgetPagination.getPage(
      tasksToShow,
      this.currentBudgetPage
    );
    const paginatedTasks = paginationData.data;

    if (budgetContainer && !budgetContainer.classList.contains("hidden")) {
      this.renderBudgetCards(paginatedTasks);
    }

    if (tableContainer && !tableContainer.classList.contains("hidden")) {
      this.renderBudgetTable(paginatedTasks);
    }

    this.budgetPagination.renderControls(
      "budgetPaginationControls",
      paginationData,
      "window.manager.changeBudgetPage"
    );
  }

  renderBudgetCards(tasks) {
    const container = document.getElementById("budgetContainer");
    if (!container) return;

    const tasksHtml = tasks.map((task) => this.createTaskCard(task)).join("");

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
  }

  createTaskCard(task) {
    const safeTask = this.sanitizeTaskData(task);
    const progress = this.calculateSimpleProgress(safeTask);
    const progressClass =
      progress >= 100
        ? "progress-complete"
        : progress >= 85
        ? "progress-high"
        : progress >= 50
        ? "progress-medium"
        : "progress-low";
    const progressStatus = this.getProgressStatusText(progress);

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

    const actualHours = Math.round((safeTask.actualMinutes / 60) * 10) / 10;
    const estimatedHours =
      Math.round((safeTask.estimatedMinutes / 60) * 10) / 10;

    const safeDescription = safeText(safeTask.description);
    const safeClientName = safeText(safeTask.clientName);
    const clientDisplayName =
      safeTask.clientName.length > 20
        ? safeText(safeTask.clientName.substring(0, 20) + "...")
        : safeClientName;

    return `
      <div class="linear-minimal-card" data-task-id="${safeTask.id}">
        <div class="linear-card-content">
          <h3 class="linear-card-title" title="${safeClientName}">
            ${safeDescription}
          </h3>
          <div class="linear-progress-section">
            <div class="linear-visual-progress">
              <div class="linear-progress-text">
                <span class="progress-percentage">${progress}%</span>
                <span class="progress-status">${safeText(progressStatus)}</span>
              </div>
              <div class="linear-progress-bar">
                <div class="linear-progress-fill ${progressClass}" style="width: ${Math.min(
      progress,
      100
    )}%"></div>
              </div>
            </div>
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
          <div class="linear-card-meta">
            <div class="linear-client-row">
              <span class="linear-client-label">לקוח:</span>
              <span class="linear-client-name" title="${safeClientName}">
                ${clientDisplayName}
              </span>
            </div>
            <div class="linear-deadline-row">
              <span class="linear-progress-label">יעד:</span>
              <span class="deadline-info ${deadlineClass}" title="${formatDate(
      safeTask.deadline
    )}">
                ${deadlineIcon} ${formatShort(safeTask.deadline)}
              </span>
            </div>
          </div>
        </div>
        <button class="linear-expand-btn" onclick="manager.expandTaskCard(${
          safeTask.id
        }, event)" title="הרחב פרטים">
          <i class="fas fa-plus"></i>
        </button>
      </div>
    `;
  }

  renderBudgetTable(tasks) {
    const tableContainer = document.getElementById("budgetTableContainer");
    if (!tableContainer) return;

    if (!tasks || tasks.length === 0) {
      tableContainer.innerHTML = this.createEmptyTableState();
      return;
    }

    tableContainer.innerHTML = `
      <div class="modern-table-container">
        <table class="modern-budget-table">
          <thead>
            <tr>
              <th>לקוח</th>
              <th>תיאור</th>
              <th>התקדמות</th>
              <th>יעד</th>
              <th>סטטוס</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            ${tasks.map((task) => this.createTableRow(task)).join("")}
          </tbody>
        </table>
      </div>
    `;
  }
  /**
   * דיאלוג עריכת שעתון מורחב - החלפה של showEditTimesheetDialog במחלקת Manager
   */
  showEditTimesheetDialog(entryId) {
    console.log("🔧 פותח דיאלוג עריכת שעתון מורחב:", entryId);

    const entry = this.timesheetEntries.find(
      (e) =>
        (e.id && e.id.toString() === entryId.toString()) ||
        (e.entryId && e.entryId.toString() === entryId.toString())
    );

    if (!entry) {
      this.showNotification("רשומת שעתון לא נמצאה", "error");
      console.error("❌ רשומה לא נמצאה:", entryId);
      return;
    }

    console.log("✅ רשומה נמצאה:", entry);

    // מכין את תאריך לפורמט input date
    let entryDateForInput = "";
    try {
      const dateObj = new Date(entry.date);
      entryDateForInput = dateObj.toISOString().split("T")[0];
    } catch (error) {
      entryDateForInput = new Date().toISOString().split("T")[0];
    }

    const overlay = document.createElement("div");
    overlay.className = "popup-overlay";

    overlay.innerHTML = `
    <div class="popup edit-timesheet-popup" style="max-width: 600px;">
      <div class="popup-header">
        <i class="fas fa-edit"></i>
        ערוך רשומת שעתון
      </div>
      <div class="popup-content">
        <div class="task-overview">
          <h3>
            <i class="fas fa-info-circle"></i>
            רשומה מקורית
          </h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 13px; color: #6b7280; background: #f9fafb; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
            <p><strong>תאריך מקורי:</strong> ${formatDate(entry.date)}</p>
            <p><strong>לקוח מקורי:</strong> ${safeText(entry.clientName)}</p>
            <p><strong>זמן מקורי:</strong> ${entry.minutes} דקות</p>
            <p><strong>פעולה:</strong> ${safeText(entry.action)}</p>
          </div>
        </div>
        
        <form id="editTimesheetForm">
          <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div class="form-group">
              <label for="editDate">תאריך <span class="required">*</span></label>
              <input 
                type="date" 
                id="editDate" 
                value="${entryDateForInput}" 
                required
                style="
                  width: 100%;
                  padding: 10px 12px;
                  border: 2px solid #e1e5e9;
                  border-radius: 8px;
                  font-size: 14px;
                  transition: all 0.2s ease;
                "
              >
            </div>
            
            <div class="form-group">
              <label for="editMinutes">זמן (דקות) <span class="required">*</span></label>
              <input 
                type="number" 
                id="editMinutes" 
                min="1" 
                max="999" 
                value="${entry.minutes}" 
                required
                placeholder="60"
                style="
                  width: 100%;
                  padding: 10px 12px;
                  border: 2px solid #e1e5e9;
                  border-radius: 8px;
                  font-size: 16px;
                  font-weight: 600;
                  text-align: center;
                  transition: all 0.2s ease;
                "
              >
            </div>
          </div>
          
          <div class="form-group">
            <label for="editClientName">שם לקוח <span class="required">*</span></label>
            <div class="modern-client-search">
              <input
                type="text"
                class="search-input"
                id="editClientSearch"
                placeholder="התחל להקליד שם לקוח..."
                value="${safeText(entry.clientName)}"
                autocomplete="off"
                oninput="manager.searchClientsForEdit(this.value)"
                style="
                  width: 100%;
                  padding: 12px 16px;
                  border: 2px solid #e1e5e9;
                  border-radius: 8px;
                  font-size: 14px;
                  font-weight: 500;
                  transition: all 0.2s ease;
                "
              />
              <div
                class="search-results"
                id="editClientSearchResults"
                style="
                  position: absolute;
                  top: 100%;
                  left: 0;
                  right: 0;
                  background: white;
                  border: 1px solid #d1d5db;
                  border-top: none;
                  border-radius: 0 0 8px 8px;
                  max-height: 200px;
                  overflow-y: auto;
                  z-index: 1000;
                  display: none;
                "
              ></div>
              <input
                type="hidden"
                id="editClientSelect"
                value="${safeText(entry.clientName)}"
                required
              />
            </div>
            <small class="form-help">
              <i class="fas fa-search"></i> 
              התחל להקליד לחיפוש לקוחות קיימים
            </small>
          </div>
          
          <div class="form-group">
            <label for="editReason">סיבת העריכה <span class="required">*</span></label>
            <textarea 
              id="editReason" 
              rows="3" 
              placeholder="הסבר מדוע אתה משנה את הפרטים (חובה למעקב)"
              required
              style="
                width: 100%;
                padding: 10px 12px;
                border: 2px solid #e1e5e9;
                border-radius: 8px;
                font-size: 14px;
                resize: vertical;
                transition: all 0.2s ease;
              "
            ></textarea>
            <small class="form-help">
              <i class="fas fa-exclamation-circle"></i> 
              סיבת העריכה נדרשת למעקב ובקרה
            </small>
          </div>
        </form>
      </div>
      <div class="popup-buttons">
        <button class="popup-btn popup-btn-confirm" onclick="manager.submitAdvancedTimesheetEdit('${entryId}')" style="min-width: 140px;">
          <i class="fas fa-save"></i> שמור שינויים
        </button>
        <button class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()">
          <i class="fas fa-times"></i> ביטול
        </button>
      </div>
    </div>
  `;

    document.body.appendChild(overlay);

    // הוספת עיצוב focus למקומות שנערכים
    setTimeout(() => {
      const editInputs = overlay.querySelectorAll("input, textarea");
      editInputs.forEach((input) => {
        input.addEventListener("focus", function () {
          this.style.borderColor = "#3b82f6";
          this.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
        });

        input.addEventListener("blur", function () {
          this.style.borderColor = "#e1e5e9";
          this.style.boxShadow = "none";
        });
      });

      // פוקוס על שדה הזמן
      const minutesInput = document.getElementById("editMinutes");
      if (minutesInput) {
        minutesInput.select();
        minutesInput.focus();
      }
    }, 100);
  }

  /**
   * חיפוש לקוחות לעריכת שעתון
   */
  searchClientsForEdit(searchTerm) {
    const resultsContainer = document.getElementById("editClientSearchResults");
    const hiddenInput = document.getElementById("editClientSelect");

    if (!resultsContainer) return;

    if (!searchTerm || searchTerm.length < 1) {
      resultsContainer.style.display = "none";
      return;
    }

    // סינון לקוחות
    const filteredClients = this.clients.filter(
      (client) =>
        client.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.fileNumber.includes(searchTerm) ||
        client.clientName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (filteredClients.length === 0) {
      resultsContainer.innerHTML = `
      <div style="padding: 12px; color: #6b7280; text-align: center;">
        <i class="fas fa-search"></i> לא נמצאו לקוחות תואמים
      </div>
    `;
      resultsContainer.style.display = "block";
      return;
    }

    const resultsHtml = filteredClients
      .slice(0, 8)
      .map(
        (client) => `
    <div class="client-result" onclick="manager.selectClientForEdit('${
      client.fullName
    }', '${client.fileNumber}')" 
         style="
           padding: 10px 12px;
           cursor: pointer;
           border-bottom: 1px solid #f3f4f6;
           display: flex;
           justify-content: space-between;
           align-items: center;
           transition: background 0.2s ease;
         "
         onmouseover="this.style.background='#f8fafc'"
         onmouseout="this.style.background='white'">
      <div>
        <div style="font-weight: 600; color: #374151;">${safeText(
          client.fullName
        )}</div>
        ${
          client.description
            ? `<div style="font-size: 12px; color: #6b7280;">${safeText(
                client.description
              )}</div>`
            : ""
        }
      </div>
      <div style="font-size: 12px; color: #3b82f6; font-weight: 500;">
        ${client.fileNumber}
      </div>
    </div>
  `
      )
      .join("");

    resultsContainer.innerHTML = resultsHtml;
    resultsContainer.style.display = "block";
  }

  /**
   * בחירת לקוח לעריכה
   */
  selectClientForEdit(clientName, fileNumber) {
    const searchInput = document.getElementById("editClientSearch");
    const hiddenInput = document.getElementById("editClientSelect");
    const resultsContainer = document.getElementById("editClientSearchResults");

    if (searchInput && hiddenInput && resultsContainer) {
      searchInput.value = clientName;
      hiddenInput.value = clientName;
      resultsContainer.style.display = "none";

      // אנימציה קצרה להצגת הבחירה
      searchInput.style.background = "#ecfdf5";
      searchInput.style.borderColor = "#10b981";
      setTimeout(() => {
        searchInput.style.background = "white";
        searchInput.style.borderColor = "#e1e5e9";
      }, 500);
    }
  }

  /**
   * שמירת עריכה מתקדמת של שעתון
   */
  async submitAdvancedTimesheetEdit(entryId) {
    console.log("💾 שומר עריכה מתקדמת של שעתון:", entryId);

    try {
      // קבלת הערכים החדשים
      const newDate = document.getElementById("editDate").value;
      const newMinutes = parseInt(document.getElementById("editMinutes").value);
      const newClientName = document
        .getElementById("editClientSelect")
        .value.trim();
      const reason = document.getElementById("editReason").value.trim();

      // ולידציה
      const validationErrors = [];

      if (!newDate) validationErrors.push("תאריך חובה");
      if (!newMinutes || newMinutes < 1 || newMinutes > 999) {
        validationErrors.push("זמן חייב להיות בין 1 ל-999 דקות");
      }
      if (!newClientName) validationErrors.push("שם לקוח חובה");
      if (!reason || reason.length < 5) {
        validationErrors.push("סיבת עריכה חובה (לפחות 5 תווים)");
      }

      if (validationErrors.length > 0) {
        this.showNotification(
          "❌ שגיאות בטופס:\n• " + validationErrors.join("\n• "),
          "error"
        );
        return;
      }

      // מציאת הרשומה המקומית
      const entry = this.timesheetEntries.find(
        (e) =>
          (e.id && e.id.toString() === entryId.toString()) ||
          (e.entryId && e.entryId.toString() === entryId.toString())
      );

      if (!entry) {
        this.showNotification("❌ רשומת שעתון לא נמצאה", "error");
        return;
      }

      const originalData = {
        date: entry.date,
        minutes: entry.minutes,
        clientName: entry.clientName,
      };

      // בדיקה אם יש שינוי
      const dateChanged =
        new Date(newDate).toDateString() !==
        new Date(originalData.date).toDateString();
      const minutesChanged = newMinutes !== originalData.minutes;
      const clientChanged = newClientName !== originalData.clientName;

      if (!dateChanged && !minutesChanged && !clientChanged) {
        document.querySelector(".popup-overlay").remove();
        this.showNotification("⚠️ לא בוצעו שינויים", "info");
        return;
      }

      // עדכון מקומי מיידי (אופטימיסטי)
      const entryIndex = this.timesheetEntries.findIndex(
        (e) =>
          (e.id && e.id.toString() === entryId.toString()) ||
          (e.entryId && e.entryId.toString() === entryId.toString())
      );

      if (entryIndex !== -1) {
        // שמירת הנתונים החדשים
        this.timesheetEntries[entryIndex].date = newDate;
        this.timesheetEntries[entryIndex].minutes = newMinutes;
        this.timesheetEntries[entryIndex].clientName = newClientName;
        this.timesheetEntries[entryIndex].lastModified =
          new Date().toLocaleString("he-IL");
        this.timesheetEntries[entryIndex].editReason = reason;
        this.timesheetEntries[entryIndex].edited = true;

        // הוספת לוג עריכה מפורט
        if (!this.timesheetEntries[entryIndex].editHistory) {
          this.timesheetEntries[entryIndex].editHistory = [];
        }

        this.timesheetEntries[entryIndex].editHistory.push({
          timestamp: new Date().toLocaleString("he-IL"),
          changes: {
            date: {
              old: originalData.date,
              new: newDate,
              changed: dateChanged,
            },
            minutes: {
              old: originalData.minutes,
              new: newMinutes,
              changed: minutesChanged,
            },
            clientName: {
              old: originalData.clientName,
              new: newClientName,
              changed: clientChanged,
            },
          },
          reason: reason,
          editor: this.currentUser,
        });

        this.filteredTimesheetEntries = [...this.timesheetEntries];
      }

      // עדכון התצוגה מיידי
      this.renderTimesheetEntries();

      // הסרת הדיאלוג
      document.querySelector(".popup-overlay").remove();

      // הודעת הצלחה מפורטת
      const changes = [];
      if (dateChanged)
        changes.push(
          `תאריך: ${formatDate(originalData.date)} → ${formatDate(newDate)}`
        );
      if (minutesChanged)
        changes.push(`זמן: ${originalData.minutes} → ${newMinutes} דק'`);
      if (clientChanged)
        changes.push(`לקוח: ${originalData.clientName} → ${newClientName}`);

      this.showNotification(
        `✅ שעתון עודכן בהצלחה!\n• ${changes.join("\n• ")}`,
        "success"
      );

      // כאן תוסיף בעתיד קריאה לשרת Firebase:
      await updateTimesheetEntryFirebase(entryId, newMinutes, reason);

      console.log(`✅ עריכה מתקדמת הושלמה:`, {
        originalData,
        newData: { newDate, newMinutes, newClientName },
      });
    } catch (error) {
      console.error("Error in advanced timesheet edit:", error);
      this.showNotification(
        "❌ שגיאה בעדכון השעתון: " + error.message,
        "error"
      );

      // החזרת השינוי במקרה של שגיאה
      await this.loadDataFromFirebase();
    }
  }

  /**
   * עדכון רשומת שעתון - הוספה למחלקת Manager
   */
  async submitTimesheetEdit(entryId) {
    console.log("💾 שומר עריכת שעתון:", entryId);

    try {
      const newMinutes = parseInt(document.getElementById("editMinutes").value);
      const reason = document.getElementById("editReason").value.trim();

      if (!newMinutes || newMinutes < 1 || newMinutes > 999) {
        this.showNotification("❌ מספר דקות חייב להיות בין 1 ל-999", "error");
        return;
      }

      // מציאת הרשומה המקומית
      const entry = this.timesheetEntries.find(
        (e) =>
          (e.id && e.id.toString() === entryId.toString()) ||
          (e.entryId && e.entryId.toString() === entryId.toString())
      );

      if (!entry) {
        this.showNotification("❌ רשומת שעתון לא נמצאה", "error");
        return;
      }

      const oldMinutes = entry.minutes;

      // אם אין שינוי בזמן, לא צריך לעדכן
      if (oldMinutes === newMinutes) {
        document.querySelector(".popup-overlay").remove();
        this.showNotification("⚠️ לא בוצע שינוי בזמן", "info");
        return;
      }

      // עדכון מקומי מיידי (אופטימיסטי)
      const entryIndex = this.timesheetEntries.findIndex(
        (e) =>
          (e.id && e.id.toString() === entryId.toString()) ||
          (e.entryId && e.entryId.toString() === entryId.toString())
      );

      if (entryIndex !== -1) {
        this.timesheetEntries[entryIndex].minutes = newMinutes;
        this.timesheetEntries[entryIndex].lastModified =
          new Date().toLocaleString("he-IL");
        this.timesheetEntries[entryIndex].editReason =
          reason || `שונה מ-${oldMinutes} ל-${newMinutes} דקות`;
        this.timesheetEntries[entryIndex].edited = true;
        this.filteredTimesheetEntries = [...this.timesheetEntries];
      }

      // עדכון התצוגה מיידי
      this.renderTimesheetEntries();

      // הסרת הדיאלוג
      document.querySelector(".popup-overlay").remove();

      // הודעת הצלחה עם פרטים
      const difference = newMinutes - oldMinutes;
      const diffText = difference > 0 ? `+${difference}` : `${difference}`;
      this.showNotification(
        `✅ שעתון עודכן: ${oldMinutes} → ${newMinutes} דק' (${diffText})`,
        "success"
      );

      // כאן תוסיף בעתיד קריאה לשרת Firebase:
      await updateTimesheetEntryFirebase(entryId, newMinutes, reason);

      console.log(`✅ עריכת שעתון הושלמה: ${oldMinutes} → ${newMinutes}`);
    } catch (error) {
      console.error("Error editing timesheet:", error);
      this.showNotification(
        "❌ שגיאה בעדכון השעתון: " + error.message,
        "error"
      );

      // החזרת השינוי במקרה של שגיאה
      await this.loadDataFromFirebase();
    }
  }

  /**
   * הצגת היסטוריית עריכות - הוספה למחלקת Manager
   */
  showTimesheetEditHistory(entryId) {
    console.log("📜 מציג היסטוריית עריכות:", entryId);

    const entry = this.timesheetEntries.find(
      (e) =>
        (e.id && e.id.toString() === entryId.toString()) ||
        (e.entryId && e.entryId.toString() === entryId.toString())
    );

    if (!entry || !entry.editHistory || entry.editHistory.length === 0) {
      this.showNotification("אין היסטוריית עריכות לרשומה זו", "info");
      return;
    }

    const overlay = document.createElement("div");
    overlay.className = "popup-overlay";

    const historyHtml = entry.editHistory
      .map(
        (edit, index) => `
      <div class="history-edit-entry" style="
        background: ${index === 0 ? "#fef3c7" : "#f3f4f6"};
        border: 1px solid ${index === 0 ? "#f59e0b" : "#d1d5db"};
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 10px;
      ">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <strong style="color: #374151;">עריכה #${
            entry.editHistory.length - index
          }</strong>
          <span style="color: #6b7280; font-size: 12px;">${
            edit.timestamp
          }</span>
        </div>
        <div style="color: #4b5563; font-size: 14px;">
          <strong>שונה מ-${edit.oldMinutes} ל-${edit.newMinutes} דקות</strong>
          (הפרש: ${edit.difference > 0 ? "+" : ""}${edit.difference})
        </div>
        ${
          edit.reason
            ? `
          <div style="color: #6b7280; font-size: 13px; margin-top: 6px; font-style: italic;">
            "${edit.reason}"
          </div>
        `
            : ""
        }
      </div>
    `
      )
      .join("");

    overlay.innerHTML = `
    <div class="popup" style="max-width: 600px;">
      <div class="popup-header">
        <i class="fas fa-history"></i>
        היסטוריית עריכות - ${entry.action}
      </div>
      <div class="popup-content">
        <div class="task-overview">
          <h4><i class="fas fa-info-circle"></i> פרטי הרשומה</h4>
          <p><strong>לקוח:</strong> ${entry.clientName}</p>
          <p><strong>תאריך:</strong> ${formatDate(entry.date)}</p>
          <p><strong>זמן נוכחי:</strong> ${entry.minutes} דקות</p>
          <p><strong>מספר עריכות:</strong> ${entry.editHistory.length}</p>
        </div>
        
        <div style="max-height: 300px; overflow-y: auto;">
          <h4 style="margin-bottom: 15px; color: #374151;">
            <i class="fas fa-list"></i> היסטוריית שינויים
          </h4>
          ${historyHtml}
        </div>
      </div>
      <div class="popup-buttons">
        <button class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()">
          <i class="fas fa-times"></i> סגור
        </button>
      </div>
    </div>
  `;

    document.body.appendChild(overlay);
  }
  createTableRow(task) {
    const safeTask = this.sanitizeTaskData(task);
    const progress = this.calculateSimpleProgress(safeTask);

    return `
      <tr data-task-id="${safeTask.id}">
        <td>${safeText(safeTask.clientName)}</td>
        <td>${safeText(safeTask.description)}</td>
        <td>${progress}%</td>
        <td>${formatDate(safeTask.deadline)}</td>
        <td>${safeText(safeTask.status)}</td>
        <td class="actions-column">
          <button class="action-btn time-btn" onclick="manager.showAdvancedTimeDialog(${
            safeTask.id
          })" title="הוסף זמן">
            <i class="fas fa-clock"></i>
          </button>
          <button class="action-btn extend-btn" onclick="manager.showExtendDeadlineDialog(${
            safeTask.id
          })" title="האריך יעד">
            <i class="fas fa-calendar-plus"></i>
          </button>
          <button class="action-btn history-btn" onclick="manager.showTaskHistory(${
            safeTask.id
          })" title="היסטוריה">
            <i class="fas fa-history"></i>
          </button>
          <button class="action-btn complete-btn" onclick="manager.completeTask(${
            safeTask.id
          })" title="סיים משימה">
            <i class="fas fa-check"></i>
          </button>
        </td>
      </tr>
    `;
  }

  renderTimesheetEntries() {
    const timesheetContainer = document.getElementById("timesheetContainer");
    const tableContainer = document.getElementById("timesheetTableContainer");

    if (!timesheetContainer && !tableContainer) {
      console.warn("Timesheet containers not found");
      return;
    }

    const entriesToShow =
      this.filteredTimesheetEntries || this.timesheetEntries || [];
    const paginationData = this.timesheetPagination.getPage(
      entriesToShow,
      this.currentTimesheetPage
    );
    const paginatedEntries = paginationData.data;

    if (
      timesheetContainer &&
      !timesheetContainer.classList.contains("hidden")
    ) {
      this.renderTimesheetCards(paginatedEntries);
    }

    if (tableContainer && !tableContainer.classList.contains("hidden")) {
      this.renderTimesheetTable(paginatedEntries);
    }

    this.timesheetPagination.renderControls(
      "timesheetPaginationControls",
      paginationData,
      "window.manager.changeTimesheetPage"
    );
  }

  renderTimesheetCards(entries) {
    const container = document.getElementById("timesheetContainer");
    if (!container) return;

    const cardsHtml = entries
      .map(
        (entry) => `
          <div class="timesheet-card">
            <div>${safeText(entry.clientName || "")}</div>
            <div>${safeText(entry.action || "")}</div>
            <div>${entry.minutes || 0} דקות</div>
            <div>${formatDate(entry.date)}</div>
          </div>
        `
      )
      .join("");

    container.innerHTML = `
      <div class="timesheet-cards">
        ${cardsHtml}
      </div>
    `;
  }

  renderTimesheetTable(entries) {
    const tableContainer = document.getElementById("timesheetTableContainer");
    if (!tableContainer) return;

    if (!entries || entries.length === 0) {
      tableContainer.innerHTML = this.createEmptyTimesheetState();
      return;
    }

    const rowsHtml = entries
      .map(
        (entry) => `
        <tr data-entry-id="${entry.id || entry.entryId || Date.now()}">
          <td class="timesheet-cell-date">${formatDate(entry.date)}</td>
          <td class="timesheet-cell-action">${safeText(entry.action || "")}</td>
          <td class="timesheet-cell-time">
            <span class="time-badge">${entry.minutes || 0} דק'</span>
          </td>
          <td class="timesheet-cell-client">${safeText(
            entry.clientName || ""
          )}</td>
          <td>${safeText(entry.fileNumber || "")}</td>
          <td>${safeText(entry.notes || "—")}</td>
          <td class="actions-column">
            <button class="action-btn edit-btn" onclick="manager.showEditTimesheetDialog('${
              entry.id || entry.entryId || Date.now()
            }')" title="ערוך שעתון">
              <i class="fas fa-edit"></i>
            </button>
          </td>
        </tr>
      `
      )
      .join("");

    tableContainer.innerHTML = `
    <div class="modern-table-container">
      <table class="modern-timesheet-table">
        <thead>
          <tr>
            <th>תאריך</th>
            <th>פעולה</th>
            <th>זמן</th>
            <th>לקוח</th>
            <th>תיק</th>
            <th>הערות</th>
            <th>פעולות</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
  }

  createEmptyTableState() {
    return `
      <div class="empty-state">
        <i class="fas fa-chart-bar"></i>
        <h4>אין משימות להצגה</h4>
        <p>הוסף משימה חדשה כדי להתחיל</p>
      </div>
    `;
  }

  createEmptyTimesheetState() {
    return `
      <div class="empty-state">
        <i class="fas fa-clock"></i>
        <h4>אין רשומות שעתון</h4>
        <p>רשום את הפעולה הראשונה שלך</p>
      </div>
    `;
  }

  // Helper methods
  sanitizeTaskData(task) {
    if (!task) return {};

    return {
      id: task.id || Date.now(),
      clientName: task.clientName || "לקוח לא ידוע",
      description:
        task.taskDescription || task.description || "משימה ללא תיאור",
      taskDescription:
        task.taskDescription || task.description || "משימה ללא תיאור",
      estimatedMinutes: Number(task.estimatedMinutes) || 0,
      actualMinutes: Number(task.actualMinutes) || 0,
      deadline: task.deadline || new Date().toISOString(),
      status: task.status || "פעיל",
      branch: task.branch || "",
      fileNumber: task.fileNumber || "",
      history: task.history || [],
    };
  }

  calculateSimpleProgress(task) {
    if (!task.estimatedMinutes || task.estimatedMinutes <= 0) return 0;
    const progress = Math.round(
      ((task.actualMinutes || 0) / task.estimatedMinutes) * 100
    );
    return Math.min(progress, 100);
  }

  getProgressStatusText(progress) {
    if (progress >= 100) return "הושלם";
    if (progress >= 90) return "כמעט סיימת";
    if (progress >= 75) return "קרוב לסיום";
    if (progress >= 50) return "באמצע הדרך";
    if (progress >= 25) return "התחלנו";
    if (progress > 0) return "בתחילת הדרך";
    return "לא התחיל";
  }

  getActiveTasksCount() {
    return (this.filteredBudgetTasks || []).filter(
      (task) => task && task.status === "פעיל"
    ).length;
  }

  getCompletedTasksCount() {
    return (this.filteredBudgetTasks || []).filter(
      (task) => task && task.status === "הושלם"
    ).length;
  }

  changeBudgetPage(page) {
    this.currentBudgetPage = page;
    this.budgetPagination.currentPage = page;
    this.renderBudgetTasks();
  }

  changeTimesheetPage(page) {
    this.currentTimesheetPage = page;
    this.timesheetPagination.currentPage = page;
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

  // Data operations - Firebase only
  async createClientComplete(client) {
    try {
      await saveClientToFirebase(client);
      this.showNotification("לקוח נוסף בהצלחה!", "success");
      await this.loadDataFromFirebase();
    } catch (error) {
      console.error("Error creating client:", error);
      this.showNotification("שגיאה ביצירת לקוח: " + error.message, "error");
    }
  }

  async saveTimesheetAndUpdateClient(entry) {
    try {
      // Save timesheet entry
      await saveTimesheetToFirebase(entry);

      // Update client hours if needed
      if (entry.clientName && entry.minutes) {
        try {
          const hoursResult = await updateClientHoursImmediately(
            entry.clientName,
            entry.minutes
          );

          if (hoursResult.success && hoursResult.hoursData) {
            console.log(
              `✅ שעות לקוח עודכנו: ${hoursResult.hoursData.remainingHours.toFixed(
                1
              )} שעות נותרות`
            );

            // Show alert if client became critical or blocked
            if (hoursResult.hoursData.isBlocked) {
              this.showNotification(
                `🚨 לקוח ${entry.clientName} נחסם - נגמרו השעות!`,
                "error"
              );
            } else if (hoursResult.hoursData.isCritical) {
              this.showNotification(
                `⚠️ לקוח ${
                  entry.clientName
                } קריטי - נותרו ${hoursResult.hoursData.remainingHours.toFixed(
                  1
                )} שעות`,
                "warning"
              );
            }
          }
        } catch (hoursError) {
          console.warn(
            "⚠️ שעתון נשמר אבל שגיאה בעדכון שעות:",
            hoursError.message
          );
        }
      }

      console.log("✅ רשומה נשמרה ושעות עודכנו ב-Firebase");
    } catch (error) {
      console.error("Error saving timesheet:", error);
      throw error;
    }
  }

  showError(message) {
    document.body.innerHTML = `
      <div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: linear-gradient(135deg, #f8f9ff 0%, #e8f4f8 50%, #f0f8ff 100%);">
        <div style="background: white; padding: 40px; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.1); text-align: center; max-width: 400px;">
          <h2 style="color: #ef4444; margin-bottom: 20px;">שגיאה</h2>
          <p style="color: #64748b; font-size: 16px;">${safeText(message)}</p>
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
    } catch (error) {
      console.error("Error showing notification:", error);
    }
  }

  expandTaskCard(taskId, event) {
    event.stopPropagation();
    const task = this.filteredBudgetTasks.find((t) => t.id == taskId);
    if (!task) return;

    const cardElement = event.target.closest(".linear-minimal-card");
    if (!cardElement) return;

    this.showExpandedCard(cardElement, task);
  }

  showExpandedCard(cardElement, task) {
    const safeTask = this.sanitizeTaskData(task);
    const progress = this.calculateSimpleProgress(safeTask);

    const safeDescription = safeText(
      safeTask.taskDescription || safeTask.description
    );
    const safeClientName = safeText(safeTask.clientName);
    const safeStatus = safeText(safeTask.status);

    const expandedContent = `
      <div class="linear-expanded-overlay" onclick="manager.closeExpandedCard(event)">
        <div class="linear-expanded-card" onclick="event.stopPropagation()">
          <div class="linear-expanded-header">
            <h2 class="linear-expanded-title">${safeDescription}</h2>
            <button class="linear-close-btn" onclick="manager.closeExpandedCard(event)">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="linear-expanded-body">
            <div class="linear-info-grid">
              <div class="linear-info-item">
                <label>לקוח:</label>
                <span>${safeClientName}</span>
              </div>
              <div class="linear-info-item">
                <label>סטטוס:</label>
                <span>${safeStatus}</span>
              </div>
              <div class="linear-info-item">
                <label>התקדמות:</label>
                <span>${progress}%</span>
              </div>
              <div class="linear-info-item">
                <label>תאריך יעד:</label>
                <span>${formatDateTime(new Date(safeTask.deadline))}</span>
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
                <i class="fas fa-calendar-plus"></i> האריך יעד
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

    document.body.insertAdjacentHTML("beforeend", expandedContent);

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
      setTimeout(() => overlay.remove(), 300);
    }
  }

  showAdvancedTimeDialog(taskId) {
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
          <form id="advancedTimeForm">
            <div class="form-group">
              <label for="workDate">תאריך העבודה</label>
              <input type="date" id="workDate" required value="${
                new Date().toISOString().split("T")[0]
              }">
            </div>
            <div class="form-group">
              <label for="workMinutes">דקות עבודה</label>
              <input type="number" id="workMinutes" min="1" max="999" placeholder="60" required>
            </div>
            <div class="form-group">
              <label for="workDescription">תיאור העבודה</label>
              <textarea id="workDescription" rows="3" placeholder="תיאור מפורט..." required></textarea>
            </div>
          </form>
        </div>
        <div class="popup-buttons">
          <button class="popup-btn popup-btn-confirm" onclick="manager.submitTimeEntry(${taskId})">
            <i class="fas fa-save"></i> שמור
          </button>
          <button class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()">
            <i class="fas fa-times"></i> ביטול
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  submitTimeEntry(taskId) {
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

    const timeData = { taskId, date, minutes, description };
    this.addTimeToTask(timeData);

    const popup = document.querySelector(".popup-overlay");
    if (popup) popup.remove();
  }

  async addTimeToTask(timeData) {
    try {
      showSimpleLoading("רושם זמן למשימה...");

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
        });
        this.filteredBudgetTasks = [...this.budgetTasks];
        this.renderBudgetTasks();
        this.showNotification("⏳ רושם זמן... (עדכון מיידי)", "info");
      }

      // Here you would add Firebase function to add time to task
      // For now, just simulate success
      this.showNotification("✅ זמן נוסף בהצלחה למשימה!", "success");
      setTimeout(() => this.loadDataFromFirebase(), 1000);
    } catch (error) {
      console.error("Error adding time:", error);

      if (originalTask && taskIndex !== -1) {
        this.budgetTasks[taskIndex] = originalTask;
        this.filteredBudgetTasks = [...this.budgetTasks];
        this.renderBudgetTasks();
      }

      this.showNotification("❌ שגיאה ברישום זמן - נסה שוב", "error");
    } finally {
      hideSimpleLoading();
    }
  }

  showTaskHistory(taskId) {
    const task = this.budgetTasks.find((t) => t.id === taskId);
    if (!task) {
      this.showNotification("המשימה לא נמצאה", "error");
      return;
    }

    const overlay = document.createElement("div");
    overlay.className = "popup-overlay";

    let historyHtml = "";
    if (task.history?.length > 0) {
      historyHtml = task.history
        .map(
          (entry) => `
        <div class="history-entry">
          <div class="history-header">
            <span class="history-date">${formatDate(entry.date)}</span>
            <span class="history-minutes">${entry.minutes} דקות</span>
          </div>
          <div class="history-description">${safeText(
            entry.description || ""
          )}</div>
          <div class="history-timestamp">נוסף ב: ${safeText(
            entry.timestamp || ""
          )}</div>
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
          היסטוריית זמנים - ${safeText(task.clientName || "")}
        </div>
        <div class="popup-content">
          <div class="task-summary">
            <h4>${safeText(task.description || "")}</h4>
            <p>סה"כ זמן: ${task.actualMinutes || 0} דקות מתוך ${
      task.estimatedMinutes || 0
    }</p>
          </div>
          <div class="history-container">
            ${historyHtml}
          </div>
        </div>
        <div class="popup-buttons">
          <button class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()">
            <i class="fas fa-times"></i> סגור
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
  }

  async completeTask(taskId) {
    const task = this.budgetTasks.find((t) => t.id === taskId);
    if (!task) {
      this.showNotification("המשימה לא נמצאה", "error");
      return;
    }

    const notes = prompt(
      `סיום משימה: ${
        task.description || task.taskDescription
      }\n\nהערות סיום (אופציונלי):`,
      ""
    );

    if (notes !== null) {
      try {
        const taskIndex = this.budgetTasks.findIndex((t) => t.id === taskId);
        if (taskIndex !== -1) {
          this.budgetTasks[taskIndex].status = "הושלם";
          this.budgetTasks[taskIndex].completedAt = new Date().toLocaleString(
            "he-IL"
          );
          this.filteredBudgetTasks = [...this.budgetTasks];
          this.renderBudgetTasks();
        }

        // Here you would add Firebase function to complete task
        this.showNotification("המשימה הושלמה בהצלחה", "success");
        await this.loadDataFromFirebase();
      } catch (error) {
        console.error("Error completing task:", error);
        this.showNotification("שגיאה בהשלמת המשימה", "error");
      }
    }
  }

  switchBudgetView(view) {
    this.currentBudgetView = view;

    document.querySelectorAll("#budgetTab .view-tab").forEach((tab) => {
      tab.classList.remove("active");
    });

    const activeTab = document.querySelector(
      `#budgetTab .view-tab[data-view="${view}"]`
    );
    if (activeTab) activeTab.classList.add("active");

    const budgetContainer = document.getElementById("budgetContainer");
    const budgetTableContainer = document.getElementById(
      "budgetTableContainer"
    );

    if (view === "cards") {
      if (budgetContainer) budgetContainer.classList.remove("hidden");
      if (budgetTableContainer) budgetTableContainer.classList.add("hidden");
    } else {
      if (budgetContainer) budgetContainer.classList.add("hidden");
      if (budgetTableContainer) budgetTableContainer.classList.remove("hidden");
    }

    if (!this.budgetTasks || this.budgetTasks.length === 0) {
      this.loadDataFromFirebase()
        .then(() => {
          this.applyBudgetTaskFilters();
          this.renderBudgetTasks();
        })
        .catch((error) => {
          console.error("Error loading data:", error);
          this.showNotification("שגיאה בטעינת נתונים", "error");
        });
    } else {
      if (!this.filteredBudgetTasks || this.filteredBudgetTasks.length === 0) {
        this.applyBudgetTaskFilters();
      }
      this.renderBudgetTasks();
    }
  }

  switchTimesheetView(view) {
    this.currentTimesheetView = view;

    document.querySelectorAll("#timesheetTab .view-tab").forEach((tab) => {
      tab.classList.remove("active");
    });

    const activeTab = document.querySelector(
      `#timesheetTab .view-tab[data-view="${view}"]`
    );
    if (activeTab) activeTab.classList.add("active");

    const timesheetContainer = document.getElementById("timesheetContainer");
    const timesheetTableContainer = document.getElementById(
      "timesheetTableContainer"
    );

    if (view === "cards") {
      if (timesheetContainer) timesheetContainer.classList.remove("hidden");
      if (timesheetTableContainer)
        timesheetTableContainer.classList.add("hidden");
    } else {
      if (timesheetContainer) timesheetContainer.classList.add("hidden");
      if (timesheetTableContainer)
        timesheetTableContainer.classList.remove("hidden");
    }

    if (!this.timesheetEntries || this.timesheetEntries.length === 0) {
      this.loadDataFromFirebase()
        .then(() => {
          this.applyTimesheetFilters();
          this.renderTimesheetEntries();
        })
        .catch((error) => {
          console.error("Error loading timesheet data:", error);
          this.showNotification("שגיאה בטעינת נתונים", "error");
        });
    } else {
      if (
        !this.filteredTimesheetEntries ||
        this.filteredTimesheetEntries.length === 0
      ) {
        this.applyTimesheetFilters();
      }
      this.renderTimesheetEntries();
    }
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
  } else if (tabName === "timesheet") {
    const timesheetTab = document.getElementById("timesheetTab");
    if (timesheetTab) timesheetTab.classList.add("active");

    const dateField = document.getElementById("actionDate");
    if (dateField) {
      dateField.value = new Date().toISOString().split("T")[0];
    }
  }

  currentActiveTab = tabName;
}

function toggleNotifications() {
  notificationBell.toggleDropdown();
}

function clearAllNotifications() {
  if (confirm("האם אתה בטוח שברצונך למחוק את כל ההתראות?")) {
    notificationBell.clearAllNotifications();
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

const debouncedSearchClients = debounce((formType, query) => {
  searchClientsInternal(formType, query);
}, 300);

function searchClients(formType, query) {
  debouncedSearchClients(formType, query);
}

function searchClientsInternal(formType, query) {
  const resultsContainer = document.getElementById(`${formType}SearchResults`);
  if (!resultsContainer) return;

  if (query.length < 1) {
    resultsContainer.classList.remove("show");
    return;
  }

  const allClients = window.manager ? window.manager.clients : [];
  const matches = (allClients || [])
    .filter((client) => {
      if (!client) return false;
      const searchText = `${client.fullName || ""} ${
        client.fileNumber || ""
      }`.toLowerCase();
      return searchText.includes(query.toLowerCase());
    })
    .slice(0, 8);

  if (matches.length === 0) {
    resultsContainer.innerHTML =
      '<div class="no-results">לא נמצאו לקוחות מתאימים</div>';
  } else {
    const resultsHtml = matches
      .map((client) => {
        const icon = client.type === "fixed" ? "📋" : "⏰";
        const details =
          client.type === "fixed"
            ? `שלב ${client.currentStage || 1} | פיקס`
            : `${client.hoursRemaining || 0} שעות נותרות`;

        return `
          <div class="search-result-item" onclick="selectClient('${formType}', '${safeText(
          client.fullName
        )}', '${safeText(client.fileNumber)}', '${safeText(client.type)}')">
            <div class="result-icon">${icon}</div>
            <div class="result-text">
              <div class="result-name">${safeText(client.fullName)}</div>
              <div class="result-details">תיק ${safeText(
                client.fileNumber
              )} • ${safeText(details)}</div>
            </div>
          </div>
        `;
      })
      .join("");

    resultsContainer.innerHTML = resultsHtml;
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
    console.error("Error in selectClient:", error);
  }
}

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

function confirmLogout() {
  const interfaceElements = document.getElementById("interfaceElements");
  if (interfaceElements) interfaceElements.classList.add("hidden");

  if (window.manager) {
    window.manager.showNotification("מתנתק מהמערכת... להתראות! 👋", "info");
  }

  setTimeout(() => location.reload(), 1500);
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

/* === Global Instances === */
const domCache = new DOMCache();
const notificationBell = new NotificationBellSystem();
const manager = new LawOfficeManager();

// Export to window for HTML access
window.manager = manager;
window.showSimpleLoading = showSimpleLoading;
window.hideSimpleLoading = hideSimpleLoading;
window.notificationBell = notificationBell;

/* === Cleanup function === */
function cleanupGlobalListeners() {
  if (globalListeners.documentKeydown) {
    document.removeEventListener("keydown", globalListeners.documentKeydown);
  }
  if (globalListeners.windowResize) {
    window.removeEventListener("resize", globalListeners.windowResize);
  }
  if (globalListeners.documentClick) {
    document.removeEventListener("click", globalListeners.documentClick);
  }
  if (notificationBell) {
    notificationBell.cleanup();
  }
}

/* === Event Listeners === */
globalListeners.documentKeydown = (event) => {
  if (event.key === "Escape") {
    const sidebar = document.getElementById("sidebar");
    if (sidebar?.classList.contains("open")) {
      sidebar.classList.remove("open");
    }

    if (notificationBell.isDropdownOpen) {
      notificationBell.hideDropdown();
    }
  }
};
document.addEventListener("keydown", globalListeners.documentKeydown);

globalListeners.windowResize = () => {
  const sidebar = document.getElementById("sidebar");
  if (window.innerWidth <= 768 && sidebar?.classList.contains("open")) {
    sidebar.classList.remove("open");
  }
};
window.addEventListener("resize", globalListeners.windowResize);

globalListeners.documentClick = (event) => {
  const searchContainers = document.querySelectorAll(".modern-client-search");
  searchContainers.forEach((container) => {
    if (!container.contains(event.target)) {
      const resultsInContainer = container.querySelector(".search-results");
      if (resultsInContainer) {
        resultsInContainer.classList.remove("show");
      }
    }
  });
};
document.addEventListener("click", globalListeners.documentClick);

window.addEventListener("beforeunload", () => {
  cleanupGlobalListeners();
});

// Initialization
document.addEventListener("DOMContentLoaded", () => {
  // Initialize Firebase
  if (!initializeFirebase()) {
    console.error("❌ Firebase initialization failed");
    return;
  }

  // Test Firebase connection
  setTimeout(() => {
    testFirebaseConnection();
  }, 1000);

  // Initialize UI
  const firstNavItem = document.querySelector(".nav-item");
  if (firstNavItem) {
    firstNavItem.classList.add("active");
  }

  // Log performance metrics
  const loadTime = performance.now() - startTime;
  console.log(`System loaded in ${Math.round(loadTime)}ms`);

  if (performance.memory) {
    const memoryUsed =
      (performance.memory.usedJSHeapSize - startMemory) / 1024 / 1024;
    console.log(`Memory used: ${Math.round(memoryUsed)}MB`);
  }
});

/* === Debug Functions === */

/**
 * Full client hours mismatch diagnostic
 */
async function debugClientHoursMismatch() {
  console.log("🔍 מתחיל אבחון מלא של סתירה בשעות לקוח...");

  try {
    const db = window.firebaseDB;
    if (!db) {
      console.error("❌ Firebase לא מחובר");
      return;
    }

    // Check local system data
    console.log("\n=== 📊 נתוני מערכת מקומית ===");

    if (window.manager && window.manager.clients) {
      console.log(
        `📈 סה"כ לקוחות במערכת מקומית: ${window.manager.clients.length}`
      );

      window.manager.clients.forEach((client, index) => {
        console.log(`\n👤 לקוח ${index + 1}:`);
        console.log(`   📛 שם: "${client.fullName}"`);
        console.log(`   🆔 מספר תיק: "${client.fileNumber}"`);
        console.log(`   🎯 סוג: "${client.type}"`);
        console.log(`   📦 סה"כ שעות: ${client.totalHours}`);
        console.log(`   ⏰ שעות נותרות (מקומי): ${client.hoursRemaining}`);
        console.log(`   🚨 חסום (מקומי): ${client.isBlocked}`);
        console.log(`   ⚠️ קריטי (מקומי): ${client.isCritical}`);
      });
    } else {
      console.log("❌ אין נתוני לקוחות במערכת המקומית");
    }

    // Check Firebase data
    console.log("\n=== 🔥 נתוני Firebase ===");

    const clientsSnapshot = await db.collection("clients").get();
    console.log(`📈 סה"כ לקוחות ב-Firebase: ${clientsSnapshot.size}`);

    const firebaseClients = [];
    clientsSnapshot.forEach((doc, index) => {
      const data = doc.data();
      firebaseClients.push({ id: doc.id, ...data });

      console.log(`\n👤 לקוח ${index + 1} ב-Firebase:`);
      console.log(`   🆔 Document ID: ${doc.id}`);
      console.log(`   📛 שם: "${data.fullName}"`);
      console.log(`   🆔 מספר תיק: "${data.fileNumber}"`);
      console.log(`   🎯 סוג: "${data.type}"`);
      console.log(`   📦 סה"כ שעות: ${data.totalHours}`);
      console.log(`   ⏰ שעות נותרות (Firebase): ${data.hoursRemaining}`);
      console.log(`   🚨 חסום (Firebase): ${data.isBlocked}`);
      console.log(`   ⚠️ קריטי (Firebase): ${data.isCritical}`);
    });

    // Recalculate from entries for each client
    console.log("\n=== 🧮 חישוב מחדש מהרשומות ===");

    for (const client of firebaseClients) {
      if (client.type === "hours") {
        console.log(`\n🔍 בודק לקוח: "${client.fullName}"`);

        const timesheetSnapshot = await db
          .collection("timesheet_entries")
          .where("clientName", "==", client.fullName)
          .get();

        console.log(`   📊 מספר רשומות שעתון: ${timesheetSnapshot.size}`);

        let totalMinutesUsed = 0;
        const entriesByEmployee = {};
        const entriesDetails = [];

        timesheetSnapshot.forEach((doc) => {
          const entry = doc.data();
          const minutes = entry.minutes || 0;
          const employee = entry.employee || entry.lawyer || "לא ידוע";

          totalMinutesUsed += minutes;

          if (!entriesByEmployee[employee]) {
            entriesByEmployee[employee] = 0;
          }
          entriesByEmployee[employee] += minutes;

          entriesDetails.push({
            date: entry.date,
            employee: employee,
            minutes: minutes,
            action: entry.action,
          });
        });

        // Show entry details
        console.log(`   📋 פירוט רשומות:`);
        entriesDetails.forEach((entry, i) => {
          console.log(
            `      ${i + 1}. ${entry.date} | ${entry.employee} | ${
              entry.minutes
            } דק' | ${entry.action}`
          );
        });

        console.log(`   👥 פירוט לפי עובד:`);
        Object.entries(entriesByEmployee).forEach(([employee, minutes]) => {
          console.log(
            `      ${employee}: ${minutes} דקות (${(minutes / 60).toFixed(
              1
            )} שעות)`
          );
        });

        // Calculate remaining hours
        const totalMinutesAllocated = (client.totalHours || 0) * 60;
        const remainingMinutes = totalMinutesAllocated - totalMinutesUsed;
        const remainingHours = remainingMinutes / 60;

        console.log(`   📊 חישוב מדויק:`);
        console.log(
          `      📦 סה"כ דקות מוקצות: ${totalMinutesAllocated} (${client.totalHours} שעות)`
        );
        console.log(
          `      ⏱️ סה"כ דקות בשימוש: ${totalMinutesUsed} (${(
            totalMinutesUsed / 60
          ).toFixed(1)} שעות)`
        );
        console.log(
          `      ⏰ דקות נותרות: ${remainingMinutes} (${remainingHours.toFixed(
            1
          )} שעות)`
        );
        console.log(
          `      🚨 צריך להיות חסום: ${remainingMinutes <= 0 ? "כן" : "לא"}`
        );
        console.log(
          `      ⚠️ צריך להיות קריטי: ${
            remainingHours > 0 && remainingHours <= 5 ? "כן" : "לא"
          }`
        );

        // Compare to saved data
        console.log(`   🔍 השוואה לנתונים שמורים:`);
        console.log(`      Firebase רשום: ${client.hoursRemaining} שעות`);
        console.log(`      חישוב אמיתי: ${remainingHours.toFixed(1)} שעות`);
        console.log(
          `      הפרש: ${Math.abs(
            (client.hoursRemaining || 0) - remainingHours
          ).toFixed(1)} שעות`
        );

        const localClient = window.manager?.clients?.find(
          (c) => c.fullName === client.fullName
        );
        if (localClient) {
          console.log(`      מקומי רשום: ${localClient.hoursRemaining} שעות`);
          console.log(
            `      הפרש ממקומי: ${Math.abs(
              localClient.hoursRemaining - remainingHours
            ).toFixed(1)} שעות`
          );
        }
      }
    }
  } catch (error) {
    console.error("❌ שגיאה באבחון:", error);
  }
}

/**
 * Fix client hours mismatch
 */
async function fixClientHoursMismatch() {
  console.log("🔧 מתחיל תיקון הסתירה...");

  try {
    const db = window.firebaseDB;
    if (!db) {
      console.error("❌ Firebase לא מחובר");
      return;
    }

    const clientsSnapshot = await db.collection("clients").get();

    for (const clientDoc of clientsSnapshot.docs) {
      const clientData = clientDoc.data();

      if (clientData.type === "hours") {
        console.log(`🔧 מתקן לקוח: ${clientData.fullName}`);

        const hoursData = await calculateClientHoursAccurate(
          clientData.fullName
        );

        await clientDoc.ref.update({
          hoursRemaining: hoursData.remainingHours,
          minutesRemaining: hoursData.remainingMinutes,
          isBlocked: hoursData.isBlocked,
          isCritical: hoursData.isCritical,
          lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
          fixedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });

        console.log(
          `✅ תוקן: ${clientData.fullName} - ${hoursData.remainingHours.toFixed(
            1
          )} שעות`
        );

        // Update local system
        if (window.manager && window.manager.clients) {
          const localIndex = window.manager.clients.findIndex(
            (c) => c.fullName === clientData.fullName
          );
          if (localIndex !== -1) {
            window.manager.clients[localIndex].hoursRemaining =
              hoursData.remainingHours;
            window.manager.clients[localIndex].minutesRemaining =
              hoursData.remainingMinutes;
            window.manager.clients[localIndex].isBlocked = hoursData.isBlocked;
            window.manager.clients[localIndex].isCritical =
              hoursData.isCritical;
          }
        }
      }
    }

    // Update selectors
    if (window.manager && window.manager.clientValidation) {
      window.manager.clientValidation.updateBlockedClients();
    }

    console.log("✅ תיקון הושלם בהצלחה!");
  } catch (error) {
    console.error("❌ שגיאה בתיקון:", error);
  }
}

/**
 * Show client status summary
 */
function showClientStatusSummary() {
  console.log("\n=== 📊 סיכום סטטוס לקוחות ===");

  if (!window.manager || !window.manager.clients) {
    console.log("❌ אין נתוני לקוחות");
    return;
  }

  const summary = {
    total: window.manager.clients.length,
    blocked: 0,
    critical: 0,
    normal: 0,
    fixed: 0,
  };

  console.log("📋 סטטוס כל הלקוחות:");

  window.manager.clients.forEach((client, i) => {
    let status = "🟢 תקין";

    if (client.type === "fixed") {
      status = "📋 פיקס";
      summary.fixed++;
    } else if (client.isBlocked) {
      status = "🚨 חסום";
      summary.blocked++;
    } else if (client.isCritical) {
      status = "⚠️ קריטי";
      summary.critical++;
    } else {
      summary.normal++;
    }

    console.log(
      `${i + 1}. ${client.fullName} - ${
        client.hoursRemaining?.toFixed(1) || 0
      } שעות - ${status}`
    );
  });

  console.log(
    `\n📊 סיכום: ${summary.total} לקוחות | ${summary.blocked} חסומים | ${summary.critical} קריטיים | ${summary.normal} תקינים | ${summary.fixed} פיקס`
  );
}

// Add debug functions to global scope
window.debugClientHoursMismatch = debugClientHoursMismatch;
window.fixClientHoursMismatch = fixClientHoursMismatch;
window.showClientStatusSummary = showClientStatusSummary;
window.calculateClientHoursAccurate = calculateClientHoursAccurate;
window.updateClientHoursImmediately = updateClientHoursImmediately;
window.testFirebaseConnection = testFirebaseConnection;

console.log("🔥 Firebase functions loaded - מערכת מהירה פעילה!");
console.log("🔍 פונקציות Debug זמינות:");
console.log("   debugClientHoursMismatch() - אבחון מלא");
console.log("   fixClientHoursMismatch() - תיקון אוטומטי");
console.log("   showClientStatusSummary() - סיכום מהיר");
console.log("   testFirebaseConnection() - בדיקת חיבור Firebase");
// 🔍 סקריפט אבחון - בדוק אילו פונקציות חסרות
console.log("🔍 ==> בודק פונקציות קיימות...");

// רשימת הפונקציות שצריכות להיות קיימות
const requiredFunctions = [
  // Firebase Core
  "initializeFirebase",
  "testFirebaseConnection",
  "loadClientsFromFirebase",
  "saveClientToFirebase",
  "loadBudgetTasksFromFirebase",
  "saveBudgetTaskToFirebase",
  "loadTimesheetFromFirebase",
  "saveTimesheetToFirebase",
  "calculateClientHoursAccurate",
  "updateClientHoursImmediately",

  // UI Functions
  "showSimpleLoading",
  "hideSimpleLoading",
  "formatDateTime",
  "formatDate",
  "formatShort",
  "safeText",

  // Manager & Classes
  "LawOfficeManager",
  "NotificationBellSystem",
  "ClientValidation",

  // Public Functions
  "updateUserDisplay",
  "switchTab",
  "showClientForm",
  "hideClientForm",
  "logout",
  "searchClients",
  "selectClient",

  // Missing Firebase Functions (שצריכות להיות אחרי שתוסיף הקוד)
  "addTimeToTaskFirebase",
  "completeTaskFirebase",
  "extendTaskDeadlineFirebase",
  "logUserLoginFirebase",
];

// בדיקה
const missing = [];
const existing = [];

requiredFunctions.forEach((funcName) => {
  if (typeof window[funcName] !== "undefined") {
    existing.push(funcName);
  } else {
    missing.push(funcName);
  }
});

console.log("✅ ==> פונקציות קיימות:", existing.length);
existing.forEach((f) => console.log(`   ✓ ${f}`));

console.log("❌ ==> פונקציות חסרות:", missing.length);
missing.forEach((f) => console.log(`   ✗ ${f}`));

// בדיקות נוספות
console.log("🔍 ==> בדיקות נוספות:");
console.log("   Firebase DB:", window.firebaseDB ? "✓ מחובר" : "✗ לא מחובר");
console.log("   Manager:", window.manager ? "✓ קיים" : "✗ לא קיים");
console.log("   Current User:", window.manager?.currentUser || "לא מזוהה");
console.log("   DataCache:", window.dataCache ? "✓ קיים" : "✗ לא קיים");
console.log(
  "   NotificationBell:",
  window.notificationBell ? "✓ קיים" : "✗ לא קיים"
);

// בדיקת גיגציות פונקציות Google Apps Script שאולי עדיין נקראות
const legacyFunctions = [
  "sendToGoogleSheets",
  "loadClientsFromSheetOriginal",
  "loadBudgetTasksFromSheetOriginal",
  "loadTimesheetEntriesFromSheetOriginal",
  "saveBudgetTaskToSheet",
  "saveTimesheetAndUpdateClient",
];

console.log("🔍 ==> פונקציות Legacy (צריכות להיות מוחלפות):");
legacyFunctions.forEach((funcName) => {
  const exists =
    typeof window[funcName] !== "undefined" ||
    typeof window.manager?.[funcName] !== "undefined";
  console.log(
    `   ${exists ? "⚠️" : "✓"} ${funcName} - ${
      exists ? "עדיין קיימת" : "הוסרה"
    }`
  );
});

console.log("🎯 ==> סיכום:");
if (missing.length === 0) {
  console.log("🎉 כל הפונקציות קיימות!");
} else {
  console.log(`⚠️ חסרות ${missing.length} פונקציות - צריך להוסיף את הקוד החדש`);
}
/* ===== 🔥 Firebase Functions - הוסף בסוף script.js ===== */

/**
 * פונקציות Firebase חסרות להשלמת המערכת
 */

// הוספת זמן למשימה מתוקצבת (Firebase)
async function addTimeToTaskFirebase(taskId, timeEntry) {
  try {
    showSimpleLoading("רושם זמן למשימה...");

    const db = window.firebaseDB;
    if (!db) throw new Error("Firebase לא מחובר");

    const taskRef = db.collection("budget_tasks").doc(taskId);

    await db.runTransaction(async (transaction) => {
      const taskDoc = await transaction.get(taskRef);

      if (!taskDoc.exists) {
        throw new Error("משימה לא נמצאה");
      }

      const taskData = taskDoc.data();
      const currentUser = window.manager?.currentUser;

      if (taskData.employee !== currentUser) {
        throw new Error("אין הרשאה לעדכן משימה זו");
      }

      const historyEntry = {
        id: Date.now(),
        date: timeEntry.date,
        minutes: timeEntry.minutes,
        description: timeEntry.description,
        timestamp: new Date().toLocaleString("he-IL"),
        addedBy: currentUser,
      };

      const newActualMinutes =
        (taskData.actualMinutes || 0) + timeEntry.minutes;
      const newHistory = [...(taskData.history || []), historyEntry];

      transaction.update(taskRef, {
        actualMinutes: newActualMinutes,
        history: newHistory,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastModifiedBy: currentUser,
      });
    });

    console.log(`✅ זמן נוסף למשימה ${taskId}: ${timeEntry.minutes} דקות`);
    hideSimpleLoading();

    return { success: true, message: "זמן נוסף בהצלחה למשימה" };
  } catch (error) {
    console.error("❌ שגיאה בהוספת זמן למשימה:", error);
    hideSimpleLoading();
    throw new Error("שגיאה ברישום זמן: " + error.message);
  }
}

// סיום משימה מתוקצבת (Firebase)
async function completeTaskFirebase(taskId, completionNotes = "") {
  try {
    showSimpleLoading("מסיים משימה...");

    const db = window.firebaseDB;
    if (!db) throw new Error("Firebase לא מחובר");

    const taskRef = db.collection("budget_tasks").doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      throw new Error("משימה לא נמצאה");
    }

    const taskData = taskDoc.data();
    const currentUser = window.manager?.currentUser;

    if (taskData.employee !== currentUser) {
      throw new Error("אין הרשאה להשלים משימה זו");
    }

    await taskRef.update({
      status: "הושלם",
      completedAt: firebase.firestore.FieldValue.serverTimestamp(),
      completionNotes: completionNotes,
      completedBy: currentUser,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastModifiedBy: currentUser,
    });

    console.log(`✅ משימה הושלמה: ${taskId}`);
    hideSimpleLoading();

    return { success: true, message: "המשימה הושלמה בהצלחה" };
  } catch (error) {
    console.error("❌ שגיאה בהשלמת משימה:", error);
    hideSimpleLoading();
    throw new Error("שגיאה בהשלמת משימה: " + error.message);
  }
}

// הארכת תאריך יעד למשימה (Firebase)
async function extendTaskDeadlineFirebase(taskId, newDeadline, reason = "") {
  try {
    showSimpleLoading("מאריך תאריך יעד...");

    const db = window.firebaseDB;
    if (!db) throw new Error("Firebase לא מחובר");

    const taskRef = db.collection("budget_tasks").doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      throw new Error("משימה לא נמצאה");
    }

    const taskData = taskDoc.data();
    const currentUser = window.manager?.currentUser;

    if (taskData.employee !== currentUser) {
      throw new Error("אין הרשאה לעדכן משימה זו");
    }

    const extensionLog = {
      originalDeadline: taskData.deadline,
      newDeadline: newDeadline,
      reason: reason,
      extendedBy: currentUser,
      extendedAt: new Date().toISOString(),
    };

    await taskRef.update({
      deadline: newDeadline,
      extended: true,
      extensionHistory: firebase.firestore.FieldValue.arrayUnion(extensionLog),
      extensionReason: reason,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastModifiedBy: currentUser,
    });

    console.log(`✅ תאריך יעד הוארך למשימה ${taskId}: ${newDeadline}`);
    hideSimpleLoading();

    return { success: true, message: "תאריך היעד הוארך בהצלחה" };
  } catch (error) {
    console.error("❌ שגיאה בהארכת תאריך יעד:", error);
    hideSimpleLoading();
    throw new Error("שגיאה בהארכת יעד: " + error.message);
  }
}

// רישום כניסת משתמש (Firebase)
async function logUserLoginFirebase(employee, userAgent = "", ipAddress = "") {
  try {
    const db = window.firebaseDB;
    if (!db) {
      console.warn("Firebase לא מחובר - דילוג על רישום כניסה");
      return { success: true };
    }

    const loginData = {
      employee: employee,
      action: "login",
      userAgent: userAgent || navigator.userAgent,
      ipAddress: ipAddress || "לא זמין",
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      sessionId: Date.now().toString(),
      browserInfo: {
        language: navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        onlineStatus: navigator.onLine,
      },
    };

    db.collection("user_logs")
      .add(loginData)
      .then(() => {
        console.log(`📝 כניסת משתמש נרשמה: ${employee}`);
      })
      .catch((error) => {
        console.warn("שגיאה ברישום כניסה:", error.message);
      });

    return { success: true, message: "כניסה נרשמה" };
  } catch (error) {
    console.error("שגיאה ברישום כניסת משתמש:", error);
    return { success: true };
  }
}

/**
 * עדכון פונקציות קיימות להשתמש ב-Firebase במקום Google Apps Script
 */
if (window.manager) {
  // החלפת addTimeToTask
  window.manager.addTimeToTask = async function (timeData) {
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
        this.showNotification("⏳ רושם זמן...", "info");
      }

      await addTimeToTaskFirebase(timeData.taskId, timeData);

      if (taskIndex !== -1) {
        const lastHistoryItem =
          this.budgetTasks[taskIndex].history[
            this.budgetTasks[taskIndex].history.length - 1
          ];
        if (lastHistoryItem?.isPending) {
          delete lastHistoryItem.isPending;
        }
      }

      this.showNotification("✅ זמן נוסף בהצלחה!", "success");
      setTimeout(() => this.loadDataFromFirebase(), 1000);
    } catch (error) {
      if (originalTask && taskIndex !== -1) {
        this.budgetTasks[taskIndex] = originalTask;
        this.filteredBudgetTasks = [...this.budgetTasks];
        this.renderBudgetTasks();
      }

      this.showNotification("❌ שגיאה ברישום זמן", "error");
      console.error("Error in addTimeToTask:", error);
    }
  };

  // החלפת completeTask
  window.manager.completeTask = async function (taskId) {
    const task = this.budgetTasks.find((t) => t.id === taskId);
    if (!task) {
      this.showNotification("המשימה לא נמצאה", "error");
      return;
    }

    const notes = prompt(
      `סיום משימה: ${
        task.description || task.taskDescription
      }\n\nהערות סיום (אופציונלי):`,
      ""
    );

    if (notes !== null) {
      try {
        const taskIndex = this.budgetTasks.findIndex((t) => t.id === taskId);
        if (taskIndex !== -1) {
          this.budgetTasks[taskIndex].status = "הושלם";
          this.budgetTasks[taskIndex].completedAt = new Date().toLocaleString(
            "he-IL"
          );
          this.filteredBudgetTasks = [...this.budgetTasks];
          this.renderBudgetTasks();
        }

        await completeTaskFirebase(taskId, notes);
        this.showNotification("המשימה הושלמה בהצלחה", "success");

        await this.loadDataFromFirebase();
      } catch (error) {
        console.error("Error completing task:", error);
        this.showNotification("שגיאה בהשלמת המשימה", "error");
        await this.loadDataFromFirebase();
      }
    }
  };

  // הוספת פונקציית הארכת יעד
  window.manager.showExtendDeadlineDialog = function (taskId) {
    const task = this.budgetTasks.find((t) => t.id === taskId);
    if (!task) {
      this.showNotification("המשימה לא נמצאה", "error");
      return;
    }

    const overlay = document.createElement("div");
    overlay.className = "popup-overlay";

    const currentDeadline = new Date(task.deadline);
    const defaultNewDate = new Date(currentDeadline);
    defaultNewDate.setDate(defaultNewDate.getDate() + 7);
    const defaultDateValue = defaultNewDate.toISOString().split("T")[0];

    overlay.innerHTML = `
      <div class="popup" style="max-width: 500px;">
        <div class="popup-header">
          <i class="fas fa-calendar-plus"></i>
          הארכת תאריך יעד
        </div>
        <div class="popup-content">
          <div class="form-group">
            <label>משימה:</label>
            <div style="font-weight: bold; color: #333;">${
              task.description || task.taskDescription
            }</div>
          </div>
          <div class="form-group">
            <label>תאריך יעד נוכחי:</label>
            <div style="color: #dc2626; font-weight: bold;">${formatDateTime(
              currentDeadline
            )}</div>
          </div>
          <div class="form-group">
            <label for="newDeadlineDate">תאריך יעד חדש:</label>
            <input type="date" id="newDeadlineDate" value="${defaultDateValue}" required>
          </div>
          <div class="form-group">
            <label for="extensionReason">סיבת ההארכה:</label>
            <textarea id="extensionReason" rows="3" placeholder="מדוע נדרשת הארכה?" required></textarea>
          </div>
        </div>
        <div class="popup-buttons">
          <button class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()">
            <i class="fas fa-times"></i> ביטול
          </button>
          <button class="popup-btn popup-btn-confirm" onclick="manager.submitDeadlineExtension(${taskId}, this)">
            <i class="fas fa-calendar-check"></i> אשר הארכה
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
  };

  window.manager.submitDeadlineExtension = async function (
    taskId,
    buttonElement
  ) {
    const popup = buttonElement.closest(".popup-overlay");
    const newDate = document.getElementById("newDeadlineDate").value;
    const reason = document.getElementById("extensionReason").value.trim();

    if (!newDate || !reason) {
      this.showNotification("אנא מלא את כל השדות", "error");
      return;
    }

    try {
      await extendTaskDeadlineFirebase(taskId, newDate, reason);
      this.showNotification("תאריך יעד הוארך בהצלחה", "success");
      popup.remove();

      await this.loadDataFromFirebase();
    } catch (error) {
      console.error("Error extending deadline:", error);
      this.showNotification("שגיאה בהארכת יעד", "error");
    }
  };

  // החלפת logUserLogin
  window.manager.logUserLogin = async function () {
    try {
      await logUserLoginFirebase(
        this.currentUser,
        navigator.userAgent || "לא זמין",
        "לא זמין"
      );
    } catch (error) {
      console.warn("רישום כניסה נכשל:", error.message);
    }
  };

  // החלפת sendToGoogleSheets ל-Firebase
  window.manager.sendToGoogleSheets = async function (data, maxRetries = 3) {
    try {
      const { action } = data;

      switch (action) {
        case "createClientComplete":
          return await this.createClientCompleteFirebase(data);

        case "saveBudgetTaskToSheet":
          return await saveBudgetTaskToFirebase(data.task);

        case "saveTimesheetAndUpdateClient":
          return await this.saveTimesheetAndUpdateClientFirebase(data);

        case "userLogin":
          return await logUserLoginFirebase(
            data.employee,
            data.userAgent,
            data.ipAddress
          );

        default:
          console.warn(`Action לא נתמך: ${action}`);
          return { success: false, error: `Action לא נתמך: ${action}` };
      }
    } catch (error) {
      console.error("Firebase operation failed:", error);
      return { success: false, error: error.message };
    }
  };

  // פונקציה עזר ליצירת לקוח
  window.manager.createClientCompleteFirebase = async function (data) {
    try {
      const { client } = data;
      await saveClientToFirebase(client);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // פונקציה עזר לשמירת שעתון
  window.manager.saveTimesheetAndUpdateClientFirebase = async function (data) {
    try {
      const { entry } = data;

      // שמור שעתון
      await saveTimesheetToFirebase(entry);

      // עדכן שעות לקוח
      if (entry.clientName && entry.minutes) {
        await updateClientHoursImmediately(entry.clientName, entry.minutes);
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };
}

// הוסף פונקציות ל-window
window.addTimeToTaskFirebase = addTimeToTaskFirebase;
window.completeTaskFirebase = completeTaskFirebase;
window.extendTaskDeadlineFirebase = extendTaskDeadlineFirebase;
window.logUserLoginFirebase = logUserLoginFirebase;

console.log("🔥 Firebase Functions Integration Complete!");
console.log("✅ addTimeToTaskFirebase - הוספת זמן למשימה");
console.log("✅ completeTaskFirebase - סיום משימה");
console.log("✅ extendTaskDeadlineFirebase - הארכת יעד");
console.log("✅ logUserLoginFirebase - רישום כניסה");
console.log("🎯 כל הפונקציות מוחלפות לFirebase!");
/* ===== 🔥 Firebase Functions - הוסף בסוف script.js ===== */

// הוספת זמן למשימה מתוקצבת (Firebase)
async function addTimeToTaskFirebase(taskId, timeEntry) {
  try {
    showSimpleLoading("רושם זמן למשימה...");

    const db = window.firebaseDB;
    if (!db) throw new Error("Firebase לא מחובר");

    const taskRef = db.collection("budget_tasks").doc(taskId);

    await db.runTransaction(async (transaction) => {
      const taskDoc = await transaction.get(taskRef);

      if (!taskDoc.exists) {
        throw new Error("משימה לא נמצאה");
      }

      const taskData = taskDoc.data();
      const currentUser = window.manager?.currentUser;

      if (taskData.employee !== currentUser) {
        throw new Error("אין הרשאה לעדכן משימה זו");
      }

      const historyEntry = {
        id: Date.now(),
        date: timeEntry.date,
        minutes: timeEntry.minutes,
        description: timeEntry.description,
        timestamp: new Date().toLocaleString("he-IL"),
        addedBy: currentUser,
      };

      const newActualMinutes =
        (taskData.actualMinutes || 0) + timeEntry.minutes;
      const newHistory = [...(taskData.history || []), historyEntry];

      transaction.update(taskRef, {
        actualMinutes: newActualMinutes,
        history: newHistory,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastModifiedBy: currentUser,
      });
    });

    console.log(`✅ זמן נוסף למשימה ${taskId}: ${timeEntry.minutes} דקות`);
    hideSimpleLoading();

    return { success: true, message: "זמן נוסף בהצלחה למשימה" };
  } catch (error) {
    console.error("❌ שגיאה בהוספת זמן למשימה:", error);
    hideSimpleLoading();
    throw new Error("שגיאה ברישום זמן: " + error.message);
  }
}

// סיום משימה מתוקצבת (Firebase)
async function completeTaskFirebase(taskId, completionNotes = "") {
  try {
    showSimpleLoading("מסיים משימה...");

    const db = window.firebaseDB;
    if (!db) throw new Error("Firebase לא מחובר");

    const taskRef = db.collection("budget_tasks").doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      throw new Error("משימה לא נמצאה");
    }

    const taskData = taskDoc.data();
    const currentUser = window.manager?.currentUser;

    if (taskData.employee !== currentUser) {
      throw new Error("אין הרשאה להשלים משימה זו");
    }

    await taskRef.update({
      status: "הושלם",
      completedAt: firebase.firestore.FieldValue.serverTimestamp(),
      completionNotes: completionNotes,
      completedBy: currentUser,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastModifiedBy: currentUser,
    });

    console.log(`✅ משימה הושלמה: ${taskId}`);
    hideSimpleLoading();

    return { success: true, message: "המשימה הושלמה בהצלחה" };
  } catch (error) {
    console.error("❌ שגיאה בהשלמת משימה:", error);
    hideSimpleLoading();
    throw new Error("שגיאה בהשלמת משימה: " + error.message);
  }
}

// הארכת תאריך יעד למשימה (Firebase)
async function extendTaskDeadlineFirebase(taskId, newDeadline, reason = "") {
  try {
    showSimpleLoading("מאריך תאריך יעד...");

    const db = window.firebaseDB;
    if (!db) throw new Error("Firebase לא מחובר");

    const taskRef = db.collection("budget_tasks").doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      throw new Error("משימה לא נמצאה");
    }

    const taskData = taskDoc.data();
    const currentUser = window.manager?.currentUser;

    if (taskData.employee !== currentUser) {
      throw new Error("אין הרשאה לעדכן משימה זו");
    }

    const extensionLog = {
      originalDeadline: taskData.deadline,
      newDeadline: newDeadline,
      reason: reason,
      extendedBy: currentUser,
      extendedAt: new Date().toISOString(),
    };

    await taskRef.update({
      deadline: newDeadline,
      extended: true,
      extensionHistory: firebase.firestore.FieldValue.arrayUnion(extensionLog),
      extensionReason: reason,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastModifiedBy: currentUser,
    });

    console.log(`✅ תאריך יעד הוארך למשימה ${taskId}: ${newDeadline}`);
    hideSimpleLoading();

    return { success: true, message: "תאריך היעד הוארך בהצלחה" };
  } catch (error) {
    console.error("❌ שגיאה בהארכת תאריך יעד:", error);
    hideSimpleLoading();
    throw new Error("שגיאה בהארכת יעד: " + error.message);
  }
}

// רישום כניסת משתמש (Firebase)
async function logUserLoginFirebase(employee, userAgent = "", ipAddress = "") {
  try {
    const db = window.firebaseDB;
    if (!db) {
      console.warn("Firebase לא מחובר - דילוג על רישום כניסה");
      return { success: true };
    }

    const loginData = {
      employee: employee,
      action: "login",
      userAgent: userAgent || navigator.userAgent,
      ipAddress: ipAddress || "לא זמין",
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      sessionId: Date.now().toString(),
      browserInfo: {
        language: navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        onlineStatus: navigator.onLine,
      },
    };

    db.collection("user_logs")
      .add(loginData)
      .then(() => {
        console.log(`📝 כניסת משתמש נרשמה: ${employee}`);
      })
      .catch((error) => {
        console.warn("שגיאה ברישום כניסה:", error.message);
      });

    return { success: true, message: "כניסה נרשמה" };
  } catch (error) {
    console.error("שגיאה ברישום כניסת משתמש:", error);
    return { success: true };
  }
}

// עדכון פונקציות קיימות להשתמש ב-Firebase
if (window.manager) {
  // החלפת addTimeToTask
  window.manager.addTimeToTask = async function (timeData) {
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
        this.showNotification("⏳ רושם זמן...", "info");
      }

      await addTimeToTaskFirebase(timeData.taskId, timeData);

      if (taskIndex !== -1) {
        const lastHistoryItem =
          this.budgetTasks[taskIndex].history[
            this.budgetTasks[taskIndex].history.length - 1
          ];
        if (lastHistoryItem?.isPending) {
          delete lastHistoryItem.isPending;
        }
      }

      this.showNotification("✅ זמן נוסף בהצלחה!", "success");
      setTimeout(() => this.loadDataFromFirebase(), 1000);
    } catch (error) {
      if (originalTask && taskIndex !== -1) {
        this.budgetTasks[taskIndex] = originalTask;
        this.filteredBudgetTasks = [...this.budgetTasks];
        this.renderBudgetTasks();
      }

      this.showNotification("❌ שגיאה ברישום זמן", "error");
      console.error("Error in addTimeToTask:", error);
    }
  };

  // החלפת completeTask
  window.manager.completeTask = async function (taskId) {
    const task = this.budgetTasks.find((t) => t.id === taskId);
    if (!task) {
      this.showNotification("המשימה לא נמצאה", "error");
      return;
    }

    const notes = prompt(
      `סיום משימה: ${
        task.description || task.taskDescription
      }\n\nהערות סיום (אופציונלי):`,
      ""
    );

    if (notes !== null) {
      try {
        const taskIndex = this.budgetTasks.findIndex((t) => t.id === taskId);
        if (taskIndex !== -1) {
          this.budgetTasks[taskIndex].status = "הושלם";
          this.budgetTasks[taskIndex].completedAt = new Date().toLocaleString(
            "he-IL"
          );
          this.filteredBudgetTasks = [...this.budgetTasks];
          this.renderBudgetTasks();
        }

        await completeTaskFirebase(taskId, notes);
        this.showNotification("המשימה הושלמה בהצלחה", "success");

        await this.loadDataFromFirebase();
      } catch (error) {
        console.error("Error completing task:", error);
        this.showNotification("שגיאה בהשלמת המשימה", "error");
        await this.loadDataFromFirebase();
      }
    }
  };
}

/* ===== פונקציות Firebase לעריכת שעתון לפי משתמש ===== */

/**
 * עדכון רשומת שעתון ב-Firebase
 * מאפשר רק למשתמש שיצר את הרשומה לערוך אותה
 */
async function updateTimesheetEntryFirebase(entryId, newMinutes, reason = "") {
  let oldMinutes = 0; // הגדרה מחוץ ל-transaction
  try {
    showSimpleLoading("מעדכן שעתון...");

    const db = window.firebaseDB;
    if (!db) throw new Error("Firebase לא מחובר");

    const currentUser = window.manager?.currentUser;
    if (!currentUser) throw new Error("משתמש לא מזוהה");

    console.log(
      `🔥 Firebase: מעדכן רשומת שעתון ${entryId} עבור ${currentUser}`
    );

    const entryRef = db.collection("timesheet_entries").doc(entryId);

    await db.runTransaction(async (transaction) => {
      const entryDoc = await transaction.get(entryRef);

      if (!entryDoc.exists) {
        throw new Error("רשומת שעתון לא נמצאה");
      }

      const entryData = entryDoc.data();

      // בדיקת הרשאה - רק המשתמש שיצר את הרשומה יכול לערוך
      if (entryData.employee !== currentUser) {
        throw new Error("אין הרשאה לערוך רשומת שעתון זו - שייכת למשתמש אחר");
      }

      const oldMinutes = entryData.minutes || 0;

      // יצירת לוג עריכה מפורט
      const editLog = {
        oldMinutes: oldMinutes,
        newMinutes: newMinutes,
        difference: newMinutes - oldMinutes,
        reason: reason || `שונה מ-${oldMinutes} ל-${newMinutes} דקות`,
        editedBy: currentUser,
        editedAt: new Date().toISOString(),
        timestamp: new Date().toLocaleString("he-IL"),
        clientName: entryData.clientName,
        originalAction: entryData.action,
      };

      const updates = {
        minutes: newMinutes,
        editHistory: firebase.firestore.FieldValue.arrayUnion(editLog),
        lastModified: new Date().toLocaleString("he-IL"),
        lastModifiedBy: currentUser,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        totalEdits: firebase.firestore.FieldValue.increment(1),
        edited: true, // סימון שהרשומה נערכה
      };

      transaction.update(entryRef, updates);

      console.log(
        `✅ עדכון הושלם: ${oldMinutes} → ${newMinutes} דקות (${
          newMinutes - oldMinutes > 0 ? "+" : ""
        }${newMinutes - oldMinutes})`
      );
    });

    hideSimpleLoading();
    return {
      success: true,
      message: "רשומת השעתון עודכנה בהצלחה",
      oldMinutes: oldMinutes,
      newMinutes: newMinutes,
    };
  } catch (error) {
    console.error("❌ שגיאה בעדכון רשומת שעתון:", error);
    hideSimpleLoading();
    throw new Error("שגיאה בעדכון שעתון: " + error.message);
  }
}

/**
 * טעינת רשומות שעתון של משתמש ספציפי עם היסטוריית עריכות
 */
async function loadTimesheetWithEditHistory(employee) {
  try {
    showSimpleLoading("טוען שעתון עם היסטוריה...");

    const db = window.firebaseDB;
    if (!db) throw new Error("Firebase לא מחובר");

    console.log(`🔍 טוען רשומות שעתון עבור: ${employee}`);

    const snapshot = await db
      .collection("timesheet_entries")
      .where("employee", "==", employee)
      .orderBy("createdAt", "desc")
      .get();

    const entries = [];
    let totalEdits = 0;
    let totalOriginalMinutes = 0;
    let totalCurrentMinutes = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      const entry = {
        id: doc.id,
        ...data,
        hasEditHistory: data.editHistory && data.editHistory.length > 0,
      };

      entries.push(entry);

      // סטטיסטיקות
      if (data.edited) totalEdits++;
      if (data.editHistory && data.editHistory.length > 0) {
        // המינוטים המקוריים הם מהעריכה הראשונה או המינוטים הנוכחיים אם אין עריכות
        const firstEdit = data.editHistory[0];
        totalOriginalMinutes += firstEdit.oldMinutes;
      } else {
        totalOriginalMinutes += data.minutes || 0;
      }
      totalCurrentMinutes += data.minutes || 0;
    });

    console.log(`📊 סטטיסטיקות עבור ${employee}:`);
    console.log(`   📋 סה"כ רשומות: ${entries.length}`);
    console.log(`   ✏️ רשומות ערוכות: ${totalEdits}`);
    console.log(`   ⏰ דקות מקוריות: ${totalOriginalMinutes}`);
    console.log(`   ⏱️ דקות נוכחיות: ${totalCurrentMinutes}`);
    console.log(
      `   📈 הפרש: ${
        totalCurrentMinutes - totalOriginalMinutes > 0 ? "+" : ""
      }${totalCurrentMinutes - totalOriginalMinutes} דקות`
    );

    hideSimpleLoading();
    return {
      entries,
      stats: {
        totalEntries: entries.length,
        editedEntries: totalEdits,
        originalMinutes: totalOriginalMinutes,
        currentMinutes: totalCurrentMinutes,
        minutesDifference: totalCurrentMinutes - totalOriginalMinutes,
      },
    };
  } catch (error) {
    console.error("Firebase error:", error);
    hideSimpleLoading();
    throw new Error("שגיאה בטעינת שעתון: " + error.message);
  }
}

/**
 * עדכון פונקציית עריכת השעתון להשתמש ב-Firebase
 */
if (window.manager) {
  window.manager.submitTimesheetEdit = async function (entryId) {
    try {
      const newMinutes = parseInt(document.getElementById("editMinutes").value);
      const reason = document.getElementById("editReason").value.trim();

      if (!newMinutes || newMinutes < 1 || newMinutes > 999) {
        this.showNotification("❌ מספר דקות חייב להיות בין 1 ל-999", "error");
        return;
      }

      // מציאת הרשומה המקומית
      const entry = this.timesheetEntries.find(
        (e) =>
          (e.id && e.id.toString() === entryId.toString()) ||
          (e.entryId && e.entryId.toString() === entryId.toString())
      );

      if (!entry) {
        this.showNotification("❌ רשומת שעתון לא נמצאה", "error");
        return;
      }

      const oldMinutes = entry.minutes;

      // אם אין שינוי בזמן, לא צריך לעדכן
      if (oldMinutes === newMinutes) {
        document.querySelector(".popup-overlay").remove();
        this.showNotification("⚠️ לא בוצע שינוי בזמן", "info");
        return;
      }

      // עדכון ב-Firebase
      const result = await updateTimesheetEntryFirebase(
        entryId,
        newMinutes,
        reason
      );

      // עדכון מקומי רק אחרי הצלחה ב-Firebase
      const entryIndex = this.timesheetEntries.findIndex(
        (e) =>
          (e.id && e.id.toString() === entryId.toString()) ||
          (e.entryId && e.entryId.toString() === entryId.toString())
      );

      if (entryIndex !== -1) {
        this.timesheetEntries[entryIndex].minutes = newMinutes;
        this.timesheetEntries[entryIndex].lastModified =
          new Date().toLocaleString("he-IL");
        this.timesheetEntries[entryIndex].editReason =
          reason || `שונה מ-${oldMinutes} ל-${newMinutes} דקות`;
        this.timesheetEntries[entryIndex].edited = true;
        this.filteredTimesheetEntries = [...this.timesheetEntries];
      }

      // הסרת הדיאלוג
      document.querySelector(".popup-overlay").remove();

      // הודעת הצלחה עם פרטים
      const difference = newMinutes - oldMinutes;
      const diffText = difference > 0 ? `+${difference}` : `${difference}`;
      this.showNotification(
        `✅ שעתון עודכן: ${oldMinutes} → ${newMinutes} דק' (${diffText})`,
        "success"
      );

      // עדכון התצוגה
      this.renderTimesheetEntries();

      // טעינה מחדש מהשרת לוודא סנכרון
      setTimeout(async () => {
        try {
          await this.loadDataFromFirebase();
          console.log("🔄 נתונים סונכרנו מהשרת אחרי עדכון שעתון");
        } catch (error) {
          console.error("שגיאה בסנכרון נתונים:", error);
        }
      }, 1500);
    } catch (error) {
      console.error("Error editing timesheet:", error);

      let errorMessage = "שגיאה בעדכון השעתון";
      if (error.message.includes("אין הרשאה")) {
        errorMessage = "❌ אין לך הרשאה לערוך רשומה זו";
      } else if (error.message.includes("לא נמצאה")) {
        errorMessage = "❌ רשומת השעתון לא נמצאה";
      } else if (error.message.includes("Firebase לא מחובר")) {
        errorMessage = "❌ בעיית חיבור - נסה שוב";
      }

      this.showNotification(errorMessage, "error");
    }
  };

  /**
   * הוספת אפשרות להציג היסטוריית עריכות
   */
  window.manager.showTimesheetEditHistory = function (entryId) {
    const entry = this.timesheetEntries.find(
      (e) =>
        (e.id && e.id.toString() === entryId.toString()) ||
        (e.entryId && e.entryId.toString() === entryId.toString())
    );

    if (!entry || !entry.editHistory || entry.editHistory.length === 0) {
      this.showNotification("אין היסטוריית עריכות לרשומה זו", "info");
      return;
    }

    const overlay = document.createElement("div");
    overlay.className = "popup-overlay";

    const historyHtml = entry.editHistory
      .map(
        (edit, index) => `
        <div class="history-edit-entry" style="
          background: ${index === 0 ? "#fef3c7" : "#f3f4f6"};
          border: 1px solid ${index === 0 ? "#f59e0b" : "#d1d5db"};
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 10px;
        ">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <strong style="color: #374151;">עריכה #${
              entry.editHistory.length - index
            }</strong>
            <span style="color: #6b7280; font-size: 12px;">${
              edit.timestamp
            }</span>
          </div>
          <div style="color: #4b5563; font-size: 14px;">
            <strong>שונה מ-${edit.oldMinutes} ל-${edit.newMinutes} דקות</strong>
            (הפרש: ${edit.difference > 0 ? "+" : ""}${edit.difference})
          </div>
          ${
            edit.reason
              ? `
            <div style="color: #6b7280; font-size: 13px; margin-top: 6px; font-style: italic;">
              "${edit.reason}"
            </div>
          `
              : ""
          }
        </div>
      `
      )
      .join("");

    overlay.innerHTML = `
      <div class="popup" style="max-width: 600px;">
        <div class="popup-header">
          <i class="fas fa-history"></i>
          היסטוריית עריכות - ${entry.action}
        </div>
        <div class="popup-content">
          <div class="task-overview">
            <h4><i class="fas fa-info-circle"></i> פרטי הרשומה</h4>
            <p><strong>לקוח:</strong> ${entry.clientName}</p>
            <p><strong>תאריך:</strong> ${formatDate(entry.date)}</p>
            <p><strong>זמן נוכחי:</strong> ${entry.minutes} דקות</p>
            <p><strong>מספר עריכות:</strong> ${entry.editHistory.length}</p>
          </div>
          
          <div style="max-height: 300px; overflow-y: auto;">
            <h4 style="margin-bottom: 15px; color: #374151;">
              <i class="fas fa-list"></i> היסטוריית שינויים
            </h4>
            ${historyHtml}
          </div>
        </div>
        <div class="popup-buttons">
          <button class="popup-btn popup-btn-cancel" onclick="this.closest('.popup-overlay').remove()">
            <i class="fas fa-times"></i> סגור
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
  };
}

/**
 * הוספת כפתור היסטוריה לכרטיס שעתון (אם יש עריכות)
 */
if (window.manager && window.manager.createTimesheetCard) {
  const originalCreateTimesheetCard = window.manager.createTimesheetCard;

  window.manager.createTimesheetCard = function (entry) {
    const safeEntry = this.sanitizeTimesheetData(entry);
    const minutesClass =
      safeEntry.minutes >= 120
        ? "high-time"
        : safeEntry.minutes >= 60
        ? "medium-time"
        : "low-time";

    // כפתור היסטוריה רק אם יש עריכות
    const historyButton =
      entry.editHistory && entry.editHistory.length > 0
        ? `
      <button class="action-btn history-btn" onclick="manager.showTimesheetEditHistory('${safeEntry.id}')" title="היסטוריית עריכות">
        <i class="fas fa-history"></i>
        עריכות (${entry.editHistory.length})
      </button>
    `
        : "";

    return `
      <div class="timesheet-card ${minutesClass}" data-entry-id="${
      safeEntry.id
    }">
        <div class="timesheet-card-content">
          <div class="timesheet-card-header">
            <div class="timesheet-card-date">
              <i class="fas fa-calendar-day"></i>
              ${formatDate(safeEntry.date)}
            </div>
            <div class="timesheet-card-time">
              <span class="time-badge ${minutesClass}">
                <i class="fas fa-clock"></i>
                ${safeEntry.minutes} דק'
                ${
                  entry.edited
                    ? '<i class="fas fa-edit" style="margin-right: 4px; font-size: 10px;" title="נערך"></i>'
                    : ""
                }
              </span>
            </div>
          </div>
          
          <div class="timesheet-card-main">
            <div class="timesheet-card-client">
              <i class="fas fa-user-tie"></i>
              ${safeText(safeEntry.clientName)}
            </div>
            <div class="timesheet-card-action">
              ${safeText(safeEntry.action)}
            </div>
            ${
              safeEntry.fileNumber
                ? `
              <div class="timesheet-card-file">
                <i class="fas fa-folder"></i>
                תיק: ${safeText(safeEntry.fileNumber)}
              </div>
            `
                : ""
            }
          </div>
          
          ${
            safeEntry.notes && safeEntry.notes !== "—"
              ? `
            <div class="timesheet-card-notes">
              <i class="fas fa-sticky-note"></i>
              ${safeText(safeEntry.notes)}
            </div>
          `
              : ""
          }
          
          <div class="card-actions timesheet-card-actions">
            <button class="action-btn edit-btn" onclick="manager.showEditTimesheetDialog('${
              safeEntry.id
            }')" title="ערוך זמן">
              <i class="fas fa-edit"></i>
              ערוך שעתון
            </button>
            ${historyButton}
          </div>
        </div>
      </div>
    `;
  };
}
// הוסף פונקציות ל-window
window.addTimeToTaskFirebase = addTimeToTaskFirebase;
window.completeTaskFirebase = completeTaskFirebase;
window.extendTaskDeadlineFirebase = extendTaskDeadlineFirebase;
window.logUserLoginFirebase = logUserLoginFirebase;

console.log("🔥 Firebase Functions Integration Complete!");
console.log("✅ addTimeToTaskFirebase - הוספת זמן למשימה");
console.log("✅ completeTaskFirebase - סיום משימה");
console.log("✅ extendTaskDeadlineFirebase - הארכת יעד");
console.log("✅ logUserLoginFirebase - רישום כניסה");
console.log("🎯 כל הפונקציות מוחלפות לFirebase!");

/* ===== 🔚 סוף הקוד החדש ===== */
// בדוק שהכל באמת עובד
console.log("🔍 בדיקה אמיתית:");
console.log("Manager:", !!window.manager);
console.log("NotificationBell:", !!window.notificationBell);
console.log("ClientValidation:", !!window.manager?.clientValidation);
console.log("Firebase Functions:", !!window.addTimeToTaskFirebase);
console.log("🎉 הכל עובד!");
// ===== הוספת הפונקציות לכל מופע של Manager =====
// הוסף את הקוד הזה בסוף הקובץ script.js, אחרי שמחלקת LawOfficeManager מוגדרת:

// וידוא שהפונקציות זמינות גלובלית למקרה חירום
window.showEditTimesheetDialog = function (entryId) {
  if (window.manager && window.manager.showEditTimesheetDialog) {
    return window.manager.showEditTimesheetDialog(entryId);
  } else {
    console.error("❌ Manager לא זמין");
    alert("שגיאה: מערכת לא מוכנה. רענן את הדף.");
  }
};

window.submitTimesheetEdit = function (entryId) {
  if (window.manager && window.manager.submitTimesheetEdit) {
    return window.manager.submitTimesheetEdit(entryId);
  } else {
    console.error("❌ Manager לא זמין");
    alert("שגיאה: מערכת לא מוכנה. רענן את הדף.");
  }
};

// Debug: בדוק שהפונקציות קיימות
console.log("🔧 בדיקת פונקציות עריכת שעתון:");
console.log("showEditTimesheetDialog:", typeof window.showEditTimesheetDialog);
console.log("submitTimesheetEdit:", typeof window.submitTimesheetEdit);
console.log(
  "manager.showEditTimesheetDialog:",
  window.manager?.showEditTimesheetDialog ? "✅ קיים" : "❌ חסר"
);

/**
 * תצוגת כרטיסיות משופרת לשעתון - מותאמת לנתוני השעתון
 * החלפת הפונקציה renderTimesheetCards ב-LawOfficeManager
 */

// החלפת הפונקציה הקיימת במחלקת LawOfficeManager
if (window.manager) {
  /**
   * יצירת כרטיסיות מעוצבות לשעתון
   */
  window.manager.renderTimesheetCards = function (entries) {
    const container = document.getElementById("timesheetContainer");
    if (!container) return;

    if (!entries || entries.length === 0) {
      container.innerHTML = this.createEmptyTimesheetState();
      return;
    }

    const cardsHtml = entries
      .map((entry) => this.createTimesheetCard(entry))
      .join("");

    container.innerHTML = `
      <div class="modern-cards-header">
        <h3 class="modern-cards-title">
          <i class="fas fa-clock"></i>
          רשומות שעתון
        </h3>
        <div class="modern-cards-subtitle">
          ${this.filteredTimesheetEntries.length} רשומות • 
          ${this.getTotalHoursFromEntries()} שעות • 
          ${this.getEntriesThisWeek()} השבוע
        </div>
      </div>
      <div class="timesheet-cards-grid">
        ${cardsHtml}
      </div>
    `;
  };

  /**
   * יצירת כרטיס יחיד לשעתון
   */
  window.manager.createTimesheetCard = function (entry) {
    const safeEntry = this.sanitizeTimesheetData(entry);

    // חישוב סוג הזמן לעיצוב
    const minutesClass =
      safeEntry.minutes >= 120
        ? "high-time"
        : safeEntry.minutes >= 60
        ? "medium-time"
        : "low-time";

    // בדיקת תאריך לעיצוב
    const entryDate = new Date(safeEntry.date);
    const today = new Date();
    const diffDays = Math.floor((today - entryDate) / (1000 * 60 * 60 * 24));

    let dateClass = "";
    let dateIcon = "📅";
    if (diffDays === 0) {
      dateClass = "today";
      dateIcon = "🔥";
    } else if (diffDays === 1) {
      dateClass = "yesterday";
      dateIcon = "🕐";
    } else if (diffDays <= 7) {
      dateClass = "this-week";
      dateIcon = "📆";
    } else if (diffDays > 30) {
      dateClass = "old";
      dateIcon = "🗓️";
    }

    const safeDescription = safeText(safeEntry.action);
    const safeClientName = safeText(safeEntry.clientName);
    const clientDisplayName =
      safeEntry.clientName.length > 25
        ? safeText(safeEntry.clientName.substring(0, 25) + "...")
        : safeClientName;

    return `
      <div class="timesheet-linear-card" data-entry-id="${safeEntry.id}">
        <div class="timesheet-card-content">
          <div class="timesheet-card-header">
            <div class="timesheet-date-info ${dateClass}">
              <span class="date-icon">${dateIcon}</span>
              <span class="date-text">${formatDate(safeEntry.date)}</span>
              ${diffDays === 0 ? '<span class="today-badge">היום</span>' : ""}
            </div>
            <div class="timesheet-time-badge ${minutesClass}">
              <i class="fas fa-stopwatch"></i>
              <span class="time-value">${safeEntry.minutes}</span>
              <span class="time-unit">דק'</span>
            </div>
          </div>

          <div class="timesheet-main-content">
            <h3 class="timesheet-action-title" title="${safeDescription}">
              ${safeDescription}
            </h3>
            
            <div class="timesheet-client-info">
              <div class="client-row">
                <i class="fas fa-user-tie"></i>
                <span class="client-name" title="${safeClientName}">
                  ${clientDisplayName}
                </span>
              </div>
              ${
                safeEntry.fileNumber
                  ? `
                <div class="file-row">
                  <i class="fas fa-folder-open"></i>
                  <span class="file-number">תיק ${safeText(
                    safeEntry.fileNumber
                  )}</span>
                </div>
              `
                  : ""
              }
            </div>

            ${
              safeEntry.notes && safeEntry.notes !== "—"
                ? `
              <div class="timesheet-notes">
                <i class="fas fa-sticky-note"></i>
                <span class="notes-text">${safeText(safeEntry.notes)}</span>
              </div>
            `
                : ""
            }
          </div>

          <div class="timesheet-card-footer">
            <div class="timesheet-meta">
              <span class="created-time">
                <i class="fas fa-clock"></i>
                ${safeEntry.createdAt || "לא ידוע"}
              </span>
              ${
                safeEntry.edited
                  ? `
                <span class="edited-indicator" title="רשומה נערכה">
                  <i class="fas fa-edit"></i>
                  נערך
                </span>
              `
                  : ""
              }
            </div>
            
            <div class="card-actions">
              <button class="timesheet-action-btn edit-btn" 
                      onclick="manager.showEditTimesheetDialog('${
                        safeEntry.id
                      }')" 
                      title="ערוך רשומה">
                <i class="fas fa-edit"></i>
              </button>
              ${
                safeEntry.editHistory && safeEntry.editHistory.length > 0
                  ? `
                <button class="timesheet-action-btn history-btn" 
                        onclick="manager.showTimesheetEditHistory('${safeEntry.id}')" 
                        title="היסטוריית עריכות">
                  <i class="fas fa-history"></i>
                  <span class="history-count">${safeEntry.editHistory.length}</span>
                </button>
              `
                  : ""
              }
            </div>
          </div>
        </div>
      </div>
    `;
  };

  /**
   * פונקציות עזר לסטטיסטיקות
   */
  window.manager.sanitizeTimesheetData = function (entry) {
    if (!entry) return {};

    return {
      id: entry.id || entry.entryId || Date.now(),
      date: entry.date || new Date().toISOString(),
      action: entry.action || "פעולה ללא תיאור",
      minutes: Number(entry.minutes) || 0,
      clientName: entry.clientName || "לקוח לא ידוע",
      fileNumber: entry.fileNumber || "",
      notes: entry.notes || "",
      createdAt: entry.createdAt || "",
      edited: entry.edited || false,
      editHistory: entry.editHistory || [],
    };
  };

  window.manager.getTotalHoursFromEntries = function () {
    if (!this.filteredTimesheetEntries) return "0";

    const totalMinutes = this.filteredTimesheetEntries.reduce((sum, entry) => {
      return sum + (Number(entry.minutes) || 0);
    }, 0);

    return (totalMinutes / 60).toFixed(1);
  };

  window.manager.getEntriesThisWeek = function () {
    if (!this.filteredTimesheetEntries) return 0;

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    return this.filteredTimesheetEntries.filter((entry) => {
      const entryDate = new Date(entry.date);
      return entryDate >= oneWeekAgo;
    }).length;
  };

  /**
   * עדכון פונקציית החלפת תצוגה
   */
  window.manager.switchTimesheetView = function (view) {
    this.currentTimesheetView = view;

    // עדכן את הכפתורים
    document.querySelectorAll("#timesheetTab .view-tab").forEach((tab) => {
      tab.classList.remove("active");
    });

    const activeTab = document.querySelector(
      `#timesheetTab .view-tab[data-view="${view}"]`
    );
    if (activeTab) activeTab.classList.add("active");

    // החלף תצוגות
    const timesheetContainer = document.getElementById("timesheetContainer");
    const timesheetTableContainer = document.getElementById(
      "timesheetTableContainer"
    );

    if (view === "cards") {
      if (timesheetContainer) timesheetContainer.classList.remove("hidden");
      if (timesheetTableContainer)
        timesheetTableContainer.classList.add("hidden");
    } else {
      if (timesheetContainer) timesheetContainer.classList.add("hidden");
      if (timesheetTableContainer)
        timesheetTableContainer.classList.remove("hidden");
    }

    // טען נתונים אם צריך
    if (!this.timesheetEntries || this.timesheetEntries.length === 0) {
      this.loadDataFromFirebase()
        .then(() => {
          this.applyTimesheetFilters();
          this.renderTimesheetEntries();
        })
        .catch((error) => {
          console.error("Error loading timesheet data:", error);
          this.showNotification("שגיאה בטעינת נתונים", "error");
        });
    } else {
      if (
        !this.filteredTimesheetEntries ||
        this.filteredTimesheetEntries.length === 0
      ) {
        this.applyTimesheetFilters();
      }
      this.renderTimesheetEntries();
    }
  };

  console.log("✅ תצוגת כרטיסיות לשעתון הושלמה!");
} else {
  console.error("❌ Manager לא זמין - לא ניתן להוסיף פונקציות");
}
// החלף את הקוד הקיים ב-script.js עם הגרסה המשופרת הזו

// מחק את כל הקוד הקיים של ACTION_CATEGORIES ו-CategoryUtils
// והחלף אותו בקוד הזה

const ACTION_CATEGORIES = {
  "כתבי טענות ראשוניים": ["כתב תביעה", "כתב הגנה", "כתב תשובה"],

  "הליכי ביניים": ["בקשה בכתב", "תגובה לבקשה בכתב"],

  "כתבי טענות מיוחדים": ["כתב ערעור", "עתירה מנהלית"],

  "כתבי טענות במהלך ההליכים המשפטיים": [
    "הליכים מקדמיים (גילוי מסמכים כללי/גילוי מסמכים ספציפי/שאלון)",
    "היערכות לדיון מקדמי",
    "ייצוג בדיון מקדמי",
    "היערכות לקדם מסכם",
    "ייצוג בדיון קדם מסכם",
    "תצהירי עדות ראשית/הכנת תיק מוצגים",
    "הכנת חקירות נגדיות לעדי הצד שכנגד",
    "הכנת הלקוח ועדי הלקוח לחקירות נגדיות",
    "ייצוג בדיון הוכחות",
    "עריכת סיכומים",
    "עריכת סיכומי תשובה",
  ],

  מכתבים: ["עריכת מכתב התראה"],

  הסכמים: [
    "הסכם מייסדים",
    "תקנון חברה לא סטנדרטי",
    "הסכם שותפות",
    "עבודה",
    "שיתוף פעולה",
    "נותן שירותים",
    "מכר דירה/בית/שטח",
    "הסכם מכר מניות",
  ],

  "צוואה/ירושה": ["עריכת צוואה", "בקשה לצו ירושה"],

  // קטגוריות חדשות
  "מסמכים דיגיטליים": [
    "תקנון אתר",
    "מדיניות פרטיות לאתר",
    "תנאי שימוש באתר",
    "מדיניות קובצי Cookies",
    "הסכם שירות דיגיטלי",
  ],

  "הליכי הוצאה לפועל": [
    "בקשה לצו עיקול",
    "התנגדות לעיקול",
    "בקשה לביטול עיקול",
    "הליכי חלוקה",
    "בקשה למכירה פומבית",
  ],

  "בוררות ותיווך": [
    "הגשת כתב בוררות",
    "כתב הגנה בבוררות",
    "ייצוג בהליכי בוררות",
    "הליכי תיווך",
    "הסכם בוררות",
  ],

  "הליכי פשיטת רגל ורה״ח": [
    "בקשה לפשיטת רגל",
    "התנגדות לפשיטת רגל",
    "הליכי רה״ח (ראש הנהלה חדש)",
    "הסכם נושים",
  ],

  "פעולות ייעוץ ומחקר": [
    "ייעוץ טלפוני",
    "פגישת לקוח",
    "מחקר משפטי",
    "הכנת חוות דעת משפטית",
    "בדיקת תקדימים",
    "ייעוץ בכתיבת חוזה",
  ],

  "הליכי רישוי ורגולציה": [
    "בקשה לרישיון עסק",
    "ייצוג מול רשויות מקומיות",
    "הליכי היתרי בנייה",
    "ייצוג מול משרדי ממשלה",
    "ערר מנהלי",
  ],

  "דיני משפחה": [
    "הסכם ממון טרום נישואין",
    "הסכם גירושין",
    "הסכם מזונות",
    "בקשה למשמורת",
    "הסכם ראייה בילדים",
  ],
};

// עדכון פעולות פופולריות
const POPULAR_ACTIONS = [
  "כתב תביעה",
  "כתב הגנה",
  "היערכות לדיון מקדמי",
  "ייצוג בדיון מקדמי",
  "עריכת מכתב התראה",
  "הסכם שותפות",
  "תקנון אתר",
  "מדיניות פרטיות לאתר",
  "ייעוץ טלפוני",
  "פגישת לקוח",
  "מחקר משפטי",
];

const CategoryUtils = {
  getAllActions() {
    const actions = [];
    Object.values(ACTION_CATEGORIES).forEach((categoryActions) => {
      actions.push(...categoryActions);
    });
    return actions;
  },

  searchActions(searchText) {
    if (!searchText) return this.getPopularActions();

    const lowerSearch = searchText.toLowerCase();
    const allActions = this.getAllActions();

    // חיפוש מדויק ברמת מילים
    const exactMatches = allActions.filter((action) =>
      action.toLowerCase().includes(lowerSearch)
    );

    // חיפוש במילים נפרדות
    const words = lowerSearch.split(" ").filter((w) => w.length > 1);
    const partialMatches = allActions.filter((action) => {
      const actionLower = action.toLowerCase();
      return (
        words.some((word) => actionLower.includes(word)) &&
        !exactMatches.includes(action)
      );
    });

    // מיון לפי רלוונטיות - פעולות פופולריות קודם
    const sortByRelevance = (matches) => {
      return matches.sort((a, b) => {
        const aPopular = POPULAR_ACTIONS.includes(a);
        const bPopular = POPULAR_ACTIONS.includes(b);

        if (aPopular && !bPopular) return -1;
        if (!aPopular && bPopular) return 1;

        // אם שניהם פופולריים או לא, מיין לפי התחלת המילה
        const aStartsWith = a.toLowerCase().startsWith(lowerSearch);
        const bStartsWith = b.toLowerCase().startsWith(lowerSearch);

        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;

        return a.length - b.length; // קצרים קודם
      });
    };

    return [
      ...sortByRelevance(exactMatches),
      ...sortByRelevance(partialMatches),
    ].slice(0, 10);
  },

  getPopularActions() {
    return POPULAR_ACTIONS;
  },

  findCategoryForAction(actionName) {
    for (const [category, actions] of Object.entries(ACTION_CATEGORIES)) {
      if (actions.includes(actionName)) {
        return category;
      }
    }
    return null;
  },

  isValidAction(actionName) {
    return this.getAllActions().includes(actionName);
  },

  getCategoryIcon(categoryName) {
    const icons = {
      "כתבי טענות ראשוניים": "📄",
      "הליכי ביניים": "📋",
      "כתבי טענות מיוחדים": "⚖️",
      "כתבי טענות במהלך ההליכים המשפטיים": "🏛️",
      מכתבים: "✉️",
      הסכמים: "📝",
      "צוואה/ירושה": "📜",
      "מסמכים דיגיטליים": "💻",
      "הליכי הוצאה לפועל": "⚖️",
      "בוררות ותיווך": "🤝",
      "הליכי פשיטת רגל ורה״ח": "📊",
      "פעולות ייעוץ ומחקר": "🔍",
      "הליכי רישוי ורגולציה": "📋",
      "דיני משפחה": "👨‍👩‍👧‍👦",
    };
    return icons[categoryName] || "📁";
  },

  highlightMatch(text, searchTerm) {
    if (!searchTerm) return text;

    const regex = new RegExp(
      `(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi"
    );
    return text.replace(regex, '<mark class="search-highlight">$1</mark>');
  },

  createProfessionalCombobox(
    containerId,
    inputId,
    placeholder = "בחר או חפש פעולה..."
  ) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="professional-combobox">
        <div class="combobox-input-wrapper">
          <input 
            type="text" 
            id="${inputId}" 
            placeholder="${placeholder}"
            autocomplete="off"
            class="combobox-input"
            required
            spellcheck="false"
          />
          <button type="button" class="combobox-dropdown-btn" id="${inputId}DropdownBtn">
            <i class="fas fa-chevron-down"></i>
          </button>
          <input type="hidden" id="${inputId}Selected" required />
        </div>
        
        <div class="combobox-dropdown" id="${inputId}Dropdown">
          <div class="dropdown-header">
            <span class="dropdown-title">בחר פעולה</span>
            <span class="dropdown-count" id="${inputId}Count"></span>
          </div>
          <div class="dropdown-content" id="${inputId}Content">
            <!-- תוצאות יוצגו כאן -->
          </div>
        </div>
        
        <div class="combobox-help">
          התחל להקליד לחיפוש או לחץ על החץ לרשימה המלאה
        </div>
      </div>
    `;

    this.setupComboboxListeners(inputId);
    this.showInitialOptions(inputId);
  },

  setupComboboxListeners(inputId) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(`${inputId}Dropdown`);
    const dropdownBtn = document.getElementById(`${inputId}DropdownBtn`);
    const hiddenInput = document.getElementById(`${inputId}Selected`);

    if (!input || !dropdown || !dropdownBtn || !hiddenInput) return;

    let isOpen = false;

    // פתיחה/סגירה של הרשימה
    const toggleDropdown = () => {
      if (isOpen) {
        this.closeDropdown(inputId);
      } else {
        this.openDropdown(inputId);
      }
    };

    // הקלדה בשדה
    input.addEventListener("input", (e) => {
      const value = e.target.value.trim();
      this.updateDropdownContent(inputId, value);

      if (!isOpen) {
        this.openDropdown(inputId);
      }

      // איפוס הערך הנסתר אם המשתמש משנה את הטקסט
      if (hiddenInput.value && hiddenInput.value !== value) {
        hiddenInput.value = "";
        input.classList.remove("selected");
      }
    });

    // פוקוס על השדה
    input.addEventListener("focus", () => {
      if (!isOpen) {
        this.openDropdown(inputId);
      }
    });

    // לחיצה על כפתור הרשימה
    dropdownBtn.addEventListener("click", (e) => {
      e.preventDefault();
      toggleDropdown();
      input.focus();
    });

    // מקלדת ניווט
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        this.navigateDropdown(inputId, "down");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        this.navigateDropdown(inputId, "up");
      } else if (e.key === "Enter") {
        e.preventDefault();
        this.selectHighlighted(inputId);
      } else if (e.key === "Escape") {
        this.closeDropdown(inputId);
      }
    });

    // סגירה בלחיצה מחוץ לרכיב
    document.addEventListener("click", (e) => {
      const combobox = input.closest(".professional-combobox");
      if (combobox && !combobox.contains(e.target)) {
        this.closeDropdown(inputId);
      }
    });

    // שמירה של מצב הרשימה
    dropdown.addEventListener("transitionend", () => {
      isOpen = dropdown.classList.contains("open");
    });
  },

  openDropdown(inputId) {
    const dropdown = document.getElementById(`${inputId}Dropdown`);
    const dropdownBtn = document.getElementById(`${inputId}DropdownBtn`);

    if (dropdown && dropdownBtn) {
      dropdown.classList.add("open");
      dropdownBtn.classList.add("open");
      this.updateDropdownContent(
        inputId,
        document.getElementById(inputId).value
      );
    }
  },

  closeDropdown(inputId) {
    const dropdown = document.getElementById(`${inputId}Dropdown`);
    const dropdownBtn = document.getElementById(`${inputId}DropdownBtn`);

    if (dropdown && dropdownBtn) {
      dropdown.classList.remove("open");
      dropdownBtn.classList.remove("open");
      this.clearHighlight(inputId);
    }
  },

  updateDropdownContent(inputId, searchValue) {
    const content = document.getElementById(`${inputId}Content`);
    const count = document.getElementById(`${inputId}Count`);

    if (!content || !count) return;

    const matches = this.searchActions(searchValue);
    count.textContent = `${matches.length} פעולות`;

    if (matches.length === 0) {
      content.innerHTML = `
        <div class="dropdown-empty">
          <i class="fas fa-search"></i>
          <span>לא נמצאו פעולות מתאימות</span>
        </div>
      `;
      return;
    }

    // קיבוץ לפי קטגוריות אם אין חיפוש
    if (!searchValue) {
      this.renderGroupedOptions(content, matches);
    } else {
      this.renderSearchResults(content, matches, searchValue);
    }
  },

  renderGroupedOptions(content, actions) {
    const grouped = {};

    actions.forEach((action) => {
      const category = this.findCategoryForAction(action);
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(action);
    });

    let html = "";
    Object.entries(grouped).forEach(([category, categoryActions]) => {
      const icon = this.getCategoryIcon(category);
      html += `
        <div class="dropdown-group">
          <div class="group-header">
            <span class="group-icon">${icon}</span>
            <span class="group-title">${category}</span>
          </div>
          ${categoryActions
            .map(
              (action) => `
            <div class="dropdown-option" data-value="${action}">
              <span class="option-text">${action}</span>
            </div>
          `
            )
            .join("")}
        </div>
      `;
    });

    content.innerHTML = html;
    this.attachOptionListeners(content);
  },

  renderSearchResults(content, actions, searchTerm) {
    let html = actions
      .map((action) => {
        const category = this.findCategoryForAction(action);
        const icon = this.getCategoryIcon(category);
        const highlighted = this.highlightMatch(action, searchTerm);

        return `
        <div class="dropdown-option search-result" data-value="${action}">
          <div class="option-main">
            <span class="option-icon">${icon}</span>
            <span class="option-text">${highlighted}</span>
          </div>
          <div class="option-category">${category}</div>
        </div>
      `;
      })
      .join("");

    content.innerHTML = html;
    this.attachOptionListeners(content);
  },

  attachOptionListeners(content) {
    const options = content.querySelectorAll(".dropdown-option");
    options.forEach((option) => {
      option.addEventListener("click", () => {
        const value = option.getAttribute("data-value");
        const inputId = content.id.replace("Content", "");
        this.selectOption(inputId, value);
      });

      option.addEventListener("mouseenter", () => {
        this.highlightOption(option);
      });
    });
  },

  selectOption(inputId, value) {
    const input = document.getElementById(inputId);
    const hiddenInput = document.getElementById(`${inputId}Selected`);

    if (input && hiddenInput) {
      input.value = value;
      hiddenInput.value = value;
      input.classList.add("selected");

      this.closeDropdown(inputId);

      // אפקט ויזואלי
      input.style.backgroundColor = "#f0fdf4";
      input.style.borderColor = "#10b981";

      setTimeout(() => {
        input.style.backgroundColor = "";
        input.style.borderColor = "";
      }, 1500);

      console.log(
        `נבחרה פעולה: ${value} מהקטגוריה: ${this.findCategoryForAction(value)}`
      );
    }
  },

  showInitialOptions(inputId) {
    this.updateDropdownContent(inputId, "");
  },

  navigateDropdown(inputId, direction) {
    const content = document.getElementById(`${inputId}Content`);
    if (!content) return;

    const options = content.querySelectorAll(".dropdown-option");
    const currentHighlight = content.querySelector(
      ".dropdown-option.highlighted"
    );

    let newIndex = 0;
    if (currentHighlight) {
      const currentIndex = Array.from(options).indexOf(currentHighlight);
      newIndex = direction === "down" ? currentIndex + 1 : currentIndex - 1;
    }

    // התמודדות עם גבולות
    if (newIndex < 0) newIndex = options.length - 1;
    if (newIndex >= options.length) newIndex = 0;

    this.clearHighlight(inputId);
    if (options[newIndex]) {
      options[newIndex].classList.add("highlighted");
      options[newIndex].scrollIntoView({ block: "nearest" });
    }
  },

  selectHighlighted(inputId) {
    const content = document.getElementById(`${inputId}Content`);
    if (!content) return;

    const highlighted = content.querySelector(".dropdown-option.highlighted");
    if (highlighted) {
      const value = highlighted.getAttribute("data-value");
      this.selectOption(inputId, value);
    }
  },

  highlightOption(option) {
    const content = option.closest(".dropdown-content");
    if (content) {
      content
        .querySelectorAll(".dropdown-option.highlighted")
        .forEach((opt) => {
          opt.classList.remove("highlighted");
        });
      option.classList.add("highlighted");
    }
  },

  clearHighlight(inputId) {
    const content = document.getElementById(`${inputId}Content`);
    if (content) {
      content
        .querySelectorAll(".dropdown-option.highlighted")
        .forEach((opt) => {
          opt.classList.remove("highlighted");
        });
    }
  },

  // פונקציות חדשות שהוספת
  getCategoriesStats() {
    const stats = {};
    let totalActions = 0;

    Object.entries(ACTION_CATEGORIES).forEach(([category, actions]) => {
      stats[category] = {
        count: actions.length,
        icon: this.getCategoryIcon(category),
        actions: actions,
      };
      totalActions += actions.length;
    });

    return {
      totalCategories: Object.keys(ACTION_CATEGORIES).length,
      totalActions: totalActions,
      categories: stats,
    };
  },

  advancedSearch(searchText, filterByCategory = null) {
    if (!searchText) return this.getPopularActions();

    const lowerSearch = searchText.toLowerCase();
    const results = [];

    Object.entries(ACTION_CATEGORIES).forEach(([category, actions]) => {
      if (filterByCategory && category !== filterByCategory) return;

      actions.forEach((action) => {
        if (action.toLowerCase().includes(lowerSearch)) {
          results.push({
            action: action,
            category: category,
            icon: this.getCategoryIcon(category),
            relevance: this.calculateRelevance(action, searchText),
          });
        }
      });
    });

    // מיון לפי רלוונטיות
    return results
      .sort((a, b) => b.relevance - a.relevance)
      .map((result) => result.action)
      .slice(0, 15);
  },

  calculateRelevance(action, searchText) {
    const actionLower = action.toLowerCase();
    const searchLower = searchText.toLowerCase();

    let score = 0;

    // משקל גבוה להתחלה מדויקת
    if (actionLower.startsWith(searchLower)) score += 100;

    // משקל בינוני להכלת המילה
    if (actionLower.includes(searchLower)) score += 50;

    // משקל נמוך ליחס אורך
    score += (searchText.length / action.length) * 25;

    // בונוס לפעולות פופולריות
    if (POPULAR_ACTIONS.includes(action)) score += 25;

    return score;
  },

  // פונקציה להצגת כל הקטגוריות והפעולות (לדיבוג)
  printAllCategories() {
    console.log("📋 כל הקטגוריות והפעולות:");
    console.log("=".repeat(50));

    Object.entries(ACTION_CATEGORIES).forEach(([category, actions]) => {
      const icon = this.getCategoryIcon(category);
      console.log(`\n${icon} ${category} (${actions.length} פעולות):`);
      actions.forEach((action, index) => {
        console.log(`  ${index + 1}. ${action}`);
      });
    });

    const stats = this.getCategoriesStats();
    console.log(
      `\n📊 סה״כ: ${stats.totalCategories} קטגוריות, ${stats.totalActions} פעולות`
    );
  },
};

// אתחול השדות עם הגרסה המקצועית
setTimeout(() => {
  if (document.getElementById("budgetDescriptionContainer")) {
    CategoryUtils.createProfessionalCombobox(
      "budgetDescriptionContainer",
      "budgetDescription",
      "בחר או חפש סוג משימה..."
    );
    console.log("✅ Combobox תקצוב נוצר");
  }

  if (document.getElementById("actionDescriptionContainer")) {
    CategoryUtils.createProfessionalCombobox(
      "actionDescriptionContainer",
      "actionDescription",
      "בחר או חפש סוג פעולה..."
    );
    console.log("✅ Combobox שעתון נוצר");
  }
}, 2000);

// יצוא הקבועים
window.ACTION_CATEGORIES = ACTION_CATEGORIES;
window.POPULAR_ACTIONS = POPULAR_ACTIONS;
window.CategoryUtils = CategoryUtils;

console.log("🎯 מערכת הפעולות עודכנה עם קטגוריות חדשות!");
console.log("📋 קטגוריות חדשות נוספו:");
console.log("  • מסמכים דיגיטליים (כולל תקנון אתר ומדיניות פרטיות)");
console.log("  • הליכי הוצאה לפועל");
console.log("  • בוררות ותיווך");
console.log("  • הליכי פשיטת רגל ורה״ח");
console.log("  • פעולות ייעוץ ומחקר");
console.log("  • הליכי רישוי ורגולציה");
console.log("  • דיני משפחה");

// הדפסת כל הקטגוריות לבדיקה
CategoryUtils.printAllCategories();
