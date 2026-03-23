/**
 * Statistics Module - מודול סטטיסטיקה ונתונים חכמים
 * משרד עורכי דין - מערכת ניהול מתקדמת
 *
 * נוצר: 08/10/2025
 * עודכן: 29/10/2025
 * גרסה: 5.3.0 - Server-Side Metrics Integration
 *
 * תכונות:
 * - Ultra minimal design כמו Linear, Vercel, Raycast
 * - Font Awesome icons (far = outline) - תוקן לאייקונים שקיימים
 * - Stat compact cards עם אייקונים
 * - 4px spacing grid system
 * - מיקום מושלם של טקסט ואייקונים
 * - חישובים חכמים: מטרות חודשיות, התקדמות, אזהרות
 * - Server-side metrics עם fallback ללקוח
 */

// ===== קבועים גלובליים =====

/**
 * Urgent Threshold - משותף ללקוח ולשרת
 * משימה נחשבת דחופה אם deadline שלה עד 72 שעות (3 ימים)
 */
const URGENT_THRESHOLD_HOURS = 72;

/**
 * פונקציה לבדיקת דחיפות משימה
 * @param {number} deadlineMs - deadline במילישניות
 * @param {number} nowMs - זמן נוכחי במילישניות
 * @returns {boolean} true אם המשימה דחופה
 */
function isUrgent(deadlineMs, nowMs) {
  const timeUntilDeadline = deadlineMs - nowMs;
  const urgentThresholdMs = URGENT_THRESHOLD_HOURS * 60 * 60 * 1000;

  // דחוף אם הזמן עד deadline קטן או שווה ל-72 שעות
  // ולא עבר יותר מ-24 שעות מאז deadline (לא נספור deadlines ישנים מדי)
  return timeUntilDeadline <= urgentThresholdMs && timeUntilDeadline >= -24 * 60 * 60 * 1000;
}

// ===== תקצוב משימות - חישובי סטטיסטיקה =====

/**
 * חישוב סטטיסטיקה לקוח (Client-side calculation)
 * ✅ פונקציה פנימית - משמשת כ-fallback אם השרת לא זמין
 * @param {Array} tasks - מערך המשימות
 * @returns {Object} אובייקט עם כל הסטטיסטיקה
 */
function _calculateBudgetStatisticsClient(tasks) {
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
  const nowMs = now.getTime();
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

    // ✅ בדיקת דחיפות - משתמש בקבוע URGENT_THRESHOLD_HOURS ובפונקציה isUrgent
    if (task.deadline && task.status === 'פעיל') {
      const deadline = new Date(task.deadline);
      const deadlineMs = deadline.getTime();

      // שימוש בפונקציה isUrgent המשותפת
      if (isUrgent(deadlineMs, nowMs)) {
        stats.urgent++;
      }

      // משימות קריטיות: deadline עד שבוע (נשאר כמו שהיה)
      const daysUntil = Math.ceil((deadlineMs - nowMs) / (1000 * 60 * 60 * 24));
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
 * חישוב סטטיסטיקה מלאה לתקצוב משימות
 * ✅ Server-first approach עם fallback ללקוח
 *
 * @param {Array} tasks - מערך המשימות
 * @returns {Promise<Object>} אובייקט עם כל הסטטיסטיקה
 */
async function calculateBudgetStatistics(tasks) {
  const stats = _calculateBudgetStatisticsClient(tasks);
  stats.source = 'client';
  return stats;
}

/**
 * יצירת HTML לסרגל סטטיסטיקה של תקצוב משימות - Ultra Minimal Design
 * @param {Object} stats - אובייקט סטטיסטיקה
 * @param {string} currentFilter - הפילטר הנוכחי (active/completed/all)
 * @returns {string} HTML string
 */
function createBudgetStatsBar(stats, currentFilter = 'all') {
  return `
    <div class="stats-badge">
      <div class="stat-compact ${currentFilter === 'all' ? 'stat-highlight' : ''}">
        <div class="stat-icon">
          <i class="far fa-folder-open"></i>
        </div>
        <div class="stat-content">
          <div class="stat-label">משימות</div>
          <div class="stat-value">${stats.total}</div>
        </div>
      </div>

      <div class="stat-compact ${currentFilter === 'active' ? 'stat-highlight' : ''}">
        <div class="stat-icon">
          <i class="far fa-circle-play"></i>
        </div>
        <div class="stat-content">
          <div class="stat-label">פעילות</div>
          <div class="stat-value">${stats.active}</div>
        </div>
      </div>

      <div class="stat-compact stat-success ${currentFilter === 'completed' ? 'stat-highlight' : ''}">
        <div class="stat-icon">
          <i class="far fa-circle-check"></i>
        </div>
        <div class="stat-content">
          <div class="stat-label">הושלמו</div>
          <div class="stat-value">${stats.completed}</div>
        </div>
      </div>

      <div class="stat-compact">
        <div class="stat-icon">
          <i class="far fa-chart-bar"></i>
        </div>
        <div class="stat-content">
          <div class="stat-label">התקדמות</div>
          <div class="stat-value">${stats.overallProgress}%</div>
        </div>
      </div>

      ${stats.urgent > 0 ? `
      <div class="stat-compact stat-urgent">
        <div class="stat-icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <div class="stat-content">
          <div class="stat-label">דחופות</div>
          <div class="stat-value">${stats.urgent}</div>
        </div>
      </div>
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

  // עיגול כל הערכים למספרים שלמים לתצוגה קומפקטית
  stats.monthHours = Math.round(stats.monthHours);
  stats.hoursRemaining = Math.round(stats.hoursRemaining);
  stats.todayHours = Math.round(stats.todayHours);
  stats.weekHours = Math.round(stats.weekHours);

  return stats;
}

/**
 * חישוב מטרות חכמות ומידע מתקדם
 * @param {number} monthHours - שעות שנעשו החודש
 * @param {Date} now - תאריך נוכחי
 * @returns {Object} מידע חכם על מטרות והתקדמות
 */
function calculateSmartGoals(monthHours, now) {
  // קבלת תקן שעות אישי של העובד (אם קיים)
  const employeeData = window.manager?.currentEmployee || {};
  const dailyHoursTarget = employeeData.dailyHoursTarget || null;

  // יצירת מחשבון עם תקן אישי
  const calculator = new WorkHoursCalculator(dailyHoursTarget);
  const quota = calculator.getMonthlyQuota(now.getFullYear(), now.getMonth());

  // תקן חודשי דינמי לפי ימי עבודה (מוריד שישי-שבת וחגים)
  const monthlyGoal = quota.monthlyQuota;

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
 * יצירת HTML לסרגל סטטיסטיקה של שעתון - Ultra Minimal Design
 * @param {Object} stats - אובייקט סטטיסטיקה
 * @returns {string} HTML string
 */
function createTimesheetStatsBar(stats) {
  // קבלת תאריך נוכחי
  const now = new Date();
  const day = now.getDate();
  const monthNames = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];
  const currentMonth = monthNames[now.getMonth()];
  const currentDate = `${day} ${currentMonth}`;

  // בדיקה אם יש תקן אישי
  const employeeData = window.manager?.currentEmployee || {};
  const hasCustomTarget = employeeData.dailyHoursTarget && employeeData.dailyHoursTarget !== 8.45;
  const targetIcon = hasCustomTarget ? '🎯' : '📊';

  return `
    <div class="stats-badge">
      <div class="stat-compact stat-highlight">
        <div class="stat-icon">
          <i class="far fa-calendar-check"></i>
        </div>
        <div class="stat-content">
          <div class="stat-label">תאריך</div>
          <div class="stat-value">${currentDate}</div>
        </div>
      </div>

      <div class="stat-compact stat-highlight">
        <div class="stat-icon">
          <i class="far fa-calendar"></i>
        </div>
        <div class="stat-content">
          <div class="stat-label">${currentMonth}</div>
          <div class="stat-value">${stats.monthHours}h</div>
        </div>
      </div>

      <div class="stat-compact">
        <div class="stat-icon">
          <i class="far fa-flag"></i>
        </div>
        <div class="stat-content">
          <div class="stat-label">תקן ${targetIcon}</div>
          <div class="stat-value">${stats.monthlyGoal}h</div>
        </div>
      </div>

      <div class="stat-compact">
        <div class="stat-icon">
          <i class="far fa-clock"></i>
        </div>
        <div class="stat-content">
          <div class="stat-label">נותר</div>
          <div class="stat-value">${stats.hoursRemaining}h</div>
        </div>
      </div>

      <div class="stat-compact">
        <div class="stat-icon">
          <i class="far fa-chart-bar"></i>
        </div>
        <div class="stat-content">
          <div class="stat-label">התקדמות</div>
          <div class="stat-value">${stats.progressPercent}%</div>
        </div>
      </div>

      <div class="stat-compact">
        <div class="stat-icon">
          <i class="far fa-calendar-days"></i>
        </div>
        <div class="stat-content">
          <div class="stat-label">השבוע</div>
          <div class="stat-value">${stats.weekHours}h</div>
        </div>
      </div>
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

