# Deduction System Module

מודול מודולרי ומקצועי לניהול קיזוז שעות ומעקב אחר חבילות במערכת משרד עורכי הדין.

## 📦 מבנה המודול

```
src/modules/deduction/
├── index.js              → Public API (Facade, CommonJS — Firebase Functions)
├── calculators.js        → Pure calculation functions
├── validators.js         → Input validation
├── deduction-logic.js    → Core deduction logic (the only module index.js re-exports)
├── builders.js           → Package/Stage builders
├── ui/                   → UI Components (future)
└── README.md            → This file
```

> **2026-07-23 (PR-STAGE-OWN cleanup):** `aggregators.js` — which duplicated the exact
> Σ(packages.hoursUsed) stage-recompute this PR removed from
> `src/modules/aggregation/index.js` and `functions/services/index.js` for
> destroying stage-only-counted ("orphan") hours — was **deleted**. It was
> genuinely dead in the Cloud Functions runtime: the CJS facade `index.js`
> only ever re-exports from `deduction-logic.js` (never imported
> `aggregators.js`), and a repo-wide grep of `functions/` found no other
> caller. A near-identical `aggregators.js` still exists at
> `apps/user-app/src/modules/deduction/aggregators.js` — that copy IS live
> (loaded directly by `apps/user-app/index.html` as a native ES module
> script tag) and was intentionally left untouched; it is a separate
> frontend file, out of scope for this backend fix.

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

#### `getActivePackage(stage, allowOverdraft = true, overrideActive = false)`
מוצא חבילה לקיזוז בשלב/בשירות, לפי סדר עדיפויות.

**Parameters:**
- `stage` (Object) — Stage or service object with `packages` array
- `allowOverdraft` (boolean) — אם `false`, מחזיר רק חבילות עם שעות חיוביות (strict mode)
- `overrideActive` (boolean) — אם `true`, רצפת ה-10h- נעקפת בpass הfallback

**Selection priority (PR-DED-1, 2026-05-25):**

1. **Fresh pass** — מעדיף חבילה **הוותיקה ביותר** (לפי `purchaseDate` / `createdAt` עולה) שעומדת בכל אלה:
   - `hoursRemaining > 0`
   - `status ∈ {'active', 'pending', no-status}`

2. **Fallback pass** (רק אם `allowOverdraft=true`) — אם אין fresh, מחזיר חבילה ראשונה שעומדת ב:
   - `status ∈ {'active', 'pending', 'overdraft', 'depleted'}` (Branch A — modern stage)
   - או `status ∈ {'active', 'overdraft', 'depleted', no-status}` (Branch B — BC, stage ללא `.status`)
   - `hoursRemaining > -10` (או כל ערך אם `overrideActive=true`)

3. אם אין מועמדים → `null`.

**Why two passes:** מערכת ה-billing מציגה ללקוח breakdown פר-חבילה (`ReportGenerator.renderPackagesBreakdown`). drain של חבילה ישנה לפני חדשה הוא FIFO billing נכון. בנוסף — חבילה depleted אסור שתבלוק רישום שעות אם יש חבילה טריה זמינה.

**Example (Miri Daniel, client 2026065 stage_a):**
```javascript
const stage = {
  status: 'active',
  packages: [
    { id: 'pkg_initial',    status: 'depleted', hoursRemaining: -7.6, purchaseDate: '2025-06-01' },
    { id: 'pkg_additional', status: 'active',   hoursRemaining: 35.5, purchaseDate: '2026-05-25' }
  ]
};
const pkg = DeductionSystem.getActivePackage(stage);
// Pre-PR-DED-1: returned pkg_initial (depleted, blocked customer at -10h floor)
// Post-PR-DED-1: returns pkg_additional (fresh, customer can log hours)
```

**G3 monitoring:** הפונקציה כותבת `console.warn` כש-fallback נבחר (חבילה לא-fresh). מאפשר זיהוי שלבים שצריכים חבילה חדשה.

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

// 3. עדכן aggregates אחרי קיזוז — דרך ה-canonical helpers, לא ה-aggregators.js
//    שנמחק (2026-07-23): src/modules/aggregation (calcServiceHoursUsedFromStages,
//    recomputeStageHoursUsedPreservingOrphan) או functions/shared/client-writer.js
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
- [DATA_STRUCTURE_STANDARD.md](../../../../docs/archive/DATA_STRUCTURE_STANDARD.md) - מבנה הנתונים (⚠️ בארכיון — לא מתאר את המערכת הנוכחית; ראה `docs/architecture/SERVICE_TYPES.md`)

## 📝 Version History

### v3.1.0 (2026-05-25) — PR-DED-1
- 🐛 fix: `getActivePackage` בחר חבילה ראשונה במערך גם אם depleted, מתעלם מחבילה טרייה שזמינה
- ✨ selection priority חדש: fresh-first ב-pass ראשון, fallback ל-depleted/overdraft רק אם אין fresh
- ✨ FIFO tie-break לפי `purchaseDate` / `createdAt` ASC (drain ישן לפני חדש)
- ✨ G3 monitoring: `console.warn` בfallback path
- 🧪 18 בדיקות חדשות ב-`functions/tests/get-active-package.test.js`

### v3.0.0 (2025-11-23)
- 🏗️ Architectural upgrade — immutable patterns ב-`deductHoursFromPackage` / `deductHoursFromStage`

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
