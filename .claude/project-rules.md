# Project Rules - Law Office System

## 🎯 Core Principles

### 1. Single Source of Truth (SSOT)
- כל פונקציה/לוגיקה קיימת במקום אחד בלבד
- אל תיצור קוד כפול - תמיד בדוק אם קיים מודול משותף
- השתמש במודולים הגלובליים הקיימים

### 2. Shared Modules (אל תשנה ללא אישור!)
המודולים האלה הם **Single Source of Truth** - אל תשנה אותם ללא אישור מפורש:

```javascript
// ✅ USE THESE - DON'T CREATE DUPLICATES

// 1. XSS Protection
window.safeText(text)
// Location: js/modules/core-utils.js
// Purpose: הגנת XSS - כל HTML חייב לעבור דרך הפונקציה הזו

// 2. Client Search
window.ClientSearch.searchClientsReturnHTML(clients, searchTerm, onClickHandler)
window.ClientSearch.searchClientsUpdateDOM(clients, searchTerm, domElements, onClickHandler)
// Location: js/modules/ui/client-search.js
// Purpose: חיפוש לקוחות - אחיד בכל המערכת

// 3. Service Cards
window.renderServiceCard(service, type, pricingType, caseItem, options)
// Location: js/modules/service-card-renderer.js
// Purpose: רינדור כרטיסי שירותים

// 4. Date Formatting
window.DatesModule.formatDateTime(date)
window.DatesModule.formatDate(date)
window.DatesModule.formatShort(date)
window.DatesModule.convertTimestamp(timestamp)
// Location: js/modules/dates.js
// Purpose: המרת תאריכים + Firebase Timestamps

// 5. Hours Calculation
window.calculateRemainingHours(entity)
// Location: src/modules/deduction/calculators.js
// Purpose: חישוב שעות נותרות מחבילות
```

### 3. Documentation Standards

#### בכל שינוי לקובץ קיים:
1. ✅ עדכן `@version` בheader
2. ✅ הוסף ערך ל-CHANGELOG בתוך הקובץ
3. ✅ תאר מה השתנה (קבצים + שורות)

#### בכל feature/refactoring גדול:
1. ✅ צור קובץ תיעוד ב-`docs/`
2. ✅ תאר את הבעיה והפתרון
3. ✅ כלול דוגמאות Before/After
4. ✅ רשום השפעה (כמה שורות נמחקו, כמה נוספו)

### 4. Git Commit Standards

```bash
# ✅ Good commit message format:
✨ Feature: Short description (v1.2.0)

Detailed description of what changed and why.

## Changes
- File 1: what changed (lines X-Y)
- File 2: what changed (lines A-B)

## Impact
- Reduced code duplication by X lines
- Improved performance/security/UX

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

### 5. Code Quality Rules

#### אבטחה:
- ✅ כל HTML output חייב לעבור דרך `window.safeText()`
- ✅ כל user input חייב validation
- ❌ לעולם אל תשתמש ב-`innerHTML` ישירות עם user data

#### ביצועים:
- ✅ השתמש במודולים משותפים (נטענים פעם אחת)
- ✅ IIFE Pattern למניעת global scope pollution
- ❌ אל תיצור קוד כפול שנטען מספר פעמים

#### תחזוקה:
- ✅ קוד נקי וקריא
- ✅ תיעוד ב-JSDoc
- ✅ Comments בעברית ואנגלית
- ✅ Semantic Versioning (MAJOR.MINOR.PATCH)

## 📁 Recent Major Changes

### רפקטורינג ביטול כפילות קוד (19/01/2025)
- 📄 תיעוד: `docs/REFACTORING_CODE_DUPLICATION_2025-01-19.md`
- 📊 השפעה: ~280 שורות קוד כפול נמחקו
- 🎯 מודולים חדשים:
  - `client-search.js` (v1.0.0)
  - `service-card-renderer.js` (v1.1.0)
  - עדכוני `core-utils.js` (v1.1.0)
  - עדכוני `dates.js` (v1.1.0)

### Stepper/Wizard UI למודול יצירת תיקים (19/01/2025)
- 📄 קובץ: `js/modules/case-creation/case-creation-dialog.js`
- 📦 גרסה: v3.4.0 → v5.1.0
- 🎯 שינויים:
  - ממשק רב-שלבי (Multi-step wizard)
  - 3 צעדים ללקוח חדש
  - 2 צעדים ללקוח קיים
  - מחוון התקדמות עם ולידציה

## ⚠️ Before You Start Any Task

**שאל את עצמך:**
1. ❓ האם הפונקציה הזו כבר קיימת במודול משותף?
2. ❓ האם אני יוצר קוד כפול?
3. ❓ האם אני משנה מודול SSOT? (צריך אישור!)
4. ❓ האם עדכנתי CHANGELOG + version?
5. ❓ האם צריך תיעוד לשינוי הזה?

## 🚫 Common Mistakes to Avoid

❌ **DON'T:**
- יצירת פונקציית `escapeHtml()` חדשה → השתמש ב-`window.safeText`
- יצירת פונקציית חיפוש לקוחות חדשה → השתמש ב-`window.ClientSearch`
- יצירת HTML לכרטיס שירות ידנית → השתמש ב-`window.renderServiceCard`
- המרת תאריכים ידנית → השתמש ב-`window.DatesModule`
- שינוי מודולי SSOT ללא תיאום

✅ **DO:**
- בדוק קודם אם קיים מודול משותף
- השתמש במודולים הגלובליים
- עדכן תיעוד + version
- צור commits ברורים ומתועדים
- שאל אם לא בטוח!

---

**Last Updated**: 2025-01-19
**Maintained By**: Haim + Claude Code
