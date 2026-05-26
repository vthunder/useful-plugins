---
id: 20260526-mocs-curate-dense-tag-clusters
title: Maps of Content curate dense tag clusters into navigable overviews
tags: [zettelkasten, moc, organization, navigation]
links: [tags-group-zettels-into-clusters, zettels-link-bidirectionally]
created: 2026-05-26
---

A Map of Content (MOC) is itself a zettel — with an `id`, `title`, `tags`, and `links` — whose body is an annotated list of other zettels sharing a topic tag. Unlike a generated table of contents, each entry in a MOC carries a short editorial annotation (10–20 words) explaining why that zettel matters within the cluster and how it relates to its neighbors.

MOCs are written by `zettel-index` but are authored documents, not auto-generated indexes. Regenerating a MOC from scratch would discard the editorial curation. New zettels are added to an existing MOC incrementally rather than overwriting it.

The threshold for creating a MOC is roughly 5+ zettels sharing a tag — below that, direct links between zettels are sufficient for navigation. Above that threshold, a MOC provides a curated entry point that helps a reader (or an agent) orient within the cluster without reading every zettel first. `zettel-lint` flags clusters that have crossed this threshold but lack a MOC.
