export const meta = {
  name: 'fact-check',
  description: 'Verify N factual claims against primary sources with adversarial refutation',
  whenToUse: 'When user receives marketing copy, third-party claims, blog posts, or news about Anthropic/competitor products and wants verification against primary sources.',
  phases: [
    { title: 'Search', detail: 'Parallel web searches for each claim, separating primary from third-party sources' },
    { title: 'Verify', detail: 'Fetch primary sources and extract verbatim evidence' },
    { title: 'Refute', detail: 'Adversarial check — try to disprove each verdict, default to REFUTED' },
    { title: 'Synthesize', detail: 'Hebrew report with confidence levels per claim' }
  ]
}

// EXPECTED args shape (pass via Workflow({name: 'fact-check', args: {...}})):
// {
//   claims: [
//     { id: string, text: string, searchQueries: string[] }
//   ],
//   primaryDomains: string[],   // e.g. ['anthropic.com', 'docs.anthropic.com']
//   reportLanguage: 'he' | 'en' // default 'he'
// }

if (!args || !args.claims || !Array.isArray(args.claims) || args.claims.length === 0) {
  throw new Error('fact-check workflow requires args.claims = [{id, text, searchQueries}, ...]')
}

const CLAIMS = args.claims
const PRIMARY_DOMAINS = args.primaryDomains || []
const REPORT_LANG = args.reportLanguage || 'he'

const SEARCH_SCHEMA = {
  type: 'object',
  properties: {
    foundEvidence: { type: 'boolean' },
    primarySources: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          title: { type: 'string' },
          publishedDate: { type: 'string' },
          relevantSnippet: { type: 'string' }
        },
        required: ['url', 'title', 'relevantSnippet']
      }
    },
    thirdPartySources: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          title: { type: 'string' },
          source: { type: 'string' },
          relevantSnippet: { type: 'string' }
        }
      }
    },
    summary: { type: 'string' }
  },
  required: ['foundEvidence', 'primarySources', 'thirdPartySources', 'summary']
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    verdict: {
      enum: ['CONFIRMED_BY_PRIMARY', 'CONFIRMED_BY_THIRD_PARTY_ONLY', 'CONTRADICTED', 'PARTIAL_MATCH', 'NO_EVIDENCE_FOUND']
    },
    bestPrimarySourceUrl: { type: ['string', 'null'] },
    verbatimQuote: { type: 'string' },
    reasoning: { type: 'string' },
    discrepancies: { type: 'array', items: { type: 'string' } }
  },
  required: ['verdict', 'reasoning', 'discrepancies']
}

const REFUTE_SCHEMA = {
  type: 'object',
  properties: {
    survives: { type: 'boolean' },
    refutationAttempts: { type: 'array', items: { type: 'string' } },
    finalConfidence: { enum: ['HIGH', 'MEDIUM', 'LOW', 'NONE'] },
    notes: { type: 'string' }
  },
  required: ['survives', 'finalConfidence', 'refutationAttempts', 'notes']
}

const primaryDomainsList = PRIMARY_DOMAINS.length > 0
  ? PRIMARY_DOMAINS.map(d => `- ${d}`).join('\n')
  : '- (no specific primary domains specified — caller did not provide; treat reputable .com/.org/.gov sources as primary candidates and judge each on merit)'

phase('Search')
const searchResults = await parallel(
  CLAIMS.map(claim => () =>
    agent(
      `You are verifying a factual claim. PRIORITIZE primary sources over third-party.

CLAIM: "${claim.text}"

Search using WebSearch with these queries (try each, keep best results):
${claim.searchQueries.map(q => `- ${q}`).join('\n')}

PRIMARY source domains (highest authority for this fact-check):
${primaryDomainsList}

Third-party sources (news, blogs, social) are SECONDARY — record them but flag as non-primary.

Return: best primary sources + best third-party sources + honest summary. If no primary found, say so explicitly.

DO NOT fabricate URLs. DO NOT pretend a source exists when search returned nothing. Return empty arrays if no results.`,
      { label: `search:${claim.id}`, phase: 'Search', schema: SEARCH_SCHEMA }
    )
  )
)

phase('Verify')
const verdicts = await parallel(
  searchResults.map((res, i) => () => {
    if (!res || !res.foundEvidence) {
      return Promise.resolve({
        verdict: 'NO_EVIDENCE_FOUND',
        bestPrimarySourceUrl: null,
        verbatimQuote: '',
        reasoning: 'Search returned no relevant evidence',
        discrepancies: []
      })
    }
    const sources = [...(res.primarySources || []), ...(res.thirdPartySources || [])]
    return agent(
      `You are verifying a single claim against the sources found.

CLAIM: "${CLAIMS[i].text}"

Sources from search:
${JSON.stringify(sources, null, 2)}

Your task:
1. WebFetch the most promising primary sources first
2. Extract VERBATIM quotes that support or contradict
3. Compare the EXACT wording of the claim vs. what sources actually say — note discrepancies (e.g., claim says "16 parallel" but source says "up to a limit determined by CPU cores")
4. Return verdict using this strict scale:
   - CONFIRMED_BY_PRIMARY: primary source has verbatim or near-verbatim support
   - CONFIRMED_BY_THIRD_PARTY_ONLY: only secondary sources, no primary
   - PARTIAL_MATCH: source supports part of claim but with different wording or scope
   - CONTRADICTED: primary source contradicts
   - NO_EVIDENCE_FOUND: nothing in sources

DO NOT fabricate quotes. If a fetch fails, return NO_EVIDENCE_FOUND.
DO NOT round PARTIAL_MATCH up to CONFIRMED.`,
      { label: `verify:${CLAIMS[i].id}`, phase: 'Verify', schema: VERDICT_SCHEMA }
    )
  })
)

phase('Refute')
const refutations = await parallel(
  verdicts.map((v, i) => () =>
    agent(
      `You are the ADVERSARIAL REFUTER. Default to REFUTED — only mark SURVIVES if you cannot find any flaw after honest effort.

CLAIM: "${CLAIMS[i].text}"
CURRENT VERDICT: ${v.verdict}
REASONING: ${v.reasoning}
BEST SOURCE: ${v.bestPrimarySourceUrl || 'none'}
VERBATIM QUOTE: ${v.verbatimQuote || 'none'}
NOTED DISCREPANCIES: ${JSON.stringify(v.discrepancies || [])}

Attack angles:
1. Wording drift — does source say what claim says word-for-word, or is it paraphrased/extrapolated?
2. Date mismatch — is source from a different release/version?
3. Marketing vs technical — marketing copy vs official spec?
4. Third-party attribution — is source quoting someone else (e.g., blogger interpreting) vs the primary themselves?
5. Scope mismatch — does claim generalize a narrow feature?
6. Fabrication test — search the verbatim quote string in a fresh WebSearch; if it doesn't appear anywhere, the quote may be fabricated.

If CONFIRMED but you find ANY issue, downgrade to PARTIAL_MATCH or NO_EVIDENCE_FOUND.

Return final confidence after adversarial check.`,
      { label: `refute:${CLAIMS[i].id}`, phase: 'Refute', schema: REFUTE_SCHEMA }
    )
  )
)

phase('Synthesize')
const combined = CLAIMS.map((claim, i) => ({
  claim,
  searchResult: searchResults[i],
  verdict: verdicts[i],
  refutation: refutations[i]
}))

const reportInstructions = REPORT_LANG === 'he'
  ? `Write the report in HEBREW with this structure:

# אימות מול מקורות ראשיים — דוח מסכם

## טבלת ממצאים
Columns: # | טענה (קצר) | verdict | confidence (אחרי refute) | מקור ראשי | הערה
Order rows from STRONGEST to WEAKEST confidence.

## פירוט לטענות שתוקפו או חסרות מקור
For each REFUTED / PARTIAL_MATCH / NO_EVIDENCE_FOUND claim — explain WHY in 2-3 sentences. Cite the discrepancy or missing source.

## פירוט לטענות שאומתו במלואן
For each claim with HIGH confidence — quote the verbatim source + URL.

## סיכום
2-3 paragraphs: how much is real vs marketing/extrapolation/fabrication. Be direct.

## איפה לקרוא בעצמך
3-5 most useful primary sources.

DO NOT fabricate URLs or quotes.`
  : `Write the report in ENGLISH with this structure:

# Fact-Check Report — Primary Source Verification

## Findings table
Columns: # | Claim (short) | verdict | confidence (post-refute) | Primary URL | Note
Order rows from STRONGEST to WEAKEST confidence.

## Refuted / Partial / No-evidence details
For each claim that did NOT achieve HIGH confidence, explain why in 2-3 sentences.

## Fully verified details
For each HIGH-confidence claim, quote the verbatim source + URL.

## Summary
2-3 paragraphs.

## Read further
3-5 primary sources.

DO NOT fabricate URLs or quotes.`

const finalReport = await agent(
  `Compile final verification report.

Original claims:
${JSON.stringify(CLAIMS.map(c => ({ id: c.id, text: c.text })), null, 2)}

Combined verification data:
${JSON.stringify(combined, null, 2)}

${reportInstructions}

IMPORTANT:
- DO NOT fabricate URLs or quotes. If verdict was NO_EVIDENCE_FOUND, write that explicitly.
- DO NOT round up confidence.
- DO NOT pad the report.`,
  { label: 'final-report' }
)

return { perClaim: combined, finalReport }
