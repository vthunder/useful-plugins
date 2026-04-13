---
generated_at: 2026-04-13T01:50:00Z
commit: 44fa705b
repomix: available
---

# useful-plugins — Overview

> Generated: 2026-04-13 | Commit: 44fa705b

## Purpose

A collection of general-purpose plugins for the [Bud](https://github.com/vthunder/bud2) agent framework, providing skills for documentation generation/maintenance, Zettelkasten knowledge management, and general software development workflows. Each plugin is a self-contained directory with a `plugin.json` manifest and one or more `SKILL.md` files that are loaded by the Bud agent at runtime.

## Data Flow

There is no runtime code in this repo — all logic is declarative: `SKILL.md` files contain structured natural-language instructions that the Bud agent interprets when a skill is triggered. When Bud loads a plugin (via `plugins.yaml` or `--plugin-dir`), it reads each `plugin.json` to register the plugin, then walks `./skills/*/SKILL.md` to expose those skills to the agent. When a user triggers a skill (e.g. `dev:repo-doc bud2`), Bud injects the matching SKILL.md content into the agent context and the agent executes the instructions using its available tools (Bash, Read, Write, Grep, etc.).

The `dev-docs/skills/repo-doc/extract.sh` is the only executable file — it is the one piece of shell logic invoked by the `repo-doc` skill to run `repomix` and collect per-module scoring data before synthesis.

## Module Map

| Path | Responsibility |
|------|----------------|
| `dev-docs/` | Documentation generation and maintenance plugin |
| `dev-docs/.claude-plugin/plugin.json` | Plugin manifest registering the `dev-docs` skill collection |
| `dev-docs/skills/repo-doc/SKILL.md` | Generate/refresh `overview.md` + `doc-plan.md` for a repo |
| `dev-docs/skills/repo-doc/extract.sh` | Shell script: runs repomix and collects scoring data for a repo |
| `dev-docs/skills/arch-doc/SKILL.md` | Generate deep-dive architectural docs for specific topics |
| `dev-docs/skills/doc-audit/SKILL.md` | Audit existing docs, classify files, archive stale content |
| `dev-docs/skills/doc-maintain/SKILL.md` | Autonomous doc maintenance: pick highest-value improvement and execute |
| `dev-docs/skills/doc-scan/SKILL.md` | Scan all repos under ~/src/ for documentation status |
| `dev-general/` | General software development skills plugin |
| `dev-general/skills/prd/SKILL.md` | Generate Product Requirements Documents |
| `dev-general/skills/code-review/SKILL.md` | Structured code review guidance |
| `dev-general/skills/web-research/SKILL.md` | Focused web research methodology |
| `zettel/` | Zettelkasten knowledge management plugin |
| `zettel/skills/zettel-new/SKILL.md` | Create atomic zettel notes |
| `zettel/skills/zettel-search/SKILL.md` | Search existing zettels before creating new ones |
| `zettel/skills/zettel-convert/SKILL.md` | Convert ephemeral notes into structured zettels |
| `zettel/skills/zettel-link/SKILL.md` | Add bidirectional links between zettels |
| `zettel/skills/zettel-index/SKILL.md` | Build Maps of Content (MOC) for topic tags |
| `zettel/skills/zettel-lint/SKILL.md` | Periodic health check of the zettel corpus |
| `zettel/skills/zettel-archive/SKILL.md` | Move ephemeral notes to archive |
| `guides/` | Guide-related plugin with zettel storage scaffold |
| `sandmill/skills/product-review/SKILL.md` | Sandmill-specific product review skill |

## Key Files

- `dev-docs/skills/repo-doc/SKILL.md` — The most complex skill; read this to understand the full doc-generation pipeline including reference vs. maintained repo distinctions
- `dev-docs/skills/repo-doc/extract.sh` — The only shell script; orchestrates repomix, README collection, and per-module scoring data
- `dev-docs/skills/doc-maintain/SKILL.md` — The meta-skill that coordinates doc-scan → scoring → repo-doc/doc-audit/arch-doc; read this to understand the autonomous doc maintenance loop
- `dev-docs/skills/arch-doc/SKILL.md` — Shows the pattern for topic-scoped deep dives; explains doc-plan topic scoring
- `zettel/skills/zettel-new/SKILL.md` — Entry point for the zettelkasten workflow; establishes note schema and tagging conventions
- `dev-docs/.claude-plugin/plugin.json` — Plugin manifest format (same pattern used by all four plugins)

## Conventions

- **Testing**: None — this is a pure-markdown/shell repo with no test suite. Correctness is validated by running skills manually or in doc-maintain autonomous mode.
- **Naming**: Skills are named in kebab-case matching their trigger phrase (`repo-doc`, `arch-doc`, `doc-maintain`). Plugin directories are also kebab-case. SKILL.md filenames are always uppercase.
- **Entry points**: Each plugin is registered via `<plugin>/.claude-plugin/plugin.json`; each skill is a `SKILL.md` under `<plugin>/skills/<skill-name>/`.
- **Patterns to know**: Every skill that writes files to a repo must apply the "reference repo guardrail" — check for `state/projects/<name>/overview.md` to determine whether to write to the source repo or to the state directory. Violation of this guardrail is the primary failure mode.

## Start Here

For a given task type, start at:
- **Adding a new skill**: `dev-docs/.claude-plugin/plugin.json` — copy the plugin.json structure, then create `skills/<name>/SKILL.md` using an existing skill as a template
- **Modifying the doc pipeline**: `dev-docs/skills/repo-doc/SKILL.md` — the authoritative spec for all repo-doc behavior; `extract.sh` is the only code path
- **Understanding the autonomous loop**: `dev-docs/skills/doc-maintain/SKILL.md` — the coordination layer; calls doc-scan, scores candidates, dispatches to sub-skills
- **Adding a zettel skill**: `zettel/skills/zettel-new/SKILL.md` — establishes the schema and conventions all other zettel skills follow
- **Running locally**: `README.md` — explains the two install paths (`plugins.yaml` or `--plugin-dir`)
