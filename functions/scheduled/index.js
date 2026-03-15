/** Scheduled Functions — פונקציות מתוזמנות יומיות */

const admin = require('firebase-admin');
const { onSchedule } = require('firebase-functions/v2/scheduler');

const db = admin.firestore();

/**
 * formatDate - פורמט תאריך לתצוגה בעברית
 */
function formatDate(date) {
  return new Intl.DateTimeFormat('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

/**
 * dailyTaskReminders - תזכורות משימות יומיות
 * רץ כל יום בשעה 09:00 בבוקר
 * בודק:
 * 1. משימות שעומדות לפוג בתוך 3 ימים
 * 2. משימות שכבר עבר תאריך היעד שלהן (overdue)
 * שולח התראה אוטומטית לעובדים (לא למנהלים - הם רואים בדשבורד)
 */
const dailyTaskReminders = onSchedule({
  schedule: '0 9 * * *',  // כל יום בשעה 09:00
  timeZone: 'Asia/Jerusalem',
  region: 'us-central1'
}, async (event) => {
    try {
      console.log('🔔 Running dailyTaskReminders at', new Date().toISOString());

      const now = admin.firestore.Timestamp.now();
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      const threeDaysTimestamp = admin.firestore.Timestamp.fromDate(threeDaysFromNow);

      // מצא משימות פעילות עם deadline בתוך 3 ימים או שעבר
      const tasksSnapshot = await db.collection('budget_tasks')
        .where('status', '==', 'פעיל')
        .where('deadline', '!=', null)
        .get();

      let remindersCount = 0;
      let overdueCount = 0;

      for (const taskDoc of tasksSnapshot.docs) {
        const task = taskDoc.data();
        const taskId = taskDoc.id;
        const deadline = task.deadline;

        // דלג על משימות ללא deadline
        if (!deadline) continue;

        const isOverdue = deadline.toDate() < now.toDate();
        const isUpcoming = !isOverdue && deadline.toDate() <= threeDaysTimestamp.toDate();

        if (isOverdue) {
          // משימה שעבר הזמן
          await db.collection('notifications').add({
            userId: task.lawyer || task.createdBy,
            userEmail: task.employee,
            title: `⚠️ משימה באיחור: ${task.clientName}`,
            message: `המשימה "${task.description}" עברה את תאריך היעד (${formatDate(deadline.toDate())})`,
            type: 'error',
            taskId: taskId,
            reminder: true,
            automated: true,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            icon: 'fa-exclamation-triangle'
          });
          overdueCount++;

        } else if (isUpcoming) {
          // משימה שמתקרבת לתאריך יעד
          const daysLeft = Math.ceil((deadline.toDate() - now.toDate()) / (1000 * 60 * 60 * 24));
          await db.collection('notifications').add({
            userId: task.lawyer || task.createdBy,
            userEmail: task.employee,
            title: `⏰ תזכורת: ${task.clientName}`,
            message: `המשימה "${task.description}" מתקרבת לתאריך יעד (${daysLeft} ימים)`,
            type: 'warning',
            taskId: taskId,
            reminder: true,
            automated: true,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            icon: 'fa-clock'
          });
          remindersCount++;
        }
      }

      console.log(`✅ Sent ${overdueCount} overdue alerts and ${remindersCount} upcoming reminders`);
      return { overdueCount, remindersCount };

    } catch (error) {
      console.error('❌ Error in dailyTaskReminders:', error);
      throw error;
    }
  });

/**
 * dailyBudgetWarnings - אזהרות תקציב יומיות
 * רץ כל יום בשעה 17:00 אחה"צ
 * בודק:
 * 1. משימות שחרגו מ-80% מתקציב הזמן (warning)
 * 2. משימות שחרגו 100% מתקציב הזמן (danger)
 * שולח התראה אוטומטית לעובדים
 */
const dailyBudgetWarnings = onSchedule({
  schedule: '0 17 * * *',  // כל יום בשעה 17:00
  timeZone: 'Asia/Jerusalem',
  region: 'us-central1'
}, async (event) => {
    try {
      console.log('💰 Running dailyBudgetWarnings at', new Date().toISOString());

      // מצא משימות פעילות
      const tasksSnapshot = await db.collection('budget_tasks')
        .where('status', '==', 'פעיל')
        .get();

      let warningsCount = 0;
      let criticalCount = 0;

      for (const taskDoc of tasksSnapshot.docs) {
        const task = taskDoc.data();
        const taskId = taskDoc.id;

        // חישוב תקציב ושעות בפועל
        const estimatedMinutes = (task.estimatedHours || 0) * 60 + (task.estimatedMinutes || 0);
        const actualMinutes = (task.actualHours || 0) * 60 + (task.actualMinutes || 0);

        // דלג על משימות ללא תקציב
        if (estimatedMinutes === 0) continue;

        const percentageUsed = (actualMinutes / estimatedMinutes) * 100;

        // בדוק אם כבר שלחנו התראה היום (למנוע spam)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const existingNotification = await db.collection('notifications')
          .where('taskId', '==', taskId)
          .where('automated', '==', true)
          .where('type', 'in', ['warning', 'error'])
          .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(today))
          .limit(1)
          .get();

        if (!existingNotification.empty) {
          console.log(`⏭️  Skipping task ${taskId} - already notified today`);
          continue;
        }

        if (percentageUsed >= 100) {
          // חריגה מלאה מהתקציב
          await db.collection('notifications').add({
            userId: task.lawyer || task.createdBy,
            userEmail: task.employee,
            title: `🚨 חריגה מתקציב: ${task.clientName}`,
            message: `המשימה "${task.description}" חרגה מתקציב הזמן (${Math.round(percentageUsed)}%)`,
            type: 'error',
            taskId: taskId,
            budgetWarning: true,
            automated: true,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            icon: 'fa-exclamation-circle'
          });
          criticalCount++;

        } else if (percentageUsed >= 80) {
          // אזהרה - מתקרב לתקציב
          await db.collection('notifications').add({
            userId: task.lawyer || task.createdBy,
            userEmail: task.employee,
            title: `⚠️ התקרבות לתקציב: ${task.clientName}`,
            message: `המשימה "${task.description}" מתקרבת לתקציב הזמן (${Math.round(percentageUsed)}%)`,
            type: 'warning',
            taskId: taskId,
            budgetWarning: true,
            automated: true,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            icon: 'fa-exclamation-triangle'
          });
          warningsCount++;
        }
      }

      console.log(`✅ Sent ${criticalCount} critical budget alerts and ${warningsCount} budget warnings`);
      return { criticalCount, warningsCount };

    } catch (error) {
      console.error('❌ Error in dailyBudgetWarnings:', error);
      throw error;
    }
  });

// ═══════════════════════════════════════════════════════════════
// 🔍 Daily Invariant Check - Data Integrity Monitor
// ═══════════════════════════════════════════════════════════════

// TODO: כשישודרג Twilio — להוסיף שליחת SMS בפער
// מספר יעד: +972549539238

const dailyInvariantCheck = onSchedule({
  schedule: '0 6 * * *',
  timeZone: 'Asia/Jerusalem',
  region: 'us-central1'
}, async () => {
  const SKIP_CLIENTS = ['2025003'];
  const TOLERANCE = 0.02;
  const discrepancies = [];

  try {
    console.log('🔍 Starting daily invariant check...');

    const clientsSnapshot = await db.collection('clients').get();
    console.log(`📊 Checking ${clientsSnapshot.size} clients`);

    for (const clientDoc of clientsSnapshot.docs) {
      const clientId = clientDoc.id;

      if (SKIP_CLIENTS.includes(clientId)) {
        continue;
      }

      try {
        const clientData = clientDoc.data();
        const clientName = clientData.clientName || clientData.name || clientId;
        const services = clientData.services || [];

        if (services.length === 0) {
          continue;
        }

        // Read all timesheet entries for this client
        const timesheetSnapshot = await db.collection('timesheet_entries')
          .where('clientId', '==', clientId)
          .get();

        // Group minutes by effective serviceId (parentServiceId for legal_procedure stages)
        const serviceMinutes = {};
        timesheetSnapshot.forEach(doc => {
          const entry = doc.data();
          const effectiveServiceId = entry.parentServiceId || entry.serviceId;
          if (effectiveServiceId) {
            serviceMinutes[effectiveServiceId] = (serviceMinutes[effectiveServiceId] || 0) + (entry.minutes || 0);
          }
        });

        // Check each service
        for (const service of services) {
          const serviceId = service.id;
          if (!serviceId) continue;

          const cardHoursUsed = service.pricingType === 'fixed'
            ? (service.stages || []).reduce((sum, st) => sum + (st.totalHoursWorked || 0), 0)
            : (service.hoursUsed || 0);
          const timesheetMinutes = serviceMinutes[serviceId] || 0;
          const timesheetHoursUsed = timesheetMinutes / 60;
          const gap = Math.abs(cardHoursUsed - timesheetHoursUsed);

          if (gap > TOLERANCE) {
            discrepancies.push({
              clientId,
              clientName,
              serviceId,
              serviceName: service.name || service.type || serviceId,
              cardHoursUsed: parseFloat(cardHoursUsed.toFixed(2)),
              timesheetHoursUsed: parseFloat(timesheetHoursUsed.toFixed(2)),
              gap: parseFloat(gap.toFixed(2))
            });
          }
        }
      } catch (clientError) {
        console.error(`⚠️ Error checking client ${clientId}:`, clientError.message);
        // Continue to next client
      }
    }

    // Check 1: tasks without serviceId
    const tasksSnapshot = await db.collection('budget_tasks')
      .where('status', 'in', ['פעיל', 'הושלם'])
      .get();
    tasksSnapshot.forEach(doc => {
      const task = doc.data();
      if (!task.serviceId) {
        discrepancies.push({
          type: 'task_missing_serviceId',
          taskId: doc.id,
          clientId: task.clientId,
          employee: task.employee,
          description: task.description
        });
      }
    });

    // Check 2: stages without pricingType
    clientsSnapshot.docs.forEach(clientDoc => {
      const data = clientDoc.data();
      (data.services || []).forEach(svc => {
        if (svc.type === 'legal_procedure') {
          (svc.stages || []).forEach(stage => {
            if (!stage.pricingType) {
              discrepancies.push({
                type: 'stage_missing_pricingType',
                clientId: clientDoc.id,
                serviceId: svc.id,
                stageId: stage.id
              });
            }
          });
        }
      });
    });

    // Check 3: task.actualMinutes vs SUM entries
    const taskMinutes = {};
    const allEntriesSnapshot = await db.collection('timesheet_entries')
      .where('taskId', '!=', null)
      .get();
    allEntriesSnapshot.forEach(doc => {
      const entry = doc.data();
      if (entry.taskId) {
        taskMinutes[entry.taskId] = (taskMinutes[entry.taskId] || 0) + (entry.minutes || 0);
      }
    });
    tasksSnapshot.forEach(doc => {
      const task = doc.data();
      const sumEntries = taskMinutes[doc.id] || 0;
      const actualMinutes = task.actualMinutes || 0;
      if (Math.abs(actualMinutes - sumEntries) > 1) {
        discrepancies.push({
          type: 'task_actualMinutes_gap',
          taskId: doc.id,
          clientId: task.clientId,
          actualMinutes,
          sumEntries,
          gap: sumEntries - actualMinutes
        });
      }
    });

    // Save result to system_health_checks
    if (discrepancies.length > 0) {
      await db.collection('system_health_checks').add({
        type: 'invariant_check',
        status: 'FAIL',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        discrepanciesCount: discrepancies.length,
        discrepancies,
        message: `נמצאו ${discrepancies.length} פערים בנתוני שעות`
      });
      console.log(`❌ Invariant check FAILED — ${discrepancies.length} discrepancies found`);
    } else {
      await db.collection('system_health_checks').add({
        type: 'invariant_check',
        status: 'PASS',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        discrepanciesCount: 0,
        discrepancies: [],
        message: 'כל הנתונים תקינים'
      });
      console.log('✅ Invariant check PASSED — no discrepancies');
    }

  } catch (error) {
    console.error('❌ Invariant check ERROR:', error);
    try {
      await db.collection('system_health_checks').add({
        type: 'invariant_check',
        status: 'ERROR',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        discrepanciesCount: 0,
        discrepancies: [],
        message: `שגיאה בבדיקת תקינות: ${error.message}`
      });
    } catch (saveError) {
      console.error('❌ Failed to save error status:', saveError);
    }
  }
});

module.exports = { dailyTaskReminders, dailyBudgetWarnings, dailyInvariantCheck };
