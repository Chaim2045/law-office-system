# 📦 Calendar CDN Implementation Archive (v2.x)

> **תאריך ארכוב**: 4 נובמבר 2025
> **סיבת הארכוב**: שדרוג ל-npm package (v3.0.5) ברמת Hi-Tech

---

## 📋 מה כלול בארכיון זה?

### קבצים:
- `vanilla-calendar-picker-v2-cdn.js` - Wrapper class המקורי שעבד עם CDN

### פרטי המימוש הישן:

**ספרייה**: Vanilla Calendar Pro v2.9.10
**מקור**: CDN - `https://cdn.jsdelivr.net/npm/vanilla-calendar-pro/build/`
**API**: `new VanillaCalendar(container, options)`

**רשומות CDN שהוסרו מ-index.html:**
```html
<!-- Line 100 -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/vanilla-calendar-pro/build/vanilla-calendar.min.css" />

<!-- Line 975 -->
<script src="https://cdn.jsdelivr.net/npm/vanilla-calendar-pro/build/vanilla-calendar.min.js"></script>
```

---

## ⚠️ למה עברנו למימוש חדש?

### בעיות במימוש הישן:

1. **404 Errors** - הספרייה עדכנה ל-v3.0.5 ושינתה paths:
   - `/build/vanilla-calendar.min.css` → לא קיים יותר
   - Path חדש: `/styles/index.css`

2. **אין Version Pinning** - CDN ללא `@version` = breaking changes פתאומיים

3. **תלות ברשת** - אין עבודה offline, תלוי ב-CDN חיצוני

4. **לא תואם Enterprise Standards**:
   - אין package.json dependency
   - אין version locking
   - לא ניתן ל-bundling

---

## ✅ המימוש החדש (v3.0.5)

**מקור**: `npm install vanilla-calendar-pro@3.0.5`
**API**: `new Calendar(container, options)` (v3 API)
**יתרונות**:
- ✅ Local package - עובד offline
- ✅ Version locked - יציבות מלאה
- ✅ Modern API
- ✅ Testable + Bundlable
- ✅ Enterprise-ready

---

## 🔄 Migration Notes

### שינויי API עיקריים:

```javascript
// OLD (v2 - CDN)
const calendar = new VanillaCalendar(container, {
  settings: {...}
});

// NEW (v3 - npm)
import { Calendar } from 'vanilla-calendar-pro';
const calendar = new Calendar(container, {
  settings: {...}
});
```

### שינויי Configuration:

```javascript
// v2 - Manual positioning
this.container.style.top = position.top + 'px';
this.container.style.left = position.left + 'px';

// v3 - Built-in inputMode
settings: {
  inputMode: true,
  positionToInput: 'center'
}
```

---

## 📚 תיעוד נוסף

- [Calendar Upgrade Documentation](../../docs/CALENDAR_UPGRADE_V3.md)
- [Vanilla Calendar Pro v3 Docs](https://vanilla-calendar.pro/docs/learn)
- [CHANGELOG Enterprise Upgrade](../../CHANGELOG-ENTERPRISE-UPGRADE.md)

---

## 🚫 אל תשתמש בקבצים האלה

הקבצים בארכיון זה **לא צריכים להיות בשימוש פעיל**.
הם נשמרים רק למטרות:
- 📖 הסטוריה וחקר
- 🔄 Rollback במקרה חירום (לא צפוי)
- 📚 למידה ומחקר

**השתמש במימוש החדש**: `js/modules/vanilla-calendar-picker.js` (v3)

---

**ארכוב על ידי**: Claude Code
**תאריך**: 4 נובמבר 2025
