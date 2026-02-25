# GH Law Office System

מערכת ניהול משרד עורכי דין גיא הרשקוביץ — שתי אפליקציות + שרת + כלי פיתוח.

---

## מבנה הפרויקט

```
law-office-system/
├── apps/
│   ├── user-app/              ← אפליקציית העובדים (Frontend)
│   │   ├── js/                ← קוד ראשי (modules/, core/, services/)
│   │   ├── css/               ← עיצוב (15+ קבצי CSS מודולריים)
│   │   ├── components/        ← רכיבי UI
│   │   ├── chatbot/           ← אינטגרציית AI
│   │   ├── shared/            ← utilities משותפים
│   │   ├── dist/              ← TypeScript compiled (אל תערוך)
│   │   └── index.html         ← נקודת כניסה
│   │
│   └── admin-panel/           ← פאנל ניהול למנהלים
│       ├── js/                ← מודולים (managers/, ui/, services/)
│       ├── css/               ← עיצוב
│       ├── components/        ← רכיבי UI
│       └── index.html         ← נקודת כניסה
│
├── functions/                 ← Firebase Backend (Cloud Functions)
│   ├── index.js               ← Registry — 105 שורות, ייצוא כל הפונקציות
│   ├── admin/                 ← ניהול משתמשים, מחיקת נתונים
│   ├── auth/                  ← אימות, הרשאות, claims
│   ├── budget-tasks/          ← ניהול תקציב משימות
│   ├── clients/               ← CRUD לקוחות, מספרי תיק
│   ├── fee-agreements/        ← הסכמי שכ"ט
│   ├── metrics/               ← מדדי ביצועים וסטטיסטיקות
│   ├── scheduled/             ← משימות מתוזמנות יומיות
│   ├── services/              ← ניהול שירותים ושלבים
│   ├── timesheet/             ← מעקב שעות עבודה
│   └── whatsapp/              ← אינטגרציית WhatsApp
│
├── tests/                     ← בדיקות (unit, integration, e2e)
├── devtools/                  ← כלי פיתוח
│   ├── backup/                ← גיבוי DB
│   ├── debug-scripts/         ← כלי דיבאג
│   ├── firestore-scripts/     ← שאילתות ומיגרציות
│   ├── test-scripts/          ← בדיקות ידניות
│   └── ui-tools/              ← כלי UI
│
├── docs/                      ← תיעוד ארכיטקטורה ו-ADRs
├── .github/workflows/         ← CI/CD (GitHub Actions)
└── configs: firebase.json, netlify.toml, eslint, stylelint, playwright
```

---

## אפליקציות

### User App (`apps/user-app/`)

אפליקציית העובדים — ניהול לקוחות, משימות מתוקצבות, שעתון עבודה, לוח שנה, הודעות, צ'אט AI.

- ארכיטקטורה: EventBus (event-driven) + FirebaseService (callable functions)
- `js/core/event-bus.ts` — 60+ אירועים מוגדרים, type-safe
- `js/services/firebase-service.ts` — retry, cache, rate-limiting
- `js/modules/` — 45+ מודולים, כל אחד אחראי לדבר אחד

### Admin Panel (`apps/admin-panel/`)

פאנל ניהול למנהלים — ניהול משתמשים, דוחות, feature flags, מחיקת נתונים, אנליטיקת עומסים.

---

## Backend (`functions/`)

`index.js` = 105 שורות — registry שמייצא את כל הפונקציות מ-10 מודולים:

| מודול | תיאור |
|---|---|
| `admin/` | ניהול משתמשים, חסימה, מחיקת נתונים |
| `auth/` | אימות, claims, הרשאות admin |
| `budget-tasks/` | יצירת משימות, הוספת זמן, השלמה, הארכת יעד |
| `clients/` | CRUD לקוחות, מספרי תיק, סגירת תיקים |
| `fee-agreements/` | העלאה ומחיקה של הסכמי שכ"ט |
| `metrics/` | מדדי ביצועים, סטטיסטיקות עובדים |
| `scheduled/` | תזכורות יומיות, אזהרות תקציב, invariant check |
| `services/` | ניהול שירותים, מעבר שלבים, השלמה |
| `timesheet/` | רישום שעות (v2), quick-log, עדכון רשומות |
| `whatsapp/` | שליחת הודעות, webhook, אישורים |

---

## URLs

| | DEV (main) | PROD (production-stable) |
|---|---|---|
| **User App** | https://main--gh-law-office-system.netlify.app | https://gh-law-office-system.netlify.app |
| **Admin Panel** | https://main--admin-gh-law-office-system.netlify.app | https://admin-gh-law-office-system.netlify.app |

---

## Firebase

- **Project**: `law-office-system-e4801`
- **Collections עיקריות**: clients, budget_tasks, timesheet_entries, users, messages, fee_agreements, services
- **Cloud Functions**: ~50 callable functions ב-10 מודולים

---

## Deploy

```
feature/* → main (DEV) → בדיקה → PR ל-production-stable (PROD) → בדיקה → Functions בנפרד
```

1. עבודה על feature branch
2. Merge ל-`main` — Netlify DEV מתעדכן אוטומטית
3. בדיקה ב-DEV URLs
4. PR מ-`main` ל-`production-stable` (branch protected)
5. Merge — Netlify PROD מתעדכן
6. Functions: `firebase deploy --only functions` (בנפרד, לפי צורך)

---

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6 modules), TypeScript (core + services)
- **Backend**: Node.js, Firebase Cloud Functions
- **Database**: Firestore, Realtime Database
- **Auth**: Firebase Authentication (session-based per tab)
- **Hosting**: Netlify (2 sites — user app + admin panel)
- **Testing**: Vitest (unit), Playwright (e2e)
- **CI/CD**: GitHub Actions, pre-commit hooks (ESLint + Stylelint via Husky)
- **Validation**: Zod (frontend schemas), Joi (backend)

---

**גרסה**: 4.27.0 | **עודכן**: פברואר 2026
