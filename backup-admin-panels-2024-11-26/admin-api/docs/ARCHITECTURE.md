# 🏗️ Admin API - ארכיטקטורה מפורטת

---

## 📊 תרשים זרימה כללי

```
┌──────────────────────────────────────────────────────────────┐
│                         User (Admin)                         │
│                  haim@ghlawoffice.co.il                      │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          │ 1. Login with Firebase Auth
                          │
┌─────────────────────────▼────────────────────────────────────┐
│                   Admin Dashboard UI                         │
│            admin-dashboard-v3.html + admin-api-client.js     │
│                                                               │
│  [Create User] [Block User] [Transfer Tasks] [Send Notif]   │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          │ 2. Call Admin API
                          │    (HTTPS Callable Functions)
                          │
┌─────────────────────────▼────────────────────────────────────┐
│              Cloud Functions - Admin API Layer               │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Security Middleware (Every Function)                   │ │
│  │  1. Check: context.auth exists?                        │ │
│  │  2. Check: user is admin? (email === haim@...)        │ │
│  │  3. Validate: input data                               │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Audit Logger (Every Function)                          │ │
│  │  - Log action to admin_audit_log collection            │ │
│  │  - Include: who, what, when, data                      │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Business Logic (Function-specific)                     │ │
│  │  - users.js: Create, Block, Delete users               │ │
│  │  - tasks.js: Transfer, Complete tasks                  │ │
│  │  - notifications.js: Send notifications                │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────┬────────────────────────────────────┘
                          │
                          │ 3. Use Admin SDK (Full Access)
                          │
┌─────────────────────────▼────────────────────────────────────┐
│                    Firebase Services                         │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Firestore  │  │ Auth (Admin) │  │   Storage    │      │
│  │              │  │              │  │              │      │
│  │ - employees  │  │ - createUser │  │ - files      │      │
│  │ - clients    │  │ - deleteUser │  │              │      │
│  │ - tasks      │  │ - setCustom  │  │              │      │
│  │ - audit_log  │  │   Claims     │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔐 שכבות האבטחה (Security Layers)

### Layer 1: Firebase Authentication
```javascript
if (!context.auth) {
  throw new functions.https.HttpsError('unauthenticated', 'Must login');
}
```
**מה זה עושה:** מוודא שהמשתמש התחבר דרך Firebase Auth

---

### Layer 2: Admin Authorization
```javascript
const ADMIN_EMAILS = ['haim@ghlawoffice.co.il'];

if (!ADMIN_EMAILS.includes(context.auth.token.email)) {
  throw new functions.https.HttpsError('permission-denied', 'Admin only');
}
```
**מה זה עושה:** מוודא שרק אדמינים יכולים לקרוא ל-functions

---

### Layer 3: Input Validation
```javascript
if (!data.email || !data.email.includes('@')) {
  throw new functions.https.HttpsError('invalid-argument', 'Invalid email');
}
```
**מה זה עושה:** בודק שהנתונים שנשלחו תקינים

---

### Layer 4: Audit Logging
```javascript
await admin.firestore().collection('admin_audit_log').add({
  action: 'CREATE_USER',
  performedBy: context.auth.token.email,
  timestamp: admin.firestore.FieldValue.serverTimestamp(),
  data: { email: data.email }
});
```
**מה זה עושה:** רושם כל פעולה ליומן ביקורת

---

## 📂 מבנה ה-Collections ב-Firestore

### קיים כרגע:
```
firestore/
├── employees/            ← עובדים
├── clients/              ← לקוחות
├── budget_tasks/         ← משימות תקציב
├── timesheet_entries/    ← רישום שעות
└── sessions/             ← סשנים פעילים
```

### חדש - Admin API:
```
firestore/
└── admin_audit_log/      ← יומן ביקורת (NEW!)
    └── {logId}/
        ├── action: "CREATE_USER"
        ├── performedBy: "haim@ghlawoffice.co.il"
        ├── targetUser: "employee@example.com"
        ├── timestamp: Timestamp
        ├── data: {...}
        └── success: true
```

---

## 🔄 זרימת קריאה טיפוסית

### דוגמה: יצירת משתמש חדש

```
1. Admin Dashboard
   └─→ Click "הוסף משתמש"
   └─→ Fill form: email, password, name, role
   └─→ Click "שמור"

2. admin-api-client.js
   └─→ adminAPI.createUser({ email, password, name, role })
   └─→ Call: firebase.functions().httpsCallable('adminCreateUser')

3. Cloud Function (adminCreateUser)
   └─→ [Security] Check: context.auth exists?
   └─→ [Security] Check: user is admin?
   └─→ [Validation] Check: email valid?
   └─→ [Validation] Check: password strong?
   └─→ [Audit] Log: "ADMIN_CREATE_USER" → admin_audit_log
   └─→ [Action] admin.auth().createUser({ email, password })
   └─→ [Action] admin.firestore().collection('employees').doc().set({
         email, name, role, createdAt, createdBy: 'admin'
       })
   └─→ [Return] { success: true, userId: '...' }

4. Dashboard
   └─→ Show success message
   └─→ Refresh employees list
```

---

## 🎯 עקרונות תכנון

### 1. **Single Responsibility**
כל function עושה דבר אחד בלבד:
- `adminCreateUser` - רק יוצר משתמש
- `adminBlockUser` - רק חוסם משתמש
- לא מערבבים פעולות

### 2. **DRY (Don't Repeat Yourself)**
קוד משותף נמצא ב-`utils.js`:
```javascript
// utils.js
exports.checkAdminAuth = (context) => { ... }
exports.logAudit = async (action, data) => { ... }
exports.validateEmail = (email) => { ... }
```

### 3. **Fail-Safe**
אם קורית שגיאה - המערכת לא מתרסקת:
```javascript
try {
  // Do something dangerous
} catch (error) {
  console.error('Error:', error);
  throw new functions.https.HttpsError('internal', 'Operation failed');
}
```

### 4. **Audit Everything**
כל פעולה מתועדת - **גם אם נכשלה**:
```javascript
await logAudit({
  action: 'CREATE_USER',
  success: false,
  error: error.message
});
```

---

## 🚀 ביצועים (Performance)

### 1. **Bulk Operations**
במקום loop - עושים batch:
```javascript
// ❌ לא טוב (איטי)
for (const task of tasks) {
  await db.collection('tasks').doc(task.id).update({...});
}

// ✅ טוב (מהיר)
const batch = db.batch();
tasks.forEach(task => {
  batch.update(db.collection('tasks').doc(task.id), {...});
});
await batch.commit();
```

### 2. **Parallel Queries**
במקום sequential - עושים parallel:
```javascript
// ❌ לא טוב (איטי)
const users = await getUsers();
const tasks = await getTasks();

// ✅ טוב (מהיר)
const [users, tasks] = await Promise.all([
  getUsers(),
  getTasks()
]);
```

---

## 🧪 Testing Strategy

### Unit Tests
```javascript
// Test individual functions
describe('adminCreateUser', () => {
  it('should create user with valid data', async () => {
    const result = await adminCreateUser({
      email: 'test@example.com',
      password: 'Test123!',
      name: 'Test User',
      role: 'employee'
    });
    expect(result.success).toBe(true);
  });
});
```

### Integration Tests
```javascript
// Test full flow
it('should create user and log audit', async () => {
  await adminCreateUser({...});
  const auditLog = await getAuditLog();
  expect(auditLog[0].action).toBe('CREATE_USER');
});
```

---

## 📈 Scalability

### הערכות:
- **משתמשים:** עד 100 עובדים פעילים
- **משימות:** עד 10,000 משימות פעילות
- **לקוחות:** עד 5,000 לקוחות פעילים
- **Audit Log:** שומר 1 שנה אחורה (ניקוי אוטומטי)

### צווארי בקבוק אפשריים:
1. **Firestore Read Limits** - פתרון: Caching
2. **Cloud Functions Cold Starts** - פתרון: Keep Warm
3. **Audit Log Size** - פתרון: Scheduled Cleanup

---

## 🔮 עתיד (Future Enhancements)

### Phase 2:
- [ ] **Custom Claims** - הרשאות מתקדמות
- [ ] **Role-Based Access** - תפקידים שונים
- [ ] **Multi-Admin Support** - כמה admins

### Phase 3:
- [ ] **Real-time Dashboard** - עדכונים בזמן אמת
- [ ] **Advanced Analytics** - BI Dashboard
- [ ] **API Rate Limiting** - מניעת spam

---

## 📚 קריאה נוספת

- [Firebase Admin SDK Docs](https://firebase.google.com/docs/admin/setup)
- [Cloud Functions Best Practices](https://firebase.google.com/docs/functions/best-practices)
- [Security Rules](https://firebase.google.com/docs/firestore/security/overview)

---

**עודכן לאחרונה:** 23 אוקטובר 2025
