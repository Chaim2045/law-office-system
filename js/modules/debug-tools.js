/**
 * Debug Tools Module
 * Provides debugging and diagnostic utilities for client hours tracking
 *
 * Created: 2025
 * Part of Law Office Management System
 */

import { calculateClientHoursAccurate, updateClientHoursImmediately } from './client-hours.js';

/**
 * Full client hours mismatch diagnostic
 */
async function debugClientHoursMismatch() {

  try {
    const db = window.firebaseDB;
    if (!db) {
      console.error("❌ Firebase לא מחובר");
      return;
    }

    // Check local system data

    if (window.manager && window.manager.clients) {

      window.manager.clients.forEach((client, index) => {
      });
    } else {
    }

    // Check Firebase data

    const clientsSnapshot = await db.collection("clients").get();

    const firebaseClients = [];
    clientsSnapshot.forEach((doc, index) => {
      const data = doc.data();
      firebaseClients.push({ id: doc.id, ...data });

    });

    // Recalculate from entries for each client

    for (const client of firebaseClients) {
      if (client.type === "hours") {

        const timesheetSnapshot = await db
          .collection("timesheet_entries")
          .where("clientName", "==", client.fullName)
          .get();


        let totalMinutesUsed = 0;
        const entriesByEmployee = {};
        const entriesDetails = [];

        timesheetSnapshot.forEach((doc) => {
          const entry = doc.data();
          const minutes = entry.minutes || 0;
          const employee = entry.employee || entry.lawyer || "לא ידוע";

          totalMinutesUsed += minutes;

          if (!entriesByEmployee[employee]) {
            entriesByEmployee[employee] = 0;
          }
          entriesByEmployee[employee] += minutes;

          entriesDetails.push({
            date: entry.date,
            employee: employee,
            minutes: minutes,
            action: entry.action,
          });
        });

        // Show entry details
        entriesDetails.forEach((entry, i) => {
        });

        Object.entries(entriesByEmployee).forEach(([employee, minutes]) => {
        });

        // Calculate remaining hours
        const totalMinutesAllocated = (client.totalHours || 0) * 60;
        const remainingMinutes = totalMinutesAllocated - totalMinutesUsed;
        const remainingHours = remainingMinutes / 60;


        // Compare to saved data

        const localClient = window.manager?.clients?.find(
          (c) => c.fullName === client.fullName
        );
        if (localClient) {
        }
      }
    }
  } catch (error) {
    console.error("❌ שגיאה באבחון:", error);
  }
}

/**
 * Fix client hours mismatch
 */
async function fixClientHoursMismatch() {

  try {
    const db = window.firebaseDB;
    if (!db) {
      console.error("❌ Firebase לא מחובר");
      return;
    }

    const clientsSnapshot = await db.collection("clients").get();

    for (const clientDoc of clientsSnapshot.docs) {
      const clientData = clientDoc.data();

      if (clientData.type === "hours") {

        const hoursData = await calculateClientHoursAccurate(
          clientData.fullName
        );

        await clientDoc.ref.update({
          hoursRemaining: hoursData.remainingHours,
          minutesRemaining: hoursData.remainingMinutes,
          isBlocked: hoursData.isBlocked,
          isCritical: hoursData.isCritical,
          lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
          fixedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });


        // Update local system
        if (window.manager && window.manager.clients) {
          const localIndex = window.manager.clients.findIndex(
            (c) => c.fullName === clientData.fullName
          );
          if (localIndex !== -1) {
            window.manager.clients[localIndex].hoursRemaining =
              hoursData.remainingHours;
            window.manager.clients[localIndex].minutesRemaining =
              hoursData.remainingMinutes;
            window.manager.clients[localIndex].isBlocked = hoursData.isBlocked;
            window.manager.clients[localIndex].isCritical =
              hoursData.isCritical;
          }
        }
      }
    }

    // Update selectors
    if (window.manager && window.manager.clientValidation) {
      window.manager.clientValidation.updateBlockedClients();
    }

  } catch (error) {
    console.error("❌ שגיאה בתיקון:", error);
  }
}

/**
 * Show client status summary
 */
function showClientStatusSummary() {

  if (!window.manager || !window.manager.clients) {
    return;
  }

  const summary = {
    total: window.manager.clients.length,
    blocked: 0,
    critical: 0,
    normal: 0,
    fixed: 0,
  };


  window.manager.clients.forEach((client, i) => {
    let status = "🟢 תקין";

    if (client.type === "fixed") {
      status = "📋 פיקס";
      summary.fixed++;
    } else if (client.isBlocked) {
      status = "🚨 חסום";
      summary.blocked++;
    } else if (client.isCritical) {
      status = "⚠️ קריטי";
      summary.critical++;
    } else {
      summary.normal++;
    }

  });

}

// Expose to window for console debugging
if (typeof window !== 'undefined') {
  window.debugClientHoursMismatch = debugClientHoursMismatch;
  window.fixClientHoursMismatch = fixClientHoursMismatch;
  window.showClientStatusSummary = showClientStatusSummary;
  window.calculateClientHoursAccurate = calculateClientHoursAccurate;
  window.updateClientHoursImmediately = updateClientHoursImmediately;
}

// Exports
export {
  debugClientHoursMismatch,
  fixClientHoursMismatch,
  showClientStatusSummary
};
