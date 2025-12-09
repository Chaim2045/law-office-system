# 🔒 Secure Selective Deletion System
## מערכת מחיקה סלקטיבית מאובטחת

---

## 📋 סקירה כללית

מערכת מחיקה מתקדמת עם 8 שכבות אבטחה שמאפשרת למנהלים למחוק נתונים ספציפיים של משתמשים באופן בטוח ומבוקר.

### 🎯 מה המערכת עושה?
- מאפשרת מחיקה **סלקטיבית** של משימות, שעתונים ואישורים
- בדיקת בעלות - רק פריטים ששייכים למשתמש הנכון יימחקו
- רישום מלא - כל פעולה נרשמת ב-audit log
- Rate limiting - מניעת שימוש לרעה
- Preview mode - אפשרות לראות מה ימחק לפני המחיקה

---

## 🔒 8 שכבות אבטחה

### Layer 1: Authentication (אימות)
```javascript
if (!context.auth) {
  throw new Error('נדרשת התחברות');
}
```
- בדיקה שהמשתמש מחובר
- ניסיון גישה ללא אימות נדחה מיידית

### Layer 2: Authorization (הרשאות)
```javascript
const adminData = getAdminData(email);
if (!adminData.isAdmin) {
  throw new Error('אין הרשאות מנהל');
}
```
- רק משתמשים עם `isAdmin: true` יכולים למחוק
- בדיקה כפולה: `isAdmin` + `role === 'admin'`

### Layer 3: Input Validation (וולידציה)
```javascript
validateDeletionRequest(data);
// - בדיקת פורמט אימייל
// - בדיקת תקינות IDs
// - מקסימום 500 פריטים למחיקה
// - בדיקה שיש לפחות פריט אחד למחיקה
```

### Layer 4: Rate Limiting (מניעת שימוש לרעה)
```javascript
// מקסימום 10 מחיקות ב-5 דקות
// 30 שניות cooldown בין מחיקות
checkRateLimit(adminEmail);
```

### Layer 5: Ownership Verification (בדיקת בעלות)
```javascript
// בדיקה שכל task/timesheet/approval שייך למשתמש הנכון
verifyAllOwnership(userEmail, items);
// אם יש אפילו פריט אחד שלא שייך → דחייה מלאה
```

### Layer 6: Suspicious Activity Detection (זיהוי פעילות חשודה)
```javascript
// אם נמחקו יותר מ-1000 פריטים בשעה → התראה
checkSuspiciousActivity(adminEmail);
```

### Layer 7: Transaction Safety (עסקאות מאובטחות)
```javascript
// מחיקה ב-batches של 500
// במקרה של כישלון → rollback אוטומטי
deleteInBatches(items);
```

### Layer 8: Audit Logging (רישום מלא)
```javascript
logDeletionAttempt({
  who: adminEmail,
  what: items,
  when: timestamp,
  result: success/failure
});
```

---

## 📁 מבנה הקבצים

```
functions/src/deletion/
├── validators.js          # Layer 3: Input Validation
├── ownership.js           # Layer 5: Ownership Verification
├── deletion-engine.js     # Layer 7: Transaction Safety
├── audit.js               # Layer 8: Audit Logging
└── README.md              # התיעוד הזה
```

---

## 🚦 Phases (שלבי פיתוח)

### 🔴 Phase 1: READ-ONLY (נוכחי)
```javascript
DELETION_ENABLED = false
```
- **כל הקריאות חוזרות preview בלבד**
- לא נמחק כלום מה-DB
- מטרה: בדיקת כל שכבות האבטחה
- משך: 7-14 ימים

### 🟡 Phase 2: DRY RUN + PREVIEW
```javascript
if (dryRun === true) {
  return preview;
} else {
  throw new Error('מחיקה אמיתית עדיין לא זמינה');
}
```
- אפשרות ל-dry run
- preview מפורט של מה ימחק
- משך: 7-14 ימים

### 🟠 Phase 3: LIMITED DELETE
```javascript
if (items.length > 5) {
  throw new Error('Phase 3: מקסימום 5 פריטים');
}
```
- מחיקה אמיתית עד 5 פריטים
- בדיקות מעמיקות
- משך: 7-14 ימים

### 🟢 Phase 4: FULL PRODUCTION
```javascript
DELETION_ENABLED = true
```
- מחיקה מלאה (עד 500 פריטים)
- כל מנגנוני האבטחה פעילים
- ניטור מתמיד

---

## 📊 Monitoring & Metrics

### Audit Log
```javascript
firestore.collection('audit_log')
  .where('action', '==', 'delete_user_data_selective')
  .get();
```

### Daily Metrics
```javascript
firestore.collection('deletion_metrics')
  .doc('daily_2025-01-09')
  .get();
```

### Alerts
```javascript
firestore.collection('deletion_metrics')
  .doc('alerts')
  .get();
```

---

## 🚨 Kill Switch

במקרה חירום, ניתן לכבות את המערכת:

```javascript
// בקובץ: deletion-engine.js
const DELETION_ENABLED = false; // ← שנה ל-false

// ואז:
firebase deploy --only functions:deleteUserDataSelective
```

---

## 🧪 Testing

### Unit Tests (Phase 1)
```bash
cd functions
npm test src/deletion/validators.test.js
npm test src/deletion/ownership.test.js
```

### Integration Tests (Phase 2)
```bash
npm test src/deletion/integration.test.js
```

### Load Tests (Phase 3)
```bash
npm run load-test:deletion
```

---

## 📝 API Usage

### Request Format
```javascript
const deleteUserDataSelective = firebase.functions().httpsCallable('deleteUserDataSelective');

const result = await deleteUserDataSelective({
  userEmail: 'user@example.com',
  taskIds: ['task1', 'task2', 'task3'],
  timesheetIds: ['ts1', 'ts2'],
  approvalIds: ['app1'],
  dryRun: true // ← Phase 1: תמיד true
});
```

### Response Format
```javascript
{
  success: true,
  dryRun: true,
  phase: 'phase_1_readonly',
  deletionEnabled: false,
  message: '✅ Preview: 6 פריטים יימחקו',
  deletedCounts: {
    tasks: 3,
    timesheets: 2,
    approvals: 1,
    total: 6
  },
  preview: {
    tasks: [...],
    timesheets: [...],
    approvals: [...]
  },
  executionTime: '234ms'
}
```

---

## 🔐 Security Checklist

- [x] Authentication required
- [x] Admin authorization only
- [x] Input validation (email, IDs)
- [x] Rate limiting (10/5min, 30s cooldown)
- [x] Ownership verification
- [x] Suspicious activity detection
- [x] Transaction safety (batches + rollback)
- [x] Full audit logging
- [x] Dry run mode
- [x] Kill switch
- [x] Phase-based rollout

---

## 📞 Support & Issues

### Phase 1 Issues
- כל הבעיות צריכות להירשם ב-audit log
- נית monitor על `deletion_metrics/alerts`
- בעיות ידווחו אוטומטית

### Contact
- Admin: haim@ghlawoffice.co.il
- Logs: Firebase Console → Functions → deleteUserDataSelective

---

**Version:** 1.0.0 (Phase 1: Read-Only)
**Last Updated:** 2025-01-09
**Status:** 🔴 Phase 1 - Testing Only
