/**
 * Admin Dashboard - מערכת ניהול מלאה
 * משרד עו"ד - דשבורד מנהלים מתקדם
 */

// Global Variables
let db;
let employeesData = [];
let clientsData = [];
let activityData = [];
let currentUser = null;

// Firebase Configuration (מתוך HTML)
const firebaseConfig = {
  apiKey: "AIzaSyAlVbkAEBklF6lnxI_LsSg8ZXGlp0pgeMw",
  authDomain: "law-office-system-e4801.firebaseapp.com",
  projectId: "law-office-system-e4801",
  storageBucket: "law-office-system-e4801.firebasestorage.app",
  messagingSenderId: "199682320505",
  appId: "1:199682320505:web:8e4f5e34653476479b4ca8",
};

// Initialize Firebase
try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  console.log("Firebase מחובר בהצלחה לדשבורד מנהלים");
} catch (error) {
  console.error("שגיאה בחיבור Firebase:", error);
}

/**
 * Authentication & Authorization
 */
function checkAdminAccess() {
  const urlParams = new URLSearchParams(window.location.search);
  const user = urlParams.get("user") || urlParams.get("emp");

  if (user !== "מנהל מערכת" && user !== "גיא") {
    document.body.innerHTML = `
      <div class="min-h-screen bg-red-50 flex items-center justify-center">
        <div class="bg-white p-8 rounded-lg shadow-lg text-center">
          <h1 class="text-2xl font-bold text-red-600 mb-4">אין הרשאה</h1>
          <p class="text-gray-600 mb-4">אין לך הרשאה לגשת לדשבורד המנהלים</p>
          <a href="../index.html" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">חזור למערכת</a>
        </div>
      </div>
    `;
    return false;
  }

  currentUser = user;
  return true;
}

/**
 * Main Tab Management
 */
function showMainTab(tabName) {
  // Hide all tabs
  document.querySelectorAll(".tab-content").forEach((tab) => {
    tab.classList.add("hidden");
  });

  // Remove active class from all tab buttons
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.classList.remove("bg-blue-100", "dark:bg-blue-800");
    button.classList.add("bg-gray-100", "dark:bg-gray-800");
  });

  // Show selected tab
  const selectedTab = document.getElementById(tabName);
  if (selectedTab) {
    selectedTab.classList.remove("hidden");
  }

  // Activate selected tab button
  const selectedButton = document.querySelector(`[data-tab="${tabName}"]`);
  if (selectedButton) {
    selectedButton.classList.remove("bg-gray-100", "dark:bg-gray-800");
    selectedButton.classList.add("bg-blue-100", "dark:bg-blue-800");
  }

  // Load data for the selected tab
  switch (tabName) {
    case "employees":
      loadEmployeesData();
      break;
    case "clients":
      loadClientsData();
      break;
    case "activity":
      loadActivityFeed();
      break;
  }
}

/**
 * Data Loading Functions
 */
async function loadEmployeesData() {
  try {
    showLoading("טוען נתוני עובדים...");

    // Get all employees from different collections
    const [budgetTasks, timesheetEntries, userLogs] = await Promise.all([
      db.collection("budget_tasks").get(),
      db.collection("timesheet_entries").get(),
      db.collection("user_logs").get(),
    ]);

    const employeeStats = {};

    // Process budget tasks
    budgetTasks.forEach((doc) => {
      const data = doc.data();
      const emp = data.employee || "לא ידוע";
      if (!employeeStats[emp]) {
        employeeStats[emp] = {
          name: emp,
          totalTasks: 0,
          completedTasks: 0,
          totalHours: 0,
          lastActivity: null,
        };
      }
      employeeStats[emp].totalTasks++;
      if (data.status === "הושלם") {
        employeeStats[emp].completedTasks++;
      }
      employeeStats[emp].totalHours += (data.actualMinutes || 0) / 60;
    });

    // Process timesheet entries
    timesheetEntries.forEach((doc) => {
      const data = doc.data();
      const emp = data.employee || data.lawyer || "לא ידוע";
      if (!employeeStats[emp]) {
        employeeStats[emp] = {
          name: emp,
          totalTasks: 0,
          completedTasks: 0,
          totalHours: 0,
          lastActivity: null,
        };
      }
      employeeStats[emp].totalHours += (data.minutes || 0) / 60;

      // Update last activity
      const entryDate = new Date(data.date || data.createdAt?.toDate?.());
      if (
        !employeeStats[emp].lastActivity ||
        entryDate > employeeStats[emp].lastActivity
      ) {
        employeeStats[emp].lastActivity = entryDate;
      }
    });

    employeesData = Object.values(employeeStats);
    renderEmployeesTable();
    updateEmployeesStats();

    hideLoading();
  } catch (error) {
    console.error("שגיאה בטעינת נתוני עובדים:", error);
    hideLoading();
  }
}

async function loadClientsData() {
  try {
    showLoading("טוען נתוני לקוחות...");

    const [clients, timesheetEntries] = await Promise.all([
      db.collection("clients").get(),
      db.collection("timesheet_entries").get(),
    ]);

    const clientsWithStats = [];

    clients.forEach((doc) => {
      const clientData = { id: doc.id, ...doc.data() };

      // Calculate actual hours used
      let totalMinutesUsed = 0;
      timesheetEntries.forEach((entry) => {
        const entryData = entry.data();
        if (entryData.clientName === clientData.fullName) {
          totalMinutesUsed += entryData.minutes || 0;
        }
      });

      clientData.hoursUsed = totalMinutesUsed / 60;
      clientData.hoursRemaining =
        (clientData.totalHours || 0) - clientData.hoursUsed;
      clientData.utilizationPercent =
        clientData.totalHours > 0
          ? (clientData.hoursUsed / clientData.totalHours) * 100
          : 0;

      clientsWithStats.push(clientData);
    });

    clientsData = clientsWithStats;
    renderClientsTable();
    updateClientsStats();

    hideLoading();
  } catch (error) {
    console.error("שגיאה בטעינת נתוני לקוחות:", error);
    hideLoading();
  }
}

async function loadActivityFeed() {
  try {
    showLoading("טוען פעילות מערכת...");

    const [userLogs, timesheetEntries, budgetTasks] = await Promise.all([
      db.collection("user_logs").orderBy("timestamp", "desc").limit(50).get(),
      db
        .collection("timesheet_entries")
        .orderBy("createdAt", "desc")
        .limit(20)
        .get(),
      db
        .collection("budget_tasks")
        .orderBy("updatedAt", "desc")
        .limit(20)
        .get(),
    ]);

    const activities = [];

    // Process user logs
    userLogs.forEach((doc) => {
      const data = doc.data();
      activities.push({
        type: "login",
        user: data.employee,
        action: "התחבר למערכת",
        timestamp: data.timestamp?.toDate() || new Date(),
        details: `${data.userAgent?.slice(0, 50)}...`,
      });
    });

    // Process timesheet entries
    timesheetEntries.forEach((doc) => {
      const data = doc.data();
      activities.push({
        type: "timesheet",
        user: data.employee || data.lawyer,
        action: "רישום שעות",
        timestamp: data.createdAt?.toDate() || new Date(data.date),
        details: `${data.minutes} דקות - ${data.clientName}`,
      });
    });

    // Process budget tasks
    budgetTasks.forEach((doc) => {
      const data = doc.data();
      activities.push({
        type: "task",
        user: data.employee,
        action: data.status === "הושלם" ? "השלמת משימה" : "עדכון משימה",
        timestamp:
          data.updatedAt?.toDate() || data.createdAt?.toDate() || new Date(),
        details: data.description,
      });
    });

    // Sort by timestamp
    activities.sort((a, b) => b.timestamp - a.timestamp);
    activityData = activities.slice(0, 100);

    renderActivityFeed();
    hideLoading();
  } catch (error) {
    console.error("שגיאה בטעינת פעילות:", error);
    hideLoading();
  }
}

/**
 * Rendering Functions
 */
function renderEmployeesTable() {
  const container = document.getElementById("employee-list");
  if (!container) return;

  const html = employeesData
    .map(
      (emp) => `
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <div class="flex justify-between items-start">
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">${
            emp.name
          }</h3>
          <div class="mt-2 space-y-1">
            <p class="text-sm text-gray-600 dark:text-gray-400">משימות: ${
              emp.totalTasks
            } (${emp.completedTasks} הושלמו)</p>
            <p class="text-sm text-gray-600 dark:text-gray-400">שעות: ${emp.totalHours.toFixed(
              1
            )}</p>
            <p class="text-sm text-gray-600 dark:text-gray-400">פעילות אחרונה: ${
              emp.lastActivity ? formatDate(emp.lastActivity) : "לא ידוע"
            }</p>
          </div>
        </div>
        <div class="flex gap-2">
          <button onclick="viewEmployeeDetails('${
            emp.name
          }')" class="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600">
            פרטים
          </button>
          <button onclick="editEmployee('${
            emp.name
          }')" class="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600">
            עריכה
          </button>
        </div>
      </div>
    </div>
  `
    )
    .join("");

  container.innerHTML = html;
}

function renderClientsTable() {
  const container = document.getElementById("client-list");
  if (!container) return;

  const html = clientsData
    .map(
      (client) => `
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <div class="flex justify-between items-start">
        <div class="flex-1">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">${
            client.fullName
          }</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">תיק: ${
            client.fileNumber
          }</p>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">שעות מוקצות: ${
                client.totalHours || 0
              }</p>
              <p class="text-sm text-gray-600 dark:text-gray-400">שעות בשימוש: ${client.hoursUsed.toFixed(
                1
              )}</p>
              <p class="text-sm text-gray-600 dark:text-gray-400">שעות נותרות: ${client.hoursRemaining.toFixed(
                1
              )}</p>
            </div>
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">ניצול: ${client.utilizationPercent.toFixed(
                1
              )}%</p>
              <p class="text-sm text-gray-600 dark:text-gray-400">סוג: ${
                client.type
              }</p>
              <p class="text-sm ${
                client.hoursRemaining <= 0 ? "text-red-600" : "text-green-600"
              }">
                ${client.hoursRemaining <= 0 ? "חסום" : "פעיל"}
              </p>
            </div>
          </div>
        </div>
        <div class="flex gap-2">
          <button onclick="viewClientDetails('${
            client.id
          }')" class="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600">
            פרטים
          </button>
          <button onclick="editClient('${
            client.id
          }')" class="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600">
            עריכה
          </button>
        </div>
      </div>
    </div>
  `
    )
    .join("");

  container.innerHTML = html;
}

function renderActivityFeed() {
  const container = document.getElementById("activity-list");
  if (!container) return;

  const html = activityData
    .map(
      (activity) => `
    <div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-1">
            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getActivityTypeClass(
              activity.type
            )}">
              ${getActivityTypeLabel(activity.type)}
            </span>
            <span class="text-sm font-medium text-gray-900 dark:text-white">${
              activity.user
            }</span>
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-400">${
            activity.action
          }</p>
          <p class="text-xs text-gray-500 dark:text-gray-500 mt-1">${
            activity.details
          }</p>
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-500">
          ${formatDateTime(activity.timestamp)}
        </div>
      </div>
    </div>
  `
    )
    .join("");

  container.innerHTML = html;
}

/**
 * Statistics Updates
 */
function updateEmployeesStats() {
  const totalUsers = document.getElementById("total-users");
  const onlineUsers = document.getElementById("online-users");

  if (totalUsers) totalUsers.textContent = employeesData.length;
  if (onlineUsers) {
    // מספר המשתמשים שהיו פעילים ב-24 השעות האחרונות
    const activeCount = employeesData.filter(
      (emp) =>
        emp.lastActivity && new Date() - emp.lastActivity < 24 * 60 * 60 * 1000
    ).length;
    onlineUsers.textContent = activeCount;
  }
}

function updateClientsStats() {
  const activeClients = document.getElementById("active-clients");
  const completedTasks = document.getElementById("completed-tasks");

  if (activeClients) {
    const activeCount = clientsData.filter(
      (client) => client.hoursRemaining > 0
    ).length;
    activeClients.textContent = activeCount;
  }

  if (completedTasks) {
    const totalTasks = employeesData.reduce(
      (sum, emp) => sum + emp.totalTasks,
      0
    );
    const completed = employeesData.reduce(
      (sum, emp) => sum + emp.completedTasks,
      0
    );
    completedTasks.textContent = completed;

    const progress = document.getElementById("completion-progress");
    if (progress) {
      const percentage = totalTasks > 0 ? (completed / totalTasks) * 100 : 0;
      progress.style.width = `${percentage}%`;
    }
  }
}

/**
 * Utility Functions
 */
function showLoading(message = "טוען...") {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) {
    overlay.querySelector("div div").textContent = message;
    overlay.classList.remove("hidden");
  }
}

function hideLoading() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) {
    overlay.classList.add("hidden");
  }
}

function formatDate(date) {
  if (!date) return "לא ידוע";
  return new Date(date).toLocaleDateString("he-IL");
}

function formatDateTime(date) {
  if (!date) return "לא ידוע";
  return new Date(date).toLocaleString("he-IL");
}

function getActivityTypeClass(type) {
  switch (type) {
    case "login":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case "timesheet":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    case "task":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
  }
}

function getActivityTypeLabel(type) {
  switch (type) {
    case "login":
      return "כניסה";
    case "timesheet":
      return "שעתון";
    case "task":
      return "משימה";
    default:
      return "פעילות";
  }
}

function showNotifications() {
  alert("מערכת הודעות בפיתוח...");
}

// Placeholder functions for detailed views
function viewEmployeeDetails(employeeName) {
  alert(`פרטי העובד ${employeeName} - בפיתוח`);
}

function editEmployee(employeeName) {
  alert(`עריכת עובד ${employeeName} - בפיתוח`);
}

function viewClientDetails(clientId) {
  alert(`פרטי לקוח ${clientId} - בפיתוח`);
}

function editClient(clientId) {
  alert(`עריכת לקוח ${clientId} - בפיתוח`);
}

/**
 * Initialize Dashboard
 */
document.addEventListener("DOMContentLoaded", function () {
  if (!checkAdminAccess()) {
    return;
  }

  console.log("דשבורד מנהלים נטען בהצלחה");

  // Load initial data
  showMainTab("employees");

  // Update statistics every 5 minutes
  setInterval(() => {
    loadEmployeesData();
    loadClientsData();
    loadActivityFeed();
  }, 5 * 60 * 1000);
});
