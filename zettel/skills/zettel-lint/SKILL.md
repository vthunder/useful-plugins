---
name: zettel-lint
description: "Periodic health check of the zettel corpus. Trigger: 'lint zettels', 'check zettel health', 'find orphaned zettels', 'zettel maintenance'."
user-invocable: true
---

# zettel-lint

Audit the zettel corpus for structural problems. Run periodically (every few weeks) to prevent rot.

## Checks (parallel workflow)

Resolve registered libraries using this order:

1. Check for `.zettel-libraries.yaml` in the current working directory (also check `.claude/zettel-libraries.yaml`).
2. If not found, check `~/.config/zettel/libraries.yaml`.
3. If neither exists, use `./docs/zettel/` as the sole library.

Read all zettel frontmatter and bodies from all resolved libraries. Then resolve the workflow script path: read `~/.claude/plugins/installed_plugins.json`, find `zettel@useful-plugins`, take its `installPath`. The script is at `<installPath>/workflows/zettel-lint-checks.js`.

Invoke the Workflow tool with `scriptPath` set to that resolved path, passing:

```json
{
  "libraries": [
    {
      "name": "<library-name>",
      "path": "<library-path>",
      "kind": "release-spec | evergreen",
      "zettels": [
        { "id": "...", "title": "...", "tags": [...], "links": [...], "external_links": [...], "source": "...", "path": "..." }
      ]
    }
  ]
}
```

The workflow runs all 6 structural checks concurrently (orphaned zettels, missing cross-references, stale sources, tag drift, MOC gaps, broken external links) and returns:
- `findings` — all findings across all checks, each with `check`, `library`, `zettel_id`, `description`, `suggestion`
- `by_check` — count per check name
- `total_issues` — total finding count

The six checks, for reference:

1. **Orphaned zettels** — no incoming links from same-library zettels (cross-library external_links don't count)
2. **Missing cross-references** — same-library pairs sharing 2+ tags with no bidirectional link
3. **Stale sources** — `source:` field pointing to a file that no longer exists on disk
4. **Tag drift** — tags appearing in only one zettel across the whole corpus
5. **Tag clusters with no MOC** — tags in 5+ zettels in a library with no `moc-<tag>.md`
6. **Broken external links** — `external_links:` entries not found in any resolved library

## Output format

Use the `findings` and `by_check` from the workflow result to produce this report:

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
