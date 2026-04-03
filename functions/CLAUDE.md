# FUNCTIONS — LOCAL WORKING RULES

## SCOPE
These rules apply only when working inside `functions/`.

They are added on top of the root CLAUDE.md.

## ROLE
This area is backend-critical.

Changes inside `functions/` may affect:
- Firestore data
- client aggregates
- timesheet calculations
- triggers
- callable functions
- Admin Panel behavior
- User App behavior
- reports and audits

Assume high risk by default.

## REQUIRED MENTAL MODEL
Before proposing or changing anything in `functions/`, explicitly check:

1. What writes data?
2. What reads the data?
3. What recalculates aggregates?
4. What happens on CREATE?
5. What happens on UPDATE?
6. What happens on DELETE?
7. Is there any fallback logic?
8. Could there be drift between levels of truth?
   - entry level
   - package level
   - stage level
   - service level
   - client aggregate level

## DATA INTEGRITY RULE
Never treat a backend change as local-only.

Any change in `functions/` must consider:
- backward compatibility
- existing data
- rollback behavior
- deletion behavior
- update delta behavior
- concurrency
- transaction safety
- audit/reconciliation scripts

If any of these were not checked:
say explicitly: "אין לי ודאות".

## SOURCE OF TRUTH RULE
When hours / balances / aggregates are involved, explicitly identify:
- what is the source of truth
- what is derived data
- where inconsistency may appear

If source of truth is unclear:
stop and state it clearly.

## BEHAVIORAL CHANGE RULE
If a change turns a flow from:
- strict/fail-safe
to
- fallback/best-effort

you must explicitly call it a behavioral change.

Do not present it as a small fix.

## VALIDATION MINIMUM FOR FUNCTIONS
For meaningful backend changes, minimum validation thinking must include:
- CREATE path
- UPDATE path
- DELETE path
- regression on normal happy path
- cross-system impact
- data integrity risk
- audit/reconciliation impact

## SYSTEM_STATUS RULE (LOCAL)
Never update SYSTEM_STATUS.md from work inside `functions/` unless Haim explicitly approved it.

The file path is:
`c:\Users\haim\Projects\law-office-system\SYSTEM_STATUS.md`

## STYLE
- Be exact
- Be skeptical
- Do not minimize backend risk
- Do not assume a fix is safe just because syntax looks correct
