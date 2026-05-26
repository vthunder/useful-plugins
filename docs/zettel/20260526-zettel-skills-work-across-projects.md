---
id: 20260526-zettel-skills-work-across-projects
title: Zettel skills resolve library location from config files, not hardcoded paths
tags: [zettelkasten, configuration, multi-library]
links: [atomic-notes-are-single-ideas, zettels-link-bidirectionally, moc-zettelkasten]
created: 2026-05-26
---

The zettel Claude Code skills (`zettel-new`, `zettel-search`, etc.) locate the library through a three-step resolution:

1. **Local config** — `.zettel-libraries.yaml` in the current working directory (or `.claude/zettel-libraries.yaml`). The entry marked `default: true`, or the first entry, is the write target.
2. **Convention** — if no local config exists, writes go to `./docs/zettel/` relative to cwd. The global config at `~/.config/zettel/libraries.yaml` may also be read to discover named external libraries, but these are never the write target.
3. **Named override** — passing `library: <name>` selects a specific library from either config by name.

This means a project repo gets its own zettel library at `./docs/zettel/` with no configuration required. A personal knowledge base (like bud's) can register a library in the global config and make it searchable from any project without risking accidental writes to it. Cross-project links go into `external_links:` on the linking zettel; the target library is never modified.
