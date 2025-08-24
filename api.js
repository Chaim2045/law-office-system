/**
 * API Connection Layer - חיבור מקצועי לשרת Firebase Functions v2
 * משרד עורכי דין - מערכת ניהול מתקדמת
 */

// Configuration
const API_CONFIG = {
  SERVER_URL:
    "https://us-central1-law-office-system-e4801.cloudfunctions.net/legacyRouter",
  TIMEOUT: 90000, // 90 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
};

/**
 * הפונקציה הראשית לכל הקריאות לשרת
 */
async function callServerFunction(action, data = null, showLoading = true) {
  if (showLoading) {
    showSimpleLoading(`מעבד ${action}...`);
  }

  try {
    const requestBody = {
      action: action,
      data: data,
      timestamp: new Date().toISOString(),
      clientVersion: "2.0.0",
    };

    const response = await fetchWithRetry(API_CONFIG.SERVER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "שגיאה לא ידועה בשרת");
    }

    return result;
  } catch (error) {
    console.error(`❌ API Error: ${action}`, error);

    // Show user-friendly error message
    const errorMessage = getUserFriendlyError(error, action);
    if (window.manager && window.manager.showNotification) {
      window.manager.showNotification(errorMessage, "error");
    } else {
      alert(errorMessage);
    }

    throw error;
  } finally {
    if (showLoading) {
      hideSimpleLoading();
    }
  }
}

/**
 * Fetch עם retry logic ו-timeout
 */
async function fetchWithRetry(url, options, attempt = 1) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    if (attempt < API_CONFIG.RETRY_ATTEMPTS && !controller.signal.aborted) {
      console.log(
        `🔄 Retry attempt ${attempt + 1}/${API_CONFIG.RETRY_ATTEMPTS}`
      );
      await delay(API_CONFIG.RETRY_DELAY * attempt);
      return fetchWithRetry(url, options, attempt + 1);
    }

    throw error;
  }
}

/**
 * Helper function for delay
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Convert technical errors to user-friendly messages
 */
function getUserFriendlyError(error, action) {
  if (error.name === "AbortError") {
    return "⏱️ החיבור לשרת נקטע - אנא נסה שוב";
  }

  if (error.message.includes("Failed to fetch")) {
    return "🌐 אין חיבור לאינטרנט - בדוק את החיבור שלך";
  }

  if (error.message.includes("HTTP 500")) {
    return "⚠️ שגיאה בשרת - אנא נסה שוב בעוד כמה דקות";
  }

  if (error.message.includes("HTTP 404")) {
    return "❓ השירות אינו זמין כרגע";
  }

  // Return the original error message if it's user-friendly
  if (
    error.message &&
    !error.message.includes("TypeError") &&
    !error.message.includes("fetch")
  ) {
    return `❌ ${error.message}`;
  }

  return `❌ שגיאה ב${action} - אנא נסה שוב`;
}

/**
 * Test connection to server
 */
async function testServerConnection() {
  try {
    const result = await callServerFunction("testConnection", null, false);

    return true;
  } catch (error) {
    console.error("❌ Server connection failed!", error);
    return false;
  }
}

/**
 * פונקציות API ספציפיות - החלפה לפונקציות הישנות
 */

// החלפה ל-loadClientsFromFirebase
async function loadClientsFromServer() {
  const result = await callServerFunction("getClients");

  return result.data || [];
}

// החלפה ל-saveClientToFirebase
async function saveClientToServer(clientData) {
  const result = await callServerFunction("createClientComplete", clientData);
  return result.clientId;
}

// החלפה ל-saveTimesheetAndUpdateClient
async function saveTimesheetToServer(timesheetData) {
  const result = await callServerFunction(
    "saveTimesheetAndUpdateClient",
    timesheetData
  );
  return result.entryId;
}
// החלפה ל-loadBudgetTasksFromFirebase
async function loadBudgetTasksFromServer(employee) {
  const result = await callServerFunction("getBudgetTasks", { employee });
  return result.data || [];
}

// החלפה ל-saveBudgetTaskToFirebase
async function saveBudgetTaskToServer(taskData) {
  const result = await callServerFunction("saveBudgetTask", taskData);
  return result.taskId;
}

// החלפה ל-loadTimesheetFromFirebase
async function loadTimesheetFromServer(employee) {
  const result = await callServerFunction("getTimesheetEntries", { employee });
  return result.data || [];
}

// החלפה ל-calculateClientHoursAccurate
async function calculateClientHoursFromServer(clientName) {
  const result = await callServerFunction("calculateClientHours", {
    clientName,
  });
  return result.data;
}
/**
 * Initialize API on page load
 */
window.addEventListener("load", async () => {
  // Test server connection
  const isConnected = await testServerConnection();

  if (isConnected) {
    // Show success notification if manager is available
    if (window.manager && window.manager.showNotification) {
      window.manager.showNotification("🚀 מחובר לשרת החדש!", "success");
    }
  } else {
    console.error("❌ Failed to initialize API");

    // Show error notification
    if (window.manager && window.manager.showNotification) {
      window.manager.showNotification("⚠️ בעיה בחיבור לשרת", "error");
    }
  }
});

// Export functions to global scope
window.callServerFunction = callServerFunction;
window.testServerConnection = testServerConnection;
window.loadClientsFromServer = loadClientsFromServer;
window.saveClientToServer = saveClientToServer;
window.saveTimesheetToServer = saveTimesheetToServer;
window.loadBudgetTasksFromServer = loadBudgetTasksFromServer;
window.saveBudgetTaskToServer = saveBudgetTaskToServer;
window.loadTimesheetFromServer = loadTimesheetFromServer;
window.calculateClientHoursFromServer = calculateClientHoursFromServer;
window.loadDataFromServer = loadDataFromServer;

console.log("📦 API module loaded successfully!");

// החלפה ל-loadDataFromFirebase
async function loadDataFromServer() {
  const result = await callServerFunction("getClients");
  return result.data || {};
}

// === DEBUG CHECK ===
console.log("��� API Debug Info:");
console.log("- callServerFunction:", typeof callServerFunction);
console.log("- testServerConnection:", typeof testServerConnection);
console.log("- loadClientsFromServer:", typeof loadClientsFromServer);

if (typeof callServerFunction === "function") {
  console.log("✅ API functions loaded successfully");
} else {
  console.log("❌ API functions NOT loaded");
}

// פונקציות חדשות שהוספנו
async function addTimeToTaskFromServer(taskId, minutes, employee) {
  const result = await callServerFunction("addTimeToTask", {
    taskId,
    minutes,
    employee,
  });
  return result;
}

async function completeTaskFromServer(taskId, employee, notes) {
  const result = await callServerFunction("completeTask", {
    taskId,
    employee,
    notes,
  });
  return result;
}

// ✅ פונקציות חדשות
async function addTimeToTaskFromServer(taskId, minutes, employee) {
  const result = await callServerFunction("addTimeToTask", {
    taskId,
    minutes,
    employee,
  });
  return result;
}

async function completeTaskFromServer(taskId, employee, notes) {
  const result = await callServerFunction("completeTask", {
    taskId,
    employee,
    notes,
  });
  return result;
}

// ✅ פונקציות חדשות
async function addTimeToTaskFromServer(taskId, minutes, employee) {
  const result = await callServerFunction("addTimeToTask", {
    taskId,
    minutes,
    employee,
  });
  return result;
}

async function completeTaskFromServer(taskId, employee, notes) {
  const result = await callServerFunction("completeTask", {
    taskId,
    employee,
    notes,
  });
  return result;
}

async function extendTaskDeadlineFromServer(
  taskId,
  newDeadline,
  employee,
  reason
) {
  const result = await callServerFunction("extendTaskDeadline", {
    taskId,
    newDeadline,
    employee,
    reason,
  });
  return result;
}

async function getTaskHistoryFromServer(taskId) {
  const result = await callServerFunction("getTaskHistory", { taskId });
  return result.data || [];
}

// Export
window.addTimeToTaskFromServer = addTimeToTaskFromServer;
window.completeTaskFromServer = completeTaskFromServer;
window.extendTaskDeadlineFromServer = extendTaskDeadlineFromServer;
window.getTaskHistoryFromServer = getTaskHistoryFromServer;

console.log("✅ 4 פונקציות חדשות זמינות!");
