---
name: spec-test-gen
description: "Read changed zettels and generate or update test stubs for every testable claim. Called by spec-lock; can also be run directly on specific zettels."
user-invocable: false
---

# spec-test-gen

Given one or more zettel slugs or file paths, enumerate every testable claim in each zettel, reconcile against the existing test suite, and produce new or updated tests for any claim that is uncovered or has changed. Stamp each zettel's frontmatter with a `tests:` field listing the test files written.

## Library resolution

Find the zettel library using this order:

1. Check `.zettel-libraries.yaml` in cwd (also `.claude/zettel-libraries.yaml`).
2. Check `~/.config/zettel/libraries.yaml`.
3. Fall back to `./docs/zettel/`.

The target library is the one marked `default: true`, or the first entry whose `kind` is `release-spec`, or the first entry overall. Zettel files are resolved relative to that library's `path`.

## Inputs

- One or more zettel slugs (`YYYYMMDD-slug` IDs) or absolute/relative file paths to `.md` zettel files.
- Optional: `--test-dir <path>` — override where tests are searched and created. Defaults to auto-detected (see step 3).

## Step 1 — Read each zettel

For each input zettel, read the file completely. Note:
- `id`, `title`, and `tags` from frontmatter.
- The full body text.
- Any existing `tests:` frontmatter field (list of test file paths).

> **Skip `scenario`-tagged zettels.** A zettel tagged `scenario` is **non-claim-bearing**: it describes an end-to-end user journey, not atomic assertable facts. Its verification is a `spec-scenario-run` friction pass, not executable claim-tests. If a zettel's `tags` include `scenario`, do not enumerate claims or write stubs for it — note it as skipped (non-claim-bearing) and move on. (It still participates in `zettel-audit` congruence checks; it just never reaches this skill's claim machinery.)

## Step 2 — Enumerate testable claims

A **testable claim** is any assertion that can be verified by running code. Scan the zettel body (and title) and produce a numbered list of candidate claims.

**Testable — include:**
- Command or subcommand exists and is callable (e.g., "the CLI exposes `admin import`")
- A flag or option is accepted (e.g., "`--dry-run` flag is accepted")
- A database column or table exists with the stated name and type
- A specific input produces a specific output or return value
- A state transition: given state A + action B → state C
- An HTTP endpoint returns a specific status code or response shape
- A configuration key controls a specific behavior
- A constraint is enforced (e.g., uniqueness, foreign key, length limit)
- An error condition produces a specific error message or code

**Not testable — skip:**
- Why a design decision was made (rationale)
- Human workflow descriptions ("the operator reviews the list")
- Aspirational or future-scope notes
- Prose restatements of architecture without concrete behavior
- Aesthetic or style guidance

**Non-normative — never enumerate as a claim, even if it reads testable:** text the author explicitly marked descriptive. A section whose heading carries a `(presentational)`, `(advisory)`, `(non-normative)`, or `(implementation-note)` marker, and any blockquote (`>`) aside, are descriptive — they document, they don't assert. Skip them entirely. (This lets authors keep prose like a color palette or an implementation detail in the spec without it generating brittle or out-of-place claim-tests. The `scenario` tag does the same thing at the whole-zettel level; these markers do it per section.)

For each testable claim, output:
```
Claim N: <one-sentence description of what to assert>
Zettel: <id>
```

If a zettel has zero testable claims, note that and skip it — do not create an empty test file.

> **Completeness backstop.** This enumeration is a single pass and can silently drop a claim. When invoked via `spec-lock`, the `spec-lock-test-gen` workflow runs an always-on completeness check after generation: two independent critics re-enumerate each zettel blind, a reconciler keeps only claims BOTH flag as unstubbed (2/2 vote), and those are remediated by re-invoking this skill with the missing claims named. Aim to be complete here regardless — but know that a dropped claim is caught and either recovered or surfaced as a hard gate, not shipped.

## Step 3 — Locate test directory

Detect the project's test layout:
1. If `--test-dir` was passed, use that.
2. Look for `Cargo.toml` in cwd or any parent up to the repo root. If found, the test dir is `tests/` under the crate root (integration tests) — unit tests live inside source files.
3. Look for `package.json` — if found, check `"test"` script and look for `tests/` or `__tests__/`.
4. Look for `pytest.ini`, `pyproject.toml`, or `setup.cfg` — if found, use `tests/`.
5. Fall back to `tests/` in cwd.

## Step 4 — Search for existing tests per claim

For each testable claim, search the test directory (recursively) for tests that already cover it:

1. Grep for the claim's key nouns and verbs (2–4 keywords extracted from the claim sentence).
2. Also grep for the zettel `id` in test file comments (test stubs written by this skill include the zettel ID as a comment).
3. If a match is found, read that test block and compare it against the current claim. If the claim has changed materially, mark the existing test as **needs update**.
4. If no match is found, mark the claim as **uncovered**.

Produce a reconciliation table:
```
Claim 1: [covered | uncovered | needs update] — <file:line if covered>
Claim 2: ...
```

## Step 5 — Write or update test stubs

**For uncovered claims** — create a new test stub.

- For **Rust** projects: create a file `tests/spec_<zettel-slug>.rs` if it does not exist, or append to it. Each stub uses the `#[test]` attribute and includes a comment with the zettel ID and claim number:

```rust
/// spec: <zettel-id> claim <N> — <claim description>
#[test]
#[ignore = "stub: not yet implemented"]
fn <snake_case_claim_name>() {
    todo!("<claim description>")
}
```

- For **JavaScript/TypeScript** projects: append to or create `tests/spec_<zettel-slug>.test.ts`. Each stub:

```typescript
// spec: <zettel-id> claim <N> — <claim description>
test.todo("<claim description>");
```

- For **Python** projects: append to or create `tests/test_spec_<zettel-slug>.py`. Each stub:

```python
# spec: <zettel-id> claim <N> — <claim description>
def test_<snake_case_claim_name>():
    raise NotImplementedError("<claim description>")
```

Use `snake_case` derived from the claim text (lowercase, strip punctuation, replace spaces with underscores, truncate to 60 chars).

**For claims that need update** — find the existing test block (identified in step 4). Update the comment line to reflect the revised claim. Do NOT change the test body if it already has real assertions — only update stubs (i.e., `todo!()`, `test.todo`, `raise NotImplementedError`). If the existing test has real assertions, append a `// FIXME: claim changed — review this test` comment immediately before the `#[test]` line and leave the body intact.

Do not delete any existing tests.

> Handoff: the `// FIXME: claim changed` markers (and the new stubs) are acted on downstream by **spec-test-author**, which re-authors changed tests' bodies to the current claim and quarantines tests whose claim was removed. This skill only *detects and marks*; it never rewrites real assertions or deletes tests.

## Step 6 — Update zettel frontmatter

After writing all test files for a zettel, update the zettel's frontmatter `tests:` field to list every test file that covers a claim from this zettel (absolute paths or paths relative to the repo root — prefer relative):

```yaml
tests:
  - tests/spec_20250115-auth-model.rs
```

If the field already exists, merge the new paths in (deduplicate, sort). Use the Edit tool to make the frontmatter change.

## Step 7 — Report

Output a summary:

```
spec-test-gen summary
---------------------
Zettel: <id> — <title>
  Testable claims found: N
  Already covered: N
  Newly stubbed: N
  Updated: N
  Test file(s): <paths>

(repeat for each zettel)

Total stubs written: N
Total updates: N
```
