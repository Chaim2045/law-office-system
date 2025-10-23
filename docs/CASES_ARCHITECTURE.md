# ארכיטקטורת Cases/תיקים - מערכת ניהול משרד עורכי דין

## 📋 סקירה כללית

מעבר מארכיטקטורה של **Client = Case** (לקוח = הליך אחד) לארכיטקטורה של **Client + Cases** (לקוח + תיקים מרובים).

### 🎯 מטרות המעבר:
1. ✅ אפשר ללקוח אחד מספר תיקים/הליכים
2. ✅ הפרדה מלאה של שעות בין תיקים
3. ✅ שקיפות מלאה - דו"ח נפרד לכל תיק
4. ✅ גמישות - כל תיק יכול להיות שעתי/פיקס/סגור
5. ✅ הכנה לפורטל לקוחות עתידי
6. ✅ תאימות לתעשיה המשפטית (לקוח ≠ תיק)

---

## 🗂️ מבנה הנתונים החדש

### Collection 1: `clients` - מידע אישי של לקוחות

```javascript
clients: {
  "client_abc123": {
    // מידע זהות
    clientName: "דנה לוי",              // שם מלא
    idNumber: "123456789",              // ת.ז או ח.פ
    idType: "id",                       // "id" או "company"

    // יצירת קשר
    phone: "050-1234567",
    email: "dana@example.com",
    address: "רחוב הרצל 10, תל אביב",

    // Metadata
    createdAt: Timestamp,
    createdBy: "חיים",
    lastModifiedAt: Timestamp,
    lastModifiedBy: "חיים",

    // Statistics (מחושב)
    totalCases: 3,                      // כמות תיקים
    activeCases: 2,                     // תיקים פעילים
    totalHoursRemaining: 45.5,          // סה"כ שעות נותרות בכל התיקים

    // אופציונלי
    notes: "לקוח VIP - תגובה מהירה",
    tags: ["VIP", "עירוני", "חוזרני"]
  }
}
```

### Collection 2: `cases` - תיקים משפטיים

```javascript
cases: {
  "case_xyz789": {
    // זיהוי תיק
    caseNumber: "2024/001",             // מספר תיק ייחודי (חובה משפטית!)
    caseTitle: "תביעה עירונית - עיריית ת״א",  // כותרת מתארת

    // קישור ללקוח
    clientId: "client_abc123",          // Foreign Key
    clientName: "דנה לוי",              // Denormalized למהירות

    // סוג הליך
    procedureType: "hours",             // "hours" | "fixed"

    // שדות ספציפיים לסוג הליך - HOURS
    totalHours: 50,                     // רק אם procedureType = "hours"
    hoursRemaining: 35.5,
    minutesRemaining: 2130,
    hourlyRate: 500,                    // ₪ לשעה (אופציונלי)

    // שדות ספציפיים לסוג הליך - FIXED
    stages: [                           // רק אם procedureType = "fixed"
      { id: 1, name: "שלב 1 - הגשת כתב תביעה", completed: true, completedAt: Timestamp },
      { id: 2, name: "שלב 2 - דיון מקדמי", completed: false },
      { id: 3, name: "שלב 3 - משפט", completed: false }
    ],
    fixedPrice: 15000,                  // מחיר קבוע (אופציונלי)

    // סטטוס
    status: "active",                   // "active" | "completed" | "archived" | "on_hold"
    priority: "medium",                 // "low" | "medium" | "high" | "urgent"

    // תאריכים חשובים
    openedAt: Timestamp,                // תאריך פתיחת תיק
    deadline: Timestamp,                // תאריך יעד (אופציונלי)
    completedAt: Timestamp,             // תאריך סגירה (אם status = "completed")

    // צוות
    assignedTo: ["חיים", "גיא"],       // עורכי דין אחראיים
    mainAttorney: "חיים",               // עו"ד מוביל

    // Metadata
    createdAt: Timestamp,
    createdBy: "חיים",
    lastModifiedAt: Timestamp,
    lastModifiedBy: "חיים",

    // תיוג וחיפוש
    tags: ["עירוני", "תביעה", "דחוף"],
    category: "municipal",              // קטגוריה משפטית

    // אופציונלי
    description: "תביעה בסך 50,000 ₪ נגד העירייה בגין נזקי תשתית",
    notes: "הלקוח ביקש עדכונים שבועיים",
    attachments: ["doc1.pdf", "doc2.pdf"]
  }
}
```

### Collection 3: `tasks` - משימות (מקושרות לתיק!)

```javascript
tasks: {
  "task_def456": {
    // קישור לתיק (במקום ללקוח!)
    caseId: "case_xyz789",              // ⚠️ BREAKING CHANGE - היה clientName
    caseNumber: "2024/001",             // Denormalized
    clientId: "client_abc123",          // Foreign Key
    clientName: "דנה לוי",              // Denormalized

    // פרטי המשימה
    taskTitle: "הגשת כתב תביעה",
    description: "להכין ולהגיש כתב תביעה לבית משפט השלום",

    // סטטוס
    status: "active",                   // "active" | "completed"
    priority: "high",

    // אחריות
    assignedTo: "חיים",

    // תאריכים
    deadline: Timestamp,
    createdAt: Timestamp,
    completedAt: Timestamp,

    // שעות (אם רלוונטי)
    estimatedHours: 3,
    actualHours: 2.5
  }
}
```

### Collection 4: `timesheet` - רישום שעות (מקושר לתיק!)

```javascript
timesheet: {
  "entry_ghi789": {
    // קישור לתיק
    caseId: "case_xyz789",              // ⚠️ BREAKING CHANGE
    caseNumber: "2024/001",
    clientId: "client_abc123",
    clientName: "דנה לוי",

    // פרטי הרישום
    description: "פגישה עם לקוח + הכנת טיעונים",
    minutes: 120,
    hours: 2,

    // מי ביצע
    employeeName: "חיים",

    // מתי
    date: "2024-10-16",
    timestamp: Timestamp,

    // סוג פעילות
    activityType: "meeting",            // "meeting" | "research" | "court" | "writing"

    // חיוב
    billable: true,
    hourlyRate: 500
  }
}
```

---

## 🔄 תהליך המעבר ההדרגתי

### Phase 1: הוספת Cases ללא שיבוש (Backward Compatible)

**מה נעשה:**
1. ✅ יצירת collection חדש `cases`
2. ✅ Firebase Functions חדשות: `createCase`, `getCases`, `updateCase`, `deleteCase`
3. ✅ הקוד הישן ממשיך לעבוד בדיוק כמו קודם
4. ✅ המערכת תומכת בשני המבנים במקביל

**דוגמה:**
```javascript
// הקוד הישן (ממשיך לעבוד):
await createClient({
  clientName: "דנה לוי",
  fileNumber: "2024/001",
  description: "תביעה עירונית",
  procedureType: "hours",
  totalHours: 50
})
// ✅ יוצר גם Client וגם Case אוטומטית!

// הקוד החדש (אופציונלי):
await createCase({
  clientId: "client_abc123",  // לקוח קיים
  caseNumber: "2024/002",
  caseTitle: "הליך פלילי",
  procedureType: "fixed"
})
// ✅ יוצר רק Case ללקוח קיים
```

### Phase 2: מיגרציה הדרגתית

**מה נעשה:**
1. ✅ פונקציה `migrateClientsToCases()` - ממירה לקוחות ישנים לפורמט חדש
2. ✅ כל "לקוח" ישן → נוצר `client` + `case` אחד
3. ✅ Tasks/Timesheet מקבלים שדה `caseId`
4. ✅ הקוד ממשיך לעבוד עם שני המבנים

**לוגיקת המיגרציה:**
```javascript
// לקוח ישן:
{
  clientName: "דנה לוי",
  fileNumber: "2024/001",
  description: "תביעה עירונית",
  totalHours: 50
}

// הופך ל:

// Client:
{
  clientName: "דנה לוי",
  phone: "",
  email: "",
  totalCases: 1,
  activeCases: 1
}

// Case:
{
  caseNumber: "2024/001",
  clientId: "client_abc123",
  clientName: "דנה לוי",
  caseTitle: "תביעה עירונית",
  procedureType: "hours",
  totalHours: 50,
  status: "active"
}
```

### Phase 3: UI חדש

**מה נעשה:**
1. ✅ כפתור "צור תיק חדש" במקום "צור לקוח"
2. ✅ בחירת לקוח קיים או יצירת לקוח חדש
3. ✅ תצוגת תיקים מקובצת לפי לקוח
4. ✅ דו"חות נפרדים לכל תיק

**דוגמת UI:**
```
┌─────────────────────────────────────────┐
│ 📁 לקוחות ותיקים                       │
├─────────────────────────────────────────┤
│                                         │
│ 👤 דנה לוי                              │
│    050-1234567 | dana@example.com      │
│    ───────────────────────────────────  │
│    📋 תיק 2024/001 - תביעה עירונית     │
│       ⏱️ 35.5/50 שעות | 🟢 פעיל       │
│       📌 3 משימות פעילות               │
│                                         │
│    📋 תיק 2024/055 - הליך פלילי        │
│       ✅ שלב 2/3 | 🟢 פעיל            │
│       📌 1 משימה ממתינה                │
│                                         │
│    📋 תיק 2024/012 - ייעוץ משפטי       │
│       ✔️ הושלם | 🔵 ארכיון            │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🔌 API Functions

### createCase
```javascript
exports.createCase = functions.https.onCall(async (data, context) => {
  // Input:
  {
    clientId: "client_abc123",      // אופציונלי - אם לא קיים, יוצר client חדש
    clientName: "דנה לוי",          // חובה אם אין clientId
    caseNumber: "2024/001",         // חובה - ייחודי
    caseTitle: "תביעה עירונית",    // חובה
    procedureType: "hours",         // חובה
    totalHours: 50,                 // חובה אם procedureType = "hours"
    // ...
  }

  // Output:
  {
    success: true,
    caseId: "case_xyz789",
    clientId: "client_abc123",
    case: { /* פרטי התיק */ }
  }
});
```

### getCases
```javascript
exports.getCases = functions.https.onCall(async (data, context) => {
  // Input:
  {
    clientId: "client_abc123",      // אופציונלי - מסנן לפי לקוח
    status: "active",               // אופציונלי - מסנן לפי סטטוס
    assignedTo: "חיים"             // אופציונלי - מסנן לפי עו"ד
  }

  // Output:
  {
    success: true,
    cases: [
      { caseId: "...", caseNumber: "...", clientName: "...", ... },
      { ... }
    ],
    total: 15
  }
});
```

### updateCase
```javascript
exports.updateCase = functions.https.onCall(async (data, context) => {
  // Input:
  {
    caseId: "case_xyz789",
    updates: {
      status: "completed",
      completedAt: Timestamp.now()
    }
  }

  // Output:
  {
    success: true,
    case: { /* התיק המעודכן */ }
  }
});
```

### getCasesByClient
```javascript
exports.getCasesByClient = functions.https.onCall(async (data, context) => {
  // Input:
  {
    clientId: "client_abc123"
  }

  // Output:
  {
    success: true,
    client: { clientName: "דנה לוי", ... },
    cases: [
      { caseNumber: "2024/001", status: "active", hoursRemaining: 35.5 },
      { caseNumber: "2024/055", status: "active", stage: "2/3" },
      { caseNumber: "2024/012", status: "completed" }
    ],
    statistics: {
      totalCases: 3,
      activeCases: 2,
      completedCases: 1,
      totalHoursRemaining: 35.5
    }
  }
});
```

---

## 🔒 Security Rules

```javascript
// Firestore Security Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Clients - רק משתמשים מחוברים
    match /clients/{clientId} {
      allow read: if request.auth != null;
      allow create, update, delete: if request.auth != null &&
                                      request.auth.token.role == 'admin';
    }

    // Cases - רק משתמשים מחוברים
    match /cases/{caseId} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null;
      allow delete: if request.auth != null &&
                     request.auth.token.role == 'admin';
    }

    // Tasks - קשורות לתיק
    match /tasks/{taskId} {
      allow read, write: if request.auth != null;
    }

    // Timesheet - רישום זמן
    match /timesheet/{entryId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null &&
                             (resource.data.employeeName == request.auth.token.username ||
                              request.auth.token.role == 'admin');
    }
  }
}
```

---

## 📊 דוגמאות לשאילתות

### 1. כל התיקים הפעילים של לקוח
```javascript
const activeCases = await db.collection('cases')
  .where('clientId', '==', 'client_abc123')
  .where('status', '==', 'active')
  .orderBy('createdAt', 'desc')
  .get();
```

### 2. תיקים עם שעות קריטיות (פחות מ-10%)
```javascript
const criticalCases = await db.collection('cases')
  .where('procedureType', '==', 'hours')
  .where('status', '==', 'active')
  .get();

// סינון בצד לקוח:
const filtered = criticalCases.docs
  .map(doc => ({ id: doc.id, ...doc.data() }))
  .filter(c => (c.hoursRemaining / c.totalHours) < 0.1);
```

### 3. כל המשימות של תיק ספציפי
```javascript
const tasks = await db.collection('tasks')
  .where('caseId', '==', 'case_xyz789')
  .where('status', '==', 'active')
  .orderBy('deadline', 'asc')
  .get();
```

### 4. רישומי זמן של תיק בחודש האחרון
```javascript
const lastMonth = new Date();
lastMonth.setMonth(lastMonth.getMonth() - 1);

const timeEntries = await db.collection('timesheet')
  .where('caseId', '==', 'case_xyz789')
  .where('timestamp', '>=', lastMonth)
  .orderBy('timestamp', 'desc')
  .get();

// חישוב סה"כ שעות:
const totalHours = timeEntries.docs.reduce((sum, doc) =>
  sum + (doc.data().hours || 0), 0);
```

---

## 🎨 UI Components

### CaseCard Component
```javascript
function CaseCard({ case }) {
  return `
    <div class="case-card" data-case-id="${case.id}">
      <div class="case-header">
        <span class="case-number">${case.caseNumber}</span>
        <span class="case-status status-${case.status}">${getStatusText(case.status)}</span>
      </div>

      <h3 class="case-title">${case.caseTitle}</h3>

      ${case.procedureType === 'hours' ? `
        <div class="case-hours">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${(case.hoursRemaining / case.totalHours) * 100}%"></div>
          </div>
          <span>${case.hoursRemaining}/${case.totalHours} שעות נותרו</span>
        </div>
      ` : `
        <div class="case-stages">
          <span>${case.stages.filter(s => s.completed).length}/${case.stages.length} שלבים הושלמו</span>
        </div>
      `}

      <div class="case-footer">
        <span class="assigned-to">👤 ${case.mainAttorney}</span>
        <span class="case-date">📅 ${formatDate(case.openedAt)}</span>
      </div>
    </div>
  `;
}
```

### ClientCasesView Component
```javascript
function ClientCasesView({ client, cases }) {
  return `
    <div class="client-cases-view">
      <div class="client-header">
        <h2>👤 ${client.clientName}</h2>
        <div class="client-info">
          <span>📞 ${client.phone}</span>
          <span>✉️ ${client.email}</span>
        </div>
      </div>

      <div class="cases-summary">
        <div class="stat">
          <span class="stat-value">${cases.length}</span>
          <span class="stat-label">תיקים</span>
        </div>
        <div class="stat">
          <span class="stat-value">${cases.filter(c => c.status === 'active').length}</span>
          <span class="stat-label">פעילים</span>
        </div>
        <div class="stat">
          <span class="stat-value">${calculateTotalHours(cases)}</span>
          <span class="stat-label">שעות נותרו</span>
        </div>
      </div>

      <div class="cases-list">
        ${cases.map(c => CaseCard({ case: c })).join('')}
      </div>

      <button class="btn-new-case" onclick="createNewCase('${client.id}')">
        ➕ צור תיק חדש
      </button>
    </div>
  `;
}
```

---

## 🚀 תוכנית יישום

### Week 1: Backend (Firebase Functions)
- [ ] יצירת `createCase` function
- [ ] יצירת `getCases` function
- [ ] יצירת `updateCase` function
- [ ] יצירת `deleteCase` function
- [ ] יצירת `getCasesByClient` function
- [ ] יצירת `migrateClientsToCases` function
- [ ] בדיקות

### Week 2: Frontend Module
- [ ] יצירת `cases.js` module
- [ ] פונקציות עזר: `createCase()`, `getCases()`, `updateCase()`
- [ ] רנדור: `renderCaseCard()`, `renderClientCases()`
- [ ] אינטגרציה עם `script.js`

### Week 3: UI Updates
- [ ] כפתור "צור תיק חדש"
- [ ] מודאל יצירת תיק (בחירת לקוח קיים/חדש)
- [ ] תצוגת תיקים מקובצת לפי לקוח
- [ ] עדכון משימות - קישור לתיק במקום ללקוח
- [ ] עדכון שעתון - קישור לתיק במקום ללקוח

### Week 4: Migration & Testing
- [ ] הרצת מיגרציה על נתונים קיימים
- [ ] בדיקות מקיפות
- [ ] תיקון באגים
- [ ] דוקומנטציה

---

## 📝 Notes

### Breaking Changes
- ⚠️ `tasks` collection: שדה `caseId` חדש (במקום רק `clientName`)
- ⚠️ `timesheet` collection: שדה `caseId` חדש (במקום רק `clientName`)

### Backward Compatibility
- ✅ הקוד הישן ממשיך לעבוד
- ✅ `createClient()` יוצר גם Client וגם Case אוטומטית
- ✅ Tasks/Timesheet עובדים עם שני המבנים

### Future Enhancements
- 🔮 פורטל לקוחות - כל לקוח רואה את כל התיקים שלו
- 🔮 דו"חות מתקדמים - ניתוח לפי תיק/לקוח/עו"ד
- 🔮 תזכורות אוטומטיות - deadline מתקרב
- 🔮 אינטגרציה עם לוח שנה
- 🔮 ייצוא לפורמטים (PDF, Excel)

---

**תיעוד נוצר:** 2024-10-16
**גרסה:** 1.0
**סטטוס:** תכנון ראשוני
