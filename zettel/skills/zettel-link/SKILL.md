---
name: zettel-link
description: "Add a bidirectional link between two existing zettels. Trigger: 'link these zettels', 'connect zettel', 'add zettel link', 'relate two zettels'."
user-invocable: true
---

# zettel-link

Add a bidirectional link between two existing zettels.

## Input

Two zettel identifiers — either full IDs (`20240312-act-r-activation`) or slugs (`act-r-activation`). If slugs are ambiguous, glob `state/zettels/*<slug>*` to resolve.

## Steps

1. **Resolve both files.** Check `state/system/zettel-libraries.yaml` for registered libraries. Search for each ID/slug across all library paths (home first, then external). If a file isn't found in any library, stop and report which is missing.

2. **Determine link type.**
   - If both zettels are in the **same library** → bidirectional link (existing behavior)
   - If they are in **different libraries** → one-way outbound link only (source gets `external_links:`, target is never touched)

3. **Check for existing link.**
   - Same-library: if A lists B in `links:` and B lists A in `links:`, report "already linked".
   - Cross-library: if A lists B in `external_links:`, report "already linked".

4. **Add the link(s).**
   - Same-library: add B's slug to A's `links:`, add A's slug to B's `links:`.
   - Cross-library: add B's ID to A's `external_links:` only. Never edit the target file.

5. Confirm: "Linked `<slug-a>` ↔ `<slug-b>`." (same library) or "Linked `<slug-a>` → `<slug-b>` (one-way, cross-library)."

## Frontmatter editing rule

The `links:` field is a YAML inline array: `links: [slug1, slug2]`. Preserve existing entries. If `links:` is missing from the frontmatter, add it after the `tags:` line.

The `external_links:` field is a YAML inline array like `links:`. It holds IDs (not slugs) of zettels in external libraries. Add it after the `links:` line if not present.
