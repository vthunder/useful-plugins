export const meta = {
  name: 'spec-build-impl',
  description: 'Implement spec-build gaps in parallel: plan touched files, cluster file-disjoint, implement each cluster in an isolated worktree',
  phases: [
    { title: 'Plan', detail: 'Predict the files/migrations each gap will touch (read-only)' },
    { title: 'Implement', detail: 'One worktree agent per file-disjoint cluster' },
  ],
}

// args: {
//   gaps: Array<{ id, test_name, test_file, zettel_id?, claim?, failure_summary }>,
//   repo_root: string,
//   library_path: string,
//   test_cmd: string,            // e.g. "cargo test"
//   migration_base: number,      // first free migration number (e.g. 19)
//   migrations_dir?: string,     // default "migrations"
// }
const { gaps, repo_root, library_path, test_cmd, migration_base, migrations_dir, base_sha } = args
const migDir = migrations_dir || 'migrations'

if (!gaps || gaps.length === 0) {
  return { clusters: [], note: 'no gaps' }
}

// ── Phase 1: plan (parallel, read-only) ─────────────────────────────────────
const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    files: { type: 'array', items: { type: 'string' }, description: 'repo-relative source files this gap will likely create or edit (exclude test files)' },
    needs_migrations: { type: 'number', description: 'how many new DB migration files this gap needs (0 if none)' },
    summary: { type: 'string', description: 'one-line implementation approach' },
  },
  required: ['id', 'files', 'needs_migrations'],
}

const plans = await pipeline(
  gaps,
  g => agent(
    `You are PLANNING (not implementing) the fix for one failing spec test. Read-only.

Gap ${g.id}: test ${g.test_name} in ${g.test_file}
${g.zettel_id ? `Spec: ${g.zettel_id} claim ${g.claim || '?'}` : ''}
Failure: ${g.failure_summary || ''}
Repo root: ${repo_root}   Zettel library: ${library_path}

Read the test, the referenced zettel claim, and the production code involved. Then predict:
1. files — the repo-relative PRODUCTION source files you would create or edit to make this test pass (NOT test files). Be precise and complete; integration correctness depends on this list capturing every shared dispatch point (command enums, parsers, routers) you'd touch.
2. needs_migrations — how many new SQL migration files the fix requires (0 if none).
3. summary — one line on the approach.

Do NOT edit anything. Return the structured plan only.`,
    { label: `plan:${g.id}`, phase: 'Plan', schema: PLAN_SCHEMA }
  )
)

const validPlans = plans.filter(Boolean)

// ── Cluster: union gaps that share any production file ───────────────────────
const parent = {}
const find = x => (parent[x] === x ? x : (parent[x] = find(parent[x])))
const union = (a, b) => { parent[find(a)] = find(b) }
validPlans.forEach(p => { parent[p.id] = p.id })
const fileOwner = {}
for (const p of validPlans) {
  for (const f of (p.files || [])) {
    if (fileOwner[f] != null) union(p.id, fileOwner[f])
    else fileOwner[f] = p.id
  }
}
const clusterMap = {}
for (const p of validPlans) {
  const root = find(p.id)
  ;(clusterMap[root] ||= []).push(p)
}
const clusters = Object.values(clusterMap)

// Pre-assign disjoint migration number ranges per cluster.
let nextMig = migration_base
const clusterSpecs = clusters.map((members, i) => {
  const migCount = members.reduce((s, p) => s + (p.needs_migrations || 0), 0)
  const migStart = nextMig
  nextMig += migCount
  return {
    index: i,
    branch: `spec-build/cluster-${i}`,
    members,
    files: [...new Set(members.flatMap(p => p.files || []))],
    migration_start: migStart,
    migration_count: migCount,
  }
})

log(`${gaps.length} gaps → ${clusterSpecs.length} file-disjoint cluster(s); migrations ${migration_base}..${nextMig - 1}`)

// ── Phase 2: implement (parallel, isolated worktrees) ────────────────────────
const IMPL_SCHEMA = {
  type: 'object',
  properties: {
    index: { type: 'number' },
    branch: { type: 'string' },
    committed: { type: 'boolean', description: 'true if changes were committed on the branch' },
    tests_passed: { type: 'boolean', description: 'true if every target test for this cluster passes' },
    failing_tests: { type: 'array', items: { type: 'string' } },
    touched_files: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
  required: ['index', 'branch', 'committed', 'tests_passed'],
}

const results = await parallel(clusterSpecs.map(c => () => agent(
  `You are IMPLEMENTING one file-disjoint cluster of spec gaps, in an isolated git worktree. Make the target tests pass with minimal production changes. Do NOT modify test files. Do NOT edit zettels.

WORKTREE SETUP (do this FIRST, exactly):
- You are in an isolated worktree, but it may have been forked from a STALE commit. The integration base is ${base_sha || '<base_sha not provided — ask orchestrator>'}.
- Run \`git rev-parse HEAD\`. If it is not ${base_sha || 'the integration base'}, run \`git reset --hard ${base_sha || '<base_sha>'}\` so your tree matches the branch that carries the target tests (otherwise the tests/ dir and recent source will be missing and you cannot verify your work).
- Then: \`git switch -c ${c.branch}\`

WORKTREE ISOLATION (hard rules — violating these corrupts the shared repo):
- Operate ONLY inside your current worktree directory. Run every git/cargo command from here.
- NEVER cd to or run git against the main checkout (${repo_root}). NEVER \`git switch\`/commit onto any branch other than ${c.branch}. NEVER \`git add -A\` outside this worktree.
- Commit only to ${c.branch}. The orchestrator integrates branches; you never merge.

Target gaps (make each test pass):
${c.members.map(p => `- ${p.id}: ${p.summary || ''} (files: ${(p.files || []).join(', ') || '?'})`).join('\n')}

For each gap: read the test (its file is in the gap list passed to planning) and the referenced zettel claim under ${library_path}; implement the minimal production change. Search for the real module/dispatch site; create code where it belongs.

MIGRATIONS: if you need new SQL migrations, this cluster OWNS the number range starting at ${String(c.migration_start).padStart(4, '0')} (you may use up to ${c.migration_count} file(s)): name them ${migDir}/${String(c.migration_start).padStart(4, '0')}_*.sql, then ${String(c.migration_start + 1).padStart(4, '0')}_*.sql, etc. Do NOT use any other number — other clusters own theirs.

Stay within this cluster's files where possible: ${c.files.join(', ') || '(discover)'}. If you must touch a file you didn't expect, note it (it may indicate a clustering miss).

When done:
1. Build and run THIS cluster's target tests with: ${test_cmd} <test filters> (run only your gaps' tests).
2. Fix until they pass (max 3 attempts each). If one can't pass, leave its test untouched and report it in failing_tests.
3. git add -A && git commit -m "impl(cluster ${c.index}): <summary>"  (one commit is fine).

Return the structured result (branch, committed, tests_passed, failing_tests, touched_files, notes). Your committed branch is the deliverable; the orchestrator integrates branches serially.`,
  { label: `impl:cluster-${c.index}`, phase: 'Implement', schema: IMPL_SCHEMA, isolation: 'worktree' }
)))

const valid = results.filter(Boolean)
return {
  clusters: clusterSpecs.map(c => ({ index: c.index, branch: c.branch, files: c.files, gaps: c.members.map(m => m.id), migration_start: c.migration_start, migration_count: c.migration_count })),
  results: valid,
  migration_base,
  migration_next: nextMig,
  integrated: valid.filter(r => r.committed && r.tests_passed).map(r => r.branch),
  needs_attention: valid.filter(r => !r.tests_passed).map(r => ({ branch: r.branch, failing: r.failing_tests, notes: r.notes })),
}
