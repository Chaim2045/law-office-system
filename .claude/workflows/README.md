# Workflows Library — `.claude/workflows/`

**Status:** introduced 2026-05-30 via PR-META-9. Dependent on Anthropic Claude Code Dynamic Workflows feature (research preview as of release).

**What lives here:** reusable JavaScript workflow scripts that the Lead Agent can invoke via the `Workflow` tool to coordinate multiple sub-agents on a single task with built-in adversarial verification.

---

## When to use a workflow vs a direct agent invocation

This is the decision tree the Lead Agent should follow:

### Use a DIRECT agent invocation (`Agent({...})`) when:

- The task fits ONE specialist's perspective (e.g., "review this Firestore rule" → `security-access-expert` alone)
- The task is small (single file, single function, ≤ 50 lines of analysis)
- You need a single answer fast (status check, quick question)
- The cost of running a workflow (~500K–1M tokens) is disproportionate to the task

### Use a WORKFLOW (`Workflow({name: 'fact-check', args})`) when:

- The task needs MULTIPLE perspectives running in parallel (e.g., 5 dimensions reviewing the same PR)
- The task involves N independent items processed identically (e.g., verify 7 claims, audit 10 files, classify 61 callsites)
- The answer requires adversarial verification (one agent finds, another tries to refute) — workflows have this built-in via the `Refute` phase pattern
- The task involves search → fetch → synthesize across many sources
- Cost is justified by the depth of the answer needed (high-stakes decision, deep audit, fact-check before customer-facing claim)

### Default to DIRECT for trivial tasks. Default to WORKFLOW for tasks where you'd otherwise spawn 3+ parallel agents anyway.

---

## Available workflows

### 1. `fact-check.js`

**Use case:** Verify N factual claims against primary sources with adversarial refutation. Pattern: search → verify → refute → synthesize.

**Invoke:**
```js
Workflow({
  name: 'fact-check',
  args: {
    claims: [
      { id: 'claim-1', text: 'Anthropic released Opus 4.8', searchQueries: ['Claude Opus 4.8 release'] },
      // ...
    ],
    primaryDomains: ['anthropic.com', 'docs.anthropic.com', 'claude.com'],
    reportLanguage: 'he' // or 'en'
  }
})
```

**Cost:** ~3 sub-agents per claim (search + verify + refute) + 1 synthesis. For 7 claims = ~22 sub-agents, ~1M tokens, ~5–10 minutes wall-clock.

**Example use:** verify a vendor's claims about a new feature; verify a third-party blog post about Anthropic; verify a customer's allegation against your system.

---

### 2. `source-verify.js`

**Use case:** Verify that quotes in a document actually appear verbatim in their cited sources. Catches fabricated quotes, misattributed paraphrases, wrong URLs.

**Invoke:**
```js
Workflow({
  name: 'source-verify',
  args: {
    documentPath: '/absolute/path/to/document.md',
    reportLanguage: 'he',
    maxCitations: 50,                        // optional, default 50 — hard cap
    allowedSchemes: ['https:', 'http:']      // optional, default ['https:', 'http:']
  }
})
```

**Safety gates (enforced in plain JS, not by an agent):**
- Citations with disallowed URL scheme (e.g., `file://`, relative paths) are SKIPPED
- Duplicate URLs are SKIPPED (de-duplication via `Set` of visited URLs)
- Citations beyond `maxCitations` are SKIPPED
- Skipped citations are reported in the final output so you can see what was dropped and why

**Cost:** ~3 sub-agents per citation (match + adversarial) + 1 extraction + 1 synthesis. For a document with 4 citations = ~14 sub-agents.

**Example use:** before merging a doc with external citations (e.g., MASTER_PLAN.md anchors to Anthropic publications). Run this and confirm zero `FABRICATED` / `PARAPHRASE_PRESENTED_AS_QUOTE` findings before merge.

**Why it exists:** during PR-META-8, the initial draft presented paraphrases as verbatim quotes (`*"..."*` format). Devil's-advocate caught it. Running `source-verify` proactively would have caught it without devil's-advocate needing to fire.

---

### 3. `deep-audit.js`

**Use case:** Multi-lens review of a PR or module. Five dimensions reviewed in parallel (correctness, security, performance, UX, business-logic), every finding adversarially verified, false-positives filtered, severity-ranked report.

**Invoke:**
```js
// Review a PR
Workflow({
  name: 'deep-audit',
  args: {
    target: { type: 'pr', prNumber: 339 },
    focusDimensions: ['correctness', 'security', 'business'], // optional subset
    contextHints: 'This PR adds new admin-claim write endpoints',
    reportLanguage: 'he'
  }
})

// Review a module
Workflow({
  name: 'deep-audit',
  args: {
    target: { type: 'module', modulePath: '/absolute/path/to/apps/admin-panel/js/core' },
    reportLanguage: 'he'
  }
})
```

**Cost:** ~5 review agents (one per dimension) + ~1 verification per finding (typically 10–30 findings) + synthesis. For a typical PR = ~30 sub-agents, ~1M tokens.

**When to use:** Phase 1 PRs C-G; schema changes; security rule changes; data migrations; refactors >100 lines; any PR you'd normally invoke `devils-advocate` on (deep-audit subsumes it for code review use).

---

## Cost guidance

Workflows are expensive. Use them when depth is worth it.

| Workflow | Typical sub-agents | Typical tokens | Wall-clock |
|---|---|---|---|
| `fact-check` (7 claims) | ~22 | ~1M | 5–10 min |
| `source-verify` (5 citations) | ~14 | ~500K | 3–5 min |
| `deep-audit` (PR with 20 findings) | ~30 | ~1M+ | 8–15 min |

**Rule of thumb:** don't invoke a workflow for tasks that a single direct agent could answer in under 60 seconds.

---

## Research preview dependency — IMPORTANT

Workflows depend on the Anthropic `Workflow` tool, which is **research preview** as of 2026-05-30. This means:

- **The API may change** without notice. If it does, the scripts in this directory may break.
- **Workflows require Claude Code v2.1.154+** and a paid plan (Pro/Max/Team/Enterprise).
- **Free-tier users** will not have access to the `Workflow` tool.

**Fallback:** if the `Workflow` tool stops working or is unavailable, the Lead Agent can manually orchestrate the same patterns by:
1. Reading the workflow script to understand the phases
2. Spawning the equivalent sub-agents directly via `Agent({...})` in sequence/parallel
3. Doing the synthesis step manually

The workflow scripts are **JavaScript** — they're readable as documentation of the pattern even if not executable.

---

## How to add a new workflow

1. Create `.claude/workflows/<name>.js` following the structure of the existing 3 (meta block + phases + return)
2. Add a section to this README
3. Add to the rubric of the PR that introduces it
4. Run `devils-advocate` on the workflow design before opening the PR

---

## Workflows do NOT replace the 12-agent team

Workflows are **patterns for using the 12-agent team**. They are not new team members. The 12 sub-agents (defined in `.claude/agents/`) remain the authoritative team — workflows compose them in pre-defined orchestration scripts.

### When a workflow may use Anthropic's `general-purpose`

`fact-check.js` and `source-verify.js` use `general-purpose` for tasks no project specialist covers (open-ended research, web search, multi-source synthesis, fact verification). This is intentional and allowed — the 12 custom agents are scoped to specific project domains; research tasks are orthogonal.

### When `general-purpose` is FORBIDDEN

`deep-audit.js` must NEVER use `general-purpose`. Every code-review dimension maps to a project specialist (correctness → `testing-quality-expert`; security → `security-access-expert`; performance + business → `backend-firebase-expert`; ux → `frontend-ui-expert`). Reason: traceability. When a deep-audit finds a bug, the chain of accountability must point to a named specialist, not an anonymous default.

### If a workflow needs a capability not covered by anyone

Either (a) extend an existing agent's prompt, or (b) bring the gap to Haim for a team-composition discussion — NOT silently add a one-off agent role to a workflow.

---

## See also

- `@.claude/rules/agent-rules.md` — the canonical team definition (which agents exist, when each is mandatory)
- `@.claude/rules/feature-protocol.md` — when workflows fit into the broader feature-execution flow
- `@docs/MASTER_PLAN.md` §2.0.1 — the bar's 5-source definition (workflows must not violate the bar)
- `@docs/MASTER_PLAN.md` §15 — Bar Revisions Log (changes to workflow defaults are not bar revisions; changes to "what workflow is mandatory for X" ARE bar revisions)
