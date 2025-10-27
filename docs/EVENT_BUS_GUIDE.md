# Event Bus - מדריך שימוש מלא

**תאריך:** 27 אוקטובר 2025
**גרסה:** 2.0.0
**סטטוס:** ✅ ייצור

---

## 🎯 מה זה Event Bus?

Event Bus הוא מערכת לתקשורת בין מודולים באפליקציה בצורה **מנותקת** (Decoupled).

במקום:
```javascript
// ❌ תלות ישירה (Tight Coupling)
window.ClientCaseSelectorsManager?.clearBudget();
```

עושים:
```javascript
// ✅ אירועים מנותקים (Loose Coupling)
EventBus.emit('selector:budget-cleared', {});
```

### יתרונות
- ✅ **Type Safety** - בדיקת טיפוסים בזמן קומפילציה
- ✅ **Autocomplete** - ה-IDE יציע לך אירועים ונתונים
- ✅ **Debugging** - היסטוריית אירועים ושחזור
- ✅ **Testing** - קל לבדוק כל מודול בנפרד
- ✅ **Maintainability** - שינוי במודול לא שובר אחרים

---

## 📦 התקנה

### 1. Import ה-Event Bus

```typescript
import { EventBus } from './js/core/event-bus';
```

או ב-JavaScript רגיל:
```javascript
import { EventBus } from './js/core/event-bus.js';
```

### 2. ה-Event Bus זמין גלובלית

```javascript
// Debug mode
window.EventBus.setDebugMode(true);

// Statistics
console.log(window.EventBus.getStats());
```

---

## 🚀 שימוש בסיסי

### פליטת אירוע (Emit)

```typescript
EventBus.emit('client:selected', {
  clientId: '123',
  clientName: 'יוחנן כהן',
  caseId: '456',
  caseName: 'תביעה אזרחית'
});
```

### האזנה לאירוע (Listen)

```typescript
const unsubscribe = EventBus.on('client:selected', (data) => {
  console.log(`לקוח נבחר: ${data.clientName}`);
  console.log(`תיק: ${data.caseName}`);

  // עדכון ממשק
  updateUIWithClient(data);
});
```

### ביטול האזנה (Unsubscribe)

```typescript
// כשאתה לא רוצה יותר לקבל אירועים
unsubscribe();
```

---

## 📋 רשימת אירועים זמינים

### אירועי לקוחות (Client Events)

#### `client:selected`
נשלח כאשר משתמש בחר לקוח ותיק.

```typescript
EventBus.emit('client:selected', {
  clientId: string,
  clientName: string,
  caseId?: string,
  caseName?: string
});
```

**דוגמה:**
```typescript
// פליטה
EventBus.emit('client:selected', {
  clientId: 'client-123',
  clientName: 'יוחנן כהן',
  caseId: 'case-456',
  caseName: 'תביעה אזרחית'
});

// האזנה
EventBus.on('client:selected', (data) => {
  // עדכון Budget Module
  budgetModule.setClient(data.clientId);

  // עדכון Timesheet Module
  timesheetModule.setClient(data.clientId);

  // עדכון UI
  document.getElementById('selectedClient').textContent = data.clientName;
});
```

---

#### `client:created`
נשלח כאשר לקוח חדש נוצר.

```typescript
EventBus.emit('client:created', {
  clientId: string,
  clientName: string,
  createdBy: string
});
```

---

#### `client:updated`
נשלח כאשר פרטי לקוח עודכנו.

```typescript
EventBus.emit('client:updated', {
  clientId: string,
  changes: Record<string, any>,
  updatedBy: string
});
```

---

#### `client:deleted`
נשלח כאשר לקוח נמחק.

```typescript
EventBus.emit('client:deleted', {
  clientId: string,
  deletedBy: string
});
```

---

### אירועי משימות (Task Events)

#### `task:created`
נשלח כאשר משימת תקציב נוצרה.

```typescript
EventBus.emit('task:created', {
  taskId: string,
  clientId: string,
  clientName: string,
  employee: string,
  originalEstimate: number
});
```

**דוגמה:**
```typescript
EventBus.on('task:created', (data) => {
  console.log(`✅ משימה חדשה: ${data.clientName} (${data.originalEstimate} דקות)`);

  // רענון רשימת משימות
  refreshTaskList();

  // הצגת התראה
  showNotification(`משימה נוספה עבור ${data.clientName}`, 'success');
});
```

---

#### `task:budget-adjusted`
נשלח כאשר תקציב משימה שונה.

```typescript
EventBus.emit('task:budget-adjusted', {
  taskId: string,
  oldEstimate: number,
  newEstimate: number,
  reason: string,
  adjustedBy: string
});
```

**דוגמה:**
```typescript
EventBus.on('task:budget-adjusted', (data) => {
  const diff = data.newEstimate - data.oldEstimate;
  console.log(`📊 תקציב שונה: ${diff > 0 ? '+' : ''}${diff} דקות`);
  console.log(`סיבה: ${data.reason}`);

  // עדכון תצוגה
  updateBudgetDisplay(data.taskId, data.newEstimate);
});
```

---

#### `task:deadline-extended`
נשלח כאשר יעד משימה הוארך.

```typescript
EventBus.emit('task:deadline-extended', {
  taskId: string,
  oldDeadline: string,
  newDeadline: string,
  reason: string,
  extendedBy: string
});
```

---

#### `task:completed`
נשלח כאשר משימה הושלמה.

```typescript
EventBus.emit('task:completed', {
  taskId: string,
  clientId: string,
  completedBy: string,
  totalMinutes: number
});
```

---

### אירועי שעתון (Timesheet Events)

#### `timesheet:entry-created`
נשלח כאשר רישום שעה חדש נוצר.

```typescript
EventBus.emit('timesheet:entry-created', {
  entryId: string,
  taskId: string,
  clientId: string,
  employee: string,
  minutes: number,
  date: string
});
```

**דוגמה:**
```typescript
EventBus.on('timesheet:entry-created', (data) => {
  console.log(`⏱️ רישום שעה: ${data.minutes} דקות`);

  // עדכון סיכום יומי
  updateDailySummary(data.date, data.minutes);

  // עדכון משימה קשורה
  updateTaskProgress(data.taskId);
});
```

---

### אירועי תקציב (Budget Events)

#### `budget:warning-80`
נשלח כאשר משימה חרגה ל-80% מהתקציב.

```typescript
EventBus.emit('budget:warning-80', {
  taskId: string,
  clientName: string,
  percentageUsed: number,
  remainingMinutes: number
});
```

**דוגמה:**
```typescript
EventBus.on('budget:warning-80', (data) => {
  showNotification(
    `⚠️ אזהרה: ${data.clientName} הגיע ל-${data.percentageUsed}% מהתקציב!`,
    'warning'
  );
});
```

---

#### `budget:warning-100`
נשלח כאשר משימה חרגה ל-100% מהתקציב.

```typescript
EventBus.emit('budget:warning-100', {
  taskId: string,
  clientName: string,
  overageMinutes: number
});
```

---

#### `budget:overrun`
נשלח כאשר משימה חרגה מהתקציב.

```typescript
EventBus.emit('budget:overrun', {
  taskId: string,
  clientName: string,
  totalMinutes: number,
  estimatedMinutes: number
});
```

---

### אירועי ממשק (UI Events)

#### `ui:notification-shown`
נשלח כאשר התראה מוצגת למשתמש.

```typescript
EventBus.emit('ui:notification-shown', {
  type: 'success' | 'error' | 'warning' | 'info',
  message: string
});
```

---

#### `ui:dialog-opened`
נשלח כאשר חלון דיאלוג נפתח.

```typescript
EventBus.emit('ui:dialog-opened', {
  dialogId: string,
  dialogType: string
});
```

---

#### `ui:tab-changed`
נשלח כאשר משתמש עבר בין טאבים.

```typescript
EventBus.emit('ui:tab-changed', {
  oldTab: string,
  newTab: string
});
```

---

### אירועי סלקטור (Selector Events)

#### `selector:budget-cleared`
נשלח כאשר בחירת לקוח בסלקטור תקציב נוקתה.

```typescript
EventBus.emit('selector:budget-cleared', {});
```

**דוגמה:**
```typescript
EventBus.on('selector:budget-cleared', () => {
  // נקה שדות ממשק
  clearBudgetForm();

  // הסתר פרטי לקוח
  document.getElementById('clientDetails').classList.add('hidden');
});
```

---

#### `selector:timesheet-cleared`
נשלח כאשר בחירת לקוח בסלקטור שעתון נוקתה.

```typescript
EventBus.emit('selector:timesheet-cleared', {});
```

---

#### `selector:values-changed`
נשלח כאשר ערכי סלקטור השתנו.

```typescript
EventBus.emit('selector:values-changed', {
  selectorType: 'budget' | 'timesheet' | 'procedure',
  values: any
});
```

---

### אירועי מערכת (System Events)

#### `system:error`
נשלח כאשר שגיאה התרחשה במערכת.

```typescript
EventBus.emit('system:error', {
  error: Error,
  context: string,
  severity: 'low' | 'medium' | 'high' | 'critical'
});
```

**דוגמה:**
```typescript
EventBus.on('system:error', (data) => {
  if (data.severity === 'critical') {
    // התראה קריטית
    alert(`שגיאה חמורה: ${data.error.message}`);

    // שליחה לשרת ניטור
    sendToMonitoring(data);
  } else {
    // רישום בקונסול
    console.error(`[${data.severity}] ${data.context}:`, data.error);
  }
});
```

---

#### `system:data-loaded`
נשלח כאשר נתונים נטענו מהשרת.

```typescript
EventBus.emit('system:data-loaded', {
  dataType: string,
  recordCount: number,
  duration: number
});
```

---

#### `system:cache-updated`
נשלח כאשר מטמון עודכן.

```typescript
EventBus.emit('system:cache-updated', {
  cacheKey: string,
  action: 'add' | 'update' | 'delete' | 'clear'
});
```

---

## 🎨 שימושים מתקדמים

### עדיפות לאירועים (Priority)

```typescript
// ראשון בעדיפות (ירוץ קודם)
EventBus.on('client:selected', handleClientSelected, { priority: 10 });

// רגיל
EventBus.on('client:selected', updateUI, { priority: 0 });

// נמוך בעדיפות (ירוץ אחרון)
EventBus.on('client:selected', logAnalytics, { priority: -10 });
```

---

### האזנה חד-פעמית (Once)

```typescript
// ירוץ רק פעם אחת ואז יתנתק אוטומטית
EventBus.once('task:created', (data) => {
  console.log('משימה ראשונה נוצרה!');
});
```

---

### ניקוי כל המאזינים לאירוע

```typescript
// הסר את כל המאזינים ל-client:selected
EventBus.off('client:selected');
```

---

### ניקוי כל המאזינים במערכת

```typescript
// הסר את כל המאזינים לכל האירועים
EventBus.clear();
```

---

## 🔍 Debug Mode

### הפעלת מצב דיבאג

```typescript
EventBus.setDebugMode(true);
```

עכשיו תראה בקונסול:
```
📤 [EventBus] Emitting: client:selected { clientId: '123', clientName: 'יוחנן כהן' }
📥 [EventBus] Subscribed to: client:selected (ID: listener-1, Priority: 0)
✅ [EventBus] client:selected completed in 1.23ms (3 listeners)
```

---

## 📊 סטטיסטיקות

### קבלת נתונים סטטיסטיים

```typescript
const stats = EventBus.getStats();

console.log(`סך אירועים: ${stats.totalEventsEmitted}`);
console.log(`סך מאזינים: ${stats.totalListeners}`);
console.log(`זמן ממוצע: ${stats.averageEmitTime.toFixed(2)}ms`);
console.log(`שגיאות: ${stats.errors}`);
```

**פלט לדוגמה:**
```
סך אירועים: 1523
סך מאזינים: 15
זמן ממוצע: 0.87ms
שגיאות: 0
```

---

### סיכום אירועים

```typescript
const summary = EventBus.getEventSummary();

console.log(summary);
// {
//   'client:selected': 5,
//   'task:created': 12,
//   'timesheet:entry-created': 8,
//   ...
// }
```

---

## 📜 היסטוריה

### צפייה בהיסטוריית אירועים

```typescript
const history = EventBus.getHistory();

history.forEach((entry) => {
  console.log(`${entry.event}: ${entry.listenersNotified} listeners, ${entry.duration}ms`);
});
```

---

### 10 האירועים האחרונים

```typescript
const last10 = EventBus.getLastEvents(10);
console.log(last10);
```

---

### שחזור אירועים (Replay)

```typescript
// שחזור כל האירועים
EventBus.replay();

// שחזור אירועים מאינדקס 5 ועד הסוף
EventBus.replay(5);

// שחזור אירועים מאינדקס 5 עד 15
EventBus.replay(5, 15);
```

---

## 💡 דוגמאות מלאות

### דוגמה 1: אינטגרציה עם ClientCaseSelector

**לפני (Tight Coupling):**
```javascript
// client-case-selector.js
selectClient(clientId) {
  // ... logic

  // קריאה ישירה למודולים אחרים
  window.budgetModule?.updateClient(clientId);
  window.timesheetModule?.updateClient(clientId);
  window.reportsModule?.setClientFilter(clientId);
}
```

**אחרי (Event-Driven):**
```typescript
// client-case-selector.ts
selectClient(clientId: string, clientName: string) {
  // ... logic

  // פליטת אירוע
  EventBus.emit('client:selected', {
    clientId,
    clientName,
    caseId: this.selectedCaseId,
    caseName: this.selectedCaseName
  });
}
```

**מודולים מקשיבים:**
```typescript
// budget-module.ts
EventBus.on('client:selected', (data) => {
  this.updateClient(data.clientId, data.clientName);
});

// timesheet-module.ts
EventBus.on('client:selected', (data) => {
  this.setClient(data.clientId);
  this.refreshEntries();
});

// reports-module.ts
EventBus.on('client:selected', (data) => {
  this.filterByClient(data.clientId);
});
```

---

### דוגמה 2: טיפול בתקציב חריג

```typescript
// budget-monitor.ts

// האזנה לאזהרות תקציב
EventBus.on('budget:warning-80', (data) => {
  showNotification(
    `⚠️ ${data.clientName} הגיע ל-80% מהתקציב (נותרו ${data.remainingMinutes} דקות)`,
    'warning'
  );
});

EventBus.on('budget:warning-100', (data) => {
  showNotification(
    `🚨 ${data.clientName} חרג מהתקציב ב-${data.overageMinutes} דקות!`,
    'error'
  );

  // שליחת מייל למנהל
  sendEmailAlert(data);
});
```

---

### דוגמה 3: מעקב אחר פעולות משתמש

```typescript
// analytics.ts

// מעקב אחר כל פעולות המשתמש
EventBus.on('client:created', (data) => {
  trackEvent('client_created', {
    clientId: data.clientId,
    user: data.createdBy
  });
});

EventBus.on('task:created', (data) => {
  trackEvent('task_created', {
    taskId: data.taskId,
    estimate: data.originalEstimate
  });
});

EventBus.on('timesheet:entry-created', (data) => {
  trackEvent('timesheet_entry', {
    minutes: data.minutes,
    employee: data.employee
  });
});
```

---

## 🧪 Testing

### בדיקת פליטת אירועים

```typescript
// client-selector.test.ts
import { EventBus } from './event-bus';

describe('ClientSelector', () => {
  it('should emit client:selected event', () => {
    const mockCallback = jest.fn();

    EventBus.on('client:selected', mockCallback);

    // פעולה
    clientSelector.selectClient('123', 'יוחנן כהן');

    // בדיקה
    expect(mockCallback).toHaveBeenCalledWith({
      clientId: '123',
      clientName: 'יוחנן כהן'
    });
  });
});
```

---

## ⚠️ Best Practices

### ✅ DO:

1. **השתמש באירועים לתקשורת בין מודולים**
   ```typescript
   EventBus.emit('client:selected', data);
   ```

2. **תן שמות ברורים לאירועים**
   ```typescript
   'client:selected'  // ✅ ברור
   'update'           // ❌ לא ברור
   ```

3. **תמיד נתק מאזין כשלא צריך אותו**
   ```typescript
   const unsubscribe = EventBus.on('...', callback);
   // ...
   unsubscribe();
   ```

4. **השתמש ב-Type Safety**
   ```typescript
   // TypeScript יבדוק שהנתונים נכונים
   EventBus.emit('client:selected', {
     clientId: '123',
     clientName: 'יוחנן כהן'
   });
   ```

### ❌ DON'T:

1. **אל תשלח אירועים מיותרים**
   ```typescript
   // ❌ לא צריך אירוע לכל שינוי UI קטן
   EventBus.emit('button:clicked', {});
   ```

2. **אל תשכח לטפל בשגיאות**
   ```typescript
   EventBus.on('client:selected', (data) => {
     try {
       updateClient(data);
     } catch (error) {
       console.error('Error updating client:', error);
     }
   });
   ```

3. **אל תשתמש באירועים לעברת נתונים גדולים**
   ```typescript
   // ❌ אל תעביר מערכים ענקיים
   EventBus.emit('data:loaded', {
     clients: [...10000 clients]
   });

   // ✅ עבור רק את הנתונים הנחוצים
   EventBus.emit('data:loaded', {
     dataType: 'clients',
     recordCount: 10000
   });
   ```

---

## 🔗 ראה גם

- [Firebase Service Guide](./FIREBASE_SERVICE_GUIDE.md)
- [Migration Guide](./MIGRATION_GUIDE.md)
- [Architecture Refactor Plan](./ARCHITECTURE_REFACTOR_PLAN.md)

---

**נוצר:** 27 אוקטובר 2025
**עדכון אחרון:** 27 אוקטובר 2025
**גרסה:** 1.0.0
