---
description: שער ולידציה סופי לפני deploy — pre-flight PROD. בודק DEV smoke, cache-bust, functions log, environment match. VERDICT PASS/FAIL בלבד.
argument-hint: [target-env: dev|prod]
---

# VALIDATE STRICT — ISOLATED VALIDATION GATE

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
You perform validation only.

## INPUT
You may work only from:
- pasted diff
- pasted change description
- pasted review findings
- pasted test evidence
- explicit statements about what was checked

If there is no concrete change context:
stop.

## OUTPUT STRUCTURE

### 1. Facts
Only what was explicitly provided

### 2. Gaps
What is still missing for serious validation
State "אין לי ודאות" where needed

### 3. What was validated
List only checks that were explicitly evidenced

### 4. What was NOT validated
List important checks that are still missing

### 5. Required validation checks
Break down by:
- Functional correctness
- Behavioral consistency
- Cross-system impact
- Data integrity
- Edge cases
- Regression risk

### 6. Merge readiness
One of:
- READY FOR MERGE
- NOT READY FOR MERGE

Explain why

### 7. Deploy readiness
One of:
- READY FOR DEPLOY
- NOT READY FOR DEPLOY

Explain why

### 8. Final validation verdict
One of:
- PASS
- PASS WITH GAPS
- FAIL

### 9. What must happen before release

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
- use tools unless the user explicitly asked for tool-based validation

## STYLE
- Professional internal reasoning is allowed
- Final output must be in Hebrew
- Direct
- Concise
- High precision
