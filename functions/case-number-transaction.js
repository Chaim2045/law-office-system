/**
 * Case Number Generation with Firestore Transaction
 * מודול לייצור מספרי תיק עם Transaction אטומית
 *
 * @module case-number-transaction
 * @version 1.0.0
 */

const admin = require('firebase-admin');
const functions = require('firebase-functions');

// ✅ Get Firestore reference (will be initialized by index.js)
// DON'T initialize here - index.js does it
let db;

/**
 * 🎯 יצירת מספר תיק אוטומטי עם Firestore Transaction (ATOMIC)
 * מבטיח ייחודיות מוחלטת - אפס race conditions
 *
 * שימוש ב-Firestore Transaction מבטיח שאם 2+ משתמשים יוצרים תיק באותה שנייה,
 * כל אחד יקבל מספר ייחודי משלו.
 *
 * @param {number} maxRetries - מספר ניסיונות מקסימלי (ברירת מחדל: 5)
 * @returns {Promise<string>} - מספר תיק חדש וייחודי
 */
async function generateCaseNumberWithTransaction(maxRetries = 5) {
  // Lazy init db reference
  if (!db) {
    db = admin.firestore();
  }

  const counterRef = db.collection('_system').doc('caseNumberCounter');
  const currentYear = new Date().getFullYear().toString();

  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;

    try {
      return await db.runTransaction(async (transaction) => {
        const counterDoc = await transaction.get(counterRef);

        let nextNumber = 1;

        if (counterDoc.exists) {
          const data = counterDoc.data();

          // אם זו אותה שנה, נמשיך את הספירה
          if (data.year === currentYear) {
            nextNumber = data.lastNumber + 1;

            // 🚨 ALERT: Counter approaching limit
            if (nextNumber > 950) {
              console.error(`🚨 CRITICAL: Case number approaching limit! Current: ${nextNumber}/999`);
              // TODO: שלח התראה לאדמין
            }

            // 🚨 CRITICAL: Counter exceeded limit!
            if (nextNumber > 999) {
              throw new Error(
                `Case number counter exceeded maximum (999) for year ${currentYear}. ` +
                `Please contact system administrator.`
              );
            }
          }
          // אחרת (שנה חדשה), נתחיל מ-1
        }

        const caseNumber = `${currentYear}${nextNumber.toString().padStart(3, '0')}`;

        // ✅ עדכון אטומי של המונה - מובטח שאף אחד אחר לא יקבל את אותו מספר!
        transaction.set(counterRef, {
          year: currentYear,
          lastNumber: nextNumber,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          _stats: {
            totalTransactions: (counterDoc.data()?._stats?.totalTransactions || 0) + 1,
            lastAttemptCount: attempt,
            lastCaseNumber: caseNumber
          }
        }, { merge: true });

        console.log(`✅ [Transaction ${attempt}/${maxRetries}] Generated case number: ${caseNumber}`);
        return caseNumber;
      });

    } catch (error) {
      // Firestore transaction aborted - תנאי race - ננסה שוב
      if (error.code === 10 && attempt < maxRetries) { // code 10 = ABORTED
        console.warn(`⚠️ Transaction aborted (race condition), retry ${attempt}/${maxRetries}...`);

        // Exponential backoff
        await new Promise(resolve =>
          setTimeout(resolve, Math.pow(2, attempt) * 100)
        );

        continue; // נסיון נוסף
      }

      // 🚨 CRITICAL: Transaction failed multiple times or non-recoverable error
      console.error(`🚨 CRITICAL: Transaction failed after ${attempt} attempts!`, error);

      // אם זו שגיאה קריטית (לא race condition), זרוק מיד
      throw new functions.https.HttpsError(
        'internal',
        `Failed to generate case number: ${error.message}`
      );
    }
  }

  // אם הגענו לכאן, כל הניסיונות נכשלו
  throw new functions.https.HttpsError(
    'resource-exhausted',
    `Failed to generate case number after ${maxRetries} attempts. Please try again.`
  );
}

module.exports = {
  generateCaseNumberWithTransaction
};
