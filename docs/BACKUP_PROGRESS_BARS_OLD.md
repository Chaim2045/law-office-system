# גיבוי Progress Bars (Deprecated - מוחלף ב-SVG Rings)

## תאריך גיבוי: 27 אוקטובר 2025

**סטטוס:** ❌ Deprecated - הוחלף ב-SVG Rings System

---

## קוד JS שנמחק (budget-tasks.js lines 361-527)

```javascript
// חישוב בר התקדמות היעד
const createdAt = safeTask.createdAt ? new Date(safeTask.createdAt) : now;
const totalDays = Math.max(1, (deadline - createdAt) / (1000 * 60 * 60 * 24));
const elapsedDays = (now - createdAt) / (1000 * 60 * 60 * 24);
const deadlineProgress = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));
const isDeadlineOverdue = daysUntilDeadline < 0;
const overdueDays = Math.abs(Math.min(0, daysUntilDeadline));

// Progress section HTML
${isOverOriginal && !isCompleted ? `
  <!-- בר עם חריגה -->
  <div class="budget-with-overage">
    <div class="budget-bar-label">
      <span class="budget-icon"><i class="fas fa-clock"></i></span>
      <span class="budget-text">תקציב זמן</span>
    </div>
    <div class="linear-visual-progress">
      <div class="linear-progress-bar">
        <div class="linear-progress-fill complete" style="width: 100%"></div>
      </div>
      <div class="linear-progress-text">
        <span class="progress-percentage">100%</span>
        <span class="progress-status">${Math.round(originalEstimate / 60 * 10) / 10}h מתוכנן</span>
      </div>
    </div>
    <!-- בר חריגה -->
    <div class="overage-bar-container">
      <div class="overage-bar-label">
        <span class="overage-icon"><i class="fas fa-exclamation-triangle"></i></span>
        <span class="overage-text">חריגת זמן</span>
      </div>
      <div class="overage-progress-bar">
        <div class="overage-progress-fill" style="width: ${Math.min(overagePercent, 100)}%"></div>
      </div>
      <div class="overage-progress-text">
        <span class="overage-amount">+${Math.round(overageMinutes / 60 * 10) / 10}h חריגה</span>
        ${!wasAdjusted ? `<button class="update-budget-btn" onclick="event.stopPropagation(); manager.showAdjustBudgetDialog('${safeTask.id}')"><i class="fas fa-edit"></i> עדכן תקציב</button>` : ''}
      </div>
    </div>
    ${wasAdjusted ? `<div class="budget-adjusted-note"><i class="fas fa-info-circle"></i> תקציב עודכן ל-${estimatedHours}h</div>` : ''}
  </div>
` : `
  <!-- תקציב רגיל (לא חרג) -->
  <div class="linear-visual-progress">
    <div class="linear-progress-text">
      <span class="progress-percentage">${progress}%</span>
      <span class="progress-status">${safeText ? safeText(progressStatus) : progressStatus}</span>
    </div>
    <div class="linear-progress-bar">
      <div class="linear-progress-fill ${progressClass}" style="width: ${Math.min(progress, 100)}%"></div>
    </div>
  </div>
`}

// Deadline progress bar
${!isCompleted ? `
  <div class="deadline-progress-container">
    <div class="deadline-progress-bar">
      <div class="deadline-progress-fill ${isDeadlineOverdue ? 'overdue' : ''}" style="width: 100%"></div>
    </div>
    <div class="deadline-progress-text">
      ${isDeadlineOverdue
        ? `<span class="deadline-overdue-text">100% • היעד הגיע</span>`
        : `<span class="deadline-days-left">${daysUntilDeadline} ${daysUntilDeadline === 1 ? 'יום' : 'ימים'} נותרו • ${deadlineProgress}%</span>`
      }
    </div>
    ${isDeadlineOverdue ? `
    <!-- בר איחור -->
    <div class="deadline-overage-container">
      <div class="deadline-overage-bar-label">
        <span class="deadline-overage-icon"><i class="fas fa-calendar-times"></i></span>
        <span class="deadline-overage-text">איחור</span>
      </div>
      <div class="deadline-overage-bar">
        <div class="deadline-overage-fill" style="width: ${Math.min((overdueDays / Math.max(totalDays, 1)) * 100, 100)}%"></div>
      </div>
      <div class="deadline-overage-text-info">
        <span class="deadline-overage-amount">+${overdueDays} ${overdueDays === 1 ? 'יום' : 'ימים'} איחור</span>
        <button class="extend-deadline-btn" onclick="event.stopPropagation(); manager.showExtendDeadlineDialog('${safeTask.id}')"><i class="fas fa-calendar-plus"></i> הארך יעד</button>
      </div>
    </div>
    ` : ''}
  </div>
` : ''}
```

---

## קוד CSS שנמחק (style-hitech-addon.css lines 278-569)

```css
/* ===============================================
   DEADLINE PROGRESS BAR - בר התקדמות יעד
   =============================================== */

.deadline-progress-container {
  margin-top: 8px;
  direction: rtl;
}

.deadline-progress-bar {
  width: 100%;
  height: 8px;
  background: #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
  position: relative;
}

.deadline-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981 0%, #059669 100%);
  border-radius: 10px;
  transition: width 0.3s ease, background 0.3s ease;
  position: relative;
}

.deadline-progress-fill.overdue {
  background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%);
}

/* אנימציה לבר */
.deadline-progress-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.3) 50%,
    transparent 100%
  );
  animation: shimmerSlide 2s infinite;
}

.deadline-progress-text {
  margin-top: 4px;
  font-size: 11px;
  color: #6b7280;
  text-align: right;
  font-weight: 500;
}

.deadline-overdue-text {
  color: #dc2626;
  font-weight: 600;
}

.deadline-days-left {
  color: #059669;
}

/* ===============================================
   BUDGET OVERAGE BAR - בר חריגת תקציב
   =============================================== */

.budget-with-overage {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.budget-bar-label,
.overage-bar-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 4px;
}

.budget-icon {
  color: #3b82f6;
}

.overage-icon {
  color: #ef4444;
}

/* בר חריגה */
.overage-bar-container {
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px dashed #e5e7eb;
}

.overage-progress-bar {
  width: 100%;
  height: 8px;
  background: #fee2e2;
  border-radius: 10px;
  overflow: hidden;
  position: relative;
  margin-top: 6px;
}

.overage-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%);
  border-radius: 10px;
  transition: width 0.3s ease;
  position: relative;
}

/* אנימציה לבר חריגה */
.overage-progress-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.4) 50%,
    transparent 100%
  );
  animation: shimmerSlide 2s infinite;
}

.overage-progress-text {
  margin-top: 4px;
  font-size: 11px;
  color: #dc2626;
  text-align: right;
  font-weight: 600;
  direction: rtl;
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: flex-end;
}

/* Update Budget Button - כפתור עדכון תקציב */
.update-budget-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 4px rgba(245, 158, 11, 0.2);
  white-space: nowrap;
}

.update-budget-btn:hover {
  background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(245, 158, 11, 0.3);
}

.update-budget-btn:active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(245, 158, 11, 0.2);
}

.update-budget-btn i {
  font-size: 10px;
}

/* בר 100% עם סגנון complete */
.linear-progress-fill.complete {
  background: linear-gradient(90deg, #10b981 0%, #059669 100%);
}

/* ===============================================
   DEADLINE OVERAGE BAR - בר איחור יעד
   =============================================== */

.deadline-overage-container {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #fee2e2;
}

.deadline-overage-bar-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 6px;
  direction: rtl;
}

.deadline-overage-icon {
  color: #ef4444;
}

.deadline-overage-text {
  color: #dc2626;
}

.deadline-overage-bar {
  width: 100%;
  height: 8px;
  background: #fee2e2;
  border-radius: 10px;
  overflow: hidden;
  position: relative;
}

.deadline-overage-fill {
  height: 100%;
  background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%);
  border-radius: 10px;
  transition: width 0.3s ease;
  position: relative;
}

/* אנימציה לבר איחור */
.deadline-overage-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.4) 50%,
    transparent 100%
  );
  animation: shimmerSlide 2s infinite;
}

.deadline-overage-text-info {
  margin-top: 4px;
  font-size: 11px;
  color: #dc2626;
  text-align: right;
  font-weight: 600;
  direction: rtl;
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: flex-end;
}

/* Extend Deadline Button - כפתור הארכת יעד */
.extend-deadline-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 4px rgba(239, 68, 68, 0.2);
  white-space: nowrap;
}

.extend-deadline-btn:hover {
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(239, 68, 68, 0.3);
}

.extend-deadline-btn:active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(239, 68, 68, 0.2);
}

.extend-deadline-btn i {
  font-size: 10px;
}
```

---

## סיבת ההחלפה

הקוד הישן (progress bars) הוחלף ב-SVG Rings מסיבות הבאות:

1. **בלבול ויזואלי** - שני ברים ירוקים דומים (תקציב + יעד)
2. **חווית משתמש** - SVG Rings מרשימים יותר ומבדילים בין metrics
3. **מודרניות** - טכנולוגיה מתקדמת יותר
4. **Responsiveness** - Rings עובדים טוב יותר במובייל

---

**להשבת הקוד הישן:** העתק מכאן בחזרה למיקומים המקוריים
**הקובץ נשמר:** `docs/BACKUP_PROGRESS_BARS_OLD.md`
