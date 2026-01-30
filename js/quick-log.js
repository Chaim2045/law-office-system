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
      const email = user.email.toLowerCase().trim();

      // Try to get employee document
      const employeeDoc = await db.collection('employees').doc(email).get();

      if (!employeeDoc.exists) {
        console.error('[Quick Log] Employee document not found');
        return false;
      }

      const employee = employeeDoc.data();
      currentUser = employee;

      // Check if user is manager or admin
      const isAuthorized = employee.role === 'manager' || employee.role === 'admin';

      // User role checked: manager or admin required

      return isAuthorized;

    } catch (error) {
      console.error('[Quick Log] Error checking user role:', error);
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
  // CLIENT LOADING & AUTOCOMPLETE
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Load clients from Firestore
   * Reuses window.clients if available, otherwise fetches
   */
  async function loadClients() {
    try {
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

    // Client selected from autocomplete
  }

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
    const hours = parseInt(document.getElementById('hours').value) || 0;
    const mins = parseInt(document.getElementById('minutes').value) || 0;
    const description = document.getElementById('description').value.trim();
    const dateValue = dateInput.value;

    // Validation
    if (!clientId || !clientName) {
      showError('יש לבחור לקוח מהרשימה');
      return;
    }

    const totalMinutes = (hours * 60) + mins;
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
      // Convert date to Timestamp
      const date = firebase.firestore.Timestamp.fromDate(new Date(dateValue));

      // Call Cloud Function
      const createQuickLogEntry = functions.httpsCallable('createQuickLogEntry');

      const result = await createQuickLogEntry({
        clientId: clientId,
        clientName: clientName,
        date: date,
        minutes: totalMinutes,
        description: description
      });

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
    clientSearch.value = '';
    document.getElementById('hours').value = '0';
    document.getElementById('minutes').value = '0';
    document.getElementById('description').value = '';
    dateInput.valueAsDate = new Date();
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

    // Set default date to today
    dateInput.valueAsDate = new Date();
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
