# מערכת ניהול חבילות שעות (Packages System)

**תאריך:** 23 אוקטובר 2025
**סטטוס:** ✅ מיושם ופועל

---

## 📦 מה זה מערכת החבילות?

מערכת החבילות מאפשרת לעקוב אחרי **כל רכישה של שעות בנפרד**, כולל:
- מתי נרכשה החבילה
- כמה שעות היו בה
- כמה שעות נוצלו
- כמה שעות נותרות
- האם היא פעילה או סגורה

זה מאפשר להפיק דוחות מדויקים לכל חבילה בנפרד!

---

## 🎯 הבעיה שפתרנו

### לפני המערכת החדשה:
```javascript
// ❌ אין מעקב היסטורי!
case = {
  totalHours: 30,      // סך הכל 30 שעות - אבל לא יודעים מאיפה!
  hoursUsed: 15,       // נוצלו 15 - אבל מאיזו תקופה?
  hoursRemaining: 15   // נותרו 15 - אבל מתי רכשו?
}
```

**בעיות:**
- ❌ לא יודעים מתי לקוח חידש חבילה
- ❌ לא ניתן לייצא דוח "מתאריך X עד תאריך Y"
- ❌ לא ניתן לדעת כמה שילם הלקוח על כל חבילה
- ❌ כשנגמרות שעות, צריך לפתוח תיק חדש (בזבוז!)

---

### אחרי המערכת החדשה:
```javascript
// ✅ מעקב מלא!
stage = {
  packages: [
    // חבילה ראשונה - סגורה
    {
      id: 'pkg_001',
      type: 'initial',
      hours: 10,
      hoursUsed: 10,
      hoursRemaining: 0,
      purchaseDate: '2024-01-01',
      closedDate: '2024-02-15',    // ✅ יודע מתי נגמרה!
      status: 'depleted',
      paidAmount: 5000
    },

    // חבילה שנייה - פעילה
    {
      id: 'pkg_002',
      type: 'renewal',              // ✅ חידוש!
      hours: 20,
      hoursUsed: 5,
      hoursRemaining: 15,
      purchaseDate: '2024-02-15',
      status: 'active',
      paidAmount: 10000,
      reason: 'לקוח חידש חבילה'
    }
  ],

  totalHours: 30,      // סיכום
  hoursUsed: 15,
  hoursRemaining: 15
}
```

**יתרונות:**
- ✅ יודעים בדיוק מתי נרכשה כל חבילה
- ✅ ניתן לייצא דוח לכל חבילה בנפרד
- ✅ יודעים כמה שילם הלקוח
- ✅ חבילות נסגרות אוטומטית
- ✅ אין צורך לפתוח תיק חדש - פשוט מוסיפים חבילה!

---

## 🏗️ המבנה הטכני

### 1. מבנה חבילה (Package)

```javascript
{
  id: string,               // מזהה יחודי (pkg_001, pkg_additional_123...)
  type: 'initial' | 'additional' | 'renewal',
  hours: number,            // כמות השעות שנרכשו
  hoursUsed: number,        // כמה שעות נוצלו
  hoursRemaining: number,   // כמה שעות נותרות
  purchaseDate: string,     // מתי נרכשה (ISO 8601)
  closedDate: string,       // מתי נסגרה (אם סגורה)
  status: 'active' | 'depleted',
  paidAmount: number,       // כמה שילם הלקוח (אופציונלי)
  reason: string,           // סיבת הרכישה
  addedBy: string,          // מי הוסיף (שם משתמש)
  addedAt: string           // מתי הוסיף
}
```

---

### 2. איך זה עובד בתיקים שונים?

#### א. תיק שעתי רגיל (`procedureType: "hours"`)

```javascript
case = {
  procedureType: 'hours',
  services: [{
    id: 'srv_001',
    type: 'hours',
    packages: [
      { id: 'pkg_001', hours: 10, hoursUsed: 10, status: 'depleted' },
      { id: 'pkg_002', hours: 20, hoursUsed: 5, status: 'active' }
    ],
    totalHours: 30,
    hoursUsed: 15,
    hoursRemaining: 15
  }]
}
```

---

#### ב. הליך משפטי - תמחור שעתי

```javascript
case = {
  procedureType: 'legal_procedure',
  pricingType: 'hourly',
  currentStage: 'stage_a',

  stages: [
    {
      id: 'stage_a',
      name: 'שלב א',
      status: 'active',
      packages: [
        { id: 'pkg_a1', hours: 10, hoursUsed: 8, status: 'active' }
      ],
      totalHours: 10,
      hoursUsed: 8,
      hoursRemaining: 2
    },
    {
      id: 'stage_b',
      name: 'שלב ב',
      status: 'pending',
      packages: [
        { id: 'pkg_b1', hours: 15, hoursUsed: 0, status: 'active' }
      ],
      totalHours: 15,
      hoursUsed: 0,
      hoursRemaining: 15
    }
  ]
}
```

**כשעובד רושם שעות:**
1. מוצא את השלב הפעיל (`stage_a`)
2. מוצא את החבילה הפעילה בשלב (`pkg_a1`)
3. מקזז מהחבילה
4. סוגר את החבילה אם התרוקנה

---

#### ג. הליך משפטי - מחיר קבוע

```javascript
case = {
  procedureType: 'legal_procedure',
  pricingType: 'fixed',

  stages: [
    {
      id: 'stage_a',
      fixedPrice: 5000,
      paid: true,
      hoursWorked: 12,      // ✅ מעקב כמה שעות הושקעו (לא קיזוז!)
      totalHoursWorked: 12
    }
  ]
}
```

**הבדל:** במחיר קבוע לא מקזזים, רק עוקבים אחר כמה שעות הושקעו.

---

## 🔄 תהליכים אוטומטיים

### 1. קיזוז שעות (`createTimesheetEntry`)

```javascript
// כשעובד רושם שעות:
await createTimesheetEntry({
  caseId: 'case_123',
  minutes: 120,
  action: 'עבודה על התיק'
});

// מה קורה מאחורי הקלעים:
1. מוצא את התיק
2. מזהה את הסוג (hours / legal_procedure)
3. מוצא את השלב הנוכחי (אם רלוונטי)
4. מוצא את החבילה הפעילה ➜ getActivePackage(stage)
5. מקזז מהחבילה ➜ deductHoursFromPackage(package, 2)
6. אם החבילה התרוקנה ➜ סוגר אותה אוטומטית!
7. שומר stageId ו-packageId ב-timesheet_entry
```

**קוד מפושט:**
```javascript
const activePackage = getActivePackage(stage);
if (activePackage) {
  deductHoursFromPackage(activePackage, hoursWorked);

  // שמור במי package/stage זה נרשם
  entryData.packageId = activePackage.id;
  entryData.stageId = stage.id;
}
```

---

### 2. סגירה אוטומטית של חבילות

```javascript
function deductHoursFromPackage(package, hours) {
  package.hoursUsed += hours;
  package.hoursRemaining -= hours;

  // ✅ סגירה אוטומטית!
  if (package.hoursRemaining <= 0) {
    package.status = 'depleted';
    package.closedDate = new Date().toISOString();
    console.log(`📦 חבילה ${package.id} נסגרה`);
  }
}
```

---

### 3. הוספת חבילה חדשה (`addHoursPackageToStage`)

```javascript
await addHoursPackageToStage({
  caseId: 'case_123',
  stageId: 'stage_a',
  hours: 20,
  reason: 'לקוח חידש חבילה'
});

// מה קורה:
1. סוגר את כל החבילות שהתרוקנו (אם יש)
2. יוצר חבילה חדשה עם status: 'active'
3. מוסיף לרשימת החבילות (לא מחליף!)
4. מעדכן totalHours ו-hoursRemaining
```

**קוד מפושט:**
```javascript
// סגור חבילות ישנות
currentPackages.forEach(pkg => {
  if (pkg.hoursRemaining <= 0) {
    pkg.status = 'depleted';
    pkg.closedDate = now;
  }
});

// הוסף חבילה חדשה
const newPackage = {
  id: `pkg_additional_${Date.now()}`,
  hours: 20,
  status: 'active',
  // ...
};

stage.packages.push(newPackage);
```

---

## 📊 רישומי שעות (Timesheet Entries)

כל רישום שעות עכשיו כולל קישור לחבילה ולשלב:

```javascript
// timesheet_entry:
{
  id: 'entry_123',
  clientId: 'client_xxx',
  caseId: 'case_yyy',
  stageId: 'stage_a',        // ✅ איזה שלב
  packageId: 'pkg_002',      // ✅ איזו חבילה!
  minutes: 120,
  hours: 2,
  date: '2024-02-20',
  action: 'עבודה על התיק',
  employee: 'haim@example.com',
  lawyer: 'חיים'
}
```

---

## 📈 דוחות וייצוא

### 1. דוח לפי חבילה

```javascript
// כל השעות שנרשמו לחבילה ספציפית:
const entries = await db.collection('timesheet_entries')
  .where('packageId', '==', 'pkg_001')
  .get();

// תוצאה:
// - כל השעות שנרשמו לחבילה הזו
// - מתאריך 01/01/2024 עד 15/02/2024
// - סה"כ 10 שעות
```

---

### 2. דוח לפי תאריכים

```javascript
// כל השעות בין תאריכים:
const package = case.stages[0].packages.find(p =>
  p.purchaseDate >= '2024-01-01' &&
  p.purchaseDate <= '2024-02-15'
);

const entries = await db.collection('timesheet_entries')
  .where('packageId', '==', package.id)
  .get();
```

---

### 3. דוח כלכלי

```javascript
// כמה שילם הלקוח vs כמה שעות קיבל:
packages.forEach(pkg => {
  console.log(`
    חבילה: ${pkg.id}
    שולם: ${pkg.paidAmount} ₪
    שעות: ${pkg.hoursUsed}/${pkg.hours}
    תאריכים: ${pkg.purchaseDate} - ${pkg.closedDate}
  `);
});
```

---

## 🎨 תצוגה בממשק

### במסך לקוחות - תצוגה מודרנית:

```
┌─────────────────────────────────────────┐
│ 📋 תיק #12345 - משה כהן - שלב א'       │
├─────────────────────────────────────────┤
│                                         │
│ 💼 חבילה פעילה                         │
│ ┌───────────────────────────────────┐   │
│ │ נותרו: 15 מתוך 20 שעות           │   │
│ │ נרכש: 15/02/2024                  │   │
│ │ שולם: ₪10,000                     │   │
│ └───────────────────────────────────┘   │
│                                         │
│ 📊 היסטוריה                            │
│ ┌───────────────────────────────────┐   │
│ │ חבילה 1 (סגורה)                  │   │
│ │ 10/10 שעות                        │   │
│ │ 01/01/2024 - 15/02/2024           │   │
│ │ ₪5,000                            │   │
│ └───────────────────────────────────┘   │
│                                         │
│ [➕ הוסף חבילה] [📥 ייצא דוח]          │
└─────────────────────────────────────────┘
```

---

## 🔧 פונקציות עזר

### 1. `getActivePackage(stage)`
```javascript
/**
 * מוצא את החבילה הפעילה בשלב
 * @returns החבילה הראשונה שהיא active ויש לה שעות > 0
 */
function getActivePackage(stage) {
  return stage.packages.find(pkg =>
    pkg.status === 'active' && pkg.hoursRemaining > 0
  );
}
```

---

### 2. `deductHoursFromPackage(package, hours)`
```javascript
/**
 * מקזז שעות מחבילה
 * סוגר אותה אוטומטית אם התרוקנה
 */
function deductHoursFromPackage(package, hours) {
  package.hoursUsed += hours;
  package.hoursRemaining -= hours;

  if (package.hoursRemaining <= 0) {
    package.status = 'depleted';
    package.closedDate = new Date().toISOString();
  }
}
```

---

### 3. `closePackageIfDepleted(package)`
```javascript
/**
 * סוגר חבילה אם היא התרוקנה
 */
function closePackageIfDepleted(package) {
  if (package.hoursRemaining <= 0 && package.status === 'active') {
    package.status = 'depleted';
    package.closedDate = new Date().toISOString();
  }
}
```

---

## 🎬 תרחיש מלא - דוגמה

### יום 1 - רכישה ראשונה
```javascript
// לקוח רוכש 10 שעות
await createClient({
  clientName: 'משה כהן',
  procedureType: 'hours',
  totalHours: 10
});

// נוצר:
packages = [{
  id: 'pkg_initial_001',
  type: 'initial',
  hours: 10,
  hoursRemaining: 10,
  status: 'active'
}]
```

---

### יום 5 - עבודה
```javascript
// עובד רושם 2 שעות
await createTimesheetEntry({
  caseId: 'case_123',
  minutes: 120
});

// מתעדכן:
packages[0] = {
  hoursUsed: 2,
  hoursRemaining: 8,
  status: 'active'
}

// נרשם:
timesheet_entry = {
  packageId: 'pkg_initial_001',
  minutes: 120
}
```

---

### יום 30 - גמר השעות
```javascript
// עובד רושם 8 שעות (אחרונות)
await createTimesheetEntry({
  caseId: 'case_123',
  minutes: 480
});

// ✅ החבילה נסגרת אוטומטית!
packages[0] = {
  hoursUsed: 10,
  hoursRemaining: 0,
  status: 'depleted',        // ✅
  closedDate: '2024-02-15'   // ✅
}
```

---

### יום 31 - חידוש
```javascript
// מנהל מוסיף 20 שעות
await addHoursPackageToStage({
  caseId: 'case_123',
  stageId: 'stage_a',
  hours: 20,
  reason: 'לקוח חידש חבילה'
});

// נוסף:
packages = [
  {
    id: 'pkg_initial_001',
    status: 'depleted',      // ישן - סגור
    hoursUsed: 10
  },
  {
    id: 'pkg_additional_002',
    type: 'renewal',
    hours: 20,
    hoursUsed: 0,
    status: 'active'         // ✅ חדש - פעיל!
  }
]
```

---

### יום 35 - דוח
```javascript
// מנהל מייצא דוח לחבילה ראשונה
const report1 = await getTimesheetByPackage('pkg_initial_001');
// תוצאה: 10 שעות, 01/01 - 15/02

// מנהל מייצא דוח לחבילה שנייה
const report2 = await getTimesheetByPackage('pkg_additional_002');
// תוצאה: 5 שעות עד כה, מ-15/02
```

---

## ✅ סיכום

| תכונה | לפני | אחרי |
|-------|------|------|
| **מעקב היסטורי** | ❌ | ✅ |
| **סגירה אוטומטית** | ❌ | ✅ |
| **דוח לפי תקופה** | ❌ | ✅ |
| **דוח לפי חבילה** | ❌ | ✅ |
| **חידוש חבילות** | ❌ צריך תיק חדש | ✅ פשוט מוסיפים |
| **מעקב תשלומים** | ❌ | ✅ |
| **קישור רישום→חבילה** | ❌ | ✅ |

---

## 📞 מיקום בקוד

### פונקציות עזר:
- `getActivePackage()` - [functions/index.js:228-239](functions/index.js#L228-L239)
- `deductHoursFromPackage()` - [functions/index.js:265-277](functions/index.js#L265-L277)
- `closePackageIfDepleted()` - [functions/index.js:247-254](functions/index.js#L247-L254)

### קיזוז שעות:
- `createTimesheetEntry()` - [functions/index.js:1881-1996](functions/index.js#L1881-L1996)

### הוספת חבילה:
- `addHoursPackageToStage()` - [functions/index.js:3161-3290](functions/index.js#L3161-L3290)

---

**עודכן לאחרונה:** 23 אוקטובר 2025
