---
name: spec-build
description: "Loop 2 orchestrator: run the test suite, parse failures into a spec gap report, implement fixes one at a time, and commit each. Loop exits when all tests pass. Trigger: 'spec-build', 'build from spec', 'implement the spec', 'close spec gaps', 'run spec-build'."
user-invocable: true
---

# spec-build

Run the project's test suite, parse every failure into a structured gap report tied to spec claims, and implement fixes one at a time until all tests pass. Each implemented gap gets its own commit. If a failure reveals genuine spec ambiguity, surface it as a spec gap item instead of guessing — never modify zettels or tests from within this skill.

## Inputs

- Optional: `--test-cmd <command>` — override the test command (default: auto-detected, see step 1).
- Optional: `--filter <pattern>` — pass a test filter to run only a subset (e.g., `spec_` to run only spec-generated stubs).
- Optional: `--max-gaps <N>` — stop after closing N gaps (useful for incremental runs; default: unlimited).

## Step 1 — Detect test command

Auto-detect in this order:
1. If `--test-cmd` was passed, use it.
2. Read `.claude/settings.json` or `CLAUDE.md` for a `test_command` or `testCommand` key.
3. If `Cargo.toml` is present in cwd or any parent up to the repo root: use `cargo test`.
4. If `package.json` is present: read the `"test"` script and use `npm test` (or `yarn test` if `yarn.lock` exists).
5. If `pytest.ini`, `pyproject.toml`, or `setup.cfg` is present: use `pytest`.
6. Fall back to `make test`.

Record the resolved command as `<test-cmd>`.

## Step 2 — Initial test run

Run `<test-cmd>` and capture all output (stdout + stderr). Note:
- Total tests run.
- Number passing.
- Number failing.
- Number ignored/skipped.

If all tests pass immediately, report success and exit — nothing to do.

## Step 3 — Parse failures into gap report

For each failing test, extract:

1. **Test name** — the function or test block name.
2. **Failure message** — the assertion error, panic message, or `todo!()` / `NotImplementedError` body.
3. **File and line** — where the failure occurred.
4. **Spec claim reference** — look for a comment in the test file of the form `spec: <zettel-id> claim <N> — <description>` immediately above or inside the test. If found, record the zettel ID and claim number. If not found, mark as "no spec reference".
5. **Failure kind** — classify as one of:
   - `stub` — test body is `todo!()`, `test.todo`, or `raise NotImplementedError` (unimplemented spec item).
   - `assertion` — a real assertion failed (regression or mismatch).
   - `compile` — the code does not compile (missing type, function, or module).
   - `ambiguous` — the failure message or test name suggests the spec itself is unclear (see step 6).

Produce the gap report:

```
Gap Report — <timestamp>
------------------------
Total failing: N

[1] <test-name>
    Kind: stub | assertion | compile | ambiguous
    Spec: <zettel-id> claim <N> — <description>  (or "no spec reference")
    File: <test-file>:<line>
    Message: <first 3 lines of failure output>

[2] ...
```

Print the gap report.

## Step 4 — Implementation loop

Process gaps one at a time, in this order: `compile` first, then `stub`, then `assertion`. Skip `ambiguous` gaps (handled in step 6).

For each gap:

### 4a — Understand the claim

If a zettel ID and claim number are present, read that zettel from the library (use library resolution from spec-test-gen). Extract the exact claim text. This is the authoritative description of what must be implemented.

If there is no spec reference, use the test name and failure message to infer what behavior is expected.

### 4b — Locate or create the implementation

Search the codebase for the relevant module, struct, function, or database migration:
- For a missing function: search for the module where it should live based on naming conventions. Create it there.
- For a missing DB column: find the migrations directory and create a new migration file.
- For a missing CLI command: find the command dispatch code and add the new variant.
- For a failing assertion: read the existing implementation and identify why it diverges from the claim.

Make the minimal change that satisfies the claim. Do not refactor unrelated code. Do not change tests.

### 4c — Run the test for this gap only

Run `<test-cmd> <filter-for-this-test>` to verify the single test now passes:
- Rust: `cargo test <test_function_name>`
- JS/TS: `npm test -- --testNamePattern "<test name>"`
- Python: `pytest tests/<file>.py::<test_name>`

If the test still fails:
- Read the new failure message carefully.
- If it reveals a genuine spec ambiguity (the claim is contradictory, underspecified, or conflicts with another claim): classify as `ambiguous` and move on — do not keep trying to implement it.
- If it is a code error: fix and re-run. Limit to 3 fix attempts per gap. If still failing after 3 attempts, mark as `blocked` and move on.

### 4d — Commit the gap

Once the single test passes, commit:

```
git add -p   (stage only files touched for this gap)
git commit -m "impl: <zettel-id> claim <N> — <one-line description>"
```

If there is no zettel reference:
```
git commit -m "impl: <short description derived from test name>"
```

Move to the next gap.

## Step 5 — Full test run

After processing all non-ambiguous, non-blocked gaps, run the full test suite again:

```
<test-cmd>
```

If all tests pass: proceed to step 7 (final report).

If tests still fail: some gaps may have been interdependent or a fix introduced a regression. Re-parse failures and repeat the loop (steps 3–5) for newly failing or still-failing tests. Limit to 3 full-loop iterations total. After 3 iterations, stop and report remaining failures.

## Step 6 — Spec ambiguity handling

For each gap classified as `ambiguous`, produce a spec gap item in this format:

```
SPEC GAP [<gap-number>]
Test: <test-name>
Spec: <zettel-id> claim <N> (if known)
Problem: <one paragraph describing exactly what is unclear or contradictory>
Options:
  A. <interpretation A and its implication>
  B. <interpretation B and its implication>
Recommended action: Update the spec zettel to clarify, then re-run spec-lock, then re-run spec-build.
```

Do NOT:
- Modify any zettel files.
- Modify any test files.
- Guess at an implementation and commit it.

Surface all spec gap items to the user at the end of the report.

## Step 7 — Final report

```
spec-build complete
-------------------
Test command: <test-cmd>
Full loop iterations: N

Gaps found:       N
  stub:           N
  assertion:      N
  compile:        N
  ambiguous:      N

Gaps closed:      N  (all tests passing)
Gaps blocked:     N  (listed below)
Spec gaps:        N  (listed below)

Commits made: N
  <sha> — <message>
  ...

<If blocked gaps exist:>
Blocked gaps (require manual investigation):
  [<n>] <test-name> — <last failure message>

<If spec gaps exist:>
Spec gaps (require spec update before re-running):
  [SPEC GAP N] ...
```
