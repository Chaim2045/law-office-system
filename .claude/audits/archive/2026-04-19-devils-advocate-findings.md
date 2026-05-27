# Devil's Advocate — Findings on the 17-Agent System
**תאריך:** 2026-04-19
**חוקר:** פרקליט שטן חיצוני (Claude Opus 4.7, Zero-Context)
**היקף:** כל 17 הסוכנים ב-`.claude/agents/` + כל 17 הפקודות ב-`.claude/commands/` + `CLAUDE.md` + `.claude/settings*.json`
**מקור:** קריאה ישירה בקבצים. לא הסתמכתי על `2026-04-19-AUDIT-PACKAGE.md`.

---

## 🎯 תמצית מנהלים (אחד לחיים)

המערכת סובלת מ-**4 כשלים מבניים** שמסבירים בדיוק את התופעה שתיארת ("סוכנים מתחזים לעבודה"):

1. **סוכנים שאמורים "לנווט" אין להם כלים לראות שום דבר** → הם ממציאים.
2. **שכפול בין `agent.md` ל-`command.md` יצר drift** → פרוטוקולי code-review ו-PROD-gate שונים מהותית לכל alias.
3. **5 שלבים "דבר בלי כלים" לפני שמישהו קורא קוד** → חיים מגיע לשלב Investigation מותש ומצפה לתשובה, הסוכן "מספק".
4. **"פרוטוקול ברזל" בלי hook שכופה** → בפועל אופציונלי, לכן מדולג.

**מסקנה:** לא סוכנים "מתחזים" — **הארכיטקטורה מעודדת התחזות.** זה ניתן לתיקון, אבל הדרך היא **צמצום אגרסיבי**, לא הוספת סוכנים.

---

## 🔴 ממצאים — מדורגים לפי חומרה

### C1 — navigator הוא "סוכן עיוור שמתיימר לראות" 🔴 CRITICAL
**הטענה:** `navigator-process-guide` מצהיר תפקיד של "יודע איפה אתה בפרוטוקול", אבל אין לו כלים לראות את המצב.

**ראיות:**
- [`.claude/agents/navigator.md:4`](.claude/agents/navigator.md#L4) → `tools: Read` (בלבד). אין Bash, אין Grep, אין Glob.
- [`.claude/commands/ניווט.md:17-21`](.claude/commands/ניווט.md#L17-L21) מצהיר שהפלט כולל `Branch: [current-branch-name]`, `App: [...]`, `Env: [DEV/PROD]` — **שדות שאין לו דרך לאמת** (אין Bash → אין git, אין gh).
- [`.claude/agents/navigator.md:22-30`](.claude/agents/navigator.md#L22-L30) מבטיח "מה סגור", "מה הבא", "איזה סוכן להפעיל" — כל אלה דורשים מידע מצב (git/PR/commits).

**השלכה ישירה לבעיה שתיארת ("navigator מדלג שלבים"):** 
הוא לא מדלג שלבים בזדון — **הוא מנחש איפה אתה**. כשאתה אומר "איפה אני?", הוא קורא את הטקסט ששלחת, מזהה מילת-מפתח ("תיקנתי קוד"), ומחזיר את התבנית "אתה בשלב 5, עבור לטסטר" — בלי שום ודאות שזה נכון.

**הסיבה הטכנית המדויקת:** `tools: Read` בהגדרת הסוכן.
**התיקון הטכני המדויק:** הוסף `tools: Read, Bash, Grep, Glob` כדי שיוכל להריץ `git status`, `git branch --show-current`, `gh pr list`, `git log --oneline -5`.

---

### C2 — שכפול Agent↔Command עם Drift מהותי 🔴 CRITICAL
**הטענה:** לכל פעולה מרכזית יש **שתי או שלוש גרסאות** של הפרוטוקול, שונות זו מזו. הפלט שחיים מקבל תלוי בשם שהפעיל.

**עדויות קונקרטיות:**

**Code Review (3 גרסאות שונות מהותית):**
| קובץ | שלבים |
|---|---|
| [`reviewer.md:16-44`](.claude/agents/reviewer.md#L16-L44) | FIRST PASS → FAIL TRIGGERS → EDGE CASE → BEHAVIORAL DIFF → SAFETY AUDIT → VERDICT |
| [`review-strict.md:32-66`](.claude/commands/review-strict.md#L32-L66) | Facts → Gaps → Risks → Edge → Behavioral → Cross-System → Verdict → Why → Must-check |
| [`ביקורת.md:17-22`](.claude/commands/ביקורת.md#L17-L22) | Formatting → Linting → Security → Data → Performance → Architecture |

**שלושה פרוטוקולים שונים, אותו שם "ביקורת קוד".** הממצא של הסוכן שונה מהותית בכל אחד.

**PROD Gate (3 גרסאות שונות):**
| קובץ | תוכן |
|---|---|
| [`gatekeeper.md:22-36`](.claude/agents/gatekeeper.md#L22-L36) | 4 שלבים (Zero-Context / Devil's Advocate / PROD Gates / VERDICT) |
| [`validate-strict.md:34-78`](.claude/commands/validate-strict.md#L34-L78) | 9 שלבים (Facts/Gaps/WasValidated/NotValidated/Required/Merge/Deploy/Verdict/WhatMustHappen) |
| [`ולידציה.md:14-22`](.claude/commands/ולידציה.md#L14-L22) | 9 בדיקות טכניות (DEV smoke, Cache-bust, type-check, lint, test, git status, branch, Functions logs, Console) |

**בעיה נוספת:** בנוסף ל-`prod-gatekeeper` יש `work-session-gatekeeper` — **שני סוכנים עם שם "gatekeeper" שונה לחלוטין בתפקיד**. כשחיים כותב "gatekeeper אמר PASS" — לא ברור איזה.

**השלכה:** חיים לא יודע איזה פלט יקבל. הסוכנים לא יודעים מה התבנית הנכונה. **זה המקור ל"סוכן מתחזה" — הוא באמת לא יודע מה מצפים ממנו.**

**התיקון:** למחוק את הכפילות. **Command הוא רק trigger**, לא פרוטוקול. הפרוטוקול תמיד ב-`agent.md`.

---

### C3 — 5 שלבי "דבר-בלי-לראות" יוצרים עייפות ציפייה 🔴 CRITICAL
**הטענה:** חמישה שלבים נפרדים אוסרים על שימוש בכלים. חיים עובר דרך כולם לפני שסוכן אחד מורשה לקרוא קוד.

**ראיות:**
- [`intent-refiner.md:34-36`](.claude/agents/intent-refiner.md#L34-L36): "YOU MAY NOT: לקרוא קבצים, להריץ git, להציע פתרונות, להתחיל Investigation"
- [`אבחון.md:16-22`](.claude/commands/אבחון.md#L16-L22): "YOU MAY NOT: לקרוא קוד, להשתמש בכלים, לבדוק git, להריץ חיפוש"
- [`טומי.md:8-14`](.claude/commands/טומי.md#L8-L14): "לא קורא קוד, לא מריץ כלים, לא מבצע git, לא עושה investigation"
- [`תכנון.md:98-100`](.claude/commands/תכנון.md#L98-L100): "אסור להשתמש בכלים, אסור לקרוא קבצים, אסור לכתוב קוד"
- [`plan-strict.md:70-72`](.claude/commands/plan-strict.md#L70-L72): "אסור להשתמש בכלים, לקרוא קוד, לכתוב קוד"

**אותו דבר, חמש פעמים, בכוונה.**

**איך זה מייצר "סוכן מתחזה":**
1. חיים מתאר בעיה → intent-refiner: "שאל שאלות בלי לבדוק"
2. חיים עונה → אבחון: "מסגר בעיה בלי לבדוק"
3. Checkpoint → חיים מאשר עם ציפייה
4. תכנון: "תכנן בלי לבדוק"
5. סוף-סוף `/ארכיטקט` → מורשה לקרוא. **אבל כבר הצטברה הבטחה ל-4 שלבים של "אנחנו עובדים על זה"**. הסוכן הראשון עם tools מרגיש חייב לספק — אז הוא קורא 2 קבצים ואומר "מצאתי!".

**זה המקור המדויק לתלונה שלך. לא התנהגות הסוכנים — מבנה הפרוטוקול.**

**האשם העיקרי:** אין סוכן אחד "אשם". אבל **הסוכן היחיד עם tools שמופעל ראשון אחרי שלבי הדיבור הוא `backend-firebase-expert` או `data-investigator`**. זה הרגע של "אני חייב לספק ממצא". אם בודדת איזה סוכן "מצהיר מצאתי" הכי מוקדם — הוא הקורבן, לא האשם.

---

### C4 — "פרוטוקול ברזל" של work-session-gatekeeper הוא טקסט בלי אכיפה 🔴 CRITICAL
**הטענה:** [`CLAUDE.md:23`](CLAUDE.md#L23) וגם [`work-session-gatekeeper.md:13`](.claude/agents/work-session-gatekeeper.md#L13) מצהירים "פרוטוקול ברזל, MANDATORY FIRST". **אין שום מנגנון שכופה.**

**ראיות:**
- `c:/Users/haim/Projects/law-office-system/.claude/hooks/` → **לא קיים**. אין תיקיית hooks.
- [`.claude/settings.json`](.claude/settings.json) → אין שדה `hooks`. רק `permissions`.
- [`.claude/settings.local.json`](.claude/settings.local.json) → אין שדה `hooks`. רק `permissions`.
- ב-Claude Code, סוכן רץ רק כשהמודל הראשי **בוחר** להפעילו. אם הוא לא בחר — לא רץ. "MANDATORY" ב-markdown אינו אכיפה.

**תוצאה:** בכל פעם שחיים כותב "תקן באג X", המודל הראשי מחליט אם להפעיל work-session-gatekeeper. **לרוב לא יפעיל** (כי trigger רחב מדי + prompt ישיר יותר חזק). חיים חושב שיש לו שומר סף — בפועל אין.

**בנוסף — description של הסוכן כל כך רחב שהוא "תמיד מתאים":**
`work-session-gatekeeper.md:3` מונה triggers: "רוצה להתחיל, בוא נטפל, צריך לעשות, יש לי רעיון, נעבור ל, נוסיף פיצ'ר, נתקן, משהו חדש, תעזור לי עם, let's start, new task..." — **זה כל בקשה שחיים יכול לכתוב.** בסוכנים, description רחב מדי = אף פעם לא מופעל כי הוא לא מובחן.

**התיקון הטכני:** הוסף hook `UserPromptSubmit` ב-`.claude/settings.json` שמריץ script בדיקה קצר (git status + gh pr list) ומדביק לפרומפט. זה אכיפה אמיתית, לא הסתמכות על "המודל יזכור".

---

### H1 — חפיפה בין 4 סוכני "pre-investigation" 🟠 HIGH
**הטענה:** חיים לא יכול לדעת מתי להפעיל `intent-refiner` מול `/טומי` מול `/אבחון` מול `navigator`.

**ראיות:**
- `intent-refiner.md:13-15` → "חדד Intent, לא חוקר, לא כותב קוד"
- `/טומי.md:8-10` → "לא קורא קוד, לא מריץ כלים"
- `/אבחון.md:7-9` → "ממסגר בעיה לפני חקירה, לא חוקר קוד"
- `navigator.md:11-12` → "לא כותב קוד, לא חוקר, לא מבקר"

**אלה ארבעה סוכנים שכולם "שכבה לפני השלב הראשון, בלי כלים, בלי קוד".** הבחנה ביניהם נמחקת ברגע שקוראים אותם. חיים חייב להחליט כל פעם, וזה חיכוך מתמיד.

**השלכה:** אחד מהם ישרוד אחרי consolidation. שלושת האחרים הם **עיוותים של אותו תפקיד**.

---

### H2 — explainer-hebrew כסוכן נפרד מיותר 🟠 HIGH
**הטענה:** [`explainer.md`](.claude/agents/explainer.md) מתרגם פלטים ל-3 שורות בעברית. זה לא סוכן — זה **system prompt rule**.

**ראיות:**
- `explainer.md:30` → "אל תוסיף מידע. אם הסוכן לא אמר משהו — אתה גם לא אומר."
- הסוכן הוא pure transformation על טקסט קיים. אין שאלה, אין kbוח חקירה, אין כלים (`tools: Read` בלבד).

**למה זה בעיה:** כל סוכן אחר כבר אמור לדבר עברית (CLAUDE.md). הפעלת סוכן נוסף רק לתרגם היא **כפול-לטנסי**, כפול-טוקן, בלי ערך. עדיף `explainer` להיות מילה בסוף כל פרומפט של kuser-facing agent: "סכם ב-3 משפטים בעברית".

---

### H3 — השלב "אבחון → תכנון → ביקורת → ולידציה" הוא פרוטוקול יפה על הנייר, אבל רוב הזמן מדולג 🟠 HIGH
**ראיות אסיפתיות מ-CLAUDE.md:21-29 ומפקודות:**  
הפרוטוקול מונה 6 שלבים (Intent/Investigation/Checkpoint/Planning/Code/Gates). **אין שום hook שמקדם שלב או חוסם קפיצה.** המודל הראשי יכול לעבור מ-Intent ישר ל-Code. כלומר הפרוטוקול הוא **מחויבות עצמית של המודל** — וזו בדיוק ההתנהגות שחיים מתלונן עליה (דילוג שלבים).

**מסקנה:** הפרוטוקול עצמו תקני. האכיפה היא הבעיה. ראה תיקון ב-C4.

---

### M1 — פקודות "משוך-מהבית" / "עדכן-לעבודה" מייצרות סיכון data-loss 🟡 MEDIUM
**ראיות:**
- [`משוך-מהבית.md:23`](.claude/commands/משוך-מהבית.md#L23) מריץ `git reset --hard origin/main` אחרי `git clean -fd`.
- [`עדכן-לעבודה.md:13`](.claude/commands/עדכן-לעבודה.md#L13) מריץ `git add .` — כולל קבצים רגישים potential.

**סיכון קונקרטי:** אם חיים שכח שיש לו עבודה מקומית לא-commited ב-DEV → ירוץ `/משוך-מהבית` → איבד את כל השינויים. הסכנה מובאת בתהליך ("אזהרה: ימחק שינויים"), אבל כפתור אחד לכל זה.

**המלצה:** להעביר את הלוגיקה ל-hook בטוח, לא לפקודה ישירה.

---

### M2 — CLAUDE.md ארוך מדי עם חוסר-מיקוד 🟡 MEDIUM
**ראיות:** [`CLAUDE.md`](CLAUDE.md) הוא 127 שורות של כללים (AUTHORITY, STRICT RULE, ENVIRONMENTS, PROTOCOL, FORBIDDEN, PROD SAFETY, ENV MAP, BRANCH MAPPING, DEPLOY RULES, TARGET ID, SYSTEM_STATUS). הרבה כללים → המודל בוחר מה לזכור.

**מה מועיל:**
- FORBIDDEN COMMANDS (שורה 45-52) — חד-משמעי, הציל מרגים אוטומטיים.
- ENVIRONMENT MAP (63-66) — שימושי.
- BRANCH MAPPING (68-71) — שימושי.

**מה מכביד:**
- FEATURE PROTOCOL (21-29) — **לא נאכף**, ולכן מבזבז טוקנים בכל prompt.
- TARGET IDENTIFICATION RULE (91-105) — חוקים שכל סוכן ממילא מיישם (App/Env).
- SYSTEM_STATUS RULE (107-126) — מפורט מדי, יכול להיות ב-agent נפרד.

**המלצה:** לקצץ ל-40-50 שורות של כללים שרק אלה שנאכפים או מציעים טריגרים קונקרטיים.

---

### L1 — הכרזות "חובה להריץ /פרקליט-שטן" ב-3 סוכנים 🟢 LOW
**ראיות:**
- `backend.md:20-27` → "חובה להריץ /פרקליט-שטן"
- `firebase-rules.md:49-52` → "חובה להריץ /פרקליט-שטן"
- `security.md:28-32` → "חובה להריץ /פרקליט-שטן"
- `refactoring.md:62-66` → "ממליץ להריץ /פרקליט-שטן"
- `gatekeeper.md:7-14` → "חובה להוסיף בסוף הפלט ממליץ /פרקליט-שטן"

**הבעיה:** גם זה "חובה" בלי אכיפה (ראה C4). אבל — **אם יישקם בעקבות שאר הממצאים**, ההרחבה הזו מציפה את הפלט. כל פעם שחיים מבקש משהו ב-backend, הוא מקבל הזכורת "חובה פרקליט-שטן" גם אם זה שינוי טריוויאלי.

---

## 🛠️ המלצות תיקון, מדורג לפי ROI

### 🥇 ROI #1 — **מחיקת כפילות Agent↔Command (ערך עצום, 2 שעות עבודה)**
**מה לעשות:** לצמצם כל פקודת-alias לכמה שורות שרק **מפעילות את הסוכן**. הפרוטוקול המלא נשאר רק ב-`.claude/agents/*.md`.

**קבצים למחיקה/צמצום:**
- `review-strict.md` ו-`ביקורת.md` → 2 שורות בלבד: "מפעיל code-reviewer". הפרוטוקול ב-`reviewer.md`.
- `validate-strict.md` ו-`ולידציה.md` → 2 שורות. הפרוטוקול ב-`gatekeeper.md`.
- `פרקליט-שטן.md` → 2 שורות. הפרוטוקול ב-`devils-advocate.md`.
- `בדיקות.md` → 2 שורות. הפרוטוקול ב-`tester.md`.
- `חקירת-נתונים.md` → 2 שורות. הפרוטוקול ב-`data-investigator.md`.
- `ניווט.md` → 2 שורות. הפרוטוקול ב-`navigator.md`.

**אחד מכל זוג שורד, השני נהיה trigger אלגנטי.** תמחק גם את הסיכוי ל-drift בעתיד.

**ערך:** חוסם את כשל #C2 (שורש של "סוכן מתחזה"). 
**עלות:** נמוך. שינויים textual בלבד.

---

### 🥈 ROI #2 — **תיקון navigator: הוסף tools + קצר את ההצהרות (15 דקות)**
**מה לעשות:**
1. `navigator.md:4` → שנה ל-`tools: Read, Bash, Grep, Glob`
2. `navigator.md:22-30` → הוסף "תריץ תמיד קודם: `git status`, `git branch --show-current`, `gh pr list --author @me --state open`. אחר כך ענה."

**ערך:** חוסם את כשל #C1. navigator מפסיק להזות.
**עלות:** זעיר.

---

### 🥉 ROI #3 — **חיבור hook אמיתי ל-work-session-gatekeeper (30 דקות)**
**מה לעשות ב-`.claude/settings.json`:**
```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "^(תתקן|בוא נ|רוצה ל|יש לי|תוסיף|צריך|לעשות)",
        "hooks": [
          {"type": "command", "command": "git status --short && gh pr list --author @me --state open --limit 5"}
        ]
      }
    ]
  }
}
```

זה מדביק אוטומטית מצב git ו-PRs לתחילת כל prompt "פתיחת משימה". **אכיפה אמיתית בלי להסתמך על זיכרון המודל.**

**ערך:** חוסם את כשל #C4. זה מה שחיים חשב שיש לו מההתחלה.
**עלות:** בינוני (דרוש test בידי חיים).

---

### 🏅 ROI #4 — **מיזוג 4 סוכני "pre-investigation" לאחד (1 שעה)**
**מה לעשות:** לבחור סוכן אחד שורד — **אני ממליץ `/אבחון`** (הוא הכי קצר וממוקד). למחוק את השלושה האחרים:
- `intent-refiner.md` → למחוק. תפקידו זהה לאבחון.
- `navigator.md` → להשאיר רק בתפקיד של "הצג מצב git", לא "נהל פרוטוקול".
- `טומי.md` (הפקודה) → למחוק. חיים לא צריך פקודה נפרדת כדי "לדבר".

**ערך:** חוסם כשל #H1. חיים לא מתלבט "איזה להפעיל".
**עלות:** בינוני (דורש לחוות-דעת בשטח).

---

### 🏅 ROI #5 — **מחיקת `explainer-hebrew` כסוכן; הפיכתו לכלל בפרומפט (10 דקות)**
**מה לעשות:** להוסיף ל-CLAUDE.md שורה אחת: "כל סוכן שמפיק פלט טכני, חייב לסיים ב-3 משפטים בעברית פשוטה (מה נמצא / מה המשמעות / מה הצעד הבא)."
למחוק את `explainer.md` ואת תיאוריו.

**ערך:** חוסם כשל #H2. חוסך טוקנים ו-latency.
**עלות:** זעיר.

---

### 🎖️ ROI #6 — **צמצום CLAUDE.md ל-50 שורות חיוניות (30 דקות)**
**מה להשאיר:** AUTHORITY + STRICT RULE + ENV MAP + BRANCH MAPPING + FORBIDDEN.
**מה להעביר למקום אחר או למחוק:** FEATURE PROTOCOL (לא נאכף), TARGET IDENTIFICATION (כלול ממילא בסוכנים), SYSTEM_STATUS (להעביר ל-agent נפרד או למחוק).

**ערך:** חוסם #M2. פחות טוקנים בכל שיחה, יותר רלוונטיות.

---

## 📋 תשובות ישירות לשאלות שלך

### א. האם נדרשים 17 סוכנים? אילו למחוק/לאחד?
**לא.** נדרשים 8-10. המלצת המחיקה:

**להשאיר (8 סוכנים חיוניים):**
1. `backend-firebase-expert` — backend + Firestore + Functions
2. `frontend-ui-expert` — UI
3. `data-investigator` — pure data work
4. `code-reviewer` (→ ישלב את הפרוטוקולים של 3 הגרסאות הקיימות)
5. `prod-gatekeeper` (→ כמו למעלה)
6. `devils-advocate` — שימושי, יחיד בסוגו
7. `testing-quality-expert`
8. `work-session-gatekeeper` — רק אחרי שיש לו hook

**להשאיר עם הפחתה (2):**
9. `navigator` — לצמצם לתפקיד "הצג מצב git" בלבד
10. `security-access-expert` — חובה בזכות מידע משפטי של לקוחות

**למחוק/לאחד (7):**
- ❌ `intent-refiner` — חופף לאבחון/טומי
- ❌ `explainer-hebrew` — צריך להיות system rule
- ❌ `firebase-rules-expert` — חלק מ-security, אל תפצל
- ❌ `performance-expert` — נכלל ב-backend/frontend
- ❌ `refactoring-expert` — נכלל ב-backend/frontend + reviewer
- ❌ `ci-cd-expert` — overlap גדול עם devops
- ❌ `devops-deploy-manager` — overlap עם ci-cd + gatekeeper

### ב. האם work-session-gatekeeper מונע דילוג שלבים?
**לא, בפועל כמעט לא מופעל.** ראה C4. "פרוטוקול ברזל" בלי hook = markdown theater. עם hook (ROI #3) — כן.

### ג. איזה סוכן הוא "האשם העיקרי" בתלונה "מתחזים למצוא את הבעיה"?
**אין סוכן יחיד אשם. האשם הוא המבנה של 5 שלבי "דבר בלי לראות" שיוצרים ציפייה לממצא.** ראה C3.

אם בכל זאת אתה מחפש בודד — **הקורבן התכוף ביותר הוא `backend-firebase-expert`**, כי הוא הראשון עם tools אחרי שרשרת הדיבור, והוא מרגיש חייב לספק ממצא.

### ד. navigator מדלג שלבים — הסיבה הטכנית המדויקת?
**`tools: Read` ב-`navigator.md:4`.** אין לו שום דרך לאמת את המצב שהוא מציג. התיקון: לשנות ל-`tools: Read, Bash, Grep, Glob`. ראה ROI #2.

### ה. CLAUDE.md מועיל או מכביד?
**חלקים מועילים, חלקים מכבידים.** ראה M2 + ROI #6. FORBIDDEN + ENV MAP + BRANCH = חיוני. FEATURE PROTOCOL + TARGET ID + SYSTEM_STATUS = טוקנים יקרים ללא אכיפה.

---

## 🎯 שאלת הסיום לחיים

**האם תסכים לפני כל תיקון להפעיל על המערכת את "The Null Test":**
> *אם אמחק את הסוכן X מחר לחלוטין, האם יחסר בפועל משהו שסוכן אחר לא מספק?*

אם התשובה "לא" עבור סוכן — הוא **תיאטרון**. אם "כן" — הוא חיוני. לפני שמתקנים 17 → 10, הפעל את המבחן הזה בעצמך על כל אחד. זה יבהיר למה `intent-refiner`, `explainer`, `firebase-rules`, `performance`, `refactoring`, `ci-cd`, `devops` נופלים במבחן.

---

## ❌ מה אין לי ודאות עליו
- לא בדקתי קוד אמיתי ב-`functions/` או `apps/` — רק את מערכת הסוכנים.
- לא הרצתי hooks לאימות שהם עובדים ב-Claude Code (לא הייתה לי סיבה).
- לא בדקתי את האודיט-חבילה (`2026-04-19-AUDIT-PACKAGE.md`) כי חיים אמר לא לסמוך עליה.
- ייתכן שיש הקשר היסטורי שהוביל לבחירת השמות / הכפילויות — אבל זה לא משנה את הממצאים הטכניים.

---

**פרקליט שטן חיצוני.**
**דעתי בלתי-מנומסת מכוונת.**
**כל טענה שלי מגובה בקובץ:שורה. אם תפריך משהו — תפריך עם ציטוט, לא עם "נראה לי".**
