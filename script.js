/**
 * Firebase-Only Law Office Management System
 * Clean version without legacy Google Apps Script integration
 * Version: 4.22.1 - With DatesModule integration
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
// Global flag to suppress loading during welcome screen
window.isInWelcomeScreen = false;

function showSimpleLoading(message = "מעבד...") {
  // Don't show loading overlay during welcome screen
  if (window.isInWelcomeScreen) {
    console.log("Suppressing loading overlay during welcome screen:", message);
    return;
  }
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
 * Show subtle progress indicator
 */
function showProgress(message = "") {
  // Remove existing indicator
  const existing = document.getElementById("progress-indicator");
  if (existing) existing.remove();

  // Create new indicator
  const indicator = document.createElement("div");
  indicator.id = "progress-indicator";
  indicator.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    font-size: 14px;
    font-weight: 500;
    z-index: 9998;
    display: flex;
    align-items: center;
    gap: 10px;
    animation: slideInUp 0.3s ease-out;
  `;

  indicator.innerHTML = `
    <div style="width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top: 2px solid white; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
    <span>${safeText(message || "מעבד...")}</span>
    <style>
      @keyframes slideInUp {
        from { transform: translateY(100px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    </style>
  `;

  document.body.appendChild(indicator);
}

/**
 * Hide progress indicator
 */
function hideProgress() {
  const indicator = document.getElementById("progress-indicator");
  if (indicator) {
    indicator.style.animation = "slideOutDown 0.3s ease-out";
    setTimeout(() => indicator.remove(), 300);
  }
}

/**
 * Show success feedback with animation
 */
function showSuccessFeedback(message = "בוצע בהצלחה") {
  const feedback = document.createElement("div");
  feedback.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    font-size: 14px;
    font-weight: 500;
    z-index: 9998;
    display: flex;
    align-items: center;
    gap: 10px;
    animation: slideInUp 0.3s ease-out;
  `;

  feedback.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style="flex-shrink: 0;">
      <circle cx="10" cy="10" r="10" fill="rgba(255,255,255,0.2)"/>
      <path d="M6 10l3 3 5-6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span>${safeText(message)}</span>
  `;

  document.body.appendChild(feedback);

  setTimeout(() => {
    feedback.style.animation = "slideOutDown 0.3s ease-out";
    setTimeout(() => feedback.remove(), 300);
  }, 2000);
}

// Add CSS animations for feedback system
const feedbackStyles = document.createElement("style");
feedbackStyles.textContent = `
  @keyframes slideInUp {
    from {
      transform: translateY(100px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @keyframes slideOutDown {
    from {
      transform: translateY(0);
      opacity: 1;
    }
    to {
      transform: translateY(100px);
      opacity: 0;
    }
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;
document.head.appendChild(feedbackStyles);

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
    if (!dateString) return '-';

    // Handle Firebase Timestamp
    let d;
    if (dateString.toDate && typeof dateString.toDate === 'function') {
      d = dateString.toDate();
    } else {
      d = new Date(dateString);
    }

    return d.toLocaleDateString("he-IL");
  } catch (error) {
    console.warn("formatDate failed", { input: dateString, error });
    return "תאריך לא תקין";
  }
}

function formatShort(date) {
  if (!date) return '-';

  // Handle Firebase Timestamp
  let d;
  if (date.toDate && typeof date.toDate === 'function') {
    d = date.toDate();
  } else {
    d = new Date(date);
  }

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
    return clients;
  } catch (error) {
    console.error("Firebase error:", error);
    throw new Error("שגיאה בטעינת לקוחות: " + error.message);
  }
}

/**
 * Load budget tasks from Firebase
 */
async function loadBudgetTasksFromFirebase(employee) {
  try {
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
      const data = doc.data();

      // ⚡ CRITICAL: Convert Firebase Timestamps to JavaScript Date objects
      const taskWithFirebaseId = {
        ...data,
        firebaseDocId: doc.id, // ✅ Always save Firebase document ID
        // Convert Timestamps to Date objects for proper formatting
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
        completedAt: data.completedAt?.toDate ? data.completedAt.toDate() : data.completedAt,
        deadline: data.deadline?.toDate ? data.deadline.toDate() : data.deadline,
      };

      // Only set 'id' if it doesn't exist in the data
      if (!taskWithFirebaseId.id) {
        taskWithFirebaseId.id = doc.id;
      }

      tasks.push(taskWithFirebaseId);
    });

    console.log(`🔥 Firebase: נטענו ${tasks.length} משימות`);
    return tasks;
  } catch (error) {
    console.error("Firebase error:", error);
    throw new Error("שגיאה בטעינת משימות: " + error.message);
  }
}

/**
 * Load timesheet entries from Firebase
 */
async function loadTimesheetFromFirebase(employee) {
  try {
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
      const data = doc.data();

      // Convert Firebase Timestamps to JavaScript Date objects
      entries.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
      });
    });

    // Sort by date (manual sorting instead of orderBy)
    entries.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date) - new Date(a.date);
    });

    console.log(`🔥 Firebase: נטענו ${entries.length} רשומות שעתון`);
    return entries;
  } catch (error) {
    console.error("Firebase error:", error);
    throw new Error("שגיאה בטעינת שעתון: " + error.message);
  }
}

/**
 * Save client to Firebase
 */
async function saveClientToFirebase(clientData) {
  try {
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
    return docRef.id;
  } catch (error) {
    console.error("Firebase error:", error);
    throw new Error("שגיאה בשמירת לקוח: " + error.message);
  }
}

/**
 * Save budget task to Firebase
 */
async function saveBudgetTaskToFirebase(taskData) {
  try {
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
    return docRef.id;
  } catch (error) {
    console.error("Firebase error:", error);
    throw new Error("שגיאה בשמירת משימה: " + error.message);
  }
}

/**
 * Save timesheet entry to Firebase
 */
async function saveTimesheetToFirebase(entryData) {
  try {
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
    return docRef.id;
  } catch (error) {
    console.error("Firebase error:", error);
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
// Old TablePagination class removed - now using PaginationModule from pagination.js

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
    this.currentBudgetSort = "recent";
    this.currentTimesheetSort = "recent";

    // Initialize Pagination Managers
    this.budgetPagination = window.PaginationModule.create({ pageSize: 20 });
    this.timesheetPagination = window.PaginationModule.create({ pageSize: 20 });

    // Initialize Activity Logger
    this.activityLogger = null; // Will be initialized after Firebase setup
    this.taskActionsManager = null; // Will be initialized after module loads

    // Initialize Integration Manager
    this.integrationManager = window.IntegrationManagerModule ? window.IntegrationManagerModule.create() : null;

    this.currentBudgetPage = 1;
    this.currentTimesheetPage = 1;
    this.clientValidation = new ClientValidation(this);
    this.welcomeScreenStartTime = null; // Track welcome screen duration
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
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        await this.handleLogin();
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
    const minimalSidebar = document.getElementById("minimalSidebar");
    const interfaceElements = document.getElementById("interfaceElements");
    const mainFooter = document.getElementById("mainFooter");
    const bubblesContainer = document.getElementById("bubblesContainer");

    if (loginSection) loginSection.classList.remove("hidden");
    if (appContent) appContent.classList.add("hidden");
    if (minimalSidebar) minimalSidebar.classList.add("hidden");
    if (interfaceElements) interfaceElements.classList.add("hidden");
    if (mainFooter) mainFooter.classList.add("hidden");
    if (bubblesContainer) bubblesContainer.classList.remove("hidden");

    // Remove class from body when logged out
    document.body.classList.remove("logged-in");
  }

  async handleLogin() {
    const password = document.getElementById("password").value;
    const employee = EMPLOYEES[this.targetEmployee];

    if (password === employee.password) {
      this.currentUser = employee.name;
      updateUserDisplay(this.currentUser);

      // Set flag to suppress old loading spinners
      window.isInWelcomeScreen = true;

      // Show welcome screen (non-blocking)
      this.showWelcomeScreen();

      // Load data while welcome screen is showing
      try {
        await this.loadData();

        // Log login activity (after data loaded and activity logger initialized)
        if (this.activityLogger) {
          await this.activityLogger.logLogin();
        }
      } catch (error) {
        this.showNotification("שגיאה בטעינת נתונים", "error");
        console.error("Error loading data:", error);
      }

      // Wait for minimum welcome screen time (2 seconds total)
      await this.waitForWelcomeMinimumTime();

      // Clear flag - welcome screen is done
      window.isInWelcomeScreen = false;

      // Show app after everything loaded
      this.showApp();
    } else {
      const errorMessage = document.getElementById("errorMessage");
      if (errorMessage) {
        errorMessage.classList.remove("hidden");
        setTimeout(() => errorMessage.classList.add("hidden"), 3000);
      }
    }
  }

  /**
   * מציג מסך ברוך הבא עם שם המשתמש ולוגו
   */
  showWelcomeScreen() {
    const loginSection = document.getElementById("loginSection");
    const welcomeScreen = document.getElementById("welcomeScreen");
    const welcomeTitle = document.getElementById("welcomeTitle");
    const lastLoginTime = document.getElementById("lastLoginTime");
    const bubblesContainer = document.getElementById("bubblesContainer");

    // Store welcome screen start time for minimum duration
    this.welcomeScreenStartTime = Date.now();

    // הסתר את מסך הכניסה
    if (loginSection) loginSection.classList.add("hidden");

    // עדכן שם משתמש
    if (welcomeTitle) {
      welcomeTitle.textContent = `ברוך הבא, ${this.currentUser}`;
    }

    // Get and display last login from localStorage
    const lastLogin = localStorage.getItem(`lastLogin_${this.currentUser}`);
    if (lastLoginTime) {
      if (lastLogin) {
        const loginDate = new Date(lastLogin);
        const formatted = loginDate.toLocaleString("he-IL", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        lastLoginTime.textContent = formatted;
      } else {
        lastLoginTime.textContent = "זו הכניסה הראשונה שלך";
      }
    }

    // Save current login time for next time
    localStorage.setItem(
      `lastLogin_${this.currentUser}`,
      new Date().toISOString()
    );

    // הצג את מסך ברוך הבא
    if (welcomeScreen) {
      welcomeScreen.classList.remove("hidden");
    }

    // Keep bubbles visible during welcome screen
    if (bubblesContainer) bubblesContainer.classList.remove("hidden");

    console.log(`👋 מסך ברוך הבא מוצג עבור: ${this.currentUser}`);
  }

  /**
   * וידוא שמסך הברוך הבא מוצג לפחות 2 שניות
   */
  async waitForWelcomeMinimumTime() {
    // Ensure welcome screen shows for at least 2 seconds
    const elapsed = Date.now() - this.welcomeScreenStartTime;
    const remaining = Math.max(0, 2000 - elapsed);
    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }
  }

  /**
   * עדכון טקסט הטעינה במסך ברוך הבא
   */
  updateLoaderText(text) {
    // Only update if welcome screen is active
    if (!window.isInWelcomeScreen) {
      return;
    }
    const loaderText = document.getElementById("loaderText");
    if (loaderText) {
      loaderText.textContent = text;
    }
  }

  showApp() {
    const loginSection = document.getElementById("loginSection");
    const welcomeScreen = document.getElementById("welcomeScreen");
    const appContent = document.getElementById("appContent");
    const interfaceElements = document.getElementById("interfaceElements");
    const minimalSidebar = document.getElementById("minimalSidebar");
    const mainFooter = document.getElementById("mainFooter");
    const bubblesContainer = document.getElementById("bubblesContainer");

    if (loginSection) loginSection.classList.add("hidden");
    if (welcomeScreen) welcomeScreen.classList.add("hidden");
    if (appContent) appContent.classList.remove("hidden");
    if (interfaceElements) interfaceElements.classList.remove("hidden");
    if (minimalSidebar) minimalSidebar.classList.remove("hidden");
    if (mainFooter) mainFooter.classList.remove("hidden");
    if (bubblesContainer) bubblesContainer.classList.add("hidden");

    // Add class to body when logged in
    document.body.classList.add("logged-in");

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
        this.filterBudgetTasks(); // ✅ Use the correct filter function that respects the SELECT value and renders
        this.applyTimesheetFilters();
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
      // Update loader text
      this.updateLoaderText("טוען לקוחות...");

      // Load clients (via IntegrationManager)
      this.clients = this.integrationManager
        ? await this.integrationManager.loadClients()
        : await loadClientsFromFirebase();

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

      // Update loader text
      this.updateLoaderText("טוען משימות...");

      // Load budget tasks (via IntegrationManager)
      this.budgetTasks = this.integrationManager
        ? await this.integrationManager.loadBudgetTasks(this.currentUser)
        : await loadBudgetTasksFromFirebase(this.currentUser);

      // Update loader text
      this.updateLoaderText("טוען שעתון...");

      // Load timesheet entries (via IntegrationManager)
      this.timesheetEntries = this.integrationManager
        ? await this.integrationManager.loadTimesheet(this.currentUser)
        : await loadTimesheetFromFirebase(this.currentUser);

      // Update loader text
      this.updateLoaderText("מערכת מוכנה!");

      // Initialize Activity Logger now that Firebase is ready
      if (!this.activityLogger && window.ActivityLoggerModule) {
        this.activityLogger = window.ActivityLoggerModule.create(firebase);
        this.activityLogger.setCurrentUser({
          uid: this.currentUser,
          email: this.currentUser,
          displayName: this.currentUser
        });
        console.log('✅ Activity Logger initialized');
      }

      // Initialize TaskActionsManager
      if (window.TaskActionsModule) {
        this.taskActionsManager = window.TaskActionsModule.create();
        this.taskActionsManager.setManager(this);
        console.log('✅ TaskActionsManager initialized');
      }

      this.connectionStatus = "connected";
      this.updateConnectionStatus?.("🟢 מחובר");
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

  // REMOVED - use filterBudgetTasks() instead which actually filters based on SELECT value

  applyTimesheetFilters() {
    this.filteredTimesheetEntries = [...this.timesheetEntries];
  }

  filterTimesheetEntries() {
    const filterSelect = document.getElementById('timesheetFilter');
    if (!filterSelect) return;

    const filterValue = filterSelect.value;
    const now = new Date();

    // Filter based on date range
    if (filterValue === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      this.filteredTimesheetEntries = this.timesheetEntries.filter(entry => {
        if (!entry.date) return false;
        const entryDate = new Date(entry.date);
        const entryDay = new Date(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate());
        return entryDay.getTime() === today.getTime();
      });
    } else if (filterValue === 'month') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      this.filteredTimesheetEntries = this.timesheetEntries.filter(entry => {
        if (!entry.date) return true;
        const entryDate = new Date(entry.date);
        return entryDate >= oneMonthAgo;
      });
    } else {
      // Show all
      this.filteredTimesheetEntries = [...this.timesheetEntries];
    }

    // Re-render
    this.renderTimesheetEntries();
  }

  sortTimesheetEntries() {
    // קבלת כל ה-selects (גם כרטיסים וגם טבלה)
    const allSelects = document.querySelectorAll('#timesheetSortSelect');
    if (allSelects.length === 0) return;

    // קבלת הערך מה-select שהופעל (event.target) או מהראשון
    const sortValue = event?.target?.value || allSelects[0].value;

    // שמירת הבחירה הנוכחית
    this.currentTimesheetSort = sortValue;

    // סינכרון כל ה-selects לאותו ערך
    allSelects.forEach(select => {
      if (select.value !== sortValue) {
        select.value = sortValue;
      }
    });

    // מיון מהיר ויעיל
    this.filteredTimesheetEntries.sort((a, b) => {
      switch (sortValue) {
        case 'recent':
          // מיון לפי תאריך - הכי אחרון ראשון
          const dateA = new Date(a.date || 0).getTime();
          const dateB = new Date(b.date || 0).getTime();
          return dateB - dateA;

        case 'client':
          // מיון לפי שם לקוח - עברית א-ת
          const nameA = (a.clientName || '').trim();
          const nameB = (b.clientName || '').trim();
          if (!nameA && !nameB) return 0;
          if (!nameA) return 1;
          if (!nameB) return -1;
          return nameA.localeCompare(nameB, 'he');

        case 'hours':
          // מיון לפי שעות - הכי גבוה ראשון
          const minutesA = a.minutes || 0;
          const minutesB = b.minutes || 0;
          return minutesB - minutesA;

        default:
          return 0;
      }
    });

    this.renderTimesheetEntries();
  }

  async loadMoreTimesheetEntries() {
    // Show skeleton
    if (window.SkeletonLoaderModule) {
      const skeletonType = this.currentTimesheetView === 'cards' ? 'card' : 'row';
      const containerId = this.currentTimesheetView === 'cards' ? 'timesheetCardsContainer' : 'timesheetTableContainer';
      window.SkeletonLoaderModule.show(containerId, {
        count: 3,
        type: skeletonType,
        columns: 8
      });
    }

    const delay = this.integrationManager ? this.integrationManager.getSkeletonDelay() : 300;

    setTimeout(async () => {
      // Use IntegrationManager if available
      if (this.integrationManager) {
        this.timesheetEntries = await this.integrationManager.loadMoreTimesheet(this.currentUser, this.timesheetEntries);
        this.filterTimesheetEntries();
      } else {
        const result = this.timesheetPagination.loadMore();
      }

      // Render with scroll preservation
      if (this.integrationManager) {
        this.integrationManager.executeWithScrollPreservation(() => {
          this.renderTimesheetEntries();
        });
      } else {
        this.renderTimesheetEntries();
      }

      // Hide skeleton after render
      if (window.SkeletonLoaderModule) {
        const containerId = this.currentTimesheetView === 'cards' ? 'timesheetCardsContainer' : 'timesheetTableContainer';
        window.SkeletonLoaderModule.hide(containerId);
      }
    }, delay);
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
      showProgress("שומר משימה...");

      // Save to Firebase ONLY - no local updates!
      await saveBudgetTaskToFirebase(budgetTask);

      // Reload from Firebase to get the saved task
      await this.loadDataFromFirebase();

      // Log activity
      if (this.activityLogger) {
        await this.activityLogger.logCreateTask(budgetTask.id, budgetTask);
      }

      this.clearBudgetForm();
      hideProgress();
      showSuccessFeedback("המשימה נוספה בהצלחה");
    } catch (error) {
      console.error("Error adding budget task:", error);
      hideProgress();
      this.showNotification("❌ שגיאה בהוספת משימה: " + error.message, "error");
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

      // Log activity
      if (this.activityLogger) {
        await this.activityLogger.logCreateTimesheet(tempEntry.id, timesheetEntry);
      }

      showSuccessFeedback("הפעולה נרשמה בשעתון בהצלחה");
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

    // Update items only if data changed (don't reset page)
    if (JSON.stringify(this.budgetPagination.items) !== JSON.stringify(tasksToShow)) {
      this.budgetPagination.setItems(tasksToShow);
    }

    // Get current page items (maintains current page number)
    const paginatedTasks = this.budgetPagination.getCurrentPageItems();

    if (budgetContainer && !budgetContainer.classList.contains("hidden")) {
      this.renderBudgetCards(paginatedTasks);
    }

    if (tableContainer && !tableContainer.classList.contains("hidden")) {
      this.renderBudgetTable(paginatedTasks);
    }
  }

  renderBudgetCards(tasks) {
    const container = document.getElementById("budgetContainer");
    if (!container) return;

    const tasksHtml = tasks.map((task) => this.createTaskCard(task)).join("");

    // שימוש במודול הסטטיסטיקה החדש - חישוב על כל המשימות (לא מסוננות)
    const stats = window.StatisticsModule.calculateBudgetStatistics(this.budgetTasks);
    const statsBar = window.StatisticsModule.createBudgetStatsBar(stats, this.currentTaskFilter || 'active');

    // Get pagination status
    const paginationStatus = this.budgetPagination.getStatus();

    // Generate load more button HTML
    const loadMoreButton = paginationStatus.hasMore ? `
      <div class="pagination-controls">
        <button class="load-more-btn" onclick="window.manager.loadMoreBudgetTasks()">
          <i class="fas fa-chevron-down"></i>
          טען עוד (${paginationStatus.filteredItems - paginationStatus.displayedItems} רשומות נוספות)
        </button>
        <div class="pagination-info">
          מציג ${paginationStatus.displayedItems} מתוך ${paginationStatus.filteredItems} רשומות
        </div>
      </div>
    ` : '';

    container.innerHTML = `
      <div class="modern-cards-container">
        <div class="modern-table-header">
          <h3 class="modern-table-title">
            <i class="fas fa-chart-bar"></i>
            משימות מתוקצבות
          </h3>
        </div>
        <div class="stats-with-sort-row">
          ${statsBar}
          <div class="sort-dropdown">
            <label class="sort-label">
              <i class="fas fa-sort-amount-down"></i>
              מיין לפי:
            </label>
            <select class="sort-select" id="budgetSortSelect" onchange="manager.sortBudgetTasks()">
              <option value="recent" ${this.currentBudgetSort === 'recent' ? 'selected' : ''}>עדכון אחרון</option>
              <option value="name" ${this.currentBudgetSort === 'name' ? 'selected' : ''}>שם (א-ת)</option>
              <option value="deadline" ${this.currentBudgetSort === 'deadline' ? 'selected' : ''}>תאריך יעד</option>
              <option value="progress" ${this.currentBudgetSort === 'progress' ? 'selected' : ''}>התקדמות</option>
            </select>
          </div>
        </div>
        <div class="budget-cards-grid">
          ${tasksHtml}
        </div>
        ${loadMoreButton}
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

    // Check if task is completed
    const isCompleted = safeTask.status === 'הושלם';
    const completedIndicator = isCompleted ? `
      <div style="display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: #10b981; border-radius: 50%; margin-left: 8px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
    ` : '';

    return `
      <div class="linear-minimal-card" data-task-id="${safeTask.id}">
        ${window.DatesModule.getCreationDateCorner(safeTask)}
        <div class="linear-card-content">
          <h3 class="linear-card-title" title="${safeClientName}" style="display: flex; align-items: center;">
            <span style="flex: 1;">${safeDescription}</span>
            ${completedIndicator}
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

    // שימוש במודול הסטטיסטיקה החדש - חישוב על כל המשימות (לא מסוננות)
    const stats = window.StatisticsModule.calculateBudgetStatistics(this.budgetTasks);
    const statsBar = window.StatisticsModule.createBudgetStatsBar(stats, this.currentTaskFilter || 'active');

    // Get pagination status
    const paginationStatus = this.budgetPagination.getStatus();

    // Generate load more button HTML
    const loadMoreButton = paginationStatus.hasMore ? `
      <div class="pagination-controls">
        <button class="load-more-btn" onclick="window.manager.loadMoreBudgetTasks()">
          <i class="fas fa-chevron-down"></i>
          טען עוד (${paginationStatus.filteredItems - paginationStatus.displayedItems} רשומות נוספות)
        </button>
        <div class="pagination-info">
          מציג ${paginationStatus.displayedItems} מתוך ${paginationStatus.filteredItems} רשומות
        </div>
      </div>
    ` : '';

    tableContainer.innerHTML = `
      <div class="modern-table-container">
        <div class="modern-table-header">
          <h3 class="modern-table-title">
            <i class="fas fa-chart-bar"></i>
            משימות מתוקצבות
          </h3>
        </div>
        <div class="stats-with-sort-row">
          ${statsBar}
          <div class="sort-dropdown">
            <label class="sort-label">
              <i class="fas fa-sort-amount-down"></i>
              מיין לפי:
            </label>
            <select class="sort-select" id="budgetSortSelect" onchange="manager.sortBudgetTasks()">
              <option value="recent" ${this.currentBudgetSort === 'recent' ? 'selected' : ''}>עדכון אחרון</option>
              <option value="name" ${this.currentBudgetSort === 'name' ? 'selected' : ''}>שם (א-ת)</option>
              <option value="deadline" ${this.currentBudgetSort === 'deadline' ? 'selected' : ''}>תאריך יעד</option>
              <option value="progress" ${this.currentBudgetSort === 'progress' ? 'selected' : ''}>התקדמות</option>
            </select>
          </div>
        </div>
        <table class="modern-budget-table">
          <thead>
            <tr>
              <th>לקוח</th>
              <th>תיאור</th>
              <th>התקדמות</th>
              <th>יעד</th>
              <th>נוצר</th>
              <th>סטטוס</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            ${tasks.map((task) => this.createTableRow(task)).join("")}
          </tbody>
        </table>
        ${loadMoreButton}
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

    // Visual indicator for completed tasks
    const isCompleted = safeTask.status === 'הושלם';
    const statusDisplay = isCompleted ? `
      <div style="display: flex; align-items: center; gap: 6px;">
        <div style="display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; background: #10b981; border-radius: 50%;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <span>${safeText(safeTask.status)}</span>
      </div>
    ` : safeText(safeTask.status);

    return `
      <tr data-task-id="${safeTask.id}">
        <td>${safeText(safeTask.clientName)}</td>
        <td>${safeText(safeTask.description)}</td>
        <td>${progress}%</td>
        <td>${formatDate(safeTask.deadline)}</td>
        <td style="color: #6b7280; font-size: 13px;">${window.DatesModule.getCreationDateTableCell(safeTask)}</td>
        <td>${statusDisplay}</td>
        <td class="actions-column">
          ${this.taskActionsManager ? this.taskActionsManager.createTableActionButtons(safeTask, isCompleted) : ''}
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

    // Update items only if data changed (don't reset page)
    if (JSON.stringify(this.timesheetPagination.items) !== JSON.stringify(entriesToShow)) {
      this.timesheetPagination.setItems(entriesToShow);
    }

    // Get current page items (maintains current page number)
    const paginatedEntries = this.timesheetPagination.getCurrentPageItems();

    if (
      timesheetContainer &&
      !timesheetContainer.classList.contains("hidden")
    ) {
      this.renderTimesheetCards(paginatedEntries);
    }

    if (tableContainer && !tableContainer.classList.contains("hidden")) {
      this.renderTimesheetTable(paginatedEntries);
    }
  }

  renderTimesheetCards(entries) {
    const container = document.getElementById("timesheetContainer");
    if (!container) return;

    const cardsHtml = entries
      .map((entry) => this.createTimesheetCard(entry))
      .join("");

    // חישוב סטטיסטיקה מלאה
    const stats = window.StatisticsModule.calculateTimesheetStatistics(
      this.timesheetEntries || []
    );
    const statsBar = window.StatisticsModule.createTimesheetStatsBar(stats);

    // Get pagination status
    const paginationStatus = this.timesheetPagination.getStatus();

    // Generate load more button HTML
    const loadMoreButton = paginationStatus.hasMore ? `
      <div class="pagination-controls">
        <button class="load-more-btn" onclick="window.manager.loadMoreTimesheetEntries()">
          <i class="fas fa-chevron-down"></i>
          טען עוד (${paginationStatus.filteredItems - paginationStatus.displayedItems} רשומות נוספות)
        </button>
        <div class="pagination-info">
          מציג ${paginationStatus.displayedItems} מתוך ${paginationStatus.filteredItems} רשומות
        </div>
      </div>
    ` : '';

    container.innerHTML = `
      <div class="modern-cards-container">
        <div class="modern-table-header">
          <h3 class="modern-table-title">
            <i class="fas fa-clock"></i>
            רשומות שעות
          </h3>
          <div class="modern-table-subtitle">
            ${entries.length} רשומות • ${stats.totalMinutes} דקות • ${stats.totalHours} שעות
          </div>
        </div>
        <div class="stats-with-sort-row">
          ${statsBar}
          <div class="sort-dropdown">
            <label class="sort-label">
              <i class="fas fa-sort-amount-down"></i>
              מיין לפי:
            </label>
            <select class="sort-select" id="timesheetSortSelect" onchange="manager.sortTimesheetEntries()">
              <option value="recent" ${this.currentTimesheetSort === 'recent' ? 'selected' : ''}>תאריך אחרון</option>
              <option value="client" ${this.currentTimesheetSort === 'client' ? 'selected' : ''}>שם לקוח (א-ת)</option>
              <option value="hours" ${this.currentTimesheetSort === 'hours' ? 'selected' : ''}>שעות (גבוה-נמוך)</option>
            </select>
          </div>
        </div>
        <div class="timesheet-cards-grid">
          ${cardsHtml}
        </div>
        ${loadMoreButton}
      </div>
    `;
  }

  createTimesheetCard(entry) {
    const safeEntry = {
      id: entry.id || entry.entryId || Date.now(),
      clientName: entry.clientName || "",
      action: entry.action || "",
      minutes: entry.minutes || 0,
      date: entry.date || new Date().toISOString(),
      fileNumber: entry.fileNumber || "",
      notes: entry.notes || "",
      createdAt: entry.createdAt || null
    };

    const hours = Math.round((safeEntry.minutes / 60) * 10) / 10;
    const safeClientName = safeText(safeEntry.clientName);
    const safeAction = safeText(safeEntry.action);
    const safeFileNumber = safeText(safeEntry.fileNumber);
    const safeNotes = safeText(safeEntry.notes);

    return `
      <div class="linear-minimal-card timesheet-card" data-entry-id="${safeEntry.id}" onclick="manager.expandTimesheetCard('${safeEntry.id}', event)">
        <div class="linear-card-content">
          <h3 class="linear-card-title">
            ${safeAction}
          </h3>
          <div class="linear-progress-section">
            <div class="linear-time-info">
              <div class="time-item actual">
                <span class="time-value">${hours}h</span>
                <span class="time-label">${safeEntry.minutes} דק'</span>
              </div>
              <div class="time-item estimated">
                <span class="time-value">${formatShort(safeEntry.date)}</span>
                <span class="time-label">תאריך</span>
              </div>
            </div>
          </div>
          <div class="linear-card-meta">
            <div class="linear-client-row">
              <span class="linear-client-label">לקוח:</span>
              <span class="linear-client-name">
                ${safeClientName}
              </span>
            </div>
            ${safeFileNumber ? `
            <div class="linear-deadline-row">
              <span class="linear-progress-label">תיק:</span>
              <span class="deadline-info">
                ${safeFileNumber}
              </span>
            </div>
            ` : ''}
            ${window.DatesModule.getCreationDateHTML(safeEntry)}
            ${safeNotes ? `
            <div class="linear-deadline-row">
              <span class="linear-progress-label">הערות:</span>
              <span class="deadline-info" style="color: #6b7280; font-size: 12px;">
                ${safeNotes}
              </span>
            </div>
            ` : ''}
          </div>
        </div>
        <button class="linear-expand-btn" onclick="event.stopPropagation(); manager.showEditTimesheetDialog('${safeEntry.id}')" title="ערוך" style="position: absolute; bottom: 15px; left: 15px;">
          <i class="fas fa-edit"></i>
        </button>
      </div>
    `;
  }

  getTotalMinutes(entries) {
    return entries.reduce((total, entry) => total + (entry.minutes || 0), 0);
  }

  expandTimesheetCard(entryId, event) {
    event.stopPropagation();
    const entry = this.timesheetEntries.find((e) => e.id == entryId || e.entryId == entryId);
    if (!entry) return;

    this.showExpandedTimesheetCard(entry);
  }

  showExpandedTimesheetCard(entry) {
    const safeEntry = {
      id: entry.id || entry.entryId || Date.now(),
      clientName: safeText(entry.clientName || ""),
      action: safeText(entry.action || ""),
      minutes: entry.minutes || 0,
      date: entry.date || new Date().toISOString(),
      fileNumber: safeText(entry.fileNumber || ""),
      notes: safeText(entry.notes || "")
    };

    const hours = Math.round((safeEntry.minutes / 60) * 10) / 10;

    const expandedContent = `
      <div class="linear-expanded-overlay" onclick="manager.closeExpandedCard(event)">
        <div class="linear-expanded-card" onclick="event.stopPropagation()">
          <div class="linear-expanded-header">
            <h2 class="linear-expanded-title">${safeEntry.action}</h2>
            <button class="linear-close-btn" onclick="manager.closeExpandedCard(event)">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="linear-expanded-body">
            <div class="linear-info-grid">
              <div class="linear-info-item">
                <label>לקוח:</label>
                <span>${safeEntry.clientName}</span>
              </div>
              <div class="linear-info-item">
                <label>תאריך:</label>
                <span>${formatDate(safeEntry.date)}</span>
              </div>
              <div class="linear-info-item">
                <label>זמן:</label>
                <span>${hours}h (${safeEntry.minutes} דקות)</span>
              </div>
              ${safeEntry.fileNumber ? `
              <div class="linear-info-item">
                <label>תיק:</label>
                <span>${safeEntry.fileNumber}</span>
              </div>
              ` : ''}
            </div>
            ${safeEntry.notes ? `
            <div class="linear-expanded-section">
              <h3>הערות</h3>
              <p>${safeEntry.notes}</p>
            </div>
            ` : ''}
            <div class="linear-expanded-actions">
              <button class="linear-action-btn primary" onclick="manager.showEditTimesheetDialog('${safeEntry.id}'); manager.closeExpandedCard(event)">
                <i class="fas fa-edit"></i>
                ערוך
              </button>
              <button class="linear-action-btn secondary" onclick="manager.closeExpandedCard(event)">
                סגור
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", expandedContent);
    setTimeout(() => {
      const overlay = document.querySelector(".linear-expanded-overlay");
      if (overlay) overlay.classList.add("active");
    }, 10);
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
          <td style="color: #6b7280; font-size: 13px;">${window.DatesModule.getCreationDateTableCell(entry)}</td>
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

    // חישוב סטטיסטיקה מלאה
    const stats = window.StatisticsModule.calculateTimesheetStatistics(
      this.timesheetEntries || []
    );
    const statsBar = window.StatisticsModule.createTimesheetStatsBar(stats);

    // Get pagination status
    const paginationStatus = this.timesheetPagination.getStatus();

    // Generate load more button HTML
    const loadMoreButton = paginationStatus.hasMore ? `
      <div class="pagination-controls">
        <button class="load-more-btn" onclick="window.manager.loadMoreTimesheetEntries()">
          <i class="fas fa-chevron-down"></i>
          טען עוד (${paginationStatus.filteredItems - paginationStatus.displayedItems} רשומות נוספות)
        </button>
        <div class="pagination-info">
          מציג ${paginationStatus.displayedItems} מתוך ${paginationStatus.filteredItems} רשומות
        </div>
      </div>
    ` : '';

    tableContainer.innerHTML = `
      <div class="modern-table-container">
        <div class="modern-table-header">
          <h3 class="modern-table-title">
            <i class="fas fa-clock"></i>
            רשומות שעות
          </h3>
          <div class="modern-table-subtitle">
            ${entries.length} רשומות • ${stats.totalMinutes} דקות • ${stats.totalHours} שעות
          </div>
        </div>
        <div class="stats-with-sort-row">
          ${statsBar}
          <div class="sort-dropdown">
            <label class="sort-label">
              <i class="fas fa-sort-amount-down"></i>
              מיין לפי:
            </label>
            <select class="sort-select" id="timesheetSortSelect" onchange="manager.sortTimesheetEntries()">
              <option value="recent" ${this.currentTimesheetSort === 'recent' ? 'selected' : ''}>תאריך אחרון</option>
              <option value="client" ${this.currentTimesheetSort === 'client' ? 'selected' : ''}>שם לקוח (א-ת)</option>
              <option value="hours" ${this.currentTimesheetSort === 'hours' ? 'selected' : ''}>שעות (גבוה-נמוך)</option>
            </select>
          </div>
        </div>
        <div class="table-wrapper">
          <table class="modern-timesheet-table">
            <thead>
              <tr>
                <th>תאריך</th>
                <th>פעולה</th>
                <th>זמן</th>
                <th>לקוח</th>
                <th>תיק</th>
                <th>נוצר</th>
                <th>הערות</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
        ${loadMoreButton}
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
      createdAt: task.createdAt || null,
      updatedAt: task.updatedAt || null,
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
    // Count from ALL tasks, not filtered
    return (this.budgetTasks || []).filter(
      (task) => task && task.status !== "הושלם"
    ).length;
  }

  getCompletedTasksCount() {
    // Count from ALL tasks, not filtered
    return (this.budgetTasks || []).filter(
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
      showProgress("שומר לקוח...");
      await saveClientToFirebase(client);
      await this.loadDataFromFirebase();
      hideProgress();
      showSuccessFeedback("הלקוח נוסף בהצלחה");
    } catch (error) {
      console.error("Error creating client:", error);
      hideProgress();
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
    const isCompleted = safeTask.status === 'הושלם';

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
            ${this.taskActionsManager ? this.taskActionsManager.createCardActionButtons(safeTask, isCompleted) : ''}
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
      showProgress("רושם זמן למשימה...");

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
      }

      // Here you would add Firebase function to add time to task
      // For now, just simulate success
      setTimeout(() => this.loadDataFromFirebase(), 1000);

      hideProgress();
      showSuccessFeedback("זמן נוסף למשימה בהצלחה");
    } catch (error) {
      console.error("Error adding time:", error);

      if (originalTask && taskIndex !== -1) {
        this.budgetTasks[taskIndex] = originalTask;
        this.filteredBudgetTasks = [...this.budgetTasks];
        this.renderBudgetTasks();
      }

      hideProgress();
      this.showNotification("❌ שגיאה ברישום זמן - נסה שוב", "error");
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
        <div class="popup-buttons" style="justify-content: flex-start;">
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

    // Show professional completion modal
    this.showTaskCompletionModal(task);
  }

  showTaskCompletionModal(task) {
    const overlay = document.createElement("div");
    overlay.className = "popup-overlay";
    overlay.style.zIndex = "10000";

    // Calculate statistics
    const estimatedMinutes = task.estimatedMinutes || 0;
    const actualMinutes = task.actualMinutes || 0;
    const timeDiff = actualMinutes - estimatedMinutes;
    const timePercentage =
      estimatedMinutes > 0
        ? ((actualMinutes / estimatedMinutes) * 100).toFixed(0)
        : 0;

    // Deadline statistics
    const now = new Date();
    const deadline = task.deadline ? new Date(task.deadline) : null;
    const createdAt = task.createdAt ? new Date(task.createdAt) : now;
    const originalDeadline = task.originalDeadline
      ? new Date(task.originalDeadline)
      : deadline;
    const wasExtended =
      task.deadlineExtensions && task.deadlineExtensions.length > 0;

    let deadlineStatus = "";
    let deadlineClass = "";
    let deadlineIconClass = "";
    let deadlineColor = "";

    if (deadline) {
      const daysRemaining = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));

      if (daysRemaining < 0) {
        deadlineStatus = `איחור של ${Math.abs(daysRemaining)} ימים`;
        deadlineClass = "deadline-late";
        deadlineIconClass = "fa-exclamation-triangle";
        deadlineColor = "#ef4444";
      } else if (daysRemaining === 0) {
        deadlineStatus = "בדיוק בזמן!";
        deadlineClass = "deadline-ontime";
        deadlineIconClass = "fa-check-circle";
        deadlineColor = "#3b82f6";
      } else {
        deadlineStatus = `${daysRemaining} ימים לפני המועד`;
        deadlineClass = "deadline-early";
        deadlineIconClass = "fa-flag-checkered";
        deadlineColor = "#10b981";
      }

      if (wasExtended && originalDeadline) {
        const extensionDays = Math.ceil(
          (deadline - originalDeadline) / (1000 * 60 * 60 * 24)
        );
        deadlineStatus += ` (הוארך ב-${extensionDays} ימים)`;
      }
    } else {
      deadlineStatus = "ללא תאריך יעד";
      deadlineClass = "deadline-none";
      deadlineIconClass = "fa-calendar";
      deadlineColor = "#9ca3af";
    }

    // Time status
    let timeStatus = "";
    let timeClass = "";
    let timeIconClass = "";
    let timeColor = "";

    if (timeDiff < 0) {
      timeStatus = `חסכת ${Math.abs(timeDiff)} דקות!`;
      timeClass = "time-saved";
      timeIconClass = "fa-bolt";
      timeColor = "#10b981";
    } else if (timeDiff === 0) {
      timeStatus = "בדיוק לפי התקציב!";
      timeClass = "time-exact";
      timeIconClass = "fa-check-circle";
      timeColor = "#3b82f6";
    } else {
      timeStatus = `חרגת ב-${timeDiff} דקות`;
      timeClass = "time-over";
      timeIconClass = "fa-clock";
      timeColor = "#ef4444";
    }

    overlay.innerHTML = `
      <div class="popup completion-modal" style="max-width: 650px; animation: slideInUp 0.3s ease-out;">
        <!-- Header -->
        <div class="popup-header" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; position: relative;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-check-circle" style="font-size: 24px;"></i>
            <span style="font-size: 18px; font-weight: 600;">סיום משימה</span>
          </div>
          <button
            onclick="this.closest('.popup-overlay').remove()"
            style="position: absolute; left: 20px; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s;"
            onmouseover="this.style.background='rgba(255,255,255,0.3)'"
            onmouseout="this.style.background='rgba(255,255,255,0.2)'"
            title="סגור">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="popup-content" style="padding: 30px;">
          <!-- Task Info -->
          <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 20px; border-radius: 12px; margin-bottom: 25px; border: 1px solid #e5e7eb;">
            <h3 style="margin: 0 0 12px 0; color: #1f2937; font-size: 18px; font-weight: 700;">
              ${safeText(task.taskDescription || task.description || "")}
            </h3>
            <div style="color: #6b7280; font-size: 14px; display: flex; align-items: center; gap: 16px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <i class="fas fa-building" style="color: #3b82f6;"></i>
                <span>${safeText(task.clientName || "")}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <i class="fas fa-folder" style="color: #8b5cf6;"></i>
                <span>${safeText(task.fileNumber || "")}</span>
              </div>
            </div>
          </div>

          <!-- Statistics Grid -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">

            <!-- Time Budget Card -->
            <div class="stat-card ${timeClass}" style="background: white; border: 2px solid ${timeColor}; border-radius: 12px; padding: 24px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
              <div style="width: 56px; height: 56px; border-radius: 50%; background: ${timeColor}15; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px;">
                <i class="fas ${timeIconClass}" style="font-size: 24px; color: ${timeColor};"></i>
              </div>
              <div style="font-size: 13px; color: #6b7280; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">תקציב זמן</div>
              <div style="font-size: 28px; font-weight: bold; color: #1f2937; margin-bottom: 4px;">
                ${actualMinutes} <span style="font-size: 18px; color: #9ca3af;">/</span> ${estimatedMinutes}
              </div>
              <div style="font-size: 12px; color: #9ca3af; margin-bottom: 12px;">דקות</div>
              <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
                <div style="font-size: 14px; font-weight: 600; color: ${timeColor};">
                  ${timeStatus}
                </div>
                <div style="font-size: 12px; color: #9ca3af; margin-top: 4px;">
                  ${timePercentage}% מהתקציב
                </div>
              </div>
            </div>

            <!-- Deadline Card -->
            <div class="stat-card ${deadlineClass}" style="background: white; border: 2px solid ${deadlineColor}; border-radius: 12px; padding: 24px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
              <div style="width: 56px; height: 56px; border-radius: 50%; background: ${deadlineColor}15; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px;">
                <i class="fas ${deadlineIconClass}" style="font-size: 24px; color: ${deadlineColor};"></i>
              </div>
              <div style="font-size: 13px; color: #6b7280; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">תאריך יעד</div>
              <div style="font-size: 16px; font-weight: bold; color: #1f2937; margin-bottom: 4px;">
                ${deadline ? formatDate(deadline) : "לא הוגדר"}
              </div>
              <div style="font-size: 12px; color: #9ca3af; margin-bottom: 12px;">
                ${deadline ? `יצירה: ${formatDate(createdAt)}` : ""}
              </div>
              <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
                <div style="font-size: 14px; font-weight: 600; color: ${deadlineColor};">
                  ${deadlineStatus}
                </div>
              </div>
            </div>
          </div>

          <!-- Completion Notes -->
          <div style="margin-bottom: 0;">
            <label style="display: block; margin-bottom: 10px; font-weight: 600; color: #374151; font-size: 14px; display: flex; align-items: center; gap: 8px;">
              <i class="fas fa-pen" style="color: #10b981;"></i>
              הערות סיום (אופציונלי)
            </label>
            <textarea
              id="completionNotes"
              rows="4"
              placeholder="תאר את התוצאות, לקחים, או כל מידע רלוונטי אחר..."
              style="width: 100%; padding: 14px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; font-family: inherit; resize: vertical; transition: all 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.05);"
              onfocus="this.style.borderColor='#10b981'; this.style.boxShadow='0 0 0 3px rgba(16, 185, 129, 0.1)'"
              onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.05)'"
            ></textarea>
            <div style="text-align: left; font-size: 12px; color: #9ca3af; margin-top: 6px;">
              <span id="notesCounter">0</span> תווים
            </div>
          </div>

        </div>

        <div class="popup-buttons" style="padding: 20px 30px; background: linear-gradient(180deg, #f9fafb 0%, #f3f4f6 100%); border-top: 1px solid #e5e7eb; display: flex; gap: 12px;">
          <button
            class="popup-btn popup-btn-confirm"
            id="confirmCompleteBtn"
            onclick="manager.submitTaskCompletion(${task.id})"
            style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); flex: 1; padding: 15px; font-size: 16px; font-weight: 600; border-radius: 10px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); transition: all 0.2s;"
            onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(16, 185, 129, 0.4)'"
            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(16, 185, 129, 0.3)'">
            <i class="fas fa-check"></i> אשר סיום משימה
          </button>
          <button
            class="popup-btn popup-btn-cancel"
            onclick="this.closest('.popup-overlay').remove()"
            style="flex: 0.4; padding: 15px; border-radius: 10px; transition: all 0.2s;"
            onmouseover="this.style.transform='translateY(-1px)'"
            onmouseout="this.style.transform='translateY(0)'">
            <i class="fas fa-times"></i> ביטול
          </button>
        </div>
      </div>
    `;

    // Add character counter
    const textarea = overlay.querySelector("#completionNotes");
    const counter = overlay.querySelector("#notesCounter");
    if (textarea && counter) {
      textarea.addEventListener("input", () => {
        counter.textContent = textarea.value.length;
      });
    }

    document.body.appendChild(overlay);
  }

  async submitTaskCompletion(taskId) {
    const task = this.budgetTasks.find((t) => t.id === taskId);
    if (!task) return;

    const notesTextarea = document.getElementById("completionNotes");
    const notes = notesTextarea ? notesTextarea.value.trim() : "";
    const confirmBtn = document.getElementById("confirmCompleteBtn");
    const popup = document.querySelector(".completion-modal");

    try {
      // Disable button and show loading
      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> שומר...';
      }

      // Save to Firebase - MUST use firebaseDocId (not task.id!)
      if (!task.firebaseDocId) {
        throw new Error("❌ שגיאה פנימית: firebaseDocId לא נמצא במשימה");
      }
      await completeTaskFirebase(task.firebaseDocId, notes);

      // Log activity
      if (this.activityLogger) {
        await this.activityLogger.logCompleteTask(
          task.id,
          task.taskDescription || task.description
        );
      }

      // Show success in modal
      if (popup) {
        popup.querySelector(".popup-content").innerHTML = `
          <div style="text-align: center; padding: 80px 40px;">
            <div style="width: 80px; height: 80px; border-radius: 50%; background: #10b98115; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; animation: successPulse 0.5s ease-out;">
              <i class="fas fa-check" style="font-size: 40px; color: #10b981;"></i>
            </div>
            <h2 style="color: #1f2937; margin-bottom: 12px; font-size: 24px; font-weight: 700;">המשימה הושלמה בהצלחה!</h2>
            <p style="color: #6b7280; font-size: 15px; margin-bottom: 24px;">הנתונים נשמרו ב-Firebase</p>
            <div style="font-size: 13px; color: #9ca3af;">סוגר אוטומטית בעוד רגע...</div>
          </div>
          <style>
            @keyframes successPulse {
              0% { transform: scale(0); opacity: 0; }
              50% { transform: scale(1.1); }
              100% { transform: scale(1); opacity: 1; }
            }
          </style>
        `;

        // Keep close button in header, remove bottom buttons
        const buttonsDiv = popup.querySelector(".popup-buttons");
        if (buttonsDiv) {
          buttonsDiv.innerHTML = `
            <button
              class="popup-btn popup-btn-cancel"
              onclick="this.closest('.popup-overlay').remove()"
              style="width: 100%; padding: 14px; border-radius: 10px;">
              <i class="fas fa-times"></i> סגור
            </button>
          `;
        }
      }

      // Wait a moment, then close modal and refresh
      setTimeout(async () => {
        // Close modal first
        document.querySelector(".popup-overlay")?.remove();

        // Reload data from Firebase
        await this.loadDataFromFirebase();

        // Switch to "active only" filter
        const filterSelect = document.getElementById("budgetTaskFilter");
        if (filterSelect) {
          filterSelect.value = "active";
          this.filterBudgetTasks();
        }
      }, 2000);
    } catch (error) {
      console.error("Error completing task:", error);

      // Show error in modal
      if (popup) {
        const errorDiv = document.createElement("div");
        errorDiv.style.cssText =
          "background: #fee; border: 2px solid #ef4444; padding: 15px; border-radius: 8px; margin: 20px; color: #991b1b;";
        errorDiv.innerHTML = `<strong>❌ שגיאה:</strong> ${safeText(
          error.message || "שגיאה בשמירת המשימה"
        )}`;
        popup
          .querySelector(".popup-content")
          .insertBefore(
            errorDiv,
            popup.querySelector(".popup-content").firstChild
          );
      }

      // Re-enable button
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fas fa-check"></i> אשר סיום משימה';
      }
    }
  }

  filterBudgetTasks() {
    const filterSelect = document.getElementById('budgetTaskFilter');
    if (!filterSelect) return;

    const filterValue = filterSelect.value;
    this.currentTaskFilter = filterValue;

    // Filter based on status
    if (filterValue === 'active') {
      this.filteredBudgetTasks = this.budgetTasks.filter(t => t.status !== 'הושלם');
    } else if (filterValue === 'completed') {
      // Show completed tasks from last month
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      this.filteredBudgetTasks = this.budgetTasks.filter(t => {
        if (t.status !== 'הושלם') return false;
        if (!t.completedAt) return true;
        const completedDate = new Date(t.completedAt);
        return completedDate >= oneMonthAgo;
      });
    } else {
      // Show all
      this.filteredBudgetTasks = [...this.budgetTasks];
    }

    // Re-render
    this.renderBudgetTasks();
  }

  sortBudgetTasks() {
    // קבלת כל ה-selects (גם כרטיסים וגם טבלה)
    const allSelects = document.querySelectorAll('#budgetSortSelect');
    if (allSelects.length === 0) return;

    // קבלת הערך מה-select שהופעל (event.target) או מהראשון
    const sortValue = event?.target?.value || allSelects[0].value;

    // שמירת הבחירה הנוכחית
    this.currentBudgetSort = sortValue;

    // סינכרון כל ה-selects לאותו ערך
    allSelects.forEach(select => {
      if (select.value !== sortValue) {
        select.value = sortValue;
      }
    });

    // מיון מהיר ויעיל
    this.filteredBudgetTasks.sort((a, b) => {
      switch (sortValue) {
        case 'recent':
          // מיון לפי עדכון אחרון - הכי חדש ראשון
          const dateA = new Date(a.lastUpdated || a.createdAt || 0).getTime();
          const dateB = new Date(b.lastUpdated || b.createdAt || 0).getTime();
          return dateB - dateA;

        case 'name':
          // מיון לפי שם לקוח - עברית א-ת
          const nameA = (a.clientName || '').trim();
          const nameB = (b.clientName || '').trim();
          if (!nameA && !nameB) return 0;
          if (!nameA) return 1;
          if (!nameB) return -1;
          return nameA.localeCompare(nameB, 'he');

        case 'deadline':
          // מיון לפי תאריך יעד - הכי קרוב ראשון
          const deadlineA = new Date(a.deadline || '9999-12-31').getTime();
          const deadlineB = new Date(b.deadline || '9999-12-31').getTime();
          return deadlineA - deadlineB;

        case 'progress':
          // מיון לפי התקדמות - הכי גבוה ראשון
          const progressA = a.estimatedMinutes > 0 ? (a.actualMinutes / a.estimatedMinutes) * 100 : 0;
          const progressB = b.estimatedMinutes > 0 ? (b.actualMinutes / b.estimatedMinutes) * 100 : 0;
          return progressB - progressA;

        default:
          return 0;
      }
    });

    this.renderBudgetTasks();
  }

  async loadMoreBudgetTasks() {
    // Show skeleton
    if (window.SkeletonLoaderModule) {
      const skeletonType = this.currentBudgetView === 'cards' ? 'card' : 'row';
      const containerId = this.currentBudgetView === 'cards' ? 'budgetCardsContainer' : 'budgetTableContainer';
      window.SkeletonLoaderModule.show(containerId, {
        count: 3,
        type: skeletonType,
        columns: 8
      });
    }

    const delay = this.integrationManager ? this.integrationManager.getSkeletonDelay() : 300;

    setTimeout(async () => {
      // Use IntegrationManager if available
      if (this.integrationManager) {
        this.budgetTasks = await this.integrationManager.loadMoreBudgetTasks(this.currentUser, this.budgetTasks);
        this.filterBudgetTasks();
      } else {
        const result = this.budgetPagination.loadMore();
      }

      // Render with scroll preservation
      if (this.integrationManager) {
        this.integrationManager.executeWithScrollPreservation(() => {
          this.renderBudgetTasks();
        });
      } else {
        this.renderBudgetTasks();
      }

      // Hide skeleton after render
      if (window.SkeletonLoaderModule) {
        const containerId = this.currentBudgetView === 'cards' ? 'budgetCardsContainer' : 'budgetTableContainer';
        window.SkeletonLoaderModule.hide(containerId);
      }
    }, delay);
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
          this.filterBudgetTasks();
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

// ===== Reports Functions - מוסיפים ל-Manager =====

LawOfficeManager.prototype.initReportsForm = function() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // Populate year dropdowns (last 5 years + next year)
  const yearSelects = ['reportsYear', 'reportsYear1', 'reportsYear2'];
  yearSelects.forEach(selectId => {
    const select = document.getElementById(selectId);
    if (select) {
      select.innerHTML = '';
      for (let year = currentYear - 5; year <= currentYear + 1; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === currentYear) option.selected = true;
        select.appendChild(option);
      }
    }
  });

  // Set current month
  const monthSelects = ['reportsMonth', 'reportsMonth1', 'reportsMonth2'];
  monthSelects.forEach(selectId => {
    const select = document.getElementById(selectId);
    if (select) select.value = currentMonth;
  });

  // Set up event listeners for report type changes
  const reportsType = document.getElementById('reportsType');
  if (reportsType) {
    reportsType.addEventListener('change', this.handleReportTypeChange.bind(this));
  }
};

LawOfficeManager.prototype.handleReportTypeChange = function() {
  const reportType = document.getElementById('reportsType').value;
  const monthSelect = document.getElementById('monthSelect');
  const rangeDates = document.getElementById('rangeDates');
  const comparisonDates = document.getElementById('comparisonDates');

  // Hide all optional sections
  if (monthSelect) monthSelect.style.display = reportType === 'monthly' ? 'block' : 'none';
  if (rangeDates) rangeDates.style.display = reportType === 'range' ? 'grid' : 'none';
  if (comparisonDates) comparisonDates.style.display = reportType === 'comparison' ? 'grid' : 'none';
};

LawOfficeManager.prototype.generateReport = function() {
  const dataType = document.getElementById('reportsDataType').value;
  const reportType = document.getElementById('reportsType').value;
  const resultsContainer = document.getElementById('reportsResults');

  if (!resultsContainer) return;

  // Show loading
  resultsContainer.innerHTML = `
    <div class="reports-loading">
      <div class="reports-loading-spinner"></div>
      <div class="reports-loading-text">מכין דוח...</div>
    </div>
  `;

  // Get the appropriate data
  const allData = dataType === 'timesheet' ? this.timesheetEntries : this.budgetTasks;

  setTimeout(() => {
    let reportHTML = '';

    try {
      if (reportType === 'monthly') {
        reportHTML = this.generateMonthlyReport(allData, dataType);
      } else if (reportType === 'yearly') {
        reportHTML = this.generateYearlyReport(allData, dataType);
      } else if (reportType === 'range') {
        reportHTML = this.generateRangeReport(allData, dataType);
      } else if (reportType === 'comparison') {
        reportHTML = this.generateComparisonReport(allData, dataType);
      }

      resultsContainer.innerHTML = reportHTML;

      // Show export button
      const exportBtn = document.getElementById('exportReportBtn');
      if (exportBtn) exportBtn.style.display = 'flex';

    } catch (error) {
      console.error('Error generating report:', error);
      resultsContainer.innerHTML = `
        <div class="reports-empty-state">
          <i class="fas fa-exclamation-triangle"></i>
          <div class="reports-empty-state-title">שגיאה ביצירת הדוח</div>
          <div class="reports-empty-state-text">${error.message}</div>
        </div>
      `;
    }
  }, 500);
};

LawOfficeManager.prototype.generateMonthlyReport = function(allData, dataType) {
  const month = parseInt(document.getElementById('reportsMonth').value);
  const year = parseInt(document.getElementById('reportsYear').value);

  const stats = dataType === 'timesheet'
    ? ReportsModule.calculateMonthlyTimesheetStats(allData, month, year)
    : ReportsModule.calculateMonthlyBudgetStats(allData, month, year);

  if (stats.isEmpty) {
    return `
      <div class="reports-empty-state">
        <i class="fas fa-calendar-times"></i>
        <div class="reports-empty-state-title">אין נתונים לתקופה זו</div>
        <div class="reports-empty-state-text">לא נמצאו נתונים עבור ${stats.monthName} ${year}</div>
      </div>
    `;
  }

  // Summary cards
  let summaryHTML = '<div class="reports-summary">';

  if (dataType === 'timesheet') {
    summaryHTML += `
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">סה"כ רשומות</div>
          <div class="reports-summary-card-icon blue"><i class="fas fa-list"></i></div>
        </div>
        <div class="reports-summary-card-value">${stats.totalEntries}</div>
        <div class="reports-summary-card-subtitle">רשומות שעתון</div>
      </div>
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">סה"כ שעות</div>
          <div class="reports-summary-card-icon green"><i class="fas fa-clock"></i></div>
        </div>
        <div class="reports-summary-card-value">${stats.totalHours}h</div>
        <div class="reports-summary-card-subtitle">${stats.totalMinutes} דקות</div>
      </div>
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">ממוצע יומי</div>
          <div class="reports-summary-card-icon yellow"><i class="fas fa-chart-line"></i></div>
        </div>
        <div class="reports-summary-card-value">${stats.averageHoursPerDay}h</div>
        <div class="reports-summary-card-subtitle">לפי ${stats.workDays} ימי עבודה</div>
      </div>
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">לקוחות</div>
          <div class="reports-summary-card-icon purple"><i class="fas fa-users"></i></div>
        </div>
        <div class="reports-summary-card-value">${stats.uniqueClients}</div>
        <div class="reports-summary-card-subtitle">לקוחות ייחודיים</div>
      </div>
    `;
  } else {
    summaryHTML += `
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">נוצרו</div>
          <div class="reports-summary-card-icon blue"><i class="fas fa-plus-circle"></i></div>
        </div>
        <div class="reports-summary-card-value">${stats.tasksCreated}</div>
        <div class="reports-summary-card-subtitle">משימות חדשות</div>
      </div>
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">הושלמו</div>
          <div class="reports-summary-card-icon green"><i class="fas fa-check-circle"></i></div>
        </div>
        <div class="reports-summary-card-value">${stats.tasksCompleted}</div>
        <div class="reports-summary-card-subtitle">${stats.completionRate}% אחוז השלמה</div>
      </div>
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">שעות בפועל</div>
          <div class="reports-summary-card-icon yellow"><i class="fas fa-clock"></i></div>
        </div>
        <div class="reports-summary-card-value">${stats.totalActualHours}h</div>
        <div class="reports-summary-card-subtitle">מתוך ${stats.totalPlannedHours}h מתוכנן</div>
      </div>
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">זמן השלמה</div>
          <div class="reports-summary-card-icon purple"><i class="fas fa-hourglass-half"></i></div>
        </div>
        <div class="reports-summary-card-value">${stats.averageCompletionTime}</div>
        <div class="reports-summary-card-subtitle">ימים בממוצע</div>
      </div>
    `;
  }

  summaryHTML += '</div>';

  return `
    <div class="reports-section">
      <div class="reports-section-header">
        <div class="reports-section-title">
          <i class="fas fa-calendar-alt"></i>
          דוח חודשי - ${stats.monthName} ${year}
        </div>
      </div>
      ${summaryHTML}
    </div>
  `;
};

LawOfficeManager.prototype.generateYearlyReport = function(allData, dataType) {
  const year = parseInt(document.getElementById('reportsYear').value);
  const yearStats = ReportsModule.calculateYearlyStats(allData, year, dataType);

  let summaryHTML = '<div class="reports-summary">';

  if (dataType === 'timesheet') {
    summaryHTML += `
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">סה"כ שנתי</div>
          <div class="reports-summary-card-icon blue"><i class="fas fa-clock"></i></div>
        </div>
        <div class="reports-summary-card-value">${yearStats.summary.totalHours}h</div>
        <div class="reports-summary-card-subtitle">${yearStats.summary.totalEntries} רשומות</div>
      </div>
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">ממוצע חודשי</div>
          <div class="reports-summary-card-icon green"><i class="fas fa-chart-bar"></i></div>
        </div>
        <div class="reports-summary-card-value">${yearStats.summary.averageMonthlyHours}h</div>
        <div class="reports-summary-card-subtitle">לחודש</div>
      </div>
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">חודש מוביל</div>
          <div class="reports-summary-card-icon yellow"><i class="fas fa-trophy"></i></div>
        </div>
        <div class="reports-summary-card-value">${yearStats.summary.bestMonth.totalHours}h</div>
        <div class="reports-summary-card-subtitle">${yearStats.summary.bestMonth.monthName}</div>
      </div>
    `;
  } else {
    summaryHTML += `
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">הושלמו</div>
          <div class="reports-summary-card-icon blue"><i class="fas fa-check-circle"></i></div>
        </div>
        <div class="reports-summary-card-value">${yearStats.summary.totalCompleted}</div>
        <div class="reports-summary-card-subtitle">משימות</div>
      </div>
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">אחוז השלמה</div>
          <div class="reports-summary-card-icon green"><i class="fas fa-percent"></i></div>
        </div>
        <div class="reports-summary-card-value">${yearStats.summary.overallCompletionRate}%</div>
        <div class="reports-summary-card-subtitle">מכלל המשימות</div>
      </div>
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">חודש מוביל</div>
          <div class="reports-summary-card-icon yellow"><i class="fas fa-trophy"></i></div>
        </div>
        <div class="reports-summary-card-value">${yearStats.summary.bestMonth.tasksCompleted}</div>
        <div class="reports-summary-card-subtitle">${yearStats.summary.bestMonth.monthName}</div>
      </div>
    `;
  }

  summaryHTML += '</div>';

  // Monthly breakdown table
  let tableHTML = `
    <div class="reports-table-wrapper">
      <table class="reports-table">
        <thead>
          <tr>
            <th>חודש</th>
  `;

  if (dataType === 'timesheet') {
    tableHTML += `
            <th>רשומות</th>
            <th>שעות</th>
            <th>ממוצע יומי</th>
            <th>לקוחות</th>
    `;
  } else {
    tableHTML += `
            <th>נוצרו</th>
            <th>הושלמו</th>
            <th>שעות</th>
            <th>אחוז השלמה</th>
    `;
  }

  tableHTML += '</tr></thead><tbody>';

  yearStats.monthlyStats.forEach(month => {
    if (month.isEmpty) return;

    tableHTML += `<tr>
      <td class="reports-table-highlight">${month.monthName}</td>
    `;

    if (dataType === 'timesheet') {
      tableHTML += `
        <td>${month.totalEntries}</td>
        <td class="reports-table-highlight">${month.totalHours}h</td>
        <td>${month.averageHoursPerDay}h</td>
        <td>${month.uniqueClients}</td>
      `;
    } else {
      tableHTML += `
        <td>${month.tasksCreated}</td>
        <td class="reports-table-highlight">${month.tasksCompleted}</td>
        <td>${month.totalActualHours}h</td>
        <td><span class="reports-table-badge ${month.completionRate >= 80 ? 'success' : month.completionRate >= 50 ? 'info' : 'warning'}">${month.completionRate}%</span></td>
      `;
    }

    tableHTML += '</tr>';
  });

  tableHTML += '</tbody></table></div>';

  return `
    <div class="reports-section">
      <div class="reports-section-header">
        <div class="reports-section-title">
          <i class="fas fa-calendar"></i>
          דוח שנתי - ${year}
        </div>
      </div>
      ${summaryHTML}
      ${tableHTML}
    </div>
  `;
};

LawOfficeManager.prototype.generateRangeReport = function(allData, dataType) {
  const startDate = new Date(document.getElementById('reportsStartDate').value);
  const endDate = new Date(document.getElementById('reportsEndDate').value);

  if (!startDate || !endDate || isNaN(startDate) || isNaN(endDate)) {
    return `
      <div class="reports-empty-state">
        <i class="fas fa-calendar-times"></i>
        <div class="reports-empty-state-title">נא לבחור תאריכים</div>
        <div class="reports-empty-state-text">יש לבחור תאריך התחלה וסיום</div>
      </div>
    `;
  }

  const stats = ReportsModule.calculateRangeStats(allData, startDate, endDate, dataType);

  const startDateStr = startDate.toLocaleDateString('he-IL');
  const endDateStr = endDate.toLocaleDateString('he-IL');

  let summaryHTML = '<div class="reports-summary">';

  if (dataType === 'timesheet') {
    summaryHTML += `
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">רשומות</div>
          <div class="reports-summary-card-icon blue"><i class="fas fa-list"></i></div>
        </div>
        <div class="reports-summary-card-value">${stats.totalEntries}</div>
        <div class="reports-summary-card-subtitle">סה"כ</div>
      </div>
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">שעות</div>
          <div class="reports-summary-card-icon green"><i class="fas fa-clock"></i></div>
        </div>
        <div class="reports-summary-card-value">${stats.totalHours}h</div>
        <div class="reports-summary-card-subtitle">סה"כ</div>
      </div>
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">ממוצע יומי</div>
          <div class="reports-summary-card-icon yellow"><i class="fas fa-chart-line"></i></div>
        </div>
        <div class="reports-summary-card-value">${stats.averagePerDay}h</div>
        <div class="reports-summary-card-subtitle">לפי ${stats.days} ימים</div>
      </div>
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">לקוחות</div>
          <div class="reports-summary-card-icon purple"><i class="fas fa-users"></i></div>
        </div>
        <div class="reports-summary-card-value">${stats.uniqueClients}</div>
        <div class="reports-summary-card-subtitle">ייחודיים</div>
      </div>
    `;
  } else {
    summaryHTML += `
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">הושלמו</div>
          <div class="reports-summary-card-icon blue"><i class="fas fa-check-circle"></i></div>
        </div>
        <div class="reports-summary-card-value">${stats.tasksCompleted}</div>
        <div class="reports-summary-card-subtitle">משימות</div>
      </div>
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">שעות בפועל</div>
          <div class="reports-summary-card-icon green"><i class="fas fa-clock"></i></div>
        </div>
        <div class="reports-summary-card-value">${stats.totalActualHours}h</div>
        <div class="reports-summary-card-subtitle">מתוך ${stats.totalPlannedHours}h מתוכנן</div>
      </div>
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">ממוצע יומי</div>
          <div class="reports-summary-card-icon yellow"><i class="fas fa-chart-line"></i></div>
        </div>
        <div class="reports-summary-card-value">${stats.averagePerDay}</div>
        <div class="reports-summary-card-subtitle">משימות ליום</div>
      </div>
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">חריגות</div>
          <div class="reports-summary-card-icon purple"><i class="fas fa-exclamation-triangle"></i></div>
        </div>
        <div class="reports-summary-card-value">${stats.overBudgetTasks}</div>
        <div class="reports-summary-card-subtitle">חורגות תקציב</div>
      </div>
    `;
  }

  summaryHTML += '</div>';

  return `
    <div class="reports-section">
      <div class="reports-section-header">
        <div class="reports-section-title">
          <i class="fas fa-calendar-week"></i>
          דוח מותאם - ${startDateStr} עד ${endDateStr}
        </div>
      </div>
      ${summaryHTML}
    </div>
  `;
};

LawOfficeManager.prototype.generateComparisonReport = function(allData, dataType) {
  const month1 = parseInt(document.getElementById('reportsMonth1').value);
  const year1 = parseInt(document.getElementById('reportsYear1').value);
  const month2 = parseInt(document.getElementById('reportsMonth2').value);
  const year2 = parseInt(document.getElementById('reportsYear2').value);

  const comparison = ReportsModule.compareMonths(allData, month1, year1, month2, year2, dataType);

  let comparisonHTML = `
    <div class="reports-comparison">
      <div class="reports-comparison-period">
        <div class="reports-comparison-period-title">תקופה 1</div>
        <div class="reports-comparison-period-value">${comparison.period1}</div>
      </div>
      <div class="reports-comparison-arrow">
        <i class="fas fa-exchange-alt"></i>
      </div>
      <div class="reports-comparison-period">
        <div class="reports-comparison-period-title">תקופה 2</div>
        <div class="reports-comparison-period-value">${comparison.period2}</div>
      </div>
    </div>
  `;

  let detailsHTML = '<div class="reports-comparison-details">';

  if (dataType === 'timesheet') {
    const comp = comparison.comparison;
    detailsHTML += `
      <div class="reports-comparison-item">
        <div class="reports-comparison-item-label">הפרש שעות</div>
        <div class="reports-comparison-item-value ${comp.hoursDifference > 0 ? 'positive' : comp.hoursDifference < 0 ? 'negative' : 'neutral'}">
          ${comp.hoursDifference > 0 ? '+' : ''}${comp.hoursDifference}h
          <span style="font-size: 14px">(${comp.hoursGrowthPercent > 0 ? '+' : ''}${comp.hoursGrowthPercent}%)</span>
        </div>
      </div>
      <div class="reports-comparison-item">
        <div class="reports-comparison-item-label">הפרש רשומות</div>
        <div class="reports-comparison-item-value ${comp.entriesDifference > 0 ? 'positive' : comp.entriesDifference < 0 ? 'negative' : 'neutral'}">
          ${comp.entriesDifference > 0 ? '+' : ''}${comp.entriesDifference}
          <span style="font-size: 14px">(${comp.entriesGrowthPercent > 0 ? '+' : ''}${comp.entriesGrowthPercent}%)</span>
        </div>
      </div>
      <div class="reports-comparison-item">
        <div class="reports-comparison-item-label">ממוצע יומי</div>
        <div class="reports-comparison-item-value ${comp.averageDailyDifference > 0 ? 'positive' : comp.averageDailyDifference < 0 ? 'negative' : 'neutral'}">
          ${comp.averageDailyDifference > 0 ? '+' : ''}${comp.averageDailyDifference}h
        </div>
      </div>
      <div class="reports-comparison-item">
        <div class="reports-comparison-item-label">מגמה</div>
        <div class="reports-comparison-item-value ${comp.improvement === 'שיפור' ? 'positive' : comp.improvement === 'ירידה' ? 'negative' : 'neutral'}">
          ${comp.improvement}
        </div>
      </div>
    `;
  } else {
    const comp = comparison.comparison;
    detailsHTML += `
      <div class="reports-comparison-item">
        <div class="reports-comparison-item-label">הפרש משימות</div>
        <div class="reports-comparison-item-value ${comp.tasksCompletedDifference > 0 ? 'positive' : comp.tasksCompletedDifference < 0 ? 'negative' : 'neutral'}">
          ${comp.tasksCompletedDifference > 0 ? '+' : ''}${comp.tasksCompletedDifference}
          <span style="font-size: 14px">(${comp.tasksCompletedGrowth > 0 ? '+' : ''}${comp.tasksCompletedGrowth}%)</span>
        </div>
      </div>
      <div class="reports-comparison-item">
        <div class="reports-comparison-item-label">הפרש שעות</div>
        <div class="reports-comparison-item-value ${comp.hoursDifference > 0 ? 'positive' : comp.hoursDifference < 0 ? 'negative' : 'neutral'}">
          ${comp.hoursDifference > 0 ? '+' : ''}${comp.hoursDifference}h
          <span style="font-size: 14px">(${comp.hoursGrowthPercent > 0 ? '+' : ''}${comp.hoursGrowthPercent}%)</span>
        </div>
      </div>
      <div class="reports-comparison-item">
        <div class="reports-comparison-item-label">אחוז השלמה</div>
        <div class="reports-comparison-item-value ${comp.completionRateDifference > 0 ? 'positive' : comp.completionRateDifference < 0 ? 'negative' : 'neutral'}">
          ${comp.completionRateDifference > 0 ? '+' : ''}${comp.completionRateDifference}%
        </div>
      </div>
      <div class="reports-comparison-item">
        <div class="reports-comparison-item-label">מגמה</div>
        <div class="reports-comparison-item-value ${comp.improvement === 'שיפור' ? 'positive' : comp.improvement === 'ירידה' ? 'negative' : 'neutral'}">
          ${comp.improvement}
        </div>
      </div>
    `;
  }

  detailsHTML += '</div>';

  return `
    <div class="reports-section">
      <div class="reports-section-header">
        <div class="reports-section-title">
          <i class="fas fa-balance-scale"></i>
          השוואה בין תקופות
        </div>
      </div>
      ${comparisonHTML}
      ${detailsHTML}
    </div>
  `;
};

LawOfficeManager.prototype.resetReportsForm = function() {
  const resultsContainer = document.getElementById('reportsResults');
  if (resultsContainer) resultsContainer.innerHTML = '';

  const exportBtn = document.getElementById('exportReportBtn');
  if (exportBtn) exportBtn.style.display = 'none';

  // Reset to defaults
  this.initReportsForm();

  // Reset report type to monthly
  const reportsType = document.getElementById('reportsType');
  if (reportsType) {
    reportsType.value = 'monthly';
    this.handleReportTypeChange();
  }
};

LawOfficeManager.prototype.exportReport = function() {
  window.print();
};

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

/**
 * פונקציות Firebase חסרות להשלמת המערכת
 */

// הוספת זמן למשימה מתוקצבת (Firebase)
async function addTimeToTaskFirebase(taskId, timeEntry) {
  try {
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
    return { success: true, message: "זמן נוסף בהצלחה למשימה" };
  } catch (error) {
    console.error("❌ שגיאה בהוספת זמן למשימה:", error);
    throw new Error("שגיאה ברישום זמן: " + error.message);
  }
}

// סיום משימה מתוקצבת (Firebase)
async function completeTaskFirebase(taskId, completionNotes = "") {
  try {
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
    return { success: true, message: "המשימה הושלמה בהצלחה" };
  } catch (error) {
    console.error("❌ שגיאה בהשלמת משימה:", error);
    throw new Error("שגיאה בהשלמת משימה: " + error.message);
  }
}

// הארכת תאריך יעד למשימה (Firebase)
async function extendTaskDeadlineFirebase(taskId, newDeadline, reason = "") {
  try {
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
    return { success: true, message: "תאריך היעד הוארך בהצלחה" };
  } catch (error) {
    console.error("❌ שגיאה בהארכת תאריך יעד:", error);
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
