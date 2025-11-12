# 🎯 הסבר מלא: איך קיזוז השעות עובד

**תאריך:** 2025-11-11
**מטרה:** להבין בדיוק איפה כל דבר נשמר ואיך הקיזוז עובד

---

## 📦 מבנה הנתונים - איפה הכל נשמר

### 1️⃣ **Firestore Collection: `clients`**

כל לקוח = Document אחד ב-`clients` collection.

```
Firestore
└── clients/
    └── 2025001  ← Document ID (מספר תיק)
        ├── caseNumber: "2025001"
        ├── clientName: "משה כהן"
        ├── fullName: "משה כהן"
        ├── phone: "050-1234567"
        ├── email: "moshe@example.com"
        ├── procedureType: "legal_procedure"  ← 🎯 סוג השירות
        ├── createdAt: timestamp
        ├── createdBy: "chaim@example.com"
        │
        └── services: [  ← 🎯 מערך של שירותים
              {
                id: "service_lp_123456",
                type: "legal_procedure",
                name: "הליך משפטי - גירושין",
                pricingType: "hourly",
                status: "active",

                // 🎯 שלבים (Stages)
                stages: [
                  {
                    id: "stage_a",
                    name: "שלב א - גישור",
                    description: "ניסיון לגישור",
                    order: 1,
                    status: "active",
                    totalHours: 20,
                    hoursUsed: 0,
                    hoursRemaining: 20,

                    // 🎯 חבילות שעות בשלב
                    packages: [
                      {
                        id: "pkg_initial_stage_a_123456",
                        type: "initial",
                        hours: 20,
                        hoursUsed: 0,
                        hoursRemaining: 20,
                        status: "active",
                        description: "חבילה ראשונית - שלב א",
                        createdAt: "2025-01-01T10:00:00Z"
                      }
                    ]
                  },
                  {
                    id: "stage_b",
                    name: "שלב ב - הליכים משפטיים",
                    description: "הגשת תביעה",
                    order: 2,
                    status: "pending",
                    totalHours: 30,
                    hoursUsed: 0,
                    hoursRemaining: 30,

                    packages: [
                      {
                        id: "pkg_initial_stage_b_123457",
                        type: "initial",
                        hours: 30,
                        hoursUsed: 0,
                        hoursRemaining: 30,
                        status: "pending",
                        description: "חבילה ראשונית - שלב ב",
                        createdAt: "2025-01-01T10:00:00Z"
                      }
                    ]
                  },
                  {
                    id: "stage_c",
                    name: "שלב ג - סיום הליך",
                    description: "משא ומתן וסיום",
                    order: 3,
                    status: "pending",
                    totalHours: 15,
                    hoursUsed: 0,
                    hoursRemaining: 15,

                    packages: [
                      {
                        id: "pkg_initial_stage_c_123458",
                        type: "initial",
                        hours: 15,
                        hoursUsed: 0,
                        hoursRemaining: 15,
                        status: "pending",
                        description: "חבילה ראשונית - שלב ג",
                        createdAt: "2025-01-01T10:00:00Z"
                      }
                    ]
                  }
                ],

                // 🎯 Aggregates - סכומים מצטברים
                totalHours: 65,        // 20 + 30 + 15
                hoursUsed: 0,
                hoursRemaining: 65,
                currentStageId: "stage_a"  // השלב הנוכחי
              }
            ]
```

---

## 🎬 תרחיש מלא: מיצירת לקוח עד קיזוז

### **תרחיש:** משה כהן - הליך גירושין

---

### 📝 **שלב 1: יצירת לקוח חדש**

**מה קורה בקוד:**

1. **משתמש ממלא טופס:**
   ```
   שם: משה כהן
   טלפון: 050-1234567
   סוג: הליך משפטי
   ```

2. **לוחצים "שמור"**

3. **Frontend → קורא ל-Firebase Function:**
   ```javascript
   firebase.functions().httpsCallable('createClient')({
     client: {
       clientName: "משה כהן",
       phone: "050-1234567",
       email: "moshe@example.com"
     },
     procedureType: "legal_procedure",
     stages: [
       {
         id: "stage_a",
         name: "שלב א - גישור",
         description: "ניסיון לגישור",
         hours: 20
       },
       {
         id: "stage_b",
         name: "שלב ב - הליכים",
         description: "הגשת תביעה",
         hours: 30
       },
       {
         id: "stage_c",
         name: "שלב ג - סיום",
         description: "משא ומתן וסיום",
         hours: 15
       }
     ]
   })
   ```

4. **Backend (functions/index.js) - פונקציה `createClient()`:**

   ```javascript
   exports.createClient = functions.https.onCall(async (data, context) => {
     // 1. ולידציה
     // 2. יצירת מספר תיק
     const caseNumber = await generateCaseNumber(); // "2025001"

     // 3. 🎯 בניית השלבים עם המודול החדש!
     const DeductionSystem = require('../src/modules/deduction');

     const stages = DeductionSystem.createLegalProcedureStages({
       stagesData: data.stages,
       username: context.auth.token.email
     });

     // 4. שמירה ב-Firestore
     await db.collection('clients').doc(caseNumber).set({
       caseNumber,
       clientName: data.client.clientName,
       fullName: data.client.clientName,
       phone: data.client.phone,
       procedureType: "legal_procedure",
       services: [
         {
           id: `service_lp_${Date.now()}`,
           type: "legal_procedure",
           stages: stages,  // ← 🎯 כאן השלבים!
           totalHours: 65,
           hoursRemaining: 65,
           currentStageId: "stage_a"
         }
       ],
       createdAt: admin.firestore.FieldValue.serverTimestamp(),
       createdBy: context.auth.token.email
     });
   });
   ```

5. **✅ הלקוח נשמר ב-Firestore!**

**📍 איפה הוא נשמר:**
```
Firestore → clients → 2025001
```

---

### ⏱️ **שלב 2: רישום שעתון (Timesheet)**

**המשתמש עכשיו רושם שעות עבור משה כהן:**

1. **ממלאים:**
   ```
   לקוח: משה כהן (2025001)
   תאריך: 05/01/2025
   שעות: 3
   תיאור: פגישת גישור ראשונה
   שלב: שלב א - גישור  ← 🎯 חשוב!
   ```

2. **לוחצים "שמור"**

3. **Frontend → קורא ל:**
   ```javascript
   firebase.functions().httpsCallable('createTimesheetEntry')({
     clientId: "2025001",
     date: "2025-01-05",
     hours: 3,
     description: "פגישת גישור ראשונה",
     stageId: "stage_a"  // ← 🎯 השלב שנבחר!
   })
   ```

---

### 🔧 **שלב 3: הקיזוז - הלב של המערכת!**

**מה קורה ב-Backend (functions/index.js):**

```javascript
exports.createTimesheetEntry = functions.https.onCall(async (data, context) => {
  const { clientId, hours, stageId } = data;

  // 1. שליפת הלקוח מ-Firestore
  const clientDoc = await db.collection('clients').doc(clientId).get();
  const clientData = clientDoc.data();

  // 2. מציאת השירות (הליך משפטי)
  const service = clientData.services.find(s => s.type === 'legal_procedure');

  // 3. 🎯 מציאת השלב הנכון
  const stageIndex = service.stages.findIndex(s => s.id === stageId);
  const currentStage = service.stages[stageIndex];

  console.log('🎯 קיזוז שעות:', {
    לקוח: clientData.clientName,
    שלב: currentStage.name,
    שעות_לקיזוז: hours,
    שעות_נותרות_לפני: currentStage.hoursRemaining
  });

  // 4. 🎯 קיזוז באמצעות המודול החדש!
  const DeductionSystem = require('../src/modules/deduction');

  // מציאת חבילה פעילה בשלב
  const activePackage = DeductionSystem.getActivePackage(currentStage);

  if (!activePackage) {
    throw new Error('אין חבילה פעילה בשלב זה!');
  }

  // 🎯 קיזוז השעות מהחבילה!
  DeductionSystem.deductHoursFromPackage(activePackage, hours);

  // עדכון השלב
  currentStage.hoursUsed += hours;
  currentStage.hoursRemaining = DeductionSystem.calculateRemainingHours(currentStage);

  console.log('✅ אחרי קיזוז:', {
    חבילה: activePackage.id,
    שעות_בחבילה: activePackage.hoursRemaining,
    שעות_בשלב: currentStage.hoursRemaining,
    סטטוס_חבילה: activePackage.status
  });

  // 5. 🎯 שמירת הרישום בשעתון
  await db.collection('timesheet').add({
    clientId,
    clientName: clientData.clientName,
    employeeEmail: context.auth.token.email,
    date: data.date,
    hours: hours,
    description: data.description,
    stageId: stageId,
    stageName: currentStage.name,
    packageId: activePackage.id,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // 6. 🎯 עדכון הלקוח ב-Firestore עם השעות החדשות
  await clientDoc.ref.update({
    services: clientData.services  // ← החבילה עודכנה!
  });

  return { success: true };
});
```

---

## 🔍 בואו נראה מה קרה בדאטה

### **לפני הקיזוז:**

```json
// Client: 2025001
{
  "services": [
    {
      "stages": [
        {
          "id": "stage_a",
          "name": "שלב א - גישור",
          "hoursRemaining": 20,  ← 🎯
          "packages": [
            {
              "id": "pkg_123",
              "hoursRemaining": 20,  ← 🎯
              "status": "active"
            }
          ]
        }
      ]
    }
  ]
}
```

### **אחרי קיזוז של 3 שעות:**

```json
// Client: 2025001
{
  "services": [
    {
      "stages": [
        {
          "id": "stage_a",
          "name": "שלב א - גישור",
          "hoursUsed": 3,        ← ✅ התעדכן!
          "hoursRemaining": 17,  ← ✅ 20 - 3 = 17
          "packages": [
            {
              "id": "pkg_123",
              "hoursUsed": 3,        ← ✅ התעדכן!
              "hoursRemaining": 17,  ← ✅ 20 - 3 = 17
              "status": "active"
            }
          ]
        }
      ]
    }
  ]
}
```

### **רישום בשעתון (Timesheet Collection):**

```json
// timesheet/entry_xyz
{
  "clientId": "2025001",
  "clientName": "משה כהן",
  "employeeEmail": "chaim@example.com",
  "date": "2025-01-05",
  "hours": 3,
  "description": "פגישת גישור ראשונה",
  "stageId": "stage_a",      ← 🎯 מאיזה שלב
  "stageName": "שלב א - גישור",
  "packageId": "pkg_123",    ← 🎯 מאיזו חבילה
  "createdAt": "2025-01-05T14:30:00Z"
}
```

---

## 🎯 איך המערכת יודעת לקזז מהשלב הנכון?

### **התשובה:** המשתמש **בוחר** את השלב!

```
Flow:
1. משתמש פותח "רישום שעות"
2. בוחר לקוח: "משה כהן"
3. ← 🎯 המערכת טוענת את השלבים של הלקוח
4. משתמש בוחר שלב: "שלב א - גישור"
5. ממלא שעות: 3
6. שומר
7. ← Backend מקבל את ה-stageId
8. ← מוצא את השלב הנכון
9. ← מקזז מהחבילה הפעילה של השלב הזה!
```

**קוד Frontend (דוגמה):**

```javascript
// בדיאלוג רישום שעות
async function loadClientStages(clientId) {
  const client = await db.collection('clients').doc(clientId).get();
  const service = client.data().services.find(s => s.type === 'legal_procedure');

  // הצגת השלבים לבחירה
  const stageSelect = document.getElementById('stage-select');
  service.stages.forEach(stage => {
    const option = document.createElement('option');
    option.value = stage.id;
    option.textContent = `${stage.name} (${stage.hoursRemaining} שעות נותרות)`;
    stageSelect.appendChild(option);
  });
}
```

---

## 🧪 איך לבדוק שזה עובד? (Testing Guide)

### **בדיקה 1: יצירת לקוח עם הליך משפטי**

```bash
# Firestore Console
1. לך ל-Firebase Console
2. Firestore Database
3. Collection: clients
4. מצא את הלקוח שיצרת
5. ✅ בדוק: האם יש שדה services?
6. ✅ בדוק: האם יש 3 stages?
7. ✅ בדוק: כל stage יש packages?
```

**תצפית:**
```json
services[0].stages[0].packages[0] = {
  "hours": 20,
  "hoursRemaining": 20,
  "status": "active"
}
```

---

### **בדיקה 2: קיזוז שעות**

```bash
# במערכת:
1. רשום 3 שעות עבור "שלב א"
2. רענן את הדף
3. פתח את הלקוח
4. ✅ בדוק: השעות נותרות בשלב א = 17?

# Firestore Console:
1. מצא את הלקוח
2. services → stages → stage_a → packages[0]
3. ✅ בדוק: hoursRemaining = 17?
4. ✅ בדוק: hoursUsed = 3?

# Timesheet Collection:
1. לך ל-Collection: timesheet
2. מצא את הרישום האחרון
3. ✅ בדוק: יש stageId = "stage_a"?
4. ✅ בדוק: יש packageId?
```

---

### **בדיקה 3: סגירה אוטומטית של חבילה**

```bash
# תרחיש: שלב א יש 20 שעות
1. רשום 10 שעות → נשאר 10
2. רשום עוד 10 שעות → נשאר 0
3. ✅ בדוק ב-Firestore:
   packages[0].status = "depleted"
   packages[0].closedDate = timestamp
```

---

### **בדיקה 4: מעבר בין שלבים**

```bash
# תרחיש: סיימנו שלב א, עוברים לשלב ב

1. רשום שעות עד שלב א מתרוקן (20 שעות)
2. רשום שעות חדשות - בחר "שלב ב"
3. ✅ בדוק:
   - stages[0] (שלב א): hoursRemaining = 0
   - stages[0].packages[0].status = "depleted"
   - stages[1] (שלב ב): hoursRemaining = 30
   - stages[1].packages[0].hoursUsed > 0
```

---

## 🐛 שגיאות נפוצות ואיך לתקן

### **שגיאה 1: "אין חבילה פעילה"**

**סיבה:** כל החבילות בשלב מתרוקנו או ב-status "depleted"

**פתרון:**
```javascript
// הוסף חבילה חדשה לשלב
DeductionSystem.addPackageToStage(stage, {
  hours: 10,
  description: "חבילה נוספת"
});
```

---

### **שגיאה 2: "השעות לא מתקזזות"**

**סיבה אפשרית 1:** ה-stageId שנשלח לא תואם לאף שלב

**בדיקה:**
```javascript
console.log('Stage ID:', data.stageId);
console.log('Available stages:', service.stages.map(s => s.id));
```

**סיבה אפשרית 2:** הפונקציה הישנה משומשת במקום החדשה

**בדיקה:**
```javascript
// ודא שב-functions/index.js יש:
const DeductionSystem = require('../src/modules/deduction');
DeductionSystem.deductHoursFromPackage(...);
```

---

### **שגיאה 3: "השעות מתקזזות פעמיים"**

**סיבה:** יש שני listeners או פונקציה נקראית פעמיים

**בדיקה:**
```javascript
// בקונסול - ספור כמה פעמים מופיע:
"📦 חבילה נסגרה אוטומטית"
// אם מופיע פעמיים → יש duplicate call
```

---

## 📊 סיכום - המפה המנטלית

```
יצירת לקוח
    ↓
Frontend: טופס עם פרטי לקוח + שלבים
    ↓
Firebase Function: createClient()
    ↓
DeductionSystem.createLegalProcedureStages()
    ↓
Firestore: clients/{caseNumber}
    ├── services[0]
    │   └── stages[0..2]
    │       └── packages[]
    ↓
✅ לקוח נשמר!

───────────────────────────

רישום שעתון
    ↓
Frontend: בחירת לקוח + שלב + שעות
    ↓
Firebase Function: createTimesheetEntry()
    ↓
1. שליפת לקוח
2. מציאת שלב לפי stageId
3. DeductionSystem.getActivePackage()
4. DeductionSystem.deductHoursFromPackage()
5. שמירת timesheet entry
6. עדכון client ב-Firestore
    ↓
✅ שעות קוזזו!
```

---

## ✅ Checklist - האם הקיזוז עובד?

- [ ] לקוח חדש עם הליך משפטי נשמר ב-Firestore
- [ ] יש 3 שלבים ב-services[0].stages
- [ ] כל שלב יש packages[] עם חבילה ראשונית
- [ ] רישום שעתון יוצר document ב-timesheet collection
- [ ] השעות מקוזזות מה-package הנכון
- [ ] hoursRemaining מתעדכן
- [ ] כשחבילה מתרוקנת - status = "depleted"
- [ ] closedDate מתווסף
- [ ] אפשר לבחור שלבים שונים ברישום שעתון
- [ ] כל שלב מקזז מהחבילה שלו ולא של שלב אחר

---

**נוצר על ידי:** Claude Code
**תאריך:** 2025-11-11
**גרסה:** 1.0
