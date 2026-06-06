---
name: spec-scenario-run
description: "Drive a scenario zettel end-to-end as a user N times against a disposable app instance, extract recurring UX friction, adversarially verify each finding, and route it to a lane (spec-patch / candidate-claim / human question) as a friction-proposal. The soft, journey-level companion to the hard claim/test loop — it discovers the gaps *between* claims. Trigger: 'run the scenario', 'spec-scenario-run', 'friction test', 'drive the journey', 'UX scenario'."
user-invocable: true
---

# spec-scenario-run

The hard spec loop (`spec-lock` → `spec-test-author` → `spec-build`) proves every *claim* is met. It is structurally blind to the seams **between** claims: a journey where each step is individually correct but the whole is confusing, dead-ends, or silently no-ops. `spec-scenario-run` covers that blind spot.

It takes a **scenario zettel** (a broad, goal-stated user journey — see the `scenario` tag), drives it end-to-end **as a user** against a disposable real instance **N times**, and emits **friction findings** — evidence of where the path broke. Findings are adversarially verified, then routed into lanes as `friction-proposal` beans for the human (or, above a confidence threshold, into the normal hard loop).

## The one invariant: define ≠ certify

The agent that **experiences** friction must never be the agent that **certifies** the fix. This skill *discovers* friction and *routes* it; it never **hand-edits** production code, tests, or claims itself, and it never certifies its own fix. That keeps the soft signal from ever weakening `green ⟺ spec satisfied`. A finding becomes a real change only by being **handed to an independent certifier**: a candidate claim → `spec-test-author` writes the test (hard loop), or a Lane-2 fix → `spec-patch`, which certifies via a test that was **red before and green after** and defers full adversarial verification to the next `spec-loop`. The Lane-2 auto-patch default does not break this invariant: this skill never writes the fix or its test by hand — it invokes `spec-patch`, whose red→green proof is the independent certification, and the next `spec-loop` reconciles it at full strength. What the skill must never do is *decide a Lane-1 product question* or *mark anything verified in the hard sense* on its own.

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

- An optional scenario reference: a `scenario`-tagged zettel `id` or a file path to scope the run to **one** scenario. **With no reference, the default is the whole suite** (every `scenario`-tagged zettel in the library) — the suite is the intended unit, since cross-scenario recurrence (different personas hitting one root cause) is the strongest signal, and dedup (Step 4) makes repeated full-suite runs cheap in the tracker. `--all-scenarios` is accepted as the explicit spelling of that default.
- `--runs <N>` — full journey runs per scenario (default **1**, **adaptive**). A full journey is the dominant cost (a long agent session), so run it **once** by default. Confirmation does **not** come from re-driving the whole journey — it comes from the per-finding **verifier** (Step 3), which reproduces a *single* finding by re-running just its commands on a fresh seeded instance (seconds, not a full re-drive). That targeted reproduction is the always-on confirmation; a second full journey is the exception. **Escalate to a 2nd journey only when the verifier cannot cleanly reproduce-or-refute a proposal-worthy finding in isolation** — i.e. it looks genuinely *path-dependent* (the friction may depend on the exact sequence the driver took). That trigger is rarely true, unlike "any finding appeared" (which is almost always true and would collapse to always-running-2). An explicit `--runs <N>` skips the adaptive rule and runs exactly N full journeys.
  - *Rationale:* most friction is **structural** (deterministic — a missing command, a silent no-op), caught in one run and confirmed by targeted reproduction. The failure mode a second *journey* would guard against — a one-off fluke of the path — is rare; the failure mode we actually see is the driver **misreading** (bad input, undiscovered command), which the verifier's reproduction catches. And the strongest recurrence signal comes from **different scenarios** hitting the same root cause (two personas, one bug), which a broad suite gives for free — not from N runs of one journey.
- `--harness <path>` — the project's scenario harness providing `up`/`seed`/`ssh`/`tui-*`/`down` (default: auto-detect, step 1).
- `--library <name>` — zettel library override (same resolution as spec-test-gen).
- **Auto-patch is graduated per lane (see Step 4).** **Lane 2** (small, unambiguous fixes) is **live by default**: a finding meeting the bar auto-flows to `spec-patch` (red→green fix committed, bean filed/updated). **Lane 1** (product-intent questions) is **never** auto — always a human bean. **Lane 3** (candidate claims) stays propose-only unless `--live` is passed. This default reflects a proven-out false-positive rate: the Step-3 verifier refutes bogus findings before they're ever filed, so the findings that survive to a lane are reliable. The escape hatches:
  - `--propose` — force full propose mode: **every** finding (including Lane 2) stops at a draft `friction-proposal` bean, nothing auto-patches. Use when exploring a new scenario whose findings you don't trust yet, or to review a batch before letting it flow.
  - `--live` — additionally graduate **Lane 3**: above threshold, candidate claims auto-flow into the hard loop (`spec-lock`). (Lane 2 is already live; `--live` does not change Lane 1.)
- `--threshold <frac>` — recurrence required for auto-flow, as a **fraction of runs** so it's consistent at any N (default **0.6**, i.e. a majority; with the default 2 runs that means both, and a `recovered=false` high-severity event in even one run still surfaces as a *proposal* — the threshold gates only auto-flow, never whether a finding is reported).

## Step 0 — Resolve context

- **Library** — same order as spec-test-gen (`.zettel-libraries.yaml` → `~/.config/zettel/libraries.yaml` → `./docs/zettel/`).
- **Scenario(s)** — if a reference was given, resolve it to that one zettel; **if no reference was given, select every `scenario`-tagged zettel in the library** (the default whole-suite run). If a referenced zettel is **not** tagged `scenario`, stop: this skill only drives scenario zettels.
- **Harness** — `--harness` → `scenario-sandbox.sh` at repo root → a `scenario_harness` key in `.claude/settings.json`/`CLAUDE.md`. The harness MUST expose: `up`, `seed`, `ssh "<cmd>"`, `tui-open/tui-keys/tui-screen/tui-close`, `down`. If none is found, stop and report what's missing (the harness is a prerequisite — see the digital-twin/harness bean).
- Record `runs = N`.

## Step 1 — Drive the scenario (the driver agent)

Run the full journey **once by default**. Per-finding confirmation is the verifier's job (Step 3, targeted reproduction), not a second journey. Only run additional full journeys when Step 3 flags a proposal-worthy finding it could not reproduce-or-refute in isolation (looks path-dependent) — or when `--runs <N>` is given explicitly.

For each journey run, in sequence (a single-instance harness serializes; parallelize only if the harness supports concurrent instances):

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

Because the journey runs once by default, this step **is** the confirmation — it carries the load a second full run would otherwise carry, but per-finding and far cheaper. For each candidate finding, spawn a **verifier** (distinct from driver and judge) that tries to **refute** it. The verifier's job is to catch the failure mode the soft layer is most exposed to: a finding that is really **driver error**, not a product defect. It does both a **targeted reproduction** and a set of **refutation checks**:

**Targeted reproduction (the cheap confirmation).** On a fresh seeded instance (`harness up`/`seed`), re-run *just the commands implicated in this one finding* — not the whole journey — and observe directly whether the friction reproduces. This is the per-finding analogue of a second journey run: seconds of harness calls instead of a full re-drive. Use the project's real seed/inputs (see the input-validity check). Record the reproduction commands + result as part of the verdict. Tear down after.

**Refutation checks:**
- **Did the driver feed valid input?** Compare the driver's invocations against how real inputs are produced (the project's real seed/import path, canonical reference forms). *A hand-built or malformed input that "failed" is not a product finding.* (The F1 lesson: a plausible high-severity finding was really the driver using the wrong sprint-key format.)
- **Is the expected behavior actually specified, or did the driver invent an expectation?** (E.g. "release target window is empty" is working-as-specced when the spec says those dates have no population path in 1.0.)
- **Did it reproduce in isolation?** If the targeted reproduction reproduces it, it's real — a *structural* finding (missing command, silent no-op, wrong output) is real even from a single journey run. If it does **not** reproduce in isolation but the driver clearly hit it, the friction may be **path-dependent** → this is the one case that warrants a 2nd full journey run (Step 1's escalation), to see whether an independent traversal hits it again. Refute as a genuine "one-off stumble" only when it looks like the agent fumbling a path that otherwise works.

Drop findings the verifier refutes (record them as "investigated, not real" — don't silently discard). Keep the rest.

## Step 4 — Route into lanes

**First, dedupe against existing proposals — never file a duplicate.** This skill is meant to be run repeatedly (and across a suite), so the same friction will resurface. Before creating *any* `friction-proposal` bean, search for an existing one for the same finding:

```
beans list --json --tag friction-proposal            # the open proposal set
```

Match a surviving finding to an existing bean by **(scenario id + the affordance it concerns)** — the command/flag/screen at fault and the `kind` — not by exact wording (the judge phrases it differently each run). When in doubt, read the candidate bean's body and decide if it's the same underlying friction.

- **Existing open bean found** → **update it, don't create.** Bump its recurrence (append this run's date + `k/N`), add any new evidence excerpt, and refresh severity if it changed. One bean per distinct friction, accumulating evidence across runs — that *strengthens* the signal instead of cluttering the tracker.
- **A matching bean exists but is `completed`/`scrapped`** (the friction was fixed or rejected) and the finding **reproduced again** → this is a **regression or a reopened decision**: create a new bean that references the old one, rather than silently reopening. Flag it in the report.
- **No match** → create a new `friction-proposal` bean.

Then, for each surviving finding, by `candidate_lane`:

- **Lane 1 — product-direction** (the spec is genuinely silent on *intent*; no deductive test could settle it): **always file a `friction-proposal` bean as a question for a human.** Never invent the product direction. **Never** auto-flows, in any mode — a product decision is not the skill's to make.
- **Lane 2 — small, unambiguous fix** (confusing error, missing obvious flag, silent no-op): **live by default.** When recurrence ≥ `--threshold` **and** there is a **single, clean fix direction**, invoke `spec-patch` with the proposed change (red→green now, fix committed with its unreconciled marker; full reconciliation deferred to the next `spec-loop`) **and** file/update the `friction-proposal` bean to record what shipped. No merge gate — you review the patch commit and the bean afterward; `spec-patch` keeps it safe (a test that was red before and green after) and the next `spec-loop` reconciles it at full strength.
  - **Guard — ambiguous fix direction stays a draft bean.** If the finding has more than one plausible fix, or the right fix is a judgment call (e.g. "surface the effective query" *vs* "change the scoping"), do **not** auto-patch — file the draft bean with the candidate directions for a human. Auto-patch is for findings where the fix writes itself; guessing past ambiguity is exactly what `spec-patch` forbids. (This is the lesson of the one deferred finding in review: a valid-looking bug with two candidate directions and no clear winner.)
  - `--propose` suppresses the auto-patch — Lane 2 then stops at a draft bean like the others.
- **Lane 3 — larger / multi-claim gap**: file a `friction-proposal` bean carrying a **candidate claim** (drafted claim text + which zettel it belongs in). **Propose-only by default.** Under `--live` **and** recurrence ≥ `--threshold` → hand the candidate claim to the normal hard loop (it enters at `spec-lock`; `spec-test-author` — *not this skill* — writes the test). Otherwise leave as a draft bean for human triage.

Every `friction-proposal` bean is tagged `friction-proposal` and carries: **scenario id**, **the affordance at fault** (command/flag/screen + `kind`) — these two are its dedup identity — plus recurrence, evidence excerpt(s), proposed direction(s), and lane. **Default routing:** Lane 2 auto-patches (single clean direction, ≥ threshold), Lane 1 always waits for a human, Lane 3 waits unless `--live`. `--propose` forces everything to stop at draft beans — use it to review a batch from an untrusted scenario before letting it flow.

## Step 5 — Report

```
spec-scenario-run — <scenario id | suite>
==========================================
Harness: <path>   Runs: N (adaptive)   Mode: default (L2 auto-patch) | +live (L3) | propose (threshold <frac>)

Satisfaction: <goal-reached runs>/N   (suite: <avg> across <M> scenarios)

Findings (verified):
  [L<lane>] <observed issue>   recurrence k/N   severity
     evidence: <excerpt>
     → <proposed direction(s)>   ⇒ friction-proposal <bean-id> (new | updated existing) [+ spec-patch <sha> (L2 auto) | candidate-claim → spec-lock (L3, --live) | draft: ambiguous direction]

Proposals: <C> new, <U> updated existing, <R> reopened (regression)

Refuted (driver-error / not reproducible):
  <issue> — why refuted

Status: <N findings, M proposals filed, P auto-flowed (live)>
```

End with the single most useful line: `<N> verified friction finding(s) — <P> auto-patched (review the commits), <M> draft proposal(s) for triage (review the friction-proposal beans).`

## What this skill must never do

- Never **hand-edit** production code, tests, or claims; never remove a `spec-patch` marker; never mark anything "verified" in the hard sense. (Lane-2 auto-patch is allowed, but only by *invoking* `spec-patch` — which writes its own red→green test — never by editing code/tests directly here.)
- Never auto-patch a finding with an ambiguous or multi-direction fix — that requires guessing past ambiguity, which `spec-patch` forbids; file a draft bean for a human instead.
- Never let the driver see the claims, the step list, or the scenario's "known friction" — that defeats discovery and the holdout separation.
- Never report a finding without recurrence and a verbatim evidence excerpt, and never skip Step 3 (a friction finding that wasn't refutation-tested is not ready to propose).
- Never gate a merge or auto-decide a Lane-1 product question.
- Never file a duplicate `friction-proposal` — always dedupe against existing open proposals first (Step 4) and update-in-place when the same friction recurs.
