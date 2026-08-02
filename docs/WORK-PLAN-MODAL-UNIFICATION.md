# תוכנית עבודה — איחוד כרטיס-הלקוח (מאסטר-דיטייל)

**מסמך-אב מפורט:** `docs/PLAN-ADMIN-MODAL-UNIFICATION-2026-07.md` (§1–§15). זה ה-**roadmap הביצועי** הנקי למעקב.

**עקרונות-על:**
- **Frontend-only** — אך ורק `apps/admin-panel/**` + tests + docs. אפס נגיעה ב-`functions/**`/rules/claims/CF. כל 16 ה-callables נשארים ביט-זהים.
- **ענף טרי לכל PR מ-`origin/main`**, worktree מבודד, כותב אחד. main מקבל PR רק אחרי סקירה+מיזוג של חיים.
- **characterization-first** (מצמידים את ההתנהגות הנוכחית לפני שינוי) · **delete-last** (מוחקים את הישן רק ב-U7, אחרי שהכל עובד + שבוע soak).
- **מעל היום:** האיחוד מתקן 5 פרצות XSS קיימות (§15 SEC-1) + מבטל את מנוע-החישוב-הכפול (SSOT).
- **שער-parity:** כל יכולת מ-§14 שנוגעים בה חייבת בדיקה אוטומטית **או** שורת-smoke בגוף-ה-PR, אחרת לא ממזגים.

---

## הרצף — 8 PRים

| # | מה נבנה | קבצים עיקריים | בדיקות | שער נוסף | סטטוס |
|---|---|---|---|---|---|
| **U0** | Characterization — מצמיד התנהגות נוכחית | `tests/…current-behavior.test.ts` (חדש) | D1+D2 + חוזי-DOM + payloads של **כל 16 ה-callables** (VAL-1) | — | ⬜ |
| **U1** | Management קורא `hoursUsed` מאוחסן (SSOT) | `ClientManagementModal.js` (~10 ש׳) | הצמדת שינוי-התצוגה + fixture-דריפט | — | ⬜ |
| **U2** | `ServiceCardModel` — מודל טהור (dead-code) | `js/modules/ServiceCardModel.js` (חדש) | D2=2 כרטיסים, D1=אין פנטום, מספרים=מסמך | — | ⬜ |
| **U3** | חילוץ `ReportPreview` (preview+עריכת-רשומה) | `js/ui/ReportPreview.js` (חדש) | payload `updateTimesheetEntry` ביט-זהה | **DA-4** z-index >100000 + חריגת-Design-Bar · **SEC-1** escape ב-`:1222`/`:1629` | ⬜ |
| **U4** | לשונית-דוח + מבנה **מאסטר-דיטייל** (rail+detail) — additive | `clients.html`, `js/ui/ReportTab.js`, `UnifiedServiceCard.js` (חדש) | D1/D2 בלשונית, formData ביט-זהה, **VAL-2** (מזריקים→פאנל-מוסתר) | **DA-1** radio `name` ממורחב · **DA-2** אוסר legal בלי `stage` | ⬜ |
| **U5** | הניהול מאמץ את הרנדרר המאוחד (מוחק רנדרר 1/2) + פריט "כללי" | `UnifiedServiceCard.js`, `ClientManagementModal.js` | שוויון-DOM מלא + **כל שורות-§14** (כולל שינוי-תאריך-רכישה) | **devils-advocate חובה** · **DA-3** תיחום AddPackageToStage · **SEC-1** escape ב-`:441`/`:547`/`:219` | ⬜ |
| **U6** | Cutover — "הפק דוח" פותח את הכרטיס המאוחד | `ClientsTable.js` | flow מלא ידני (בחירה→preview→עריכה→הפקה) | soak שבוע (קובי 2025994 + חליבה 2025549) | ⬜ |
| **U7** | Delete-last — מחיקת המודאל הישן + shim | `clients.html`, `ClientReportModal.js`→shim | grep סטטי: אין `servicesMap.set(stage.id`/בלוק-פנטום; fluent לא-שבור | **devils-advocate חובה** | ⬜ |

**תלות:** U0→U1→U2→U3→U4→U5→U6→U7. U1/U2 בלתי-תלויים (ניתן להקדים). **devils-advocate חובה: U4, U5, U7.**

---

## מה נועל כל PR (מ-§9 + §15) — checklist ל-rubric

- מפתח-ספירה `overdraftResolved.isResolved` — לא זז; אף אגרגט/פילטר לא זז.
- `NON_AGGREGATING_STATUSES` מסונכרן; באדג' "בארכיון" בשני ה-modes.
- פעולות הרסניות/חיצוניות (`deleteService`/`closeCase`/`generateAndEmail`/`getFeeAgreementUrl`) — מאחורי affordance מפורש, לא ב-default view.
- `isBlocked`/`isCritical` מ-CF בלבד; `warnIfTruncated`+cap 10000 נשמרים; `currentClient`-capture-early.
- חוזי-DOM: `ServiceOverdraftResolution` (`#clientManagementModal`+style-toggle+`.management-service-card`+`data-service-id`) · `AddPackageToStage` (`.management-stage-name` textContent===stage.name) — **כל פאנלי-ה-detail ב-DOM (אחד visible)**; ה-rail = classes שאינם `.management-*`.
- מסלולי-כתיבה: `updateTimesheetEntry` payload ביט-זהה; escape-at-sink בכל sink (SEC-1).
- מודולים-חדשים: אפס-PII ל-log (ids בלבד, SEC-2); motion דרך tokens בלבד (QUAL-1); `:active scale`+`@media(hover:hover)`+כניסת-מודאל-ממורכזת (Emil).
- `?v=` הוקפץ בכל עמוד שטוען קובץ שהשתנה; `service-card-renderer.js` (emitted) לא נגוע; ענף טרי; אפס נגיעה בשרת.

---

## קריטריון קבלה סופי (אחרי U7)
- **קובי 2025994:** שני השירותים בלשונית-הדוח, "תביעה" חזר.
- **חליבה 2025549:** אפס כרטיסי-פנטום; שורת "שעות ללא שיוך" במקום.
- כל כרטיס: `Σ` מוצג == האגרגטים במסמך. אפס שינוי בספירת-החריגות בטבלה.
- כל §14 (43 יכולות): נשמרות, כל אחת עם בדיקה/smoke. console נקי (שגיאה = FAIL).

## Rollback
כל PR = squash יחיד → `git revert <sha>`. U7 מוחזר → המודאל הישן חוזר בשלמותו.

## מי עושה מה
- **Fable 5** — חקירה + תוכנית + §12 UI + §14 parity + §15 סקירה (✅ הושלם).
- **Lead Agent** — בונה כל PR.
- **grader / security-access-expert / devils-advocate** — שערים בכל PR (devils חובה U4/U5/U7).
- **חיים (Product Owner)** — סוקר ומזג כל PR; מאשר soak + cutover + מחיקה.
