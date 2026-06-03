export const meta = {
  name: 'spec-lock-test-gen',
  description: 'Parallel spec-test-gen across all changed zettels for spec-lock step 3, with adversarial claim-completeness verification',
  phases: [
    { title: 'Test gen', detail: 'Run spec-test-gen on each changed zettel in parallel' },
    { title: 'Coverage check', detail: 'Verify every zettel has tests: frontmatter or zero testable claims' },
    { title: 'Completeness', detail: '2 blind critics + reconcile per zettel to catch silently dropped testable claims' },
    { title: 'Remediate', detail: 'Re-gen stubs for confirmed-missing claims, then re-verify residual' },
  ],
}

// args: { zettels: string[], library_path: string, test_dir?: string }
const _args = typeof args === 'string' ? JSON.parse(args) : (args || {})
const { zettels, library_path, test_dir } = _args

if (!zettels || zettels.length === 0) {
  log('No changed zettels passed — nothing to do.')
  return { results: [], uncovered: [], completeness: [], incomplete: [] }
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

const CRITIC_SCHEMA = {
  type: 'object',
  properties: {
    zettel_path: { type: 'string' },
    missing_claims: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string', description: 'one-sentence statement of the testable claim' },
          why_testable: { type: 'string', description: 'which rubric category makes this verifiable by code' },
        },
        required: ['description'],
      },
    },
    spurious_stubs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          test_fn: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['test_fn'],
      },
    },
  },
  required: ['zettel_path', 'missing_claims'],
}

const RECONCILE_SCHEMA = {
  type: 'object',
  properties: {
    zettel_path: { type: 'string' },
    confirmed_missing: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          why_testable: { type: 'string' },
        },
        required: ['description'],
      },
    },
    confirmed_spurious: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          test_fn: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['test_fn'],
      },
    },
  },
  required: ['zettel_path', 'confirmed_missing'],
}

const RUBRIC = `Testable = a command/subcommand exists & is callable; a flag/option is accepted; a DB column/table exists with a stated name/type; a specific input produces a specific output/return value; a state transition (state A + action B → state C); an HTTP endpoint returns a specific status/response shape; a config key controls a specific behavior; a constraint is enforced (uniqueness, foreign key, length limit); an error condition produces a specific message/code.
NOT testable = design rationale (why), human-workflow prose, aspirational/future scope, architecture restatement without concrete behavior, aesthetic/style guidance.`

const base = p => p.split('/').pop()
const emptyVerdict = path => ({ zettel_path: path, confirmed_missing: [], confirmed_spurious: [] })

// Run 2 independent blind critics + a reconcile (2/2 intersection) for one zettel.
// `test_files` is the current set of test files covering this zettel.
async function verifyCompleteness(zettel_path, test_files, phase) {
  const files = (test_files || []).join(', ') || '(none)'
  const critics = await parallel([0, 1].map(n => () => agent(
    `You are completeness critic ${n + 1} of 2 for spec test coverage. Work BLIND — do not assume any prior claim enumeration was correct or complete; re-derive everything yourself.

Zettel: ${zettel_path}
Test file(s) already written for it: ${files}
Library path: ${library_path}

TASK:
1. Read the zettel completely and independently enumerate EVERY testable claim, using this rubric:
${RUBRIC}
2. Read the listed test file(s). For each testable claim you found, decide whether a test (a real test OR an #[ignore]/todo stub) already covers it — match by BEHAVIOR/MEANING, never by claim number.
3. Report:
   - missing_claims: testable claims with NO corresponding test. Include why each is testable.
   - spurious_stubs: existing test stubs that do NOT map to any current testable claim (possible over-stubbing or a stale claim).

Be conservative: report a claim as missing only if you are confident it is BOTH testable under the rubric AND has no covering test.`,
    { label: `critic-${n}:${base(zettel_path)}`, phase, schema: CRITIC_SCHEMA }
  )))

  const valids = critics.filter(Boolean)
  // A failed critic means we cannot establish a 2/2 agreement — fail safe to "nothing confirmed"
  // rather than block on one critic's unverified list.
  if (valids.length < 2) {
    if (valids.length === 1 && (valids[0].missing_claims || []).length > 0) {
      log(`⚠ ${base(zettel_path)}: only 1 critic returned — cannot confirm 2/2, treating as inconclusive`)
    }
    return emptyVerdict(zettel_path)
  }

  const a = valids[0].missing_claims || []
  const b = valids[1].missing_claims || []
  if (a.length === 0 && b.length === 0) {
    return emptyVerdict(zettel_path)
  }

  // Reconcile: only claims BOTH critics independently flagged survive (2/2 vote), matched by meaning.
  const rec = await agent(
    `Two independent critics each listed testable claims they believe have NO test in this zettel. Return ONLY the claims that BOTH critics independently identified — the 2/2 intersection — matched by MEANING (wording will differ between them). Drop any claim only one critic raised. Intersect spurious_stubs the same way.

Zettel: ${zettel_path}
Test file(s): ${files}
Library path: ${library_path}

Critic 1 missing_claims: ${JSON.stringify(a)}
Critic 2 missing_claims: ${JSON.stringify(b)}
Critic 1 spurious_stubs: ${JSON.stringify(valids[0].spurious_stubs || [])}
Critic 2 spurious_stubs: ${JSON.stringify(valids[1].spurious_stubs || [])}

Before confirming a claim, RE-READ the zettel and the test file(s) and verify it really is testable under the rubric and really has no covering test. Only include claims you can verify are genuinely uncovered.
${RUBRIC}`,
    { label: `reconcile:${base(zettel_path)}`, phase, schema: RECONCILE_SCHEMA }
  )

  return rec || emptyVerdict(zettel_path)
}

// ── Phase 1+2: generate stubs, then retry zettels that failed to stamp frontmatter ──
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
    { label: `test-gen:${base(zettel_path)}`, phase: 'Test gen', schema: TEST_GEN_SCHEMA }
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
      { label: `retry:${base(r.zettel_path)}`, phase: 'Coverage check', schema: TEST_GEN_SCHEMA }
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

// ── Phase 3: completeness critic (always-on) ──
const toCheck = valid.filter(r => !r.error)
log(`Completeness: 2 blind critics + reconcile on ${toCheck.length} zettel(s)`)

const filesByPath = Object.fromEntries(valid.map(r => [r.zettel_path, r.test_files || []]))

const completeness = (await pipeline(
  toCheck,
  r => verifyCompleteness(r.zettel_path, filesByPath[r.zettel_path], 'Completeness')
)).filter(Boolean)

// ── Phase 4: remediate confirmed-missing claims, then re-verify residual ──
const needsFix = completeness.filter(c => (c.confirmed_missing || []).length > 0)

if (needsFix.length > 0) {
  const totalMissing = needsFix.reduce((s, c) => s + c.confirmed_missing.length, 0)
  log(`Remediation: ${totalMissing} confirmed-missing claim(s) across ${needsFix.length} zettel(s) — re-generating stubs`)

  const remediated = await pipeline(
    needsFix,
    async c => {
      const regen = await agent(
        `Run spec-test-gen on ${c.zettel_path} to ADD coverage for these specific testable claims that were independently confirmed MISSING by two critics:
${c.confirmed_missing.map((m, i) => `  ${i + 1}. ${m.description}`).join('\n')}

Library path: ${library_path}
${test_dir ? `Test directory override: ${test_dir}` : 'Use auto-detected test directory.'}

Write a test stub for each missing claim (a real test or an #[ignore]/todo stub as appropriate to the project conventions). Never delete existing tests. Re-stamp the zettel's tests: frontmatter to include any new files. Return structured output.`,
        { label: `remediate:${base(c.zettel_path)}`, phase: 'Remediate', schema: TEST_GEN_SCHEMA }
      )
      const newFiles = regen && regen.test_files && regen.test_files.length
        ? regen.test_files
        : filesByPath[c.zettel_path]
      // Re-verify residual after the fix
      const residual = await verifyCompleteness(c.zettel_path, newFiles, 'Remediate')
      return { zettel_path: c.zettel_path, regen, residual }
    }
  )

  // Replace initial verdicts with post-remediation residual verdicts
  const residualByPath = Object.fromEntries(
    remediated.filter(Boolean).map(r => [r.zettel_path, r.residual])
  )
  for (let i = 0; i < completeness.length; i++) {
    const path = completeness[i].zettel_path
    if (residualByPath[path]) completeness[i] = residualByPath[path]
  }
}

const incomplete = completeness.filter(c => (c.confirmed_missing || []).length > 0)
const spurious = completeness.filter(c => (c.confirmed_spurious || []).length > 0)

if (incomplete.length > 0) {
  log(`⛔ ${incomplete.length} zettel(s) still have confirmed-missing claims after remediation — hard stop for spec-lock`)
}

return {
  results: valid,
  uncovered: stillUncovered.map(r => r.zettel_path),
  total_stubs_written: valid.reduce((s, r) => s + (r.stubs_written || 0), 0),
  total_stubs_updated: valid.reduce((s, r) => s + (r.stubs_updated || 0), 0),
  // Completeness verification results:
  completeness,
  incomplete: incomplete.map(c => ({ zettel_path: c.zettel_path, missing_claims: c.confirmed_missing })),
  spurious_stubs: spurious.map(c => ({ zettel_path: c.zettel_path, stubs: c.confirmed_spurious })),
  total_missing_remediated: needsFix.reduce((s, c) => s + c.confirmed_missing.length, 0),
}
