---
id: 20260526-zettels-link-bidirectionally
title: Bidirectional links turn isolated zettels into a knowledge graph
tags: [zettelkasten, linking, knowledge-graph]
links: [atomic-notes-are-single-ideas, zettel-id-encodes-date-and-slug, tags-group-zettels-into-clusters]
created: 2026-05-26
---

When zettel A links to zettel B, B's `links:` frontmatter array is also updated to include A. Both files record the connection. This bidirectionality is what makes the zettelkasten a graph rather than a tree: you can navigate from either end of any connection without a separate backlinks index.

The `links:` field holds slugs for same-library zettels. For zettels in external libraries (registered in `~/.config/zettel/libraries.yaml`), the receiving zettel's file is never edited — instead the linking zettel stores the target's full ID in an `external_links:` field. Cross-library links are intentionally one-way to avoid write access requirements on external libraries.

Links compound in value as the library grows. A zettel with five links is a node in a web; a library of 500 linked zettels is a navigable map of a knowledge domain. Orphaned zettels — those with no incoming links — signal either a missing connection or a concept that should not exist yet.
