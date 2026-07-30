# 🗄️ ארכיון תיעוד — מסמכים שהוחלפו

> ## ⚠️ אזהרה
>
> **אף מסמך בתיקייה הזו אינו מתאר את המערכת הנוכחית.**
> כל המסמכים כאן נכונים היסטורית ושגויים עובדתית לגבי הקוד שרץ היום.
> **אין להשתמש בהם כמקור ייחוס** — לא לכתיבת קוד, לא לתשובה לשאלה, ולא כבסיס לתוכנית.
> הם נשמרים כי ההיסטוריה מסבירה למה הנתונים נראים כפי שהם.
>
> אם הגעת לכאן מחיפוש, מקישור ישן או מסשן קודם — עצור, וקרא את המסמך העדכני
> שמצוין בשורת **"קרא במקום"** של הרשומה הרלוונטית.

**נוצר:** 2026-07-23 · **ענף:** `chore/docs-archive`

היכן נמצא התיעוד החי:

| נושא | המסמך העדכני |
|---|---|
| צורות שירות, `type` מול `pricingType` | `docs/architecture/SERVICE_TYPES.md` |
| זרימת מעקב שעות מקצה לקצה | `docs/architecture/TIME-TRACKING-FLOW.md` |
| מודל האגרגטים (בעלות יחידה) | `docs/SINGLE-OWNER-AGGREGATE-DESIGN.md` |
| תוכניות פעילות 2026-07 | `docs/PLAN-HOURS-STAGE-INTEGRITY-2026-07.md`, `docs/PLAN-INTEGRITY-GUARD-LAYER-2026-07.md` |
| ממצאים פתוחים 2026-07 | `docs/FINDINGS-STAGE-TRANSITION-MECHANISM-2026-07.md`, `docs/FINDINGS-INTERNAL-OFFICE-BILLING-LEAK-2026-07.md` |
| התוכנית הרב-שלבית | `docs/MASTER_PLAN.md` |
| נקודת כניסה לסשן חדש | `CLAUDE.md` (שורש הרפו) |

---

## 1. `DATA_STRUCTURE_STANDARD.md`

| | |
|---|---|
| **מיקום קודם** | `docs/DATA_STRUCTURE_STANDARD.md` |
| **תקף בערך** | 2025-11-05 → 2026-05 |

**למה הועבר לארכיון**
המסמך מצהיר על עצמו `Status: Official Standard` ומתעד (שורה 40) סוג תמחור שלישי:
`pricingType: "hourly" | "fixed" | "retainer"`.
**`retainer` אינו קיים במערכת.** `functions/shared/constants.js:34` מגדיר
`VALID_PRICING_TYPES: ['hourly', 'fixed']`, ו-`isValidPricingType()` באותו קובץ
(שורה 133) דוחה כל ערך אחר. מפתח או סוכן שיסתמך על המסמך יכתוב ערך שהוולידציה בשרת תדחה.
בנוסף, כל תיאור האגרגטים כאן קודם לעיצוב-מחדש של single-owner (2026-06).

**קרא במקום**
`docs/architecture/SERVICE_TYPES.md` (ארבע צורות השירות) ·
`docs/SINGLE-OWNER-AGGREGATE-DESIGN.md` (מודל האגרגטים) ·
`functions/shared/constants.js` (מקור האמת לערכים חוקיים).

**עדיין שימושי כדי** להבין למה מסמכי לקוחות ישנים מכילים שדות שכבר לא נכתבים.

> **הערה על הביקורת:** הביקורת שקדמה לעבודה הזו טענה שהמסמך "מלמד `procedureType`
> ברמת הלקוח כאות הסיווג". זה **לא מדויק** — המסמך מסמן את `procedureType` כ-`LEGACY ONLY`
> (שורה 39) ואף מזהיר מפני ערבוב מבנים ("Mistake 3", שורה 380). העילה לארכוב היא `retainer`.

---

## 2. `CLIENT_SERVICES_ARCHITECTURE_V3.md`

| | |
|---|---|
| **מיקום קודם** | `docs/CLIENT_SERVICES_ARCHITECTURE_V3.md` |
| **תקף בערך** | 2025-11-05 → 2026-05 |

**למה הועבר לארכיון**
מודל החבילות שמתועד כאן מעולם לא מומש. כל לוגיקת הקיזוז במסמך נשענת על מצביע
`stage.currentPackageIndex` (שורות 263, 289, 494) ועל `stage.currentPackageId` (שורות 365, 393).
**שני השדות אינם קיימים באף שורת קוד ברפו** — `git grep currentPackageIndex` ו-
`git grep currentPackageId` מחזירים אפס תוצאות.
הקוד בפועל מאתר חבילה לפי מזהה מפורש: `functions/addTimeToTask_v2.js:559-570`
(`resolvedPackageId` → `targetService.packages.find(p => p.id === resolvedPackageId)`).
המסמך גם מציג `procedureType` ברמת הלקוח כשדה מבני חי (שורה 227).

**קרא במקום**
`docs/architecture/SERVICE_TYPES.md` ·
`functions/src/modules/deduction/deduction-logic.js` (הקיזוז בפועל) ·
`docs/SINGLE-OWNER-AGGREGATE-DESIGN.md`.

**עדיין שימושי כדי** להבין את הדרישות העסקיות המקוריות (הליך רב-שלבי, כמה חבילות לשלב)
שמסבירות את הצורה של `services[].stages[].packages[]`.

---

## 3. `DEDUCTION_FLOW_EXPLAINED.md`

| | |
|---|---|
| **מיקום קודם** | `docs/architecture/DEDUCTION_FLOW_EXPLAINED.md` |
| **תקף בערך** | 2025-11-11 → 2026-05 |

**למה הועבר לארכיון**
המסמך מפנה שוב ושוב ל-`functions/index.js` כמקום שבו יושבים `createClient()` וקוד הקיזוז
(שורות 171, 193, 249, 546 — "מה קורה ב-Backend (functions/index.js)").
**זה שגוי היום:** `createClient` הוא `functions/clients/index.js:65`; הקיזוז מתבצע ב-
`functions/timesheet/index.js:304` ו-`:385`; ו-`functions/index.js` הוא registry בן 221 שורות
שאין בו אף אזכור ל-`DeductionSystem`. מי שיחפש שם לא ימצא כלום.
בנוסף, שורה 23 מציגה `procedureType` ברמת הלקוח כ-"🎯 סוג השירות" — בדיוק השדה ש-
`docs/architecture/SERVICE_TYPES.md` מסמן כ-legacy ב-"Common mistakes" סעיף 2.
המסמך גם קודם לפיצול `totalHoursWorked` לשלבי fixed ולמוסכמת `hoursRemaining: null`
לשירות fixed (`functions/timesheet/internal-case.js:68`).

**קרא במקום**
`docs/architecture/TIME-TRACKING-FLOW.md` (זרימה מקצה לקצה — ראה שם כותרת תיקון) ·
`functions/src/modules/deduction/deduction-logic.js` ·
`functions/timesheet/index.js`.

**עדיין שימושי כדי** להבין את כוונת התכנון המקורית של קיזוז שלב→חבילה,
ולמה `hoursRemaining` מוכפל בין רמת השלב לרמת החבילה.

---

## 4. `DOCUMENTATION-INDEX.md`

| | |
|---|---|
| **מיקום קודם** | `docs/DOCUMENTATION-INDEX.md` |
| **תקף בערך** | 2025-10 → 2025-11 |

**למה הועבר לארכיון**
אינדקס תיעוד שרוב היעדים שלו מתים. **חמישה מתוך שישה קישורים אינם קיימים ברפו:**
`docs/README-MIGRATION.md`, `docs/MIGRATION-GUIDE.md`, `docs/MIGRATION-SUMMARY.md`,
`docs/run-validation.html`, `docs/js/validation-script.js`. רק `docs/QUICK-START.md` שרד.
המסמך חותם ב-`Status: ✅ Complete & Production Ready` ומתאר מיגרציית Client=Case שהסתיימה,
כך שקורא חדש מקבל רושם שזו נקודת הכניסה לתיעוד — ומגיע לחמישה קישורים שבורים.

**קרא במקום**
`CLAUDE.md` (שורש הרפו — נקודת הכניסה בפועל לסשן חדש) ·
`README.md` (מפת הפרויקט) · `docs/MASTER_PLAN.md`.

**עדיין שימושי כדי** לדעת אילו מסמכי מיגרציה היו קיימים ב-2025 ומה כל אחד כיסה,
אם צריך לשחזר אותם מהיסטוריית git.

---

## 5. איחוד-בכמות — דוחות ומדריכים היסטוריים (2026-07-30, PR-DOCS-2, גל-3ד)

הקבוצות הבאות הועברו לכאן כ**רשומות מתוארכות** (לא מקורות-אמת מטעים — הן מתעדות
*מה נעשה בתאריך מסוים*, לא את המערכת הנוכחית). אינן דורשות כותרת-תיקון פרטנית;
נשמרות להיסטוריה בלבד. **קרא במקום:** `docs/HEALTH-MAP-2026-07.md` (מפת-הבריאות
הנוכחית) · `CLAUDE.md` · `docs/MASTER_PLAN.md`.

| קבוצה | מה | מיקום קודם |
|---|---|---|
| `analysis/` (14) | ניתוחי-מערכת ודוחות חד-פעמיים | `docs/analysis/` |
| `fixes/` (7) | סיכומי תיקוני-באגים היסטוריים | `docs/fixes/` |
| `case-creation/` (5) | תוכניות רפקטור case-creation + `LEGACY-BACKUP` | `.claude/CASE-CREATION-*`, `apps/user-app/components/add-task/LEGACY-BACKUP.md` |
| מדריכי-הגירה + הסברים | EVENTBUS/ENTERPRISE_V2/REACT migration guides, QUICK-START(×2), SIMPLE_EXPLANATION, ASYNC-EXPLANATION, NEXT_STEPS, SERVER_CODE_ANALYSIS, SERVER_MIGRATION_MAP, מעבר-לצד-שרת, INSTRUCTIONS-UPDATE-DIALOG, ENTERPRISE_V2_GAPS | `docs/`, `docs/architecture/`, `.claude/` |
| `sessions/` | לוג-סשן 2025-12-02 | `.claude/sessions/` |

---

## מה **לא** הועבר לכאן, ולמה

- **`docs/architecture/TIME-TRACKING-FLOW.md`** — נשאר במקומו. כל מנגנון שהוא מתאר אומת מול
  הקוד וקיים (`writeClientWithCanonicalAggregates` ב-10 קבצים; מצב `log_only` ב-
  `functions/triggers/timesheet-trigger.js:593`). מה שהתיישן הוא ההכרזה על "steady-state קנוני",
  ושני שמות אוספים שגויים. נוספה לו כותרת תיקון קדימה במקום ארכוב.
- **`devtools/docs/`** — רשומות תחקיר היסטוריות; לא מתחזות למקור-אמת. הושארו במקומן.

> **עדכון 2026-07-30 (גל-3ד):** `docs/fixes/` ו-`docs/analysis/` **הועברו כעת** לכאן
> (סעיף 5 למעלה) — במקור הושארו במקומם (2026-07-23), אך גל-3ד איחד את כל הארכיון
> תחת `docs/archive/`. ההחלטה עודכנה במפורש (החלטת חיים, 2026-07-30) כדי שיהיה
> **מיקום-ארכיון אחד** במקום שניים.
