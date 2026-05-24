#!/bin/bash
# PR-META-2: agent usage report.
#
# Reads `.claude/logs/agent-usage.jsonl` and prints:
#   - Count per agent (sorted descending)
#   - Time range covered
#   - Dormant agents (defined but never called)
#
# Usage:
#   bash .claude/scripts/agent-usage-report.sh
#
# Run weekly per CLAUDE.md "AGENT USAGE REVIEW RULE".

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
LOG_FILE="$REPO_ROOT/.claude/logs/agent-usage.jsonl"
AGENTS_DIR="$REPO_ROOT/.claude/agents"

if [ ! -f "$LOG_FILE" ]; then
  echo "No usage log yet at $LOG_FILE"
  echo "Hook will create it on first agent invocation in a new session."
  exit 0
fi

if [ ! -s "$LOG_FILE" ]; then
  echo "Log file empty at $LOG_FILE"
  exit 0
fi

echo "========================================"
echo "  Agent Usage Report"
echo "========================================"
echo ""

# Count lines
TOTAL="$(wc -l < "$LOG_FILE" | tr -d ' ')"
echo "Total agent invocations: $TOTAL"

# Time range
FIRST="$(head -1 "$LOG_FILE" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).ts)")"
LAST="$(tail -1 "$LOG_FILE" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).ts)")"
echo "From: $FIRST"
echo "To:   $LAST"
echo ""

echo "----------------------------------------"
echo "  Invocations per agent (desc)"
echo "----------------------------------------"

# Extract agent names + count
node <<NODESCRIPT
const fs = require('fs');
const lines = fs.readFileSync('$LOG_FILE', 'utf8').trim().split('\n');
const counts = {};
for (const line of lines) {
  try {
    const e = JSON.parse(line);
    counts[e.agent] = (counts[e.agent] || 0) + 1;
  } catch (_e) { /* skip bad lines */ }
}
const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
for (const [name, count] of sorted) {
  console.log(\`  \${name.padEnd(35)} \${count}\`);
}
NODESCRIPT

echo ""
echo "----------------------------------------"
echo "  Dormant agents (defined but never called)"
echo "----------------------------------------"

# List agent files vs used names
node <<NODESCRIPT
const fs = require('fs');
const path = require('path');
const lines = fs.readFileSync('$LOG_FILE', 'utf8').trim().split('\n');
const used = new Set();
for (const line of lines) {
  try {
    const e = JSON.parse(line);
    used.add(e.agent);
  } catch (_e) {}
}
const agentFiles = fs.readdirSync('$AGENTS_DIR').filter(f => f.endsWith('.md'));
const defined = agentFiles.map(f => f.replace(/\.md$/, ''));
const dormant = defined.filter(a => !used.has(a));
if (dormant.length === 0) {
  console.log('  (none — all agents used at least once)');
} else {
  for (const a of dormant) {
    console.log(\`  \${a}\`);
  }
}
NODESCRIPT

echo ""
echo "========================================"
echo "  Recommendation"
echo "========================================"
echo ""
echo "If an agent has 0 invocations after 1+ week of normal use → candidate for removal."
echo "If 2 agents always co-occur (correlated 80%+) → candidate for merge."
echo "See CLAUDE.md AGENT USAGE REVIEW RULE for full process."
