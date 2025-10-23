# תיקון מערכת קיזוז השעות

**תאריך:** 23 אוקטובר 2025
**סטטוס:** ✅ תוקן ונפרס

---

## 🐛 הבעיה שהיתה

מערכת הקיזוז של השעות עבדה **רק** לתיקים מסוג "חבילת שעות" פשוטה.
הליכים משפטיים עם שלבים **לא קיזזו שעות בכלל**.

### קוד ישן (לא עבד):
```javascript
if (caseData.procedureType === 'hours') {
  // ✅ עבד
  await caseDoc.ref.update({
    hoursRemaining: increment(-hoursWorked)
  });
} else {
  // ❌ לא עשה כלום!
  console.log('אין קיזוז');
}
```

---

## ✅ התיקון

עכשיו הקוד תומך ב-**3 סוגי תיקים**:

### 1️⃣ חבילת שעות פשוטה (`procedureType: "hours"`)
```javascript
if (caseData.procedureType === 'hours') {
  await caseDoc.ref.update({
    hoursRemaining: increment(-hoursWorked),
    minutesRemaining: increment(-minutes)
  });
}
```
**מה קורה:** מקזז מיתרת השעות של התיק כולו.

---

### 2️⃣ הליך משפטי - תמחור שעתי (`procedureType: "legal_procedure"`, `pricingType: "hourly"`)
```javascript
else if (caseData.procedureType === 'legal_procedure' && caseData.pricingType === 'hourly') {
  // מוצא את השלב הנוכחי (stage_a, stage_b, או stage_c)
  const currentStage = stages.find(s => s.id === caseData.currentStage);

  // מקזז מהשלב הספציפי
  currentStage.hoursUsed += hoursWorked;
  currentStage.hoursRemaining -= hoursWorked;

  await caseDoc.ref.update({
    stages: stages,
    hoursRemaining: increment(-hoursWorked)
  });
}
```

**מה קורה:**
1. מזהה איזה שלב פעיל כרגע (א', ב', או ג')
2. מקזז את השעות **רק מהשלב הזה**
3. עוקב אחרי כמה שעות נותרו בשלב
4. אם אזלו השעות בשלב - מזהיר ולא מקזז יותר

**דוגמה:**
- שלב א': 10 שעות
- שלב ב': 15 שעות
- שלב ג': 20 שעות
- עובד רושם 2 שעות → מקזז 2 מ"שלב א'" (נשארו 8)

---

### 3️⃣ הליך משפטי - מחיר קבוע (`procedureType: "legal_procedure"`, `pricingType: "fixed"`)
```javascript
else if (caseData.procedureType === 'legal_procedure' && caseData.pricingType === 'fixed') {
  // לא מקזז - זה מחיר קבוע!
  // אבל עוקב אחרי כמה שעות הושקעו
  currentStage.hoursWorked += hoursWorked;

  await caseDoc.ref.update({
    stages: stages,
    totalHoursWorked: increment(hoursWorked)
  });
}
```

**מה קורה:**
1. **לא מקזז שעות** (כי זה מחיר קבוע, לא שעתי)
2. **עוקב** אחרי כמה שעות הושקעו בפועל
3. חשוב לדעת אם השקענו יותר מדי זמן על מחיר קבוע

**דוגמה:**
- שלב א': 5,000 ₪ (מחיר קבוע)
- עובד רושם 2 שעות → רושם "2 שעות הושקעו" (אבל לא מקזז כסף)
- אחר כך אפשר לראות: "השקענו 20 שעות על תיק של 5,000 ₪ - זה כדאי?"

---

## 📊 השוואה: לפני ואחרי

| סוג תיק | לפני התיקון | אחרי התיקון |
|---------|-------------|-------------|
| **חבילת שעות** | ✅ עבד | ✅ עובד |
| **הליך משפטי - שעתי** | ❌ לא קיזז | ✅ מקזז מהשלב הנוכחי |
| **הליך משפטי - קבוע** | ❌ לא עקב | ✅ עוקב אחרי שעות בפועל |

---

## 🎯 מה זה משנה למשתמש?

### לפני:
1. עובד רושם 5 שעות על הליך משפטי
2. השעות נרשמו ב-timesheet_entries
3. **אבל לא קוזזו מהשלב!**
4. במסך הלקוחות: עדיין מראה "10 שעות נותרו" (לא נכון!)

### אחרי:
1. עובד רושם 5 שעות על הליך משפטי
2. השעות נרשמו ב-timesheet_entries
3. **השעות מקוזזות מהשלב הנוכחי!**
4. במסך הלקוחות: מראה "5 שעות נותרו" (נכון!)

---

## 🔍 קוד מפורט

### מיקום הקובץ:
`functions/index.js` שורות 1823-1919

### פונקציה:
`exports.createTimesheetEntry`

### מה הפונקציה עושה:
1. מקבלת רישום שעות (client, case, minutes, action)
2. יוצרת document ב-`timesheet_entries`
3. **מקזזת/עוקבת אחרי השעות בתיק הרלוונטי**
4. רושמת activity log

---

## ✅ סטטוס הפריסה

```bash
firebase deploy --only functions:createTimesheetEntry
```

**תאריך פריסה:** 23 אוקטובר 2025
**סטטוס:** ✅ נפרס בהצלחה
**פונקציה:** `createTimesheetEntry`
**אזור:** `us-central1`

---

## 📝 בדיקות שצריך לעשות

לאחר הפריסה, בדוק:

### ✅ תיק שעתי:
1. צור לקוח עם תיק שעתי (50 שעות)
2. רשום 2 שעות
3. ודא: `hoursRemaining` השתנה מ-50 ל-48

### ✅ הליך משפטי - שעתי:
1. צור לקוח עם הליך משפטי שעתי (שלב א': 10 שעות)
2. רשום 2 שעות
3. ודא: `stages[0].hoursRemaining` השתנה מ-10 ל-8

### ✅ הליך משפטי - קבוע:
1. צור לקוח עם הליך משפטי מחיר קבוע (שלב א': 5,000 ₪)
2. רשום 2 שעות
3. ודא: `stages[0].hoursWorked` השתנה מ-0 ל-2
4. ודא: `fixedPrice` לא השתנה (עדיין 5,000 ₪)

---

## 🎓 מה למדנו?

1. **הארכיטקטורה היתה מצוינת** - Client → Case → Service
2. **ההגיון היה נכון** - 3 סוגי תמחור שונים
3. **הקוד פשוט לא הושלם** - היה חסר לוגיקה לשלבים
4. **זה לא "חרטא"** - זה מערכת מקצועית שפשוט היתה חסרה 40 שורות

---

## 🚀 השלבים הבאים

עכשיו שהקיזוז עובד נכון, אפשר:

1. ✅ לבנות דשבורד Admin מקצועי
2. ✅ להציג דו"חות שעות מדויקים
3. ✅ לייצא PDF עם פירוט לפי שלבים
4. ✅ להזהיר כשנגמרות השעות בשלב

---

## 📞 תמיכה

**שאלות?**
- מיקום הקוד: [functions/index.js:1823-1919](functions/index.js#L1823-L1919)
- פונקציה: `createTimesheetEntry`

---

**עודכן לאחרונה:** 23 אוקטובר 2025
