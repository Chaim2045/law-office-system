# 🤖 הצ'אטבוט המשפטי החכם

> **Smart Legal Assistant** - מערכת עזרה אינטראקטיבית למשרד עורכי הדין

---

## 📁 מבנה התיקייה

```
chatbot/
├── index.js                    # 🏠 נקודת כניסה ראשית - מחבר את כל המודולים ✅
├── data/                       # 📊 מידע וקונפיגורציה
│   └── faq-database.js        #    מאגר שאלות ותשובות מלא ✅
├── ui/                         # 💬 רכיבי ממשק משתמש
│   ├── messages.js            #    תצוגת הודעות (משתמש + בוט) ✅
│   └── suggestions.js         #    כפתורי הצעות מהירות ✅
├── utils/                      # 🛠️ כלי עזר
│   ├── text-processing.js     #    עיבוד טקסט עברי + Levenshtein ✅
│   └── highlighter.js         #    הדגשת אלמנטים בדף ✅
├── styles/                     # 🎨 עיצוב
│   ├── chatbot-styles.js      #    CSS עבור הבוט ✅
│   └── tour-styles.js         #    CSS עבור הסיור ✅
├── core/                       # ⚙️ לוגיקה עסקית
│   └── system-tour.js         #    סיור במערכת (onboarding) ✅
└── README.md                   # 📖 המסמך הזה

✅ = הושלם ופעיל
[TODO] = למקור: כפתורי פעולה, תשובות דינמיות (בקובץ הישן)
```

---

## 🎯 עקרונות המבנה

### 1. **הכל בתוך `chatbot/` - אסור לצאת החוצה**
- כל קוד הקשור לצ'אטבוט **חייב** להיות בתוך תיקייה זו
- אסור ליצור קבצים ב-`js/`, `css/`, או תיקיות אחרות
- אם צריך משהו חדש - ליצור תת-תיקייה בתוך `chatbot/`

### 2. **מבנה ברור ועקבי**
- **data/** - רק מידע סטטי (JSON, קונפיג, מאגרי נתונים)
- **ui/** - רק רכיבי תצוגה (DOM manipulation)
- **utils/** - פונקציות עזר כלליות ללא state
- **styles/** - רק CSS (מוזרק ל-`<style>` tags)
- **core/** - לוגיקה עסקית מרכזית, classes, מנועים

### 3. **קובץ אחד = אחריות אחת**
- כל קובץ עושה **דבר אחד בלבד**
- שם הקובץ תואם לתפקידו (לא `utils.js` אלא `text-processing.js`)
- פונקציות exported עם שמות ברורים בעברית + אנגלית

### 4. **ES6 Modules בלבד**
```javascript
// ✅ כך:
export function doSomething() { ... }
import { doSomething } from './file.js';

// ❌ לא כך:
window.myFunction = () => { ... }
var something = ...
```

---

## 📝 כללי קוד (Code Standards)

### שפה
- **קוד**: אנגלית (משתנים, פונקציות)
- **תיעוד**: עברית (הערות, README)
- **UI**: עברית (טקסטים למשתמש)

### דוגמה:
```javascript
/**
 * חישוב דמיון בין שתי מחרוזות
 * @param {string} str1 - מחרוזת ראשונה
 * @param {string} str2 - מחרוזת שנייה
 * @returns {number} - ציון דמיון 0-1
 */
export function calculateSimilarity(str1, str2) {
    // לוגיקה...
}
```

### עיצוב קוד
- **Indentation**: 4 רווחים (לא tabs)
- **Quotes**: backticks (`) לstrings ארוכים, single quotes (') לקצרים
- **Semicolons**: כן, תמיד
- **JSDoc**: תיעוד לכל פונקציה exported

---

## 🚀 איך להוסיף פיצ'ר חדש?

### תרחיש 1: הוספת שאלה ל-FAQ
**קובץ**: [`data/faq-database.js`](data/faq-database.js)

```javascript
export const faqDatabase = {
    general: [
        {
            keywords: ['מילות', 'חיפוש', 'רלוונטיות'],
            question: 'השאלה שתופיע?',
            answer: `<strong>התשובה:</strong> <p>פירוט...</p>`,
            category: 'general',
            guideType: 'action_name',  // אופציונלי
            selector: '#elementId'      // אופציונלי
        },
        // שאלות נוספות...
    ]
};
```

**⚠️ אסור:**
- לשנות מבנה קיים של שאלות
- להוסיף קטגוריות חדשות מבלי לעדכן את `index.js`
- לשים HTML לא בטוח (XSS risk)

---

### תרחיש 2: הוספת פונקציונליות UI
**קובץ חדש**: `ui/my-new-component.js`

```javascript
/**
 * תיאור הרכיב
 */

/**
 * פונקציה ראשית
 * @param {type} param - תיאור
 */
export function myFunction(param) {
    // לוגיקה...
}
```

**אז בindex.js**:
```javascript
import { myFunction } from './ui/my-new-component.js';
```

**⚠️ אסור:**
- לערבב UI logic עם business logic
- לגשת ישירות ל-DOM מתוך `core/`
- ליצור globals (`window.something`)

---

### תרחיש 3: הוספת CSS
**קובץ**: [`styles/chatbot-styles.js`](styles/chatbot-styles.js)

```javascript
export function addMyStyles() {
    const style = document.createElement('style');
    style.id = 'my-unique-id';
    style.textContent = `
        .my-class {
            color: #3b82f6;
        }
    `;
    document.head.appendChild(style);
}
```

**⚠️ אסור:**
- לשנות CSS קיים של המערכת (רק הוסיף)
- לייצר כפילויות של styles
- להשתמש ב-`!important` (חוץ מאם הכרחי)

---

## 🔧 תלויות (Dependencies)

### פנימיות (בתוך הפרויקט)
- `window.manager` - המנג'ר הראשי של המערכת
  - `manager.currentUsername` - שם המשתמש
  - `manager.budgetTasks` - משימות
  - `manager.timesheetEntries` - שעות
  - `manager.clients` - לקוחות

- `window.firebaseAuth` - אימות Firebase
  - `firebaseAuth.currentUser`

- `work-hours-calculator.js` - חישובי שעות עבודה

### חיצוניות (External)
- **אין!** הצ'אטבוט עצמאי לחלוטין
- כל ה-CSS, ה-JS, וה-HTML מוטמעים

---

## 🎨 צבעי המערכת

```css
/* כחול ראשי */
--primary-blue: #3b82f6;
--primary-blue-dark: #2563eb;

/* ירוק (success) */
--success-green: #10b981;
--success-green-dark: #059669;

/* אדום (danger) */
--danger-red: #ef4444;
--danger-red-dark: #dc2626;

/* כתום (warning) */
--warning-orange: #f59e0b;

/* אפור (neutral) */
--gray-50: #f9fafb;
--gray-200: #e5e7eb;
--gray-400: #9ca3af;
--gray-600: #4b5563;
--gray-800: #1f2937;
```

**⚠️ אסור** להשתמש בצבעים אחרים מבלי לתאם!

---

## 🧪 בדיקות לפני Commit

### Checklist:
- [ ] כל הקבצים בתוך `chatbot/`?
- [ ] ה-imports עובדים?
- [ ] אין `console.log()` מיותרים?
- [ ] יש JSDoc לכל פונקציה exported?
- [ ] הקוד בעברית + אנגלית לפי הכללים?
- [ ] ה-CSS לא משבש אלמנטים קיימים?
- [ ] בדקתי בדפדפן שהכל עובד?

### פקודות לבדיקה:
```bash
# רשימת כל הקבצים בchatbot
find chatbot -type f

# חיפוש globals (אמור להחזיר ריק)
grep -r "window\." chatbot/ --include="*.js"

# חיפוש console.log (צריך למחוק לפני ייצור)
grep -r "console.log" chatbot/ --include="*.js"
```

---

## 📚 קריאה נוספת

### מסמכים רלוונטיים:
- [הקובץ המקורי](../js/modules/smart-faq-bot.js) - 2,750 שורות (לפני הפיצול)
- [index.html](../index.html) - איך הבוט נטען
- [work-hours-calculator.js](../js/modules/work-hours-calculator.js) - תלות חיצונית

### טכנולוגיות:
- Vanilla JavaScript (ES6+)
- CSS-in-JS (ללא framework)
- Levenshtein Distance לחיפוש מטושטש
- DOM Manipulation ישיר

---

## 🐛 בעיות ידועות / TODO

- [x] **SystemTour** ✅ הועבר ל-`core/system-tour.js`
- [x] **tour-styles.js** ✅ CSS של הסיור ב-`styles/tour-styles.js`
- [ ] **תשובות דינמיות** (כמה משימות? כמה שעות?) - להעביר ל-`core/dynamic-responses.js`
- [ ] **כפתורי פעולה** - להעביר ל-`ui/action-buttons.js`
- [ ] **chat-interface.js** - לפצל את יצירת ה-HTML מ-index.js
- [ ] **אופטימיזציה** - cache של חיפושים נפוצים
- [ ] **הדרכות צעד-אחר-צעד** - step-by-step guides

---

## 🤝 תרומה לפרויקט

### כללים למפתחים (כולל AI assistants!)

1. **קרא את המסמך הזה קודם!** לא להתחיל לקודד לפני שהבנת את המבנה
2. **אל תצא מחוץ ל-`chatbot/`** - הכל פה בפנים!
3. **אל תשבור את המבנה** - אם צריך תת-תיקייה, תיצור בתוך chatbot
4. **תשאל אם לא בטוח** - עדיף לשאול מאשר לשבור
5. **כתוב קוד נקי** - JSDoc + הערות + שמות ברורים

### דוגמה לפנייה טובה:
```
"אני רוצה להוסיף פיצ'ר X לצ'אטבוט.
איפה זה שייך לפי המבנה?
האם זה ui/ או core/?"
```

### דוגמה לפנייה רעה:
```
"אני יוצר קובץ js/chatbot-new-feature.js"
❌ לא! זה מחוץ ל-chatbot/!
```

---

## 📞 צור קשר

אם יש שאלות או הצעות לשיפור המבנה:
- פתח issue בגיט
- תעדכן את README הזה
- תיצור PR עם הסבר

---

## 🏆 גרסה

**Current**: v2.0.0 (מודולרי)
**Previous**: v1.0.0 (מונוליטי - `js/modules/smart-faq-bot.js`)

**Date**: 2025-10-23
**Author**: Claude + Haim (AI Pair Programming)

---

## 📜 רישיון

חלק ממערכת ניהול משרד עורכי הדין
© כל הזכויות שמורות
