# מפת בריאות המערכת — law-office-system (גל-1, 2026-07-27)

> **Wave-1 — פלט סינתזה (קריאה-בלבד).** מסמך זה מרכז את ממצאי כל הסורקים לאחר אימות יריב (adversarial verification). **לא נמחק, נערך או הוזז אף קובץ.** כל שורת "מועמד-למחיקה" נכנסה רק לאחר שאימות **CONFIRMED** אותה; טענות שהופרכו (**REFUTED**) הועברו לרשימת "חי / לא-ברור" ולעולם לא לרשימת המחיקה. המחיקה עצמה (גל-3) מותנית באישור מפורש של חיים לפי הנספח בסוף.

---

## 1. תקציר מנהלים

מופו 7 אזורי סריקה: `admin-panel`, `user-app`, `functions`, shared/core, docs, כפילויות, ואבטחה. התמונה הכללית: **הליבה חיה ובריאה** — מנגנוני הטעינה (classic `<script>` + `window.X` globals, dynamic import, lazy-loader) מופו במלואם ולא נמצאו קבצים מתים בשרשרת ה-deploy של `functions`. עיקר החוב מרוכז בשלוש חזיתות: (1) שאריות של פיצ'רים שהוקפאו/נזנחו ב-frontend, (2) שתי חשיפות אבטחה קריטיות, ו-(3) עומס מסמכי דוחות-שהושלמו.

### ממצאי-על

| # | ממצא | חומרה |
|---|------|-------|
| 1 | **סוד Twilio חשוף בהיסטוריית git ציבורית** (commit `2aa74be`, לא נוקה) — הטוקן עדיין שליף פומבית | 🔴 קריטי |
| 2 | **סיסמאות עובדים ב-cleartext** ב-Firestore + השוואת מחרוזת פשוטה | 🔴 קריטי |
| 3 | **webhook WhatsApp ללא אימות חתימת Twilio** — ניתן לזייף פקודות admin | 🟠 גבוה |
| 4 | 5 עמודי admin שבורים/יתומים מוגשים פומבית (`publish='.'`) | 🟠 גבוה |
| 5 | אשכולות dead-candidate מאומתים ב-user-app (chatbot/, virtual-assistant modular, messaging/alerts, dist כפול) | 🟡 בינוני |
| 6 | כפילות cross-app שנסחפה בשקט (presence-system, service-card-renderer, logger) | 🟡 בינוני |

### יומן פריטים שצפו (surfaced items — לפי נוהל §9 בתוכנית-המסגרת)

| תאריך | פריט | קטגוריה→תת-גל | איך טופל | PRs | צעד-פרוד | סטטוס |
|-------|------|----------------|----------|-----|-----------|--------|
| 2026-07-28 | פירוק משטח WhatsApp/Twilio (צף באימות-האבטחה; 2 "קריטיים" התפוגגו: Twilio מחוק, 0 סיסמאות cleartext ב-probe) | אבטחה → גל-3א | 3 סוכני מיפוי read-only → אימות יריב → checkpoint scope → 2 PRים (frontend→backend), grader PASS + devils-advocate GO בשניהם | #474, #475 | `functions:delete` ×4 — ידי חיים; אומת (`functions:list`=ריק) | ✅ הושלם |

### יומן ביצוע גל-3 (execution log — כל PR מתחזק את הטבלה הזו כחלק מה-diff שלו, §9.4)

| תת-גל | PR | מה | reviews | סטטוס |
|-------|-----|-----|---------|-------|
| 3א | #477 (S1) | tighten monitor rules — מחק sessions+function_monitor_errors, נעל function_monitor_logs→`if false` | devils=GO · grader=PASS_W | ✅ מוזג+פרוד (`firebase deploy --only firestore:rules`) |
| 3א | #478 (S2) | מחיקת מודול-הסיסמאות המת (`employees-manager.js`) — סוגר חוט הסיסמאות | grader=PASS | ✅ מוזג |
| 3א | #479 (S3) | פירוק 3 מודולי `function-monitor*.js` (1436 ש') | grader=PASS | ✅ מוזג |
| 3א | #480 (S4) | A4-1: מחיקת DEBUG_EMAILS מ-WorkloadCalculator (159 ש', היגיינת-PII, אפס שינוי-התנהגות) + יומן-הביצוע הזה + §14 | grader=PASS | ✅ מוזג |
| 3א | #481 (A4-2) | untrack+gitignore של 162 קבצי-PII לא-נטענים (`devtools/` 157 + `add-employee-phones.js` כולל @gmail + 4 one-offs ב-`scripts/`) — נשארים על הדיסק, נעלמים מ-GitHub הציבורי; **החלטת חיים: untrack (לא delete); History=להשאיר** | grader=PASS | ✅ מוזג |
| 3ב | #482 (DB-1) | מחיקת 8 קבצי-admin מתים: 4 עמודים יתומים (tasks/timesheet/debug-firebase-init/feature-flags) + case-number-generator.js + 3 CSS (שומר את תאום task-approval-dialog החי) | grader=PASS | ✅ מוזג |
| 3ב | #483 (DB-2) | מחיקת 28 קבצי user-app מתים: chatbot/ (10) + VA-מודולרי (6) + VA-ישן + virtual-assistant.css + 6 גלובלים (statistics-calculator/pagination-manager/notification-bridge/flatpickr-wrapper/reports/system-diagnostics) + 4 scratch. שומר `-complete.js`/`pagination.js`/`dist/js/` | grader=PASS_W | ✅ מוזג |
| 3ב | #484 (DB-3) | מחיקת ה-build הכפול תחת `apps/user-app/dist/` (21 קבצים): `dist/apps/**` + `dist/types/**` (פלט tsc מקונן כפול, outDir שגוי) + `dist/index.html` + `dist/assets/**` (build ישן של Vite). **שומר `dist/js/**`** (פלט tsc החי, נטען ב-index.html:1229-1230). 0 refs חיים; Netlify `publish=apps/user-app` מגיש את index.html בשורש, לא את dist/ | grader=PASS | ✅ מוזג |
| 3ב | #485 (DB-4) | מחיקת `apps/admin-panel/js/ui/SMSManagement.js` (יתום — 0 loaders/refs חיים; הטסט עצמו מציין "ORPHANED") **יחד עם** הטסט היחיד שמייבא אותו `tests/unit/admin-panel/sms-csv-injection.test.ts`. **שומר `js/core/csv-safe.js`** (SSOT, 8 צרכנים; כיסויו נשמר ב-3 טסטי csv-injection חיים אחרים). **סוגר גל-3ב** | grader=PASS | ✅ מוזג |
| 3ג | DP-1 (זה) | **הכפילות ה"מסוכנת" התפוגגה באימות:** `presence-system.js` קיים ב-2 apps אבל העותק של admin **טעון-ומעולם-לא-נקרא** (0 קוראים; grep מלא ב-admin-panel); כל 4 השדות (`lastLogin`/`loginCount`/`isOnline`/`lastSeen`) נכתבים ע"י user-app (`authentication.js` + `connect()`), נקראים ע"י admin. לכן העותק של admin = **קוד מת**, לא איחוד. מוחק `apps/admin-panel/js/modules/presence-system.js` + 2 תגי `<script>` (index.html:229 + workload.html:84). **שומר** את העותק החי ב-user-app. 0 שינוי-התנהגות (admin אף פעם לא הריץ). rules כבר מתירים 4 השדות | grader=? | 🟢 בעבודה |

**נותר בגל-3א (follow-ups, tracked — נדחו בהחלטת חיים לטובת 3ב):** A4-3 (איחוד 4 עותקי `ADMIN_EMAILS`→config לא-מחויב) · A4-4 (retire auth שכבה-2 email-fallback — **התנהגותי → devils-advocate**).

**גל-3ב (dead-code) — פירוק מאושר (4 PRs):** DB-1 (admin, זה) · DB-2 (user-app: chatbot+VA-מודולרי+גלובלים+scratch ~28) · DB-3 (dist כפול, שומר `dist/js/`) · DB-4 (SMSManagement+הטסט שלו). **אשכול messaging/errors נדחה למסלול H.8.0** (rules-last + devils-advocate, כולל reference רדום ב-UserAlertsPanel.js).

**Backlog doc-drift (→ גל-3ד):** `SYSTEM_MAP.md`, `SYSTEM_STATUS.md`, `docs/FUNCTION_MONITOR_README.md`, `docs/ANALYTICS_DASHBOARD_GUIDE.md`, `.claude/WHATSAPP-PDF-UPLOAD-FEATURE.md` — מזכירים פיצ'רים שפורקו (WhatsApp/Twilio, function-monitor POC).

### ספירות

- **קבצי קוד dead-candidate מאומתים (CONFIRMED):** ~50 קבצים/ארטיפקטים ב-9 אשכולות.
- **טענות שהופרכו והוחזרו לחיים/לא-ברור:** 8 (בראשן `clients-fluent.html` + מחסנית Fluent — **חיים ומוקפאים בכוונה**).
- **חוב אבטחה:** 2 קריטי, 1 גבוה, 3 בינוני, 2 נמוך.
- **מסמכים:** ~40 מאומתים ל-DELETE/REPLACE-BY-HEALTHMAP; עשרות KEEP/ARCHIVE.
- **סתירת תיעוד קריטית:** MASTER_PLAN §8.8 (c-5, #454) טוען ש-`case-creation-dialog.js` נמחק ו"מעולם לא נטען" — בפועל הוא **חי ונטען** ב-`index.html:1314`. יש ליישב לפני הסתמכות על סטטוס ה-cutover בתוכנית.

---

## 2. אינוונטר קוד מסווג (לפי אזור)

### 2.1 admin-panel

**חי (10 עמודים):** `index`, `clients`, `employee-costs`, `pending-clients`, `profitability`, `reconciliation`, `settings`, `system-announcements`, `workload`, `audit-trail` — כולם מקושרים ב-`Navigation.js` וטוענים מודולים אמיתיים.

**מועמד-למחיקה (מאומת CONFIRMED):**

| קובץ | ביטחון | הנימוק שאומת |
|------|--------|--------------|
| `tasks.html` | גבוה | לא ב-nav; טוען `TasksManager.js`+`TasksTable.js` שאינם קיימים → TypeError; מוגש פומבית |
| `timesheet.html` | גבוה | לא ב-nav; טוען `TimesheetManager.js`+`TimesheetTable.js` שאינם קיימים; timesheet מטופל ב-user-app |
| `debug-firebase-init.html` | גבוה | ארטיפקט debug; מוגש פומבית; אין צרכן קוד |
| `feature-flags.html` | גבוה | מפנה ל-`../firebase-config.js` שאינו קיים; אין init inline → שבור |
| `js/managers/BroadcastManager.js` | גבוה | IIFE ל-`window.BroadcastManager`; אין `<script>`, הוחלף ב-`WhatsAppMessageDialog.js` |
| `js/ui/SMSManagement.js` | גבוה | אין טעינה בשום עמוד; ⚠️ נצרך ע"י `sms-csv-injection.test.ts` — מחיקה תשבור את הטסט |
| `js/modules/case-number-generator.js` | גבוה | עותק admin ללא צרכן; הגרסה החיה היא ב-user-app |
| `css/case-creation-dialog.css` | גבוה | ה-JS שהיא עיצבה נמחק ב-#454; לא מקושרת בשום HTML |
| `css/messaging-modals.css` | גבוה | שאריות H.8.0; אין `<link>`, אין class-ים חיים |
| `components/styles/task-approval-panel.css` | בינוני | עמודים חיים טוענים את `task-approval-system/styles/` במקום |
| `components/styles/task-approval-dialog.css` | בינוני | כנ"ל — עותק כפול-נתיב מיושן |

**חי / לא-ברור (הופרך — אין למחוק):**

| קובץ | סטטוס | מדוע לא-מת |
|------|-------|-----------|
| `clients-fluent.html` | **חי** | פרוס ב-Firebase hosting, מתועד ב-SYSTEM_MAP, **מוקפא בכוונה** (pr-meta-7, CLAUDE.md), 5 rubrics מתחזקות אותו |
| `js/fluent/FluentClientsManager.js` | **חי** | נטען ומאותחל ב-`clients-fluent.html` הפרוס; מחסנית Fluent מוקפאת מפורשות |
| `js/fluent/FluentDataGrid.js` | לא-ברור | פרוס+מוקפא אך לא מקושר ל-nav; **אינו יעד מחיקה בטוח** |

### 2.2 user-app

**חי:** `index.html` (~55 סקריפטים) + `dist/js/` (פלט tsc חי) + `main.js` (orchestrator) + knowledge-base (lazy) + `virtual-assistant-complete.js` + `components/add-task/index.js` + `src/modules/deduction/` + `quick-log.js`.

**⚠️ סתירת liveness:** `js/modules/case-creation/case-creation-dialog.js` — **חי** (נטען ב-`index.html:1314`), בסתירה ל-MASTER_PLAN §8.8 c-5.

**מועמד-למחיקה (מאומת CONFIRMED) — מקובצים לאשכולות:**

| אשכול | קבצים | ביטחון |
|-------|-------|--------|
| **chatbot/ (יתום מלא)** | `chatbot/index.js`, `chatbot/core/system-tour.js` + 7 קבצי האשכול | גבוה |
| **virtual-assistant modular (refactor נזנח)** | `virtual-assistant-bundle.js`, `-core.js`, `-main.js`, `-ui.js`, `-data.js`, `-engines.js` | גבוה/בינוני |
| **VA ישן** | `js/modules/virtual-assistant.js` (טיוטה חתוכה) | גבוה |
| **messaging/alerts (שארית H.8.0)** | `js/models/Alert.js`, `js/managers/AlertEngine.js` | גבוה |
| **function-monitor** | `function-monitor.js`, `-dashboard.js`, `-init.js` | גבוה |
| **כפילי-global מתים** | `statistics-calculator.js`, `pagination-manager.js` (byte-identical ל-`pagination.js`), `notification-bridge.js`, `flatpickr-wrapper.js` | גבוה |
| **דיווח מוחלף** | `reports.js` (תלוי ב-`ReportsModule` לא-מוגדר) | גבוה |
| **דיאגנוסטיקה/one-off** | `system-diagnostics.js`, `js/scripts/add-employee-phones.js` (בינוני — מתועד במדריך תפעולי) | גבוה/בינוני |
| **dist כפול/מיושן** | `dist/index.html`, `dist/assets/index-BcxwZFff.js`, `dist/apps/user-app/**`, `dist/types/**` | גבוה |
| **scaffold/demo/scratch** | `load-messaging-system.html`, `components/add-task/demo.html`, `case-creation-dialog-UPDATED.txt` (+`event-handlers`/`render-functions`-UPDATED.txt) | גבוה |

**חי / לא-ברור (הופרך — אין למחוק):**

| קובץ | סטטוס | מדוע |
|------|-------|------|
| `js/validation-script.js` | לא-ברור | כלי-קונסול **מתוחזק במכוון** (SYSTEM_STATUS, PR #354) — de-wired אך לא מת |
| `js/shared/business-rules-adapter.js` | **חי** | mirror נשמר ע"י `business-rules.sync.test.ts` (byte-identity) |

### 2.3 messaging/errors cluster — טיפול מיוחד (אימות מפוצל)

אשכול `js/core/errors/*` + `js/core/constants/*` + `js/services/ValidationService.js` **מת כיחידה** (שארית H.8.0), אך יש בו אימות מפוצל שיש לכבד בזהירות:

- **CONFIRMED dead:** `NetworkError.js`, `PermissionError.js`, `ValidationError.js`, `constants/message-types.js`, `constants/thread-constants.js` (bin), `load-messaging-system.html` (ה-loader היתום שמחזיק את כולם "מוזכרים").
- **הופרך על טענה אחת → לא-ברור, לא בסט המחיקה:** `core/errors/BaseError.js` ו-`constants/alert-types.js` — לשניהם *יש* צרכנים (Alert.js/AlertEngine.js/ValidationService), אלא שהצרכנים עצמם מתים. **מסקנה:** אין למחוק אותם עצמאית; הם חלק מאותה יחידה מתה.

**המלצה מבצעית:** להסיר את כל האשכול **כיחידה אחת** תחת פרויקט **"H.8.0 messaging-retire follow-up"** הקיים (מאושר-חיים, rules-last, devils-advocate), ולא במחיקה אד-הוק.

### 2.4 functions

**אין קבצים מתים בשרשרת ה-deploy.** `index.js` מחווט ~70 exports, כל require מוביל לקוד חי. `lib/` = פלט TS מהודר (החלטה מפורשת). `migrations/` + `scripts/` = כלים תפעוליים ידניים (נשמרים בכוונה, לא-מחווטים = תקין). `src/whatsapp-bot/` = חי אך מגיע רק דרך webhook (lazy-require).

---

## 3. מפת כפילויות (עם SSOT מומלץ)

| # | דפוס | SSOT מומלץ | דחיפות |
|---|------|-----------|--------|
| 1 | **מודולים byte-identical cross-app** — `holidays-cache`, `work-hours-calculator`, `idle-timeout-manager`, `work-hours-constants` | עותק `shared/` יחיד נטען ע"י שני ה-apps (או copy-on-build). מכני, low-risk | בינונית |
| 2 | **עותקים שנסחפו בשקט** — `presence-system` (שדות Firestore שונים!), `service-card-renderer` (48 diff), `client-case-selector` (107 diff), `logger`, `system-constants` | ליישב כל זוג ל-shared יחיד, לבחור canonical במודע. **המסוכן ביותר** — תיקון לא מגיע לעותק השני | **גבוהה** |
| 3 | **case-number-generator** ×3 (admin/user/functions) | `functions/case-number-transaction.js` (טרנזקציוני, שרת) הוא המקצה הסמכותי | בינונית |
| 4 | **ולידציית ת"ז** ב-5+ מקומות | `functions/shared/validators.js` backend-SSOT; לחזית adapter יחיד עם sync-test | בינונית |
| 5 | **escapeHtml** — admin מאוחד (`window.escapeHtml`), user-app עדיין ידני ב-~16 קבצים | להביא את `escape-html.js` ל-user-app, להחליף כל escaper inline | **גבוהה** (XSS) |
| 6 | **ClientReportModal + ClientManagementModal** (~4448 שורות חופפות) | איחוד ל-client-card יחיד (ManagementModal host) — פרויקט `admin_modal_unification` | בינונית |
| 7 | **pagination** — `pagination.js` ≡ `pagination-manager.js` (byte-identical) + `firebase-pagination` + admin `Pagination.js` | למחוק תאום זהה מיידית, אז לשקול איחוד הפגינטורים | נמוכה |
| 8 | **approval-helpers.js** ×2 ב-admin (18 diff) | לשמור עותק `task-approval-system/utils` (colocated) | נמוכה |
| 9 | **date-formatting** — `dates.js` vs `utils/date-utils.js` | `dates.js` (`window.DatesModule`, timestamp-aware) | נמוכה |
| 10 | **CSV encoding** — admin `CsvSafe` SSOT, user-app inline | להעלות `window.CsvSafe.cell` ל-shared, לכל export ב-user-app | בינונית (injection) |
| 11 | **service-classification** ×3 | canonical=`functions/shared/business-rules/service-classification.js`; adapters=mirror מנוהל בכוונה (sync-test) — **להשאיר** | נמוכה |

---

## 4. חוב אבטחה מדורג

### 🔴 קריטי

**A1 — סוד Twilio בהיסטוריית git ציבורית.** `functions/.env` (commit `2aa74be`, 2025-12-10) הכיל `TWILIO_ACCOUNT_SID`+`TWILIO_AUTH_TOKEN`, "נמחק" ב-`ff71201` ללא rewrite. ב-repo ציבורי הבלוב עדיין שליף (`git cat-file -e 2aa74be:functions/.env`). **פעולה: לרוטט את ה-auth-token מיד + לנקות היסטוריה (filter-repo/BFG).** המקור הנוכחי קורא מ-env בלבד — תקין.

**A2 — סיסמאות עובדים cleartext.** `employees-manager.js:165,233,391` — סיסמה נשמרת גלויה ב-Firestore (`// TODO: encrypt`) והשוואה ב-`data.password !== password`. `firestore.rules:115` מאפשר כל admin לקרוא את כל מסמכי העובדים → כל admin-token שנפרץ מדליף את כל הסיסמאות. גם נכתב ע"י `UserForm.js:715`. **פעולה: hash שרת-צד (bcrypt/scrypt) או מעבר מלא ל-Firebase Auth + הסרת השדה.**

### 🟠 גבוה

**A3 — webhook WhatsApp ללא אימות חתימה.** `functions/whatsapp/index.js:461` — אין `validateRequest`/`X-Twilio-Signature`. הרשאת admin מבוססת רק על `From` (נשלט-תוקף). כל POST עם `From` של admin ידוע → הרצת פקודות בוט + העלאת מדיה. **פעולה: `twilio.validateRequest` עם ה-auth-token לפני העיבוד.**

### 🟡 בינוני

- **A4 — PII בקוד ציבורי:** מיילי צוות אמיתיים hardcoded (`auth.js:136`, `system-constants.js:91`, `WorkloadCalculator.js`). מפר MASTER_PLAN §2.8. חשיפה (לא bypass — ה-gate האמיתי הוא custom claims). **פעולה: config לא-מחויב/claims.**
- **A5 — כללי Firestore רחבים מדי:** `function_monitor_logs`/`errors` + `sessions` = read+write לכל authenticated ללא סכימה. flooding/poisoning + קריאת session של אחרים. **פעולה: scope reads ל-admin, writes CF-only/field-validated.**
- **A6 — PII בלוגים:** `whatsapp/index.js:468` מלוגג body+טלפון מלאים. מפר §2.2. **פעולה: redact ל-actor-id/אורך.**

### 🟢 נמוך

- **A7 —** `pending_task_approvals` + `kb_analytics` create ללא field-guards (השפעה נמוכה — הראשון dead-path).
- **A8 —** קבצי SA-key ב-working tree (gitignored נכון, לא tracked — סיכון `git add -f` בלבד).

> חיובי: סריקת סודות במקור הנוכחי נקייה; ה-track של hardening XSS/CSV (2026-06) מחזיק — sinks עוברים דרך `escapeHtml`/`CsvSafe`.

---

## 5. גורל המסמכים

טבלה מרוכזת — **רק ורדיקטים שאומתו CONFIRMED**. מסמכים שהופרכו (SETUP-CI-CD, CLIENTS_*, REFACTORING bundle, DASHBOARDS bundle, FULLNAME batch, devtools/docs, admin-panel/docs, MIGRATION_GUIDE bundle, CSS_CLEANUP_GUIDE, CLIENT_CASE_DIALOG, testing docs) = **KEEP** ואינם מופיעים ברשימת המחיקה.

| גורל | מסמכים |
|------|--------|
| **DELETE** (כפילי-בייט / גיבויים) | `docs/README_ARCHITECTURE_v2.md`, `docs/README_PHASE1_DEPLOYMENT.md`, `docs/SENIOR_REVIEW.md`, `docs/WORKFLOW_ENFORCEMENT.md`, `docs/CHANGELOG-CI-CD.md`, `docs/CHANGELOG-ENTERPRISE-UPGRADE.md`, `docs/BACKUP_PROGRESS_BARS_OLD.md`, `.claude/README-old.md`, `.claude/agents.backup-20260526/*`, `.dev/*.md`, `apps/user-app/components/add-task/LEGACY-BACKUP.md` |
| **REPLACE-BY-HEALTHMAP** (דוחות שהושלמו) | `docs/COMPREHENSIVE_ANALYSIS_REPORT.md`, `docs/CODE_CLEANUP_REPORT.md`, `docs/DEDUCTION_EXECUTION_ANALYSIS.md`, `docs/MIGRATION_PLAN_DEDUCTION.md`, `docs/FORMS_MODULE_REPORT.md`, `docs/CASES_IMPLEMENTATION_SUMMARY.md`, `docs/MODALS_REFACTORING_SUMMARY.md`, `docs/NOTIFICATION_SYSTEM_SUMMARY.md`, `docs/MD_FILES_ORGANIZATION_SUMMARY.md`, `docs/IMPACT_ANALYSIS_MIGRATION_PLAN.md`, `docs/MIGRATION_SUMMARY.md`, `docs/FIREBASE_AUTH_MIGRATION_PLAN.md`, `docs/NOTIFICATION_SYSTEM_MIGRATION.md`, `docs/PHASE_2.1_COMPLETED.md`, **כל `docs/analysis/*.md`**, **כל `docs/fixes/*.md`**, סט `.claude/CASE-CREATION-*.md` |
| **ARCHIVE** (ערך היסטורי, מחוץ לרוטציה) | `docs/DOCUMENTATION-INDEX.md`, `docs/QUICK-START.md`, `docs/QUICK_START.md`, `docs/EVENTBUS_MIGRATION_GUIDE.md`, `docs/ENTERPRISE_V2_MIGRATION_GUIDE.md`, `docs/ENTERPRISE_V2_GAPS_AND_LIMITATIONS.md`, `docs/SIMPLE_EXPLANATION.md`, `docs/NEXT_STEPS.md`, `docs/INSTRUCTIONS-UPDATE-DIALOG.md`, `docs/STATUS-SESSION-2026-07-22.md`, `docs/architecture/REACT_MIGRATION_PLAN.md`, `.claude/ASYNC-EXPLANATION.md`, `.claude/sessions/2025-12-02-*.md`, `docs/SERVER_CODE_ANALYSIS.md`, `docs/SERVER_MIGRATION_MAP.md`, `docs/מעבר-לצד-שרת-מקצועי.md` |
| **KEEP** (safelist / נצרך / הופרך) | MASTER_PLAN, כל CLAUDE.md, `.claude/rules/*`, `.claude/rubrics/*` (כולל ~200 pr-*.md), ENGINEERING/DESIGN bars, §13 refs, `SETUP-CI-CD.md`, `CLIENTS_*`, `REFACTORING_*`, `DASHBOARDS/UNIFIED_*`, batch FULLNAME/FIX, `devtools/docs/`, `apps/admin-panel/docs/*`, `README_PHASE3_STATUS`/`WORK_PLAN`, add-task `CLEANUP-PLAN`/`MIGRATION-NOTES`, `MIGRATION_GUIDE*`, `CSS_CLEANUP_GUIDE`, `CLIENT_CASE_DIALOG_ARCHITECTURE`, כל docs הטסטינג |

---

## 6. נספח DELETE-LIST — לאישור חיים לפני גל-3

> **⚠️ אף אחד מאלה לא נמחק.** רשימה מפורשת בלבד. פריטים עם הערת-אזהרה דורשים פעולה נלווית לפני מחיקה.

### 6.1 קוד — admin-panel

| קובץ | נימוק |
|------|-------|
| `apps/admin-panel/tasks.html` | טוען 2 סקריפטים לא-קיימים → TypeError; לא ב-nav |
| `apps/admin-panel/timesheet.html` | כנ"ל; timesheet ב-user-app |
| `apps/admin-panel/debug-firebase-init.html` | ארטיפקט debug מוגש פומבית |
| `apps/admin-panel/feature-flags.html` | firebase-config שבור; אין init |
| `apps/admin-panel/js/managers/BroadcastManager.js` | IIFE ללא טוען; הוחלף |
| `apps/admin-panel/js/ui/SMSManagement.js` | ⚠️ **קודם עדכן/הסר `sms-csv-injection.test.ts`** |
| `apps/admin-panel/js/modules/case-number-generator.js` | עותק admin ללא צרכן |
| `apps/admin-panel/css/case-creation-dialog.css` | ה-JS נמחק ב-#454 |
| `apps/admin-panel/css/messaging-modals.css` | שארית H.8.0 |
| `apps/admin-panel/components/styles/task-approval-panel.css` | עותק כפול-נתיב |
| `apps/admin-panel/components/styles/task-approval-dialog.css` | ⚠️ dedup בבעלות global-agent; לוודא שהעותק ב-`task-approval-system/styles/` נשאר |

### 6.2 קוד — user-app (מקובץ לאשכולות; מחק כאשכול)

| אשכול / קובץ | נימוק |
|--------------|-------|
| `apps/user-app/chatbot/**` (9 קבצים) | יתום מלא; הפיצ'ר מושבת (smart-faq-bot ב-comment) |
| `apps/user-app/js/modules/virtual-assistant/{bundle,core,main,ui,data,engines}.js` | refactor נזנח; הוחלף ב-`-complete.js` |
| `apps/user-app/js/modules/virtual-assistant.js` | טיוטה חתוכה מיושנת |
| `apps/user-app/js/modules/function-monitor{,-dashboard,-init}.js` | דיאגנוסטיקה לא-מחווטת |
| `apps/user-app/js/modules/statistics-calculator.js` | dead; export הוסר מפורשות בקובץ עצמו |
| `apps/user-app/js/modules/pagination-manager.js` | byte-identical ל-`pagination.js` |
| `apps/user-app/js/modules/notification-bridge.js` | redefine של globals חיים |
| `apps/user-app/js/modules/flatpickr-wrapper.js` | אין צרכן; flatpickr לא נטען |
| `apps/user-app/js/modules/reports.js` | תלוי ב-`ReportsModule` לא-מוגדר |
| `apps/user-app/js/system-diagnostics.js` | אפס הפניות |
| `apps/user-app/js/scripts/add-employee-phones.js` | ⚠️ one-off; **עדכן `SMS_AUTH_DEPLOYMENT.md` + SYSTEM_MAP** |
| `apps/user-app/dist/index.html`, `dist/assets/**`, `dist/apps/**`, `dist/types/**` | build כפול/מיושן; **שמור `dist/js/` — חי!** |
| `apps/user-app/components/add-task/demo.html` | harness demo |
| `apps/user-app/js/modules/case-creation/*-UPDATED.txt` (×3) | scratch text, לא-טעין |

### 6.3 קוד — אשכול messaging/errors (הסר כיחידה תחת פרויקט H.8.0)

`js/models/Alert.js`, `js/managers/AlertEngine.js`, `js/services/ValidationService.js`, `js/core/errors/{BaseError,NetworkError,PermissionError,ValidationError}.js`, `js/core/constants/{alert-types,message-types,thread-constants}.js`, `js/load-messaging-system.html`.
⚠️ `BaseError.js` ו-`alert-types.js` קיבלו אימות-מפוצל — **למחוק רק כחלק מהיחידה השלמה, לא עצמאית.** ⚠️ לבדוק את הנתיב הרדום ב-admin `UserAlertsPanel.js` (מפנה ל-`THREAD_CATEGORIES`) לפני מחיקה כדי למנוע ReferenceError עתידי.

### 6.4 מסמכים

ראה סעיף 5 (DELETE + REPLACE-BY-HEALTHMAP). ⚠️ `.dev/*` ו-`.claude/agents.backup-*` כבר gitignored — מחיקת working-tree בלבד.

---

## 7. סדר הגירת TypeScript מומלץ (גלובלי)

עיקרון: מודולים pure/small עם טסטים/`.d.ts` קיימים תחילה; כותבי-כתיבה פיננסיים גדולים אחרונים.

| # | קובץ | עדיפות | נימוק |
|---|------|--------|-------|
| 1 | `functions/shared/logger.js` | גבוה | 39 צרכנים, pure, `.d.ts` קיים — מקבע את משטח הלוגים לכל הבאים |
| 2 | `shared/business-rules/service-classification.js` | גבוה | pure, מכוסה sync-test, fan-out גבוה |
| 3 | `functions/shared/validators.js` | גבוה | pure, 25 test-refs, אפס side-effects |
| 4 | `functions/shared/claim-writer.js` | גבוה | `.d.ts` קיים; primitive אבטחה |
| 5 | `functions/addTimeToTask_v2.js` | גבוה | ליבת ניכוי — שורש drift; ה-ROI הגבוה ביותר; test קיים |
| 6 | `functions/services/index.js` | גבוה | הקובץ הגדול (1703) + כותב aggregate package/stage |
| 7 | `functions/timesheet/index.js` | גבוה | 1595 שורות; SSOT שעות+עלות |
| 8 | `functions/triggers/timesheet-trigger.js` | גבוה | recompute-from-ledger; להגר יחד עם services/timesheet |
| 9 | `apps/*/js/core/{escape-html,csv-safe,budget-status}.js` | גבוה | SSOT אבטחה/badge קטנים עם טסטים |
| 10 | `apps/user-app/js/modules/{budget-crossing,submit-guard,israeli-id,tz-helper}.js` | גבוה | pure, hot-path, drift-guards קיימים |
| 11 | `functions/clients/index.js`, `shared/client-writer.js`, `budget-tasks/index.js` | בינוני | SSOT לקוח; blast-radius בינוני |
| 12 | `apps/admin-panel/js/managers/ReportGenerator.js`, `js/ui/Client*Modal.js`, `ClientsDataManager.js` | גבוה→בינוני | כסף/שעות, change-frequency גבוה |
| 13 | `apps/admin-panel/js/ui/UserDetailsModal.js` (5248 שורות) | בינוני | **לפצל למודולים לפני** TS |
| 14 | `functions/shared/{service-writer,package-repair-core}.js`, `apps/admin-panel/js/core/auth.js`, `functions/src/whatsapp-bot/WhatsAppBot.js` | נמוך | כותבי-כסף/אבטחה גדולים; אחרונים, עם guardrails |

---

## 8. הצעת Roadmap לגל-3

**גל-3א — אבטחה (חוסם, ראשון):**
1. רוטציית Twilio auth-token + ניקוי היסטוריה (A1).
2. Hash/מיגרציה של סיסמאות עובדים (A2).
3. `validateRequest` ל-webhook (A3).
4. הידוק כללי Firestore (A5) + redact לוגים (A6) + הוצאת PII מהקוד (A4).

**גל-3ב — מחיקת dead-code (אחרי אישור נספח §6):**
5. אשכולות user-app ברורים תחילה (chatbot/, VA-modular, dist-כפול, scratch) — low-risk.
6. 5 עמודי admin השבורים + BroadcastManager + case-number-generator.
7. אשכול messaging/errors **כיחידה** תחת פרויקט H.8.0 (rules-last, devils-advocate).
8. תיאום `SMSManagement.js` ↔ הטסט שלו לפני מחיקה.

**גל-3ג — כפילויות (מדורג לפי סיכון):**
9. **תחילה המסוכן:** ליישב עותקים-שנסחפו (presence-system, service-card-renderer) — כאן התנהגות מתפצלת בשקט.
10. השלמת consolidation של `escapeHtml`/`CsvSafe` ל-user-app.
11. איחוד byte-identical ל-`shared/` יחיד.

**גל-3ד — מסמכים:**
12. מחיקת כפילי-בייט + גיבויים (§6.4).
13. ARCHIVE של דוחות היסטוריים; REPLACE-BY-HEALTHMAP מוחלף במסמך זה (`docs/HEALTH-MAP`).

**גל-3ה — חוב מבני (מקביל/רקע):**
14. הגירת TS לפי §7 (מתחיל ב-logger + ליבת השעות).
15. פיצוק god-files (`UserDetailsModal` 5248, `main.js` 3449, `virtual-assistant-complete` 4751).
16. איחוד `ClientReportModal`+`ClientManagementModal` (פרויקט admin_modal_unification).

**נקודת-יישוב חובה לפני הכל:** ליישב את סתירת MASTER_PLAN §8.8 c-5 מול `case-creation-dialog.js` החי — לפני הסתמכות על סטטוס cutover כלשהו בתוכנית.
