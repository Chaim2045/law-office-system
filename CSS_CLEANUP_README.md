# 🧹 הנחיות ניקיון CSS - קרא אותי תמיד!

## 📢 חשוב! לכל מי שנוגע ב-style.css

### 🎯 הכלל הזהבי:

**כל שינוי ב-CSS = הזדמנות לניקיון!**

---

## ✅ תהליך עבודה (5 צעדים)

### 1️⃣ **לפני שאתה מתחיל**
```bash
# חפש TODO tags באזור שבו אתה עובד
grep -A 5 "TODO: CLEANUP" style.css | head -20
```

### 2️⃣ **עשה את השינוי שלך**
- הוסף פיצ'ר חדש
- תקן באג
- שנה עיצוב

### 3️⃣ **נקה כפילויות באזור**
אם מצאת `/* TODO: CLEANUP */` באזור - **מחק אותו!**

**איך למחוק בטוח**:
```bash
# 1. צור גיבוי
cp style.css style.css.backup-$(date +%s)

# 2. מחק את הכפילות
# 3. בדוק שהכל עובד
# 4. עדכן את CSS_CLEANUP_GUIDE.md
```

### 4️⃣ **סמן מה מחקת**
פתח את [CSS_CLEANUP_GUIDE.md](CSS_CLEANUP_GUIDE.md) וסמן ✅:
```markdown
- [x] שורה XXX - נמחק ב-DD.MM.YYYY
```

### 5️⃣ **בדוק שהכל עובד**
- פתח את הדף בדפדפן
- בדוק את האזור ששינית
- ודא שהעיצוב תקין

---

## 📚 משאבים

- **[CSS_CLEANUP_GUIDE.md](CSS_CLEANUP_GUIDE.md)** - רשימה מלאה של כפילויות
- **[css-simple-cleanup.js](css-simple-cleanup.js)** - סקריפט לניתוח כפילויות

---

## 🎯 מטרה

**273 כפילויות** → **0 כפילויות**

**התקדמות נוכחית**: █░░░░░░░░░ 2/273 (0.7%)

---

## 💡 טיפים

### איך לזהות כפילות מהר?
```bash
# מצא כמה פעמים selector מופיע
grep -c ".timesheet-card {" style.css

# מצא את כל המיקומים
grep -n ".timesheet-card {" style.css
```

### איך למזג media queries?
1. מצא את כל ה-instances:
   ```bash
   grep -n "@media (max-width: 768px)" style.css
   ```
2. העתק את התוכן של כולם
3. מזג ל-instance אחד (שמור את ה-MAIN)
4. מחק את השאר

---

## ⚠️ מה לא למחוק

- ❌ Keyframes/animations
- ❌ CSS variables (`:root`)
- ❌ Print styles (אלא אם כן זה כפילות)
- ❌ Vendor prefixes (`-webkit-`, `-moz-`)

---

## 📞 שאלות?

אם אתה לא בטוח - **אל תמחק!**

סמן כ-`/* TODO: VERIFY */` ותבדוק מאוחר יותר.

---

**עדכון אחרון**: 28.10.2025
**יוצר**: Claude Code 🤖
