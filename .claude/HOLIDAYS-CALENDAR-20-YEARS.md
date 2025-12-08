# 📅 לוח חגים ישראלי - 20 שנה קדימה

## 🎯 **מטרה**

להבטיח שהמערכת תחשב נכון את **תקן השעות החודשי** ב-20 השנים הקרובות (2025-2045), תוך התחשבות בחגים ישראליים שמשתנים מדי שנה.

---

## ⚠️ **הבעיה**

חגים ישראליים נקבעים לפי **לוח שנה עברי** (לוח ירחי-שמשי), לא לפי לוח גרגוריאני.
זה אומר ש**התאריכים משתנים כל שנה** בלוח הגרגוריאני.

### **דוגמה:**
| חג | 2024 | 2025 | 2026 |
|-----|------|------|------|
| ראש השנה | 3-4 אוקטובר | 23-24 ספטמבר | 12-13 ספטמבר |
| פסח | 23-24 אפריל | 13-14 אפריל | 2-3 אפריל |

---

## 🔧 **הפתרון הנוכחי**

כרגע יש **חגים קבועים** ל-3 שנים בלבד (2024-2026) ב:
📁 [js/modules/work-hours-calculator.js](../js/modules/work-hours-calculator.js:13-78)

```javascript
this.holidays2025 = [
    { name: 'ראש השנה', start: new Date(2025, 8, 23), end: new Date(2025, 8, 24) },
    { name: 'יום כיפור', start: new Date(2025, 9, 2), end: new Date(2025, 9, 2) },
    // ... וכו'
];
```

**זה לא מספיק ל-20 שנה קדימה!**

---

## ✅ **הפתרונות האפשריים**

### **אופציה 1: ספריית Hebcal (מומלץ)**

השתמש בספריית **[Hebcal](https://github.com/hebcal/hebcal-js)** - ספריית JavaScript רשמית לחגים עבריים.

#### **התקנה:**
```bash
npm install @hebcal/core
```

#### **שימוש:**
```javascript
import { HebrewCalendar, HolidayEvent } from '@hebcal/core';

function getIsraeliHolidays(year) {
    const options = {
        year: year,
        isHebrewYear: false, // גרגוריאני
        candlelighting: false,
        location: { cc: 'IL' }, // ישראל
        il: true // חגים של ארץ ישראל
    };

    const events = HebrewCalendar.calendar(options);
    const holidays = [];

    for (const ev of events) {
        if (ev instanceof HolidayEvent) {
            holidays.push({
                name: ev.getDesc('he'), // שם בעברית
                start: ev.getDate().greg(),
                end: ev.getDate().greg()
            });
        }
    }

    return holidays;
}

// קבלת חגים לכל השנים
const allHolidays = [];
for (let year = 2024; year <= 2045; year++) {
    allHolidays.push(...getIsraeliHolidays(year));
}
```

**יתרונות:**
- ✅ דיוק מלא
- ✅ כולל חגים נוספים (חנוכה, פורים, ט"ו בשבט וכו')
- ✅ תומך בחגים ייחודיים לישראל (יום השואה, יום הזיכרון, יום העצמאות)
- ✅ מתעדכן אוטומטית

**חסרונות:**
- ⚠️ צריך להוסיף ספרייה חיצונית
- ⚠️ גודל קובץ גדול יותר (~30KB)

---

### **אופציה 2: חישוב ידני (נוכחי)**

להוסיף ידנית חגים לכל שנה עד 2045.

#### **איך להוסיף:**

1. **מצא את התאריכים** של חגים ישראליים ב:
   - [Hebcal Online](https://www.hebcal.com/holidays/)
   - [לוח שנה עברי](https://www.hebcal.com/converter)

2. **הוסף למערך** `this.allHolidays`:

```javascript
this.holidays2027 = [
    { name: 'ראש השנה', start: new Date(2027, 8, 2), end: new Date(2027, 8, 3) },
    { name: 'יום כיפור', start: new Date(2027, 8, 11), end: new Date(2027, 8, 11) },
    { name: 'סוכות', start: new Date(2027, 8, 16), end: new Date(2027, 8, 17) },
    { name: 'שמחת תורה', start: new Date(2027, 8, 23), end: new Date(2027, 8, 23) },
    { name: 'פורים', start: new Date(2027, 1, 26), end: new Date(2027, 1, 26) },
    { name: 'פסח', start: new Date(2027, 2, 23), end: new Date(2027, 2, 24) },
    { name: 'פסח (ז׳ חג)', start: new Date(2027, 2, 29), end: new Date(2027, 2, 30) },
    { name: 'יום הזיכרון', start: new Date(2027, 3, 13), end: new Date(2027, 3, 13) },
    { name: 'יום העצמאות', start: new Date(2027, 3, 14), end: new Date(2027, 3, 14) },
    { name: 'שבועות', start: new Date(2027, 4, 12), end: new Date(2027, 4, 12) }
];

this.allHolidays = [
    ...this.holidays2024,
    ...this.holidays2025,
    ...this.holidays2026,
    ...this.holidays2027 // ⬅️ הוסף כאן
];
```

3. **חזור על זה** לכל שנה עד 2045.

**יתרונות:**
- ✅ אין תלות בספריות חיצוניות
- ✅ גודל קובץ קטן

**חסרונות:**
- ❌ עבודה ידנית מייגעת (22 שנים!)
- ❌ סיכוי לטעויות
- ❌ צריך לעדכן ידנית כל כמה שנים

---

### **אופציה 3: API חיצוני**

לקרוא את החגים מ-API חיצוני כמו:
- [Hebcal API](https://www.hebcal.com/home/197/jewish-calendar-rest-api)
- [Calendarific API](https://calendarific.com/)

#### **דוגמה:**
```javascript
async function getHolidays(year) {
    const url = `https://www.hebcal.com/hebcal?v=1&cfg=json&year=${year}&maj=on&min=on&mod=off&nx=off&i=on&s=on`;
    const response = await fetch(url);
    const data = await response.json();

    return data.items.map(item => ({
        name: item.hebrew,
        start: new Date(item.date),
        end: new Date(item.date)
    }));
}
```

**יתרונות:**
- ✅ תמיד מעודכן
- ✅ לא צריך לשמור נתונים מקומיים

**חסרונות:**
- ❌ תלות באינטרנט
- ❌ איטי יותר
- ❌ עלול להיכשל אם ה-API נופל

---

## 🎯 **המלצה: שימוש ב-Hebcal**

**הפתרון המומלץ הוא אופציה 1 - Hebcal**, כי:
- ✅ **דיוק מושלם** - ללא טעויות אנושיות
- ✅ **חד פעמי** - מתקינים ונשכחים
- ✅ **תחזוקה 0** - לא צריך לעדכן כל שנה
- ✅ **תומך בכל החגים** - כולל אלה שפספסנו

---

## 📝 **יישום Hebcal במערכת**

### **שלב 1: התקנה**
```bash
cd /path/to/law-office-system
npm install @hebcal/core
```

### **שלב 2: עדכון work-hours-calculator.js**

```javascript
import { HebrewCalendar, HolidayEvent } from '@hebcal/core';

class WorkHoursCalculator {
    constructor(dailyHoursTarget = null) {
        this.DAILY_HOURS_TARGET = dailyHoursTarget || 8.45;
        this.MONTHLY_HOURS_TARGET = 186;

        // ✅ חישוב חגים ל-20 שנה קדימה
        this.allHolidays = this.generateHolidays(2024, 2045);
    }

    /**
     * יצירת רשימת חגים ל-20 שנה
     */
    generateHolidays(startYear, endYear) {
        const holidays = [];

        for (let year = startYear; year <= endYear; year++) {
            const options = {
                year: year,
                isHebrewYear: false,
                candlelighting: false,
                location: { cc: 'IL' },
                il: true
            };

            const events = HebrewCalendar.calendar(options);

            for (const ev of events) {
                if (ev instanceof HolidayEvent) {
                    const gregDate = ev.getDate().greg();
                    holidays.push({
                        name: ev.getDesc('he'),
                        start: gregDate,
                        end: gregDate
                    });
                }
            }
        }

        return holidays;
    }
}
```

---

## 🧪 **בדיקה**

אחרי היישום, בדוק שהמערכת עובדת נכון:

```javascript
const calculator = new WorkHoursCalculator();

// בדיקה לשנת 2045
const quota2045 = calculator.getMonthlyQuota(2045, 8); // ספטמבר 2045
console.log(quota2045);

// בדוק שחגים מחושבים נכון
const isRoshHashana = calculator.isHoliday(new Date(2045, 8, 15));
console.log('Is Rosh Hashana:', isRoshHashana); // צריך להיות true
```

---

## 📊 **השוואת הפתרונות**

| קריטריון | Hebcal | ידני | API |
|-----------|--------|------|-----|
| דיוק | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| קלות יישום | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| תחזוקה | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐ |
| ביצועים | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| אמינות | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |

---

## 🚀 **סיכום**

1. **כרגע:** המערכת עובדת עד 2026
2. **מומלץ:** להשתמש ב-Hebcal ל-20 שנה קדימה
3. **חלופה:** הוספה ידנית (מייגע)
4. **לא מומלץ:** API (תלות באינטרנט)

---

**נוצר:** 2025-01-19
**עדכון אחרון:** 2025-01-19
**גרסה:** 1.0.0