/**
 * Authentication Module
 * Handles user login, logout, and session management
 *
 * Created: 2025
 * Part of Law Office Management System
 */

import { updateUserDisplay, updateSidebarUser } from './ui-components.js';

/**
 * Authentication methods for LawOfficeManager
 * These should be mixed into the main manager class
 */

function showLogin() {
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

async function handleLogin() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const errorMessage = document.getElementById("errorMessage");

  if (!email || !password) {
    if (errorMessage) {
      errorMessage.textContent = "אנא מלא את כל השדות";
      errorMessage.classList.remove("hidden");
      setTimeout(() => errorMessage.classList.add("hidden"), 3000);
    }
    return;
  }

  try {
    // התחברות עם Firebase Auth
    const userCredential = await firebase.auth()
      .signInWithEmailAndPassword(email, password);

    const uid = userCredential.user.uid;

    // מצא את ה-employee לפי authUID
    const snapshot = await window.firebaseDB.collection('employees')
      .where('authUID', '==', uid)
      .limit(1)
      .get();

    if (snapshot.empty) {
      throw new Error('משתמש לא נמצא במערכת');
    }

    const employeeDoc = snapshot.docs[0];
    const employee = employeeDoc.data();

    // ✅ שמור את המשתמש הנוכחי - email לשאילתות, username לתצוגה, uid לזיהוי
    this.currentUid = uid; // ✅ Firebase Auth UID
    this.currentUser = employee.email; // ✅ EMAIL for queries and security
    this.currentUsername = employee.username || employee.name; // Username for display
    updateUserDisplay(this.currentUsername);

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

      // ✅ Track user presence with Firebase Realtime Database (replaces old UserTracker)
      if (window.PresenceSystem) {
        await window.PresenceSystem.connect(this.currentUid, this.currentUsername, this.currentUser);
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

  } catch (error) {
    console.error("Login error:", error);

    let errorText = "אימייל או סיסמה שגויים";

    if (error.code === 'auth/user-not-found') {
      errorText = "משתמש לא נמצא";
    } else if (error.code === 'auth/wrong-password') {
      errorText = "סיסמה שגויה";
    } else if (error.code === 'auth/invalid-email') {
      errorText = "כתובת אימייל לא תקינה";
    } else if (error.code === 'auth/user-disabled') {
      errorText = "חשבון זה הושבת. צור קשר עם המנהל";
    }

    if (errorMessage) {
      errorMessage.textContent = errorText;
      errorMessage.classList.remove("hidden");
      setTimeout(() => errorMessage.classList.add("hidden"), 3000);
    }
  }
}

/**
 * מציג מסך ברוך הבא עם שם המשתמש ולוגו
 */
async function showWelcomeScreen() {
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
    welcomeTitle.textContent = `ברוך הבא, ${this.currentUsername}`;
  }

  // ✅ תיקון יסודי: קריאת lastLogin מ-Firebase (לא localStorage!)
  if (lastLoginTime) {
    try {
      // קריאה מ-employees collection ב-Firebase
      const employeeDoc = await window.firebaseDB
        .collection('employees')
        .doc(this.currentUsername)
        .get();

      if (employeeDoc.exists) {
        const data = employeeDoc.data();

        // lastLogin הוא Firestore Timestamp
        if (data.lastLogin && data.lastLogin.toDate) {
          const loginDate = data.lastLogin.toDate();
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
      } else {
        lastLoginTime.textContent = "זו הכניסה הראשונה שלך";
      }
    } catch (error) {
      console.error('⚠️ Failed to load lastLogin from Firebase:', error);
      lastLoginTime.textContent = "זו הכניסה הראשונה שלך";
    }
  }

  // הצג את מסך ברוך הבא
  if (welcomeScreen) {
    welcomeScreen.classList.remove("hidden");
  }

  // Keep bubbles visible during welcome screen
  if (bubblesContainer) bubblesContainer.classList.remove("hidden");

}

/**
 * וידוא שמסך הברוך הבא מוצג לפחות 2 שניות
 */
async function waitForWelcomeMinimumTime() {
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
function updateLoaderText(text) {
  // Only update if welcome screen is active
  if (!window.isInWelcomeScreen) {
    return;
  }
  const loaderText = document.getElementById("loaderText");
  if (loaderText) {
    loaderText.textContent = text;
  }
}

function showApp() {
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
      <span>שלום ${this.currentUsername}</span>
      <span id="connectionIndicator" style="margin-right: 15px; font-size: 14px;">🔄 מתחבר...</span>
    `;
    userInfo.classList.remove("hidden");
  }

  setTimeout(() => {
    updateSidebarUser(this.currentUsername);
  }, 500);
}

function logout() {
  // Use new notification system if available
  if (window.NotificationSystem) {
    window.NotificationSystem.confirm(
      'האם אתה בטוח שברצונך לצאת? כל הנתונים שלא נשמרו יאבדו.',
      () => window.confirmLogout(),
      null,
      {
        title: 'יציאה מהמערכת',
        confirmText: 'כן, צא מהמערכת',
        cancelText: 'ביטול',
        type: 'warning'
      }
    );
  } else {
    // Fallback to old popup system
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
}

async function confirmLogout() {
  const interfaceElements = document.getElementById("interfaceElements");
  if (interfaceElements) interfaceElements.classList.add("hidden");

  // Show goodbye notification using new system
  if (window.NotificationSystem) {
    window.NotificationSystem.info("מתנתק מהמערכת... להתראות! 👋", 3000);
  } else if (window.manager) {
    // Fallback to old system if new one not loaded
    window.manager.showNotification("מתנתק מהמערכת... להתראות! 👋", "info");
  }

  // ✅ Track logout with Presence System
  if (window.PresenceSystem) {
    await window.PresenceSystem.disconnect();
  }

  // התנתק מ-Firebase Auth
  await firebase.auth().signOut();

  // רענן דף - Auth State Listener יזהה שהמשתמש התנתק ויציג מסך התחברות
  setTimeout(() => location.reload(), 1500);
}

// Exports
export {
  showLogin,
  handleLogin,
  showWelcomeScreen,
  waitForWelcomeMinimumTime,
  updateLoaderText,
  showApp,
  logout,
  confirmLogout
};
