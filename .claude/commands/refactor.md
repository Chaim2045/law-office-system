---
description: הנחיות מהירות לרפקטור פשוט (rename, extract פונקציה בקובץ אחד). לרפקטורים מורכבים על SSOT modules או מספר קבצים — Lead Agent יפעיל את הסוכן `refactoring-expert`.
argument-hint: [תיאור הרפקטור]
---

# REFACTOR GUIDANCE — Law Office System

**שימוש:** הנחיות מהירות לרפקטור פשוט. לרפקטור מורכב (>3 קבצים, SSOT modules, cross-app) — Lead Agent יפעיל את `refactoring-expert` agent (context מבודד, ניתוח עמוק יותר).

## כללי ברזל:
1. **Behavior preservation:** רפקטורינג = שינוי מבנה בלבד. **אפס שינוי התנהגות**. אם יש חשד שההתנהגות משתנה — עצור, דווח, עבור ל-Planning.
2. **Tests first:** אין רפקטורינג בלי בדיקות מכסות. אם אין — כתוב קודם (או העבר ל-testing-quality-expert), ואז רפקטר.
3. **SSOT over DRY:** המטרה היא לא רק לבטל כפילות, אלא לחזק את ה-SSOT. כפילות היא סימפטום — ה-root cause היא שאין SSOT מוגדר.
4. **קומיט קטן, קומיט ממוקד:** כל commit = רפקטור אחד מוגדר. אסור לערבב "refactor + feature + fix".
5. **עבור על הצרכנים לפני שינוי:** Grep על כל המקומות שקוראים לפונקציה הזו, רק אחרי שראית את כולם — שנה חתימה.
6. **Deprecated בהדרגה:** אסור למחוק API ציבורי בלי שלב deprecation עם warning.

## SSOT Modules ב-Law Office System (חובה להכיר!):
- `window.safeText(text)` — `js/modules/core-utils.js`
- `window.ClientSearch.*` — `js/modules/ui/client-search.js`
- `window.renderServiceCard(...)` — `js/modules/service-card-renderer.js`
- `window.DatesModule.*` — `js/modules/dates.js`
- `window.calculateRemainingHours(entity)` — `src/modules/deduction/calculators.js`

**כל כפילות של אחד מהם = רפקטור חובה.**

## Smell → Fix:
| Smell | Fix |
|---|---|
| `escapeHtml()`, `htmlEncode()`, `sanitize()` בקובץ מודולרי | החלף ב-`window.safeText()` |
| `clients.filter(c => c.name.includes(q))` | החלף ב-`ClientSearch.searchClientsReturnHTML()` |
| `<div class="service-card">...</div>` ידנית | החלף ב-`renderServiceCard()` |
| `new Date(ts.seconds * 1000)` או `.toDate()` | החלף ב-`DatesModule.convertTimestamp()` |
| `service.hoursBudget - service.hoursUsed` | החלף ב-`calculateRemainingHours()` |
| פונקציה זהה ב-User App + Admin Panel | Extract ל-`shared/` |
| קובץ בשם `*-v2.js`, `*-new.js`, `*-copy.js` | זהה את הקובץ החי, מחק את המת |

## מה חובה לעשות לפני רפקטור:
1. `Grep` מקיף על כל השמות והדפוסים
2. `Read` את ה-SSOT module הרלוונטי (לוודא התאמה)
3. ספור כמה צרכנים — אם >10, פצל לכמה commits
4. הרץ `npm test` לפני — צריך לעבור
5. רפקטור
6. הרץ `npm test` שוב — צריך לעבור **באותו אופן בדיוק**

## ⚠️ Lead Agent: לפני רפקטור גדול
אם הרפקטור עומד להיות **>100 שורות** או נוגע באחד מ-SSOT modules — Lead Agent מפעיל `devils-advocate` לפני התחלת העבודה.

## גישור (Lead Agent ינתב):
- ➡️ `testing-quality-expert` — **תמיד לפני רפקטור**, לוודא כיסוי
- ➡️ `outcomes-grader` — לפני merge (כולל behavioral diff check)
- ➡️ `devils-advocate` — חובה לרפקטור >100 שורות או SSOT change
