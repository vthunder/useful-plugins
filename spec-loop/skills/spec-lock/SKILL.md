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
2. Call `zettel-edit` on the implicated zettel to fix the issue. Apply the minimal change that resolves the audit finding:
   - Broken link → remove the link from `links:` frontmatter.
   - Contradiction between two zettels → update the zettel whose claim is stale (prefer updating the older zettel, unless the audit identifies which is authoritative).
   - Interface mismatch → reconcile the described interface with the implementation by updating the zettel body.
   - Stale claim → update the zettel body to reflect current behavior.
   - Blocking open question → surface it to the user as a spec gap and **do not proceed** until answered. Non-blocking open questions: note them and continue.
3. After applying fixes, re-run `zettel-audit`. Repeat until audit is clean.

**Safety limit:** If the audit is still not clean after 5 fix-and-reaudit cycles, stop and report all remaining issues to the user for manual resolution. Do not commit partial work.

## Step 3 — Test generation

For each file path in `changed_zettels`, call `spec-test-gen` with that path as input.

`spec-test-gen` will:
- Enumerate testable claims in the zettel.
- Search the test suite for coverage.
- Create or update test stubs.
- Stamp `tests:` frontmatter on the zettel.

Wait for `spec-test-gen` to complete before proceeding.

## Step 4 — Coverage check

For each zettel in `changed_zettels`:
- Read the zettel's frontmatter.
- Check whether `tests:` is present and non-empty, OR the zettel was confirmed to have zero testable claims (spec-test-gen reported "0 testable claims").

If any zettel is missing `tests:` coverage and was not confirmed claim-free, re-run `spec-test-gen` for that zettel. If it fails again, report the gap and continue (do not block the commit).

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
