# 📖 API Reference - Admin API

תיעוד מלא של כל ה-Admin Cloud Functions

---

## 📚 תוכן עניינים

- [Users Management](#-users-management)
- [Tasks Management](#-tasks-management)
- [Notifications](#-notifications)
- [Error Codes](#-error-codes)

---

## 👥 Users Management

### adminCreateUser

יצירת משתמש (עובד) חדש במערכת

**Endpoint:** `adminCreateUser`

**Parameters:**
| שם | סוג | חובה | תיאור |
|----|-----|------|-------|
| email | string | כן | כתובת מייל |
| password | string | כן | סיסמה (8+ תווים, אות גדולה, אות קטנה, מספר) |
| name | string | כן | שם מלא (2+ תווים) |
| role | string | כן | תפקיד: `admin`, `lawyer`, `employee`, `intern` |
| phone | string | לא | מספר טלפון |
| username | string | לא | שם משתמש (אם לא סופק, יווצר אוטומטית) |

**Returns:**
```typescript
{
  success: boolean,
  userId: string,          // Firebase Auth UID
  username: string,        // שם המשתמש שנוצר
  email: string,
  message: string          // "המשתמש [name] נוצר בהצלחה"
}
```

**Example:**
```javascript
const result = await adminAPI.createUser({
  email: 'newuser@example.com',
  password: 'SecurePass123!',
  name: 'שם העובד',
  role: 'employee',
  phone: '050-1234567'
});

console.log(result.message); // "המשתמש שם העובד נוצר בהצלחה"
```

**Errors:**
- `invalid-argument` - נתונים לא תקינים
- `auth/email-already-exists` - המייל כבר קיים
- `permission-denied` - אין הרשאות admin

---

### adminBlockUser

חסימת משתמש (מונע ממנו התחברות)

**Endpoint:** `adminBlockUser`

**Parameters:**
| שם | סוג | חובה | תיאור |
|----|-----|------|-------|
| userId | string | כן | שם משתמש (document ID in employees) |
| reason | string | לא | סיבת החסימה |

**Returns:**
```typescript
{
  success: boolean,
  message: string  // "המשתמש [userId] נחסם בהצלחה"
}
```

**Example:**
```javascript
const result = await adminAPI.blockUser('חיים', 'עזב את המשרד');
```

---

### adminUnblockUser

ביטול חסימת משתמש

**Endpoint:** `adminUnblockUser`

**Parameters:**
| שם | סוג | חובה | תיאור |
|----|-----|------|-------|
| userId | string | כן | שם משתמש |

**Example:**
```javascript
const result = await adminAPI.unblockUser('חיים');
```

---

### adminDeleteUser

מחיקת משתמש לצמיתות (⚠️ פעולה בלתי הפיכה!)

**Endpoint:** `adminDeleteUser`

**Parameters:**
| שם | סוג | חובה | תיאור |
|----|-----|------|-------|
| userId | string | כן | שם משתמש |
| confirm | boolean | כן | חובה `true` |

**Example:**
```javascript
const result = await adminAPI.deleteUser('olduser');
// confirm מועבר אוטומטית על ידי ה-client
```

**Note:** המשימות והשעות של המשתמש **לא נמחקות** (נשארות להיסטוריה)

---

### adminUpdateUserRole

שינוי תפקיד משתמש

**Endpoint:** `adminUpdateUserRole`

**Parameters:**
| שם | סוג | חובה | תיאור |
|----|-----|------|-------|
| userId | string | כן | שם משתמש |
| newRole | string | כן | תפקיד חדש: `admin`, `lawyer`, `employee`, `intern` |

**Example:**
```javascript
const result = await adminAPI.updateUserRole('חיים', 'lawyer');
// "תפקיד חיים שונה מ-employee ל-lawyer"
```

---

### adminResetPassword

שליחת מייל לאיפוס סיסמה

**Endpoint:** `adminResetPassword`

**Parameters:**
| שם | סוג | חובה | תיאור |
|----|-----|------|-------|
| email | string | כן | כתובת מייל |

**Returns:**
```typescript
{
  success: boolean,
  message: string,
  resetLink: string  // קישור לאיפוס (אופציונלי להצגה)
}
```

**Example:**
```javascript
const result = await adminAPI.resetPassword('user@example.com');
```

---

## 📝 Tasks Management

### adminTransferTask

העברת משימה בודדת מעובד אחד לאחר

**Endpoint:** `adminTransferTask`

**Parameters:**
| שם | סוג | חובה | תיאור |
|----|-----|------|-------|
| taskId | string | כן | מזהה המשימה |
| fromEmployeeEmail | string | כן | email העובד הנוכחי |
| toEmployeeEmail | string | כן | email העובד החדש |
| reason | string | לא | סיבת ההעברה |

**Example:**
```javascript
const result = await adminAPI.transferTask(
  'task123',
  'haim@example.com',
  'danny@example.com',
  'העובד בחופש'
);
```

---

### adminBulkTransferTasks

העברת כל המשימות של עובד

**Endpoint:** `adminBulkTransferTasks`

**Parameters:**
| שם | סוג | חובה | תיאור |
|----|-----|------|-------|
| fromEmployeeEmail | string | כן | email עובד מקור |
| toEmployeeEmail | string | כן | email עובד יעד |
| includeCompleted | boolean | לא | להעביר גם משימות שהושלמו? (ברירת מחדל: false) |
| reason | string | לא | סיבת ההעברה |

**Returns:**
```typescript
{
  success: boolean,
  count: number,     // מספר המשימות שהועברו
  message: string    // "X משימות הועברו בהצלחה ל-[username]"
}
```

**Example:**
```javascript
const result = await adminAPI.bulkTransferTasks(
  'oldemployee@example.com',
  'newemployee@example.com',
  false,  // רק משימות פעילות
  'העובד עזב את המשרד'
);

console.log(`הועברו ${result.count} משימות`);
```

---

### adminDeleteTask

מחיקת משימה (⚠️ בלתי הפיכה!)

**Endpoint:** `adminDeleteTask`

**Parameters:**
| שם | סוג | חובה | תיאור |
|----|-----|------|-------|
| taskId | string | כן | מזהה המשימה |
| confirm | boolean | כן | חובה `true` |
| reason | string | לא | סיבת המחיקה |

**Example:**
```javascript
const result = await adminAPI.deleteTask('task123', 'משימה כפולה');
```

---

### adminCompleteTask

סימון משימה כהושלמה

**Endpoint:** `adminCompleteTask`

**Parameters:**
| שם | סוג | חובה | תיאור |
|----|-----|------|-------|
| taskId | string | כן | מזהה המשימה |
| completionNotes | string | לא | הערות השלמה |

**Example:**
```javascript
const result = await adminAPI.completeTask(
  'task123',
  'הושלמה בהצלחה על ידי המנהל'
);
```

---

### adminUpdateTaskDeadline

עדכון דדליין של משימה

**Endpoint:** `adminUpdateTaskDeadline`

**Parameters:**
| שם | סוג | חובה | תיאור |
|----|-----|------|-------|
| taskId | string | כן | מזהה המשימה |
| newDeadline | string | כן | תאריך חדש (YYYY-MM-DD) |
| reason | string | לא | סיבת השינוי |

**Example:**
```javascript
const result = await adminAPI.updateTaskDeadline(
  'task123',
  '2025-12-31',
  'הלקוח ביקש הארכה'
);
```

---

## 🔔 Notifications

### adminSendNotification

שליחת התראה למשתמש ספציפי

**Endpoint:** `adminSendNotification`

**Parameters:**
| שם | סוג | חובה | תיאור |
|----|-----|------|-------|
| userEmail | string | כן | email המשתמש |
| title | string | כן | כותרת ההתראה |
| message | string | כן | תוכן ההתראה |
| type | string | לא | `info` (ברירת מחדל), `success`, `warning`, `error` |
| actionUrl | string | לא | URL לפעולה |
| actionText | string | לא | טקסט כפתור |

**Returns:**
```typescript
{
  success: boolean,
  notificationId: string,
  message: string
}
```

**Example:**
```javascript
const result = await adminAPI.sendNotification({
  userEmail: 'employee@example.com',
  title: 'משימה דחופה',
  message: 'יש לך משימה חדשה שדורשת טיפול מיידי',
  type: 'warning',
  actionUrl: '/tasks',
  actionText: 'לצפייה במשימה'
});
```

---

### adminBroadcastNotification

שליחת הודעת שידור לכולם

**Endpoint:** `adminBroadcastNotification`

**Parameters:**
| שם | סוג | חובה | תיאור |
|----|-----|------|-------|
| title | string | כן | כותרת ההודעה |
| message | string | כן | תוכן ההודעה |
| type | string | לא | סוג ההתראה |
| excludeBlocked | boolean | לא | לא לשלוח לחסומים? (ברירת מחדל: true) |
| roleFilter | string[] | לא | שליחה רק לתפקידים אלה |

**Returns:**
```typescript
{
  success: boolean,
  count: number,     // מספר המשתמשים שקיבלו
  message: string
}
```

**Example:**
```javascript
const result = await adminAPI.broadcastNotification({
  title: 'עדכון מערכת',
  message: 'המערכת תהיה בתחזוקה ביום ראשון 10:00-12:00',
  type: 'warning',
  excludeBlocked: true,
  roleFilter: ['lawyer', 'employee'] // לא לשלוח ל-interns
});

console.log(`נשלח ל-${result.count} משתמשים`);
```

---

### adminSendTaskReminder

שליחת תזכורת למשתמש על משימה

**Endpoint:** `adminSendTaskReminder`

**Parameters:**
| שם | סוג | חובה | תיאור |
|----|-----|------|-------|
| taskId | string | כן | מזהה המשימה |
| customMessage | string | לא | הודעה מותאמת |

**Example:**
```javascript
const result = await adminAPI.sendTaskReminder(
  'task123',
  'אנא טפל במשימה זו בהקדם'
);
```

---

## ❌ Error Codes

כל ה-Functions יכולות להחזיר את קודי השגיאה הבאים:

| קוד | משמעות | פתרון |
|-----|---------|--------|
| `unauthenticated` | לא מחובר | יש להתחבר למערכת |
| `permission-denied` | אין הרשאות | רק admins יכולים לבצע פעולות אלו |
| `invalid-argument` | נתונים לא תקינים | בדוק את הפרמטרים |
| `not-found` | הפריט לא נמצא | בדוק את ה-ID |
| `already-exists` | קיים כבר | המשתמש/פריט כבר קיים |
| `internal` | שגיאת שרת | נסה שוב או פנה לתמיכה |

**דוגמת טיפול בשגיאות:**
```javascript
try {
  const result = await adminAPI.createUser({...});
} catch (error) {
  switch (error.code) {
    case 'auth/email-already-exists':
      alert('המייל כבר קיים במערכת');
      break;
    case 'permission-denied':
      alert('אין לך הרשאות לפעולה זו');
      break;
    default:
      alert(error.message);
  }
}
```

---

## 📊 Rate Limits

Firebase Cloud Functions מגבילים קריאות:
- **Default:** 1,000 קריאות/דקה
- **בפועל:** אין בעיה למערכת שלנו (עד 100 עובדים)

---

## 🔐 Security

כל הפונקציות:
1. ✅ בודקות authentication
2. ✅ בודקות authorization (admin only)
3. ✅ מאמתות נתונים
4. ✅ רושמות ל-audit log

---

## 📞 תמיכה

לשאלות נוספות:
- **תיעוד ראשי:** admin-api/README.md
- **ארכיטקטורה:** admin-api/docs/ARCHITECTURE.md
- **פריסה:** admin-api/docs/DEPLOYMENT.md

---

**עודכן לאחרונה:** 23 אוקטובר 2025
