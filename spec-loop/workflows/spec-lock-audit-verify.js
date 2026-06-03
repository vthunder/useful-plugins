export const meta = {
  name: 'spec-lock-audit-verify',
  description: 'Adversarially verify proposed spec-lock audit fixes before applying them',
  phases: [
    { title: 'Verify fixes', detail: 'Two independent reviewers check each proposed fix for correctness and minimal scope' },
  ],
}

// args (uniform file contract): { fixes_file: <abs path to JSON array of
// { issue_kind, zettel_path, zettel_id, issue_description, proposed_change }>,
// fix_count: N, library_path }
// The fix list ALWAYS lives in a file — never inline — so the caller never judges
// payload size or splits invocations. Only the path + count + library_path travel
// through args. Results carry `fix_index` so the caller maps verdicts back to the file.
function parseArgs(a) {
  if (a == null) return {}
  if (typeof a !== 'string') return a
  try {
    return JSON.parse(a)
  } catch (e) {
    throw new Error(
      `spec-loop/spec-lock-audit-verify: control args could not be parsed as JSON (got a ${a.length}-char string). ` +
      `Args should be tiny ({ fixes_file, fix_count, library_path }); the fix list belongs in the file. ` +
      `Underlying error: ${e.message}`
    )
  }
}

const A = parseArgs(args)
const { fixes_file, fix_count, library_path } = A

if (!fixes_file || !fix_count) {
  return { approved: [], rejected: [] }
}

// Each reviewer reads its own fix record [i] from the file.
const proposed_fixes = Array.from({ length: fix_count }, (_, i) => ({ _i: i }))

log(`Verifying ${fix_count} proposed fix(es) with 2 independent reviewers each (records from ${fixes_file})`)

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    zettel_id: { type: 'string' },
    approved: { type: 'boolean' },
    reason: { type: 'string' },
    concern: { type: 'string', description: 'If not approved: what is wrong with the proposed fix' },
    alternative: { type: 'string', description: 'If not approved: what the fix should be instead' },
  },
  required: ['zettel_id', 'approved', 'reason'],
}

const results = await pipeline(
  proposed_fixes,
  async fix => {
    // Two independent reviewers per fix
    const reviews = await parallel([0, 1].map(n => () => agent(
      `You are reviewer ${n + 1} of 2 for a spec-lock audit fix. Be skeptical.

Your proposed-fix record is element [${fix._i}] of the JSON array in the file:
  ${fixes_file}
Read that file, parse it, and use entry [${fix._i}] — fields: issue_kind, zettel_id, zettel_path, issue_description, proposed_change.

Library path: ${library_path}

Read the referenced zettel (the record's zettel_path). Then evaluate:
1. Is this fix MINIMAL — does it change only what's needed to resolve the issue?
2. Is this fix CORRECT — does it actually resolve the stated issue without introducing new problems?
3. Is this fix SAFE — does it avoid changing the zettel's core claims unless that's explicitly what the issue requires?

Approve if the fix is minimal, correct, and safe.
Reject if: the fix is overly broad, changes things it shouldn't, doesn't actually solve the problem, or the issue itself is a false positive.`,
      { label: `review-${n}:#${fix._i}`, phase: 'Verify fixes', schema: VERDICT_SCHEMA }
    )))

    const valid = reviews.filter(Boolean)
    const approvedCount = valid.filter(v => v.approved).length

    // Require both reviewers to approve (conservative — spec edits should be high-confidence)
    const approved = approvedCount >= 2
    const concerns = valid.filter(v => !v.approved).map(v => v.concern).filter(Boolean)
    const alternatives = valid.filter(v => !v.approved && v.alternative).map(v => v.alternative)

    // Return the index (so the caller maps back to the fix it wrote to the file)
    // plus the zettel_id the reviewers reported.
    return {
      fix_index: fix._i,
      zettel_id: (valid[0] && valid[0].zettel_id) || '',
      approved,
      reviewer_concerns: concerns,
      suggested_alternatives: alternatives,
    }
  }
)

const approved = results.filter(Boolean).filter(r => r.approved)
const rejected = results.filter(Boolean).filter(r => !r.approved)

if (rejected.length > 0) {
  log(`${rejected.length} fix(es) rejected by reviewers — surface to user before applying`)
}

return { approved, rejected }
