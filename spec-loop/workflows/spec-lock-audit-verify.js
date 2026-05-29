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
const { proposed_fixes, library_path } = args

if (!proposed_fixes || proposed_fixes.length === 0) {
  return { approved: [], rejected: [] }
}

log(`Verifying ${proposed_fixes.length} proposed fix(es) with 2 independent reviewers each`)

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

Issue: ${fix.issue_kind}
Zettel: ${fix.zettel_id} (${fix.zettel_path})
Problem: ${fix.issue_description}
Proposed fix: ${fix.proposed_change}

Library path: ${library_path}

Read the zettel at ${fix.zettel_path}. Then evaluate:
1. Is this fix MINIMAL — does it change only what's needed to resolve the issue?
2. Is this fix CORRECT — does it actually resolve the stated issue without introducing new problems?
3. Is this fix SAFE — does it avoid changing the zettel's core claims unless that's explicitly what the issue requires?

Approve if the fix is minimal, correct, and safe.
Reject if: the fix is overly broad, changes things it shouldn't, doesn't actually solve the problem, or the issue itself is a false positive.`,
      { label: `review-${n}:${fix.zettel_id}`, phase: 'Verify fixes', schema: VERDICT_SCHEMA }
    )))

    const valid = reviews.filter(Boolean)
    const approvedCount = valid.filter(v => v.approved).length

    // Require both reviewers to approve (conservative — spec edits should be high-confidence)
    const approved = approvedCount >= 2
    const concerns = valid.filter(v => !v.approved).map(v => v.concern).filter(Boolean)
    const alternatives = valid.filter(v => !v.approved && v.alternative).map(v => v.alternative)

    return {
      ...fix,
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
