---
name: spec-scenario-run
description: "Drive a scenario zettel end-to-end as a user N times against a disposable app instance, extract recurring UX friction, adversarially verify each finding, and route it to a lane (spec-patch / candidate-claim / human question) as a friction-proposal. The soft, journey-level companion to the hard claim/test loop — it discovers the gaps *between* claims. Trigger: 'run the scenario', 'spec-scenario-run', 'friction test', 'drive the journey', 'UX scenario'."
user-invocable: true
---

# spec-scenario-run

The hard spec loop (`spec-lock` → `spec-test-author` → `spec-build`) proves every *claim* is met. It is structurally blind to the seams **between** claims: a journey where each step is individually correct but the whole is confusing, dead-ends, or silently no-ops. `spec-scenario-run` covers that blind spot.

It takes a **scenario zettel** (a broad, goal-stated user journey — see the `scenario` tag), drives it end-to-end **as a user** against a disposable real instance **N times**, and emits **friction findings** — evidence of where the path broke. Findings are adversarially verified, then routed into lanes as `friction-proposal` beans for the human (or, above a confidence threshold, into the normal hard loop).

## The one invariant: define ≠ certify

The agent that **experiences** friction must never be the agent that **certifies** the fix. This skill only *discovers and proposes*; it never edits production code, tests, or claims, and it never decides a fix ships. That keeps the soft signal from ever weakening `green ⟺ spec satisfied`. A finding becomes a real change only by flowing through the hard loop (a candidate claim → `spec-test-author` writes the test) or `spec-patch` (which defers full verification to the next `spec-loop`) — both certify independently of this skill.

This skill also **never gates a merge.** A satisfaction score gates *attention*, not shipping.

## Scenario zettel format

A scenario zettel is **only the journey** — lean, durable spec content. Canonical sections:

- **Persona** — who the user is and what they know/don't know.
- **Goal** — the outcome to achieve, stated as outcomes not keystrokes (so the driver must discover the path). No step list.
- **Setup** — how the instance is seeded and how the persona connects.
- **Success looks like** — the goal-reached criteria.
- **Out of scope** — what this journey deliberately ignores.

Frontmatter: `tags:` includes `scenario`; `links:` lists the claim zettels the journey traverses; no `tests:` (non-claim-bearing).

**Keep out of the zettel:**
- *Authoring guidance / meta-commentary* ("stated as outcomes by design", "this is a non-claim-bearing zettel…") — that lives here in the skill and in INDEX, not repeated in every file.
- *Runtime findings* — friction this scenario has surfaced is **ephemeral output**; it lives in `friction-proposal` beans and run reports, never baked into the spec. Beyond being stale-prone, a "known friction" list in the body is a **holdout leak**: the driver (Step 1) is given only Persona/Goal/Success precisely so it discovers friction blind. Anything in the zettel that hints where the path breaks defeats that.

## Inputs

- A scenario reference: a `scenario`-tagged zettel `id`, a file path, or `--all-scenarios` to run the whole suite.
- `--runs <N>` — driver runs per scenario (default **3**). Recurrence (k/N) separates real friction from a one-off stumble.
- `--harness <path>` — the project's scenario harness providing `up`/`seed`/`ssh`/`tui-*`/`down` (default: auto-detect, step 1).
- `--library <name>` — zettel library override (same resolution as spec-test-gen).
- `--live` — actually file proposals into the hard loop above the confidence threshold. **Default off (propose mode):** every finding becomes a draft `friction-proposal` bean only; nothing auto-flows. Graduate lanes to `--live` once their false-positive rate proves out.
- `--threshold <k/N>` — recurrence required for auto-flow under `--live` (default **3/5**, i.e. ≥60% of runs).

## Step 0 — Resolve context

- **Library** — same order as spec-test-gen (`.zettel-libraries.yaml` → `~/.config/zettel/libraries.yaml` → `./docs/zettel/`).
- **Scenario(s)** — resolve the reference to one or more `scenario`-tagged zettels. If a referenced zettel is **not** tagged `scenario`, stop: this skill only drives scenario zettels.
- **Harness** — `--harness` → `scenario-sandbox.sh` at repo root → a `scenario_harness` key in `.claude/settings.json`/`CLAUDE.md`. The harness MUST expose: `up`, `seed`, `ssh "<cmd>"`, `tui-open/tui-keys/tui-screen/tui-close`, `down`. If none is found, stop and report what's missing (the harness is a prerequisite — see the digital-twin/harness bean).
- Record `runs = N`.

## Step 1 — Drive the scenario, N times (the driver agent)

For each run `1..N`, in sequence (a single-instance harness serializes; parallelize only if the harness supports concurrent instances):

1. `harness up` then `harness seed` — a fresh, real, seeded instance.
2. Spawn a **driver agent** (one per run, isolated context) given **only**:
   - the scenario's **Goal**, **Persona**, and **Success-looks-like** sections — *not* the claims, *not* a step list, *not* the "known friction" section (holdout: the driver must discover the path, blind to what we expect).
   - the harness primitives it may call: `harness ssh "<cmd>"` (Tier-1 CLI), and `harness tui-open/tui-keys/tui-screen/tui-close` (Tier-2 TUI — drive `browse` via send-keys → screenshot → repeat).
   - the instruction to **behave like the persona**: pursue the goal, reach for help when unsure, guess reasonable commands, and **narrate friction as it happens** ("expected X, got Y; couldn't tell if it worked; had to run `show` to confirm").
3. The driver returns a structured **trajectory**:
   ```
   { scenario_id, run_n, goal_reached: bool,
     commands_issued: [...],
     events: [ { kind, severity, evidence, recovered } ],   // kind ∈ dead-end | confusing-error |
                                                            //   extra-steps | wrong-output |
                                                            //   missing-affordance | discoverability
     notes: "free-form expected-vs-got narration" }
   ```
4. `harness down` — drop the db, kill the server, reap tui sessions. **Always tear down**, even if the run errored.

The driver decides its own keystrokes and when to re-screenshot (it *is* the user; "I couldn't tell what to press" is itself a finding). It must not read production code or the spec claims.

## Step 2 — Extract & dedupe friction (the judge agent)

Spawn a **separate judge agent** (not any driver) over all N trajectories:

- Cluster events describing the same underlying friction across runs (same command/screen/symptom).
- Compute **recurrence `k/N`** per cluster (in how many runs it appeared).
- Roll up a **satisfaction** number: fraction of runs that reached the goal without a blocking (`recovered=false`, high-severity) stall. Report per-scenario and, for `--all-scenarios`, a suite roll-up with cross-scenario findings deduped.
- For each cluster, draft the **uniform proposal artifact**:
  ```
  { observed_issue, evidence (verbatim excerpt), proposed_direction(s),
    recurrence: "k/N", severity, candidate_lane }
  ```

## Step 3 — Adversarially verify each finding (the load-bearing step)

For each candidate finding, spawn a **verifier** (distinct from driver and judge) that tries to **refute** it. The verifier's job is to catch the failure mode that the soft layer is most exposed to: a finding that is really **driver error**, not a product defect. It checks specifically:

- **Did the driver feed valid input?** Compare the driver's invocations against how real inputs are produced (e.g. the project's real seed/import path, canonical reference forms). *A hand-built or malformed input that "failed" is not a product finding.* (This is the F1 lesson: a plausible high-severity finding turned out to be the driver using the wrong sprint-key format.)
- **Is the expected behavior actually specified, or did the driver invent an expectation?**
- **Is it reproducible (k/N ≥ 2), or a one-off stumble?**

Drop findings the verifier refutes (record them as "investigated, not real" — don't silently discard). Keep the rest.

## Step 4 — Route into lanes

For each surviving finding, by `candidate_lane`:

- **Lane 1 — product-direction** (the spec is genuinely silent on *intent*; no deductive test could settle it): **always file a `friction-proposal` bean as a question for a human.** Never invent the product direction. Not subject to `--live` auto-flow.
- **Lane 2 — small, unambiguous fix** (confusing error, missing obvious flag, silent no-op): file a `friction-proposal` bean. Under `--live` **and** recurrence ≥ `--threshold` **and** a clean single direction → additionally invoke `spec-patch` with the proposed change (red→green now; full reconciliation deferred to the next `spec-loop`).
- **Lane 3 — larger / multi-claim gap**: file a `friction-proposal` bean carrying a **candidate claim** (drafted claim text + which zettel it belongs in). Under `--live` **and** recurrence ≥ `--threshold` → hand the candidate claim to the normal hard loop (it enters at `spec-lock`; `spec-test-author` — *not this skill* — writes the test). Below threshold → leave as a draft bean for human triage.

Every `friction-proposal` bean is tagged `friction-proposal` and carries: scenario id, recurrence, evidence excerpt, proposed direction(s), and lane. In propose mode (default) **all** routing stops at the draft bean — review the batch, then re-run with `--live` (per lane) once trustworthy.

## Step 5 — Report

```
spec-scenario-run — <scenario id | suite>
==========================================
Harness: <path>   Runs: N   Mode: propose | live (threshold k/N)

Satisfaction: <goal-reached runs>/N   (suite: <avg> across <M> scenarios)

Findings (verified):
  [L<lane>] <observed issue>   recurrence k/N   severity
     evidence: <excerpt>
     → <proposed direction(s)>   ⇒ friction-proposal <bean-id> [+ spec-patch/candidate-claim if --live]

Refuted (driver-error / not reproducible):
  <issue> — why refuted

Status: <N findings, M proposals filed, P auto-flowed (live)>
```

End with the single most useful line: `<N> verified friction finding(s) — <M> proposals filed (review the friction-proposal beans).`

## What this skill must never do

- Never edit production code, tests, or claims; never remove a `spec-patch` marker; never mark anything "verified" in the hard sense.
- Never let the driver see the claims, the step list, or the scenario's "known friction" — that defeats discovery and the holdout separation.
- Never report a finding without recurrence and a verbatim evidence excerpt, and never skip Step 3 (a friction finding that wasn't refutation-tested is not ready to propose).
- Never gate a merge or auto-decide a Lane-1 product question.
