---
id: 20260526-release-spec-library-replaces-monolithic-spec
title: A release-spec zettel library replaces a monolithic spec doc with a queryable, diffable structure
tags: [knowledge-management, zettelkasten, documentation, conventions]
links: [20260526-zettel-library-kind-as-lifecycle-contract, 20260526-index-md-as-toc-for-structured-libraries]
created: 2026-05-26
---

A monolithic spec document has three failure modes: sections go stale independently but there's no way to update one without touching all; it's not queryable ("what does the spec say about auth?"); and it can't be diffed meaningfully between versions.

A release-spec zettel library fixes all three. Each section of the spec becomes its own zettel — independently editable, tagged, and linkable. The library supports:

- **Render**: assemble any subset (by tag, section, or full library) into a readable document on demand
- **Query**: answer natural language questions by searching and synthesizing across zettels
- **Diff**: compare two release libraries to produce a structured added/removed/revised summary — input for release notes

The source spec document (if one existed) becomes a lightweight index of `[[links]]` pointing into the library. Implementation details that are purely code-derivable (API routes, data model columns) are dropped entirely — they live in the code and don't belong in a spec whose purpose is to capture *intent*.

The key constraint: content that is purely descriptive of current state is a skip. Only content expressing design intent — decisions, rationale, behavior that must be built — belongs in the release-spec library.
