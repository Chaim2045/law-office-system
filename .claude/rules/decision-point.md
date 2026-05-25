# DECISION POINT RULE — when to consult an agent before asking Tommy

**Source:** referenced from `CLAUDE.md` via `@.claude/rules/decision-point.md`. Loaded every session.

## Core rule

**Before any `AskUserQuestion` that asks Tommy to choose between approaches / scopes / architecture / priorities — Claude MUST consult the relevant specialized sub-agent first** (from `.claude/agents/`).

The question presented to Tommy MUST include:

1. The investigating agent's name
2. The agent's verdict / finding (1-2 lines)
3. The agent's recommendation
4. Alternatives with trade-offs

## Triggers — consult agent

- Approach choice (A vs B vs C)
- Scope sizing (1 PR or N?)
- Prioritization (X first or Y?)
- Architectural trade-offs (sync vs async, monolith vs split, etc.)
- Behavioral changes (loosening / tightening / migration)
- Resource decisions (new dependency, new infra)

## Skip — no agent needed

- Trivial yes/no ("להמשיך?")
- Clarification of wording
- Tiny changes (<50 lines, no architectural impact)
- Status checks ("איפה אנחנו?")
- After-deploy smoke results

## Relevant agents (located in `.claude/agents/`)

`intent-refiner`, `devils-advocate`, `navigator`, `data-investigator`, `outcomes-grader`, `reviewer`, `security`, `performance`, `firebase-rules`, `refactoring`, `tester`, `backend`, `frontend`, `ci-cd`, `devops`, `explainer`, `effort-scaler` (PR-META-1), `completeness-checker` (PR-META-1), `evaluator-optimizer` (PR-META-1).

## Anti-pattern (FORBIDDEN)

```
AskUserQuestion("איזה approach? A או B?")  ← no agent consulted = blocked
```

## Correct pattern

```
[Step 1] Invoke devils-advocate / navigator / etc.
[Step 2] Receive verdict + recommendation + reasoning.
[Step 3] AskUserQuestion(
  question: "🤖 [agent-name]: [verdict]. ממליץ [option].

            [options with trade-offs]"
)
```

## Why this exists

Tommy's explicit demand (2026-05-20):
> "אני מחפש צוות שנעבוד תמיד יחד אבל שתמיד יהיה בפעולה ועבודה"

Decisions made by Claude alone are weaker than decisions backed by specialized agent analysis. Each agent is a perspective. Together = engineered work.

## Exemption

If Tommy says **"מהר"** / **"תחליט אתה"** / **"פשוט תעשה"** — skip agent consultation.
**Note the skip in your response** (auditable).
