---
name: zettel-lint
description: "Periodic health check of the zettel corpus. Trigger: 'lint zettels', 'check zettel health', 'find orphaned zettels', 'zettel maintenance'."
user-invocable: true
---

# zettel-lint

Audit the zettel corpus for structural problems. Run periodically (every few weeks) to prevent rot.

## Checks

Resolve registered libraries using this order:

1. Check for `.zettel-libraries.yaml` in the current working directory (also check `.claude/zettel-libraries.yaml`).
2. If not found, check `~/.config/zettel/libraries.yaml`.
3. If neither exists, use `./docs/zettel/` as the sole library.

Run all checks against all resolved libraries.

### 1. Orphaned zettels
A zettel with no incoming links — nothing in the corpus points to it via a `links:` field. Likely too isolated to contribute to the knowledge web.

Orphan detection counts only `links:` fields (bidirectional links) and incoming `links:` references from other zettels within the same library. Do not flag a zettel as orphaned purely because it only appears in `external_links:` fields — cross-library references are intentionally one-way and do not count as incoming links.

```
grep -rL "<id>" <library-path>/  # for each zettel, check if its id appears in any other zettel's links: or body
```

Report: list of orphaned zettel ids + titles (per library).
Action: for each orphan, suggest either linking it into an existing cluster or reviewing whether it should exist.

### 2. Missing cross-references
Pairs of zettels within the **same library** that share 2+ tags but are not linked to each other. Likely related but overlooked. Cross-library pairs are intentionally linked one-way and should not be flagged here.

For each same-library pair with tag overlap ≥ 2: check if either links to the other.

Report: list of unlinked pairs with shared tags.
Action: prompt to run `zettel-link` on flagged pairs.

### 3. Stale sources
Zettels with a `source:` field pointing to a file that no longer exists (moved, renamed, deleted).

```
for each zettel with source: field, check if the path in source: exists on disk
```

Report: list of zettels with broken source paths.
Action: update source path or clear it if provenance is no longer recoverable.

### 4. Tag drift
Tags that appear in only one zettel. Likely a one-off that should be normalized to an existing tag or dropped.

```
extract all tags, count frequency, flag count == 1
```

Report: singleton tags + the zettel that uses them.
Action: suggest merging with a similar existing tag or removing if the tag adds no value.

### 5. Tag clusters with no MOC

Tags that appear in 5+ zettels but have no corresponding `moc-<tag>.md` file in the same library. These are dense clusters that have outgrown ad-hoc linking and warrant a Map of Content.

```
for each tag with count >= 5: check if <library-path>/moc-<tag>.md exists
```

Report: list of tag clusters missing a MOC, with zettel count.
Action: suggest running `zettel-index <tag>` for each flagged cluster.

### 6. Broken external links

For each zettel in each registered library that has an `external_links:` field, verify each listed ID exists in any resolved library path. Report missing targets.

Action: update or remove broken `external_links:` entries.

## Output format

```
Zettel Lint Report — YYYY-MM-DD
================================
Corpus: N zettels (default: N, <library-name>: N, ...)

ORPHANS (no incoming links): N
- 20240312-slug — Title of orphaned zettel
  → Suggestion: link from <related-zettel-id>

MISSING CROSS-REFS: N pairs
- 20240312-slug-a ↔ 20240315-slug-b (shared tags: tag1, tag2)
  → Run: zettel-link

STALE SOURCES: N
- 20240318-slug — source: /path/to/missing-file.md (file not found)

TAG DRIFT (singleton tags): N
- "sparse-tag" used only in 20240320-slug — consider merging with "similar-tag"

MOC GAPS (dense tag clusters with no MOC): N
- "memory-retrieval" — 8 zettels, no moc-memory-retrieval.md → run: zettel-index memory-retrieval

BROKEN EXTERNAL LINKS: N
- 20240401-slug — external_links: [20240210-missing-id] (not found in any library)
  → Update or remove the broken entry

All clear: No issues found.
```

## Cadence

Run after bulk conversions and then every 2–4 weeks. Not required before every `zettel-new` — that's `zettel-search`'s job.
