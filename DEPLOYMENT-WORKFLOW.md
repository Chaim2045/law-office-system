# מדריך זרימת עבודה - פיתוח וייצור

## 📋 סקירה כללית

המערכת עובדת עם **שני branches נפרדים**:

### 🔴 production-stable (ייצור - משתמשים אמיתיים)
- **URL:** https://gh-law-office-system.netlify.app
- **Admin Panel:** https://admin-gh-law-office-system.netlify.app
- **תכלית:** המשתמשים האמיתיים רואים את זה
- **עדכונים:** רק אחרי בדיקה מלאה!

### 🟡 main (פיתוח וניסויים)
- **URL:** https://main--gh-law-office-system.netlify.app
- **Admin Panel:** https://main--admin-gh-law-office-system.netlify.app
- **תכלית:** לניסויים, פיתוח, בדיקות
- **עדכונים:** חופשי לשנות כל מה שרוצים!

---

## 🔄 זרימת העבודה היומיומית

### שלב 1: עבודה על main (ניסויים)
```bash
# כל העבודה קורית על main
git checkout main

# אתה או קלוד עושים שינויים...
# קלוד עושה commit ו-push...
git push origin main

# ✅ השינויים עולים אוטומטית ל:
# https://main--gh-law-office-system.netlify.app
# (רק אתה רואה את זה!)
```

**המשתמשים האמיתיים לא מושפעים בכלל!**

---

### שלב 2: בדיקה
אחרי שינויים ב-main:
1. פתח את: https://main--gh-law-office-system.netlify.app
2. בדוק שהכל עובד טוב
3. אם יש באגים - תקן אותם (עדיין על main)
4. אם הכל תקין - עבור לשלב 3

---

### שלב 3: העלאה לייצור (רק כשהכל מוכן!)

**אופציה א': ידנית (אתה שולט)**
```bash
# עבור ל-production-stable
git checkout production-stable

# משוך את השינויים מ-main
git merge main

# דחוף לייצור (יש בדיקות אוטומטיות!)
git push origin production-stable

# ✅ עכשיו המשתמשים רואים את העדכון!
# https://gh-law-office-system.netlify.app
```

**אופציה ב': דרך קלוד**
פשוט תגיד לקלוד:
> "קלוד, בדקתי הכל על main, תעלה לייצור"

קלוד יעשה את כל השלבים אוטומטית.

---

## 🛡️ הגנות אוטומטיות

### Push ל-main (פיתוח)
```
🟡 Pushing to MAIN branch (Development/Testing)
✅ This is safe - not deploying to real users
💡 Preview URL: https://main--gh-law-office-system.netlify.app
```
- בדיקות קלות
- אפשר להמשיך גם עם שגיאות

### Push ל-production-stable (ייצור)
```
🚨 WARNING: Pushing to PRODUCTION-STABLE branch!
🚨 This will deploy to LIVE site with REAL USERS!
🔍 Running mandatory checks...
```
- בדיקת TypeScript מלאה
- בדיקת קומפילציה
- אם יש שגיאה - ה-push ייכשל!

---

## 📊 דוגמה מציאותית

### יום ראשון:
```
חיים: "קלוד, תוסיף כפתור 'מחק לקוח'"
קלוד: עובד על main → commit → push
       ✅ עלה ל: https://main--gh-law-office-system.netlify.app
       ❌ המשתמשים לא רואים (עדיין ב-production-stable הישן)
```

### יום שני:
```
חיים: "קלוד, תשנה צבע הכותרת לכחול"
קלוד: עובד על main → commit → push
       ✅ עלה ל: https://main--gh-law-office-system.netlify.app
       ❌ המשתמשים עדיין לא רואים
```

### יום רביעי:
```
חיים: "קלוד, בדקתי הכל ב-main, זה מעולה! תעלה לייצור"
קלוד: git checkout production-stable
       git merge main
       git push origin production-stable
       ✅ עכשיו המשתמשים רואים את כל השינויים!
```

---

## 🔍 פקודות שימושיות

### לבדוק איזה branch אתה עליו:
```bash
git branch
```

### לראות מה ההבדל בין main ל-production-stable:
```bash
git diff production-stable main
```

### לבטל שינויים ב-main (אם משהו השתבש):
```bash
git checkout main
git reset --hard production-stable
# זה מחזיר את main להיות זהה ל-production-stable
```

### לחזור ל-main אחרי push לייצור:
```bash
git checkout main
```

---

## ⚠️ כללי בטיחות

### ✅ מותר:
- לשבור דברים ב-main כמה שרוצים
- לנסות features חדשים
- לעשות ניסויים
- קלוד יכול לעשות commit ו-push חופשי ל-main

### ❌ אסור:
- לעשות push ישיר ל-production-stable (רק דרך merge מ-main)
- לשנות קבצים ישירות על production-stable
- לדלג על בדיקה של השינויים לפני העלאה לייצור

---

## 🆘 מצבי חירום

### אם קלוד דחף משהו ל-main ושיבר הכל:
**לא נורא!** המשתמשים לא מושפעים.
פשוט תקן את זה ב-main, אל תעלה לייצור.

### אם בטעות נעשה push ל-production-stable:
```bash
# חזור לגרסה הקודמת
git checkout production-stable
git reset --hard origin/production-stable~1
git push --force origin production-stable
```
**שים לב:** זה מצב חירום! השתמש בזה רק אם באמת צריך!

---

## 📞 תמיכה

יש בעיה? שאלה?
פשוט שאל את קלוד: "קלוד, אני רוצה לעשות X, איך עושים את זה בזרימה החדשה?"
