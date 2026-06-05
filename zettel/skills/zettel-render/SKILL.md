---
name: zettel-render
description: "Assemble zettels into a readable document. Trigger: 'render spec', 'generate doc from zettels', 'assemble zettel view', 'recreate the spec', 'produce onboarding doc', 'render the release spec'."
user-invocable: true
---

# zettel-render

Assemble a set of zettels from a library into a single readable markdown document. Use for recreating a spec, producing onboarding material, generating a PRD section, or sharing content with someone outside the zettelkasten.

## Input

One of:
- `--moc <tag>` — render all zettels referenced by `moc-<tag>.md`, in MOC order
- `--tag <tag>` — render all zettels tagged with `<tag>`, sorted by creation date
- `--slugs slug1,slug2,...` — render an explicit ordered list of zettels by slug or ID
- `--library <name>` — render the entire library (all non-MOC, non-INDEX zettels), ordered by MOC if one exists, otherwise by creation date

Optionally: `--output <filepath>` to write the result to a file instead of printing. `--library <name>` can be combined with any of the above to target a specific library.

Optionally: `--no-scenarios` — exclude `scenario`-tagged zettels (non-claim-bearing end-to-end journeys) for a pure claims/behavior spec. By **default scenarios ARE included**, grouped under their own section. They are legitimate spec content (user journeys), so a full render shows them — but under the INDEX "Scenarios" heading, kept visually separate from the claim-bearing zettels, never interleaved with them.

## Library resolution

Standard resolution order:
1. `.zettel-libraries.yaml` in cwd (also `.claude/zettel-libraries.yaml`)
2. `~/.config/zettel/libraries.yaml`
3. Default: `./docs/zettel/`

If `--library` is given, search both local and global configs by name.

## Steps

1. **Resolve the library and selection.** Determine which library to read from and which zettels to include, using the input above.

2. **Collect and order zettels.**
   - For `--moc`: read `moc-<tag>.md`, extract `[[id]]` references in the order they appear. That is the render order.
   - For `--tag`: grep `<library-path>/*.md` for `tags:` containing `<tag>`. Sort by `created:` ascending.
   - For `--slugs`: resolve each slug/ID to a file path in order given.
   - For `--library`: check for `INDEX.md` first — if present, use the `[[id]]` order from INDEX.md (this is the authoritative order for release-spec libraries). If no INDEX.md but a MOC exists, use MOC order for indexed zettels then append unindexed by creation date. If neither, sort all by creation date. If INDEX.md has sections (`##` headings), preserve them as section headings in the rendered document.
   - **Scenario zettels:** if `--no-scenarios` is set, drop every `scenario`-tagged zettel from the selection (in any mode). Otherwise include them, but **grouped, not interleaved**: with INDEX.md its "Scenarios" section already places them last (nothing to do); without INDEX.md, collect `scenario`-tagged zettels into a trailing "Scenarios" section after the claim-bearing ones rather than mixing them into creation-date order.

3. **Read each zettel.** Extract title, tags, body. Strip frontmatter from output.

4. **Render the document.**

   ```markdown
   # <Document title>

   > Rendered from `<library-name>` · <N> zettels · <date>

   ---

   ## <zettel title>

   <zettel body>

   ---

   ## <zettel title>

   <zettel body>

   ---
   ```

   **Document title:** for `--moc`, use the MOC title (strip "MOC: " prefix). For `--library`, use the library `name:`. For `--tag`, use the tag name. For `--slugs`, use "Selected zettels".

   **Links:** `[[slug]]` references in zettel bodies are left as-is if rendering to a file (they remain navigable in editors that support wiki links). If printing to terminal, render them as `<title> (slug)` by resolving each slug to its title.

5. **Output.**
   - If `--output` was given: write to that path. Confirm: "Rendered <N> zettels to `<path>`."
   - Otherwise: print the rendered document to the conversation.

## Example use cases

- `zettel-render --library task-1.0` — recreate the full 1.0 spec as a document
- `zettel-render --moc task-1.0-spec` — render the spec MOC in authored order
- `zettel-render --tag auth --library task-1.0` — auth section only
- `zettel-render --slugs 20260526-multi-auth-strategy,20260526-dual-server-process-model --output auth-overview.md` — targeted doc for sharing
