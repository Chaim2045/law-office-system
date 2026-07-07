/** Timesheet Helpers — כלי עזר פנימיים לדיווח שעות */

const admin = require('firebase-admin');
const db = admin.firestore();

// ===============================
// Enterprise Infrastructure - דיוק מוחלט
// ===============================

/**
 * ✅ ENTERPRISE: Version Control & Optimistic Locking
 * מונע Lost Updates - כאשר שני משתמשים עורכים אותו מסמך בו-זמנית
 *
 * @param {DocumentReference} docRef - רפרנס למסמך
 * @param {number} expectedVersion - גרסה צפויה
 * @returns {Promise<Object>} - המסמך והגרסה הנוכחית
 * @throws {Error} - אם הגרסה לא תואמת (conflict detected)
 */
async function checkVersionAndLock(docRef, expectedVersion) {
  const doc = await docRef.get();

  if (!doc.exists) {
    throw new Error('מסמך לא נמצא');
  }

  const data = doc.data();
  const currentVersion = data._version || 0;

  // ✅ בדיקת התנגשות
  if (expectedVersion !== undefined && currentVersion !== expectedVersion) {
    throw new Error(
      `CONFLICT: המסמך שונה על ידי משתמש אחר. ` +
      `גרסה צפויה: ${expectedVersion}, גרסה נוכחית: ${currentVersion}. ` +
      `אנא רענן את המסמך ונסה שוב.`
    );
  }

  return {
    data,
    currentVersion,
    nextVersion: currentVersion + 1
  };
}

/**
 * ✅ ENTERPRISE: Event Sourcing - רישום אירוע במערכת
 * כל שינוי במערכת נרשם כאירוע append-only (אף פעם לא נמחק)
 * זה מאפשר:
 * 1. Audit Trail מלא
 * 2. שחזור מצב עבר
 * 3. ניתוח דפוסי שימוש
 * 4. בדיקת עקביות נתונים
 *
 * @param {Object} eventData - נתוני האירוע
 * @returns {Promise<string>} - Event ID
 */
async function createTimeEvent(eventData) {
  const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const event = {
    eventId,
    eventType: eventData.eventType, // TIME_ADDED, TIME_UPDATED, PACKAGE_DEPLETED
    timestamp: admin.firestore.FieldValue.serverTimestamp(),

    // מזהי ישויות
    caseId: eventData.caseId,
    serviceId: eventData.serviceId || null,
    stageId: eventData.stageId || null,
    packageId: eventData.packageId || null,
    taskId: eventData.taskId || null,
    timesheetEntryId: eventData.timesheetEntryId || null,

    // נתוני האירוע
    data: eventData.data || {},

    // מי ביצע
    performedBy: eventData.performedBy,
    performedByEmail: eventData.performedByEmail,

    // מצב לפני ואחרי
    before: eventData.before || {},
    after: eventData.after || {},

    // מניעת כפילויות
    idempotencyKey: eventData.idempotencyKey || null,

    // מטא-דאטה
    userAgent: eventData.userAgent || null,
    ipAddress: eventData.ipAddress || null,

    // סטטוס
    processed: true,
    processingErrors: eventData.errors || []
  };

  await db.collection('time_events').doc(eventId).set(event);

  console.log(`📝 [EVENT] ${eventData.eventType} - ${eventId}`);

  return eventId;
}

/**
 * PR-2 (idempotency SSOT): the non-atomic checkIdempotency()/registerIdempotency()
 * pair that used to live here was RETIRED. It read processed_operations BEFORE
 * the write-path's transaction and wrote the record AFTER the transaction
 * committed — a lost-ack retry on a weak network could slip between the two
 * calls and re-run the write (a duplicate timesheet entry / duplicate hours).
 *
 * Both callers (createTimesheetEntry_v2, createQuickLogEntry in ./index.js)
 * now use the ATOMIC, transaction-scoped primitive in
 * functions/shared/idempotency.js — the same one functions/addTimeToTask_v2.js
 * uses (PR-1) — which reads the processed_operations doc as part of the
 * transaction's Phase-1 reads and writes it via `transaction.create()` in
 * Phase-3, inside the SAME transaction as the actual mutation.
 */

/**
 * ✅ ENTERPRISE: Two-Phase Commit - Phase 1 (Reserve)
 * יצירת הזמנה לפני ביצוע הפעולה בפועל
 *
 * @param {Object} reservationData - נתוני ההזמנה
 * @returns {Promise<string>} - Reservation ID
 */
async function createReservation(reservationData) {
  const reservationId = `rsv_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const reservation = {
    reservationId,
    status: 'pending', // pending → committed / rolled_back

    // נתוני הפעולה
    caseId: reservationData.caseId,
    minutes: reservationData.minutes,
    performedBy: reservationData.performedBy,

    // פעולות מתוכננות
    operations: reservationData.operations || [],

    // זמנים
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + 5 * 60 * 1000) // תפוגה אחרי 5 דקות
    )
  };

  await db.collection('reservations').doc(reservationId).set(reservation);

  console.log(`📌 [RESERVATION] נוצרה הזמנה: ${reservationId}`);

  return reservationId;
}

/**
 * ✅ ENTERPRISE: Two-Phase Commit - Phase 2 (Commit)
 * סימון ההזמנה כהושלמה
 */
async function commitReservation(reservationId) {
  await db.collection('reservations').doc(reservationId).update({
    status: 'committed',
    committedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log(`✅ [RESERVATION] הושלמה: ${reservationId}`);
}

/**
 * ✅ ENTERPRISE: Two-Phase Commit - Rollback
 * סימון ההזמנה כבוטלה
 */
async function rollbackReservation(reservationId, error) {
  await db.collection('reservations').doc(reservationId).update({
    status: 'rolled_back',
    rolledBackAt: admin.firestore.FieldValue.serverTimestamp(),
    error: error.message || 'Unknown error'
  });

  console.log(`❌ [RESERVATION] בוטלה: ${reservationId}`);
}

module.exports = {
  checkVersionAndLock,
  createTimeEvent,
  createReservation,
  commitReservation,
  rollbackReservation
};
