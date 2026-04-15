---
topic: Repo-Doc Extraction Pipeline
repo: useful-plugins
generated_at: 2026-04-15T00:00:00Z
commit: ecf333f8
key_modules: [dev-docs/skills/repo-doc/extract.sh, dev-docs/skills/repo-doc]
score: 0.71
---

# Repo-Doc Extraction Pipeline

> Repo: `useful-plugins` | Generated: 2026-04-15 | Commit: ecf333f8

## Summary

The extraction pipeline is the only executable code in this repo: `extract.sh` collects raw material from a target repository — compressed structure, file trees, README, manifests, and per-module scoring data — so the `repo-doc` SKILL.md synthesis step can generate `overview.md` and `doc-plan.md` without needing direct file access. It exists because LLM synthesis quality degrades sharply if the agent has to discover and read files ad-hoc; a structured extraction phase front-loads that work into a consistent, token-budgeted set of inputs.

## Key Data Structures

### `compressed.md` (`/tmp/repo-doc-<name>/compressed.md`)
The primary synthesis input. Produced by `repomix --compress --style markdown`, it contains the full directory structure plus compressed function/type signatures (implementations replaced with `⋮----` delimiters). Used both as synthesis input and as the source for centrality counting via `grep`.

### `tree.md` (`/tmp/repo-doc-<name>/tree.md`)
File-tree-only output from `repomix --no-files`. Provides the directory hierarchy without code content — used as a lower-token supplement when `compressed.md` is too large.

### `scoring-data.md` (`/tmp/repo-doc-<name>/scoring-data.md`)
A markdown table with one row per source directory (depth 1–2). Columns: `Module`, `Files`, `LoC`, `Commits 90d`, `Fix-Commits 90d`, `Centrality (import refs)`. This table is the numerical input to the doc-plan topic scoring formula. Produced entirely within `extract.sh`.

### `manifest.md` (`/tmp/repo-doc-<name>/manifest.md`)
Concatenated contents of whichever package manifests exist (`package.json`, `go.mod`, `composer.json`, `Cargo.toml`). Provides the dependency graph and tech-stack signal to synthesis.

### `summary.txt` (`/tmp/repo-doc-<name>/summary.txt`)
Machine-readable metadata: repomix availability, file sizes (bytes, lines, rough token estimate at ~4 chars/token). Consumed by `repo-doc` SKILL.md to annotate the doc frontmatter (`repomix: available|unavailable`).

## Lifecycle

1. **Invocation**: The `repo-doc` SKILL.md runs `bash extract.sh <repo_path> /tmp/repo-doc-<name>/` as a subprocess. The two arguments are positional and required — the script exits immediately if either is missing (`${1:?...}` guard).

2. **Path normalization**: `repo_path` is resolved to an absolute path via `cd && pwd` before any git or repomix commands, preventing relative-path failures if the caller's working directory differs.

3. **repomix availability check**: `command -v repomix` determines whether repomix is on `PATH`. Result stored in `REPOMIX_AVAILABLE` (0/1) and `REPOMIX_VERSION`. If unavailable, the script logs a warning and falls back — it does not exit.

4. **Compressed extraction** (repomix path): Runs `repomix --compress --style markdown --ignore <IGNORE_PATTERNS>` targeting `<repo_path>`. The ignore list covers generated and vendor artifacts: `*_pb2.py,*.pb.go,**/migrations/**,**/vendor/**,**/.venv/**,**/node_modules/**,**/dist/**,**/build/**,**/__pycache__/**`. Output: `compressed.md`.

5. **Tree extraction** (repomix path): Runs `repomix --no-files --style markdown` with the same ignore patterns. Output: `tree.md`. Failures on either repomix step are non-fatal (logged as `WARNING`, script continues).

6. **Fallback extraction** (no-repomix path): Uses `find` to collect source files by extension (`.go`, `.ts`, `.tsx`, `.js`, `.jsx`, `.php`, `.py`, `.rb`, `.rs`, `.java`, `.kt`), capped at 100 results. Writes a minimal `tree.md`. `compressed.md` is created as an empty file so downstream consumers can always `[ -f ]` safely.

7. **README collection**: Iterates candidate names (`README.md`, `README.txt`, `README.rst`, `README`) and `cp`s the first match to `readme.md`. If none found, writes a placeholder.

8. **Manifest collection**: Checks for `package.json`, `go.mod`, `composer.json`, `Cargo.toml` in sequence, appending each found into `manifest.md` with a labeled code block. These are NOT mutually exclusive — a polyglot repo with both `go.mod` and `package.json` will have both appended.

9. **Language detection**: Sets `HAS_GO`, `HAS_TS`, `HAS_PY` flags by checking manifest file existence. Used to select `SRC_EXT` for the scoring-data step. The `if/elif` chain (Go → TS → Python → all) means only one language drives extension selection — a polyglot repo defaults to whichever manifest appears first.

10. **Go module prefix extraction**: If `HAS_GO`, extracts the module path from `go.mod` with `awk '/^module /{print $2; exit}'`. This prefix is later used to count centrality as `"${MODULE_PREFIX}/${rel_path}"` in import strings, since Go imports use full qualified paths.

11. **Per-module scoring**: Iterates directories at `mindepth 1 maxdepth 2` under `repo_path`. For each:
    - Skips hidden dirs and `SKIP_DIRS` (vendor, node_modules, .git, dist, build, __pycache__, .venv, target, .cache, coverage, .nyc_output)
    - Counts source files matching `SRC_EXT` with `find -maxdepth 3 -name <ext>`
    - Skips dirs with zero matching source files
    - Estimates LoC via `find | xargs wc -l | tail -1`
    - Counts 90-day git commits: `git log --since="90 days ago" --oneline -- <rel_path>`
    - Counts fix commits: same with `--grep='\(fix\|bug\|Fix\|Bug\|patch\)'`
    - Counts centrality: `grep -o "<import_prefix>" compressed.md | wc -l`
    - Writes one row to `scoring-data.md`

12. **Summary**: Writes `summary.txt` with per-file stats and token estimates to stdout (via `tee`).

## Design Decisions

- **Centrality via grep, not AST**: Import references are counted by simple string matching on `compressed.md` rather than language-specific AST parsing. This is language-agnostic and requires no additional tooling, but will over-count if a module path appears in comments or string literals, and will not follow re-exports.

- **`set -euo pipefail` with `; true` escapes**: The script uses strict error handling globally, but `grep` exits with code 1 on no-match. Rather than wrapping all grep calls in `if grep ... ; then`, the script appends `; true` to the centrality subshell: `centrality=$(grep ... 2>/dev/null | wc -l | tr -d ' '; true)`. This is the idiomatic escape hatch for strict-mode scripts that need to tolerate grep no-matches.

- **Depth 2 module scan**: `find -mindepth 1 -maxdepth 2` captures top-level directories and one level of nesting. This is enough to distinguish `internal/auth` from `internal/api` in Go repos without exploding the row count for deep directory trees. There is no mechanism to go deeper for unusually nested codebases.

- **Non-fatal repomix failures**: Each repomix invocation uses `|| echo "WARNING: ..."` so a single step failure does not abort the whole extraction. The script can produce partial output (e.g. `tree.md` but no `compressed.md`) and the synthesis step will work with what it has.

- **Single-language bias**: The `SRC_EXT` selection is exclusive: a repo detected as Go will only scan `.go` files for scoring, even if it also has significant TypeScript. This simplifies LoC counting but will undercount modules in the secondary language.

## Integration Points

| From | To | What crosses the boundary |
|------|----|--------------------------|
| `repo-doc` SKILL.md | `extract.sh` | Shell invocation with `repo_path` and `output_dir`; the script is the only way to populate the tmp dir |
| `extract.sh` | repomix (external CLI) | Two invocations: `--compress` for signatures, `--no-files` for tree; repomix must be on PATH |
| `extract.sh` | git CLI | `git log` queries for commit counts (90d churn, fix counts); git must be available and `repo_path` must be a git repo |
| `extract.sh` → `compressed.md` | scoring loop (within same script) | The centrality counting grep reads `compressed.md` that was just written by repomix — same-run file dependency |
| `/tmp/repo-doc-<name>/` | `repo-doc` SKILL.md synthesis step | All five output files (`compressed.md`, `tree.md`, `readme.md`, `manifest.md`, `scoring-data.md`) are consumed by the LLM synthesis prompt |
| `scoring-data.md` | doc-plan synthesis (Phase 2) | The numeric table drives the topic scoring formula for `doc-plan.md` generation |

## Non-Obvious Behaviors

- **`compressed.md` is written before the scoring loop that reads it**: The centrality count depends on `compressed.md` existing. If repomix fails silently and `compressed.md` is absent, the `[ -f "$OUT_DIR/compressed.md" ]` guard sets `centrality=0` for all modules rather than erroring. The resulting `scoring-data.md` will have all zeros in the Centrality column, which suppresses the centrality signal in doc-plan scoring.

- **Go centrality uses full module path**: For Go repos, import references are counted as `"github.com/owner/repo/internal/foo"` while for other languages they're counted as `"internal/foo"`. This means Go centrality numbers are comparable to each other but not to other-language repos.

- **Token estimate is bytes/4, not a real tokenizer**: `summary.txt` reports `~N tokens` computed as `file_size_bytes / 4`. This is a rough heuristic (actual token counts depend on content). The synthesis step uses this for awareness, not gating.

- **README lookup is a first-match linear scan**: The script checks `README.md`, `README.txt`, `README.rst`, `README` in order and stops at the first match. A repo with both `README.md` and `README.rst` will only capture `README.md`.

- **Fix-commit grep matches message body too**: The `--grep='\(fix\|bug\|Fix\|Bug\|patch\)'` pattern matches anywhere in the commit message including the body. A commit with "fixed by removing patch" in its body body will count even if the subject line is unrelated.

- **`mindepth 1 maxdepth 2` means depth-2 dirs can shadow depth-1**: If both `internal/` and `internal/auth/` appear in the scan, both get rows. The `internal/` row will include all files under `internal/` (including those in `auth/`), making its LoC and file count a superset of its subdirectory rows. This can inflate top-level centrality and LoC in the scoring table.

## Start Here

- `dev-docs/skills/repo-doc/extract.sh` — the entire extraction pipeline; read start-to-end to understand all outputs and their derivation
- `dev-docs/skills/repo-doc/SKILL.md` (steps 3–4b) — the consumption side: how extracted files are fed to LLM synthesis and how `scoring-data.md` drives doc-plan scoring
- `dev-docs/skills/arch-doc/SKILL.md` (step 4) — shows the scoped variant: arch-doc runs repomix with `--include` for a topic's key modules rather than the whole repo
- `dev-docs/skills/doc-plan.md` (any generated plan) — concrete output of the pipeline; comparing this to `scoring-data.md` shows how raw metrics become topic scores
