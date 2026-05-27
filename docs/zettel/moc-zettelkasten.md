---
id: moc-zettelkasten
title: "MOC: zettelkasten"
tags: [moc, zettelkasten]
links: [atomic-notes-are-single-ideas, zettel-id-encodes-date-and-slug, zettels-link-bidirectionally, tags-group-zettels-into-clusters, mocs-curate-dense-tag-clusters, zettel-skills-work-across-projects, 20260526-zettel-library-kind-as-lifecycle-contract, 20260526-release-spec-library-replaces-monolithic-spec, 20260526-index-md-as-toc-for-structured-libraries, 20260526-query-synthesis-creates-new-knowledge, 20260527-spec-driven-two-loop-model, 20260527-test-generation-as-loop-contract]
created: 2026-05-26
---

A Map of Content for zettels tagged `zettelkasten`. Updated: 2026-05-27. 12 zettels.

## Structure

- [[20260526-atomic-notes-are-single-ideas]] **A zettel captures exactly one idea** — the foundational constraint; everything else follows from enforcing this
- [[20260526-zettel-id-encodes-date-and-slug]] **Zettel IDs encode creation date and a topic slug** — how files are named and why the scheme enables grep-based navigation without a database
- [[20260526-zettels-link-bidirectionally]] **Bidirectional links turn isolated zettels into a knowledge graph** — why both ends of a link must be recorded, and how cross-library links differ

## Organization

- [[20260526-tags-group-zettels-into-clusters]] **Tags group zettels into navigable clusters without imposing hierarchy** — why flat tags beat folders, and when a singleton tag signals a problem
- [[20260526-mocs-curate-dense-tag-clusters]] **Maps of Content curate dense tag clusters into navigable overviews** — what distinguishes an authored MOC from a generated index, and when to create one

## Tooling

- [[20260526-zettel-skills-work-across-projects]] **Zettel skills resolve library location from config files, not hardcoded paths** — how local config, global config, and the `./docs/zettel/` fallback interact across projects

## Library organization

- [[20260526-zettel-library-kind-as-lifecycle-contract]] **Zettel library kind should map to maintenance lifecycle, not content type** — the evergreen vs. release-spec distinction and why it prevents cross-contamination between library types
- [[20260526-index-md-as-toc-for-structured-libraries]] **Intentionally structured libraries need a mandatory upfront INDEX.md, not an emergent MOC** — when to declare structure vs. let it emerge from tag density
- [[20260526-release-spec-library-replaces-monolithic-spec]] **A release-spec zettel library replaces a monolithic spec doc** — render, query, and diff as first-class operations on design intent; code-derivable content is dropped

## Query and synthesis

- [[20260526-query-synthesis-creates-new-knowledge]] **Non-obvious synthesis across zettels is itself new knowledge worth capturing** — querying is not just retrieval; it surfaces emergent insights the individual zettels don't express alone

## Spec-driven development

- [[20260527-spec-driven-two-loop-model]] **Spec-driven development runs as two separate loops with different ownership** — Loop 1 (human + agent) owns spec and tests; Loop 2 (fully automated) owns code; merging them removes the feedback mechanism
- [[20260527-test-generation-as-loop-contract]] **Test generation at the end of Loop 1 is the contract that Loop 2 executes against** — tests are written from zettel claims before implementation; the harness must exist first
