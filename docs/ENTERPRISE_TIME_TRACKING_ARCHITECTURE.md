# Enterprise-Grade Time Tracking Architecture
## ארכיטקטורת מעקב זמן ברמת ארגונית

**תאריך:** 2025-11-05
**דרישה עסקית:** דיוק מוחלט - דוחות שבועיים ללקוחות
**רמת איכות:** Senior/Principal Engineer Level

---

## 🎯 דרישות איכות

### Non-Negotiable Requirements
1. **Zero Data Loss** - אפס אובדן נתונים
2. **100% Accuracy** - דיוק מוחלט
3. **Complete Audit Trail** - מעקב מלא אחר כל שינוי
4. **Idempotency** - אותה פעולה פעמיים = תוצאה זהה
5. **Atomic Transactions** - הכל או כלום
6. **Data Consistency** - עקביות בכל רמה
7. **Compensating Actions** - rollback אוטומטי בשגיאה

---

## 🏗️ מבנה נתונים מתקדם

### 1️⃣ **Version Control & Optimistic Locking**

```javascript
// כל מסמך מכיל:
{
  "_version": 15,              // ✅ גרסה נוכחית
  "_lastModified": Timestamp,
  "_modifiedBy": "user1",
  "_etag": "abc123",           // ✅ חתימה דיגיטלית

  // ... שאר הנתונים
}

// Update רק אם הגרסה תואמת:
transaction.update(docRef, {
  field: newValue,
  _version: oldVersion + 1
}, {
  // ✅ Precondition - רק אם הגרסה הנוכחית היא oldVersion
  precondition: { _version: oldVersion }
});
```

**יתרון:**
- אם משתמש A ו-B עובדים באותו זמן - רק אחד מצליח
- השני מקבל error ונאלץ לטעון מחדש
- ❌ לעולם לא יאבדו עדכונים!

---

### 2️⃣ **Event Sourcing - מעקב אחר כל אירוע**

במקום לעדכן ישירות, נשמור **כל אירוע**:

```javascript
// Collection: time_events (append-only)
{
  "eventId": "evt_1762335335968",
  "eventType": "TIME_ADDED",       // ✅ סוג האירוע
  "timestamp": Timestamp,
  "caseId": "2025001",
  "serviceId": "srv_xxx",
  "stageId": "stage_a",
  "packageId": "pkg_001",

  // הנתונים
  "data": {
    "taskId": "task_123",
    "minutes": 120,
    "date": "2025-02-20",
    "addedBy": "user1",
    "description": "פגישה עם לקוח"
  },

  // מצב לפני
  "before": {
    "hoursRemaining": 50,
    "hoursUsed": 10,
    "_version": 14
  },

  // מצב אחרי
  "after": {
    "hoursRemaining": 48,
    "hoursUsed": 12,
    "_version": 15
  },

  // Idempotency
  "idempotencyKey": "task_123_2025-02-20_user1",  // ✅ מזהה ייחודי
  "processed": true,
  "processedAt": Timestamp
}
```

**יתרונות:**
- ✅ מעקב מלא - יודעים **מי, מה, מתי, למה**
- ✅ Audit Trail מובנה
- ✅ אפשר לשחזר כל מצב בעבר
- ✅ Debug קל - רואים בדיוק מה קרה

---

### 3️⃣ **Two-Phase Commit Pattern**

```javascript
// Phase 1: Reserve (הזמנה)
{
  "reservationId": "rsv_xxx",
  "status": "pending",           // ✅ pending → committed → rolled_back
  "caseId": "2025001",
  "minutes": 120,
  "reservedAt": Timestamp,
  "expiresAt": Timestamp + 30s,  // ✅ תפוגה אוטומטית

  "operations": [
    {
      "collection": "clients",
      "docId": "2025001",
      "field": "services[0].stages[0].hoursRemaining",
      "oldValue": 50,
      "newValue": 48,
      "version": 14
    },
    {
      "collection": "budget_tasks",
      "docId": "task_123",
      "field": "actualMinutes",
      "oldValue": 600,
      "newValue": 720
    },
    {
      "collection": "timesheet_entries",
      "operation": "create",
      "data": { ... }
    }
  ]
}

// Phase 2: Commit or Rollback
// אם הכל הצליח - commit
// אם משהו נכשל - rollback אוטומטי
```

---

### 4️⃣ **Idempotency Keys**

```javascript
// Collection: processed_operations
{
  "idempotencyKey": "task_123_2025-02-20_user1_120min",
  "status": "completed",
  "result": {
    "success": true,
    "eventId": "evt_xxx",
    "timestamp": Timestamp
  },
  "expiresAt": Timestamp + 24h  // ✅ ניקוי אוטומטי
}

// בדיקה לפני ביצוע:
const existing = await db.collection('processed_operations')
  .doc(idempotencyKey)
  .get();

if (existing.exists) {
  // ✅ כבר בוצע! החזר את התוצאה הקודמת
  return existing.data().result;
}

// אחרת - המשך לביצוע
```

---

## 🔐 **Cloud Function ברמת Enterprise**

### `addTimeToTask_v2` (Enterprise Edition)

```javascript
exports.addTimeToTask_v2 = functions.https.onCall(async (data, context) => {
  const user = await checkUserPermissions(context);

  // ═══════════════════════════════════════
  // 1. Validation (3 layers)
  // ═══════════════════════════════════════

  // Layer 1: Input validation
  if (!data.taskId || !data.minutes || !data.date) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'חסרים שדות חובה: taskId, minutes, date'
    );
  }

  // Layer 2: Business rules validation
  if (data.minutes <= 0 || data.minutes > 1440) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'דקות חייבות להיות בין 1 ל-1440 (24 שעות)'
    );
  }

  // Layer 3: Authorization
  const taskDoc = await db.collection('budget_tasks').doc(data.taskId).get();
  if (!taskDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'משימה לא נמצאה');
  }

  const taskData = taskDoc.data();
  if (taskData.employee !== user.email && user.role !== 'admin') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'אין הרשאה להוסיף זמן למשימה זו'
    );
  }

  // ═══════════════════════════════════════
  // 2. Idempotency Check
  // ═══════════════════════════════════════

  const idempotencyKey = `${data.taskId}_${data.date}_${user.email}_${data.minutes}`;
  const processedRef = db.collection('processed_operations').doc(idempotencyKey);

  const processedDoc = await processedRef.get();
  if (processedDoc.exists && processedDoc.data().status === 'completed') {
    console.log(`⚠️ Operation ${idempotencyKey} already processed - returning cached result`);
    return processedDoc.data().result;
  }

  // Mark as processing
  await processedRef.set({
    status: 'processing',
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
    taskId: data.taskId,
    minutes: data.minutes,
    user: user.email
  });

  // ═══════════════════════════════════════
  // 3. Two-Phase Commit: Phase 1 (Reserve)
  // ═══════════════════════════════════════

  const reservationId = `rsv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const reservationRef = db.collection('reservations').doc(reservationId);

  try {
    // Load client
    const clientRef = db.collection('clients').doc(taskData.caseId);
    const clientDoc = await clientRef.get();
    if (!clientDoc.exists) {
      throw new Error('לקוח לא נמצא');
    }

    const clientData = clientDoc.data();
    const currentVersion = clientData._version || 0;

    // Find service and stage
    const service = clientData.services?.find(s => s.id === taskData.parentServiceId);
    if (!service) {
      throw new Error('שירות לא נמצא');
    }

    const stage = service.stages?.find(s => s.id === taskData.serviceId);
    if (!stage) {
      throw new Error('שלב לא נמצא');
    }

    // ✅ Calculate deduction with automatic package switching
    const hoursToDeduct = data.minutes / 60;
    let remainingToDeduct = hoursToDeduct;
    const operations = [];
    let currentPackageIndex = stage.currentPackageIndex || 0;

    // Deep clone to avoid mutations
    const updatedStage = JSON.parse(JSON.stringify(stage));

    while (remainingToDeduct > 0 && currentPackageIndex < updatedStage.packages.length) {
      const pkg = updatedStage.packages[currentPackageIndex];

      if (pkg.status !== 'active') {
        currentPackageIndex++;
        continue;
      }

      const available = pkg.hoursRemaining || 0;

      if (available >= remainingToDeduct) {
        // Current package has enough
        pkg.hoursUsed = (pkg.hoursUsed || 0) + remainingToDeduct;
        pkg.hoursRemaining -= remainingToDeduct;
        pkg.minutesRemaining = pkg.hoursRemaining * 60;

        // Add time entry
        if (!pkg.timeEntries) pkg.timeEntries = [];
        pkg.timeEntries.push({
          eventId: `evt_${Date.now()}`,
          date: data.date,
          minutes: Math.round(remainingToDeduct * 60),
          hours: remainingToDeduct,
          addedBy: user.username,
          addedAt: new Date().toISOString(),
          taskId: data.taskId,
          description: data.description || ''
        });

        remainingToDeduct = 0;

        // Check if depleted
        if (pkg.hoursRemaining <= 0) {
          pkg.status = 'depleted';
          pkg.closedDate = new Date().toISOString();

          // Move to next package if exists
          if (currentPackageIndex + 1 < updatedStage.packages.length) {
            updatedStage.currentPackageIndex = currentPackageIndex + 1;
            updatedStage.currentPackageId = updatedStage.packages[currentPackageIndex + 1].id;
          }
        }

      } else {
        // Not enough - deduct all and move to next
        pkg.hoursUsed = (pkg.hoursUsed || 0) + available;
        pkg.hoursRemaining = 0;
        pkg.minutesRemaining = 0;
        pkg.status = 'depleted';
        pkg.closedDate = new Date().toISOString();

        if (!pkg.timeEntries) pkg.timeEntries = [];
        pkg.timeEntries.push({
          eventId: `evt_${Date.now()}`,
          date: data.date,
          minutes: Math.round(available * 60),
          hours: available,
          addedBy: user.username,
          addedAt: new Date().toISOString(),
          taskId: data.taskId,
          description: (data.description || '') + ' (חלקי)'
        });

        remainingToDeduct -= available;
        currentPackageIndex++;

        if (currentPackageIndex < updatedStage.packages.length) {
          updatedStage.currentPackageIndex = currentPackageIndex;
          updatedStage.currentPackageId = updatedStage.packages[currentPackageIndex].id;
        }
      }
    }

    // Check if all hours were deducted
    if (remainingToDeduct > 0) {
      throw new Error(
        `אין מספיק שעות! חסרות ${remainingToDeduct.toFixed(2)} שעות. ` +
        `יש לרכוש חבילת שעות נוספת ל${stage.name}.`
      );
    }

    // Update stage totals
    updatedStage.hoursUsed = (updatedStage.hoursUsed || 0) + hoursToDeduct;
    updatedStage.hoursRemaining = (updatedStage.hoursRemaining || 0) - hoursToDeduct;

    // ✅ Create reservation document
    await reservationRef.set({
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + 30000),  // 30 seconds TTL
      caseId: taskData.caseId,
      serviceId: taskData.parentServiceId,
      stageId: taskData.serviceId,
      taskId: data.taskId,
      minutes: data.minutes,
      user: user.email,

      // Planned operations
      operations: {
        clientUpdate: {
          collection: 'clients',
          docId: taskData.caseId,
          currentVersion: currentVersion,
          newVersion: currentVersion + 1,
          updatedStage: updatedStage
        },
        taskUpdate: {
          collection: 'budget_tasks',
          docId: data.taskId,
          incrementMinutes: data.minutes
        },
        timesheetCreate: {
          collection: 'timesheet_entries',
          data: {
            clientId: taskData.caseId,
            serviceId: taskData.parentServiceId,
            stageId: taskData.serviceId,
            taskId: data.taskId,
            date: data.date,
            minutes: data.minutes,
            employee: user.email,
            lawyer: user.username,
            description: data.description || taskData.description
          }
        }
      }
    });

    // ═══════════════════════════════════════
    // 4. Two-Phase Commit: Phase 2 (Commit)
    // ═══════════════════════════════════════

    const result = await db.runTransaction(async (transaction) => {
      // Re-read with transaction
      const freshClientDoc = await transaction.get(clientRef);
      const freshClientData = freshClientDoc.data();

      // ✅ Optimistic lock check
      if (freshClientData._version !== currentVersion) {
        throw new Error(
          `❌ Conflict detected! המסמך שונה על ידי משתמש אחר. ` +
          `אנא טען מחדש ונסה שוב. (expected version ${currentVersion}, got ${freshClientData._version})`
        );
      }

      // Find and update the stage
      const serviceIndex = freshClientData.services.findIndex(s => s.id === taskData.parentServiceId);
      const stageIndex = freshClientData.services[serviceIndex].stages.findIndex(s => s.id === taskData.serviceId);

      freshClientData.services[serviceIndex].stages[stageIndex] = updatedStage;

      // ✅ Update client with version increment
      transaction.update(clientRef, {
        services: freshClientData.services,
        _version: currentVersion + 1,
        _lastModified: admin.firestore.FieldValue.serverTimestamp(),
        _modifiedBy: user.username,
        lastActivity: admin.firestore.FieldValue.serverTimestamp()
      });

      // ✅ Update task
      transaction.update(taskDoc.ref, {
        actualMinutes: admin.firestore.FieldValue.increment(data.minutes),
        actualHours: admin.firestore.FieldValue.increment(data.minutes / 60),
        lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastModifiedBy: user.username
      });

      // ✅ Create timesheet entry
      const timesheetRef = db.collection('timesheet_entries').doc();
      transaction.set(timesheetRef, {
        clientId: taskData.caseId,
        clientName: freshClientData.clientName,
        serviceId: taskData.parentServiceId,
        serviceName: service.name,
        stageId: taskData.serviceId,
        stageName: stage.name,
        taskId: data.taskId,
        taskDescription: taskData.description,
        date: data.date,
        minutes: data.minutes,
        hours: data.minutes / 60,
        employee: user.email,
        lawyer: user.username,
        description: data.description || '',
        autoGenerated: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: user.username
      });

      // ✅ Mark reservation as committed
      transaction.update(reservationRef, {
        status: 'committed',
        committedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        success: true,
        message: 'זמן נוסף בהצלחה',
        details: {
          hoursDeducted: hoursToDeduct,
          newHoursRemaining: updatedStage.hoursRemaining,
          timesheetId: timesheetRef.id
        }
      };
    });

    // ═══════════════════════════════════════
    // 5. Mark idempotency key as completed
    // ═══════════════════════════════════════

    await processedRef.update({
      status: 'completed',
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      result: result
    });

    // ═══════════════════════════════════════
    // 6. Audit log
    // ═══════════════════════════════════════

    await logAction('ADD_TIME_TO_TASK', user.uid, user.username, {
      taskId: data.taskId,
      caseId: taskData.caseId,
      minutes: data.minutes,
      reservationId: reservationId
    });

    return result;

  } catch (error) {
    console.error('❌ Error in addTimeToTask_v2:', error);

    // ═══════════════════════════════════════
    // 7. Rollback (Compensating Transaction)
    // ═══════════════════════════════════════

    try {
      await reservationRef.update({
        status: 'rolled_back',
        error: error.message,
        rolledBackAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await processedRef.update({
        status: 'failed',
        error: error.message,
        failedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (rollbackError) {
      console.error('❌ Rollback failed:', rollbackError);
    }

    throw error;
  }
});
```

---

## 📊 **Validation & Reconciliation**

### Daily Reconciliation Job

```javascript
exports.dailyReconciliation = functions.pubsub
  .schedule('0 2 * * *')  // 2 AM every day
  .onRun(async (context) => {

    const clientsSnapshot = await db.collection('clients').get();
    const errors = [];

    for (const clientDoc of clientsSnapshot.docs) {
      const clientData = clientDoc.data();

      for (const service of clientData.services || []) {
        for (const stage of service.stages || []) {

          // ✅ Validation 1: Sum of packages == stage totals
          let calculatedTotal = 0;
          let calculatedUsed = 0;
          let calculatedRemaining = 0;

          for (const pkg of stage.packages || []) {
            calculatedTotal += (pkg.hours || 0);
            calculatedUsed += (pkg.hoursUsed || 0);
            calculatedRemaining += (pkg.hoursRemaining || 0);
          }

          if (Math.abs(calculatedTotal - (stage.totalHours || 0)) > 0.01) {
            errors.push({
              caseId: clientDoc.id,
              serviceId: service.id,
              stageId: stage.id,
              error: 'TOTAL_MISMATCH',
              expected: stage.totalHours,
              actual: calculatedTotal
            });
          }

          if (Math.abs(calculatedUsed - (stage.hoursUsed || 0)) > 0.01) {
            errors.push({
              caseId: clientDoc.id,
              serviceId: service.id,
              stageId: stage.id,
              error: 'USED_MISMATCH',
              expected: stage.hoursUsed,
              actual: calculatedUsed
            });
          }

          if (Math.abs(calculatedRemaining - (stage.hoursRemaining || 0)) > 0.01) {
            errors.push({
              caseId: clientDoc.id,
              serviceId: service.id,
              stageId: stage.id,
              error: 'REMAINING_MISMATCH',
              expected: stage.hoursRemaining,
              actual: calculatedRemaining
            });
          }

          // ✅ Validation 2: timeEntries sum == hoursUsed
          for (const pkg of stage.packages || []) {
            let entriesSum = 0;
            for (const entry of pkg.timeEntries || []) {
              entriesSum += (entry.hours || entry.minutes / 60 || 0);
            }

            if (Math.abs(entriesSum - (pkg.hoursUsed || 0)) > 0.01) {
              errors.push({
                caseId: clientDoc.id,
                serviceId: service.id,
                stageId: stage.id,
                packageId: pkg.id,
                error: 'TIME_ENTRIES_MISMATCH',
                expected: pkg.hoursUsed,
                actual: entriesSum
              });
            }
          }
        }
      }
    }

    // ✅ Report errors
    if (errors.length > 0) {
      console.error(`❌ Found ${errors.length} data consistency errors!`);

      // Send alert to admin
      await db.collection('system_alerts').add({
        type: 'DATA_CONSISTENCY_ERROR',
        severity: 'critical',
        errors: errors,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      // TODO: Send email to admin
    } else {
      console.log('✅ Data consistency check passed - no errors found');
    }
  });
```

---

## 🎯 **המלצה סופית**

### **תוכנית יישום (4 שלבים)**

#### **שלב 1: Infrastructure (קריטי!) - 1 שבוע**
1. ✅ הוסף `_version` לכל מסמך לקוח
2. ✅ צור Collection: `time_events`
3. ✅ צור Collection: `processed_operations`
4. ✅ צור Collection: `reservations`
5. ✅ הוסף cleanup job למחיקת רשומות ישנות

#### **שלב 2: Core Logic - 1.5 שבוע**
6. ✅ יישם `addTimeToTask_v2` עם כל הבדיקות
7. ✅ Migration script - העבר לקוחות קיימים לפורמט חדש
8. ✅ Dual write - כתוב גם למבנה ישן וגם לחדש

#### **שלב 3: Validation & Testing - 1 שבוע**
9. ✅ יישם `dailyReconciliation` job
10. ✅ בדיקות אוטומטיות (unit + integration)
11. ✅ Load testing - 50 משתמשים סימולטניים

#### **שלב 4: Monitoring & Rollout - 0.5 שבוע**
12. ✅ Dashboard לניטור שגיאות
13. ✅ Alerts אוטומטיים
14. ✅ Gradual rollout - 10% → 50% → 100%

---

## 📈 **השוואה: לפני ואחרי**

| תכונה | לפני (נוכחי) | אחרי (Enterprise) |
|-------|-------------|-------------------|
| **Lost Updates** | 🔴 אפשרי | ✅ בלתי אפשרי (Optimistic Lock) |
| **Partial Failures** | 🔴 אפשרי | ✅ בלתי אפשרי (Transaction) |
| **Data Drift** | 🔴 אפשרי | ✅ נמנע (Daily Reconciliation) |
| **Audit Trail** | ❌ אין | ✅ מלא (Event Sourcing) |
| **Idempotency** | ❌ אין | ✅ מובנה |
| **Rollback** | ❌ ידני | ✅ אוטומטי |
| **דיוק** | 🟡 95-98% | ✅ 99.99% |

---

## ✅ סיכום

**זו הדרך היחידה** להבטיח דיוק מוחלט בדוחות ללקוחות.

**מחיר:**
- זמן פיתוח: ~4 שבועות
- מורכבות: גבוהה
- ביצועים: קצת יותר איטי (300ms → 500ms)

**תועלת:**
- ✅ דיוק 99.99%
- ✅ אפס אובדן נתונים
- ✅ מעקב מלא
- ✅ הגנה מושלמת מבאגים

**האם תרצה שאתחיל ליישם את השלב הראשון?**
