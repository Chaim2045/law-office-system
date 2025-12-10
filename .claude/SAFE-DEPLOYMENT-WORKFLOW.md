# 🛡️ תהליך עבודה בטוח - מערכת בפרודקשן עם משתמשים

> **⚠️ קריטי**: המערכת בשימוש אקטיבי - משתמשים אמיתיים עובדים עם הממשק!
> כל שינוי ל-`main` מתפרס **מיד** ל-Production.

## 📋 תוכן עניינים
1. [תהליך העבודה היומיומי](#תהליך-העבודה-היומיומי)
2. [שכבות ההגנה שהוקמו](#שכבות-ההגנה)
3. [מבנה Branches](#מבנה-branches)
4. [תרחישים נפוצים](#תרחישים-נפוצים)
5. [מה לעשות אם משהו נשבר](#מה-לעשות-בחירום)

---

## 🚀 תהליך העבודה היומיומי

### ✅ הדרך הנכונה (בטוחה):

```bash
# 1. צור branch חדש לתכונה/תיקון
git checkout -b feature/my-new-feature

# 2. עבוד על הקוד
# ... עריכות ...

# 3. Commit השינויים
git add .
git commit -m "הוספתי תכונה חדשה"

# 4. Push ל-feature branch
git push origin feature/my-new-feature
# ↑ זה יוצר Deploy Preview ב-Netlify - לבדיקה בטוחה!

# 5. בדוק את ה-Deploy Preview
# Netlify ישלח לך לינק - בדוק שהכל עובד

# 6. אם הכל טוב - מזג ל-main
git checkout main
git pull origin main
git merge feature/my-new-feature

# 7. Push ל-main (עם בדיקות!)
git push origin main
# ↑ Pre-push hook יבדוק TypeScript לפני!
# ↑ Netlify יבדוק שהכל עובד לפני deploy!
```

---

### ❌ מה לא לעשות:

```bash
# ❌ אל תעבוד ישירות על main!
git checkout main
# עריכות...
git push origin main  # סכנה! ישר ל-production

# ❌ אל תדלג על הבדיקות!
git push --no-verify  # מסוכן! דילוג על Pre-push hook

# ❌ אל תמזג בלי לבדוק!
git merge feature/something  # בלי לבדוק Deploy Preview קודם
```

---

## 🛡️ שכבות ההגנה שהוקמו

### שכבה 1: Pre-Push Hook (מקומי)
**מיקום**: `.husky/pre-push`

```
Push ל-main →
  1. TypeScript Type Check ✓
  2. TypeScript Compilation ✓
  3. אם עובר → ממשיך
  4. אם נכשל → חסימה!
```

**לדלג במקרה חירום:**
```bash
git push --no-verify  # רק במקרה חירום!
```

### שכבה 2: Netlify Build Checks
**מיקום**: `netlify.toml`

```toml
[build]
  # Push ל-main רץ:
  command = "npm run type-check && npm run compile-ts"
  # אם נכשל → Deploy נעצר!
```

**תוצאה:**
- ✅ אם הכל תקין → Deploy מצליח
- ❌ אם יש שגיאות → Deploy נכשל, Production לא נפגע!

### שכבה 3: Branch-Based Deploys
**ענפים שונים = סביבות שונות:**

| Branch | סביבה | URL | בדיקות |
|--------|-------|-----|---------|
| `main` | Production (LIVE!) | `gh-law-office-system.netlify.app` | מלאות ✓ |
| `develop` | Staging | `develop--gh-law-office...` | קלות |
| `feature/*` | Deploy Preview | `feature-x--gh-law-office...` | מינימום |

### שכבה 4: GitHub Actions
**מיקום**: `.github/workflows/ci-cd-production.yml`

```
Push → GitHub Actions:
  ✓ Code Quality
  ✓ TypeScript
  ✓ Security Audit
  ✓ Tests
  ✓ E2E Tests
  ✓ Deploy Firebase
```

---

## 🌳 מבנה Branches

```
main (PRODUCTION - LIVE!)
  ↑
  └── develop (Staging - בדיקות)
       ↑
       ├── feature/new-feature-1
       ├── feature/bug-fix-2
       └── feature/improvement-3
```

### Branch: main
- **מטרה**: Production בלבד
- **גישה**: רק דרך merge מבוקר
- **בדיקות**: מקסימליות
- **Deploy**: אוטומטי ל-Production

### Branch: develop
- **מטרה**: Staging לבדיקות
- **גישה**: Feature branches ממוזגים לכאן
- **בדיקות**: בינוניות
- **Deploy**: אוטומטי ל-Staging URL

### Branches: feature/*
- **מטרה**: פיתוח תכונות בודדות
- **גישה**: חופשית
- **בדיקות**: מינימום
- **Deploy**: Deploy Preview לבדיקה

---

## 🎯 תרחישים נפוצים

### תרחיש 1: תיקון קטן ודחוף

```bash
# אפילו תיקון קטן - עבוד על branch!
git checkout -b hotfix/urgent-fix

# תקן את הבעיה
# ...

# Commit ו-Push
git add .
git commit -m "תיקון דחוף: ..."
git push origin hotfix/urgent-fix

# בדוק ב-Deploy Preview שהתיקון עובד

# מזג ישירות ל-main (אם דחוף)
git checkout main
git merge hotfix/urgent-fix
git push origin main  # Pre-push hook יבדוק!
```

### תרחיש 2: תכונה חדשה גדולה

```bash
# צור feature branch
git checkout -b feature/big-new-feature

# עבוד מספר ימים...
git add .
git commit -m "WIP: חלק ראשון"
git push origin feature/big-new-feature

# המשך עבודה...
git commit -m "WIP: חלק שני"
git push origin feature/big-new-feature

# כשמוכן - מזג ל-develop לבדיקה
git checkout develop
git merge feature/big-new-feature
git push origin develop

# בדוק ב-Staging URL

# אם הכל טוב - מזג ל-main
git checkout main
git merge develop
git push origin main
```

### תרחיש 3: ניסוי/בדיקה

```bash
# צור branch לניסוי
git checkout -b experiment/trying-something

# נסה שינויים...
git commit -m "ניסוי..."
git push origin experiment/trying-something

# בדוק ב-Deploy Preview

# אם לא עובד - פשוט מחק את ה-branch
git checkout main
git branch -D experiment/trying-something
git push origin --delete experiment/trying-something

# אם עובד - מזג כרגיל
```

---

## 🚨 מה לעשות בחירום

### חירום: קוד שבור עלה ל-Production!

#### אפשרות 1: Rollback מהיר (מומלץ)
```bash
# 1. מצא את ה-commit האחרון שעבד
git log --oneline -10

# 2. חזור לcommit תקין
git revert <commit-hash>

# 3. Push מיד!
git push origin main
# זה יפרוס את הגרסה התקינה תוך דקות
```

#### אפשרות 2: Netlify Rollback
```bash
# דרך CLI
netlify rollback

# או דרך Dashboard:
# Netlify → Deploys → בחר deploy תקין → Publish
```

### חירום: צריך לדלג על בדיקות
```bash
# דלג על Pre-push hook (רק במקרה חירום!)
git push --no-verify origin main

# זהירות: Netlify build checks עדיין ירוצו!
```

### חירום: Deploy תקוע
```bash
# ביטול deploy ב-Netlify
netlify api cancelSiteDeploy --site-id=YOUR_SITE_ID --deploy-id=DEPLOY_ID

# או ב-Dashboard:
# Netlify → Deploys → Stop auto publishing
```

---

## 📊 מעקב אחר Deploys

### Netlify Logs
```bash
# צפייה ב-deploy logs
netlify watch

# סטטוס האתר
netlify status

# רשימת deploys אחרונים
netlify api listSiteDeploys --site-id=YOUR_SITE_ID
```

### GitHub Actions
- לך ל-: https://github.com/Chaim2045/law-office-system/actions
- בדוק את ה-workflow האחרון
- אם נכשל - לחץ לראות logs

---

## ⚙️ הגדרות נוספות מומלצות

### GitHub Branch Protection (אופציונלי אבל מומלץ!)

1. לך ל-: `Settings → Branches → Add rule`
2. Branch name pattern: `main`
3. סמן:
   - ☑️ Require pull request reviews before merging
   - ☑️ Require status checks to pass
   - ☑️ Require branches to be up to date

### Netlify Deploy Notifications

1. לך ל-: `Netlify → Site settings → Build & deploy → Deploy notifications`
2. הוסף:
   - Email notification on deploy failed
   - Slack webhook (אופציונלי)

---

## 🎓 טיפים וטריקים

### טיפ 1: בדיקה מקומית לפני Push
```bash
# רוץ את הבדיקות ידנית לפני push
npm run type-check && npm run compile-ts

# אם עובר - בטוח ל-push
git push origin main
```

### טיפ 2: צפייה ב-Deploy Preview לפני Merge
```bash
# לאחר push של feature branch
git push origin feature/my-feature

# Netlify יגיב עם:
# ✓ Deploy preview: https://feature-my-feature--gh-law-office...
# ↑ בדוק את הלינק הזה לפני merge!
```

### טיפ 3: עבודה מקבילה על כמה תכונות
```bash
# תכונה 1
git checkout -b feature/feature-1
# ... עבודה
git push origin feature/feature-1

# תכונה 2 (מ-main חדש)
git checkout main
git checkout -b feature/feature-2
# ... עבודה
git push origin feature/feature-2

# כל אחת תקבל Deploy Preview משלה!
```

---

## ✅ Checklist לפני Production Push

לפני `git push origin main`, תוודא:

- [ ] הרצתי בדיקות מקומיות (`npm run type-check`)
- [ ] הקוד עבד ב-Deploy Preview / Staging
- [ ] בדקתי בדפדפן שהשינויים עובדים
- [ ] אין שגיאות ב-Console
- [ ] התיעוד מעודכן (אם רלוונטי)
- [ ] הודעת Commit ברורה ומתארת
- [ ] אין קוד debug (console.log וכו')
- [ ] אין TODO שלא גמורים באמצע פונקציות

---

## 📚 קישורים שימושיים

- **Production Site**: https://gh-law-office-system.netlify.app
- **Admin Panel**: https://admin-gh-law-office-system.netlify.app
- **Netlify Dashboard**: https://app.netlify.com/sites/gh-law-office-system
- **GitHub Actions**: https://github.com/Chaim2045/law-office-system/actions
- **Firebase Console**: https://console.firebase.google.com/project/law-office-system-e4801

---

## 🆘 קיבלת שגיאה?

### "TypeScript check failed"
```bash
# הצג שגיאות מפורטות
npm run type-check

# תקן ו-נסה שוב
```

### "Build failed on Netlify"
```bash
# צפה ב-logs ב-Netlify Dashboard
netlify open

# או ב-CLI
netlify watch
```

### "Pre-push hook blocked push"
```bash
# בדוק מה נכשל
npm run type-check
npm run compile-ts

# תקן את השגיאות
# אם באמת דחוף ואין ברירה:
git push --no-verify origin main  # זהירות!
```

---

**💡 זכור**: עדיף להיות איטי וזהיר מאשר מהיר ושובר משהו למשתמשים!

**🎯 מטרה**:
- ✅ משתמשים רואים רק קוד שעובד
- ✅ אתה יכול לפתח בחופשיות על branches
- ✅ Production תמיד יציב
