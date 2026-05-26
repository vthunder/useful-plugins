---
id: 20260526-zettel-library-kind-as-lifecycle-contract
title: Zettel library kind should map to maintenance lifecycle, not content type
tags: [knowledge-management, zettelkasten, conventions]
links: [20260526-release-spec-library-replaces-monolithic-spec, 20260526-index-md-as-toc-for-structured-libraries]
external_links: [20260405-adr-status-lifecycle-preserves-design-rationale]
created: 2026-05-26
---

A common mistake when organizing zettel libraries is to split by topic or project. A better split criterion is **maintenance lifecycle**: how long will this library be actively edited, and what happens when it's done?

Two natural kinds emerge:

- **Evergreen** — indefinitely maintained, cross-project, generalizable. Zettels here are refined as understanding deepens. No expiry.
- **Release-spec** — scoped to a specific release or version. Actively edited during development, then archived when the release ships. Content describes intent, not current state.

The `kind` field in library config encodes this contract. It affects tooling behavior: title rules (claims vs. categories), creation criteria (evergreen required for evergreen libraries, not for release-spec), and what happens to the library when its lifecycle ends (archive the whole directory).

This mirrors ADR status lifecycles — the lifecycle state is explicit metadata, not inferred from content age. A library without a declared kind drifts: release-specific content accumulates in evergreen libraries, or evergreen insights get buried in archived release docs.
