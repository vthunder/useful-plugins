export const meta = {
  name: 'spec-lock-audit-verify',
  description: 'Adversarially verify proposed spec-lock audit fixes before applying them',
  phases: [
    { title: 'Verify fixes', detail: 'Two independent reviewers check each proposed fix for correctness and minimal scope' },
  ],
}

// args: {
//   proposed_fixes: Array<{
//     issue_kind: string,        // 'broken-link' | 'contradiction' | 'stale-claim' | 'interface-mismatch'
//     zettel_path: string,
//     zettel_id: string,
//     issue_description: string,
//     proposed_change: string,   // natural-language description of the edit
//   }>,
//   library_path: string,
// }
// Parse args defensively. The runtime may deliver `args` as a JSON string (and can
// corrupt inline strings over ~500 chars). Fix descriptions can be long, so prefer the
// compact file contract: write proposed fixes to a JSON file and pass
// { fixes_file: "<abs path>", fix_count: N } — see the skill's "compact args" note.
function parseArgs(a) {
  if (a == null) return {}
  if (typeof a !== 'string') return a
  try {
    return JSON.parse(a)
  } catch (e) {
    throw new Error(
      `spec-loop/spec-lock-audit-verify: args could not be parsed as JSON (got a ${a.length}-char string). ` +
      `Fix descriptions can be long and inline args over ~500 chars can be corrupted in transit — ` +
      `write proposed_fixes to a file and pass { fixes_file, fix_count } instead. ` +
      `Underlying error: ${e.message}`
    )
  }
}

const A = parseArgs(args)
const { library_path } = A
const fixesFile = A.fixes_file
// File mode: index markers; each reviewer reads its own fix record from the file.
const proposed_fixes = (A.proposed_fixes && A.proposed_fixes.length)
  ? A.proposed_fixes.map((f, i) => ({ ...f, _i: i }))
  : (fixesFile ? Array.from({ length: A.fix_count || 0 }, (_, i) => ({ _i: i, _file: fixesFile })) : [])

if (proposed_fixes.length === 0) {
  return { approved: [], rejected: [] }
}

log(`Verifying ${proposed_fixes.length} proposed fix(es) with 2 independent reviewers each${fixesFile ? ` (from ${fixesFile})` : ''}`)

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
    const fixBlock = fix._file
      ? `Your proposed-fix record is element [${fix._i}] of the JSON array in the file:
  ${fix._file}
Read that file, parse it, and use entry [${fix._i}] — fields: issue_kind, zettel_id, zettel_path, issue_description, proposed_change.`
      : `Issue: ${fix.issue_kind}
Zettel: ${fix.zettel_id} (${fix.zettel_path})
Problem: ${fix.issue_description}
Proposed fix: ${fix.proposed_change}`
    // Two independent reviewers per fix
    const reviews = await parallel([0, 1].map(n => () => agent(
      `You are reviewer ${n + 1} of 2 for a spec-lock audit fix. Be skeptical.

${fixBlock}

Library path: ${library_path}

Read the referenced zettel (the record's zettel_path). Then evaluate:
1. Is this fix MINIMAL — does it change only what's needed to resolve the issue?
2. Is this fix CORRECT — does it actually resolve the stated issue without introducing new problems?
3. Is this fix SAFE — does it avoid changing the zettel's core claims unless that's explicitly what the issue requires?

Approve if the fix is minimal, correct, and safe.
Reject if: the fix is overly broad, changes things it shouldn't, doesn't actually solve the problem, or the issue itself is a false positive.`,
      { label: `review-${n}:${fix._file ? '#' + fix._i : fix.zettel_id}`, phase: 'Verify fixes', schema: VERDICT_SCHEMA }
    )))

    const valid = reviews.filter(Boolean)
    const approvedCount = valid.filter(v => v.approved).length

    // Require both reviewers to approve (conservative — spec edits should be high-confidence)
    const approved = approvedCount >= 2
    const concerns = valid.filter(v => !v.approved).map(v => v.concern).filter(Boolean)
    const alternatives = valid.filter(v => !v.approved && v.alternative).map(v => v.alternative)

    // Inline mode echoes the full fix; file mode returns the index (so the skill can
    // map back to the fix it wrote) plus the zettel_id the reviewers reported.
    const identity = fix._file
      ? { fix_index: fix._i, zettel_id: (valid[0] && valid[0].zettel_id) || '' }
      : fix

    return {
      ...identity,
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
