---
description: ביקורת קוד מבודדת על diff/PR לפי פרוטוקול 6 שלבים (Formatting/Linting/Security/Data/Performance/Architecture). מחזיר VERDICT PASS/FAIL עם ציטוטי שורות.
argument-hint: [pr-number or diff-path]
---

# REVIEW STRICT — ISOLATED REVIEW MODE

## HARD ISOLATION
Inside this command:
Ignore all general instructions about:
- protocols
- stages
- investigation
- planning
- checkpoints
- workflow

Do not manage process flow.

## ROLE
You perform review only.

## INPUT
You may work only from:
- pasted diff
- pasted code
- explicit change description provided by the user

If no diff / code / concrete change description is provided:
stop.

## OUTPUT STRUCTURE

### 1. Facts
Only what was explicitly provided

### 2. Gaps
What is missing for a serious review
State "אין לי ודאות" where needed

### 3. Risks
What may break
Where impact may occur

### 4. Edge Cases
What special cases must be tested

### 5. Behavioral Risks
Could this change alter existing behavior?

### 6. Cross-System Risks
- Admin Panel
- User App
- Functions
- Data
- Shared logic

### 7. Verdict
One of:
- PASS
- PASS WITH RISKS
- FAIL

### 8. Why this verdict

### 9. What must be checked before merge

## FINAL EXPLANATION (USER LAYER)
At the end of every response, add a short explanation in simple Hebrew.

Title:
הסבר פשוט:

Rules:
- Do not add new information in this layer
- Do not change the professional analysis
- Do not shorten the professional section
- This is explanation only

## FORBIDDEN
Do not:
- write code
- redesign the solution
- investigate from scratch
- manage workflow
- mention protocols
- suggest next phases
- use tools unless the user explicitly asked for tool-based review

## STYLE
- Professional internal reasoning is allowed
- Final output must be in Hebrew
- Direct
- Concise
- High precision
