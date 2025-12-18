# 🛡️ הגדרת Branch Protection ב-GitHub

## מטרה
למנוע push ישיר ל-`production-stable` ולאכוף merge רק דרך Pull Request.

---

## 📋 שלבים להגדרה

### שלב 1: כניסה להגדרות הריפוזיטורי
1. פתח את הריפוזיטורי ב-GitHub: https://github.com/Chaim2045/law-office-system
2. לחץ על **Settings** (הגדרות) בתפריט העליון
3. בתפריט הצד, לחץ על **Branches** (תחת Code and automation)

### שלב 2: הוספת Branch Protection Rule
1. לחץ על **Add branch protection rule** (או **Add rule**)
2. ב-**Branch name pattern**, כתוב: `production-stable`

### שלב 3: הגדרת חוקי ההגנה (סמן את האפשרויות הבאות)

#### ✅ חובה (MUST):
- [x] **Require a pull request before merging**
  - זה מאלץ כל שינוי לעבור דרך PR
  - תת-אפשרות: **Require approvals** (אופציונלי - אם יש לך reviewer נוסף)

- [x] **Do not allow bypassing the above settings**
  - מונע bypass של החוקים, גם למנהל הריפוזיטורי

#### 🔒 מומלץ מאוד (RECOMMENDED):
- [x] **Require status checks to pass before merging**
  - אם יש לך CI/CD checks (GitHub Actions)

- [x] **Require branches to be up to date before merging**
  - מבטיח שה-branch מעודכן לפני merge

- [x] **Include administrators**
  - החוקים חלים גם עליך! (מומלץ לבטיחות)

#### 📝 אופציונלי (OPTIONAL):
- [ ] **Require linear history**
  - אוכף היסטוריה לינארית (ללא merge commits מורכבים)

- [ ] **Require deployments to succeed before merging**
  - אם יש deployment previews

### שלב 4: שמירה
1. גלול למטה
2. לחץ על **Create** (או **Save changes**)

---

## ✅ התוצאה

לאחר ההגדרה:

### ❌ לא ניתן יותר:
```bash
git checkout production-stable
git commit -m "something"
git push origin production-stable
```
**תקבל שגיאה:** `remote: error: GH006: Protected branch update failed`

### ✅ הדרך הנכונה:
```bash
# 1. עבוד על main
git checkout main
git add .
git commit -m "feature X"
git push origin main

# 2. פתח Pull Request ב-GitHub:
# https://github.com/Chaim2045/law-office-system/compare/production-stable...main

# 3. בדוק את השינויים ב-PR
# 4. לחץ "Merge pull request" רק אחרי שאתה מאשר!
```

---

## 🧪 בדיקה

אחרי ההגדרה, נסה:
```bash
git checkout production-stable
echo "test" > test-protection.txt
git add test-protection.txt
git commit -m "test protection"
git push origin production-stable
```

**צפוי:** שגיאה מ-GitHub - "Protected branch update failed"

---

## 💡 יתרונות

1. **אכיפה טכנית** - לא רק הנחיות, אלא חסימה אמיתית
2. **Pull Request workflow** - תמיד תראה diff לפני merge
3. **אבטחה כפולה** - גם קלוד לא יוכל לעשות push ישיר
4. **היסטוריה נקייה** - כל שינוי ב-production מתועד ב-PR

---

## 🔧 שילוב עם המערכת הקיימת

הגנת GitHub תעבוד **ביחד** עם:
- ✅ systemPrompt של קלוד (שכבה ראשונה)
- ✅ Git hooks (בדיקות לפני push)
- ✅ Branch Protection (חסימה אמיתית)

**שכבות הגנה:**
```
המשתמש/קלוד
    ↓
systemPrompt (אזהרה)
    ↓
Git Hooks (בדיקות local)
    ↓
GitHub Branch Protection (חסימה בשרת)
    ↓
❌ אי אפשר לעשות push ל-production-stable!
```

---

## 📞 צריך עזרה?

אם נתקעת בהגדרה:
1. צלם screenshot של המסך
2. שלח לי ואני אעזור

קישור להגדרות: https://github.com/Chaim2045/law-office-system/settings/branches
