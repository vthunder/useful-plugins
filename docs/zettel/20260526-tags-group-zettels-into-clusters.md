---
id: 20260526-tags-group-zettels-into-clusters
title: Tags group zettels into navigable clusters without imposing hierarchy
tags: [zettelkasten, tags, organization]
links: [atomic-notes-are-single-ideas, zettels-link-bidirectionally, mocs-curate-dense-tag-clusters]
created: 2026-05-26
---

Each zettel carries 2–5 lowercase kebab-case tags in its frontmatter. Tags are flat — there is no tag hierarchy, no parent-child relationship. A zettel about spaced repetition might carry `[memory, learning, spaced-repetition]`; the tags do not imply that `spaced-repetition` is a subcategory of `learning`.

This flatness is intentional. Hierarchical filing systems force a single canonical location for each idea; a concept that touches multiple domains either gets duplicated or buried. Flat tags let the same zettel belong to multiple clusters simultaneously without duplication.

Tags serve two operational functions: finding related zettels via grep, and triggering Maps of Content (MOCs) once a cluster grows dense enough (typically 5+ zettels sharing a tag). A singleton tag — used by only one zettel — is a signal to either normalize it to an existing tag or reconsider whether the concept is genuinely distinct. `zettel-lint` flags these.
