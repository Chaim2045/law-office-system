/**
 * ════════════════════════════════════════════════════════════════════════════
 * ⏱ Quick Log - Manager Quick Timesheet Entry
 * ════════════════════════════════════════════════════════════════════════════
 *
 * @version 1.0.0
 * @created 2026-01-30
 * @description Standalone page for managers to quickly log hours without tasks
 *
 * Features:
 * - Firebase Auth integration
 * - Manager/Admin role validation (client + server)
 * - Client autocomplete (reuses window.clients if available)
 * - Direct call to createQuickLogEntry Cloud Function
 * - Success/Error feedback
 *
 * Security:
 * - Client-side role check (defense in depth)
 * - Server-side role enforcement (primary defense)
 * - Input sanitization via backend
 * ════════════════════════════════════════════════════════════════════════════
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  // FIREBASE INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════

  const firebaseConfig = {
    apiKey: 'AIzaSyAlVbkAEBklF6lnxI_LsSg8ZXGlp0pgeMw',
    authDomain: 'law-office-system-e4801.firebaseapp.com',
    databaseURL: 'https://law-office-system-e4801-default-rtdb.firebaseio.com',
    projectId: 'law-office-system-e4801',
    storageBucket: 'law-office-system-e4801.firebasestorage.app',
    messagingSenderId: '199682320505',
    appId: '1:199682320505:web:8e4f5e34653476479b4ca8'
  };

  firebase.initializeApp(firebaseConfig);

  const auth = firebase.auth();
  const db = firebase.firestore();
  const functions = firebase.functions();

  // ═══════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════

  let currentUser = null;
  let allClients = [];

  // ═══════════════════════════════════════════════════════════════════
  // DOM ELEMENTS
  // ═══════════════════════════════════════════════════════════════════

  const loginScreen = document.getElementById('loginScreen');
  const quickLogScreen = document.getElementById('quickLogScreen');
  const loginForm = document.getElementById('loginForm');
  const quickLogForm = document.getElementById('quickLogForm');
  const loginError = document.getElementById('loginError');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const successMessage = document.getElementById('successMessage');
  const errorMessage = document.getElementById('errorMessage');
  const userName = document.getElementById('userName');
  const clientSearch = document.getElementById('clientSearch');
  const clientResults = document.getElementById('clientResults');
  const dateInput = document.getElementById('date');

  // ═══════════════════════════════════════════════════════════════════
  // AUTH STATE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      // User is logged in - check if they're a manager/admin
      const isAuthorized = await checkUserRole(user);

      if (isAuthorized) {
        showQuickLogScreen();
        await loadClients();
      } else {
        showError('אין לך הרשאה לגשת לדף זה. רק מנהלים יכולים לדווח שעות.', true);
        setTimeout(() => {
          logout();
        }, 3000);
      }
    } else {
      // User is not logged in
      showLoginScreen();
    }
  });

  /**
   * Check if user has manager or admin role
   * CLIENT-SIDE CHECK ONLY (server enforces as well)
   */
  async function checkUserRole(user) {
    try {
      const uid = user.uid;
      const email = user.email;

      console.log('[Quick Log] Checking user role...');
      console.log('[Quick Log]   UID:', uid);
      console.log('[Quick Log]   Email:', email);

      // Query employees by authUID (matches backend pattern)
      const snapshot = await db.collection('employees')
        .where('authUID', '==', uid)
        .limit(1)
        .get();

      console.log('[Quick Log] Query result:', snapshot.empty ? 'NOT FOUND' : 'FOUND');

      if (snapshot.empty) {
        console.error('[Quick Log] ❌ Employee not found with authUID:', uid);
        console.log('[Quick Log] This means the authUID in Firestore does not match Firebase Auth UID');
        return false;
      }

      const employee = snapshot.docs[0].data();
      currentUser = employee;

      console.log('[Quick Log] ✅ Employee found:');
      console.log('[Quick Log]   Name:', employee.name);
      console.log('[Quick Log]   Email:', employee.email);
      console.log('[Quick Log]   Role:', employee.role);
      console.log('[Quick Log]   authUID:', employee.authUID);

      // Check if user is manager or admin
      const isAuthorized = employee.role === 'manager' || employee.role === 'admin';

      if (isAuthorized) {
        console.log('[Quick Log] ✅ User is authorized (role:', employee.role + ')');
      } else {
        console.error('[Quick Log] ❌ Unauthorized: User role is', employee.role, '(not manager/admin)');
      }

      return isAuthorized;

    } catch (error) {
      console.error('[Quick Log] ❌ Error checking user role:', error);
      console.error('[Quick Log] Error details:', error.message);
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // LOGIN HANDLING
  // ═══════════════════════════════════════════════════════════════════

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    hideMessage(loginError);

    try {
      await auth.signInWithEmailAndPassword(email, password);
      // Auth state listener will handle the rest
    } catch (error) {
      console.error('[Quick Log] Login error:', error);

      let errorText = 'שגיאת התחברות';

      if (error.code === 'auth/user-not-found') {
        errorText = 'משתמש לא קיים';
      } else if (error.code === 'auth/wrong-password') {
        errorText = 'סיסמה שגויה';
      } else if (error.code === 'auth/invalid-email') {
        errorText = 'כתובת אימייל לא תקינה';
      } else if (error.message) {
        errorText = error.message;
      }

      showMessage(loginError, errorText, 'error');
    }
  });

  window.logout = function() {
    auth.signOut();
  };

  // ═══════════════════════════════════════════════════════════════════
  // GOOGLE SIGN-IN (Mobile-First)
  // ═══════════════════════════════════════════════════════════════════

  const googleLoginBtn = document.getElementById('googleLoginBtn');

  // Check for redirect result on page load
  auth.getRedirectResult()
    .then(result => {
      if (result.user) {
        console.log('[Quick Log] Google redirect login success:', result.user.email);
        // onAuthStateChanged will handle validation
      }
    })
    .catch(error => {
      console.error('[Quick Log] Redirect result error:', error);
      handleGoogleError(error);
    });

  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
      googleLoginBtn.disabled = true;
      googleLoginBtn.classList.add('loading');
      hideAllMessages();

      try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.addScope('profile');
        provider.addScope('email');

        // Mobile-first: use redirect (better UX on mobile)
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        if (isMobile) {
          // Mobile: Always use redirect
          console.log('[Quick Log] Using signInWithRedirect (mobile)');
          await auth.signInWithRedirect(provider);
          // Page will reload, redirect result handled on next load
        } else {
          // Desktop: Try popup, fallback to redirect
          console.log('[Quick Log] Using signInWithPopup (desktop)');
          try {
            await auth.signInWithPopup(provider);
            // onAuthStateChanged will handle validation
          } catch (popupError) {
            if (popupError.code === 'auth/popup-blocked') {
              console.log('[Quick Log] Popup blocked, falling back to redirect');
              await auth.signInWithRedirect(provider);
            } else {
              throw popupError;
            }
          }
        }

      } catch (error) {
        console.error('[Quick Log] Google login error:', error);
        handleGoogleError(error);
        googleLoginBtn.disabled = false;
        googleLoginBtn.classList.remove('loading');
      }
    });
  }

  function handleGoogleError(error) {
    let errorText = 'שגיאה בהתחברות עם Google';

    if (error.code === 'auth/popup-closed-by-user') {
      errorText = 'החלון נסגר - נסה שוב';
    } else if (error.code === 'auth/cancelled-popup-request') {
      errorText = 'הבקשה בוטלה';
    } else if (error.code === 'auth/unauthorized-domain') {
      console.error('[Quick Log] Unauthorized domain:', window.location.origin);
      errorText = `Domain לא מורשה: ${window.location.origin}\nפנה למנהל המערכת`;
    } else if (error.code === 'auth/network-request-failed') {
      errorText = 'שגיאת רשת - בדוק חיבור לאינטרנט';
    } else if (error.code === 'auth/account-exists-with-different-credential') {
      errorText = 'חשבון קיים עם שיטת כניסה אחרת';
    } else if (error.message) {
      errorText = error.message;
    }

    showMessage(loginError, errorText, 'error');
  }

  // ═══════════════════════════════════════════════════════════════════
  // BIOMETRIC AUTHENTICATION
  // ═══════════════════════════════════════════════════════════════════

  const biometricBtn = document.getElementById('biometricLogin');
  const BIOMETRIC_CREDENTIAL_KEY = 'quicklog_biometric_credential';

  // Check if biometric is available
  async function checkBiometricAvailability() {
    if (!window.PublicKeyCredential) {
      biometricBtn.style.display = 'none';
      return false;
    }

    try {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!available) {
        biometricBtn.style.display = 'none';
      }
      return available;
    } catch (error) {
      console.error('[Quick Log] Biometric check error:', error);
      biometricBtn.style.display = 'none';
      return false;
    }
  }

  // Handle biometric login
  biometricBtn.addEventListener('click', async () => {
    try {
      biometricBtn.classList.add('loading');
      hideMessage(loginError);

      // Check if we have stored credentials
      const storedEmail = localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY);

      if (!storedEmail) {
        showMessage(loginError, 'לא נמצאו פרטי כניסה שמורים. אנא התחבר בעזרת סיסמה תחילה.', 'error');
        biometricBtn.classList.remove('loading');
        return;
      }

      // Request biometric authentication (will trigger Face ID/Touch ID)
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: new Uint8Array(32), // In production, this should come from server
          timeout: 60000,
          userVerification: 'required'
        }
      });

      if (credential) {
        // In a real app, verify the credential with your backend
        // For now, we'll just sign in with the stored email
        // You would need to implement a backend endpoint that:
        // 1. Verifies the biometric credential
        // 2. Returns a custom token
        // 3. Signs in with that token

        showMessage(loginError, 'כניסה ביומטרית מוצלחת! מנסה להתחבר...', 'success');

        // For demo purposes, show that biometric worked
        // In production, you'd get a custom token from backend
        setTimeout(() => {
          showMessage(loginError, 'זיהוי ביומטרי מוצלח. אנא השלם כניסה עם סיסמה.', 'error');
        }, 1500);
      }

    } catch (error) {
      console.error('[Quick Log] Biometric login error:', error);

      if (error.name === 'NotAllowedError') {
        showMessage(loginError, 'הזיהוי הביומטרי נכשל או בוטל', 'error');
      } else {
        showMessage(loginError, 'שגיאה בכניסה ביומטרית', 'error');
      }
    } finally {
      biometricBtn.classList.remove('loading');
    }
  });

  // Store credential after successful password login
  async function registerBiometricAfterLogin(email) {
    const biometricAvailable = await checkBiometricAvailability();
    if (!biometricAvailable) {
return;
}

    try {
      // Create credential for future biometric login
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: new Uint8Array(32),
          rp: {
            name: 'משרד עורכי דין - רישום מהיר',
            id: window.location.hostname
          },
          user: {
            id: new Uint8Array(16),
            name: email,
            displayName: email
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' }  // ES256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required'
          },
          timeout: 60000
        }
      });

      if (credential) {
        // Store email for future biometric login
        localStorage.setItem(BIOMETRIC_CREDENTIAL_KEY, email);
        console.log('[Quick Log] Biometric credential registered');
      }
    } catch (error) {
      // Silent fail - don't interrupt user flow
      console.error('[Quick Log] Biometric registration error:', error);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // PASSWORD VISIBILITY TOGGLE
  // ═══════════════════════════════════════════════════════════════════

  const passwordToggle = document.getElementById('passwordToggle');
  const passwordInput = document.getElementById('loginPassword');

  passwordToggle.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';

    const icon = passwordToggle.querySelector('i');
    icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';

    passwordToggle.setAttribute('aria-label', isPassword ? 'הסתר סיסמה' : 'הצג סיסמה');
  });

  // Initialize biometric check on load
  checkBiometricAvailability();

  // ⚠️ DEV: Disable biometric demo (no backend support)
  biometricBtn.style.display = 'none';

  // ═══════════════════════════════════════════════════════════════════
  // CLIENT LOADING & AUTOCOMPLETE
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Generic 3D Wheel Picker Factory
   * iOS-style wheel with perspective effect + Virtual Scrolling for performance
   *
   * @param {Object} config - Configuration object
   * @param {string} config.inputId - ID of the hidden input element
   * @param {string} config.displayId - ID of the display button element
   * @param {string} config.pickerId - ID of the picker modal element
   * @param {string} config.scrollId - ID of the scroll container element
   * @param {string} config.doneButtonId - ID of the done button element
   * @param {Array} config.items - Array of {value, label} objects
   * @param {string} config.displayFormat - Function or string template for display
   * @param {boolean} config.useVirtualScrolling - Enable virtual scrolling (default: true for >100 items)
   */
  function createWheelPicker(config) {
    const input = document.getElementById(config.inputId);
    const display = document.getElementById(config.displayId);
    const picker = document.getElementById(config.pickerId);
    const wheelScroll = document.getElementById(config.scrollId);
    const doneButton = document.getElementById(config.doneButtonId);
    const backdrop = document.getElementById('wheelPickerBackdrop');

    let selectedValue = null;
    let isScrolling = false;
    let scrollTimeout = null;

    // Constants
    const ITEM_HEIGHT = 44;
    const SCROLL_PADDING = 115;
    const BUFFER_SIZE = 25;
    const TOTAL_ITEMS = config.items.length;
    const TOTAL_HEIGHT = TOTAL_ITEMS * ITEM_HEIGHT;
    const USE_VIRTUAL = config.useVirtualScrolling !== false && TOTAL_ITEMS > 100;

    // Create container
    wheelScroll.innerHTML = `<div class="wheel-virtual-container" style="height: ${TOTAL_HEIGHT}px; position: relative;"></div>`;
    const container = wheelScroll.firstElementChild;

    // Cache for rendered items
    const renderedItems = new Map();
    let lastRenderedRange = { start: -1, end: -1 };

    /**
     * Format display text
     */
    function formatDisplay(value) {
      if (typeof config.displayFormat === 'function') {
        return config.displayFormat(value);
      }
      return config.displayFormat.replace('{value}', value);
    }

    /**
     * Render visible items based on scroll position
     */
    function renderVisibleItems() {
      const scrollTop = wheelScroll.scrollTop;
      const viewportHeight = wheelScroll.clientHeight;

      let startIndex, endIndex;

      if (USE_VIRTUAL) {
        // Virtual scrolling for large lists
        startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_SIZE);
        endIndex = Math.min(TOTAL_ITEMS, Math.ceil((scrollTop + viewportHeight) / ITEM_HEIGHT) + BUFFER_SIZE);

        if (startIndex === lastRenderedRange.start && endIndex === lastRenderedRange.end) {
          return;
        }
        lastRenderedRange = { start: startIndex, end: endIndex };
      } else {
        // Render all items for small lists
        startIndex = 0;
        endIndex = TOTAL_ITEMS;
      }

      // Remove items outside range
      if (USE_VIRTUAL) {
        renderedItems.forEach((element, index) => {
          if (index < startIndex || index >= endIndex) {
            element.remove();
            renderedItems.delete(index);
          }
        });
      }

      // Add/update items in range
      for (let i = startIndex; i < endIndex; i++) {
        if (!renderedItems.has(i)) {
          const itemData = config.items[i];
          const item = document.createElement('div');
          item.className = 'wheel-picker-item';
          item.dataset.value = itemData.value;
          item.dataset.index = i;
          item.textContent = itemData.label;
          item.style.position = 'absolute';
          item.style.top = `${i * ITEM_HEIGHT}px`;
          item.style.left = '0';
          item.style.right = '0';
          item.style.width = '100%';
          item.style.height = `${ITEM_HEIGHT}px`;
          item.style.display = 'flex';
          item.style.alignItems = 'center';
          item.style.justifyContent = 'center';
          item.style.fontSize = '1.125rem';
          item.style.fontWeight = '500';
          item.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
          item.style.transformStyle = 'preserve-3d';
          item.style.transformOrigin = 'center center';
          item.style.willChange = 'transform, opacity';
          item.style.userSelect = 'none';
          item.style.cursor = 'pointer';
          item.style.textAlign = 'center';

          // Add click handler
          item.addEventListener('click', () => {
            selectedValue = itemData.value;
            input.value = itemData.value;
            display.textContent = formatDisplay(itemData.label);
            display.style.color = 'var(--gray-900)';

            if (navigator.vibrate) {
navigator.vibrate(10);
}
            setTimeout(closeWheel, 200);
          });

          container.appendChild(item);
          renderedItems.set(i, item);
        }
      }

      updateWheelEffect();
    }

    // Open wheel picker
    display.addEventListener('click', () => {
      picker.classList.add('active');
      backdrop.classList.add('active');
      document.body.style.overflow = 'hidden';

      renderVisibleItems();

      // Scroll to current value
      if (selectedValue) {
        const index = config.items.findIndex(item => item.value === selectedValue);
        if (index !== -1) {
          const viewportHeight = wheelScroll.clientHeight;
          const targetScroll = index * ITEM_HEIGHT - (viewportHeight / 2) + (ITEM_HEIGHT / 2) + SCROLL_PADDING;
          wheelScroll.scrollTop = Math.max(0, targetScroll);
          renderVisibleItems();
        }
      }

      setTimeout(updateWheelEffect, 50);
    });

    // Close wheel picker
    const closeWheel = () => {
      picker.classList.remove('active');
      // Only hide backdrop if no other pickers are open
      const openPickers = document.querySelectorAll('.wheel-picker.active');
      if (openPickers.length === 0) {
        backdrop.classList.remove('active');
        document.body.style.overflow = '';
      }
    };

    // Close on backdrop click (only this picker)
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop && picker.classList.contains('active')) {
        closeWheel();
      }
    });
    doneButton.addEventListener('click', closeWheel);

    // Handle scroll
    wheelScroll.addEventListener('scroll', () => {
      isScrolling = true;
      clearTimeout(scrollTimeout);
      renderVisibleItems();
      scrollTimeout = setTimeout(() => {
        isScrolling = false;
        snapToNearest();
      }, 150);
    });

    // Update 3D effect
    function updateWheelEffect() {
      const scrollTop = wheelScroll.scrollTop;
      const viewportHeight = wheelScroll.clientHeight;
      const containerMiddle = scrollTop + (viewportHeight / 2) - SCROLL_PADDING;

      let closestItem = null;
      let minDistance = Infinity;

      renderedItems.forEach((element, index) => {
        const itemTop = index * ITEM_HEIGHT;
        const itemCenter = itemTop + (ITEM_HEIGHT / 2);
        const distance = Math.abs(itemCenter - containerMiddle);

        if (distance < minDistance) {
          minDistance = distance;
          const itemData = config.items[index];
          closestItem = { element, index, value: itemData.value, label: itemData.label };
        }
      });

      if (isScrolling && closestItem) {
        display.textContent = formatDisplay(closestItem.label);
        display.style.color = 'var(--gray-900)';
      }

      renderedItems.forEach((item, index) => {
        const itemTop = index * ITEM_HEIGHT;
        const itemCenter = itemTop + (ITEM_HEIGHT / 2);
        const distanceFromCenter = itemCenter - containerMiddle;
        const absDistance = Math.abs(distanceFromCenter);

        const rotationAngle = (distanceFromCenter / ITEM_HEIGHT) * 15;
        const clampedRotation = Math.max(-45, Math.min(45, rotationAngle));

        let opacity, fontSize, fontWeight, color;

        if (absDistance < 22) {
          opacity = 1;
          fontSize = '1.75rem';
          fontWeight = '700';
          color = '#1a365d';
        } else if (absDistance < 44) {
          const ratio = absDistance / 44;
          opacity = 1 - (ratio * 0.35);
          fontSize = `${1.75 - (ratio * 0.5)}rem`;
          fontWeight = '600';
          color = '#4b5563';
        } else if (absDistance < 88) {
          const ratio = (absDistance - 44) / 44;
          opacity = 0.65 - (ratio * 0.25);
          fontSize = `${1.25 - (ratio * 0.15)}rem`;
          fontWeight = '500';
          color = '#6b7280';
        } else {
          opacity = 0.15;
          fontSize = '1rem';
          fontWeight = '500';
          color = '#d1d5db';
        }

        item.style.opacity = opacity;
        item.style.fontSize = fontSize;
        item.style.fontWeight = fontWeight;
        item.style.color = color;
        item.style.transform = `rotateX(${-clampedRotation}deg) translateZ(0)`;
      });
    }

    // Snap to nearest
    function snapToNearest() {
      const scrollTop = wheelScroll.scrollTop;
      const viewportHeight = wheelScroll.clientHeight;
      const containerMiddle = scrollTop + (viewportHeight / 2) - SCROLL_PADDING;

      let closestItem = null;
      let minDistance = Infinity;

      renderedItems.forEach((_element, index) => {
        const itemTop = index * ITEM_HEIGHT;
        const itemCenter = itemTop + (ITEM_HEIGHT / 2);
        const distance = Math.abs(itemCenter - containerMiddle);

        if (distance < minDistance) {
          minDistance = distance;
          const itemData = config.items[index];
          closestItem = { index, value: itemData.value, label: itemData.label };
        }
      });

      if (!closestItem) {
return;
}

      const targetScroll = closestItem.index * ITEM_HEIGHT - (viewportHeight / 2) + (ITEM_HEIGHT / 2) + SCROLL_PADDING;
      wheelScroll.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth'
      });

      selectedValue = closestItem.value;
      input.value = closestItem.value;
      display.textContent = formatDisplay(closestItem.label);
      display.style.color = 'var(--gray-900)';

      if (navigator.vibrate) {
navigator.vibrate(10);
}

      setTimeout(() => {
        renderVisibleItems();
        updateWheelEffect();
      }, 100);
    }
  }

  /**
   * Initialize Hybrid Minutes Picker (Input + Wheel)
   */
  function initializeMinutesPicker() {
    const input = document.getElementById('minutes');
    const pickerBtn = document.getElementById('minutesPickerBtn');
    const picker = document.getElementById('minutesWheelPicker');
    const wheelScroll = document.getElementById('minutesWheelScroll');
    const doneButton = document.getElementById('wheelPickerDone');
    const backdrop = document.getElementById('wheelPickerBackdrop');

    const ITEM_HEIGHT = 44;
    const SCROLL_PADDING = 115;
    const BUFFER_SIZE = 25;
    const MIN_VALUE = 1;
    const MAX_VALUE = 2000;

    // Generate items
    const minutesItems = [];
    for (let i = MIN_VALUE; i <= MAX_VALUE; i++) {
      minutesItems.push({ value: i, label: i.toString() });
    }

    const TOTAL_ITEMS = minutesItems.length;
    const TOTAL_HEIGHT = TOTAL_ITEMS * ITEM_HEIGHT;

    // Create container with virtual scrolling
    wheelScroll.innerHTML = `<div class="wheel-virtual-container" style="height: ${TOTAL_HEIGHT}px; position: relative;"></div>`;
    const container = wheelScroll.firstElementChild;

    const renderedItems = new Map();
    let lastRenderedRange = { start: -1, end: -1 };
    let scrollTimeout = null;

    // Validate input
    function validateInput() {
      let value = parseInt(input.value);
      if (isNaN(value) || value < MIN_VALUE) {
        value = MIN_VALUE;
      } else if (value > MAX_VALUE) {
        value = MAX_VALUE;
      }
      input.value = value;
      return value;
    }

    // Render visible items
    function renderVisibleItems() {
      const scrollTop = wheelScroll.scrollTop;
      const viewportHeight = wheelScroll.clientHeight;

      const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_SIZE);
      const endIndex = Math.min(TOTAL_ITEMS, Math.ceil((scrollTop + viewportHeight) / ITEM_HEIGHT) + BUFFER_SIZE);

      if (startIndex === lastRenderedRange.start && endIndex === lastRenderedRange.end) {
        return;
      }
      lastRenderedRange = { start: startIndex, end: endIndex };

      // Remove items outside range
      renderedItems.forEach((element, index) => {
        if (index < startIndex || index >= endIndex) {
          element.remove();
          renderedItems.delete(index);
        }
      });

      // Add items in range
      for (let i = startIndex; i < endIndex; i++) {
        if (!renderedItems.has(i)) {
          const itemData = minutesItems[i];
          const item = document.createElement('div');
          item.className = 'wheel-picker-item';
          item.dataset.value = itemData.value;
          item.dataset.index = i;
          item.textContent = itemData.label;
          item.style.position = 'absolute';
          item.style.top = `${i * ITEM_HEIGHT}px`;
          item.style.left = '0';
          item.style.right = '0';
          item.style.width = '100%';
          item.style.height = `${ITEM_HEIGHT}px`;
          item.style.display = 'flex';
          item.style.alignItems = 'center';
          item.style.justifyContent = 'center';
          item.style.fontSize = '1.125rem';
          item.style.fontWeight = '500';
          item.style.transition = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
          item.style.transformStyle = 'preserve-3d';
          item.style.transformOrigin = 'center center';
          item.style.willChange = 'transform, opacity';
          item.style.userSelect = 'none';
          item.style.cursor = 'pointer';
          item.style.textAlign = 'center';

          item.addEventListener('click', () => {
            input.value = itemData.value;
            if (navigator.vibrate) {
navigator.vibrate(10);
}
            setTimeout(closePicker, 200);
          });

          container.appendChild(item);
          renderedItems.set(i, item);
        }
      }

      updateWheelEffect();
    }

    // Update 3D effect
    function updateWheelEffect() {
      const scrollTop = wheelScroll.scrollTop;
      const viewportHeight = wheelScroll.clientHeight;
      const containerMiddle = scrollTop + (viewportHeight / 2) - SCROLL_PADDING;

      renderedItems.forEach((item, index) => {
        const itemTop = index * ITEM_HEIGHT;
        const itemCenter = itemTop + (ITEM_HEIGHT / 2);
        const distanceFromCenter = itemCenter - containerMiddle;
        const absDistance = Math.abs(distanceFromCenter);

        const rotationAngle = (distanceFromCenter / ITEM_HEIGHT) * 15;
        const clampedRotation = Math.max(-45, Math.min(45, rotationAngle));

        let opacity, fontSize, fontWeight, color;

        if (absDistance < 22) {
          opacity = 1;
          fontSize = '1.75rem';
          fontWeight = '700';
          color = '#1a365d';
        } else if (absDistance < 44) {
          const ratio = absDistance / 44;
          opacity = 1 - (ratio * 0.35);
          fontSize = `${1.75 - (ratio * 0.5)}rem`;
          fontWeight = '600';
          color = '#4b5563';
        } else if (absDistance < 88) {
          const ratio = (absDistance - 44) / 44;
          opacity = 0.65 - (ratio * 0.25);
          fontSize = `${1.25 - (ratio * 0.15)}rem`;
          fontWeight = '500';
          color = '#6b7280';
        } else {
          opacity = 0.15;
          fontSize = '1rem';
          fontWeight = '500';
          color = '#d1d5db';
        }

        item.style.opacity = opacity;
        item.style.fontSize = fontSize;
        item.style.fontWeight = fontWeight;
        item.style.color = color;
        item.style.transform = `rotateX(${-clampedRotation}deg) translateZ(0)`;
      });
    }

    // Snap to nearest
    function snapToNearest() {
      const scrollTop = wheelScroll.scrollTop;
      const viewportHeight = wheelScroll.clientHeight;
      const containerMiddle = scrollTop + (viewportHeight / 2) - SCROLL_PADDING;

      let closestItem = null;
      let minDistance = Infinity;

      renderedItems.forEach((_element, index) => {
        const itemTop = index * ITEM_HEIGHT;
        const itemCenter = itemTop + (ITEM_HEIGHT / 2);
        const distance = Math.abs(itemCenter - containerMiddle);

        if (distance < minDistance) {
          minDistance = distance;
          closestItem = { index, value: minutesItems[index].value };
        }
      });

      if (!closestItem) {
return;
}

      const targetScroll = closestItem.index * ITEM_HEIGHT - (viewportHeight / 2) + (ITEM_HEIGHT / 2) + SCROLL_PADDING;
      wheelScroll.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth'
      });

      input.value = closestItem.value;
      if (navigator.vibrate) {
navigator.vibrate(10);
}

      setTimeout(() => {
        renderVisibleItems();
        updateWheelEffect();
      }, 100);
    }

    // Open picker
    function openPicker() {
      picker.classList.add('active');
      backdrop.classList.add('active');
      document.body.style.overflow = 'hidden';

      // Validate and scroll to current value
      const currentValue = validateInput();
      const index = currentValue - 1; // 0-indexed

      renderVisibleItems();

      const viewportHeight = wheelScroll.clientHeight;
      const targetScroll = index * ITEM_HEIGHT - (viewportHeight / 2) + (ITEM_HEIGHT / 2) + SCROLL_PADDING;
      wheelScroll.scrollTop = Math.max(0, targetScroll);

      renderVisibleItems();
      setTimeout(updateWheelEffect, 50);
    }

    // Close picker
    function closePicker() {
      picker.classList.remove('active');
      const openPickers = document.querySelectorAll('.wheel-picker.active');
      if (openPickers.length === 0) {
        backdrop.classList.remove('active');
        document.body.style.overflow = '';
      }
    }

    // Event listeners
    pickerBtn.addEventListener('click', openPicker);
    doneButton.addEventListener('click', closePicker);

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop && picker.classList.contains('active')) {
        closePicker();
      }
    });

    wheelScroll.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      renderVisibleItems();
      scrollTimeout = setTimeout(() => {
        snapToNearest();
      }, 150);
    });

    // Input validation on blur
    input.addEventListener('blur', validateInput);

    // Prevent invalid characters
    input.addEventListener('keypress', (e) => {
      if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E' || e.key === '.') {
        e.preventDefault();
      }
    });
  }

  /**
   * Initialize date input with today's date
   */
  function initializeDatePicker() {
    const dateInput = document.getElementById('date');
    const today = new Date();
    dateInput.value = today.toISOString().split('T')[0];
  }

  /**
   * Initialize 3D Wheel Picker for branch
   */
  function initializeBranchPicker() {
    const branchItems = [
      { value: 'רחובות', label: 'רחובות' },
      { value: 'תל אביב', label: 'תל אביב' }
    ];

    createWheelPicker({
      inputId: 'branch',
      displayId: 'branchDisplay',
      pickerId: 'branchWheelPicker',
      scrollId: 'branchWheelScroll',
      doneButtonId: 'branchWheelPickerDone',
      items: branchItems,
      displayFormat: (label) => label,
      useVirtualScrolling: false
    });
  }

  /**
   * Load clients from Firestore
   * Reuses window.clients if available, otherwise fetches
   */
  async function loadClients() {
    try {
      // Initialize wheel pickers
      initializeMinutesPicker();
      initializeDatePicker();
      initializeBranchPicker();

      // Check if clients are already loaded (from main app)
      if (window.clients && Array.isArray(window.clients) && window.clients.length > 0) {
        // Reusing existing clients from window.clients
        allClients = window.clients;
        return;
      }

      // Otherwise, fetch from Firestore (no existing clients)
      const snapshot = await db.collection('clients').get();

      allClients = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Clients loaded successfully from Firestore

    } catch (error) {
      console.error('[Quick Log] Error loading clients:', error);
      showError('שגיאה בטעינת לקוחות. נסה שוב.');
    }
  }

  /**
   * Filter clients based on search term
   * Reuses logic from client-search.js
   */
  function filterClients(searchTerm) {
    if (!searchTerm || searchTerm.length < 1) {
      return [];
    }

    const lowerSearch = searchTerm.toLowerCase();

    return allClients.filter(client =>
      client.fullName?.toLowerCase().includes(lowerSearch) ||
      client.fileNumber?.includes(searchTerm) ||
      client.clientName?.toLowerCase().includes(lowerSearch)
    );
  }

  /**
   * Handle client search input
   */
  clientSearch.addEventListener('input', (e) => {
    const searchTerm = e.target.value;

    if (searchTerm.length < 1) {
      clientResults.innerHTML = '';
      clientResults.classList.remove('show');
      return;
    }

    const filtered = filterClients(searchTerm);

    if (filtered.length === 0) {
      clientResults.innerHTML = `
        <div class="no-results">
          <i class="fas fa-search"></i> לא נמצאו לקוחות תואמים
        </div>
      `;
    } else {
      clientResults.innerHTML = filtered.slice(0, 8).map(client => `
        <div class="result-item" data-client-id="${safeAttr(client.id)}" data-client-name="${safeAttr(client.fullName || client.clientName)}">
          <strong>${safeText(client.fullName || client.clientName)}</strong>
          ${client.fileNumber ? `<span class="file-number">${safeText(client.fileNumber)}</span>` : ''}
        </div>
      `).join('');

      // Add click handlers to results
      const resultItems = clientResults.querySelectorAll('.result-item');
      resultItems.forEach(item => {
        item.addEventListener('click', () => {
          selectClient(item.dataset.clientId, item.dataset.clientName);
        });
      });
    }

    clientResults.classList.add('show');
  });

  /**
   * Select a client from autocomplete
   */
  function selectClient(clientId, clientName) {
    document.getElementById('selectedClientId').value = clientId;
    document.getElementById('selectedClientName').value = clientName;
    clientSearch.value = clientName;
    clientResults.innerHTML = '';
    clientResults.classList.remove('show');

    // Check if client has multiple services
    const client = allClients.find(c => c.id === clientId);

    if (client && client.services && client.services.length > 1) {
      showServiceSelector(client.services);
    } else if (client && client.services && client.services.length === 1) {
      // Single service - auto-select it
      document.getElementById('selectedServiceId').value = client.services[0].id;
      hideServiceSelector();
    } else {
      // No services
      hideServiceSelector();
    }
  }

  /**
   * Show service selector dropdown
   */
  function showServiceSelector(services) {
    const serviceSelector = document.getElementById('serviceSelector');
    const serviceSelectorGroup = document.getElementById('serviceSelectorGroup');

    // Build options
    const options = services.map(service => {
      const hoursRemaining = service.hoursRemaining || 0;
      const status = hoursRemaining <= 0 ? ' (אזלו השעות)' : ` (${hoursRemaining.toFixed(1)} שעות נותרות)`;
      return `<option value="${safeAttr(service.id)}">${safeText(service.name || 'שירות ללא שם')}${status}</option>`;
    }).join('');

    serviceSelector.innerHTML = '<option value="">בחר שירות...</option>' + options;
    serviceSelectorGroup.classList.remove('hidden');
    serviceSelector.required = true;
  }

  /**
   * Hide service selector dropdown
   */
  function hideServiceSelector() {
    const serviceSelectorGroup = document.getElementById('serviceSelectorGroup');
    const serviceSelector = document.getElementById('serviceSelector');

    serviceSelectorGroup.classList.add('hidden');
    serviceSelector.required = false;
  }

  // Service selector change handler
  document.getElementById('serviceSelector').addEventListener('change', (e) => {
    document.getElementById('selectedServiceId').value = e.target.value;
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!clientSearch.contains(e.target) && !clientResults.contains(e.target)) {
      clientResults.classList.remove('show');
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // FORM SUBMISSION
  // ═══════════════════════════════════════════════════════════════════

  quickLogForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const clientId = document.getElementById('selectedClientId').value;
    const clientName = document.getElementById('selectedClientName').value;
    const serviceId = document.getElementById('selectedServiceId').value;
    const branch = document.getElementById('branch').value;
    const totalMinutes = parseInt(document.getElementById('minutes').value) || 0;
    const description = document.getElementById('description').value.trim();
    const dateValue = dateInput.value;

    // Validation
    if (!clientId || !clientName) {
      showError('יש לבחור לקוח מהרשימה');
      return;
    }

    // Check if service selector is visible and required
    const serviceSelectorGroup = document.getElementById('serviceSelectorGroup');
    if (!serviceSelectorGroup.classList.contains('hidden') && !serviceId) {
      showError('יש לבחור שירות/חבילה');
      return;
    }

    if (!branch) {
      showError('יש לבחור סניף מטפל');
      return;
    }

    if (totalMinutes <= 0) {
      showError('יש להזין לפחות דקה אחת');
      return;
    }

    if (!description) {
      showError('יש להזין תיאור פעולה');
      return;
    }

    if (!dateValue) {
      showError('יש לבחור תאריך');
      return;
    }

    // Show loading
    showLoading();
    hideAllMessages();

    try {
      // Convert date to ISO string (Callable Functions don't support Timestamp serialization)
      const dateObj = new Date(dateValue);
      const dateISO = dateObj.toISOString();

      // Build payload
      const payload = {
        clientId: clientId,
        clientName: clientName,
        date: dateISO,  // Send as ISO string, backend will convert to Timestamp
        minutes: totalMinutes,
        description: description,
        branch: branch
      };

      // Add serviceId if selected
      if (serviceId) {
        payload.serviceId = serviceId;
      }

      // Call Cloud Function
      const createQuickLogEntry = functions.httpsCallable('createQuickLogEntry');
      const result = await createQuickLogEntry(payload);

      hideLoading();

      if (result.data.success) {
        const hoursText = totalMinutes >= 60
          ? `${Math.floor(totalMinutes / 60)} שעות ${totalMinutes % 60 > 0 ? `ו-${totalMinutes % 60} דקות` : ''}`
          : `${totalMinutes} דקות`;

        showSuccess(`✅ נרשמו ${hoursText} עבור ${clientName}`);
        resetForm();
      } else {
        showError(result.data.message || 'שגיאה בשליחת הדיווח');
      }

    } catch (error) {
      hideLoading();
      console.error('[Quick Log] Submission error:', error);

      let errorText = 'שגיאה בשליחת הדיווח';

      if (error.code === 'permission-denied') {
        errorText = 'אין לך הרשאה לבצע פעולה זו';
      } else if (error.code === 'unauthenticated') {
        errorText = 'נדרשת התחברות מחדש';
        setTimeout(() => logout(), 2000);
      } else if (error.code === 'not-found') {
        errorText = 'לקוח לא נמצא במערכת';
      } else if (error.code === 'invalid-argument') {
        errorText = error.message || 'נתונים לא תקינים';
      } else if (error.code === 'resource-exhausted') {
        errorText = error.message || 'הלקוח בחריגה - נא לעדכן את גיא';
      } else if (error.message) {
        errorText = error.message;
      }

      showError(errorText);
    }
  });

  /**
   * Reset form to default values
   */
  function resetForm() {
    document.getElementById('selectedClientId').value = '';
    document.getElementById('selectedClientName').value = '';
    document.getElementById('selectedServiceId').value = '';
    clientSearch.value = '';
    document.getElementById('branch').value = '';
    document.getElementById('minutes').value = '';
    document.getElementById('description').value = '';
    document.getElementById('date').value = new Date().toISOString().split('T')[0];
    hideServiceSelector();

    // Reset branch display only (minutes is now a direct input)
    const branchDisplay = document.getElementById('branchDisplay');
    if (branchDisplay) {
      branchDisplay.textContent = 'בחר סניף...';
      branchDisplay.style.color = '';
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // UI HELPERS
  // ═══════════════════════════════════════════════════════════════════

  function showLoginScreen() {
    loginScreen.classList.remove('hidden');
    quickLogScreen.classList.add('hidden');
  }

  function showQuickLogScreen() {
    loginScreen.classList.add('hidden');
    quickLogScreen.classList.remove('hidden');
    userName.textContent = currentUser.username || currentUser.email;

    // Set default date to today (handled by wheel picker initialization)
  }

  function showLoading() {
    loadingOverlay.classList.remove('hidden');
  }

  function hideLoading() {
    loadingOverlay.classList.add('hidden');
  }

  function showSuccess(message) {
    successMessage.textContent = message;
    successMessage.classList.remove('hidden');

    // Auto-hide after 5 seconds
    setTimeout(() => {
      successMessage.classList.add('hidden');
    }, 5000);
  }

  function showError(message, isPersistent = false) {
    errorMessage.textContent = '❌ ' + message;
    errorMessage.classList.remove('hidden');

    // Auto-hide after 7 seconds (unless persistent)
    if (!isPersistent) {
      setTimeout(() => {
        errorMessage.classList.add('hidden');
      }, 7000);
    }
  }

  function showMessage(element, message, type) {
    element.textContent = message;
    element.classList.remove('hidden');
    element.classList.add(type);
  }

  function hideMessage(element) {
    element.classList.add('hidden');
  }

  function hideAllMessages() {
    successMessage.classList.add('hidden');
    errorMessage.classList.add('hidden');
  }

  // ═══════════════════════════════════════════════════════════════════
  // UTILITY FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Sanitize text for display (XSS protection)
   */
  function safeText(text) {
    if (!text) {
return '';
}
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Sanitize attribute value (XSS protection)
   */
  function safeAttr(value) {
    if (!value) {
return '';
}
    return String(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ═══════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════

  // Quick Log initialized and ready

})();
