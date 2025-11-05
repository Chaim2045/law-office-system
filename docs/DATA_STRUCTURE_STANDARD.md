# 🏗️ Data Structure Standard - Law Office System
## High-Tech Enterprise Architecture v3.0

> **Created:** 2025-11-05
> **Purpose:** Define the canonical data structure for all clients/cases
> **Status:** Official Standard

---

## 🎯 Design Principles

1. **Single Source of Truth** - אחד מבנה, עקבי לכל הלקוחות
2. **Separation of Concerns** - שירותים נפרדים (hours vs legal_procedure)
3. **Backward Compatible** - תמיכה במבנים ישנים (READ ONLY)
4. **Forward Compatible** - קל להוסיף שירותים חדשים
5. **Type Safety** - כל שדה מוגדר בצורה ברורה
6. **Audit Trail** - מעקב אחר כל שינוי

---

## 📐 The Standard Structure

### Client/Case Document
```javascript
{
  // ===== IDENTITY =====
  id: "2025001",                    // Document ID = caseNumber
  caseNumber: "2025001",             // מספר תיק (ייחודי)
  clientName: "חיים כהן",            // שם הלקוח
  clientId: "208234567",             // ת.ז לקוח (לשימוש עתידי)

  // ===== METADATA (Enterprise v2.0) =====
  _version: 5,                       // Optimistic Locking
  _lastModified: Timestamp,          // Event Sourcing
  _modifiedBy: "haim",               // Audit Trail
  _etag: "v5_1730843050000",         // Idempotency

  // ===== PRICING TYPE =====
  procedureType: "hours",            // "hours" | "legal_procedure" (LEGACY ONLY)
  pricingType: "hourly",             // "hourly" | "fixed" | "retainer"

  // ===== SERVICES ARRAY (THE CORE) =====
  services: [
    // Service Type 1: Regular Hours
    {
      id: "srv_hours_1730843000000",
      type: "hours",                 // שירות רגיל (שעות)
      name: "שירותי יעוץ משפטי כללי",
      pricingType: "hourly",
      ratePerHour: 800,
      status: "active",              // "active" | "completed" | "paused"

      // Totals
      totalHours: 100,
      hoursUsed: 25.5,
      hoursRemaining: 74.5,
      totalMinutes: 6000,
      minutesUsed: 1530,
      minutesRemaining: 4470,

      // Packages (חבילות שעות)
      packages: [
        {
          id: "pkg_1730843100000",
          name: "חבילת שעות 1",
          hoursInPackage: 50,
          hoursUsed: 15.5,
          hoursRemaining: 34.5,
          purchaseDate: Timestamp,
          expiryDate: Timestamp,
          status: "active"
        },
        {
          id: "pkg_1730843200000",
          name: "חבילת שעות 2",
          hoursInPackage: 50,
          hoursUsed: 10,
          hoursRemaining: 40,
          purchaseDate: Timestamp,
          expiryDate: Timestamp,
          status: "active"
        }
      ],

      createdAt: Timestamp,
      createdBy: "haim",
      lastActivity: Timestamp
    },

    // Service Type 2: Legal Procedure (שלבי הליך משפטי)
    {
      id: "srv_legal_1730843300000",
      type: "legal_procedure",       // הליך משפטי
      name: "חוות דעת מעסיק",
      pricingType: "hourly",         // "hourly" | "fixed"
      ratePerHour: 800,
      status: "active",

      // Stages (שלבים)
      stages: [
        {
          id: "stage_a",
          name: "שלב א'",
          description: "עריכת טיוטה ראשונה",
          status: "active",          // "active" | "completed" | "pending"
          order: 1,

          // Stage Totals
          totalHours: 30,
          hoursUsed: 5.5,
          hoursRemaining: 24.5,
          totalMinutes: 1800,
          minutesUsed: 330,
          minutesRemaining: 1470,

          // Packages per Stage
          packages: [
            {
              id: "pkg_stage_a_1",
              name: "חבילה שלב א'",
              hoursInPackage: 30,
              hoursUsed: 5.5,
              hoursRemaining: 24.5,
              purchaseDate: Timestamp,
              status: "active"
            }
          ],

          startDate: Timestamp,
          completionDate: null,
          lastActivity: Timestamp
        },
        {
          id: "stage_b",
          name: "שלב ב'",
          description: "שיפורים ותיקונים",
          status: "pending",
          order: 2,

          totalHours: 40,
          hoursUsed: 0,
          hoursRemaining: 40,

          packages: [
            {
              id: "pkg_stage_b_1",
              hoursInPackage: 40,
              hoursUsed: 0,
              hoursRemaining: 40,
              status: "pending"
            }
          ]
        },
        {
          id: "stage_c",
          name: "שלב ג'",
          description: "חוו\"ד סופית",
          status: "pending",
          order: 3,

          totalHours: 40,
          hoursUsed: 0,
          hoursRemaining: 40,

          packages: [
            {
              id: "pkg_stage_c_1",
              hoursInPackage: 40,
              hoursUsed: 0,
              hoursRemaining: 40,
              status: "pending"
            }
          ]
        }
      ],

      // Service-level aggregates
      totalStages: 3,
      completedStages: 0,
      currentStage: "stage_a",

      totalHours: 110,               // סכום כל השלבים
      hoursUsed: 5.5,
      hoursRemaining: 104.5,

      createdAt: Timestamp,
      createdBy: "haim",
      lastActivity: Timestamp
    }
  ],

  // ===== LEGACY SUPPORT (READ ONLY) =====
  stages: [],                        // ריק! נשמר רק לתאימות אחורה

  // ===== CLIENT-LEVEL AGGREGATES =====
  totalHours: 210,                   // סכום כל השירותים
  hoursUsed: 31,
  hoursRemaining: 179,
  totalMinutes: 12600,
  minutesUsed: 1860,
  minutesRemaining: 10740,

  // ===== STATUS & METADATA =====
  status: "active",                  // "active" | "completed" | "archived"
  openDate: Timestamp,
  closeDate: null,
  lastActivity: Timestamp,

  // ===== FINANCIAL =====
  totalRevenue: 24800,               // סה"כ הכנסות
  totalCost: 0,                      // סה"כ הוצאות

  // ===== TIMESTAMPS =====
  createdAt: Timestamp,
  createdBy: "haim",
  lastModifiedAt: Timestamp,
  lastModifiedBy: "haim"
}
```

---

## 🔄 Migration Path

### Phase 1: Add New Structure (✅ Done)
- Added `services` array
- Added version control fields
- Kept legacy `stages` for compatibility

### Phase 2: Dual Support (✅ In Progress)
- Server code reads from BOTH structures
- Server code writes to NEW structure ONLY
- UI displays from BOTH structures

### Phase 3: Full Migration (🚧 Next)
- Migrate all existing clients to new structure
- Remove legacy code paths
- Deprecate old fields

---

## 📝 Rules for All Code

### Rule 1: Write to New Structure ONLY
```javascript
// ✅ CORRECT
const services = clientData.services || [];
const legalProcService = services.find(s => s.type === 'legal_procedure');
legalProcService.stages[0].hoursUsed += hoursWorked;

await clientRef.update({
  services: clientData.services,  // Write to new structure
  _version: nextVersion,
  _lastModified: Timestamp
});
```

```javascript
// ❌ WRONG
clientData.stages[0].hoursUsed += hoursWorked;  // Don't write to legacy!
```

### Rule 2: Read from BOTH Structures
```javascript
// ✅ CORRECT - Support both structures
let stages = [];

// Try new structure first
const legalProcService = clientData.services?.find(s => s.type === 'legal_procedure');
if (legalProcService) {
  stages = legalProcService.stages || [];
}

// Fallback to legacy structure
if (stages.length === 0 && clientData.procedureType === 'legal_procedure') {
  stages = clientData.stages || [];
}
```

### Rule 3: Service Identification
```javascript
// For legal_procedure tasks:
{
  serviceType: "legal_procedure",
  serviceId: "stage_a",              // stage ID
  parentServiceId: "srv_legal_123",  // service ID
  serviceName: "חוות דעת מעסיק"      // service name
}

// For hours tasks:
{
  serviceType: "hours",
  serviceId: "srv_hours_123",        // service ID
  parentServiceId: null,             // no parent
  serviceName: "שירותי יעוץ"
}
```

### Rule 4: Always Update Aggregates
```javascript
// When deducting hours, update:
1. package.hoursUsed
2. package.hoursRemaining
3. stage.hoursUsed
4. stage.hoursRemaining
5. service.hoursUsed (if exists)
6. service.hoursRemaining (if exists)
7. client.hoursUsed
8. client.hoursRemaining
9. client.minutesUsed
10. client.minutesRemaining
```

---

## 🎯 Benefits of This Structure

### 1. **Clarity** - ברור מה זה שירות, מה זה שלב
```
Client (חיים כהן)
├── Service: Regular Hours (שעות רגילות)
│   └── packages[]
└── Service: Legal Procedure (הליך משפטי)
    └── stages[]
        └── packages[]
```

### 2. **Flexibility** - קל להוסיף שירותים
```javascript
services.push({
  type: "consultation",
  name: "ייעוץ חד פעמי",
  pricingType: "fixed",
  fixedPrice: 5000
});
```

### 3. **Type Safety** - כל שירות עם type ברור
```javascript
if (service.type === 'legal_procedure') {
  // יש stages
  service.stages.forEach(...)
} else if (service.type === 'hours') {
  // יש packages בלבד
  service.packages.forEach(...)
}
```

### 4. **Analytics Ready** - קל לעשות דוחות
```javascript
// סה"כ שעות בהליכים משפטיים
const legalHours = services
  .filter(s => s.type === 'legal_procedure')
  .reduce((sum, s) => sum + s.hoursUsed, 0);

// סה"כ שעות רגילות
const regularHours = services
  .filter(s => s.type === 'hours')
  .reduce((sum, s) => sum + s.hoursUsed, 0);
```

---

## 🚨 Common Mistakes to Avoid

### ❌ Mistake 1: Writing to Legacy Fields
```javascript
// DON'T DO THIS!
clientData.stages[0].hoursUsed += 5;
```

### ❌ Mistake 2: Not Updating Aggregates
```javascript
// DON'T DO THIS!
stage.hoursUsed += 5;
// Missing: client.hoursUsed, client.minutesUsed, etc.
```

### ❌ Mistake 3: Mixing Structures
```javascript
// DON'T DO THIS!
if (clientData.procedureType === 'hours') {
  // But checking clientData.stages (legacy!)
  clientData.stages[0].hoursUsed += 5;
}
```

### ❌ Mistake 4: Not Checking Service Type
```javascript
// DON'T DO THIS!
const service = services[0];
service.stages[0].hoursUsed += 5;  // What if it's type="hours"?
```

---

## ✅ Checklist for Every Feature

When implementing ANY feature that touches client data:

- [ ] Does it read from BOTH structures? (new + legacy)
- [ ] Does it write to NEW structure ONLY?
- [ ] Does it update ALL aggregates?
- [ ] Does it check service type correctly?
- [ ] Does it use parentServiceId for legal_procedure?
- [ ] Does it update _version and _lastModified?
- [ ] Does it handle errors gracefully?
- [ ] Does it log actions for audit trail?
- [ ] Is it tested with BOTH structures?
- [ ] Is it documented?

---

## 📊 Summary

| Aspect | Old Structure | New Structure |
|--------|--------------|---------------|
| **Location** | `clientData.stages` | `services[].stages` |
| **Flexibility** | ❌ One procedure type only | ✅ Multiple services |
| **Type Safety** | ❌ procedureType is ambiguous | ✅ service.type is clear |
| **Hierarchy** | ❌ Flat (stages at top) | ✅ Nested (service→stages) |
| **Future Proof** | ❌ Hard to extend | ✅ Easy to add service types |
| **Analytics** | ❌ Hard to aggregate | ✅ Easy to query by type |

---

## 🔗 Related Documents

- [ENTERPRISE_V2_MIGRATION_GUIDE.md](ENTERPRISE_V2_MIGRATION_GUIDE.md)
- [ENTERPRISE_V2_GAPS_AND_LIMITATIONS.md](ENTERPRISE_V2_GAPS_AND_LIMITATIONS.md)
- [CLIENT_CASE_MODEL.md](CLIENT_CASE_MODEL.md) (if exists)

---

## 📞 Questions?

If you're implementing a feature and unsure about the structure:
1. Read this document
2. Check existing code for examples
3. Test with BOTH structures
4. Ask for code review

**Remember:** Consistency is key! 🔑
