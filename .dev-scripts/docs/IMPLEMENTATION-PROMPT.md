# 🚀 Implementation Prompt - להעתיק לקלוד

העתק והדבק את זה כשמגיעים לשלב המימוש:

---

## 📋 הנחיות מימוש

קרא קודם:
- `.dev-scripts/docs/ARCHITECTURE-GUIDELINES.md`

---

## ✅ עכשיו תממש את מה שדיברנו לפי הכללים הבאים:

### 1. Branch חדש - חובה!
```bash
git checkout -b feature/[שם-תכונה]
```

### 2. קבצים חדשים
כל קובץ JS חדש:
- שם: `js/modules/[feature-name].js`
- גרסה: `?v=1.0.0`
- **defer:** כן! (תמיד)

### 3. הוסף ל-index.html
```html
<script defer src="js/modules/[feature-name].js?v=1.0.0"></script>
```

**איפה?** אחרי שורה ~1100 (אחרי presence-system.js)

### 4. Firestore Queries
```javascript
.limit(50)  // תמיד!
```

### 5. Input Validation
```javascript
import { safeText } from './modules/core-utils.js';
const clean = safeText(userInput);
```

### 6. Error Handling
```javascript
try {
  // קוד
} catch (error) {
  console.error('Failed:', error);
  NotificationSystem.error('שגיאה');
}
```

### 7. אחרי שסיימת לכתוב:
```bash
git add .
git commit -m "feat: [תיאור קצר]"
```

### 8. דווח לי:
```
✅ סיימתי לכתוב!

קבצים שנוצרו:
- js/modules/[name].js
- css/[name].css

קבצים ששונו:
- index.html (added script with defer)
- js/main.js (initialization)

בדקתי מקומית:
- Chrome ✅
- Console נקי ✅
- עובד ✅

רוצה שאעלה ל-main?
```

### 9. המתן לאישור שלי!
**אל תעשה merge ל-main בלי אישור מפורש!**

---

**זהו - התחל לכתוב!**
