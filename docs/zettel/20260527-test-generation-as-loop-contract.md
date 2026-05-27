---
id: 20260527-test-generation-as-loop-contract
title: Test generation at the end of Loop 1 is the contract that Loop 2 executes against
tags: [zettelkasten, spec-driven, automation, testing]
links: [20260527-spec-driven-two-loop-model, 20260526-release-spec-library-replaces-monolithic-spec]
created: 2026-05-27
---

Tests are not written after implementation — they are written as the final step of spec refinement, before any implementation work begins. This makes tests the *contract* between the two loops: Loop 1 defines what correct means; Loop 2 works until the contract is satisfied.

## Trigger: zettel changes, not implementation work

Every zettel edit or creation is evaluated for testable claims. A **testable claim** is any assertion in a zettel body that can be verified by running code — command exists, flag accepted, DB column present, input produces output, state transitions correctly.

Not all claims in a zettel are testable. Process descriptions, rationale, and human workflow are not. The test generation step reads claims one by one and asks: "is this verifiable in code?"

## What the agent produces

For each changed zettel, the test generation agent:
1. Enumerates the zettel's testable claims
2. Checks whether a test already exists for each claim (by searching the test suite)
3. Modifies existing tests if the claim changed
4. Creates new test stubs for claims with no coverage

A test stub expresses the assertion and marks it as pending. It is a failing test — intentionally. Failing tests are Loop 2's work queue.

## Zettel linkback

After tests are written, the source zettel is updated with a `tests:` frontmatter field:

```yaml
tests:
  - tests/integration/sprint_close.rs
  - tests/unit/sprint_reference.rs
```

This makes the spec→test mapping explicit and auditable. `zettel-audit` can flag zettels with testable claims but no `tests:` entry.

## The harness must exist first

Test generation is only useful if there is a test harness the generated tests can land in. The harness defines the test vocabulary — what helpers exist, how the server is started, how assertions are expressed. It must be defined (not fully built, but defined) before the test generation agent runs, so generated tests are runnable, not just syntactically valid.

This is the one bootstrapping dependency: **define the harness before running Loop 1 for the first time.**
