# 🔄 Legacy Code Backup

## ✅ הקוד הישן נשמר!

לפני שמחקנו או שינינו משהו, שמרנו את כל הקוד הישן בתיקייה מיוחדת.

---

## 📦 איפה הקוד הישן?

כל הקוד המקורי נשמר ב:

```
📁 legacy/add-task/
   ├── original-html.html           # HTML מקורי
   ├── original-addBudgetTask.js    # פונקציה מקורית
   ├── original-event-listener.js   # event listener מקורי
   └── NOTES.md                     # הסברים מפורטים
```

**👉 [לחץ כאן לצפייה בקוד הישן](../../legacy/add-task/)**

---

## 🎯 למה זה חשוב?

1. **בטיחות** - אם משהו לא יעבוד, אפשר לחזור
2. **השוואה** - אפשר לראות מה השתנה
3. **למידה** - אפשר ללמוד מהקוד הישן
4. **ביטחון** - אף דבר לא אבד!

---

## 🔍 מה שונה?

ראה את המסמך המפורט:

**👉 [legacy/add-task/NOTES.md](../../legacy/add-task/NOTES.md)**

סיכום קצר:

| היבט | ישן | חדש |
|------|-----|-----|
| HTML | inline ב-index.html | `AddTaskDialog.buildHTML()` |
| Logic | פונקציה ענקית | מפוצל ל-6 קבצים |
| Validation | inline | `TaskFormValidator.js` |
| ניהול טופס | inline | `TaskFormManager.js` |
| בניית data | inline | `task-data-builder.js` |

---

## ⏪ איך לחזור למצב הישן?

אם צריך (בחירום בלבד!):

1. פתח את [legacy/add-task/NOTES.md](../../legacy/add-task/NOTES.md)
2. עקוב אחרי סעיף "איך לחזור למצב הישן"
3. העתק את הקוד חזרה למקומות המקוריים

**⚠️ אבל:** המערכת החדשה עובדת טוב! אין סיבה לחזור.

---

## 🗑️ מתי אפשר למחוק את ה-legacy?

**אחרי:**
- ✅ שבועיים בייצור ללא בעיות
- ✅ כל הבדיקות עברו
- ✅ יש גיבוי מלא

---

## 💡 טיפ

אם אתה עובד על פיצ'ר חדש ורוצה להשתמש באותה שיטה:

1. פתח את [.claude/CODE-REFACTORING-PROMPT.md](../../.claude/CODE-REFACTORING-PROMPT.md)
2. עקוב אחרי ההוראות
3. גם שם נשמור את הקוד הישן!

---

**נוצר:** 2025-12-07
**גרסה:** 1.0.0

**👉 [חזרה ל-README](README.md)**
