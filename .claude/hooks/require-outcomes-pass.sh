#!/bin/bash
# PR-META-1 + PR-META-3: Pre-PR-create quality gate hook.
#
# Blocks `gh pr create` if quality gates fail:
#   1. Branch has a rubric file (.claude/rubrics/<branch>.md OR <pr-id>.md)
#   2. PR body contains "VERDICT: PASS" or "VERDICT: PASS_WITH_WARNINGS"
#   3. (PR-META-3) PR body contains "PRODUCT-GRADE GATES" section with all
#      7 gates (G1-G7) marked PASS / N/A / FAIL
#   4. (PR-META-3) No gate marked FAIL
#
# Triggered by Claude Code's PreToolUse hook on Bash. Matches `gh pr create`
# commands only (via `if` filter in settings.json) — silently exits 0 for
# other commands.
#
# Implementation: uses Node.js (universally available) to parse hook JSON
# from stdin. No jq dependency.

set -uo pipefail

# Read stdin into temp file (Node will parse it)
INPUT_FILE="$(mktemp 2>/dev/null || echo /tmp/hook-input-$$.json)"
cat > "$INPUT_FILE"

# Use Node to extract command + validate
node - "$INPUT_FILE" <<'NODESCRIPT'
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const inputFile = process.argv[2];
let hookInput;
try {
  hookInput = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
} catch (e) {
  // Empty input or malformed — let it pass (not our concern)
  process.exit(0);
}

const command = (hookInput.tool_input && hookInput.tool_input.command) || '';

// Only intercept `gh pr create` — pass through everything else
if (!/^\s*gh\s+pr\s+create\b/.test(command)) {
  process.exit(0);
}

// ─── Quality checks ─────────────────────────────────────────

let repoRoot;
try {
  repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
} catch (e) {
  emitDeny('Cannot determine repo root — not in a git repo?');
  process.exit(0);
}

let branch = '';
try {
  branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
} catch (e) {
  branch = 'unknown';
}

const failures = [];

// Check 1: rubric file exists for this branch
const rubricDir = path.join(repoRoot, '.claude', 'rubrics');
let rubricFound = null;

if (fs.existsSync(rubricDir)) {
  // Try to match branch name → rubric (e.g. fix/calendar-tz-bug-pr-g-3-7 → pr-g-3-7.md)
  const prIdMatch = branch.match(/pr-[a-z0-9-]+/i);
  if (prIdMatch) {
    const candidate = path.join(rubricDir, `${prIdMatch[0].toLowerCase()}.md`);
    if (fs.existsSync(candidate)) {
      rubricFound = `${prIdMatch[0].toLowerCase()}.md`;
    }
  }
  // Fallback: any rubric file modified in this branch vs origin/main
  if (!rubricFound) {
    try {
      const diff = execSync('git diff --name-only origin/main..HEAD', { encoding: 'utf8' });
      const modified = diff.split('\n').find(p => /^\.claude\/rubrics\/.+\.md$/.test(p));
      if (modified && fs.existsSync(path.join(repoRoot, modified))) {
        rubricFound = path.basename(modified);
      }
    } catch (e) { /* origin/main may not be fetched */ }
  }
}

if (!rubricFound) {
  failures.push(`No rubric file found in .claude/rubrics/ matching branch '${branch}' or added in this branch.`);
}

// Check 2: PR body mentions outcomes-grader VERDICT (PASS / PASS_WITH_WARNINGS)
// We scan the gh command string itself for the body content.
const hasGraderPass = /VERDICT[:\s]*PASS(_WITH_WARNINGS)?/i.test(command) ||
                      /Outcomes\s*Grader[:\s].*PASS/i.test(command);

if (!hasGraderPass) {
  failures.push(`PR body does not mention outcomes-grader VERDICT: PASS or PASS_WITH_WARNINGS. Run grader + include verdict in PR body.`);
}

// Check 3 (PR-META-3): PR body contains PRODUCT-GRADE GATES section with G1-G7
const hasGatesSection = /PRODUCT[- ]GRADE\s*GATES/i.test(command);
if (!hasGatesSection) {
  failures.push(`PR body missing "PRODUCT-GRADE GATES" section. Required per PR-META-3 — see .claude/rubrics/_PRODUCT-GRADE-GATES.md. Add a section listing G1-G7 with status (PASS/N/A/FAIL).`);
} else {
  // Check 4 (PR-META-3): each of G1-G7 must appear with a status
  const gateIds = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7'];
  const missingGates = [];
  const failedGates = [];
  for (const g of gateIds) {
    // Match "G1" followed by optional separator then PASS|N/A|FAIL within ~80 chars
    const gateRe = new RegExp(`\\b${g}\\b[^\\n]{0,120}?\\b(PASS|N\\/A|FAIL)\\b`, 'i');
    const m = command.match(gateRe);
    if (!m) {
      missingGates.push(g);
    } else if (/^fail$/i.test(m[1])) {
      failedGates.push(g);
    }
  }
  if (missingGates.length > 0) {
    failures.push(`PRODUCT-GRADE GATES section missing status for: ${missingGates.join(', ')}. Each gate must be PASS / N/A / FAIL.`);
  }
  if (failedGates.length > 0) {
    failures.push(`PRODUCT-GRADE GATES failing: ${failedGates.join(', ')}. Fix before opening PR (see .claude/rubrics/_PRODUCT-GRADE-GATES.md).`);
  }
}

// ─── Decision ────────────────────────────────────────────────

if (failures.length === 0) {
  // All checks passed — allow
  process.exit(0);
}

emitDeny([
  'PR creation blocked by quality gate (.claude/hooks/require-outcomes-pass.sh):',
  ...failures.map(f => `- ${f}`),
  '',
  'To fix: ensure rubric exists in .claude/rubrics/, run outcomes-grader, include "VERDICT: PASS" in PR body.'
].join('\n'));

function emitDeny(reason) {
  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason
    }
  };
  process.stdout.write(JSON.stringify(output));
}
NODESCRIPT

# Cleanup temp file
rm -f "$INPUT_FILE"
exit 0
