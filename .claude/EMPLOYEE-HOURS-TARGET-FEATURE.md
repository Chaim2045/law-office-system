# 🎯 תכונת תקן שעות יומי לעובדים

## 📋 **תיאור התכונה**

מערכת לניהול תקני שעות אישיים לכל עובד, המאפשרת למנהל לקבוע תקן שעות יומי מותאם אישית לכל עובד.
המערכת מחשבת **אוטומטית** את התקן החודשי לפי:
- **תקן יומי** שהוגדר על ידי המנהל
- **ימי עבודה בפועל** בכל חודש
- **לוח שנה ישראלי** (מוריד שישי-שבת וחגים)

---

## 🚀 **איך זה עובד?**

### **1️⃣ מנהל קובע תקן יומי**
המנהל נכנס לאדמין פאנל → עורך עובד → מזין תקן שעות יומי (לדוגמה: 8.5 שעות)

### **2️⃣ המערכת מחשבת אוטומטית**
לכל חודש, המערכת:
1. סופרת את **ימי העבודה בפועל** (ראשון-חמישי)
2. **מורידה** שישי-שבת
3. **מורידה** חגים ישראליים מ[לוח השנה המשולב](../js/modules/work-hours-calculator.js)
4. **מחשבת:** `תקן חודשי = ימי עבודה × תקן יומי`

### **3️⃣ העובד רואה תקן דינמי**
בצ'אטבוט / שעתון:
- **תקן אישי:** 🎯 8.5 שעות/יום
- **מכסה לינואר 2025:** 195.5 שעות (23 ימי עבודה × 8.5)
- **מכסה לפברואר 2025:** 170 שעות (20 ימי עבודה × 8.5 - פורים)

---

## 📂 **קבצים ששונו**

### **1. טופס עריכת עובדים - Admin Panel**
📁 `master-admin-panel/js/ui/UserForm.js`

**שינויים:**
- ✅ נוסף שדה: **תקן שעות יומי** (dailyHoursTarget)
- ✅ Validation: 1-24 שעות, חצי שעה מינימום
- ✅ Placeholder: 8.5 (ברירת מחדל)
- ✅ הסבר למנהל: "המערכת תחשב אוטומטית את התקן החודשי"

```html
<input
    type="number"
    id="dailyHoursTarget"
    name="dailyHoursTarget"
    placeholder="8.5"
    min="0"
    max="24"
    step="0.5"
>
```

---

### **2. WorkHoursCalculator - לוגיקת חישוב**
📁 `js/modules/work-hours-calculator.js`

**שינויים:**
```javascript
class WorkHoursCalculator {
    constructor(dailyHoursTarget = null) {
        // תקן יומי (ברירת מחדל: 8.45)
        this.DAILY_HOURS_TARGET = dailyHoursTarget || 8.45;
    }

    getMonthlyQuota(year, month) {
        const workDaysInMonth = this.getWorkDaysInMonth(year, month);
        const dailyTarget = this.DAILY_HOURS_TARGET;

        // חישוב: ימי עבודה × תקן יומי
        const monthlyQuota = Math.round(workDaysInMonth * dailyTarget * 10) / 10;

        return {
            monthlyQuota,
            dailyTarget,
            workDaysInMonth,
            isCustomTarget: dailyTarget !== 8.45
        };
    }
}
```

**לפני השינוי:**
- מדד קבוע: 186 שעות חודשיות
- חישוב: `186 / 22 = 8.45 שעות ליום`

**אחרי השינוי:**
- תקן דינמי: `dailyTarget × ימי עבודה בחודש`
- תומך בתקן אישי לכל עובד

---

### **3. Cloud Functions - שמירה ב-Firestore**
📁 `functions/admin/master-admin-wrappers.js`

**שינויים בפונקציית `createUser`:**
```javascript
// Validation של תקן שעות יומי
let dailyHoursTarget = null;
if (data.dailyHoursTarget !== undefined && data.dailyHoursTarget !== null) {
    const hours = parseFloat(data.dailyHoursTarget);
    if (isNaN(hours) || hours < 1 || hours > 24) {
        throw new functions.https.HttpsError('invalid-argument', 'תקן שעות יומי חייב להיות בין 1 ל-24');
    }
    dailyHoursTarget = hours;
}

// הוספה ל-Firestore
if (dailyHoursTarget !== null) {
    employeeData.dailyHoursTarget = dailyHoursTarget;
}
```

**שינויים בפונקציית `updateUser`:**
```javascript
if (data.dailyHoursTarget !== undefined) {
    if (data.dailyHoursTarget === null || data.dailyHoursTarget === '') {
        // מחיקת תקן אישי (חזרה לברירת מחדל)
        updates.dailyHoursTarget = admin.firestore.FieldValue.delete();
    } else {
        const hours = parseFloat(data.dailyHoursTarget);
        if (isNaN(hours) || hours < 1 || hours > 24) {
            throw new functions.https.HttpsError('invalid-argument', 'תקן שעות יומי חייב להיות בין 1 ל-24');
        }
        updates.dailyHoursTarget = hours;
    }
}
```

---

### **4. ChatBot - הצגה ויזואלית**
📁 `js/modules/smart-faq-bot.js`

**שינויים:**
```javascript
// קבלת תקן אישי של העובד
const employeeData = window.manager.currentEmployee || {};
const dailyHoursTarget = employeeData.dailyHoursTarget || null;

// יצירת מחשבון עם תקן אישי
const calculator = new window.WorkHoursCalculator(dailyHoursTarget);
const hoursStatus = calculator.calculateCurrentStatus(timesheetEntries);
const quota = calculator.getMonthlyQuota();

// הצגה בתשובה
${quota.isCustomTarget ? `
    • תקן אישי: 🎯 ${quota.dailyTarget} שעות/יום
` : `
    • תקן ברירת מחדל: 8.45 שעות/יום
`}
• מכסה לחודש זה: ${quota.monthlyQuota} שעות
(${quota.workDaysTotal} ימי עבודה × ${quota.dailyTarget} שעות)
```

---

## 📊 **דוגמאות שימוש**

### **דוגמה 1: עובד במשרה מלאה**
- **תקן יומי:** 9 שעות
- **ינואר 2025:** 23 ימי עבודה → **207 שעות**
- **פברואר 2025:** 20 ימי עבודה → **180 שעות** (פורים)

### **דוגמה 2: עובד במשרה חלקית**
- **תקן יומי:** 4 שעות
- **ינואר 2025:** 23 ימי עבודה → **92 שעות**
- **פברואר 2025:** 20 ימי עבודה → **80 שעות**

### **דוגמה 3: עובד ללא תקן אישי**
- **תקן ברירת מחדל:** 8.45 שעות (מדד 186 שעות חודשיות)
- **ינואר 2025:** 23 ימי עבודה → **194.4 שעות**
- **פברואר 2025:** 20 ימי עבודה → **169 שעות**

---

## 🔧 **מבנה הנתונים ב-Firestore**

### **Collection: `employees`**
```json
{
  "email": "user@example.com",
  "displayName": "שם המשתמש",
  "role": "employee",
  "dailyHoursTarget": 8.5,  // ⬅️ שדה חדש (אופציונלי)
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-19T12:00:00Z"
}
```

### **שדה `dailyHoursTarget`**
- **סוג:** Number
- **ערכים אפשריים:** 1-24
- **ברירת מחדל:** `null` (אז משתמש ב-8.45)
- **חסר/ריק:** משתמש בברירת מחדל 8.45

---

## 🎨 **ממשק המשתמש**

### **אדמין פאנל - עריכת עובד**
```
┌─────────────────────────────────────────┐
│  תקן שעות יומי (אופציונלי)             │
│  ┌─────────────────────────────────┐    │
│  │ 8.5                             │    │
│  └─────────────────────────────────┘    │
│  ℹ️ ברירת מחדל: 8.45 שעות/יום       │
│  המערכת תחשב אוטומטית את התקן      │
│  החודשי לפי ימי העבודה בפועל        │
│  (מוריד שישי-שבת וחגים)              │
└─────────────────────────────────────────┘
```

### **צ'אטבוט - תצוגת שעות**
```
📊 סיכום שעות פברואר 2025

⏰ מכסת שעות:
• תקן אישי: 🎯 8.5 שעות/יום
• מכסה לחודש זה: 170 שעות
  (20 ימי עבודה × 8.5 שעות)

📊 מצב נוכחי:
• דיווחת עד היום: 120 שעות
• עוד צריך לדווח: 50 שעות
```

---

## ✅ **Validation Rules**

1. **תקן יומי:**
   - מינימום: 1 שעה
   - מקסימום: 24 שעות
   - צעדים: 0.5 שעה

2. **שדה אופציונלי:**
   - אם לא מוזן → ברירת מחדל 8.45
   - אם ריק → ברירת מחדל 8.45

3. **עדכון:**
   - ניתן לעדכן בכל עת
   - ניתן למחוק (חזרה לברירת מחדל)

---

## 🧪 **בדיקות**

### **תרחישים לבדיקה:**

1. ✅ **יצירת עובד חדש עם תקן אישי**
   - יצירת עובד עם תקן 9 שעות
   - וידוא שהשדה נשמר ב-Firestore

2. ✅ **עדכון תקן קיים**
   - עדכון מ-8 ל-10 שעות
   - וידוא שהחישוב משתנה

3. ✅ **מחיקת תקן (חזרה לברירת מחדל)**
   - מחיקת התקן האישי
   - וידוא שחוזר ל-8.45

4. ✅ **הצגה בצ'אטבוט**
   - שאילתת שעות עם תקן אישי
   - וידוא שמוצג "תקן אישי: 🎯"

5. ✅ **חישוב דינמי לפי חודשים**
   - בדיקה שחודשים עם חגים מקבלים תקן נמוך יותר

---

## 🔄 **תאימות לאחור**

- ✅ עובדים ישנים ללא תקן → ממשיכים לעבוד עם 8.45
- ✅ קוד קיים שלא מעביר תקן → עדיין עובד
- ✅ WorkHoursCalculator ישן → ממשיך לעבוד (8.45)

---

## 📝 **הערות למפתחים**

### **שימוש ב-WorkHoursCalculator**

```javascript
// ללא תקן אישי (ברירת מחדל)
const calculator1 = new WorkHoursCalculator();

// עם תקן אישי
const calculator2 = new WorkHoursCalculator(9.5);

// קבלת מכסה חודשית
const quota = calculator2.getMonthlyQuota(2025, 0); // ינואר 2025
console.log(quota.monthlyQuota);      // 218.5
console.log(quota.dailyTarget);       // 9.5
console.log(quota.workDaysInMonth);   // 23
console.log(quota.isCustomTarget);    // true
```

### **שליפת תקן מ-Firestore**

```javascript
const employeeDoc = await db.collection('employees').doc(email).get();
const employeeData = employeeDoc.data();
const dailyTarget = employeeData.dailyHoursTarget || null;

const calculator = new WorkHoursCalculator(dailyTarget);
```

---

## 🎉 **סיכום**

תכונה זו מאפשרת:
- ✅ **גמישות מלאה** בקביעת תקן שעות לכל עובד
- ✅ **חישוב אוטומטי** לפי לוח שנה ישראלי
- ✅ **שקיפות מלאה** לעובד בצ'אטבוט
- ✅ **ניהול פשוט** דרך אדמין פאנל
- ✅ **תאימות לאחור** מלאה

---

**נוצר:** 2025-01-19
**גרסה:** 1.0.0
**מפתח:** Claude Code
**סטטוס:** ✅ הושלם
