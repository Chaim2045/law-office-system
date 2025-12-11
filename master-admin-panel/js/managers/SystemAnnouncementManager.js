/**
 * ═════════════════════════════════════════════════════════════════
 * System Announcement Manager - Admin Panel
 * ═════════════════════════════════════════════════════════════════
 *
 * Manages system-wide announcements from the admin panel
 * Allows admins to create, publish, and manage global announcements
 *
 * Features:
 * - Create new announcements (info, warning, critical)
 * - Set expiry dates
 * - View active announcements
 * - View dismissed statistics
 * - Archive/deactivate announcements
 *
 * Created: 2025-12-11
 * Version: 1.0.0
 */

window.SystemAnnouncementManager = (function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════
  // SEVERITY LEVELS
  // ═══════════════════════════════════════════════════════════════

  const SEVERITY_LEVELS = {
    info: {
      label: 'מידע',
      icon: 'fa-info-circle',
      color: '#3b82f6',
      description: 'עדכון או מידע כללי'
    },
    warning: {
      label: 'אזהרה',
      icon: 'fa-exclamation-triangle',
      color: '#f97316',
      description: 'דורש תשומת לב'
    },
    critical: {
      label: 'קריטי',
      icon: 'fa-exclamation-circle',
      color: '#ef4444',
      description: 'דחוף ביותר'
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════

  let state = {
    currentUser: null,
    db: null,
    announcements: []
  };

  // ═══════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════

  function init() {
    console.log('📢 SystemAnnouncementManager: Initializing...');

    // Get Firebase references
    state.db = window.firebaseDB;
    state.currentUser = window.firebaseAuth?.currentUser;

    if (!state.db || !state.currentUser) {
      console.error('❌ SystemAnnouncementManager: Missing Firebase dependencies');
      return;
    }

    renderUI();
    loadAnnouncements();

    console.log('✅ SystemAnnouncementManager initialized');
  }

  // ═══════════════════════════════════════════════════════════════
  // UI RENDERING
  // ═══════════════════════════════════════════════════════════════

  function renderUI() {
    const container = document.getElementById('announcement-manager-section');
    if (!container) {
      console.error('❌ Announcement manager section not found');
      return;
    }

    container.innerHTML = `
      <div class="announcement-manager">
        <!-- Header -->
        <div class="manager-header">
          <h2>
            <i class="fas fa-bullhorn"></i>
            הודעות מערכת
          </h2>
          <p class="manager-subtitle">
            שלח הודעות גלובליות לכל המשתמשים במערכת
          </p>
        </div>

        <!-- Create Announcement Form -->
        <div class="create-announcement-section">
          <h3 class="section-title">
            <i class="fas fa-plus-circle"></i>
            צור הודעה חדשה
          </h3>

          <form id="createAnnouncementForm" class="announcement-form">
            <!-- Severity Selection -->
            <div class="form-group">
              <label class="form-label">
                <i class="fas fa-signal"></i>
                רמת חומרה
              </label>
              <div class="severity-buttons" id="severityButtons">
                ${Object.entries(SEVERITY_LEVELS).map(([key, level]) => `
                  <button
                    type="button"
                    class="severity-btn ${key === 'info' ? 'active' : ''}"
                    data-severity="${key}"
                    style="--severity-color: ${level.color}"
                  >
                    <i class="fas ${level.icon}"></i>
                    <span class="severity-label">${level.label}</span>
                    <span class="severity-desc">${level.description}</span>
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- Message Input -->
            <div class="form-group">
              <label class="form-label" for="announcementMessage">
                <i class="fas fa-comment"></i>
                תוכן ההודעה
                <span class="required">*</span>
              </label>
              <textarea
                id="announcementMessage"
                class="form-textarea"
                placeholder="הכנס את תוכן ההודעה כאן..."
                rows="4"
                maxlength="500"
                required
              ></textarea>
              <div class="char-counter">
                <span id="charCount">0</span> / 500 תווים
              </div>
            </div>

            <!-- Expiry Date -->
            <div class="form-group">
              <label class="form-label" for="expiryDate">
                <i class="fas fa-calendar-times"></i>
                תאריך תפוגה (אופציונלי)
              </label>
              <input
                type="datetime-local"
                id="expiryDate"
                class="form-input"
              />
              <small class="form-hint">
                ההודעה תיעלם אוטומטית בתאריך זה. השאר ריק להודעה קבועה.
              </small>
            </div>

            <!-- Submit Button -->
            <div class="form-actions">
              <button type="submit" class="btn-primary" id="publishBtn">
                <i class="fas fa-paper-plane"></i>
                פרסם הודעה
              </button>
              <button type="button" class="btn-secondary" id="resetFormBtn">
                <i class="fas fa-redo"></i>
                נקה טופס
              </button>
            </div>
          </form>
        </div>

        <!-- Active Announcements List -->
        <div class="announcements-list-section">
          <h3 class="section-title">
            <i class="fas fa-list"></i>
            הודעות פעילות
          </h3>
          <div id="announcementsList" class="announcements-list">
            <div class="loading-state">
              <i class="fas fa-spinner fa-spin"></i>
              טוען הודעות...
            </div>
          </div>
        </div>
      </div>
    `;

    attachEventListeners();
    injectStyles();
  }

  // ═══════════════════════════════════════════════════════════════
  // EVENT LISTENERS
  // ═══════════════════════════════════════════════════════════════

  function attachEventListeners() {
    // Severity buttons
    document.querySelectorAll('.severity-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.severity-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Character counter
    const messageInput = document.getElementById('announcementMessage');
    if (messageInput) {
      messageInput.addEventListener('input', (e) => {
        const charCount = document.getElementById('charCount');
        if (charCount) {
          charCount.textContent = e.target.value.length;
        }
      });
    }

    // Form submission
    const form = document.getElementById('createAnnouncementForm');
    if (form) {
      form.addEventListener('submit', handleCreateAnnouncement);
    }

    // Reset button
    const resetBtn = document.getElementById('resetFormBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', resetForm);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CREATE ANNOUNCEMENT
  // ═══════════════════════════════════════════════════════════════

  async function handleCreateAnnouncement(e) {
    e.preventDefault();

    const messageInput = document.getElementById('announcementMessage');
    const expiryInput = document.getElementById('expiryDate');
    const severityBtn = document.querySelector('.severity-btn.active');

    const message = messageInput.value.trim();
    const severity = severityBtn?.dataset.severity || 'info';
    const expiryDate = expiryInput.value;

    if (!message) {
      showNotification('נא להזין תוכן הודעה', 'error');
      return;
    }

    // Confirm before publishing
    const confirmed = confirm(`האם אתה בטוח שברצונך לפרסם הודעה זו לכל המשתמשים?\n\nחומרה: ${SEVERITY_LEVELS[severity].label}\nתוכן: ${message}`);
    if (!confirmed) return;

    const publishBtn = document.getElementById('publishBtn');
    publishBtn.disabled = true;
    publishBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> מפרסם...';

    try {
      const announcementData = {
        message: message,
        severity: severity,
        isActive: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: state.currentUser.email,
        dismissedBy: []
      };

      // Add expiry date if provided
      if (expiryDate) {
        announcementData.expiresAt = firebase.firestore.Timestamp.fromDate(new Date(expiryDate));
      }

      await state.db.collection('system_announcements').add(announcementData);

      console.log('✅ Announcement published successfully');
      showNotification('ההודעה פורסמה בהצלחה!', 'success');

      // Reset form
      resetForm();

      // Reload list
      loadAnnouncements();

    } catch (error) {
      console.error('❌ Error publishing announcement:', error);
      showNotification('שגיאה בפרסום ההודעה', 'error');
    } finally {
      publishBtn.disabled = false;
      publishBtn.innerHTML = '<i class="fas fa-paper-plane"></i> פרסם הודעה';
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // LOAD ANNOUNCEMENTS
  // ═══════════════════════════════════════════════════════════════

  async function loadAnnouncements() {
    try {
      const snapshot = await state.db.collection('system_announcements')
        .where('isActive', '==', true)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      state.announcements = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      renderAnnouncementsList();

    } catch (error) {
      console.error('❌ Error loading announcements:', error);
      const listContainer = document.getElementById('announcementsList');
      if (listContainer) {
        listContainer.innerHTML = `
          <div class="error-state">
            <i class="fas fa-exclamation-triangle"></i>
            <p>שגיאה בטעינת הודעות</p>
          </div>
        `;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDER ANNOUNCEMENTS LIST
  // ═══════════════════════════════════════════════════════════════

  function renderAnnouncementsList() {
    const listContainer = document.getElementById('announcementsList');
    if (!listContainer) return;

    if (state.announcements.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-inbox"></i>
          <p>אין הודעות פעילות כרגע</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = state.announcements.map(announcement => {
      const level = SEVERITY_LEVELS[announcement.severity] || SEVERITY_LEVELS.info;
      const dismissedCount = announcement.dismissedBy?.length || 0;
      const createdAt = announcement.createdAt?.toDate ? announcement.createdAt.toDate().toLocaleString('he-IL') : 'לא ידוע';
      const expiresAt = announcement.expiresAt?.toDate ? announcement.expiresAt.toDate().toLocaleString('he-IL') : 'ללא תפוגה';

      return `
        <div class="announcement-card ${announcement.severity}">
          <div class="announcement-card-header">
            <div class="severity-badge" style="background: ${level.color}">
              <i class="fas ${level.icon}"></i>
              ${level.label}
            </div>
            <button class="btn-deactivate" onclick="SystemAnnouncementManager.deactivateAnnouncement('${announcement.id}')">
              <i class="fas fa-times"></i>
              השבת
            </button>
          </div>
          <div class="announcement-card-body">
            <p class="announcement-text">${announcement.message}</p>
          </div>
          <div class="announcement-card-footer">
            <div class="announcement-meta">
              <span>
                <i class="fas fa-clock"></i>
                ${createdAt}
              </span>
              <span>
                <i class="fas fa-calendar-times"></i>
                ${expiresAt}
              </span>
            </div>
            <div class="announcement-stats">
              <i class="fas fa-check-circle"></i>
              ${dismissedCount} משתמשים הבינו
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ═══════════════════════════════════════════════════════════════
  // DEACTIVATE ANNOUNCEMENT
  // ═══════════════════════════════════════════════════════════════

  async function deactivateAnnouncement(announcementId) {
    const confirmed = confirm('האם אתה בטוח שברצונך להשבית הודעה זו?');
    if (!confirmed) return;

    try {
      await state.db.collection('system_announcements')
        .doc(announcementId)
        .update({
          isActive: false,
          deactivatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          deactivatedBy: state.currentUser.email
        });

      console.log('✅ Announcement deactivated');
      showNotification('ההודעה הושבתה בהצלחה', 'success');

      // Reload list
      loadAnnouncements();

    } catch (error) {
      console.error('❌ Error deactivating announcement:', error);
      showNotification('שגיאה בהשבתת ההודעה', 'error');
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // RESET FORM
  // ═══════════════════════════════════════════════════════════════

  function resetForm() {
    document.getElementById('createAnnouncementForm').reset();
    document.getElementById('charCount').textContent = '0';

    // Reset severity to info
    document.querySelectorAll('.severity-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.severity-btn[data-severity="info"]')?.classList.add('active');
  }

  // ═══════════════════════════════════════════════════════════════
  // NOTIFICATION HELPER
  // ═══════════════════════════════════════════════════════════════

  function showNotification(message, type = 'info') {
    if (window.Notifications) {
      window.Notifications.show(message, type);
    } else {
      alert(message);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // INJECT STYLES
  // ═══════════════════════════════════════════════════════════════

  function injectStyles() {
    if (document.getElementById('announcementManagerStyles')) return;

    const style = document.createElement('style');
    style.id = 'announcementManagerStyles';
    style.textContent = `
      .announcement-manager {
        padding: 24px;
        max-width: 1200px;
        margin: 0 auto;
      }

      .manager-header {
        margin-bottom: 32px;
      }

      .manager-header h2 {
        font-size: 24px;
        font-weight: 600;
        color: var(--gray-900);
        margin: 0 0 8px 0;
      }

      .manager-subtitle {
        color: var(--gray-600);
        margin: 0;
      }

      .section-title {
        font-size: 18px;
        font-weight: 600;
        color: var(--gray-800);
        margin: 0 0 16px 0;
      }

      .create-announcement-section {
        background: white;
        border-radius: var(--radius-lg);
        padding: 24px;
        margin-bottom: 32px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }

      .severity-buttons {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin-top: 8px;
      }

      .severity-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 16px;
        border: 2px solid var(--gray-200);
        border-radius: var(--radius-md);
        background: white;
        cursor: pointer;
        transition: all var(--transition-fast);
      }

      .severity-btn:hover {
        border-color: var(--severity-color);
        background: color-mix(in srgb, var(--severity-color) 5%, white);
      }

      .severity-btn.active {
        border-color: var(--severity-color);
        background: color-mix(in srgb, var(--severity-color) 10%, white);
      }

      .severity-label {
        font-weight: 600;
        color: var(--gray-900);
      }

      .severity-desc {
        font-size: 12px;
        color: var(--gray-600);
      }

      .form-textarea {
        width: 100%;
        padding: 12px;
        border: 1px solid var(--gray-300);
        border-radius: var(--radius-sm);
        font-size: 14px;
        resize: vertical;
      }

      .char-counter {
        text-align: left;
        font-size: 12px;
        color: var(--gray-500);
        margin-top: 4px;
      }

      .announcement-card {
        background: white;
        border-radius: var(--radius-md);
        padding: 20px;
        margin-bottom: 16px;
        border-right: 4px solid var(--gray-300);
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }

      .announcement-card.info { border-right-color: var(--blue); }
      .announcement-card.warning { border-right-color: var(--orange); }
      .announcement-card.critical { border-right-color: var(--red); }

      .announcement-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }

      .severity-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        border-radius: 999px;
        color: white;
        font-size: 12px;
        font-weight: 600;
      }

      .btn-deactivate {
        padding: 6px 12px;
        border: 1px solid var(--gray-300);
        border-radius: var(--radius-sm);
        background: white;
        color: var(--gray-700);
        font-size: 12px;
        cursor: pointer;
      }

      .btn-deactivate:hover {
        background: var(--gray-100);
      }

      .announcement-text {
        margin: 0;
        color: var(--gray-800);
        line-height: 1.5;
      }

      .announcement-card-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid var(--gray-200);
        font-size: 12px;
        color: var(--gray-600);
      }

      .announcement-meta {
        display: flex;
        gap: 16px;
      }

      .empty-state, .loading-state, .error-state {
        text-align: center;
        padding: 40px 20px;
        color: var(--gray-500);
      }

      .empty-state i, .loading-state i, .error-state i {
        font-size: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
      }
    `;

    document.head.appendChild(style);
  }

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════

  return {
    init,
    deactivateAnnouncement
  };

})();
