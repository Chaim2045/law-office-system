# DECISION POINT RULE — when to consult an agent before asking Haim

**Source:** referenced from `CLAUDE.md` via `@.claude/rules/decision-point.md`. Loaded every session.

## Core rule

**Before any `AskUserQuestion` that asks Haim to choose between approaches / scopes / architecture / priorities — the Lead Agent MUST consult the relevant specialized sub-agent first** (from `.claude/agents/`).

The question presented to Haim MUST include:

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

`backend-firebase-expert`, `frontend-ui-expert`, `data-investigator`, `security-access-expert`, `outcomes-grader`, `testing-quality-expert`, `devils-advocate`, `effort-scaler`, `completeness-checker`, `evaluator-optimizer`, `ops`.

## Anti-pattern (FORBIDDEN)

```
AskUserQuestion("איזה approach? A או B?")  ← no agent consulted = blocked
```

## Correct pattern

```
[Step 1] Lead Agent invokes devils-advocate / backend / etc.
[Step 2] Receive verdict + recommendation + reasoning.
[Step 3] Lead Agent calls AskUserQuestion(
  question: "🤖 [agent-name]: [verdict]. ממליץ [option].

            [options with trade-offs]"
)
```

## Why this exists

Haim's explicit demand (2026-05-20):
> "אני מחפש צוות שנעבוד תמיד יחד אבל שתמיד יהיה בפעולה ועבודה"

Decisions made by the Lead Agent alone are weaker than decisions backed by specialized agent analysis. Each agent is a perspective. Together = engineered work.

## Exemption

If Haim says **"מהר"** / **"תחליט אתה"** / **"פשוט תעשה"** — skip agent consultation.
**Note the skip in your response** (auditable).
