---
name: spec-test-author
description: "Reconcile the test suite to the current spec without writing production code: author real failing tests from ignored stubs, re-author tests whose claim changed, and flag orphaned tests whose claim was removed. The middle step between spec-lock (writes stubs + detects changes) and spec-build (implements). Trigger: 'author the spec tests', 'flesh out the stubs', 'reconcile tests to spec', 'the spec changed update the tests', 'spec-test-author'."
user-invocable: true
---

# spec-test-author

The test suite should always be a faithful encoding of the current spec. Keeping it so is one job — distinct from *implementing* the spec (that is `spec-build`). This skill owns that job. It does **not** write production code; that separation is what keeps the loop trustworthy (the test author must not be the implementer, or tests get shaped to the code instead of the spec).

`spec-lock` detects spec changes and leaves three kinds of signal in the suite. This skill acts on all three:

| Signal (from spec-lock / spec-test-gen) | Operation here |
|---|---|
| **New claim** → ignored `todo!()` stub | **author** a real failing test |
| **Changed claim** → `// FIXME: claim changed` on a real test (or drift vs the zettel) | **re-author** the test body to the current claim (goes red) |
| **Removed/renamed claim** → test whose `spec: <id> claim <N>` no longer maps to any claim | **retire**: flag/quarantine for review (never silent-delete) |

Loop position: **spec-lock → spec-test-author → spec-build**.

## Inputs

- Optional: `--since <ref>` — only reconcile tests for zettels/test files changed since this git ref (default: scan all test files). Use this in the normal loop right after spec-lock so the pass is fast and scoped to what changed.
- Optional: `--files <glob/paths>` — restrict to specific test files.
- Optional: `--library <name>` / `--test-dir <path>` — overrides (same resolution as spec-test-gen).
- Optional: `--max <N>` — cap the number of tests touched (incremental runs).
- Optional: `--no-commit` — reconcile and run, but do not commit (default: commit the red checkpoint).

## Core rules

1. **Author tests only — never write or modify production code**, and never edit zettels. Production code is `spec-build`'s job.
2. **The zettel claim is authoritative.** Author/re-author the assertion to check what the *current* claim says, at the strength it implies. Never weaken an assertion to make it pass; never assert behavior the claim doesn't state.
3. **Stay at the existing test boundary.** Mirror how sibling real tests exercise the system — black-box via CLI/SSH, HTTP, PTY, and SQL (`information_schema`, table queries), **not** by calling internal functions. This is what lets a test *compile and fail* before the feature exists; a test that calls a not-yet-existing internal symbol breaks the build instead.
4. **Match claims by text/meaning, not by number.** Claim numbers shift when claims are inserted or removed, so `claim <N>` references drift. Reconcile a test against the *content* of the zettel's claims; update the `spec: <id> claim <N> — <text>` comment to the current number+text when you touch a test.
5. **Never delete a test function.** Every claim that had a stub keeps a function — the test count never decreases. A stub you can't author stays in the file as an `#[ignore]` stub (restored verbatim if touched); an orphan is quarantined with `#[ignore]`, never deleted (Step 4c). A could-not-author entry with no surviving `#[ignore]` function in the file is a bug. Removing or weakening a test that still maps to a current claim requires surfacing it for human review, not doing it silently.
6. **Remove `#[ignore]`** (and the `"stub: not yet implemented"` / `FIXME` markers) once a test is real and matches the current claim, so it runs.

## Step 1 — Resolve library, test dir, and conventions

Resolve the zettel library and test directory exactly as `spec-test-gen` does. Then **learn the suite's conventions**: read 2–3 existing real (non-ignored) tests and capture the harness/fixtures (test server, CLI/HTTP client, PTY helper, DB access), the seed helpers (and whether seeds must be **time-relative**), and the assertion/import style. These are the template for every authored test.

## Step 2 — Collect reconciliation work

Scan the test dir (filtered by `--since`/`--files`/`--max`) and build three work lists, each entry carrying `(file, fn_name, zettel_id, claim_n, claim_text_in_comment)`:

- **NEW** — ignored stubs: `#[ignore = "stub: not yet implemented"]` + `todo!()` (Rust), `test.todo` (JS/TS), `raise NotImplementedError` (Python).
- **CHANGED** — real tests carrying `// FIXME: claim changed` (emitted by spec-test-gen), **plus** any real test whose referenced claim, re-read from the current zettel, no longer matches what the test asserts (drift spec-test-gen's grep missed). Reconcile by claim *text*, not number (Core rule 4).
- **ORPHANED** — real tests whose `spec: <id> claim <N>` references a zettel that no longer exists, or a claim that is no longer present in that zettel (removed/renamed; confirm by text, since numbering shifts).

If all three lists are empty, report "Test suite already matches the spec" and exit.

## Step 3 — Reconcile (parallel workflow)

Resolve the workflow script path: read `~/.claude/plugins/installed_plugins.json`, find `spec-loop@useful-plugins`, take its `installPath`. The script is at `<installPath>/workflows/spec-test-author.js`.

Invoke the Workflow tool with `scriptPath` set to that path. **Use the compact `files` contract** — pass just the list of affected test-file paths (one agent per file; each agent re-discovers the NEW/CHANGED/ORPHANED work by scanning its own file and the stub markers / `spec:` comments in it):

```json
{
  "files": ["<test file path>", "..."],
  "library_path": "<resolved library path>"
}
```

> **Compact args (important).** The Workflow runtime can **corrupt inline `args` longer than ~500 chars** (it arrives as a complete-but-invalid JSON string and the workflow throws a parse error). Keep the payload small: pass `files` (paths only), **not** the verbose `stub_files` with per-fn `new`/`changed`/`orphaned` arrays, and **omit `conventions`** — each agent infers fixtures/seed-helpers from sibling real tests anyway. The legacy `stub_files` / `conventions` shape is still accepted for small payloads, but prefer `files`. Your Step-2 scan still drives the human-facing report; the agents just re-derive the per-file work.

Each agent, for its file:
- **NEW** → writes a real arrange/act/assert body from the current claim; removes `#[ignore]`.
- **CHANGED** → rewrites the body to encode the *current* claim; updates the `spec:` comment to the current claim number+text; removes the `FIXME`. (The test should now go red until spec-build implements the new behavior.)
- **ORPHANED** → does **not** delete. Marks it `#[ignore = "orphaned: claim removed — review for deletion"]`, leaving the body intact, and reports it for human review.

After reconciling, the workflow runs an **always-on semantic coverage check**: for every authored/re-authored (now real) test, two independent reviewers judge *statically* — the tests are red, so the question is "if this test were to pass, would that prove its claim at the claim's strength?". A reviewer flags `too_weak` / `over_asserts` / `wrong_boundary` / `no_exercise`. **Two-tier vote:** any one reviewer's flag triggers a cheap **strengthen** retry (re-author just that test stronger, tests-only); a weakness **confirmed by both reviewers after** the retry becomes a hard gate.

It returns per-file counts, the orphan list, `could_not_author`, and:
- `total_verified` — authored tests reviewed
- `total_strengthened` — tests re-authored because a reviewer flagged weak coverage
- `weak_coverage` — `[{ file, fn, zettel_claim, issue, detail }]` tests that **still** don't prove their claim after strengthening (2/2). **This is the new hard gate (Step 4e).**

## Step 4 — Compile, run, and review

**4a. Compile + run** the affected tests. Authored/re-authored tests should be **red for the right reason** — a failed assertion or an expected "feature absent" error, **not** a compile error:
- Compile error → a test referenced something nonexistent at the wrong boundary (violates Core rule 3). Fix to the CLI/HTTP/SQL boundary, or revert that one to its prior `#[ignore]` and report it. Never leave the suite uncompilable.
- Fails an assertion / expected error → correct (red checkpoint for spec-build).
- A NEW or CHANGED test that **passes immediately** → the claim is already satisfied; keep it (now real coverage) and note it.

**4b. Re-author fixes** at most 2 times per file; if a test still won't compile cleanly as a faithful test, restore its prior marker and list it under "could not author". Every could-not-author entry **must** carry (1) the claim it covers, (2) a concrete reason it can't be authored at the test boundary, and (3) a **suggested resolution** — e.g. add a harness capability (mock-hq, multi-identity SSH, clock injection), rescope the claim as non-testable in the zettel, or split it into a testable form. A reason without a path to resolve it is not acceptable.

**4b-check. No test was deleted.** Before trusting the workflow's output, confirm the agents didn't drop any stub: the count of test functions per touched file must be ≥ what it started with, and every `could_not_author` entry must still have a matching `#[ignore]` function in its file. If a function went missing, restore it as an `#[ignore]` stub (from the claim text) before continuing — a could-not-author claim with no surviving stub is a regression, not a gate item.

**4c. Surface orphans.** List every quarantined orphan with its old claim reference so the user can confirm deletion (or restore the claim to the spec). Do not delete them yourself.

**4d. Could-not-author is a decision gate (do not auto-proceed).** If *any* claim could not be authored, this skill **stops at its report** and does not hand off to spec-build. These are claims with no executable test, so spec-build cannot drive or verify them — running it anyway would silently ship unverified behavior, the exact failure mode this loop exists to prevent. The user decides per item whether to (a) resolve it (add the missing harness capability / fix the spec) and re-run spec-test-author, or (b) explicitly accept it as known-unverified and proceed. The skill must not make that call itself.

**4e. Weak coverage is a decision gate (do not auto-proceed).** If `weak_coverage` is non-empty, those authored tests *compile and are red*, but two reviewers independently confirmed (even after a strengthen retry) that passing them would **not** prove their claim — a green there would be a false guarantee, which is as dangerous as no test. Treat it exactly like could-not-author: **stop at the report**, do not hand off to spec-build. Per item the user (a) accepts the suggested strengthening / adds the harness capability needed to assert the claim faithfully and re-runs spec-test-author, (b) rescopes the claim in the zettel so the weaker assertion is in fact faithful, or (c) explicitly accepts it as known-weak coverage and proceeds. The skill never silently ships a test that doesn't prove its claim.

## Step 5 — Commit the red checkpoint

Unless `--no-commit`, stage only the touched test files and commit:

```
spec-test-author: reconcile tests to spec — <A> authored, <C> re-authored, <O> orphaned

Authored (new, now failing):
- <zettel-id> claim <N>: <fn>
Re-authored (claim changed, now failing):
- <zettel-id> claim <N>: <fn>
Orphaned (quarantined, review for deletion):
- <zettel-id> claim <N>: <fn>
```

Committing failing tests is intentional — this is the "spec locked, tests match spec, not yet implemented" (red) checkpoint that `spec-build` consumes.

## Step 6 — Report

```
spec-test-author complete
-------------------------
Test dir: <dir>     Scope: <--since ref / files / all>
Authored (new):     N   (real failing tests)
Re-authored (changed): N   (now failing; old assertions replaced)
Passed immediately: N   (claim already satisfied)
Orphaned (quarantined): N
Verified (semantic): N   (authored tests reviewed)   Strengthened: N
Could not author:   N   ← if > 0, decision gate (see below)
Weak coverage:      N   ← if > 0, decision gate (see below)
Committed:          <sha> (or "skipped, --no-commit")

Orphaned tests — confirm deletion or restore the claim:
  [<zettel-id> claim N] <fn> — claim no longer in spec

⚠ COULD NOT AUTHOR — N claim(s) have no executable test. Decide before spec-build:
  [<zettel-id> claim N] <fn>
     why: <concrete reason it can't be tested at the boundary>
     to resolve: <suggested fix — harness capability / spec change / rescope>
     your call: resolve & re-run spec-test-author, or accept as known-unverified

⚠ WEAK COVERAGE — N authored test(s) would not prove their claim even if green (2/2 reviewers, post-strengthen):
  [<zettel-id> claim N] <fn>  (issue: too_weak | over_asserts | wrong_boundary | no_exercise)
     detail: <why passing would not establish the claim>
     your call: strengthen (resolve & re-run), rescope the claim, or accept as known-weak
```

**If both "Could not author" and "Weak coverage" are 0**, end with: `Next: run spec-build to implement the red tests to green.`

**If either is > 0**, do NOT tell the user to run spec-build. End with an explicit gate, e.g.:

```
N claim(s) have NO test and N test(s) would not prove their claim. spec-build cannot
safely verify these. Choose per item: (a) resolve the blocker and re-run spec-test-author,
or (b) explicitly accept it as unverified/known-weak — then run spec-build for the rest.
```

Wait for the user's decision; do not proceed to spec-build on your own.

## Pitfalls

- **Claim numbers are not stable IDs.** Inserting/removing a claim renumbers the rest, so `claim <N>` comments drift. Always reconcile by claim *text/meaning* and rewrite the comment to the current number when you touch a test (Core rule 4).
- **Silent green is the enemy.** A test that still encodes an *old* claim can keep passing and hide that the implementation no longer matches the spec — that is exactly the case the CHANGED path exists to catch. Don't skip drift-checking real tests just because they're green.
- **Time-relative fixtures.** Seed "current" data relative to now (e.g. SQL `date_trunc('week', CURRENT_DATE)`) so tests don't rot as the clock moves.
- **One claim per test**, encode exactly the claim (don't over- or under-assert), and **never touch production code or zettels** here — that separation is what makes a green suite mean "matches spec."
