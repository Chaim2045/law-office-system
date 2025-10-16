/**
 * Statistics Calculator Module
 * מודול חישובי סטטיסטיקה ומחשבונים
 * משרד עורכי דין - מערכת ניהול מתקדמת
 *
 * נוצר: 15/10/2025
 * גרסה: 1.0.0
 *
 * תכונות:
 * - חישוב שעות לקוחות מדויקות מרשומות שעתון
 * - חישוב התקדמות משימות
 * - ספירת משימות פעילות ומושלמות
 * - חישוב סטטטיסטיקות תקציב
 * - חישוב סטטיסטיקות שעתון
 * - סטטוס התקדמות חכם
 */

// ===== חישוב שעות לקוחות =====

/**
 * Calculate accurate client hours from all timesheet entries
 * חישוב מדויק של שעות לקוח מכל רשומות השעתון
 * @param {string} clientName - שם הלקוח
 * @returns {Promise<Object>} נתוני שעות מפורטים
 */
async function calculateClientHoursAccurate(clientName) {
  try {
    const db = window.firebaseDB;
    if (!db) throw new Error("Firebase לא מחובר");

    // Get client data
    const clientsSnapshot = await db
      .collection("clients")
      .where("fullName", "==", clientName)
      .get();

    if (clientsSnapshot.empty) {
      throw new Error("לקוח לא נמצא");
    }

    const client = clientsSnapshot.docs[0].data();

    // Get all timesheet entries for this client (from ALL users)
    const timesheetSnapshot = await db
      .collection("timesheet_entries")
      .where("clientName", "==", clientName)
      .get();

    let totalMinutesUsed = 0;
    const entriesByLawyer = {};

    timesheetSnapshot.forEach((doc) => {
      const entry = doc.data();
      const minutes = entry.minutes || 0;
      const lawyer = entry.employee || entry.lawyer || "לא ידוע";

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
    let status = "פעיל";
    let isBlocked = false;
    let isCritical = false;

    if (client.type === "hours") {
      if (remainingMinutes <= 0) {
        status = "חסום - נגמרו השעות";
        isBlocked = true;
      } else if (remainingHours <= 5) {
        status = "קריטי - מעט שעות";
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
      lastCalculated: new Date(),
    };

    return result;
  } catch (error) {
    console.error("שגיאה בחישוב שעות:", error);
    throw error;
  }
}

/**
 * Update client hours immediately in Firebase
 * עדכון מיידי של שעות לקוח ב-Firebase
 * @param {string} clientName - שם הלקוח
 * @param {number} minutesUsed - דקות שנוספו
 * @returns {Promise<Object>} תוצאת העדכון
 */
async function updateClientHoursImmediately(clientName, minutesUsed) {
  try {
    const db = window.firebaseDB;
    if (!db) throw new Error("Firebase לא מחובר");

    // Find the client
    const clientsSnapshot = await db
      .collection("clients")
      .where("fullName", "==", clientName)
      .get();

    if (clientsSnapshot.empty) {
      console.warn(`לקוח ${clientName} לא נמצא - לא ניתן לעדכן שעות`);
      return { success: false, message: "לקוח לא נמצא" };
    }

    const clientDoc = clientsSnapshot.docs[0];
    const clientData = clientDoc.data();

    // Only for hours-based clients
    if (clientData.type !== "hours") {
      return { success: true, message: "לקוח פיקס - לא נדרש עדכון" };
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
      isCritical: hoursData.isCritical,
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
        window.manager.clients[localClientIndex].isBlocked = hoursData.isBlocked;
        window.manager.clients[localClientIndex].isCritical = hoursData.isCritical;
      }
    }

    return {
      success: true,
      message: "שעות לקוח עודכנו בהצלחה",
      data: hoursData,
    };
  } catch (error) {
    console.error("שגיאה בעדכון שעות לקוח:", error);
    return { success: false, message: error.message };
  }
}

// ===== חישובי התקדמות משימות =====

/**
 * Calculate simple progress percentage for a task
 * חישוב אחוז התקדמות פשוט למשימה
 * @param {Object} task - אובייקט המשימה
 * @returns {number} אחוז התקדמות (0-100)
 */
function calculateSimpleProgress(task) {
  if (!task.estimatedMinutes || task.estimatedMinutes <= 0) return 0;
  const progress = Math.round(
    ((task.actualMinutes || 0) / task.estimatedMinutes) * 100
  );
  return Math.min(progress, 100);
}

/**
 * Get progress status text in Hebrew
 * קבלת טקסט סטטוס התקדמות בעברית
 * @param {number} progress - אחוז התקדמות
 * @returns {string} טקסט סטטוס
 */
function getProgressStatusText(progress) {
  if (progress >= 100) return "הושלם";
  if (progress >= 90) return "כמעט סיימת";
  if (progress >= 75) return "קרוב לסיום";
  if (progress >= 50) return "באמצע הדרך";
  if (progress >= 25) return "התחלנו";
  if (progress > 0) return "בתחילת הדרך";
  return "לא התחיל";
}

// ===== ספירת משימות =====

/**
 * Get count of active tasks
 * קבלת מספר משימות פעילות
 * @param {Array} tasks - מערך משימות
 * @returns {number} מספר משימות פעילות
 */
function getActiveTasksCount(tasks) {
  if (!tasks || !Array.isArray(tasks)) return 0;
  return tasks.filter((task) => task && task.status !== "הושלם").length;
}

/**
 * Get count of completed tasks
 * קבלת מספר משימות שהושלמו
 * @param {Array} tasks - מערך משימות
 * @returns {number} מספר משימות שהושלמו
 */
function getCompletedTasksCount(tasks) {
  if (!tasks || !Array.isArray(tasks)) return 0;
  return tasks.filter((task) => task && task.status === "הושלם").length;
}

/**
 * Get total hours from tasks
 * קבלת סך השעות ממשימות
 * @param {Array} tasks - מערך משימות
 * @param {string} type - 'estimated' או 'actual'
 * @returns {number} סך השעות
 */
function getTotalHours(tasks, type = "actual") {
  if (!tasks || !Array.isArray(tasks)) return 0;

  const minutesField = type === "estimated" ? "estimatedMinutes" : "actualMinutes";

  const totalMinutes = tasks.reduce((sum, task) => {
    return sum + (task[minutesField] || 0);
  }, 0);

  return Math.round((totalMinutes / 60) * 10) / 10;
}

// ===== סטטיסטיקות תקציב משימות =====

/**
 * Calculate budget statistics for tasks
 * חישוב סטטיסטיקות תקציב למשימות
 * @param {Array} tasks - מערך משימות
 * @returns {Object} אובייקט סטטיסטיקה
 */
function calculateBudgetStatistics(tasks) {
  if (!tasks || tasks.length === 0) {
    return {
      total: 0,
      active: 0,
      completed: 0,
      overBudget: 0,
      urgent: 0,
      overallProgress: 0,
      totalPlanned: 0,
      totalActual: 0,
      completionRate: 0,
    };
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const stats = {
    total: tasks.length,
    active: 0,
    completed: 0,
    overBudget: 0,
    urgent: 0,
    totalPlanned: 0,
    totalActual: 0,
    completedThisMonth: 0,
    criticalTasks: 0,
  };

  tasks.forEach((task) => {
    // ספירת משימות פעילות והושלמו
    if (task.status === "הושלם") {
      stats.completed++;

      // בדיקה אם הושלם החודש
      if (task.completedDate) {
        const completedDate = new Date(task.completedDate);
        if (completedDate >= startOfMonth) {
          stats.completedThisMonth++;
        }
      }
    } else {
      stats.active++;
    }

    // חישוב שעות
    const plannedMinutes = task.estimatedMinutes || 0;
    const actualMinutes = task.actualMinutes || 0;

    stats.totalPlanned += plannedMinutes;
    stats.totalActual += actualMinutes;

    // בדיקה אם חורג תקציב (בפועל גבוה ממתוכנן ביותר מ-10%)
    if (actualMinutes > plannedMinutes * 1.1 && plannedMinutes > 0) {
      stats.overBudget++;
    }

    // בדיקת דחיפות - רק למשימות שלא הושלמו
    if (task.deadline && task.status !== "הושלם") {
      const deadline = new Date(task.deadline);
      const daysUntil = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));

      // דחופות: deadline עבר או עד 3 ימים
      if (daysUntil <= 3) {
        stats.urgent++;
      }

      // משימות קריטיות: deadline עד שבוע
      if (daysUntil <= 7) {
        stats.criticalTasks++;
      }
    }
  });

  // חישוב אחוז התקדמות כללי
  if (stats.totalPlanned > 0) {
    stats.overallProgress = Math.min(
      100,
      Math.round((stats.totalActual / stats.totalPlanned) * 100)
    );
  } else {
    stats.overallProgress = 0;
  }

  // חישוב אחוז השלמה
  stats.completionRate =
    stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  // קביעת סטטוס
  let status = "good";
  let statusText = "בקצב טוב";

  if (stats.completionRate >= 80 && stats.urgent === 0) {
    status = "excellent";
    statusText = "מעולה!";
  } else if (stats.urgent > 3 || stats.overBudget > 5) {
    status = "danger";
    statusText = "דורש תשומת לב";
  } else if (stats.urgent > 0 || stats.overBudget > 2) {
    status = "warning";
    statusText = "ניתן לשפר";
  }

  stats.budgetStatus = status;
  stats.budgetStatusText = statusText;

  return stats;
}

/**
 * Create HTML for budget statistics bar - Badge Style
 * יצירת HTML לסרגל סטטיסטיקה של תקציב - סגנון Badge
 * @param {Object} stats - אובייקט סטטיסטיקה
 * @param {string} currentFilter - הפילטר הנוכחי (active/completed/all)
 * @returns {string} HTML string
 */
function createBudgetStatsBar(stats, currentFilter = "all") {
  const plannedHours = Math.round((stats.totalPlanned / 60) * 10) / 10;
  const actualHours = Math.round((stats.totalActual / 60) * 10) / 10;

  return `
    <div class="stats-badge">
      <span class="badge-item ${
        currentFilter === "all" ? "badge-highlight" : ""
      }">משימות: <strong>${stats.total}</strong></span>
      <span class="badge-separator">|</span>
      <span class="badge-item ${
        currentFilter === "active" ? "badge-highlight" : ""
      }">פעילות: <strong>${stats.active}</strong></span>
      <span class="badge-separator">|</span>
      <span class="badge-item ${
        currentFilter === "completed" ? "badge-highlight" : ""
      } badge-success">הושלמו: <strong>${stats.completed}</strong></span>
      <span class="badge-separator">|</span>
      <span class="badge-item">התקדמות: <strong>${
        stats.overallProgress
      }%</strong></span>
      ${
        stats.urgent > 0
          ? `
      <span class="badge-separator">|</span>
      <span class="badge-item badge-urgent">דחופות: <strong>${stats.urgent}</strong></span>
      `
          : ""
      }
    </div>
  `;
}

// ===== סטטיסטיקות שעתון =====

/**
 * Calculate timesheet statistics
 * חישוב סטטיסטיקות שעתון
 * @param {Array} entries - מערך רשומות שעתון
 * @returns {Object} אובייקט סטטיסטיקה
 */
function calculateTimesheetStatistics(entries) {
  if (!entries || entries.length === 0) {
    return {
      total: 0,
      totalMinutes: 0,
      totalHours: 0,
      todayMinutes: 0,
      todayHours: 0,
      weekMinutes: 0,
      weekHours: 0,
      monthMinutes: 0,
      monthHours: 0,
      uniqueClients: 0,
    };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // תחילת השבוע (ראשון)
  const startOfWeek = new Date(today);
  const day = startOfWeek.getDay();
  startOfWeek.setDate(startOfWeek.getDate() - day);

  // תחילת החודש
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const stats = {
    total: entries.length,
    totalMinutes: 0,
    todayMinutes: 0,
    weekMinutes: 0,
    monthMinutes: 0,
    clients: new Set(),
  };

  entries.forEach((entry) => {
    const minutes = entry.minutes || 0;
    stats.totalMinutes += minutes;

    // הוספת לקוח לרשימה
    if (entry.clientName) {
      stats.clients.add(entry.clientName);
    }

    // בדיקת תאריך
    if (entry.date) {
      const entryDate = new Date(entry.date);
      const entryDay = new Date(
        entryDate.getFullYear(),
        entryDate.getMonth(),
        entryDate.getDate()
      );

      // היום
      if (entryDay.getTime() === today.getTime()) {
        stats.todayMinutes += minutes;
      }

      // השבוע
      if (entryDay >= startOfWeek) {
        stats.weekMinutes += minutes;
      }

      // החודש
      if (entryDate >= startOfMonth) {
        stats.monthMinutes += minutes;
      }
    }
  });

  // המרה לשעות
  stats.totalHours = Math.round((stats.totalMinutes / 60) * 10) / 10;
  stats.todayHours = Math.round((stats.todayMinutes / 60) * 10) / 10;
  stats.weekHours = Math.round((stats.weekMinutes / 60) * 10) / 10;
  stats.monthHours = Math.round((stats.monthMinutes / 60) * 10) / 10;
  stats.uniqueClients = stats.clients.size;

  // חישוב מטרות חכמות
  const smartGoals = calculateSmartGoals(stats.monthHours, now);
  Object.assign(stats, smartGoals);

  return stats;
}

/**
 * Calculate smart goals and advanced metrics
 * חישוב מטרות חכמות ומדדים מתקדמים
 * @param {number} monthHours - שעות החודש
 * @param {Date} now - תאריך נוכחי
 * @returns {Object} מידע על מטרות והתקדמות
 */
function calculateSmartGoals(monthHours, now) {
  // מטרת חודש: 160 שעות (40 שעות/שבוע × 4 שבועות)
  const monthlyGoal = 160;

  // חישוב ימי עבודה בחודש (ללא שישי-שבת)
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();

  let workDaysInMonth = 0;
  let workDaysPassed = 0;

  for (let day = 1; day <= lastDayOfMonth; day++) {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();

    // לא ספירת שישי (5) ושבת (6)
    if (dayOfWeek !== 5 && dayOfWeek !== 6) {
      workDaysInMonth++;
      if (day < now.getDate()) {
        workDaysPassed++;
      } else if (day === now.getDate()) {
        workDaysPassed++; // כולל היום הנוכחי
      }
    }
  }

  const workDaysRemaining = workDaysInMonth - workDaysPassed + 1; // +1 כולל היום

  // חישוב התקדמות
  const hoursRemaining = Math.max(0, monthlyGoal - monthHours);
  const progressPercent = Math.round((monthHours / monthlyGoal) * 100);

  // חישוב ממוצע יומי נדרש (מה שנותר חלקי ימי עבודה שנותרו)
  const requiredDailyAverage =
    workDaysRemaining > 0
      ? Math.round((hoursRemaining / workDaysRemaining) * 10) / 10
      : 0;

  // חישוב ממוצע יומי בפועל (עד כה)
  const actualDailyAverage =
    workDaysPassed > 0
      ? Math.round((monthHours / workDaysPassed) * 10) / 10
      : 0;

  // קביעת סטטוס
  let status = "good";
  let statusText = "בקצב טוב";

  if (progressPercent >= 95) {
    status = "excellent";
    statusText = "מעולה!";
  } else if (progressPercent >= 80 && actualDailyAverage >= 6) {
    status = "good";
    statusText = "בקצב טוב";
  } else if (progressPercent < 60 || actualDailyAverage < 5) {
    status = "danger";
    statusText = "דורש תשומת לב";
  } else {
    status = "warning";
    statusText = "ניתן לשפר";
  }

  return {
    monthlyGoal,
    hoursRemaining,
    progressPercent,
    requiredDailyAverage,
    actualDailyAverage,
    workDaysRemaining,
    goalStatus: status,
    goalStatusText: statusText,
  };
}

/**
 * Create HTML for timesheet statistics bar - Badge Style
 * יצירת HTML לסרגל סטטיסטיקה של שעתון - סגנון Badge
 * @param {Object} stats - אובייקט סטטיסטיקה
 * @returns {string} HTML string
 */
function createTimesheetStatsBar(stats) {
  return `
    <div class="stats-badge">
      <span class="badge-item badge-highlight">החודש: <strong>${stats.monthHours}h</strong></span>
      <span class="badge-separator">|</span>
      <span class="badge-item">יעד: <strong>${stats.monthlyGoal}h</strong></span>
      <span class="badge-separator">|</span>
      <span class="badge-item">נותר: <strong>${stats.hoursRemaining}h</strong></span>
      <span class="badge-separator">|</span>
      <span class="badge-item">התקדמות: <strong>${stats.progressPercent}%</strong></span>
      <span class="badge-separator">|</span>
      <span class="badge-item">השבוע: <strong>${stats.weekHours}h</strong></span>
    </div>
  `;
}

// ===== ייצוא לשימוש גלובלי =====

// Export as module for modern usage
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    // Client hours calculations
    calculateClientHoursAccurate,
    updateClientHoursImmediately,

    // Task progress calculations
    calculateSimpleProgress,
    getProgressStatusText,

    // Task counting
    getActiveTasksCount,
    getCompletedTasksCount,
    getTotalHours,

    // Budget statistics
    calculateBudgetStatistics,
    createBudgetStatsBar,

    // Timesheet statistics
    calculateTimesheetStatistics,
    createTimesheetStatsBar,
    calculateSmartGoals,
  };
}

// Export to global window for browser usage
window.StatisticsCalculator = {
  // Client hours calculations
  calculateClientHoursAccurate,
  updateClientHoursImmediately,

  // Task progress calculations
  calculateSimpleProgress,
  getProgressStatusText,

  // Task counting
  getActiveTasksCount,
  getCompletedTasksCount,
  getTotalHours,

  // Budget statistics
  calculateBudgetStatistics,
  createBudgetStatsBar,

  // Timesheet statistics
  calculateTimesheetStatistics,
  createTimesheetStatsBar,
  calculateSmartGoals,
};

console.log("Statistics Calculator Module loaded successfully");
