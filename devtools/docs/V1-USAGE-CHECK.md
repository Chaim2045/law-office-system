# בדיקת שימוש ב-createTimesheetEntry (v1)
**תאריך:** 2026-02-08
**מבוקש על ידי:** טומי

---

## תוצאות חיפוש

### Frontend (js/)

**קריאות ישירות ל-v1:**
1. ❌ אין קריאות ישירות ל-`createTimesheetEntry` (v1)
   - כל הקריאות הן ל-`createTimesheetEntryV2`

**קריאות עקיפות דרך wrapper deprecated:**

📍 **js/modules/firebase-operations.js:244**
```javascript
// Call Firebase Function for secure validation and creation
const result = await callFunction('createTimesheetEntry', entryData);
```

**הערה:** הפונקציה `saveTimesheetToFirebase` מסומנת כ-deprecated, אבל:
- היא עדיין קיימת בקוד
- היא קוראת ל-`callFunction('createTimesheetEntry', ...)`
- **זו קריאה ל-v1!**

---

## נתיב הקריאות הממשי

### נתיב 1: v2 (מומלץ) ✅
```
main.js:1573
  → createTimesheetEntryV2()
    → callFunction('createTimesheetEntry_v2', ...)
      → functions/index.js:3773 (אטומי!)
```

### נתיב 2: deprecated wrapper (v1) ⚠️
```
saveTimesheetToFirebase()  [DEPRECATED]
  → firebase-operations.js:244
    → callFunction('createTimesheetEntry', ...)
      → functions/index.js:2879 (לא אטומי!)
```

---

## האם v1 בשימוש אקטיבי?

**תשובה:** לא ישירות, אבל:

1. **הקוד הישן (deprecated) עדיין קיים:**
   - `saveTimesheetToFirebase` ב-firebase-operations.js
   - קורא ל-v1 בשורה 244

2. **Feature flag בשימוש:**
   - firebase-server-adapter.js:184-189
   - אם `FEATURE_FLAGS.USE_FUNCTIONS_FOR_TIMESHEET === false`
   - זה יכול לקרוא ל-`saveTimesheetToFirebase_ORIGINAL`
   - שקורא ל-v1

3. **Fallback mechanism:**
   - firebase-server-adapter.js:151-152
   - אם v2 נכשל → חוזר ל-v1

---

## סיכום

**קריאות ישירות ל-v1 מה-frontend:** אין

**קריאות עקיפות (deprecated/fallback):**
- js/modules/firebase-operations.js:244 (קריאה ל-`callFunction('createTimesheetEntry', ...)`)
- js/modules/firebase-server-adapter.js:144, 152 (fallback ל-v1)

**המלצה:**
1. למחוק את `saveTimesheetToFirebase` (deprecated)
2. להסיר את ה-fallback ל-v1
3. לוודא ש-`FEATURE_FLAGS.USE_FUNCTIONS_FOR_TIMESHEET` תמיד `true`

---

### master-admin-panel/

**תוצאה:** אין קבצים JS בתיקייה (התיקייה לא קיימת/ריקה)

