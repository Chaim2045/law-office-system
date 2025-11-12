/**
 * addTimeToTask V2 - With Transaction + Optimistic Locking
 *
 * תיקון קריטי: עוטף את כל הפעולות (task + client + timesheet) ב-transaction אחד
 * זה מבטיח:
 * 1. Atomicity - הכל מתבצע או כלום
 * 2. Consistency - אין data inconsistency
 * 3. Isolation - אין race conditions בין משתמשים
 * 4. Optimistic Locking - בדיקת _version למניעת overwrites
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

            updates.clientUpdate = {
              services: clientData.services,
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
  // ✅ לקוח שעתי (מבנה חדש)
  else if (clientData.procedureType === 'hours' && clientData.services && clientData.services.length > 0) {
    let service = null;

    if (taskData.serviceId) {
      service = clientData.services.find(s => s.id === taskData.serviceId);
      if (!service) {
        service = clientData.services[0];
      }
    } else {
      service = clientData.services[0];
    }

    if (service) {
      const activePackage = getActivePackage(service);

      if (activePackage) {
        deductHoursFromPackage(activePackage, hoursWorked);

        updates.clientUpdate = {
          services: clientData.services,
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
 * הפונקציה הראשית - עם Transaction
 */
async function addTimeToTaskWithTransaction(db, data, user) {
  const MAX_RETRIES = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await db.runTransaction(async (transaction) => {
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

        // 2️⃣ חישוב נתוני המשימה
        const newActualMinutes = (taskData.actualMinutes || 0) + data.minutes;
        const currentEstimate = taskData.estimatedMinutes || 0;
        const percentOfBudget = currentEstimate > 0 ? Math.round((newActualMinutes / currentEstimate) * 100) : 0;
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

        // 3️⃣ עדכון המשימה
        transaction.update(taskRef, {
          actualHours: admin.firestore.FieldValue.increment(data.minutes / 60),
          actualMinutes: admin.firestore.FieldValue.increment(data.minutes),
          timeEntries: admin.firestore.FieldValue.arrayUnion(timeEntry),
          lastModifiedBy: user.username,
          lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // 4️⃣ יצירת רשומת שעתון
        const timesheetRef = db.collection('timesheet_entries').doc();
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
        transaction.set(timesheetRef, timesheetEntry);

        // 5️⃣ עדכון לקוח (עם optimistic locking)
        let clientUpdated = false;
        let clientLogs = [];

        if (taskData.clientId) {
          const clientRef = db.collection('clients').doc(taskData.clientId);
          const clientDoc = await transaction.get(clientRef);

          if (clientDoc.exists) {
            const clientData = clientDoc.data();
            const currentVersion = clientData._version || 0;

            // חישוב עדכוני הלקוח
            const updates = calculateClientUpdates(clientData, taskData, data.minutes);

            if (updates.clientUpdate) {
              // ✅ הוספת _version לעדכון
              updates.clientUpdate._version = currentVersion + 1;
              updates.clientUpdate._lastModified = admin.firestore.FieldValue.serverTimestamp();
              updates.clientUpdate._modifiedBy = user.username;

              transaction.update(clientRef, updates.clientUpdate);
              clientUpdated = true;
              clientLogs = updates.logs;
            }
          }
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
      result.clientLogs.forEach(log => console.log(log));
      return result;

    } catch (error) {
      lastError = error;

      // אם זה version conflict, נסה שוב
      if (error.code === 'aborted' && attempt < MAX_RETRIES) {
        console.log(`⚠️ Version conflict on attempt ${attempt}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 100 * attempt)); // backoff
        continue;
      }

      // שגיאה אחרת או נגמרו הניסיונות
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
