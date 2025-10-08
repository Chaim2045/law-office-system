/**
 * Statistics Module - מודול סטטיסטיקה ונתונים חכמים
 * משרד עורכי דין - מערכת ניהול מתקדמת
 *
 * נוצר: 08/10/2025
 * עודכן: 08/10/2025
 * גרסה: 1.2.0
 *
 * תכונות:
 * - סטטיסטיקה בסיסית לתקצוב ושעתון
 * - חישובים חכמים: מטרות חודשיות, התקדמות, אזהרות
 * - ממוצעים יומיים, ימי עבודה נותרים
 * - סטטוס אוטומטי: מעולה / בקצב טוב / ניתן לשפר / דורש תשומת לב
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

    // בדיקת דחיפות - deadline עבר או עד 3 ימים
    if (task.deadline) {
      const deadline = new Date(task.deadline);
      const daysUntil = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));

      if (daysUntil < 0 || (daysUntil <= 3 && task.status !== 'הושלם')) {
        stats.urgent++;
      }

      // משימות קריטיות - deadline עד שבוע או עבר, וטרם הושלם
      if (daysUntil <= 7 && task.status !== 'הושלם') {
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
 * יצירת HTML לסרגל סטטיסטיקה של תקצוב משימות
 * @param {Object} stats - אובייקט סטטיסטיקה
 * @returns {string} HTML string
 */
function createBudgetStatsBar(stats) {
  const plannedHours = Math.round((stats.totalPlanned / 60) * 10) / 10;
  const actualHours = Math.round((stats.totalActual / 60) * 10) / 10;

  const statusClass = 'status-good'; // תמיד נייטרלי
  const smartStatusClass = `stats-status-${stats.budgetStatus}`;

  return `
    <div class="stats-bar ${statusClass}">
      <div class="stats-item">
        <span class="stats-label">סה"כ משימות:</span>
        <span class="stats-value">${stats.total}</span>
      </div>
      <div class="stats-separator">•</div>
      <div class="stats-item">
        <span class="stats-label">פעילות:</span>
        <span class="stats-value">${stats.active}</span>
      </div>
      <div class="stats-separator">•</div>
      <div class="stats-item stats-completed">
        <span class="stats-label">הושלמו:</span>
        <span class="stats-value">${stats.completed}</span>
      </div>
      ${stats.overBudget > 0 ? `
      <div class="stats-separator">•</div>
      <div class="stats-item stats-warning">
        <span class="stats-label">חורגות:</span>
        <span class="stats-value">${stats.overBudget}</span>
      </div>
      ` : ''}
      ${stats.urgent > 0 ? `
      <div class="stats-separator">•</div>
      <div class="stats-item stats-urgent">
        <span class="stats-label">דחופות:</span>
        <span class="stats-value">${stats.urgent}</span>
      </div>
      ` : ''}
      <div class="stats-separator">•</div>
      <div class="stats-item">
        <span class="stats-label">שעות:</span>
        <span class="stats-value">${actualHours}h / ${plannedHours}h</span>
      </div>
      <div class="stats-separator">•</div>
      <div class="stats-item stats-progress">
        <span class="stats-label">התקדמות:</span>
        <span class="stats-value">${stats.overallProgress}%</span>
      </div>
    </div>
    <div class="stats-smart-row">
      <div class="stats-smart-item">
        <span class="stats-smart-label">הושלמו החודש:</span>
        <span class="stats-smart-value">${stats.completedThisMonth}</span>
      </div>
      <div class="stats-separator">•</div>
      <div class="stats-smart-item">
        <span class="stats-smart-label">אחוז השלמה:</span>
        <span class="stats-smart-value">${stats.completionRate}%</span>
      </div>
      ${stats.criticalTasks > 0 ? `
      <div class="stats-separator">•</div>
      <div class="stats-smart-item">
        <span class="stats-smart-label">משימות קריטיות:</span>
        <span class="stats-smart-value" style="color: #dc2626; font-weight: 700;">${stats.criticalTasks}</span>
      </div>
      ` : ''}
      ${stats.overBudget > 0 ? `
      <div class="stats-separator">•</div>
      <div class="stats-smart-item">
        <span class="stats-smart-label">חריגות תקציב:</span>
        <span class="stats-smart-value" style="color: #d97706; font-weight: 700;">${stats.overBudget}</span>
      </div>
      ` : ''}
      <div class="stats-separator">•</div>
      <span class="${smartStatusClass}">${stats.budgetStatusText}</span>
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
 * יצירת HTML לסרגל סטטיסטיקה של שעתון
 * @param {Object} stats - אובייקט סטטיסטיקה
 * @returns {string} HTML string
 */
function createTimesheetStatsBar(stats) {
  // קביעת סטטוס CSS לפי הסטטוס החכם
  const statusClass = 'status-good'; // תמיד נייטרלי

  // קביעת סטטוס CSS למידע החכם
  const smartStatusClass = `stats-status-${stats.goalStatus}`;

  return `
    <div class="stats-bar ${statusClass}">
      <div class="stats-item">
        <span class="stats-label">סה"כ רשומות:</span>
        <span class="stats-value">${stats.total}</span>
      </div>
      <div class="stats-separator">•</div>
      <div class="stats-item">
        <span class="stats-label">סה"כ שעות:</span>
        <span class="stats-value">${stats.totalHours}h</span>
      </div>
      <div class="stats-separator">•</div>
      <div class="stats-item stats-highlight">
        <span class="stats-label">היום:</span>
        <span class="stats-value">${stats.todayHours}h</span>
      </div>
      <div class="stats-separator">•</div>
      <div class="stats-item">
        <span class="stats-label">השבוע:</span>
        <span class="stats-value">${stats.weekHours}h</span>
      </div>
      <div class="stats-separator">•</div>
      <div class="stats-item">
        <span class="stats-label">החודש:</span>
        <span class="stats-value">${stats.monthHours}h</span>
      </div>
      <div class="stats-separator">•</div>
      <div class="stats-item">
        <span class="stats-label">לקוחות:</span>
        <span class="stats-value">${stats.uniqueClients}</span>
      </div>
    </div>
    <div class="stats-smart-row">
      <div class="stats-smart-item">
        <span class="stats-smart-label">מטרת חודש:</span>
        <span class="stats-smart-value">${stats.monthlyGoal}h</span>
      </div>
      <div class="stats-separator">•</div>
      <div class="stats-smart-item">
        <span class="stats-smart-label">התקדמות:</span>
        <span class="stats-smart-value">${stats.progressPercent}%</span>
      </div>
      <div class="stats-separator">•</div>
      <div class="stats-smart-item">
        <span class="stats-smart-label">נותר:</span>
        <span class="stats-smart-value">${stats.hoursRemaining}h</span>
      </div>
      <div class="stats-separator">•</div>
      <div class="stats-smart-item">
        <span class="stats-smart-label">ממוצע יומי נדרש:</span>
        <span class="stats-smart-value">${stats.requiredDailyAverage}h</span>
      </div>
      <div class="stats-separator">•</div>
      <div class="stats-smart-item">
        <span class="stats-smart-label">ימי עבודה נותרו:</span>
        <span class="stats-smart-value">${stats.workDaysRemaining}</span>
      </div>
      <div class="stats-separator">•</div>
      <span class="${smartStatusClass}">${stats.goalStatusText}</span>
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

console.log('Statistics module v1.2.0 loaded successfully!');
