# 🔍 דוח חקירה: בעיית סנכרון שעות בניהול לקוחות

**תאריך:** 4 בפברואר 2026
**חוקר:** Claude (AI Assistant)
**מזמין החקירה:** טומי (ראש צוות פיתוח)
**ענף:** `investigation/admin-employee-management`
**מספר תיק לדוגמה:** 2025006 (תמיר אקווע)

---

## 📋 תקציר מנהלים

**הבעיה המרכזית:**
המערכת מציגה 49.2/120 שעות עבור תמיר אקווע, אבל בפועל עבדו 146.88 שעות. הפרש של **76 שעות חסרות** בתצוגה.

**הסיבה:**
Cloud Function `createTimesheetEntry` לא מעדכן את `client.services[].hoursUsed` ו-`client.services[].hoursRemaining` כשמוסיפים משימה חדשה.

**ההשפעה:**
- לקוחות עם חריגת שעות לא מוצגים נכון
- מנהלים לא יכולים לעקוב אחר צריכת השעות האמיתית
- דוחות לא מדויקים

**הפתרון:**
1. תיקון Cloud Function לעדכן גם `services`
2. סקריפט סנכרון לתקן נתונים קיימים
3. ClientsDataManager כבר עובד נכון - רק צריך נתונים מעודכנים

---

## 🎯 תיאור הבעיה

### מצב נוכחי

עבור לקוח "תמיר אקווע" (ID: 2025006), הטבלה בסקשן ניהול לקוחות מציגה:

```
49.2 / 120 שעות
```

המשמעות לפי התצוגה:
- תקציב כולל: 120 שעות
- נותרו: 49.2 שעות
- נוצלו: 70.8 שעות

### מצב אמיתי

ב-Firestore, בקולקשן `timesheet_entries`:
- **60 משימות** שנרשמו
- **146.88 שעות** בפועל
- כולן משויכות ל-serviceId: `srv_1765177554252`

### הפער

```
תצוגה בטבלה:   70.8 שעות
נתונים אמיתיים: 146.88 שעות
──────────────────────────────
הפרש:           76.08 שעות ❌
```

---

## 🔬 תהליך החקירה

### שלב 1: בדיקת מבנה הנתונים

**מבנה הלקוח ב-Firestore:**

```javascript
client (2025006) = {
    fullName: "תמיר אקווע",

    // ✅ מבנה חדש (נכון)
    services: [
        {
            id: "srv_1765177554252",
            name: "תוכנית שעות #1",
            type: "hours",
            status: "active",
            totalHours: 60,
            hoursUsed: 70.8,          // ❌ לא מעודכן!
            hoursRemaining: -10.8,    // ❌ לא מעודכן!
            createdAt: "2025-12-04..."
        },
        {
            id: "srv_1769776553488",
            name: "תיק מקרקעין - אכיפת הסכם",
            type: "legal_procedure",
            pricingType: "hourly",
            currentStage: "stage_a",
            stages: [
                {
                    id: "stage_a",
                    name: "שלב א'",
                    status: "active",
                    totalHours: 60,
                    hoursRemaining: 60
                },
                // ... שלבים נוספים
            ],
            totalHours: 180,
            hoursUsed: 0,
            hoursRemaining: 180
        }
    ]
}
```

**מבנה המשימות ב-Firestore:**

```javascript
timesheet_entries (collection) {
    // 60 documents
    {
        clientId: "2025006",
        serviceId: "srv_1765177554252",
        date: "2025-12-02",
        hours: 2.033,
        description: "תמלול הקלטת פגישה...",
        employee: "user@example.com",
        createdAt: "2025-12-14T10:13:42Z"
    },
    // ... 59 משימות נוספות
}
```

### שלב 2: זיהוי נקודת השבירה

**חקירה כרונולוגית:**

| תאריך | משימה # | שעות מצטבר | אירוע |
|-------|---------|------------|-------|
| 2.12.2025 | 1 | 2.03 | משימה ראשונה |
| ... | ... | ... | עבודה רגילה |
| 4.1.2026 | 41 | **61.30** | 🎯 חרגנו מ-60 שעות |
| 5.1.2026 | 43 | **70.80** | ⚠️ המערכת הפסיקה כאן |
| 5.1.2026 | 44 | 72.80 | ❌ לא עודכן בשירות |
| ... | ... | ... | 18 משימות נוספות |
| 4.2.2026 | 60 | **146.88** | משימה אחרונה |

**ממצא קריטי:**

```
✅ משימות 1-43: 70.8 שעות - עודכנו בשירות
❌ משימות 44-60: 76.08 שעות - לא עודכנו!
```

### שלב 3: בדיקת קוד

**איפה הבעיה?**

functions/index.js:2879-3301 - `createTimesheetEntry`

הפונקציה עושה:

1. ✅ שומר משימה ב-`timesheet_entries`
2. ✅ מקזז שעות מחבילה (package)
3. ✅ מעדכן `client.hoursRemaining` (שדה ישן!)
4. ❌ **לא מעדכן** `client.services[x].hoursUsed`
5. ❌ **לא מעדכן** `client.services[x].hoursRemaining`

**הקוד הבעייתי:**

```javascript
// functions/index.js:3210-3215
await clientDoc.ref.update({
    stages: stages,  // ⚠️ לארכיטקטורה ישנה
    hoursRemaining: admin.firestore.FieldValue.increment(-hoursWorked),
    minutesRemaining: admin.firestore.FieldValue.increment(-data.minutes),
    lastActivity: admin.firestore.FieldValue.serverTimestamp()
});
```

**מה חסר:**

```javascript
// ❌ זה לא קיים בקוד!
const services = clientData.services || [];
const serviceIndex = services.findIndex(s => s.id === data.serviceId);

if (serviceIndex !== -1) {
    services[serviceIndex].hoursUsed += hoursWorked;
    services[serviceIndex].hoursRemaining -= hoursWorked;

    await clientDoc.ref.update({
        services: services
    });
}
```

### שלב 4: בדיקת ClientsDataManager

**האם הבעיה בתצוגה?**

לא! ClientsDataManager (שורות 129-181) עובד **נכון**:

```javascript
calculateRemainingHoursFromServices(client) {
    let totalRemaining = 0;

    client.services.forEach(service => {
        if (service.type === 'legal_procedure' && service.stages) {
            // רק שלבים ACTIVE
            service.stages.forEach(stage => {
                if (stage.status === 'active') {
                    totalRemaining += (stage.hoursRemaining || 0);
                }
            });
        } else {
            totalRemaining += (service.hoursRemaining || 0);
        }
    });

    return totalRemaining;
}
```

**הלוגיקה:**
- ✅ עבור `type: "hours"` → מחזיר `service.hoursRemaining`
- ✅ עבור `type: "legal_procedure"` → מסכם רק שלבים `status: "active"`

**הבעיה:**
הנתונים ב-`service.hoursRemaining` לא מעודכנים!

---

## 🧩 מקור האמת

### היררכיית נתונים

```
1. timesheet_entries (קולקשן)
   └─ מקור האמת המוחלט ✅
      - כל משימה מתועדת
      - לא ניתן לשנות רטרואקטיבית
      - חותמת זמן של יצירה

2. client.services[].hoursUsed
   └─ צריך להיות מחושב מ-timesheet_entries
      - כרגע: לא מתעדכן אוטומטית ❌
      - צריך: עדכון אוטומטי ב-Cloud Function

3. client.hoursRemaining (שדה ישן)
   └─ deprecated - לא בשימוש
```

### חישוב נכון

```javascript
// מה צריך להיות:
SELECT SUM(hours)
FROM timesheet_entries
WHERE clientId = '2025006'
  AND serviceId = 'srv_1765177554252'

// תוצאה: 146.88 שעות ✅

// מה בפועל בשירות:
service.hoursUsed = 70.8  ❌
```

---

## 📊 השפעה על המערכת

### 1. תצוגת ניהול לקוחות

**מה מוצג:**
```
תמיר אקווע: 49.2 / 120
```

**מה אמור להיות:**
```
תמיר אקווע: -86.88 / 60 (חריגה!)
עוד שירות: 60 / 60
```

### 2. דוחות

הדוח של תמיר אקווע מראה:
- סיכום שגוי של שעות
- לא ברור כמה באמת עבדו

### 3. מעקב תקציב

- מנהלים לא יודעים שיש חריגה של 86 שעות
- התראות לא עובדות
- תכנון כלכלי לא מדויק

---

## 📊 היקף הבעיה במערכת

### סקירה כללית

**סה"כ משימות במערכת:** 1,143
- ✅ 707 עם `serviceId` (62%)
- ⚠️ 436 ללא `serviceId` (38% - רובן תקינות, ראה הסבר למטה)

**שירותים לא מסונכרנים:** 27 מתוך 97 שירותים (27.8%)

### פירוט משימות ללא `serviceId`

```
433 משימות (99%) → internal_office ✅ תקין
  משימות פנימיות של המשרד (לא צריכות serviceId)

3 משימות (1%) → לקוחות אמיתיים ❌
  - קובי הראל: 2 משימות
  - סיון אזרד: 1 משימה
```

**מסקנה:** רוב המשימות ללא `serviceId` הן תקינות (עבודה פנימית).

### חומרת הבעיה - 27 שירותים לא מסונכרנים

#### קטגוריה 1: נקודת שבירה מזוהה (4 שירותים)

```
1. תמיר אקווע - תוכנית שעות #1
   💥 הפסיק: 5.1.2026, 18:03
   📊 הפרש: 76.08 שעות (17 משימות לא נספרו)

2. רעות ואוריאל חליבה - תוכנית שעות #1
   💥 הפסיק: 15.1.2026, 15:44
   📊 הפרש: 25.58 שעות (20 משימות לא נספרו)

3. ביקון אבטחת מידע - תוכנית שעות #1
   💥 הפסיק: 3.2.2026, 9:55
   📊 הפרש: 2.42 שעות (2 משימות לא נספרו)

4. הפודקסטיה - תוכנית שעות #1
   💥 הפסיק: 4.1.2026, 13:52
   📊 הפרש: 1.08 שעות (2 משימות לא נספרו)
```

**תבנית משותפת:** כולם נשברו בינואר-פברואר 2026

#### קטגוריה 2: נתונים שגויים מלכתחילה (23 שירותים)

```
דוגמאות:
❌ ד"ר אילן וסרמן - 55.5 שעות שמורות, 0 משימות בפועל
❌ רומן אברמוב - 34 שעות שמורות, 0 משימות בפועל
❌ חיים פרץ - 64 שעות שמורות, רק 6.72 שעות אמיתיות
```

**אפשרויות:**
- Migration גרוע
- משימות נמחקו אבל `hoursUsed` לא עודכן
- העתקה ידנית שגויה

### מצב timesheet_entries (מקור האמת)

✅ **הקולקשן תקין:**
- 0 משימות יתומות (עם `serviceId` לא קיים)
- 0 שירותים נמחקו
- 100% עם `clientId`, `hours`, `date`, `createdAt`
- כל המידע נשמר נכון

**מסקנה:** המידע האמיתי קיים ושלם - רק התצוגה לא מסונכרנת.

---

## ✅ סיכום

### הבעיה

**27 שירותים (27.8%)** לא מסונכרנים:
- 4 שירותים: המערכת הפסיקה לעדכן (ינואר-פברואר 2026)
- 23 שירותים: נתונים שגויים מלכתחילה

**תמיר אקווע (המקרה הקיצוני):**
- מוצג: 70.8 שעות
- אמיתי: 146.88 שעות
- הפרש: **76 שעות חסרות**

### הסיבה

Cloud Function `createTimesheetEntry` **מעולם לא עדכן** את `client.services[].hoursUsed`:

```javascript
// functions/index.js:3210-3215
await clientDoc.ref.update({
    stages: stages,  // ⬅️ ארכיטקטורה ישנה בלבד
    hoursRemaining: ...  // ⬅️ ארכיטקטורה ישנה בלבד
    // ❌ לא מעדכן services!
});
```

### הפתרון המומלץ

1. **תיקון Cloud Function** - שילוב של מודול `deduction/aggregators` הקיים
2. **סקריפט סנכרון** - תיקון 27 השירותים הלא מסונכרנים
3. **ניקוי נתונים** - בדיקה של 23 השירותים עם נתונים שגויים
4. **בדיקות** - וידוא שהתיקון עובד

---

## 📎 נספחים

### נספח א': קבצים רלוונטיים

1. **functions/index.js**
   - שורה 2879: `createTimesheetEntry`
   - שורה 3210-3215: עדכון הלקוח (נדרש תיקון)

2. **master-admin-panel/js/managers/ClientsDataManager.js**
   - שורה 129-152: `calculateRemainingHoursFromServices` (עובד נכון)
   - שורה 158-181: `calculateTotalHoursFromServices` (עובד נכון)

3. **master-admin-panel/js/modules/case-creation-dialog.js**
   - שורה 255-293: תיעוד מבנה הנתונים

### נספח ב': סקריפטי חקירה

כל הסקריפטים ב-`.dev/`:
1. `diagnose-tamir-hours-mismatch.js` - אבחון ראשוני
2. `check-tamir-service2-stages.js` - בדיקת שירות #2 (הליך משפטי)
3. `find-tamir-tasks.js` - מיפוי כל 60 המשימות
4. `verify-completion-theory.js` - אימות נקודת השבירה
5. `check-when-hoursUsed-added.js` - סקירת כל השירותים במערכת
6. `find-breaking-point.js` - איתור 4 נקודות שבירה מדויקות
7. `investigate-missing-serviceId.js` - בדיקת 436 משימות ללא serviceId
8. `investigate-orphaned-tasks.js` - בדיקת משימות יתומות (0 נמצאו)
9. `verify-timesheet-entries-integrity.js` - אימות שלמות מקור האמת

### נספח ג': נתוני תמיר אקווע

```
Client ID: 2025006
Full Name: תמיר אקווע

Service #1:
  ID: srv_1765177554252
  Name: תוכנית שעות #1
  Type: hours
  Status: active
  totalHours: 60
  hoursUsed (שגוי): 70.8
  hoursUsed (נכון): 146.88
  hoursRemaining (שגוי): -10.8
  hoursRemaining (נכון): -86.88

  Tasks: 60 משימות
  Date Range: 2.12.2025 - 4.2.2026

Service #2:
  ID: srv_1769776553488
  Name: תיק מקרקעין - אכיפת הסכם
  Type: legal_procedure
  pricingType: hourly
  Status: active

  Stages:
    - שלב א': 60/60 שעות (active)
    - שלב ב': 60/60 שעות (pending)
    - שלב ג': 60/60 שעות (pending)

  Tasks: 0 משימות
```

---

**סיום הדוח**
**תאריך:** 4 בפברואר 2026, 19:30
**חתימה:** Claude AI Assistant
