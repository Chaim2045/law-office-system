# 💬 מערכת צ'אט דו-כיוונית - מדריך שימוש

## תוכן עניינים
1. [סקירה כללית](#סקירה-כללית)
2. [קבצים שנוצרו](#קבצים-שנוצרו)
3. [אינטגרציה במערכת](#אינטגרציה-במערכת)
4. [שימוש - צד עובד](#שימוש---צד-עובד)
5. [שימוש - צד מנהל](#שימוש---צד-מנהל)
6. [Firestore Rules](#firestore-rules)
7. [אינדקסים נדרשים](#אינדקסים-נדרשים)
8. [פתרון בעיות](#פתרון-בעיות)

---

## סקירה כללית

מערכת צ'אט דו-כיוונית בסגנון **WhatsApp/Telegram** בין מנהלים לעובדים.

### תכונות עיקריות:
- ✅ צ'אט בזמן אמת (Real-time)
- ✅ עיצוב בסגנון WhatsApp
- ✅ אישורי קריאה (Read receipts)
- ✅ היסטוריית שיחות
- ✅ הודעות לא נקראו (Unread counter)
- ✅ שמירה ב-Firestore
- ✅ אבטחה מלאה עם Firestore Rules

---

## קבצים שנוצרו

### 1. Backend & Logic
| קובץ | תיאור | מיקום |
|------|-------|-------|
| **ChatManager.js** | מנהל מרכזי לכל פעולות הצ'אט | `js/managers/ChatManager.js` |
| **EmployeeChatUI.js** | ממשק צ'אט לעובדים | `js/ui/EmployeeChatUI.js` |
| **AdminChatUI.js** | ממשק צ'אט למנהל (פאנל מלא) | `master-admin-panel/js/ui/AdminChatUI.js` |

### 2. Styling
| קובץ | תיאור | מיקום |
|------|-------|-------|
| **chat.css** | עיצוב WhatsApp-style | `css/chat.css` |

### 3. Security
| קובץ | תיאור | מיקום |
|------|-------|-------|
| **firestore.rules** | כללי אבטחה ל-conversations | `firestore.rules` (עודכן) |

---

## אינטגרציה במערכת

### 1. עבור עובדים (Employee Dashboard)

הוסף ל-`index.html` של עובדים:

```html
<!-- CSS -->
<link rel="stylesheet" href="css/chat.css">

<!-- JavaScript Modules -->
<script src="js/managers/ChatManager.js"></script>
<script src="js/ui/EmployeeChatUI.js"></script>
```

### 2. עבור מנהל (Admin Panel)

הוסף ל-`master-admin-panel/index.html`:

```html
<!-- CSS -->
<link rel="stylesheet" href="../css/chat.css">

<!-- JavaScript Modules -->
<script src="../js/managers/ChatManager.js"></script>
<script src="js/ui/AdminChatUI.js"></script>
```

### 3. כפתור פתיחת צ'אט באדמין

הוסף כפתור בסרגל העליון של האדמין:

```html
<button onclick="window.adminChatUI.showChatPanel()" class="btn btn-primary">
    <i class="fas fa-comments"></i> צ'אט עם עובדים
</button>
```

---

## שימוש - צד עובד

### זרימה:
1. **עובד מקבל הודעה מהמנהל** → הודעת Toast מופיעה
2. **עובד לוחץ על "השב"** → נפתח חלון צ'אט WhatsApp-style
3. **עובד כותב ושולח הודעה** → ההודעה נשמרת ב-Firestore
4. **המנהל רואה אותה בזמן אמת**

### קוד דוגמה - פתיחה ידנית:

```javascript
// פתיחת צ'אט עם מנהל (לפי UID)
window.employeeChatUI.openChat(
    'adminUidHere',      // UID של המנהל
    'גיא - מנהל'         // שם המנהל
);
```

---

## שימוש - צד מנהל

### זרימה:
1. **מנהל לוחץ על "צ'אט עם עובדים"** → נפתח פאנל מלא
2. **מנהל רואה רשימת שיחות** (כמו WhatsApp Web)
3. **מנהל לוחץ על עובד** → נפתחת השיחה
4. **מנהל כותב ושולח** → העובד מקבל בזמן אמת

### קוד דוגמה:

```javascript
// פתיחת פאנל צ'אט מלא
window.adminChatUI.showChatPanel();
```

### כפתור ב-HTML:

```html
<button onclick="window.adminChatUI.showChatPanel()">
    <i class="fas fa-comments"></i> צ'אט עם עובדים
</button>
```

---

## Firestore Rules

### מבנה ה-Collection:

```
conversations/
  └── conv_{uid1}_{uid2}/     (מזהה שיחה ייחודי)
      ├── metadata:
      │   ├── participants: ["uid1", "uid2"]
      │   ├── participantNames: { uid1: "שם", uid2: "שם" }
      │   ├── lastMessage: "תוכן הודעה אחרונה"
      │   ├── lastMessageAt: timestamp
      │   └── unreadCount: { uid1: 0, uid2: 2 }
      └── messages/  (subcollection)
          └── {messageId}:
              ├── from: { uid, name, email, role }
              ├── to: { uid, name, email, role }
              ├── text: "תוכן ההודעה"
              ├── createdAt: timestamp
              ├── isRead: false
              └── readAt: null
```

### כללי אבטחה:

```javascript
// הכללים הוספו אוטומטית ל-firestore.rules
match /conversations/{conversationId} {
  // רק משתתפים בשיחה יכולים לקרוא/לכתוב
  allow read: if isAuthenticated() && isParticipant();
  allow create: if isAuthenticated() && willBeParticipant();
  allow update: if isAuthenticated() && isParticipant();
  allow delete: if isAdmin();

  match /messages/{messageId} {
    // רק משתתפים יכולים לקרוא הודעות
    allow read: if isAuthenticated() && isConversationParticipant();

    // רק השולח יכול לשלוח הודעות בשמו
    allow create: if isAuthenticated() &&
                     isConversationParticipant() &&
                     request.resource.data.from.uid == request.auth.uid;

    // ניתן לעדכן רק סטטוס קריאה
    allow update: if isAuthenticated() && (
      (resource.data.from.uid == request.auth.uid) ||
      (resource.data.to.uid == request.auth.uid &&
       request.resource.data.diff(resource.data).affectedKeys()
         .hasOnly(['isRead', 'readAt']))
    );

    allow delete: if isAuthenticated() && (
      resource.data.from.uid == request.auth.uid || isAdmin()
    );
  }
}
```

---

## אינדקסים נדרשים

### יש ליצור את האינדקסים הבאים ב-Firestore Console:

#### 1. אינדקס לשיחות של משתמש
- **Collection**: `conversations`
- **Fields**:
  - `participants` (Array)
  - `lastMessageAt` (Descending)

#### 2. אינדקס להודעות בשיחה
- **Collection**: `conversations/{conversationId}/messages`
- **Fields**:
  - `createdAt` (Ascending)

#### יצירת אינדקסים:
1. היכנס ל-[Firebase Console](https://console.firebase.google.com)
2. בחר את הפרויקט שלך
3. עבור ל-**Firestore Database** → **Indexes**
4. לחץ על **Create Index**
5. הוסף את השדות לפי הטבלה למעלה

---

## פתרון בעיות

### ❌ שגיאה: "ChatManager לא זמין"

**פתרון:**
```javascript
// וודא ש-ChatManager נטען לפני השימוש
if (window.chatManager) {
    console.log('✅ ChatManager זמין');
} else {
    console.error('❌ ChatManager לא נטען');
}
```

---

### ❌ שגיאה: "Missing or insufficient permissions"

**סיבה:** חסרים אינדקסים או כללי אבטחה לא מעודכנים.

**פתרון:**
1. עדכן את `firestore.rules` (ראה למעלה)
2. פרסם את הכללים:
   ```bash
   firebase deploy --only firestore:rules
   ```
3. צור את האינדקסים הנדרשים

---

### ❌ שגיאה: "PERMISSION_DENIED" בשליחת הודעה

**סיבה:** המשתמש לא מחובר או אין לו custom claims.

**פתרון:**
```javascript
// בדוק אימות
const user = firebase.auth().currentUser;
if (!user) {
    console.error('❌ משתמש לא מחובר');
}

// בדוק custom claims
user.getIdTokenResult().then((idTokenResult) => {
    console.log('User role:', idTokenResult.claims.role);
});
```

---

### ❌ הודעות לא מופיעות בזמן אמת

**סיבה:** ה-listener לא פועל.

**פתרון:**
```javascript
// וודא שה-listener פועל
if (window.chatManager.activeListeners.size > 0) {
    console.log('✅ Listeners פעילים:', window.chatManager.activeListeners.size);
} else {
    console.error('❌ אין listeners פעילים');
}
```

---

### ❌ CSS לא נטען - חלון צ'אט נראה שבור

**פתרון:**
```html
<!-- וודא שה-CSS נטען בראש ה-HTML -->
<link rel="stylesheet" href="css/chat.css">
```

---

## טיפים למפתחים

### 1. בדיקת חיבור בזמן אמת

```javascript
// בדוק אם יש חיבור ל-Firestore
firebase.firestore().enableNetwork().then(() => {
    console.log('✅ מחובר ל-Firestore');
}).catch((error) => {
    console.error('❌ אין חיבור:', error);
});
```

### 2. Debug הודעות

```javascript
// הצג את כל ההודעות בשיחה
window.chatManager.getConversationHistory('recipientUid', 100)
    .then(messages => {
        console.log('📜 כל ההודעות:', messages);
    });
```

### 3. ניקוי listeners

```javascript
// עצור את כל ה-listeners (שימושי ב-logout)
window.chatManager.stopAllListeners();
```

---

## API Reference

### ChatManager

#### שליחת הודעה
```javascript
await window.chatManager.sendChatMessage(
    recipientUid,        // UID של הנמען
    messageText,         // תוכן ההודעה
    {
        recipientName: 'שם הנמען',
        recipientRole: 'employee',
        fromRole: 'admin'
    }
);
```

#### האזנה לשיחה
```javascript
const unsubscribe = window.chatManager.listenToConversation(
    recipientUid,
    (message) => {
        console.log('📨 הודעה חדשה:', message);
    }
);

// עצירת האזנה
unsubscribe();
```

#### טעינת היסטוריה
```javascript
const messages = await window.chatManager.getConversationHistory(
    recipientUid,
    50  // מספר הודעות מקסימלי
);
```

#### רשימת שיחות
```javascript
const conversations = await window.chatManager.getMyConversations(50);
```

---

## סטטוס

- ✅ **ChatManager.js** - פועל
- ✅ **EmployeeChatUI.js** - פועל
- ✅ **AdminChatUI.js** - פועל
- ✅ **chat.css** - פועל
- ✅ **Firestore Rules** - מעודכן
- ✅ **אינטגרציה עם NotificationManager** - פועל

---

## תמיכה

אם נתקלת בבעיה:
1. בדוק את ה-Console (F12)
2. וודא שכל הקבצים נטענו
3. בדוק את Firestore Rules
4. צור את האינדקסים הנדרשים
5. וודא אימות משתמש

---

**תאריך עדכון אחרון:** 2025-01-17
**גרסה:** 1.0.0
**סטטוס:** ✅ ייצור - מוכן לשימוש
