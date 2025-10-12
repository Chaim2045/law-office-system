/**
 * Reports Module - מודול דוחות וניתוח נתונים
 * משרד עורכי דין - מערכת ניהול מתקדמת
 *
 * נוצר: 08/10/2025
 * גרסה: 1.0.0
 *
 * תכונות:
 * - חישוב נתונים לפי חודש/שנה/טווח מותאם
 * - השוואה בין תקופות שונות
 * - מדדי ביצועים: ממוצעים, מגמות, אחוזי גידול
 * - סינון וחיתוך נתונים
 * - קיבוץ לפי חודש, שנה, לקוח
 * - תמיכה בשעתון ותקצוב משימות
 */

// ===== פונקציות עזר - תאריכים =====

/**
 * בדיקה אם תאריך נמצא בטווח מסוים
 * @param {Date} date - התאריך לבדיקה
 * @param {Date} startDate - תאריך התחלה
 * @param {Date} endDate - תאריך סיום
 * @returns {boolean}
 */
function isDateInRange(date, startDate, endDate) {
  return date >= startDate && date <= endDate;
}

/**
 * קבלת תאריך תחילת חודש
 * @param {number} month - חודש (0-11)
 * @param {number} year - שנה
 * @returns {Date}
 */
function getMonthStart(month, year) {
  return new Date(year, month, 1);
}

/**
 * קבלת תאריך סוף חודש
 * @param {number} month - חודש (0-11)
 * @param {number} year - שנה
 * @returns {Date}
 */
function getMonthEnd(month, year) {
  return new Date(year, month + 1, 0, 23, 59, 59, 999);
}

/**
 * קבלת תאריך תחילת שנה
 * @param {number} year - שנה
 * @returns {Date}
 */
function getYearStart(year) {
  return new Date(year, 0, 1);
}

/**
 * קבלת תאריך סוף שנה
 * @param {number} year - שנה
 * @returns {Date}
 */
function getYearEnd(year) {
  return new Date(year, 11, 31, 23, 59, 59, 999);
}

/**
 * קבלת שם חודש בעברית
 * @param {number} month - חודש (0-11)
 * @returns {string}
 */
function getMonthNameHebrew(month) {
  const months = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'סeptember', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];
  return months[month];
}

/**
 * חישוב מספר ימי עבודה בחודש (ללא שישי-שבת)
 * @param {number} month - חודש (0-11)
 * @param {number} year - שנה
 * @returns {number}
 */
function getWorkDaysInMonth(month, year) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  let workDays = 0;

  for (let day = 1; day <= lastDay; day++) {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    // לא ספירת שישי (5) ושבת (6)
    if (dayOfWeek !== 5 && dayOfWeek !== 6) {
      workDays++;
    }
  }

  return workDays;
}

// ===== סינון וחיתוך נתונים =====

/**
 * סינון רשומות שעתון לפי טווח תאריכים
 * @param {Array} entries - מערך רשומות שעתון
 * @param {Date} startDate - תאריך התחלה
 * @param {Date} endDate - תאריך סיום
 * @returns {Array}
 */
function filterTimesheetByDateRange(entries, startDate, endDate) {
  if (!entries || entries.length === 0) return [];

  return entries.filter(entry => {
    if (!entry.date) return false;
    const entryDate = new Date(entry.date);
    return isDateInRange(entryDate, startDate, endDate);
  });
}

/**
 * סינון משימות לפי טווח תאריכים (לפי תאריך יצירה או deadline)
 * @param {Array} tasks - מערך משימות
 * @param {Date} startDate - תאריך התחלה
 * @param {Date} endDate - תאריך סיום
 * @param {string} dateField - שדה תאריך לסינון ('createdDate' או 'deadline' או 'completedDate')
 * @returns {Array}
 */
function filterTasksByDateRange(tasks, startDate, endDate, dateField = 'createdDate') {
  if (!tasks || tasks.length === 0) return [];

  return tasks.filter(task => {
    if (!task[dateField]) return false;
    const taskDate = new Date(task[dateField]);
    return isDateInRange(taskDate, startDate, endDate);
  });
}

/**
 * סינון נתונים לפי לקוח
 * @param {Array} data - מערך נתונים (שעתון או משימות)
 * @param {string} clientName - שם הלקוח
 * @returns {Array}
 */
function filterByClient(data, clientName) {
  if (!data || data.length === 0) return [];
  return data.filter(item => item.clientName === clientName);
}

/**
 * סינון משימות לפי סטטוס
 * @param {Array} tasks - מערך משימות
 * @param {string} status - סטטוס ('פעיל' או 'הושלם')
 * @returns {Array}
 */
function filterTasksByStatus(tasks, status) {
  if (!tasks || tasks.length === 0) return [];
  return tasks.filter(task => task.status === status);
}

// ===== קיבוץ נתונים =====

/**
 * קיבוץ רשומות שעתון לפי חודש
 * @param {Array} entries - מערך רשומות שעתון
 * @returns {Object} אובייקט עם מפתח של חודש-שנה ומערך רשומות
 */
function groupTimesheetByMonth(entries) {
  if (!entries || entries.length === 0) return {};

  const grouped = {};

  entries.forEach(entry => {
    if (!entry.date) return;

    const date = new Date(entry.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!grouped[key]) {
      grouped[key] = [];
    }

    grouped[key].push(entry);
  });

  return grouped;
}

/**
 * קיבוץ משימות לפי חודש (לפי תאריך השלמה)
 * @param {Array} tasks - מערך משימות
 * @returns {Object} אובייקט עם מפתח של חודש-שנה ומערך משימות
 */
function groupTasksByMonth(tasks) {
  if (!tasks || tasks.length === 0) return {};

  const grouped = {};

  tasks.forEach(task => {
    const dateField = task.status === 'הושלם' ? 'completedDate' : 'createdDate';
    if (!task[dateField]) return;

    const date = new Date(task[dateField]);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!grouped[key]) {
      grouped[key] = [];
    }

    grouped[key].push(task);
  });

  return grouped;
}

/**
 * קיבוץ נתונים לפי לקוח
 * @param {Array} data - מערך נתונים
 * @returns {Object} אובייקט עם מפתח של שם לקוח ומערך נתונים
 */
function groupByClientName(data) {
  if (!data || data.length === 0) return {};

  const grouped = {};

  data.forEach(item => {
    const clientName = item.clientName || 'ללא לקוח';

    if (!grouped[clientName]) {
      grouped[clientName] = [];
    }

    grouped[clientName].push(item);
  });

  return grouped;
}

// ===== חישובי סטטיסטיקה לפי תקופה =====

/**
 * חישוב סטטיסטיקה מלאה לשעתון לפי חודש
 * @param {Array} allEntries - כל רשומות השעתון
 * @param {number} month - חודש (0-11)
 * @param {number} year - שנה
 * @returns {Object}
 */
function calculateMonthlyTimesheetStats(allEntries, month, year) {
  const startDate = getMonthStart(month, year);
  const endDate = getMonthEnd(month, year);
  const monthEntries = filterTimesheetByDateRange(allEntries, startDate, endDate);

  if (monthEntries.length === 0) {
    return {
      month,
      year,
      monthName: getMonthNameHebrew(month),
      totalEntries: 0,
      totalMinutes: 0,
      totalHours: 0,
      workDays: getWorkDaysInMonth(month, year),
      averageHoursPerDay: 0,
      uniqueClients: 0,
      topClient: null,
      isEmpty: true
    };
  }

  let totalMinutes = 0;
  const clients = new Set();
  const clientHours = {};

  monthEntries.forEach(entry => {
    totalMinutes += entry.minutes || 0;

    if (entry.clientName) {
      clients.add(entry.clientName);
      clientHours[entry.clientName] = (clientHours[entry.clientName] || 0) + (entry.minutes || 0);
    }
  });

  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
  const workDays = getWorkDaysInMonth(month, year);
  const averageHoursPerDay = workDays > 0 ? Math.round((totalHours / workDays) * 10) / 10 : 0;

  // מציאת הלקוח עם הכי הרבה שעות
  let topClient = null;
  let maxHours = 0;
  Object.entries(clientHours).forEach(([client, minutes]) => {
    const hours = minutes / 60;
    if (hours > maxHours) {
      maxHours = hours;
      topClient = { name: client, hours: Math.round(hours * 10) / 10 };
    }
  });

  return {
    month,
    year,
    monthName: getMonthNameHebrew(month),
    totalEntries: monthEntries.length,
    totalMinutes,
    totalHours,
    workDays,
    averageHoursPerDay,
    uniqueClients: clients.size,
    topClient,
    isEmpty: false
  };
}

/**
 * חישוב סטטיסטיקה מלאה לתקצוב משימות לפי חודש
 * @param {Array} allTasks - כל המשימות
 * @param {number} month - חודש (0-11)
 * @param {number} year - שנה
 * @returns {Object}
 */
function calculateMonthlyBudgetStats(allTasks, month, year) {
  const startDate = getMonthStart(month, year);
  const endDate = getMonthEnd(month, year);

  // משימות שנוצרו בחודש
  const createdTasks = filterTasksByDateRange(allTasks, startDate, endDate, 'createdDate');
  // משימות שהושלמו בחודש
  const completedTasks = filterTasksByDateRange(allTasks, startDate, endDate, 'completedDate');

  if (createdTasks.length === 0 && completedTasks.length === 0) {
    return {
      month,
      year,
      monthName: getMonthNameHebrew(month),
      tasksCreated: 0,
      tasksCompleted: 0,
      totalPlannedMinutes: 0,
      totalActualMinutes: 0,
      totalPlannedHours: 0,
      totalActualHours: 0,
      averageCompletionTime: 0,
      overBudgetTasks: 0,
      completionRate: 0,
      isEmpty: true
    };
  }

  let totalPlannedMinutes = 0;
  let totalActualMinutes = 0;
  let overBudgetCount = 0;

  completedTasks.forEach(task => {
    const planned = task.estimatedMinutes || 0;
    const actual = task.actualMinutes || 0;

    totalPlannedMinutes += planned;
    totalActualMinutes += actual;

    if (actual > planned * 1.1 && planned > 0) {
      overBudgetCount++;
    }
  });

  const totalPlannedHours = Math.round((totalPlannedMinutes / 60) * 10) / 10;
  const totalActualHours = Math.round((totalActualMinutes / 60) * 10) / 10;

  // חישוב זמן השלמה ממוצע (מיצירה להשלמה)
  let totalCompletionDays = 0;
  let tasksWithBothDates = 0;

  completedTasks.forEach(task => {
    if (task.createdDate && task.completedDate) {
      const created = new Date(task.createdDate);
      const completed = new Date(task.completedDate);
      const days = Math.ceil((completed - created) / (1000 * 60 * 60 * 24));
      totalCompletionDays += days;
      tasksWithBothDates++;
    }
  });

  const averageCompletionTime = tasksWithBothDates > 0
    ? Math.round(totalCompletionDays / tasksWithBothDates)
    : 0;

  // אחוז השלמה
  const completionRate = createdTasks.length > 0
    ? Math.round((completedTasks.length / createdTasks.length) * 100)
    : 0;

  return {
    month,
    year,
    monthName: getMonthNameHebrew(month),
    tasksCreated: createdTasks.length,
    tasksCompleted: completedTasks.length,
    totalPlannedMinutes,
    totalActualMinutes,
    totalPlannedHours,
    totalActualHours,
    averageCompletionTime,
    overBudgetTasks: overBudgetCount,
    completionRate,
    isEmpty: false
  };
}

/**
 * חישוב סטטיסטיקה לשנה שלמה
 * @param {Array} allData - כל הנתונים
 * @param {number} year - שנה
 * @param {string} dataType - 'timesheet' או 'budget'
 * @returns {Object}
 */
function calculateYearlyStats(allData, year, dataType = 'timesheet') {
  const monthlyStats = [];

  // חישוב סטטיסטיקה לכל חודש בשנה
  for (let month = 0; month < 12; month++) {
    const monthStats = dataType === 'timesheet'
      ? calculateMonthlyTimesheetStats(allData, month, year)
      : calculateMonthlyBudgetStats(allData, month, year);

    monthlyStats.push(monthStats);
  }

  // חישוב סיכום שנתי
  if (dataType === 'timesheet') {
    const totalHours = monthlyStats.reduce((sum, m) => sum + m.totalHours, 0);
    const totalEntries = monthlyStats.reduce((sum, m) => sum + m.totalEntries, 0);
    const averageMonthlyHours = Math.round((totalHours / 12) * 10) / 10;

    return {
      year,
      dataType,
      monthlyStats,
      summary: {
        totalHours: Math.round(totalHours * 10) / 10,
        totalEntries,
        averageMonthlyHours,
        bestMonth: monthlyStats.reduce((best, current) =>
          current.totalHours > best.totalHours ? current : best
        ),
        worstMonth: monthlyStats.reduce((worst, current) =>
          current.totalHours < worst.totalHours && current.totalHours > 0 ? current : worst
        )
      }
    };
  } else {
    const totalCreated = monthlyStats.reduce((sum, m) => sum + m.tasksCreated, 0);
    const totalCompleted = monthlyStats.reduce((sum, m) => sum + m.tasksCompleted, 0);
    const totalHours = monthlyStats.reduce((sum, m) => sum + m.totalActualHours, 0);
    const averageMonthlyTasks = Math.round(totalCompleted / 12);

    return {
      year,
      dataType,
      monthlyStats,
      summary: {
        totalCreated,
        totalCompleted,
        totalHours: Math.round(totalHours * 10) / 10,
        averageMonthlyTasks,
        overallCompletionRate: totalCreated > 0
          ? Math.round((totalCompleted / totalCreated) * 100)
          : 0,
        bestMonth: monthlyStats.reduce((best, current) =>
          current.tasksCompleted > best.tasksCompleted ? current : best
        ),
        worstMonth: monthlyStats.reduce((worst, current) =>
          current.tasksCompleted < worst.tasksCompleted && current.tasksCompleted > 0 ? current : worst
        )
      }
    };
  }
}

/**
 * חישוב סטטיסטיקה לטווח תאריכים מותאם אישית
 * @param {Array} allData - כל הנתונים
 * @param {Date} startDate - תאריך התחלה
 * @param {Date} endDate - תאריך סיום
 * @param {string} dataType - 'timesheet' או 'budget'
 * @returns {Object}
 */
function calculateRangeStats(allData, startDate, endDate, dataType = 'timesheet') {
  const rangeData = dataType === 'timesheet'
    ? filterTimesheetByDateRange(allData, startDate, endDate)
    : filterTasksByDateRange(allData, startDate, endDate, 'completedDate');

  const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

  if (dataType === 'timesheet') {
    const totalMinutes = rangeData.reduce((sum, e) => sum + (e.minutes || 0), 0);
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
    const averagePerDay = days > 0 ? Math.round((totalHours / days) * 10) / 10 : 0;

    const clients = new Set();
    rangeData.forEach(entry => {
      if (entry.clientName) clients.add(entry.clientName);
    });

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      days,
      dataType,
      totalEntries: rangeData.length,
      totalHours,
      averagePerDay,
      uniqueClients: clients.size
    };
  } else {
    const totalPlanned = rangeData.reduce((sum, t) => sum + (t.estimatedMinutes || 0), 0) / 60;
    const totalActual = rangeData.reduce((sum, t) => sum + (t.actualMinutes || 0), 0) / 60;
    const overBudget = rangeData.filter(t =>
      (t.actualMinutes || 0) > (t.estimatedMinutes || 0) * 1.1 && (t.estimatedMinutes || 0) > 0
    ).length;

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      days,
      dataType,
      tasksCompleted: rangeData.length,
      totalPlannedHours: Math.round(totalPlanned * 10) / 10,
      totalActualHours: Math.round(totalActual * 10) / 10,
      overBudgetTasks: overBudget,
      averagePerDay: days > 0 ? Math.round((rangeData.length / days) * 10) / 10 : 0
    };
  }
}

// ===== השוואה בין תקופות =====

/**
 * השוואה בין שני חודשים
 * @param {Array} allData - כל הנתונים
 * @param {number} month1 - חודש ראשון (0-11)
 * @param {number} year1 - שנה ראשונה
 * @param {number} month2 - חודש שני (0-11)
 * @param {number} year2 - שנה שנייה
 * @param {string} dataType - 'timesheet' או 'budget'
 * @returns {Object}
 */
function compareMonths(allData, month1, year1, month2, year2, dataType = 'timesheet') {
  const stats1 = dataType === 'timesheet'
    ? calculateMonthlyTimesheetStats(allData, month1, year1)
    : calculateMonthlyBudgetStats(allData, month1, year1);

  const stats2 = dataType === 'timesheet'
    ? calculateMonthlyTimesheetStats(allData, month2, year2)
    : calculateMonthlyBudgetStats(allData, month2, year2);

  if (dataType === 'timesheet') {
    const hoursDiff = stats2.totalHours - stats1.totalHours;
    const hoursGrowth = stats1.totalHours > 0
      ? Math.round(((stats2.totalHours - stats1.totalHours) / stats1.totalHours) * 100)
      : 0;

    const entriesDiff = stats2.totalEntries - stats1.totalEntries;
    const entriesGrowth = stats1.totalEntries > 0
      ? Math.round(((stats2.totalEntries - stats1.totalEntries) / stats1.totalEntries) * 100)
      : 0;

    return {
      period1: `${stats1.monthName} ${year1}`,
      period2: `${stats2.monthName} ${year2}`,
      dataType,
      stats1,
      stats2,
      comparison: {
        hoursDifference: Math.round(hoursDiff * 10) / 10,
        hoursGrowthPercent: hoursGrowth,
        entriesDifference: entriesDiff,
        entriesGrowthPercent: entriesGrowth,
        averageDailyDifference: Math.round((stats2.averageHoursPerDay - stats1.averageHoursPerDay) * 10) / 10,
        clientsDifference: stats2.uniqueClients - stats1.uniqueClients,
        improvement: hoursDiff > 0 ? 'שיפור' : hoursDiff < 0 ? 'ירידה' : 'ללא שינוי'
      }
    };
  } else {
    const completedDiff = stats2.tasksCompleted - stats1.tasksCompleted;
    const completedGrowth = stats1.tasksCompleted > 0
      ? Math.round(((stats2.tasksCompleted - stats1.tasksCompleted) / stats1.tasksCompleted) * 100)
      : 0;

    const hoursDiff = stats2.totalActualHours - stats1.totalActualHours;
    const hoursGrowth = stats1.totalActualHours > 0
      ? Math.round(((stats2.totalActualHours - stats1.totalActualHours) / stats1.totalActualHours) * 100)
      : 0;

    return {
      period1: `${stats1.monthName} ${year1}`,
      period2: `${stats2.monthName} ${year2}`,
      dataType,
      stats1,
      stats2,
      comparison: {
        tasksCompletedDifference: completedDiff,
        tasksCompletedGrowth: completedGrowth,
        hoursDifference: Math.round(hoursDiff * 10) / 10,
        hoursGrowthPercent: hoursGrowth,
        completionRateDifference: stats2.completionRate - stats1.completionRate,
        overBudgetDifference: stats2.overBudgetTasks - stats1.overBudgetTasks,
        improvement: completedDiff > 0 ? 'שיפור' : completedDiff < 0 ? 'ירידה' : 'ללא שינוי'
      }
    };
  }
}

// ===== מדדי ביצועים ומגמות =====

/**
 * חישוב אחוז גידול
 * @param {number} oldValue - ערך ישן
 * @param {number} newValue - ערך חדש
 * @returns {number} אחוז גידול
 */
function calculateGrowthRate(oldValue, newValue) {
  if (oldValue === 0) return newValue > 0 ? 100 : 0;
  return Math.round(((newValue - oldValue) / oldValue) * 100);
}

/**
 * זיהוי מגמה (עולה/יורדת/יציבה) מרשימת ערכים
 * @param {Array<number>} values - מערך ערכים
 * @returns {Object}
 */
function identifyTrend(values) {
  if (!values || values.length < 2) {
    return { trend: 'unknown', confidence: 0 };
  }

  let increases = 0;
  let decreases = 0;

  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[i - 1]) increases++;
    else if (values[i] < values[i - 1]) decreases++;
  }

  const total = values.length - 1;
  const increasePercent = (increases / total) * 100;
  const decreasePercent = (decreases / total) * 100;

  let trend = 'stable';
  let confidence = 0;

  if (increasePercent > 60) {
    trend = 'increasing';
    confidence = Math.round(increasePercent);
  } else if (decreasePercent > 60) {
    trend = 'decreasing';
    confidence = Math.round(decreasePercent);
  } else {
    trend = 'stable';
    confidence = Math.round(Math.max(increasePercent, decreasePercent));
  }

  return { trend, confidence };
}

/**
 * חישוב ממוצע נע (Moving Average) - מחליק תנודות
 * @param {Array<number>} values - מערך ערכים
 * @param {number} window - גודל חלון (כמה ערכים לממוצע)
 * @returns {Array<number>}
 */
function calculateMovingAverage(values, window = 3) {
  if (!values || values.length < window) return values;

  const result = [];

  for (let i = 0; i <= values.length - window; i++) {
    const sum = values.slice(i, i + window).reduce((a, b) => a + b, 0);
    result.push(Math.round((sum / window) * 10) / 10);
  }

  return result;
}

// ===== ייצוא לשימוש גלובלי =====
window.ReportsModule = {
  // פונקציות עזר - תאריכים
  isDateInRange,
  getMonthStart,
  getMonthEnd,
  getYearStart,
  getYearEnd,
  getMonthNameHebrew,
  getWorkDaysInMonth,

  // סינון וחיתוך
  filterTimesheetByDateRange,
  filterTasksByDateRange,
  filterByClient,
  filterTasksByStatus,

  // קיבוץ
  groupTimesheetByMonth,
  groupTasksByMonth,
  groupByClientName,

  // חישובי סטטיסטיקה
  calculateMonthlyTimesheetStats,
  calculateMonthlyBudgetStats,
  calculateYearlyStats,
  calculateRangeStats,

  // השוואה
  compareMonths,

  // מדדי ביצועים
  calculateGrowthRate,
  identifyTrend,
  calculateMovingAverage
};

// Production mode - no console logs
