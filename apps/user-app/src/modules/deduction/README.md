# Deduction System Module

מודול מודולרי ומקצועי לניהול קיזוז שעות ומעקב אחר חבילות במערכת משרד עורכי הדין.

## 📦 מבנה המודול

```
src/modules/deduction/
├── index.js              → Public API (Facade)
├── calculators.js        → Pure calculation functions
├── validators.js         → Input validation
├── aggregators.js        → Aggregate fields updates
├── deduction-logic.js    → Core deduction logic
├── builders.js           → Package/Stage builders
├── ui/                   → UI Components (future)
└── README.md            → This file
```

## 🚀 Quick Start

### Import המודול

```javascript
// ES6
import DeductionSystem from '@/modules/deduction';

// CommonJS
const DeductionSystem = require('@/modules/deduction');

// Global (legacy compatibility)
const { calculateRemainingHours } = window.DeductionSystem;
```

### שימוש בסיסי

```javascript
// חישוב שעות נותרות
const hours = DeductionSystem.calculateRemainingHours(service);

// ולידציה
const validation = DeductionSystem.validateTimeEntry(taskData, clientData);
if (!validation.valid) {
  console.error(validation.error);
}

// קיזוז שעות
const result = DeductionSystem.deductHoursFromStage(stage, 2.5);
```

## 📚 API Reference

### Calculators

#### `calculateRemainingHours(entity)`
🎯 **SINGLE SOURCE OF TRUTH** - חישוב שעות נותרות מחבילות פעילות.

**Parameters:**
- `entity` (Object) - Service, stage, or case

**Returns:** `number` - Total remaining hours

**Example:**
```javascript
const service = {
  packages: [
    { status: 'active', hoursRemaining: 20 },
    { status: 'depleted', hoursRemaining: 0 },
    { status: 'active', hoursRemaining: 15 }
  ]
};
const hours = DeductionSystem.calculateRemainingHours(service);
// Returns: 35
```

#### `calculateProgress(entity)`
חישוב אחוז התקדמות (0-100).

#### `formatHours(hours, showMinutes)`
פורמט שעות להצגה בעברית.

### Validators

#### `validateTimeEntry(taskData, clientData)`
ולידציה מלאה לפני רישום שעות.

#### `validatePackage(packageData)`
ולידציה לנתוני חבילת שעות.

### Deduction Logic

#### `getActivePackage(stage)`
מוצא חבילה פעילה בשלב.

#### `deductHoursFromPackage(pkg, hours)`
קיזוז שעות מחבילה (כולל סגירה אוטומטית).

#### `deductHoursFromStage(stage, hours)`
קיזוז שעות משלב (מוצא חבילה פעילה אוטומטית).

## 🎓 Best Practices

### ✅ DO

```javascript
// 1. תמיד השתמש ב-calculateRemainingHours
const hours = DeductionSystem.calculateRemainingHours(service);

// 2. ולדט לפני פעולה
const validation = DeductionSystem.validateDeduction(hours, entity);
if (validation.valid) {
  // ...
}

// 3. עדכן aggregates אחרי קיזוז
DeductionSystem.updateServiceAggregates(service, username);
```

### ❌ DON'T

```javascript
// אל תקרא ישירות מ-hoursRemaining (מיושן!)
const hours = service.hoursRemaining; // ❌

// אל תשכח ולידציה
DeductionSystem.deductHoursFromPackage(pkg, 1000); // ❌ לא ולדט
```

## 🔄 Backward Compatibility

המודול שומר על תאימות מלאה עם קוד ישן:

```javascript
// ✅ עדיין עובד
window.calculateRemainingHours(service);

// ✅ תיקים ישנים ללא packages
const oldCase = { hoursRemaining: 50 };
const hours = DeductionSystem.calculateRemainingHours(oldCase);
// Returns: 50 (fallback)
```

## 🧪 Testing

```bash
# Run unit tests
npm run test src/modules/deduction

# Run specific test
npm run test calculators.test.ts
```

## 📖 Additional Documentation

- [DEDUCTION_SYSTEM_GUIDE.md](../../docs/DEDUCTION_SYSTEM_GUIDE.md) - מדריך מקיף
- [PACKAGES_SYSTEM.md](../../docs/PACKAGES_SYSTEM.md) - מערכת החבילות
- [DATA_STRUCTURE_STANDARD.md](../../../../../docs/archive/DATA_STRUCTURE_STANDARD.md) - מבנה הנתונים (⚠️ בארכיון — לא מתאר את המערכת הנוכחית; ראה `docs/architecture/SERVICE_TYPES.md`)

## 📝 Version History

### v1.0.0 (2025-11-11)
- ✨ מודול מודולרי חדש
- ✅ Facade Pattern
- ✅ JSDoc מלא
- ✅ Backward compatibility
- ✅ Zero technical debt

---

**Created:** 2025-11-11
**Maintainer:** Development Team
**License:** Proprietary
