#!/bin/bash
# PR-META-2: agent usage logging hook.
#
# Fires on SubagentStart event. Appends one JSON line per agent invocation
# to `.claude/logs/agent-usage.jsonl` for later analysis.
#
# Purpose: measure actual usage of the 20-agent pool before consolidation
# decisions (PR-META-3). Identifies dormant agents + overlap patterns.
#
# Log format (jsonl, one line per call):
#   {"ts":"2026-05-24T20:30:45Z","agent":"navigator","desc":"find TZ bug sites"}
#
# Log file is NOT committed (see .claude/logs/.gitignore). Local only.

set -uo pipefail

# Read hook input from stdin
INPUT_FILE="$(mktemp 2>/dev/null || echo /tmp/agent-log-$$.json)"
cat > "$INPUT_FILE"

# Use Node to parse + write log entry
node - "$INPUT_FILE" <<'NODESCRIPT'
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const inputFile = process.argv[2];
let hookInput;
try {
  hookInput = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
} catch (e) {
  process.exit(0);
}

// Find repo root for log file location
let repoRoot;
try {
  repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
} catch (e) {
  process.exit(0);
}

const logDir = path.join(repoRoot, '.claude', 'logs');
const logFile = path.join(logDir, 'agent-usage.jsonl');

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Extract agent name + description from SubagentStart payload
// Schema varies; defensively dig through common fields.
const agentName = hookInput.subagent_type ||
                  hookInput.agent_type ||
                  hookInput.subagent_name ||
                  (hookInput.tool_input && hookInput.tool_input.subagent_type) ||
                  'unknown';

const desc = (hookInput.tool_input && hookInput.tool_input.description) ||
             hookInput.description ||
             '';

const entry = {
  ts: new Date().toISOString(),
  agent: agentName,
  desc: desc.slice(0, 120) // cap description length
};

try {
  fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
} catch (e) {
  // Silent — logging failure should never block the agent
}

process.exit(0);
NODESCRIPT

rm -f "$INPUT_FILE"
exit 0
