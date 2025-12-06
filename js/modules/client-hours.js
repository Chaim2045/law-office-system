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

/**
 * Update client hours immediately in Firebase
 */
async function updateClientHoursImmediately(clientName, minutesUsed) {
  try {
    const db = window.firebaseDB;
    if (!db) {
throw new Error('Firebase לא מחובר');
}


    // Find the client
    const clientsSnapshot = await db
      .collection('clients')
      .where('fullName', '==', clientName)
      .get();

    if (clientsSnapshot.empty) {
      console.warn(`⚠️ לקוח ${clientName} לא נמצא - לא ניתן לעדכן שעות`);
      return { success: false, message: 'לקוח לא נמצא' };
    }

    const clientDoc = clientsSnapshot.docs[0];
    const clientData = clientDoc.data();

    // Only for hours-based clients
    if (clientData.type !== 'hours') {
      return { success: true, message: 'לקוח פיקס - לא נדרש עדכון' };
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
      isCritical: hoursData.isCritical
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
      isCritical: hoursData.isCritical
    };
  } catch (error) {
    console.error('❌ שגיאה בעדכון שעות לקוח:', error);
    throw new Error('שגיאה בעדכון שעות: ' + error.message);
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

      if (client.isBlocked) {
        this.blockedClients.add(client.fullName);
        this.blockedClientsData.push({
          name: client.fullName,
          hoursRemaining: window.calculateRemainingHours(client)
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
        task.status !== 'הושלם' &&
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
    setTimeout(() => overlay.classList.add('show'), 10);

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
  updateClientHoursImmediately,
  ClientValidation
};
