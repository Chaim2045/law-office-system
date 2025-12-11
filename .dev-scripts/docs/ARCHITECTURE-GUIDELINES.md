# 🏗️ Architecture Guidelines - Law Office System

## 📌 מטרה

הנחיות לבניית features חדשים במערכת פרודקשן.
קרא לפני שמתחיל לכתוב קוד.

---

## 🚨 כללי ברזל

1. **המערכת בפרודקשן** - אל תשבור דברים
2. **אל תוסיף dependencies** בלי אישור מפורש
3. **תציג תוכנית לפני קוד** - קבל אישור, אז תבצע
4. **קובץ JS חדש = `defer`** - תמיד lazy loading
5. **🔴 אסור לעלות ל-main בלי אישור 100%** - עבוד ב-branch, בדוק, רק אז merge

---

## 📂 מבנה פרויקט

```
/                          → ממשק עובדים (gh-law-office-system.netlify.app)
/master-admin-panel/       → ממשק אדמין (admin-gh-law-office-system.netlify.app)
/js/modules/               → Features modules
/css/                      → Styles
/functions/                → Firebase Cloud Functions
```

**כלל:** Feature לעובדים → `/js/modules/`, Feature לאדמין → `/master-admin-panel/js/`

---

## 🛠️ Stack (מה שקיים - אל תוסיף!)

- **Firebase** v9.22.0 (Auth, Firestore, Functions, Realtime DB)
- **TypeScript** v5.3.3 (אופציונלי)
- **Vanilla JS** ES2020
- **Netlify** hosting

### ❌ אסור להוסיף:
- React/Vue/Angular
- jQuery
- Lodash
- Webpack/Rollup bundler מלא
- כל framework/library בלי אישור

---

## 🏗️ תהליך בניית Feature

### 1. הבנת דרישות
- מה ה-feature עושה?
- למי? (employees/admins/both)
- תלות ב-features קיימים?
- צריך Firestore?

### 2. תוכנית מפורטת

צור תוכנית עם:

```markdown
## Feature: [שם]

### Files to CREATE:
- js/modules/my-feature.js
- css/my-feature.css

### Files to MODIFY:
- index.html - add: <script defer src="js/modules/my-feature.js?v=1.0.0"></script>
  (location: after line ~1100, after presence-system.js)
- js/main.js - initialize: new MyFeature().init()

### Firestore:
- Collection: my_collection/
  Fields: { userId, name, createdAt, ... }

### Dependencies:
- firebaseDB
- NotificationSystem
- ModalsManager

### UI:
- Reuse: .btn, .form-group, .modern-table
- New: custom calendar widget

### Performance:
- defer loading ✅
- Firestore: limit(50) ✅
```

### 3. אישור משתמש
הצג תוכנית → חכה לאישור → רק אז תכתוב קוד

### 4. מימוש ב-Branch
```bash
# צור branch חדש
git checkout -b feature/my-feature

# כתוב קוד
# commit
```

### 5. בדיקה מקומית - חובה!
- פתח בדפדפן ✅
- עובד? ✅
- Console נקי? ✅
- לא שבר features אחרים? ✅

### 6. דווח למשתמש
"הכל עובד! בדקתי:
- Chrome ✅
- Firefox ✅
- Console נקי ✅
- לא שבר דברים ✅

רוצה שאעלה ל-main?"

### 7. רק אחרי אישור - Merge
```bash
git checkout main
git merge feature/my-feature
git push
```

---

## 📝 Code Conventions

### Module Pattern

```javascript
// ✅ IIFE (רוב הקוד הקיים)
(function() {
  'use strict';

  class MyFeature {
    init() { /* ... */ }
  }

  window.MyFeature = MyFeature;
})();
```

```javascript
// ✅ ES6 Module (קבצים חדשים)
export class MyFeature {
  init() { /* ... */ }
}
```

### Naming

```javascript
// Classes: PascalCase
class BudgetManager {}

// Functions: camelCase
function loadData() {}

// Constants: UPPER_SNAKE_CASE
const MAX_ITEMS = 50;
```

### Error Handling

```javascript
// ✅ תמיד handle errors
async function loadData() {
  try {
    const data = await fetchFromFirebase();
    return data;
  } catch (error) {
    console.error('Failed:', error);
    NotificationSystem.error('שגיאה בטעינה');
    return null;
  }
}
```

### Firestore

```javascript
// ✅ תמיד limit queries
const snapshot = await firebaseDB
  .collection('tasks')
  .where('userId', '==', userId)
  .orderBy('createdAt', 'desc')
  .limit(50)  // חובה!
  .get();
```

### DOM

```javascript
// ✅ Use safeText for user input
import { safeText } from './modules/core-utils.js';

element.innerHTML = `<h3>${safeText(userInput)}</h3>`;
```

---

## 🎨 UI Components (השתמש בקיימים!)

| Component | קובץ | שימוש |
|-----------|------|-------|
| Buttons | css/buttons.css | `.btn`, `.btn-primary` |
| Forms | css/forms.css | `.form-group`, `.form-row` |
| Tables | css/tables.css | `.modern-budget-table` |
| Modals | js/modules/modals-manager.js | `ModalsManager.show()` |
| Notifications | js/modules/notification-system.js | `NotificationSystem.success()` |

**אל תבנה מאפס אם יש קיים!**

---

## ⚡ Performance - חובה!

### Lazy Loading

```html
<!-- ✅ כל script חדש עם defer -->
<script defer src="js/modules/my-feature.js?v=1.0.0"></script>

<!-- ❌ לא ככה -->
<script src="js/modules/my-feature.js?v=1.0.0"></script>
```

**כלל:**
- Critical (Firebase, auth) → רגיל
- After DOM (UI, forms) → `defer`
- Independent (analytics) → `async`

### Firestore

```javascript
// ✅ limit + cache
.limit(50)

// ❌ ללא limit
.get()  // יכול להחזיר 10,000 docs!
```

---

## 🔒 Security - חובה!

### Input Validation

```javascript
// ✅ תמיד validate
if (!title || title.length > 200) {
  throw new Error('כותרת לא תקינה');
}

const clean = safeText(title);
```

### Auth Check

```javascript
// ✅ בדוק auth
const user = firebase.auth().currentUser;
if (!user) {
  window.location.href = '/';
  return;
}
```

---

## 🔄 Git - חובה לעבוד ב-Branch!

### 🔴 אסור לעלות ל-main ישירות!

**תהליך חובה:**
1. צור branch חדש
2. עבוד ב-branch
3. בדוק שהכל עובד 100%
4. רק אז merge ל-main

### Branch Names

```bash
feature/my-feature-name
fix/bug-description
perf/optimization-name
```

### Workflow

```bash
# 1. צור branch חדש
git checkout -b feature/vacation-system

# 2. עבוד... commit... test...
git add .
git commit -m "feat: Add vacation system"

# 3. בדיקה מקומית - חובה!
# - פתח בדפדפן
# - בדוק שהכל עובד
# - בדוק Console - אין שגיאות

# 4. רק אחרי אישור מפורש מהמשתמש:
git checkout main
git merge feature/vacation-system
git push origin main

# Netlify יפרוס אוטומטית
```

### Commit Format

```bash
git commit -m "feat: Add vacation management system

- Created VacationManager module
- Added Firestore vacation_requests collection
- Integrated with ModalsManager
- Tested on Chrome/Firefox

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### 🚨 אם מצאת בעיה אחרי merge:

```bash
# Revert מיד!
git revert HEAD
git push

# תקן בבranch נפרד
git checkout -b fix/issue-name
# תקן... test... ורק אז merge שוב
```

---

## ✅ Checklist לפני Merge ל-Main

### 🔴 חובה - אל תעלה ל-main בלי זה!

### Code:
- [ ] עובד ב-branch ✅
- [ ] בדיקה מקומית - הכל עובד ✅
- [ ] Console נקי - אין שגיאות ✅
- [ ] מתועד (comments) ✅

### Performance:
- [ ] Script חדש עם `defer` ✅
- [ ] Firestore queries עם `limit()` ✅

### Security:
- [ ] Input validation ✅
- [ ] safeText() לuser input ✅
- [ ] Auth check ✅

### UX:
- [ ] Loading states ✅
- [ ] Error messages בעברית ✅
- [ ] RTL support ✅
- [ ] Responsive ✅

### Testing - חובה!:
- [ ] Chrome ✅
- [ ] Firefox ✅
- [ ] Mobile (DevTools) ✅
- [ ] לא שבר features אחרים ✅
- [ ] **קיבלת אישור מפורש מהמשתמש** ✅

### רק אחרי שהכל ✅ - אפשר merge ל-main

---

## 🎯 דוגמה מלאה

**משתמש אומר:**
> "בנה מערכת ניהול חופשות"

**קלוד עונה:**

```markdown
## תוכנית: מערכת ניהול חופשות

### Files to CREATE:
1. js/modules/vacation-manager.js (~200 lines)
2. css/vacation-manager.css (~100 lines)

### Files to MODIFY:
3. index.html:
   Add: <script defer src="js/modules/vacation-manager.js?v=1.0.0"></script>
   Location: after presence-system.js (line ~1100)
4. js/main.js:
   Add: new VacationManager().init()

### Firestore:
vacation_requests/ {
  userId: string,
  startDate: timestamp,
  endDate: timestamp,
  status: 'pending' | 'approved' | 'rejected',
  reason: string,
  createdAt: timestamp
}

### Security Rules:
- Users: read own, create own
- Admins: read all, update all

### Dependencies:
- firebaseDB (window.firebaseDB)
- ModalsManager
- NotificationSystem

### UI (reuse):
- Modal: ModalsManager.show()
- Table: .modern-table
- Buttons: .btn-primary
- Forms: .form-group

### Performance:
- defer loading ✅
- limit(50) on queries ✅

### Flow:
1. Employee clicks "בקש חופשה"
2. Modal opens with form (dates + reason)
3. Submit → Firestore
4. Notification: "הבקשה נשלחה"
5. Admin sees request, approves/rejects
6. Employee sees updated status

האם התוכנית מתאימה? רוצה שינויים?
```

**משתמש:**
> "כן, קדימה"

**קלוד:**
> "מתחיל לכתוב..."

---

## 📞 עזרה

**מסמכים:**
- `.dev-scripts/docs/LAZY-LOADING-OPTIMIZATION-PLAN.md` - אופטימיזציה
- `.dev-scripts/docs/QUICK-DEPLOY-TEMPLATE.md` - פריסה

**קוד לדוגמה:**
- `js/modules/notification-bell.js` - feature טוב
- `js/modules/modals-manager.js` - modals
- `js/modules/client-case-selector.js` - component מורכב

---

## 🎓 זכור - כללי הזהב

1. **🔴 אסור לעלות ל-main ישירות** - תמיד branch → test → אישור → merge
2. **תוכנית לפני קוד** - הצג, קבל אישור, אז תכתוב
3. **defer על scripts חדשים** - תמיד lazy loading
4. **limit() על queries** - תמיד
5. **validate input** - תמיד
6. **השתמש בקיים** - אל תבנה מחדש
7. **בדיקה מקומית חובה** - Chrome + Firefox + Console נקי
8. **דווח לפני merge** - תן סיכום, חכה לאישור

---

**גרסה:** 2.0.0 (ממוקד)
**עדכון:** 2025-12-11
