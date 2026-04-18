# 🎯 Claude Code Agents & Commands — מדריך שימוש מהיר

**משרד עו"ד גיא הרשקוביץ | Law Office System**

**עודכן:** 2026-04-17 · **גרסה:** 2.0 · **ראה גם:** `CLAUDE.md` (הסכם העבודה)

---

## 🟢 תוך 30 שניות — מה לעשות עכשיו?

| המצב שלך | הפקודה להקליד |
|---|---|
| רק רציתי להתחיל משהו חדש | `/טומי [רעיון]` |
| יש לי בעיה ואני לא בטוח מה זה | `/אבחון [תיאור]` |
| אני יודע מה הבעיה, רוצה לחקור | `/ארכיטקט [הנושא]` |
| רוצה תוכנית פעולה | `/תכנון [הבעיה]` |
| רוצה שיכתבו לי קוד עכשיו | ראה "בחירת סוכן" למטה |
| סיימתי קוד — רוצה ביקורת | `/ביקורת` |
| רוצה לדחוף ל-DEV | `/ולידציה dev` |
| רוצה להעלות ל-PROD | `/ולידציה prod` |
| **רוצה שיתקפו את ההחלטה שלי** | `/פרקליט-שטן [ההחלטה]` |
| אני מבולבל מהשלב | `/ניווט` |

---

## 🧭 הפרוטוקול הקבוע (חובה לפי CLAUDE.md)

```
1. Intent          ← אתה מגדיר מה רוצים
2. Investigation   ← הסוכן חוקר (READ ONLY)
3. Checkpoint      ← אתה מאשר להמשיך ⚠️
4. Planning        ← הסוכן מציע תוכנית
5. Code            ← הסוכן כותב קוד
6. Gates           ← /ביקורת + /ולידציה ⚠️
```

**אסור לדלג על Checkpoint.** אם דילגת — `/ניווט` יחזיר אותך למסלול.

---

## 📋 הפקודות (Commands) — לפי תדירות

### ⭐ יומיומי
| פקודה | למה זה טוב |
|---|---|
| `/טומי [רעיון]` | System Architect — חושב, לא עושה |
| `/אבחון [בעיה]` | אבחון ראשוני לפני חקירה |
| `/תכנון [בעיה]` | תכנון פתרון עם 2-3 אופציות |
| `/פרקליט-שטן [החלטה]` | 5 התנגדויות חזקות עם ראיות מהקוד |
| `/ביקורת` | ביקורת קוד ב-6 שלבים |
| `/ולידציה [dev\|prod]` | gate לפני deploy |
| `/ניווט` | איפה אני, מה הבא |
| `/סטטוס` | דוח מצב של הפרויקט |

### 🔧 עבודה טכנית
| פקודה | למה זה טוב |
|---|---|
| `/ארכיטקט [נושא]` | חקירת מערכת, READ ONLY |
| `/בדיקות [מודול]` | כתיבת בדיקות Vitest/Playwright |
| `/חקירת-נתונים [id]` | חקירת פערי נתונים |

### 🔄 Git
| פקודה | למה זה טוב |
|---|---|
| `/ענף-חדש [שם]` | יצירת feature branch בטוח |
| `/משוך-מהבית` | git pull בטוח |
| `/עדכן-לעבודה [msg]` | commit + push בטוח |

### ⚙️ מצבים מבודדים (Isolated)
| פקודה | למה זה טוב |
|---|---|
| `/plan-strict [feature]` | תכנון בלי הפרוטוקול |
| `/review-strict [pr]` | ביקורת בלי הפרוטוקול |
| `/validate-strict [env]` | ולידציה בלי הפרוטוקול |

### 🇮🇱 Aliases בעברית (כדי שיהיה לך נוח)
| בעברית | שווה ל |
|---|---|
| `/ביקורת` | `/review-strict` |
| `/ולידציה` | `/validate-strict` |
| `/ניווט` | navigator agent |

---

## 🤖 הסוכנים (Agents) — מי עושה מה

### Tier 1 — ראשי (מופעלים אוטומטית)
| סוכן | תחום | מתי יפעל |
|---|---|---|
| `intent-refiner` | חידוד בקשה | כשאין App/Env/Scope ברורים |
| `navigator-process-guide` | ניווט בתהליך | כשאתה מתבלבל בפרוטוקול |
| `explainer-hebrew` | תרגום לעברית | אחרי פלט טכני של סוכן אחר |

### Tier 2 — מומחי תחום
| סוכן | תחום | טריגרים |
|---|---|---|
| `backend-firebase-expert` | Cloud Functions, Firestore, Transactions | "שנה ב-Firestore", "Cloud Function", "race condition" |
| `frontend-ui-expert` | HTML/CSS/JS, EventBus, DOMPurify | "תקן UI", "המסך לא מתעדכן", "innerHTML" |
| `data-investigator` | פערי נתונים, reconciliation | "שעות לא נכונות", "יש drift", "סכום לא תואם" |
| `security-access-expert` | Rules, Auth, Claims, XSS | "תבדוק אבטחה", "הרשאות", "privilege escalation" |
| `firebase-rules-expert` | firestore.rules, storage.rules | "תעדכן rules", "emulator test for rules" |
| `testing-quality-expert` | Vitest, Playwright, coverage | "תכתוב בדיקות", "coverage", "e2e" |
| `performance-expert` | Bundle, queries, cold starts | "איטי", "נתקע", "lighthouse" |
| `refactoring-expert` | ביטול כפילות, SSOT | "כפילות", "refactor", "SSOT violation" |

### Tier 3 — שערים ופיקוח
| סוכן | תחום | מתי יפעל |
|---|---|---|
| `code-reviewer` | ביקורת קוד פורמלית | לפני PR, אחרי קוד |
| `prod-gatekeeper` | gate לפני PROD | לפני merge ל-production-stable |
| `devils-advocate` | **תקיפת החלטות עם 5 התנגדויות + הגנה** | לפני merge גדול, רפקטור, שינוי rules |
| `devops-deploy-manager` | פריסה, CI/CD, סביבות | כל deploy |
| `ci-cd-expert` | GitHub Actions, husky, lint-staged | כשל ב-CI, שינוי ב-pipeline |

---

## 🏗️ מפת הארכיטקטורה — מה איפה

```
law-office-system/
├── apps/user-app/          ← העובדים
├── apps/admin-panel/       ← המנהלים
├── functions/              ← 55 Cloud Functions ב-10 מודולים
├── tests/                  ← Vitest + Playwright
└── devtools/               ← כלי פיתוח, reconciliation
```

### 🌐 URLs
| | DEV (main) | PROD (production-stable) |
|---|---|---|
| **User App** | main--gh-law-office-system.netlify.app | gh-law-office-system.netlify.app |
| **Admin Panel** | main--admin-gh-law-office-system.netlify.app | admin-gh-law-office-system.netlify.app |

### 🔥 Firebase
- **Project:** `law-office-system-e4801`
- **37 Collections** (עיקריים: clients, budget_tasks, timesheet_entries, services, users)
- **SSOT לשעות:** `timesheet_entries` — כל ערך אחר נגזר ממנו

---

## 🎯 SSOT Modules — אסור לשכפל!

```javascript
window.safeText(text)                         // XSS protection
window.ClientSearch.searchClientsReturnHTML() // חיפוש לקוחות
window.renderServiceCard(service, type, ...)  // כרטיס שירות
window.DatesModule.formatDateTime(date)       // תאריכים
window.calculateRemainingHours(entity)        // שעות נותרות
```

**לפני שכותבים קוד — `Grep` על שם הפונקציה.** אם יש — השתמש. אל תיצור שוב.

---

## 🚨 FORBIDDEN — אסור לחלוטין

מ-CLAUDE.md:
- ❌ `gh pr merge --admin` — עקיפת branch protection
- ❌ `git push --force` ל-main / production-stable
- ❌ merge ישיר ל-production-stable בלי אישור מחיים
- ❌ `--admin`, `--force`, `--no-verify` לעקיפת checks
- ❌ deploy ישיר ל-PROD בלי DEV
- ❌ שינוי ב-SYSTEM_STATUS.md בלי אישור

אם CI חוסם — **לעצור ולדווח**, לא לעקוף.

---

## 🔄 תהליך Deploy המלא

```
feature/xyz → merge ל-main → Netlify DEV deploy → /ולידציה dev
         ↓
  בדיקה ידנית ב-DEV URLs
         ↓
  PR מ-main ל-production-stable
         ↓
  /ביקורת → /ולידציה prod → merge (אחרי אישור חיים)
         ↓
  Netlify PROD deploy → Smoke test → סיום
```

Functions נפרד: `firebase deploy --only functions`

---

## 💡 טיפים מהניסיון

1. **תמיד תתחיל ב-/טומי** — חושבים לפני שעושים
2. **אל תדלג על Checkpoint** — זה השומר הכי טוב שלך
3. **בעיות נתונים → /חקירת-נתונים**, לא frontend
4. **כל שינוי ב-rules → firebase-rules-expert + /פרקליט-שטן + /ביקורת**
5. **לפני merge גדול → /פרקליט-שטן** (גם אם הכל עבר ביקורת)
6. **לא סגור ב-DEV? אל תעלה ל-PROD**
7. **console.error = FAIL** — גם אם הכל עובד לעין
8. **לא סגור איך? שאל /ניווט**

## 🛡️ מתי /פרקליט-שטן הוא חובה (לא אופציה)

- 🚨 לפני merge ל-`production-stable`
- 🚨 רפקטור >100 שורות
- 🚨 כל שינוי ב-`firestore.rules` או `storage.rules`
- 🚨 שינוי בחישובי שעות, כסף, או חיוב
- 🚨 מחיקה/שינוי שדה ב-DB שיש לו רשומות ב-PROD
- 🚨 Migration על collection קיים
- 🚨 שינוי ב-auth flow / admin claims

**הסוכנים האחרים יזכירו לך** להפעיל אותו ברגעים האלה — אבל אתה הבוס. אם אתה רוצה תקיפה — `/פרקליט-שטן [ההחלטה]`.

---

## 📚 מסמכים חשובים

- `CLAUDE.md` — הסכם העבודה עם חיים (טומי), חוקי ברזל
- `.claude/PROJECT-CONTEXT.md` — הקשר הפרויקט, branches, URLs
- `.claude/project-rules.md` — כללי SSOT, דפוסים אסורים
- `.claude/senior-engineer-protocol.md` — פרוטוקול מפתח בכיר
- `README.md` (root) — סקירת הפרויקט
- `SYSTEM_MAP.md` — מפת functions ו-collections

---

**נוצר אוטומטית כחלק משדרוג מערכת הסוכנים v2.0.**
**שאלות? הקלד `/ניווט` או `/טומי`.**
