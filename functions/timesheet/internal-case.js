/** Internal Case — יצירת/שליפת תיק פנימי */

const admin = require('firebase-admin');
const db = admin.firestore();

/**
 * יצירה או קבלת תיק פנימי לעובד (Lazy Creation)
 * נוצר אוטומטית בפעם הראשונה שהעובד רושם פעילות פנימית
 *
 * @param {string} employeeName - שם העובד (למשל: "חיים")
 * @returns {Promise<Object>} - אובייקט התיק הפנימי
 */
async function getOrCreateInternalCase(employeeName) {
  const caseId = `internal_${employeeName.toLowerCase().replace(/\s+/g, '_')}`;
  const internalClientId = 'internal_office';

  // 1. בדיקה אם התיק כבר קיים
  // ✅ במבנה החדש Client=Case: clients collection
  const caseRef = db.collection('clients').doc(caseId);
  const caseDoc = await caseRef.get();

  if (caseDoc.exists) {
    console.log(`✅ תיק פנימי קיים: ${caseId}`);
    return {
      id: caseDoc.id,
      ...caseDoc.data()
    };
  }

  console.log(`🆕 יוצר תיק פנימי חדש: ${caseId}`);

  // 2. ודא שהלקוח המשרדי קיים
  const clientRef = db.collection('clients').doc(internalClientId);
  const clientDoc = await clientRef.get();

  if (!clientDoc.exists) {
    // יצירת לקוח משרדי (פעם אחת בלבד)
    await clientRef.set({
      id: internalClientId,
      clientName: 'משרד - פעילות פנימית',
      clientType: 'internal',
      isSystemClient: true,
      idNumber: 'SYSTEM-INTERNAL',
      idType: 'system',
      phone: '-',
      email: 'office@internal.system',
      address: 'פנימי',
      totalCases: 0,
      activeCases: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: 'system',
      lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastModifiedBy: 'system'
    });

    console.log(`✅ לקוח משרדי נוצר: ${internalClientId}`);
  }

  // 3. יצירת התיק הפנימי
  const newCase = {
    id: caseId,
    clientId: internalClientId,
    clientName: 'משרד - פעילות פנימית',
    caseNumber: `INTERNAL-${employeeName.toUpperCase()}`,
    caseTitle: `${employeeName} - משימות משרדיות`,
    procedureType: 'internal',
    totalHours: null,
    hoursRemaining: null,
    minutesRemaining: null,
    hourlyRate: null,
    assignedTo: [employeeName],
    mainAttorney: employeeName,
    status: 'active',
    priority: 'low',
    isSystemCase: true,
    isInternal: true,
    isDeletable: false,
    isEditable: false,
    isHiddenFromReports: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'system',
    createdReason: 'auto_internal_case',
    lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastModifiedBy: 'system'
  };

  await caseRef.set(newCase);

  // 4. עדכון מונה התיקים בלקוח המשרדי
  await clientRef.update({
    totalCases: admin.firestore.FieldValue.increment(1),
    activeCases: admin.firestore.FieldValue.increment(1),
    lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log(`✅ תיק פנימי נוצר בהצלחה: ${caseId}`);

  return newCase;
}

module.exports = {
  getOrCreateInternalCase
};
