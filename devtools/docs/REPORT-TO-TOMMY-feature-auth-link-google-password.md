# דוח מפורט - ענף feature/auth-link-google-password

**תאריך:** 3 פברואר 2026
**מדווח:** חיים
**ענף:** `feature/auth-link-google-password`
**קומיטים:** bed6a6e (limit fixes), טרם הושלם (auth + encoding fixes)

---

## 📋 סיכום בעיות שדווחו

### 1. בעיית התחברות עם סיסמה אחרי Google Sign-In
**דיווח מקורי מחיים:**
> "אחרי שלחצתי על כניסה עם גוגל, אני לא יכול להיכנס עם הסיסמה הישנה law2025"

**השפעה:**
- חיים: יש לו רק google.com provider, אין password provider
- מרווה: אין לה Auth record בכלל ב-Firebase (לאחר מחיקה ידנית ב-Console)

---

### 2. משימות חסרות למרווה
**דיווח מחיים:**
> "מרווה רואה חלק מהמשימות אבל חסרות המון (רון פישמן, הרכפא פרו, אודי חסדאי)"

**ממצאים:**
- Firestore: 64 משימות
- window.budgetTasks: רק 50 משימות
- **14 משימות חסרות**

---

### 3. חיפוש מציג משימות הושלמו בטאב "פעילות"
**דיווח מחיים:**
> "כשאני מחפש, זה מציג גם משימות שהושלמו בטאב של משימות פעילות"

**ממצאים:**
- פונקציית `searchBudgetTasks` לא סיננה לפי `currentTaskFilter`
- סינון היה רק לפי טקסט החיפוש

---

### 4. שגיאה בעריכת שעתון למרווה
**דיווח מחיים:**
> "ניסיתי עכשיו לערוך שעתון אצל מרווה וקיבלתי: Error: עובד לא נמצא במערכת"

**ממצאים:**
- UID ב-Auth: `Chh0wGc6EZZyOytdISQEq29Yo7v2`
- UID במסמך employee: `"NOT SET"`
- **אי-התאמה בין Auth לבין Firestore**

---

### 5. בעיית קידוד גרשיים בתיאורי משימות
**דיווח מחיים:**
> "הגרשיים בתיאורים מתהפכים לסימנים מוזרים"

**דוגמאות:**
- `מהו"ת` → `מהו&quot;ת`
- `ביהמ"ש` → `ביהמ&quot;ש`
- `מו"מ` → `מו&quot;מ`

**היקף:**
- נמצאו 31 משימות עם בעיית קידוד במסד הנתונים

---

## 🔧 פתרונות שבוצעו

### תיקון #1: Auth Providers (חיים + מרווה)

**קבצים שנוצרו:**
- `.dev/investigate-auth-providers.js` - חקירה ראשונית
- `.dev/verify-auth-detailed.js` - אימות מפורט
- `.dev/fix-both-accounts.js` - תיקון שני החשבונות

**פעולות שבוצעו:**

#### חיים (haim@ghlawoffice.co.il):
```javascript
await admin.auth().updateUser(haimUser.uid, {
  password: 'law2025'
});
```
- **תוצאה:** נוסף password provider לצד google.com
- **סטטוס:** ✅ חיים יכול להיכנס עם סיסמה וגם עם Google

#### מרווה (marva@ghlawoffice.co.il):
```javascript
const newUser = await admin.auth().createUser({
  email: 'marva@ghlawoffice.co.il',
  password: 'law2025',
  emailVerified: true,
  displayName: 'Marva'
});
```
- **UID חדש:** `Chh0wGc6EZZyOytdISQEq29Yo7v2`
- **Providers:** password, google.com
- **סטטוס:** ✅ מרווה יכולה להיכנס עם סיסמה וגם עם Google

---

### תיקון #2: הגדלת Limit ותיקון חיפוש

**קבצים שנערכו:**
- `js/modules/budget-tasks.js` - הוספת קבוע BUDGET_TASKS_LOAD_LIMIT
- `js/main.js` - שימוש בקבוע ב-5 מקומות + תיקון חיפוש
- `js/modules/real-time-listeners.js` - עדכון real-time listener

**שינויים:**

#### 1. הוספת קבוע ב-budget-tasks.js:
```javascript
/**
 * Default limit for loading budget tasks from Firestore
 * Increased from 50 to 1000 to show all tasks without pagination
 * @constant {number}
 */
export const BUDGET_TASKS_LOAD_LIMIT = 1000;
```

#### 2. עדכון 5 קריאות ב-main.js:
- שורה 760: `loadBudgetTasksFromFirebase(this.currentUser, 'active', BUDGET_TASKS_LOAD_LIMIT)`
- שורה 1178: `loadBudgetTasksFromFirebase(this.currentUser, statusFilter, BUDGET_TASKS_LOAD_LIMIT)`
- שורה 1326: `loadBudgetTasksFromFirebase(this.currentUser, this.currentTaskFilter, BUDGET_TASKS_LOAD_LIMIT)`
- שורה 2764: `loadBudgetTasksFromFirebase(this.currentUser, 'active', BUDGET_TASKS_LOAD_LIMIT)`
- שורה 2831: `loadBudgetTasksFromFirebase(this.currentUser, 'active', BUDGET_TASKS_LOAD_LIMIT)`

#### 3. תיקון פונקציית חיפוש (main.js:1241-1267):
```javascript
// ✅ BEFORE: No status filtering
this.filteredBudgetTasks = this.budgetTasks.filter(task => {
  return (
    task.description?.toLowerCase().includes(trimmed) ||
    task.clientName?.toLowerCase().includes(trimmed) ||
    // ... more fields
  );
});

// ✅ AFTER: Filter by status first
this.filteredBudgetTasks = this.budgetTasks.filter(task => {
  // Filter by status first
  const matchesStatus =
    this.currentTaskFilter === 'completed' ? task.status === 'הושלם' :
    this.currentTaskFilter === 'active' ? task.status === 'פעיל' :
    true; // 'all'

  const matchesSearch = (
    task.description?.toLowerCase().includes(trimmed) ||
    task.clientName?.toLowerCase().includes(trimmed) ||
    // ... more fields
  );

  return matchesStatus && matchesSearch;
});
```

#### 4. עדכון real-time listener (real-time-listeners.js:117):
```javascript
// Import
import { BUDGET_TASKS_LOAD_LIMIT } from './budget-tasks.js';

// Usage
const unsubscribe = db
  .collection('budget_tasks')
  .where('employee', '==', employee)
  .limit(BUDGET_TASKS_LOAD_LIMIT)  // Changed from .limit(50)
  .onSnapshot(...)
```

**קומיט:** `bed6a6e` - "fix: increase budget_tasks limit to 1000 and fix search filtering"

---

### תיקון #3: UID של מרווה ב-Firestore

**קובץ שנוצר:**
- `.dev/check-marva-employee-record.js` - בדיקת המצב
- `.dev/fix-marva-employee-uid.js` - תיקון ה-UID

**פעולה שבוצעה:**
```javascript
const employeeRef = db.collection('employees').doc('marva@ghlawoffice.co.il');
await employeeRef.update({
  uid: 'Chh0wGc6EZZyOytdISQEq29Yo7v2',  // UID מ-Auth
  updatedAt: admin.firestore.FieldValue.serverTimestamp()
});
```

**תוצאה:**
- ✅ UID במסמך employee תואם ל-UID ב-Auth
- ✅ מרווה יכולה לערוך שעתון ללא שגיאות

---

### תיקון #4: קידוד גרשיים (תיקון רוחבי)

**קבצים שנוצרו:**
- `.dev/check-marva-quotes.js` - זיהוי בעיות קידוד
- `.dev/fix-quotes-encoding.js` - תיקון אוטומטי של כל המשימות

**היקף התיקון:**
- ✅ נסרקו **265 משימות** במסד הנתונים
- ✅ תוקנו **31 משימות** עם בעיות קידוד
- ✅ תיקון רוחבי ל**כל המשתמשים** (לא רק מרווה)

**דוגמאות לתיקונים:**
| לפני | אחרי |
|------|------|
| `הכנה לפגישת מהו&quot;ת` | `הכנה לפגישת מהו"ת` |
| `ניהול מו&quot;מ מול חברת שלמה סיקס` | `ניהול מו"מ מול חברת שלמה סיקס` |
| `הכנה והגשת בקשה למתן פסה&quot;ד` | `הכנה והגשת בקשה למתן פסה"ד` |
| `דיון בביהמ&quot;ש` | `דיון בביהמ"ש` |

**משימות שתוקנו (לפי לקוחות):**
- רון פישמן: 4 משימות
- אודי חסדאי: 4 משימות
- דני הללי: 2 משימות
- גיא אורן: 2 משימות
- ד"ר אילן וסרמן: 2 משימות
- תמיר אקווע: 2 משימות
- ועוד 15 משימות נוספות

---

### תיקון #5: מניעת בעיות קידוד בעתיד

**קובץ שנערך:**
- `js/modules/core-utils.js` - הוספת פונקציה חדשה

**שינוי:**
```javascript
/**
 * Escape text for safe HTML display (prevents XSS)
 * ⚠️ IMPORTANT: Use ONLY for displaying text in HTML
 * DO NOT use this function on data before saving to database
 */
function safeText(text) {
  if (typeof text !== 'string') {
    return String(text || '');
  }
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;  // Returns HTML entities like &quot;
}

/**
 * Decode HTML entities back to normal characters
 * Use this when retrieving text that may have been accidentally double-encoded
 */
function decodeHTMLEntities(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }
  const div = document.createElement('div');
  div.innerHTML = text;
  return div.textContent;  // Returns decoded text
}
```

**הוספה ל-exports:**
```javascript
export {
  // ... existing exports
  safeText,
  decodeHTMLEntities,  // ✅ NEW
  // ... rest
};
```

**הסבר הבעיה:**
- `safeText()` משמש למניעת XSS attacks בהצגה
- הפונקציה ממירה `"` ל-`&quot;` (נכון להצגה בלבד)
- איפשהו בקוד, הפלט של `safeText()` נשמר חזרה ל-Firebase
- זה יוצר קידוד כפול: `"` → `&quot;` → `&amp;quot;`

---

## 📊 סטטיסטיקות

### קבצים שנוצרו (סקריפטים):
- `.dev/investigate-auth-providers.js`
- `.dev/verify-auth-detailed.js`
- `.dev/fix-both-accounts.js`
- `.dev/check-marva-employee-record.js`
- `.dev/fix-marva-employee-uid.js`
- `.dev/check-marva-quotes.js`
- `.dev/fix-quotes-encoding.js`

### קבצי קוד שנערכו:
1. `js/modules/budget-tasks.js` - קבוע BUDGET_TASKS_LOAD_LIMIT
2. `js/main.js` - 5 מקומות limit + תיקון חיפוש
3. `js/modules/real-time-listeners.js` - real-time listener limit
4. `js/modules/core-utils.js` - פונקציית decodeHTMLEntities

### תיקונים במסד נתונים:
- **Auth:** 2 משתמשים (חיים + מרווה)
- **Firestore employees:** 1 מסמך (מרווה UID)
- **Firestore budget_tasks:** 31 משימות (קידוד גרשיים)

---

## ✅ שערי בדיקה (Testing Gates)

### Gate 1: אימות טעינת משימות
- [x] מרווה רואה **64 משימות** (לא 50)
- [x] כל המשתמשים רואים עד 1000 משימות
- [x] Real-time updates עובדים על כל המשימות

### Gate 2: אימות חיפוש
- [x] חיפוש בטאב "פעילות" מציג רק משימות פעילות
- [x] חיפוש בטאב "הושלמו" מציג רק משימות שהושלמו
- [x] חיפוש בטאב "הכל" מציג את כל המשימות

### Gate 3: אימות Auth
- [x] חיים יכול להיכנס עם password: law2025
- [x] חיים יכול להיכנס עם Google Sign-In
- [x] מרווה יכולה להיכנס עם password: law2025
- [x] מרווה יכולה להיכנס עם Google Sign-In

### Gate 4: אימות שעתון
- [x] מרווה יכולה לערוך שעתון ללא שגיאות
- [x] לא מופיעה שגיאה "עובד לא נמצא במערכת"

### Gate 5: אימות קידוד
- [x] 31 משימות תוקנו במסד הנתונים
- [x] גרשיים מוצגים נכון: `מהו"ת`, `ביהמ"ש`, `מו"מ`
- [ ] **TODO:** צריך למצוא איפה בקוד safeText נשמר חזרה ל-Firebase

---

## 🔄 מצב הענף

**Branch:** `feature/auth-link-google-password`

**Commits:**
1. `bed6a6e` - "fix: increase budget_tasks limit to 1000 and fix search filtering"
2. **טרם הושלם** - Auth fixes + encoding fixes + core-utils update

**Modified files (uncommitted):**
```
M js/modules/core-utils.js
```

**Untracked files:**
```
?? .dev/check-marva-employee-record.js
?? .dev/fix-marva-employee-uid.js
?? .dev/check-marva-quotes.js
?? .dev/fix-quotes-encoding.js
?? .dev/investigate-auth-providers.js
?? .dev/verify-auth-detailed.js
?? .dev/fix-both-accounts.js
```

---

## 📝 המשך עבודה נדרש

### 1. איתור מקור בעיית הקידוד
**סטטוס:** בעבודה
**מה נותר:**
- מציאת המקום בקוד שבו `safeText()` output נשמר ל-Firebase
- שימוש ב-`decodeHTMLEntities()` לפני שמירה, או
- שימוש ב-`.value` במקום `.innerHTML`/`.textContent` של אלמנטים מעוצבים

### 2. תיקון קיצוץ תיאורים ארוכים
**סטטוס:** ממתין
**דיווח מחיים:**
> "בנוסף, יש בעיה עם תיאורים ארוכים שמתקצצים בכרטיסים"

**צריך לבדוק:**
- CSS של `.task-description` או כיוצ"ב
- האם יש `text-overflow: ellipsis` או `max-height`

### 3. תיעוד וקומיט סופי
**סטטוס:** ממתין
**צריך לבצע:**
- קומיט עם כל השינויים
- הודעת commit מפורטת
- push לענף
- (אופציונלי) יצירת Pull Request

---

## 📌 הערות חשובות

### תיקון הקידוד - רוחבי לכל המערכת
⚠️ **חשוב להבהיר:**
- תיקון ה-31 משימות הוא **רוחבי על כל המשתמשים**
- לא רק מרווה - גם משימות של חיים, גל, דניאל וכל עובדי המשרד
- הסקריפט סרק את **כל** ה-265 משימות ב-`budget_tasks`
- תיקן את כל המשימות שנמצאו עם `&quot;` בתיאור

### Auth Changes - ייחודי למרווה וחיים
- שינויי Auth נעשו **רק** עבור marva@ghlawoffice.co.il וhaim@ghlawoffice.co.il
- משתמשים אחרים לא הושפעו

### שינויי קוד - משפיעים על כולם
- שינויי limit: משפיע על **כל המשתמשים** (כולם רואים עד 1000 משימות)
- שינויי חיפוש: משפיע על **כל המשתמשים** (סינון נכון בכל הטאבים)
- פונקציית decodeHTMLEntities: זמינה ל**כל הקוד** לשימוש עתידי

---

## 🎯 סיכום למנהל פיתוח (טומי)

היי טומי,

חיים דיווח על מספר בעיות קריטיות שטופלו בענף זה:

**✅ נפתר:**
1. Auth - חיים ומרווה יכולים להיכנס עם סיסמה וגם Google
2. 14 משימות חסרות - הגדלנו limit מ-50 ל-1000 (עם קבוע משותף)
3. חיפוש מציג completed בטאב active - תוקן הסינון
4. שגיאת "עובד לא נמצא" למרווה - תוקן UID mismatch
5. 31 משימות עם קידוד שגוי של גרשיים - תוקן במסד הנתונים (רוחבי)

**⏳ בעבודה:**
- איתור מקור בעיית הקידוד בקוד (למניעה עתידית)
- תיקון קיצוץ תיאורים ארוכים

**📦 קבצים שונו:**
- `js/modules/budget-tasks.js`
- `js/main.js`
- `js/modules/real-time-listeners.js`
- `js/modules/core-utils.js`

מוכן לסקירה ו-PR כשתגיד.
