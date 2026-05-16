/**
 * Client Hours Management Module
 * Handles client hours calculation, validation, and tracking
 *
 * Created: 2025
 * Part of Law Office Management System
 */

/* === Client Hours Calculation === */

/**
 * Calculate accurate client hours from all timesheet entries
 */
async function calculateClientHoursAccurate(clientName) {
  try {
    const db = window.firebaseDB;
    if (!db) {
throw new Error('Firebase לא מחובר');
}


    // Get client data
    const clientsSnapshot = await db
      .collection('clients')
      .where('fullName', '==', clientName)
      .get();

    if (clientsSnapshot.empty) {
      throw new Error('לקוח לא נמצא');
    }

    const client = clientsSnapshot.docs[0].data();

    // Get all timesheet entries for this client (from ALL users)
    const timesheetSnapshot = await db
      .collection('timesheet_entries')
      .where('clientName', '==', clientName)
      .get();

    let totalMinutesUsed = 0;
    const entriesByLawyer = {};

    timesheetSnapshot.forEach((doc) => {
      const entry = doc.data();
      const minutes = entry.minutes || 0;
      const lawyer = entry.employee || entry.lawyer || 'לא ידוע';

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
    let status = 'פעיל';
    let isBlocked = false;
    let isCritical = false;

    if (client.type === 'hours') {
      if (remainingMinutes <= 0) {
        status = 'חסום - נגמרו השעות';
        isBlocked = true;
      } else if (remainingHours <= 5) {
        status = 'קריטי - מעט שעות';
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
      lastCalculated: new Date()
    };


    return result;
  } catch (error) {
    console.error('שגיאה בחישוב שעות:', error);
    throw error;
  }
}

// REMOVED 2026-05-13: updateClientHoursImmediately
//
// Reason: This function was a parallel write path for client.isBlocked that
// did not use the canonical calcClientAggregates from functions/shared/aggregates.js.
// It only checked `type === 'hours'` (missed legal_procedure+hourly), ignored
// overrideActive and overdraftResolved, and wrote isBlocked directly to Firestore
// based on a separate computation path (calculateClientHoursAccurate).
//
// Verified zero production callers (only window-exposed, no code invocations).
// Removed to ensure single source of truth for client.isBlocked.
//
// Recovery: see .refactor-backups/client-hours.js if needed.

/**
 * Client validation helper
 */
class ClientValidation {
  constructor(manager) {
    this.manager = manager;
    this.blockedClients = new Set();
    this.criticalClients = new Set();
    this.blockedClientsData = []; // נתונים מלאים של לקוחות חסומים
    this.criticalClientsData = []; // נתונים מלאים של לקוחות קריטיים
  }

  updateBlockedClients() {
    this.blockedClients.clear();
    this.criticalClients.clear();
    this.blockedClientsData = [];
    this.criticalClientsData = [];

    if (!this.manager.clients || !Array.isArray(this.manager.clients)) {
      return;
    }

    for (const client of this.manager.clients) {
      if (!client) {
continue;
}

      // PR-A.4 (2026-05-16): block on EITHER derived isBlocked OR manual isOnHold.
      // isOnHold = admin freeze (unpaid, dispute) — orthogonal to hour balance.
      if (client.isBlocked || client.isOnHold) {
        this.blockedClients.add(client.fullName);
        this.blockedClientsData.push({
          name: client.fullName,
          hoursRemaining: window.calculateRemainingHours(client),
          reason: client.isOnHold ? 'manual_hold' : 'no_hours'
        });
      } else if (
        client.type === 'hours' &&
        typeof client.hoursRemaining === 'number'
      ) {
        const hours = window.calculateRemainingHours(client);
        if (hours <= 5 && hours > 0) {
          this.criticalClients.add(client.fullName);
          this.criticalClientsData.push({
            name: client.fullName,
            hoursRemaining: hours
          });
        }
      }
    }

    this.updateNotificationBell();
  }

  updateNotificationBell() {
    const now = new Date();
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const urgentTasks = (this.manager.budgetTasks || []).filter(
      (task) =>
        task &&
        task.status === 'פעיל' &&
        task.deadline &&
        task.description &&
        new Date(task.deadline) <= oneDayFromNow
    );

    notificationBell.updateFromSystem(
      this.blockedClientsData,  // שולח נתונים מלאים במקום Set
      this.criticalClientsData, // שולח נתונים מלאים במקום Set
      urgentTasks
    );
  }

  validateClientSelection(clientName, action = 'רישום') {
    if (this.blockedClients.has(clientName)) {
      this.showBlockedClientDialog(clientName, action);
      return false;
    }
    return true;
  }

  showBlockedClientDialog(clientName, action) {
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';

    const clientNameDiv = document.createElement('div');
    clientNameDiv.className = 'client-name';
    clientNameDiv.textContent = clientName;

    const actionBlockedDiv = document.createElement('div');
    actionBlockedDiv.className = 'action-blocked';
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

    // ✅ תיקון: הסרת class .hidden כדי שהפופאפ יופיע
    requestAnimationFrame(() => overlay.classList.add('show'));

    setTimeout(() => {
      if (document.body.contains(overlay)) {
        overlay.remove();
      }
    }, 10000);
  }
}

// Exports
export {
  calculateClientHoursAccurate,
  ClientValidation
};
