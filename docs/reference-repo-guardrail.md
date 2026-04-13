---
topic: Reference Repo Guardrail
repo: useful-plugins
generated_at: 2026-04-13T12:00:00Z
commit: d26bbf8f
key_modules: [dev-docs/skills/repo-doc, dev-docs/skills/arch-doc, dev-docs/skills/doc-maintain]
score: 0.82
---

# Reference Repo Guardrail

> Repo: `useful-plugins` | Generated: 2026-04-13 | Commit: d26bbf8f

## Summary

The Reference Repo Guardrail is a cross-cutting safety constraint that prevents documentation from being committed to a source repository when the documentation for that repo is tracked externally in the Bud state directory. It exists because some repos are "reference repos" — Bud tracks their docs in `~/Documents/bud-state/state/projects/<name>/` rather than `~/src/<name>/docs/` — and writing doc commits to those source repos would cause ownership conflicts and bypass the external tracking contract. Every doc-generation skill (repo-doc, arch-doc, doc-maintain) implements this check independently before writing or committing any file.

## Key Data Structures

### `doc_dir` (runtime variable, all skills)

The resolved output directory for documentation writes. Its value is either `~/src/<repo_name>/docs/` (maintained) or `state/projects/<repo_name>/` (reference). This single variable controls both where files are written and whether a `git commit` is permitted — the two outcomes that the guardrail governs. It is never inferred from the source repo path alone; it is always determined by the detection step.

### `repo_type` (runtime variable, `repo-doc/SKILL.md`)

An enum-like flag set to either `maintained` or `reference` during step 1 of repo-doc. This drives the conditional logic in steps 5 (write location) and 6 (commit or not). In arch-doc and doc-maintain the same distinction is applied implicitly via the resolved `doc_dir` value rather than an explicit variable.

### `state/projects/<repo_name>/overview.md` (filesystem sentinel)

The authoritative signal that a repo is a reference repo. Its presence — regardless of whether `~/src/<repo_name>/docs/overview.md` also exists — is definitive. No flag, config, or user input overrides it. The skills check for this file explicitly during the repo discovery step before taking any action.

### `doc-meta.json` (`~/src/<repo_name>/docs/doc-meta.json` or `state/projects/<repo_name>/doc-meta.json`)

Stores `{"docs_commit": "<SHA>", "generated_at": "<ISO>", "repomix_version": "<version>"}`. Written during repo-doc to record when docs were last generated. Used by the staleness check (`git log <docs_commit>..HEAD`) to detect whether a regeneration is needed. For reference repos, this file lives in the state directory and is never committed to the source repo.

## Lifecycle

1. **Pre-screen in doc-maintain** (`doc-maintain/SKILL.md` step 2): Before scoring candidates, doc-maintain checks for `state/projects/<name>/overview.md` for each documented repo. If found, the repo is flagged as a reference repo. This pre-screen prevents any write-to-source-repo action from being dispatched to sub-skills, even if the sub-skill would catch the error itself.

2. **Discovery in sub-skills** (`repo-doc/SKILL.md` step 1, `arch-doc/SKILL.md` step 1): Each skill independently resolves `doc_dir` by checking in order: `~/src/<repo_name>/docs/overview.md` (maintained), then `state/projects/<repo_name>/overview.md` (reference). The check is sequential — if the state-side file exists, it wins regardless of what the source repo contains.

3. **Write to resolved `doc_dir`**: Generated `overview.md`, `doc-plan.md`, `doc-meta.json`, and arch-doc files are all written to `doc_dir`. For maintained repos this is inside the source repo; for reference repos this is inside the Bud state directory (`~/Documents/bud-state`).

4. **Commit gate** (`repo-doc/SKILL.md` step 6, `arch-doc/SKILL.md` step 6): After writing, the skills check `repo_type` (or the resolved `doc_dir`) before running `git commit`. For maintained repos, they run `git -C <repo_path> add docs/ && git -C <repo_path> commit -m 'docs: ...'`. For reference repos, the commit step is skipped entirely — no prompt, no commit. The state-side files are picked up by the Bud state repo's git tracking separately.

5. **Autonomous mode does not bypass** (`repo-doc/SKILL.md` step 1): The `--autonomous` flag causes doc-maintain to skip interactive prompts and auto-commit, but explicitly does not override the reference repo check. The skill comment reads: "The `--autonomous` flag does not override this — even in autonomous mode, reference repo docs are written to `state/projects/<name>/` with no commit to the source."

## Design Decisions

- **State-side file as sole oracle**: The guardrail uses only the presence of `state/projects/<name>/overview.md` to classify a repo, not a config file, allowlist, or environment variable. This means: any repo can become a reference repo by creating that file; no central registry needs updating when repos are added. The tradeoff is that an accidental `overview.md` in the state directory would silently redirect all doc writes away from the source repo.

- **Redundant checks at every skill boundary**: The guardrail is implemented in repo-doc, arch-doc, and doc-maintain independently rather than in a shared helper. This defensive layering means a sub-skill invoked directly (not through doc-maintain) still applies the check. The cost is that the same logic block is duplicated across three SKILL.md files.

- **doc-maintain pre-screens before dispatching**: Even though sub-skills enforce the guardrail themselves, doc-maintain performs its own pre-screen during candidate scoring (step 2). This prevents a reference repo from appearing as the "highest scoring candidate" and triggering unnecessary work that will be redirected and not committed.

- **Source-side `docs/` is not cleaned up for reference repos**: If `~/src/<repo>/docs/overview.md` exists alongside `state/projects/<repo>/overview.md`, the source-side file is ignored — not deleted. The guardrail does not enforce exclusivity; it only gates writes and commits. Engineers reading the source repo may see stale doc files with no indication they are being ignored.

## Integration Points

| From | To | What crosses the boundary |
|------|----|--------------------------|
| `doc-maintain/SKILL.md` | `repo-doc/SKILL.md` | Dispatches with `--autonomous` flag; doc-maintain pre-screens but relies on repo-doc to enforce guardrail for its own writes |
| `doc-maintain/SKILL.md` | `arch-doc/SKILL.md` | Same dispatch pattern; arch-doc independently re-checks repo type using the same sentinel file logic |
| `repo-doc/SKILL.md` | `state/projects/<name>/` | Writes overview.md, doc-plan.md, doc-meta.json here for reference repos instead of the source repo |
| `arch-doc/SKILL.md` | `state/projects/<name>/` | Writes the arch-doc markdown file here for reference repos |
| All skills | `~/Documents/bud-state` git repo | Reference repo doc files land here; the state repo's git tracking picks them up for commit (not handled by the skills themselves) |

## Non-Obvious Behaviors

- **The source-side `docs/` directory is checked first**: In the repo-doc discovery step, `~/src/<repo>/docs/overview.md` is checked *before* `state/projects/<repo>/overview.md`. This means: if a repo has docs in both places, it is classified as **maintained** (source-side wins). The state-side file only wins when the source-side file is absent. This ordering is the opposite of what the guardrail's "state wins" framing implies.

- **`--autonomous` flag changes commit behavior, not write location**: A common misread is that `--autonomous` enables unrestricted behavior. It does not: it only suppresses interactive prompts. The reference repo check and the write-location decision are independent of `--autonomous`.

- **No git commit happens in the Bud state repo**: The skills write files to `state/projects/<name>/` but do not run `git commit` in `~/Documents/bud-state`. State-side docs accumulate as uncommitted changes. It is the user's (or executive's) responsibility to commit the state repo separately.

- **Stale source-side `docs/` in a reference repo is invisible to the guardrail**: If `~/src/<repo>/docs/` contains outdated docs from before the repo was converted to reference tracking, those files remain. The guardrail does not flag them, and doc-scan will report the repo as "maintained" if it finds `overview.md` there. This can cause doc-maintain to incorrectly classify a reference repo as maintained if the state-side file was not yet created.

- **doc-maintain's pre-screen uses a different check than sub-skills**: doc-maintain checks for `state/projects/<name>/overview.md` during step 2 (scoring). Sub-skills re-derive `repo_type` from the same sentinel during their step 1 (discovery). If a repo is added to `state/projects/` after doc-maintain's pre-screen but before the sub-skill executes, the sub-skill will correctly catch it. There is no race condition risk in normal (single-threaded) operation.

## Start Here

- `dev-docs/skills/doc-maintain/SKILL.md` — The top of the file has the canonical guardrail definition with rules and rationale; start here to understand what the constraint is and why it exists.
- `dev-docs/skills/repo-doc/SKILL.md` — Step 1 shows the exact file-existence check that classifies a repo; step 6 shows how the commit gate is applied. This is the most complete implementation of the guardrail.
- `dev-docs/skills/arch-doc/SKILL.md` — Step 1 shows the same discovery logic reused; step 6 shows the commit gate. Confirms the redundant-check design.
