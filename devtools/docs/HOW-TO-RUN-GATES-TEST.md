# איך להריץ את בדיקות Gates 1, 2, 5

**תאריך:** 2026-02-05
**משך זמן:** ~2 דקות

---

## צעד 1: פתח את אפליקציית המשתמש

1. פתח דפדפן (Chrome/Edge)
2. עבור לכתובת: http://localhost:5000 (או הכתובת של User App שלך)
3. **התחבר** עם המשתמש שלך (haim@ghlawoffice.co.il)

---

## צעד 2: פתח את הקונסול

1. לחץ **F12** (או Right-click → Inspect)
2. לחץ על הטאב **Console**

---

## צעד 3: העתק והדבק את הסקריפט

1. פתח את הקובץ: `.dev/test-v2-migration-browser.js`
2. **בחר הכל** (Ctrl+A)
3. **העתק** (Ctrl+C)
4. חזור לקונסול בדפדפן
5. **הדבק** (Ctrl+V)
6. לחץ **Enter**

---

## צעד 4: חכה לתוצאות

הסקריפט ירוץ אוטומטית ויבדוק:

### Gate 1: יצירת רשומה ✅
```
=== Gate 1: Create Internal Activity ===

📝 Payload: { date: '2026-02-05', minutes: 60, ... }
⏳ Creating entry...
✅ Result: { success: true, entryId: 'xxx', version: null }
🔍 Verifying Firestore document...
📄 Firestore Document: { ... }
✅ Field Verification:
  ✅ clientId = "internal_office"
  ✅ clientName = "פעילות פנימית"
  ✅ isInternal = true
  ✅ _processedByVersion = "v2.0"
  ✅ _idempotencyKey exists
  ✅ version returned null (correct for internal)

✅ Gate 1 PASSED
```

### Gate 2: מניעת כפילויות ✅
```
=== Gate 2: Duplicate Prevention ===

📝 Using SAME idempotencyKey: timesheet_...
⏳ Attempting duplicate submission...
✅ Result: { success: true, entryId: 'xxx', version: null }
✅ Returned same entryId - idempotency working!
🔍 Verifying no duplicate documents...
📊 Documents with this idempotencyKey: 1

✅ Gate 2 PASSED - No duplicates created
```

### Gate 3: אוסף Idempotency ✅
```
=== Gate 5: Idempotency Collection ===

🔍 Checking processed_operations collection...
   Looking for key: timesheet_...
📊 Found 1 document(s) in processed_operations
📄 processed_operations Document: { ... }
✅ Field Verification:
  ✅ idempotencyKey matches
  ✅ result.success = true
  ✅ result.entryId matches
  ✅ timestamp exists

✅ Gate 5 PASSED
```

---

## צעד 5: בדוק את התוצאות

### אם הכל עבר ✅
אתה אמור לראות:
```
╔════════════════════════════════════════════════════════╗
║  ✅ ALL GATES PASSED                                   ║
╚════════════════════════════════════════════════════════╝

📋 Evidence Summary:
═══════════════════════════════════════════════════════
timesheet_entries docId:      ts_xxxxx
processed_operations docId:   ts_xxxxx
idempotencyKey:                timesheet_...
═══════════════════════════════════════════════════════
```

**זהו! המיגרציה עבדה בהצלחה!** ✅

---

### אם יש שגיאה ❌

הסקריפט יעצור ויראה:
```
❌ TEST FAILED: [תיאור השגיאה]

Stack: [מידע טכני]
```

**במקרה כזה:**
1. צלם screenshot של השגיאה
2. העתק את כל הטקסט מהקונסול
3. שלח לטומי/Claude

---

## מה עושה הסקריפט?

1. **Gate 1:** יוצר רשומת שעות פנימית חדשה
2. **Gate 2:** מנסה ליצור אותה רשומה שוב (אותו idempotencyKey)
3. בודק שהוחזר אותו `entryId` ולא נוצרה רשומה כפולה
4. **Gate 5:** בודק ש-`processed_operations` יש רשומה עם המפתח

---

## שינויים מהגרסה הקודמת

**מה תוקן:**
- ✅ הסקריפט מקבל `version: null` (זה תקין עבור פעילות פנימית)
- ✅ הוספנו בדיקה ש-`version === null` (לא אמור להיות מספר)
- ✅ הבהרנו שזה **BY DESIGN** ולא באג

**למה version הוא null:**
- פעילות פנימית לא משנה מסמך לקוח
- אין צורך ב-optimistic locking
- אין מספר גרסה לעקוב אחריו

---

## פתרון בעיות נפוצות

### "Firebase not loaded"
**פתרון:** ודא שאתה באפליקציה (לא בדף ריק)

### "FirebaseService not loaded"
**פתרון:** חכה שהאפליקציה תסיים לטעון, אז הרץ שוב

### "PERMISSION_DENIED"
**פתרון:** התחבר למערכת לפני הרצת הסקריפט

---

**סטטוס:** ✅ מוכן לשימוש

**משך זמן משוער:** 30 שניות להריץ את הסקריפט + 1 דקה לבדוק תוצאות

---

**End of Guide**
