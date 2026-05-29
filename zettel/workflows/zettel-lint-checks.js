export const meta = {
  name: 'zettel-lint-checks',
  description: 'Run all 6 zettel-lint structural checks in parallel across all registered libraries',
  phases: [
    { title: 'Lint checks', detail: 'Six structural checks run concurrently' },
    { title: 'Synthesize', detail: 'Merge findings into the lint report' },
  ],
}

// args: {
//   libraries: Array<{
//     name: string,
//     path: string,
//     kind: string,
//     zettels: Array<{ id, title, tags, links, external_links, source?, path }>
//   }>
// }
const { libraries } = args

const librariesJson = JSON.stringify(libraries)
const totalZettels = libraries.reduce((s, l) => s + l.zettels.length, 0)

log(`Running 6 lint checks across ${libraries.length} librar${libraries.length === 1 ? 'y' : 'ies'} (${totalZettels} zettels) in parallel`)

const CHECK_SCHEMA = {
  type: 'object',
  properties: {
    check: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          library: { type: 'string' },
          zettel_id: { type: 'string' },
          zettel_title: { type: 'string' },
          description: { type: 'string' },
          suggestion: { type: 'string' },
          partner_id: { type: 'string', description: 'For cross-ref pairs: the second zettel ID' },
          shared_tags: { type: 'array', items: { type: 'string' }, description: 'For cross-ref pairs' },
        },
        required: ['library', 'zettel_id', 'description', 'suggestion'],
      },
    },
  },
  required: ['check', 'findings'],
}

const CHECKS = [
  {
    key: 'orphans',
    label: 'Check 1: Orphaned zettels',
    prompt: `Find zettels with no incoming links — no other zettel in the same library points to them via a links: field, and they don't appear in any other zettel's body.
Do NOT flag a zettel as orphaned purely because it only appears in external_links: fields — cross-library references are intentionally one-way.
For each orphan: suggest either linking it into an existing cluster or reviewing whether it should exist.`,
  },
  {
    key: 'cross-refs',
    label: 'Check 2: Missing cross-references',
    prompt: `Find pairs of zettels within the SAME library that share 2 or more tags but are not linked to each other (neither zettel's links: field contains the other).
Cross-library pairs are intentionally not bidirectionally linked — skip them.
For each unlinked pair: report both IDs, the shared tags, and suggest running zettel-link.`,
  },
  {
    key: 'stale-sources',
    label: 'Check 3: Stale sources',
    prompt: `Find zettels with a source: frontmatter field pointing to a file path that no longer exists on disk.
For each: check if the path in source: exists. Report any that are missing.
Suggest updating the source path or clearing it if provenance is unrecoverable.`,
  },
  {
    key: 'tag-drift',
    label: 'Check 4: Tag drift',
    prompt: `Find tags that appear in only one zettel across the entire corpus (all libraries combined).
These singletons are likely one-offs that should be normalized to an existing tag or dropped.
For each singleton tag: report the tag name and the single zettel that uses it. Suggest merging with a similar existing tag or removing.`,
  },
  {
    key: 'moc-gaps',
    label: 'Check 5: Tag clusters with no MOC',
    prompt: `Find tags that appear in 5 or more zettels within a single library but have no corresponding moc-<tag>.md file in that library's path.
Dense clusters without a MOC have outgrown ad-hoc linking.
For each: report the tag, zettel count, and the missing MOC filename. Suggest running zettel-index <tag>.`,
  },
  {
    key: 'external-links',
    label: 'Check 6: Broken external links',
    prompt: `For each zettel with an external_links: field, verify that each listed ID exists in any of the resolved libraries (check all library paths).
Report any external_links: entries that don't match an existing zettel ID in any library.
Suggest updating or removing broken entries.`,
  },
]

const checkResults = await parallel(
  CHECKS.map(c => () => agent(
    `You are running a zettel corpus health check: ${c.label}

ALL REGISTERED LIBRARIES:
${librariesJson}

TASK: ${c.prompt}

Be thorough. Check every zettel. Return structured findings — an empty findings array is a valid (clean) result.`,
    { label: c.label, phase: 'Lint checks', schema: CHECK_SCHEMA }
  ))
)

const allFindings = checkResults
  .filter(Boolean)
  .flatMap(r => r.findings || [])

const by_check = Object.fromEntries(
  checkResults
    .filter(Boolean)
    .map(r => [r.check, (r.findings || []).length])
)

return {
  findings: allFindings,
  by_check,
  total_issues: allFindings.length,
}
