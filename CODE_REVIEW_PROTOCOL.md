# CODE REVIEW PROTOCOL — GH Law Office System
## law-office-system-e4801

**נכתב על ידי:** טומי — ראש צוות הפיתוח
**תאריך:** 2026-03-19
**גרסה:** 1.0.0
**מקור:** Cross-agent analysis — Claude-Tommy + GPT-Tommy
**מיועד ל:** טומי (ביקורת קוד), Claude Code (self-check לפני שליחה)

---

## עיקרון מרכזי

**אל תקריאו קוד לפני שתבינו מה הוא אמור לעשות.**

ביקורת קוד מתחילה בהיגיון (לוגיקה, סמנטיקה, safety) ורק אחרי בדיפים (סינטקס, edge cases, סגנון).
העיניין הוא בתהליך מקריאה שלב-שלב.

---

## סדר הביצוע (טומי, אל תדלג על שלבים)

```
שלב 1 — FIRST PASS (להפיק לפני קריאה)
שלב 2 — FAIL TRIGGERS (בדיקת מסננים אוטומטית)
שלב 3 — EDGE CASE DETECTION (מטריצת קצוות)
שלב 4 — BEHAVIORAL DIFF CHECK (אם יש שינוי של קוד קיים)
שלב 5 — SAFETY AUDIT (ל-PROD בלבד)
שלב 6 — FAIL TRIGGERS שנית (על התוצאות מ-3-5)
שלב 7 — VERDICT
```

---

## שלב 1 — FIRST PASS

**לפני שקוראים שורה אחת של קוד, להפיק:**

| שדה | מה להפיק |
|-----|---------|
| **operation_type** | migration / cleanup / repair / backfill / feature / fix |
| **target_env** | DEV / PROD / unknown — אם unknown = FAIL |
| **target_collections** | כל collections/docs שנקראים או נכתבים |
| **read_set** | כל השדות שנקראים |
| **write_set** | כל השדות שנכתבים |
| **destructive_ops** | delete / overwrite / unset / replace / batch update |
| **source_of_truth** | מה מגדיר את הערך הנכון |
| **backup_strategy** | none / pre-write / post-write — אם none על PROD = FAIL |
| **skip_logic** | כל תנאי שמדלג על document |
| **fallback_logic** | כל `\|\|`, `??`, ternary, default value |
| **idempotency** | האם הרצה חוזרת בטוחה? |
| **failure_boundary** | per-doc / per-batch / whole-run |

**מפת נתונים — לכל שדה שנכתב:**

```
שדה: _______________
  ערך ישן מאיפה?    _______________
  ערך חדש מאיפה?    _______________
  יכול להיות null?   כן / לא
  יש fallback?       כן / לא — מה?
  תנאי skip?         כן / לא — מה?
  נגזר?              כן / לא
```

**FAIL אוטומטי:**
- target_env לא מוגדר
- source_of_truth לא ברור
- write scope רחב מה-intent
- destructive_ops בלי backup
- derivation בלי מקור מפורש

---

## שלב 2 — FAIL TRIGGERS (סריקה ראשונית)

**FAIL אוטומטי — תנאים שמפילים בלי דיון:**

| מזהה | תנאי |
|------|-------|
| **F1** | סמנטיקה/פרגמטיקה לא מתאימים לקוד |
| **F2** | סקריפט PROD ללא מנגנון backup durable לפני כתיבה |
| **F3** | קריסה באמצע מושחרת מצב לא ניתן לשחזור |
| **F4** | כתיבה לא idempotent ובלי checkpoint/resume |
| **F5** | סקריפט רואה על records שאפשר לתקן/לחשב |
| **F6** | סקריפט שותל default במקום derivation מדויק מהמקור |
| **F7** | שינוי של "cleanup" משנה semantics בלי שקיפות שלמות |
| **F8** | שינוי של fallback (`\|\|`/`??`) משנה מתי מטריגר undefined/null/0/false |
| **F9** | overwrite רחב במקום patch ממוקד |
| **F10** | mixed-schema/legacy לא נלקח בחשבון |
| **F11** | backup/logging מתבצע אחרי mutation במקום לפני |
| **F12** | אין evidence מתנה מהות על partial failure / rerun |
| **F13** | לא אפשר לענות את "מה שישתנה ולמה?" לפני execution |
| **F14** | נתון mutation תלוי בנתון שנכתב באותו loop |

---

## שלב 3 — EDGE CASE DETECTION

**לכל entity/document שהסקריפט נוגע בו, לבדוק מטריצות:**

### מטריצת נוכחות שדות

| מקרה | תיאור | מטופל בקוד |
|------|-------|-------------|
| A | כל השדות כל הרשומות קיימות | ✓ / ✗ |
| B | שדה נדרש ולכן חסר | ✓ / ✗ |
| C | מספר שדות נדרשים חסרים | ✓ / ✗ |
| D | שדה קיים ולכן undefined | ✓ / ✗ |
| E | שדה קיים ולכן null | ✓ / ✗ |
| F | שדה קיים ולכן סוג שגוי (string במקום number) | ✓ / ✗ |
| G | ערך edge: empty string / 0 / false / מערך ריק | ✓ / ✗ |

### מטריצת מבניות

| מקרה | תיאור | מטופל בקוד |
|------|-------|-------------|
| J | parent קיים, child חסר | ✓ / ✗ |
| K | child קיים, parent חסר | ✓ / ✗ |
| L | שני הם קיימים, ערכים סותרים | ✓ / ✗ |

### מטריצת derivation (קריטיות!)

| מקרה | תיאור | מטופל בקוד |
|------|-------|-------------|
| **O** | **אפשר לחשב ממקור ראשי בלבד** | ✓ / ✗ |
| **P** | **מקור ראשי חסר, מקור משני מצוי** | ✓ / ✗ |
| Q | מקורות סותרים | ✓ / ✗ |
| R | תוצאת החישוב = 0 | ✓ / ✗ |
| S | תוצאת החישוב = undefined | ✓ / ✗ |
| T | תוצאת החישוב שלילית / בלתי אפשרית | ✓ / ✗ |

**איך Case P (הכלל שתפס את הבאג הגדול):**

```
אם מקור ראשי חסר (למשל totalHours)
ויש מקור שני במשנה (למשל billable.hoursRemaining)
במקום לעשות SKIP:
  → שאלה: "האם אפשר לחשב מהמקור המשני?"
  → אם כן — FAIL — הקוד צריך לחשב, לא לדלג
```

### מטריצת הרצה

| מקרה | תיאור | מטופל בקוד |
|------|-------|-------------|
| U | קריסה לפני כתיבה ראשונה | ✓ / ✗ |
| V | קריסה אחרי N כתיבות | ✓ / ✗ |
| W | הרצה חוזרת אחרי קריסה באמצע | ✓ / ✗ |
| X | שני סקריפטים רצים במקביל | ✓ / ✗ |

---

## שלב 4 — BEHAVIORAL DIFF CHECK

**רלוונטי רק ורק כששינוי של קוד קיים (refactor / cleanup / fix).**

**כלל: אם שינוי מתואר כ-"cleanup" / "refactor" / "readability" — zero-trust mode.**

**לכל expression שהשתנה, טבלת זהות סמנטית:**

| Input | לוגיקה ישנה → output | לוגיקה חדשה → output | זהה? |
|-------|--------------------|--------------------|------|
| undefined | | | |
| null | | | |
| 0 | | | |
| false | | | |
| "" (ריק) | | | |
| מספר תקין (למשל 50) | | | |
| NaN | | | |

**אם output שונה בשורה כלשהי — זה לא cleanup. זה שינוי של התנהגות. → FAIL אלא אם מצוין ומוצדק.**

**FAIL triggers ספציפיים:**

- שינוי של `computed_value || default` ל-`default` קבוע
- שינוי של `A || 0` ל-`0`
- הסרת guard שאם תמיד true במקרה הנוכחי בלתי אפשרי
- הוספת skip branch למקרה ambiguous שאפשר לחשב
- שינוי סדר פעולות (backup/log אחרי write במקום לפני)

---

## שלב 5 — SAFETY AUDIT (PROD בלבד)

**צ'קליסט חובה לכל סקריפט שרץ על PROD:**

| # | בדיקה | סטטוס |
|---|-------|-------|
| 1 | אישור target מפורש בקוד (project ID) | ✓ / ✗ |
| 2 | קריאה לפני כתיבה | ✓ / ✗ |
| 3 | dry-run mode קיים | ✓ / ✗ |
| 4 | ספירת documents שהושפעו בסיכום | ✓ / ✗ |
| 5 | **backup נכתב לדיסק לפני כל write** | ✓ / ✗ |
| 6 | **backup מספיק לביצוע rollback** | ✓ / ✗ |
| 7 | idempotent (הרצה חוזרת בטוחה) | ✓ / ✗ |
| 8 | error handling per-doc (לא whole-run) | ✓ / ✗ |
| 9 | mutation log עם doc ID + before/after | ✓ / ✗ |
| 10 | האם skip שקט על docs ambiguous | ✓ / ✗ |
| 11 | האם hardcoded fallback שמחליק ערך תקין | ✓ / ✗ |
| 12 | טיפול מפורש ב-undefined/null/legacy | ✓ / ✗ |
| 13 | סקריפט מתנהג בפרגמטיקה של הכותב | ✓ / ✗ |

**FAIL אם אחד מ-5, 6, 11, 12 נכשל.**

---

## שלב 6 — FAIL TRIGGERS שנית

**לאחר שלבים 3-5, לסרוק שנית רשימת F1-F14 על התוצאות החדשות.**

---

## שלב 7 — VERDICT

### FAIL אם:
- נתון כל מסלולי הפילטר
- נתון כל מסלולי הגיבוי
- migration לא ניתן לשחזור אחרי קריסה
- התנהגות השתנתה בלי הצדקה
- recoverability לא מבוססת

### PASS WITH FIXES אם:
- בעיות מבודדות ב: ניסוח לוגים, הוספת output, סגנון קוד אבל שינוי של סמנטיקה

### PASS אם:
- כל השלבים עברו בלי ממצאים

---

## מבחן Anti-Premature Closure

**לפני כל הכרזת PASS, לשאול:**

> **"מה הפריע לי הכי הרבה?"**

- אם יש תשובה קצה קריטית — לא PASS
- אם אין תשובה — PASS

**דוגמה מהפרויקט:**

```
ממצא: PASS על skip client-level recalc כש-totalHours חסר
שאלה: מה הפריע?
תשובה: היה מקרה — mixed client, totalHours חסר, אבל billable service
        עם hoursRemaining=70. אפשר לחשב. → FAIL
```

---

## סדר עדיפויות בביקורת

```
1. סמנטיקה ונתוניות נכונים (data corruption)
2. סמנטיקה ואיבוד נתונים (data loss)
3. יכולת שחזור (recoverability)
4. Edge cases
5. סגנון קוד
```

**אל תקפיצו ל-4/5 לפני שסיימת 1/2/3.**

---

## הוראות ל-Claude Code

כשמקבלים קוד לכתוב קוד לביקורת, יש לוודא שנצרף:

```
SELF-CHECK:
  write_set: [רשימת שדות שנכתבים]
  backup_strategy: [pre-write / post-write / none]
  skip_conditions: [רשימת תנאי דילוג]
  fallback_values: [רשימת || / ?? / defaults]
  idempotent: [yes / no]
  edge_cases_considered: [רשימה]
```

**אם ה-self-check חסר — הקוד חוזר בלי ביקורת.**

---

## מתי משתמשים בפרוטוקול הזה

| סוג משימה | שלבים נדרשים |
|----------|-------------|
| Migration script (PROD) | **כל השלבים — ללא יוצאים** |
| Migration script (DEV) | שלבים 1-4, 7 |
| Bug fix | שלבים 1, 2, 4, 7 |
| Feature code | שלבים 1, 2, 3, 7 |
| Refactor / Cleanup | שלבים 1, 2, 4, 7 |
| Cloud Function | שלבים 1, 2, 3, 7 |

---

## מקור המסמך

המסמך הזה נוצר כל מתוך צוות עבודה של שני agents שעובדים על אותו פרויקט:

- **Claude-Tommy** (Anthropic, Claude Opus 4.6) — bottom-up reviewer, חזק במכניקה פנימית
- **GPT-Tommy** (OpenAI, GPT-5.4 Thinking) — top-down reviewer, חזק ב-failure mode detection

שלושת הממצאים שהובילו ליצירת המסמך:
1. **Case P** — דילוג על חישוב כשמקור משני מצוי (באג אמיתי)
2. **F11** — backup אחרי mutation במקום לפני (crash safety)
3. **F7/F8** — שינוי של `totalHours || 0` ל-`0` שהוא edge case guard

**המסמך הזה נועד לתפוס שלושת הממצאים האלה ודומים להם בעתיד.**

---

*נכתב על ידי טומי — ראש צוות הפיתוח | GH Law Office System | 2026-03-19*
*מעודכן למשתמשים blind spots חדשים*
