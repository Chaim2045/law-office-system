/**
 * Statistics Module - מודול סטטיסטיקה ונתונים חכמים
 * משרד עורכי דין - מערכת ניהול מתקדמת
 *
 * נוצר: 08/10/2025
 * עודכן: 08/10/2025
 * גרסה: 3.1.0 - Modern Badge Style
 *
 * תכונות:
 * - תצוגת Badge מודרנית עם קופסאות נפרדות
 * - עיצוב נקי ומקצועי
 * - פריטים בקופסאות עם גרדיאנטים עדינים
 * - חישובים חכמים: מטרות חודשיות, התקדמות, אזהרות
 */

// ===== תקצוב משימות - חישובי סטטיסטיקה =====

/**
 * חישוב סטטיסטיקה מלאה לתקצוב משימות
 * @param {Array} tasks - מערך המשימות
 * @returns {Object} אובייקט עם כל הסטטיסטיקה
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
      totalActual: 0
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
    criticalTasks: 0
  };

  tasks.forEach(task => {
    // ספירת משימות פעילות והושלמו
    if (task.status === 'הושלם') {
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
    if (task.deadline && task.status !== 'הושלם') {
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
  stats.completionRate = stats.total > 0
    ? Math.round((stats.completed / stats.total) * 100)
    : 0;

  // קביעת סטטוס
  let status = 'good';
  let statusText = 'בקצב טוב';

  if (stats.completionRate >= 80 && stats.urgent === 0) {
    status = 'excellent';
    statusText = 'מעולה!';
  } else if (stats.urgent > 3 || stats.overBudget > 5) {
    status = 'danger';
    statusText = 'דורש תשומת לב';
  } else if (stats.urgent > 0 || stats.overBudget > 2) {
    status = 'warning';
    statusText = 'ניתן לשפר';
  }

  stats.budgetStatus = status;
  stats.budgetStatusText = statusText;

  return stats;
}

/**
 * יצירת HTML לסרגל סטטיסטיקה של תקצוב משימות - Badge Style
 * @param {Object} stats - אובייקט סטטיסטיקה
 * @param {string} currentFilter - הפילטר הנוכחי (active/completed/all)
 * @returns {string} HTML string
 */
function createBudgetStatsBar(stats, currentFilter = 'all') {
  const plannedHours = Math.round((stats.totalPlanned / 60) * 10) / 10;
  const actualHours = Math.round((stats.totalActual / 60) * 10) / 10;

  return `
    <div class="stats-badge">
      <span class="badge-item ${currentFilter === 'all' ? 'badge-highlight' : ''}">משימות: <strong>${stats.total}</strong></span>
      <span class="badge-separator">|</span>
      <span class="badge-item ${currentFilter === 'active' ? 'badge-highlight' : ''}">פעילות: <strong>${stats.active}</strong></span>
      <span class="badge-separator">|</span>
      <span class="badge-item ${currentFilter === 'completed' ? 'badge-highlight' : ''} badge-success">הושלמו: <strong>${stats.completed}</strong></span>
      <span class="badge-separator">|</span>
      <span class="badge-item">התקדמות: <strong>${stats.overallProgress}%</strong></span>
      ${stats.urgent > 0 ? `
      <span class="badge-separator">|</span>
      <span class="badge-item badge-urgent">דחופות: <strong>${stats.urgent}</strong></span>
      ` : ''}
    </div>
  `;
}

// ===== שעתון - חישובי סטטיסטיקה =====

/**
 * חישוב סטטיסטיקה מלאה לשעתון
 * @param {Array} entries - מערך רשומות השעתון
 * @returns {Object} אובייקט עם כל הסטטיסטיקה
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
      uniqueClients: 0
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
    clients: new Set()
  };

  entries.forEach(entry => {
    const minutes = entry.minutes || 0;
    stats.totalMinutes += minutes;

    // הוספת לקוח לרשימה
    if (entry.clientName) {
      stats.clients.add(entry.clientName);
    }

    // בדיקת תאריך
    if (entry.date) {
      const entryDate = new Date(entry.date);
      const entryDay = new Date(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate());

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
 * חישוב מטרות חכמות ומידע מתקדם
 * @param {number} monthHours - שעות שנעשו החודש
 * @param {Date} now - תאריך נוכחי
 * @returns {Object} מידע חכם על מטרות והתקדמות
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
  const requiredDailyAverage = workDaysRemaining > 0
    ? Math.round((hoursRemaining / workDaysRemaining) * 10) / 10
    : 0;

  // חישוב ממוצע יומי בפועל (עד כה)
  const actualDailyAverage = workDaysPassed > 0
    ? Math.round((monthHours / workDaysPassed) * 10) / 10
    : 0;

  // קביעת סטטוס
  let status = 'good';
  let statusText = 'בקצב טוב';

  if (progressPercent >= 95) {
    status = 'excellent';
    statusText = 'מעולה!';
  } else if (progressPercent >= 80 && actualDailyAverage >= 6) {
    status = 'good';
    statusText = 'בקצב טוב';
  } else if (progressPercent < 60 || actualDailyAverage < 5) {
    status = 'danger';
    statusText = 'דורש תשומת לב';
  } else {
    status = 'warning';
    statusText = 'ניתן לשפר';
  }

  return {
    monthlyGoal,
    hoursRemaining,
    progressPercent,
    requiredDailyAverage,
    actualDailyAverage,
    workDaysRemaining,
    goalStatus: status,
    goalStatusText: statusText
  };
}

/**
 * יצירת HTML לסרגל סטטיסטיקה של שעתון - Badge Style
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
window.StatisticsModule = {
  calculateBudgetStatistics,
  createBudgetStatsBar,
  calculateTimesheetStatistics,
  createTimesheetStatsBar
};

