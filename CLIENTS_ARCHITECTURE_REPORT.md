# 📋 דוח ארכיטקטורת מערכת הלקוחות

## תאריך: 16/10/2025
## מערכת: Law Office Management System

---

## 🏗️ ארכיטקטורה כללית

המערכת עובדת בשני שכבות:

```
┌─────────────────┐
│  Client Side    │  ← script.js (Frontend)
│  (Browser)      │
└────────┬────────┘
         │
         │ HTTPS Callable Functions
         ▼
┌─────────────────┐
│  Server Side    │  ← functions/index.js (Backend)
│  (Firebase)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Firestore     │  ← Database
│   Collection    │
│   'clients'     │
└─────────────────┘
```

---

## 📊 מבנה נתונים ב-Firestore

### Collection: `clients`

כל לקוח הוא **document** עם המבנה הבא:

```javascript
{
  id: "auto-generated-id",           // מזהה אוטומטי מ-Firestore
  fullName: "שם מלא",                // שדה חובה, מינימום 2 תווים
  phone: "050-1234567",               // אופציונלי, אימות לפי תקן ישראלי
  email: "email@example.com",         // אופציונלי, אימות לפי RFC
  type: "budget",                     // חובה: "budget" או "hours"
  createdBy: "חיים",                  // שם המשתמש שיצר את הלקוח
  createdAt: Timestamp,               // זמן יצירה (serverTimestamp)
  lastModifiedBy: "חיים",             // שם המשתמש שעדכן לאחרונה
  lastModifiedAt: Timestamp           // זמן עדכון אחרון (serverTimestamp)
}
```

---

## 🔐 Firebase Functions - שכבת ה-Backend

### 1️⃣ **createClient** (יצירת לקוח חדש)

**מיקום:** `functions/index.js:247-327`

**Validation (אימות):**
- ✅ `fullName` - חובה, מחרוזת, מינימום 2 תווים
- ✅ `phone` - אופציונלי, אימות לפי regex ישראלי: `/^0(5[0-9]|[2-4]|[7-9])\d{7}$/`
- ✅ `email` - אופציונלי, אימות לפי regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- ✅ `type` - חובה, רק "budget" או "hours"

**Sanitization (ניקוי):**
- מנקה HTML tags (`<`, `>`, `"`, `'`, `/`) למניעת XSS
- מסיר רווחים מיותרים (`.trim()`)

**Authorization (הרשאות):**
- ✅ משתמש מחובר (Firebase Auth)
- ✅ עובד פעיל (`isActive: true`)
- ✅ **כל עובד יכול ליצור לקוחות** (אין הגבלת admin)

**תהליך:**
```javascript
1. בדיקת הרשאות → checkUserPermissions()
2. אימות נתונים → Validation
3. ניקוי נתונים → sanitizeString()
4. שמירה ב-Firestore → db.collection('clients').add()
5. רישום ב-Audit Log → logAction('CREATE_CLIENT')
6. החזרת תוצאה → { success: true, clientId, client }
```

---

### 2️⃣ **getClients** (קריאת לקוחות)

**מיקום:** `functions/index.js:335-365`

**Authorization:**
- ✅ משתמש מחובר
- ✅ **כל עובד רואה את כל הלקוחות** (אין סינון לפי עובד)

**תהליך:**
```javascript
1. בדיקת הרשאות
2. שליפה מ-Firestore → db.collection('clients').get()
3. המרה למערך → snapshot.forEach()
4. החזרה → { success: true, clients: [...] }
```

**שימוש בקוד:**
- נקרא ב-`loadClientsFromFirebase()` - script.js:250
- נקרא גם ב-`IntegrationManager` (מנהל אינטגרציה)

---

### 3️⃣ **updateClient** (עדכון לקוח)

**מיקום:** `functions/index.js:373-465`

**Authorization:**
- ✅ משתמש מחובר
- ✅ **רק בעל הלקוח (createdBy) או admin יכולים לעדכן**

**Validation:**
- בדיקה שהלקוח קיים
- אימות שדות (אם מועברים): `fullName`, `phone`, `email`

**תהליך:**
```javascript
1. בדיקת הרשאות
2. בדיקה שהלקוח קיים
3. בדיקת הרשאה לעדכן (owner או admin)
4. אימות שדות חדשים
5. עדכון ב-Firestore → update()
6. רישום ב-Audit Log
7. החזרה → { success: true, clientId }
```

---

### 4️⃣ **deleteClient** (מחיקת לקוח)

**מיקום:** `functions/index.js:471-525`

**Authorization:**
- ✅ **רק בעל הלקוח (createdBy) או admin יכולים למחוק**

**תהליך:**
```javascript
1. בדיקת הרשאות
2. בדיקה שהלקוח קיים
3. בדיקת הרשאה למחוק (owner או admin)
4. מחיקה מ-Firestore → delete()
5. רישום ב-Audit Log → logAction('DELETE_CLIENT')
6. החזרה → { success: true, clientId }
```

---

## 💻 Frontend - קוד הלקוח (script.js)

### טעינת לקוחות (loadClientsFromFirebase)

**מיקום:** `script.js:250-267`

**תהליך:**
```javascript
async function loadClientsFromFirebase() {
  // 1. קריאה ישירה מ-Firestore (ללא Function!)
  const snapshot = await db.collection("clients").get();

  // 2. המרה למערך
  const clients = [];
  snapshot.forEach((doc) => {
    clients.push({
      id: doc.id,
      ...doc.data()
    });
  });

  return clients;
}
```

**⚠️ שים לב:**
- הקוד הזה **לא משתמש ב-Firebase Function!**
- הוא קורא **ישירות מ-Firestore**
- זה אומר ש**Firestore Security Rules** צריכות לאפשר קריאה!

---

### יצירת לקוח (saveClientToFirebase)

**מיקום:** `script.js:369-380`

**תהליך:**
```javascript
async function saveClientToFirebase(clientData) {
  // ✅ קריאה ל-Firebase Function (בטוחה!)
  const result = await callFunction('createClient', clientData);

  if (!result.success) {
    throw new Error(result.message || 'שגיאה בשמירת לקוח');
  }

  return result;
}
```

**✅ נכון:** משתמש ב-Function עם Validation

---

## 🔒 Firestore Security Rules

לפי הקוד, ה-Security Rules **חייבים** להיות:

```javascript
// clients collection
match /clients/{clientId} {
  // קריאה: כל עובד מחובר יכול לקרוא
  allow read: if request.auth != null
              && exists(/databases/$(database)/documents/employees/$(request.auth.uid))
              && get(/databases/$(database)/documents/employees/$(request.auth.uid)).data.isActive == true;

  // כתיבה: רק דרך Functions (לא ישירות!)
  allow write: if false;  // כל הכתיבה דרך Firebase Functions
}
```

---

## 📈 זרימת נתונים - דוגמה מלאה

### יצירת לקוח חדש:

```
User Action (Browser)
    ↓
[1] script.js → createClient()
    ↓
[2] script.js → saveClientToFirebase({ fullName, phone, email, type })
    ↓
[3] script.js → callFunction('createClient', data)
    ↓
[4] Firebase Functions → createClient(data, context)
    ↓
[5] checkUserPermissions(context) → בדיקת Auth + Employee
    ↓
[6] Validation:
    ├─ fullName (required, min 2 chars)
    ├─ phone (optional, Israeli format)
    ├─ email (optional, valid format)
    └─ type (required, 'budget' or 'hours')
    ↓
[7] Sanitization → sanitizeString()
    ↓
[8] db.collection('clients').add(clientData)
    ↓
[9] logAction('CREATE_CLIENT', ...) → audit_log
    ↓
[10] Return → { success: true, clientId, client }
    ↓
[11] script.js → הצגת הודעה למשתמש
    ↓
[12] script.js → רענון רשימת לקוחות
```

---

## 🔄 האם יש שימוש ישיר ב-Firestore?

### כן - בקריאה (READ):
- ✅ `loadClientsFromFirebase()` - קוראת **ישירות** מ-Firestore
- ✅ יעיל יותר (פחות API calls ל-Functions)
- ⚠️ דורש Security Rules נכונות

### לא - בכתיבה (WRITE):
- ✅ `saveClientToFirebase()` - משתמשת ב-**Firebase Function**
- ✅ `updateClient()` - דרך Function בלבד
- ✅ `deleteClient()` - דרך Function בלבד
- ✅ בטוח יותר - Validation ב-Server Side

---

## 📌 סיכום עיקרי

### ✅ מה עובד טוב:

1. **שכבת Backend מאובטחת** - כל כתיבה דרך Functions עם Validation
2. **Sanitization** - מניעת XSS attacks
3. **Audit Logging** - כל פעולה נרשמת
4. **הרשאות ברורות** - Owner או Admin לעדכון/מחיקה
5. **אימות נתונים חזק** - טלפון, אימייל, שדות חובה

### ⚠️ דברים לשיפור:

1. **קריאה ישירה מ-Firestore** - כדאי גם לעבור דרך Function?
2. **אין Cache** - כל פעם שולפים הכל מחדש
3. **אין Pagination** - אם יהיו 1000 לקוחות, זה יטען הכל
4. **Security Rules לא מתועדות** - צריך לוודא שהן תואמות לקוד

---

## 🎯 המלצות לעתיד:

1. **מיגרציה לקריאה דרך Functions** - גם `getClients`
2. **הוספת Pagination** - לא לטעון 1000 לקוחות בבת אחת
3. **Cache Layer** - שמירה זמנית ב-LocalStorage/Memory
4. **Real-time Listeners** - שימוש ב-`onSnapshot` במקום `get`
5. **Indexing** - אינדקסים ב-Firestore לחיפוש מהיר

---

**נוצר על ידי:** Claude Code
**תאריך:** 16/10/2025
**גרסה:** 1.0
