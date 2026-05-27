# דוח מקיף: מערך הלקוחות (Clients System)

## סיכום ביצוע
מערך הלקוחות הוא מרכז חשוב במערכת. הוא משדרג, צורצים ומנהל את כל הלקוחות/תיקים.

### ארכיטקטורה עיקרית:
- Client = Case (מבנה אחוד)
- Document ID: מספר תיק (caseNumber)
- Collection: clients ב-Firestore
- Real-time Cache Sync עם listeners
- Enterprise Features: Version control, idempotency, event sourcing

## שדות לקוח קריטיים (Client document fields)

### שדות חישוביים (DERIVED) — נוצרים מ-`calcClientAggregates`

נכתבים אך ורק דרך `writeClientWithCanonicalAggregates` (functions/shared/client-writer.js). שולחים אותם כקלט ל-CFs = `invalid-argument`.

| שדה | מקור | משמעות |
|---|---|---|
| `isBlocked` | calcClientAggregates | יתרת שעות = 0 ואין override. אוטומטי. |
| `isCritical` | calcClientAggregates | יתרת שעות ≤ 5. אוטומטי. |
| `hoursUsed` / `hoursRemaining` | calcClientAggregates | סכום על שירותים billable **פעילים** |
| `minutesUsed` / `minutesRemaining` | calcClientAggregates | המרה |
| `totalHours` | סכום `svc.totalHours` של billable **פעילים** | רץ ב-helper |

**הגדרת "billable פעיל" (PR-G.3.14, 2026-05-27):**
- `!isFixedService(svc)` (לא שירות קבוע)
- `(svc.status || 'active') !== 'archived'` (לא בארכיון)
- שני סטטוסים שעדיין נספרים: `'completed'` (היסטוריית billing, ראה `functions/tests/complete-service.test.js:264-280`) ו-`'on_hold'` (השהיה זמנית — עשוי לחזור)
- ערך החוזה ההיסטורי המלא (כל הסטטוסים): `services.reduce((s, svc) => s + (svc.totalHours || 0), 0)`
- ה-SSOT של רשימת הסטטוסים שמוצאים: `functions/shared/aggregates.js → NON_AGGREGATING_STATUSES`

### שדות ידניים (MANUAL) — קלט מ-CFs

| שדה | נכתב על-ידי | משמעות |
|---|---|---|
| `status` | changeClientStatus | active \| inactive |
| `isOnHold` | changeClientStatus (PR-A.4) | הקפאה ידנית של אדמין (אי-תשלום, סכסוך, הקפאה). אורתוגונלי ל-isBlocked. |
| `assignedTo` | createClient + admin tools | רשימת עורכי דין |
| `services` | addServiceToClient + עוד | מערך שירותים — מטוטל ידנית, אבל aggregates עליו מחושבים |

### כלל אכיפה ב-User App

טוען לקוח? אל תרשום זמן אם `(client.isBlocked || client.isOnHold)`. שניהם.

ראה: `apps/user-app/js/modules/client-validation.js`, `apps/user-app/js/modules/client-hours.js`.

## אכיפת כתיבה — Firestore Rules + violations collection (PR-A.5)

### Firestore Rules — שכבת הגנה שנייה

`firestore.rules` למסד `/clients/{clientId}` מאכיף **field-level allowlist** מאז PR-A.5:

| פעולה | מותר ל-Admin Browser | חסום |
|---|---|---|
| read | ✅ | — |
| create | ✅ עם שדות אורתוגונליים בלבד (לא aggregate) | ❌ אם כולל isBlocked / isCritical / services / totalHours / hoursUsed/Remaining / minutesUsed/Remaining |
| update | ✅ עם שדות אורתוגונליים בלבד | ❌ אם נוגע ב-aggregate keys |
| delete | ✅ | — |

**Cloud Functions אינן מושפעות** — הן משתמשות ב-Admin SDK שעוקף Rules. ה-helper הקנוני (`writeClientWithCanonicalAggregates`) הוא הדרך היחידה לכתוב aggregate fields, ו-Rules מבטיחות שאין דלת אחורית מהדפדפן.

### `clientInvariantViolations` collection

כשה-helper מזהה הפרת invariant (I1/I2/I4 מ-`assertClientAggregateInvariants`), הוא:

1. **כותב רשומה ל-`clientInvariantViolations`** (fire-and-forget, מחוץ ל-transaction שנכשלה)
2. **emits structured log** `functions.logger.error('invariant_violation', { ... })` ל-Cloud Logging
3. **re-throws** את שגיאת ה-assertion — ה-write לא קורה

מבנה הרשומה:
```js
{
  timestamp: serverTimestamp,
  caller: 'changeClientStatus',           // איזה CF טריגר
  clientId: '2026069',
  error: 'invariant_violation:I1_no_billable_but_blocked [caller=...]',
  proposedAggregates: { isBlocked, isCritical, totalHours, hoursRemaining },
  servicesSummary: [{ id, type, pricingType, totalHours, status }, ...],
  auditMeta: { uid, username } | null
}
```

Read access: admins בלבד (לא User App). Write: רק CFs.

ב-PR-C יהיה Admin dashboard + WhatsApp alert.

## Kill-switch — `system_settings/invariant_enforcement` (PR-A.6)

מתג חירום מרכזי לשליטה בהתנהגות ה-helper אם משהו משתבש בפרודקשן. ניתן להחליף בלי deploy חדש.

### 3 מצבים

| מצב | התנהגות | מתי להשתמש |
|---|---|---|
| `enforce` (ברירת מחדל) | violation → throw + log + write נדחה | תקין. ייצור רגיל. |
| `log_only` | violation → log + write **עובר** עם canonical aggregates | במהלך migration של callsites חדשים (PR-B). רוצים להסתכל לפני לחסום. |
| `disabled` | assertion מדלגים לחלוטין. אין log. אין throw. | **חירום בלבד.** רק אם ה-assertion עצמו באגי. לא להשאיר ככה זמן רב. |

### איך מחליפים (admin)

1. Firebase Console → Firestore → `system_settings`
2. פותחים מסמך `invariant_enforcement` (יוצרים אם חסר)
3. שדה `mode` → אחד מ-`enforce` / `log_only` / `disabled`
4. תוקף תוך עד **60 שניות** (cache TTL לכל CF instance)

### ברירות מחדל בטוחות

כל failure path מחזיר `'enforce'`:
- מסמך חסר → enforce
- שדה `mode` חסר → enforce
- ערך לא תקין (case-sensitive, חייב להיות מ-VALID_MODES) → enforce
- Firestore read fail (permission, network) → enforce

→ misconfiguration **לא יכולה** להוריד בטיחות בשקט.

### ניטור

כל violation נרשם עם השדה `mode` בtoken — מאפשר ניתוח בדיעבד "האם זה היה enforce או log_only".

ב-Cloud Logging נחפש: `invariant_violation` או `invariant_violation_log_only`.

## קבצים עיקריים

### Frontend:
- js/modules/client-validation.js - ולידציה לקוחות, בדיקת חסימה
- js/modules/client-hours.js - חישוב שעות לקוח
- js/modules/client-case-selector.js - בחירת לקוח ותיק
- js/cases.js - ניהול תיקים (CasesManager)
- js/cases-integration.js - אינטגרציה בחירת תיקים
- js/modules/api-client-v2.js - API client

### Backend (Firebase Functions):
- functions/index.js - CRUD operations
  - createClient() - יצירה
  - getClients() - קבלה
  - updateClient() - עדכון
  - deleteClient() - מחיקה
  - addServiceToClient() - הוספת שירות
  - addPackageToService() - הוספת חבילה
- functions/validators.js - Validation schemas
- functions/addTimeToTask_v2.js - קזיזת שעות

## זרימת נתונים (Data Flow)

### יצירת לקוח:
User fills form → ClientCaseSelector validates → createClient() called
→ Server validates + idempotency check → Generate unique case number
→ Create Client/Case document in clients/{caseNumber} 
→ Update cache + emit EventBus 'case:created'

### חישוב שעות:
calculateClientHoursAccurate() → Query client + ALL timesheet_entries
→ Sum minutes → Calculate remaining → Update Firebase
→ Update local cache → Notify UI

### בחירת לקוח/תיק:
Type in search → Filter from cache (NO Firebase reads!)
→ Click client → selectClient() → Load cases
→ Click case → selectService() → Populate hidden fields

## מבנה נתונים - clients collection

clients/{caseNumber}:
{
  caseNumber: "2025001",
  clientName: "שם לקוח",
  fullName: "שם לקוח" (backward compatibility),
  createdAt: Timestamp,
  createdBy: "username",
  phone, email, address,
  procedureType: "hours" | "fixed" | "legal_procedure",
  status: "active" | "completed" | "on_hold",
  
  // שעות (for type='hours')
  totalHours: 100,
  hoursRemaining: 75.5,
  minutesRemaining: 4530,
  
  // שירותים (NEW)
  services: [
    {
      id: "srv_123",
      type: "hours" | "legal_procedure",
      name: "שם שירות",
      status: "active",
      totalHours, hoursRemaining, hoursUsed,
      packages: [
        {
          id: "pkg_123",
          hours, hoursRemaining, hoursUsed,
          status: "active" | "depleted"
        }
      ],
      stages: [  // for legal_procedure
        {
          id: "stage_a",
          name: "שלב א",
          totalHours, hoursRemaining,
          packages: [...]
        }
      ]
    }
  ],
  
  totalServices: 1,
  activeServices: 1,
  _version: 5  // enterprise feature
}

## נקודות חשודות וכפילויות

### 1. fullName vs clientName Inconsistency (CRITICAL)
- client-hours.js:23 - שורה חיפוש לפי "fullName"
- client-hours.js:35 - שורה חיפוש לפי "clientName"
- שדות שונים עלול להיות סינכרון שגוי

### 2. אין מניעת כפילויות (CRITICAL)
- אפשר ליצור שני לקוחות עם אותו שם
- כלא unique constraint על clientName
- שאילתה לפי שם יכולה להחזיר לקוח שגוי

### 3. אין cascading delete (MEDIUM)
- מחיקת לקוח לא מוחקת:
  - timesheet entries (יתומים)
  - budget tasks (יתומים)
  - historical data

### 4. אין version control בעדכון (MEDIUM)
- updateClient() לא בודק גרסה
- Lost update problem אם שני משתמשים עוריכים בו-זמנית

### 5. שדות שעות מכופלים (MEDIUM)
- totalHours
- hoursRemaining
- minutesRemaining
- hoursUsed
- totalMinutesUsed (בtimesheet)

סינכרון בין שדות עלול להישבר.

### 6. לא ברור Source of Truth (MEDIUM)
- hoursRemaining בדקומנט - או
- חישוב לפי timesheet_entries - live

אם timesheet שגוי, hoursRemaining שגוי.

### 7. מבנה Services משתנה (MEDIUM)
- Legacy: client.stages[]
- New: client.services[].stages[]
קוד צריך להתמודד עם שניהם.

### 8. לא pagination (MINOR)
- getClients() טוען את כל הדקומנטים
- בעיה ביצועים עם אלפים של לקוחות

### 9. Race condition ביצירת case number (MINOR)
- שני creates יכולים ליצור את אותו מספר
- קוד עושה recursive retry, אבל לא אידיאלי

## פונקציות CRUD

### CREATE - createClient() [functions/index.js:710]
Input Validation:
- clientName: string, min 2 chars
- phone: Israeli format (optional)
- email: valid email (optional)
- procedureType: "hours" | "fixed" | "legal_procedure"
- totalHours: number > 0 (if hours)
- stages: array of 3 (if legal)

Features:
- Idempotency protection
- Auto-generates case number
- Race condition handling
- Creates services/packages structure
- Event sourcing
- Audit logging

### READ - getClients() [functions/index.js:1544]
- Returns ALL clients
- No pagination
- No filtering
- Performance concern with large datasets

### UPDATE - updateClient() [functions/index.js:1582]
Allowed: fullName, phone, email
Issues:
- No version control
- No optimistic locking

### DELETE - deleteClient() [functions/index.js:1680]
Issues:
- Hard delete only (no soft delete)
- No cascading delete
- Orphaned records

## אינטגרציות חשובות

עם Timesheet:
- createTimesheetEntry() קוזז שעות מהלקוח
- calculateClientHoursAccurate() סוכם entries

עם Task/Budget:
- createBudgetTask() ties to client/case
- addTimeToTask() קוזז שעות
- completeTask() updates hours

עם Legal Procedures:
- Support 3-stage procedures
- Separate allocation per stage
- Support fixed-price stages

## מלצות תיקון

CRITICAL:
1. Normalize fullName vs clientName → use only clientName
2. Add UNIQUE constraint on clientName
3. Add version control to updateClient()
4. Implement cascading delete

MEDIUM:
5. Add pagination to getClients()
6. Consolidate hours fields
7. Clear Source of Truth for hours
8. Unify service structure

OPTIONAL:
9. Add search indexes
10. Monitor audit logs
11. Regular validation tests

## File Locations

C:\Users\haim\law-office-system\js\modules\client-validation.js
C:\Users\haim\law-office-system\js\modules\client-hours.js
C:\Users\haim\law-office-system\js\modules\client-case-selector.js
C:\Users\haim\law-office-system\js\modules\api-client-v2.js
C:\Users\haim\law-office-system\js\cases.js
C:\Users\haim\law-office-system\js\cases-integration.js
C:\Users\haim\law-office-system\functions\index.js
C:\Users\haim\law-office-system\functions\validators.js
C:\Users\haim\law-office-system\functions\addTimeToTask_v2.js

