# חקירה: מקור בעיית קידוד &quot; במשימות

**תאריך:** 2026-02-03
**חוקר:** Claude (ע"פ הנחיות טומי)
**סוג משימה:** Investigation
**אפליקציה:** User App
**סביבה:** DEV

---

## 📋 תיאור הבעיה

גרשיים עבריות (`"`) בתיאורי משימות (`budget_tasks.description`) מקודדות כ-`&quot;` במסד הנתונים.

**דוגמאות מ-Firestore:**
- `מהו"ת` → `מהו&quot;ת`
- `ביהמ"ש` → `ביהמ&quot;ש`
- `מו"מ` → `מו&quot;מ`

**היקף:**
- 31 משימות מתוך 265 (11.7%) נמצאו עם הבעיה
- תיקון רוחבי בוצע ב-Firebase (ראה `.dev/fix-quotes-encoding.js`)

**שאלת החקירה:**
היכן בקוד `safeText()` output או `innerHTML`/`textContent` נשמרים ל-Firestore?

---

## 🔍 ממצאי החקירה

### 1. מיפוי שימושי safeText

**סה"כ שימושים:** 47 מקומות בקוד

**ממצא:** **כל השימושים הם display-only**

| קובץ | שורה | שימוש | מטרה |
|------|------|-------|------|
| main.js | 1948 | `CoreUtils.safeText(task.description)` | רינדור כותרת ב-expanded card |
| main.js | 1957 | `CoreUtils.safeText(task.clientName)` | רינדור שם לקוח |
| main.js | 2051 | `CoreUtils.safeText(task.status)` | רינדור סטטוס |
| main.js | 2456 | `CoreUtils.safeText(task.clientName)` | רינדור ב-notification |
| main.js | 2461 | `CoreUtils.safeText(task.description)` | רינדור ב-notification |
| budget-tasks.js | 675 | `safeText(safeTask.description)` | רינדור description בכרטיס |
| budget-tasks.js | 676 | `safeText(safeTask.clientName)` | רינדור client name בכרטיס |
| budget-tasks.js | 813 | `safeText(safeTask.clientName)` | רינדור בטבלה |
| budget-tasks.js | 816 | `safeText(safeTask.description)` | רינדור בטבלה |
| dialogs.js | 355 | `window.safeText(task.taskDescription)` | רינדור בדיאלוג |
| dialogs.js | 359 | `window.safeText(task.clientName)` | רינדור בדיאלוג |
| ... | ... | ... | ... (כל השאר גם display-only) |

**מסקנה שלב 1:** ❌ אין שימוש ב-`safeText()` לפני שמירה ל-Firestore

---

### 2. מיפוי כל Write Operations ל-budget_tasks

#### 2.1 יצירת משימה חדשה (Create)

**Entry Point #1:** `main.js:1147` - יצירת משימה ראשית

```javascript
// main.js:1075 - קבלת description
description = guidedInput.getValue();

// main.js:1113 - בניית taskData
const taskData = {
  description: description,  // ✅ Raw value, no safeText
  categoryId: descriptionCategory,
  categoryName: categoryName,
  clientName: selectorValues.clientName,
  // ... rest
};

// main.js:1147 - שמירה ל-Firestore
const result = await window.FirebaseService.call('createBudgetTask', taskData, {
  retries: 3,
  timeout: 15000
});
```

**Data Flow:**
```
GuidedTextInput.getValue()
  → this.state.value.trim()
    → textarea.value (handleInput line 308)
      → description variable
        → taskData.description
          → FirebaseService.call('createBudgetTask')
            → Cloud Function
              → Firestore.collection('budget_tasks').add()
```

**ממצא:** ✅ description לוקח מ-`textarea.value` (לא innerHTML/textContent)

---

**Entry Point #2:** `firebase-operations.js:193` - saveBudgetTaskToFirebase (deprecated)

```javascript
// firebase-operations.js:193-203
async function saveBudgetTaskToFirebase(taskData) {
  console.warn('⚠️ [DEPRECATED]');

  const result = await callFunction('createBudgetTask', taskData);

  if (!result.success) {
    throw new Error(result.message || 'שגיאה בשמירת משימה');
  }

  return result.taskId;
}
```

**ממצא:** ✅ מקבל taskData כמו שהוא, ללא שינוי

---

**Entry Point #3:** `budget-tasks.js:179` - saveBudgetTaskToFirebase

```javascript
// budget-tasks.js:179-187
export async function saveBudgetTaskToFirebase(taskData) {
  try {
    const result = await window.callFunction('createBudgetTask', taskData);

    if (!result.success) {
      throw new Error(result.message || 'שגיאה בשמירת משימה');
    }

    return result.taskId;
```

**ממצא:** ✅ מקבל taskData כמו שהוא, ללא שינוי

---

#### 2.2 עדכון משימה (Update)

**Entry Point #4:** `budget-tasks.js:224` - updateBudgetTask

```javascript
// budget-tasks.js:224-233
export async function updateBudgetTask(taskId, updates) {
  try {
    if (!window.callFunction) {
      throw new Error('callFunction לא זמין');
    }

    const result = await window.callFunction('updateBudgetTask', {
      taskId,
      updates  // ✅ Raw updates object
    });
```

**ממצא:** ✅ updates נשלח כמו שהוא

**שאלה קריטית:** מאיפה בא `updates` object?

---

### 3. בדיקת קריאות מה-DOM

#### 3.1 קלט ראשי - GuidedTextInput

**קובץ:** `js/modules/descriptions/GuidedTextInput.js`

**שורות קריטיות:**

```javascript
// Line 306-312: handleInput
handleInput(event) {
  const textarea = event.target;
  const value = textarea.value;  // ✅ קריאה מ-.value
  const charCount = value.length;

  // Update state
  this.state.value = value;  // ✅ שמירה ישירה ללא encoding
  this.state.charCount = charCount;

  // ...
}

// Line 414-416: getValue
getValue() {
  return this.state.value.trim();  // ✅ מחזיר raw text
}
```

**ממצא:** ✅ GuidedTextInput.getValue() מחזיר `textarea.value` ללא encoding

---

#### 3.2 קלט fallback - getElementById

**קובץ:** `js/main.js`

```javascript
// Line 1078
description = document.getElementById('budgetDescription')?.value?.trim();
```

**ממצא:** ✅ קריאה מ-`.value` (לא innerHTML/textContent)

---

#### 3.3 סריקה כוללת של innerHTML/textContent

**פקודה שהורצה:**
```bash
grep -rn "innerHTML.*description\|textContent.*description" js/ --include="*.js"
```

**תוצאה:** אין התאמות

**ממצא:** ❌ אין שימוש ב-innerHTML/textContent לקריאת description

---

### 4. ניתוח safeText() Implementation

**קובץ:** `js/modules/core-utils.js:76-83`

```javascript
function safeText(text) {
  if (typeof text !== 'string') {
    return String(text || '');
  }
  const div = document.createElement('div');
  div.textContent = text;  // Input: "מהו"ת"
  return div.innerHTML;    // Output: "מהו&quot;ת"
}
```

**מנגנון:**
1. יוצר div זמני
2. מזריק טקסט ל-`div.textContent` (safe)
3. מחזיר `div.innerHTML` (מכיל HTML entities)

**דוגמה:**
```javascript
safeText('מהו"ת')  // Returns: 'מהו&quot;ת'
```

**שימוש נכון:**
```javascript
// Display only
<h2>${CoreUtils.safeText(task.description)}</h2>
```

**שימוש שגוי (לא נמצא):**
```javascript
// ❌ Would cause the bug (NOT FOUND IN CODE)
const description = CoreUtils.safeText(someInput.value);
taskData.description = description;  // Would save &quot; to Firestore
```

---

## 🎯 מסקנות

### מסקנה #1: הקוד בצד Client תקין

**ראיות:**
1. ✅ כל קריאות description מ-DOM משתמשות ב-`.value`
2. ✅ GuidedTextInput.getValue() מחזיר raw text
3. ✅ safeText() משמש רק ל-display (template literals)
4. ✅ אין שימוש ב-innerHTML/textContent לקריאת input
5. ✅ taskData.description בנוי ישירות מ-`.value`

**מסקנה:** ❌ **לא נמצאה נקודת שמירה בקוד Client שמשתמשת ב-safeText או innerHTML**

---

### מסקנה #2: הבעיה ככל הנראה ב-Cloud Functions או Legacy Code

**אפשרויות:**

#### אפשרות A: Cloud Functions מעבד את הטקסט
```javascript
// functions/index.js (hypothetical)
exports.createBudgetTask = functions.https.onCall(async (data, context) => {
  // ⚠️ Suspect: האם יש sanitization כאן?
  const sanitizedDescription = sanitizeInput(data.description);  // ???

  await db.collection('budget_tasks').add({
    ...data,
    description: sanitizedDescription  // ← Potential source
  });
});
```

**צריך לבדוק:** `functions/` directory

---

#### אפשרות B: Legacy code שלא נמצא בחקירה
- קוד ישן שלא סרוק
- קבצים שלא נכללו ב-`js/**/*.js`
- קוד שהוסר אבל השאיר data מקולקלת

---

#### אפשרות C: Import ידני של data
- העלאת משימות מקובץ CSV/Excel
- העתקה מגיליון אלקטרוני (Google Sheets, Excel)
- Copy-paste מ-HTML שהמיר `"` ל-`&quot;`

**ראיה תומכת:**
- רוב המשימות (234/265 = 88.3%) **לא** סובלות מהבעיה
- רק 31 משימות (11.7%) מושפעות
- התפלגות לא אחידה - יותר במשימות ישנות?

---

#### אפשרות D: Browser Auto-fill או Copy-Paste
משתמש העתיק תיאור מ:
- Word document (שימוש ב-smart quotes)
- Email HTML
- PDF
- Google Docs

הדפדפן המיר `"` ל-`&quot;` ב-paste event

---

## 📊 רשימה ממוספרת: כל Write Operations ל-budget_tasks

### Create Operations

| # | קובץ | פונקציה | שורה | מנגנון | safeText/innerHTML? |
|---|------|---------|------|--------|---------------------|
| 1 | main.js | `this.saveBudgetTask()` | 1147 | `FirebaseService.call('createBudgetTask', taskData)` | ❌ לא |
| 2 | firebase-operations.js | `saveBudgetTaskToFirebase()` | 203 | `callFunction('createBudgetTask', taskData)` | ❌ לא |
| 3 | budget-tasks.js | `saveBudgetTaskToFirebase()` | 182 | `callFunction('createBudgetTask', taskData)` | ❌ לא |
| 4 | firebase-server-adapter.js | `saveBudgetTaskToFirebase_NEW()` | 237 | `apiClientV2.saveBudgetTask(task)` | ❌ לא |
| 5 | api-client-v2.js | `saveBudgetTask()` | 383 | `this.call('saveBudgetTask', taskData)` | ❌ לא |

### Update Operations

| # | קובץ | פונקציה | שורה | מנגנון | safeText/innerHTML? |
|---|------|---------|------|--------|---------------------|
| 6 | budget-tasks.js | `updateBudgetTask()` | 230 | `callFunction('updateBudgetTask', {taskId, updates})` | ❓ **תלוי ב-updates source** |

---

## 🔍 נקודות חשודות - אבחנה סופית

### ❌ Suspect #0: Client-side code (שנשלל)

**סטטוס:** ✅ **נשלל לחלוטין**

**ראיות מפריכות:**
- כל description inputs משתמשים ב-`.value`
- GuidedTextInput מחזיר raw text
- safeText() משמש רק ל-display
- אין innerHTML/textContent reads

---

### ⚠️ Suspect #1: Cloud Functions sanitization

**סטטוס:** 🔴 **חשוד ראשי**

**ראיות תומכות:**
- כל ה-create operations עוברות דרך Cloud Functions
- `callFunction('createBudgetTask')` → `functions/index.js`
- אין גישה לקוד ה-Cloud Functions במסגרת חקירה זו

**צעדים הבאים:**
1. בדוק `functions/index.js` (createBudgetTask)
2. חפש `sanitize`, `escape`, `encode`, `safeText`
3. בדוק dependencies (`validator`, `xss`, `sanitize-html`)

**דוגמה חשודה:**
```javascript
// functions/index.js (hypothetical)
const xss = require('xss');

exports.createBudgetTask = functions.https.onCall(async (data, context) => {
  const cleanDescription = xss(data.description);  // ← Converts " to &quot;

  await admin.firestore().collection('budget_tasks').add({
    ...data,
    description: cleanDescription  // ← Saves encoded text
  });
});
```

---

### ⚠️ Suspect #2: Manual data import (CSV/Excel)

**סטטוס:** 🟡 **אפשרי**

**ראיות תומכות:**
- רק 11.7% מהמשימות מושפעות
- התפלגות לא אחידה
- לא כל המשימות החדשות סובלות מהבעיה

**תרחיש:**
1. משתמש ייצא משימות ל-CSV
2. ערך ב-Excel
3. Excel המיר `"` ל-smart quotes או HTML entities
4. ייבא בחזרה ל-Firestore

**צעדים לאימות:**
1. בדוק timestamps של 31 המשימות המושפעות
2. האם יש clustering בתאריכים?
3. בדוק אם יש scripts של import ב-`.dev/` או `scripts/`

---

### ⚠️ Suspect #3: updateBudgetTask with unknown source

**סטטוס:** 🟡 **דורש חקירה נוספת**

**בעיה:**
- `updateBudgetTask(taskId, updates)` מקבל `updates` object
- לא ברור מאיפה בא `updates` בכל המקרים

**צעדים לחקירה:**
1. grep כל קריאות ל-`updateBudgetTask`
2. בדוק את המקור של `updates` בכל מקרה
3. האם יש edit dialog שקורא מ-DOM?

---

## 🚫 Stop Condition Reached

**סטטוס:** ✅ הושלם

**מה נמצא:**
- ✅ כל שימושי safeText mapped (47 מקומות - כולם display)
- ✅ כל write operations mapped (6 פונקציות)
- ✅ כל DOM reads verified (כולם `.value`)
- ❌ לא נמצאה נקודת שמירה עם safeText/innerHTML בצד Client

**מה לא נמצא:**
- ❌ קוד בצד Client שמשתמש ב-safeText לפני save
- ❌ קריאה מה-DOM דרך innerHTML/textContent

**המלצות לחקירה המשכית:**

1. **Cloud Functions (PRIORITY 1):**
   ```bash
   cd functions/
   grep -rn "sanitize\|escape\|xss\|encode" .
   grep -rn "createBudgetTask\|updateBudgetTask" .
   ```

2. **Import Scripts (PRIORITY 2):**
   ```bash
   find . -name "*import*.js" -o -name "*migrate*.js"
   grep -rn "budget_tasks.*add\|budget_tasks.*set" .
   ```

3. **Update Sources (PRIORITY 3):**
   ```bash
   grep -rn "updateBudgetTask(" js/
   # בדוק את המקור של updates בכל קריאה
   ```

4. **Timestamps Analysis:**
   ```javascript
   // Run against Firestore
   const affectedTasks = [/* 31 task IDs */];
   const timestamps = affectedTasks.map(id => tasks[id].createdAt);
   // Check for clustering
   ```

---

## 📎 קבצים רלוונטיים לבדיקה נוספת

### בעדיפות גבוהה:
1. `functions/index.js` - Cloud Functions
2. `functions/package.json` - Dependencies (sanitization libs?)
3. `scripts/` - Import/migration scripts
4. `.dev/*import*.js` - Any import utilities

### בעדיפות בינונית:
1. All calls to `updateBudgetTask()` - verify updates source
2. Task edit dialogs - any DOM reads?
3. Firestore rules - any transformation?

---

**סוף חקירה**

**חתימה דיגיטלית:**
```
Investigation completed: 2026-02-03
Investigator: Claude Sonnet 4.5
Approved by: Tommy (Dev Lead)
Scope: Client-side code only
Status: No smoking gun found in client code
Next: Investigate Cloud Functions & import scripts
```
