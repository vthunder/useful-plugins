# Doc Plan: useful-plugins — 2026-04-13

Scoring: centrality (0.30) + coverage gap (0.30) + complexity (0.20) + churn (0.10) + bug density (0.10)
Topics span modules — signals are the max across constituent modules.

| Rank | Topic | Score | Key Modules | Signals | Status |
|------|-------|-------|-------------|---------|--------|
| 1 | Reference Repo Guardrail | 0.82 | `dev-docs/skills/repo-doc`, `dev-docs/skills/arch-doc`, `dev-docs/skills/doc-maintain` | cross-cutting, no doc, foundational safety constraint | done |
| 2 | Doc-Maintain Autonomous Loop | 0.78 | `dev-docs/skills/doc-maintain`, `dev-docs/skills/doc-scan` | no doc, high complexity, coordinates all other skills | generated |
| 3 | Repo-Doc Extraction Pipeline | 0.71 | `dev-docs/skills/repo-doc/extract.sh`, `dev-docs/skills/repo-doc` | only shell code in repo, no doc, entry point for all doc generation | generated: `repo-doc-extraction-pipeline.md` |
| 4 | Skill Loading and Plugin Manifest | 0.65 | `dev-docs/.claude-plugin/plugin.json`, `zettel/.claude-plugin/plugin.json`, `dev-general/.claude-plugin/plugin.json` | foundational, cross-cutting, no doc | missing |
| 5 | Doc-Plan Scoring Algorithm | 0.61 | `dev-docs/skills/repo-doc`, `dev-docs/skills/arch-doc` | complex scoring formula, no doc, feeds autonomous decisions | missing |
| 6 | Zettel Schema and Lifecycle | 0.55 | `zettel/skills/zettel-new`, `zettel/skills/zettel-lint`, `zettel/skills/zettel-convert` | no doc, 7 interdependent skills | missing |
| 7 | Doc-Audit Classification Pipeline | 0.48 | `dev-docs/skills/doc-audit` | no doc, complex classification rules | missing |
| 8 | Arch-Doc Topic Extraction | 0.42 | `dev-docs/skills/arch-doc` | no doc, repomix scoping pattern | missing |

## Recommended next

Run `dev:arch-doc "Skill Loading and Plugin Manifest"` on `useful-plugins` — foundational cross-cutting concern; documents how plugins register skills with the Bud agent.

---
_Generated: 2026-04-13T01:50:00Z | Commit: 44fa705b_
