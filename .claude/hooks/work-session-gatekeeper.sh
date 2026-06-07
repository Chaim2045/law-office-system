#!/bin/bash
# SessionStart hook — Work Session Gatekeeper (replaces former work-session-gatekeeper.md agent).
#
# Runs once per session start. Collects open-work signals and injects a
# brief summary into the Lead Agent's context as `additionalContext`.
#
# The Lead Agent then decides GO/STOP based on this summary + the user's
# stated intent. We do NOT block here — we inform.
#
# Replaces .claude/agents/work-session-gatekeeper.md (2026-05-26 consolidation).

set -uo pipefail

# Find repo root; if not in a git repo, exit silently
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$REPO_ROOT" || exit 0

# ── Gather state ──────────────────────────────────────────────
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

# Helper: count with all whitespace removed
count() { tr -d '[:space:]'; }

# Uncommitted / staged changes
UNCOMMITTED_COUNT=$(git status --short 2>/dev/null | wc -l | count)

# Stash entries
STASH_COUNT=$(git stash list 2>/dev/null | wc -l | count)

# Local branches not merged to main
UNMERGED_BRANCHES=$(git branch --no-merged main 2>/dev/null | grep -v -E '^\*?\s*(main|production-stable)$' | wc -l | count)

# Worktrees (beyond the main one)
WORKTREES=$(git worktree list 2>/dev/null | wc -l | count)
EXTRA_WORKTREES=$((WORKTREES > 1 ? WORKTREES - 1 : 0))

# Commits ahead of origin (guard against no-upstream errors with pipefail)
AHEAD=0
if git rev-parse --abbrev-ref '@{u}' >/dev/null 2>&1; then
  AHEAD=$(git rev-list --count '@{u}..HEAD' 2>/dev/null | count)
  [ -z "$AHEAD" ] && AHEAD=0
fi

# Open PRs (only if gh is available)
OPEN_PRS_COUNT=0
OPEN_PRS_SUMMARY=""
if command -v gh >/dev/null 2>&1; then
  OPEN_PRS_RAW=$(gh pr list --author @me --state open --json number,title,createdAt --limit 10 2>/dev/null || echo "[]")
  OPEN_PRS_COUNT=$(echo "$OPEN_PRS_RAW" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const a=JSON.parse(d);process.stdout.write(String(Array.isArray(a)?a.length:0))}catch(e){process.stdout.write("0")}})' 2>/dev/null || echo -n "0")
  [ -z "$OPEN_PRS_COUNT" ] && OPEN_PRS_COUNT=0
  if [ "$OPEN_PRS_COUNT" -gt 0 ] 2>/dev/null; then
    OPEN_PRS_SUMMARY=$(echo "$OPEN_PRS_RAW" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const a=JSON.parse(d);a.forEach(p=>console.log(`  - PR #${p.number}: ${p.title} (opened ${p.createdAt.slice(0,10)})`))}catch(e){}})' 2>/dev/null)
  fi
fi

# Deploy drift (main ahead of production-stable)
DEPLOY_DRIFT=0
if git rev-parse --verify origin/production-stable >/dev/null 2>&1 && git rev-parse --verify origin/main >/dev/null 2>&1; then
  DEPLOY_DRIFT=$(git log origin/production-stable..origin/main --oneline 2>/dev/null | wc -l | count)
  [ -z "$DEPLOY_DRIFT" ] && DEPLOY_DRIFT=0
fi

# PROD deploy HEALTH (not just commit drift). The gap that hid the 2026-06-04
# incident: the ci-cd-production `deploy-production` job was RED on every merge
# to main for 6 days (two stacked blockers — a 1st->2nd-Gen function conflict
# + an unset secret), freezing ~6 days of Cloud Functions + firestore.rules out
# of PROD, while commit-drift looked normal and no session noticed. We surface
# the latest ci-cd-production run conclusion so the next session is ALERTED.
# NOTE: a MANUAL `firebase deploy` is out-of-band and won't register as a run,
# so a stale failed run can over-alert until the next code push to main — that
# is intentional (over-alert > under-alert on PROD deploy health; the Lead Agent
# verifies the actual state before acting).
DEPLOY_RUN_FAILED=0
if command -v gh >/dev/null 2>&1; then
  DEPLOY_RUN_CONCLUSION=$(gh run list --workflow=ci-cd-production.yml --branch main --limit 1 --json conclusion 2>/dev/null \
    | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const a=JSON.parse(d);process.stdout.write(String((a[0]&&a[0].conclusion)||""))}catch(e){process.stdout.write("")}})' 2>/dev/null || echo -n "")
  [ "$DEPLOY_RUN_CONCLUSION" = "failure" ] && DEPLOY_RUN_FAILED=1
fi

# ── Build summary ──────────────────────────────────────────────
SUMMARY=""

if [ "$UNCOMMITTED_COUNT" = "0" ] && [ "$STASH_COUNT" = "0" ] && [ "$UNMERGED_BRANCHES" = "0" ] && [ "$EXTRA_WORKTREES" = "0" ] && [ "$AHEAD" = "0" ] && [ "$OPEN_PRS_COUNT" = "0" ] && [ "$DEPLOY_DRIFT" = "0" ] && [ "$DEPLOY_RUN_FAILED" = "0" ]; then
  SUMMARY="🔒 Work Session Gatekeeper — clean state. Branch: $BRANCH. No open work detected. Safe to start new task."
else
  SUMMARY="🔒 Work Session Gatekeeper — OPEN WORK DETECTED"
  SUMMARY="$SUMMARY"$'\n'"Branch: $BRANCH"
  [ "$UNCOMMITTED_COUNT" != "0" ] && SUMMARY="$SUMMARY"$'\n'"- Uncommitted changes: $UNCOMMITTED_COUNT files"
  [ "$STASH_COUNT" != "0" ] && SUMMARY="$SUMMARY"$'\n'"- Stashed work: $STASH_COUNT entries"
  [ "$UNMERGED_BRANCHES" != "0" ] && SUMMARY="$SUMMARY"$'\n'"- Local branches not merged to main: $UNMERGED_BRANCHES"
  [ "$EXTRA_WORKTREES" != "0" ] && SUMMARY="$SUMMARY"$'\n'"- Active worktrees beyond main: $EXTRA_WORKTREES"
  [ "$AHEAD" != "0" ] && SUMMARY="$SUMMARY"$'\n'"- Commits ahead of origin: $AHEAD"
  [ "$OPEN_PRS_COUNT" != "0" ] && SUMMARY="$SUMMARY"$'\n'"- Open PRs: $OPEN_PRS_COUNT"$'\n'"$OPEN_PRS_SUMMARY"
  [ "$DEPLOY_DRIFT" != "0" ] && SUMMARY="$SUMMARY"$'\n'"- Deploy drift (commits on main not in production-stable): $DEPLOY_DRIFT"
  [ "$DEPLOY_RUN_FAILED" = "1" ] && SUMMARY="$SUMMARY"$'\n'"- 🔴 LAST PROD PIPELINE RUN FAILED (ci-cd-production on main) — a Cloud Functions / firestore.rules deploy may be FROZEN in PROD. Investigate with \`gh run list --workflow=ci-cd-production.yml --branch main\` + the failed job's log BEFORE merging more code (this is the 2026-06-04 incident class)."
  SUMMARY="$SUMMARY"$'\n'$'\n'"⚠️ Lead Agent: before starting a new task, assess whether this open work overlaps with the new request. If yes — recommend continuing existing work instead. If no — flag the open work and ask Haim how to proceed."
fi

# ── Emit as additionalContext ──────────────────────────────────
# Use Node to safely serialize the JSON (handles embedded newlines/quotes)
node -e '
const summary = process.argv[1] || "";
const output = {
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: summary
  }
};
process.stdout.write(JSON.stringify(output));
' "$SUMMARY"

exit 0
