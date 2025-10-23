# תיקון Admin Dashboard - User Tracking System

## תאריך: 12/10/2025

## סיכום הבעיה
ה-Admin Dashboard היה מנסה לטעון נתוני עובדים אבל קיבל שגיאה:
```
FirebaseError: Function Query.where() called with invalid data. Unsupported field value: undefined
```

## הבעיות שזוהו

### 1. שדות לא תואמים במסד הנתונים
- ה-Admin Dashboard חיפש: `userData.displayName` או `userData.name`
- המערכת שומרת: `userData.username` או `doc.id`
- התוצאה: השאילתות קיבלו `undefined`

### 2. Collection לא תואם
- ה-Admin Dashboard חיפש: `active_sessions`
- המערכת שומרת: `sessions`
- התוצאה: לא מצא משתמשים מחוברים

### 3. שדה לא תואם ב-sessions
- ה-Admin Dashboard חיפש: `where("employee", "==", employeeName)`
- המערכת שומרת: `userId` (לא `employee`)

## התיקונים שבוצעו

### קובץ: `admin/admin.html`

#### תיקון 1: שימוש ב-username הנכון
**קודם (שורות 1004-1010):**
```javascript
const userData = doc.data();
const timesheetSnapshot = await db
  .collection("timesheet_entries")
  .where("employee", "==", userData.displayName || userData.name)
  .get();
```

**אחרי:**
```javascript
const userData = doc.data();
const employeeName = userData.username || doc.id;

if (!employeeName) {
  console.warn(`⚠️ משתמש ללא שם: ${doc.id}`);
  continue;
}

const timesheetSnapshot = await db
  .collection("timesheet_entries")
  .where("employee", "==", employeeName)
  .get();
```

#### תיקון 2: תיקון שאילתת משימות (שורה 1036)
**קודם:**
```javascript
.where("employee", "==", userData.displayName || userData.name)
```

**אחרי:**
```javascript
.where("employee", "==", employeeName)
```

#### תיקון 3: תיקון פונקציית checkUserOnlineStatus (שורות 1076-1078)
**קודם:**
```javascript
const sessionsSnapshot = await db
  .collection("active_sessions")
  .where("employee", "==", employeeName)
  .where("isActive", "==", true)
  .get();
```

**אחרי:**
```javascript
const sessionsSnapshot = await db
  .collection("sessions")
  .where("userId", "==", employeeName)
  .where("isActive", "==", true)
  .get();
```

#### תיקון 4: תיקון updateUserSession (שורה 2143)
**קודם:**
```javascript
.collection("active_sessions")
```

**אחרי:**
```javascript
.collection("sessions")
```

#### תיקון 5: תיקון cleanupOldSessions (שורה 2177)
**קודם:**
```javascript
.collection("active_sessions")
```

**אחרי:**
```javascript
.collection("sessions")
```

## מבנה הנתונים ב-Firebase

### Collection: `users`
```javascript
{
  username: "שם המשתמש",  // מזהה ראשי
  lastLogin: Timestamp,
  isOnline: boolean,
  currentSession: "session_id",
  updatedAt: Timestamp
}
```

### Collection: `sessions`
```javascript
{
  userId: "שם המשתמש",    // תואם ל-username
  sessionId: "unique_id",
  loginTime: Timestamp,
  lastActivity: Timestamp,
  isActive: boolean,
  device: {...},
  actions: [...]
}
```

### Collection: `timesheet_entries`
```javascript
{
  employee: "שם המשתמש",  // תואם ל-username
  clientName: "...",
  minutes: 120,
  date: "...",
  ...
}
```

### Collection: `budget_tasks`
```javascript
{
  employee: "שם המשתמש",  // תואם ל-username
  taskName: "...",
  status: "...",
  ...
}
```

## בדיקות שיש לבצע

1. ✅ התחבר כמשתמש ב-index.html
2. ✅ פתח את admin/admin.html
3. ✅ וודא שאין שגיאות ב-Console
4. ✅ וודא שהעובדים נטענים בטבלה
5. ✅ וודא שהסטטוס "מחובר" מוצג נכון

## קבצים ששונו

- ✅ `admin/admin.html` - תיקון כל השאילתות והפניות

## קבצים שנוצרו קודם (קשורים)

- `user-tracker.js` - מערכת מעקב משתמשים
- `admin/admin-manager.js` - API לדשבורד

## הערות נוספות

- כל השאילתות עכשיו מתואמות למבנה הנתונים האמיתי
- המערכת תומכת ב-fallback: אם `userData.username` לא קיים, משתמשת ב-`doc.id`
- הוספנו validation: אם אין שם משתמש, מדלג על המשתמש ומדפיס אזהרה

## שלב הבא

אחרי התיקונים, Admin Dashboard אמור:
1. לטעון נתוני עובדים מ-Firebase
2. להציג משתמשים מחוברים בזמן אמת
3. להציג שעות שבועיות ומשימות פעילות לכל עובד
4. לאפשר ניהול מלא של המשתמשים

---
**תיעוד זה נוצר על ידי Claude Code**
