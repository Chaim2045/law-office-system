# 📋 תכנית מיזוג מלאה: Client = Case

## סטטוס: **נדרש מיגרציית נתונים קיימים** ✅

---

## 🎯 מטרה
מיזוג `clients` ו-`cases` למודל אחד פשוט:
- **לקוח = תיק אחד**
- **מספר תיק = מזהה ייחודי** (Document ID)
- **מספר תיק אוטומטי** (2025001, 2025002...)
- **חיפוש לפי שם** עם dropdown (שם + מספר תיק)

---

## 📁 קבצים לשינוי - רשימה מלאה

### 🔥 Backend - Firebase Functions (functions/)

#### ✅ **functions/index.js** - השינויים העיקריים

**פונקציות למחיקה מלאה:**
1. ❌ `exports.createCase` (שורה 2720)
2. ❌ `exports.getCases` (שורה 3132)
3. ❌ `exports.getCasesByClient` (שורה 3189)
4. ❌ `exports.updateCase` (שורה 3267)
5. ❌ `exports.getCaseById` (שורה 3368)
6. ❌ `exports.addServiceToCase` (שורה ~815)
7. ❌ `exports.addPackageToService` (שורה ~965)
8. ❌ `exports.addHoursPackageToStage` (שורה ~3448)
9. ❌ `exports.moveToNextStage` (שורה ~3526)

**פונקציות לעדכון משמעותי:**
1. ✏️ `exports.createClient` (שורה 400)
   - **להוסיף:**
     - `caseNumber` (אוטומטי)
     - `services[]` (מערך שירותים)
     - `procedureType` (hours/fixed/legal_procedure)
     - validation לכפילויות מספר תיק
   - **שינוי:** Document ID = caseNumber (במקום auto-generated)

2. ✏️ `exports.createBudgetTask` (שורה 1273)
   - **להסיר:** כל התייחסות ל-`caseId`
   - **להשתמש רק ב:** `clientId`
   - **לעדכן:** קריאה מ-`clients` במקום `cases` (שורה 1316)

3. ✏️ `exports.addTimeToTask` (שורה 1479)
   - **לשנות:** `db.collection('cases')` → `db.collection('clients')` (שורה 1577)
   - **לעדכן:** משתנה `caseDoc` → `clientDoc`
   - **לשמור:** הלוגיקה של חיפוש serviceId (כבר תוקן!)

4. ✏️ `exports.createTimesheetEntry` (שורה 1939)
   - **לשנות:** `db.collection('cases')` → `db.collection('clients')` (שורה 2073)
   - **לעדכן:** משתנה `caseDoc` → `clientDoc`
   - **לשמור:** הלוגיקה של חיפוש serviceId (כבר תוקן!)

5. ✏️ `exports.getClients` (שורה 1071)
   - **ללא שינוי** - כבר תקין

6. ✏️ `exports.updateClient` (שורה 1109)
   - **להוסיף:** תמיכה בעדכון `services[]`
   - **להוסיף:** תמיכה בעדכון `procedureType`

7. ✏️ `exports.deleteClient` (שורה 1207)
   - **ללא שינוי** - כבר תקין

**פונקציות חדשות ליצירה:**
1. ➕ `generateCaseNumber()` - פונקציית עזר
   - קריאת המספר האחרון
   - יצירת מספר חדש (שנה + סידורי)
   - בדיקת ייחודיות

2. ➕ `addServiceToClient(clientId, serviceData)` - הוספת שירות
3. ➕ `addPackageToService(clientId, serviceId, packageData)` - הוספת חבילת שעות

**מיקומי שינוי ב-functions/index.js:**
```javascript
// שורה 139: getActivePackage
db.collection('cases') → db.collection('clients')

// שורה 1316: createBudgetTask
db.collection('cases') → db.collection('clients')

// שורה 1577: addTimeToTask
db.collection('cases') → db.collection('clients')

// שורה 2073: createTimesheetEntry
db.collection('cases') → db.collection('clients')

// שורה 3780: migrateClientsIntoFullCases
לעדכן או למחוק

// שורה 4154: migrateHistoricalTimesheetEntries
db.collection('cases') → db.collection('clients')
```

---

### 🎨 Frontend - JavaScript Modules (js/)

#### ✅ **js/main.js** - קובץ ראשי
**שורות לשינוי:**
- כל קריאה ל-`db.collection('cases')`
- משתנים: `caseId` → `clientId`
- פונקציות: `loadCases()` → `loadClients()`

#### ✅ **js/modules/budget-tasks.js** - ניהול משימות
**שינויים נדרשים:**
- הסרת שדה `caseId` מטופס יצירת משימה
- שימוש רק ב-`clientId`
- עדכון badges - `caseNumber` מגיע מ-`client.caseNumber`
- פונקציה `createTask()` - הסרת `caseId` מ-data

#### ✅ **js/modules/timesheet.js** - שעתון
**שינויים נדרשים:**
- `createTimesheetCard()` - `caseNumber` מגיע מ-entry
- ללא שינוי משמעותי - כבר עובד עם נתונים denormalized

#### ✅ **js/modules/timesheet-constants.js**
- ✅ ללא שינוי - רק badges

#### ✅ **js/modules/client-case-selector.js** - סלקטור לקוחות/תיקים
**שינויים משמעותיים:**
- **שם חדש:** `client-selector.js` (להסיר "case")
- **מחיקת לוגיקה:** כל הטיפול בתיקים נפרדים
- **dropdown חדש:** רק לקוחות (שם + מספר תיק)
- **קריאות API:**
  - מחיקת `db.collection('cases')` (שורה 237, 289, 479)
  - רק `db.collection('clients')`

#### ✅ **js/modules/modern-client-case-selector.js**
**שינויים:**
- אותם שינויים כמו `client-case-selector.js`
- `db.collection('cases')` → `db.collection('clients')` (שורות 272, 353)

#### ✅ **js/cases.js** - ניהול תיקים
**אפשרויות:**
1. **מחיקה מלאה** - אם לא בשימוש
2. **שינוי שם ל-** `clients-management.js` + עדכון מלא
- שורה 1376: `collection('cases')` → `collection('clients')`

#### ✅ **js/legal-procedures.js**
**בדיקה נדרשת:**
- האם משתמש ב-`caseId`?
- עדכון לפי הצורך

#### ✅ **js/system-diagnostics.js**
**שינויים:**
- שורה 115: `db.collection('cases')` → `db.collection('clients')`

#### ✅ **js/modules/firebase-operations.js**
**שינויים:**
- שורה 71: `db.collection('cases')` → `db.collection('clients')`

#### ✅ **js/modules/selectors-loader.js**
**בדיקה:**
- עדכון imports אם משתמש ב-case-selector

---

### 🌐 Frontend - HTML Files

#### ✅ **index.html** - ממשק ראשי
**שינויים בממשק:**
1. **טופס יצירת לקוח חדש:**
   - הסרת dropdown "בחר תיק קיים"
   - הוספת שדות:
     - מספר תיק (מוסתר - אוטומטי)
     - סוג הליך (dropdown: שעתי/פיקס/הליך משפטי)
     - שירותים (טבלה דינמית)

2. **טופס הוספת משימה:**
   - שינוי: "בחר לקוח + תיק" → "בחר לקוח"
   - dropdown: "ראובן כהן - #2025001"

3. **טופס רישום זמן:**
   - שינוי: "בחר תיק" → "בחר לקוח"

**אלמנטים למחיקה:**
- כל אזכור ל-"תיק" כישות נפרדת
- כפתורים: "צור תיק חדש", "ניהול תיקים"

**אלמנטים לעדכון:**
- "לקוח" במקום "לקוח/תיק"

#### ✅ **admin/admin-unified-v2.html** - ממשק ניהול
**שינויים:**
- הסרת טאב "ניהול תיקים" (אם קיים)
- עדכון טופס יצירת לקוח (כמו index.html)

---

### 🧪 Tests (functions/test/)

#### ✅ **functions/test/workflow-enforcement.test.js**
**שינויים:**
- שורה 89: `db.collection('cases')` → `db.collection('clients')`
- עדכון כל ה-test cases

---

### 📊 Database - Firestore Structure

#### **Collection: `clients`** ✅ (עדכון)
```javascript
{
  // Document ID = caseNumber (!)
  id: "2025001",

  // נתונים בסיסיים
  caseNumber: "2025001",
  clientName: "ראובן כהן",
  phone: "050-1234567",
  email: "reuven@example.com",
  idNumber: "123456789",
  address: "תל אביב",

  // מידע על התיק
  procedureType: "hours", // hours/fixed/legal_procedure
  status: "active",
  priority: "medium",
  description: "תיאור התיק",

  // שירותים וחבילות
  services: [
    {
      id: "srv_001",
      name: "ייצוג בבית משפט",
      type: "hours",
      status: "active",
      packages: [
        {
          id: "pkg_001",
          hours: 40,
          hoursUsed: 15,
          hoursRemaining: 25,
          purchaseDate: "2025-01-01",
          status: "active"
        }
      ],
      totalHours: 40,
      hoursUsed: 15,
      hoursRemaining: 25
    }
  ],

  // backward compatibility
  totalHours: 40,
  hoursRemaining: 25,
  minutesRemaining: 1500,

  // metadata
  createdAt: timestamp,
  createdBy: "username",
  lastModifiedAt: timestamp,
  lastModifiedBy: "username"
}
```

#### **Collection: `cases`** ❌ (למחיקה)
- יימחק לאחר המיגרציה

#### **Collection: `budget_tasks`** ✅ (עדכון)
```javascript
{
  // הסרת caseId, שימוש רק ב-clientId
  clientId: "2025001",  // = caseNumber
  clientName: "ראובן כהן",
  caseNumber: "2025001", // denormalized
  serviceId: "srv_001",
  serviceName: "ייצוג בבית משפט",
  // ... שאר השדות
}
```

#### **Collection: `timesheet`** ✅ (עדכון)
```javascript
{
  // הסרת caseId, שימוש רק ב-clientId
  clientId: "2025001",
  clientName: "ראובן כהן",
  caseNumber: "2025001", // denormalized
  serviceId: "srv_001",
  serviceName: "ייצוג בבית משפט",
  // ... שאר השדות
}
```

---

## 🔄 סקריפט מיגרציה (functions/migrations/)

### **קובץ חדש: `functions/migrations/merge-clients-cases.js`**

```javascript
/**
 * מיגרציה: מיזוג clients + cases
 * 1. העתקת נתונים מ-cases ל-clients
 * 2. עדכון tasks ו-timesheet
 * 3. מחיקת cases collection
 */
```

**שלבי המיגרציה:**
1. ✅ גיבוי מלא (Firestore export)
2. ✅ קריאת כל ה-cases
3. ✅ לכל case:
   - מציאת ה-client המתאים
   - העתקת services[], procedureType
   - מחיקת ה-case
4. ✅ עדכון כל ה-tasks:
   - החלפת caseId ב-clientId
   - הוספת caseNumber
5. ✅ עדכון כל ה-timesheet entries:
   - החלפת caseId ב-clientId
   - הוספת caseNumber
6. ✅ אימות (verification)
7. ✅ מחיקת cases collection

---

## 📝 צ'קליסט ביצוע

### שלב 1: הכנה
- [ ] גיבוי מלא של Firestore
- [ ] גיבוי מלא של הקוד
- [ ] בדיקת כמה cases ו-clients קיימים

### שלב 2: Backend
- [ ] יצירת `generateCaseNumber()`
- [ ] עדכון `createClient`
- [ ] עדכון `createBudgetTask`
- [ ] עדכון `addTimeToTask`
- [ ] עדכון `createTimesheetEntry`
- [ ] מחיקת פונקציות case
- [ ] יצירת `addServiceToClient`
- [ ] יצירת `addPackageToService`

### שלב 3: Frontend - JavaScript
- [ ] עדכון `client-case-selector.js`
- [ ] עדכון `modern-client-case-selector.js`
- [ ] עדכון `budget-tasks.js`
- [ ] עדכון `main.js`
- [ ] עדכון `cases.js` / מחיקה
- [ ] עדכון `system-diagnostics.js`
- [ ] עדכון `firebase-operations.js`

### שלב 4: Frontend - HTML
- [ ] עדכון `index.html` - טופס לקוח
- [ ] עדכון `index.html` - טופס משימה
- [ ] עדכון `index.html` - רישום זמן
- [ ] עדכון `admin-unified-v2.html`

### שלב 5: מיגרציה
- [ ] כתיבת סקריפט מיגרציה
- [ ] הרצה ב-dry-run
- [ ] הרצה אמיתית
- [ ] אימות תוצאות

### שלב 6: בדיקות
- [ ] יצירת לקוח חדש
- [ ] הוספת שירות
- [ ] יצירת משימה
- [ ] רישום זמן
- [ ] בדיקת קיזוז שעות
- [ ] בדיקת חיפוש dropdown

### שלב 7: פריסה
- [ ] פריסת Backend
- [ ] פריסת Frontend
- [ ] מעקב לוגים
- [ ] תיקון באגים

---

## ⏱️ הערכת זמן

- **Backend:** 4-6 שעות
- **Frontend JS:** 3-4 שעות
- **Frontend HTML:** 2-3 שעות
- **מיגרציה:** 3-5 שעות (תלוי בכמות נתונים)
- **בדיקות:** 2-3 שעות

**סה"כ:** 14-21 שעות עבודה

---

## 🚨 סיכונים וטיפול

1. **אובדן נתונים**
   - ✅ גיבוי מלא לפני כל שלב
   - ✅ dry-run של מיגרציה
   - ✅ אפשרות rollback

2. **משתמשים פעילים**
   - ✅ הודעה מראש
   - ✅ downtime מתוכנן
   - ✅ מעקב בזמן אמת

3. **שינויים משמעותיים**
   - ✅ תיעוד מלא
   - ✅ הדרכת משתמשים
   - ✅ תמיכה צמודה

---

## 📞 צור קשר לשאלות
- תיעוד זה נוצר אוטומטית
- תאריך: 24/10/2025
- גרסה: 1.0
