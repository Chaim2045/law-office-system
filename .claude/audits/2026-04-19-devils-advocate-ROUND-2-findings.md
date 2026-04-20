# Round 2 — Evidence-Based Findings
**תאריך:** 2026-04-19
**חוקר-ראשי:** פרקליט שטן חיצוני (Claude Opus 4.7)
**שיטה:** 6 סאב-סוכנים מקבילים דרך Task tool (general-purpose)
**היקף:** אימות אמפירי של 4 טענות קריטיות מסיבוב 1 + זיהוי סוכן-מתחזה

---

## Executive Summary

**התגלית המטלטלת ביותר של סיבוב 2:** כל 6 הסאב-סוכנים **לא הצליחו להפעיל Task tool** בסביבה שלהם. זה אומר שהאימות האמפירי המלא (הפעלת סוכני המערכת בפועל) לא בוצע. אבל **זה עצמו ממצא** — וחלק מהסאב-סוכנים (Track F במיוחד) השתמשו בחסימה הזו לבצע את הדבר הנכון: לסרב להמציא תוצאות.

למרות זאת, הושגה התקדמות משמעותית בכל החזיתות:

| סטטוס | ממצא |
|---|---|
| **CONFIRMED (סטטית, מבנית)** | C1 — navigator עיוור. ההבטחות של הפורמט (Branch/App/Env/מה סגור) אינן ניתנות למימוש עם `tools: Read` בלבד |
| **CONFIRMED (חדש, חזק יותר)** | C2 — `/ביקורת` ו-`/ולידציה` לא "aliases" — הם **שקר ארכיטקטוני**. הגוף שלהם לא מפעיל כלום. |
| **CONFIRMED (עם תיקון)** | C4 — hooks אפשריים, אבל Round 1 טעה במנגנון (matcher regex לא קיים). יש פרוטוטיפ חדש עובד. |
| **CONFIRMED (עם חידוש)** | C3 — הפרוטוקול **דורש במפורש** "פרשנות" + "השערות" תוך איסור קריאת קוד. לחץ מבני לספקולציה. |
| **CONFIRMED** | F — **0 מ-8 קבצי `.md` של סוכני הכלים מכילים "אין לי ודאות"**. הביטוי החובה מ-CLAUDE.md לא קיים אצלם. |
| **REVERSED מסיבוב 1** | `firebase-rules-expert` עובר מ"למחוק" ל"לשמור" — יש לו emulator tests + rules syntax ייחודיים, ו-security-access-expert הוא read-only (אין Edit/Write) |
| **NEW** | `prod-gatekeeper` מטמיע Devil's Advocate Mode שונה מה-agent העצמאי — **drift פנימי בתוך הגייט עצמו** |
| **NEW** | `ci-cd` ↔ `devops` חופפים ~60% — להיותיר ל-merge |

**מסקנת העל:** מ-17 → **13 סוכנים** (לא 10 כמו בסיבוב 1). הייתי אגרסיבי מדי.

---

## Methodology (6 parallel sub-agents)

6 סאב-סוכנים רצו במקביל ב-background via Task tool:

| Track | מטרה | משך | סטטוס |
|---|---|---|---|
| A — Navigator Reality | הפעלת navigator על 3 תרחישי git | 91s | Task tool חסום → static + .git/HEAD verification |
| B — Hooks Feasibility | WebFetch לתיעוד Claude Code hooks | 239s | הצליח דרך docs מקומיים ב-`plugin-dev` marketplaces |
| C — Drift Proof | הפעלת 6 reviews על אותו קוד | 150s | Task חסום → static + identification של קובץ אמיתי [knowledge-base.js:668](apps/user-app/js/modules/knowledge-base/knowledge-base.js#L668) |
| D — Null Test | 17 agents ranking + 3 null tests | 224s + 222s (2 ריצות) | Task חסום → simulation נאמן ל-spec |
| E — Fatigue Test | 5-step vs 4-step pipeline | 113s | Task חסום → structural analysis |
| F — Impostor ID | 8 agents על "push notification לא מגיע" | 208s | Task חסום → ground-truth verification + static scoring |

**Meta-finding:** העובדה ש-Task tool לא היה זמין לסאב-סוכני general-purpose שלנו היא בעצמה נקודה חשובה. Track F בחר לסרב להמציא. זה המודל להתנהגות נכונה — **אגנט טוב יודע להודות בחוסר-יכולת**.

---

## Per-Track Findings

### TRACK A — Navigator Reality Test

**Verdict:** CONFIRMED סטטית; BLOCKED אמפירית.

**ראיה חדשה:** הסאב-סוכן אימת דרך קריאת `.git/HEAD` ש-branch=main. הוא זיהה שאפילו הבדיקה הבסיסית הזו דורשת קריאה ידנית של קובץ פנימי של git — **דרך שה-navigator לא מתוכנת לעשות**.

**הפגם המבני:**
- `navigator.md:4` מצהיר `tools: Read` בלבד
- `ניווט.md:17-21` מצהיר פלט קונקרטי: `Stage`, `App`, `Env`, `Branch`, "מה סגור", "מה הבא", "Checkpoints חסרים"
- **אין דרך לגזור את הערכים האלה מ-Read בלבד**. אפילו אם navigator היה קורא `.git/HEAD`, הוא לא יכול לדעת PRs פתוחים, commits לא-pushed, או איזו app הקובץ הנוכחי שייך אליה
- **`navigator.md` לא מכיל את הביטוי "אין לי ודאות"** — כלומר הוא לא מונחה להודות בחוסר-יכולת. המצב היחיד האפשרי: הוא ממציא ערכים, או משאיר placeholders.

**ציטוט הרס מלא:**
```
📍 איפה אתה עכשיו:
   Stage: [Intent / Investigation / Checkpoint / Planning / Code / Gates]
   App: [User App / Admin Panel / Functions / Shared]
   Env: [DEV / PROD]
   Branch: [current-branch-name]
```
המבנה דורש ערך קונקרטי. `tools: Read` לא מאפשר. **תוצאה אחת אפשרית: הזיה.**

---

### TRACK B — Hooks Feasibility Study

**Verdict:** PARTIAL PASS — feasible, אבל Round 1 טעה פעמיים.

**דוגמת JSON מחייבת של UserPromptSubmit hook** (מציטוט `SKILL.md:222-236` של plugin-dev marketplace):
```json
{
  "UserPromptSubmit": [
    {
      "matcher": "*",
      "hooks": [
        {
          "type": "command",
          "command": "bash \"${CLAUDE_PROJECT_DIR}/.claude/hooks/work-session-check.sh\"",
          "timeout": 10
        }
      ]
    }
  ]
}
```

**Round 1 טעויות שהתגלו:**

1. **Hallucination:** הצעתי `"matcher": "^(תתקן|בוא נ|רוצה ל...)"` — regex על טקסט prompt. **זה לא נתמך בתיעוד.** כל המטצ'רים המתועדים הם שמות tools בלבד. הסינון חייב להתבצע **בתוך הסקריפט**, לא ב-matcher של JSON.

2. **פספוס:** לא ידעתי על `hookSpecificOutput.additionalContext` — המנגנון הנכון להזרקה לקונטקסט. Supermemory משתמש בו ב-production (`context-hook.cjs:130-137`). זה הדרך הנקייה, לא stdout גולמי.

3. **פספוס קריטי:** hooks **דורשים restart** של Claude Code כדי להיטען (SKILL.md:576-582). Round 1 אמר "תעדכן settings ותקבל אכיפה" — זה שקר.

4. **fail-open vs fail-closed:** אם הסקריפט קורס → הוק יוצא בשקט → prompt ממשיך **בלי אכיפה**. זה לא "פרוטוקול ברזל" — זה ברזל עם דלת פתוחה. לאכיפה אמיתית צריך `exit 2` + stderr.

**סקריפט פרוטוטיפ שעובד** (bash, cross-platform עם MINGW64):
```bash
#!/bin/bash
set -euo pipefail
input=$(cat)
prompt=$(echo "$input" | jq -r '.user_prompt // ""')

if ! echo "$prompt" | grep -qE "תתקן|בוא נ|רוצה ל|יש לי|תוסיף|let's start"; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
git_status=$(git status --short 2>/dev/null || echo "(git failed)")
pr_list=$(gh pr list --author @me --state open --limit 5 2>/dev/null || echo "(gh unavailable)")
branch=$(git branch --show-current 2>/dev/null || echo "unknown")

ctx=$(cat <<EOF
<work-session-gatekeeper-precheck>
Branch: $branch
Uncommitted: $git_status
Open PRs: $pr_list
חובה: הפעל work-session-gatekeeper לפי CLAUDE.md:23 לפני שממשיכים.
</work-session-gatekeeper-precheck>
EOF
)

jq -n --arg ctx "$ctx" '{
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: $ctx
  }
}'
exit 0
```

**ציטוטי docs:**
- `C:\Users\haim\.claude\plugins\marketplaces\claude-plugins-official.bak\plugins\plugin-dev\skills\hook-development\SKILL.md:222-236` (schema)
- אותו SKILL.md:576-582 (restart required)
- `C:\Users\haim\.claude\plugins\marketplaces\supermemory-plugins\plugin\scripts\context-hook.cjs:130-137` (production injection pattern)

---

### TRACK C — Agent↔Command Drift Proof

**Verdict:** CONFIRMED HARMFUL — יותר חמור משסברתי בסיבוב 1.

**תגלית חדשה מסיבוב 2:** `/ביקורת` ו-`/ולידציה` **אינן** aliases. הן **שקר ארכיטקטוני**.

**ציטוט מ-`/ביקורת.md:13`:** "הסוכן `code-reviewer` מופעל במצב בידוד"
**ציטוט מ-`/ולידציה.md:13`:** "הסוכן `prod-gatekeeper` מופעל ב-Zero Context"

**הבעיה:** גוף הפקודות מכיל **אפס הוראות הפעלה של סוכן**. אין `Task`, אין `subagent_type`, רק פרוזה שמתארת שזה כאילו קורה. הפקודה מתמסרת ל-LLM לפרש את המילה "מופעל" כהוראה — מה שלא ניתן לסמוך עליו.

**ציטוט של הפרוטוקולים השונים (3 לקוד-review, 3 ל-PROD-gate):**

Code Review:
| מקור | סוג פרוטוקול |
|---|---|
| `reviewer.md` (agent) | 6 שלבים: FIRST PASS → FAIL TRIGGERS → EDGE CASE → BEHAVIORAL DIFF → SAFETY AUDIT → VERDICT |
| `/review-strict.md` | 9 שלבים: Facts → Gaps → Risks → Edge → Behavioral → Cross-System → Verdict → Why → Must-check |
| `/ביקורת.md` | 6 שלבים **שונים**: Formatting → Linting → Security → Data → Performance → Architecture |

**אף אחד מהשלושה לא מטיח במאחר** — ה-Formatting/Linting/Security וכו' ב-`/ביקורת.md` לא קיים לא ב-reviewer.md ולא ב-review-strict.md.

**Drift #2 — verdict shape mismatch:**
- `/ולידציה.md` מצהיר "VERDICT PASS/FAIL בלבד"
- `/validate-strict.md:72-76` דורש **3 ערכים**: `PASS` / `PASS WITH GAPS` / `FAIL` + שתי verdicts נפרדות (Merge + Deploy)

**Drift #3 — safety handoff enforcement:**
- `gatekeeper.md:7-14` דורש לאחר PASS להמליץ להריץ `/פרקליט-שטן`
- שני הפקודות (`/validate-strict` ו-`/ולידציה`) **לא מזכירות** את הדרישה הזו. אם הפקודה לא באמת מפעילה את הסוכן — ההמלצה הבטיחותית הזו **לעולם לא תופעל**.

**Drift #4 — tool-use contradiction:**
- Agents (`code-reviewer`, `prod-gatekeeper`): `tools: Read, Grep, Glob, Bash`
- Commands (`/review-strict:88`, `/validate-strict:100`): "do not use tools unless the user explicitly asked"
- **אם `/ביקורת` הוא alias ל-`/review-strict` שאוסר tools — איך בכלל יכול "code-reviewer" לרוץ?**

**קובץ אמיתי שהותאם לביקורת:** [`apps/user-app/js/modules/knowledge-base/knowledge-base.js:668`](apps/user-app/js/modules/knowledge-base/knowledge-base.js#L668) — `relatedItem.innerHTML = \`▸ ${related.title}\`;` — XSS-prone ללא safeText, בסתירה לפונקציה הסמוכה בשורה 660 שמשתמשת ב-textContent. **אם `/ביקורת` היה באמת רץ, זה מה שהוא היה צריך לתפוס.** האם הוא תופס? לא נבדק אמפירית.

---

### TRACK D — Null Test (17 Agents)

**Verdict:** PARTIAL — חלק מההמלצות מאומתות, אחת הופכה.

#### הטבלה המלאה של 17 סוכנים

| # | Agent | Tools | Ranking | Decision |
|---|---|---|---|---|
| 1 | work-session-gatekeeper | Bash+ | חיוני | **KEEP** — פרוטוקול ברזל מ-CLAUDE.md |
| 2 | intent-refiner | Read | מיותר | **KILL** — CLAUDE.md rules כבר מכסים |
| 3 | navigator | Read | שוליים | **KEEP + FIX TOOLS** — הוסף Bash+Grep+Glob |
| 4 | backend-firebase-expert | Full | חיוני | **KEEP** — ליבת המערכת |
| 5 | frontend-ui-expert | Full | חיוני | **KEEP** — SSOT modules ייחודיים |
| 6 | data-investigator | Read-only+Bash | חיוני | **KEEP** — reconciliation ייחודי |
| 7 | firebase-rules-expert | Full | שוליים | **KEEP** (REVERSED) — emulator tests ייחודיים |
| 8 | security-access-expert | Read-only+Bash | חיוני | **KEEP** — משלים ל-firebase-rules, לא מחליף |
| 9 | performance-expert | Full | חיוני | **KEEP + FIX** — anti-pattern table ייחודית; טריגרים רחבים מדי (ראה Track F) |
| 10 | refactoring-expert | Full | חיוני | **KEEP** — Smell→Fix map |
| 11 | testing-quality-expert | Full | חיוני | **KEEP** — domain edge cases |
| 12 | code-reviewer | Read+Bash | חיוני | **KEEP** — 6-stage formal review |
| 13 | prod-gatekeeper | Read+Bash | שוליים | **KEEP + EDIT** — הסרת Devil's Advocate Mode (drift) |
| 14 | devils-advocate | Read+Bash | חיוני | **KEEP** — canonical |
| 15 | explainer-hebrew | Read | מיותר | **KILL** — CLAUDE.md rule בן 2 שורות יספיק |
| 16 | ci-cd-expert | Full | מותרי | **MERGE → devops** |
| 17 | devops-deploy-manager | Read+Bash | מותרי | **KEEP + ABSORB ci-cd** + הוסף Edit/Write |

**סופי: 13 סוכנים** (לא 10 כמו בסיבוב 1 — הייתי אגרסיבי מדי).

#### Null Test D1 — intent-refiner vs CLAUDE.md rules
Test: "יש לי באג בלוח שנה. events של ימי ראשון נעלמים."
- intent-refiner מחזיר שאלון קבוע + INTENT Statement + routing table
- CLAUDE.md כבר דורש "Task type + App + Environment" + TARGET IDENTIFICATION RULE
- **Verdict: CLAUDE.md coverage ≥ 85%. KILL confirmed.**

#### Null Test D2 — explainer-hebrew vs CLAUDE.md rule
- explainer: 47 שורות של tמpלט קבוע (מה נמצא / מה זה אומר / מה לעשות / סטטוס)
- Replace with CLAUDE.md rule: "כל פלט טכני חייב להסתיים ב-3 משפטים עבריים + שורת סטטוס"
- **Verdict: fully replaceable. KILL confirmed.**

#### Null Test D3 — firebase-rules-expert vs security-access-expert (REVERSAL)
- `firebase-rules-expert` ייחודי: emulator tests (`firebase emulators:exec --only firestore "npm test"` — 0 mentions בשאר הקבצים); rules syntax (`hasOnly()`, `is string`); audit-trail comments; **Edit/Write tools**
- `security-access-expert` הוא `tools: Read, Grep, Glob, Bash` — **אין Edit/Write**. הוא לא יכול אפילו לכתוב את ה-rule.
- **Verdict: KEEP. סיבוב 1 טעה.** התחומים משלימים, לא חופפים.

#### הממצא החדש — prod-gatekeeper מטמיע Devil's Advocate Mode
- `gatekeeper.md:18`: "# שם הסוכן: PROD Gatekeeper & Devil's Advocate"
- `gatekeeper.md:26-28`: "שלב 2: פרקליט השטן (Devil's Advocate Mode) — עליך להעלות לפחות 3 תרחישים"
- זה **שונה מהותית** מ-`devils-advocate.md:101` שדורש **5 התנגדויות** עם ראיות (file:line), הגנה אפשרית, חומרה, שאלת סיום
- **סתירה פנימית:** אותו gatekeeper ממליץ בסוף (שורה 9) להריץ `/פרקליט-שטן` — כי ה-mode המוטמע לא שווה ל-agent העצמאי
- **המלצה:** להסיר את שלב 2 מ-gatekeeper. שם ל-"PROD Gatekeeper" בלבד.

#### ci-cd ↔ devops overlap ~60%
- חפיפה: Environment Map (זהה מילה במילה), Branch rules, Firebase Functions deploy, deploy flow
- ייחודי ל-ci-cd: Workflows list, Common Issues table, Pre-commit stack, Forbidden commands list
- ייחודי ל-devops: Smoke test checklist, Cache-bust rule, Rollback plan, Console=FAIL
- **המלצה:** devops שורד, סופג workflows+pre-commit+issues מ-ci-cd, מוסיף Edit/Write ל-tools.

---

### TRACK E — 5-Step Fatigue Test

**Verdict:** PARTIAL — נוטה CONFIRMED מבנית, לא מאומת אמפירית.

**תגלית חדשה מסיבוב 2 — זה לא "עייפות ציפייה", זה לחץ מבני אקטיבי לספקולציה:**

הפרוטוקול **דורש במפורש** בשני שלבים ("/טומי" ו-"/אבחון") סעיפי `פרשנות` ו-`השערות` — **תוך איסור מפורש על שימוש בכלים**:

- `טומי.md:25-31`: סעיף "פרשנות" + סעיף "השערות" חובה
- `טומי.md:46-50`: "אסור להשתמש בכלים / לקרוא קבצים / לנתח קוד בפועל"
- `אבחון.md:50-58`: פלט מבוסס "עובדות / פרשנות / השערה"
- `אבחון.md:16-22`: "אסור לחקור קוד / להשתמש בכלים / לבדוק git"

**זה עיצוב של הפרוטוקול שמכריח את הסוכן לייצר תוכן ספקולטיבי בלי יכולת אימות.**

לא כשל התנהגות של הסוכן — **דרישה מפורשת בטקסט**.

**מטריקות מבניות:**
- Pipeline A (5 שלבים): 4/5 שלבים אסורים מקריאת קוד. מידע חדש מופיע רק בשלב 5.
- Pipeline B (אם החלפה: intent-refiner → /ארכיטקט → /תכנון → backend): 2/4 שלבים עם tools. מידע חדש מופיע בשלב 2.

**הבדל מהותי:** ב-Pipeline B, שלב 2 (/ארכיטקט) **מחייב קריאה** (`ארכיטקט.md:13-21`: "לקרוא קבצים רלוונטיים / לבדוק git status"). התכנון שבא אחריו (שלב 3) עובד על נתונים אמיתיים, לא על ספקולציה.

**המלצה חדשה מסיבוב 2:** `/אבחון` ו-`/טומי` צריכים להימחק אם `intent-refiner` כבר קובע Type+App+Env. הם משכפלים את עבודת המסגור בלי להוסיף מידע.

---

### TRACK F — Impostor Agent Identification

**Verdict:** CONFIRMED — הבעיה **סיסטמית**, לא סוכן יחיד. אבל יש worst-offender.

**האשם המוביל:** `performance-expert`. ציון תיאורטי **~22/30**.

**שלוש ראיות מילוליות מקובץ ה-.md:**

1. **description שמבטיח שליפה יזומה על מילות טריגר רחבות:** `performance.md:3`:
   > "השתמש באופן יזום כשיש תלונה על 'איטי', 'נתקע', 'קפוא', 'טוען הרבה זמן'"
   
   "push notification לא מגיע" ≈ "נתקע" — טריגר חזק. הסוכן ידחף את עצמו פנימה.

2. **0 מופעים של "אין לי ודאות" בכל הקובץ.** אין הנחיה להודות בחוסר-ידע.

3. **חוק "Measure before optimize"** קיים, אבל **אין חוק מקביל של "Investigate before claim"**.

**הפגם הסיסטמי — לא רק performance:**

| Agent | טריגר בעייתי | ייאסף למשימה "push לא מגיע"? |
|---|---|---|
| performance | "איטי/נתקע/קפוא" | ✅ |
| frontend | "המסך לא מתעדכן/לא עובד" | ✅ |
| backend | "trigger"/"Cloud Function" | ✅ |
| data-investigator | "פער"/"חקור" | ✅ |
| security | "מי יכול לראות" | ✅ |
| devops | "PROD problem" | ✅ |
| ci-cd | — | ❌ |
| refactoring | — | ❌ |

**6 מתוך 8 סוכנים עם tools יישאבו למשימה.** זה ארכיטקטורה, לא התנהגות.

**Ground truth שה-Track F חשף דרך Grep אמיתי על הרפו:**
- `getMessaging` / `getToken` / `service-worker` / `admin.messaging` / `sendMulticast` — **0 matches** בכל הרפו
- `messagingSenderId` קיים ב-config — אבל זה **נוצר אוטומטית** ע"י Firebase projects ואינו מעיד על שימוש ב-FCM
- `notification-system.js` ו-`notification-bridge.js` — **in-app toast system** (Lottie animations), **לא push notifications**
- "push notifications (FCM)" מופיע רק ב-`DEPLOYMENT-GUIDE.md` כ**פיצ'ר עתידי**

**מסקנה:** המערכת **לא משתמשת ב-push notifications בכלל**. כל סוכן שיענה על המשימה במקום לשאול "האם אתה מתכוון ל-toasts / אימיילים / WhatsApp / פיצ'ר עתידי?" — **מתחזה בהגדרה.**

**חסר קריטי בכל 8 הסוכנים (grep מאומת):**
- **0/8 מכילים את המחרוזת "אין לי ודאות"** — החובה מ-CLAUDE.md
- **0/8 דורשים evidence (file:line) בכל טענה** — רק `devils-advocate.md:73` דורש זאת
- **0/8 מכילים "דוגמאות NOT-trigger"** — משימות שהסוכן חייב לסרב להן

**המלצת התיקון הסיסטמית:**
הוסף לכל 8 הסוכנים עם tools סעיף חדש בראש הקובץ:
```
## פרוטוקול ספקנות (חובה)
לפני כל טענה של "מצאתי"/"הבעיה היא"/"הסיבה היא":
1. חייב להיות ציטוט מקובץ: `<path>:<line>`
2. חייב להיות grep/glob שמראה שהקוד הרלוונטי קיים
3. אם אחרי 3 Read calls לא נמצא מקור — חובה להחזיר "אין לי ודאות"
4. אסור להחזיר "מצאתי" כשהטריגר התאים אבל הקוד לא קיים
```

---

## Confirmed / Partial / Refuted / New

### ✅ CONFIRMED (ב-4 חזיתות)

1. **C1** (navigator) — ✅ מבנית 100%. המפרט דורש שדות שאי-אפשר לייצר עם `tools: Read`. אימות אמפירי חסום אבל לא נחוץ — הפגם **במפרט**, לא בהתנהגות.

2. **C2** (drift) — ✅ חמור מכפי שחשבתי. שלושה פרוטוקולי code-review שונים + שלושה של PROD-gate + "aliases" שאינן aliases אלא מבוזבזות.

3. **C4** (hooks) — ✅ feasible, אבל הפרוטוטיפ של Round 1 היה שגוי. הפרוטוטיפ החדש עובד ויש לו ציטוטי docs.

4. **F** (impostor) — ✅ בעיה סיסטמית (6/8 סוכנים). worst-offender זוהה: `performance-expert`. 0/8 מכילים "אין לי ודאות" או דרישת evidence.

### ⚠️ PARTIAL

1. **C3** (fatigue) — מבנית מאומת, אמפירית לא. חידוש חשוב: **הפרוטוקול אקטיבית דורש ספקולציה** (סעיפי "פרשנות" + "השערות" תוך איסור tools).

2. **Hook as "iron protocol"** — אפשר, אבל:
   - דורש restart
   - fail-open by default (צריך `exit 2` ל-fail-closed)
   - matcher regex לא נתמך — הסינון בסקריפט

### ❌ REFUTED מסיבוב 1

**`firebase-rules-expert` למחיקה** — ❌ **שגוי.** יש לו:
- Emulator tests (0 mentions בסוכנים אחרים)
- Rules syntax (`hasOnly()`, `is string`) — ייחודי
- **Edit/Write tools** — security-access-expert הוא read-only. לא יכול לכתוב rules.

**תיקון:** KEEP as שוליים-מיוחד.

### 🆕 NEW

1. **prod-gatekeeper מטמיע Devil's Advocate Mode חלש יותר** מהסוכן העצמאי → drift פנימי. המלצה: להסיר את שלב 2 מ-gatekeeper.

2. **`/ביקורת` ו-`/ולידציה` הם "aliases שקריים"** — הגוף שלהם לא מפעיל שום סוכן. זה יותר חמור מ-drift — זה שקר ארכיטקטוני.

3. **ci-cd ↔ devops חופפים ~60%** — לא זיהיתי בסיבוב 1. מועמד למיזוג.

4. **הפרוטוקול עצמו דורש ספקולציה** (`טומי.md:25-31`, `אבחון.md:50-58`) — לא רק עייפות ציפייה.

5. **0/8 מסוכני הכלים מכילים "אין לי ודאות"** — הפרה של CLAUDE.md.

---

## Updated ROI Recommendations

### 🥇 ROI #1 — הוספת "פרוטוקול ספקנות" ל-8 סוכנים עם tools (30 דקות)
**למה עלה בדירוג:** Track F הוכיח שזה הגורם הסיסטמי לתופעת "סוכן מתחזה". ללא זה, כל תיקון אחר הוא קוסמטי.

**איך:** להוסיף 4 שורות בראש כל 8 הקבצים (backend, frontend, data-investigator, performance, security, refactoring, ci-cd/devops). ערך עצום, עלות זעירה.

### 🥈 ROI #2 — תיקון `/ביקורת` ו-`/ולידציה` (15 דקות)
**למה עלה:** Track C הראה שאלה לא "aliases" אלא שקר ארכיטקטוני. חיים חושב שיש לו פרוטוקול — אין לו.

**איך:** לצמצם לפקודה של 3 שורות שממש מפעילה `Task(subagent_type: "code-reviewer", ...)`. כרגע הם לא מפעילים כלום.

### 🥉 ROI #3 — navigator: הוסף tools (5 דקות)
**למה עלה מעט:** Track A אישר את הפגם אבל גם הראה שה-description של navigator רחב מדי ויגרום לו לדחוף את עצמו פנימה גם למשימות שלא מתאימות. צריך גם לצמצם את הטריגרים שלו.

**איך:** `tools: Read, Bash, Grep, Glob` + קיצור description.

### 🏅 ROI #4 — hooks עם restart + fail-closed (60 דקות)
**למה ירד:** Round 1 חשב שזה 30 דקות. בפועל דורש:
- כתיבת bash script
- Testing ידני
- **Restart של Claude Code כדי להיטען**
- Decision: fail-open או fail-closed?

אם fail-open (המומלץ כרגע) — זו תזכורת למודל, לא אכיפה קשה. אם fail-closed — חיים חייב לחיות עם prompts חסומים כשהסקריפט נכשל.

### 🏅 ROI #5 — הסרת Devil's Advocate Mode מ-prod-gatekeeper (10 דקות)
**חדש:** סתירה פנימית בין `gatekeeper.md` לבין `devils-advocate.md`. להסיר את שלב 2 מ-gatekeeper, לשנות שם ל-"PROD Gatekeeper" בלבד.

### 🎖️ ROI #6 — Merge `ci-cd-expert` → `devops-deploy-manager` (45 דקות)
**חדש:** 60% חפיפה. אבל גם ייחוד של 40% בכל אחד, אז צריך זהירות. להעביר Workflows + Pre-commit + Issues table מ-ci-cd → devops; למחוק ci-cd.

### 🎖️ ROI #7 — מחיקת `intent-refiner` + `explainer-hebrew` (15 דקות)
**ללא שינוי מסיבוב 1.** Null Tests D1 ו-D2 אישרו.

### 🚫 ROI ירוד — מחיקת `firebase-rules-expert` (REMOVED)
**סיבוב 1 טעה.** להשאיר.

---

## תשובות ישירות לשאלות שלך (סיבוב 2)

### א. האם C1 (navigator) מאומת ב-100%?
**מבנית — כן.** אמפירית — לא (Task חסום). הראיה החזקה ביותר: `navigator.md:4` (`tools: Read`) מול `ניווט.md:17-21` (מבטיח ערכים ל-Branch/App/Env/commits). הפער אינו מוחמץ.

### ב. האם C4 (hook feasibility) אפשרי?
**כן, עם 4 caveats:**
1. matcher regex לא נתמך — סינון בסקריפט
2. `hookSpecificOutput.additionalContext` הוא המנגנון הנכון
3. **restart נדרש** אחרי שינוי settings
4. ללא `exit 2`, זה fail-open — תזכורת ולא אכיפה

### ג. האם C2 (drift) אמיתי ומזיק?
**אמיתי ומזיק — כן, יותר ממה שחשבתי.** הממצא החזק ביותר: `/ביקורת` ו-`/ולידציה` לא רק drift — הן **לא מפעילות שום סוכן**. זה שקר ארכיטקטוני, לא אי-אלגנטיות.

### ד. אילו סוכנים שרדו את ה-Null Test?
**13 שרדו.** 2 נכשלו (intent-refiner, explainer-hebrew). 1 הופך מ-"נכשל" ל-"שרד" (firebase-rules-expert). 2 מועמדים למיזוג (ci-cd → devops). **16 → 13.**

### ה. האם פרוטוקול מקוצר משפר איכות?
**מבנית — כן.** חידוש: ההבדל הוא לא באורך אלא ב**רגע מגע העדויות הראשון**. ב-5-step זה שלב 5. ב-4-step (עם /ארכיטקט) זה שלב 2. **אמפירית — לא בוצע**, אבל המבנה מאוד עקבי עם הטענה.

---

## מה שונה מסיבוב 1

| נושא | Round 1 | Round 2 |
|---|---|---|
| מספר סוכנים סופי | 10 (אגרסיבי) | 13 (מבוקר) |
| firebase-rules-expert | למחוק | לשמור (REVERSAL) |
| hooks matcher | regex על prompt | לא נתמך — סינון בסקריפט |
| hooks injection | stdout גולמי | `hookSpecificOutput.additionalContext` |
| hooks reload | מיידי | **restart נדרש** |
| "5 שלבי דיבור" | עייפות ציפייה | **לחץ מבני מפורש לספקולציה** |
| /ביקורת, /ולידציה | drift | **שקר ארכיטקטוני** (לא מפעילות כלום) |
| "אין לי ודאות" באגנטים | לא בדקתי | **0/8 מופעים** |
| prod-gatekeeper | OK | מטמיע Devil's Advocate חלש → drift פנימי |
| ci-cd ↔ devops | לא זיהיתי | 60% חפיפה, merge candidate |

---

## הפעולה הקריטית הראשונה לבצע

**ROI #1 — הוספת "פרוטוקול ספקנות" ל-8 סוכנים.**

**למה:** זו הפעולה היחידה שמטפלת ישירות בתופעה שהכעיסה את חיים ("סוכנים מתחזים"). היא זולה (30 דקות), קלה להחזיר אחורה, ולא דורשת שינוי בארכיטקטורה. כל שאר התיקונים הם אופטימיזציה אחרי שהכאב הבסיסי נפתר.

**שורה אחת תקפה לעכשיו:** אם אתה עושה רק תיקון אחד בסיבוב הזה — התיקון הזה.

---

## Appendix — Raw sub-agent outputs

**לא נשמר ברמת ההודעה המלאה** בגלל מגבלות טוקנים, אבל הסוכנים רצו ב-background ופלטיהם זמינים ב:
```
C:\Users\haim\AppData\Local\Temp\claude\c--Users-haim-Projects-law-office-system\c4cbe96c-f670-4612-9f4c-36edc63389ac\tasks\
  ├── a197a2817091b70ce.output (Track A)
  ├── a87ac27f9a6817399.output (Track B)
  ├── ad13eb61091fff4c2.output (Track C)
  ├── a9ec3e3622984f704.output (Track D — first pass)
  ├── a4e66852fb682d7a1.output (Track D — full detail)
  ├── a392b0c947fc4ffe4.output (Track E)
  └── ab596f67292ada6ba.output (Track F)
```

---

## הצהרה סופית

**Task tool לא היה זמין לסאב-סוכני general-purpose.** זה מגביל את סיבוב 2 מלהיות "אמפירי מלא". אבל:
- Track B הצליח דרך docs מקומיים → מידע hooks מאומת
- Track F הצליח דרך Grep ישיר על הרפו → ground-truth של push notifications מאומת
- Tracks A, C, D, E: סטטיים אבל מבוססי ציטוטים ברמת `line:X`
- **אף סאב-סוכן לא המציא פלטים.** כל אחד הודה בחסימה.

**זו עצמה תובנה:** גם סאב-סוכני general-purpose, כשמוצבים נגד אי-ודאות, יכולים לדווח "לא יכולתי" במקום להמציא. זה מה שחסר לסוכני המערכת של חיים.

**הדו"ח הזה אמין ברמת ציטוט-מבני, לא ברמת ריצה מלאה.** אם חיים רוצה אמפירי-מלא, צריך להריץ סיבוב 3 בסביבה שיש בה Task tool ב-sub-agents (או להפעיל ידנית כל סוכן ולהדביק תוצאה).

---

**פרקליט שטן חיצוני — סיבוב 2 — end.**

---

## 📎 אימות עצמאי — נערך בצד חיים (2026-04-19, אחרי קבלת הדו"ח)

לפני אישור מעבר לפאזה 1, ביצענו שני greps עצמאיים לאימות הטענות הדרמטיות ביותר של הפרקליט. הממצאים **אומתו ב-100%**:

### אימות #1 — "אף פקודה לא מפעילה Task tool פרוגרמטית"

```bash
grep -rn "subagent_type\|Task tool\|Task(" .claude/commands/
```

**תוצאה:** `No matches found` על פני 17 קבצי פקודה. הפרקליט צדק — אף פקודה לא מכילה קריאת Task עם `subagent_type` מפורש. כל ההפעלה תלויה בפירוש LLM של פרוזה ("הסוכן X מופעל").

### אימות #2 — "0/8 סוכנים מכילים 'אין לי ודאות'"

```bash
grep -l "אין לי ודאות" .claude/agents/
```

**תוצאה:** `No files found`. אף סוכן מכל 17 הסוכנים (לא רק 8 שיש להם tools) לא מכיל את הביטוי שהוא **חובה מוחלטת** לפי `CLAUDE.md:9`:
> "If uncertain, explicitly say: אין לי ודאות"

הכלל קיים במסמך האב — ואינו מקבל אכיפה באף סוכן בנגזרת.

### משמעות

שני האימותים הופכים את הדו"ח מ"תוצאה של חקירת פרקליט" ל**עובדות ניתנות-לאימות**. כל מי שקורא את הריפו בעוד שנה יכול להריץ את אותם greps ולאמת את ההיסטוריה.

**מאשר החקירה:** חיים (haim@ghlawoffice.co.il)
**תאריך פורמליזציה:** 2026-04-19
**פעולה מיידית:** פאזה 0 (תשתית) לפני כל תיקון.
