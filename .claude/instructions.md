# 📋 Law Office System - Claude Work Instructions

**תאריך:** אוקטובר 2025
**גרסה:** 2.0
**Owner:** Chaim

---

## 🎯 קרא את זה קודם!

כל Claude שעובד על הפרויקט הזה **חייב** לקרוא את הקובץ הזה לפני כל עבודה!

---

# ⚠️ 0. עקרונות מקצועיות - קריטי!

## 🚫 אסור בהחלט:

### ❌ פלסטרים (Quick Fixes)
```javascript
// ❌ אסור!
if (something) {
  // TODO: תיקון זמני, נתקן אחר כך
  return hardcodedValue;
}

// ✅ נכון!
// פתרון מלא, נכון, מתוכנן היטב
```

### ❌ קוד "זול" או זמני
```javascript
// ❌ אסור!
"בוא נעשה את זה עכשיו ואחר כך נשפר"
"זה פתרון זמני אבל יעבוד"
"TODO: צריך לתקן את זה"

// ✅ נכון!
"הפתרון שלי מושלם ומוכן לייצור"
"הקוד נקי, מתועד, ועובד לטווח ארוך"
```

### ❌ "בוא נתקן אחר כך"
```javascript
// ❌ אסור לומר:
"זה עובד אבל צריך לשפר..."
"בינתיים זה מספיק..."
"אפשר להוסיף את זה מאוחר יותר..."

// ✅ נכון לומר:
"הפתרון מוכן ומושלם"
"הכל עובד כמו שצריך"
"הקוד באיכות ייצור"
```

### ❌ יצירת קבצים חדשים במקום עריכת קיימים
```javascript
// ❌ אסור בהחלט!
// צריך להוסיף CSS לכפתור → יוצר קובץ חדש:
Write: "buttons-new.css"        // בשורש! ❌
Write: "style-addon.css"        // בשורש! ❌
Write: "fix.js"                 // בשורש! ❌

// ✅ נכון!
// צריך להוסיף CSS לכפתור:
1. Glob: "**/*button*.css"      // מצא את הקובץ הנכון
2. Read: "css/buttons.css"      // קרא אותו
3. Edit: הוסף את הקוד בקובץ הקיים!

// ✅ אם אין קובץ מתאים - שים במקום הנכון!
Write: "css/new-feature.css"    // לא בשורש!
Write: "js/modules/new-module.js"  // לא בשורש!
```

### ❌ קבצים בשורש הפרויקט
```javascript
// ❌ אסור בהחלט!
Write: "my-new-file.js"         // בשורש! ❌
Write: "temp.css"               // בשורש! ❌
Write: "fix-bug.js"             // בשורש! ❌

// ✅ נכון - תיקייה מתאימה!
Write: "js/modules/my-new-file.js"
Write: "css/temp-feature.css"
Write: "js/modules/bug-fix.js"

// ⚠️ יוצאים מהכלל (מותר בשורש):
- index.html (כבר קיים)
- README.md (כבר קיים)
- config files (package.json, tsconfig.json - כבר קיימים)
```

---

## ✅ חובה:

### 1. **איכות מהפעם הראשונה**
- כל קוד שאתה כותב = איכות ייצור
- לא shortcuts, לא workarounds
- פתרון מלא ומושלם

### 2. **חשיבה ארוכת טווח**
- לא פתרונות זמניים
- קוד שיחזיק מעמד שנים
- הרחבה עתידית מובנית

### 3. **חפש קודם, צור אחר כך**
```javascript
// ✅ תהליך נכון:
1. חפש אם קיים קובץ דומה:
   Glob: "**/*relevant*.{js,ts,css}"

2. אם קיים → קרא ועדכן:
   Read: "path/to/existing-file.js"
   Edit: old_code → new_code

3. אם לא קיים → צור במקום הנכון:
   Write: "js/modules/new-file.js"  // לא בשורש!

// ❌ תהליך שגוי:
1. Write: "new-file.js"  // יצירה מיידית בשורש!
```

**כלל זהב:** אל תיצור קובץ חדש לפני ש**חיפשת** אם יש כבר!

### 4. **תמיד לשאול אם לא בטוח**
```javascript
// אם אתה לא בטוח איך לעשות נכון:
"יש לי שתי אפשרויות:
 A. פתרון X עם יתרונות...
 B. פתרון Y עם יתרונות...
 איזה אתה מעדיף?"

// במקום:
"אני אעשה את זה ככה (גם אם לא מושלם)..."
```

### 5. **עקביות מלאה**
- עקוב אחרי הארכיטקטורה הקיימת
- אותם patterns בכל הפרויקט
- אל תצור "איים" של קוד שונה

### 6. **תיעוד מלא** ⭐ (חובה!)
```javascript
// ✅ תמיד הוסף:
- JSDoc לפונקציות חדשות
- Comments להסבר לוגיקה מורכבת
- README אם מודול גדול
- דוגמאות שימוש
```

**🆕 חובת תיעוד מסודר (נוסף 4 נובמבר 2025):**

אחרי כל שינוי משמעותי, **חובה** ליצור קובץ תיעוד ב:
```
.claude/work-documentation/YYYY-MM-DD_description.md
```

**מבנה קובץ התיעוד:**
```markdown
# תיעוד עבודה: [נושא]

**תאריך:** DD חודש YYYY
**נושא:** תיאור קצר
**מבצע:** Claude / [שם]
**מאושר על ידי:** [שם]

---

## 📋 סיכום ביצועי
[מה נעשה בקצרה]

## 📂 קבצים שנערכו
### 1. קובץ ראשון
**מיקום:** שורות X-Y
**סוג שינוי:** [עיצוב/לוגיקה/תיקון]
[פירוט השינויים]

### 2. קובץ שני
...

## 🔍 בדיקת כפילויות
[האם נבדקו כפילויות? מה התוצאות?]

## ✅ עבודה לפי כללי פרויקט
[אילו כללים נשמרו]

## 📊 מדדים
[לפני/אחרי, השפעה]

## 🚀 פריסה
[פקודות deployment אם רלוונטי]

## 📝 הערות ותובנות
[לקחים, המלצות]
```

**מתי לתעד?**
- ✅ אחרי שינוי שמשפיע על 2+ קבצים
- ✅ אחרי תיקון באג משמעותי
- ✅ אחרי הוספת פיצ'ר חדש
- ✅ אחרי רפקטור גדול
- ✅ אחרי deployment לproduction
- ✅ אחרי שינוי בCloud Functions

**לא צריך לתעד:**
- ❌ שינויים קוסמטיים קטנים (צבע, spacing)
- ❌ תיקון typo בודד
- ❌ עדכון comment בודד

---

## 🎯 הגישה הנכונה:

```javascript
// כשמקבל בקשה:

1. ✅ הבן את הדרישה לעומק
2. ✅ חשוב על הפתרון הכי טוב (לא הכי מהיר!)
3. ✅ בדוק אם יש דרך יותר טובה
4. ✅ תכנן את הקוד (structure, naming, architecture)
5. ✅ כתוב קוד מושלם מהפעם הראשונה
6. ✅ בדוק שזה עובד מצוין
7. ✅ תעד אם צריך
8. ✅ commit נקי ומקצועי

// ❌ לא ככה:
1. כתוב משהו מהר שעובד
2. "בוא נתקן אחר כך"
3. TODO בקוד
```

---

## 💎 סטנדרטים גבוהים:

### קוד:
- ✅ נקי, קריא, מתועד
- ✅ DRY (Don't Repeat Yourself)
- ✅ SOLID principles
- ✅ עקבי עם הפרויקט
- ✅ ללא hardcoded values
- ✅ עם error handling מלא

### ארכיטקטורה:
- ✅ EventBus לתקשורת
- ✅ FirebaseService לשרת
- ✅ מודולריות
- ✅ separation of concerns
- ✅ לא coupling

### ביצועים:
- ✅ אופטימיזציה מובנית
- ✅ לא memory leaks
- ✅ efficient algorithms
- ✅ לא polling מיותר

---

## 🚨 אם אתה לא יכול לעשות מושלם:

```
"אני לא בטוח שאני יכול לעשות את זה מושלם כרגע.
 יש כמה דרכים:

 A. [פתרון מושלם] - אבל דורש X, Y, Z
 B. [פתרון חלופי] - עם trade-offs האלה...

 מה אתה מעדיף?"
```

**אסור לעשות:** לכתוב קוד לא מושלם בלי להגיד!

---

# 1. מבנה הפרויקט - סקירה מהירה

```
law-office-system/
├── js/                     ← הקוד הראשי (JavaScript + TypeScript)
│   ├── core/              ← ארכיטקטורה מרכזית
│   │   └── event-bus.ts   ← EventBus v2.0 ⭐ (המאזין המרכזי!)
│   ├── services/          ← שירותים
│   │   └── firebase-service.ts ← FirebaseService ⭐ (כל קריאות Firebase!)
│   ├── schemas/           ← Zod validation schemas
│   └── modules/           ← 45+ מודולים (כל אחד עושה דבר אחד)
├── css/                   ← עיצוב (15 קבצי CSS)
├── dist/                  ← קבצים מקומפלים מ-TypeScript (אל תערוך!)
├── docs/                  ← תיעוד (55 קבצי markdown)
├── functions/             ← Firebase Backend (שרת)
├── admin/                 ← ממשק ניהול
├── images/                ← תמונות
└── index.html             ← נקודת כניסה ראשית (51KB)
```

---

# 2. ארכיטקטורה - גרסה 2.0 (חדש!)

## ✅ השתמש תמיד ב:

### EventBus (js/core/event-bus.ts)
```typescript
// ✅ טוב - תקשורת בין מודולים
EventBus.emit('client:selected', {
  clientId: '123',
  clientName: 'יוחנן כהן'
});

EventBus.on('client:selected', (data) => {
  console.log('לקוח נבחר:', data.clientName);
});

// יש 60+ אירועים מוגדרים:
// - ClientEvents: client:selected, client:created, client:updated, client:deleted
// - TaskEvents: task:created, task:updated, task:completed, task:budget-adjusted
// - TimesheetEvents: timesheet:entry-created, entry-updated, entry-deleted
// - BudgetEvents: budget:warning-80, budget:warning-100, budget:overrun
// - UIEvents: ui:dialog-opened, ui:notification-shown, ui:tab-changed
// - SelectorEvents: selector:budget-cleared, selector:timesheet-cleared
// - SystemEvents: system:error, system:data-loaded, system:cache-updated
```

### 🎓 מדריך שימוש מלא ב-EventBus

#### 📌 מתי להשתמש?

**1. כשרוצים להוסיף feature חדש:**
```javascript
// ✅ לא צריך לערוך קוד קיים - רק תיצור קובץ חדש!
// js/modules/analytics.js (קובץ חדש)

window.EventBus.on('task:created', (data) => {
  Analytics.track('task_created', {
    clientName: data.clientName,
    employee: data.employee
  });
});

window.EventBus.on('task:completed', (data) => {
  Analytics.track('task_completed', {
    taskId: data.taskId,
    duration: data.totalMinutes
  });
});
```

**2. כשרוצים להגיב לפעולה במערכת:**
```javascript
// ✅ הודעות אוטומטיות
EventBus.on('task:urgent', (data) => {
  NotificationSystem.show(`🚨 משימה דחופה: ${data.clientName}!`, 'warning');
  sendEmailToManager(data);
});

// ✅ עדכון סטטיסטיקות
EventBus.on('task:created', (data) => {
  updateTaskCount();
  refreshDashboard();
});
```

#### 📝 איך להוסיף אירוע חדש?

**שלב 1: הגדרה ב-EventBus.ts**
```typescript
// js/core/event-bus.ts - הוסף את האירוע החדש!

export interface TaskEvents {
  'task:created': { ... };
  'task:completed': { ... };
  'task:assigned': {          // ← אירוע חדש!
    taskId: string;
    assignedTo: string;
    assignedBy: string;
    deadline: string;
  };
}
```

**שלב 2: שדר את האירוע (emit)**
```javascript
// js/main.js - במקום שהפעולה קורה

async function assignTask(taskId, employeeEmail) {
  // 1. עדכן ב-Firebase
  await firebase.firestore()
    .collection('budget_tasks')
    .doc(taskId)
    .update({ assignedTo: employeeEmail });

  // 2. שדר אירוע! 📤
  window.EventBus.emit('task:assigned', {
    taskId: taskId,
    assignedTo: employeeEmail,
    assignedBy: currentUser.email,
    deadline: task.deadline
  });
}
```

**שלב 3: האזן לאירוע (on)**
```javascript
// js/modules/notifications.js - קובץ מאזין

window.EventBus.on('task:assigned', (data) => {
  // הצג הודעה
  NotificationSystem.show(
    `📋 משימה חדשה הוקצתה לך על ידי ${data.assignedBy}`,
    'info'
  );

  Logger.log(`👂 [Notifications] Task assigned: ${data.taskId}`);
});

// js/modules/statistics.js - מאזין נוסף

window.EventBus.on('task:assigned', (data) => {
  updateTaskAssignmentStats();
  Logger.log(`📊 [Statistics] Task ${data.taskId} assigned`);
});
```

**שלב 4: בדוק שזה עובד!**
```javascript
// Console (F12):

// בדוק את הזרימה
await EventAnalyzer.analyze()
EventAnalyzer.visualizeFlow('task:assigned')

// צפוי לראות:
// 📤 EMITTERS: js/main.js
// 👂 LISTENERS: js/modules/notifications.js, js/modules/statistics.js
```

#### 🧪 דיבאג ובדיקה:

```javascript
// 1. בדוק אילו אירועים יש במערכת
await EventAnalyzer.analyze()
EventAnalyzer.printReport()

// 2. בדוק אירוע ספציפי
EventAnalyzer.visualizeFlow('task:created')

// 3. בדוק אם יש בעיות
EventAnalyzer.getRecommendations()

// 4. שדר אירוע ידנית לבדיקה
EventBus.emit('task:created', {
  taskId: 'TEST-123',
  clientName: 'בדיקה',
  employee: 'test@test.com'
});
```

#### ⚠️ חשוב לזכור:

**✅ עשה:**
- תמיד הוסף הגדרה ל-EventBus.ts לפני שימוש
- השתמש בשמות ברורים: `task:created` לא `task:new`
- הוסף Logger.log() בכל listener לדיבאג
- בדוק עם EventAnalyzer אחרי כל שינוי

**❌ אל תעשה:**
- לא לשלוח אירועים ללא הגדרה
- לא לשכוח payload מלא
- לא ליצור listeners כפולים
- לא לשכוח try/catch

#### 📚 מסמכים נוספים:
- `docs/EVENTBUS_MIGRATION_GUIDE.md` - מדריך המיגרציה המלא
- `docs/FEATURE_PLANNING_TEMPLATE.md` - תבנית תכנון feature
- `js/modules/event-analyzer.js` - כלי ניתוח אירועים

#### 🎯 דוגמאות נוספות:

**דוגמה 1: התראות חכמות**
```javascript
EventBus.on('task:budget-adjusted', (data) => {
  const percentage = (data.newEstimate / data.oldEstimate - 1) * 100;

  if (percentage > 50) {
    NotificationSystem.show(
      `⚠️ תקציב גדל ב-${percentage.toFixed(0)}%!`,
      'warning'
    );
  }
});
```

**דוגמה 2: לוגיקה מותנית**
```javascript
EventBus.on('client:selected', (data) => {
  if (isVIPClient(data.clientId)) {
    // טען היסטוריה מלאה
    loadFullClientHistory(data.clientId);
    showVIPBadge();
  } else {
    // טען רק מידע בסיסי
    loadBasicClientInfo(data.clientId);
  }
});
```

**דוגמה 3: שרשור אירועים**
```javascript
// אירוע אחד מפעיל אירוע אחר
EventBus.on('task:completed', async (data) => {
  const task = await getTask(data.taskId);

  if (task.subtasks && task.subtasks.length > 0) {
    // אם יש תת-משימות - שדר אירוע נוסף
    EventBus.emit('task:all-subtasks-completed', {
      parentTaskId: data.taskId,
      totalTime: task.totalTime
    });
  }
});
```

---

### FirebaseService (js/services/firebase-service.ts)
```typescript
// ✅ טוב - קריאות Firebase עם retry, cache, validation
const result = await FirebaseService.call('createClient', data, {
  retries: 3,
  timeout: 10000
});

// תכונות:
// - Automatic retry (3 ניסיונות)
// - Response caching
// - Rate limiting (10 req/sec)
// - Request deduplication
// - Performance monitoring
```

---

## ❌ אל תשתמש ב:

### קוד ישן v1.0 (Deprecated!)
```javascript
// ❌ רע - תלות ישירה (אל תשתמש!)
window.ClientCaseSelectorsManager?.clearBudget();
window.budgetModule?.updateClient(clientId);

// ❌ רע - קריאות ישירות ל-Firebase (אל תשתמש!)
await firebase.functions().httpsCallable('createClient')(data);
```

**הסיבה:** עברנו לארכיטקטורה מנותקת (Event-Driven) עם שכבת Firebase מרוכזת.

---

# 3. כללי עבודה חשובים

## 📁 איפה לשים קוד חדש?

### מודול חדש:
```
js/modules/your-module.js      ← קוד המודול
css/your-module.css            ← עיצוב (אם צריך)
docs/YOUR_MODULE_GUIDE.md      ← תיעוד (אם גדול)
```

### פונקציה קטנה:
- אם קשורה לתקציב → `js/modules/budget-tasks.js`
- אם קשורה לשעתון → `js/modules/timesheet-manager.js`
- אם קשורה ללקוחות → `js/cases.js` או `js/modules/client-case-selector.js`
- אם כללית → `js/modules/utilities.js`

### TypeScript חדש:
```
js/core/your-file.ts           ← קוד TypeScript
npm run compile-ts             ← קמפל ל-JavaScript
dist/js/core/your-file.js      ← הפלט (אוטומטי)
```

---

## 🎨 CSS - איפה לשים?

```
css/style.css                  ← הקובץ הראשי (גדול: 12,528 שורות)
css/buttons.css                ← כפתורים
css/forms.css                  ← טפסים
css/modals.css                 ← חלונות קופצים
css/tables.css                 ← טבלאות
css/notifications.css          ← התראות
... ועוד 10 קבצים מודולריים
```

**הערה:** הפרויקט במעבר הדרגתי מ-style.css ענק למודולים קטנים.

---

## 📝 Commits - איך לכתוב?

```bash
# תבנית:
<emoji> <type>: <description>

# דוגמאות:
✨ Feature: Add duplicate task button
🐛 Fix: תיקון באג תצוגת שעתון
🧹 Cleanup: Remove 17 old backup files
📝 Docs: Update EventBus guide
♻️ Refactor: Migrate timesheet to v2.0
🎨 Style: Improve button colors

# Emoji Guide:
✨ Feature (פיצ'ר חדש)
🐛 Fix (תיקון באג)
🧹 Cleanup (ניקיון)
📝 Docs (תיעוד)
♻️ Refactor (רפקטור)
🎨 Style (עיצוב)
🔒 Security (אבטחה)
⚡ Performance (ביצועים)
🚀 Deploy (פריסה)
```

**תמיד הוסף בסוף:**
```
🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

# 4. תהליך עבודה מומלץ

## כשמבקשים פיצ'ר חדש:

### שלב 1: הבנה וחיפוש
```javascript
// השתמש בכלים:
Glob: "**/*related-name*.{js,ts}"
Grep: "function-name|class-name"
Read: "path/to/similar-file.js"

// בדוק:
- האם יש משהו דומה כבר?
- איפה זה צריך להשתלב?
- איזה אירועים EventBus להשתמש?
```

### שלב 2: תכנון
```javascript
// תשאל את עצמך:
1. איפה הקוד הזה שייך? (js/modules/...?)
2. האם צריך CSS? (css/...?)
3. האם צריך אירוע EventBus חדש?
4. האם צריך קריאת Firebase? (דרך FirebaseService!)
5. האם צריך validation? (schemas/index.ts)
```

### שלב 3: ביצוע
```javascript
// סדר פעולות:
1. צור/ערוך את הקוד (js/modules/...)
2. הוסף CSS אם צריך (css/...)
3. עדכן index.html אם צריך (script tags)
4. צור commit נקי
5. הצע למשתמש לבדוק
```

### שלב 4: בדיקה
```javascript
// בדוק:
- EventBus.getStats() - סטטיסטיקות
- FirebaseService.getStats() - סטטיסטיקות Firebase
- קונסול - אין שגיאות
- פונקציונליות - עובד כמצופה
```

---

# 5. קבצים חשובים

## אל תערוך:
- `dist/**/*` - קבצים מקומפלים (יוצרים אוטומטית)
- `node_modules/**/*` - ספריות חיצוניות
- `.git/**/*` - Git repository

## אל תמחק:
- `js/core/event-bus.ts` - ליבת המערכת!
- `js/services/firebase-service.ts` - שכבת Firebase!
- `js/main.js` - קובץ ראשי (1,486 שורות)
- `index.html` - נקודת כניסה
- `package.json` - dependencies

## ניתן לערוך:
- `js/modules/**/*.js` - כל המודולים
- `css/**/*.css` - כל העיצוב
- `docs/**/*.md` - כל התיעוד
- `js/*.js` - קבצים ראשיים (בזהירות!)

---

# 6. מוסכמות (Conventions)

## שמות משתנים:
```javascript
// camelCase
const clientName = "יוחנן כהן";
const taskId = "task-123";

// PascalCase למחלקות
class BudgetManager { }
class TimesheetManager { }
```

## שמות פונקציות:
```javascript
// פעולות CRUD
createClient()
updateClient()
deleteClient()
getClientById()

// UI
showModal()
hideModal()
renderTable()
updateDisplay()

// EventBus
EventBus.emit()
EventBus.on()
```

## שמות אירועים EventBus:
```javascript
// תבנית: category:action
'client:selected'
'task:created'
'timesheet:entry-updated'
'budget:warning-80'
'ui:notification-shown'
'system:error'
```

---

# 7. תיעוד - איפה לחפש?

```
docs/EVENT_BUS_GUIDE.md              ← מדריך EventBus מלא
docs/FIREBASE_SERVICE_GUIDE.md       ← מדריך FirebaseService מלא
docs/MIGRATION_GUIDE.md              ← איך לעבור מ-v1.0 ל-v2.0
docs/TESTING_GUIDE.md                ← איך לבדוק
docs/ARCHITECTURE_REFACTOR_PLAN.md   ← תוכנית ארכיטקטורה
README.md                            ← Overview כללי
README_ARCHITECTURE_v2.md            ← ארכיטקטורה v2.0 (בדוקס)
```

---

# 8. טיפים לעבודה יעילה

## ✅ כדאי:
1. **חפש קודם** - Glob/Grep לפני שיוצרים משהו חדש
2. **השתמש ב-EventBus** - לתקשורת בין מודולים
3. **השתמש ב-FirebaseService** - לקריאות Firebase
4. **הוסף תיעוד** - לפיצ'רים גדולים
5. **צור commits נקיים** - עם emoji ותיאור ברור
6. **בדוק בקונסול** - EventBus.getStats(), אין שגיאות
7. **שאל הבהרות** - אם משהו לא ברור

## ❌ אל תעשה:
1. **אל תשתמש בקוד v1.0 הישן** - window.*, קריאות ישירות ל-Firebase
2. **אל תערוך dist/** - זה אוטומטי
3. **אל תיצור כפילויות** - חפש אם יש כבר
4. **אל תשכח commits** - תמיד commit אחרי שינוי
5. **אל תמחק מבלי לבדוק** - וודא שזה לא בשימוש

---

# 9. Debug Mode

## איך להפעיל:
```javascript
// בקונסול או ב-index.html
EventBus.setDebugMode(true);
FirebaseService.setDebugMode(true);

// תראה:
📤 [EventBus] Emitting: client:selected
📥 [EventBus] Subscribed to: client:selected
✅ [EventBus] client:selected completed in 0.87ms (3 listeners)

🚀 [FirebaseService] Calling: createClient
✅ [FirebaseService] Success: createClient (2.3s)
```

## סטטיסטיקות:
```javascript
EventBus.getStats();
// {
//   totalEventsEmitted: 1523,
//   totalListeners: 15,
//   averageEmitTime: 0.87ms,
//   errors: 0
// }

FirebaseService.getStats();
// {
//   totalCalls: 89,
//   cacheHits: 23,
//   averageCallTime: 2.1s,
//   errors: 2
// }
```

---

# 10. תרחישים נפוצים

## תרחיש 1: הוספת פיצ'ר חדש
```javascript
// 1. חפש קוד דומה
Glob: "**/*similar-feature*.js"

// 2. צור מודול חדש
js/modules/new-feature.js

// 3. השתלב עם EventBus
EventBus.emit('feature:action', data);

// 4. הוסף CSS
css/new-feature.css

// 5. עדכן index.html
<script src="js/modules/new-feature.js"></script>
<link rel="stylesheet" href="css/new-feature.css">

// 6. commit
git commit -m "✨ Feature: Add new feature"
```

## תרחיש 2: תיקון באג
```javascript
// 1. מצא את הקוד הבעייתי
Grep: "function-with-bug"

// 2. קרא את הקובץ
Read: "path/to/file.js"

// 3. תקן
Edit: old code → new code

// 4. בדוק בקונסול
// אין שגיאות?

// 5. commit
git commit -m "🐛 Fix: תיקון באג ב-..."
```

## תרחיש 3: רפקטור
```javascript
// 1. זהה קוד כפול/ישן
Grep: "old-pattern"

// 2. בדוק כמה מקומות
// רשימה של כל הקבצים

// 3. החלף בכל מקום
Edit: old → new (בכל קובץ)

// 4. בדוק שהכל עובד
// פתח את האפליקציה

// 5. commit
git commit -m "♻️ Refactor: Migrate X to v2.0"
```

---

# 11. מידע טכני

## Versions:
- **Node.js:** 20 LTS
- **TypeScript:** 5.3.3
- **Vite:** 5.0.8
- **Firebase:** Admin SDK 12.0.0, Functions 5.0.0
- **Validation:** Zod (בschemas), Joi (בfunctions)

## Scripts:
```bash
npm run compile-ts       # קמפל TypeScript
npm run compile:watch    # קמפל אוטומטי
npm run type-check       # בדיקת טיפוסים
npm run build            # בניית Vite
```

## מבנה EventBus:
- **60+ אירועים מוגדרים**
- **Type-safe** (TypeScript)
- **History** (100 אירועים אחרונים)
- **Statistics** (מדידות ביצועים)
- **Debug mode** (לוגים מפורטים)

## מבנה FirebaseService:
- **Retry logic** (3 ניסיונות)
- **Caching** (עם TTL)
- **Rate limiting** (10 req/sec)
- **Deduplication** (מניעת כפילויות)
- **Queue** (תור בקשות)

---

# 12. שפה

- **קוד:** English (משתנים, פונקציות, comments)
- **תיעוד:** עברית + English
- **UI:** עברית
- **Commits:** עברית + English (מעורבב)
- **תקשורת עם Owner:** עברית

---

# 13. סיכום מהיר

```javascript
const workWithThisProject = {
  // תמיד השתמש ב:
  architecture: "EventBus + FirebaseService (v2.0)",
  communication: "EventBus.emit() / .on()",
  firebase: "FirebaseService.call()",

  // קבצים חשובים:
  core: [
    "js/core/event-bus.ts",
    "js/services/firebase-service.ts"
  ],

  // מבנה:
  newModules: "js/modules/your-module.js",
  styling: "css/your-style.css",
  docs: "docs/YOUR_DOC.md",

  // תהליך:
  workflow: [
    "1. חפש (Glob/Grep)",
    "2. הבן (Read)",
    "3. תכנן (איפה? איך?)",
    "4. בצע (כתוב קוד)",
    "5. בדוק (קונסול, stats)",
    "6. commit (emoji + description)"
  ],

  // אל תשכח:
  avoidOldCode: "אל תשתמש ב-window.*, קריאות ישירות ל-Firebase",
  alwaysUse: "EventBus + FirebaseService",
  checkBeforeCreate: "Glob/Grep - אל תיצור כפילויות"
};
```

---

# 14. CI/CD Pipeline (הוסף 3 נובמבר 2025)

## 🚀 מה יש לנו?

הפרויקט מצויד ב-**CI/CD pipeline מלא** עם GitHub Actions!

### 📁 קבצי Workflow:

```
.github/workflows/
├── ci-cd-production.yml   ← Pipeline ראשי (444 שורות, 9 jobs)
├── pull-request.yml       ← בדיקות PR (324 שורות, 7 jobs)
├── nightly-tests.yml      ← בדיקות לילה (395 שורות, 6 jobs)
└── README.md              ← תיעוד workflows
```

### 📚 קבצי תיעוד:

```
docs/CI-CD-GUIDE.md        ← מדריך מקיף 500+ שורות
SETUP-CI-CD.md             ← מדריך התקנה מהיר
.github/workflows/README.md ← הסבר workflows
```

---

## 🎯 מתי ה-Workflows רצים?

### 1. Production Pipeline (`ci-cd-production.yml`)
**טריגר**: כל `git push origin main`

**מה הוא עושה** (10-15 דקות):
```
1. Code Quality    → CSS lint, TODO count
2. TypeScript      → type-check, compile
3. Security        → npm audit, secrets scan
4. Tests           → npm test (כרגע placeholder)
5. Build           → compile + package
6. Deploy Staging  → Firebase staging
7. Deploy Prod     → Firebase production
8. Health Check    → בדיקת site
9. Notify          → סיכום
```

**Jobs במקביל**: code-quality + typescript + security
**Jobs ברצף**: build → deploy-staging → deploy-production → health-check

### 2. PR Validation (`pull-request.yml`)
**טריגר**: כל Pull Request ל-`main`

**מה הוא עושה** (5-8 דקות):
```
1. PR Info         → פרטי PR
2. Code Quality    → בדיקות
3. TypeScript      → type-check
4. Security        → audit
5. Tests           → npm test
6. Build           → verification
7. Summary         → ✅/❌
```

**חשוב**: **לא עושה deployment** - רק בדיקות!

### 3. Nightly Tests (`nightly-tests.yml`)
**טריגר**: כל לילה 2:00 AM (cron: `0 0 * * *`)

**מה הוא עושה** (15-20 דקות):
```
1. Health Check    → Site UP, SSL, performance
2. Dependencies    → npm outdated, security
3. Code Metrics    → statistics, git activity
4. TypeScript      → deep analysis
5. Build           → full verification
6. Report          → סיכום
```

---

## 🔧 שילוב CI/CD בעבודה היומיומית

### ✅ תהליך עבודה תקין:

#### שיטה 1: עבודה ישירה על main (פשוט)
```bash
# 1. עבוד על קוד
vim js/modules/my-feature.js

# 2. Commit
git add .
git commit -m "✨ Feature: הוספת פיצ'ר חדש"

# 3. Push
git push origin main

# ← CI/CD רץ אוטומטית!
# אתה מקבל email אם נכשל
# אחרת: deployed אוטומטית ל-production!
```

#### שיטה 2: עבודה עם PRs (מומלץ!)
```bash
# 1. צור branch
git checkout -b feature/new-thing

# 2. עבוד על קוד
vim js/modules/my-feature.js
git add .
git commit -m "✨ Feature: דבר חדש"

# 3. Push ל-branch
git push origin feature/new-thing

# 4. פתח PR ב-GitHub
# ← pull-request.yml רץ אוטומטית!

# 5. חכה ל-✅ ירוק

# 6. Merge ב-GitHub
# ← ci-cd-production.yml רץ אוטומטית!
```

---

## 📋 Checklist לפני Push

### ⚠️ בדוק מקומית:

```bash
# 1. TypeScript בודק?
npm run type-check
# צפוי: ✅ אין שגיאות

# 2. TypeScript מקומפל?
npm run compile-ts
# צפוי: ✅ dist/ נוצר

# 3. אין secrets בקוד?
grep -r "apiKey.*AIza" js/
# צפוי: לא אמור למצוא (Firebase API keys מותרים, אבל וודא!)

# 4. Commit message תקין?
# ✅ יש emoji
# ✅ יש תיאור ברור
# ✅ יש "Generated with Claude Code"
```

### ✅ אחרי Push:

```bash
# 1. לך ל-GitHub → Actions
# 2. ראה שהworkflow רץ
# 3. חכה ל-✅ ירוק (10-15 דקות)
# 4. בדוק שהאתר עובד:
#    https://law-office-system-e4801.web.app
```

---

## 🚨 אם Workflow נכשל

### שגיאה: TypeScript Failed
```bash
# Debug מקומית:
npm run type-check

# תקן את השגיאות
# Push שוב
git add .
git commit -m "🐛 Fix: TypeScript errors"
git push
```

### שגיאה: Security Audit Failed
```bash
# בדוק מה הבעיה:
npm audit

# נסה לתקן:
npm audit fix

# אם זה לא עובד:
npm audit fix --force  # זהירות!

# Push
git add package*.json
git commit -m "🔒 Security: fix vulnerabilities"
git push
```

### שגיאה: Deployment Failed (401)
```bash
# FIREBASE_TOKEN פג תוקף!
# תקן:
firebase login:ci
# העתק token
# GitHub → Settings → Secrets → FIREBASE_TOKEN → Edit

# Re-run workflow ב-GitHub Actions
```

---

## ⚙️ קבצים שעודכנו עבור CI/CD

### 1. `package.json` - נוספו scripts:
```json
{
  "scripts": {
    "css:lint": "echo '✅ CSS lint check passed'",
    "test": "echo '⚠️ No tests configured yet'"
  }
}
```

**למה**: CI/CD קורא לscripts האלו. כרגע placeholders.

### 2. `firebase.json` - נוסף hosting:
```json
{
  "hosting": {
    "public": ".",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

**למה**: מגדיר איך Firebase Hosting עובד (SPA routing).

---

## 🎓 כללי עבודה עם CI/CD

### ✅ תמיד עשה:

1. **לפני Push - בדוק מקומית**
   ```bash
   npm run type-check  # חובה!
   npm run compile-ts  # חובה!
   ```

2. **אחרי Push - עקוב אחרי Actions**
   - לך ל-GitHub Actions
   - וודא ✅ ירוק
   - אם ❌ אדום - תקן מיד!

3. **ב-PR - חכה לchecks**
   - לא לעשות merge עד ✅
   - תקן failures לפני merge

4. **כל יום - בדוק nightly**
   - בוקר: GitHub Actions → "Nightly Health & Testing"
   - וודא ✅ ירוק
   - אם ❌ - יש בעיה לטפל!

### ❌ לעולם אל תעשה:

1. **אל תעקוף את הchecks**
   ```bash
   # ❌ אסור!
   git push --force origin main
   git push --no-verify
   ```

2. **אל תעשה merge של PR עם ❌**
   - אם יש failures - תקן!
   - אל תעקוף

3. **אל תערוך .github/workflows/ בלי להבין**
   - זה קוד קריטי
   - שגיאה פה = pipeline נשבר
   - אם צריך לשנות - שאל קודם!

4. **אל תשכח GitHub Secrets**
   - FIREBASE_TOKEN חייב להיות מוגדר
   - בלעדיו - deployment נכשל

---

## 📊 מעקב ומדדים

### איפה לראות תוצאות?

1. **GitHub Actions Tab**
   - כל הruns
   - Logs מפורטים
   - Artifacts (build outputs)

2. **Email Notifications**
   - GitHub שולח מייל אם נכשל
   - הגדר ב-Settings → Notifications

3. **PR Checks**
   - בכל PR יש סיכום ✅/❌
   - לחץ על Details לפרטים

### KPIs - מה למדוד?

```javascript
// כל שבוע בדוק:
const kpis = {
  deploymentFrequency: "כמה deployments השבוע?",
  failureRate: "אחוז ה-❌ מכלל הruns",
  leadTime: "זמן מcommit לproduction",
  recoveryTime: "זמן לתקן failure"
};

// מטרות:
// - 5+ deployments בשבוע
// - פחות מ-10% failures
// - פחות מ-20 דקות lead time
// - פחות מ-2 שעות recovery
```

---

## 🔮 שדרוגים עתידיים

### Phase 2 (TODO):
```
[ ] הוסף tests אמיתיים (Jest/Vitest)
[ ] הוסף E2E tests (Playwright)
[ ] הוסף ESLint לpipeline
[ ] הוסף coverage reports
[ ] הוסף Sentry integration
```

### Phase 3 (TODO):
```
[ ] Performance budgets
[ ] Visual regression tests
[ ] Accessibility tests
[ ] Advanced deployment strategies
```

---

## 📖 קישורים לתיעוד

**קרא קודם** (התקנה):
- `SETUP-CI-CD.md` - מדריך התקנה מהיר (10 דקות)

**קרא לעומק** (הבנה):
- `docs/CI-CD-GUIDE.md` - מדריך מקיף (500+ שורות)
- `.github/workflows/README.md` - הסבר workflows

**Reference**:
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Firebase CI/CD](https://firebase.google.com/docs/hosting/github-integration)

---

## 🎯 סיכום מהיר - CI/CD

```javascript
const cicdWorkflow = {
  // קבצים:
  workflows: ".github/workflows/*.yml",
  docs: ["docs/CI-CD-GUIDE.md", "SETUP-CI-CD.md"],

  // טריגרים:
  triggers: {
    production: "push to main",
    pr: "PR opened/updated",
    nightly: "cron: 2:00 AM daily"
  },

  // תהליך:
  process: [
    "1. כתוב קוד",
    "2. בדוק מקומית (type-check, compile)",
    "3. Commit + Push",
    "4. CI/CD רץ אוטומטית",
    "5. עקוב אחרי Actions",
    "6. וודא ✅ ירוק"
  ],

  // זמנים:
  durations: {
    production: "10-15 דקות",
    pr: "5-8 דקות",
    nightly: "15-20 דקות"
  },

  // חשוב לזכור:
  remember: [
    "בדוק מקומית לפני push",
    "חכה ל-✅ לפני merge",
    "עקוב אחרי nightly reports",
    "תקן failures מיד"
  ]
};
```

---

**תאריך עדכון אחרון:** 3 נובמבר 2025
**CI/CD הוסף:** 3 נובמבר 2025
**Owner:** Chaim
**Claude Code Version:** 4.5

---

🎉 **בהצלחה בעבודה על הפרויקט!**
