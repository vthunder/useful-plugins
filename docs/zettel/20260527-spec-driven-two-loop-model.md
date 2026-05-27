---
id: 20260527-spec-driven-two-loop-model
title: Spec-driven development runs as two separate loops with different ownership
tags: [zettelkasten, spec-driven, automation, process]
links: [20260526-release-spec-library-replaces-monolithic-spec, 20260527-test-generation-as-loop-contract]
created: 2026-05-27
---

When a release-spec zettel library drives development, the process splits into two loops with strict ownership separation. Merging them into one loop lets the implementation agent both define correctness and satisfy it — the spec becomes a post-hoc description of what was built rather than a constraint on what gets built.

## Loop 1 — Spec refinement (human-heavy, agent-assisted)

1. Human and agent co-author spec changes (zettel create/edit)
2. `zettel-audit` runs automatically — checks internal consistency, contradictions, unspecced dependencies
3. Agent fixes any audit findings; repeat until audit is clean
4. Agent generates tests for the changed zettels (see [[20260527-test-generation-as-loop-contract]])
5. Zettels are updated with `tests:` links pointing to the generated test files

**Owner:** human drives step 1; agent automates steps 2–5. Loop 1 never writes production code.

## Loop 2 — Implementation (fully automated)

1. Spec compliance check: run tests, produce gap report (failing tests = unimplemented spec items)
2. If gaps exist: implementation agent closes them, commits, runs tests again — repeat until green
3. When all tests pass and gap report is empty: Loop 2 is done

**Owner:** fully automated. Loop 2 never edits zettels or tests. If it encounters genuine ambiguity in the spec, it surfaces a gap report item rather than making a judgment call — that judgment returns to Loop 1.

## Sequencing

Loop 1 must complete before Loop 2 starts. Loop 2's work queue is Loop 1's test output. After Loop 2 finishes, manual testing takes place; findings re-enter Loop 1.

```
Loop 1 (spec + tests) → Loop 2 (code) → manual testing → Loop 1
```

## Why the separation matters

- Loop 1 defines correctness; Loop 2 achieves it
- A failing test in Loop 2 is unambiguously a code problem, not a spec problem
- If a Loop 2 failure reveals a spec gap, that's a Loop 1 trigger — not a reason to bend the implementation
