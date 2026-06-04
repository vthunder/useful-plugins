---
name: spec-patch
description: "Fast lane for a small, localized change (bug fix or behavior tweak) without the full spec-loop ceremony: prove a red→green test, fix the code, mark it for later reconciliation. The spec stays the source of truth — the heavy adversarial verification is deferred to the next full spec-loop, not skipped. Trigger: 'spec-patch', 'quick fix', 'patch this bug', 'small change', 'fast lane', 'fix it and move on'."
user-invocable: true
---

# spec-patch

The full `spec-loop` (spec-lock → spec-test-author → spec-build) is the right tool when you are **changing intended behavior at scale** — its audit loop and adversarial verification panels (2/2 completeness critics, runtime-validate, 2-reviewer coverage, 3-interpreter ambiguity) earn their cost there. They are wildly disproportionate for a **small, localized change**: a one-spot bug fix, a behavior tweak, or a tiny new behavior you can hold in your head and verify by eye.

`spec-patch` is that fast lane. It preserves the loop's core invariant — **nothing ships without a test that was red before the change and green after** — while *deferring* (not discarding) the expensive spec-side verification to the next full `spec-loop` run.

## The deal: light now, rigorous later

What the fast lane keeps:
- A real test that **demonstrably fails for the right reason** before your change and passes after. That red→green transition is evidence the big loop's *static* panels don't even have.
- A green full suite after the change (regression guard).

What it defers — never drops:
- Folding the change into the spec (a claim covering the new/changed behavior).
- The adversarial verification of the patch test (is it too weak? does it prove the claim at full strength?).

The deferral is made safe by a **marker comment** on every patch test. The next full `spec-loop` reconciles every marker before it is allowed to report "complete" (see `spec-lock` Step 0). So the spec is *provably current and fully verified after any full loop*, and between full loops you move fast on a thinner — but non-zero — guarantee.

**Use `spec-patch` when:** the change touches one feature, you can write its test yourself, and you don't need the spec reconciled this minute.
**Use `spec-loop` instead when:** you're adding/changing a substantial chunk of behavior, multiple interdependent claims, or anything where you want the spec rewritten and adversarially verified up front.

## The marker comment (the ledger)

There is no ledger file. The ledger is a grep over the test directory. Every test authored or changed by a patch carries exactly one marker, placed immediately above the test function:

```
// spec-patch: unreconciled — <zettel-id | "spec-silent"> — <YYYY-MM-DD> — <one-line description of the change>
```

- `<zettel-id>` — the zettel whose claim this change relates to, if one exists.
- `"spec-silent"` — use this literal token when the spec says nothing about the behavior you changed (the bug was in undefined territory). Reconciliation will draft a claim and confirm it with you.
- Use the project's line-comment syntax (`//`, `#`, etc.) matching sibling tests.

`grep -rn "spec-patch: unreconciled" <test-dir>` **is** the reconciliation work list. Do not also write a separate file.

## Inputs

- A description of the change (bug to fix or behavior to adjust). Usually given in the invoking message.
- Optional: `--test-cmd <command>` — override the test command (default: auto-detect, same order as spec-build: `--test-cmd` → settings/CLAUDE.md → Cargo/npm/pytest → `make test`).
- Optional: `--no-commit` — make the change but don't commit.

## Step 1 — Locate the relevant claim (or confirm the spec is silent)

Resolve the zettel library (same order as spec-lock: `.zettel-libraries.yaml` → `~/.config/zettel/libraries.yaml` → `./docs/zettel/`). Search for a claim describing the behavior you're changing.

- **A claim exists and the current code/behavior violates it** (classic bug): note the `<zettel-id>` and the claim text. The spec is already right; only the code is wrong.
- **A claim exists but you intend to change what it says** (behavior tweak): you may proceed on the fast lane *only if the change is small and the new behavior is unambiguous*. Note the `<zettel-id>`; reconciliation will update the claim text to match. If the change is large or you're unsure how the claim should read, **stop and use `spec-loop`** instead — that's what its up-front verification is for.
- **No claim exists** (spec-silent): the behavior was undefined. Record `spec-silent`. You may optionally add a one-line claim to the zettel inline now (eager) or leave it for reconciliation to draft and confirm with you (lazy) — both are fine; the marker carries the debt either way.

If the change is genuinely ambiguous — two plausible behaviors and the spec doesn't decide — that is a spec gap, not a patch. **Stop** and surface it; don't guess on the fast lane.

## Step 2 — Write the test and prove it red for the right reason

Write **one** test that exercises the target behavior, at the existing test boundary (black-box via CLI/SSH/HTTP/PTY/SQL — mirror sibling real tests, never call internal symbols). The assertion must encode the behavior you intend *after* the change.

Run it against the **unchanged** code and confirm it fails **at its assertion about the behavior** — not at compile, setup, or an unrelated panic. A test that's red for the wrong reason is the one failure mode the fast lane can't afford, because it skips the panels that would otherwise catch it.

- Fails at the intended assertion → good, this is your red checkpoint. Continue.
- Fails at compile/setup, or passes already → fix the test until it's red for the right reason (or, if it passes, the behavior already exists — there may be nothing to change; reassess).

Add the `spec-patch: unreconciled` marker comment above the test.

## Step 3 — Make the change

Make the **minimal** code change that turns the behavior correct. Do not refactor unrelated code. Do not touch other tests.

## Step 4 — Prove it green, and guard against regressions

1. Run the single patch test — it must now pass.
2. Run the **full** suite with `<test-cmd>` — it must be all green. A localized change that breaks another test is not done; fix it before committing.

If you can't get the full suite green within a few honest attempts and the failure reveals deeper entanglement, this wasn't a fast-lane change after all — stop and route it to `spec-loop`.

## Step 5 — (Optional) eager claim

If the spec was silent or the claim needs updating and the right wording is obvious, you may edit the zettel now: add/adjust the one-line claim and stamp the test file in its `tests:` frontmatter (matching the project convention). This is optional — reconciliation will do it if you don't, and will confirm any spec-silent claim with the user regardless. Even if you write the claim eagerly, **leave the marker in place**: the deferred *adversarial verification* of the test still has to run in the next full loop. Reconciliation removes the marker, not you.

## Step 6 — Commit

Unless `--no-commit`, stage only the touched code and test files and commit:

```
patch: <one-line description>

<zettel-id | spec-silent> — test proven red→green; deferred to spec-loop reconciliation.
```

Committing a patch with an unreconciled marker is intentional and expected — it's the IOU the next full loop redeems.

## Step 7 — Report

```
spec-patch complete
-------------------
Change: <one-line description>
Spec: <zettel-id> claim <N> (violated existing claim | claim updated | spec-silent)
Test: <fn> — red at assertion (unchanged code) → green (after change)
Full suite: all green (N tests)
Marker: spec-patch: unreconciled — <...>   (← reconciled by next full spec-loop)
Committed: <sha> (or "skipped, --no-commit")
```

End with: `Patched and shipped. Spec reconciliation deferred — the next `spec-loop` run will fold this into the spec and verify it at full strength.`

## What this skill must never do

- Never ship a change without a test that was **red for the right reason** first. The red→green proof is the floor; it is not optional, ever.
- Never skip the marker. An unreconciled change with no marker is invisible to reconciliation — a silent spec drift, the exact failure this design prevents.
- Never guess past a genuine ambiguity, and never take on a large or interdependent behavior change. Those belong in `spec-loop`. The fast lane is for changes small enough to verify by eye.
- Never remove your own marker or claim "reconciled." Only a full `spec-loop` run (spec-lock Step 0), having run the deferred verification, may do that.
