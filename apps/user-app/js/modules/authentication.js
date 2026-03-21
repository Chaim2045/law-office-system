/**
 * Authentication Module
 * Handles user login, logout, and session management
 * Supports multiple authentication methods: Password, SMS OTP
 *
 * Created: 2025
 * Updated: 2025-11-25 - Added SMS authentication
 * Part of Law Office Management System
 */

import { updateUserDisplay, updateSidebarUser } from './ui-components.js';

/**
 * Authentication methods for LawOfficeManager
 * These should be mixed into the main manager class
 */

function showLogin() {

  const loginSection = document.getElementById('loginSection');
  const forgotPasswordSection = document.getElementById('forgotPasswordSection');
  const welcomeScreen = document.getElementById('welcomeScreen');
  const appContent = document.getElementById('appContent');
  const minimalSidebar = document.getElementById('minimalSidebar');
  const interfaceElements = document.getElementById('interfaceElements');
  const mainFooter = document.getElementById('mainFooter');
  const bubblesContainer = document.getElementById('bubblesContainer');

  if (loginSection) {
loginSection.classList.remove('hidden');
}
  if (forgotPasswordSection) {
forgotPasswordSection.classList.add('hidden');
}
  if (welcomeScreen) {
welcomeScreen.classList.add('hidden');
}
  if (appContent) {
appContent.classList.add('hidden');
}
  if (minimalSidebar) {
minimalSidebar.classList.add('hidden');
}
  if (interfaceElements) {
interfaceElements.classList.add('hidden');
}
  if (mainFooter) {
mainFooter.classList.add('hidden');
}
  if (bubblesContainer) {
bubblesContainer.classList.remove('hidden');
}

  // Remove class from body when logged out
  document.body.classList.remove('logged-in');
}

async function handleLogin() {
  const emailInput = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const errorAlert = document.getElementById('errorAlert');
  const errorMessage = document.getElementById('errorMessage');

  if (!emailInput || !password) {
    if (errorMessage && errorAlert) {
      errorMessage.textContent = 'אנא מלא את כל השדות';
      errorAlert.classList.add('show');
      setTimeout(() => errorAlert.classList.remove('show'), 3000);
    }
    return;
  }

  try {
    // ✅ Set flag BEFORE auth to block onAuthStateChanged race condition
    // onAuthStateChanged triggers DURING signInWithEmailAndPassword, not after!
    window.isInWelcomeScreen = true;

    // התחברות עם Firebase Auth
    const userCredential = await firebase.auth()
      .signInWithEmailAndPassword(emailInput, password);

    // Normalize email (same as Google OAuth flow)
    const email = userCredential.user.email?.toLowerCase().trim();
    const uid = userCredential.user.uid;

    if (!email) {
      throw new Error('לא התקבל אימייל מהמערכת');
    }

    // ✅ OPTIMIZATION: Direct get instead of query (faster, cheaper)
    // userCredential.user.email is available immediately after sign-in
    const employeeDoc = await window.firebaseDB.collection('employees')
      .doc(email)  // Direct document access with normalized email
      .get();

    if (!employeeDoc.exists) {
      throw new Error('משתמש לא נמצא במערכת');
    }

    const employee = employeeDoc.data();

    if (!employee) {
      throw new Error('שגיאה בטעינת נתוני עובד');
    }

    // ✅ שמור את המשתמש הנוכחי - email לשאילתות, username לתצוגה, uid לזיהוי
    this.currentUid = uid; // ✅ Firebase Auth UID
    this.currentUser = email; // ✅ NORMALIZED EMAIL for queries and security
    this.currentUsername = employee.username || employee.name; // Username for display
    this.currentEmployee = employee; // ✅ Full employee data (including dailyHoursTarget)

    updateUserDisplay(this.currentUsername);

    // Show welcome screen (blocking) - MUST wait for screen to be visible
    await this.showWelcomeScreen();

    // Load data while welcome screen is showing
    try {
      await this.loadData();

      // Log login activity (after data loaded and activity logger initialized)
      if (this.activityLogger) {
        await this.activityLogger.logLogin();
      }

      // ✅ Update lastLogin directly (independent of PresenceSystem)
      try {
        await window.firebaseDB.collection('employees').doc(this.currentUser).update({
          lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
          loginCount: firebase.firestore.FieldValue.increment(1)
        });
        Logger.log('✅ lastLogin updated successfully');
      } catch (loginUpdateError) {
        console.warn('⚠️ Failed to update lastLogin:', loginUpdateError.message);
      }

      // ✅ Track user presence with Firebase Realtime Database (replaces old UserTracker)
      if (window.PresenceSystem) {
        try {
          // Add 5 second timeout to prevent infinite spinner
          await Promise.race([
            window.PresenceSystem.connect(this.currentUid, this.currentUsername, this.currentUser),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('PresenceSystem timeout')), 5000)
            )
          ]);
          Logger.log('✅ PresenceSystem connected successfully');
        } catch (presenceError) {
          console.warn('⚠️ PresenceSystem failed (non-critical):', presenceError.message);
          // Continue anyway - presence tracking is not critical for login
        }
      }
    } catch (error) {
      this.showNotification('שגיאה בטעינת נתונים', 'error');
      console.error('Error loading data:', error);
    }

    // Wait for minimum welcome screen time (6 seconds total)
    await this.waitForWelcomeMinimumTime();

    // Clear flag - welcome screen is done
    window.isInWelcomeScreen = false;

    // Initialize security modules after successful login
    if (this.initSecurityModules) {
      this.initSecurityModules();
    }

    // Show app after everything loaded
    this.showApp();

    // ⚡ Lazy load AI Chat System AFTER successful login (prevents showing on login screen)
    // This improves initial page load time by ~70KB
    this.initAIChatSystem();

  } catch (error) {
    console.error('Login error:', error);

    // ✅ Clear flag on error to allow retry
    window.isInWelcomeScreen = false;

    let errorText = 'אימייל או סיסמה שגויים';

    if (error.code === 'auth/user-not-found') {
      errorText = 'משתמש לא נמצא';
    } else if (error.code === 'auth/wrong-password') {
      errorText = 'סיסמה שגויה';
    } else if (error.code === 'auth/invalid-email') {
      errorText = 'כתובת אימייל לא תקינה';
    } else if (error.code === 'auth/user-disabled') {
      errorText = 'חשבון זה הושבת. צור קשר עם המנהל';
    }

    if (errorMessage && errorAlert) {
      errorMessage.textContent = errorText;
      errorAlert.classList.add('show');
      setTimeout(() => errorAlert.classList.remove('show'), 3000);
    }
  }
}

/**
 * מציג מסך ברוך הבא עם שם המשתמש ולוגו
 */
async function showWelcomeScreen() {
  const loginSection = document.getElementById('loginSection');
  const welcomeScreen = document.getElementById('welcomeScreen');
  const welcomeTitle = document.getElementById('welcomeTitle');
  const lastLoginTime = document.getElementById('lastLoginTime');
  const bubblesContainer = document.getElementById('bubblesContainer');

  // הסתר את מסך הכניסה
  if (loginSection) {
loginSection.classList.add('hidden');
}

  // עדכן שם משתמש
  if (welcomeTitle) {
    welcomeTitle.textContent = `ברוך הבא, ${this.currentUsername}`;
  }

  // הצג את מסך ברוך הבא מיד
  if (welcomeScreen) {
    welcomeScreen.classList.remove('hidden');
  }

  // Keep bubbles visible during welcome screen
  if (bubblesContainer) {
bubblesContainer.classList.remove('hidden');
}

  // ✅ Start timing AFTER screen is visible
  this.welcomeScreenStartTime = Date.now();

  // ✅ Initialize progress bar to 0
  const progressBar = document.getElementById('progressBar');
  if (progressBar) {
    progressBar.style.width = '0%';
  }

  // ✅ תיקון יסודי: קריאת lastLogin מ-Firebase (לא localStorage!)
  if (lastLoginTime) {
    try {
      // קריאה מ-employees collection ב-Firebase (לפי EMAIL - document ID)
      const employeeDoc = await window.firebaseDB
        .collection('employees')
        .doc(this.currentUser)
        .get();

      if (employeeDoc.exists) {
        const data = employeeDoc.data();

        // lastLogin הוא Firestore Timestamp
        if (data.lastLogin && data.lastLogin.toDate) {
          const loginDate = data.lastLogin.toDate();
          const formatted = loginDate.toLocaleString('he-IL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          lastLoginTime.textContent = formatted;
        } else {
          lastLoginTime.textContent = 'זו הכניסה הראשונה שלך';
        }
      } else {
        lastLoginTime.textContent = 'זו הכניסה הראשונה שלך';
      }
    } catch (error) {
      console.error('⚠️ Failed to load lastLogin from Firebase:', error);
      lastLoginTime.textContent = 'זו הכניסה הראשונה שלך';
    }
  }

}

/**
 * וידוא שמסך הברוך הבא מוצג לפחות 3 שניות
 */
async function waitForWelcomeMinimumTime() {
  // ✅ REMOVED: No artificial delay - progress bar provides natural feedback
  // The progress bar at 100% is enough visual confirmation
  // User enters immediately when data is ready
  return;
}

/**
 * עדכון טקסט הטעינה במסך ברוך הבא + Progress Bar
 */
function updateLoaderText(text, progress = null) {
  // Only update if welcome screen is active
  if (!window.isInWelcomeScreen) {
    return;
  }
  const loaderText = document.getElementById('loaderText');
  if (loaderText) {
    loaderText.textContent = text;
  }

  // Update progress bar if progress provided
  if (progress !== null) {
    const progressBar = document.getElementById('progressBar');
    if (progressBar) {
      progressBar.style.width = `${Math.min(progress, 100)}%`;
    }
  }
}

function showApp() {
  const loginSection = document.getElementById('loginSection');
  const welcomeScreen = document.getElementById('welcomeScreen');
  const appContent = document.getElementById('appContent');
  const interfaceElements = document.getElementById('interfaceElements');
  const minimalSidebar = document.getElementById('minimalSidebar');
  const mainFooter = document.getElementById('mainFooter');
  const bubblesContainer = document.getElementById('bubblesContainer');

  if (loginSection) {
loginSection.classList.add('hidden');
}
  if (welcomeScreen) {
welcomeScreen.classList.add('hidden');
}
  if (appContent) {
appContent.classList.remove('hidden');
}
  if (interfaceElements) {
interfaceElements.classList.remove('hidden');
}
  if (minimalSidebar) {
minimalSidebar.classList.remove('hidden');
}
  if (mainFooter) {
mainFooter.classList.remove('hidden');
}
  if (bubblesContainer) {
bubblesContainer.classList.add('hidden');
}

  // Add class to body when logged in
  document.body.classList.add('logged-in');

  const userInfo = document.getElementById('userInfo');
  if (userInfo) {
    userInfo.innerHTML = `
      <span>שלום ${this.currentUsername}</span>
      <span id="connectionIndicator" style="margin-right: 15px; font-size: 14px;">🔄 מתחבר...</span>
    `;
    userInfo.classList.remove('hidden');
  }

  setTimeout(() => {
    updateSidebarUser(this.currentUsername);
  }, 500);

  // ✅ Initialize System Announcement Ticker when entering the app
  if (window.manager && typeof window.manager.initTicker === 'function') {
    window.manager.initTicker();
  }

  // ✅ Initialize System Announcement Popup when entering the app
  if (window.manager && typeof window.manager.initPopup === 'function') {
    window.manager.initPopup();
  }

  // Knowledge Base — lazy load on first help click
  const helpTrigger = document.querySelector('[data-help-trigger]');
  if (helpTrigger && window.lazyLoader) {
    helpTrigger.addEventListener('click', function onHelpClick() {
      helpTrigger.removeEventListener('click', onHelpClick);
      window.lazyLoader.loadScriptsSequentially([
        'js/modules/knowledge-base/kb-icons.js',
        'js/modules/knowledge-base/kb-data.js',
        'js/modules/knowledge-base/kb-search.js',
        'js/modules/knowledge-base/kb-analytics.js',
        'js/modules/knowledge-base/knowledge-base.js'
      ]).catch(err => console.error('KB load failed:', err));
    }, { once: true });
  }
}

function logout() {
  // ✅ תיקון: השתמש ב-NotificationSystem.confirm רтолько אם הוא זמין ויש לו את המתודה
  if (window.NotificationSystem && typeof window.NotificationSystem.confirm === 'function') {
    console.log('✅ Using NotificationSystem.confirm');
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
    return; // ← חשוב! עצור כאן - אל תמשיך ל-Fallback
  }

  // Fallback to old popup system
  console.log('⚠️ Using Fallback popup (NotificationSystem not available)');
  const overlay = document.createElement('div');
  overlay.className = 'popup-overlay show';
  overlay.style.cssText = 'position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 10001; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(8px);';
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

  // ✅ כבר הוספנו inline styles ו-class .show - לא צריך requestAnimationFrame
}


async function confirmLogout() {
  const interfaceElements = document.getElementById('interfaceElements');
  if (interfaceElements) {
interfaceElements.classList.add('hidden');
}

  // Show goodbye notification using new system with custom icon
  if (window.NotificationSystem) {
    const notification = window.NotificationSystem.info('מתנתק מהמערכת... להתראות', 3000);
    // Replace default info icon with power-off icon
    const iconElement = notification.querySelector('.notification-icon i');
    if (iconElement) {
      iconElement.className = 'fas fa-power-off';
    }
  } else if (window.manager) {
    // Fallback to old system if new one not loaded
    window.manager.showNotification('מתנתק מהמערכת... להתראות', 'info');
  }

  // ✅ Track logout with Presence System
  if (window.PresenceSystem) {
    await window.PresenceSystem.disconnect();
  }

  // 🔌 Cleanup realtime listeners to prevent permission errors
  if (window.CaseNumberGenerator) {
    window.CaseNumberGenerator.cleanup();
  }

  // התנתק מ-Firebase Auth
  await firebase.auth().signOut();

  // רענן דף - Auth State Listener יזהה שהמשתמש התנתק ויציג מסך התחברות
  setTimeout(() => location.reload(), 1500);
}

/**
 * מציג מסך שחזור סיסמה
 */
function showForgotPassword() {
  const loginSection = document.getElementById('loginSection');
  const forgotPasswordSection = document.getElementById('forgotPasswordSection');
  const bubblesContainer = document.getElementById('bubblesContainer');

  if (loginSection) {
loginSection.classList.add('hidden');
}
  if (forgotPasswordSection) {
forgotPasswordSection.classList.remove('hidden');
}
  if (bubblesContainer) {
bubblesContainer.classList.remove('hidden');
}

  // נקה שדות
  const resetEmail = document.getElementById('resetEmail');
  if (resetEmail) {
resetEmail.value = '';
}

  // הסתר הודעות קודמות
  const resetErrorMessage = document.getElementById('resetErrorMessage');
  const resetSuccessMessage = document.getElementById('resetSuccessMessage');
  if (resetErrorMessage) {
resetErrorMessage.classList.add('hidden');
}
  if (resetSuccessMessage) {
resetSuccessMessage.classList.add('hidden');
}
}

/**
 * טיפול בשחזור סיסמה
 */
async function handleForgotPassword(event) {
  event.preventDefault();

  const email = document.getElementById('resetEmail')?.value?.trim();
  const resetErrorMessage = document.getElementById('resetErrorMessage');
  const resetSuccessMessage = document.getElementById('resetSuccessMessage');

  // Validation
  if (!email) {
    if (resetErrorMessage) {
      resetErrorMessage.textContent = 'אנא הזן כתובת אימייל';
      resetErrorMessage.classList.remove('hidden');
      setTimeout(() => resetErrorMessage.classList.add('hidden'), 3000);
    }
    return;
  }

  try {
    // שליחת Email Reset מ-Firebase עם URL מותאם אישית
    const actionCodeSettings = {
      url: window.location.origin + '/reset-password.html',
      handleCodeInApp: false
    };

    await firebase.auth().sendPasswordResetEmail(email, actionCodeSettings);

    // הצג הודעת הצלחה
    if (resetSuccessMessage) {
      resetSuccessMessage.classList.remove('hidden');
    }
    if (resetErrorMessage) {
      resetErrorMessage.classList.add('hidden');
    }

    // Use NotificationSystem if available
    if (window.NotificationSystem) {
      window.NotificationSystem.success(
        '📧 קישור לאיפוס סיסמה נשלח למייל שלך. בדוק את תיבת הדואר.',
        5000
      );
    }

    // חזור למסך כניסה אחרי 3 שניות
    setTimeout(() => {
      showLogin.call(this);
    }, 3000);

  } catch (error) {
    console.error('Password reset error:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);

    let errorText = 'שגיאה בשליחת מייל לאיפוס סיסמה';

    if (error.code === 'auth/user-not-found') {
      errorText = 'משתמש עם כתובת מייל זו לא נמצא במערכת';
    } else if (error.code === 'auth/invalid-email') {
      errorText = 'כתובת אימייל לא תקינה';
    } else if (error.code === 'auth/too-many-requests') {
      errorText = 'יותר מדי ניסיונות. נסה שוב מאוחר יותר';
    } else if (error.code === 'auth/missing-continue-uri') {
      errorText = 'שגיאת הגדרות Firebase - פנה למפתח';
    } else if (error.code === 'auth/invalid-continue-uri') {
      errorText = 'שגיאת הגדרות Firebase - פנה למפתח';
    } else if (error.code === 'auth/unauthorized-continue-uri') {
      errorText = 'שגיאת הרשאות Firebase - פנה למפתח';
    } else {
      // הצג את הקוד המלא לדיבוג
      errorText = `שגיאה: ${error.code || 'unknown'} - בדוק את ה-Console`;
    }

    if (resetErrorMessage) {
      resetErrorMessage.textContent = errorText;
      resetErrorMessage.classList.remove('hidden');
      setTimeout(() => resetErrorMessage.classList.add('hidden'), 5000);
    }

    if (resetSuccessMessage) {
      resetSuccessMessage.classList.add('hidden');
    }

    // Use NotificationSystem if available
    if (window.NotificationSystem) {
      window.NotificationSystem.error(errorText, 5000);
    }
  }
}

// ════════════════════════════════════════════════════════════
// GOOGLE LOGIN
// ════════════════════════════════════════════════════════════

async function loginWithGoogle() {
  const btn = document.getElementById('googleBtn');
  if (btn) {
btn.disabled = true;
}
  hideError();

  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');

    const result = await window.firebaseAuth.signInWithPopup(provider);
    const user = result.user;
    console.log('✅ Google Login Success:', user);

    // Normalize email
    const email = user.email?.toLowerCase().trim();

    if (!email) {
      await window.firebaseAuth.signOut();
      showError('לא התקבל אימייל מ-Google');
      if (btn) {
btn.disabled = false;
}
      return;
    }

    // Check if user exists in employees collection
    const employeeDoc = await window.firebaseDB.collection('employees').doc(email).get();

    if (!employeeDoc.exists) {
      // User not authorized - sign them out
      await window.firebaseAuth.signOut();
      showError('משתמש לא מורשה - פנה למנהל המערכת');
      if (btn) {
btn.disabled = false;
}
      return;
    }

    const employee = employeeDoc.data();

    if (!employee) {
      await window.firebaseAuth.signOut();
      showError('שגיאה בטעינת נתוני עובד');
      if (btn) {
btn.disabled = false;
}
      return;
    }

    console.log('✅ Employee validated:', employee);

    // Set current user data (this = LawOfficeManager)
    this.currentUid = user.uid;
    this.currentUser = email;
    this.currentUsername = employee.username || employee.name || email;
    this.currentEmployee = employee;

    // Update user display
    updateUserDisplay(this.currentUsername);

    // Show welcome screen (blocking)
    window.isInWelcomeScreen = true;
    await this.showWelcomeScreen();

    // Load data while welcome screen is showing
    await this.loadData();

    // Log login activity
    if (this.activityLogger) {
      await this.activityLogger.logLogin();
    }

    // Update lastLogin timestamp
    try {
      await window.firebaseDB.collection('employees').doc(this.currentUser).update({
        lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
        loginCount: firebase.firestore.FieldValue.increment(1)
      });
    } catch (err) {
      console.warn('⚠️ Failed to update lastLogin:', err);
    }

    // Track user presence (with timeout to prevent blocking)
    if (window.PresenceSystem) {
      try {
        await Promise.race([
          window.PresenceSystem.connect(
            this.currentUid,
            this.currentUsername,
            this.currentUser
          ),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('PresenceSystem timeout')), 5000)
          )
        ]);
        console.log('✅ PresenceSystem connected successfully');
      } catch (err) {
        console.warn('⚠️ PresenceSystem failed (non-critical):', err.message);
        // Continue anyway - presence tracking is not critical for login
      }
    }

    // Show the main app
    console.log('🎯 Calling showApp...');
    showApp.call(this);
    console.log('✅ showApp completed');

    // ⚡ Lazy load AI Chat System AFTER successful login
    this.initAIChatSystem();

  } catch (error) {
    console.error('❌ Google Login Error:', error);

    // Handle other errors
    let errorMsg = 'שגיאה בהתחברות עם Google';

    if (error.code === 'auth/account-exists-with-different-credential') {
      errorMsg = 'קיים חשבון עם שיטת התחברות אחרת. היכנס עם סיסמה או פנה למנהל.';
    } else if (error.code === 'auth/popup-closed-by-user') {
      errorMsg = 'הפופאפ נסגר - נסה שוב';
    } else if (error.code === 'auth/cancelled-popup-request') {
      errorMsg = 'הבקשה בוטלה';
    }

    showError(errorMsg);
    if (btn) {
btn.disabled = false;
}
  }
}

// ════════════════════════════════════════════════════════════
// APPLE LOGIN
// ════════════════════════════════════════════════════════════

async function loginWithApple() {
  const btn = document.getElementById('appleBtn');
  if (btn) {
btn.disabled = true;
}
  hideError();

  try {
    const provider = new firebase.auth.OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');

    const result = await window.firebaseAuth.signInWithPopup(provider);
    const user = result.user;
    console.log('✅ Apple Login Success:', user);

    // Normalize email
    const email = user.email?.toLowerCase().trim();

    if (!email) {
      await window.firebaseAuth.signOut();
      showError('לא התקבל אימייל מ-Apple');
      if (btn) {
btn.disabled = false;
}
      return;
    }

    // Check if user exists in employees collection
    const employeeDoc = await window.firebaseDB.collection('employees').doc(email).get();

    if (!employeeDoc.exists) {
      // User not authorized - sign them out
      await window.firebaseAuth.signOut();
      showError('משתמש לא מורשה - פנה למנהל המערכת');
      if (btn) {
btn.disabled = false;
}
      return;
    }

    const employee = employeeDoc.data();

    if (!employee) {
      await window.firebaseAuth.signOut();
      showError('שגיאה בטעינת נתוני עובד');
      if (btn) {
btn.disabled = false;
}
      return;
    }

    console.log('✅ Employee validated:', employee);

    // Set current user data (this = LawOfficeManager)
    this.currentUid = user.uid;
    this.currentUser = email;
    this.currentUsername = employee.username || employee.name || email;
    this.currentEmployee = employee;

    // Update user display
    updateUserDisplay(this.currentUsername);

    // Show welcome screen (blocking)
    window.isInWelcomeScreen = true;
    await this.showWelcomeScreen();

    // Load data while welcome screen is showing
    await this.loadData();

    // Log login activity
    if (this.activityLogger) {
      await this.activityLogger.logLogin();
    }

    // Update lastLogin timestamp
    try {
      await window.firebaseDB.collection('employees').doc(this.currentUser).update({
        lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
        loginCount: firebase.firestore.FieldValue.increment(1)
      });
    } catch (err) {
      console.warn('⚠️ Failed to update lastLogin:', err);
    }

    // Track user presence (with timeout to prevent blocking)
    if (window.PresenceSystem) {
      try {
        await Promise.race([
          window.PresenceSystem.connect(
            this.currentUid,
            this.currentUsername,
            this.currentUser
          ),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('PresenceSystem timeout')), 5000)
          )
        ]);
        console.log('✅ PresenceSystem connected successfully');
      } catch (err) {
        console.warn('⚠️ PresenceSystem failed (non-critical):', err.message);
        // Continue anyway - presence tracking is not critical for login
      }
    }

    // Show the main app
    console.log('🎯 Calling showApp...');
    showApp.call(this);
    console.log('✅ showApp completed');

    // ⚡ Lazy load AI Chat System AFTER successful login
    this.initAIChatSystem();

  } catch (error) {
    console.error('❌ Apple Login Error:', error);

    // Handle other errors
    let errorMsg = 'שגיאה בהתחברות עם Apple';

    if (error.code === 'auth/account-exists-with-different-credential') {
      errorMsg = 'קיים חשבון עם שיטת התחברות אחרת. היכנס עם סיסמה או פנה למנהל.';
    } else if (error.code === 'auth/popup-closed-by-user') {
      errorMsg = 'הפופאפ נסגר - נסה שוב';
    }

    showError(errorMsg);
    if (btn) {
btn.disabled = false;
}
  }
}

// ════════════════════════════════════════════════════════════
// TOGGLE PASSWORD VISIBILITY
// ════════════════════════════════════════════════════════════

function togglePasswordVisibility() {
  const passwordInput = document.getElementById('password');
  const toggleIcon = document.getElementById('toggleIcon');

  if (!passwordInput || !toggleIcon) {
return;
}

  const isPassword = passwordInput.type === 'password';

  passwordInput.type = isPassword ? 'text' : 'password';
  toggleIcon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
}

// ════════════════════════════════════════════════════════════
// ERROR HANDLING
// ════════════════════════════════════════════════════════════

function showError(message) {
  const errorAlert = document.getElementById('errorAlert');
  const errorMessage = document.getElementById('errorMessage');

  if (errorAlert && errorMessage) {
    errorMessage.textContent = message;
    errorAlert.classList.add('show');
  }
}

function hideError() {
  const errorAlert = document.getElementById('errorAlert');

  if (errorAlert) {
    errorAlert.classList.remove('show');
  }
}

/**
 * Initialize authentication methods
 */
async function initializeAuthMethods() {
  try {
    await loginMethods.initialize();
    console.log('✅ Login methods initialized');
  } catch (error) {
    console.error('Failed to initialize login methods:', error);
  }
}

/**
 * Switch between authentication methods
 */
function switchAuthMethod(method) {
  const passwordSection = document.querySelector('.password-input-section');
  const phoneSection = document.querySelector('.phone-input-section');
  const otpSection = document.querySelector('.otp-input-section');

  // Hide all sections
  if (passwordSection) {
passwordSection.classList.remove('active');
}
  if (phoneSection) {
phoneSection.classList.remove('active');
}
  if (otpSection) {
otpSection.classList.remove('active');
}

  // Update method buttons
  document.querySelectorAll('.auth-method-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // Show selected section
  if (method === 'password') {
    if (passwordSection) {
passwordSection.classList.add('active');
}
  } else if (method === 'sms') {
    if (phoneSection) {
phoneSection.classList.add('active');
}
  }

  // Mark button as active
  const activeBtn = document.querySelector(`.auth-method-btn[data-method="${method}"]`);
  if (activeBtn) {
activeBtn.classList.add('active');
}

  loginMethods.switchMethod(method);
}

/**
 * Handle SMS login flow
 */
async function handleSMSLogin() {
  const phoneInput = document.getElementById('phoneNumber');
  const errorMessage = document.getElementById('smsErrorMessage');

  if (!phoneInput || !phoneInput.value) {
    if (errorMessage) {
      errorMessage.textContent = 'אנא הזן מספר טלפון';
      errorMessage.classList.remove('hidden');
    }
    return;
  }

  try {
    // Show loading state
    const sendBtn = document.getElementById('sendOTPBtn');
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.classList.add('loading');
    }

    // Send OTP
    await loginMethods.methods.sms.handler.sendOTP(phoneInput.value);

    // Show OTP input section
    const phoneSection = document.querySelector('.phone-input-section');
    const otpSection = document.querySelector('.otp-input-section');

    if (phoneSection) {
phoneSection.classList.remove('active');
}
    if (otpSection) {
      otpSection.classList.add('active');

      // Display masked phone number
      const phoneDisplay = document.querySelector('.otp-phone-display');
      if (phoneDisplay) {
        phoneDisplay.textContent = loginMethods.methods.sms.handler
          .constructor.formatForDisplay(phoneInput.value);
      }

      // Focus first OTP input
      const firstOTPInput = document.querySelector('.otp-input');
      if (firstOTPInput) {
firstOTPInput.focus();
}

      // Start countdown timer
      startOTPTimer();
    }

  } catch (error) {
    console.error('SMS login error:', error);

    if (errorMessage) {
      errorMessage.textContent = error.message || 'שגיאה בשליחת SMS';
      errorMessage.classList.remove('hidden');
    }
  } finally {
    const sendBtn = document.getElementById('sendOTPBtn');
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.classList.remove('loading');
    }
  }
}

/**
 * Verify OTP code
 */
async function verifyOTP() {
  const otpInputs = document.querySelectorAll('.otp-input');
  const errorMessage = document.getElementById('otpErrorMessage');

  // Collect OTP from inputs
  let otp = '';
  otpInputs.forEach(input => {
    otp += input.value;
  });

  if (otp.length !== 6) {
    if (errorMessage) {
      errorMessage.textContent = 'אנא הזן קוד בן 6 ספרות';
      errorMessage.classList.remove('hidden');
    }
    return;
  }

  try {
    // Show loading state
    const verifyBtn = document.getElementById('verifyOTPBtn');
    if (verifyBtn) {
      verifyBtn.disabled = true;
      verifyBtn.textContent = 'מאמת...';
    }

    // Verify OTP
    const result = await loginMethods.methods.sms.handler.verifyOTP(otp);

    // Set current user
    this.currentUser = result.employeeData.email;
    this.currentUsername = result.employeeData.username || result.employeeData.name;
    this.currentEmployee = result.employeeData; // ✅ Full employee data (including dailyHoursTarget)

    updateUserDisplay(this.currentUsername);

    // Continue with normal login flow
    await this.showWelcomeScreen();
    await this.loadData();

    // Initialize security modules
    if (this.initSecurityModules) {
      this.initSecurityModules();
    }

    await this.waitForWelcomeMinimumTime();
    window.isInWelcomeScreen = false;
    this.showApp();

  } catch (error) {
    console.error('OTP verification error:', error);

    // Add shake animation to inputs
    otpInputs.forEach(input => {
      input.classList.add('error');
      setTimeout(() => input.classList.remove('error'), 500);
    });

    if (errorMessage) {
      errorMessage.textContent = error.message || 'קוד שגוי';
      errorMessage.classList.remove('hidden');
    }
  } finally {
    const verifyBtn = document.getElementById('verifyOTPBtn');
    if (verifyBtn) {
      verifyBtn.disabled = false;
      verifyBtn.textContent = 'אמת קוד';
    }
  }
}

/**
 * Start OTP countdown timer
 */
function startOTPTimer() {
  let seconds = 300; // 5 minutes
  const timerElement = document.querySelector('.otp-timer-countdown');
  const resendBtn = document.querySelector('.resend-otp-btn');

  if (resendBtn) {
resendBtn.disabled = true;
}

  const interval = setInterval(() => {
    seconds--;

    if (timerElement) {
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      timerElement.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    if (seconds <= 0) {
      clearInterval(interval);
      if (timerElement) {
timerElement.textContent = 'פג תוקף';
}
      if (resendBtn) {
resendBtn.disabled = false;
}
    }
  }, 1000);

  return interval;
}

/**
 * Handle OTP input auto-advance
 */
function setupOTPInputs() {
  const otpInputs = document.querySelectorAll('.otp-input');

  otpInputs.forEach((input, index) => {
    // Auto-advance to next input
    input.addEventListener('input', (e) => {
      if (e.target.value.length === 1 && index < otpInputs.length - 1) {
        otpInputs[index + 1].focus();
      }

      // Auto-submit when all filled
      if (index === otpInputs.length - 1) {
        let allFilled = true;
        otpInputs.forEach(inp => {
          if (!inp.value) {
allFilled = false;
}
        });

        if (allFilled) {
          verifyOTP.call(window.manager);
        }
      }
    });

    // Handle backspace
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && index > 0) {
        otpInputs[index - 1].focus();
      }
    });

    // Allow only numbers
    input.addEventListener('keypress', (e) => {
      if (!/[0-9]/.test(e.key)) {
        e.preventDefault();
      }
    });
  });
}

/**
 * ⚡ Lazy load AI Chat System
 * טעינה דינמית של מערכת AI Chat אחרי התחברות מוצלחת
 * @description מייעל ביצועים - חוסך ~70KB בטעינה ראשונית
 */
async function initAIChatSystem() {
  try {
    // בדיקה אם כבר נטען
    if (window.aiChat) {
      Logger.log('[AI Chat] Already initialized, skipping');
      return;
    }

    // בדיקה אם LazyLoader זמין
    if (!window.lazyLoader) {
      console.error('[AI Chat] LazyLoader not available');
      return;
    }

    Logger.log('[AI Chat] 🚀 Starting lazy load...');
    const startTime = performance.now();

    // טעינת כל הסקריפטים הדרושים
    const aiScripts = [
      { src: 'js/modules/ai-system/ai-config.js', options: { version: '2.0.0' } },
      { src: 'js/modules/ai-system/ai-engine.js', options: { version: '2.0.0' } },
      { src: 'js/modules/ai-system/ai-context-builder.js', options: { version: '2.0.0' } },
      { src: 'js/modules/UserReplyModal.js', options: { version: '1.0.3-threads' } },
      { src: 'js/config/message-categories.js', options: { version: '1.0.0' } },
      { src: 'js/modules/notification-bell.js', options: { version: '20251210-fix' } },
      { src: 'js/modules/ai-system/ThreadView.js', options: { version: '1.0.4-mark-as-read' } }
    ];

    // טען את כל הסקריפטים במקביל (מהיר יותר)
    await window.lazyLoader.loadScripts(aiScripts);

    // טען את ה-UI אחרון (תלוי בשאר)
    await window.lazyLoader.loadScript(
      'js/modules/ai-system/ai-chat-ui.js',
      { version: '2.0.7-categories' }
    );

    // אתחל את מערכת AI Chat
    if (window.AIChatUI && !window.aiChat) {
      window.aiChat = new window.AIChatUI();

      const loadTime = (performance.now() - startTime).toFixed(0);
      Logger.log(`[AI Chat] ✅ Initialized successfully (${loadTime}ms)`);
    } else {
      console.warn('[AI Chat] ⚠️ AIChatUI class not available after loading');
    }

    // ✅ אתחל את מערכת ההודעות (NotificationBell)
    if (window.NotificationBellSystem) {
      // יצירת instance אם לא קיים
      if (!window.notificationBell) {
        window.notificationBell = new window.NotificationBellSystem();
        Logger.log('[NotificationBell] Instance created');
      }

      // חיבור למשתמש - גם אם ה-instance כבר קיים
      if (this.currentUser && window.firebaseDB) {
        const user = { email: this.currentUser };
        window.notificationBell.startListeningToAdminMessages(user, window.firebaseDB);
        Logger.log(`[NotificationBell] ✅ Listening to admin messages for ${user.email}`);
      } else {
        console.warn('[NotificationBell] ⚠️ Cannot start listening - missing user or DB', {
          currentUser: this.currentUser,
          firebaseDB: !!window.firebaseDB
        });
      }
    }

  } catch (error) {
    console.error('[AI Chat] ❌ Failed to lazy load:', error);
    // לא חוסם את המערכת - AI Chat הוא optional
  }
}

// ════════════════════════════════════════════════════════════
// FEATURE FLAG INITIALIZATION
// ════════════════════════════════════════════════════════════

/**
 * Initialize OAuth feature flags
 * Called on DOMContentLoaded to apply feature flags
 */
function initOAuthFeatureFlags() {
  const appleBtn = document.getElementById('appleBtn');

  if (!appleBtn) {
return;
}

  // Check if Apple OAuth is enabled in config
  const isEnabled = window.CONFIG?.enableAppleOAuth === true;

  if (!isEnabled) {
    appleBtn.disabled = true;
    appleBtn.style.opacity = '0.5';
    appleBtn.style.cursor = 'not-allowed';
    appleBtn.title = 'בקרוב - Apple Sign-In נמצא בפיתוח';

    // Replace onclick to show message instead
    appleBtn.onclick = (e) => {
      e.preventDefault();
      showError('Apple Sign-In יהיה זמין בקרוב');
    };

    console.log('🚫 Apple OAuth disabled by feature flag');
  } else {
    console.log('✅ Apple OAuth enabled');
  }
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
  confirmLogout,
  showForgotPassword,
  handleForgotPassword,
  initializeAuthMethods,    // ← חדש
  switchAuthMethod,         // ← חדש
  handleSMSLogin,           // ← חדש
  verifyOTP,                // ← חדש
  setupOTPInputs,           // ← חדש
  loginWithGoogle,          // ← Google OAuth
  loginWithApple,           // ← Apple OAuth
  togglePasswordVisibility, // ← Toggle password visibility
  showError,                // ← Show error message
  hideError,                // ← Hide error message
  initAIChatSystem,         // ⚡ Lazy loading
  initOAuthFeatureFlags     // ← Feature flags for OAuth
};
