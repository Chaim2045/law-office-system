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

### 6. **תיעוד מלא**
```javascript
// ✅ תמיד הוסף:
- JSDoc לפונקציות חדשות
- Comments להסבר לוגיקה מורכבת
- README אם מודול גדול
- דוגמאות שימוש
```

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

**תאריך עדכון אחרון:** 28 אוקטובר 2025
**Owner:** Chaim
**Claude Code Version:** 4.5

---

🎉 **בהצלחה בעבודה על הפרויקט!**
