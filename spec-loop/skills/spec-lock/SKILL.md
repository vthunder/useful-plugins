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

## Step 1 — Detect changed zettels

Run:
```
git diff --name-only <ref> -- <library-path>
```

If `--since` was given, use that ref. Otherwise:
- If the working tree has uncommitted changes, use `git diff --name-only HEAD -- <library-path>` (unstaged) and `git diff --name-only --cached -- <library-path>` (staged), union the results.
- If the working tree is clean (no staged or unstaged changes), use `git diff --name-only HEAD~1 HEAD -- <library-path>`.

Filter to files matching `*.md` and exclude `INDEX.md` and `moc-*.md`.

If no changed zettels are found, report "No changed zettels detected since <ref>." and exit cleanly — do not proceed to audit or commit.

Record the list as `changed_zettels` (list of file paths).

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
3. Before applying fixes, resolve the workflow script path (`spec-loop@useful-plugins` installPath from `~/.claude/plugins/installed_plugins.json`, then `<installPath>/workflows/spec-lock-audit-verify.js`). Invoke the Workflow tool with `scriptPath` set to that path, passing all proposed fixes for this audit cycle as a batch:
   ```json
   {
     "proposed_fixes": [
       {
         "issue_kind": "broken-link | contradiction | stale-claim | interface-mismatch",
         "zettel_path": "<path>",
         "zettel_id": "<id>",
         "issue_description": "<what the audit found>",
         "proposed_change": "<natural-language description of the edit>"
       }
     ],
     "library_path": "<library path>"
   }
   ```
   The workflow returns `approved` and `rejected` arrays. Apply only the `approved` fixes. For `rejected` fixes, report the reviewer concerns to the user — do not apply them silently.
4. Apply the approved fixes using `zettel-edit`.
5. After applying fixes, re-run `zettel-audit`. Repeat until audit is clean.

**Safety limit:** If the audit is still not clean after 5 fix-and-reaudit cycles, stop and report all remaining issues to the user for manual resolution. Do not commit partial work.

## Step 3 — Test generation (parallel)

Resolve the workflow script path: read `~/.claude/plugins/installed_plugins.json`, find the entry for `spec-loop@useful-plugins`, and take its `installPath`. The script is at `<installPath>/workflows/spec-lock-test-gen.js`.

Invoke the Workflow tool with `scriptPath` set to that resolved path, passing:

```json
{
  "zettels": ["<path1>", "<path2>", ...],
  "library_path": "<resolved library path>",
  "test_dir": "<test dir if known, else omit>"
}
```

The workflow runs `spec-test-gen` on all changed zettels in parallel, retries any that fail to stamp `tests:` frontmatter, and returns:
- `results` — per-zettel summary (stubs written, test files, covered flag)
- `uncovered` — list of zettel paths that still lack coverage after retry
- `total_stubs_written`, `total_stubs_updated`

Wait for the workflow to complete before proceeding.

## Step 4 — Coverage check

Inspect the workflow result:
- Any path in `uncovered` represents a zettel that failed coverage after retry. Report it and continue (do not block the commit).
- All other zettels in `results` with `covered: true` are done.

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
```

Commit with `git commit -m "..."`.

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

Committed: <short SHA> — <commit message first line>
```

If any non-fatal gaps remain (non-blocking open questions, zettels with no testable claims, coverage failures), list them under "Remaining items for manual review:".

## Next step in the loop

spec-lock only *detects and marks* spec changes — it leaves new claims as **ignored `todo!()` stubs**, marks changed claims with `// FIXME: claim changed` (via spec-test-gen), and never deletes tests. None of those become real, correct, failing tests here. The loop continues:

1. **spec-test-author** — reconciles the suite to the current spec without writing production code: authors new stubs into real failing tests, re-authors changed-claim tests to the current claim, and quarantines orphaned tests whose claim was removed.
2. **spec-build** — implements production code until those tests pass.

Run `spec-test-author` next, then `spec-build`.
