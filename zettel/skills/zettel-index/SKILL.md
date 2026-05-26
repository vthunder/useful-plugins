---
name: zettel-index
description: "Build or rebuild a Map of Content (MOC) for a topic tag. Trigger: 'build zettel index', 'create MOC', 'map of content for', 'index zettels by tag', 'zettel-index'."
user-invocable: true
---

# zettel-index

Build an annotated Map of Content (MOC) for a given tag. A MOC is an *authored* zettel — not a generated table of contents. Each link carries a brief annotation explaining its role in the cluster. This is what makes it useful for navigation vs. being a flat dump.

## Input

A tag name (e.g., `memory`, `act-r`, `spaced-repetition`).

## Library resolution

Resolve the target library using this order:

1. Check for `.zettel-libraries.yaml` in the current working directory (also check `.claude/zettel-libraries.yaml`). The write target is the entry marked `default: true`, or the first entry if none is marked.
2. If no local config exists, the write target is `./docs/zettel/`. Also check `~/.config/zettel/libraries.yaml` for additional named libraries — these are available for search and linking but are **never** the write target.
3. A `library:` parameter overrides the write target by name.

The MOC is written to the resolved write target.

## Steps

1. **Find all matching zettels.** Grep `<resolved-library-path>/*.md` for `tags:` lines containing the given tag. Collect matching file paths. If zero match, report and stop.

2. **Read each zettel.** Extract:
   - `id`, `title`, `tags` (full list), `links`
   - First sentence of the body (for context)

3. **Group by sub-tag.** If zettels share a secondary tag (beyond the query tag), group them under that sub-tag as a section. Ungrouped zettels go under "General".

4. **Write annotated MOC** to `<resolved-library-path>/moc-<tag>.md`:

```markdown
---
id: moc-<tag>
title: MOC: <tag>
tags: [moc, <tag>]
links: []
created: YYYY-MM-DD
---

A Map of Content for zettels tagged `<tag>`. Updated: YYYY-MM-DD. <N> zettels.

## <Sub-tag or "General">

- [[<id>]] **<title>** — <one-line annotation: why this matters here, what role it plays, or contrast with another zettel>
- [[<id>]] **<title>** — <annotation>

## <Sub-tag>

- [[<id>]] **<title>** — <annotation>
```

   The annotation is not the first sentence of the body verbatim — it's a brief editorial note (10–20 words) placing the zettel in context within the cluster. Write it as a human curator would, not as a summarizer.

5. **Link back.** Add `moc-<tag>` to the `links:` frontmatter of each zettel included in the MOC (if not already present).

6. **Update or create INDEX.md.**

   - Count how many `moc-*.md` files now exist in the library.
   - If `INDEX.md` already exists: check whether this MOC is listed. If not, add it with a short annotation and update the "Updated" line.
   - If `INDEX.md` does not exist and there are now 2+ MOCs: create it (see format below) and list all current MOCs.
   - If `INDEX.md` does not exist and there is only 1 MOC: skip — a single MOC doesn't need a meta-index yet.

   **INDEX.md format:**

   ```markdown
   ---
   id: INDEX
   title: Index
   tags: [index]
   links: [moc-<tag1>, moc-<tag2>]
   created: YYYY-MM-DD
   ---

   Entry point for this zettel library. Updated: YYYY-MM-DD. <N> MOCs.

   - [[moc-<tag1>]] **MOC: <tag1>** — <one-line annotation: what domain this cluster covers and why it matters>
   - [[moc-<tag2>]] **MOC: <tag2>** — <annotation>
   ```

   INDEX.md is a zettel itself (`id: INDEX`) but is not tagged with any topic tag — only `index`. It links to MOCs, not to individual zettels. Each entry annotation describes the domain, not the MOC structure.

7. Confirm: "MOC written to `<resolved-library-path>/moc-<tag>.md` — <N> zettels."

## Notes

- MOC files are zettels themselves — they participate in the link graph. Give them a proper `id: moc-<tag>` and frontmatter.
- Do not regenerate automatically. MOCs are authored documents; overwriting one discards editorial work. Warn before overwriting an existing MOC.
- If a MOC already exists for this tag, read it first. Prefer adding new entries to the existing MOC rather than regenerating from scratch.
- INDEX.md is the MOC-of-MOCs: an authored entry point for the whole library. It lives at `<resolved-library-path>/INDEX.md` and is updated incrementally, never regenerated from scratch.
