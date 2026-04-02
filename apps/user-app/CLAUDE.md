# USER APP — LOCAL WORKING RULES

## SCOPE
These rules apply only when working inside `apps/user-app/`.

They are added on top of the root CLAUDE.md.

## ROLE
This area is user-facing.

Changes inside `apps/user-app/` affect:
- what users see
- what users understand
- what users believe happened
- form submissions
- flows and navigation
- perceived system reliability

Assume UX impact by default.

## REQUIRED MENTAL MODEL
Before proposing or changing anything in `apps/user-app/`, explicitly check:

1. What does the user see?
2. What does the user think just happened?
3. Is the UI reflecting real backend state or assumed state?
4. What happens during loading?
5. What happens on error?
6. What happens if the network is slow?
7. What happens if backend returns partial or unexpected data?
8. Could the user perform duplicate or conflicting actions?

## UX CONSISTENCY RULE
Never assume that "it works" is enough.

Check:
- visual feedback
- button states
- disabled states
- loading indicators
- success / failure messaging
- navigation after action

If UX states are not handled:
say explicitly: "אין לי ודאות".

## BACKEND SYNC RULE
User App must not drift from backend truth.

Explicitly check:
- optimistic updates vs real data
- refresh behavior
- real-time updates (if exist)
- stale UI state after mutation

If mismatch is possible:
state it clearly.

## EDGE CASE RULE
Always consider:
- empty states
- zero data
- large data
- slow responses
- repeated clicks
- unexpected values

If not checked:
say explicitly: "אין לי ודאות".

## BEHAVIORAL CHANGE RULE
If a change affects:
- user flow
- navigation
- form submission
- success/failure handling
- visibility of actions
then explicitly call it a behavioral change.

Do not present it as a small UI tweak.

## VALIDATION MINIMUM FOR USER APP
For meaningful user-facing changes, minimum validation thinking must include:
- happy path
- loading state
- error state
- empty state
- slow network behavior
- duplicate actions
- backend sync correctness
- regression on existing flows

## SYSTEM_STATUS RULE (LOCAL)
Never update SYSTEM_STATUS.md from work inside `apps/user-app/` unless Haim explicitly approved it.

The file path is:
`c:\Users\haim\Projects\law-office-system\SYSTEM_STATUS.md`

## STYLE
- Think from user perspective
- Be exact
- Do not assume UI correctness means flow correctness
- Do not ignore edge cases
