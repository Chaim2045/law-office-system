# 🚀 GitHub Actions Workflows

תיקייה זו מכילה את כל ה-CI/CD workflows של מערכת ניהול משרד עורכי הדין.

## 📁 תוכן התיקייה

### 1. `ci-cd-production.yml` - Production Deployment Pipeline
**מתי רץ**: כל push ל-`main` branch

**מה הוא עושה**:
- ✅ בדיקות איכות קוד (CSS linting, TODO count)
- ✅ TypeScript type checking & compilation
- ✅ Security audit (npm audit, secrets scanning)
- ✅ Automated tests (placeholder - להוסיף tests אמיתיים)
- ✅ Build verification
- 🚀 Deployment ל-Firebase Staging
- 🚀 Deployment ל-Firebase Production (אחרי staging)
- 🏥 Health check
- 📊 Notifications & summary

**זמן ריצה משוער**: 10-15 דקות

**Jobs**:
1. **code-quality** - בדיקות CSS, TODO count
2. **typescript** - type checking + compilation
3. **security** - npm audit + secrets scanning
4. **test** - הרצת בדיקות (כרגע placeholder)
5. **build** - build מלא של הפרויקט
6. **deploy-staging** - פריסה ל-staging
7. **deploy-production** - פריסה ל-production
8. **health-check** - בדיקת תקינות
9. **notify** - סיכום והתראות

---

### 2. `pull-request.yml` - Pull Request Validation
**מתי רץ**: כל Pull Request שנפתח/מעודכן כנגד `main`

**מה הוא עושה**:
- 📋 מציג מידע על ה-PR
- ✅ בדיקות איכות קוד
- ✅ TypeScript validation
- ✅ Security scanning
- ✅ Tests
- 🏗️ Build verification
- 📊 סיכום תוצאות

**שוני מ-production pipeline**: **לא עושה deployment** - רק בדיקות!

**זמן ריצה משוער**: 5-8 דקות

**Jobs**:
1. **pr-info** - מידע על ה-PR
2. **code-quality** - בדיקות קוד
3. **typescript** - type checking
4. **security** - security audit
5. **test** - הרצת tests
6. **build** - build verification
7. **pr-summary** - סיכום

---

### 3. `nightly-tests.yml` - Nightly Health Monitoring
**מתי רץ**:
- 🌙 כל לילה ב-2:00 AM (שעון ישראל)
- 📅 Schedule: `0 0 * * *` (cron)
- 🔧 ידני (workflow_dispatch)

**מה הוא עושה**:
- 🏥 בדיקת תקינות Production
- 📦 בדיקת dependency updates
- 📊 ניתוח קוד statistics
- 📘 TypeScript deep analysis
- 🏗️ Full build verification
- 📧 דו"ח סיכום

**זמן ריצה משוער**: 15-20 דקות

**Jobs**:
1. **health-check** - בדיקת site availability, SSL, performance
2. **dependency-check** - npm outdated, security audit
3. **code-metrics** - statistics, large files, git activity
4. **typescript-deep-check** - strict type checking
5. **build-verification** - full clean build
6. **nightly-report** - סיכום כל הבדיקות

---

## 🔧 הגדרת Secrets

כדי שה-workflows יעבדו, צריך להגדיר GitHub Secrets:

### Required Secrets:

1. **FIREBASE_TOKEN**
   ```bash
   firebase login:ci
   # העתק את ה-token שמתקבל
   ```

   הוספה ב-GitHub:
   - Settings → Secrets and variables → Actions → New repository secret
   - Name: `FIREBASE_TOKEN`
   - Value: ה-token מ-`firebase login:ci`

2. **FIREBASE_PROJECT_ID** (אופציונלי)
   - Name: `FIREBASE_PROJECT_ID`
   - Value: `law-office-system-e4801`

---

## 📊 מעקב אחר Workflows

### איפה לראות תוצאות:

1. **GitHub Actions Tab**:
   - לך ל-GitHub repository
   - לחץ על טאב "Actions"
   - תראה את כל ה-workflow runs

2. **Pull Request Checks**:
   - בכל PR תראה את תוצאות ה-checks מ-`pull-request.yml`
   - ✅ ירוק = הכל עבר
   - ❌ אדום = יש failures

3. **Email Notifications**:
   - GitHub שולח מייל אוטומטית אם workflow נכשל
   - אפשר להגדיר ב-Settings → Notifications

---

## 🎯 Best Practices

### ✅ DO:
- בדוק שה-PR checks עברו לפני merge
- עקוב אחרי nightly reports
- עדכן dependencies בקביעות
- הוסף tests אמיתיים (כרגע placeholders)

### ❌ DON'T:
- אל תעשה merge של PR עם failing checks
- אל תדלג על security warnings
- אל תשכח לעדכן FIREBASE_TOKEN אם פג תוקף

---

## 🚨 Troubleshooting

### Problem: Workflow נכשל על TypeScript errors
**פתרון**:
```bash
npm run type-check
npm run compile-ts
# תקן את השגיאות לפני push
```

### Problem: Security audit נכשל
**פתרון**:
```bash
npm audit
npm audit fix
# או:
npm audit fix --force  # זהירות! עשוי לשבור דברים
```

### Problem: Firebase deployment נכשל
**פתרון**:
1. בדוק ש-FIREBASE_TOKEN תקף:
   ```bash
   firebase login:ci
   # עדכן ב-GitHub Secrets
   ```

2. בדוק ש-firebase.json תקין:
   ```bash
   firebase deploy --dry-run
   ```

### Problem: Workflow רץ לאט מדי
**אפשרויות**:
- בדוק אם יש jobs שיכולים לרוץ במקביל
- הקטן את `timeout-minutes` לזיהוי בעיות מהר יותר
- בדוק אם `npm ci` משתמש ב-cache

---

## 📚 קישורים שימושיים

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Firebase CI/CD](https://firebase.google.com/docs/hosting/github-integration)
- [YAML Syntax](https://yaml.org/spec/1.2.2/)
- [Cron Schedule Expression](https://crontab.guru/)

---

## 🔄 עדכונים עתידיים

### TODO:
- [ ] הוסף tests אמיתיים (Jest/Vitest)
- [ ] הוסף E2E tests (Playwright/Cypress)
- [ ] הוסף CSS linting אמיתי (stylelint)
- [ ] הוסף ESLint לבדיקת JavaScript
- [ ] שדרג notifications (Slack/Email)
- [ ] הוסף performance monitoring
- [ ] הוסף automated rollback על failure

---

**גרסה**: 1.0.0
**תאריך**: 2025-11-03
**מחבר**: Chaim
