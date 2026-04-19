# חבילת ביקורת — Agents, Commands, Protocol, CLAUDE.md
**תאריך הכנה:** 2026-04-19
**מכין:** Claude (Cowork session, Opus 4.7)
**מבקש:** חיים (haim@ghlawoffice.co.il)
**יעד:** סשן נפרד של פרקליט שטן (devils-advocate) לחקירה עצמאית
**סטטוס:** Frozen — לא לערוך את המסמך הזה אחרי הפצתו.

---

## 🎯 מטרת הביקורת

חיים בנה לאורך זמן מערכת של 17 סוכנים + 17 פקודות + CLAUDE.md + פרוטוקול עבודה מסודר.
הוא **חושד** שהמערכת לא ממלאת את יעודה — מרגיש שסוכנים:
1. מתחזים לעבודה ("כן, מצאתי!") בלי באמת לקרוא קבצים/להריץ git
2. מדלגים שלבים בפרוטוקול ואז אומרים "סליחה טעות שלי"
3. מבזבזים טוקנים על פלט שנראה מסודר אבל ריק מתוכן אמיתי

**הבעיה החמורה יותר:** Claude (המכין הזה) בנה את הסוכנים. לכן הוא **לא אובייקטיבי** לבקר אותם. חבילה זו מתועדת במיוחד כדי שגורם חיצוני (פרקליט שטן) יוכל לחקור בלי להסתמך על סיכומים מוטים.

**מה פרקליט השטן צריך להחזיר:**
1. אילו סוכנים הם באמת "ממושמעים" ואילו מתחזים?
2. אילו סוכנים מיותרים / חופפים / מתים?
3. איפה פערי אימות (הוראות על הנייר בלי מנגנון אכיפה)?
4. האם `work-session-gatekeeper` באמת מונע דילוג שלבים, או שהוא עצמו כושל באותה דרך?
5. האם CLAUDE.md הוא "מוח יעיל" או שהוא תיאטרון?
6. מה היעדים הקונקרטיים לתיקון (ranked by ROI)?

---

## 📋 רקע — איך המערכת אמורה לעבוד (Ground Truth)

### שני ה-apps
```
User App       : apps/user-app/
Admin Panel    : apps/admin-panel/
Functions      : functions/
```

### סביבות
```
main              = DEV  (Netlify auto-deploy)
production-stable = PROD (Netlify auto-deploy, branch protected)
```

### URLs
- User App DEV:     https://main--gh-law-office-system.netlify.app
- User App PROD:    https://gh-law-office-system.netlify.app
- Admin Panel DEV:  https://main--admin-gh-law-office-system.netlify.app
- Admin Panel PROD: https://admin-gh-law-office-system.netlify.app

### מצב dist/ (חשוב!)
`apps/user-app/dist/` מוחזק **בתוך git** (לא ב-`.gitignore`). Netlify **לא בונה** ב-PROD — הוא מגיש את ה-dist ישירות מה-branch. מחיקה = הפלת האתר.

---

## 📄 CLAUDE.md הנוכחי (העתקה מלאה — לייחוס)

```markdown
# SYSTEM ARCHITECT & ENGINEERING LEAD - WORKING AGREEMENT

## AUTHORITY
You are an executing AI.
You are subordinate to Tommy (System Architect & Dev Lead).
You do not decide, approve, or initiate.

## STRICT RULE
Never assume missing information.
If uncertain, explicitly say: "אין לי ודאות".

## ENVIRONMENTS
Always confirm before acting.
If not specified — STOP.

- Apps: User App | Admin Panel
- Branches:
  main = DEV
  production-stable = PROD

## FEATURE PROTOCOL (STRICT ORDER)

0. **Work Session Check** — `work-session-gatekeeper` agent (MANDATORY FIRST, זהו פרוטוקול ברזל)
1. Intent — defined by Tommy
2. Investigation — map flow, read code, find edge cases (NO planning, NO code)
3. Checkpoint — wait for approval
4. Planning — only approved scope
5. Code — only after approval
6. Gates — prove with evidence (PASS/FAIL only)

## WORK SESSION GATEKEEPER RULE
Before any new task — `work-session-gatekeeper` MUST run first.
Returns VERDICT: GO or STOP. If STOP — resolve open work before proceeding.
Read-only on git. No exceptions. (Details: `.claude/agents/work-session-gatekeeper.md`)

## MANDATORY RULES
- Every task starts with: Task type + App + Environment
- Never skip steps / Never jump to code / Never expand scope
- If missing data → STOP

## FORBIDDEN COMMANDS (לסוכנים)
- `gh pr merge --admin`
- `git push --force` to main/production-stable
- Any direct merge to production-stable without human approval
- Any bypass of branch protection

## PROD SAFETY
Any PROD action requires: explicit target, dry-run, backup, explicit approval from Tommy.

## BRANCH MAPPING
- main = DEV
- production-stable = PROD
- Feature branches from main → merge to main first

## WHAT IS "PROD"?
"PROD" = the deployed app (Netlify/Firebase), NOT the production-stable branch.
The branch contains everything (tooling, docs, code) — but only built app
artifacts reach production.

## DEPLOYMENT RULES
- Every change must pass DEV before PROD / Direct deploy to PROD forbidden
- Cache-bust mandatory before PROD checks / Smoke test mandatory after deploy
- Any console error = deployment FAIL

## REQUIRED DEPLOY FLOW
DEV → checks → merge to production-stable → PROD → smoke test → close

## TARGET IDENTIFICATION RULE
Before any work: confirm App + Environment + Branch + URL. Missing → STOP.

## SYSTEM_STATUS RULE
SYSTEM_STATUS.md = macro only. Updates require explicit approval from Haim.
```

---

## 🤖 Inventory — 17 הסוכנים

| # | שם הקובץ | שם ה-agent | Tools | תפקיד קצר |
|---|---|---|---|---|
| 1 | backend.md | backend-firebase-expert | Read, Edit, Write, Grep, Glob, **Bash** | Cloud Functions, Firestore transactions, idempotency |
| 2 | ci-cd.md | ci-cd-expert | Read, Edit, Write, Grep, Glob, **Bash** | GitHub Actions, husky, lint-staged, Netlify |
| 3 | data-investigator.md | data-investigator | Read, Grep, Glob, **Bash** | Reconciliation, פערי נתונים, dry-run |
| 4 | devils-advocate.md | devils-advocate | Read, Grep, Glob, **Bash** | פרקליט שטן פנימי — 5 התנגדויות לכל החלטה |
| 5 | devops.md | devops-deploy-manager | Read, Grep, Glob, **Bash** | Deploy flow, cache-bust, smoke test |
| 6 | explainer.md | explainer-hebrew | **Read only** | מתרגם פלטים טכניים לעברית פשוטה |
| 7 | firebase-rules.md | firebase-rules-expert | Read, Edit, Write, Grep, Glob, **Bash** | firestore.rules, storage.rules |
| 8 | frontend.md | frontend-ui-expert | Read, Edit, Write, Grep, Glob, **Bash** | HTML/CSS/JS, EventBus, XSS protection |
| 9 | gatekeeper.md | prod-gatekeeper | Read, Grep, Glob, **Bash** | שומר סף PROD — PASS/FAIL |
| 10 | intent-refiner.md | intent-refiner | **Read only** | Pre-investigation — מחדד בקשה ל-Intent |
| 11 | navigator.md | navigator-process-guide | **Read only** | נווט תהליך — "איפה אני?" |
| 12 | performance.md | performance-expert | Read, Edit, Grep, Glob, **Bash** | אופטימיזציה, Firestore queries |
| 13 | refactoring.md | refactoring-expert | Read, Edit, Write, Grep, Glob, **Bash** | ביטול כפילויות, SSOT enforcement |
| 14 | reviewer.md | code-reviewer | Read, Grep, Glob, **Bash** | Code review 6 שלבי (PASS/FAIL) |
| 15 | security.md | security-access-expert | Read, Grep, Glob, **Bash** | OWASP, Auth claims, XSS/CSRF |
| 16 | tester.md | testing-quality-expert | Read, Edit, Write, Grep, Glob, **Bash** | Vitest, Playwright, 80% coverage |
| 17 | work-session-gatekeeper.md | work-session-gatekeeper | **Bash**, Read, Grep, Glob | שומר סף מושב — GO/STOP לפני כל משימה |

**הערות Tools:**
- **3 סוכנים ללא Bash:** `explainer`, `intent-refiner`, `navigator`. שניים הראשונים — סביר (אין להם מה לעשות ב-Bash). השלישי (navigator) — **פגם:** הוא אמור לדעת "איפה אתה" בתהליך, ואין לו דרך לבדוק את מצב ה-git. ראה "Case Study: navigator.md" למטה.
- **כל השאר יש להם Bash** — טוב לעבודה אמיתית, אבל גם סיכון: פרקליט שטן צריך לאמת שהם *משתמשים* בו ולא רק מצהירים.

---

## 🔧 Inventory — 17 הפקודות (Slash Commands)

בתיקייה `.claude/commands/`:

**אנגלית (3):**
- `plan-strict.md`
- `review-strict.md`
- `validate-strict.md`

**עברית (14):**
- `אבחון.md` — ביצוע אבחון (bug fix)
- `ארכיטקט.md` — יעוץ ארכיטקטוני
- `בדיקות.md` — הרצת בדיקות
- `ביקורת.md` — code review
- `ולידציה.md` — ולידציית deploy
- `חקירת-נתונים.md` — data investigation
- `טומי.md` — (לא מוכר — ייחקר)
- `משוך-מהבית.md` — (לא מוכר — ייחקר)
- `ניווט.md` — הפעלת navigator
- `סטטוס.md` — סטטוס מערכת
- `עדכן-לעבודה.md` — (לא מוכר — ייחקר)
- `ענף-חדש.md` — יצירת feature branch
- `פרקליט-שטן.md` — הפעלת devils-advocate
- `תכנון.md` — שלב תכנון

**שאלה לפרקליט השטן:** האם יש פקודות שלא נקראות בפועל? האם יש חפיפה עם סוכנים?

---

## 🚨 Known Failures — שתי תלונות אמיתיות של חיים

### תלונה 1: "כן מצאתי" בזמן שרחוק שנות אור
**ציטוט ישיר של חיים:**
> "למשל שסוכן מבזבז סתם טוקנים ואו למשל שהוא מרגיש לי שהוא מנסה לומר לי כן מצאת את הבעיה ובתכלס הוא רחוק שנות אור כאילו הוא מתעצל באמת לבדוק או שהוא רוצה לחסוך לעצמו"

**פרשנות:** סוכן שמחזיר "מצאתי את הבעיה!" בלי באמת לקרוא את הקבצים, בלי להריץ grep, בלי לבדוק את ה-logs. הזיה סמכותית.

**שאלות לחקירה:**
- אילו סוכנים מצהירים על ממצאים בלי לצטט שורה+קובץ?
- אילו סוכנים יש להם הוראה מפורשת "כל ממצא חייב להיות מגובה בעדות קונקרטית"?
- אילו הוראות "אין לי ודאות" יש על הנייר — ואילו באמת נאכפות ע"י המבנה?

---

### תלונה 2: מדלג שלבים, ואז "סליחה טעות שלי"
**ציטוט ישיר של חיים:**
> "בנוסף סוכן שאומר לי איפה אני בדיוק נמצא נניח שאני באמצע פיתוח מסויים אז הוא אומר לי איפה אני נמצא ומה השלב הבא - הרבה פעמים הוא מדלג לי שלבים ואז אומר סליחה טעות שלי"

**הסוכן שחיים ציין:** `navigator.md` (ראה Case Study נפרד למטה).

**שאלות לחקירה:**
- האם הדפוס "סליחה טעות שלי" חוזר במקומות אחרים (לא רק navigator)?
- האם `work-session-gatekeeper` באמת מונע את זה, או שהוא עצמו סובל מאותה בעיה?
- האם יש מנגנון "אימות מיקום בתהליך" שמבוסס על *עובדות* (git state, קבצים) ולא על זיכרון של השיחה?

---

## 🔬 Case Study — navigator.md (הסוכן שחיים ציין במפורש)

### מה navigator אמור לעשות
לפי הקובץ `.claude/agents/navigator.md`:
- לענות על "איפה אני?" / "מה הבא?" / "איזה סוכן להפעיל?"
- להחזיר מבנה קבוע: 📍 איפה אתה / ✅ מה סגור / ➡️ מה הבא
- לעקוב אחר פרוטוקול של 11 שלבים

### 4 ממצאים שזיהיתי אני (Claude) בקריאה ראשונית

#### ממצא 1: **פרוטוקול סותר את CLAUDE.md**
`navigator.md` עוקב אחר פרוטוקול של **11 שלבים** (חקירה → תוכנית → ביקורת → קוד → ביקורת קוד → טסטים → Deploy DEV → בדיקה ידנית → Deploy PROD → Smoke test → סגירה).

`CLAUDE.md` מגדיר פרוטוקול של **7 שלבים** (0. Work Session Check → 1. Intent → 2. Investigation → 3. Checkpoint → 4. Planning → 5. Code → 6. Gates).

`work-session-gatekeeper.md` מגדיר פרוטוקול של **7 שלבים** אבל עם שמות אחרים (0. work-session-gatekeeper → 1. intent-refiner → 2. navigator/investigator → 3. checkpoint → 4. planning → 5. code → 6. gates).

**⚠️ יש 3 פרוטוקולים שונים במערכת אחת.** זה לא שיבוש קטן — זה הגדרה סותרת של "איפה אני".

#### ממצא 2: אין אזכור של work-session-gatekeeper
`navigator.md` לא מזכיר את הסוכן שנוצר לאחרונה (work-session-gatekeeper). המשמעות: navigator יכול "להתחיל משלב 1 — חקירה" בלי שעבר קודם ב-gatekeeper.

#### ממצא 3: Tools חסרים לאימות אמיתי
`tools: Read` בלבד. אין Bash, אין Grep. כלומר navigator מנחש איפה אתה נמצא על סמך **הזיכרון של השיחה**, לא על סמך מצב ה-git, ה-branch, ה-PRs, ה-commits.

**זה המתכון הקלאסי להזיות סמכותיות:** הסוכן בטוח ב-"איפה אתה", אבל אין לו דרך לאמת.

#### ממצא 4: אין הוראת "אין לי ודאות"
CLAUDE.md אומר: *"Never assume missing information. If uncertain, explicitly say: 'אין לי ודאות'"*.
navigator.md **לא מזכיר את ההוראה הזו בכלל.** אז הוא לא מחויב להודות שהוא לא יודע. אז הוא ממציא.

#### הערה נוספת: כתיבה לא נקייה
בקובץ navigator.md מעורב "טומי" ו"חיים" באותו מסמך (שורות 9, 12, 15, 56, 58 = "טומי"; description = "חיים"). לא שגיאה פונקציונלית, אבל רמז לעבודה לא בשלה.

---

## 🌐 Potential Cross-cutting Issues (שאלות למערכת כולה)

אלה לא ממצאים שאימתתי — אלה **השערות** שפרקליט השטן צריך לאשר או להפריך:

### השערה A: כפילות בין `gatekeeper` (prod-gatekeeper) ו-`devils-advocate`
שני הסוכנים "תוקפים" החלטות ומחזירים VERDICT. מתי כל אחד מופעל? האם יש חפיפה? `gatekeeper.md` עצמו ממליץ להפעיל `/פרקליט-שטן` אחרי VERDICT=PASS — רמז לחוסר הפרדה ברורה.

### השערה B: "כללי ברזל" על הנייר
כמעט כל סוכן מתחיל ב"פרוטוקול עבודה וכללי ברזל". **פרקליט שטן חייב לבדוק:** האם ההוראות האלה באמת נאכפות ע"י מנגנון, או שהן הצהרה שסוכן יכול להתעלם ממנה ברגע שלחץ הטוקנים מתעורר?

### השערה C: המלצות "חובה להריץ /פרקליט-שטן" שלא נאכפות
ב-backend.md, security.md ועוד כתוב: *"חובה להריץ /פרקליט-שטן [תיאור] לפני שמתחילים לכתוב קוד"*. אין מנגנון טכני שבודק אם זה קרה בפועל. זה חוזה של כבוד.

### השערה D: Explainer כ-translator-only
`explainer-hebrew` מקבל "אל תוסיף מידע". אבל מה קורה אם הסוכן הטכני החזיר פלט **שגוי או חלקי**? Explainer רק מתרגם את השגיאה לעברית יפה, ומגנב אותה לחיים. האם יש גייט שתופס שגיאה של סוכן טכני לפני שהיא מגיעה ל-explainer?

### השערה E: סוכן work-session-gatekeeper מתחזה ל-"חכם"
הוא מכריז על "5 עקרונות חוכמה" (Urgency Assessment, Conflict Detection...). האם הם באמת מיושמים בהוראות המפורשות, או שרק כותרות נחמדות מבלי שיש logic אמיתי שמאכיף אותן? פרקליט שטן צריך לקרוא את הסוכן מא'-ת' ולהחליט.

### השערה F: "Forbidden Commands" ב-CLAUDE.md
הפקודות האסורות (`--admin`, `--force`, `--no-verify`) — האם איזשהו סוכן עקף בפועל? האם יש audit trail? האם זה רק הצהרה?

---

## 🎯 10 שאלות ניקור לפרקליט השטן

1. **אימות ממשי:** קח את `backend-firebase-expert`. הוא מצהיר "לפני כל שינוי שמשפיע על זרימת הנתונים, הפק דוח השלכות". איך אתה יודע שהוא עושה את זה בפועל ולא רק מצהיר? מה האכיפה?

2. **Navigator paradox:** האם סוכן עם `tools: Read` בלבד *יכול בכלל* להיות מהימן בתפקיד "לדעת איפה אני"? או שהארכיטקטורה שלו דופקה מהתכנון?

3. **פרוטוקולים סותרים:** CLAUDE.md (7 שלבים), work-session-gatekeeper (7 שלבים אחרים), navigator (11 שלבים). **מי מוביל?** איזה קובץ הוא ה-SSOT? האם הסוכנים "יודעים" לאיזה לציית?

4. **"חובה להריץ /פרקליט-שטן":** כמה סוכנים כותבים את זה? האם זה נאכף טכנית? אם לא — זו גירסה משופרת של מחווה.

5. **Work Session Gatekeeper כשטיח:** Claude בנה אותו לאחרונה. האם הוא באמת מזהה עבודה פתוחה — או שהוא רק רץ `git status` ו`git branch`? האם בדוגמאות שלו (בקובץ) יש **התנהגות חכמה** או רק הצהרות שהוא "חכם"?

6. **Dead code:** אילו סוכנים לא נקראים בפועל? (בדיקה: grep על שמם בכל הקבצים של .claude/)

7. **Explainer hazard:** אם סוכן טכני החזיר שגיאה סמויה (ממצא שגוי), Explainer יתרגם אותה לעברית יפה. איזה גייט קיים *לפני* explainer כדי לתפוס את זה?

8. **כפילות bash-utilities:** 14 סוכנים יש להם Bash. כמה מהם מריצים אותם פקודות? האם יש ספריית פקודות משותפת, או שכל סוכן ממציא את הגלגל?

9. **Gatekeeper vs Devils-Advocate:** תקרא את שני הסוכנים. מתי כל אחד מופעל? האם אתה (פרקליט שטן חיצוני) יכול להסביר את ההבדל בלי להציץ בקובץ?

10. **Self-Audit Question:** אתה (פרקליט שטן חיצוני) — לו **אתה** היית בונה את המערכת הזו מ-0, האם היו 17 סוכנים? כמה? מה היית מוחק/מאחד? תן רשימה עם נימוק.

---

## 📎 נספחים — קבצים שהפרקליט שטן צריך לקרוא בעצמו (לא לסמוך על הסיכום הזה!)

רשימת קבצי ה-Ground Truth שפרקליט השטן חייב לקרוא ישירות מהריפו, ולא להסתפק בסיכום שלי:

```
/CLAUDE.md                                        (+ 3 נוספים: apps/user-app, apps/admin-panel, functions)
/.claude/agents/*.md                              (17 קבצים)
/.claude/commands/*.md                            (17 קבצים)
/.claude/AGENTS-CHEATSHEET.md
/.claude/README.md
/.claude/instructions.md
/.claude/senior-engineer-protocol.md
/.claude/project-rules.md
/SYSTEM_STATUS.md
/SYSTEM_MAP.md
/CODE_REVIEW_PROTOCOL.md
```

**הוראה מפורשת:** כל ממצא של פרקליט השטן חייב להיות מגובה בציטוט של **קובץ:שורה**. חזרה על הסיכום שלי ללא אימות = חקירה כושלת.

---

## 🧭 Meta — מה *לא* ייכלל בחבילה בכוונה

- **דוגמאות סשנים אמיתיות של חיים** — אין לי גישה לארכיב שלו. חיים ציין שתי תלונות אמיתיות (תועדו ב"Known Failures"), אבל transcripts מלאים לא צורפו. פרקליט שטן יעבוד על סמך הקבצים + השערותיו.
- **החלטה מי "צודק" במחלוקות שכבר היו** — הביקורת היא על המערכת כפי שהיא היום, לא על היסטוריה.
- **מסקנות/תיקונים שלי** — בכוונה. לא הצעתי תיקונים לאף סוכן בחבילה הזו. פרקליט שטן הוא הגורם שמצפה להציע פתרונות, לא אני.

---

**סיום חבילה. טוב לשימוש בסשן חיצוני.**
