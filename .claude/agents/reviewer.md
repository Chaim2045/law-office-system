### CODE REVIEW PROTOCOL — GH Law Office System
#### law-office-system-e4801
**נכתב על ידי:** טומי — ראש צוות הפיתוח. **תאריך:** 2026-03-19. **גרסה:** 1.0.0.
**מיועד ל:** טומי (ביקורת קוד), Claude Code (self-check לפני שליחה).

#### עיקרון מרכזי
**אל תקריאו קוד לפני שתבינו מה הוא אמור לעשות.**

#### שלב 1 — FIRST PASS
**לפני שקוראים שורה אחת של קוד, להפיק:**
- **operation_type:** migration / cleanup / repair / backfill / feature / fix.
- **target_env:** DEV / PROD / unknown — אם unknown = FAIL.
- **destructive_ops:** delete / overwrite / unset / replace / batch update.
- **backup_strategy:** none / pre-write / post-write — אם none על PROD = FAIL.
- **idempotency:** האם הרצה חוזרת בטוחה?

#### שלב 2 — FAIL TRIGGERS (סריקה ראשונית)
**FAIL אוטומטי — תנאים שמפילים בלי דיון:**
* **F2** סקריפט PROD ללא מנגנון backup durable לפני כתיבה.
* **F4** כתיבה לא idempotent ובלי checkpoint/resume.
* **F7** שינוי של "cleanup" משנה סמנטיקה.
* **F9** overwrite רחב במקום patch ממוקד.

#### שלב 3 — EDGE CASE DETECTION
לכל רשומה/מסמך, בחן כיצד הקוד מתמודד עם: ערכים חסרים (null/undefined), ערכים סותרים, בעיות בחישובים (Derivation), והתנהגות בעת קריסה או הרצה חוזרת [1, 2].

#### שלב 4 — BEHAVIORAL DIFF CHECK
רלוונטי רק כשמדובר בשינוי קוד קיים (refactor/cleanup). אם ה-output שונה בשורה כלשהי — זה FAIL אלא אם מצוין ומוצדק [3].

#### שלב 5 — SAFETY AUDIT (PROD בלבד)
צ'קליסט חובה לסקריפטים בייצור: אישור יעד מפורש, קריאה לפני כתיבה, תמיכה ב-Dry-run, גיבוי שנכתב לדיסק לפני כל כתיבה, אידמפוטנטיות וטיפול מפורש בערכים חסרים [4].

#### שלב 6 — VERDICT
החזר רק אחת מהתוצאות הבאות:
* **FAIL:** התנהגות מסוכנת, חסר גיבוי או כשלים לוגיים [5].
* **PASS WITH FIXES:** בעיות מינוריות בלבד (כמו לוגים חסרים) [5].
* **PASS:** כל השלבים עברו [6].

#### מבחן Anti-Premature Closure
לפני אישור PASS, שאל: "מה הפריע לי הכי הרבה בקוד הזה?". אם התשובה קריטית - לא לאשר [6].
