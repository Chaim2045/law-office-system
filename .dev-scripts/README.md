# Development Scripts & Test Files

⚠️ **WARNING: These are development and debugging files - DO NOT USE IN PRODUCTION!**

## תיקיה זו מכילה:

### סקריפטי Debug (check-*.js)
- קבצים לבדיקת נתונים ב-Firestore
- בדיקות permissions ו-authentication
- **שימוש**: `node .dev-scripts/check-xxx.js`

### קבצי Test (test-*.js / test-*.html)
- קבצי HTML לבדיקות UI
- בדיקות performance ו-diagnostics
- **שימוש**: פתח ב-browser או הרץ עם node

### סקריפטי Cleanup (delete-*.js, reset-*.js)
- ⚠️ **סכנה**: קבצים אלה מוחקים נתונים!
- delete-clients-tasks-timesheet.js - מוחק נתונים מ-Firestore
- reset-xxx.js - מאפס הגדרות

## שימוש

```bash
# בדיקת נתונים
node .dev-scripts/check-client-data.js

# בדיקת permissions
node .dev-scripts/check-user-permissions.js
```

## הערות חשובות

1. **אל תריץ סקריפטי delete/reset בייצור!**
2. קבצים אלה לא חלק מה-production build
3. אם אתה צריך סקריפט חדש, הוסף אותו כאן

## History

- **2025-12-06**: הועברו כל קבצי debug/test מה-root לכאן לקראת הדרכת משתמשים
