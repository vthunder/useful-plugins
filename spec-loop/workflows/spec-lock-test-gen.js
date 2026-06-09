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

// args (uniform file contract): { zettels_file: <abs path to JSON array of zettel
// paths>, zettel_count: N, library_path: string, test_dir?: string }
// The array ALWAYS lives in a file — the workflow never receives it inline — so the
// caller never has to judge payload size or split invocations, and the per-zettel data
// never travels through the prompt (each agent reads only the entry it needs).
function parseArgs(a) {
  if (a == null) return {}
  if (typeof a !== 'string') return a
  try {
    return JSON.parse(a)
  } catch (e) {
    throw new Error(
      `spec-loop/spec-lock-test-gen: control args could not be parsed as JSON (got a ${a.length}-char string). ` +
      `Args should be tiny ({ zettels_file, zettel_count, library_path, test_dir }); the zettel list belongs in the file. ` +
      `Underlying error: ${e.message}`
    )
  }
}

const { zettels_file, zettel_count, library_path, test_dir, base_ref } = parseArgs(args)
// Ref the changed zettels are diffed against, so remediation can tell which
// confirmed-missing claims are NEW/changed in this revision (stub those) vs
// PRE-EXISTING (report as a backlog, never auto-stub). Defaults to HEAD.
const baseRef = base_ref || 'HEAD'

if (!zettels_file || !zettel_count) {
  log('No zettels_file/zettel_count passed — nothing to do.')
  return { results: [], uncovered: [], completeness: [], incomplete: [] }
}

const zettelIdx = Array.from({ length: zettel_count }, (_, i) => i)
log(`Running spec-test-gen on ${zettel_count} zettel(s) in parallel (paths from ${zettels_file})`)

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
NOT testable = design rationale (why), human-workflow prose, aspirational/future scope, architecture restatement without concrete behavior, aesthetic/style guidance.
NON-NORMATIVE (never derive a claim from it, even if it reads testable) = any text the author explicitly marked descriptive: a section whose heading carries a \`(presentational)\`, \`(advisory)\`, \`(non-normative)\`, or \`(implementation-note)\` marker, and any blockquote (\`>\`) aside. These are out of scope for claim enumeration entirely.\``

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
  zettelIdx,
  i => agent(
    `Run the spec-test-gen skill on one changed zettel.

Your zettel file path is element [${i}] of the JSON array of path strings in the file:
  ${zettels_file}
Read that file, parse it, and take entry [${i}] — that path is the zettel to process.

Library path: ${library_path}
${test_dir ? `Test directory override: ${test_dir}` : 'Use auto-detected test directory.'}

Follow the full spec-test-gen procedure:
1. Read the zettel completely.
2. Enumerate testable claims (behavioral assertions, commands, endpoints, DB fields, error conditions).
3. Search the test directory for existing coverage using grep on zettel ID and claim keywords.
4. Write new test stubs for uncovered claims; update stubs for changed claims; never delete existing tests.
5. Stamp the zettel's frontmatter with a tests: field listing all test files.
6. Return structured output, with zettel_path set to the exact path you processed.`,
    { label: `test-gen:#${i}`, phase: 'Test gen', schema: TEST_GEN_SCHEMA }
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

// ── Phase 4: remediate — but DELTA-SCOPED. Only claims that are NEW/changed in
// this revision get stubbed; PRE-EXISTING confirmed-missing claims (old, untouched
// coverage debt the critics surfaced by re-reading the whole zettel) are reported
// as a backlog and NEVER auto-stubbed — so a small edit to a long-lived zettel
// doesn't dump a pile of stubs to manually revert. New-vs-pre-existing is decided
// per claim from the zettel's diff against baseRef.
const needsFix = completeness.filter(c => (c.confirmed_missing || []).length > 0)
const preExistingGaps = []   // { zettel_path, claims: [{ description }] }
let totalStubbedNew = 0

if (needsFix.length > 0) {
  const totalMissing = needsFix.reduce((s, c) => s + c.confirmed_missing.length, 0)
  log(`Remediation: ${totalMissing} confirmed-missing claim(s) across ${needsFix.length} zettel(s) — stubbing NEW/changed ones, reporting pre-existing as backlog (base ${baseRef})`)

  const REMEDIATE_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
      test_files: { type: 'array', items: { type: 'string' } },
      stubbed_new: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { description: { type: 'string' } }, required: ['description'] } },
      pre_existing: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { description: { type: 'string' } }, required: ['description'] } },
      still_missing_new: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { description: { type: 'string' }, reason: { type: 'string' } }, required: ['description'] } },
    },
    required: ['test_files', 'stubbed_new', 'pre_existing', 'still_missing_new'],
  }

  const remediated = await pipeline(
    needsFix,
    async c => {
      const reg = await agent(
        `Two critics independently confirmed these testable claims have NO test in ${c.zettel_path}:
${c.confirmed_missing.map((m, i) => `  ${i + 1}. ${m.description}`).join('\n')}

STEP 1 — classify each claim as NEW or PRE-EXISTING:
- Run \`git diff ${baseRef} -- ${c.zettel_path}\` and read the zettel to see what text this revision added/changed.
- NEW = the claim's supporting claim/prose text was ADDED or CHANGED in this revision.
- PRE-EXISTING = the claim's text was already in the zettel before this revision (untouched by this edit) — old coverage debt.
- If you genuinely cannot tell, treat it as NEW (safer to cover than to silently skip).

STEP 2 — act:
- For each NEW claim: write a test stub (a real test or an #[ignore]/todo stub per project conventions) and re-stamp the zettel's tests: frontmatter to include any new files. List these in \`stubbed_new\`. If you truly could not write a stub for a NEW claim, list it in \`still_missing_new\` with a reason.
- For each PRE-EXISTING claim: write NOTHING — just list it in \`pre_existing\`. It is reported as a backlog, not part of this change.

Never delete existing tests. Library path: ${library_path}. ${test_dir ? `Test directory: ${test_dir}.` : 'Use the auto-detected test directory.'}
Return structured output.`,
        { label: `remediate:${base(c.zettel_path)}`, phase: 'Remediate', schema: REMEDIATE_SCHEMA }
      )
      return { zettel_path: c.zettel_path, reg }
    }
  )

  // Fold back: a zettel's residual incomplete = only NEW claims still missing;
  // its pre-existing claims become backlog (they never gate, never get stubs).
  for (const r of remediated.filter(Boolean)) {
    const stillNew = (r.reg && r.reg.still_missing_new) || []
    const pre = (r.reg && r.reg.pre_existing) || []
    totalStubbedNew += ((r.reg && r.reg.stubbed_new) || []).length
    const idx = completeness.findIndex(c => c.zettel_path === r.zettel_path)
    if (idx >= 0) {
      completeness[idx] = {
        zettel_path: r.zettel_path,
        confirmed_missing: stillNew,
        confirmed_spurious: completeness[idx].confirmed_spurious || [],
      }
    }
    if (pre.length) preExistingGaps.push({ zettel_path: r.zettel_path, claims: pre })
  }
}

const incomplete = completeness.filter(c => (c.confirmed_missing || []).length > 0)
const spurious = completeness.filter(c => (c.confirmed_spurious || []).length > 0)

if (incomplete.length > 0) {
  log(`⛔ ${incomplete.length} zettel(s) have NEW/changed claims still missing a test after remediation — hard stop for spec-lock`)
}
if (preExistingGaps.length > 0) {
  const n = preExistingGaps.reduce((s, g) => s + g.claims.length, 0)
  log(`ℹ ${n} pre-existing coverage gap(s) across ${preExistingGaps.length} zettel(s) reported as backlog (not stubbed)`)
}

return {
  results: valid,
  uncovered: stillUncovered.map(r => r.zettel_path),
  total_stubs_written: valid.reduce((s, r) => s + (r.stubs_written || 0), 0),
  total_stubs_updated: valid.reduce((s, r) => s + (r.stubs_updated || 0), 0),
  // Completeness verification results:
  completeness,
  incomplete: incomplete.map(c => ({ zettel_path: c.zettel_path, missing_claims: c.confirmed_missing })),
  // Pre-existing coverage debt the critics surfaced but that this revision did NOT
  // touch — reported as a backlog, never auto-stubbed. Non-blocking.
  pre_existing_gaps: preExistingGaps,
  spurious_stubs: spurious.map(c => ({ zettel_path: c.zettel_path, stubs: c.confirmed_spurious })),
  total_missing_remediated: totalStubbedNew,
}
