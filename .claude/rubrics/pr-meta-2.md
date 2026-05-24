# Rubric — PR-META-2: agent usage logging + weekly review

**Scope:** infrastructure-only. Add `SubagentStart` hook that logs every agent invocation to a local jsonl file. Add report script. Add CLAUDE.md weekly-review rule. Enable data-driven consolidation decisions after 1 week (planned PR-META-3).

**Origin:** Tommy 2026-05-24 — after PR-META-1 we have 20 agents vs Anthropic's 3 baseline. Need to MEASURE which are dormant before deciding what to remove.

## MUST (7) — blocking

1. **`SubagentStart` hook registered in settings.json.** *Evidence:* `.claude/settings.json` `hooks.SubagentStart[]` block with command pointing to `log-agent-usage.sh`.

2. **Hook script exists + executable + writes jsonl.** *Evidence:* `ls -la .claude/hooks/log-agent-usage.sh` shows execute bit + script creates `.claude/logs/agent-usage.jsonl` on first invocation.

3. **Log entry format = `{ts, agent, desc}` jsonl.** Each line independently parseable. *Evidence:* script writes `JSON.stringify(entry) + '\n'`.

4. **Log file gitignored.** *Evidence:* `.claude/logs/.gitignore` with `*.jsonl` + `*.log`. `git status` shows logs not tracked.

5. **Report script exists + executable.** *Evidence:* `ls -la .claude/scripts/agent-usage-report.sh` shows execute bit.

6. **Report shows: total count, time range, per-agent count desc, dormant agents.** *Evidence:* script body has 4 sections matching.

7. **CLAUDE.md AGENT USAGE REVIEW RULE added.** Documents weekly schedule + consolidation triggers (dormant agents → PR-META-3). *Evidence:* grep CLAUDE.md for "AGENT USAGE REVIEW".

## SHOULD (3) — non-blocking

1. **Hook is `async: true`.** Logging failure must NEVER block agent execution. *Evidence:* settings.json hook entry has `"async": true`.

2. **Hook degrades silently on error.** No console spam, no orchestrator interruption. *Evidence:* script has try/catch around `appendFileSync`.

3. **Report script gives consolidation recommendation.** Includes "If agent has 0 invocations after 1+ week → candidate for removal" guidance. *Evidence:* script footer prints recommendation.

## Out of scope

- PR-META-3 (consolidation itself) — needs 1+ week of data first
- Cross-session analytics dashboard — overkill for now
- Auto-removal of dormant agents — manual decision after Tommy reviews

## Test outputs required

- Manual: register hook → trigger sub-agent → verify line written to `.claude/logs/agent-usage.jsonl`
- Manual: run `bash .claude/scripts/agent-usage-report.sh` → verify counts + dormant detection
- No code/test changes — infrastructure-only PR
- Hook `async: true` confirmed in settings.json
