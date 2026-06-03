export const meta = {
  name: 'spec-test-author',
  description: 'Reconcile tests to spec (author new, re-author changed, quarantine orphaned), one agent per file, in parallel',
  phases: [
    { title: 'Reconcile tests', detail: 'Per file: author new stubs, re-author changed claims, quarantine orphans' },
    { title: 'Verify coverage', detail: '2 reviewers per file judge whether each authored test would actually prove its claim (green ⟺ claim satisfied)' },
    { title: 'Strengthen', detail: 'Re-author tests a reviewer flagged as weak coverage, then re-verify' },
  ],
}

// args (uniform file contract): { files_file: <abs path to JSON array of test-file
// paths>, file_count: N, library_path: string }
// The path list ALWAYS lives in a file — never inline — so the caller never judges
// payload size or splits invocations. Each agent self-discovers the NEW/CHANGED/
// ORPHANED work by scanning its own file (the stub markers and `spec:` comments live
// there), and infers conventions from sibling real tests — so no per-fn lists or
// conventions blob need to travel through args at all.
function parseArgs(a) {
  if (a == null) return {}
  if (typeof a !== 'string') return a
  try {
    return JSON.parse(a)
  } catch (e) {
    throw new Error(
      `spec-loop/spec-test-author: control args could not be parsed as JSON (got a ${a.length}-char string). ` +
      `Args should be tiny ({ files_file, file_count, library_path }); the test-file list belongs in the file. ` +
      `Underlying error: ${e.message}`
    )
  }
}

const A = parseArgs(args)
const { files_file, file_count, library_path } = A

if (!files_file || !file_count) {
  log('No files_file/file_count passed — suite already matches the spec.')
  return { results: [], total_authored: 0, total_reauthored: 0, total_orphaned: 0 }
}

const fileIdx = Array.from({ length: file_count }, (_, i) => i)
log(`Reconciling tests to spec across ${file_count} file(s) in parallel (paths from ${files_file})`)

const RESULT_SCHEMA = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    authored: { type: 'number', description: 'new stubs turned into real failing tests' },
    reauthored: { type: 'number', description: 'tests whose body was rewritten to a changed claim' },
    orphaned_quarantined: { type: 'number', description: 'tests marked orphaned (claim removed)' },
    passed_immediately: { type: 'number', description: 'new/changed tests that already pass' },
    authored_tests: {
      type: 'array',
      description: 'every NEW or re-authored test that is now a REAL test (exclude orphaned and still-#[ignore] stubs), each with the claim it encodes — this is the input to semantic verification',
      items: {
        type: 'object',
        properties: {
          fn: { type: 'string' },
          zettel_claim: { type: 'string', description: 'the "spec: <id> claim <N> — <text>" this test is meant to encode' },
        },
        required: ['fn', 'zettel_claim'],
      },
    },
    could_not_author: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fn: { type: 'string' },
          zettel_claim: { type: 'string' },
          reason: { type: 'string', description: 'concrete reason it cannot be authored at the test boundary' },
          suggested_resolution: { type: 'string', description: 'what would make it authorable: harness capability, spec change, or rescope' },
        },
        required: ['fn', 'reason', 'suggested_resolution'],
      },
    },
    orphans: {
      type: 'array',
      items: {
        type: 'object',
        properties: { fn: { type: 'string' }, zettel_claim: { type: 'string' } },
        required: ['fn'],
      },
    },
    notes: { type: 'string' },
  },
  required: ['file', 'authored', 'reauthored', 'orphaned_quarantined'],
}

const results = await pipeline(
  fileIdx,
  i => agent(
    `You are the spec-test-author step, reconciling ONE test file to the current spec. You make the tests faithfully encode the current claims — you do NOT write production code.

Your test file path is element [${i}] of the JSON array of path strings in the file:
  ${files_file}
Read that file, parse it, and take entry [${i}] — that is the test file you reconcile. Call it FILE below.

Related zettels (read claims here): ${library_path}  — the zettel id(s) for each test are in its "spec: <id> claim <N>" comment.

Discover the work yourself by scanning FILE:
- NEW: any ignored stub (#[ignore]="stub: not yet implemented" + todo!()/test.todo/raise NotImplementedError) → author a real test from the claim, remove #[ignore].
- CHANGED: any real test carrying "FIXME: claim changed", OR any real test whose body no longer matches its referenced claim (drift) → rewrite the body to the CURRENT claim, update the "spec: <id> claim <N> — <text>" comment, remove the FIXME.
- ORPHANED: any real test whose "spec: <id> claim <N>" no longer maps to an existing zettel/claim → quarantine, do NOT delete.

PROCEDURE:
1. Read FILE fully and read 2-3 existing REAL (non-ignored) tests in it (or the same dir) to learn fixtures, client, seed helpers, imports, assertion style — mirror them.
2. For each work item, read the referenced zettel and extract the EXACT current claim by TEXT (claim numbers shift — match on meaning, not number).
3. Apply:
   - NEW: write a real arrange/act/assert body encoding the claim; remove the #[ignore]/"stub" marker.
   - CHANGED: replace the existing body so it encodes the CURRENT claim; update the "spec: <id> claim <N> — <text>" comment to the current number+text; remove any "FIXME: claim changed" comment. (It should now fail until the feature is implemented.)
   - ORPHANED: do NOT delete. Change its attribute to #[ignore = "orphaned: claim removed — review for deletion"], leave the body intact, and list it in "orphans".

HARD RULES:
- Author/modify TESTS ONLY. Never write or modify production/source code, and never edit zettels.
- NEVER DELETE A TEST FUNCTION. Every claim that had a stub keeps a function in the file. The number of test functions must NOT decrease — it only stays the same (stub → real, or stub stays #[ignore]) or grows. Before finishing, re-read the file and confirm every fn you started with is still present.
- Exercise the system at the SAME boundary as sibling tests — black-box via CLI/SSH exec, HTTP, PTY, SQL (information_schema, table queries). NEVER call internal symbols that may not exist; that breaks compilation instead of failing cleanly.
- Authored/re-authored tests must COMPILE and then FAIL for the right reason (assertion failure / expected "feature absent" error). Red-because-unimplemented is the goal.
- Encode exactly the current claim — don't weaken to pass, don't assert unspecified behavior. One claim per test.
- Use time-relative seeding (e.g. SQL date_trunc('week', CURRENT_DATE)) instead of hardcoded "current" dates.
- If a test cannot be authored faithfully at the test boundary without breaking compilation, the function MUST remain in the file as an #[ignore] stub (restore it verbatim if you removed or edited it — do NOT delete it), and you record it in could_not_author with BOTH a concrete reason AND a suggested_resolution (what would make it authorable: a harness capability like mock-hq / multi-identity SSH / clock injection, a spec change, or rescoping the claim). Never leave the suite uncompilable, and never drop an unauthorable claim — a could_not_author entry without a surviving #[ignore] function in the file is a failure.

Self-check before returning: count the test functions in FILE at the start and at the end — the count must NOT decrease (every function still present, whether authored, re-authored, or left as #[ignore]); none were deleted. Your edits to the file are the deliverable; the returned text is just the structured summary.

In the structured summary, set \`file\` to FILE's path, and populate authored_tests with EVERY test you turned into a real test (NEW + CHANGED, but NOT orphaned and NOT ones left as #[ignore] stubs), each with its fn name and the exact "spec: <id> claim <N> — <text>" it encodes. This list is fed to an independent reviewer who checks that each test would actually prove its claim.`,
    { label: `reconcile:#${i}`, phase: 'Reconcile tests', schema: RESULT_SCHEMA }
  )
)

const valid = results.filter(Boolean)

// ─────────────────────────────────────────────────────────────────────────────
// Semantic coverage verification (always-on).
// A test that passes but doesn't actually prove its claim is a false guarantee.
// Authored tests are RED now (feature unimplemented), so judge STATICALLY:
// "if this test were to pass, would that prove the claim at the claim's strength?"
//
// Two-tier vote (hard-stop posture): ANY ONE reviewer flagging a test as weak
// triggers a cheap strengthen retry; a weakness CONFIRMED BY BOTH reviewers after
// the retry is a hard gate ("authored but weak") that blocks handoff to spec-build.
// Conservative default: faithful unless clearly weak — mirrors the ambiguity verifier.
// ─────────────────────────────────────────────────────────────────────────────

const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fn: { type: 'string' },
          faithful: { type: 'boolean', description: 'true if, were this test to pass, it would prove the claim at the strength the claim implies' },
          issue: { type: 'string', enum: ['none', 'too_weak', 'over_asserts', 'wrong_boundary', 'no_exercise'] },
          detail: { type: 'string', description: 'one line on what is wrong (if issue != none)' },
          suggested_strengthening: { type: 'string', description: 'concrete change that would make the test faithfully prove the claim' },
        },
        required: ['fn', 'faithful', 'issue'],
      },
    },
  },
  required: ['file', 'verdicts'],
}

const base = p => p.split('/').pop()
const SUBSTANTIVE = new Set(['too_weak', 'over_asserts', 'wrong_boundary', 'no_exercise'])

// Files with at least one real authored/re-authored test to verify.
const toVerify = valid.filter(r => (r.authored_tests || []).length > 0)

function verifyPrompt(n, file, tests) {
  return `You are semantic-coverage reviewer ${n + 1} of 2. The tests below were just authored to encode spec claims. They are currently RED (the feature is not implemented yet), so do NOT run them — judge STATICALLY by reading the test body and the claim:

  "If this test were to PASS, would that prove the claim — at the strength the claim implies?"

File: ${file}
Zettel claims live under: ${library_path}  — each test's "spec: <id> claim <N>" names its zettel.
Tests to judge (fn → the claim it should encode):
${tests.map(t => `  - ${t.fn} :: ${t.zettel_claim}`).join('\n')}

For EACH listed fn: read its body in ${file}, read the referenced claim, and assign one issue:
- none         — the test faithfully proves the claim at its full strength.
- too_weak     — passing would NOT establish the claim (asserts less than the claim, only checks setup, tautological/constant assertion, ignores the key output).
- over_asserts — asserts behavior the claim does NOT state (couples the test to incidental details; a faithful impl could fail it).
- wrong_boundary — exercises a different layer than the claim is about, or calls internal symbols instead of the black-box boundary sibling tests use.
- no_exercise  — does not actually trigger the claimed behavior at all.

Be CONSERVATIVE: default faithful=true / issue=none unless the test is CLEARLY weak. When you flag an issue, give a concrete suggested_strengthening. Judge only the listed fns.`
}

async function verifyFile(file, tests, phase) {
  const reviews = await parallel([0, 1].map(n => () => agent(
    verifyPrompt(n, file, tests),
    { label: `verify-${n}:${base(file)}`, phase, schema: VERIFY_SCHEMA }
  )))
  return reviews.filter(Boolean)
}

// Returns per-fn aggregate: { flaggedBy (0..2), worstIssue, strengthenings[] }
function aggregate(reviews, tests) {
  const byFn = {}
  for (const t of tests) byFn[t.fn] = { fn: t.fn, zettel_claim: t.zettel_claim, flaggedBy: 0, issues: [], strengthenings: [] }
  for (const rev of reviews) {
    for (const v of (rev.verdicts || [])) {
      const rec = byFn[v.fn]
      if (!rec) continue
      if (v.faithful === false && SUBSTANTIVE.has(v.issue)) {
        rec.flaggedBy += 1
        rec.issues.push(v.issue)
        if (v.suggested_strengthening) rec.strengthenings.push(v.suggested_strengthening)
      }
    }
  }
  return Object.values(byFn)
}

let weakHardGate = []   // confirmed-weak after strengthen (2/2) — blocks spec-build
let strengthenedCount = 0

if (toVerify.length > 0) {
  log(`Semantic verify: 2 reviewers on authored tests across ${toVerify.length} file(s)`)

  const perFile = await pipeline(
    toVerify,
    async r => {
      const tests = r.authored_tests
      const reviews1 = await verifyFile(r.file, tests, 'Verify coverage')
      const agg1 = aggregate(reviews1, tests)

      // 1/2 trigger: any reviewer flag → attempt a strengthen retry for those fns.
      const toStrengthen = agg1.filter(a => a.flaggedBy >= 1)
      if (toStrengthen.length === 0) {
        return { file: r.file, weak: [], strengthened: 0 }
      }

      await agent(
        `Reviewers flagged these tests in ${r.file} as WEAK coverage of their claim. Re-author ONLY these tests so each faithfully proves its claim at full strength. Tests only — never production code, never edit zettels, never weaken an assertion to pass, stay at the same black-box boundary as sibling tests, keep the test RED-for-the-right-reason (feature absent). Do not touch any other test, and do not delete any function.

Zettel claims live under: ${library_path}  — each flagged test's "spec: <id> claim <N>" names its zettel.
Flagged tests:
${toStrengthen.map(a => `  - ${a.fn} :: ${a.zettel_claim}\n      issue(s): ${a.issues.join(', ')}\n      fix: ${a.strengthenings.join(' | ') || '(strengthen to assert the full claim)'}`).join('\n')}`,
        { label: `strengthen:${base(r.file)}`, phase: 'Strengthen', schema: RESULT_SCHEMA }
      )
      strengthenedCount += toStrengthen.length

      // Re-verify only the strengthened fns.
      const reTests = toStrengthen.map(a => ({ fn: a.fn, zettel_claim: a.zettel_claim }))
      const reviews2 = await verifyFile(r.file, reTests, 'Strengthen')
      const agg2 = aggregate(reviews2, reTests)

      // 2/2 confirm post-retry = hard gate.
      const stillWeak = agg2.filter(a => a.flaggedBy >= 2).map(a => ({
        file: r.file,
        fn: a.fn,
        zettel_claim: a.zettel_claim,
        issue: a.issues[0] || 'too_weak',
        detail: a.strengthenings.join(' | '),
      }))
      return { file: r.file, weak: stillWeak, strengthened: toStrengthen.length }
    }
  )

  weakHardGate = perFile.filter(Boolean).flatMap(p => p.weak)
}

if (weakHardGate.length > 0) {
  log(`⛔ ${weakHardGate.length} test(s) still weak after strengthening (2/2) — hard gate before spec-build`)
}

return {
  results: valid,
  total_authored: valid.reduce((s, r) => s + (r.authored || 0), 0),
  total_reauthored: valid.reduce((s, r) => s + (r.reauthored || 0), 0),
  total_orphaned: valid.reduce((s, r) => s + (r.orphaned_quarantined || 0), 0),
  total_could_not_author: valid.reduce((s, r) => s + ((r.could_not_author || []).length), 0),
  orphans: valid.flatMap(r => (r.orphans || []).map(x => ({ file: r.file, ...x }))),
  could_not_author: valid.flatMap(r => (r.could_not_author || []).map(x => ({ file: r.file, ...x }))),
  // Semantic coverage verification:
  total_verified: toVerify.reduce((s, r) => s + (r.authored_tests || []).length, 0),
  total_strengthened: strengthenedCount,
  weak_coverage: weakHardGate,   // hard gate: authored tests that still don't prove their claim
}
