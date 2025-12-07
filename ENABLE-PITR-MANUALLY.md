# 🔧 הפעלת PITR ידנית - פתרון לשגיאת XHR

## ⚠️ השגיאה שקיבלת:
```
RPC failed due to xhr error
Error code: 6
```

זה אומר שה-API לא מופעל בפרויקט.

---

## 🎯 פתרון - הפעל את ה-APIs הנדרשים:

### שלב 1: לך ל-Google Cloud Console

1. **פתח:** https://console.cloud.google.com/apis/library?project=law-office-system-e4801

2. **חפש:** `Firestore API`

3. **לחץ על:** "Firestore API" (הראשון בתוצאות)

4. **לחץ על:** "Enable" (אם זה לא מופעל)

---

### שלב 2: הפעל Cloud Firestore Admin API

1. **חזור ל:** https://console.cloud.google.com/apis/library?project=law-office-system-e4801

2. **חפש:** `Cloud Firestore Admin API`

3. **לחץ עליו**

4. **לחץ:** "Enable"

---

### שלב 3: חזור ל-Firebase Console

1. **לך ל:** https://console.firebase.google.com/project/law-office-system-e4801/firestore/databases/-default-/disaster-recovery

2. **נסה שוב ללחוץ על:** "Enable point-in-time recovery"

3. **אמור לעבוד עכשיו!** ✅

---

## 🔍 אם עדיין לא עובד - בדוק הרשאות:

### בדוק שיש לך הרשאות Owner:

1. **לך ל:** https://console.cloud.google.com/iam-admin/iam?project=law-office-system-e4801

2. **מצא את האימייל שלך** בטבלה

3. **ודא שהתפקיד הוא:** `Owner` או `Editor`

אם אתה **Viewer** - תבקש מהבעלים של הפרויקט לשנות לך הרשאות.

---

## 📞 עזרה נוספת:

אם כלום לא עובד, תגיד לי:
1. מה קורה כשאתה מנסה להפעיל PITR?
2. מה ההודעה שאתה מקבל?
3. האם אתה רואה "Enable" או משהו אחר?

---

## 💡 פתרון זמני - Export ידני:

בינתיים, תוכל לעשות export ידני:

1. **לך ל:** https://console.firebase.google.com/project/law-office-system-e4801/firestore/databases/-default-/disaster-recovery

2. **גלול למטה ל:** "Imports and exports"

3. **לחץ:** "Export" (יפתח Cloud Shell)

4. **הרץ את הפקודה שמופיעה**

זה יצור לך גיבוי חד-פעמי.

---

## ✅ סיכום מהיר:

```
בעיה: API לא מופעל
  ↓
פתרון: הפעל Firestore Admin API
  ↓
איך: Google Cloud Console → APIs → Enable
  ↓
אחרי: חזור ל-Firebase ונסה שוב
```

**בהצלחה!** 🚀
