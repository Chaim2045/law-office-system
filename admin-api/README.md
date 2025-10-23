# 🎛️ Admin API - מערכת ניהול מתקדמת

> **גרסה:** 1.0.0
> **תאריך יצירה:** 23 אוקטובר 2025
> **פיתוח:** מערכת ניהול משרד עו"ד גיא הרשקוביץ

---

## 📋 תוכן עניינים

1. [מבוא](#מבוא)
2. [ארכיטקטורה](#ארכיטקטורה)
3. [מבנה התיקיות](#מבנה-התיקיות)
4. [API Reference](#api-reference)
5. [התקנה ופריסה](#התקנה-ופריסה)
6. [אבטחה](#אבטחה)
7. [דוגמאות שימוש](#דוגמאות-שימוש)

---

## 🎯 מבוא

**Admin API** היא מערכת ניהול מתקדמת המאפשרת למנהל המערכת לבצע פעולות ניהול מלאות במערכת משרד עורכי הדין.

### למה בנינו את זה?

במערכות מודרניות, **לעולם לא נותנים למשתמש גישה ישירה למסד הנתונים** - גם לא למנהלים!

במקום זה, בונים **Admin API** שמספק:
- ✅ **אבטחה מקסימלית** - כל פעולה עוברת בדיקות
- ✅ **Audit Trail** - כל פעולה מתועדת אוטומטית
- ✅ **גמישות** - קל להוסיף פיצ'רים חדשים
- ✅ **שליטה מלאה** - המערכת מחליטה מה מותר ומה לא

---

## 🏗️ ארכיטקטורה

```
┌─────────────────────────────────────────────────────────────┐
│                   Admin Dashboard (UI)                      │
│                  admin-dashboard-v3.html                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ HTTPS Calls (Authenticated)
                         │
┌────────────────────────▼────────────────────────────────────┐
│              Firebase Cloud Functions (Admin API)           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │    users.js  │  │   tasks.js   │  │notifications │     │
│  │              │  │              │  │     .js      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  Security Checks → Audit Logging → Admin SDK Operations    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ Admin SDK (Full Access)
                         │
┌────────────────────────▼────────────────────────────────────┐
│                 Firebase Services                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Firestore  │  │    Auth      │  │   Storage    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### ההבדל מהממשק הרגיל:

| היבט | ממשק רגיל (index.html) | Admin Dashboard |
|------|------------------------|-----------------|
| גישה למסד נתונים | ישירה (Firestore Rules) | דרך Admin API בלבד |
| הרשאות | מוגבלות (רק נתונים של המשתמש) | מלאות (דרך Admin SDK) |
| פעולות | קריאה/כתיבה בסיסיות | כל פעולה (מחיקה, חסימה, וכו') |
| Audit Log | לא | כן - כל פעולה מתועדת |

---

## 📁 מבנה התיקיות

```
admin-api/
├── README.md                    ← אתה כאן! תיעוד ראשי
│
├── functions/                   ← Cloud Functions (Backend)
│   ├── users.js                 → ניהול משתמשים
│   ├── tasks.js                 → ניהול משימות
│   ├── notifications.js         → מערכת התראות
│   ├── clients.js               → ניהול לקוחות
│   ├── audit.js                 → יומן ביקורת
│   ├── utils.js                 → פונקציות עזר משותפות
│   └── index.js                 → Entry point (exports all)
│
├── dashboard/                   ← Frontend (UI)
│   ├── admin-api-client.js      → JavaScript client לקריאות API
│   └── admin-dashboard-v3.html  → ממשק הדשבורד
│
└── docs/                        ← תיעוד מפורט
    ├── ARCHITECTURE.md          → ארכיטקטורה מפורטת
    ├── API_REFERENCE.md         → תיעוד כל ה-endpoints
    ├── DEPLOYMENT.md            → הוראות פריסה
    └── EXAMPLES.md              → דוגמאות שימוש
```

---

## 🔌 API Reference

### 👥 Users Management

| Function | תיאור | פרמטרים |
|----------|-------|---------|
| `adminCreateUser` | יצירת משתמש חדש | `{ email, password, name, role }` |
| `adminBlockUser` | חסימת משתמש | `{ userId }` |
| `adminUnblockUser` | ביטול חסימת משתמש | `{ userId }` |
| `adminDeleteUser` | מחיקת משתמש | `{ userId }` |
| `adminUpdateUserRole` | שינוי תפקיד משתמש | `{ userId, role }` |
| `adminResetPassword` | שליחת מייל לאיפוס סיסמה | `{ email }` |

### 📝 Tasks Management

| Function | תיאור | פרמטרים |
|----------|-------|---------|
| `adminTransferTask` | העברת משימה בין עובדים | `{ taskId, fromUserId, toUserId }` |
| `adminBulkTransferTasks` | העברת כל המשימות של עובד | `{ fromUserId, toUserId }` |
| `adminDeleteTask` | מחיקת משימה | `{ taskId }` |
| `adminCompleteTask` | סימון משימה כהושלמה | `{ taskId }` |

### 🔔 Notifications

| Function | תיאור | פרמטרים |
|----------|-------|---------|
| `adminSendNotification` | שליחת התראה למשתמש | `{ userId, title, message, type }` |
| `adminBroadcastNotification` | שליחת התראה לכולם | `{ title, message, type }` |

### 👔 Clients Management

| Function | תיאור | פרמטרים |
|----------|-------|---------|
| `adminBlockClient` | חסימת לקוח | `{ clientId }` |
| `adminUnblockClient` | ביטול חסימת לקוח | `{ clientId }` |
| `adminTransferClient` | העברת לקוח לעו"ד אחר | `{ clientId, toLawyerId }` |

### 📜 Audit Log

| Function | תיאור | פרמטרים |
|----------|-------|---------|
| `adminGetAuditLog` | קבלת יומן ביקורת | `{ startDate, endDate, limit }` |

---

## 🚀 התקנה ופריסה

### שלב 1: הוספת Functions ל-Firebase

```bash
# 1. העתק את הקבצים מ-admin-api/functions/ ל-functions/admin/
cp admin-api/functions/* functions/admin/

# 2. עדכן את functions/index.js
# הוסף: exports.admin = require('./admin');

# 3. פרוס ל-Firebase
firebase deploy --only functions
```

### שלב 2: עדכון הדשבורד

```bash
# 1. העתק את admin-api-client.js למקום נגיש
cp admin-api/dashboard/admin-api-client.js admin/

# 2. טען את הדשבורד החדש
# פתח: admin/admin-dashboard-v3.html
```

---

## 🔐 אבטחה

### שכבות אבטחה:

1. **Authentication** - כניסה עם Firebase Auth
2. **Authorization** - בדיקה שהמשתמש הוא admin
3. **Audit Logging** - תיעוד כל פעולה
4. **Input Validation** - בדיקת תקינות הנתונים

### דוגמה - כל Function בנויה כך:

```javascript
exports.adminXXX = functions.https.onCall(async (data, context) => {
  // ✅ שלב 1: בדיקת התחברות
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'יש להתחבר');
  }

  // ✅ שלב 2: בדיקת הרשאות admin
  if (context.auth.token.email !== 'haim@ghlawoffice.co.il') {
    throw new functions.https.HttpsError('permission-denied', 'אין הרשאה');
  }

  // ✅ שלב 3: תיעוד הפעולה (Audit)
  await logAudit({
    action: 'ADMIN_XXX',
    performedBy: context.auth.token.email,
    data: data,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });

  // ✅ שלב 4: ביצוע הפעולה
  const result = await doAction(data);

  // ✅ שלב 5: החזרת תוצאה
  return { success: true, result };
});
```

---

## 💡 דוגמאות שימוש

### דוגמה 1: יצירת משתמש חדש

```javascript
// בדשבורד (Frontend)
const result = await adminAPI.createUser({
  email: 'employee@example.com',
  password: 'SecurePass123!',
  name: 'שם העובד',
  role: 'employee'
});

console.log('User created:', result.userId);
```

### דוגמה 2: חסימת משתמש

```javascript
// בדשבורד (Frontend)
const result = await adminAPI.blockUser({
  userId: 'חיים'
});

console.log('User blocked successfully');
```

### דוגמה 3: העברת משימות בין עובדים

```javascript
// בדשבורד (Frontend)
const result = await adminAPI.bulkTransferTasks({
  fromUserId: 'חיים',
  toUserId: 'דני'
});

console.log(`Transferred ${result.count} tasks`);
```

---

## 📊 Audit Log

כל פעולה מתועדת אוטומטית ב-collection `admin_audit_log`:

```javascript
{
  action: 'ADMIN_CREATE_USER',
  performedBy: 'haim@ghlawoffice.co.il',
  targetUser: 'employee@example.com',
  data: { role: 'employee', name: 'שם העובד' },
  timestamp: Timestamp,
  ipAddress: '1.2.3.4',
  success: true
}
```

---

## 🛠️ פיתוח עתידי

רעיונות לפיצ'רים עתידיים:

- [ ] **Reports & Analytics** - דוחות ויזואליים
- [ ] **Bulk Operations** - פעולות מרובות בבת אחת
- [ ] **Scheduled Tasks** - משימות מתוזמנות
- [ ] **Email Notifications** - התראות במייל
- [ ] **Data Export** - ייצוא נתונים ל-CSV/Excel
- [ ] **Backup & Restore** - גיבוי ושחזור

---

## 📞 תמיכה

לשאלות או בעיות:
- **מייל:** haim@ghlawoffice.co.il
- **תיעוד מפורט:** `admin-api/docs/`

---

## 📜 רישיון

© 2025 משרד עו"ד גיא הרשקוביץ - כל הזכויות שמורות
