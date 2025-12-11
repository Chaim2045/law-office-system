# 🎯 Feature Request Template

העתק והדבק את זה לקלוד חדש כשרוצה לבנות feature:

---

## 📋 בקשה ל-Feature חדש

**קרא קודם:**
- `.dev-scripts/docs/ARCHITECTURE-GUIDELINES.md` - הנחיות ארכיטקטורה
- (אופציונלי) `.dev-scripts/docs/LAZY-LOADING-OPTIMIZATION-PLAN.md` - אופטימיזציית ביצועים

---

### 🎯 תיאור ה-Feature:

[תאר כאן מה אתה רוצה לבנות]

**דוגמה:**
```
אני רוצה מערכת ניהול חופשות:
- עובד יכול לבקש חופשה
- מנהל רואה את הבקשות ומאשר/דוחה
- יש לוח שנה עם החופשות המאושרות
```

---

### 👥 למי זה מיועד?

- [ ] עובדים (Employee Interface - `/`)
- [ ] מנהלים (Admin Interface - `/master-admin-panel/`)
- [ ] שניהם

---

### 🔗 תלויות:

האם ה-feature תלוי ב:
- [ ] Firebase Firestore (collection חדש/קיים?)
- [ ] Firebase Functions (backend logic?)
- [ ] Features קיימים (אילו?)
- [ ] APIs חיצוניים (אילו?)

---

### 🎨 UI/UX:

- [ ] צריך UI חדש (טפסים, טבלאות, modals?)
- [ ] צריך CSS חדש
- [ ] ניתן להשתמש ב-components קיימים

**אם יש mockup/תיאור ויזואלי:**
[הוסף כאן או תאר במילים]

---

### 📊 Data Structure:

**אם צריך Firestore collection חדש, תאר:**

```javascript
// דוגמה:
vacation_requests/ {
  userId: string,
  startDate: timestamp,
  endDate: timestamp,
  status: 'pending' | 'approved' | 'rejected',
  reason: string,
  approvedBy: string | null,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

---

### ⚡ ביצועים:

- [ ] Feature זה צריך להיות טעון מיד (critical)
- [ ] אפשר לטעון עם `defer` (רוב ה-cases)
- [ ] אפשר לטעון עם `async` (independent)
- [ ] אפשר לטעון רק כשמשתמש נכנס לעמוד מסוים (dynamic import)

---

### 🔒 אבטחה:

- [ ] צריך authentication (רק משתמש מחובר)
- [ ] צריך authorization (רק בעלים/מנהל)
- [ ] צריך validation (איזה שדות?)
- [ ] צריך Firestore Security Rules חדשים

---

### ✅ מה הצלחה נראית?

תאר מה אתה מצפה לראות:

**דוגמה:**
```
1. עובד לוחץ "בקש חופשה"
2. נפתח modal עם טופס
3. עובד ממלא תאריכים + סיבה
4. שולח
5. רואה הודעת הצלחה
6. החופשה מופיעה ברשימה עם סטטוס "ממתין לאישור"
7. מנהל רואה את הבקשה בפאנל שלו
```

---

### 🧪 איך לבדוק?

רשום צעדי בדיקה:

**דוגמה:**
```
1. התחבר כעובד
2. לחץ "בקש חופשה"
3. מלא תאריכים
4. שלח
5. ודא שהבקשה נשמרה ב-Firestore
6. התחבר כמנהל
7. ודא שהבקשה מופיעה
8. אשר את הבקשה
9. חזור לעובד - ודא שהסטטוס השתנה
```

---

### 🚨 סיכונים ידועים:

האם יש דברים שחשוב לדעת?

**דוגמה:**
```
- אם עובד מבקש חופשה למפרע (תאריך עבר) - מה קורה?
- אם שני עובדים מבקשים אותו תאריך - יש בעיה?
- מה קורה אם מנהל מוחק בקשה במקום לדחות?
```

---

## 🎯 הוראות לקלוד:

**עכשיו:**
1. קרא את `ARCHITECTURE-GUIDELINES.md`
2. הבן את הבקשה למעלה
3. צור **תוכנית מפורטת** לפני קוד:
   - Files to create
   - Files to modify
   - Firestore structure
   - Dependencies
   - UI components
   - Performance strategy
   - Security considerations
4. הצג את התוכנית ל**אישור** לפני שכותב קוד
5. רק אחרי אישור - תתחיל לכתוב

**זכור:**
- ❌ אל תוסיף dependencies חדשים בלי אישור
- ❌ אל תשנה קוד קיים אלא אם הכרחי
- ❌ אל תבנה components מאפס אם יש קיימים
- ✅ השתמש ב-patterns קיימים
- ✅ lazy-load עם `defer`/`async`
- ✅ תמיד validate input
- ✅ תיעד את הקוד

---

**בהצלחה! 🚀**
