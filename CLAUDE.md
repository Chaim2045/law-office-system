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
1a. **Effort Scaling** — `effort-scaler` agent (לפני dispatch של >3 agents — חובה)
2. Investigation — map flow, read code, find edge cases (NO planning, NO code)
2a. **Completeness Check** — `completeness-checker` agent (אחרי investigation, לפני checkpoint — חובה)
3. Checkpoint — wait for approval
4. Planning — only approved scope
5. Code — only after approval
6. Gates — prove with evidence (PASS/FAIL only)
6a. **Evaluator-Optimizer** — אם outcomes-grader = FAIL, `evaluator-optimizer` יבצע עד 3 retries לפני escalate

## WORK SESSION GATEKEEPER RULE
Before any new task — `work-session-gatekeeper` MUST run first.
Returns VERDICT: GO or STOP. If STOP — resolve open work before proceeding.
Read-only on git. No exceptions. (Details: `.claude/agents/work-session-gatekeeper.md`)

## OUTCOMES GRADER RULE
Before opening any PR — `outcomes-grader` MUST evaluate work against rubric `.claude/rubrics/<scope>.md`.
Returns VERDICT: PASS / FAIL / PASS_WITH_WARNINGS. FAIL blocks PR open.
Read-only. Separate context. No exceptions. (Details: `.claude/docs/OUTCOMES-GRADER-USAGE.md`)

## EFFORT SCALING RULE (PR-META-1)
לפני dispatching >3 sub-agents במקביל — `effort-scaler` חובה (model: haiku, מהיר).
מחזיר LIGHT (1-3) / MEDIUM (4-7) / HEAVY (8-15) + רשימת agents מומלצים.
מטרה: לא לבזבז טוקנים על task פשוט, לא לחתוך בעבודה גדולה.
מבוסס על [Anthropic Multi-Agent Research System](https://www.anthropic.com/engineering/multi-agent-research-system) — sweet spot 3-5 agents במקביל.
(Details: `.claude/agents/effort-scaler.md`)

## COMPLETENESS CHECK RULE (PR-META-1)
אחרי investigation, **לפני checkpoint** — `completeness-checker` חובה.
סורק loose ends: adjacent bugs, untracked files, drift, backlog correlation, stale comments.
מחזיר רשימה ממוינת severity (🔴/🟡/🟢) + recommendation per item.
מבוסס על Anthropic "synthesis step" pattern.
ה-findings חייבים להופיע ב-AskUserQuestion של ה-checkpoint.
(Details: `.claude/agents/completeness-checker.md`)

## EVALUATOR-OPTIMIZER RULE (PR-META-1)
אם `outcomes-grader` = FAIL → `evaluator-optimizer` מנסה לתקן אוטומטית, עד 3 retries.
אם אחרי 3 עוד FAIL → escalate ל-Tommy עם:
- ניסיונות + reasoning
- root cause hypothesis
- suggested manual fix
**אסור** לעקוף assertion / לskip test כדי שgrader יעבור.
מבוסס על [Anthropic Evaluator-Optimizer pattern](https://www.anthropic.com/engineering/building-effective-agents).
(Details: `.claude/agents/evaluator-optimizer.md`)

## PR-CREATE HOOK RULE (PR-META-1)
`.claude/hooks/require-outcomes-pass.sh` חוסם `gh pr create` אם:
- אין rubric file ב-`.claude/rubrics/`
- אין VERDICT ב-PR body
- VERDICT != PASS / PASS_WITH_WARNINGS
Hook severity = **deny**. **אסור לעקוף.**
אם hook חוסם → לתקן את הגrader artifact, לא לבטל hook.

## DECISION POINT RULE (חובה)
**Before any AskUserQuestion that asks Tommy to choose between approaches/scopes/architecture/priorities — Claude MUST consult the relevant specialized sub-agent first** (from `.claude/agents/`). The question presented to Tommy must include:

1. The investigating agent's name
2. The agent's verdict / finding (1-2 lines)
3. The agent's recommendation
4. Alternatives with trade-offs

**Trigger:** approach choice (A/B/C), scope sizing (1 PR or N?), prioritization (X first or Y?), architectural trade-offs, behavioral changes, resource decisions (new dep, infra).

**Skip:** trivial yes/no ("להמשיך?"), clarification of wording, tiny changes (<50 lines, no architectural impact), status checks ("איפה אנחנו?"), after-deploy smoke results.

**Relevant agents** (`.claude/agents/`): `intent-refiner`, `devils-advocate`, `navigator`, `data-investigator`, `outcomes-grader`, `reviewer`, `security`, `performance`, `firebase-rules`, `refactoring`, `tester`, `backend`, `frontend`, `ci-cd`, `devops`, `explainer`, `effort-scaler` (PR-META-1), `completeness-checker` (PR-META-1), `evaluator-optimizer` (PR-META-1).

**Anti-pattern (forbidden):**
```
AskUserQuestion("איזה approach? A או B?")  # ← no agent consulted = blocked
```

**Correct pattern:**
```
[Invoke devils-advocate / navigator / etc.]
[Receive verdict + recommendation + reasoning]
AskUserQuestion(
  question: "🤖 [agent-name]: [verdict]. ממליץ [option].
            
            [options with trade-offs]"
)
```

**Why:** Tommy's explicit demand 2026-05-20 — "אני מחפש צוות שנעבוד תמיד יחד אבל שתמיד יהיה בפעולה ועבודה". Decisions made by Claude alone are weaker than decisions backed by specialized agent analysis. Each agent is a perspective. Together = engineered work.

**Exemption:** if Tommy says "מהר" / "תחליט אתה" / "פשוט תעשה" — skip agent consultation. Note the skip in response (auditable).

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

## WHAT IS "PROD"?
"PROD" = the deployed app (Netlify/Firebase), NOT the production-stable branch.
The branch contains everything (tooling, docs, code) — but only built app
artifacts reach production. Therefore, merges to production-stable update
the branch for consistency, not to "release" tooling.

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
