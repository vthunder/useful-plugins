export const meta = {
  name: 'zettel-audit-semantic',
  description: 'Parallel semantic consistency checks across 7 dimensions for zettel-audit step 4',
  phases: [
    { title: 'Semantic checks', detail: 'Run all 7 check dimensions in parallel' },
    { title: 'Adversarial verify', detail: 'Challenge high-confidence findings to filter false positives' },
    { title: 'Synthesize', detail: 'Merge all verified findings into the final report' },
  ],
}

// args: {
//   corpus: Array<{ id, title, tags, links, external_links, body, path }>,
//   library_name: string,
//   library_kind: string,   // 'release-spec' | 'evergreen'
//   focus_slugs?: string[], // if --focus was given
// }
const { corpus, library_name, library_kind, focus_slugs } = args

const corpusJson = JSON.stringify(corpus)
const focusNote = focus_slugs && focus_slugs.length > 0
  ? `Focus slugs (bias stale-claim checks toward these): ${focus_slugs.join(', ')}`
  : 'Full library audit — no focus restriction.'

const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    dimension: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', description: 'contradiction | stale-claim | unspecced-dependency | terminology | open-question' },
          slugs: { type: 'array', items: { type: 'string' }, description: 'Zettel IDs involved' },
          description: { type: 'string', description: 'One-paragraph description of the finding' },
          quote_a: { type: 'string', description: 'Exact quote from first zettel' },
          quote_b: { type: 'string', description: 'Exact quote from second zettel, if applicable' },
          suggested_resolution: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          blocks_implementation: { type: 'boolean' },
        },
        required: ['kind', 'slugs', 'description', 'confidence', 'blocks_implementation'],
      },
    },
  },
  required: ['dimension', 'findings'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    finding_index: { type: 'number' },
    is_real: { type: 'boolean' },
    reason: { type: 'string' },
  },
  required: ['finding_index', 'is_real', 'reason'],
}

const DIMENSIONS = [
  {
    key: 'interface',
    label: '4a: Interface contradictions',
    prompt: `Check for interface contradictions: the same command, HTTP route, API endpoint, or CLI flag described differently across zettels.
Look for: command name spelling differences, route path mismatches, flag names that differ, options present in one zettel but absent in another.
For each finding cite exact quotes from both zettels.`,
  },
  {
    key: 'data-model',
    label: '4b: Data model conflicts',
    prompt: `Check for data model conflicts: the same table, column, or field referenced with different names, types, or semantics.
Also flag: fields referenced in one zettel but never declared in any data model zettel; schema changes in a newer zettel that contradict an older zettel's schema.
For each finding cite the exact field names and zettel IDs.`,
  },
  {
    key: 'behavioral',
    label: '4c: Behavioral contradictions',
    prompt: `Check for behavioral contradictions: two zettels making incompatible claims about the same behavior.
Patterns to catch: conflicting resolution rules, different default values for the same setting, scope disagreements (global vs per-team), conflicting state machine transitions.
For each finding cite exact quotes from both zettels.`,
  },
  {
    key: 'stale',
    label: '4d: Stale claims',
    prompt: `Check for stale claims: a newer zettel's claims supersede or contradict claims in older zettels that were not updated.
${focusNote}
For each stale claim: identify the old zettel, the specific claim now outdated, and the new zettel that supersedes it.
Cite exact quotes from both zettels. Note which direction to resolve (update old or update new).`,
  },
  {
    key: 'unspecced',
    label: '4e: Unspecced dependencies',
    prompt: `Check for unspecced dependencies: concepts, tables, fields, commands, or behaviors implied by a zettel but not specced anywhere.
Look for: commands mentioned but behavior not described; tables referenced but never defined; migrations implied but no zettel describes them; API endpoints called by CLI but no contract specced.
For each finding identify the implying zettel and the missing spec concept.`,
  },
  {
    key: 'terminology',
    label: '4f: Terminology inconsistency',
    prompt: `Check for terminology inconsistency: the same concept referred to by different names across zettels, or the same term used with different meanings.
Look for synonym clusters ("active sprint" vs "current sprint" vs "team sprint"), and terms whose definitions differ between zettels.
For each finding cite the specific zettels and terms.`,
  },
  {
    key: 'open-questions',
    label: '4g: Open questions',
    prompt: `Find unresolved questions, TODOs, TBD markers, or "decision pending" notes in zettel bodies.
Classify each as: blocking (must be resolved before implementation) or non-blocking (future milestone).
Cite the exact text and zettel ID for each.`,
  },
]

log(`Running ${DIMENSIONS.length} semantic check dimensions in parallel`)

const dimensionResults = await pipeline(
  DIMENSIONS,
  dim => agent(
    `You are auditing a zettel spec library for: ${dim.label}

Library: ${library_name} (kind: ${library_kind})
${focusNote}

CORPUS (${corpus.length} zettels):
${corpusJson}

TASK: ${dim.prompt}

Be thorough. A missed extraction leads to a missed conflict. Cite exact quotes — never paraphrase.
When uncertain whether two claims conflict, report as low-confidence rather than suppressing.`,
    { label: dim.label, phase: 'Semantic checks', schema: FINDINGS_SCHEMA }
  )
)

const allFindings = dimensionResults
  .filter(Boolean)
  .flatMap(r => r.findings || [])

log(`${allFindings.length} raw findings — adversarially verifying high/medium-confidence ones`)

// Adversarially verify non-open-question findings with confidence high or medium
const toVerify = allFindings
  .map((f, i) => ({ ...f, _idx: i }))
  .filter(f => f.kind !== 'open-question' && (f.confidence === 'high' || f.confidence === 'medium'))

const verdicts = await pipeline(
  toVerify,
  f => agent(
    `You are a skeptical reviewer. Try to REFUTE the following spec audit finding.
Default to is_real: false if you are uncertain.

Finding #${f._idx}:
Kind: ${f.kind}
Zettels: ${f.slugs.join(', ')}
Description: ${f.description}
${f.quote_a ? `Quote A: "${f.quote_a}"` : ''}
${f.quote_b ? `Quote B: "${f.quote_b}"` : ''}

CORPUS:
${corpusJson}

Is this finding a genuine issue in the spec, or is it a false positive (the zettels are actually consistent)?
Return is_real: true only if you are confident the conflict is real after re-reading the relevant zettels.`,
    { label: `verify:${f._idx}`, phase: 'Adversarial verify', schema: VERDICT_SCHEMA }
  )
)

const confirmedIdxs = new Set(
  verdicts.filter(Boolean).filter(v => v.is_real).map(v => v.finding_index)
)

// Keep: open questions (not verified), low-confidence (not verified), confirmed findings
const verifiedFindings = allFindings.filter((f, i) => {
  const wasVerified = toVerify.find(tv => tv._idx === i)
  if (!wasVerified) return true  // open questions + low-confidence pass through
  return confirmedIdxs.has(i)
})

log(`${verifiedFindings.length} verified findings (${allFindings.length - verifiedFindings.length} false positives removed)`)

return {
  findings: verifiedFindings,
  raw_count: allFindings.length,
  verified_count: verifiedFindings.length,
  false_positives_removed: allFindings.length - verifiedFindings.length,
  by_kind: {
    contradiction: verifiedFindings.filter(f => f.kind === 'contradiction').length,
    stale_claim: verifiedFindings.filter(f => f.kind === 'stale-claim').length,
    unspecced_dependency: verifiedFindings.filter(f => f.kind === 'unspecced-dependency').length,
    terminology: verifiedFindings.filter(f => f.kind === 'terminology').length,
    open_question: verifiedFindings.filter(f => f.kind === 'open-question').length,
  },
}
