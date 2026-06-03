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
- Optional: `--parallel` — implement gaps concurrently via the clustered-worktree workflow (Step 4P) instead of the sequential loop (Step 4). Best when there are many gaps spanning distinct features.

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

**On ignored stubs:** test runners skip `#[ignore]` / `test.todo` placeholders (written by spec-lock), so they show as *ignored*, not *failing* — spec-build will not see or implement them. spec-build only acts on tests that are already real and failing, and never authors or un-ignores tests. If you have a large ignored count and expected this skill to implement those claims, run **spec-test-author** first to convert the stubs into real failing tests, then re-run spec-build.

## Step 3 — Parse failures into gap report (parallel)

Collect the list of failing tests from the test runner output. For each failing test, extract the test name, file path, line number, and first ~20 lines of failure output.

Resolve the workflow script path: read `~/.claude/plugins/installed_plugins.json`, find `spec-loop@useful-plugins`, take its `installPath`. The script is at `<installPath>/workflows/spec-build-gap-parse.js`.

**Write the failing tests to a file, then pass the file path** (failure outputs are bulky and inline `args` over ~500 chars get corrupted in transit). Write a JSON array — one object per failing test `{ name, file, line, failure_output }` — to an absolute path (e.g. `<repo>/.spec-loop/failures.json`), then invoke the Workflow tool with `scriptPath` set to the resolved path, passing the compact reference:

```json
{
  "failures_file": "<abs path to failures.json>",
  "failing_count": <N>,
  "library_path": "<resolved zettel library path>",
  "test_dir": "<test dir>"
}
```

Each classifier agent reads element `[i]` of that file. **Uniform file contract:** always write the file, even for a single failing test — never inline the list (the runtime can corrupt inline `args` over ~500 chars).

The workflow classifies all failing tests in parallel (one agent per test), then runs 3-interpreter adversarial verification on any `ambiguous` classifications to filter false positives — tests that look ambiguous but actually have a clear spec interpretation are downgraded to `assertion`. Results are sorted into processing order: `compile` first, then `stub`, then `assertion`, `ambiguous` last.

The workflow returns:
- `gaps` — ordered array of classified gap objects with `kind`, spec ref fields, `failure_summary`, and optional `ambiguity_resolved`
- `by_kind` — counts per kind
- `gap_report` — pre-formatted gap report string

Print the `gap_report`. Use the `gaps` array as the input to step 4.

## Step 4 — Implementation loop

Use the `gaps` array returned by the workflow in step 3. Process gaps one at a time in the order returned (already sorted: `compile` → `stub` → `assertion`). Skip `ambiguous` gaps (handled in step 6).

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
- If it reveals a possible spec ambiguity: invoke the Workflow tool with `scriptPath` set to `<installPath>/workflows/spec-build-gap-parse.js` (same path resolution as step 3) for just this one test (passing a single-element `failing_tests` array). The workflow's 3-interpreter adversarial pass will determine whether the ambiguity is genuine. If the workflow returns the gap still classified as `ambiguous`, escalate to step 6. If it's resolved to `assertion`, continue fixing.
- If it is a code error (not a spec ambiguity): fix and re-run. Limit to 3 fix attempts per gap.

**A gap is only allowed to remain unimplemented if it is genuinely impossible at this layer — and then it MUST be recorded as a blocked gap with a category, a concrete reason, and a suggested resolution.** Never silently "mark blocked and move on" with no path forward. After 3 honest attempts, classify the gap into exactly one of:

- **`spec-ambiguity`** — the claim is unclear or two zettels/tests contradict. → escalate to Step 6 (SPEC GAP). Resolution: which zettel/claim to change.
- **`needs-capability`** — the test can't be driven without a missing test-harness or external capability (mock service, multi-identity auth, clock injection, network). Resolution: name the capability to add (often a spec-test-author/harness task), e.g. "rewrite to use the mock-hq non-admin identity".
- **`environment`** — flaky/infra (no DB, disk full, port contention). Resolution: the env fix.

If none of these apply, the gap is **not** blocked — keep going (return to 4b with a different approach; do not stop until it passes or genuinely fits a category above). "I didn't finish it" is not a valid blocked reason.

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

## Step 4P — Parallel implementation (clustered worktrees)

Use this **instead of Step 4** when `--parallel` is set. It implements file-disjoint feature clusters concurrently in isolated git worktrees, then integrates them serially. The safety invariant: clusters never share a production file and each owns a pre-assigned migration-number range, so their branches merge without conflicts.

**Preconditions.** Commit or stash any unrelated working-tree changes first — the tree must be clean (only the red tests committed). Capture the integration base: `base_sha = git rev-parse HEAD` on the branch carrying the red tests. Determine the first free migration number (highest existing `NNNN_*.sql` + 1).

> **Worktree base (important).** The isolation mechanism may fork each worktree from a *stale* commit (e.g. the default branch), not your current HEAD — so you MUST pass `base_sha` and the workflow makes each agent `git reset --hard <base_sha>` before working. Without this, agents' worktrees lack the `tests/` dir and recent source, and they implement blind (unverifiable) code. Agents are also instructed to stay strictly inside their worktree and never touch the main checkout or other branches.

**Run the workflow.** Resolve `spec-loop@useful-plugins` installPath; the script is `<installPath>/workflows/spec-build-impl.js`. Invoke Workflow with:

**Write the gaps to a file, then pass the file path** (gap lists are bulky; inline `args` over ~500 chars get corrupted in transit). Write a JSON array — one object per gap `{ id, test_name, test_file, zettel_id, claim, failure_summary }` — to an absolute path (e.g. `<repo>/.spec-loop/gaps.json`), then invoke Workflow with the compact reference plus the scalars:

```json
{
  "gaps_file": "<abs path to gaps.json>",
  "gap_count": <N>,
  "repo_root": "<repo root>",
  "library_path": "<zettel library path>",
  "test_cmd": "<test-cmd>",
  "migration_base": <first free migration number>,
  "base_sha": "<git rev-parse HEAD on the red-tests branch>"
}
```

Each planning agent reads gap `[i]` from that file and returns the record's `id`. **Uniform file contract:** always write the file, even for a single gap — never inline the list.

The workflow: (1) **plans** each gap in parallel (read-only) to predict the production files and migration count it touches; (2) **clusters** gaps that share any file (union-find) so each file has one owner, and assigns each cluster a disjoint migration-number range; (3) **implements** each cluster in an isolated worktree on branch `spec-build/cluster-<i>`, creating migrations only within its assigned range, and runs that cluster's target tests. It returns `clusters`, per-cluster `results` (branch, committed, tests_passed, failing_tests), `integrated` (clean branches), and `needs_attention`.

**Integrate serially (you, the orchestrator):**
1. For each branch in `integrated`: `git merge --no-ff <branch>`. Because clusters are file-disjoint, this is conflict-free. If a merge *does* conflict, the clustering missed a shared file — abort that merge, and fall back to Step 4 (sequential) for that cluster's gaps.
2. After merging all clean clusters, run the **full** `<test-cmd>`. The integrated tree must compile and pass; a green-per-cluster result does not guarantee a green whole.
3. **Sequential finish-up is mandatory, not optional.** The parallel run is a first pass only — its agents may submit unverified or partial work. After integration you MUST drop to the Step 4 sequential loop for **every** still-failing test, which includes: (a) `needs_attention` clusters, (b) integration regressions (tests that were green before and broke from a merge), and (c) any cluster whose work compiled but didn't actually pass. Do not treat the parallel pass as done while failures remain — finish each in Step 4 (which closes it, escalates it to a SPEC GAP, or records it as a categorized blocked gap with reason + suggested resolution). The parallel path is complete only when Step 4 has driven the full suite to the Step-6.5 completion gate.
4. Clean up: delete merged `spec-build/cluster-*` branches and prune worktrees (`git worktree prune`).

**Commit.** The cluster commits come in via merge; keep them, or squash per feature if you prefer one commit per cluster. Do not squash across clusters (loses the gap→commit traceability).

Then continue to Step 5 (full test run) as usual. If `--parallel` was not set, ignore this step and use Step 4.

## Step 5 — Full test run

After processing all non-ambiguous, non-blocked gaps, run the full test suite again:

```
<test-cmd>
```

If all tests pass: proceed to step 7 (final report).

If tests still fail: some gaps may have been interdependent or a fix introduced a regression. Re-parse failures and repeat the loop (steps 3–5) for newly failing or still-failing tests. Limit to 3 full-loop iterations total. After 3 iterations, stop and report remaining failures.

## Step 6 — Spec ambiguity handling

Note: the workflow in step 3 already ran 3-interpreter adversarial verification on ambiguous gaps. Any gap still classified `ambiguous` here survived that verification — it is genuinely unclear. Gaps with `ambiguity_resolved` set were downgraded to `assertion` by the workflow and will have been processed in step 4 already.

For each remaining gap classified as `ambiguous`, produce a spec gap item in this format:

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

## Step 6.5 — Completion gate

spec-build may report **success only when the full suite is green.** It must never present partial completion as done, nor leave a failing test untriaged.

Before the final report, every remaining failure must be in exactly one of three terminal states:
1. **Passing** — implemented and committed.
2. **SPEC GAP** — a genuine spec ambiguity/contradiction (Step 6), with the options laid out.
3. **Blocked gap** — genuinely impossible at this layer, recorded with a **category** (`needs-capability` | `environment`), a **concrete reason**, and a **suggested resolution** (Step 4c).

If any failure does not yet fit (2) or (3) and is not passing, you are **not done** — return to Step 4 and keep working it. "Ran out of attempts" without a category is not terminal.

When failures remain (only SPEC GAPs and/or blocked gaps), **stop at this gate**: do not claim the build is complete. Present the gate to the user — each item with its reason and suggested resolution — and let them decide whether to resolve the blocker (add the harness capability, fix the spec, fix the env) and re-run, or accept it as known-unimplemented. This mirrors spec-test-author's could-not-author gate: the user, not the skill, decides to ship something unverified.

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

<If blocked gaps exist — DECISION GATE, build is NOT complete:>
Blocked gaps (your call: resolve & re-run, or accept as unverified):
  [<n>] <test-name>  (category: needs-capability | environment)
       why: <concrete reason it can't be implemented at this layer>
       to resolve: <suggested fix — harness capability / env fix / spec-test-author task>

<If spec gaps exist:>
Spec gaps (require spec update before re-running):
  [SPEC GAP N] ...
```

End with an explicit status line: `All tests passing — build complete.` only when there are zero failures; otherwise `Build paused at gate: N spec gap(s), N blocked gap(s) — awaiting your decision.`
