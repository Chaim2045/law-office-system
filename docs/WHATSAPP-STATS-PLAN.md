# 📊 תכנון: סטטיסטיקות מתקדמות בבוט WhatsApp

## 🎯 מטרה
להוסיף לבוט WhatsApp יכולת לשלוף נתונים מניהול עובדים:
- מי מילא שעתון היום
- מי ביצע משימות
- כמות משימות לפי עובד

---

## 🐛 בעיה נוכחית - תיקון דחוף

### **שגיאה בסטטיסטיקות הקיימות**

**קובץ:** `functions/src/whatsapp-bot/WhatsAppBot.js`
**פונקציה:** `showStats()` (שורות 593-635)

**הבעיה:**
```javascript
// שורה 602: מחפש approvedAt
.where('approvedAt', '>=', today)

// שורה 608: מחפש rejectedAt
.where('rejectedAt', '>=', today)

// אבל בקוד של approveTask/rejectTask השדה נקרא:
reviewedAt: admin.firestore.FieldValue.serverTimestamp()
```

**הפתרון:**
```javascript
// אפשרות 1: שנה את showStats לחפש reviewedAt
.where('reviewedAt', '>=', today)

// אפשרות 2: הוסף גם approvedAt/rejectedAt בעת אישור/דחייה
approvedAt: admin.firestore.FieldValue.serverTimestamp()  // בנוסף ל-reviewedAt
```

**המלצה:** אפשרות 1 (פשוטה יותר)

---

## 📋 סטטיסטיקות חדשות - תכנון

### **1️⃣ שעתונים היום**

**מקור נתונים:** `timesheets` collection

**שאילתה:**
```javascript
const today = new Date();
today.setHours(0, 0, 0, 0);
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);

// כל השעתונים של היום
const timesheetsToday = await db.collection('timesheets')
    .where('date', '>=', today)
    .where('date', '<', tomorrow)
    .get();

// קבוצה לפי עובד
const employeesWithTimesheets = new Set();
timesheetsToday.forEach(doc => {
    employeesWithTimesheets.add(doc.data().userEmail);
});

// כל העובדים הפעילים
const allEmployees = await db.collection('employees')
    .where('isActive', '==', true)
    .get();

// מי לא מילא
const employeesWithoutTimesheets = [];
allEmployees.forEach(doc => {
    if (!employeesWithTimesheets.has(doc.id)) {
        employeesWithoutTimesheets.push(doc.data().name);
    }
});
```

**פלט WhatsApp:**
```
📅 שעתונים - ${today.toLocaleDateString('he-IL')}

✅ מילאו שעתון (${employeesWithTimesheets.size}):
• חיים ✓
• גיא ✓
• רועי ✓

❌ לא מילאו (${employeesWithoutTimesheets.length}):
• דני ✗
• מיכל ✗

⏱️ סה"כ שעות שדווחו: 23.5
```

---

### **2️⃣ משימות שבוצעו היום**

**מקור נתונים:** `task_actions` collection (או `timesheets` עם taskId)

**שאילתה:**
```javascript
const today = new Date();
today.setHours(0, 0, 0, 0);

// כל ה-timesheets של היום עם משימות
const tasksToday = await db.collection('timesheets')
    .where('date', '>=', today)
    .where('taskId', '!=', null)
    .get();

// סטטיסטיקות לפי עובד
const employeeStats = {};
tasksToday.forEach(doc => {
    const data = doc.data();
    const email = data.userEmail;

    if (!employeeStats[email]) {
        employeeStats[email] = {
            name: data.userName,
            taskCount: 0,
            totalHours: 0
        };
    }

    employeeStats[email].taskCount++;
    employeeStats[email].totalHours += (data.hours || 0);
});
```

**פלט WhatsApp:**
```
📋 משימות - ${today.toLocaleDateString('he-IL')}

👤 חיים:
   • משימות: 5
   • שעות: 6.5

👤 גיא:
   • משימות: 3
   • שעות: 4.0

👤 רועי:
   • משימות: 0
   • שעות: 0

📊 סה"כ: 8 משימות, 10.5 שעות
```

---

### **3️⃣ דוח עובד ספציפי**

**אפשרות לשלוח:** `"סטטיסטיקות חיים"` או `"דוח גיא"`

**שאילתה:**
```javascript
// מצא את העובד לפי שם
const employeeSnapshot = await db.collection('employees')
    .where('name', '==', employeeName)
    .limit(1)
    .get();

const employeeEmail = employeeSnapshot.docs[0].id;

// שעתונים שלו היום
const timesheets = await db.collection('timesheets')
    .where('userEmail', '==', employeeEmail)
    .where('date', '>=', today)
    .where('date', '<', tomorrow)
    .get();

// משימות שלו היום
const tasks = await db.collection('budget_tasks')
    .where('assignedTo', '==', employeeEmail)
    .where('status', '==', 'פעיל')
    .get();
```

**פלט WhatsApp:**
```
👤 דוח: חיים

📅 תאריך: 10/12/2024

✅ שעתון: מולא (8 שעות)

📋 משימות:
• לקוח אברהם - 2.5 שעות
• לקוח דוד - 1.5 שעות
• ניהול פנימי - 1 שעה

⏱️ סה"כ: 3 משימות, 5 שעות

📈 יעילות: 62.5% (5/8 שעות)
```

---

## 🎨 תפריט חדש בבוט

### **תפריט סטטיסטיקות מורחב:**

```
📊 סטטיסטיקות

1️⃣ דוח מהיר (משימות היום)
2️⃣ שעתונים (מי מילא ומי לא)
3️⃣ משימות לפי עובד
4️⃣ דוח עובד ספציפי
5️⃣ חזרה לתפריט ראשי

כתוב מספר או שם הפעולה
```

---

## 🏗️ מבנה הקוד

### **קבצים שצריך לשנות:**

#### 1. **`WhatsAppBot.js`**

**פונקציות חדשות:**
```javascript
// תיקון הבאג הקיים
async showStats(userInfo, session) {
    // שנה approvedAt → reviewedAt
}

// פונקציה חדשה: תפריט סטטיסטיקות
async showStatsMenu(userInfo, session) {
    // הצג את התפריט המורחב
}

// פונקציה חדשה: שעתונים היום
async showTimesheetStats(userInfo) {
    // מי מילא שעתון היום
}

// פונקציה חדשה: משימות לפי עובד
async showTasksByEmployee(userInfo) {
    // כמות משימות לפי עובד
}

// פונקציה חדשה: דוח עובד ספציפי
async showEmployeeReport(employeeName, userInfo) {
    // דוח מפורט על עובד אחד
}

// הוספה ל-handleStatsContext
async handleStatsContext(message, session, userInfo) {
    const msgLower = message.toLowerCase().trim();

    if (msgLower.match(/^1$/)) {
        return await this.showStats(userInfo, session);
    }

    if (msgLower.match(/^2$|שעתונ/)) {
        return await this.showTimesheetStats(userInfo);
    }

    if (msgLower.match(/^3$|משימות.*עובד/)) {
        return await this.showTasksByEmployee(userInfo);
    }

    if (msgLower.match(/^4$|דוח/)) {
        // המשתמש צריך לציין שם עובד
        return 'כתוב "דוח [שם עובד]", למשל: "דוח חיים"';
    }

    // אם כתב "דוח חיים"
    const reportMatch = message.match(/דוח\s+(.+)/i);
    if (reportMatch) {
        return await this.showEmployeeReport(reportMatch[1], userInfo);
    }
}
```

---

## 📊 Firestore Collections שנשתמש בהן

### 1. **`timesheets`**
```javascript
{
    id: "auto-generated",
    userEmail: "haim@example.com",
    userName: "חיים",
    date: Timestamp,
    hours: 8,
    taskId: "task-123" (או null),
    description: "...",
    createdAt: Timestamp
}
```

### 2. **`budget_tasks`**
```javascript
{
    id: "task-123",
    assignedTo: "haim@example.com",
    clientName: "לקוח אברהם",
    description: "...",
    status: "פעיל",
    estimatedMinutes: 120,
    actualMinutes: 90,
    createdAt: Timestamp
}
```

### 3. **`employees`**
```javascript
{
    id: "haim@example.com" (document ID),
    name: "חיים",
    role: "admin",
    isActive: true,
    phone: "+972542400403",
    whatsappEnabled: true
}
```

### 4. **`pending_task_approvals`**
```javascript
{
    id: "approval-123",
    taskId: "task-123",
    status: "approved" | "rejected" | "pending",
    reviewedAt: Timestamp,  // ✅ נשתמש בזה!
    reviewedBy: "guy@example.com",
    reviewedByName: "גיא"
}
```

---

## 🚀 תהליך היישום

### **שלב 1: תיקון הבאג (דחוף)**
- [ ] תקן את `showStats()` להשתמש ב-`reviewedAt` במקום `approvedAt`/`rejectedAt`
- [ ] בדוק שהסטטיסטיקות עובדות

### **שלב 2: הוספת פונקציות עזר**
- [ ] `showStatsMenu()` - תפריט מורחב
- [ ] `showTimesheetStats()` - שעתונים היום
- [ ] `showTasksByEmployee()` - משימות לפי עובד
- [ ] `showEmployeeReport()` - דוח עובד ספציפי

### **שלב 3: חיבור לזרימה**
- [ ] עדכון `handleStatsContext()` לתמוך בתפריט החדש
- [ ] עדכון `showHelp()` לכלול את הפקודות החדשות

### **שלב 4: בדיקות**
- [ ] בדיקה עם נתונים אמיתיים
- [ ] בדיקה עם עובדים שלא מילאו שעתון
- [ ] בדיקה של דוח עובד ספציפי

---

## 💡 שיפורים נוספים (אופציונלי)

### **1. התראות פרואקטיביות**
```javascript
// שליחה אוטומטית ב-16:00 למנהלים:
"⚠️ עדיין לא מילאו שעתון היום:
• דני
• מיכל

📊 כתוב 'שעתונים' לפרטים"
```

### **2. השוואה לאתמול/שבוע קודם**
```javascript
"📊 סטטיסטיקות היום:
✅ משימות: 12 (↑ 3 מאתמול)
⏱️ שעות: 45.5 (↓ 2.5 מאתמול)
👥 שעתונים: 8/10 (אתמול: 9/10)"
```

### **3. גרפים טקסטואליים**
```javascript
"📊 משימות לפי עובד:

חיים  ████████░░ 8
גיא    ██████░░░░ 6
רועי   ████░░░░░░ 4
דני    ██░░░░░░░░ 2
מיכל   ░░░░░░░░░░ 0"
```

---

## 🎯 סיכום

**מה נעשה:**
1. ✅ **תיקון באג** - הסטטיסטיקות הקיימות יעבדו
2. ✅ **שעתונים היום** - מי מילא ומי לא
3. ✅ **משימות לפי עובד** - כמות ושעות
4. ✅ **דוח עובד ספציפי** - פירוט מלא

**עלות ביצועים:**
- שאילתות נוספות: ~3-5 לכל קריאה לסטטיסטיקות
- זמן תגובה: ~1-2 שניות
- עלות Firestore: ~$0.0001 לקריאה (זניח)

**האם לאשר יישום?**
אם כן, אתחיל בתיקון הבאג ואז נוסיף את הפיצ'רים אחד אחד עם בדיקה בינית.
