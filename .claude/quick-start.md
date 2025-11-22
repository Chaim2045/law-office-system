# Quick Start for New Claude Sessions

## 📋 Copy-Paste this to Start:

```
היי Claude!

לפני שנתחיל - קרא את הקבצים האלה:
1. .claude/project-rules.md
2. docs/REFACTORING_CODE_DUPLICATION_2025-01-19.md

עקרונות מפתח:
- Single Source of Truth - אל תיצור קוד כפול
- השתמש במודולים הגלובליים הקיימים
- עדכן CHANGELOG + version בכל שינוי

אשר שקראת והבנת.
```

---

## 🔧 Global Functions Available

### XSS Protection
```javascript
window.safeText(text)
// File: js/modules/core-utils.js
```

### Client Search
```javascript
window.ClientSearch.searchClientsReturnHTML(clients, term, onClick)
window.ClientSearch.searchClientsUpdateDOM(clients, term, dom, onClick)
// File: js/modules/ui/client-search.js
```

### Service Cards
```javascript
window.renderServiceCard(service, type, pricingType, caseItem, options)
// File: js/modules/service-card-renderer.js
```

### Dates
```javascript
window.DatesModule.formatDateTime(date)
window.DatesModule.formatDate(date)
window.DatesModule.convertTimestamp(timestamp)
// File: js/modules/dates.js
```

### Hours Calculation
```javascript
window.calculateRemainingHours(entity)
// File: src/modules/deduction/calculators.js
```

---

## 🚫 DO NOT MODIFY (Without Permission)

- `js/modules/core-utils.js`
- `js/modules/ui/client-search.js`
- `js/modules/service-card-renderer.js`
- `js/modules/dates.js`
- `src/modules/deduction/calculators.js`

**These are Single Source of Truth modules!**

---

## ✅ Checklist Before ANY Change

- [ ] Checked if function exists in shared modules
- [ ] Not creating duplicate code
- [ ] Will update CHANGELOG in file
- [ ] Will update @version number
- [ ] Will create docs/ file if major change
- [ ] Will commit with proper message format

---

## 📚 Important Docs

- `docs/REFACTORING_CODE_DUPLICATION_2025-01-19.md` - Recent refactoring (280 lines removed)
- `.claude/project-rules.md` - Full project rules
- `.claude/quick-start.md` - This file

---

Last Updated: 2025-01-19
