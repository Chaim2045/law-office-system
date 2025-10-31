# Case Creation Module

> מודול מודרני ליצירת תיקים חדשים במערכת

## קבצים במודול

```
js/modules/case-creation/
├── README.md                     (המסמך הזה)
├── case-number-generator.js      מחולל מספרי תיק חכם
├── case-form-validator.js        ולידציה מרכזית
└── case-creation-dialog.js       הדיאלוג המרכזי
```

## הוספה ל-HTML

```html
<!-- במקום js/cases.js הישן, טען את המודול החדש -->
<script src="js/modules/case-creation/case-number-generator.js"></script>
<script src="js/modules/case-creation/case-form-validator.js"></script>
<script src="js/modules/case-creation/case-creation-dialog.js"></script>
```

## שימוש

### פתיחת דיאלוג יצירת תיק

```javascript
// פשוט!
const dialog = new CaseCreationDialog();
dialog.open();
```

### האזנה לאירועים

```javascript
// כשתיק נוצר
EventBus.on('case:created', (data) => {
  console.log('נוצר תיק חדש:', data.caseNumber);
  console.log('לקוח:', data.clientName);

  // רענן טבלה, עדכן UI וכו'
  refreshCasesTable();
});
```

## תלויות

המודול דורש:
- ✅ `client-case-selector.js` - לבחירת לקוח קיים
- ✅ `event-bus.js` - לאירועים
- ✅ Firebase Firestore
- ✅ `Logger` (global)
- ✅ `NotificationSystem` (global, אופציונלי)

## API

### CaseNumberGenerator

```javascript
// קבלת מספר תיק הבא
const nextNumber = window.CaseNumberGenerator.getNextCaseNumber();

// רזרבציה של מספר (למניעת כפילויות)
const reserved = window.CaseNumberGenerator.reserveNextNumber();

// בדיקה אם מספר תקין
const isValid = window.CaseNumberGenerator.isValidCaseNumber('24001');

// בדיקה אם מספר קיים
const exists = await window.CaseNumberGenerator.caseNumberExists('24001');

// רענון ידני
await window.CaseNumberGenerator.refresh();
```

### CaseFormValidator

```javascript
// ולידציה מלאה של טופס
const validation = CaseFormValidator.validateCaseForm(formData);

// תוצאה:
{
  isValid: boolean,
  errors: string[],
  warnings: string[]
}

// ולידציה של שדה בודד
const fieldValidation = CaseFormValidator.validateField('שם לקוח', value, {
  required: true,
  minLength: 2,
  maxLength: 100
});

// הצגת שגיאות למשתמש
CaseFormValidator.displayErrors(errors);
CaseFormValidator.displayWarnings(warnings);
```

### CaseCreationDialog

```javascript
const dialog = new CaseCreationDialog();

// פתיחה
await dialog.open();

// סגירה
dialog.close();
```

## תכונות

### ✅ בחירת לקוח
- **לקוח חדש** - מילוי שם, טלפון, אימייל
- **לקוח קיים** - שימוש ב-ClientCaseSelector

### ✅ מספר תיק אוטומטי
- נטען מיידית מה-cache
- real-time updates
- אפס Firebase reads

### ✅ סוגי הליכים
- **שעות** - תוכנית שעות פשוטה
- **הליך משפטי** - 3 שלבים עם תמחור שעתי/פיקס

### ✅ ולידציה חכמה
- בדיקות בזמן אמת
- הודעות שגיאה ברורות
- אזהרות למידע חסר

### ✅ UX מודרני
- אנימציות חלקות
- feedback ויזואלי
- responsive design

## יתרונות לעומת הדיאלוג הישן

| תכונה | ישן | חדש |
|-------|-----|-----|
| ביצועים | ❌ שליפת כל הלקוחות מ-Firebase | ✅ cache חכם |
| קוד | ❌ מונוליתי (2,300 שורות) | ✅ מודולרי (3 קבצים) |
| תחזוקה | ❌ קשה | ✅ קלה |
| ולידציה | ❌ בסיסית | ✅ מקיפה |
| UX | ⚠️ טובה | ✅ מצוינת |
| EventBus | ❌ לא | ✅ כן |

## החלפת הדיאלוג הישן

### שלב 1: הוסף את המודול החדש ל-HTML

```html
<!-- מיד אחרי client-case-selector.js -->
<script src="js/modules/case-creation/case-number-generator.js"></script>
<script src="js/modules/case-creation/case-form-validator.js"></script>
<script src="js/modules/case-creation/case-creation-dialog.js"></script>
```

### שלב 2: החלף את הקריאה

```javascript
// ❌ ישן
casesManager.showCreateCaseDialog();

// ✅ חדש
const dialog = new CaseCreationDialog();
dialog.open();
```

### שלב 3: עדכן Event Listeners

```javascript
// ❌ ישן
// אין אירועים

// ✅ חדש
EventBus.on('case:created', (data) => {
  // רענן נתונים
  manager.loadClients();
});
```

### שלב 4: הסר את הדיאלוג הישן

```html
<!-- הסר או הוסף comment -->
<!-- <script src="js/cases.js"></script> -->
```

## בדיקות

### בדיקה ידנית

1. פתח את הדיאלוג
2. נסה ליצור לקוח חדש
3. נסה לבחור לקוח קיים
4. בדוק ולידציה - השאר שדות ריקים
5. בדוק שמירה תקינה
6. בדוק שמספר תיק מתקדם

### בדיקות אוטומטיות (עתידי)

```javascript
describe('CaseCreationDialog', () => {
  it('should open dialog successfully', async () => {
    const dialog = new CaseCreationDialog();
    await dialog.open();
    expect(document.getElementById('modernCaseDialog')).toBeTruthy();
  });

  it('should validate form correctly', () => {
    const formData = { /* ... */ };
    const validation = CaseFormValidator.validateCaseForm(formData);
    expect(validation.isValid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });
});
```

## תיעוד נוסף

ראה: `docs/CLIENT_CASE_DIALOG_ARCHITECTURE.md`

## רישיון

חלק ממערכת משרד עורכי הדין
