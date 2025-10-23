# 🚀 מדריך פריסה - Admin API

מדריך מפורט צעד אחרי צעד לפריסת Admin API במערכת

---

## 📋 דרישות מקדימות

לפני שמתחילים, וודא שיש לך:
- ✅ Firebase CLI מותקן (`npm install -g firebase-tools`)
- ✅ גישת admin ל-Firebase Console
- ✅ Node.js גרסה 16 או יותר
- ✅ Git (למעקב אחרי שינויים)

---

## 🔧 שלב 1: הכנת הקבצים

### 1.1 העתקת Cloud Functions

```bash
# צור תיקייה חדשה ב-functions/
mkdir functions/admin

# העתק את כל הקבצים מ-admin-api/functions/ ל-functions/admin/
cp admin-api/functions/*.js functions/admin/
```

התוצאה אמורה להיות:
```
functions/
├── index.js          ← קיים (נעדכן בהמשך)
└── admin/            ← חדש!
    ├── index.js
    ├── utils.js
    ├── users.js
    ├── tasks.js
    └── notifications.js
```

### 1.2 עדכון functions/index.js

פתח את `functions/index.js` והוסף בסוף:

```javascript
// ==================== Admin API ====================
// ✅ Admin Management Functions (Full Access with Admin SDK)
exports.admin = require('./admin');

console.log('✅ Admin API loaded');
```

**הסבר:** זה מייצא את כל ה-Admin Functions תחת namespace `admin`.
כלומר, הפונקציות יהיו נגישות כ-`adminCreateUser`, `adminBlockUser`, וכו'.

---

## 🗂️ שלב 2: עדכון Firestore Rules

Admin API משתמשת ב-collection חדש: `admin_audit_log`

פתח את `firestore.rules` והוסף:

```javascript
// ✅ Admin Audit Log: Only admins can read (write is handled by Cloud Functions)
match /admin_audit_log/{logId} {
  allow read: if isAdmin();
  allow write: if false; // Only through Cloud Functions
}
```

**וודא שהפונקציה `isAdmin()` קיימת:**

```javascript
function isAdmin() {
  return request.auth != null && (
    request.auth.token.role == 'admin' ||
    request.auth.token.email == 'haim@ghlawoffice.co.il'
  );
}
```

---

## 🚀 שלב 3: פריסה ל-Firebase

### 3.1 התחברות ל-Firebase

```bash
firebase login
```

### 3.2 בחירת הפרויקט

```bash
firebase use law-office-system-e4801
```

### 3.3 פריסת Cloud Functions

```bash
# פריסה של כל ה-functions (כולל admin)
firebase deploy --only functions

# או פריסה רק של admin functions
firebase deploy --only functions:admin
```

**זמן פריסה:** בערך 2-3 דקות

**פלט מצופה:**
```
✔ functions[adminCreateUser]: Successful create operation.
✔ functions[adminBlockUser]: Successful create operation.
✔ functions[adminTransferTask]: Successful create operation.
...
✔ Deploy complete!
```

### 3.4 פריסת Firestore Rules

```bash
firebase deploy --only firestore:rules
```

---

## 🎨 שלב 4: עדכון הדשבורד

### 4.1 העתקת API Client

```bash
# העתק את ה-API client למקום נגיש
cp admin-api/dashboard/admin-api-client.js admin/
```

### 4.2 עדכון admin-unified-v2.html

הוסף לפני סגירת `</body>`:

```html
<!-- Admin API Client -->
<script src="../admin/admin-api-client.js"></script>

<script>
  // יצירת instance של API
  const adminAPI = new AdminAPI();

  // דוגמה: יצירת משתמש
  async function createNewUser() {
    try {
      const result = await adminAPI.createUser({
        email: document.getElementById('userEmail').value,
        password: document.getElementById('userPassword').value,
        name: document.getElementById('userName').value,
        role: document.getElementById('userRole').value
      });

      alert(result.message);
      // רענון רשימת המשתמשים...
    } catch (error) {
      alert('שגיאה: ' + error.message);
    }
  }

  // דוגמה: חסימת משתמש
  async function blockUser(userId) {
    if (!confirm(`האם לחסום את ${userId}?`)) return;

    try {
      const result = await adminAPI.blockUser(userId, 'חסימה מהדשבורד');
      alert(result.message);
      // רענון רשימת המשתמשים...
    } catch (error) {
      alert('שגיאה: ' + error.message);
    }
  }

  console.log('✅ Admin Dashboard with API ready');
</script>
```

---

## ✅ שלב 5: בדיקות

### 5.1 בדיקה ידנית

פתח את הדשבורד והתחבר כ-admin:
```
https://gh-law-office-system.netlify.app/admin/admin-unified-v2.html
```

**בדוק:**
- ✅ יצירת משתמש חדש
- ✅ חסימת משתמש
- ✅ ביטול חסימה
- ✅ שליחת התראה
- ✅ העברת משימה

### 5.2 בדיקת Audit Log

פתח Firebase Console → Firestore → `admin_audit_log`

**אמור לראות:**
```
admin_audit_log/
└── {logId}/
    ├── action: "ADMIN_CREATE_USER"
    ├── performedBy: "haim@ghlawoffice.co.il"
    ├── timestamp: ...
    ├── success: true
    └── data: {...}
```

### 5.3 בדיקת Console

פתח Developer Tools (F12) → Console

**אמור לראות:**
```
✅ Admin API Client initialized
✅ AdminAPI class available globally
📞 Calling adminCreateUser...
✅ User created successfully: {userId: "...", ...}
```

---

## 🐛 פתרון בעיות נפוצות

### בעיה 1: "Firebase is not loaded"

**פתרון:** וודא ש-Firebase SDK נטען לפני admin-api-client.js

```html
<!-- ✅ סדר נכון -->
<script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-functions-compat.js"></script>
<script src="admin-api-client.js"></script>
```

---

### בעיה 2: "Function not found"

**פתרון:** וודא שהפונקציות נפרסו:

```bash
firebase functions:list | grep admin
```

אמור להציג:
```
adminCreateUser(us-central1)
adminBlockUser(us-central1)
...
```

---

### בעיה 3: "permission-denied"

**פתרון 1:** וודא שהמשתמש מחובר:
```javascript
console.log(firebase.auth().currentUser);
```

**פתרון 2:** וודא שהמייל ברשימת admins:
```javascript
// בקובץ utils.js
const ADMIN_EMAILS = [
  'haim@ghlawoffice.co.il' // ✅ המייל שלך
];
```

---

### בעיה 4: "CORS error"

**פתרון:** Cloud Functions אמורות לטפל ב-CORS אוטומטית.
אם יש בעיה, וודא שאתה מפרוס עם:
```bash
firebase deploy --only functions
```

---

## 📊 מעקב אחרי שימוש

### Firebase Console

**Cloud Functions → Logs:**
```
View logs: https://console.firebase.google.com/project/law-office-system-e4801/functions/logs
```

**Firestore → admin_audit_log:**
```
View audit log: https://console.firebase.google.com/project/law-office-system-e4801/firestore
```

### Dashboard Analytics

בדשבורד, הוסף:
```javascript
// ספירת פעולות admin
const auditStats = await firebase.firestore()
  .collection('admin_audit_log')
  .where('performedBy', '==', 'haim@ghlawoffice.co.il')
  .get();

console.log(`Total admin actions: ${auditStats.size}`);
```

---

## 🔄 עדכונים עתידיים

### הוספת Function חדשה

1. הוסף את הפונקציה לקובץ הרלוונטי (users.js, tasks.js, וכו')
2. ייצא אותה ב-admin/index.js
3. הוסף method ב-admin-api-client.js
4. פרוס: `firebase deploy --only functions`

### דוגמה:

**1. ב-users.js:**
```javascript
exports.adminGetUserStats = functions.https.onCall(async (data, context) => {
  checkAdminAuth(context);
  // logic...
});
```

**2. ב-admin/index.js:**
```javascript
exports.adminGetUserStats = users.adminGetUserStats;
```

**3. ב-admin-api-client.js:**
```javascript
async getUserStats(userId) {
  const result = await this.functions.httpsCallable('adminGetUserStats')({ userId });
  return result.data;
}
```

**4. פריסה:**
```bash
firebase deploy --only functions:admin.adminGetUserStats
```

---

## 🎉 סיכום

אם הכל עבד, עכשיו יש לך:
- ✅ 14 Admin Cloud Functions פועלות
- ✅ Audit Log אוטומטי
- ✅ API Client לדשבורד
- ✅ אבטחה מלאה
- ✅ תיעוד מלא

**מזל טוב! המערכת מוכנה לשימוש!** 🚀

---

## 📞 תמיכה

לשאלות או בעיות:
- **תיעוד:** admin-api/README.md
- **ארכיטקטורה:** admin-api/docs/ARCHITECTURE.md
- **מייל:** haim@ghlawoffice.co.il

---

**עודכן לאחרונה:** 23 אוקטובר 2025
