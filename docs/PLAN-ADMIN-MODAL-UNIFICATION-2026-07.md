# PLAN — איחוד מודאלי הלקוח באדמין (Management + Report → כרטיס-לקוח אחד)

**נוצר:** 2026-07-31 · **בעלים:** חיים (Product Owner) · **סטטוס:** טיוטת תוכנית — ממתינה ל-devils-advocate + checkpoint
**App:** Admin Panel בלבד · **Env:** DEV (main) · **ענף עבודה:** ענפים טריים מ-`origin/main`, worktree ייעודי אחד, כותב אחד
**Frontend-only:** אין נגיעה ב-`functions/**`, ב-`firestore.rules`, ב-claims או בכל Cloud Function.

> **מסמך-אם:** תוכנית זו מחליפה (supersedes) את הארכיטקטורה של `docs/PLAN-REPORT-CARD-INTEGRITY-2026-07.md`
> (שנשמרה ב-worktree `lo-cardmodel`, ענף `pr-a1-report-card-model`, בסיס ישן #456 — **לא למזג**). קטלוג הבאגים
> D1–D5 שלה + ה-fixtures שלה ממוחזרים כאן; מודל-הביניים `report-card-model.js` שלה מתייתר, כי מסלול ה-recompute
> שהוא חיקה נמחק כולו.

---

## 1. תקציר מנהלים

שני מודאלי-לקוח חיים היום ב-`apps/admin-panel/clients.html`:

| | ClientManagementModal (`js/ui/ClientManagementModal.js`, 2,512 שורות) | ClientReportModal (`js/ui/ClientReportModal.js`, 1,951 שורות) |
|---|---|---|
| תפקיד | ניהול מלא: שירותים, שלבים, חבילות, הסכמי שכ"ט, פעולות | בחירת שירות + טווח תאריכים → הפקת דוח |
| מקור נתונים | `client.services[]` — כרטיס-לכל-שירות, אגרגטים מהמסמך | Map פנימי בן 5 passes הבונה כרטיסים מחדש — **חולה** |
| רנדרר | `renderServiceCard` (:423) + `getServiceInfo` (:508) | `populateServiceCards` (:260-613) + `createServiceCard` (:643-926) |
| באגים חיים | גזירת `hoursUsed = total − remaining` (:510-513) | **D2** (:383) + **D1** (:505-531) — ראו §2 |

**היעד המאושר (חיים, 2026-07-31):** מודאל אחד. `ClientManagementModal` הוא ה-HOST ומקבל שתי לשוניות —
**"ניהול"** + **"הפקת דוח"**. `ClientReportModal` מצטמצם עד מחיקה (shim תאימות בלבד). `ReportGenerator.js`
נשאר **המנוע** של לשונית הדוח (לא נבלע). רנדרר-כרטיסים **אחד** משרת את שתי הלשוניות (היום 3 רנדררים —
האיחוד מוחק 2; את `js/modules/service-card-renderer.js` **לא מאמצים** — הוא emitted מ-shared-web, מסכם-מחדש
מחבילות, ומוגן ב-drift-guard CI משלו).

**SSOT = השדות המאוחסנים.** קריאת האגרגטים של Management נשמרת; מסלול ה-recompute של ClientReportModal
נמחק כליל; ו-Management מפסיק לגזור `hoursUsed` — קורא את שני השדות המאוחסנים (`hoursUsed` + `hoursRemaining`).

**פירוק: 8 PR-ים קטנים, characterization-first, delete-last.** U0 (טסטים) → U1 (תיקון SSOT בניהול) →
U2 (מודל-כרטיסים טהור, dead-code) → U3 (חילוץ preview/edit) → U4 (הלשונית, additive) → U5 (הניהול מאמץ את
הרנדרר) → U6 (cutover של נקודות-הכניסה) → U7 (מחיקה + shim). המודאל הישן נשאר נגיש עד U6 (תקופת soak).

---

## 2. שני הבאגים שהאיחוד מתקן — root cause מאומת מול main הנוכחי

כל מספרי השורות אומתו מחדש ב-2026-07-31 מול `origin/main` (עץ העבודה זהה ביט-לביט ל-`origin/main`, נבדק ב-`git diff`).

### D2 — שירות שלם נעלם מהדוח (מחלקת קובי הראל, תיק 2025994)

`ClientReportModal.js:383`:

```js
servicesMap.set(stage.id, { ... });     // המפתח: stage.id — "stage_a" — לוקאלי לשירות!
```

ה-Map הוא כלל-לקוח, אבל המפתח הוא מזהה-שלב **לוקאלי לשירות**. לקוח עם שני שירותי `legal_procedure`
שלכל אחד `stage_a` → השני דורס את הראשון. השירות השני-באיטרציה "מנצח" את שני המפתחות; השירות הראשון
(אצל קובי — "תביעה", השלב הנוכחי של הלקוח) **נעלם לגמרי**, והשורד מוצג בשם הגנרי `getStageName(stage.id)`
("הליך משפטי - שלב א'") עם המספרים של השירות הלא-נכון. Management לא נפגע — הוא מרנדר `client.services[]`
כרטיס-לכל-אלמנט, בלי Map (:354-392).

**מוכח גם ב-fixture:** `lo-cardmodel/tests/unit/admin-panel/report-card-model.test.ts:179-199`
(`twoProceduresClient` — 4 שלבים קיימים, רק 2 כרטיסים; `serviceId` של שניהם = השירות האחרון).

### D1 — כרטיס-פאנטום "בשימוש N / סה"כ 0" (מחלקת רעות ואוריאל חליבה, תיק 2025549)

`ClientReportModal.js:505-531` — ה-fallback משעתון:

```js
if (!servicesMap.has(serviceName)) {            // המפה ממופתחת ב-stage.id — לעולם לא תכיל שם-שירות
    servicesMap.set(serviceName, {
        totalHours: 0,                          // "לא ידוע"
        remainingHours: 0,
        usedHours: usedHours                    // סכימה-מחדש מהלדג'ר
    });                                         // בלי displayName, בלי type, בלי status!
}
```

רשומות שעתון של שירות `legal_procedure` נושאות את **שמו** ב-`entry.serviceName`, אבל pass C מיפתח את
הכרטיסים לפי `stage.id` — הבדיקה `has(serviceName)` לעולם לא פוגעת → נולד כרטיס חסר-שם ("שירות שעות"
כברירת-מחדל ב-:719) עם `בשימוש 61 / סה"כ 0`. הפאנטום שורד **רק** אצל לקוח מעורב: הפילטר שלב-פעיל
(:573-590, כולל `servicesMap.clear()` ב-:581) מסונן על דגלי-**לקוח** (`client.procedureType/type/legalProcedure`,
:283-285) — אצל רעות ואוריאל `procedureType === 'hours'` ברמת הלקוח → הפילטר לא רץ → הפאנטום מוצג.
(לפאנטום אין `status`, כך שאילו הפילטר כן היה רץ — הוא היה נמחק; זו בדיוק העדות שהבאג חי רק במעורבים.)

**מוכח גם ב-fixture:** `report-card-model.test.ts:151-177` (פאנטום `_pass:'E'`, `displayName/type/status`
כולם `undefined`, `totalHours:0`).

### ממצאי-לוואי מהחקירה (חשובים לתוכנית)

1. **`generateAndEmail` הוא STUB** — `ReportGenerator.js:1122-1135` רק קורא ל-`generate()` ומציג
   "שליחת דוחות במייל תתווסף בגרסה הבאה". אין אימייל אמיתי היום. ה-affordance נשמר כ-invariant
   (כפתור מפורש, לעולם לא אוטומטי), אבל אין egress חי לשמר.
2. **כרטיסי הדוח לעולם לא מקבלים `overdraftResolved`** — הוא נקרא ב-:662/:683/:764/:794 אבל אף pass
   לא מאכלס אותו → תג "הוסדר" מעולם לא הוצג בדוח. האיחוד יתקן זאת אגב-אורחא (שינוי מוצהר §7.6).
3. **`closePreview()` שבור היום** — `ClientReportModal.js:1322` קורא `this.open(this.currentClient)` אחרי
   ש-`close()` (:1212→:191) כבר איפס את `currentClient` ל-null → המודאל לא נפתח מחדש אחרי ביטול preview.
   האיחוד מייתר את הדפוס (ראו §5, PR-U3).
4. **clients-fluent.html טוען `ClientReportModal.js` אבל ה-DOM שלו הוא stub ריק** (:417-425 — מודאל בלי
   form/כרטיסים) → מסלול הדוח בעמוד ה-Fluent ריק-בפועל כבר היום. העמוד קפוא-בכוונה (health-map: לא למחוק).
5. **מגבלות הטעינה הן 10000, לא 20000** — `ClientsDataManager.js:328-384` (10000 = המקסימום הקשיח של
   Firestore; ה-20000 הקודם זרק). `warnIfTruncated` (:428-469) חי ונשמר.
6. **הסביבה היא happy-dom, לא jsdom** (`vitest.config.ts` → `environment: 'happy-dom'`). טסט בודד:
   `npx vitest run tests/unit/admin-panel/<name>.test.ts` משורש הריפו.

---

## 3. ארכיטקטורת מצב-הקצה

```
clients.html
└── #clientManagementModal (host, z-index 10200 — clients-modals.css:53)
    ├── Tab bar: [ניהול] [הפקת דוח]        ← חדש; שני הפאנלים מרונדרים תמיד, CSS toggle בלבד
    ├── Panel ניהול (הקיים)
    │   ├── #managementClientInfo
    │   ├── #managementServicesList         ← כרטיסים מהרנדרר המאוחד, mode:'manage'
    │   │   └── .management-service-card[data-service-id]   ← חוזה DOM משומר
    │   ├── #feeAgreementsSection
    │   └── Quick actions (add-service / renew / change-status / close-case)
    └── Panel הפקת דוח (חדש — js/ui/ReportTab.js)
        ├── טווח תאריכים + quick-dates (ids חדשים mgmtReport*)
        ├── כרטיסי בחירת-שירות מהרנדרר המאוחד, mode:'report-select'
        │   └── זהות קנונית: service.id (+ בחירת שלב בתוך כרטיס legal_procedure)
        ├── פורמט (PDF / Excel) + [הפק דוח] [הפק ושלח במייל]
        └── formData → window.ReportGenerator (המנוע — ללא שינוי חוזה)

מודולים:
  js/modules/ServiceCardModel.js   ← מודל טהור: client → רשימת כרטיסים. SSOT=מסמך. אין DOM/גלובלים.
  js/ui/UnifiedServiceCard.js      ← הרנדרר האחד: (cardModel, {mode}) → DOM. שני ה-modes.
  js/ui/ReportPreview.js           ← ה-preview + עריכת-רשומה (updateTimesheetEntry) שחולצו מ-ClientReportModal.
  js/ui/ReportTab.js               ← בקר הלשונית: תאריכים, בחירה, formData, קריאות ReportGenerator.
  js/ui/ClientReportModal.js       ← בסוף: shim תאימות דק (עמוד fluent) — פתיחה מנתבת למודאל המאוחד.

נמחקים (ב-U5/U7): ClientManagementModal.renderServiceCard/getServiceInfo/renderStages (הרנדרר הפנימי),
ClientReportModal.populateServiceCards/createServiceCard (הרנדרר + ה-recompute), ו-HTML של #clientReportModal.
service-card-renderer.js לא נוגעים בו כלל (shared-web, drift-guard).
```

**עקרונות נעולים:**

- **זהות כרטיס = `service.id`** (ייחודי במערך). שלבים חיים **בתוך** כרטיס השירות — אין יותר Map ממופתח
  ב-`stage.id`. D2 מת בשורש. בחירת שלב לדוח נעשית בתוך הכרטיס (ברירת-מחדל: השלב הפעיל).
- **SSOT = המסמך:** `service.hoursUsed`/`service.hoursRemaining`/`stage.hoursUsed`/`stage.hoursRemaining`/
  `stage.totalHoursWorked` (fixed) נקראים ישירות. סכימת-שעתון בצד-לקוח — אסורה במודל (נאכף בטסט סטטי).
  fallback חשבוני (`total − used`) מותר רק כשהשדה המאוחסן אינו `Number.isFinite` — הדפוס הקיים
  (`ClientManagementModal.js:661-663`, `ReportGenerator.js:714-719`).
- **שני הפאנלים מרונדרים תמיד; לשוניות = CSS בלבד.** קריטי: `ServiceOverdraftResolution` + `AddPackageToStage`
  מזריקים DOM לכרטיסי הניהול על אירוע פתיחת-המודאל (MutationObserver על style) — אם פאנל הניהול לא קיים
  ב-DOM כשנפתחים ישר ללשונית הדוח, שניהם נשברים.
- **חוזה ה-formData ל-ReportGenerator משומר ביט-לביט:** `{clientId, clientName, startDate, endDate,
  service: <displayName>, serviceId, stage, reportType:'hours', reportFormat}` — בדיוק מה ש-
  `getFormData` (:1053-1069) מייצר היום, כי `findServiceByFormData` (:671-690), `resolveServiceHours`
  (:692-753) ו-`collectReportData` (:69-128) ממותחים על השדות האלה.

---

## 4. מפת צרכנים + חוזי DOM (מה שאסור לשבור)

| צרכן | תלות | קובץ:שורה |
|---|---|---|
| `ClientsTable` | `ClientManagementModal.open(client, dataManager)` · `ClientReportModal.open(clientId)` | `ClientsTable.js:657-658, :674-675` |
| `FluentDataGrid` (עמוד קפוא) | `ClientReportModal.open(client.id)` | `FluentDataGrid.js:784-793` |
| `ServiceOverdraftResolution` | `#clientManagementModal` (MutationObserver על style) · `.management-services-list` · `.management-service-card` · `data-service-id` · `window.ClientManagementModal.currentClient.id` (:914) · `close()` אחרי resolve (:841/:890) · מפתח הספירה `overdraftResolved.isResolved` | `ServiceOverdraftResolution.js:493-635` |
| `AddPackageToStage` | `#clientManagementModal` display:flex · `.management-stage` · **`.management-stage-name` — התאמה לפי textContent === stage.name** · `.management-stage-info` · `window.ClientManagementModal.currentClient` | `AddPackageToStage.js:540-644, :840-878` |
| `ReportGenerator` | `window.ClientReportModal.openEditTimesheetModal({...})` — הקורא החיצוני היחיד | `ReportGenerator.js:1431-1440` |
| `clients.html` init | `ClientReportModal.init()` + `ClientManagementModal.init()` | `clients.html:673-684` |
| `clients-fluent.html` init | `ClientReportModal.init()` (בלי ClientManagementModal, בלי Modals.js) | `clients-fluent.html:499-504` |
| CSS | `.modal` z-index 10200 (clients-modals.css:53) · `.modal-overlay` override 10300 (:67-69) · `report-service-cards.css` · `service-status-management.css` | ראו §6.3 |
| מסלולי כתיבה מהמודאלים | `updateTimesheetEntry` (עריכת רשומה, payload ב-`ClientReportModal.js:1847-1859`) · `generateAndEmail` (stub) · 12 callables של Management (updateClient/addServiceToClient/changeClientStatus/closeCase/moveToNextStage/completeService/changeServiceStatus/deleteService/addPackageToService/updatePackagePurchaseDate/uploadFeeAgreement/deleteFeeAgreement/getFeeAgreementUrl/setServiceOverride) | — |

---

## 5. פירוק ל-PR-ים

עקרונות: כל PR ≤ ~300 שורות production-code היכן שאפשר (טסטים לא נספרים בתקרה); characterization לפני
שינוי; delete-last; כל PR עם rubric ב-`.claude/rubrics/` + gates G1–G7 (hook `require-outcomes-pass.sh`);
המיזוגים squash → rollback = `git revert <squash-sha>` יחיד; bump ידני של `?v=` בכל PR שנוגע בקובץ נטען.
**devils-advocate חובה על U5 + U7** (refactor >100 שורות על משטח admin-critical); מומלץ גם על U4.

### PR-U0 — Characterization: הצמדת ההתנהגות הנוכחית (טסטים בלבד)

**קבצים (חדשים):**
- `tests/unit/admin-panel/modal-unification-current-behavior.test.ts`

**תוכן:**
1. **פיקסטורות** (ממוחזרות מ-`lo-cardmodel` — צורות מאומתות מסריקת-הצי של 2026-07):
   - `twoLegalProceduresClient()` — שני שירותי `legal_procedure`, לכל אחד `stage_a`+`stage_b`
     (מחלקת D2 / קובי הראל).
   - `mixedHoursLegalClient()` — `procedureType:'hours'` ברמת הלקוח + שירות `hours` + שירות
     `legal_procedure` ב-`services[]`, ורשומות שעתון שנושאות את **שם** השירות המשפטי
     (מחלקת D1 / רעות ואוריאל).
   - `hoursClient()` — לקוח שעות פשוט (עוגן אל-רגרסיה).
2. **התנהגות ClientReportModal (behavioral, happy-dom):** בונים את ה-scaffold
   (`#reportServiceCards` + `#reportSelectedService`), מציבים על ה-instance
   (`window.ClientReportModal.serviceCardsContainer = ...`), stubbים
   `window.ClientsDataManager.getClientTimesheetEntries` + `window.SystemConstantsHelpers.getStageName`
   + `window.escapeHtml`, קוראים `populateServiceCards(client)` ו**מצמידים את השבור**:
   - `known-bug D2`: שני שירותים → רק 2 כרטיסי-שלב, `dataset.serviceId` של שניהם = השירות השני.
   - `known-bug D1`: כרטיס פאנטום קיים, כותרת ריקה/"undefined", `סה"כ 0`, meta "שירות שעות".
3. **התנהגות ClientManagementModal:** מציבים `servicesListContainer`, stubbים `window.SYSTEM_CONSTANTS`,
   קוראים `renderServices()` ומצמידים: (א) `hoursUsed` המוצג = `totalHours − hoursRemaining`
   (הגזירה ב-:510-513 — `known-bug`); (ב) חוזה ה-DOM: `.management-service-card[data-service-id]`,
   `.management-stage-name` textContent === `stage.name`, `.management-stage-info` קיים,
   כפתורי `data-service-action` (renew/next-stage/change-status/complete/delete).
4. **חוזי מקור (source-level, בדפוס `modal-currentclient-capture-guard.test.ts`):** payload
   `updateTimesheetEntry` (הרשימה המלאה ב-:1848-1859) · מפתח `overdraftResolved?.isResolved`
   ב-4 האתרים · `formData` keys ב-`getFormData`.

**Invariants:** כולם (טסטים בלבד — אפס שינוי production). **סיכון:** ~0. **Rollback:** `git revert <sha>`.

---

### PR-U1 — Management קורא `hoursUsed` מאוחסן (התיקון הנקודתי המנדטורי)

**קבצים:** `apps/admin-panel/js/ui/ClientManagementModal.js` (בערך 10 שורות ב-`getServiceInfo` :508-513) ·
`clients.html` (bump `?v=` של הקובץ) · עדכון טסט ה-characterization מ-U0 (הצהרת-שינוי בטסט).

**שינוי:** בענף `SERVICE_TYPES.HOURS`:

```js
// לפני:  const hoursUsed = totalHours - hoursRemaining;
const hoursUsed = Number.isFinite(service.hoursUsed)
    ? service.hoursUsed
    : (totalHours - hoursRemaining);        // fallback לדור-ישן בלבד — מוצהר
```

`hoursRemaining` ממשיך להיקרא מהמסמך (כבר היום). ה-progress % ממשיך להיגזר מהמוצג.

**התנהגות מוצהרת (§7.1):** אצל לקוח עם דריפט בין `hoursUsed` המאוחסן לבין `total − remaining` —
המספר המוצג בניהול משתנה. זו המטרה: המודאל מפסיק להמציא אמת שלישית.

**Invariants שנבדקים:** לא זז אף מפתח ספירה/פילטר (הטבלה, ClientsTable, לא נגועה) · הרנדרר עצמו לא משוכתב ·
statusClass (blocked/critical/warning על 0/5/10 שעות `hoursRemaining`) נשאר על `hoursRemaining` בלבד.
**סיכון:** נמוך; דריפט-תצוגה גלוי הוא feature. **Rollback:** revert יחיד.

---

### PR-U2 — `ServiceCardModel` — מודל-הכרטיסים הטהור (dead code)

**קבצים (חדשים):** `apps/admin-panel/js/modules/ServiceCardModel.js` (~200-250 שורות) ·
`tests/unit/admin-panel/service-card-model.test.ts`. לא נטען מאף עמוד עדיין.

**חוזה:** `window.ServiceCardModel.build(client, {getStageName}) → { cards: [...], meta }`
- איטרציה על `client.services[]` בלבד — **כרטיס אחד לכל שירות** (כמו Management). אין Map לפי `stage.id`.
- כל כרטיס: `{ serviceId, name, type, pricingType, status, isFixed (דרך window.ClientTypeDisplay.isFixedService
  — ה-SSOT הקנוני, client-type-display.js:37-43, עם fallback inline זהה), totalHours, hoursUsed (מאוחסן),
  hoursRemaining (מאוחסן; fallback Number.isFinite), overdraftResolved (מועבר as-is), packages,
  stages: [{id, name, status, totalHours, hoursUsed, hoursRemaining, totalHoursWorked}] }`.
- **אסור במודל (נאכף בטסט סטטי על קובץ המקור):** אין קריאת `getClientTimesheetEntries`, אין `minutes`,
  אין `Math.max(0,` על יתרות, אין `servicesMap.set(stage.id`.
- **סובלנות דור-ישן נשמרת ברמת השדות** (service.hours/totalHours/allocatedHours וכו' — כמו ה-fallback הקיים
  ב-:442-489), אבל **passes A/B/E לא משוחזרים** (client.stages / client.hourlyPackage / פאנטום-שעתון) —
  ראו שאלה פתוחה §8.5 + סריקת-צי מקדימה.
- שירותים בסטטוס `archived` מסומנים `nonAggregating: true` (ל-parity עם `NON_AGGREGATING_STATUSES`) —
  הרנדרר יציג באדג' "בארכיון" כמו היום בשני המודאלים.

**טסטים:** על שלוש הפיקסטורות: D2 — שני השירותים קיימים כשני כרטיסים עם כל שלביהם; D1 — אין פאנטום
(entries לא מוזנים כלל למודל); hoursClient — מספרים == המסמך גם כשהלדג'ר מוזרק סותר (העתקת העיקרון
מ-`report-card-model.test.ts:96-105`); יתרה שלילית לא נחתכת.

**Invariants:** אפס שינוי התנהגות (dead code). **Rollback:** revert יחיד.

---

### PR-U3 — חילוץ `ReportPreview` (ה-preview + עריכת-רשומה) מ-ClientReportModal

**קבצים:** חדש `apps/admin-panel/js/ui/ReportPreview.js` (~350 שורות — רובן הזזה 1:1) ·
`ClientReportModal.js` (המתודות הופכות לדלגציה) · `ReportGenerator.js:1431` (קורא למודול החדש) ·
`clients.html` + `clients-fluent.html` (script tag חדש + bump `?v=`) ·
`tests/unit/admin-panel/report-preview-contract.test.ts`.

**מה זז (1:1, בלי שכתוב):** `showTimesheetPreview` / `renderTimesheetPreviewModal` / `closePreview` /
`editEntryFromPreview` / `proceedToGenerateReport` / `openEditTimesheetModal` / `saveTimesheetEdit` /
`showToast`+spinner helpers (`ClientReportModal.js:1159-1907`). API חדש:
`window.ReportPreview.showForFormData(formData)` + `window.ReportPreview.openEditModal(entryData)`.
`window.ClientReportModal.openEditTimesheetModal` נשאר כ-delegate (תאימות ל-callers ישנים) עד U7.

**שני תיקונים מוצהרים בתוך ההזזה (קטנים, נחוצים ללשונית):**
1. **שכבות z-index:** ה-overlays עוברים מ-inline `10001/10002/10003` ל-`10600/10610/10620` — מעל המודאל
   המאחד (10200, clients-modals.css:53) ומעל דיאלוג הסטטוס (10500). בלי זה ה-preview יירנדר **מאחורי**
   המודאל המאחד ב-U4. (היום זה "עובד" רק כי המודאל הישן נסגר לפני ה-preview.)
2. **אין יותר close-then-reopen:** `showForFormData` לא סוגר את המודאל-המארח; `closePreview` רק מסיר את
   ה-overlay. זה גם קובר את הבאג הקיים ב-:1322 (reopen עם `currentClient=null` — לא עבד ממילא).

**Invariants (המוקד של ה-PR):** payload `updateTimesheetEntry` **ביט-זהה** (source-guard מ-U0 ממשיך לעבור
על הקובץ החדש) · עריכה עדיין קוראת את הרשומה, בונה `editHistory`, שולחת `minutes/action/editHistory/taskId/
autoGenerated/clientId/serviceId` · רענון-preview אחרי שמירה נשמר · `generateAndEmail` נשאר מאחורי כפתור מפורש.
**סיכון:** בינוני (הזזת קוד חי). **Rollback:** revert יחיד (ה-delegates מסתירים את המבנה מהצרכנים).

---

### PR-U4 — לשונית "הפקת דוח" בתוך המודאל המאחד (additive; המסלול הישן נשאר ראשי)

**קבצים:** `clients.html` (tab-bar + panel חדש עם ids **חדשים** `mgmtReport*` — אין התנגשות `getElementById`
עם המודאל הישן שעדיין ב-DOM) · חדש `apps/admin-panel/js/ui/ReportTab.js` (~250 שורות) ·
חדש `apps/admin-panel/js/ui/UnifiedServiceCard.js` (~200 שורות — הרנדרר המאוחד, בשלב זה mode:'report-select'
בלבד) · `ClientManagementModal.js` (tab-switching + `open(client, dm, opts={initialTab})` — פרמטר שלישי
אופציונלי, additive) · CSS בתוך `clients-modals.css` (לשוניות) + שימוש-חוזר ב-`report-service-cards.css`
(הכרטיסים הנבחרים שומרים על מחלקות `.report-service-card` הקיימות) · טסטים.

**התנהגות הלשונית:**
- כרטיסי בחירה מ-`ServiceCardModel.build` דרך `UnifiedServiceCard(card, {mode:'report-select'})`:
  כרטיס-לכל-שירות; בשירות `legal_procedure` — בוחר-שלב פנימי (ברירת-מחדל: השלב הפעיל; completed ניתן
  לבחירה — שאלה פתוחה §8.1). `dataset.serviceName/serviceId/stage` — אותו חוזה כמו היום (:688-691).
- state הבחירה נשמר בבקר (לא ב-hidden input) ומיוצא כ-`formData` **בחוזה הביט-זהה** של `getFormData`.
- תאריכים + quick-dates: הלוגיקה של `setQuickDateRange` (:969-1036) מועתקת לבקר עם ברירת-מחדל `all`
  (מעוגן `caseOpenDate` — הדפוס מ-PR #408).
- [הפק דוח] → `ReportPreview.showForFormData` → `ReportGenerator.generate` ·
  [הפק ושלח במייל] → `ReportGenerator.generateAndEmail` (ה-stub; כפתור מפורש בלבד).
- **קריטי:** בפתיחה — `renderServices()` + `renderFeeAgreements()` של פאנל הניהול רצים **תמיד**, גם כשנפתחים
  ישר ללשונית הדוח (החוזה של המזריקים, §6.1-6.2).

**ב-PR זה שום כפתור קיים לא משתנה** — הלשונית נגישה רק מתוך המודאל המאחד (שנפתח מ"ניהול לקוח").
"הפק דוח" בטבלה עדיין פותח את המודאל הישן. תקופת soak: הבאגים D1/D2 מתוקנים בלשונית, ניתנים להשוואה
מול הישן על אותם לקוחות.

**טסטים:** behavioral על שתי הפיקסטורות — בלשונית: D2 = שני השירותים מופיעים; D1 = אין פאנטום;
formData שנפלט תואם ביט-לביט את חוזה `getFormData`; snapshot של `resolveServiceHours(client, formData)`
זהה בין בחירה-בישן לבחירה-בחדש (על לקוח בריא) — ההוכחה שהמנוע לא מרגיש בהחלפה.

**Invariants:** חוזה המזריקים שלם · אין ids כפולים · `currentClient`-capture-early בכל sub-flow חדש ·
z-index סולם §6.3. **סיכון:** בינוני-גבוה (הקובץ המרכזי של הניהול נגוע) — אבל additive: כשל בלשונית לא
נוגע בפאנל הניהול. **Rollback:** revert יחיד מחזיר את המודאל לאחד-פאנל.

---

### PR-U5 — פאנל הניהול מאמץ את הרנדרר המאוחד (מחיקת רנדרר 1/2) — devils-advocate חובה

**קבצים:** `UnifiedServiceCard.js` (תוספת mode:'manage': header+badges+actions+stages+packages+override) ·
`ClientManagementModal.js` — `renderServices` קורא ל-`ServiceCardModel.build`+`UnifiedServiceCard`;
**נמחקים:** `renderServiceCard` (:423-462), `getServiceTypeBadge/getServiceStatusBadge/getServiceIcon`
(:468-502), `getServiceInfo` (:508-628), `renderStages` (:634-709), `getServiceActions` (:715-751),
`_renderPackagesBreakdown` (:1403-1459) — כולם עוברים (מאוחדים) לרנדרר · טסטים · bump `?v=`.

**חוזה שוויון-DOM (המבחן המרכזי, characterization-first):** על שלוש הפיקסטורות, רינדור דרך הישן (הצמדה
ב-U0) מול החדש חייב לשמר **את כל הסלקטורים החוזיים**: `.management-service-card[data-service-id]` ·
`.management-service-header` (toggle expand/collapse + `.expanded`) · `.management-stage` ·
`.management-stage-name` **textContent === stage.name בדיוק** (AddPackageToStage מתאים לפי טקסט!) ·
`.management-stage-info` · `[data-service-action]` חמשת הכפתורים · `.override-btn` · `.edit-pkg-date-btn` ·
המספרים המוצגים (אחרי U1) זהים. הבדלי-עיצוב לא-חוזיים מותרים רק אם הוצהרו.

**Invariants:** `deleteService`/`closeCase` נשארים מאחורי כפתורים מפורשים באותם מקומות ·
`isBlocked`/`isCritical` על הלקוח ממשיכים להגיע **רק** מתשובות CF (:1162-1163, :1838-1839 — לא נגזרים) ·
statusClass של השירות נשאר גזירת-תצוגה מ-`hoursRemaining` (0/5/10) כמו היום · חוזה `ServiceOverdraftResolution`
+ `AddPackageToStage` מוכח בטסט DOM. **סיכון:** הגבוה בתוכנית — לכן אחרי U4 (הרנדרר כבר הוכח בלשונית)
ולפני כל מחיקת-מסלול-ישן. **Rollback:** revert יחיד מחזיר את הרנדרר הפנימי.

---

### PR-U6 — Cutover של נקודות-הכניסה (המודאל הישן יוצא משימוש, עוד לא נמחק)

**קבצים:** `ClientsTable.js` — `handleReportClick` (:671-682) פותח
`ClientManagementModal.open(client, dm, {initialTab:'report'})` במקום `ClientReportModal.open(clientId)` ·
`clients.html` init — `ClientReportModal.init()` נשאר (הקובץ עוד חי) · טסט cutover · bump `?v=`.

**התנהגות מוצהרת (§7.5):** "הפק דוח" פותח את הכרטיס המאוחד על לשונית הדוח. עמוד ה-Fluent לא נגוע
(ממשיך לקרוא ל-`ClientReportModal.open` הישן — שעודו קיים). המודאל הישן הופך בלתי-נגיש מ-clients.html
אך נשאר ב-DOM (בטיחות: revert של U6 בלבד מחזיר את העולם הישן בשלמותו).

**Invariants:** ה-flow המלא בדיקה-ידנית: בחירה → preview → עריכת רשומה (updateTimesheetEntry) → הפקה →
excel. **סיכון:** נמוך (שינוי ניתוב בלבד). **Rollback:** revert יחיד.

---

### PR-U7 — Delete-last: מחיקת המודאל הישן + shim — devils-advocate חובה

**קבצים:** `clients.html` — הסרת בלוק `#clientReportModal` (:276-398) · `ClientReportModal.js` — הקובץ
מוחלף ב-**shim דק** (~60 שורות): `init()` no-op-safe; `open(clientId)` → אם `ClientManagementModal` קיים
פותח את הלשונית, אחרת (עמוד fluent) מציג notify "הפקת דוח זמינה במסך ניהול הלקוחות" — **לא גרוע מהיום**,
שם המודאל ממילא stub ריק; `openEditTimesheetModal` → delegate ל-`ReportPreview` · מחיקת
`populateServiceCards`+`createServiceCard`+`getFormData`+`selectServiceCard` וכל השאר (רנדרר 2/2 +
ה-recompute מתים סופית — נקודת-האל-חזור של D1/D2) · `clients-fluent.html` — bump `?v=` בלבד (הקובץ נשאר
נטען, עכשיו כ-shim) · עדכון טסטים: ה-`known-bug` מ-U0 נמחקים/מוחלפים בטסטי guard "המסלול לא קיים"
(grep סטטי: אין `servicesMap.set(stage.id`, אין את בלוק :505-531) · docs.

**Invariants:** אפס רגרסיה בעמוד fluent (הוא היה שבור-בשקט; ה-shim מכניס הודעה מסודרת — G1) ·
`ReportGenerator` לא נגוע · כל טסטי ה-DOM-contract ירוקים. **סיכון:** בינוני (מחיקה) — אבל בשלב זה אף
מסלול חי לא עובר בקוד הנמחק. **Rollback:** revert יחיד מחזיר את הקובץ המלא + ה-HTML.

---

### סיכום סדר + תלות

```
U0 (tests) → U1 (SSOT read) → U2 (model) → U3 (preview extraction) → U4 (tab, additive)
                                                        → U5 (manage adopts renderer) → U6 (cutover) → U7 (delete+shim)
```
U1 בלתי-תלוי וניתן להקדמה; U2 בלתי-תלוי ב-U1/U3; U3 חייב לפני U4; U5 אחרי U4 (soak של הרנדרר);
U6 אחרי U4 (ורצוי אחרי U5); U7 אחרון תמיד. בין U4 ל-U6 — חלון השוואה ישן-מול-חדש על לקוחות אמת
(קובי הראל 2025994 + רעות ואוריאל 2025549) ב-DEV.

---

## 6. מה יכול לשבור את כל המערכת (וההגנה פר-סיכון)

### 6.1 ServiceOverdraftResolution — פיצ'ר שקורא את ה-DOM של המודאל
MutationObserver על `#clientManagementModal[style]` (:519-535) + polling; מזריק קופסאות-חוב לתוך
`.management-service-card` לפי `data-service-id` (:552-635); קורא `currentClient.id` (:914); **סוגר** את
המודאל אחרי resolve (:841/:890). **הגנות:** שני הפאנלים תמיד ב-DOM (§3) · הסלקטורים בחוזה-הטסט של U0/U5 ·
ה-id `#clientManagementModal` וה-toggle דרך `style.display` לא משתנים (לא עוברים ל-ModalManager במסגרת
תוכנית זו — שינוי מנגנון הפתיחה = שבירת שני המזריקים) · אחרי U5 בדיקה ידנית: לקוח עם חריגה → הקופסה
מוזרקת → "סמן כנגבה" עובד → הספירה בטבלה לא זזה.

### 6.2 AddPackageToStage — התאמת שלב לפי טקסט מוצג
מתאים `stage` לפי `.management-stage-name` **textContent === stage.name** (:594-604) ומזריק כפתור
ל-`.management-stage-info` (:637-639). כל שינוי בטקסט שם-השלב (הוספת שעות/אייקון לתוך אותו אלמנט)
שובר את הפיצ'ר בשקט. **הגנה:** חוזה-טסט: שם השלב לבדו ב-`.management-stage-name`; תוספות עיצוב —
באלמנטים אחים בלבד.

### 6.3 סולם z-index אחד (הטריק שכבר הכאיב פעמיים בריפו)
מצב קיים: `.modal` 10200 (clients-modals.css:53) · `.modal-overlay` override 10300 (:67-69) · דיאלוג
סטטוס 10500 (`ClientManagementModal.js:1190-1195`) · preview/edit/toast עם inline 10001/10002/10003
(מתחת ל-10200!). **הגנה:** U3 מעלה אותם ל-10600/10610/10620 + טסט source-guard על הערכים; מסמכים את
הסולם בהערת-קוד אחת ב-clients-modals.css.

### 6.4 חוזה ה-formData אל המנוע
`resolveServiceHours` path (a) תלוי ב-`formData.stage`; path (b) ב-`serviceId`/שם; `collectReportData`
מסנן entries לפי `serviceId===stage` בין השאר (:96-103). אם הלשונית תפלוט `stage` ריק עבור legal_procedure —
הדוח יפול ל-path (b) ויציג את סכום-ההורה (רגרסיה של באג ה-over-count המתוקן!). **הגנה:** טסט U4 המשווה
`resolveServiceHours` על formData ישן-מול-חדש; חובה `stage` מאוכלס בכל בחירת שלב.

### 6.5 ids כפולים ב-getElementById
עד U7 שני המודאלים חיים באותו עמוד. **הגנה:** כל ה-ids של הלשונית בקידומת `mgmtReport*`; טסט סטטי
שאין `id="report...` כפול ב-clients.html.

### 6.6 עמוד ה-Fluent הקפוא (clients-fluent.html)
טוען `ClientReportModal.js` + `ReportGenerator.js`, לא טוען `ClientManagementModal`/`Modals.js`; ה-DOM
שלו stub ריק (:417-425). **הגנה:** הקובץ לעולם לא נמחק — הופך shim (U7); כל שינוי-שם/מחיקה של
`window.ClientReportModal` אסורים; bump `?v=` גם שם בכל PR שנוגע בקבצים שהעמוד טוען (U3, U7).

### 6.7 מסלולי הכתיבה
`updateTimesheetEntry` — ה-payload המלא (:1848-1859) כולל `editHistory` מצטבר ו-`serviceId` fallback
(`currentEntry.serviceId || currentEntry.service`) חייב להישאר ביט-זהה (source-guard מ-U0 חי לאורך כל
התוכנית). `generateAndEmail` — נשאר מאחורי כפתור מפורש; לעולם לא נקרא מקוד אתחול/רינדור.

### 6.8 מפתחות ספירה/פילטר
`overdraftResolved.isResolved` — הטבלה (patch של ClientsTable), קופסת-החוב, וכרטיסי הדוח חייבים להמשיך
לקרוא את אותו מפתח. `NON_AGGREGATING_STATUSES` — באדג' "בארכיון" נשמר בשני ה-modes; שום אגרגט לא מסונן
בצד-לקוח מעבר לקיים. **הגנה:** source-guards מ-U0 רצים בכל PR.

### 6.9 cache-busting
`npm run cache-bust` מעדכן רק index.html — ב-clients.html/clients-fluent.html ה-`?v=` ידני. **הגנה:**
צ'ק-ליסט פר-PR: כל קובץ JS/CSS שהשתנה ⇒ bump בכל עמוד שטוען אותו. (שכחת bump = אדמין רץ על קוד ישן
עם HTML חדש — מחלקת תקלות מוכרת בריפו.)

### 6.10 עומס-עבר של המודאל: currentClient-capture-early + ESC/backdrop
כל sub-flow חדש (בוחר-שלב, preview מהלשונית) חייב ללכוד `clientId` בפתיחה (הדפוס מ-:1465/:1590, מוגן
כבר היום ב-`modal-currentclient-capture-guard.test.ts`) — פתיחת overlay יכולה להפעיל את ה-close של
המארח. ה-guard הקיים מורחב ל-`ReportTab`.

### 6.11 סיכון-על תהליכי
~24 worktrees חיים על אותו ריפו. **הגנה:** worktree טרי ייעודי אחד לתוכנית, ענף-לכל-PR מ-`origin/main`
עדכני, `git add <files>` מפורש בלבד, אימות ancestry לפני כל `gh pr create`.

---

## 7. שינויי התנהגות מוצהרים (לפי ה-BEHAVIORAL CHANGE RULE של האדמין)

1. **U1:** "נוצלו" בניהול = `service.hoursUsed` המאוחסן; היכן שיש דריפט מהגזירה — המספר המוצג משתנה.
2. **U4/U6:** שירות שהוסתר ע"י D2 **חוזר להופיע** (קובי הראל: "תביעה" חוזר; שני ההליכים נראים).
3. **U4/U6:** כרטיס הפאנטום של D1 **נעלם** (רעות ואוריאל: "בשימוש 61 / סה"כ 0" מת). אופציית שורת-מידע
   "שעות ללא שיוך" — שאלה פתוחה §8.2.
4. **U4:** "אילו שלבים מוצגים" מאוחד: כל השלבים נראים בתוך כרטיס השירות (כולל pending, כמו בניהול);
   ברירת-מחדל לבחירת דוח = השלב הפעיל. הפילטר-הישן (שרץ רק על דגלי-לקוח, כמעט אף פעם בצורה המודרנית)
   נמחק. שינוי בהיקף "מה בחיר" — §8.1.
5. **U6:** "הפק דוח" פותח את הכרטיס המאוחד על לשונית הדוח (נקודת-כניסה חדשה, אותו flow).
6. **U4:** כרטיסי הדוח מכבדים לראשונה `overdraftResolved` (תג "הוסדר" מיושר עם הניהול; עד היום השדה
   פשוט לא הגיע לדוח).
7. **U4 (בכפוף לסריקה §8.5):** תמיכת ה-passes הישנים A/B (client.stages / client.hourlyPackage) לא
   משוחזרת בלשונית.
8. **U3:** ה-preview לא סוגר-ופותח-מחדש את המודאל המארח (הדפוס השבור ב-:1322 נקבר); שכבות z-index חדשות.

---

## 8. שאלות פתוחות לצ'קפוינט של חיים

1. **בחירת שלב לדוח:** ברירת-מחדל = השלב הפעיל. האם שלב `completed` בחיר לדוח היסטורי? (המלצה: כן —
   הדרישה העסקית המקורית "רק בשלב א ולא סה\"כ" הייתה נגד *סכימה*, ו-`resolveServiceHours` כבר מבטיח
   סקופ-לשלב; חסימת היסטוריה היא מגבלה בלי רווח.) ושלב `pending` — בחיר או מוצג-נעול?
2. **תחליף לפאנטום:** כשקיימות רשומות-שעתון שלא מתאימות לאף שירות — להציג שורת-מידע לא-בחירה
   "שעות ללא שיוך: N" (ההחלטה D3 מהתוכנית הקודמת), או כלום? (המלצה: שורת-מידע — נראוּת בלי כרטיס-שקר.)
3. **לשונית ברירת-מחדל:** "ניהול לקוח" פותח בלשונית ניהול, "הפק דוח" בלשונית דוח — מאושר? ותוויות
   הלשוניות ("ניהול" / "הפקת דוח")?
4. **עמוד Fluent:** ההמלצה — shim (הודעת הפניה מסודרת). חלופות: לחבר את העמוד למודאל המאוחד (עבודה על
   עמוד קפוא) או להשאיר שבור-בשקט (נגד G1). מאשר shim?
5. **מחיקת passes A/B:** נדרש אישור להריץ סריקת-צי read-only (בדפוס `scan-report-integrity`) שתאמת
   0 לקוחות עם `client.stages`/`client.hourlyPackage` ללא `services[]` — ואז המחיקה סופית. אם יימצאו
   לקוחות כאלה — רשימה אליך להכרעה לפני U4.
6. **כפתור "הפק ושלח במייל":** היום stub ("בקרוב"). להעביר ללשונית כמו-שהוא, או להסתיר עד שיש שליחה
   אמיתית? (המלצה: להעביר כמו-שהוא — אפס שינוי-התנהגות בתוך תוכנית שכבר גדולה.)
7. **אורך ה-soak בין U4 ל-U6:** כמה ימי שימוש-DEV בהשוואת ישן/חדש לפני ה-cutover? (המלצה: שבוע עבודה
   אחד + אימות ידני על 2025994 ו-2025549.)
8. **אימות פרוד מקדים:** אישור לקריאת `.get` read-only של שני מסמכי הלקוחות הנ"ל (צורת `services[]`
   בלבד, בלי כתיבה) כדי לקבע את הפיקסטורות על הצורה האמיתית העדכנית. (הקוד והסריקה ההיסטורית כבר
   מוכיחים את המנגנון; זו הצמדה אחרונה. `אין לי ודאות` על הצורה העדכנית-להיום בלי הקריאה הזו.)

---

## 9. בלוק ה-invariants לנעילה ב-rubric של כל PR

כל rubric פר-PR (`.claude/rubrics/pr-u<N>-modal-unification.md`) כולל את הבלוק הזה כ-MUST, עם עדות:

- [ ] מפתח הספירה/פילטר `overdraftResolved.isResolved` — טבלה + כרטיס + resolution זהים; אף ספירה/פילטר/אגרגט לא זז.
- [ ] `NON_AGGREGATING_STATUSES` (החרגת archived) נשארת מסונכרנת בין השכבות; באדג' "בארכיון" בשני ה-modes.
- [ ] פעולות הרסניות (`deleteService`, `closeCase`) ופעולות חיצוניות (`generateAndEmail`, `getFeeAgreementUrl`)
      נשארות מאחורי affordance ניהולי מפורש — לעולם לא ב-default view ולא בקוד אתחול.
- [ ] `isBlocked` / `isCritical` מוחלים מתשובת ה-CF בלבד — אף גזירה חדשה בצד-לקוח.
- [ ] `warnIfTruncated` + מגבלות ה-10000 ב-ClientsDataManager לא נגועים.
- [ ] דפוס `currentClient`-capture-early בכל sub-flow (כולל החדשים) — ה-guard-test מורחב, לא נחלש.
- [ ] חוזה ה-DOM של `ServiceOverdraftResolution`: `#clientManagementModal` + `style.display` toggle +
      `.management-services-list` + `.management-service-card` + `data-service-id`.
- [ ] חוזה ה-DOM של `AddPackageToStage`: `.management-stage` + `.management-stage-name`
      (textContent === stage.name בדיוק) + `.management-stage-info` + `currentClient` נגיש.
- [ ] מסלולי הכתיבה חיים: `updateTimesheetEntry` payload ביט-זהה; `generateAndEmail` מאחורי כפתור מפורש.
- [ ] חוזה ה-formData למנוע: `{service, serviceId, stage, startDate, endDate, reportType, reportFormat}` —
      סמנטיקה זהה ל-`getFormData` הישן; `stage` מאוכלס לכל בחירת שלב.
- [ ] אין `servicesMap.set(stage.id` ואין recompute-משעתון בשום קוד חדש (grep סטטי).
- [ ] שינוי בפרדיקט-חריג-יחיד או ב"אילו שלבים מוצגים" — הוצהר במפורש ב-PR body תחת "שינוי התנהגותי".
- [ ] `?v=` הוקפץ לכל קובץ שהשתנה, בכל עמוד שטוען אותו (clients.html + clients-fluent.html).
- [ ] `service-card-renderer.js` (emitted) לא נגוע; `npm run verify:shared` ירוק.
- [ ] ענף טרי מ-`origin/main`; אין נגיעה ב-`functions/**`, `firestore.rules`, `shared-web/**`.

---

## 10. אימות ובדיקות — סיכום

- **הרצה:** `npx vitest run tests/unit/admin-panel/<file>.test.ts` (happy-dom, משורש הריפו); מלא: `npm test`.
- **דפוסי רתמה קיימים:** import-ל-side-effect של ה-IIFE + stub לגלובלים לפני ה-import
  (`overdraft-debt-reframe.test.ts:24-29`) · source-level guard לחוזים
  (`modal-currentclient-capture-guard.test.ts`) · מודל-טהור עם fixtures (`report-card-model.test.ts` ב-lo-cardmodel).
- **בדיקות ידניות פר-PR (DEV):** happy-path של שני המודאלים · שני לקוחות-הבאג · empty-state (לקוח בלי
  שירותים) · לקוח archived · חריגה + resolve · הוספת חבילה לשלב · עריכת רשומה מה-preview · excel export ·
  console נקי (deployment FAIL על כל שגיאה).
- **קריטריון קבלה סופי (אחרי U7):** על 2025994 — שני השירותים בלשונית הדוח, "תביעה" חזר; על 2025549 —
  אפס כרטיסי-פאנטום; `Σ` המוצג בכל כרטיס == האגרגטים במסמך; אפס שינוי בספירת החריגות בטבלה.

---

## 11. החלטות checkpoint + devils-advocate (2026-07-31) — נעול

### 11.1 תשובות חיים ל-8 השאלות (§8)
1. **בחירת שלב לדוח (§8.1):** ברירת-מחדל=שלב פעיל; שלב **completed בחיר** (דוח היסטורי); **pending מוצג-נעול** (לא-בחיר).
2. **תחליף לפאנטום (§8.2):** **שורת-מידע לא-בחירה "שעות ללא שיוך: N"** (לא כרטיס). מיושם ב-U2/U4 כ-`meta.unassignedHours` על המודל + שורה ברנדרר mode:'report-select'.
3. **לשונית ברירת-מחדל + תוויות (§8.3):** מאושר — "ניהול לקוח"→לשונית **ניהול**, "הפק דוח"→לשונית **הפקת דוח**; תוויות: **"ניהול" / "הפקת דוח"**.
4. **עמוד Fluent (§8.4):** מאושר **shim** (הודעת-הפניה מסודרת).
5. **מחיקת passes A/B (§8.5):** מאושר — **סריקת-צי read-only** (דפוס `scan-report-integrity`) לפני U4/U7; מחיקה סופית רק אם 0 לקוחות עם `client.stages`/`client.hourlyPackage` בלי `services[]`; אם יימצאו → **רשימה לחיים להכרעה לפני המחיקה**.
6. **כפתור "שלח במייל" (§8.6):** מאושר — **מעבירים כמו-שהוא** (stat-quo, "בקרוב").
7. **אורך soak U4→U6 (§8.7):** **שבוע-עבודה (~5 ימי-DEV) + אימות ידני** על 2025994 (קובי) + 2025549 (חליבה).
8. **אימות-פרוד להצמדת fixtures (§8.8):** **נפתר** — הצורות אומתו-חי בסשן 2026-07-31 (חליבה 2025549: `procedureType='hours'` + `srv_1772921939885` "ביה"ד לעבודה" stage_a≈61.18; קובי 2025994: 4 שירותים, 2 legal_procedure עם stage_a פעיל — "תביעה" `srv_legal_1765742557141` 46.84/50 + "כתב הגנה" `srv_1768299874412` 22.08/45 — + 2 hours). אין צורך בקריאה נוספת.

### 11.2 4 תיקוני devils-advocate חובה (folded) — verdict=GO-WITH-CHANGES
- **DA-1 (→U4):** **namespacing ל-`name` של הרדיו** — `getFormData` קורא `input[name="reportFormat"]:checked` **גלובלי**; הלשונית תשתמש ב-`name="mgmtReportFormat"`/`mgmtReportType` **וקריאה scoped ל-`this.tabRoot`**; guard סטטי על `name` כפול (לא רק `id`, §6.5). *(בלי זה — הדוח החדש קורא את הפורמט של המודאל הישן בחלון הדו-קיום.)*
- **DA-2 (→U2+U4, מחליף את טסט-השקילות ב-§5/U4):** **לאסור בחירת legal_procedure בלי `stage` מאוכלס.** `resolveServiceHours` path(b) (`ReportGenerator:735-741`) מחזיר סכום-הורה = מחזיר את ה-over-count, ו-`collectReportData` (`:88-115`) מרוקן את גוף-הדוח → header/body סותרים. **fixture חדש `legalNoActiveStage()`** (הליך בלי שלב פעיל) + טסט שהלשונית **לעולם לא פולטת `{type:'legal_procedure', stage:''}`** + טסט ש-header-total ו-body-entries עקביים. טסט-השקילות ה"בריא" לבדו לא תופס את זה.
- **DA-3 (→U5):** **לתחום את `AddPackageToStage`** — הוא סורק `#clientManagementModal .management-stage` על **כל התת-עץ**; ב-U5 לוודא ש-mode:'report-select' פולט classes **שונים** (`.report-*`) ולא `.management-stage*`, או לתחום את הסורק ל-`.management-services-list .management-stage`. + **לתעד את התאמת-ההליך-הראשון-בלבד (`:571/:604`) כפגם-ידוע** — לא לנעול אותו כ"נכון" בטסט-שוויון-ה-DOM של U5.
- **DA-4 (→U3):** **מצאי-z-index מלא** — קיימים מעל 10600: `.messages-fullscreen-modal` 11000/11001 (components.css), `AddPackageToStage` dialog 99999, `.status-change-modal-overlay` 100000 (service-status-management.css, מקושר ב-clients.html:77), ModalManager ~10000. → לבחור ערך **מעל 100000** לל-preview/edit **או** לתעד מפורשות אילו שכבות לא co-occur ולמה 10600 בטוח; **ולהצהיר ב-rubric של U3 את חריגת ה-Design-Bar** (חילוץ overlay-inline 1:1 ל-`ReportPreview.js` — legacy-move מתועד, אחרת grader עלול לחסום). ModalManager-confirm מהזרימה החדשה = ~10000 → מתחת ל-preview אם לא מטופל.
- **לא-חוסם (fold כ-SHOULD):** U1 — caveat "שלושת-המספרים לא מסתכמים" כשיש דריפט + fixture `hoursUsed ≠ total−remaining`; אכיפת **render-once-at-open** (לשוניות=CSS בלבד, בלי re-render) + טסט-DOM ששני המזריקים עדיין פועלים כשנפתחים ישר ללשונית-הדוח.
- **תיקון-דיוק:** `generateAndEmail` **מפיק דוח** (לא stub-טהור) אך בלי egress-מייל — ה-invariant "כפתור מפורש, בלי שליחה-חיה" עומד.

**סטטוס: התוכנית נעולה לבנייה. סדר: U0 → U1 → U2 → U3 → U4(+DA-1,DA-2) → U5(+DA-3) → U6 → U7. devils-advocate חובה על U4/U5/U7.**

---

## 13. החלטת-פריסה: מאסטר-דיטייל (חיים, 2026-07-31) — מחליף את פריסת-הכרטיסים של §12

חיים בחר **פריסת מאסטר-דיטייל** (אחרי השוואת שני מוק-אפים חיים: "מאוזן-כרטיסים" מול "מאסטר-דיטייל"). זה **מחליף את פריסת רשימת-הכרטיסים המתוארת ב-§12** — אבל **הארכיטקטורה (§3), ה-PR-decomposition (§5), וכל ה-invariants (§9) נשארים; רק ה-LAYOUT של הפאנלים משתנה.**

**המבנה הנבחר (זהה למוק-אפ המאושר):**
- **מעטפת:** header + tab-bar ("ניהול" / "הפקת דוח") — ללא שינוי.
- **כל פאנל = split דו-טורי:** **rail צר** (RTL: בצד ימין, ~248px) עם רשימת-שירותים קומפקטית לניווט, ו**detail** (החלון הראשי) עם פרטי-השירות-הנבחר. בחירת שורה ב-rail → ה-detail מתחלף.
- **לשונית ניהול:** rail=רשימת-שירותים; detail=ניהול-השירות-הנבחר (סיכום-שעות, פס, שלבים, פעולות, קופסת-חוב). **לשונית דוח:** rail=בחירת-שירות (radiogroup); detail=טווח-תאריכים + בורר-שלב לשירות-הנבחר + פורמט + [הפק] + שורת "שעות ללא שיוך".

**🔴 ההשלכה הארכיטקטונית הקריטית (לנעול ב-rubric — מרחיב את §6.1/§6.2/DA-3):** במאסטר-דיטייל מוצג detail של שירות **אחד** בכל רגע — אבל המזריקים (`ServiceOverdraftResolution` + `AddPackageToStage`) סורקים את **כל** `.management-service-card`/`.management-stage` שב-`#clientManagementModal`. לכן: **חובה שכל פאנלי-ה-detail של הניהול יְרוּנדרו ב-DOM (מוסתרים ב-CSS פרט לנבחר) בתוך מכולת `.management-services-list`** — בדיוק כמו שהמוק-אפ עושה (`.dpane` — כולם ב-DOM, אחד `.on`). כך המזריקים סורקים ומזריקים לכל הכרטיסים כרגיל (החוזה נשמר ביט-לביט), וה-rail הוא ניווט-בלבד עם classes **שאינם** `.management-*` (כדי ש-AddPackageToStage לא ייתפס על שורות-ה-rail — מימוש DA-3). **אין lazy-render של detail לפי בחירה** — render-once-at-open, בחירה = CSS toggle בלבד (כמו העיקרון של §3 + ההמלצה הלא-חוסמת של devils). זה שומר את §6.10 (currentClient-capture-early) ואת כל חוזי-ה-DOM.

**השפעה על ה-PRs (עדכון §5, לא שינוי-סדר):**
- **U4** בונה את מבנה ה-`.split` (rail + detail) + ה-tab, במקום רשימת-כרטיסים אנכית. ה-rail-rows = markup חדש (nav), פאנלי-ה-detail = מכולת `.management-services-list` עם כל השירותים (mode:'report-select' בלשונית-הדוח).
- **U5** — `UnifiedServiceCard` מקבל שלושה outputs: `rail-row` (שורת-ניווט רזה), `manage-detail` (הפאנל המלא עם חוזי-ה-DOM), `report-select` (בורר לדוח). ה-rail-row **לא** נושא `.management-*` classes. חוזה שוויון-ה-DOM של §5/U5 חל על ה-`manage-detail` (הוא שמחזיק את `.management-service-card`/`.management-stage-name`).
- **U0/U2** — הפיקסטורות + המודל ללא שינוי (זהות=service.id, SSOT=מסמך). הטסטים של U4/U5 מוסיפים: "כל פאנלי-ה-detail ב-DOM גם כשמוצג אחד" + "המזריקים מזריקים לכל הכרטיסים" + "rail-row אינו `.management-stage`".

**מוק-אפ מאושר (מאסטר-דיטייל):** נשמר חיצונית (artifact) כאסמכתא-עיצובית. הטוקנים/מרווחים/easing שבו (Emil: `:active scale`, `cubic-bezier(.23,1,.32,1)`, grid-rows expand, tab-underline) הם ה-spec החזותי לבנייה.

**סטטוס: פריסה נעולה (מאסטר-דיטייל). מוכן ל-U0.**

---

## 12. עיצוב UI/UX — איך זה ייראה

> מפרט חזותי 1:1 למוק-אפ. מעוגן בטוקנים האמיתיים של `apps/admin-panel/css/design-system.css` ובמחלקות
> החיות של `clients-modals.css` / `report-service-cards.css` / `service-status-management.css`. שפת-הבית:
> **Soft Minimal** (report-service-cards.css:1-15 — "Monochromatic: שחור-לבן-אפור + צבע רק לסטטוס").
> קווי-על: Emil-calm — solid בלבד, אפס gradients בקוד חדש, צבע = סמנטיקה בלבד, אוויר נדיב, RTL מלא.
> כל CSS **חדש** משתמש בטוקנים בלבד (Design Bar); המחלקות הקיימות (grandfathered, ליטרלים) נשארות כמות-שהן.

### 12.1 מעטפת המודאל המאוחד + פס הלשוניות

`#clientManagementModal` נשאר `.modal` (overlay 10200, `rgb(0 0 0 / 60%)` + `backdrop-filter: blur(8px)` —
clients-modals.css:40-57) עם `.modal-content.modal-large` (רדיוס, `max-height: 90vh`, גלילה פנימית). RTL מלא
(`dir="rtl"`). **שני הפאנלים תמיד ב-DOM; החלפה = CSS בלבד** (`hidden` על הפאנל הלא-פעיל) — חוזה המזריקים §6.1-6.2,
render-once-at-open (§11.2 SHOULD).

```
┌──────────────────────────────────────────────────────────────┐
│ ⚙ ניהול לקוח                                            ✕   │  ← .modal-header (קיים, ללא שינוי)
├──────────────────────────────────────────────────────────────┤
│  רעות ואוריאל חליבה   [חסר הסכם שכ"ט]                        │  ← #managementClientInfo (קיים):
│  # תיק: 2025549  ·  📅 נפתח: 12/03/2026 ✏  ·  💼 2/3 פעילים │     שם+באדג'ים+מטא — משותף לשתי הלשוניות
├──────────────────────────────────────────────────────────────┤
│  ┌─────────┐┌───────────┐                                    │  ← פס-לשוניות חדש .cm-tabs (מתחת ל-info,
│  │  ניהול  ││ הפקת דוח  │                                    │     מעל הסקשנים) — underline pattern
│  └─────────┘└───────────┘                                    │
├──────────────────────────────────────────────────────────────┤
│  [ פאנל ניהול — 12.2 ]        או        [ פאנל דוח — 12.3 ]  │  ← שניהם ב-DOM, אחד גלוי
└──────────────────────────────────────────────────────────────┘
```

**פס הלשוניות (`.cm-tabs`, CSS חדש ב-clients-modals.css):**
- מיכל: `display:flex; gap: var(--space-1); border-bottom: 1px solid var(--gray-200); padding: 0 var(--space-6);`
- לשונית (`.cm-tab`, `<button>`): `padding: var(--space-3) var(--space-5); font-size: var(--text-md);
  font-weight: var(--font-medium); color: var(--gray-500); background: none; border: none;
  border-bottom: 2px solid transparent; transition: color var(--transition-fast), border-color var(--transition-fast);`
- פעילה (`.cm-tab.active`): `color: var(--gray-900); font-weight: var(--font-semibold); border-bottom-color: var(--blue);`
- hover לא-פעילה: `color: var(--gray-700);` בלבד — בלי רקע, בלי תזוזה (Emil-calm).
- אייקונים: `fa-cog` לניהול, `fa-file-invoice` לדוח — `font-size: var(--text-sm)`, לפני הטקסט (RTL: מימין).
- **ברירת-מחדל לפי נקודת-כניסה (§11.1-3):** "ניהול לקוח" → לשונית ניהול; "הפק דוח" → לשונית הפקת דוח.
- **תוויות:** "ניהול" / "הפקת דוח" (נעול §11.1-3).

### 12.2 פאנל "ניהול" (mode:'manage') — אנטומיית הכרטיס המאוחד

הפאנל שומר את שלושת הסקשנים הקיימים בסדרם: שירותים → הסכמי שכ"ט → פעולות מהירות. שוויון-DOM חוזי (§5/U5).

```
┌ .management-service-card  [data-service-id="srv_…"] ────────────┐  ← חוזה DOM: המחלקה + data-service-id
│ ┌ .management-service-header (לחיץ → expand/collapse) ────────┐ │     בדיוק כהיום (ServiceOverdraftResolution)
│ │ ⚖ שירות  [פעיל]  [🏷 תביעה]  [הליך משפטי]            ˅     │ │  ← title + .service-status-badge +
│ └──────────────────────────────────────────────────────────────┘ │     .management-service-badge (name/type)
│ ┌ .management-service-body (נפתח ב-.expanded) ─────────────────┐ │
│ │  נרכשו 50.0   ·   נוצלו 46.8 ⓘ   ·   נותרו 3.2              │ │  ← שלושת המספרים (12.2.1)
│ │  ▓▓▓▓▓▓▓▓▓░ 94%                                              │ │  ← .management-hours-progress-fill.critical
│ │  ┌ שלבי ההליך (.management-stages) ────────────────────────┐ │ │
│ │  │ ✔ שלב א'          60.0 שע׳            [+ הוסף שעות]     │ │ │  ← .management-stage.completed; שם-השלב
│ │  │ ◌ שלב ב'     59.2/60.0 שע׳                              │ │ │     לבדו ב-.management-stage-name (חוזה
│ │  │ ○ שלב ג'          60.0 שע׳                              │ │ │     AddPackageToStage — textContent===stage.name)
│ │  └──────────────────────────────────────────────────────────┘ │ │
│ │  📦 חבילות (2)  — טבלת breakdown קיימת + ✏ תאריך-רכישה      │ │
│ │  ┌ חוב פתוח לגביה: 9.9 שעות          [סמן כנגבה] ─────────┐ │ │  ← .overdraft-warning-box — מוזרק ע"י
│ │  └──────────────────────────────────────────────────────────┘ │ │     ServiceOverdraftResolution, לא נבנה בידינו
│ │  [+ חדש שעות] [⇄ שנה סטטוס] [✔ סמן כהושלם]  ·  [🗑 מחק שירות]│ │  ← 12.2.2
│ └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

**12.2.1 שורת שלושת המספרים (נרכשו / נוצלו / נותרו):**
- תוויות `var(--text-sm)` `var(--gray-500)`; ערכים `var(--text-lg)` `var(--font-semibold)` `var(--gray-900)`.
- "נותרו" צבוע סמנטית לפי ה-statusClass הקיים (blocked/critical/warning/success ↔ `var(--red)` /
  `var(--orange)` / `var(--orange-light)` / `var(--green)`) — הסמנטיקה נשארת גזירת-`hoursRemaining` (0/5/10) כהיום.
- **caveat הדריפט (U1, §11.2 SHOULD):** אחרי U1 "נוצלו" = `service.hoursUsed` המאוחסן, ולכן ייתכן
  `נרכשו − נוצלו ≠ נותרו`. הצגה רגועה: כשהשוויון לא מתקיים (בטולרנס 0.05) מופיע אייקון `ⓘ` עדין
  (`var(--gray-400)`, `var(--text-xs)`) צמוד ל"נוצלו", עם tooltip (title + aria-label):
  "הנתונים נקראים ישירות ממערכת הרישום; ייתכן פער קטן בין המספרים עד לסנכרון". **בלי** צבע-אזהרה,
  **בלי** באדג' — זו שקיפות, לא תקלה. ה-progress% ממשיך להיגזר מנוצלו/נרכשו כהיום.
- fixed-price: במקום השורה — "מחיר ₪X" + "שעות עבודה (מדידה פנימית) Y" (התוכן הקיים של `getServiceInfo`).

**12.2.2 כפתורי הפעולות (`.management-service-action-btn`, קיימים):**
primary (חדש שעות / עבור לשלב הבא) · secondary (שנה סטטוס / סמן כהושלם) · **danger (מחק שירות): מובחן אך לא
צעקני** — outline: `background: none; border: 1px solid var(--red); color: var(--red-dark);` ומופרד ויזואלית
בקצה השורה (margin-inline-start: auto ב-RTL). ההרס נשאר מאחורי `confirm` כהיום (invariant §9). "סגור תיק" נשאר
ב"פעולות מהירות" של המודאל, danger, לא בתוך כרטיס.

**חוזי DOM שהעיצוב מחויב להם (inline, לנעילה בטסט U5):** `.management-service-card[data-service-id]` ·
`.management-service-header` + `.expanded` · `.management-stage` / `.management-stage-name`
(**textContent === stage.name בדיוק** — כל קישוט שעות/אייקון באלמנטים אחים בלבד) / `.management-stage-info` ·
`[data-service-action]` ×5 · `.override-btn` · `.edit-pkg-date-btn` · `.management-services-list` נשאר המיכל.
קופסת-החוב (`.overdraft-warning-box`/`.overdraft-resolved-box`) **מוזרקת** ע"י ServiceOverdraftResolution —
העיצוב שלנו רק משאיר לה מקום בתחתית הכרטיס ולא מייצר אותה.

**סקשן הסכמי שכ"ט:** ללא שינוי עיצובי (`.fee-agreement-item` + empty-state קיימים).

### 12.3 פאנל "הפקת דוח" (mode:'report-select')

סדר אנכי: תקופה → בחירת שירות → פורמט → כפתורים. ids חדשים בקידומת `mgmtReport*`; שמות רדיו
`mgmtReportFormat`/`mgmtReportType` (DA-1). **אף מחלקת `.management-stage*` לא נפלטת בפאנל הזה** (DA-3) —
כרטיסי הבחירה משתמשים במחלקות `.report-*` הקיימות (grandfathered).

```
┌ בחר תקופה ───────────────────────────────────────────────────┐
│  מתאריך [12/03/2026]   עד תאריך [31/07/2026]                 │
│  (החודש) (חודש שעבר) (3 חודשים) (השנה) (●מההתחלה)            │  ← .btn-quick-date; ברירת-מחדל 'all'
├ בחר שירות * ─────────────────────────────────────────────────┤
│  ┌ .report-service-card ─────────┐ ┌ .report-service-card ──┐ │  ← grid 2 עמודות, gap 16px
│  │ תביעה              [שעתי ⚖]  │ │ תוכנית שעות    [שעות 🕐]│ │     (report-service-cards.css:22-28)
│  │ הליך משפטי • שעתי             │ │ שירות שעות             │ │
│  │ ┌ בוחר-שלב (12.3.1) ────────┐ │ │  סה"כ 100 · בשימוש 42.5│ │
│  │ │ ○ שלב א' (הושלם)  69.9/60 │ │ │  ▓▓▓▓░░ 43%           │ │
│  │ │ ● שלב ב' (פעיל)    0.8/60 │ │ │                        │ │
│  │ │ 🔒 שלב ג' (ממתין)    60   │ │ │                        │ │
│  │ └───────────────────────────┘ │ │                     ✓  │ │  ← .report-card-selected-indicator
│  └───────────────────────────────┘ └────────────────────────┘ │
│  ⓘ שעות ללא שיוך: 3.5 שעות (רשומות שאינן משויכות לשירות)     │  ← 12.3.2 — שורת-מידע, לא כרטיס
├ פורמט הדוח ──────────────────────────────────────────────────┤
│  (●) PDF להדפסה   ( ) Excel לעריכה                           │  ← name="mgmtReportFormat" (DA-1)
├──────────────────────────────────────────────────────────────┤
│  [ביטול]                 [🕐 הפק דוח]  [✉ הפק ושלח במייל]    │  ← primary / secondary-"בקרוב"
└──────────────────────────────────────────────────────────────┘
```

- **כרטיס בחירה:** `.report-service-card` הקיים — לבן, `border: 1px #e5e7eb`, רדיוס 12px, קו-מבטא בקצה
  הימני (RTL) ‎3px; נבחר = `border #3b82f6 + רקע #f8fafc + ✓` (`report-service-cards.css:34-81`). וריאנטים:
  overdraft ‎#dc2626 · resolved ‎#10b981 · fixed ‎#8b5cf6 — כהיום. חדש (U4): הכרטיסים מקבלים לראשונה
  `overdraftResolved` אמיתי → באדג' "הוסדר" מיושר עם הניהול (שינוי מוצהר §7.6).
- **12.3.1 בוחר-השלב בתוך כרטיס legal_procedure (חדש, CSS בטוקנים):** רשימת radio אנכית בתוך הכרטיס,
  `role="radiogroup"` + `aria-label="בחירת שלב לדוח"`. שורה: `padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm); font-size: var(--text-base);`. ברירת-מחדל = השלב הפעיל (מסומן ●,
  `var(--blue)`); **completed בחיר** (○, `var(--gray-600)`, תווית "(הושלם)"); **pending נעול** (§11.1-1):
  `🔒` + `opacity: .55; cursor: not-allowed;` + `aria-disabled="true"` + tooltip "שלב עתידי — טרם נפתח לדיווח".
  לחיצה על הכרטיס בוחרת את הכרטיס + השלב הפעיל; לחיצה על שורת-שלב בחירה מדויקת. **הבחירה תמיד פולטת
  `stage` מאוכלס (DA-2)** — אין מצב UI של "שירות משפטי נבחר בלי שלב".
- **12.3.2 שורת "שעות ללא שיוך" (`meta.unassignedHours`, §11.1-2):** מחוץ לגריד, מתחתיו. **לא כרטיס** —
  שורה שקטה: `display:flex; gap: var(--space-2); padding: var(--space-3) var(--space-4);
  background: var(--gray-50); border: 1px dashed var(--gray-300); border-radius: var(--radius-sm);
  color: var(--gray-600); font-size: var(--text-base);` + `ⓘ`. לא לחיצה, לא focusable, `role="note"`.
  מוצגת רק כש-N > 0.
- **כפתורי הפקה:** [הפק דוח] = primary כחול (`var(--blue)` solid). [הפק ושלח במייל] = secondary (outline,
  `var(--gray-300)` border) + באדג'-טקסט קטן "בקרוב" (`var(--text-xs)` `var(--gray-400)`) — ה-stub נשאר
  כמות-שהוא (§11.1-6), כפתור מפורש בלבד (invariant §9).
- **preview + עריכת-רשומה (אחרי "הפק דוח"):** ה-overlays הקיימים מ-U3 (`ReportPreview.js`) — פאנל-צד ימני
  600px עם טבלת הרשומות + ✏ לכל שורה, ומודאל עריכה 520px (תאריך/עובד נעולים, דקות+תיאור עריכים,
  [ביטול][שמור שינויים]). **מעל המודאל המארח**: סולם ה-z-index לפי DA-4 — מעל 100000 (או ערך מתועד ב-rubric
  של U3), כך שה-preview לעולם לא נבלע מאחורי המודאל (10200) או מאחורי `.status-change-modal-overlay` (100000).
  המודאל המארח **לא נסגר** בפתיחת ה-preview (§7.8).

### 12.4 כרטיס אחד, שני מצבים — משותף מול שונה

| היבט | mode:'manage' | mode:'report-select' |
|---|---|---|
| מקור נתונים | `ServiceCardModel.build` — אותו מודל בדיוק | אותו מודל בדיוק |
| כותרת + באדג'י סוג/סטטוס/ארכיון | ✔ זהה (אותה היררכיית באדג'ים) | ✔ זהה |
| שלושת המספרים + progress | ✔ + caveat-דריפט ⓘ | ✔ (compact, בתוך הכרטיס) |
| מחלקות DOM | `.management-service-card` + חוזה המזריקים | `.report-service-card` בלבד (DA-3) |
| בחירה (selectable) | ✗ — אין מצב selected | ✔ — selected + ✓ + עדכון state הבקר |
| שלבים | תצוגת ציר `.management-stage` + כפתור "הוסף שעות" מוזרק | בוחר-שלב radio (12.3.1), נעול-pending |
| פעולות (renew/status/complete/delete) | ✔ | ✗ — אין פעולות בכרטיס-בחירה |
| חבילות breakdown + ✏ תאריך | ✔ | ✗ |
| קופסת-חוב מוזרקת | ✔ (ServiceOverdraftResolution) | ✗ (באדג' חריגה/הוסדר בלבד) |
| expand/collapse | ✔ (`.expanded`) | ✗ — הכרטיס תמיד מלא (min-height 160px) |

### 12.5 כל המצבים (calm — אף מצב לא "צועק")

| מצב | תצוגה |
|---|---|
| אין שירותים (ניהול) | `.management-empty-state` הקיים: 📥 "אין שירותים פעילים" + "הוסף שירות חדש כדי להתחיל" |
| אין שירותים (דוח) | אותו דפוס empty-state + כפתורי ההפקה `disabled` (`opacity:.5`) + "אין שירותים להפקת דוח" |
| שירות/לקוח בארכיון | באדג' `[🗄 בארכיון]` אפור (`var(--gray-500)`) בשני המצבים; בדוח — הכרטיס נשאר בחיר (דוח היסטורי), בלי עמעום |
| חריגה (חוב פתוח) | ניהול: קופסת-החוב המוזרקת (אדום-עדין, border-right ‎3px) + באדג' "חריגה"; דוח: וריאנט overdraft (קו-מבטא ‎#dc2626) + באדג' — בלי אנימציה, בלי הבהוב |
| חוב שנגבה | באדג' "הוסדר" ירוק + קו-מבטא ‎#10b981 — בשני המצבים (חדש בדוח, §7.6) |
| שעות ללא שיוך | שורת-המידע 12.3.2 — dashed, אפורה, לא-לחיצה |
| legal_procedure בלי שלב פעיל (`legalNoActiveStage`, DA-2) | הכרטיס בחיר רק דרך שלב קונקרטי: אין ●-ברירת-מחדל; שורות completed בחירות; אם אין אף שלב בחיר — הכרטיס `aria-disabled` + עמעום + "אין שלב זמין לדיווח". לעולם לא נפלט `stage:''` |
| טעינה | ה-`#loadingOverlay` הקיים (ספינר) בפתיחת המודאל; כפתור "הפק דוח" בזמן עבודה: `disabled` + ספינר בתוך הכפתור (דפוס `saveTimesheetBtn` הקיים) |
| שגיאה | `window.notify` העברי הקיים (G1 — עברית + פעולה-הבאה); שגיאת-טעינת-שעתון: ה-toast הלא-נעלם של `warnIfTruncated` נשאר כהיום |

### 12.6 שפת עיצוב — טוקנים, נגישות, רספונסיביות (MUST)

- **טוקנים בלבד בכל CSS חדש** (design-system.css): ריווח `--space-1..12` (רשת 4px) · אפורים `--gray-50..900` ·
  סמנטיים `--blue`(#3b82f6)/`--green`/`--orange`/`--red` (+`-light`/`-dark`) · רדיוס `--radius-sm`(8)/`--radius-md`(12) ·
  טיפוגרפיה `--text-xs..2xl` + `--font-medium/semibold/bold` · צל `--shadow-sm/md` · מעברים
  `--transition-fast/smooth` **בלבד** — לעולם לא ליטרל `200ms` (ה-safety-net של `prefers-reduced-motion`
  יושב בשכבת הטוקנים, design-system.css:169-175, ומאפס אותם אוטומטית).
- **אין gradients, אין dark-mode** — האדמין הוא אפליקציית light בלבד (אין תשתית theme; לא ממציאים).
- **`:focus-visible` על כל אלמנט אינטראקטיבי חדש** (לשוניות, כרטיסי-בחירה, שורות-שלב, quick-dates, כפתורים):
  `outline: 2px solid var(--blue); outline-offset: 2px;` — MUST של ה-Design Bar.
- **ARIA ללשוניות (מלא):** המיכל `role="tablist"` + `aria-label="תצוגות כרטיס לקוח"`; כל לשונית
  `role="tab"` + `aria-selected` + `aria-controls="cm-panel-manage|cm-panel-report"` + roving tabindex
  (פעילה `tabindex="0"`, השאר `-1`; חצים ←/→ נעים ביניהן — RTL-aware); הפאנלים `role="tabpanel"` +
  `aria-labelledby` + `tabindex="-1"`, והפוקוס עובר לפאנל בהחלפה. הפאנל המוסתר — `hidden` (לא `display`
  אינליין), כך שהוא נשאר ב-DOM לחוזה המזריקים אך מחוץ לעץ-הנגישות.
- **כרטיס-בחירה נגיש:** `role="radio"` + `aria-checked` בתוך `role="radiogroup"` "בחירת שירות לדוח";
  ניתן לבחירה ב-Enter/Space; שם נגיש = שם-השירות.
- **רספונסיביות (breakpoints קיימים):** ‎≤768px — המודאל 100%/95vh, `form-row` נערם, quick-dates לעמודה
  (clients-modals.css:1405-1429); ‎≤640px — גריד הכרטיסים לעמודה אחת (report-service-cards.css:407-421).
  חדש: פס-הלשוניות נשאר שורה אחת (2 לשוניות נכנסות תמיד); ב-≤768px ה-preview-panel (600px) הופך
  full-width; שורת שלושת-המספרים נערמת אנכית בתוך כרטיס צר. `אין לי ודאות` לגבי התנהגות ‎<380px —
  לא קיים breakpoint כזה בקבצים; המוק-אפ יידרש להוכיח 360px ידנית.
- **RTL:** קו-המבטא של הכרטיס בקצה הימני (קיים), chevrons של expand הפוכים, `margin-inline-*` בלבד בקוד חדש.

### 12.7 מה המשתמש רואה משתנה (קשור ל-§7)

- **קובי הראל (2025994):** בלשונית הדוח מופיעים לראשונה **שני** כרטיסי הליך נפרדים — "תביעה" (46.8/50,
  השלב הפעיל, ברירת-המחדל לבחירה) ו"כתב הגנה" (22.1/45) — במקום כרטיס יחיד גנרי "הליך משפטי - שלב א'"
  עם מספרים של השירות הלא-נכון. "תביעה" חזר.
- **רעות ואוריאל חליבה (2025549):** כרטיס-הפאנטום "בשימוש 61.2 / סה"כ 0" **נעלם**; במקומו — אם ואכן קיימות
  רשומות לא-משויכות — שורת-המידע השקטה "שעות ללא שיוך" מתחת לגריד. הכרטיסים שנשארים מציגים את
  המספרים המאוחסנים האמיתיים.
- **כל לקוח עם דריפט:** "נוצלו" בניהול עשוי להשתנות (קריאת המאוחסן, U1) + ⓘ שקט כשהמספרים לא מסתכמים.
- **נקודת-כניסה:** "הפק דוח" פותח את אותו כרטיס-לקוח אחד — על לשונית הדוח; ההקשר הניהולי במרחק לחיצת-לשונית.
- **preview:** נפתח מעל הכרטיס בלי לסגור אותו; ביטול מחזיר לאותו מקום (הדפוס השבור של close-then-reopen מת).

---

## 14. מלאי פיצ'רים — parity checklist (כלום לא נופל)

> מלאי ממצה של **כל** affordance/פעולה/תת-זרימה בשני המודאלים + הפיצ'רים המוזרקים, מאומת שורה-שורה מול
> הקוד החי ב-`origin/main` (2026-07-31). עמודת "משטח מאוחד" לפי פריסת המאסטר-דיטייל הנעולה (§13):
> **shell** = header+info המשותפים · **rail-manage / detail-manage** = לשונית ניהול · **rail-report /
> detail-report** = לשונית דוח · **overlay** = שכבות מעל המודאל · **inject** = נבנה ע"י פיצ'ר מזריק, לא על-ידינו.
> עמודת "שער-PR" = ה-PR שה-rubric שלו חייב להוכיח את השורה (טסט או שורת-smoke נקובה — ראו §15-VAL-1).
> **סה"כ: 43 שורות · 40 נשמרות (YES) · 2 orphan-drop מוצהרות · 1 OPEN (מיקום, לא יכולת).**

### 14.1 מעטפת + רמת-לקוח (8)

| # | פיצ'ר / affordance | היום (קובץ:שורה · מודאל) | callable/CF | משטח מאוחד | נשמר? | הערות / שער-PR |
|---|---|---|---|---|---|---|
| 1 | פתיחה/סגירה: X · backdrop · ESC | `ClientManagementModal.js:64-93` · ניהול | — | shell | YES | ESC/backdrop לא משתנים; capture-early נשמר · **U4** |
| 2 | כותרת-לקוח: שם, מס' תיק, נפתח, X/Y שירותים פעילים | `:297-348` · ניהול (+מקבילה בדוח `ClientReportModal.js:213-254`) | — | shell (משותף לשתי הלשוניות) | YES | תאריך-הרשמה מהדוח נבלע לאותה כותרת · **U4** |
| 3 | באדג' "חסר הסכם שכ"ט" | `:313-320` · ניהול | — | shell | YES | מתעדכן אחרי upload/delete (:2350/:2449) · **U4** |
| 4 | ✏ עריכת תאריך פתיחת-תיק | `:147-207` (כפתור :335) · ניהול | `updateClient` {clientId, caseOpenDate} | shell (ליד "נפתח") | YES | **הדוגמה מקבוצת-הפחד של חיים — נשאר בכותרת המשותפת**; מעדכן גם את עוגן 'מההתחלה' של הדוח (:196-198) · **U4** |
| 5 | שינוי סטטוס לקוח (active/inactive/on-hold + הערה) | `:1089-1302` · ניהול, quick-action | `changeClientStatus` {clientId, newStatus, isOnHold, note} | פאנל ניהול — פעולות-מהירות | YES | isBlocked/isCritical חוזרים מה-CF בלבד (invariant §9) · **U5** |
| 6 | סגירת תיק (ארכוב הכל) | `:1308-1375` · ניהול, quick-action | `closeCase` {clientId} | פאנל ניהול — פעולות-מהירות (danger) | YES | confirm + עדכון אגרגטים מתשובת CF · **U5** |
| 7 | הוספת שירות חדש (3 סוגים + שדות דינמיים) | `:853-1057` + `#addServiceModal` (clients.html:478-549) · ניהול | `addServiceToClient` {clientId, serviceType, serviceName, …} | מודאל-משנה קיים (ללא שינוי) + כפתור בפעולות-מהירות | YES | ה-modal הנפרד לא נוגעים בו; רק הטריגר · **U5** |
| 8 | קיצור "חדש חבילת שעות" (quick-action; שירות-יחיד) | `:1059-1076` · ניהול | → `addPackageToService` (דרך #14) | פאנל ניהול — פעולות-מהירות | YES | רב-שירותים → הודעת-הכוונה כהיום · **U5** |

### 14.2 כרטיס-שירות — mode:'manage' (12)

| # | פיצ'ר | היום | callable/CF | משטח מאוחד | נשמר? | הערות / שער-PR |
|---|---|---|---|---|---|---|
| 9 | expand/collapse כרטיס (`.expanded`, אחד-פתוח) | `:398-417` · ניהול | — | rail-manage (בחירת שורה) + detail תמיד-פתוח | YES | במאסטר-דיטייל הבחירה ב-rail מחליפה את הקיפול; **כל ה-details ב-DOM** (§13) · **U5** |
| 10 | באדג'ים: סטטוס (active/completed/on-hold/archived) · שם · סוג | `:424-502` · ניהול | — | rail-row (קומפקטי) + detail-manage (מלא) | YES | archived = פריטת `NON_AGGREGATING_STATUSES` (invariant §9) · **U5** |
| 11 | שלושת המספרים + progress + statusClass (0/5/10) | `:509-594` · ניהול | — | detail-manage | YES | אחרי U1: hoursUsed מאוחסן + ⓘ-דריפט (§12.2.1) · **U1+U5** |
| 12 | טבלת חבילות (תאריך/שעות/נוצלו/נותרו/תיאור) | `_renderPackagesBreakdown` :1403-1459 · ניהול | — | detail-manage | YES | · **U5** |
| 13 | **✏ שינוי תאריך-רכישה של חבילה** | `.edit-pkg-date-btn` :1424-1429 → `_editPackagePurchaseDate` :1461-1585 · ניהול | `updatePackagePurchaseDate` {clientId, serviceId, packageId, purchaseDate} | detail-manage (בטבלת החבילות) | **YES** | **הפיצ'ר שחיים נקב בו** — נשמר 1:1 כולל capture-early + עדכון in-memory מותנה (:1547-1560) · **U5** |
| 14 | חידוש שעות לשירות ("חדש שעות") | `renewServiceHours`/`_submitRenewHours` :1587-1742 · ניהול | `addPackageToService` {clientId, serviceId, hours, description?, purchaseDate?} | detail-manage (primary action) | YES | ModalManager sub-dialog (10300) · **U5** |
| 15 | מעבר לשלב הבא | `:1744-1806` · ניהול | `moveToNextStage` {clientId, serviceId} | detail-manage (legal עם שלב פעיל) | YES | חד-כיווני; confirm; currentStage מתעדכן מתשובת CF · **U5** |
| 16 | סימון שירות כהושלם | `:1808-1856` · ניהול | `completeService` {clientId, serviceId} | detail-manage | YES | · **U5** |
| 17 | שינוי סטטוס שירות (4 מצבים + הערה) | `:1862-2030` · ניהול | `changeServiceStatus` {clientId, serviceId, newStatus, note} | detail-manage | YES | overlay 100000 (`service-status-management.css`) — מעל הכל; נשאר · **U5** |
| 18 | מחיקת שירות | `:2032-2090` · ניהול | `deleteService` {clientId, serviceId, confirmDelete:true} | detail-manage (danger, מופרד) | YES | confirm + הודעת-רפרנציאליות ידידותית (:2084-2088); לעולם לא ב-default view (invariant §9) · **U5** |
| 19 | אישור/ביטול חריגה לשירות חסום ("אפשר חריגה") | `:209-295` (UI :538-556) · ניהול | `setServiceOverride` {clientId, serviceId, active, note} | detail-manage (בבלוק שירות-חסום) | YES | שונה מ-overdraft-resolution (#31-32)! שני מנגנונים נפרדים — שניהם נשמרים · **U5** |
| 20 | תצוגת fixed-price (מחיר + סטטוס; בלי מסגרת-שעות) | `:615-626` · ניהול | — | detail-manage | YES | isFixedService הקנוני (client-type-display.js:37-43) · **U5** |

### 14.3 רמת-שלב (3)

| # | פיצ'ר | היום | callable/CF | משטח מאוחד | נשמר? | הערות / שער-PR |
|---|---|---|---|---|---|---|
| 21 | ציר-שלבים: אייקון-סטטוס + שעות-לפי-מצב (active: נותר/סה"כ · השאר: סה"כ) | `renderStages` :634-709 · ניהול | — | detail-manage | YES | `.management-stage-name` === stage.name בדיוק (חוזה #22) · **U5** |
| 22 | **"+ הוסף שעות" לשלב פעיל (מוזרק)** | `AddPackageToStage.js:586-644` · inject לניהול | `addHoursPackageToStage` {caseId(=caseNumber!), stageId, hours, reason, purchaseDate} | inject → detail-manage | YES | הפיצ'ר לא-נגוע; רק חוזה ה-DOM נשמר (rail בלי `.management-*` — DA-3); פגם ההליך-הראשון-בלבד (:571) מתועד, לא ננעל · **U5** |
| 23 | הצגת סטטוס-שלב בדוח (פעיל/הושלם/ממתין) | `ClientReportModal.js:364-405` (באדג'ים :750-799) · דוח | — | detail-report — בורר-השלב (12.3.1) | YES | pending מוצג-נעול (§11.1-1) — שדרוג-תצוגה מוצהר (§7.4) · **U4** |

### 14.4 הסכמי שכר-טרחה (4)

| # | פיצ'ר | היום | callable/CF | משטח מאוחד | נשמר? | הערות / שער-PR |
|---|---|---|---|---|---|---|
| 24 | רשימת הסכמים + empty-state + "הוסף הסכם" | `:2160-2242` · ניהול | — | פאנל ניהול — סקשן מתחת ל-split (ראו OPEN-1) | YES | · **U5** |
| 25 | העלאת הסכם (PDF/תמונה, ≤6MB, base64) | `:2310-2368` (input clients.html:438-439) · ניהול | `uploadFeeAgreement` {clientId, fileName, fileData, fileType, fileSize} | כנ"ל | YES | ולידציית סוג+גודל בצד-לקוח נשמרת · **U5** |
| 26 | צפייה בהסכם (signed-URL) | `:2374-2411` · ניהול | `getFeeAgreementUrl` {entity:'clients', entityId, agreementId} | כנ"ל | YES | פתיחת-טאב סינכרונית לפני ה-await (חסימת-popup) — הדפוס נשמר 1:1; ה-URL לא נכתב ל-DOM/log (§15-SEC-3) · **U5** |
| 27 | מחיקת הסכם | `:2417-2467` · ניהול | `deleteFeeAgreement` {clientId, agreementId} | כנ"ל | YES | confirm + עדכון באדג'-הכותרת · **U5** |

### 14.5 חוב/חריגה — overdraft resolution (מוזרק) (3)

| # | פיצ'ר | היום | callable/CF | משטח מאוחד | נשמר? | הערות / שער-PR |
|---|---|---|---|---|---|---|
| 28 | קופסת "חוב פתוח לגביה: N שעות" | `ServiceOverdraftResolution.js:552-712` · inject לניהול | — | inject → detail-manage (כל ה-details ב-DOM — §13) | YES | · **U5** |
| 29 | "סמן כנגבה" + מודאל-הסבר (חובה, ≤500 תווים) | `:717-826` · inject | `setServiceOverdraftResolved` {clientId, serviceId, resolved:true, note} | inject → overlay | YES | סוגר את המודאל אחרי הצלחה (:841) — נשמר · **U5** |
| 30 | "בטל סימון" (אדמין) + מפתח `overdraftResolved.isResolved` | `:854-905` · inject | `setServiceOverdraftResolved` {…, resolved:false} | inject | YES | מפתח הספירה/פילטר — invariant §9; בדיקת-האדמין הרכה (:651) לא מוחמרת ולא מוחלשת · **U5** |

### 14.6 צד הדוח (10)

| # | פיצ'ר | היום | callable/CF | משטח מאוחד | נשמר? | הערות / שער-PR |
|---|---|---|---|---|---|---|
| 31 | בחירת שירות (כרטיסים + ✓ + hidden dataset) | `:643-948` · דוח | — | rail-report (radiogroup) + detail-report | YES | חוזה dataset serviceName/serviceId/stage נשמר ביט-לביט (§6.4) · **U4** |
| 32 | בחירת שלב | היום: כרטיס-לכל-שלב (הבאגים D1/D2) · דוח | — | detail-report — בורר-שלב 12.3.1 | YES (מתוקן) | `stage` תמיד מאוכלס (DA-2) · **U4** |
| 33 | טווח תאריכים + 5 quick-dates (ברירת-מחדל 'all' מעוגן caseOpenDate) | `:969-1047` · דוח | — | detail-report | YES | · **U4** |
| 34 | פורמט PDF / Excel (+reportType נסתר) | `:1053-1069` + HTML :359-378 · דוח | — | detail-report (`name="mgmtReportFormat"` — DA-1) | YES | · **U4** |
| 35 | ולידציה: שירות-חובה + טווח-תקין (scroll+highlight+notify) | `:1075-1142` · דוח | — | detail-report | YES | הודעות עברית + next-action (G1/G5) · **U4** |
| 36 | תצוגה-מקדימה: טבלת רשומות (תאריך/תיאור/דקות) | `:1159-1310` · דוח | קריאת `ReportGenerator.fetchReportData` | overlay (ReportPreview, מעל המארח) | YES | לא סוגר את המארח (§7.8) · **U3** |
| 37 | **עריכת רשומת-שעתון מה-preview** (דקות+תיאור; תאריך/עובד נעולים; editHistory) | ✏ :1287-1300 → `:1672-1907` · דוח | `updateTimesheetEntry` {entryId, date, minutes, action, editHistory, taskId, autoGenerated, clientId, serviceId} | overlay (ReportPreview) | **YES** | ה-payload ביט-זהה (source-guard U0 חי לאורך כל התוכנית); רענון-preview אחרי שמירה נשמר · **U3** |
| 38 | הפקת דוח: HTML/PDF(print) + Excel-CSV (CsvSafe fail-secure) | `ReportGenerator.js:28-63, 196-217, 1051-1116` | — | detail-report → [הפק דוח] | YES | סדר-טעינה csv-safe→ReportGenerator לא משתנה · **U4** |
| 39 | תוכן הדוח: service-info + running-balance + packages + summary + fixed-variants | `:610-1045, 1215-1406` | — | ללא שינוי (המנוע לא נבלע) | YES | `resolveServiceHours` נשאר ה-SSOT · כל ה-PRs |
| 40 | "הפק ושלח במייל" | `:1451-1499` → `generateAndEmail` :1122-1135 | (מפיק דוח; אין egress-מייל) | detail-report — secondary + "בקרוב" (§11.1-6) | YES | כפתור מפורש בלבד (invariant §9) · **U4** |

### 14.7 שונות + orphans (3)

| # | פיצ'ר | היום | callable/CF | משטח מאוחד | נשמר? | הערות / שער-PR |
|---|---|---|---|---|---|---|
| 41 | loading overlay + ספינר-בכפתור + toasts + window.notify | שני המודאלים | — | ללא שינוי (דפוסים קיימים) | YES | §12.5 · **U4/U5** |
| 42 | `ReportGenerator.editTimesheetEntry(button)` | `:1412-1450` — **orphan: אפס callers בכל ה-repo** (אומת grep) | → היה מדלגר ל-openEditTimesheetModal | — | **NO — drop מוצהר** | קוד-מת (ה-onclick שקרא לו כבר לא קיים); ה-alias `window.reportGenerator` נשאר; נמחק ב-U7 עם תיעוד |
| 43 | `ClientReportModal.generateReport()` (הפקה בלי preview) | `:1397-1445` — **לא קשור לאף כפתור** (#generateReportBtn → preview :108-111) | → `ReportGenerator.generate` | — | **NO — drop מוצהר** | מתודה בלתי-נגישה מה-UI; הזרימה החיה (preview→proceed) נשמרת ב-#36+#38; נמחק ב-U7 |

**OPEN-1 (מיקום, לא יכולת):** במאסטר-דיטייל, סקשן **הסכמי שכ"ט** (#24-27) וסקשן **פעולות-מהירות** (#5-8)
אינם פר-שירות — §13 לא קבע להם מיקום. הצעה: אזור full-width מתחת ל-split בלשונית הניהול (הסדר הקיים
נשמר: שירותים → הסכמים → פעולות). **היכולות נשמרות בכל מקרה**; רק המיקום להכרעת חיים במוק-אפ. אין עוד
שורה ללא בית.

**כלל-הזהב לכל PR:** לפני מיזוג U4/U5 — לעבור על עמודת "שער-PR" של הטבלה; כל שורה עם ה-PR הזה חייבת
טסט אוטומטי **או** שורת-smoke נקובה ב-PR body (ראו §15-VAL-1). שורה שלא הוכחה = ה-PR לא ממוזג.

---

## 15. סקירת אבטחה + איכות + ולידציה (Fable 5)

> נערכה אחרי נעילת §13 (מאסטר-דיטייל) + §14 (parity). עדשות: security-access · outcomes-grader ·
> validation. הציטוטים מהקוד החי ב-`origin/main`; G1–G7 = `.claude/rubrics/_PRODUCT-GRADE-GATES.md`
> (G1 שגיאות-מקצועיות · G2 rollback · G3 monitoring-אם-כותב · G4 טסט-תרחיש-לקוח · G5 עברית ·
> G6 אין-שבירה-בלי-מיגרציה · G7 סקירת-אבטחה-אם-PII/auth).

### 15.1 אבטחה

**SEC-0 · Frontend-only מאומת:** רשימות-הקבצים של כל 8 ה-PRs (§5) נוגעות אך ורק ב-`apps/admin-panel/**`,
`tests/**`, `docs/**`. אף CF חדש, אף שינוי rules/claims, אף שינוי ב-`shared-web/**`. כל ההרשאות נאכפות
בצד-שרת כהיום — האיחוד מזיז UI בלבד, וכל 16 ה-callables שב-§14 נקראים עם אותם payloads (נעולים
ב-source-guards). ✅

**SEC-1 · 🔴 חובה — escape-at-sink ברנדרר המאוחד + סגירת פערים חיים שנמצאו בסקירה.** המדיניות הקיימת
(escapeHtml SSOT — `js/core/escape-html.js`, נתיבי-routing מוגנים בטסטים) חייבת לחול על כל sink חדש.
בנוסף, נמצאו **פערים קיימים** בקוד שממנו מעתיקים — אסור להעתיק אותם:
- `ClientManagementModal.js:441` — `title="${service.name || 'ללא שם'}"` — שם-שירות **לא-מוברח לתוך attribute**
  (הטקסט כן מוברח, ה-title לא). ברנדרר המאוחד: escape גם ב-attributes.
- `ClientManagementModal.js:547-548` — `overrideApprovedBy` + `overrideNote` (קלט-משתמש חופשי!) מוזרקים
  **raw** ל-innerHTML של בלוק-ה-override.
- `ClientManagementModal.js:219/:227` — `serviceName` raw ב-`showOverrideModal` (מגיע מ-dataset עם escape
  חלקי `&quot;` בלבד).
- `ClientReportModal.js:1222` — `${clientName}` raw בכותרת ה-preview (`insertAdjacentHTML`). עובר ל-
  `ReportPreview.js` ב-U3 — **לתקן בהעברה** (בעקבות הדפוס של PR #382 שהבריח 10 sinks בדוח עצמו).
- `ClientReportModal.js:1629` — `${message}` raw ב-showToast (כולל `error.message` שרת-מקורי).
**פעולה:** MUST ב-rubrics של U3 (שני האחרונים) ו-U5 (שלושת הראשונים); שינוי מיקרו-התנהגותי מוצהר
(entities מוברחים). טסט: fixture עם `name: '"><img src=x onerror=…>'` עובר את הרנדרר בלי לפרוץ.

**SEC-2 · PII בלוגים — כלל למודולים חדשים:** הקוד הקיים מדפיס אובייקטי-לקוח מלאים
(`ClientReportModal.js:271-280` — `allClientData`; :215-220). **מודולים חדשים (ServiceCardModel /
UnifiedServiceCard / ReportTab / ReportPreview): אסור ללוגג שמות-לקוח/שמות-שירות/שעות — ids בלבד.**
U7 מוחק אגב-אורחא את הלוג הרועש :271-280 (שיפור). לא נדרש לטהר לוגים קיימים מחוץ לקבצים הנגועים.

**SEC-3 · signed-URL של הסכמי שכ"ט:** `viewFeeAgreement` (:2374-2411) כבר על המנגנון המוקשח
(PR-SEC-1 — `getFeeAgreementUrl`, URL קצר-מועד, אין URL ציבורי קבוע; ההערה בקוד :2382-2386). ההעברה
ל-detail-manage חייבת לשמר: פתיחת-טאב סינכרונית → ניווט אחרי ה-await; **ה-URL לעולם לא נכתב ל-DOM,
ל-console, או ל-dataset**. (סטטוס PR-SEC-2/#380 — לפי זיכרון-הפרויקט עדיין OPEN וגייטד; `אין לי ודאות`
עדכנית — לא משנה את התוכנית הזו, המודאל צורך את ה-callable הקיים בלבד.)

**SEC-4 · מאסטר-דיטייל "הכל ב-DOM" — אין חשיפה חדשה:** כל נתוני-הלקוח ממילא חיים באובייקט
`currentClient` בזיכרון-הדף; DOM מוסתר אינו גבול-אמון. העמוד admin-only (initAuthGuard + rules צד-שרת).
מחלקת-דליפת-ה-overlay (לקח tofes): ה-listener הקיים של cross-tab-logout (clients.html:630-636) מנווט
מיד ל-index — המודאל וה-overlays נעלמים עם הדף; ה-overlays החדשים (preview/edit) לא שורדים ניווט. ✅

**SEC-5 · בדיקת-האדמין הרכה ב"בטל סימון"** (`ServiceOverdraftResolution.js:651` —
`window.authSystem?.isAdmin !== false`, מתועד "כל מי שנכנס לדף הוא אדמין"): נשמרת כמות-שהיא. ההגנה
האמיתית בצד-שרת (`setServiceOverdraftResolved`). לא מחמירים ולא מקלים במסגrern התוכנית — כל שינוי כאן =
מחוץ-לסקופ ומוצהר.

**SEC-6 · CsvSafe:** ייצוא-Excel נשאר מאחורי `ensureCsvSafe` fail-secure (`ReportGenerator.js:1864-1873`);
סדר-הטעינה csv-safe→ReportGenerator לא משתנה באף PR. ✅

### 15.2 איכות (מול G1–G7 + הרף §2.0.1)

| שער | הערכה |
|---|---|
| G1 שגיאות מקצועיות | ✅ מכוסה §12.5 (notify עברית + next-action); ה-shim ל-fluent משדרג שבור-בשקט להודעה מסודרת (U7) |
| G2 rollback | ✅ לכל PR revert-sha יחיד (squash); U6 = נקודת-החזרה המלאה לפני מחיקה |
| G3 monitoring | ✅/N-A — אף PR לא מוסיף מסלול-כתיבה; לנמק N/A מפורשות ב-PR body של U3/U5 (מסלולי-כתיבה מוזזים, לא חדשים) |
| G4 טסט-תרחיש | ✅ U0 known-bugs → U2/U4 flips; **פער שנסגר ב-VAL-1** (שורות-parity ללא טסט) |
| G5 עברית | ✅ כל המחרוזות החדשות בעברית (§12); אין אנגלית ב-UI |
| G6 שבירה+מיגרציה | ✅ ה-cutover (U6) הדרגתי + soak שבוע (§11.1-7) + revert נקי; fluent מקבל shim ולא 404 |
| G7 סקירת אבטחה | ✅ סעיף §15.1 זה = הסקירה לרמת-התוכנית; U3/U5/U6/U7 (נוגעים במסלולי-כתיבה/PII) מסמנים G7 עם הפניה לכאן + לתיקוני SEC-1 |

**גדלים ושילוח עצמאי:** U0-U3, U6 קטנים; U4 ~400 שורות (מוצהר וחריג-מנומק); U5 המסוכן — ממוקם אחרי
soak-הרנדרר ב-U4, עם devils-advocate. delete-last נשמר (U7 אחרון). כל PR עם rubric נקוב. ✅

**חוסר-עקביות קטן לתיקון (QUAL-1):** §13 מציין easing של המוק-אפ (`cubic-bezier(.23,1,.32,1)`) בעוד
§12.6 מחייב `--transition-*` בלבד (וה-safety-net של reduced-motion יושב על הטוקנים — design-system.css:169-175).
**הכרעה: הטוקנים גוברים.** המוק-אפ = רפרנס ויזואלי; המימוש משתמש אך ורק ב-`--transition-fast/smooth`.
נוסף כ-MUST ל-rubric של U4.

### 15.3 ולידציה — האם האסטרטגיה באמת מוכיחה?

**(א) שני הבאגים מתוקנים — ✅ מוכח:** U0 מצמיד את השבור (D1 פאנטום, D2 דריסה) על ה-fixtures המאומתים-פרוד
(§11.1-8); U2 מוכיח את המודל המתוקן; U4 מוכיח ברמת ה-DOM של הלשונית (שני שירותים · אפס פאנטום); U7 מוחק
את הקוד החולה + טסט-guard סטטי שאין `servicesMap.set(stage.id`. שרשרת מלאה, כולל DA-2 (`legalNoActiveStage`).

**(ב) parity מלא — 🔴 פער → VAL-1 (חובה):** לשורות §14 הבאות **אין היום טסט אוטומטי מתוכנן**: #4 (caseOpenDate),
#5-8 (סטטוס-לקוח/סגירת-תיק/הוספת-שירות/קיצור-חידוש), #13 (**תאריך-רכישה — של חיים**), #14-19, #24-27
(הסכמים), #29-30 (resolution). **פעולה (VAL-1):**
1. להרחיב את ה-source-guard של U0 ל-**כל 16 ה-callables**: לכל אחד — שם-ה-callable + מפתחות-ה-payload
   (בדפוס `modal-currentclient-capture-guard.test.ts`). זה מקבע שהזרימות קיימות ומדברות נכון לשרת גם
   אחרי כל הזזה.
2. ב-PR body של U5 — **בלוק smoke נקוב** עם שורה-לכל-affordance מטבלת §14 (עמודת שער-PR=U5), כולל #13
   במפורש; ה-PR לא ממוזג עם שורה לא-מסומנת. עמודת השער בטבלה היא ה-checklist.
בלי VAL-1, שורות כמו "שינוי תאריך-רכישה" יכלו לשבור בשקט ב-U5 (ההזזה הגדולה) — בדיוק הפחד של חיים.

**(ג) אפס-רגרסיה במזריקים/ספירות/payloads — ✅ עם תוספת VAL-2:** המזריקים מכוסים (טסטי-DOM U4/U5 +
"כל ה-details ב-DOM" של §13 + DA-3 rail-classes). הספירות מכוסות (מפתח isResolved ב-source-guard; אפס
נגיעה ב-ClientsTable עד U6). **תוספת (VAL-2):** טסט U4 שנפתח ישר ללשונית-הדוח ומוכיח ששני המזריקים עדיין
מזריקים לפאנל-הניהול המוסתר (ה-SHOULD מ-§11.2 הופך MUST — זה התרחיש שהכי קל לשבור במאסטר-דיטייל).

**שורות שיישלחו בלי טסט אוטומטי גם אחרי VAL-1 (smoke-בלבד, מוצהר):** התנהגות-דיאלוגים חיה (#7 שדות-דינמיים,
#25 קובץ-אמיתי ≤6MB, #26 פתיחת-טאב) — דורשות דפדפן אמיתי; מכוסות בבלוק-ה-smoke הנקוב + console-clean. מקובל.

### 15.4 פסק-דין

## **VERDICT: GO-WITH-CHANGES**

השינויים הנדרשים (כולם ניתנים-לקיפול לתוך ה-PRs הקיימים, אפס שינוי-סדר):

| # | שינוי | לאן |
|---|---|---|
| SEC-1 | escape-at-sink ברנדרר המאוחד + סגירת 5 הפערים החיים שנמצאו (רשימה ב-§15.1) + טסט-XSS fixture | U3 (preview/toast) · U5 (title-attr/override) — MUST |
| SEC-2 | איסור PII בלוגים של ארבעת המודולים החדשים (ids בלבד) | rubrics U2-U5 — MUST |
| VAL-1 | source-guard לכל 16 ה-callables + בלוק-smoke נקוב מעמודת שער-ה-PR של §14 ב-body של U5 (כולל #13) | U0 (הרחבה) + U5 (gate) — MUST |
| VAL-2 | טסט "נפתח ישר ללשונית-דוח → המזריקים עדיין פועלים" (SHOULD→MUST) | U4 — MUST |
| QUAL-1 | easing המוק-אפ ב-§13 = רפרנס בלבד; מימוש בטוקני `--transition-*` בלבד | rubric U4 — MUST |

עם חמשת אלה — התוכנית, הפריסה וה-parity עומדים ברף. `אין לי ודאות` שנותרה: סטטוס PR-SEC-2 (#380) העדכני
(לא-משנה-תוכנית); התנהגות <380px (§12.6 — ייבדק במוק-אפ); וסמנטיקת צד-שרת של ה-callables (לא נקראה —
frontend-only, אין בה שינוי).
