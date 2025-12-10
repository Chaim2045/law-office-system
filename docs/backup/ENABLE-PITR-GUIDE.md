# 🔐 מדריך הפעלת PITR - צעד אחר צעד

## אתה עכשיו ב-Firebase Console - הנה מה לעשות:

### 🎯 **שלב 1: ודא שאתה בפרויקט הנכון**

בפינה השמאלית העליונה, תראה את שם הפרויקט.
צריך להיות: **"law-office-system"**

אם לא - לחץ על שם הפרויקט ובחר: **law-office-system-e4801**

---

### 🎯 **שלב 2: כנס ל-Firestore Database**

בתפריט הצדדי השמאלי, חפש:

```
🔧 Build (או "בנה")
  └─ Firestore Database
```

**לחץ על "Firestore Database"**

---

### 🎯 **שלב 3: כנס להגדרות**

אתה אמור לראות את מסך ה-Firestore.

1. **למעלה** במסך, תראה טאבים:
   - Data (נתונים)
   - Rules (כללים)
   - Indexes (אינדקסים)
   - Usage (שימוש)
   - **Settings** ⚙️ ← **לחץ כאן!**

---

### 🎯 **שלב 4: הפעל Point-in-Time Recovery**

במסך Settings, גלול למטה עד שאתה רואה:

```
📋 Point-in-time recovery (PITR)
```

אתה אמור לראה אחד מהמצבים הבאים:

#### **מצב A: PITR כבר מופעל** ✅
אם אתה רואה:
```
✓ Point-in-time recovery is enabled
Earliest recovery time: [תאריך]
```

**זהו! אתה כבר מוגן! אין צורך לעשות כלום!** 🎉

---

#### **מצב B: PITR לא מופעל** ⚠️
אם אתה רואה:
```
Point-in-time recovery: Disabled
[Enable] ← כפתור כחול
```

**לחץ על כפתור "Enable"**

תיפתח חלונית עם הסבר:

```
Enable point-in-time recovery?

This will allow you to recover your database to any
point in time within the last 7 days.

Pricing: $0.18/GiB/month for data beyond 1 GiB

[ Cancel ]  [ Enable ]
```

**לחץ על "Enable"** (הכפתור הכחול)

---

### 🎯 **שלב 5: המתן לאישור**

אחרי שלחצת "Enable", תראה:

```
⏳ Enabling point-in-time recovery...
```

זה אמור לקחת 30-60 שניות.

אחרי זה תראה:

```
✅ Point-in-time recovery is enabled!
Earliest recovery time: [התאריך של עכשיו]
```

---

### 🎉 **סיימת! אתה מוגן!**

מה יש לך עכשיו:
- ✅ הנתונים שלך מגובים כל שנייה
- ✅ יכול לשחזר לכל נקודת זמן ב-7 ימים אחרונים
- ✅ הגנה מפני מחיקה בטעות, bugs, ועובדים זדוניים

---

## ❓ אם אתה לא רואה את האפשרות "Point-in-Time Recovery"

### סיבות אפשריות:

1. **אין לך הרשאות מתאימות**
   - צריך להיות **Owner** או **Editor** בפרויקט
   - פתרון: בקש מהבעלים של הפרויקט להפעיל

2. **Firestore במצב לא נכון**
   - צריך **Native Mode** (לא Datastore Mode)
   - בדוק: במסך Settings, בחלק העליון צריך לראות "Mode: Native"

3. **PITR זמין רק ב-Firebase Paid Plan**
   - בדוק: האם אתה ב-**Blaze Plan** (Pay as you go)
   - אם אתה ב-Spark Plan (חינם), תצטרך לשדרג

---

## 💰 אם צריך לשדרג ל-Blaze Plan:

### מה זה Blaze Plan?
- Plan של **"Pay as you go"** (תשלום לפי שימוש)
- **לא צריך לשלם קבוע!** רק מה שמשתמשים
- המשרד שלך (10 משתמשים): **~$3-8/חודש**

### איך לשדרג?

1. **בתפריט העליון** → לחץ על שם הפרויקט
2. **לחץ על גלגל השיניים** ⚙️ → **Project settings**
3. **טאב "Usage and billing"**
4. **לחץ על "Modify plan"**
5. **בחר "Blaze Plan"**
6. **הזן פרטי תשלום** (כרטיס אשראי)
7. **אשר**

**חשוב:** אפשר להגדיר **Budget Alert** (התראת תקציב):
```
Settings → Budgets & Alerts → Create Budget
הגדר: $20/חודש (יותר ממספיק!)
```

גוגל ישלח לך אימייל אם עברת את התקציב.

---

## 📸 תגיד לי מה אתה רואה במסך

תאר לי מה אתה רואה:

1. ❓ אתה רואה "Point-in-Time Recovery" בהגדרות?
2. ❓ מה הסטטוס? (Enabled / Disabled / לא רואה בכלל)
3. ❓ איזה Plan יש לך? (Spark / Blaze)

ואני אדריך אותך הלאה! 🚀
