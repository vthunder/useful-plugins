---
id: 20260526-index-md-as-toc-for-structured-libraries
title: Intentionally structured libraries need a mandatory upfront INDEX.md, not an emergent MOC
tags: [knowledge-management, zettelkasten, conventions]
links: [20260526-zettel-library-kind-as-lifecycle-contract, 20260526-release-spec-library-replaces-monolithic-spec]
created: 2026-05-26
---

In an evergreen zettelkasten, Maps of Content (MOCs) emerge organically: once a tag accumulates 5+ zettels, a MOC is warranted to curate the cluster. INDEX.md in this model is a MOC-of-MOCs — created once there are 2+ MOCs worth indexing.

This emergence model breaks for **intentionally structured libraries** like release-spec. The structure is known upfront (it's the spec outline), the library is small by design, and tag density never reaches the MOC-gap threshold. Waiting for emergence means the library has no navigation until it's large enough to need curation — which defeats the purpose.

The fix: for release-spec libraries, INDEX.md is created immediately and is mandatory. It acts as the table of contents for the whole library, listing every zettel in logical reading order with section headings. Every new zettel is added to INDEX.md at creation time.

The practical consequence: `zettel-render --library` can use INDEX.md as authoritative render order, preserving the spec's intended section structure rather than falling back to creation date or tag clusters.

The general principle: the right INDEX.md strategy depends on whether the library's structure is **discovered** (emergent MOC) or **declared** (mandatory upfront TOC).
