# SYSTEM STATUS — GH Law Office System
## law-office-system-e4801

**מנוהל על ידי:** טומי — ראש צוות הפיתוח
**עדכון אחרון:** 2026-03-22
**סטטוס:** Performance optimization complete, מערכת יציבה
**PRs:** #144 (Trigger + deduction removal + bug fixes), #145 (cache invalidation), #146 (service blocked enforcement), #166 (budget tasks performance)

---

## 1. מצב נוכחי

### Branches

```
main:               aca4847 — synced with production-stable
production-stable:  pending merge PRs #163, #164
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

---

## 2. Timesheet Trigger Refactor — מה נבנה (PR #144)

### הבעיה שהייתה
4 פונקציות עם לוגיקת deduction משלהן. כשאחת נכשלה — נתונים נשברו בשקט. יצר פערים ב-77% מהלקוחות.

### הפתרון
**Trigger מרכזי** (`onTimesheetEntryChanged`) — מתעורר על כל CREATE/UPDATE/DELETE של timesheet entry ומחשב סיכומים מאפס.

### Commits

| Commit | תיאור |
|--------|-------|
| `b47a2ee` | feat: add onTimesheetEntryChanged trigger — hours + legal_procedure |
| `a78ab31` | fix: infinite loop guard for trigger self-writes |
| `3a6ceb4` | refactor: remove deduction from createTimesheetEntry_v2 |
| `4ec859e` | refactor: remove deduction from createQuickLogEntry |
| `2158776` | refactor: remove deduction from updateTimesheetEntry |
| `76d807d` | refactor: remove deduction from addTimeToTask + lookupServiceIds |
| `4bec3b0` | fix: always write isOverage on entry + remove debug logs |
| `e42ccfe` | fix: use parentServiceId for legal_procedure service lookup |
| `1af5fed` | fix: pass lookupServiceId to apply functions |
| `1162960` | fix: invalidate clients cache after timesheet operations |

### Flow

```
Entry נוצר/מתעדכן/נמחק ב-timesheet_entries
  → onTimesheetEntryChanged (Firestore Trigger, Gen 2)
    → מזהה eventType (CREATE/UPDATE/DELETE)
    → מחשב delta
    → self-write guard (אם רק isOverage השתנה → skip)
    → קורא client doc
    → hours → applyHoursDelta(services, serviceId, packageId, delta)
    → legal_procedure → applyLegalProcedureDelta(services, serviceId, stageId, packageId, delta)
    → calcClientAggregates → סיכומי root
    → Transaction: כותב client + entry (isOverage) + task (actualMinutes)
```

### Service lookup
- `hours`: serviceId מה-entry → service ישירות
- `legal_procedure`: `lookupServiceId = parentServiceId || serviceId`

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
├── admin/                ← 9 פונקציות
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
| Firestore Collections | 19 |
| Cloud Functions | 73 |
| onCall | ~65 |
| onSchedule | 3 |
| onDocumentWritten (Trigger) | 2 |
| onRequest | 3 |

### URLs

| סביבה | User App | Admin Panel |
|-------|----------|-------------|
| DEV | `https://main--gh-law-office-system.netlify.app` | `https://main--admin-gh-law-office-system.netlify.app` |
| PROD | `https://gh-law-office-system.netlify.app` | `https://admin-gh-law-office-system.netlify.app` |

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

## 10. נושאים פתוחים

| נושא | עדיפות | הערות |
|------|--------|-------|
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
| מיגרציה מ-functions.config() ל-Secret Manager | נמוך | deadline מרץ 2027 |

---

## 11. שרשרת קריאות — דיווח שעות (Flow קריטי)

```
main.js → createTimesheetEntryV2()
  → timesheet-adapter.js → FirebaseService.call('createTimesheetEntry_v2')
    → Cloud Function: createTimesheetEntry_v2 (יוצר entry בלבד)
      → Trigger: onTimesheetEntryChanged (מחשב סיכומים)
```

**אין שום נתיב שקורא ל-v1.**

---

*מנוהל על ידי טומי — ראש צוות הפיתוח | GH Law Office System*
*לעדכן בסוף כל עבודה — לא ליצור קובץ חדש*
