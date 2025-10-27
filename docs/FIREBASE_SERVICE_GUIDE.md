# Firebase Service - מדריך שימוש מלא

**תאריך:** 27 אוקטובר 2025
**גרסה:** 2.0.0
**סטטוס:** ✅ ייצור

---

## 🎯 מה זה Firebase Service?

Firebase Service הוא **Facade Pattern** - שכבת הפשטה מעל Firebase Cloud Functions.

במקום:
```javascript
// ❌ קריאה ישירה ב-10+ מקומות בקוד
await firebase.functions().httpsCallable('createClient')({
  clientName: 'John Doe'
});
```

עושים:
```typescript
// ✅ קריאה מרוכזת עם retry, caching, error handling
const result = await FirebaseService.call('createClient', {
  clientName: 'John Doe'
});
```

### יתרונות
- ✅ **Automatic Retry** - ניסיון חוזר אוטומטי בשגיאות רשת
- ✅ **Caching** - מטמון תגובות עם TTL
- ✅ **Rate Limiting** - מניעת spam ל-API
- ✅ **Request Deduplication** - מניעת קריאות כפולות
- ✅ **Performance Monitoring** - מדידת זמני תגובה
- ✅ **Error Boundaries** - טיפול מקצועי בשגיאות
- ✅ **Offline Support** - תור בקשות כאשר אין רשת

---

## 📦 התקנה

### 1. Import ה-Service

```typescript
import { FirebaseService } from './js/services/firebase-service';
```

או ב-JavaScript רגיל:
```javascript
import { FirebaseService } from './js/services/firebase-service.js';
```

### 2. ה-Service זמין גלובלית

```javascript
// Debug mode
window.FirebaseService.setDebugMode(true);

// Statistics
console.log(window.FirebaseService.getStats());
```

---

## 🚀 שימוש בסיסי

### קריאה פשוטה

```typescript
const result = await FirebaseService.call('createClient', {
  clientName: 'יוחנן כהן',
  phone: '050-1234567',
  email: 'yohanan@example.com'
});

if (result.success) {
  console.log('✅ לקוח נוצר:', result.data);
} else {
  console.error('❌ שגיאה:', result.error);
}
```

---

### קריאה עם אופציות

```typescript
const result = await FirebaseService.call(
  'getClientDetails',
  { clientId: '123' },
  {
    retries: 5,           // ניסיון 5 פעמים
    cacheTTL: 60000,      // מטמון ל-60 שניות
    timeout: 10000,       // timeout אחרי 10 שניות
    priority: 10          // עדיפות גבוהה
  }
);
```

---

## 📋 רשימת Firebase Functions

### לקוחות (Clients)

#### `createClient`
יצירת לקוח חדש.

```typescript
const result = await FirebaseService.call('createClient', {
  clientName: string,
  phone?: string,
  email?: string,
  address?: string,
  idNumber?: string,
  notes?: string
});

// תגובה
// result.data = { clientId: string }
```

**דוגמה:**
```typescript
const result = await FirebaseService.call('createClient', {
  clientName: 'יוחנן כהן',
  phone: '050-1234567',
  email: 'yohanan@example.com',
  idNumber: '123456789'
});

if (result.success) {
  console.log(`לקוח נוצר עם ID: ${result.data.clientId}`);

  // פליטת אירוע
  EventBus.emit('client:created', {
    clientId: result.data.clientId,
    clientName: 'יוחנן כהן',
    createdBy: currentUser.email
  });
}
```

---

#### `updateClient`
עדכון פרטי לקוח קיים.

```typescript
const result = await FirebaseService.call('updateClient', {
  clientId: string,
  updates: {
    clientName?: string,
    phone?: string,
    email?: string,
    address?: string,
    notes?: string
  }
});
```

---

#### `deleteClient`
מחיקת לקוח (soft delete).

```typescript
const result = await FirebaseService.call('deleteClient', {
  clientId: string,
  reason?: string
});
```

---

#### `getClientDetails`
קבלת פרטי לקוח מלאים.

```typescript
const result = await FirebaseService.call(
  'getClientDetails',
  { clientId: '123' },
  { cacheTTL: 60000 } // מטמון ל-60 שניות
);

// result.data = { client: {...}, cases: [...], tasks: [...] }
```

---

### תיקים (Cases)

#### `createCase`
יצירת תיק משפטי חדש.

```typescript
const result = await FirebaseService.call('createCase', {
  clientId: string,
  caseName: string,
  caseNumber?: string,
  court?: string,
  description?: string
});

// result.data = { caseId: string }
```

---

#### `updateCase`
עדכון פרטי תיק.

```typescript
const result = await FirebaseService.call('updateCase', {
  caseId: string,
  updates: {
    caseName?: string,
    status?: 'active' | 'closed' | 'pending',
    court?: string,
    notes?: string
  }
});
```

---

### משימות תקציב (Budget Tasks)

#### `createBudgetTask`
יצירת משימת תקציב חדשה.

```typescript
const result = await FirebaseService.call('createBudgetTask', {
  clientId: string,
  clientName: string,
  caseId?: string,
  caseName?: string,
  taskDescription: string,
  originalEstimate: number,
  employee: string,
  deadline?: string,
  priority?: 'low' | 'medium' | 'high' | 'urgent'
});

// result.data = { taskId: string }
```

**דוגמה מלאה:**
```typescript
const result = await FirebaseService.call('createBudgetTask', {
  clientId: 'client-123',
  clientName: 'יוחנן כהן',
  caseId: 'case-456',
  caseName: 'תביעה אזרחית',
  taskDescription: 'כתיבת כתב תביעה',
  originalEstimate: 300, // 5 שעות (300 דקות)
  employee: 'lawyer@example.com',
  deadline: '2025-11-30',
  priority: 'high'
}, {
  retries: 3
});

if (result.success) {
  console.log(`✅ משימה נוצרה: ${result.data.taskId}`);

  // פליטת אירוע
  EventBus.emit('task:created', {
    taskId: result.data.taskId,
    clientId: 'client-123',
    clientName: 'יוחנן כהן',
    employee: 'lawyer@example.com',
    originalEstimate: 300
  });
}
```

---

#### `updateBudgetTask`
עדכון משימת תקציב.

```typescript
const result = await FirebaseService.call('updateBudgetTask', {
  taskId: string,
  updates: {
    taskDescription?: string,
    deadline?: string,
    priority?: 'low' | 'medium' | 'high' | 'urgent',
    status?: 'in_progress' | 'completed' | 'on_hold',
    notes?: string
  }
});
```

---

#### `adjustTaskBudget`
התאמת תקציב משימה (הארכה/קיצור).

```typescript
const result = await FirebaseService.call('adjustTaskBudget', {
  taskId: string,
  newEstimate: number,
  reason: string
});
```

**דוגמה:**
```typescript
const result = await FirebaseService.call('adjustTaskBudget', {
  taskId: 'task-789',
  newEstimate: 420, // 7 שעות
  reason: 'המקרה מסובך יותר מהצפוי'
});

if (result.success) {
  EventBus.emit('task:budget-adjusted', {
    taskId: 'task-789',
    oldEstimate: 300,
    newEstimate: 420,
    reason: 'המקרה מסובך יותר מהצפוי',
    adjustedBy: currentUser.email
  });
}
```

---

#### `completeBudgetTask`
סיום משימת תקציב.

```typescript
const result = await FirebaseService.call('completeBudgetTask', {
  taskId: string,
  finalNotes?: string
});
```

---

### רישומי שעתון (Timesheet)

#### `createTimesheetEntry`
יצירת רישום שעה חדש.

```typescript
const result = await FirebaseService.call('createTimesheetEntry', {
  taskId: string,
  clientId: string,
  clientName: string,
  date: string,
  minutes: number,
  description: string,
  billable?: boolean
});

// result.data = { entryId: string }
```

**דוגמה:**
```typescript
const result = await FirebaseService.call('createTimesheetEntry', {
  taskId: 'task-789',
  clientId: 'client-123',
  clientName: 'יוחנן כהן',
  date: '2025-10-27',
  minutes: 120, // 2 שעות
  description: 'פגישה עם לקוח + כתיבת סיכום',
  billable: true
});

if (result.success) {
  console.log(`✅ רישום נוסף: ${result.data.entryId}`);

  EventBus.emit('timesheet:entry-created', {
    entryId: result.data.entryId,
    taskId: 'task-789',
    clientId: 'client-123',
    employee: currentUser.email,
    minutes: 120,
    date: '2025-10-27'
  });
}
```

---

#### `updateTimesheetEntry`
עדכון רישום שעה קיים.

```typescript
const result = await FirebaseService.call('updateTimesheetEntry', {
  entryId: string,
  updates: {
    minutes?: number,
    description?: string,
    billable?: boolean,
    notes?: string
  }
});
```

---

#### `deleteTimesheetEntry`
מחיקת רישום שעה.

```typescript
const result = await FirebaseService.call('deleteTimesheetEntry', {
  entryId: string,
  reason?: string
});
```

---

## 🎨 תכונות מתקדמות

### 1. Automatic Retry (ניסיון חוזר)

```typescript
const result = await FirebaseService.call(
  'createClient',
  { clientName: 'יוחנן כהן' },
  {
    retries: 5  // ינסה עד 5 פעמים
  }
);
```

**איך זה עובד:**
- ניסיון ראשון נכשל → המתנה 1 שנייה
- ניסיון שני נכשל → המתנה 2 שניות
- ניסיון שלישי נכשל → המתנה 4 שניות
- ניסיון רביעי נכשל → המתנה 8 שניות
- ניסיון חמישי נכשל → המתנה 10 שניות (max)

**שגיאות שניתן לנסות שוב:**
- ✅ `unavailable` - שרת לא זמין
- ✅ `deadline-exceeded` - timeout
- ✅ `internal` - שגיאת שרת פנימית
- ✅ Network errors

**שגיאות שלא ניתן לנסות שוב:**
- ❌ `invalid-argument` - נתונים לא תקינים
- ❌ `permission-denied` - אין הרשאה
- ❌ `not-found` - לא נמצא

---

### 2. Response Caching (מטמון)

```typescript
// קריאה ראשונה - מהשרת
const result1 = await FirebaseService.call(
  'getClientDetails',
  { clientId: '123' },
  {
    cacheTTL: 60000  // מטמון ל-60 שניות
  }
);
console.log(result1.cached); // false
console.log(result1.duration); // 234ms

// קריאה שנייה - מהמטמון
const result2 = await FirebaseService.call(
  'getClientDetails',
  { clientId: '123' },
  {
    cacheTTL: 60000
  }
);
console.log(result2.cached); // true
console.log(result2.duration); // 0.5ms - מהיר!
```

**מתי להשתמש בcache:**
- ✅ נתונים שמשתנים לעיתים רחוקות (פרטי לקוח, רשימות)
- ✅ קריאות read-only
- ❌ נתונים שמשתנים כל הזמן (timesheet live)
- ❌ פעולות create/update/delete

---

### 3. Rate Limiting (הגבלת קצב)

המערכת מגבילה אוטומטית ל-**10 בקשות בשנייה**.

```typescript
// בקשות 1-10 - יבוצעו מיד
for (let i = 0; i < 10; i++) {
  FirebaseService.call('someFunction', {});
}

// בקשה 11 - תיכנס לתור
FirebaseService.call('someFunction', {}); // ← בתור

// אחרי שנייה, התור יתרוקן אוטומטית
```

**דילוג על הגבלה (למנהלים בלבד):**
```typescript
const result = await FirebaseService.call(
  'urgentOperation',
  { ... },
  {
    skipRateLimit: true  // דלג על הגבלה
  }
);
```

---

### 4. Request Timeout (זמן קצוב)

```typescript
const result = await FirebaseService.call(
  'longRunningFunction',
  { ... },
  {
    timeout: 60000  // 60 שניות
  }
);

if (!result.success && result.errorCode === 'timeout') {
  console.error('הפעולה ארכה יותר מדי!');
}
```

ברירת מחדל: **30 שניות**

---

### 5. Request Priority (עדיפות)

```typescript
// עדיפות גבוהה - יעובד ראשון
FirebaseService.call('criticalOperation', { ... }, { priority: 10 });

// עדיפות רגילה
FirebaseService.call('normalOperation', { ... }, { priority: 0 });

// עדיפות נמוכה - יעובד אחרון
FirebaseService.call('backgroundTask', { ... }, { priority: -10 });
```

---

### 6. Custom Error Handler

```typescript
const result = await FirebaseService.call(
  'riskyOperation',
  { ... },
  {
    onError: (error) => {
      // טיפול מותאם אישית בשגיאה
      console.error('שגיאה התרחשה:', error.message);

      // שליחה למערכת ניטור
      sendToMonitoring(error);

      // הצגת התראה למשתמש
      showNotification('אירעה שגיאה, מנסה שוב...', 'warning');
    }
  }
);
```

---

### 7. Request Deduplication (מניעת כפילויות)

```typescript
// שתי קריאות זהות במקביל
const promise1 = FirebaseService.call('getClientDetails', { clientId: '123' });
const promise2 = FirebaseService.call('getClientDetails', { clientId: '123' });

// רק קריאה אחת תישלח לשרת!
const [result1, result2] = await Promise.all([promise1, promise2]);

console.log(result1 === result2); // true - אותה תוצאה
```

---

## 🔍 Debug Mode

### הפעלת מצב דיבאג

```typescript
FirebaseService.setDebugMode(true);
```

עכשיו תראה בקונסול:
```
📤 [Firebase] Calling: createClient { clientName: 'יוחנן כהן' }
💾 [Firebase] Cache hit: getClientDetails
⏳ [Firebase] Rate limited, queuing: createTask
⏳ [Firebase] Retry 1/3 after 1000ms for: createClient
✅ [Firebase] createClient completed in 234.56ms
```

---

## 📊 סטטיסטיקות

### קבלת נתונים סטטיסטיים

```typescript
const stats = FirebaseService.getStats();

console.log(`סך קריאות: ${stats.totalCalls}`);
console.log(`הצלחות: ${stats.successfulCalls}`);
console.log(`כשלונות: ${stats.failedCalls}`);
console.log(`מטמון: ${stats.cachedCalls}`);
console.log(`ניסיונות חוזרים: ${stats.retriedCalls}`);
console.log(`זמן ממוצע: ${stats.averageResponseTime.toFixed(2)}ms`);
console.log(`פגיעות rate limit: ${stats.rateLimitHits}`);
console.log(`בקשות בתור: ${stats.queuedRequests}`);
```

**פלט לדוגמה:**
```
סך קריאות: 1523
הצלחות: 1495
כשלונות: 28
מטמון: 234
ניסיונות חוזרים: 15
זמן ממוצע: 187.45ms
פגיעות rate limit: 3
בקשות בתור: 0
```

---

### איפוס סטטיסטיקות

```typescript
FirebaseService.resetStats();
```

---

## 🗑️ ניהול מטמון

### ניקוי כל המטמון

```typescript
FirebaseService.clearCache();
```

### ניקוי ערך ספציפי

```typescript
FirebaseService.clearCacheEntry('getClientDetails', { clientId: '123' });
```

---

## 💡 דוגמאות מלאות

### דוגמה 1: יצירת לקוח עם טיפול בשגיאות

```typescript
async function createNewClient(clientData) {
  try {
    const result = await FirebaseService.call(
      'createClient',
      clientData,
      {
        retries: 3,
        timeout: 10000,
        onError: (error) => {
          console.error('שגיאה ביצירת לקוח:', error.message);
        }
      }
    );

    if (result.success) {
      // הצלחה
      console.log(`✅ לקוח נוצר: ${result.data.clientId}`);

      // פליטת אירוע
      EventBus.emit('client:created', {
        clientId: result.data.clientId,
        clientName: clientData.clientName,
        createdBy: currentUser.email
      });

      // הצגת התראה
      showNotification(`לקוח ${clientData.clientName} נוצר בהצלחה`, 'success');

      // רענון רשימה
      await refreshClientList();

      return result.data.clientId;
    } else {
      // כשלון
      console.error(`❌ שגיאה: ${result.error}`);
      showNotification(`שגיאה ביצירת לקוח: ${result.error}`, 'error');
      return null;
    }
  } catch (error) {
    console.error('שגיאה חמורה:', error);
    showNotification('שגיאה חמורה ביצירת לקוח', 'error');
    return null;
  }
}
```

---

### דוגמה 2: טעינת נתונים עם מטמון

```typescript
async function loadClientDetails(clientId) {
  // הצג loader
  showLoader();

  try {
    const result = await FirebaseService.call(
      'getClientDetails',
      { clientId },
      {
        cacheTTL: 60000,  // מטמון ל-60 שניות
        timeout: 15000,   // timeout אחרי 15 שניות
        retries: 3
      }
    );

    if (result.success) {
      // הצלחה
      const { client, cases, tasks } = result.data;

      // עדכון UI
      updateClientUI(client);
      updateCasesList(cases);
      updateTasksList(tasks);

      // הצג אינדיקטור אם מהמטמון
      if (result.cached) {
        showCacheIndicator();
      }

      // Log performance
      console.log(`נתונים נטענו ב-${result.duration.toFixed(2)}ms`);
    } else {
      // כשלון
      showNotification(`שגיאה בטעינת נתונים: ${result.error}`, 'error');
    }
  } finally {
    // הסתר loader
    hideLoader();
  }
}
```

---

### דוגמה 3: Batch Operations עם Priority

```typescript
async function batchCreateTasks(tasksData) {
  const promises = tasksData.map((taskData, index) => {
    return FirebaseService.call(
      'createBudgetTask',
      taskData,
      {
        priority: tasksData.length - index,  // ראשון = עדיפות גבוהה
        retries: 2
      }
    );
  });

  const results = await Promise.all(promises);

  const successes = results.filter(r => r.success).length;
  const failures = results.filter(r => !r.success).length;

  console.log(`✅ הצלחות: ${successes}`);
  console.log(`❌ כשלונות: ${failures}`);

  return {
    total: results.length,
    successes,
    failures,
    results
  };
}
```

---

### דוגמה 4: Retry עם Exponential Backoff

```typescript
async function criticalOperation(data) {
  const result = await FirebaseService.call(
    'criticalFunction',
    data,
    {
      retries: 5,  // 5 ניסיונות
      timeout: 30000,
      onError: (error) => {
        // עדכון UI אחרי כל ניסיון
        updateRetryStatus(`מנסה שוב... (${error.message})`);
      }
    }
  );

  if (result.success) {
    console.log(`✅ הצלחה אחרי ${result.retries || 0} ניסיונות`);
  } else {
    console.error(`❌ נכשל אחרי ${result.retries || 0} ניסיונות`);
  }

  return result;
}
```

---

## ⚠️ Best Practices

### ✅ DO:

1. **תמיד בדוק את result.success**
   ```typescript
   if (result.success) {
     // הצלחה
   } else {
     // כשלון
   }
   ```

2. **השתמש בcache לread operations**
   ```typescript
   const result = await FirebaseService.call('getClients', {}, {
     cacheTTL: 60000
   });
   ```

3. **הוסף retry לפעולות קריטיות**
   ```typescript
   const result = await FirebaseService.call('importantOperation', data, {
     retries: 5
   });
   ```

4. **השתמש ב-timeout סביר**
   ```typescript
   const result = await FirebaseService.call('quickOperation', data, {
     timeout: 5000  // 5 שניות
   });
   ```

5. **טפל בשגיאות**
   ```typescript
   try {
     const result = await FirebaseService.call(...);
   } catch (error) {
     console.error('Error:', error);
   }
   ```

### ❌ DON'T:

1. **אל תשכח לטפל בכשלון**
   ```typescript
   // ❌ לא טוב
   const result = await FirebaseService.call(...);
   console.log(result.data.clientId); // ייתכן ש-data לא קיים!

   // ✅ טוב
   if (result.success) {
     console.log(result.data.clientId);
   }
   ```

2. **אל תשתמש בcache לwrite operations**
   ```typescript
   // ❌ לא טוב
   FirebaseService.call('createClient', data, { cacheTTL: 60000 });

   // ✅ טוב
   FirebaseService.call('createClient', data, { cacheTTL: 0 });
   ```

3. **אל תשתמש ב-timeout ארוך מדי**
   ```typescript
   // ❌ לא טוב
   FirebaseService.call('quickOp', data, { timeout: 300000 }); // 5 דקות!

   // ✅ טוב
   FirebaseService.call('quickOp', data, { timeout: 10000 }); // 10 שניות
   ```

4. **אל תדלג על rate limiting ללא סיבה**
   ```typescript
   // ❌ לא טוב
   FirebaseService.call('normalOp', data, { skipRateLimit: true });

   // ✅ טוב - רק לפעולות קריטיות
   FirebaseService.call('emergency', data, { skipRateLimit: true });
   ```

---

## 🧪 Testing

### מידע לבדיקות

```typescript
// Mock FirebaseService
jest.mock('./firebase-service', () => ({
  FirebaseService: {
    call: jest.fn()
  }
}));

// בבדיקה
import { FirebaseService } from './firebase-service';

test('should create client', async () => {
  // Mock תגובה
  (FirebaseService.call as jest.Mock).mockResolvedValue({
    success: true,
    data: { clientId: '123' },
    duration: 100
  });

  // קריאה לפונקציה
  const result = await createClient({ clientName: 'Test' });

  // בדיקה
  expect(result).toBe('123');
  expect(FirebaseService.call).toHaveBeenCalledWith(
    'createClient',
    { clientName: 'Test' },
    expect.any(Object)
  );
});
```

---

## 🔗 ראה גם

- [Event Bus Guide](./EVENT_BUS_GUIDE.md)
- [Migration Guide](./MIGRATION_GUIDE.md)
- [Architecture Refactor Plan](./ARCHITECTURE_REFACTOR_PLAN.md)

---

**נוצר:** 27 אוקטובר 2025
**עדכון אחרון:** 27 אוקטובר 2025
**גרסה:** 1.0.0
