---
name: spec-loop
description: "Top-level driver: run the full spec-driven loop end-to-end — spec-lock (audit + stubs + completeness) → spec-test-author (real red tests + semantic verify) → spec-build (implement to green) — stopping at every human decision gate. Trigger: 'spec-loop', 'run the spec loop', 'run the full loop', 'lock-author-build'."
user-invocable: true
---

# spec-loop

Drive the whole spec-driven development loop in one invocation instead of relaying the three skills by hand. This skill **orchestrates**; it does not itself audit, author tests, or write code — it runs the sub-skills in order, inspects each one's result, and either advances to the next stage, loops back, or **stops at a human decision gate**.

```
spec-lock  ──▶  spec-test-author  ──▶  spec-build
(audit+stubs+    (stubs → real red    (red → green)
 completeness)    tests + semantic
                  verify)
   │                  │                    │
   └── gate ──┐   ┌── gate ──┐         ┌── gate ──┐
              ▼   ▼          ▼         ▼          ▼
           STOP and surface to the human (never auto-decide)
```

## Core principle: gates are hard stops

This loop's value is that **green ⟺ spec satisfied**. Every gate exists because proceeding past it would silently ship something unverified. The driver therefore **never** resolves a gate on its own — it stops, presents the gate with its reason + suggested resolution, and waits. The driver honors every gate across the loop:

| Stage | Gate | Surfaced as |
|---|---|---|
| spec-lock | Blocking audit question / audit not clean after 5 cycles | spec-lock stops before commit |
| spec-lock | **Completeness** — **blocking** (new/changed-claim) item with no stub after remediation (`incomplete`) | spec-lock Step 4 hard gate (advisory pre-existing holes don't block) |
| spec-test-author | **Could-not-author** — claim with no executable test (`could_not_author`) | spec-test-author Step 4d |
| spec-test-author | **Test-defect** — authored test that fails at compile/setup (not at the claim assertion) and couldn't be auto-repaired | spec-test-author runtime-validation step |
| spec-test-author | **Weak coverage** — authored test that wouldn't prove its claim (`weak_coverage`) | spec-test-author Step 4e |
| spec-build | **SPEC GAP** / blocked gap — genuine ambiguity or impossible-at-this-layer | spec-build Step 6 / 6.5 |

`--auto-accept-unverified` (default **off**) is the only switch that lets the driver record a gate item as "accepted, known-unverified" and continue. Even then it logs every accepted item loudly in the final report. Without it, any gate ends the run.

## Inputs

- `--since <ref>` — git ref to scope changed zettels (passed through to spec-lock / spec-test-author; default per spec-lock's resolution).
- `--library <name>` — override library selection (passed through).
- `--test-cmd <command>` — override the test command (passed through to spec-build).
- `--parallel` — pass through to spec-build to implement gaps via clustered worktrees.
- `--max-cycles <N>` — maximum full lock→author→build cycles before stopping (default **3**).
- `--auto-accept-unverified` — continue past could-not-author / weak-coverage gates, recording each as known-unverified (default **off** — gates are hard stops).

## State model: stateless and re-entrant

The driver keeps **no state file**. Every sub-skill commits its own checkpoint, so on each invocation the driver re-derives where it is from git + a test run. This means:
- It is safe to re-run after fixing a spec gap — the driver just re-enters from spec-lock scoped to what changed.
- A crashed/interrupted run resumes by re-invoking `spec-loop` with the same args.

## Step 0 — Resolve shared context

Resolve once and reuse for every stage:
- **Library** — same resolution as spec-lock/spec-test-gen (`.zettel-libraries.yaml` → `~/.config/zettel/libraries.yaml` → `./docs/zettel/`; pick `default: true` / first `release-spec` / first).
- **Test command** — same auto-detection as spec-build (`--test-cmd` → settings/CLAUDE.md → Cargo/npm/pytest → `make test`).
- Record `cycle = 1`.

## Step 1 — spec-lock

Run the `spec-lock` skill with the resolved `--since` / `--library`.

- If spec-lock reports **"No changed zettels"**: the spec is unchanged. Skip to Step 3 (spec-build may still have red tests to drive from a prior interrupted run). If spec-build also finds all green, report "loop already complete" and exit.
- If spec-lock stops at its **blocking-audit** gate or its **completeness** gate (a **blocking**, new/changed-claim item in `incomplete`): **STOP**. Relay spec-lock's gate report verbatim and the resume instruction. Do not continue. Advisory pre-existing coverage holes do not stop the loop — spec-lock reports them non-blocking and continues. (With `--auto-accept-unverified`, blocking completeness items still cannot be auto-accepted — a missing test is not something the driver can fabricate; this gate is always hard.)
- Otherwise spec-lock has committed audit fixes + stubs (completeness clean). Continue.

## Step 2 — spec-test-author

Run the `spec-test-author` skill with the resolved `--since` / `--library` / `--test-cmd`.

Inspect its result:
- **`could_not_author` non-empty**, **`test_defect` non-empty** (authored tests that fail at compile/setup rather than at the claim assertion, and couldn't be auto-repaired), or **`weak_coverage` non-empty** → decision gate.
  - Default (no `--auto-accept-unverified`): **STOP**. Relay spec-test-author's gate report (each list, each item with reason + suggested resolution) and wait. These are claims spec-build cannot safely drive.
  - With `--auto-accept-unverified`: record each item under "accepted known-unverified/known-weak" and continue — but never to be reported as covered.
- Otherwise the suite is red and faithfully encodes the spec. Continue.

## Step 3 — spec-build

Run the `spec-build` skill with the resolved `--test-cmd` and `--parallel` if set.

Inspect its completion-gate result:
- **All green** → the cycle closed cleanly. Go to Step 4.
- **Test-defect** → spec-build classified a failure as a defective authored test (it fails at compile/setup, not at the claim assertion) rather than a production gap. Do **not** stop and do **not** implement against it. Re-run `spec-test-author` scoped to the defective test's file to re-author it, then re-run `spec-build`. (This routing counts toward the cycle bound in Step 4.)
- **SPEC GAP(s)** → genuine spec ambiguity. The fix is a *spec change*, which only a human (and spec-lock) can make. **STOP**: relay each SPEC GAP with its options and the standard recommended action (update the zettel, then re-run `spec-loop` — the driver will re-enter from spec-lock). `--auto-accept-unverified` does **not** apply to SPEC GAPs (you cannot "accept" an ambiguous spec).
- **Blocked gap(s)** (needs-capability / environment) → relay each with category + reason + suggested resolution.
  - Default: **STOP** and let the user decide.
  - With `--auto-accept-unverified`: record as known-blocked and continue to the report.

## Step 4 — Loop or finish

- If spec-build reported **all green** and no gate is open: the loop is **complete**. Go to Step 5.
- If a SPEC GAP was surfaced and the user has (in a later invocation) updated the spec: a fresh `spec-loop` run re-enters at Step 1 scoped to the changed zettel. The driver does not edit zettels itself.
- **Cycle bound:** if you have completed `--max-cycles` full lock→author→build cycles without reaching all-green (e.g. each build pass revealed new interdependent gaps), **STOP** and report the remaining failures rather than looping unbounded. Increment `cycle` per full pass.

## Step 5 — Unified report

```
spec-loop — <complete | paused at gate>
=========================================
Library: <path>     Test cmd: <cmd>     Cycles: N / <max>

spec-lock
  Changed zettels: N     Audit fixes: N
  Stubs written/updated: N / N
  Completeness: clean (recovered N missing) | ⛔ GATE: N blocking still missing   (advisory pre-existing holes: N)
spec-test-author
  Authored: N   Re-authored: N   Passed-immediately: N
  Semantic verify: N reviewed, N strengthened
  ⚠ Could-not-author: N   ⚠ Test-defect: N   ⚠ Weak-coverage: N
spec-build
  Gaps: N   Closed: N   SPEC GAPs: N   Blocked: N
  Commits: <sha> … (gap → commit)

Status: <one of>
  ✅ All tests passing — spec implemented and verified.
  ⛔ Paused at <stage> gate — <N> item(s) awaiting your decision (see above).
     Resume: after resolving, re-run `spec-loop <same args>`.
```

End with the single most important line: either `All green — loop complete.` or `Loop paused: <gate name>, <N> item(s) — your call.`

## What this skill must never do

- Never edit a zettel, a test, or production code directly — each sub-skill owns its layer; the driver only sequences them.
- Never resolve a gate silently. Without `--auto-accept-unverified`, every gate is a full stop. With it, every accepted item is still listed loudly as unverified.
- Never report "complete" while any test is failing or any gate is open. "Complete" means the full suite is green with zero open gates.
