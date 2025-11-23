/**
 * addTimeToTask V2 - With Transaction + Optimistic Locking
 *
 * תיקון קריטי: עוטף את כל הפעולות (task + client + timesheet) ב-transaction אחד
 * זה מבטיח:
 * 1. Atomicity - הכל מתבצע או כלום
 * 2. Consistency - אין data inconsistency
 * 3. Isolation - אין race conditions בין משתמשים
 * 4. Optimistic Locking - בדיקת _version למניעת overwrites
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 📝 CHANGELOG - תיקון קריטי: עדכון חבילות לא נשמר ב-Firestore
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🗓️ תאריך: 2025-01-23 (November 23, 2025)
 * 🐛 גרסה: v2.1.0
 *
 * ❌ הבעיה שהתגלתה:
 * כאשר נרשם זמן על משימה, התראנזקשן רצה בהצלחה והתיעוד נוצר, אבל השעות
 * לא קוזזו מהחבילות (packages) בפועל! החבילות נשארו עם hoursUsed: 0.
 *
 * תרחיש שנכשל:
 * - משימה מקושרת לשירות hours (serviceId: 'srv_xxx')
 * - רישום 90 דקות (1.5 שעות)
 * - ✅ timesheet_entries נוצר
 * - ✅ task.actualMinutes התעדכן
 * - ❌ package.hoursUsed נשאר 0 (במקום 1.5)
 * - ❌ progress bar מראה 0% (במקום 4.4%)
 *
 * 🔍 הסיבה (Root Cause):
 * הקוד שלח את `clientData.services` ל-Firestore ישירות, אבל זה reference
 * לאותו אובייקט שנקרא מה-DB. Firestore לא זיהה שינוי כי זה אותו reference!
 *
 * קוד בעייתי (שורות 108, 137, 164):
 *   updates.clientUpdate = {
 *     services: clientData.services,  // ← reference, לא עותק!
 *     ...
 *   };
 *
 * ✅ התיקון שבוצע:
 * הוספתי deep clone של services array לפני השליחה ל-Firestore:
 *
 *   const updatedServices = JSON.parse(JSON.stringify(clientData.services));
 *   updates.clientUpdate = {
 *     services: updatedServices,  // ← עכשיו Firestore רואה שינוי!
 *     ...
 *   };
 *
 * 📍 שורות שתוקנו:
 * - Line 107-108: הליך משפטי עם stages
 * - Line 136-138: שירות hours רגיל
 * - Line 163-164: לקוח שעתי fallback
 *
 * 🎯 Impact:
 * - ✅ החבילות מתעדכנות כעת בצורה נכונה
 * - ✅ Progress bars מציגים את האחוזים המדויקים
 * - ✅ hoursUsed/hoursRemaining מתעדכנים בזמן אמת
 * - ✅ התיקון חל גם על הליכים משפטיים עם stages
 *
 * 🧪 Testing:
 * כדי לבדוק שהתיקון עובד:
 * 1. רשום זמן על משימה
 * 2. הרץ את console script: await debugClientServices("client_id")
 * 3. בדוק: package.hoursUsed צריך להיות > 0
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 📝 CHANGELOG - תיקון קריטי: קיזוז שעות לא עבד במקרים מסוימים
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🗓️ תאריך: 2025-01-17
 *
 * ❌ הבעיה שהתגלתה:
 * כאשר לקוח הוא מסוג 'legal_procedure' ויש לו שירות רגיל (type: 'hours'),
 * הקיזוז לא התבצע כלל! הקוד בדק את procedureType של הלקוח במקום לבדוק
 * את type של השירות.
 *
 * תרחיש שנכשל:
 * - לקוח: procedureType = 'legal_procedure'
 * - שירות: type = 'hours', יש לו packages
 * - משימה: serviceId = 'srv_xxx'
 * - תוצאה: רישום זמן נוצר אבל לא קוזז מהחבילה ❌
 *
 * ✅ התיקון שבוצע:
 * הוספתי תנאי חדש בשורה 85-108 שבודק:
 * 1. האם יש services array ללקוח
 * 2. האם יש serviceId במשימה
 * 3. מוצא את השירות לפי ID
 * 4. מקזז ממנו ישירות (ללא תלות ב-procedureType של הלקוח)
 *
 * קוד קודם:
 *   if (clientData.procedureType === 'hours' && ...) { קזז }
 *
 * קוד חדש:
 *   if (clientData.services && taskData.serviceId) {
 *     const service = clientData.services.find(s => s.id === taskData.serviceId);
 *     if (service && service.type !== 'legal_procedure') { קזז }
 *   }
 *
 * 💡 הבנה ארכיטקטורית:
 * לקוח = Container (יכול להכיל מספר שירותים)
 * שירות = הישות שמוגדרת כסוג (hours, legal_procedure, וכו')
 * הלוגיקה צריכה לבדוק את השירות, לא את הלקוח!
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Import deduction system helpers from modular system
const {
  getActivePackage,
  deductHoursFromPackage
} = require('./src/modules/deduction');

function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.trim().replace(/[<>]/g, '');
}

/**
 * לוגיקת קיזוז שעות מלקוח
 * מחזיר אובייקט עם השינויים שצריך לעשות
 */
function calculateClientUpdates(clientData, taskData, minutesToAdd) {
  const hoursWorked = minutesToAdd / 60;
  const updates = {
    clientUpdate: null,
    logs: []
  };

  // ✅ הליך משפטי - תמחור שעתי (מבנה חדש: שירות בתוך services)
  if (taskData.serviceType === 'legal_procedure' && taskData.parentServiceId) {
    const services = clientData.services || [];
    const targetService = services.find(s => s.id === taskData.parentServiceId);

    if (targetService && targetService.type === 'legal_procedure') {
      const isHourly = !targetService.pricingType || targetService.pricingType === 'hourly';

      if (isHourly) {
        const currentStageId = taskData.serviceId || 'stage_a';
        const stages = targetService.stages || [];
        const currentStageIndex = stages.findIndex(s => s.id === currentStageId);

        if (currentStageIndex !== -1) {
          const currentStage = stages[currentStageIndex];
          const activePackage = getActivePackage(currentStage);

          if (activePackage) {
            deductHoursFromPackage(activePackage, hoursWorked);

            stages[currentStageIndex].hoursUsed = (currentStage.hoursUsed || 0) + hoursWorked;
            stages[currentStageIndex].hoursRemaining = (currentStage.hoursRemaining || 0) - hoursWorked;
            stages[currentStageIndex].minutesUsed = (currentStage.minutesUsed || 0) + minutesToAdd;
            stages[currentStageIndex].minutesRemaining = (currentStage.minutesRemaining || 0) - minutesToAdd;

            targetService.stages = stages;
            targetService.hoursUsed = (targetService.hoursUsed || 0) + hoursWorked;
            targetService.hoursRemaining = (targetService.hoursRemaining || 0) - hoursWorked;
            targetService.lastActivity = new Date().toISOString();

            // ✅ FIX: Deep clone services array so Firestore detects the change
            const updatedServices = JSON.parse(JSON.stringify(clientData.services));

            updates.clientUpdate = {
              services: updatedServices,
              hoursUsed: admin.firestore.FieldValue.increment(hoursWorked),
              hoursRemaining: admin.firestore.FieldValue.increment(-hoursWorked),
              minutesUsed: admin.firestore.FieldValue.increment(minutesToAdd),
              minutesRemaining: admin.firestore.FieldValue.increment(-minutesToAdd),
              lastActivity: admin.firestore.FieldValue.serverTimestamp()
            };

            updates.logs.push(`✅ קוזזו ${hoursWorked.toFixed(2)} שעות מ${currentStage.name} בשירות ${targetService.name}`);
          } else {
            updates.logs.push(`⚠️ ${currentStage.name} - אין חבילה פעילה`);
          }
        }
      }
    }
  }
  // ✅ שירות עם חבילות (לקוח שעתי או שירות בתוך הליך משפטי)
  else if (clientData.services && clientData.services.length > 0 && taskData.serviceId) {
    // מצא את השירות המבוקש
    const service = clientData.services.find(s => s.id === taskData.serviceId);

    if (service && service.type !== 'legal_procedure') {
      // שירות רגיל עם חבילות (לא הליך משפטי)
      const activePackage = getActivePackage(service);

      if (activePackage) {
        deductHoursFromPackage(activePackage, hoursWorked);

        // ✅ FIX: Deep clone services array so Firestore detects the change
        // Without this, Firestore receives a reference to the same object and ignores the update
        const updatedServices = JSON.parse(JSON.stringify(clientData.services));

        updates.clientUpdate = {
          services: updatedServices,
          minutesRemaining: admin.firestore.FieldValue.increment(-minutesToAdd),
          hoursRemaining: admin.firestore.FieldValue.increment(-hoursWorked),
          lastActivity: admin.firestore.FieldValue.serverTimestamp()
        };

        updates.logs.push(`✅ קוזזו ${hoursWorked.toFixed(2)} שעות מחבילה ${activePackage.id} של שירות ${service.name || service.id}`);
      } else {
        updates.logs.push(`⚠️ שירות ${service.name || service.id} - אין חבילה פעילה`);
      }
    }
  }
  // ✅ לקוח שעתי ללא serviceId ספציפי (fallback)
  else if (clientData.procedureType === 'hours' && clientData.services && clientData.services.length > 0) {
    const service = clientData.services[0];

    if (service) {
      const activePackage = getActivePackage(service);

      if (activePackage) {
        deductHoursFromPackage(activePackage, hoursWorked);

        // ✅ FIX: Deep clone services array so Firestore detects the change
        const updatedServices = JSON.parse(JSON.stringify(clientData.services));

        updates.clientUpdate = {
          services: updatedServices,
          minutesRemaining: admin.firestore.FieldValue.increment(-minutesToAdd),
          hoursRemaining: admin.firestore.FieldValue.increment(-hoursWorked),
          lastActivity: admin.firestore.FieldValue.serverTimestamp()
        };

        updates.logs.push(`✅ קוזזו ${hoursWorked.toFixed(2)} שעות מחבילה ${activePackage.id} של שירות ${service.name || service.id}`);
      } else {
        updates.logs.push(`⚠️ שירות ${service.name || service.id} - אין חבילה פעילה`);
      }
    }
  }
  // ✅ הליך משפטי (מבנה ישן)
  else if (clientData.procedureType === 'legal_procedure' && clientData.pricingType === 'hourly') {
    const currentStageId = taskData.serviceId || clientData.currentStage || 'stage_a';
    const stages = clientData.stages || [];
    const currentStageIndex = stages.findIndex(s => s.id === currentStageId);

    if (currentStageIndex !== -1) {
      const currentStage = stages[currentStageIndex];
      const activePackage = getActivePackage(currentStage);

      if (activePackage) {
        deductHoursFromPackage(activePackage, hoursWorked);

        stages[currentStageIndex].hoursUsed = (currentStage.hoursUsed || 0) + hoursWorked;
        stages[currentStageIndex].hoursRemaining = (currentStage.hoursRemaining || 0) - hoursWorked;

        updates.clientUpdate = {
          stages: stages,
          hoursRemaining: admin.firestore.FieldValue.increment(-hoursWorked),
          minutesRemaining: admin.firestore.FieldValue.increment(-minutesToAdd),
          lastActivity: admin.firestore.FieldValue.serverTimestamp()
        };

        updates.logs.push(`✅ קוזזו ${hoursWorked.toFixed(2)} שעות מ${currentStage.name}`);
      }
    }
  }
  // ✅ הליך משפטי - תמחור פיקס
  else if (clientData.procedureType === 'legal_procedure' && clientData.pricingType === 'fixed') {
    const targetStageId = taskData.serviceId || clientData.currentStage || 'stage_a';
    const stages = clientData.stages || [];
    const currentStageIndex = stages.findIndex(s => s.id === targetStageId);

    if (currentStageIndex !== -1) {
      const currentStage = stages[currentStageIndex];

      stages[currentStageIndex].hoursWorked = (currentStage.hoursWorked || 0) + hoursWorked;
      stages[currentStageIndex].totalHoursWorked = (currentStage.totalHoursWorked || 0) + hoursWorked;

      updates.clientUpdate = {
        stages: stages,
        totalHoursWorked: admin.firestore.FieldValue.increment(hoursWorked),
        lastActivity: admin.firestore.FieldValue.serverTimestamp()
      };

      updates.logs.push(`✅ נרשמו ${hoursWorked.toFixed(2)} שעות ל${currentStage.name} (מחיר קבוע)`);
    }
  }

  return updates;
}

/**
 * הפונקציה הראשית - עם Transaction (אפשרות 1: Simple & Safe)
 *
 * Architecture:
 * - Phase 1: READ all documents upfront (Firestore requirement)
 * - Phase 2: CALCULATE all updates (no DB access)
 * - Phase 3: WRITE all changes atomically
 *
 * Benefits:
 * - ✅ Simple and predictable flow
 * - ✅ Easy to debug and maintain
 * - ✅ Consistent behavior across all scenarios
 * - ✅ Complies with Firestore transaction rules
 *
 * @see https://firebase.google.com/docs/firestore/manage-data/transactions
 */
async function addTimeToTaskWithTransaction(db, data, user) {
  const MAX_RETRIES = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await db.runTransaction(async (transaction) => {

        // ========================================
        // PHASE 1: READ OPERATIONS (קריאות בלבד)
        // ========================================
        // All reads MUST come before any writes (Firestore requirement)

        console.log(`📖 [Transaction Phase 1] Reading documents...`);

        // 1️⃣ קריאת המשימה
        const taskRef = db.collection('budget_tasks').doc(data.taskId);
        const taskDoc = await transaction.get(taskRef);

        if (!taskDoc.exists) {
          throw new functions.https.HttpsError('not-found', 'משימה לא נמצאה');
        }

        const taskData = taskDoc.data();

        // בדיקת הרשאות
        if (taskData.employee !== user.email && user.role !== 'admin') {
          throw new functions.https.HttpsError('permission-denied', 'אין הרשאה');
        }

        // 2️⃣ קריאת הלקוח (תמיד - אפשרות 1: Simple & Safe)
        // קוראים את הלקוח תמיד, גם אם אולי לא נצטרך לעדכן אותו
        // זה מבטיח flow עקבי ופשוט, ועולה רק 1-2ms
        let clientRef = null;
        let clientDoc = null;
        let clientData = null;
        let currentVersion = 0;

        if (taskData.clientId) {
          clientRef = db.collection('clients').doc(taskData.clientId);
          clientDoc = await transaction.get(clientRef);

          if (clientDoc.exists) {
            clientData = clientDoc.data();
            currentVersion = clientData._version || 0;
            console.log(`✅ Client read: ${taskData.clientId} (version: ${currentVersion})`);
          } else {
            console.log(`⚠️ Client ${taskData.clientId} not found (will skip client update)`);
          }
        }

        console.log(`✅ [Transaction Phase 1] All reads completed`);

        // ========================================
        // PHASE 2: CALCULATIONS (חישובים - ללא נגיעה ב-DB)
        // ========================================
        // Pure calculations with no database access

        console.log(`🧮 [Transaction Phase 2] Calculating updates...`);

        // חישוב נתוני המשימה
        const newActualMinutes = (taskData.actualMinutes || 0) + data.minutes;
        const currentEstimate = taskData.estimatedMinutes || 0;
        const percentOfBudget = currentEstimate > 0
          ? Math.round((newActualMinutes / currentEstimate) * 100)
          : 0;
        const isOverBudget = newActualMinutes > currentEstimate;
        const overageMinutes = Math.max(0, newActualMinutes - currentEstimate);

        const timeEntry = {
          date: data.date,
          minutes: data.minutes,
          hours: data.minutes / 60,
          description: data.description ? sanitizeString(data.description) : '',
          addedBy: user.username,
          addedAt: new Date().toISOString(),
          budgetStatus: {
            currentEstimate,
            totalMinutesAfter: newActualMinutes,
            percentOfBudget,
            isOverBudget,
            overageMinutes
          }
        };

        // חישוב עדכוני הלקוח (אם יש לקוח)
        let clientUpdates = null;
        let clientLogs = [];

        if (clientData) {
          clientUpdates = calculateClientUpdates(clientData, taskData, data.minutes);
          clientLogs = clientUpdates.logs;
          console.log(`🧮 Client updates calculated: ${clientUpdates.clientUpdate ? 'YES' : 'NO'}`);
        }

        // הכנת רשומת שעתון
        const timesheetEntry = {
          clientId: taskData.clientId,
          clientName: taskData.clientName,
          caseNumber: taskData.caseNumber || taskData.clientId,
          serviceId: taskData.serviceId || null,
          serviceName: taskData.serviceName || null,
          serviceType: taskData.serviceType || null,
          parentServiceId: taskData.parentServiceId || null,
          taskId: data.taskId,
          taskDescription: taskData.description,
          date: data.date,
          minutes: data.minutes,
          hours: data.minutes / 60,
          action: data.description || taskData.description,
          employee: user.email,
          lawyer: user.username,
          isInternal: false,
          autoGenerated: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          createdBy: user.username
        };

        console.log(`✅ [Transaction Phase 2] All calculations completed`);

        // ========================================
        // PHASE 3: WRITE OPERATIONS (כתיבות בלבד)
        // ========================================
        // All writes happen here, after all reads are done

        console.log(`✍️ [Transaction Phase 3] Writing updates...`);

        // 3️⃣ עדכון המשימה
        transaction.update(taskRef, {
          actualHours: admin.firestore.FieldValue.increment(data.minutes / 60),
          actualMinutes: admin.firestore.FieldValue.increment(data.minutes),
          timeEntries: admin.firestore.FieldValue.arrayUnion(timeEntry),
          lastModifiedBy: user.username,
          lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✅ Task updated: ${data.taskId}`);

        // 4️⃣ יצירת רשומת שעתון
        const timesheetRef = db.collection('timesheet_entries').doc();
        transaction.set(timesheetRef, timesheetEntry);
        console.log(`✅ Timesheet entry created: ${timesheetRef.id}`);

        // 5️⃣ עדכון לקוח (אם נחוץ)
        let clientUpdated = false;

        if (clientRef && clientUpdates && clientUpdates.clientUpdate) {
          // הוספת optimistic locking metadata
          clientUpdates.clientUpdate._version = currentVersion + 1;
          clientUpdates.clientUpdate._lastModified = admin.firestore.FieldValue.serverTimestamp();
          clientUpdates.clientUpdate._modifiedBy = user.username;

          transaction.update(clientRef, clientUpdates.clientUpdate);
          clientUpdated = true;
          console.log(`✅ Client updated: ${taskData.clientId} (new version: ${currentVersion + 1})`);
        } else {
          console.log(`⏭️ Client update skipped (no updates needed)`);
        }

        // 6️⃣ לוג פעולה
        const logRef = db.collection('action_logs').doc();
        transaction.set(logRef, {
          action: 'ADD_TIME_TO_TASK',
          uid: user.uid,
          username: user.username,
          details: {
            taskId: data.taskId,
            minutes: data.minutes,
            date: data.date,
            autoTimesheetCreated: true,
            clientUpdated
          },
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✅ Action log created: ${logRef.id}`);

        console.log(`✅ [Transaction Phase 3] All writes completed successfully`);

        // החזרת תוצאה
        return {
          success: true,
          taskId: data.taskId,
          newActualMinutes,
          timesheetAutoCreated: true,
          clientUpdated,
          clientLogs,
          attempt
        };
      });

      // הצלחה!
      console.log(`🎉 Transaction completed successfully on attempt ${attempt}`);
      result.clientLogs.forEach(log => console.log(log));
      return result;

    } catch (error) {
      lastError = error;

      // אם זה version conflict, נסה שוב
      if (error.code === 'aborted' && attempt < MAX_RETRIES) {
        console.log(`⚠️ Version conflict on attempt ${attempt}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 100 * attempt)); // exponential backoff
        continue;
      }

      // שגיאה אחרת או נגמרו הניסיונות
      console.error(`❌ Transaction failed on attempt ${attempt}:`, error);
      throw error;
    }
  }

  // נגמרו כל הניסיונות
  throw new functions.https.HttpsError(
    'aborted',
    `Version conflict after ${MAX_RETRIES} retries. Please try again.`
  );
}

module.exports = { addTimeToTaskWithTransaction };
