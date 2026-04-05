# SYSTEM STATUS — GH Law Office System
## law-office-system-e4801

**מנוהל על ידי:** טומי — ראש צוות הפיתוח
**עדכון אחרון:** 2026-04-05
**סטטוס:** System Settings centralization + Audit Trail — PROD
**PRs:** #144, #145, #146, #166, #168, #169, #170, #171, #172, #173, #176, #177, #178, #183, #188, #189, #190, #191

---

## 1. מצב נוכחי

### Branches

```
main:               deb8dc2 — System Settings + Audit Trail + UI fixes
production-stable:  merged PR #191
אין branches פתוחים.
```

### PRs שמוזגו ל-production-stable (כרונולוגי)

| PR | תאריך | תיאור |
|----|--------|-------|
| #110–#115, #118, #120 | עד 15/2 | atomicity, data reconciliation, auth fixes, UI |
| #131 | ~20/2 | Refactor: services — כתיבה ישירה → Cloud Functions |
| #133 | ~24/2 | Refactor: פיצול index.js גל 1 — ניקוי 2,543 שורות קוד מת |
| #134 | ~25/2 | Refactor: פיצול index.js גל 2 — shared, scheduled, whatsapp, metrics, admin |
| #135 | ~26/2 | Refactor: פיצול index.js גל 3 — auth, budget-tasks, clients, services, timesheet |
| #144 | 4/3 | Trigger + הסרת deduction מ-4 פונקציות + 3 bug fixes |
| #145 | 5/3 | Cache invalidation ב-5 callers אחרי timesheet operations |
| #146 | 9/3 | Service blocked enforcement — כל 4 נקודות כניסה ל-timesheet_entries |
| #147 | 12/3 | caseOpenDate — תיקון דוח "מההתחלה" + עריכת תאריך פתיחת תיק + מיגרציה (31 לקוחות) |
| #148 | 15/3 | Service Override — חריגה מבוקרת על שירות חסום |
| #149 | 16/3 | Trigger hours reconciliation — 3 bug fixes + validation + invariant check + reconciliation 10 clients |
| #151 | 18/3 | מיגרציה: 39 stages pricingType + 4 tasks actualMinutes |
| #153 | 18/3 | fix: fixed-service לא נחסם — calcClientAggregates + applyLegalProcedureDelta + ServiceOverdraftResolution |
| #155 | 20/3 | fix: services/index.js — exclude fixed services from client aggregates + cleanup 16 clients |
| #156 | 21/3 | Perf: defer 28 scripts + CDN optimization + minInstances on 4 functions |
| #157 | 21/3 | Hotfix: logger.js back to blocking |
| #158 | 21/3 | Hotfix: lottie CDN back to head |
| #159 | 21/3 | Hotfix: lottie-animations + lottie-manager back to blocking |
| #160 | 21/3 | Hotfix: feature-flags.js back to blocking (lottie root cause) |
| #161 | 21/3 | Refactor: consolidate loading systems — NS calls UnifiedLoadingOverlay directly |
| #163 | 22/3 | Perf: remove 6 dead/dev scripts + lazy-load KB bundle |
| #164 | 22/3 | Cleanup: remove 2 orphaned function-monitor scripts |
| #166 | 22/3 | Performance: budget tasks — הסרת getUserMetrics callable, ספירה מקומית, הסרת double render |
| #168 | 22/3 | Performance: login flow — fire-and-forget post-login tasks, fix loginCount double increment, remove redundant queries |
| #169 | 22/3 | Performance: silence console.log/info/debug in PROD with debug backdoor |
| #170 | 22/3 | fix: activate PresenceSystem — Firestore rules, CSP wss://, connect() fields, RTDB deploy |
| #171 | 22/3 | hotfix: handle Timestamp in loadMonthlyTimesheetStats date comparison |
| #172 | 23/3 | cleanup: remove dead EventBus listeners from statistics.js |
| #173 | 23/3 | fix: conditional AI Chat loading — skip if no API key |
| #174 | 25/3 | fix: backfill orphan entries in addPackageToService — מניעת entries ללא packageId |
| #176 | 26/3 | Security hardening: XSS sanitization (DOMPurify), deterministic idempotency key, password exposure fix |
| #177 | 29/3 | Architectural: deduction moved from trigger into callable transactions — atomic entry+deduction+aggregates |
| #178 | 30/3 | fix: serviceId validation gates on all 3 entry paths + addServiceToClient wrapped in transaction |
| #183 | 3/4 | fix: Quick Log date type mismatch — Timestamp→string "YYYY-MM-DD" + WhatsApp Bot queries + migration 177 entries |
| #188 | 5/4 | feat: Fixed service type — שירות קבוע (מחיר פיקס, מעקב שעות ללא חסימה) + refactor saveNewService → Cloud Function |
| #189 | 5/4 | refactor+feat: System Settings Phase 1+2 — ריכוז 170+ constants ב-42 קבצים + Firestore system_config + Settings page |
| #190 | 5/4 | fix: admin email uri@ → roi@ |
| #191 | 5/4 | feat: Audit Trail page — לוג פעילות עם סינון, תרגום עברית, badges צבעוניים |

---

## 2. Timesheet Deduction Architecture (PR #144 → #177)

### היסטוריה
- **PR #144 (4/3):** Trigger מרכזי — הסרת deduction מ-4 callables, ריכוז בטריגר בלבד
- **PR #177 (29/3):** החזרת deduction לתוך הטרנזקציה של ה-callable — אטומיות מלאה

### הבעיה שהייתה (לפני #177)
Callable יוצר entry → Trigger רץ בנפרד ומקזז. אם הטריגר מדלג (serviceId חסר, timeout) — entry קיים אבל שעות לא קוזזו בשקט.

### המצב הנוכחי (אחרי #177)
Callable יוצר entry + מקזז + מעדכן aggregates + מעדכן task — **הכל באותה טרנזקציה**.
הטריגר נשאר כרשת ביטחון ל-UPDATE/DELETE ול-entries ישנים.

### Contract: callable ↔ trigger

```
CREATE + deductedInTransaction: true   → trigger מדלג (callable כבר טיפל)
CREATE + deductedInTransaction: false  → trigger רץ כרגיל (backward compatible)
UPDATE (כל entry)                      → trigger תמיד רץ
DELETE (כל entry)                      → trigger תמיד רץ
```

### Shared Module

`functions/src/modules/aggregation/index.js` — מקור אחד ללוגיקת קיזוז.
משמש גם callables וגם trigger — אותן פונקציות, אותן תוצאות.

### Flow — CREATE (חדש, #177)

```
Callable (createQuickLogEntry / createTimesheetEntry_v2 / addTimeToTask)
  → Firestore Transaction:
    → transaction.get(clientRef)
    → resolve serviceId (1 service=auto, >1=ERROR, 0=skip)
    → applyHoursDelta / applyLegalProcedureDelta (from aggregation module)
    → calcClientAggregates → 6 שדות: hoursUsed, hoursRemaining, minutesUsed, minutesRemaining, isBlocked, isCritical
    → overage דו-שכבתי: package-level + client-level
    → transaction.update(clientRef, { services, aggregates })
    → transaction.update(taskRef, { actualMinutes, actualHours })  [if taskId]
    → transaction.set(entryRef, { ...entry, deductedInTransaction: true, isOverage, overageMinutes })
  → Trigger fires → deductedInTransaction: true → return null
```

### Flow — UPDATE / DELETE (לא השתנה)

```
Entry מתעדכן/נמחק ב-timesheet_entries
  → onTimesheetEntryChanged (Trigger, Gen 2)
    → eventType UPDATE/DELETE → רץ תמיד
    → מחשב delta
    → applyHoursDelta / applyLegalProcedureDelta (from aggregation module)
    → calcClientAggregates
    → Transaction: client + entry (isOverage) + task (actualMinutes)
```

### Service lookup
- `hours`: serviceId מה-entry → service ישירות
- `legal_procedure`: `lookupServiceId = parentServiceId || serviceId`
- `fixed`: serviceId מה-entry → service ישירות. מעקב שעות בלבד (`work.totalMinutesWorked`), ללא חסימה

### Service Types

| סוג | תמחור | חסימה | מבנה | דיווח שעות |
|-----|--------|-------|------|-----------|
| `hours` | חבילות שעות | כן (hoursRemaining ≤ 0) | packages[] | ניכוי מחבילה |
| `legal_procedure` (hourly) | שעות לכל שלב | כן | stages[] → packages[] | ניכוי משלב |
| `legal_procedure` (fixed) | פיקס לכל שלב | לא | stages[] | מעקב בלבד |
| `fixed` | מחיר קבוע | לא | work{} | מעקב בלבד (totalMinutesWorked) |

---

## 3. פיצול functions/index.js — הושלם (PRs #133–135)

**לפני:** 9,614 שורות, 66 exports, הכל בקובץ אחד
**אחרי:** 104 שורות, registry בלבד

```
functions/
├── index.js              ← 104 שורות, registry בלבד
├── shared/               ← auth, audit, validators
├── auth/                 ← 5 פונקציות
├── budget-tasks/         ← 7 פונקציות
├── clients/              ← 7 פונקציות + helper
├── services/             ← 7 פונקציות
├── timesheet/            ← 4 פונקציות + 8 helpers + internal-case
├── scheduled/            ← 3 פונקציות (כולל dailyInvariantCheck)
├── whatsapp/             ← 4 פונקציות
├── metrics/              ← 2 פונקציות
├── fee-agreements/       ← 2 פונקציות
├── admin/                ← 12 פונקציות (כולל system-config: 3)
├── triggers/             ← onTimesheetEntryChanged
├── addTimeToTask_v2.js   ← פונקציה עצמאית
└── src/                  ← מודולים פנימיים
```

---

## 4. מצב אטומיות — כל הפונקציות

| פונקציה | אטומי? | סיכומים | סטטוס |
|---------|--------|---------|-------|
| `createTimesheetEntry_v2` | ✅ כן | Trigger | פעיל |
| `createQuickLogEntry` | ✅ כן | Trigger | פעיל |
| `updateTimesheetEntry` | ✅ כן | Trigger | פעיל |
| `addTimeToTask` | ✅ כן | Trigger | פעיל |
| `completeTask` | ✅ כן | — | פעיל |
| `cancelBudgetTask` | ✅ כן | — | פעיל |
| `createBudgetTask` | ✅ כן | — | פעיל |
| `adjustTaskBudget` | ✅ כן | — | פעיל |
| `onTimesheetEntryChanged` | ✅ Trigger | מקור יחיד | פעיל |
| `dailyInvariantCheck` | ✅ Scheduled | בקרה | פעיל |
| `createTimesheetEntry` (v1) | ❌ | — | **נמחק** (`e9333f0`) |

---

## 5. ארכיטקטורת Transaction

| סוג | בתוך Transaction? | סיבה |
|-----|-------------------|------|
| Data עיקרי (task, entry, client) | ✅ כן | חייב להיות עקבי |
| Approval records | ✅ כן | משפיע על UI |
| Audit log | ❌ לא | Secondary — לא חוסם משתמש |
| Alerts / Notifications | ❌ לא | Secondary — לא חוסם משתמש |

---

## 6. החלטות ארכיטקטוניות (לא לשנות בלי דיון)

| החלטה | סיבה |
|-------|------|
| **Trigger = מקור יחיד לסיכומים** | מקום אחד, לוגיקה אחת. הפונקציות לא מחשבות סיכומים |
| **lookupServiceId = parentServiceId ‖ serviceId** | ב-legal_procedure, serviceId ב-entry = stageId, לא service ID |
| **Self-write guard מפורש** | אם רק isOverage/overageMinutes השתנו → skip. מונע infinite loop |
| **timesheet_entries = מקור אמת** | כל פער מתוקן לפי entries |
| **Immutable pattern ב-transactions** | spread operator, לא mutation — מונע double-update ב-retry |
| **Eventarc authentication לוקח זמן** | Gen 2 — שגיאה שקטה ראשונה אחרי deploy אינה באג קוד |
| **cache invalidation מיד, בלי setTimeout** | onSnapshot listener תופס את העדכון |
| **dist/ ב-git** | Netlify לא בונה — לא להסיר בלי לתקן build |
| **v1 לא fallback** | Fail-fast עדיף על fallback לקוד לא אטומי |
| **Audit log מחוץ ל-Transaction** | Secondary — לא חוסם משתמש |
| **Functions deploy אחרון, לא ראשון** | Frontend חייב להיות מעודכן לפני שינוי Functions |
| **set+merge במקום dot notation** | Firestore מפרש נקודות ב-field path כ-nested objects |
| **auth-guard ממתין ל-firebase:ready event** | מונע הבהוב login screen לפני ש-Firebase מסיים init |
| **Pre-flight auth check בכל דף Admin** | Optimistic loading — sessionStorage check לפני Firebase |
| **auth-optimistic class pattern ל-index.html** | index.html הוא גם login page — לא ניתן להחליף AuthSystem |
| **overrideActive על service, לא client** | חריגה מבוקרת ברמת שירות בלבד — לא משפיעה על שאר השירותים |
| **readBy ב-Firestore — field שטוח** | email כ-key, לא nested. set+merge בלבד |
| **Netlify build = echo** | Workaround ל-tsc Permission denied. חוב טכני |
| **REQUIRED_STAGE_FIELDS protocol** | כל PR שמוסיף שדה חדש ל-stage/service חייב לעדכן: (1) REQUIRED_STAGE_FIELDS ב-dailyInvariantCheck (2) סקריפט reconciliation |
| **חישוב סטטיסטיקות budget tasks = client-side בלבד** | הנתונים כבר בזיכרון (onSnapshot). getUserMetrics Cloud Function נשארת אבל לא נקראת מהקליינט |
| **post-login tasks = fire-and-forget** | CaseNumberGenerator, logLogin, PresenceSystem רצים אחרי showApp בלי await |
| **loadMonthlyTimesheetStats = client-side** | מחושב מ-timesheetEntries שבזיכרון, לא Firebase query |
| **PresenceSystem = Firestore heartbeat + RTDB onDisconnect** | lastSeen+isOnline כל 5 דקות ל-Firestore, RTDB ל-real-time presence |
| **Firestore rules exception ל-presence fields** | employees doc — user יכול לעדכן lastSeen+isOnline על עצמו |
| **SYSTEM_CONSTANTS = canonical + 3 adapters** | 3 codebases עם module systems שונים (CommonJS, IIFE, IIFE). Sync test מוודא סנכרון. שינוי ב-canonical → עדכון 3 adapters + run test |
| **system_config בתוך _system collection** | מתחבר ל-pattern הקיים של caseNumberCounter. Readable by all authenticated, writable only by Admin SDK |
| **Settings page = utility icon, לא nav tab** | חוסך מקום בסרגל. גלגל שיניים + שעון (audit trail) באזור utility שמאלי |
| **AI Chat = conditional loading** | ai-config נטען ראשון, אם אין API key — שאר הסקריפטים לא נטענים |
| **DOMPurify = XSS sanitization** | נטען מ-CDN עם defer. `purify()` helper עם fallback לידני. חובה על כל innerHTML עם נתוני Firestore |
| **password לעולם לא ב-client memory** | `getEmployee()` ו-`loadAllEmployees()` לא מחזירים password. `authenticate()` קורא ישירות, משווה, וזורק |
| **Idempotency key = deterministic** | `timesheet_{employee}_{date}_{actionHash}_{minutes}_{contextHash}`. ללא timestamp — אותו payload = אותו key |

---

## 7. Reconciliation — תיקון נתונים היסטוריים

| תאריך | סקריפט | תוצאה |
|-------|--------|-------|
| 2026-02-09 | `reconciliation-fix-execute.js` | 13 שירותים, 12 לקוחות |
| 2026-02-09 | `reconciliation-fix-remaining.js` | 18 שירותים, 66 לקוחות |
| 2026-03-04 | `reconciliation-execute-2026-03-04.js` | 84 לקוחות, 0 שגיאות |

**עיקרון:**
```
Service: hoursUsed = SUM(timesheet_entries.minutes) / 60
Service: hoursRemaining = totalHours - hoursUsed
Client root: hoursUsed = SUM(services[].hoursUsed)
Client root: minutesUsed = hoursUsed * 60
```

---

## 7א. ניקוי נתוני בדיקה — בוצע (2026-03-15)

### מה נמצא
רשומות על 5 לקוחות שלא קיימים ב-clients (נמחקו בעבר):
2026021, 2026005, 2025003, 2025010, 2026020

### מה נמחק
- 12 timesheet_entries על לקוחות לא קיימים
- 14 budget_tasks על לקוחות לא קיימים
- 1 כפילות של marva על clientId 2026003 (26 דקות, 2026-01-27)
- סה"כ: 27 רשומות, 0 שגיאות

### מה נשאר פתוח
- uzi — 330 דקות על משימה בוטלת (2025549, רעות ואוריאל חליבה) — ממתין לבירור עם עוזי

---

## 7ב. Service Override — חריגה מבוקרת (PR #148)

### הבעיה שהייתה
שירות שנגמרו שעותיו חסום לחלוטין — אין דרך להמשיך לדווח גם אם admin רוצה לאשר המשך עבודה.

### הפתרון
Admin מאשר חריגה על שירות ספציפי → העובד ממשיך לדווח → isOverage: true נשמר על כל רשומה → חיוב לפי מה שנרשם בפועל.

### קבצים שהשתנו
- functions/clients/index.js — CF חדש: setServiceOverride (transaction + audit log)
- functions/index.js — export
- functions/addTimeToTask_v2.js — bypass חסימה אם overrideActive
- functions/timesheet/index.js — bypass חסימה (3 מקומות)
- apps/admin-panel/js/ui/ClientManagementModal.js — כפתור אפשר/בטל חריגה + modal
- apps/admin-panel/js/ui/ClientsTable.js — badge "חריגה מאושרת" בטבלה

### החלטות ארכיטקטוניות
- overrideActive על service object (לא client) — ברמת שירות בלבד
- overrideApprovedBy + overrideApprovedAt + overrideNote — לתיעוד וביקורת
- Trigger לא השתנה — isOverage ממשיך להיכתב אוטומטית
- ביטול override = חסימה מיידית

---

## 7ג. Trigger Hours Reconciliation (PR #149, 2026-03-16)

### בעיות שתוקנו
1. getActivePackage — מחזיר package גם כש-hoursRemaining ≤ -10 כשיש overrideActive=true
2. addServiceToClient — מעתיק pricingType לכל stage בעת יצירה
3. createBudgetTask — serviceId חובה (validation חדש)
4. TaskFormValidator — שירות חובה בטופס יצירת משימה
5. dailyInvariantCheck — הרחבה: parentServiceId ל-legal_procedure, fixed services עם totalHoursWorked, 3 בדיקות חדשות, REQUIRED_STAGE_FIELDS validation
6. 39 stages — מולאו pricingType מה-service parent

### Reconciliation — 2026-03-16
- 10 לקוחות תוקנו | 14 services | 12 tasks | 19 entries שוייכו | 0 שגיאות

### לקוחות שתוקנו
שרי פדרגרין +17.5h, קובי הראל +18.83h, מרום הנדסה +14.16h,
רעות חליבה +12.75h, תמיר אקווע +3.84h, חזי מאנע +2h,
אבי אליהו +1.75h, מורדי דבח +0.5h, שייקסטופ +0.41h, ד"ר וסרמן +0.25h

---

## 7ד. מיגרציה stage.pricingType (2026-03-18)

### הבעיה
39 stages על 13 services legal_procedure נוצרו ללא pricingType.
הטריגר לא ידע לזהות fixed vs hourly → דילג → actualMinutes = 0.
התגלה כשמרווה דיווחה שאינה יכולה לסמן משימה כהושלמה (שרית רוזנס).

### מה בוצע
- 39 stages קיבלו pricingType מה-service parent
- 4 tasks תוקן actualMinutes (מקור אמת: timesheet_entries)
- task 7KaLpvo (ארנון פטר) — דולג בכוונה (flow שונה)
- 0 שגיאות

### לקוחות שטופלו
תמיר אקווע, שייקסטופ, מרום הנדסה, אלעד מידר,
רעות חליבה, שרית רוזנס, קובי הראל, ארנון פטר,
אורן קניג, רון פישמן

---

## 7ה. תיקון חסימה שגויה על fixed services (PR #153, 2026-03-18)

### הבעיה
לקוחות עם שירות legal_procedure + fixed הוצגו כחסומים.
הסיבה: הטריגר חישב hoursRemaining = (0 - hoursUsed) על fixed service (שאין לו totalHours) → תמיד שלילי → isBlocked = true.

### מה תוקן
1. calcClientAggregates — מסנן fixed services לפני חישוב isBlocked
2. applyLegalProcedureDelta — fixed service מקבל hoursRemaining = null
3. ServiceOverdraftResolution — לא מציג overdraft על fixed service
4. Reconciliation — 22 לקוחות תוקנו, 25 services קיבלו hoursRemaining = null, 15 לקוחות הוסרה חסימה שגויה

### לא תקרה שוב
- שירות fixed חדש לא יקבל hoursRemaining
- הטריגר מסנן fixed לפני חישוב isBlocked
- dailyInvariantCheck יתפוס חריגות עתידיות

---

## 7ו. services/index.js — סינון fixed מחישוב client aggregates (PR #155, 2026-03-20)

### הבעיה
6 פונקציות ב-services/index.js חישבו client-level aggregates (hoursUsed, hoursRemaining, isBlocked, isCritical) ללא סינון fixed services, ועם נוסחה שונה מהטריגר: `sum(service.hoursRemaining)` במקום `totalHours - hoursUsed`.

### מה תוקן
1. Helper חדש: `calcClientAggregates(services, clientTotalHours)` — זהה רעיונית ל-trigger
2. `isFixedService(svc)` + `round2(n)` — helpers משותפים
3. 6 פונקציות הוחלפו מ-inline logic ל-helper: addServiceToClient, addPackageToService, addHoursPackageToStage, completeService, changeServiceStatus, deleteService
4. Fixed-only clients: `isBlocked=false`, `isCritical=false` (לא ייחסמו)
5. `minutesUsed` נכתב ל-Firestore (יישור עם trigger)
6. הוסר `clientData.type === 'hours'` check

### Cleanup
- 16 clients תוקנו (11 fixed-only, 5 mixed)
- Validation script: `devtools/validate-client-aggregates-2026-03-19.js`
- Cleanup script: `scripts/cleanup-client-aggregates-2026-03-19.js`
- Backup: `backups/cleanup-client-aggregates-2026-03-19.json`

### לא תקרה שוב
- כל 6 הפונקציות משתמשות ב-helper אחד (אין שכפול)
- נוסחה זהה ל-trigger: `totalHours - hoursUsed`
- Fixed services מסוננים לפני כל חישוב

---

## 7ז. Performance Optimization — PR #156-#160 (2026-03-21)

### מה בוצע
- **28 scripts deferred** (מתוך 40 blocking מקוריים)
- **3 CDN libs:** lottie ב-head, xlsx+DOMPurify deferred ב-body
- **4 Cloud Functions:** minInstances:1, memory:512MB, timeout:120s
- **5 hotfixes** לתיקון תלויות שלא זוהו: logger, lottie chain, feature-flags
- **firebase-tools** עודכן ל-15.11.0

### Scripts שחזרו ל-blocking (5)
| Script | סיבה |
|--------|-------|
| logger.js | תלויות blocking של סקריפטים אחרים |
| lottie CDN (head) | חייב להיטען לפני animations |
| lottie-animations.js | animation triggers fire לפני defer load |
| lottie-manager.js | חייב להיטען לפני NotificationSystem |
| feature-flags.js | loading-wrapper.js קורא SHARED_UI_CONFIG ב-init |

### ממצא: שתי מערכות loading מקבילות — **טופל ב-PR #161**
- **NotificationSystem** (ישנה, אוקט 2025) — `#lottie-loader`, דרך LottieManager, אין auto-timeout
- **UnifiedLoadingOverlay** (חדשה, נוב 2025) — `#unified-lottie-container`, ישירות דרך lottie, auto-timeout 30s
- **loading-wrapper.js** — שכבת תאימות, מפנה ל-Unified אם `USE_SHARED_LOADING=true`
- **feature-flags.js** — `USE_SHARED_LOADING: true` (מופעל)

### PR #161: Loading Consolidation (2026-03-21)
- **notification-system.js** — showLoading/hideLoading קוראים ישירות ל-UnifiedLoadingOverlay (lazy singleton)
- **loading-wrapper.js** הוסר מ-index.html (קובץ נשאר בדיסק ל-rollback)
- **אין שינוי API** — כל הקוראים (ui-components, case-creation-dialog, notification-bridge) לא השתנו
- מבטל: race condition עם feature-flags, indirection דרך wrapper, שתי מערכות מקבילות

### Audit 28 deferred scripts (2026-03-21)
- **23 SAFE** — אין blocking script שתלוי בהם ב-init time
- **3 NEEDS REVIEW** (mitigated):
  - service-card-renderer.js + client-search.js — `window.safeText` race (fallback מקומי קיים, לא crash)
  - selectors-init.js — auto-init ב-DOMContentLoaded, EventBus guard קיים
- **0 UNSAFE**

### PR #163: Script Cleanup + KB Lazy Loading (2026-03-22)
- **6 dead/dev scripts הוסרו מ-HTML** (קבצים בדיסק):
  - xlsx.full.min.js (500KB CDN, אפס references)
  - function-monitor-init.js (infinite polling bug — FirebaseOps לא מוגדר)
  - fix-old-clients.js, validation-script.js (dev console tools)
- **5 KB scripts → lazy load** על לחיצת "עזרה" דרך LazyLoader.loadScriptsSequentially
  - סדר: icons → data → search → analytics → knowledge-base
  - Trigger: `[data-help-trigger]` click ב-authentication.js showApp()

### PR #164: Function Monitor Cleanup (2026-03-22)
- **2 orphaned scripts הוסרו** — function-monitor.js + function-monitor-dashboard.js
- היו dependencies של function-monitor-init.js שהוסר ב-PR #163

### Performance Results — 2026-03-22

| מדד | Before | After |
|-----|--------|-------|
| Full Load | 13.7s | 2.7s |
| Scripts | 113 | 102 |
| Size | 893KB | 688KB |
| Cold starts | all functions | minInstances on 4 |

- 28 scripts deferred, 11 removed, KB lazy on help click
- Loading systems consolidated (2 → 1)
- Functions: minInstances:1, 512MB, 120s timeout

---

## 8. ארכיטקטורת המערכת

### שני Netlify Sites מאותו Repo

| Site | URL PROD | Build |
|------|----------|-------|
| User App | `gh-law-office-system.netlify.app` | `npm run cache-bust && npm run type-check && npm run compile-ts` (prod: echo) |
| Admin Panel | `admin-gh-law-office-system.netlify.app` | `echo` (static) |

### Firebase

| רכיב | כמות |
|------|------|
| Firestore Collections | 21 |
| Cloud Functions | 76 |
| onCall | ~68 |
| onSchedule | 3 |
| onDocumentWritten (Trigger) | 2 |
| onRequest | 3 |

### URLs

| סביבה | User App | Admin Panel |
|-------|----------|-------------|
| DEV | `https://main--gh-law-office-system.netlify.app` | `https://main--admin-gh-law-office-system.netlify.app` |
| PROD | `https://gh-law-office-system.netlify.app` | `https://admin-gh-law-office-system.netlify.app` |

---

## 8א. מבנה Repo — Monorepo (עודכן 2026-03-23)

המעבר ל-monorepo בוצע בין 09/03 ל-23/03. התיעוד הישן מתייחס לנתיבים הקודמים.

### נתיבים חדשים vs ישנים

| ישן | חדש |
|-----|-----|
| `js/main.js` | `apps/user-app/js/main.js` |
| `js/modules/` | `apps/user-app/js/modules/` |
| `master-admin-panel/` | `apps/admin-panel/` |
| `master-admin-panel/js/` | `apps/admin-panel/js/` |
| `functions/` | `functions/` — ללא שינוי |

### Netlify publish paths
- User App: `publish = "apps/user-app"`
- Admin Panel: `base = "apps/admin-panel"`

---

## 8ב. System Constants Centralization (PR #189, 2026-04-05)

### הבעיה
100+ ערכי קונפיגורציה (service types, pricing types, stage IDs, roles, admin emails) היו hardcoded ב-25+ קבצים. שינוי ערך דרש עדכון ידני בכל המקומות.

### Phase 1 — ריכוז קוד (PR #189)
- **Canonical source:** `shared/system-constants.js`
- **3 Adapters:** Functions (CommonJS), Admin Panel (IIFE), User App (IIFE)
- **Sync test:** `tests/sync-constants.test.js` — 9 tests, מוודא שכל ה-adapters זהים
- **42 קבצים עודכנו**, ~170 מיקומים הוחלפו בהפניות ל-`SYSTEM_CONSTANTS`
- **אפס שינוי התנהגות** — אותם ערכים בדיוק, רק מרוכזים

### Phase 2 — Firestore Config + Settings Page (PR #189)
- **Firestore:** `_system/system_config` — מקור אמת דינמי
- **History:** `_system_config_history/v{N}` — כל גרסה נשמרת
- **3 Cloud Functions:** `updateSystemConfig` (admin, validation, optimistic locking, atomic backup), `getSystemConfig`, `rollbackSystemConfig`
- **Config Loader:** טוען מ-Firestore עם fallback ל-static constants
- **Settings page:** `apps/admin-panel/settings.html` — ניהול admin emails, business limits, idle timeout, service type labels, role labels
- **שלבי הליך = read-only** — 3 מעגלי הגנה (UI disabled, Cloud Function reject, Firestore rules)

### קבצים חדשים
```
shared/system-constants.js              ← canonical source
functions/shared/constants.js           ← CommonJS adapter
apps/admin-panel/js/core/system-constants.js  ← IIFE adapter
apps/user-app/js/core/system-constants.js     ← IIFE adapter
tests/sync-constants.test.js            ← sync verification
functions/admin/system-config.js        ← 3 Cloud Functions
functions/scripts/init-system-config.js ← idempotent seed script
apps/admin-panel/js/core/config-loader.js     ← Firestore loader
apps/user-app/js/core/config-loader.js        ← Firestore loader
apps/admin-panel/settings.html          ← Settings page
apps/admin-panel/js/ui/SystemSettingsPage.js  ← Settings UI
apps/admin-panel/css/settings.css       ← Settings styles
```

### החלטות ארכיטקטוניות
| החלטה | סיבה |
|-------|------|
| 3 adapters + sync test (לא build step) | פשטות. Sync test תופס drift ב-pre-commit |
| Backup בתוך transaction | אטומי — אין חלון שבו backup לא עקבי |
| History collection (לא single backup) | rollback לכל גרסה, לא רק אחת אחורה |
| `_system/system_config` readable by all authenticated | Config לא רגיש, חוסך Cloud Function call |
| Stage count locked בקוד | שינוי דורש data migration על כל ה-clients |

---

## 8ג. Audit Trail Page (PR #191, 2026-04-05)

### מה נבנה
דף admin חדש — `apps/admin-panel/audit-trail.html` — מציג את כל הפעילות המתועדת במערכת.

### מקורות נתונים
- **`activity_log`** — פעילות משתמשים (login, create_task, edit_timesheet, etc.)
- **`audit_log`** — פעולות מנהל (USER_CREATED, UPLOAD_FEE_AGREEMENT, ADJUST_BUDGET, etc.)

### יכולות
- **Source tabs:** הכל / פעילות משתמשים / פעולות מנהל
- **סינון:** סוג פעולה, משתמש (שם/מייל), טווח תאריכים
- **תרגום מלא:** כל הפעולות + שדות פרטים בעברית
- **פורמט ערכים:** דקות→שעות, תאריכים→DD/MM/YYYY, bytes→KB/MB, אחוזים עם %, booleans→כן/לא
- **מזהים טכניים מוסתרים:** taskId, entryId, idempotencyKey, etc.
- **Pagination:** 50 לעמוד, שליפת 500 אחרונות מ-Firestore
- **Read-only** — אין mutations, אין Cloud Functions חדשות

### קבצים חדשים
```
apps/admin-panel/audit-trail.html
apps/admin-panel/js/ui/AuditTrailPage.js
apps/admin-panel/css/audit-trail.css
```

---

## 9. תהליך Deploy (חובה)

```
1. Push ל-main + Netlify DEV build ירוק
2. Smoke test על DEV
3. PR + Merge ל-production-stable
4. ⚠️ ודא Netlify PROD build ירוק + Published
5. רק אחרי Frontend מעודכן → firebase deploy --only functions
6. Smoke test על PROD
7. Cache bust (Ctrl+Shift+R) + בדיקת Console
```

**כלל: Functions deploy אחרון, לא ראשון!**

---

## 7ח. Reconciliation + Backfill Fix (PR #174, 2026-03-25)

### הבעיה
entries שנוצרו ללא packageId (לפני שחבילה נוספה) — הטריגר דילג עליהם → hoursUsed לא עודכן → דוחות PDF הציגו 0 התקדמות.

### חקירה
סקריפט `devtools/investigate-4-clients-2026-03-25.js` — חקירת 4 לקוחות:
- **חזי מאנע**: 55 entries ללא packageId, **218.76h חסרות** (29.39 → 248.15)
- **רבקה דרמר**: Service level תקין, Package level מעוות
- **קובי הראל**: 21 entries ללא packageId, stage_b.totalHoursWorked חסר

### Reconciliation — 2026-03-25
- סקריפט: `scripts/reconcile-hours-2026-03-25.js`
- **20 לקוחות תוקנו**, 0 שגיאות
- DRY-RUN → EXECUTE → הרצה חוזרת: Affected=0 (idempotency אומתה)
- Backup: `backups/reconcile-hours-2026-03-25.json`

### לקוחות שתוקנו (עיקריים)
חזי מאנע +218.76h, ד"ר וסרמן +63.01h, רעות חליבה +33.5h,
אודי חסדאי +32.65h, מורדי דבח +30.76h, אלחסן אבו מודעים +21.75h,
אבי אליהו +15.63h, חיים פרץ +12.25h, שייקסטופ +4.91h

### Bug Fix — addPackageToService (PR #174)
**שורש הבעיה:** `addPackageToService()` יצר חבילה עם `hoursUsed=0` בלי לשייך entries ישנים.

**התיקון:**
1. Query entries ללא packageId עבור אותו service
2. חישוב hoursUsed/hoursRemaining מהם על החבילה החדשה
3. כתיבת packageId על entries יתומים (batch, chunked per 500)
4. חישוב מחדש של service aggregates מכל ה-packages

**באג נוסף שנתפס:** service.hoursUsed לא עודכן כלל בקוד הישן.

### לא תקרה שוב
- addPackageToService עושה backfill אוטומטי
- entries ישנים משויכים לחבילה החדשה
- הטריגר ממשיך לטפל ב-entries חדשים (fallback לחבילה ראשונה)

---

## 10. נושאים פתוחים

| נושא | עדיפות | הערות |
|------|--------|-------|
| entries בלי packageId | **הושלם** | reconciliation 25/3 תיקן 20 לקוחות, PR #174 מונע חזרה (backfill ב-addPackageToService) |
| hours vs totalHours שם שדה לא עקבי ב-packages | נמוך | addPackageToService כותב hours, trigger משתמש ב-pkg.hours — עקבי. totalHours קיים רק ב-service level |
| עריכת תאריך חבילה מראה שגיאה | גבוה | חיים דיווח — צריך investigation |
| שינוי ארכיטקטוני — entry שייך ל-service, לא ל-package | גבוה | הסטנדרט המקצועי — חישוב packages דינמי FIFO |
| CI Pipeline (GitHub Actions) | קריטי | טרם נעשה |
| Loading consolidation — איחוד שתי מערכות loading | הושלם | PR #161, NS קורא ישירות ל-Unified |
| Audit 28 deferred scripts — תלויות הפוכות | הושלם | 23 SAFE, 3 NEEDS REVIEW (mitigated), 0 UNSAFE |
| Node.js 20 upgrade ל-22 | גבוה | deprecated 30/04/2026 |
| firebase-functions package upgrade | בינוני | אזהרה ב-deploy |
| ביצועי index.html (~10s) | הושלם | PR #156 — defer 28 scripts + CDN optimization |
| בדיקת UI progress ב-PROD | הושלם | cache invalidation אומת — כל נתיבי דיווח מכוסים (2026-03-06) |
| שדרוג invariant check לכל רמה | גבוה | כרגע בודק רק root |
| dailyInvariantCheck — בדיקת חריגות על שירותים חסומים | גבוה | sentinel לתפיסת נתיבים עתידיים |
| feature/new-sidebar | ממתין | sidebar + BeitMidrash + topbar. ממתין לאישור חיים |
| caseOpenDate — לקוחות חדשים (ללא entries) | נמוך | 20 לקוחות ללא entries — caseOpenDate יוגדר ידנית בעת הצורך |
| 9 שירותים manual review | בינוני | 0 רשומות timesheet — בדיקה ידנית |
| tsc permission denied ב-Netlify | נמוך | עקפנו עם skip build — חוב טכני |
| ניקוי branches ישנים | הושלם | feature/timesheet-triggers נמחק. סה"כ 2 branches בלבד. |
| SMS Twilio | נמוך | TODO בקוד, +972549539238 |
| AI integration ל-User App | נדחה | Cloud Function כ-proxy ל-Claude API |
| Trigger refactor — קריאות קוד | נמוך | PR #149 תיקן באגים, refactor נדחה לעתיד |
| services/index.js — סינון fixed בחישוב client aggregates | הושלם | PR #155, 2026-03-20 |
| dailyInvariantCheck — WhatsApp התראות | בינוני | נמצא פגם: בוט רץ אבל לא שולח התראה |
| safeText SoT — service-card-renderer + client-search fallback לא זהה ל-global | נמוך | לא crash, edge case |
| מחיקת loading-wrapper.js + loadLottieAnimation dead code | נמוך | cleanup |
| getUserMetrics — נקרא 8 פעמים per action | הושלם | PR #166 — הוסר מהקליינט, חישוב מקומי בלבד |
| Stats active סופר 'בוטל' כ-active | נמוך | חוסר עקביות ישן — _calculateBudgetStatisticsClient vs updateTaskCountBadges |
| AI_CONFIG load order | נמוך | pre-existing, ai-config לא נטען לפני ai-engine |
| Console logging ב-PROD | הושלם | PR #169 — console.log/info/debug silenced, warn+error active, enableDebug() backdoor |
| loginWithGoogle + loginWithApple pattern חוסם | נמוך | אותן בעיות כמו handleLogin — fire-and-forget |
| AI_CONFIG not found — ai-engine.js | הושלם | PR #173 — ai-config נטען ראשון, skip אם אין API key |
| EventBus not available בזמן statistics init | הושלם | PR #172 — dead listeners הוסרו (logging בלבד) |
| Console logging ב-Admin Panel | בינוני | 1,076 console.log עדיין מודפסים — צריך override כמו User App |
| main.js פיצול למודולים | בינוני | 3,156 שורות, class אחת |
| מיגרציה מ-functions.config() ל-Secret Manager | נמוך | deadline מרץ 2027 |

---

## 11. שרשרת קריאות — דיווח שעות (Flow קריטי)

```
main.js → createTimesheetEntryV2()
  → timesheet-adapter.js → FirebaseService.call('createTimesheetEntry_v2')
    → Cloud Function: createTimesheetEntry_v2 (יוצר entry בלבד)
      → Trigger: onTimesheetEntryChanged (מחשב סיכומים)

quick-log.js → FirebaseService.call('createQuickLogEntry')
  → Cloud Function: createQuickLogEntry (entry + deduction בתוך transaction)
    → Trigger: onTimesheetEntryChanged (מחשב סיכומים)
```

### החלטה ארכיטקטונית: date field format (PR #183, 2026-04-03)
- **סטנדרט:** שדה `date` ב-`timesheet_entries` הוא תמיד **string `"YYYY-MM-DD"`**
- **לא Firestore Timestamp** — כל ה-queries (Admin Panel, Workload, WhatsApp Bot) בנויים על string comparison
- `createQuickLogEntry` תוקן לשמור string (היה Timestamp)
- `createTimesheetEntry_v2` כבר שמר string — ללא שינוי

**אין שום נתיב שקורא ל-v1.**

---

*מנוהל על ידי טומי — ראש צוות הפיתוח | GH Law Office System*
*לעדכן בסוף כל עבודה — לא ליצור קובץ חדש*
