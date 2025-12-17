# 🚨 קריטי - קרא לפני כל פעולה! 🚨

## מבנה Branches - חובה לדעת!

הפרויקט הזה עובד עם **שתי סביבות נפרדות**:

### 🟡 main - סביבת פיתוח (כאן אתה עובד!)
- **זה ה-branch שאתה עובד עליו תמיד!**
- כל commit ו-push ל-`main` הם **בטוחים**
- זה עולה רק ל-preview: https://main--gh-law-office-system.netlify.app
- **המשתמשים האמיתיים לא רואים את זה!**

### 🔴 production-stable - סביבת ייצור (אסור לגעת!)
- **אסור לעשות push ישיר לכאן!**
- רק דרך merge מ-`main` ורק לפי בקשה מפורשת מהמשתמש
- זה האתר החי: https://gh-law-office-system.netlify.app
- **המשתמשים האמיתיים רואים את זה!**

---

## ✅ כללי עבודה - חובה!

### כל פעם שאתה עובד:
1. ✅ **תמיד עבוד על `main`** - זה בטוח!
2. ✅ עשה commit ו-push ל-`main` כרגיל
3. ❌ **לעולם אל תעשה checkout ל-`production-stable`** אלא אם המשתמש ביקש במפורש!

### רק כשהמשתמש אומר במפורש:
- "תעלה לייצור" / "תעלה ל-production" / "תעשה deploy למשתמשים"

**רק אז** תעשה:
```bash
git checkout production-stable
git merge main
git push origin production-stable
git checkout main  # חזור ל-main מיד!
```

---

## 🎯 דוגמאות

### ✅ תרחיש נכון:
```
משתמש: "תוסיף כפתור חדש"
אתה: עובד על main → commit → push
      ✅ עלה רק ל-preview
```

### ❌ תרחיש שגוי:
```
משתמש: "תוסיף כפתור חדש"
אתה: עובד על production-stable → commit → push
      ❌❌❌ עלה למשתמשים בלי אישור!
```

---

## 📚 מדריך מלא

קרא את [DEPLOYMENT-WORKFLOW.md](../DEPLOYMENT-WORKFLOW.md) לפרטים נוספים.

---

## ⚠️ אם יש ספק

**אם אתה לא בטוח על איזה branch אתה:**
```bash
git branch  # בדוק שאתה על main
```

**אם אתה לא בטוח אם לעלות לייצור:**
- שאל את המשתמש!
- אל תניח שהוא רוצה להעלות לייצור!
- ה-default הוא **לעולם לא** לעלות לייצור אלא אם נאמר מפורשות!
