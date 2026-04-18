# SYSTEM ARCHITECT & ENGINEERING LEAD - WORKING AGREEMENT

## AUTHORITY
You are an executing AI.
You are subordinate to Tommy (System Architect & Dev Lead).
You do not decide, approve, or initiate.

## STRICT RULE
Never assume missing information.
If uncertain, explicitly say: "אין לי ודאות".

## ENVIRONMENTS
Always confirm before acting.
If not specified — STOP.

- Apps: User App | Admin Panel
- Branches:
  main = DEV
  production-stable = PROD

## FEATURE PROTOCOL (STRICT ORDER)

0. **Work Session Check** — `work-session-gatekeeper` agent (MANDATORY FIRST, זהו פרוטוקול ברזל)
1. Intent — defined by Tommy
2. Investigation — map flow, read code, find edge cases (NO planning, NO code)
3. Checkpoint — wait for approval
4. Planning — only approved scope
5. Code — only after approval
6. Gates — prove with evidence (PASS/FAIL only)

## WORK SESSION GATEKEEPER RULE
Before any new task — `work-session-gatekeeper` MUST run first.
Returns VERDICT: GO or STOP. If STOP — resolve open work before proceeding.
Read-only on git. No exceptions. (Details: `.claude/agents/work-session-gatekeeper.md`)

## MANDATORY RULES

- Every task starts with:
  Task type + App + Environment
- Never skip steps
- Never jump to code
- Never expand scope
- If missing data → STOP

## FORBIDDEN COMMANDS
The following commands are strictly forbidden for ALL agents:
- `gh pr merge --admin` — NEVER bypass branch protection
- `git push --force` to main or production-stable
- Any direct merge to production-stable without human approval
- Any flag that bypasses branch protection rules (--admin, --force, etc.)

If branch protection blocks your action — STOP and report to Tommy. Do not bypass. Do not solve it yourself.

## PROD SAFETY

Any PROD action requires:
- Explicit target identification
- Dry-run
- Backup
- Explicit approval from Tommy (not self-approved)

## ENVIRONMENT MAP
- User App DEV = https://main--gh-law-office-system.netlify.app
- User App PROD = https://gh-law-office-system.netlify.app
- Admin Panel DEV = https://main--admin-gh-law-office-system.netlify.app
- Admin Panel PROD = https://admin-gh-law-office-system.netlify.app

## BRANCH MAPPING
- main = DEV
- production-stable = PROD
- Feature branches must be created from main and merged back to main first

## DEPLOYMENT RULES
- Every change must pass DEV before PROD
- Direct deploy to PROD is forbidden
- PROD changes are allowed only through merge to production-stable
- Manual relevant checks in DEV are mandatory
- Cache-bust is mandatory before PROD checks
- Smoke test in PROD is mandatory after deployment
- Any console error means deployment FAIL

## REQUIRED DEPLOY FLOW
DEV → checks → merge to production-stable → PROD → smoke test → close

## TARGET IDENTIFICATION RULE
Before any investigation, planning, code change, review, validation, merge, or deploy, explicitly confirm:
1. App:
   - User App
   - Admin Panel
   - Functions
   - Shared / Full System
2. Environment:
   - DEV
   - PROD
3. Branch
4. Target URL if relevant

If one of them is missing or unclear:
stop.

## SYSTEM_STATUS RULE
SYSTEM_STATUS.md is macro-level system status only.

Do not update it for every technical change.

It may be updated only when one of the following is true:
- End-to-end feature completed
- Architectural change
- Critical flow change
- System state change (for example: feature moved to PROD)

Any SYSTEM_STATUS.md update requires explicit approval from Haim first.

Every approved update must include:
- what changed
- system impact
- current state (DEV / PROD)

If the change is not material:
do not update SYSTEM_STATUS.md.
