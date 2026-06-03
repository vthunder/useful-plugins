export const meta = {
  name: 'spec-build-gap-parse',
  description: 'Parallel classification of failing tests into gap report for spec-build step 3',
  phases: [
    { title: 'Classify gaps', detail: 'One agent per failing test to extract kind, spec ref, and failure summary' },
    { title: 'Verify ambiguous', detail: 'For tests classified ambiguous, spawn 3 interpreters to find a non-ambiguous reading' },
    { title: 'Synthesize', detail: 'Merge all classifications into the ordered gap report' },
  ],
}

// args: {
//   failing_tests: Array<{
//     name: string,
//     file: string,
//     line: number,
//     failure_output: string,   // first ~20 lines of failure output
//   }>,
//   library_path: string,
//   test_dir: string,
// }
// Parse args defensively. The runtime may deliver `args` as a JSON string (and can
// corrupt inline strings over ~500 chars). Failure outputs are bulky, so prefer the
// compact file contract: write the failing-test records to a JSON file and pass
// { failures_file: "<abs path>", failing_count: N } — see the skill's "compact args" note.
function parseArgs(a) {
  if (a == null) return {}
  if (typeof a !== 'string') return a
  try {
    return JSON.parse(a)
  } catch (e) {
    throw new Error(
      `spec-loop/spec-build-gap-parse: args could not be parsed as JSON (got a ${a.length}-char string). ` +
      `Failure-output blobs are bulky and inline args over ~500 chars can be corrupted in transit — ` +
      `write failing tests to a file and pass { failures_file, failing_count } instead. ` +
      `Underlying error: ${e.message}`
    )
  }
}

const A = parseArgs(args)
const { library_path, test_dir } = A
const failuresFile = A.failures_file
// File mode: index markers; each agent reads its own record from the file.
const failing = (A.failing_tests && A.failing_tests.length)
  ? A.failing_tests.map((t, i) => ({ ...t, _i: i }))
  : (failuresFile ? Array.from({ length: A.failing_count || 0 }, (_, i) => ({ _i: i, _file: failuresFile })) : [])

if (failing.length === 0) {
  return { gaps: [], gap_report: 'No failing tests to classify.' }
}

log(`Classifying ${failing.length} failing test(s) in parallel${failuresFile ? ` (from ${failuresFile})` : ''}`)

const GAP_SCHEMA = {
  type: 'object',
  properties: {
    test_name: { type: 'string' },
    file: { type: 'string' },
    line: { type: 'number' },
    kind: { type: 'string', enum: ['stub', 'assertion', 'compile', 'ambiguous'] },
    spec_zettel_id: { type: 'string', description: 'Zettel ID from spec: comment, or empty string' },
    spec_claim_number: { type: 'number', description: 'Claim number from spec: comment, or 0' },
    spec_claim_description: { type: 'string', description: 'Claim description from spec: comment, or empty string' },
    failure_summary: { type: 'string', description: 'One-sentence summary of the failure' },
    ambiguity_reason: { type: 'string', description: 'If kind=ambiguous: what is unclear in the spec' },
  },
  required: ['test_name', 'file', 'kind', 'failure_summary'],
}

const INTERPRETATION_SCHEMA = {
  type: 'object',
  properties: {
    test_name: { type: 'string' },
    is_truly_ambiguous: { type: 'boolean' },
    non_ambiguous_interpretation: { type: 'string', description: 'If is_truly_ambiguous=false: the correct interpretation of the spec' },
    reason: { type: 'string' },
  },
  required: ['test_name', 'is_truly_ambiguous', 'reason'],
}

// Step 1: classify all failing tests in parallel
const recordBlock = t => t._file
  ? `Your failing-test record is element [${t._i}] of the JSON array in the file:
  ${t._file}
Read that file, parse it, and use entry [${t._i}] — it has fields: name, file, line, failure_output. Use them as Test name / File / line / Failure output below.`
  : `Test name: ${t.name}
File: ${t.file}:${t.line}
Failure output:
${t.failure_output}`

const classifications = await pipeline(
  failing,
  (t, _orig, i) => agent(
    `Classify this failing test for spec-build gap analysis.

${recordBlock(t)}

Library path: ${library_path}
Test dir: ${test_dir}

CLASSIFICATION TASK:
1. Read the test file (the record's \`file\`) to see the full test body and any spec: comment above/inside the test.
2. Extract: spec zettel ID, claim number, and description from any comment of the form:
   "spec: <zettel-id> claim <N> — <description>"
3. Classify the failure kind:
   - stub: body is todo!(), test.todo, or raise NotImplementedError (unimplemented spec item)
   - assertion: a real assertion failed (regression or behavior mismatch)
   - compile: code does not compile (missing type, function, or module)
   - ambiguous: failure suggests the spec itself is unclear or contradictory
4. For ambiguous: describe exactly what is unclear (what two interpretations are possible).

Return structured output (test_name and file come from the record).`,
    { label: t._file ? `classify:#${t._i}` : `classify:${t.name}`, phase: 'Classify gaps', schema: GAP_SCHEMA }
  )
)

const gaps = classifications.filter(Boolean)

// Step 2: adversarially verify ambiguous classifications
// For each ambiguous gap, spawn 3 independent interpreters to try to find a non-ambiguous reading
const ambiguous = gaps.filter(g => g.kind === 'ambiguous')

if (ambiguous.length > 0) {
  log(`${ambiguous.length} ambiguous classification(s) — running 3-interpreter verification`)

  const verifications = await pipeline(
    ambiguous,
    async g => {
      const interpretations = await parallel([0, 1, 2].map(n => () => agent(
        `You are interpreter ${n + 1} of 3. Try to find a CLEAR, NON-AMBIGUOUS reading of the spec for this failing test.
Default to is_truly_ambiguous: true only if you genuinely cannot find a coherent interpretation.

Test: ${g.test_name}
File: ${g.file}
Failure: ${g.failure_summary}
${g.spec_zettel_id ? `Spec ref: ${g.spec_zettel_id} claim ${g.spec_claim_number} — ${g.spec_claim_description}` : 'No spec reference found.'}
${g.ambiguity_reason ? `Claimed ambiguity: ${g.ambiguity_reason}` : ''}

Library path: ${library_path}

Read the referenced zettel (if any) and any related zettels. Try to resolve the ambiguity.`,
        { label: `interp-${n}:${g.test_name}`, phase: 'Verify ambiguous', schema: INTERPRETATION_SCHEMA }
      )))

      const valid = interpretations.filter(Boolean)
      const nonAmbiguousCount = valid.filter(v => !v.is_truly_ambiguous).length

      // If 2+ of 3 interpreters found a non-ambiguous reading, downgrade to assertion/stub
      if (nonAmbiguousCount >= 2) {
        const winner = valid.find(v => !v.is_truly_ambiguous)
        return { ...g, kind: 'assertion', ambiguity_resolved: winner.non_ambiguous_interpretation }
      }
      return g  // stays ambiguous
    }
  )

  // Replace ambiguous gaps with resolved ones
  const resolvedByName = Object.fromEntries(
    verifications.filter(Boolean).map(r => [r.test_name, r])
  )
  for (let i = 0; i < gaps.length; i++) {
    if (resolvedByName[gaps[i].test_name]) {
      gaps[i] = resolvedByName[gaps[i].test_name]
    }
  }
}

// Step 3: sort into processing order — compile first, then stub, then assertion, ambiguous last
const kindOrder = { compile: 0, stub: 1, assertion: 2, ambiguous: 3 }
gaps.sort((a, b) => (kindOrder[a.kind] ?? 3) - (kindOrder[b.kind] ?? 3))

const by_kind = {
  stub: gaps.filter(g => g.kind === 'stub').length,
  assertion: gaps.filter(g => g.kind === 'assertion').length,
  compile: gaps.filter(g => g.kind === 'compile').length,
  ambiguous: gaps.filter(g => g.kind === 'ambiguous').length,
}

const gap_report_lines = [
  `Gap Report`,
  `------------------------`,
  `Total failing: ${gaps.length}`,
  '',
  ...gaps.map((g, i) => [
    `[${i + 1}] ${g.test_name}`,
    `    Kind: ${g.kind}`,
    g.spec_zettel_id
      ? `    Spec: ${g.spec_zettel_id} claim ${g.spec_claim_number} — ${g.spec_claim_description}`
      : `    Spec: no spec reference`,
    `    File: ${g.file}${g.line ? ':' + g.line : ''}`,
    `    Message: ${g.failure_summary}`,
    g.ambiguity_resolved ? `    Resolved interpretation: ${g.ambiguity_resolved}` : '',
  ].filter(Boolean).join('\n')),
]

return {
  gaps,
  by_kind,
  gap_report: gap_report_lines.join('\n'),
}
