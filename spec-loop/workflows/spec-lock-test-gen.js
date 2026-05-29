export const meta = {
  name: 'spec-lock-test-gen',
  description: 'Parallel spec-test-gen across all changed zettels for spec-lock step 3',
  phases: [
    { title: 'Test gen', detail: 'Run spec-test-gen on each changed zettel in parallel' },
    { title: 'Coverage check', detail: 'Verify every zettel has tests: frontmatter or zero testable claims' },
  ],
}

// args: { zettels: string[], library_path: string, test_dir?: string }
const { zettels, library_path, test_dir } = args

if (!zettels || zettels.length === 0) {
  log('No changed zettels passed — nothing to do.')
  return { results: [], uncovered: [] }
}

log(`Running spec-test-gen on ${zettels.length} zettel(s) in parallel`)

const TEST_GEN_SCHEMA = {
  type: 'object',
  properties: {
    zettel_id: { type: 'string' },
    zettel_path: { type: 'string' },
    testable_claims: { type: 'number' },
    stubs_written: { type: 'number' },
    stubs_updated: { type: 'number' },
    test_files: { type: 'array', items: { type: 'string' } },
    covered: { type: 'boolean', description: 'true if tests: frontmatter was stamped or zero testable claims' },
    error: { type: 'string', description: 'Set if spec-test-gen failed for this zettel' },
  },
  required: ['zettel_path', 'testable_claims', 'stubs_written', 'stubs_updated', 'test_files', 'covered'],
}

const results = await pipeline(
  zettels,
  (zettel_path, _orig, i) => agent(
    `Run the spec-test-gen skill on this zettel file: ${zettel_path}
Library path: ${library_path}
${test_dir ? `Test directory override: ${test_dir}` : 'Use auto-detected test directory.'}

Follow the full spec-test-gen procedure:
1. Read the zettel completely.
2. Enumerate testable claims (behavioral assertions, commands, endpoints, DB fields, error conditions).
3. Search the test directory for existing coverage using grep on zettel ID and claim keywords.
4. Write new test stubs for uncovered claims; update stubs for changed claims; never delete existing tests.
5. Stamp the zettel's frontmatter with a tests: field listing all test files.
6. Return structured output.`,
    { label: `test-gen:${zettel_path.split('/').pop()}`, phase: 'Test gen', schema: TEST_GEN_SCHEMA }
  )
)

const valid = results.filter(Boolean)
const uncovered = valid.filter(r => !r.covered && !r.error)

if (uncovered.length > 0) {
  log(`Coverage gaps: ${uncovered.length} zettel(s) still missing tests: frontmatter — retrying`)

  const retried = await pipeline(
    uncovered,
    r => agent(
      `Retry spec-test-gen for ${r.zettel_path}. The first pass did not stamp tests: frontmatter.
Re-run the full spec-test-gen procedure. If there are genuinely zero testable claims, explicitly return covered: true with testable_claims: 0.`,
      { label: `retry:${r.zettel_path.split('/').pop()}`, phase: 'Coverage check', schema: TEST_GEN_SCHEMA }
    )
  )

  // Merge retry results back
  const retryById = Object.fromEntries(
    retried.filter(Boolean).map(r => [r.zettel_path, r])
  )
  for (let i = 0; i < valid.length; i++) {
    if (retryById[valid[i].zettel_path]) {
      valid[i] = retryById[valid[i].zettel_path]
    }
  }
}

const stillUncovered = valid.filter(r => !r.covered && !r.error)

return {
  results: valid,
  uncovered: stillUncovered.map(r => r.zettel_path),
  total_stubs_written: valid.reduce((s, r) => s + (r.stubs_written || 0), 0),
  total_stubs_updated: valid.reduce((s, r) => s + (r.stubs_updated || 0), 0),
}
