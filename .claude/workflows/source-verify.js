export const meta = {
  name: 'source-verify',
  description: 'Verify that quotes and citations in a document actually appear verbatim in their cited sources',
  whenToUse: 'When adding citations to a doc (e.g., MASTER_PLAN.md anchors), or auditing a document with many citations, to catch fabricated quotes and misattributed paraphrases. Use BEFORE committing any doc that anchors authority on external sources.',
  phases: [
    { title: 'Extract', detail: 'Read document, extract every (quote, source) pair' },
    { title: 'Fetch', detail: 'WebFetch each cited URL and capture full text' },
    { title: 'Match', detail: 'Search each quote in its source — verbatim, paraphrase, or absent' },
    { title: 'Adversarial', detail: 'Try to break each "verbatim" claim with cross-search' },
    { title: 'Report', detail: 'Per-quote verdict + classification + fix suggestions' }
  ]
}

// EXPECTED args:
// {
//   documentPath: string,        // absolute path to the document to verify
//   reportLanguage: 'he' | 'en'  // default 'he'
// }

if (!args || !args.documentPath) {
  throw new Error('source-verify workflow requires args.documentPath')
}

const DOC_PATH = args.documentPath
const REPORT_LANG = args.reportLanguage || 'he'

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    citations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          quoteText: { type: 'string', description: 'The exact quoted text from the document' },
          sourceUrl: { type: 'string' },
          sourceLabel: { type: 'string', description: 'How the source was named in the doc' },
          docLineNumber: { type: 'number' },
          isMarkedAsParaphrase: { type: 'boolean', description: 'True if doc explicitly says "paraphrased" or similar' }
        },
        required: ['quoteText', 'sourceUrl', 'docLineNumber', 'isMarkedAsParaphrase']
      }
    },
    extractionNotes: { type: 'string' }
  },
  required: ['citations', 'extractionNotes']
}

const MATCH_SCHEMA = {
  type: 'object',
  properties: {
    matchResult: {
      enum: ['VERBATIM_FOUND', 'PARAPHRASE_FOUND', 'NOT_FOUND_IN_SOURCE', 'SOURCE_UNREACHABLE', 'WRONG_SOURCE']
    },
    sourceFetchSuccess: { type: 'boolean' },
    exactQuoteInSource: { type: ['string', 'null'], description: 'If found, the exact text from source that matches' },
    discrepancyNotes: { type: 'string' },
    confidence: { enum: ['HIGH', 'MEDIUM', 'LOW'] }
  },
  required: ['matchResult', 'sourceFetchSuccess', 'discrepancyNotes', 'confidence']
}

const ADVERSARIAL_SCHEMA = {
  type: 'object',
  properties: {
    confirmsVerdict: { type: 'boolean' },
    crossSearchResults: { type: 'string', description: 'What a fresh web search for the quote returned' },
    finalClassification: {
      enum: ['VERIFIED_VERBATIM', 'VERIFIED_PARAPHRASE_HONEST', 'PARAPHRASE_PRESENTED_AS_QUOTE', 'FABRICATED', 'WRONG_ATTRIBUTION', 'UNVERIFIABLE']
    },
    fixSuggestion: { type: 'string' }
  },
  required: ['confirmsVerdict', 'finalClassification', 'fixSuggestion']
}

phase('Extract')
const extraction = await agent(
  `Read the document at: ${DOC_PATH}

Extract EVERY (quote, source URL) pair in the document. A "quote" is text wrapped in:
- Markdown quote blockquotes ("> ...")
- Italic quotes ("*"..."*" or "_..._")
- Inline double-quote text near a URL or source name
- "anchor" blocks like "> **Anchor — Source:** ..."

For each citation:
- Capture the EXACT quote text (verbatim from the doc)
- Capture the source URL
- Capture how the source was labeled (e.g., "Anthropic Constitutional AI 2022")
- Record the line number in the doc
- Note whether the doc explicitly marks it as "paraphrase" / "summary" / "adapted" (vs presenting as verbatim quote)

DO NOT skip citations. If unsure whether something is a citation, include it and let the matching phase decide.

If the document has no citations, return citations: [].`,
  { label: 'extract', phase: 'Extract', schema: EXTRACTION_SCHEMA }
)

if (!extraction || !extraction.citations || extraction.citations.length === 0) {
  return {
    documentPath: DOC_PATH,
    citations: [],
    finalReport: REPORT_LANG === 'he'
      ? `# אימות ציטוטים — דוח\n\nלא נמצאו ציטוטים מתועדים במסמך ${DOC_PATH}.\n${extraction?.extractionNotes || ''}`
      : `# Citation verification report\n\nNo documented citations found in ${DOC_PATH}.\n${extraction?.extractionNotes || ''}`
  }
}

phase('Fetch')
phase('Match')
const matches = await parallel(
  extraction.citations.map((cit, idx) => () =>
    agent(
      `Verify whether this quote appears in its cited source.

QUOTE FROM DOCUMENT (line ${cit.docLineNumber}):
"""
${cit.quoteText}
"""

CITED SOURCE: ${cit.sourceUrl}
SOURCE LABEL: ${cit.sourceLabel || '(none)'}
MARKED AS PARAPHRASE IN DOC? ${cit.isMarkedAsParaphrase ? 'YES' : 'NO'}

Your task:
1. WebFetch the source URL
2. Search the fetched content for the quote text
3. Determine match status:
   - VERBATIM_FOUND: exact wording exists in source
   - PARAPHRASE_FOUND: the IDEA exists in source but wording differs
   - NOT_FOUND_IN_SOURCE: source loaded but quote not present
   - SOURCE_UNREACHABLE: fetch failed (404, timeout, gated)
   - WRONG_SOURCE: the source is real but is about a different topic — wrong URL cited
4. If VERBATIM_FOUND or PARAPHRASE_FOUND, return the exact matching text from source
5. Note any discrepancies (e.g., "doc says 2024 but source is dated 2022")
6. Confidence: HIGH if you found the source and confirmed, MEDIUM if partial match, LOW if uncertain

DO NOT pretend to find a match that isn't there. If unsure, say NOT_FOUND_IN_SOURCE with reasoning.`,
      { label: `match:${idx}`, phase: 'Match', schema: MATCH_SCHEMA }
    )
  )
)

phase('Adversarial')
const adversarials = await parallel(
  matches.map((m, idx) => () =>
    agent(
      `ADVERSARIAL CHECK on a quote-verification verdict. Default to skeptical.

QUOTE: """${extraction.citations[idx].quoteText}"""
SOURCE: ${extraction.citations[idx].sourceUrl}
DOC MARKED AS PARAPHRASE? ${extraction.citations[idx].isMarkedAsParaphrase}

CURRENT MATCH VERDICT: ${m.matchResult}
SOURCE TEXT FOUND: ${m.exactQuoteInSource || '(none)'}
NOTES: ${m.discrepancyNotes}

Your job:
1. Run a fresh WebSearch on the quote string (in double quotes for exact match)
2. If the search returns NO results anywhere on the web, the quote may be FABRICATED
3. If the search returns the source URL — verified
4. If the search returns OTHER sources — check whether the original cited source actually has it OR if it was misattributed

Classify finally:
- VERIFIED_VERBATIM: exact quote found in cited source, and cross-search confirms attribution
- VERIFIED_PARAPHRASE_HONEST: doc marks it as paraphrase AND the underlying idea is in source
- PARAPHRASE_PRESENTED_AS_QUOTE: doc shows as verbatim ("...") but is actually a paraphrase — INTEGRITY ISSUE
- FABRICATED: quote doesn't appear in source OR anywhere on the web — quote was invented
- WRONG_ATTRIBUTION: quote is real but the cited source is wrong
- UNVERIFIABLE: source unreachable, cannot determine

For each PROBLEMATIC classification (PARAPHRASE_PRESENTED_AS_QUOTE, FABRICATED, WRONG_ATTRIBUTION), suggest a specific fix.`,
      { label: `adversarial:${idx}`, phase: 'Adversarial', schema: ADVERSARIAL_SCHEMA }
    )
  )
)

phase('Report')
const combined = extraction.citations.map((cit, i) => ({
  citation: cit,
  match: matches[i],
  adversarial: adversarials[i]
}))

const problemCount = adversarials.filter(a =>
  a && ['PARAPHRASE_PRESENTED_AS_QUOTE', 'FABRICATED', 'WRONG_ATTRIBUTION'].includes(a.finalClassification)
).length

const reportPrompt = REPORT_LANG === 'he'
  ? `Write the report in HEBREW.

# אימות ציטוטים — דוח על ${DOC_PATH}

## תקציר
Total citations: ${extraction.citations.length}
Problematic: ${problemCount}

## טבלת ממצאים
Columns: # | שורה במסמך | תקציר ציטוט | סיווג סופי | מקור | תיקון נדרש

## פירוט לציטוטים בעייתיים
For each PARAPHRASE_PRESENTED_AS_QUOTE / FABRICATED / WRONG_ATTRIBUTION:
- Quote from doc
- What was found (or not found) in source
- Suggested fix

## ציטוטים תקינים
List briefly per source.

## פעולה נדרשת
Direct recommendation: should the doc be edited before merge?

DO NOT fabricate. If a citation was unverifiable, mark UNVERIFIABLE explicitly.`
  : `Write the report in ENGLISH.

# Citation Verification Report — ${DOC_PATH}

## Summary
Total citations: ${extraction.citations.length}
Problematic: ${problemCount}

## Findings table
Columns: # | Doc line | Quote summary | Final classification | Source | Fix needed

## Problematic citations detail
For each PARAPHRASE_PRESENTED_AS_QUOTE / FABRICATED / WRONG_ATTRIBUTION:
- Quote from doc
- What was found in source
- Suggested fix

## Verified citations
List briefly per source.

## Action required
Direct recommendation.

DO NOT fabricate.`

const finalReport = await agent(
  `${reportPrompt}

Combined verification data:
${JSON.stringify(combined, null, 2)}`,
  { label: 'final-report' }
)

return {
  documentPath: DOC_PATH,
  totalCitations: extraction.citations.length,
  problematicCount: problemCount,
  perCitation: combined,
  finalReport
}
