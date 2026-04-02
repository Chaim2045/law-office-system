# ADMIN PANEL — LOCAL WORKING RULES

## SCOPE
These rules apply only when working inside `apps/admin-panel/`.

They are added on top of the root CLAUDE.md.

## ROLE
This area is admin-critical.

Changes inside `apps/admin-panel/` may affect:
- management visibility
- workload screens
- approvals
- task states
- dashboards
- counts and filters
- business decisions based on displayed data
- operational trust in the system

Assume that wrong display can create wrong decisions.

## REQUIRED MENTAL MODEL
Before proposing or changing anything in `apps/admin-panel/`, explicitly check:

1. What data is shown?
2. Where does the data come from?
3. Is it raw data or derived/aggregated data?
4. What filters affect it?
5. What permissions affect it?
6. What states affect visibility?
7. Could the UI show stale or partial data?
8. Could the Admin Panel disagree with backend truth?

## ADMIN SAFETY RULE
Never treat an Admin Panel change as visual-only by default.

Any meaningful change here must consider:
- filtering logic
- sorting logic
- counts
- approval status
- hidden vs visible state
- stale state
- mismatch between UI and Firestore
- mismatch between Admin Panel and User App

If any of these were not checked:
say explicitly: "אין לי ודאות".

## AGGREGATE / DISPLAY RULE
When totals, balances, statuses, workload, or counts are displayed:
explicitly identify:
- what is source data
- what is derived display
- where mismatch may appear
- whether the screen is operationally trusted by staff

If this is unclear:
stop and state it clearly.

## BEHAVIORAL CHANGE RULE
If a change affects:
- what staff sees
- what staff can approve
- what appears as complete / pending / cancelled / blocked
- workload distribution
then explicitly call it a behavioral change.

Do not present it as a small UI tweak.

## VALIDATION MINIMUM FOR ADMIN PANEL
For meaningful admin changes, minimum validation thinking must include:
- happy path
- filtering and sorting behavior
- empty state
- loading state
- stale state / real-time update behavior
- permissions / visibility behavior
- cross-check against backend truth
- regression on existing admin workflows

## SYSTEM_STATUS RULE (LOCAL)
Never update SYSTEM_STATUS.md from work inside `apps/admin-panel/` unless Haim explicitly approved it.

The file path is:
`c:\Users\haim\Projects\law-office-system\SYSTEM_STATUS.md`

## STYLE
- Be exact
- Be skeptical of displayed truth
- Do not minimize operational risk
- Do not assume UI correctness means system correctness
