# 📊 Workload Analytics Module

מודול מבודד לניתוח וחיזוי עומס עבודה של עובדים במשרד עורכי דין.

## 📁 מבנה הקבצים

```
workload-analytics/
├── WorkloadCalculator.js  - מנוע חישוב עומס (Pure Logic)
├── WorkloadService.js     - שליפת נתונים מ-Firestore
├── WorkloadCard.js        - רכיב UI להצגה
└── README.md             - תיעוד זה
```

## 🎯 מטרת המודול

המודול מספק:
1. **חישוב אוטומטי של עומס עבודה** - ציון 0-100 לכל עובד
2. **חיזוי זמינות** - מתי עובד יהיה פנוי למשימה חדשה
3. **זיהוי משימות בסיכון** - משימות עם דדליינים קרובים
4. **התראות אוטומטיות** - עומס קריטי, דדליינים דחופים
5. **סטטיסטיקות צוות** - ממוצעים ותובנות

## 🔧 איך זה עובד?

### זרימת נתונים:

```
Firestore Collections
    ├─ budget_tasks         (משימות)
    ├─ timesheet_entries    (רישומי זמן)
    └─ employees            (עובדים)
         ↓
WorkloadService.fetchEmployeeTasks()
         ↓
WorkloadCalculator.calculateWorkload()
         ↓
WorkloadCard.render()
         ↓
Admin Panel Dashboard
```

### מדדי עומס (ציון 0-100):

```javascript
workloadScore = (
    normalizedBacklog      × 35% +  // כמות עבודה שנותרה
    normalizedUrgency      × 30% +  // דחיפות דדליינים
    normalizedTaskCount    × 15% +  // מספר משימות מקבילות
    normalizedCapacity     × 20%    // ניצול קיבולת חודשית
)
```

### רמות עומס:

- `0-29%`   → **Low** (זמין)
- `30-59%`  → **Medium** (עומס בינוני)
- `60-84%`  → **High** (עומס גבוה)
- `85-100%` → **Critical** (עומס קריטי!)

## 📊 דוגמאות שימוש

### שימוש בסיסי ב-DashboardUI:

```javascript
// בדשבורד - אוטומטי
await this.renderWorkloadAnalytics();
```

### חישוב עומס ידני לעובד בודד:

```javascript
const metrics = await window.WorkloadService.calculateEmployeeWorkload(
    'user@example.com'
);

console.log(metrics.workloadScore);      // 72
console.log(metrics.workloadLevel);      // "high"
console.log(metrics.totalBacklogHours);  // 32.5
console.log(metrics.riskyTasks);         // Array של משימות בסיכון
```

### סטטיסטיקות צוות:

```javascript
const workloadMap = await window.WorkloadService.calculateAllEmployeesWorkload(employees);
const teamStats = window.WorkloadService.calculateTeamStats(workloadMap);

console.log(teamStats.averageScore);     // 64
console.log(teamStats.criticalCount);    // 2
console.log(teamStats.availableCount);   // 5
```

### מציאת עובדים זמינים:

```javascript
const available = window.WorkloadService.findAvailableEmployees(
    workloadMap,
    70  // מקסימום 70% עומס
);

// available = [
//   { email: "user1@...", workloadScore: 32, availableHoursToday: 5.2 },
//   { email: "user2@...", workloadScore: 45, availableHoursToday: 3.8 },
//   ...
// ]
```

## 🎨 עיצוב UI

הרכיב כולל:

- **כרטיסים צבעוניים** - לכל עובד לפי רמת עומס
- **סרגלי התקדמות** - עם אנימציה
- **התראות** - אייקונים ו-badges
- **משימות בסיכון** - רשימה מסודרת לפי דחיפות
- **תצוגת Grid/List** - מעבר בין תצוגות
- **Responsive** - מותאם למובייל

### דוגמת פלט HTML:

```html
<div class="employee-workload-card" data-level="high">
    <div class="employee-name">יעל כהן</div>
    <div class="workload-badge">72%</div>
    <div class="workload-bar">
        <div class="workload-fill" style="width: 72%; background: #f97316"></div>
    </div>
    <div class="workload-details">...</div>
    <div class="workload-alerts">...</div>
    <div class="risky-tasks-section">...</div>
</div>
```

## 🚀 התקנה ואינטגרציה

### 1. הוסף CSS ל-index.html:

```html
<link rel="stylesheet" href="css/workload-analytics.css?v=VERSION">
```

### 2. הוסף Scripts ל-index.html:

```html
<script src="js/workload-analytics/WorkloadCalculator.js?v=VERSION"></script>
<script src="js/workload-analytics/WorkloadService.js?v=VERSION"></script>
<script src="js/workload-analytics/WorkloadCard.js?v=VERSION"></script>
```

### 3. אתחל במקרה של dashboard:ready:

```javascript
if (window.WorkloadService && window.WorkloadCard) {
    window.WorkloadService.init();
    window.WorkloadCard.init();
}
```

### 4. רנדר ב-DashboardUI:

```javascript
await this.renderWorkloadAnalytics();
```

## 🔐 אבטחה

- **אין תלות בספריות חיצוניות** - רק vanilla JavaScript
- **Sanitization** - כל טקסט מנוקה מ-XSS
- **Firebase Security Rules** - גישה רק למשימות של העובד עצמו
- **Cache מבודד** - TTL של 5 דקות

## 📈 ביצועים

- **טעינה ראשונית:** ~2-3 שניות (תלוי במספר עובדים)
- **Cache:** 5 דקות
- **Queries בודדים:** ~200-500ms לעובד
- **Parallel queries:** כל העובדים במקביל

### אופטימיזציה:

```javascript
// כבר ממומש - כל העובדים במקביל
const promises = employees.map(emp =>
    this.calculateEmployeeWorkload(emp.email, emp)
);
await Promise.all(promises);
```

## 🔄 תחזוקה ושדרוגים

### גרסה 1.0.0 (2025-12-30):
- ✅ חישוב עומס בסיסי
- ✅ זיהוי משימות בסיכון
- ✅ חיזוי זמינות
- ✅ UI מלא עם Grid/List views
- ✅ התראות אוטומטיות

### גרסאות עתידיות (מתוכננות):

#### v1.1.0 - Historical Tracking:
- 📊 שמירת snapshots יומיים ב-Firestore
- 📈 גרפים של עומס לאורך זמן
- 🔮 למידת מכונה מדפוסים היסטוריים

#### v1.2.0 - Smart Assignment:
- 🤖 המלצות הקצאה אוטומטית
- ⚖️ איזון עומס צוות
- 🎯 התאמת משימות למיומנויות

#### v1.3.0 - Cloud Functions:
- ☁️ חישובים כבדים ב-server
- ⏱️ עדכונים כל 15 דקות
- 📬 Push notifications לעומס קריטי

## 🐛 Troubleshooting

### הרכיב לא נטען:

```javascript
// בדוק ב-console:
console.log(window.WorkloadCalculator); // צריך להיות Function
console.log(window.WorkloadService);    // צריך להיות Object
console.log(window.WorkloadCard);       // צריך להיות Object
```

### Cache לא מתרענן:

```javascript
// נקה cache ידנית:
window.WorkloadService.clearCache();
```

### שגיאות Firestore:

- וודא שהמשתמש מחובר
- בדוק Firebase Security Rules
- בדוק indexes ב-Firestore

## 📞 תמיכה

- **Issues:** דווח בגיטהאב
- **שאלות:** צור issue עם תגית `workload-analytics`
- **תיעוד נוסף:** ראה `WORK_PLAN.md` בשורש הפרויקט

---

נוצר ב-2025-12-30 | גרסה 1.0.0 | Made with ❤️ for משרד עו״ד גיא הרשקוביץ
