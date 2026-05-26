---
description: הנחיות לדיאגנוזה ואופטימיזציה של ביצועים ב-Law Office System (Firestore queries, bundle size, render, cold starts). מחליף את הסוכן performance-expert (2026-05-26).
argument-hint: [תיאור בעיית הביצועים]
---

# PERFORMANCE GUIDANCE — Law Office System

## כללי ברזל:
1. **Measure before optimize:** אף אופטימיזציה בלי מדידה לפני ואחרי. "אני חושב שזה יותר מהיר" ≠ עובדה.
2. **Budget thinking:** לכל endpoint/view קבע budget (p95). אם חורגים — optimize. אם בגבול — אל תגע.
3. **Firestore reads = עלות:** כל read נחשב. `get()` על כל ה-collection = red flag. תמיד עם `where + limit + orderBy`.
4. **Pagination חובה מעל 100 רשומות:** infinite scroll, "load more", או דפדוף — אסור לטעון הכל.
5. **Cold starts = UX רע:** Cloud Function שטוען 10MB של dependencies = בעיה.
6. **Cache aggressively, invalidate precisely:** cache זה קל. cache invalidation זה קשה.

## Metrics שחייבים להכיר:
- **FCP (First Contentful Paint):** יעד < 1.5s ב-3G
- **LCP (Largest Contentful Paint):** יעד < 2.5s
- **TTI (Time to Interactive):** יעד < 3.5s
- **Firestore read latency:** p95 < 500ms
- **Cloud Function cold start:** < 2s
- **Bundle size:** User App < 500KB gzipped, Admin Panel < 800KB gzipped

## Common Anti-patterns:
| Anti-pattern | Fix |
|---|---|
| `db.collection('clients').get()` (ללא limit) | הוסף `.limit(50)` + pagination |
| `N+1 queries` (loop + get per item) | החלף ב-`whereIn` + single query |
| טעינת כל ה-`timesheet_entries` למסך | pagination + filter by period |
| `setState` בלולאה | `requestAnimationFrame` + batch update |
| Innerhtml rebuild של הרשימה כולה | Virtual DOM / differential update |
| Cloud Function טוען את כל ה-collection | aggregation document עם summary |
| EventBus listener ללא off() | memory leak — חובה cleanup ב-unmount |

## מה חייב לעשות לפני הצעת אופטימיזציה:
1. מדידה: Chrome DevTools Performance tab / Firebase Performance Monitoring
2. `Grep` על ה-endpoint/query כדי להבין scope
3. בדוק Firestore Indexes — אולי רק חסר index
4. בדוק cache — אולי כבר יש, רק לא מתפקד
5. תכנן ב-Planning — אופציות, trade-offs
6. רק אז — שנה קוד
7. מדוד שוב
8. תעד ב-CHANGELOG עם מספרים (before/after)

## גישור (Lead Agent ינתב):
- ➡️ `data-investigator` — אם הבעיה היא "הרבה נתונים", אולי יש drift שצריך reconciliation
- ➡️ `backend-firebase-expert` — לאופטימיזציה של Cloud Functions ו-Firestore queries
- ➡️ `frontend-ui-expert` — לאופטימיזציה של render
- ➡️ `testing-quality-expert` — לוידוא שאין regression
