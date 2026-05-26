---
id: 20260526-zettel-id-encodes-date-and-slug
title: Zettel IDs encode creation date and a topic slug
tags: [zettelkasten, ids, file-format]
links: [atomic-notes-are-single-ideas, moc-zettelkasten]
created: 2026-05-26
---

Every zettel filename follows the pattern `YYYYMMDD-short-slug.md`, where the date is the creation date and the slug is a 2–5 word kebab-case summary of the title. For example: `20260526-working-memory-capacity.md`.

The date prefix provides a stable, sortable, unique-enough namespace without requiring a central ID registry. Two zettels created on the same day with different slugs will never collide. The slug makes the file human-readable in a directory listing without opening it.

Within the frontmatter, the `id` field repeats the filename stem (without `.md`). Links between zettels use the slug portion only (without the date) when the zettel lives in the same library, making links readable and resilient to minor slug edits. Cross-library links use the full ID including the date prefix to avoid ambiguity.

This scheme means you can navigate, grep, and sort a zettel library with standard filesystem tools and no database.
