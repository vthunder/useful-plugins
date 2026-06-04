---
name: spec-lock
description: "Loop 1 orchestrator: audit changed zettels, fix issues, generate test stubs, and commit. Trigger: 'spec-lock', 'lock the spec', 'audit and test the spec', 'run spec-lock'."
user-invocable: true
---

# spec-lock

Audit the zettel spec library for issues, fix them, and generate test stubs for every changed zettel. Loop until the audit is clean and every changed zettel has `tests:` frontmatter coverage. Commit the result.

## Library resolution

Find the zettel library using this order:

1. Check `.zettel-libraries.yaml` in cwd (also `.claude/zettel-libraries.yaml`).
2. Check `~/.config/zettel/libraries.yaml`.
3. Fall back to `./docs/zettel/`.

The target library is the one marked `default: true`, or the first entry whose `kind` is `release-spec`, or the first entry overall. Note the resolved `path` — this is `<library-path>` in steps below.

## Inputs

- Optional: `--since <ref>` — git ref to diff against (default: `HEAD`, meaning changes staged/unstaged relative to the last commit; if the working tree is clean, use the parent commit `HEAD~1`).
- Optional: `--library <name>` — override library selection by name.

## Step 0 — Reconcile spec-patch markers (deferred-verification paydown)

`spec-patch` (the fast lane) ships small changes — bug fixes and behavior tweaks — on a thinner guarantee: a proven red→green test, with the spec-side work *deferred*, not skipped. Each such test carries a marker comment:

```
// spec-patch: unreconciled — <zettel-id | "spec-silent"> — <YYYY-MM-DD> — <one-line description>
```

Before anything else, redeem those IOUs. Grep the test directory:

```
grep -rn "spec-patch: unreconciled" <test-dir>
```

If there are none, skip to Step 1. Otherwise, for **each** marked test, **actively reconcile it** — the goal is to *finish the reconciliation*, including asking the user when a judgment call is needed; never merely fail because markers exist:

1. **Ensure spec coverage.**
   - `spec-silent` → draft a one-line claim describing the now-correct behavior and **ask the user to confirm or edit it** before writing it to the appropriate zettel (pick by topic/tags; ask if unclear). Never invent a claim silently.
   - `<zettel-id>` given → re-read that zettel. If the patch changed what a claim says, update the claim text to match the shipped behavior (this is a spec change — treat it like any audited edit). If a claim already covers it correctly, no edit is needed.
2. **Run the deferred adversarial verification** the fast lane skipped, on this patch test — the same panels the normal loop applies: the completeness check (is the claim now stubbed/tested?) and the semantic coverage review (would this test, if green, prove its claim at full strength?). Reuse the existing workflows where they fit: once the claim is stamped, the test-gen completeness pass (Step 3) picks it up, and spec-test-author's coverage verification covers the test on the next stage. At minimum, judge each patch test here for `too_weak` / `over_asserts` / `wrong_boundary` and flag any that wouldn't prove their claim.
3. **On success** — claim present and test verified — rewrite the marker to a normal spec reference comment (`spec: <id> claim <N> — <text>`) and ensure the zettel's `tests:` frontmatter includes the file. The unreconciled marker is now gone.
4. **On a problem** — the patch test is weak/over-asserts, or the user can't confirm a claim — fold it into this run's normal work: the weak test joins the items spec-test-author will re-author; an unresolved claim is surfaced like any blocking spec gap. Do **not** strip the marker until it's genuinely resolved.

Add every zettel touched here to `changed_zettels` (Step 1) so the rest of this run — audit, stub-gen, completeness — applies to them too. After this step, each former patch is either folded into the spec and verified, or surfaced as an explicit gate item; no marker silently survives a completed loop.

## Step 1 — Detect changed zettels

Run:
```
git diff --name-only <ref> -- <library-path>
```

If `--since` was given, use that ref. Otherwise:
- If the working tree has uncommitted changes, use `git diff --name-only HEAD -- <library-path>` (unstaged) and `git diff --name-only --cached -- <library-path>` (staged), union the results.
- If the working tree is clean (no staged or unstaged changes), use `git diff --name-only HEAD~1 HEAD -- <library-path>`.

Filter to files matching `*.md` and exclude `INDEX.md` and `moc-*.md`.

Record the list as `changed_zettels` (list of file paths), **unioned with any zettels added by Step 0's patch reconciliation**.

If `changed_zettels` is empty *and* Step 0 found no spec-patch markers, report "No changed zettels detected since <ref>." and exit cleanly — do not proceed to audit or commit. (If Step 0 reconciled patches, continue even when the diff alone shows no changed zettels — the patch-touched zettels are the work.)

## Step 2 — Audit loop

Run the `zettel-audit` skill on the library. Capture the output.

Interpret the audit result:
- **Clean**: no errors or warnings. Proceed to step 3.
- **Issues found**: the audit lists one or more problems (contradictions, broken links, interface mismatches, stale claims, open questions marked as blocking).

For each issue found:
1. Identify which zettel(s) are implicated.
2. Formulate a proposed fix (minimal change that resolves the audit finding):
   - Broken link → remove the link from `links:` frontmatter.
   - Contradiction between two zettels → update the zettel whose claim is stale (prefer updating the older zettel, unless the audit identifies which is authoritative).
   - Interface mismatch → reconcile the described interface with the implementation by updating the zettel body.
   - Stale claim → update the zettel body to reflect current behavior.
   - Blocking open question → surface it to the user as a spec gap and **do not proceed** until answered. Non-blocking open questions: note them and continue.
3. Before applying fixes, resolve the workflow script path (`spec-loop@useful-plugins` installPath from `~/.claude/plugins/installed_plugins.json`, then `<installPath>/workflows/spec-lock-audit-verify.js`). **Write the proposed fixes to a file, then pass the file path** (uniform file contract — never inline the list). Write a JSON array — one object per fix `{ issue_kind, zettel_path, zettel_id, issue_description, proposed_change }` (`issue_kind` ∈ broken-link | contradiction | stale-claim | interface-mismatch) — to an absolute path (e.g. `<repo>/.spec-loop/audit-fixes.json`), then invoke Workflow with:
   ```json
   {
     "fixes_file": "<abs path to audit-fixes.json>",
     "fix_count": <N>,
     "library_path": "<library path>"
   }
   ```
   The workflow returns `approved` and `rejected` arrays; each entry carries `fix_index` (its position in the file) and `zettel_id` — map `approved[].fix_index` back to the fixes you wrote. Apply only the `approved` fixes. For `rejected` fixes, report the reviewer concerns to the user — do not apply them silently.
4. Apply the approved fixes using `zettel-edit`.
5. After applying fixes, re-run `zettel-audit`. Each cycle, fix only the **new** findings (don't re-litigate ones already decided in an earlier cycle).

**Termination — stochastic audit.** The semantic audit is stochastic: each pass surfaces a different subset of findings, so "one pass returns zero" is not a stable fixed point and re-running can keep surfacing pre-existing, unrelated drift. Track the set of findings across passes and stop when a pass surfaces **no new findings** versus the previous pass (i.e. two consecutive passes with no new items), OR after the 5-cycle safety limit, whichever comes first. Here "clean" means "no new findings," not "a single pass returned zero."

**Audit scope — blast radius.** Target the audit at the changed zettels' **blast radius**: the changed zettels themselves, plus zettels that link to/from them and those sharing their tags or domain vocabulary — rather than necessarily the whole library. This keeps the loop from repeatedly surfacing unrelated historical drift. A full-library audit remains available when explicitly requested.

**Safety limit:** If the audit is still surfacing new findings after 5 fix-and-reaudit cycles, stop and report all remaining issues to the user for manual resolution. Do not commit partial work.

## Step 3 — Test generation (parallel)

Resolve the workflow script path: read `~/.claude/plugins/installed_plugins.json`, find the entry for `spec-loop@useful-plugins`, and take its `installPath`. The script is at `<installPath>/workflows/spec-lock-test-gen.js`.

**Write the changed-zettel paths to a file, then pass the file path.** Write a JSON array of the zettel path strings to an absolute path (e.g. `<repo>/.spec-loop/zettels.json`), then invoke the Workflow tool with `scriptPath` set to that resolved path, passing:

```json
{
  "zettels_file": "<abs path to zettels.json>",
  "zettel_count": <N>,
  "library_path": "<resolved library path>",
  "test_dir": "<test dir if known, else omit>"
}
```

> **Uniform file contract.** Every spec-loop workflow takes its list as a *file path + count*, never an inline array — so you never have to judge payload size or split invocations, and the large per-item data never travels through the prompt (each agent reads only the entry it needs). Always write the file, regardless of how few items there are.

The workflow runs `spec-test-gen` on all changed zettels in parallel, retries any that fail to stamp `tests:` frontmatter, then runs an **always-on completeness check** (two blind critics re-enumerate each zettel's testable claims and a reconciler keeps only the claims BOTH independently flag as unstubbed — a 2/2 vote). Any confirmed-missing claim is remediated (stubs re-generated) and re-verified once. It returns:
- `results` — per-zettel summary (stubs written, test files, covered flag)
- `uncovered` — list of zettel paths that still lack `tests:` frontmatter after retry
- `total_stubs_written`, `total_stubs_updated`
- `completeness` — per-zettel post-remediation verdict (`confirmed_missing`, `confirmed_spurious`)
- `incomplete` — zettels with claims STILL missing a stub after remediation: `[{ zettel_path, missing_claims }]`. Each missing claim must be **labeled blocking or advisory** (see Step 4); only **blocking** items are a hard stop.
- `spurious_stubs` — stubs that map to no current claim (review items, non-blocking)
- `total_missing_remediated` — count of missing claims the completeness pass recovered

Wait for the workflow to complete before proceeding.

## Step 4 — Coverage check (hard gate)

Inspect the workflow result:
- Any path in `uncovered` represents a zettel that failed to get `tests:` frontmatter after retry. Report it and continue (do not block the commit on this alone).
- All other zettels in `results` with `covered: true` are done.

**Label each incomplete item before gating.** The completeness critics re-enumerate ALL claims in a zettel, so editing one claim can surface pre-existing untested claims the change never touched. Label each item in `incomplete`:
- **blocking** — the claim is NEW or CHANGED in this revision: a genuine coverage hole the change introduced.
- **advisory** — a pre-existing untested claim surfaced incidentally; the change didn't touch it.

New-vs-pre-existing is determined by whether the claim text is new or changed in the revision being locked — check the git diff of the zettel since the base ref (`<ref>` from Step 1).

**Only blocking items are a hard gate.** If any **blocking** item exists, the completeness critics confirmed (2/2) a new/changed testable claim with no test even after remediation — a silent coverage hole the loop exists to prevent. **Do not commit and do not proceed to spec-test-author.** Stop and surface each blocking item:

```
⛔ COMPLETENESS GATE — N new/changed testable claim(s) have no test after remediation:
  <zettel-id> (<zettel_path>)
    - <missing claim description>  [why testable: <category>]
  ...
Your call per item: (a) add the missing test stub manually (or fix spec-test-gen's conventions so it can) and re-run spec-lock, or
(b) revise the zettel so the claim is no longer a standalone testable assertion, or
(c) explicitly accept it as a known coverage gap and re-run spec-lock with the claim removed from scope.
```

This mirrors the other spec-loop gates: the skill stops and lets the human decide; it does not silently ship an uncovered claim. Wait for the user's decision — do not proceed on your own.

**Advisory items do not block.** Report them under "pre-existing coverage holes (non-blocking)" so the user can backfill later, and continue past the gate:

```
Pre-existing coverage holes (non-blocking) — untested claims the change didn't touch:
  <zettel-id> (<zettel_path>)
    - <missing claim description>
```

If `spurious_stubs` is non-empty, list them under "Review (non-blocking) — stubs with no matching claim:" so the user can prune stale tests later. Do not delete them automatically.

## Step 5 — Commit

Stage all changes:
```
git add <library-path>
git add tests/    (or whatever test dir was used)
```

Only stage files in `<library-path>` and in the test directory. Do not stage unrelated files.

Construct a commit message:
```
spec-lock: audit + test stubs for <N> changed zettel(s)

Changed zettels:
- <id>: <title>
- <id>: <title>

Audit fixes: <N> (or "none")
Test stubs added: <N>
Test stubs updated: <N>
Completeness: clean (or "recovered <N> missing claim(s)")
```

Commit with `git commit -m "..."`.

Reaching this step means the completeness gate passed (no **blocking** items); any blocking item would have stopped the skill at Step 4 before any commit. Advisory pre-existing holes, if any, are reported but do not block.

## Step 6 — Report

Print a final summary:

```
spec-lock complete
------------------
Library: <library-path>
Changed zettels: N
  - <id> — <title>

Audit cycles: N
Audit fixes applied: N

Test stubs written: N
Test stubs updated: N

Completeness check: 2 blind critics + reconcile per zettel
  Missing claims recovered (remediated): N
  Blocking missing after remediation: 0   (else the skill stopped at the Step 4 gate)
  Advisory pre-existing holes (non-blocking): N
  Spurious stubs flagged for review: N

Committed: <short SHA> — <commit message first line>
```

If any non-fatal gaps remain (non-blocking open questions, zettels with no testable claims, `uncovered` frontmatter failures, `spurious_stubs`), list them under "Remaining items for manual review:".

## Next step in the loop

spec-lock only *detects and marks* spec changes — it leaves new claims as **ignored `todo!()` stubs**, marks changed claims with `// FIXME: claim changed` (via spec-test-gen), and never deletes tests. None of those become real, correct, failing tests here. The loop continues:

1. **spec-test-author** — reconciles the suite to the current spec without writing production code: authors new stubs into real failing tests, re-authors changed-claim tests to the current claim, and quarantines orphaned tests whose claim was removed.
2. **spec-build** — implements production code until those tests pass.

Run `spec-test-author` next, then `spec-build`. To drive all three end-to-end (stopping at each human gate), run the `spec-loop` skill instead.
