/**
 * Debug Tools Module
 * Read-only diagnostic utilities for client hours tracking
 *
 * Created: 2025
 * Refactored: 2026-05-13 — removed write paths (fixClientHoursMismatch) that
 * bypassed canonical calcClientAggregates and wrote isBlocked without checking
 * overrideActive/overdraftResolved. See .refactor-backups/debug-tools.js.
 *
 * Part of Law Office Management System
 */

import { calculateClientHoursAccurate } from './client-hours.js';

/**
 * Full client hours mismatch diagnostic (READ-ONLY)
 */
async function debugClientHoursMismatch() {

  try {
    const db = window.firebaseDB;
    if (!db) {
      console.error('❌ Firebase לא מחובר');
      return;
    }

    // Check local system data

    if (window.manager && window.manager.clients) {

      window.manager.clients.forEach((client, index) => {
      });
    } else {
    }

    // Check Firebase clients
    const clientsSnapshot = await db.collection('clients').get();
    const firebaseClients = [];

    clientsSnapshot.forEach((doc, index) => {
      const data = doc.data();
      firebaseClients.push({
        id: doc.id,
        ...data
      });
    });

    // Check timesheet entries
    for (const client of firebaseClients) {
      if (client.type === 'hours') {

        const timesheetSnapshot = await db
          .collection('timesheet_entries')
          .where('clientName', '==', client.fullName)
          .get();

        let totalMinutes = 0;
        const employeeBreakdown = {};
        const entries = [];

        timesheetSnapshot.forEach((doc, i) => {
          const entry = doc.data();
          const minutes = entry.minutes || 0;
          const employee = entry.employee || entry.lawyer || 'לא ידוע';

          totalMinutes += minutes;
          if (!employeeBreakdown[employee]) {
employeeBreakdown[employee] = 0;
}

          employeeBreakdown[employee] += minutes;

          entries.push({
            date: entry.date,
            employee: employee,
            minutes: minutes,
            action: entry.action
          });
        });

        entries.forEach((entry, i) => {
        });

        Object.entries(employeeBreakdown).forEach(([emp, mins]) => {
        });

        const calculatedRemaining =
          ((client.totalHours || 0) * 60 - totalMinutes) / 60;
        const dbClient = window.manager?.clients?.find(
          (c) => c.fullName === client.fullName
        );

      }
    }
  } catch (error) {
    console.error('❌ שגיאה באבחון:', error);
  }
}

// REMOVED 2026-05-13: fixClientHoursMismatch
//
// Reason: This function wrote isBlocked/isCritical directly to Firestore for
// every client, bypassing canonical calcClientAggregates. It only checked
// `type === 'hours'` (missed legal_procedure+hourly), ignored overrideActive,
// and was exposed to window — any admin with DevTools could mass-corrupt
// client.isBlocked. Suspected contributor to the 21-blocked-clients incident.
//
// Recovery: see .refactor-backups/debug-tools.js if needed.

/**
 * Show client status summary (READ-ONLY)
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
    fixed: 0
  };


  window.manager.clients.forEach((client, i) => {
    let status = '🟢 תקין';

    if (client.type === 'fixed') {
      status = '📋 פיקס';
      summary.fixed++;
    } else if (client.isBlocked) {
      status = '🚨 חסום';
      summary.blocked++;
    } else if (client.isCritical) {
      status = '⚠️ קריטי';
      summary.critical++;
    } else {
      summary.normal++;
    }

  });

}

// Expose to window for console debugging (READ-ONLY functions only)
if (typeof window !== 'undefined') {
  window.debugClientHoursMismatch = debugClientHoursMismatch;
  window.showClientStatusSummary = showClientStatusSummary;
  window.calculateClientHoursAccurate = calculateClientHoursAccurate;
  // REMOVED 2026-05-13: window.fixClientHoursMismatch + window.updateClientHoursImmediately
  // (dangerous write paths that bypassed canonical isBlocked logic).
}

// Exports
export {
  debugClientHoursMismatch,
  showClientStatusSummary
};
