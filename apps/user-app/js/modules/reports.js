/**
 * Reports Module - מודול דוחות
 * Law Office Management System
 *
 * תיאור: מודול לניהול וייצור דוחות - חודשיים, שנתיים, השוואתיים ומותאמים אישית
 *
 * פונקציות עיקריות:
 * - אתחול טפסי דוחות
 * - ייצור דוחות לפי סוג (חודשי/שנתי/טווח/השוואה)
 * - ייצוא והדפסת דוחות
 * - ניהול תצוגה וממשק משתמש
 *
 * תלויות:
 * - ReportsModule (מודול חישובים סטטיסטיים)
 * - DOM elements (reportsDataType, reportsType, reportsResults וכו')
 *
 * @version 1.0.0
 * @created 2025-10-15
 */

// ============================================================================
// אתחול וטפסים
// ============================================================================

/**
 * אתחול טופס הדוחות
 * - מילוי רשימות שנים (5 שנים אחורה + שנה קדימה)
 * - הגדרת חודש ושנה נוכחיים
 * - הוספת event listeners
 */
LawOfficeManager.prototype.initReportsForm = function() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // Populate year dropdowns (last 5 years + next year)
  const yearSelects = ['reportsYear', 'reportsYear1', 'reportsYear2'];
  yearSelects.forEach(selectId => {
    const select = document.getElementById(selectId);
    if (select) {
      select.innerHTML = '';
      for (let year = currentYear - 5; year <= currentYear + 1; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === currentYear) {
option.selected = true;
}
        select.appendChild(option);
      }
    }
  });

  // Set current month
  const monthSelects = ['reportsMonth', 'reportsMonth1', 'reportsMonth2'];
  monthSelects.forEach(selectId => {
    const select = document.getElementById(selectId);
    if (select) {
select.value = currentMonth;
}
  });

  // Set up event listeners for report type changes
  const reportsType = document.getElementById('reportsType');
  if (reportsType) {
    reportsType.addEventListener('change', this.handleReportTypeChange.bind(this));
  }
};

/**
 * טיפול בשינוי סוג הדוח
 * מציג/מסתיר שדות רלוונטיים לפי סוג הדוח שנבחר
 */
LawOfficeManager.prototype.handleReportTypeChange = function() {
  const reportType = document.getElementById('reportsType').value;
  const monthSelect = document.getElementById('monthSelect');
  const rangeDates = document.getElementById('rangeDates');
  const comparisonDates = document.getElementById('comparisonDates');

  // Hide all optional sections
  if (monthSelect) {
monthSelect.style.display = reportType === 'monthly' ? 'block' : 'none';
}
  if (rangeDates) {
rangeDates.style.display = reportType === 'range' ? 'grid' : 'none';
}
  if (comparisonDates) {
comparisonDates.style.display = reportType === 'comparison' ? 'grid' : 'none';
}
};

// ============================================================================
// ייצור דוחות - פונקציה ראשית
// ============================================================================

/**
 * ייצור דוח לפי הגדרות הטופס
 * פונקציה ראשית שמפנה לפונקציות ספציפיות לפי סוג הדוח
 */
LawOfficeManager.prototype.generateReport = function() {
  const dataType = document.getElementById('reportsDataType').value;
  const reportType = document.getElementById('reportsType').value;
  const resultsContainer = document.getElementById('reportsResults');

  if (!resultsContainer) {
return;
}

  // Show loading
  resultsContainer.innerHTML = `
    <div class="reports-loading">
      <div class="reports-loading-spinner"></div>
      <div class="reports-loading-text">מכין דוח...</div>
    </div>
  `;

  // Get the appropriate data
  const allData = dataType === 'timesheet' ? this.timesheetEntries : this.budgetTasks;

  setTimeout(() => {
    let reportHTML = '';

    try {
      if (reportType === 'monthly') {
        reportHTML = this.generateMonthlyReport(allData, dataType);
      } else if (reportType === 'yearly') {
        reportHTML = this.generateYearlyReport(allData, dataType);
      } else if (reportType === 'range') {
        reportHTML = this.generateRangeReport(allData, dataType);
      } else if (reportType === 'comparison') {
        reportHTML = this.generateComparisonReport(allData, dataType);
      }

      resultsContainer.innerHTML = reportHTML;

      // Show export button
      const exportBtn = document.getElementById('exportReportBtn');
      if (exportBtn) {
exportBtn.style.display = 'flex';
}

    } catch (error) {
      console.error('Error generating report:', error);
      resultsContainer.innerHTML = `
        <div class="reports-empty-state">
          <i class="fas fa-exclamation-triangle"></i>
          <div class="reports-empty-state-title">שגיאה ביצירת הדוח</div>
          <div class="reports-empty-state-text">${error.message}</div>
        </div>
      `;
    }
  }, 500);
};

// ============================================================================
// דוח חודשי
// ============================================================================

/**
 * ייצור דוח חודשי
 * @param {Array} allData - כל הנתונים (שעתון או משימות)
 * @param {string} dataType - 'timesheet' או 'budget'
 * @returns {string} HTML של הדוח
 */
LawOfficeManager.prototype.generateMonthlyReport = function(allData, dataType) {
  const month = parseInt(document.getElementById('reportsMonth').value);
  const year = parseInt(document.getElementById('reportsYear').value);

  const stats = dataType === 'timesheet'
    ? ReportsModule.calculateMonthlyTimesheetStats(allData, month, year)
    : ReportsModule.calculateMonthlyBudgetStats(allData, month, year);

  if (stats.isEmpty) {
    return `
      <div class="reports-empty-state">
        <i class="fas fa-calendar-times"></i>
        <div class="reports-empty-state-title">אין נתונים לתקופה זו</div>
        <div class="reports-empty-state-text">לא נמצאו נתונים עבור ${stats.monthName} ${year}</div>
      </div>
    `;
  }

  // Summary cards
  let summaryHTML = '<div class="reports-summary">';

  if (dataType === 'timesheet') {
    summaryHTML += `
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">סה"כ רשומות</div>
          <div class="reports-summary-card-icon blue"><i class="fas fa-list"></i></div>
        </div>
        <div class="reports-summary-card-value">${stats.totalEntries}</div>
        <div class="reports-summary-card-subtitle">רשומות שעתון</div>
      </div>
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">סה"כ שעות</div>
          <div class="reports-summary-card-icon green"><i class="fas fa-clock"></i></div>
        </div>
        <div class="reports-summary-card-value">${stats.totalHours}h</div>
        <div class="reports-summary-card-subtitle">${stats.totalMinutes} דקות</div>
      </div>
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">ממוצע יומי</div>
          <div class="reports-summary-card-icon yellow"><i class="fas fa-chart-line"></i></div>
        </div>
        <div class="reports-summary-card-value">${stats.averageHoursPerDay}h</div>
        <div class="reports-summary-card-subtitle">לפי ${stats.workDays} ימי עבודה</div>
      </div>
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">לקוחות</div>
          <div class="reports-summary-card-icon purple"><i class="fas fa-users"></i></div>
        </div>
        <div class="reports-summary-card-value">${stats.uniqueClients}</div>
        <div class="reports-summary-card-subtitle">לקוחות ייחודיים</div>
      </div>
    `;
  } else {
    summaryHTML += `
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">נוצרו</div>
          <div class="reports-summary-card-icon blue"><i class="fas fa-plus-circle"></i></div>
        </div>
        <div class="reports-summary-card-value">${stats.tasksCreated}</div>
        <div class="reports-summary-card-subtitle">משימות חדשות</div>
      </div>
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">הושלמו</div>
          <div class="reports-summary-card-icon green"><i class="fas fa-check-circle"></i></div>
        </div>
        <div class="reports-summary-card-value">${stats.tasksCompleted}</div>
        <div class="reports-summary-card-subtitle">${stats.completionRate}% אחוז השלמה</div>
      </div>
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">שעות בפועל</div>
          <div class="reports-summary-card-icon yellow"><i class="fas fa-clock"></i></div>
        </div>
        <div class="reports-summary-card-value">${stats.totalActualHours}h</div>
        <div class="reports-summary-card-subtitle">מתוך ${stats.totalPlannedHours}h מתוכנן</div>
      </div>
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">זמן השלמה</div>
          <div class="reports-summary-card-icon purple"><i class="fas fa-hourglass-half"></i></div>
        </div>
        <div class="reports-summary-card-value">${stats.averageCompletionTime}</div>
        <div class="reports-summary-card-subtitle">ימים בממוצע</div>
      </div>
    `;
  }

  summaryHTML += '</div>';

  return `
    <div class="reports-section">
      <div class="reports-section-header">
        <div class="reports-section-title">
          <i class="fas fa-calendar-alt"></i>
          דוח חודשי - ${stats.monthName} ${year}
        </div>
      </div>
      ${summaryHTML}
    </div>
  `;
};

// ============================================================================
// דוח שנתי
// ============================================================================

/**
 * ייצור דוח שנתי
 * @param {Array} allData - כל הנתונים (שעתון או משימות)
 * @param {string} dataType - 'timesheet' או 'budget'
 * @returns {string} HTML של הדוח
 */
LawOfficeManager.prototype.generateYearlyReport = function(allData, dataType) {
  const year = parseInt(document.getElementById('reportsYear').value);
  const yearStats = ReportsModule.calculateYearlyStats(allData, year, dataType);

  let summaryHTML = '<div class="reports-summary">';

  if (dataType === 'timesheet') {
    summaryHTML += `
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">סה"כ שנתי</div>
          <div class="reports-summary-card-icon blue"><i class="fas fa-clock"></i></div>
        </div>
        <div class="reports-summary-card-value">${yearStats.summary.totalHours}h</div>
        <div class="reports-summary-card-subtitle">${yearStats.summary.totalEntries} רשומות</div>
      </div>
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">ממוצע חודשי</div>
          <div class="reports-summary-card-icon green"><i class="fas fa-chart-bar"></i></div>
        </div>
        <div class="reports-summary-card-value">${yearStats.summary.averageMonthlyHours}h</div>
        <div class="reports-summary-card-subtitle">לחודש</div>
      </div>
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">חודש מוביל</div>
          <div class="reports-summary-card-icon yellow"><i class="fas fa-trophy"></i></div>
        </div>
        <div class="reports-summary-card-value">${yearStats.summary.bestMonth.totalHours}h</div>
        <div class="reports-summary-card-subtitle">${yearStats.summary.bestMonth.monthName}</div>
      </div>
    `;
  } else {
    summaryHTML += `
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">הושלמו</div>
          <div class="reports-summary-card-icon blue"><i class="fas fa-check-circle"></i></div>
        </div>
        <div class="reports-summary-card-value">${yearStats.summary.totalCompleted}</div>
        <div class="reports-summary-card-subtitle">משימות</div>
      </div>
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">אחוז השלמה</div>
          <div class="reports-summary-card-icon green"><i class="fas fa-percent"></i></div>
        </div>
        <div class="reports-summary-card-value">${yearStats.summary.overallCompletionRate}%</div>
        <div class="reports-summary-card-subtitle">מכלל המשימות</div>
      </div>
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">חודש מוביל</div>
          <div class="reports-summary-card-icon yellow"><i class="fas fa-trophy"></i></div>
        </div>
        <div class="reports-summary-card-value">${yearStats.summary.bestMonth.tasksCompleted}</div>
        <div class="reports-summary-card-subtitle">${yearStats.summary.bestMonth.monthName}</div>
      </div>
    `;
  }

  summaryHTML += '</div>';

  // Monthly breakdown table
  let tableHTML = `
    <div class="reports-table-wrapper">
      <table class="reports-table">
        <thead>
          <tr>
            <th>חודש</th>
  `;

  if (dataType === 'timesheet') {
    tableHTML += `
            <th>רשומות</th>
            <th>שעות</th>
            <th>ממוצע יומי</th>
            <th>לקוחות</th>
    `;
  } else {
    tableHTML += `
            <th>נוצרו</th>
            <th>הושלמו</th>
            <th>שעות</th>
            <th>אחוז השלמה</th>
    `;
  }

  tableHTML += '</tr></thead><tbody>';

  yearStats.monthlyStats.forEach(month => {
    if (month.isEmpty) {
return;
}

    tableHTML += `<tr>
      <td class="reports-table-highlight">${month.monthName}</td>
    `;

    if (dataType === 'timesheet') {
      tableHTML += `
        <td>${month.totalEntries}</td>
        <td class="reports-table-highlight">${month.totalHours}h</td>
        <td>${month.averageHoursPerDay}h</td>
        <td>${month.uniqueClients}</td>
      `;
    } else {
      tableHTML += `
        <td>${month.tasksCreated}</td>
        <td class="reports-table-highlight">${month.tasksCompleted}</td>
        <td>${month.totalActualHours}h</td>
        <td><span class="reports-table-badge ${month.completionRate >= 80 ? 'success' : month.completionRate >= 50 ? 'info' : 'warning'}">${month.completionRate}%</span></td>
      `;
    }

    tableHTML += '</tr>';
  });

  tableHTML += '</tbody></table></div>';

  return `
    <div class="reports-section">
      <div class="reports-section-header">
        <div class="reports-section-title">
          <i class="fas fa-calendar"></i>
          דוח שנתי - ${year}
        </div>
      </div>
      ${summaryHTML}
      ${tableHTML}
    </div>
  `;
};

// ============================================================================
// דוח לפי טווח תאריכים
// ============================================================================

/**
 * ייצור דוח לפי טווח תאריכים מותאם אישית
 * @param {Array} allData - כל הנתונים (שעתון או משימות)
 * @param {string} dataType - 'timesheet' או 'budget'
 * @returns {string} HTML של הדוח
 */
LawOfficeManager.prototype.generateRangeReport = function(allData, dataType) {
  const startDate = new Date(document.getElementById('reportsStartDate').value);
  const endDate = new Date(document.getElementById('reportsEndDate').value);

  if (!startDate || !endDate || isNaN(startDate) || isNaN(endDate)) {
    return `
      <div class="reports-empty-state">
        <i class="fas fa-calendar-times"></i>
        <div class="reports-empty-state-title">נא לבחור תאריכים</div>
        <div class="reports-empty-state-text">יש לבחור תאריך התחלה וסיום</div>
      </div>
    `;
  }

  const stats = ReportsModule.calculateRangeStats(allData, startDate, endDate, dataType);

  const startDateStr = startDate.toLocaleDateString('he-IL');
  const endDateStr = endDate.toLocaleDateString('he-IL');

  let summaryHTML = '<div class="reports-summary">';

  if (dataType === 'timesheet') {
    summaryHTML += `
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">רשומות</div>
          <div class="reports-summary-card-icon blue"><i class="fas fa-list"></i></div>
        </div>
        <div class="reports-summary-card-value">${stats.totalEntries}</div>
        <div class="reports-summary-card-subtitle">סה"כ</div>
      </div>
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">שעות</div>
          <div class="reports-summary-card-icon green"><i class="fas fa-clock"></i></div>
        </div>
        <div class="reports-summary-card-value">${stats.totalHours}h</div>
        <div class="reports-summary-card-subtitle">סה"כ</div>
      </div>
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">ממוצע יומי</div>
          <div class="reports-summary-card-icon yellow"><i class="fas fa-chart-line"></i></div>
        </div>
        <div class="reports-summary-card-value">${stats.averagePerDay}h</div>
        <div class="reports-summary-card-subtitle">לפי ${stats.days} ימים</div>
      </div>
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">לקוחות</div>
          <div class="reports-summary-card-icon purple"><i class="fas fa-users"></i></div>
        </div>
        <div class="reports-summary-card-value">${stats.uniqueClients}</div>
        <div class="reports-summary-card-subtitle">ייחודיים</div>
      </div>
    `;
  } else {
    summaryHTML += `
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">הושלמו</div>
          <div class="reports-summary-card-icon blue"><i class="fas fa-check-circle"></i></div>
        </div>
        <div class="reports-summary-card-value">${stats.tasksCompleted}</div>
        <div class="reports-summary-card-subtitle">משימות</div>
      </div>
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">שעות בפועל</div>
          <div class="reports-summary-card-icon green"><i class="fas fa-clock"></i></div>
        </div>
        <div class="reports-summary-card-value">${stats.totalActualHours}h</div>
        <div class="reports-summary-card-subtitle">מתוך ${stats.totalPlannedHours}h מתוכנן</div>
      </div>
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">ממוצע יומי</div>
          <div class="reports-summary-card-icon yellow"><i class="fas fa-chart-line"></i></div>
        </div>
        <div class="reports-summary-card-value">${stats.averagePerDay}</div>
        <div class="reports-summary-card-subtitle">משימות ליום</div>
      </div>
      <div class="reports-summary-card">
        <div class="reports-summary-card-header">
          <div class="reports-summary-card-title">חריגות</div>
          <div class="reports-summary-card-icon purple"><i class="fas fa-exclamation-triangle"></i></div>
        </div>
        <div class="reports-summary-card-value">${stats.overBudgetTasks}</div>
        <div class="reports-summary-card-subtitle">חורגות תקציב</div>
      </div>
    `;
  }

  summaryHTML += '</div>';

  return `
    <div class="reports-section">
      <div class="reports-section-header">
        <div class="reports-section-title">
          <i class="fas fa-calendar-week"></i>
          דוח מותאם - ${startDateStr} עד ${endDateStr}
        </div>
      </div>
      ${summaryHTML}
    </div>
  `;
};

// ============================================================================
// דוח השוואתי
// ============================================================================

/**
 * ייצור דוח השוואה בין שתי תקופות
 * @param {Array} allData - כל הנתונים (שעתון או משימות)
 * @param {string} dataType - 'timesheet' או 'budget'
 * @returns {string} HTML של הדוח
 */
LawOfficeManager.prototype.generateComparisonReport = function(allData, dataType) {
  const month1 = parseInt(document.getElementById('reportsMonth1').value);
  const year1 = parseInt(document.getElementById('reportsYear1').value);
  const month2 = parseInt(document.getElementById('reportsMonth2').value);
  const year2 = parseInt(document.getElementById('reportsYear2').value);

  const comparison = ReportsModule.compareMonths(allData, month1, year1, month2, year2, dataType);

  const comparisonHTML = `
    <div class="reports-comparison">
      <div class="reports-comparison-period">
        <div class="reports-comparison-period-title">תקופה 1</div>
        <div class="reports-comparison-period-value">${comparison.period1}</div>
      </div>
      <div class="reports-comparison-arrow">
        <i class="fas fa-exchange-alt"></i>
      </div>
      <div class="reports-comparison-period">
        <div class="reports-comparison-period-title">תקופה 2</div>
        <div class="reports-comparison-period-value">${comparison.period2}</div>
      </div>
    </div>
  `;

  let detailsHTML = '<div class="reports-comparison-details">';

  if (dataType === 'timesheet') {
    const comp = comparison.comparison;
    detailsHTML += `
      <div class="reports-comparison-item">
        <div class="reports-comparison-item-label">הפרש שעות</div>
        <div class="reports-comparison-item-value ${comp.hoursDifference > 0 ? 'positive' : comp.hoursDifference < 0 ? 'negative' : 'neutral'}">
          ${comp.hoursDifference > 0 ? '+' : ''}${comp.hoursDifference}h
          <span style="font-size: 14px">(${comp.hoursGrowthPercent > 0 ? '+' : ''}${comp.hoursGrowthPercent}%)</span>
        </div>
      </div>
      <div class="reports-comparison-item">
        <div class="reports-comparison-item-label">הפרש רשומות</div>
        <div class="reports-comparison-item-value ${comp.entriesDifference > 0 ? 'positive' : comp.entriesDifference < 0 ? 'negative' : 'neutral'}">
          ${comp.entriesDifference > 0 ? '+' : ''}${comp.entriesDifference}
          <span style="font-size: 14px">(${comp.entriesGrowthPercent > 0 ? '+' : ''}${comp.entriesGrowthPercent}%)</span>
        </div>
      </div>
      <div class="reports-comparison-item">
        <div class="reports-comparison-item-label">ממוצע יומי</div>
        <div class="reports-comparison-item-value ${comp.averageDailyDifference > 0 ? 'positive' : comp.averageDailyDifference < 0 ? 'negative' : 'neutral'}">
          ${comp.averageDailyDifference > 0 ? '+' : ''}${comp.averageDailyDifference}h
        </div>
      </div>
      <div class="reports-comparison-item">
        <div class="reports-comparison-item-label">מגמה</div>
        <div class="reports-comparison-item-value ${comp.improvement === 'שיפור' ? 'positive' : comp.improvement === 'ירידה' ? 'negative' : 'neutral'}">
          ${comp.improvement}
        </div>
      </div>
    `;
  } else {
    const comp = comparison.comparison;
    detailsHTML += `
      <div class="reports-comparison-item">
        <div class="reports-comparison-item-label">הפרש משימות</div>
        <div class="reports-comparison-item-value ${comp.tasksCompletedDifference > 0 ? 'positive' : comp.tasksCompletedDifference < 0 ? 'negative' : 'neutral'}">
          ${comp.tasksCompletedDifference > 0 ? '+' : ''}${comp.tasksCompletedDifference}
          <span style="font-size: 14px">(${comp.tasksCompletedGrowth > 0 ? '+' : ''}${comp.tasksCompletedGrowth}%)</span>
        </div>
      </div>
      <div class="reports-comparison-item">
        <div class="reports-comparison-item-label">הפרש שעות</div>
        <div class="reports-comparison-item-value ${comp.hoursDifference > 0 ? 'positive' : comp.hoursDifference < 0 ? 'negative' : 'neutral'}">
          ${comp.hoursDifference > 0 ? '+' : ''}${comp.hoursDifference}h
          <span style="font-size: 14px">(${comp.hoursGrowthPercent > 0 ? '+' : ''}${comp.hoursGrowthPercent}%)</span>
        </div>
      </div>
      <div class="reports-comparison-item">
        <div class="reports-comparison-item-label">אחוז השלמה</div>
        <div class="reports-comparison-item-value ${comp.completionRateDifference > 0 ? 'positive' : comp.completionRateDifference < 0 ? 'negative' : 'neutral'}">
          ${comp.completionRateDifference > 0 ? '+' : ''}${comp.completionRateDifference}%
        </div>
      </div>
      <div class="reports-comparison-item">
        <div class="reports-comparison-item-label">מגמה</div>
        <div class="reports-comparison-item-value ${comp.improvement === 'שיפור' ? 'positive' : comp.improvement === 'ירידה' ? 'negative' : 'neutral'}">
          ${comp.improvement}
        </div>
      </div>
    `;
  }

  detailsHTML += '</div>';

  return `
    <div class="reports-section">
      <div class="reports-section-header">
        <div class="reports-section-title">
          <i class="fas fa-balance-scale"></i>
          השוואה בין תקופות
        </div>
      </div>
      ${comparisonHTML}
      ${detailsHTML}
    </div>
  `;
};

// ============================================================================
// ניהול טופס
// ============================================================================

/**
 * איפוס טופס הדוחות למצב התחלתי
 */
LawOfficeManager.prototype.resetReportsForm = function() {
  const resultsContainer = document.getElementById('reportsResults');
  if (resultsContainer) {
resultsContainer.innerHTML = '';
}

  const exportBtn = document.getElementById('exportReportBtn');
  if (exportBtn) {
exportBtn.style.display = 'none';
}

  // Reset to defaults
  this.initReportsForm();

  // Reset report type to monthly
  const reportsType = document.getElementById('reportsType');
  if (reportsType) {
    reportsType.value = 'monthly';
    this.handleReportTypeChange();
  }
};

// ============================================================================
// ייצוא והדפסה
// ============================================================================

/**
 * ייצוא דוח (הדפסה באמצעות window.print)
 */
LawOfficeManager.prototype.exportReport = function() {
  window.print();
};
