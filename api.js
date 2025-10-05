/**
 * API Connection Layer - חיבור מקצועי לשרת Firebase Functions v2
 * משרד עורכי דין - מערכת ניהול מתקדמת
 *
 * נוצר: 28/08/2025
 * גרסה: 2.0.0 - קוד מסודר ומנוקה
 */

// ===== הגדרות ותצורה =====
// CONFIG & CONSTANTS
const API_CONFIG = {
  SERVER_URL:
    "https://us-central1-law-office-system-e4801.cloudfunctions.net/legacyRouter",
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
};

// ===== פונקציות עזר טהורות =====
// UTILITIES (PURE)

/**
 * השהיה פשוטה במילישניות
 * @param {number} ms - זמן השהיה
 * @returns {Promise} Promise שמתבצע אחרי הזמן הנדרש
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * המרת שגיאות טכניות להודעות ידידותיות למשתמש
 * @param {Error} error - השגיאה המקורית
 * @param {string} action - הפעולה שבה התרחשה השגיאה
 * @returns {string} הודעת שגיאה ידידותית
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

// ===== מתאמים: קלט/פלט/DOM/API =====
// ADAPTERS: IO/DOM/API

/**
 * Fetch עם מנגנון חזרות ו-timeout
 * @param {string} url - כתובת השרת
 * @param {Object} options - אפשרויות הבקשה
 * @param {number} attempt - מספר הנסיון הנוכחי
 * @returns {Promise<Response>} תגובת השרת
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
 * הפונקציה הראשית לכל הקריאות לשרת
 * @param {string} action - שם הפעולה לביצוע
 * @param {Object} data - נתונים לשליחה
 * @param {boolean} showLoading - האם להציג אנימצית טעינה
 * @returns {Promise<Object>} תגובת השרת
 */
async function callServerFunction(action, data = null, showLoading = true) {
  if (showLoading) {
    showSimpleLoading(`מעבד ${action}...`);
  }

  try {
    console.log(`🚀 API Call: ${action}`, data);

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

    console.log(`✅ API Success: ${action}`, result);
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

// ===== פעולות ליבה עיקריות =====
// CORE ACTIONS

/**
 * בדיקת חיבור לשרת
 * @returns {Promise<boolean>} האם החיבור הצליח
 */
async function testServerConnection() {
  try {
    const result = await callServerFunction("testConnection", null, false);
    console.log("🎉 Server connection successful!", result);
    return true;
  } catch (error) {
    console.error("❌ Server connection failed!", error);
    return false;
  }
}

/**
 * טעינת רשימת לקוחות מהשרת
 * החלפה ל-loadClientsFromFirebase
 * @returns {Promise<Array>} רשימת הלקוחות
 */
async function loadClientsFromServer() {
  const result = await callServerFunction("getClients");

  // 🔍 DEBUG - הדפס מה מגיע מהשרת
  console.log("🔍 Raw server response:", result);
  console.log("🔍 Clients data:", result.data);
  if (result.data && result.data[0]) {
    console.log("🔍 First client structure:", result.data[0]);
  }

  return result.data || [];
}

/**
 * שמירת לקוח חדש בשרת
 * החלפה ל-saveClientToFirebase
 * @param {Object} clientData - נתוני הלקוח
 * @returns {Promise<string>} מזהה הלקוח החדש
 */
async function saveClientToServer(clientData) {
  const result = await callServerFunction("createClientComplete", clientData);
  return result.clientId;
}

/**
 * שמירת גיליון שעות לשרת
 * החלפה ל-saveTimesheetAndUpdateClient
 * @param {Object} timesheetData - נתוני גיליון השעות
 * @returns {Promise<string>} מזהה הרשומה החדשה
 */
async function saveTimesheetToServer(timesheetData) {
  const result = await callServerFunction(
    "saveTimesheetAndUpdateClient",
    timesheetData
  );
  return result.entryId;
}

// ===== מטפלי אירועים =====
// EVENT HANDLERS

/**
 * אתחול API בטעינת הדף
 */
window.addEventListener("load", async () => {
  console.log("🔌 Initializing API connection...");

  // Test server connection
  const isConnected = await testServerConnection();

  if (isConnected) {
    console.log("✅ API initialized successfully!");

    // Connected successfully - no notification needed
  } else {
    console.error("❌ Failed to initialize API");

    // Show error notification
    if (window.manager && window.manager.showNotification) {
      window.manager.showNotification("⚠️ בעיה בחיבור לשרת", "error");
    }
  }
});

// ===== נקודות כניסה ויצוא גלובלי =====
// ENTRY POINTS

// Export functions to global scope
window.callServerFunction = callServerFunction;
window.testServerConnection = testServerConnection;
window.loadClientsFromServer = loadClientsFromServer;
window.saveClientToServer = saveClientToServer;
window.saveTimesheetToServer = saveTimesheetToServer;

console.log("📦 API module loaded successfully!");
