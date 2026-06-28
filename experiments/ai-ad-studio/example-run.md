# הרצה לדוגמה — פרסומת משקה ספורט (15 שניות)

הוכחה שה-Skill עובד: brief → מסמך-בימוי מלא. (דוגמה ניטרלית כדי להדגים; מחליפים בקלות
במוצר שלך.)

## ה-BRIEF שהוזן
- מוצר: בקבוק משקה ספורט מאט-שחור 500מ"ל, פקק ניאון-ירוק.
- מטרה: מודעות + השקה. אורך: 15ש'. טון: אנרגטי, נחוש, פרימיום.
- קהל: רצים חובבים 25–40. מסר: "דלק לדחיפה האחרונה." CTA: לוגו + "PUSH."
- חומרים: `PRODUCT`, `CHAR_A` (רץ גבר ~28, רזה, שיער כהה קצר), `LOC_A` (מנהרת מעבר
  בטון בזריחה, אור אפור-קר).

---

## הפלט שה-Skill מפיק

### PART 1 — GLOBAL STYLE HEADER
```
STYLE: premium athletic commercial, photoreal, filmic
CAMERA: 35mm, handheld kinetic energy, decisive slow push-ins
COLOR: desaturated cool grays + a single neon-green accent
LIGHT: low-key dawn, hard rim light separating subject from background, soft fill
TEXTURE: fine 35mm grain, shallow depth of field, natural sweaty skin
MOTION: real-time, weighty footfalls; no slow-mo except SHOT 3
```

### PART 2 — ASSET REGISTRY
| NAME | locked description | sheets to prepare |
|---|---|---|
| PRODUCT | matte-black 500ml bottle, neon-green cap | front / 3-4 / profile / top — gray bg |
| CHAR_A | male runner ~28, lean, short dark hair | face closeup + full-body **headless**; **motion-test: YES** |
| LOC_A | concrete underpass, dawn, cool gray light | establishing still; **motion-test: YES** |

### PART 3 — SHOT LIST

```
SHOT 1 — Lacing up  (0–4s)
Storyboard sketch: low-angle close on running shoes, hands tightening laces, underpass behind.
Prompt (Seedance 2):
  [GLOBAL STYLE HEADER]
  SHOT: low-angle close-up   CAMERA: static, micro handheld jitter
  SUBJECT: CHAR_A crouched in LOC_A
  ACTION:
    Beat 1: fingers pinch both laces
    Beat 2: pull tight in one sharp motion
    Beat 3: tap the shoe once on the concrete
  ENVIRONMENT: wet concrete reflecting dawn light, faint mist
  LIGHTING: hard rim light from the tunnel mouth behind
  REFERENCES: attach CHAR_A
  NEGATIVE: no warped hands, no extra fingers, no logo on shoes
Duration: 4s
```
```
SHOT 2 — The drink  (4–9s)
Storyboard sketch: medium close-up, CHAR_A lifts PRODUCT, drinks, exhales hard.
Prompt (Seedance 2):
  [GLOBAL STYLE HEADER]
  SHOT: medium close-up   CAMERA: slow push-in to the face
  SUBJECT: CHAR_A holding PRODUCT in LOC_A
  ACTION:
    Beat 1: raise PRODUCT into frame, cap already open
    Beat 2: two real swallows, throat moves
    Beat 3: lower bottle, sharp exhale, eyes lock forward
  ENVIRONMENT: underpass, shallow background bokeh
  LIGHTING: neon-green accent reflecting off the bottle onto the jaw
  REFERENCES: attach CHAR_A, PRODUCT
  NEGATIVE: no label distortion, no morphing bottle shape, no face drift
Duration: 5s
```
```
SHOT 3 — The push  (9–15s)
Storyboard sketch: tracking shot, CHAR_A sprints out of the tunnel into bright light.
Prompt (Seedance 2):
  [GLOBAL STYLE HEADER]
  SHOT: side tracking shot   CAMERA: matches running speed, then he pulls ahead
  SUBJECT: CHAR_A sprinting out of LOC_A
  ACTION:
    Beat 1: explosive first stride, arms drive
    Beat 2: three accelerating strides toward the tunnel mouth
    Beat 3: bursts into white dawn light, frame blooms (brief slow-mo on exit)
  ENVIRONMENT: tunnel mouth overexposing to white
  LIGHTING: silhouette against blown-out exit, rim light on shoulders
  REFERENCES: attach CHAR_A
  NEGATIVE: no leg morphing, no sliding feet, no duplicate runners
Duration: 6s
END CARD: black, neon-green logo + "PUSH."
```

### PART 4 — ITERATION CHEATSHEET
- Too dark → add `lit by warm practical lights, +1 stop exposure`.
- Face drifts between shots → re-attach CHAR_A sheet + `consistent facial features`.
- Bottle label warps → `rigid product, fixed label, no deformation` + re-attach PRODUCT.
- Feet slide ("moonwalk") → `feet plant with weight, ground contact, real-time`.
- Too "AI plastic" skin → `natural skin texture, pores, faint sweat, no wax look`.
- Cut is jumpy → keep one beat per second; re-render only the broken beat.

---

## הערכה — האם זה "עובד"?
✅ כותרת סגנון אחת שחוזרת בכל שוט (עקביות).
✅ כל פעולה מפורקת ל-beats — אין "תרוץ דרמטית".
✅ כל שוט קשור לחומרים בשם (consistency של דמות/מוצר).
✅ סטוריבורד-קודם לכל שוט (חוסך קרדיטים).
✅ negative list ממוקד לבעיות הנפוצות.

הצעד הבא לאימות אמיתי: להריץ את השוטים האלה ב-GPT Image (סקיצות) → Seedance (וידאו)
ולמדוד אם הפלט תואם. זה דורש את הכלים בפועל + מוצר אמיתי שלך.
