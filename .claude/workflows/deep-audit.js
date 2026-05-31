export const meta = {
  name: 'deep-audit',
  description: 'Multi-lens review of a PR or module — 5 dimensions reviewed in parallel, every finding adversarially verified',
  whenToUse: 'For high-stakes PRs (Phase 1 PRs C-G, schema changes, security rule changes, data migrations, refactors >100 lines), OR when reviewing a module before refactor. Cheaper than scrambling 5 sequential agent calls; ensures consistent multi-dimensional coverage with built-in skepticism.',
  phases: [
    { title: 'Review', detail: '5 dimensions reviewed in parallel: correctness / security / performance / UX / business-logic' },
    { title: 'Verify', detail: 'Adversarial check on each finding — try to refute before accepting' },
    { title: 'Dedupe', detail: 'Cross-dimension duplicates collapsed' },
    { title: 'Synthesize', detail: 'Severity-ranked report with concrete fixes' }
  ]
}

// EXPECTED args:
// {
//   target: {
//     type: 'pr' | 'module' | 'files',
//     prNumber?: number,             // if type === 'pr'
//     modulePath?: string,           // if type === 'module' (absolute path to dir)
//     files?: string[]               // if type === 'files' (array of absolute paths)
//   },
//   focusDimensions?: string[]       // optional: subset of ['correctness', 'security', 'performance', 'ux', 'business']
//                                    // default: all 5
//   contextHints?: string            // optional: additional context (e.g., "this PR fixes 21 wrongly-blocked clients bug")
//   reportLanguage?: 'he' | 'en'     // default 'he'
// }

if (!args || !args.target) {
  throw new Error('deep-audit workflow requires args.target = {type, prNumber?, modulePath?, files?}')
}

const TARGET = args.target
const DIMENSIONS = args.focusDimensions || ['correctness', 'security', 'performance', 'ux', 'business']
const CONTEXT = args.contextHints || ''
const REPORT_LANG = args.reportLanguage || 'he'

// Resolve target description for agents
let targetDescription = ''
if (TARGET.type === 'pr' && TARGET.prNumber) {
  targetDescription = `PR #${TARGET.prNumber}. Use: gh pr view ${TARGET.prNumber} --json title,body,files | jq, AND gh pr diff ${TARGET.prNumber} to see the actual changes.`
} else if (TARGET.type === 'module' && TARGET.modulePath) {
  targetDescription = `Module at: ${TARGET.modulePath}. Use Glob and Read to inspect all files in this directory.`
} else if (TARGET.type === 'files' && TARGET.files) {
  targetDescription = `Files: ${TARGET.files.join(', ')}. Use Read on each.`
} else {
  throw new Error('Invalid target shape — need type=pr+prNumber, type=module+modulePath, or type=files+files[]')
}

// agentType values below must be one of the 12 custom agents defined in .claude/agents/.
// Do NOT use 'general-purpose' here — deep-audit is a code-review workflow and every
// dimension must map to a Project specialist for traceability ("who said this is a bug?").
const DIMENSION_DEFINITIONS = {
  correctness: {
    name: 'Correctness',
    agentType: 'testing-quality-expert',
    prompt: 'Review for CORRECTNESS bugs: off-by-one, null handling, race conditions, wrong-value-returned, error-swallowing, state corruption, missing assertions, missing edge case handling. Focus on what would happen with PRODUCTION traffic, not happy path. For each bug found, cite file:line.',
  },
  security: {
    name: 'Security',
    agentType: 'security-access-expert',
    prompt: 'Review for SECURITY issues: auth bypass, missing permission check, PII leak in logs, secrets in code, XSS, injection, CSRF, insecure defaults, missing rate limit, audit-log gap. Per project bar: this repo is PUBLIC — assume every diff is read by competitors. For each issue, cite file:line + severity.',
  },
  performance: {
    name: 'Performance',
    agentType: 'backend-firebase-expert',
    prompt: 'Review for PERFORMANCE issues: N+1 Firestore queries, missing indexes, unbounded loops, memory leaks, blocking I/O on hot path, excessive re-renders, large bundle additions, expensive computation on every render, missing pagination, missing cache. Cite file:line + estimated impact.',
  },
  ux: {
    name: 'UX',
    agentType: 'frontend-ui-expert',
    prompt: 'Review for USER EXPERIENCE issues: confusing error messages, missing loading states, broken responsive layout, accessibility violations (WCAG AA contrast, focus-visible, aria), Hebrew RTL issues, broken keyboard nav, jank/lag, missing empty states. Per project bar: customer-facing strings must be Hebrew. Cite file:line.',
  },
  business: {
    name: 'Business-logic',
    agentType: 'backend-firebase-expert',
    prompt: 'Review for BUSINESS-LOGIC issues: violations of the 4 service shapes (hours / fixed / legal_procedure-hourly / legal_procedure-fixed), wrong handling of isFixedService, dual-write race conditions, aggregate drift potential, invariant violations (calcClientAggregates I1-I4), wrong status transitions, audit-log missing on critical write. Cite file:line + which invariant.',
  }
}

const FINDING_SCHEMA = {
  type: 'object',
  properties: {
    dimension: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
          title: { type: 'string' },
          fileLine: { type: 'string' },
          description: { type: 'string' },
          suggestedFix: { type: 'string' }
        },
        required: ['severity', 'title', 'fileLine', 'description']
      }
    },
    coverageNotes: { type: 'string' }
  },
  required: ['dimension', 'findings', 'coverageNotes']
}

const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    isReal: { type: 'boolean' },
    severity: { enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'FALSE_POSITIVE'] },
    refutationAttempts: { type: 'array', items: { type: 'string' } },
    reasoning: { type: 'string' }
  },
  required: ['isReal', 'severity', 'refutationAttempts', 'reasoning']
}

phase('Review')
const dimensionResults = await parallel(
  DIMENSIONS.filter(d => DIMENSION_DEFINITIONS[d]).map(dim => () => {
    const def = DIMENSION_DEFINITIONS[dim]
    return agent(
      `You are reviewing for ${def.name} issues.

TARGET: ${targetDescription}
CONTEXT: ${CONTEXT || '(none)'}

${def.prompt}

Return a list of findings. If you found NO issues, return findings: [] with coverageNotes explaining what you checked.

DO NOT speculate. Every finding must cite file:line. If you cannot cite file:line, the finding is too speculative and should be omitted.`,
      {
        label: `review:${dim}`,
        phase: 'Review',
        agentType: def.agentType,
        schema: FINDING_SCHEMA
      }
    )
  })
)

// Flatten all findings into one list with provenance
const allFindings = []
dimensionResults.filter(Boolean).forEach(res => {
  (res.findings || []).forEach(f => {
    allFindings.push({ ...f, dimension: res.dimension })
  })
})

phase('Verify')
const verifiedFindings = await parallel(
  allFindings.map((finding, idx) => () =>
    agent(
      `ADVERSARIAL VERIFICATION of a code review finding. Default to FALSE_POSITIVE — only confirm if you can prove the bug is real.

TARGET: ${targetDescription}

FINDING TO VERIFY:
- Dimension: ${finding.dimension}
- Severity claimed: ${finding.severity}
- Title: ${finding.title}
- Location: ${finding.fileLine}
- Description: ${finding.description}
- Suggested fix: ${finding.suggestedFix || '(none)'}

Your job:
1. Read the exact file:line cited
2. Try to construct a counter-example: a scenario where the code is actually correct
3. Check if there's surrounding code that prevents the bug (guard clause, type check, upstream validation)
4. Check if the "bug" is actually handled elsewhere (try/catch upstream, fallback)
5. If you cannot defend the code → confirm bug is real
6. If you can defend the code → mark as FALSE_POSITIVE with reasoning

Adjust severity based on real-world impact:
- CRITICAL: data loss, security breach, production-blocking
- HIGH: customer-visible bug, significant performance regression
- MEDIUM: edge-case bug, minor UX issue
- LOW: code smell, refactor opportunity

Return isReal + adjusted severity + reasoning.`,
      {
        label: `verify:${finding.dimension}:${idx}`,
        phase: 'Verify',
        schema: VERIFY_SCHEMA
      }
    ).then(verdict => ({ finding, verdict }))
  )
)

phase('Dedupe')
// Group by file:line — if multiple dimensions found same location, keep highest severity + combine reasoning
const confirmedFindings = verifiedFindings
  .filter(Boolean)
  .filter(vf => vf.verdict && vf.verdict.isReal && vf.verdict.severity !== 'FALSE_POSITIVE')
  .map(vf => ({
    ...vf.finding,
    severity: vf.verdict.severity,
    verificationReasoning: vf.verdict.reasoning
  }))

const byLocation = new Map()
confirmedFindings.forEach(f => {
  const key = f.fileLine
  if (!byLocation.has(key)) {
    byLocation.set(key, { ...f, dimensions: [f.dimension] })
  } else {
    const existing = byLocation.get(key)
    if (!existing.dimensions.includes(f.dimension)) {
      existing.dimensions.push(f.dimension)
    }
    // Keep highest severity
    const severityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
    if ((severityOrder[f.severity] || 0) > (severityOrder[existing.severity] || 0)) {
      existing.severity = f.severity
    }
  }
})
const dedupedFindings = Array.from(byLocation.values())

phase('Synthesize')
const reportPrompt = REPORT_LANG === 'he'
  ? `Write the report in HEBREW.

# Deep Audit — דוח ביקורת

## תקציר
- Target: ${TARGET.type === 'pr' ? 'PR #' + TARGET.prNumber : TARGET.modulePath || TARGET.files?.join(', ')}
- ממצאים גולמיים: ${allFindings.length}
- אומתו אחרי refute: ${dedupedFindings.length}
- סינון false-positives: ${allFindings.length - dedupedFindings.length}

## טבלת ממצאים מאומתים (מקריטי לנמוך)
Columns: # | severity | dimension(s) | file:line | בעיה | תיקון מומלץ

## פירוט פר-ממצא (רק אחרי CRITICAL ו-HIGH)
For each CRITICAL/HIGH:
- description
- verification reasoning (why it's not false positive)
- fix suggestion

## כיסוי לפי dimension
Brief: what each dimension checked, what it found, any coverage gaps.

## פעולה מומלצת
Direct: should the PR/module be modified before merge? Which findings are blockers?`
  : `Write the report in ENGLISH (same structure).`

const finalReport = await agent(
  `${reportPrompt}

DATA:
- All raw findings: ${JSON.stringify(allFindings, null, 2)}
- Verified + deduped: ${JSON.stringify(dedupedFindings, null, 2)}
- Dimensions checked: ${DIMENSIONS.join(', ')}
- Target: ${JSON.stringify(TARGET)}`,
  { label: 'final-report' }
)

return {
  target: TARGET,
  rawFindingsCount: allFindings.length,
  verifiedFindingsCount: dedupedFindings.length,
  perDimension: dimensionResults,
  confirmedFindings: dedupedFindings,
  finalReport
}
