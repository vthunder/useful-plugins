export const meta = {
  name: 'spec-test-author',
  description: 'Reconcile tests to spec (author new, re-author changed, quarantine orphaned), one agent per file, in parallel',
  phases: [
    { title: 'Reconcile tests', detail: 'Per file: author new stubs, re-author changed claims, quarantine orphans' },
  ],
}

// args: {
//   stub_files: Array<{ file, zettel_ids: string[], new?: string[], changed?: string[], orphaned?: string[] }>,
//   library_path: string,
//   conventions?: string,
// }
const { stub_files, library_path, conventions } = args

if (!stub_files || stub_files.length === 0) {
  log('No files to reconcile — suite already matches the spec.')
  return { results: [], total_authored: 0, total_reauthored: 0, total_orphaned: 0 }
}

log(`Reconciling tests to spec across ${stub_files.length} file(s) in parallel`)

const RESULT_SCHEMA = {
  type: 'object',
  properties: {
    file: { type: 'string' },
    authored: { type: 'number', description: 'new stubs turned into real failing tests' },
    reauthored: { type: 'number', description: 'tests whose body was rewritten to a changed claim' },
    orphaned_quarantined: { type: 'number', description: 'tests marked orphaned (claim removed)' },
    passed_immediately: { type: 'number', description: 'new/changed tests that already pass' },
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

const conventionsNote = conventions
  ? `Suite conventions (mirror these): ${conventions}`
  : 'Infer fixtures and assertion style from existing real (non-ignored) tests in the same file/dir before authoring.'

const results = await pipeline(
  stub_files,
  f => agent(
    `You are the spec-test-author step, reconciling ONE test file to the current spec. You make the tests faithfully encode the current claims — you do NOT write production code.

File: ${f.file}
Related zettels (read claims here): ${library_path}  — zettel ids: ${(f.zettel_ids || []).join(', ')}
${conventionsNote}

Work items in this file:
- NEW (author real test from claim, remove #[ignore]): ${JSON.stringify(f.new || [])}
- CHANGED (rewrite body to the CURRENT claim, drop FIXME): ${JSON.stringify(f.changed || [])}
- ORPHANED (quarantine, do not delete): ${JSON.stringify(f.orphaned || [])}
(If a list is empty, also scan the file for any other ignored stub / FIXME-marked / drifted test and handle it the same way.)

PROCEDURE:
1. Read ${f.file} fully and read 2-3 existing REAL (non-ignored) tests to learn fixtures, client, seed helpers, imports, assertion style.
2. For each work item, read the referenced zettel and extract the EXACT current claim by TEXT (claim numbers shift — match on meaning, not number).
3. Apply:
   - NEW: write a real arrange/act/assert body encoding the claim; remove the #[ignore]/"stub" marker.
   - CHANGED: replace the existing body so it encodes the CURRENT claim; update the "spec: <id> claim <N> — <text>" comment to the current number+text; remove any "FIXME: claim changed" comment. (It should now fail until the feature is implemented.)
   - ORPHANED: do NOT delete. Change its attribute to #[ignore = "orphaned: claim removed — review for deletion"], leave the body intact, and list it in "orphans".

HARD RULES:
- Author/modify TESTS ONLY. Never write or modify production/source code, and never edit zettels.
- Exercise the system at the SAME boundary as sibling tests — black-box via CLI/SSH exec, HTTP, PTY, SQL (information_schema, table queries). NEVER call internal symbols that may not exist; that breaks compilation instead of failing cleanly.
- Authored/re-authored tests must COMPILE and then FAIL for the right reason (assertion failure / expected "feature absent" error). Red-because-unimplemented is the goal.
- Encode exactly the current claim — don't weaken to pass, don't assert unspecified behavior. One claim per test.
- Use time-relative seeding (e.g. SQL date_trunc('week', CURRENT_DATE)) instead of hardcoded "current" dates.
- If a test cannot be authored faithfully at the test boundary without breaking compilation, leave/restore its prior marker and record it in could_not_author with BOTH a concrete reason AND a suggested_resolution (what would make it authorable: a harness capability like mock-hq / multi-identity SSH / clock injection, a spec change, or rescoping the claim). Never leave the suite uncompilable, and never silently drop an unauthorable claim without a resolution path.

Your edits to the file are the deliverable; the returned text is just the structured summary.`,
    { label: `reconcile:${f.file.split('/').pop()}`, phase: 'Reconcile tests', schema: RESULT_SCHEMA }
  )
)

const valid = results.filter(Boolean)

return {
  results: valid,
  total_authored: valid.reduce((s, r) => s + (r.authored || 0), 0),
  total_reauthored: valid.reduce((s, r) => s + (r.reauthored || 0), 0),
  total_orphaned: valid.reduce((s, r) => s + (r.orphaned_quarantined || 0), 0),
  total_could_not_author: valid.reduce((s, r) => s + ((r.could_not_author || []).length), 0),
  orphans: valid.flatMap(r => (r.orphans || []).map(x => ({ file: r.file, ...x }))),
  could_not_author: valid.flatMap(r => (r.could_not_author || []).map(x => ({ file: r.file, ...x }))),
}
