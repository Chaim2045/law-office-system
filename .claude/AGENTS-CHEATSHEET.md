# 🎯 Claude Code Agents & Commands — מדריך שימוש מהיר

**משרד עו"ד גיא הרשקוביץ | Law Office System**

**עודכן:** 2026-05-26 · **גרסה:** 3.0 (Lead Agent + 11 sub-agents) · **ראה גם:** `CLAUDE.md` (הסכם העבודה)

---

## 🟢 תוך 30 שניות — מה לעשות עכשיו?

| המצב שלך | הפקודה |
|---|---|
| בקשה מעורפלת — צריך לחדד | `/intent [רעיון]` |
| יש לי בעיה ואני לא בטוח מה זה | `/אבחון [תיאור]` |
| אני יודע מה הבעיה, רוצה לחקור | `/ארכיטקט [הנושא]` |
| רוצה תוכנית פעולה | `/תכנון [הבעיה]` |
| סיימתי קוד — רוצה ביקורת | `/ביקורת` (מפעיל outcomes-grader) |
| רוצה לדחוף ל-DEV | `/ולידציה dev` |
| רוצה להעלות ל-PROD | `/ולידציה prod` |
| **רוצה שיתקפו את ההחלטה שלי** | `/פרקליט-שטן [ההחלטה]` |
| אני מבולבל מהשלב | `/ניווט` |
| רוצה הנחיות רפקטור | `/refactor [תיאור]` |
| רוצה הנחיות ביצועים | `/perf [בעיה]` |

---

## 🧭 הפרוטוקול הקבוע (חובה לפי CLAUDE.md)

```
0. Work Session Check  ← SessionStart hook אוטומטי (לא דורש פעולה)
1. Intent              ← Haim מגדיר; אם מעורפל → /intent
1a. Effort Scaling     ← effort-scaler אם >3 sub-agents
2. Investigation       ← workers במקביל (READ ONLY)
2a. Completeness Check ← completeness-checker
3. Checkpoint          ← Haim מאשר ⚠️
4. Planning            ← Lead Agent מציע תוכנית
5. Code                ← Lead Agent + workers
6. Gates               ← /ביקורת או /ולידציה (outcomes-grader) ⚠️
6a. Evaluator-Optimizer ← אם grader = FAIL, auto-retry x3
```

**אסור לדלג על Checkpoint.** אם דילגת — `/ניווט` יחזיר אותך למסלול.

---

## 🤖 הצוות — 11 sub-agents + Lead Agent

### 🎯 Lead Agent (Orchestrator) — לא subagent
זה ה-Claude Code session הראשי. תפקידו: לפרק בקשה, להפעיל workers במקביל, לאסוף תוצאות, להגיש ל-Haim. מוגדר ב-`CLAUDE.md`.

### Workers (4) — מומחי דומיין
| סוכן | תחום | טריגרים |
|---|---|---|
| `backend-firebase-expert` | Cloud Functions, Firestore, Transactions, Triggers, Idempotency | "שנה ב-Firestore", "Cloud Function", "race condition", "trigger" |
| `frontend-ui-expert` | HTML/CSS/JS, EventBus, DOMPurify, SSOT modules | "תקן UI", "המסך לא מתעדכן", "innerHTML" |
| `data-investigator` | פערי נתונים, reconciliation, timesheet_entries SSOT | "שעות לא נכונות", "יש drift", "סכום לא תואם" |
| `security-access-expert` | firestore.rules, storage.rules, Auth, Claims, XSS, PII, חוק הפרטיות | "תבדוק אבטחה", "הרשאות", "rules", "privilege escalation" |

### Quality (2)
| סוכן | תחום | מתי |
|---|---|---|
| `outcomes-grader` | **גרידה + Code Review 6-stage + PROD Safety + Anti-Premature Closure** (מאחד 3 תפקידים) | לפני כל PR |
| `testing-quality-expert` | Vitest, Playwright, coverage | חובה לפני merge |

### Challenger (1)
| סוכן | תחום | מתי |
|---|---|---|
| `devils-advocate` | 5 התנגדויות + הגנה, ראיות file:line | לפני merge גדול, רפקטור >100 שורות, schema/rules change |

### Meta (3)
| סוכן | תחום | מודל | מתי |
|---|---|---|---|
| `effort-scaler` | LIGHT/MEDIUM/HEAVY classification | Haiku | לפני dispatch >3 agents |
| `completeness-checker` | loose ends, adjacent bugs, drift, backlog | inherit | אחרי investigation, לפני checkpoint |
| `evaluator-optimizer` | auto-fix on grader FAIL (max 3 retries) | sonnet | אוטומטית כש-grader=FAIL |

### Ops (1)
| סוכן | תחום |
|---|---|
| `ops` | CI/CD + Deploy + Environments (מאחד ci-cd-expert + devops-deploy-manager לשעבר) |

---

## 🪝 Hooks אוטומטיים (לא דורשים פעולה)

| הוק | אירוע | מטרה |
|---|---|---|
| `work-session-gatekeeper.sh` | SessionStart | מזרים מצב git (open work / open PRs / deploy drift) ל-Lead Agent |
| `require-outcomes-pass.sh` | PreToolUse on `gh pr create` | חוסם פתיחת PR בלי VERDICT: PASS + PRODUCT-GRADE Gates |
| `log-agent-usage.sh` | SubagentStart | telemetry על שימוש בסוכנים → `.claude/logs/agent-usage.jsonl` |

---

## 📋 Slash Commands

### יומיומי
| פקודה | למה זה טוב |
|---|---|
| `/intent [רעיון]` | חידוד בקשה מעורפלת ל-Intent מוגדר |
| `/טומי [רעיון]` | מצב Architect — חושב, לא עושה |
| `/אבחון [בעיה]` | אבחון ראשוני לפני חקירה |
| `/תכנון [בעיה]` | תכנון פתרון עם 2-3 אופציות |
| `/פרקליט-שטן [החלטה]` | 5 התנגדויות חזקות עם ראיות מהקוד |
| `/ביקורת` | outcomes-grader עם Code Review 6-stage |
| `/ולידציה [dev\|prod]` | outcomes-grader עם PROD Safety layer |
| `/ניווט` | איפה אני, מה הבא |
| `/סטטוס` | דוח מצב של הפרויקט |
| `/מדרג [pr-id]` | outcomes-grader על PR ספציפי |
| `/refactor [תיאור]` | הנחיות רפקטור (SSOT, behavior preservation) |
| `/perf [בעיה]` | הנחיות ביצועים (Firestore, bundle, render) |

### עבודה טכנית
| פקודה | למה זה טוב |
|---|---|
| `/ארכיטקט [נושא]` | חקירת מערכת, READ ONLY |
| `/בדיקות [מודול]` | כתיבת בדיקות Vitest/Playwright |
| `/חקירת-נתונים [id]` | חקירת פערי נתונים |

### Git
| פקודה | למה זה טוב |
|---|---|
| `/ענף-חדש [שם]` | יצירת feature branch בטוח |
| `/משוך-מהבית` | git pull בטוח |
| `/עדכן-לעבודה [msg]` | commit + push בטוח |

### מצבים מבודדים
| פקודה | למה זה טוב |
|---|---|
| `/plan-strict [feature]` | תכנון בלי הפרוטוקול |
| `/review-strict [pr]` | ביקורת בלי הפרוטוקול |
| `/validate-strict [env]` | ולידציה בלי הפרוטוקול |

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
- ❌ merge ישיר ל-production-stable בלי אישור מ-Haim
- ❌ `--admin`, `--force`, `--no-verify` לעקיפת checks
- ❌ deploy ישיר ל-PROD בלי DEV
- ❌ שינוי ב-SYSTEM_STATUS.md בלי אישור
- ❌ **Recursive spawning** — sub-agent מפעיל sub-agent (רק Lead Agent מפעיל)

אם CI חוסם — **לעצור ולדווח ל-Haim**, לא לעקוף.

---

## 🛡️ מתי /פרקליט-שטן הוא חובה (לא אופציה)

- 🚨 לפני merge ל-`production-stable`
- 🚨 רפקטור >100 שורות
- 🚨 כל שינוי ב-`firestore.rules` או `storage.rules`
- 🚨 שינוי בחישובי שעות, כסף, או חיוב
- 🚨 מחיקה/שינוי שדה ב-DB שיש לו רשומות ב-PROD
- 🚨 Migration על collection קיים
- 🚨 שינוי ב-auth flow / admin claims

---

## 💡 טיפים מהניסיון

1. **תמיד תתחיל ב-/intent** או `/טומי` — חושבים לפני שעושים
2. **אל תדלג על Checkpoint** — זה השומר הכי טוב שלך
3. **בעיות נתונים → /חקירת-נתונים**, לא frontend
4. **כל שינוי ב-rules → security-access-expert + /פרקליט-שטן + /ביקורת**
5. **לפני merge גדול → /פרקליט-שטן** (גם אם הכל עבר ביקורת)
6. **לא סגור ב-DEV? אל תעלה ל-PROD**
7. **console.error = FAIL** — גם אם הכל עובד לעין
8. **לא בטוח איך? שאל /ניווט**

---

## 📚 מסמכים חשובים

- `CLAUDE.md` — הסכם העבודה + Lead Agent role + 11 sub-agents
- `.claude/rules/feature-protocol.md` — סדר הפרוטוקול
- `.claude/rules/agent-rules.md` — מתי כל סוכן חובה
- `.claude/rules/decision-point.md` — מתי להתייעץ עם סוכן לפני AskUserQuestion
- `.claude/rubrics/_PRODUCT-GRADE-GATES.md` — 7 שערים גלובליים

---

**שאלות? הקלד `/ניווט` או `/intent`.**
