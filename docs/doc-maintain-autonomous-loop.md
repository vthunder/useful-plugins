---
topic: Doc-Maintain Autonomous Loop
repo: useful-plugins
generated_at: 2026-04-14T00:00:00Z
commit: 30439658
key_modules: [dev-docs/skills/doc-maintain, dev-docs/skills/doc-scan]
score: 0.78
---

# Doc-Maintain Autonomous Loop

> Repo: `useful-plugins` | Generated: 2026-04-14 | Commit: 30439658

## Summary

The `doc-maintain` skill is the coordination layer for autonomous documentation maintenance: it runs a cross-repo scan, scores candidates by improvement priority, selects the highest-value repo, and dispatches exactly one sub-skill (`repo-doc`, `doc-audit`, or `arch-doc`) before stopping. It is designed as an idle-fallback task invoked by the Bud executive when no other queued work is pending — the entire system is declarative (SKILL.md natural-language instructions) with no compiled code.

## Key Data Structures

### Candidate state (per repo, assembled during doc-scan)

Computed in memory during the scan step; never persisted. Fields:

| Field | Source | Meaning |
|-------|--------|---------|
| `commits_behind` | `git log <plan_commit>..HEAD -- . ':(exclude)docs/'` | Non-docs commits since last `overview.md` generation |
| `quiet_hours` | `(now - last_commit_ts) / 3600` | Hours since the most recent commit to the repo |
| `overview_exists` | Presence of `docs/overview.md` or `state/projects/<name>/overview.md` | Whether bootstrapping has happened |
| `has_audit` | Presence of `docs/archive/` directory | Whether `doc-audit` has ever run |
| `top_topic_missing` | `doc-plan.md` rank-1 row `status == "missing"` | Whether the highest-priority arch-doc topic is unwritten |
| `is_reference` | Presence of `state/projects/<name>/overview.md` | Controls write target: state dir vs. source repo |

### Priority score (per candidate)

```
priority = staleness_commits(normalized, 0–50) + has_no_audit(30) + top_topic_missing(20)
```

`staleness_commits` is `commits_behind` normalized across all candidates (max = 50 points). This is additive — a repo with commits *and* no audit *and* a missing top topic can score up to 100.

### Action table

| Condition | Sub-skill dispatched |
|-----------|---------------------|
| `commits_behind ≥ 1` AND `quiet_hours ≥ 6` | `repo-doc --autonomous` |
| overview current, `has_audit == false` | `doc-audit --autonomous` |
| overview current, audit done, `top_topic_missing == true` | `arch-doc "<rank-1 topic>" --autonomous` |
| nothing applies | stop, report "nothing to do" |

## Lifecycle

1. **Invoke doc-scan**: For each directory under `~/src/`, confirm it is a git repo, then check for `docs/overview.md` (maintained) or `state/projects/<name>/overview.md` (reference). If neither exists → undocumented (skip). For documented repos, run the three git queries (last overview commit, commits since, last commit timestamp) to classify as stale or current.

2. **Filter candidates**: Skip any repo with no overview — bootstrapping must be done interactively via `dev:repo-doc`. Skipping is absolute; doc-maintain never auto-generates a first overview.

3. **Score candidates**: For each remaining repo compute the priority score using the formula above. Normalize `staleness_commits` across the full candidate set.

4. **Select highest-scoring repo**: If tied, the tiebreaker is implicit — the first repo by alphabetical order (no explicit tiebreaker is specified in the skill).

5. **Determine action**: Walk the action table in priority order for the selected repo. A repo can score high (e.g., large staleness_commits) but still fail the first condition if `quiet_hours < 6`. In that case the next condition is tried — if the repo has no audit, `doc-audit` is dispatched instead.

6. **Check uncommitted changes**: Run `git status --porcelain` on the selected repo. If output is non-empty, emit a warning in the final report. This does **not** block the action — proceed regardless.

7. **Execute sub-skill with `--autonomous`**: The `--autonomous` flag suppresses all interactive prompts and triggers auto-commit in maintained repos. Sub-skills handle their own reference-repo check at this point.

8. **Stop**: Only one improvement per invocation. If the sub-skill fails (repomix unavailable, git conflict, extraction error), log the failure and stop — do not fall back to a different repo.

9. **Report**: Emit a brief summary block naming the repo, action taken, one-line improvement description, and commit SHA (or `uncommitted`).

## Design Decisions

- **One improvement per invocation**: The unit of work is explicitly bounded to prevent unbounded execution during idle wakes. If more work remains, the next invocation will find it.

- **6-hour quiet gate on repo-doc**: Regenerating overview.md while a repo is actively being developed risks a stale snapshot the moment it's committed. The quiet check ensures the repo has "settled" before paying the repomix extraction cost.

- **No autonomous bootstrapping**: The first `overview.md` must be generated interactively because the agent needs to confirm the write target (maintained vs. reference). Autonomous runs assume this one-time decision has already been made.

- **Reference repo guardrail at the top of the SKILL.md**: The guardrail is the first section the agent reads, before any logic — this placement is intentional so it cannot be overlooked even during skimming.

- **Sub-skill failure is terminal for the invocation**: Falling back to a different repo after a sub-skill failure would make the unit of work unbounded and harder to reason about. The failure is logged and the next invocation will retry or move on.

- **`--autonomous` flag threading**: doc-maintain passes `--autonomous` to every sub-skill call. Sub-skills use this flag to skip confirmation prompts and run `git commit` directly. Without it, sub-skills would hang waiting for user input.

## Integration Points

| From | To | What crosses the boundary |
|------|----|--------------------------|
| Bud executive | `doc-maintain` | Spawns as async subagent via `Agent_spawn_async(profile: "coder", ...)` when no Tasks are pending |
| `doc-maintain` | `doc-scan` | Inline execution; doc-maintain reads the SKILL.md and executes its steps directly (no tool call boundary) |
| `doc-maintain` | `repo-doc` | Dispatch via `dev:repo-doc --autonomous <repo_name>`; receives commit SHA in final output |
| `doc-maintain` | `doc-audit` | Dispatch via `dev:doc-audit --autonomous <repo_name>`; receives archive summary in final output |
| `doc-maintain` | `arch-doc` | Dispatch via `dev:arch-doc "<topic>" --autonomous <repo_name>`; receives generated doc path and commit SHA |
| `doc-maintain` → `repo-doc` | `state/projects/` | For reference repos, sub-skills write to state dir; no commit to source repo |

## Non-Obvious Behaviors

- **The coder agent profile cannot use the `Skill` tool**: The spawn pattern in the SKILL.md specifies `profile: "coder"`, which has `skills: []`. This means the coder agent must read sub-skill SKILL.md files directly with the `Read` tool and execute their instructions manually — it cannot call `Skill("dev:repo-doc")`. The spawn goal explicitly instructs: "Sub-skills are at state/system/plugins/dev/skills/<name>/SKILL.md — read them when doc-maintain references them."

- **A repo with many stale commits can be unactionable**: If `bud2` has 8 commits behind but `quiet_hours == 0`, it scores highest on staleness but fails the quiet gate. The skill then tries the next condition (doc-audit, arch-doc). If neither applies, the condition falls through to "nothing applies" and the top-scored repo contributes no improvement.

- **`top_topic_missing` in the scoring formula is stricter than the action condition**: The scoring formula awards 20 points only if `rank-1` topic has `missing` status. But the action table's condition "top topic missing" is interpreted as "the highest-ranked topic that is still missing" — so a repo with rank-4 missing will qualify for `arch-doc` even if its score formula contribution was 0.

- **Uncommitted changes warning is advisory, not blocking**: The skill explicitly says "proceed regardless" after emitting the warning. This is intentional — the agent should not pause an autonomous wake to wait for a human to commit in-progress work.

- **State dir is the only git repo that receives commits for reference repos**: `state/projects/<name>/` lives inside `~/Documents/bud-state`, which is its own git repository. Sub-skills commit there, not to `~/src/<name>/`.

- **The executive does not wait for doc-maintain to complete**: It is spawned with `Agent_spawn_async` — fire-and-forget. The `handle-subagent-complete` skill processes the result later when the subagent completes and signals done.

## Start Here

- `dev-docs/skills/doc-maintain/SKILL.md` — the full coordination spec; read the scoring formula and action table to understand candidate selection
- `dev-docs/skills/doc-scan/SKILL.md` — the discovery step; shows the exact git queries used to compute staleness and quiet_hours
- `dev-docs/skills/repo-doc/SKILL.md` — the most complex sub-skill; essential reading for the reference repo guardrail and `--autonomous` commit behavior
- `dev-docs/skills/arch-doc/SKILL.md` — the topic-scoped extraction and synthesis pattern; shows how `doc-plan.md` rank-1 status drives the dispatch decision
