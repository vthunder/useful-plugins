---
name: zettel-search
description: "Search existing zettels before creating new ones. Trigger: 'search zettels', 'find zettel', 'does a zettel exist for', 'check zettel coverage', or any time you are about to create a new zettel."
user-invocable: true
---

# zettel-search

Search all registered zettel libraries for existing coverage before creating new zettels. Prevents duplicates and surfaces links.

## Steps

0. **Load library config.** Resolve libraries using this order:
   1. Check for `.zettel-libraries.yaml` in the current working directory (also check `.claude/zettel-libraries.yaml`).
   2. If not found, check `~/.config/zettel/libraries.yaml`.
   3. If neither exists, use `./docs/zettel/` as the sole default library.

   Build a list of `{name, path}` pairs to search across.

1. Take the query string (concept, claim, or keyword).
2. Run three searches against each library's path (`<library-path>/*.md`):
   - Title match: grep the frontmatter `title:` field for query terms (case-insensitive)
   - Tag match: grep the `tags:` frontmatter line
   - Body match: full-text grep across zettel bodies
3. Collect unique matching files across all libraries. For each, extract:
   - `id` from frontmatter
   - `title` from frontmatter
   - First sentence of the body as a one-line summary
   - Which library it came from
4. Return the list. Default library results use the standard format: `<id> — <title>: <one-line summary>`. Results from other libraries are tagged: `[<library-name>] <id> — <title>: <one-line summary>`.

## Output format

```
Matches for "<query>":
- 20240312-act-r-activation — ACT-R base-level activation decays logarithmically: The activation of a memory chunk...
- 20240318-spacing-effect — Spaced repetition exploits the spacing effect: Distributing practice over time...
- [bud] 20240401-spaced-practice — Spaced practice outperforms massed practice: Distributing learning sessions...

No match — safe to create new zettel.
```

If no matches, say so explicitly so the caller knows the search was run.

## Guidance

- If results overlap significantly with what you're about to write: **link to existing instead of duplicating**. Add to `links:` frontmatter.
- Partial overlap: create a new zettel but link to the related ones.
- Always run this before `zettel-new`.

## Query-filing convention

If answering a question required **non-obvious synthesis** across multiple zettels (not just retrieving one), the derived insight is itself new knowledge. After returning results:

1. Ask: did finding this answer involve combining ideas in a way not captured in any single zettel?
2. If yes: prompt to run `zettel-new` with the synthesized insight as the title/claim. The synthesis zettel links back to all source zettels it drew from.
3. If no (answer was already in one zettel): skip.

Knowledge compounds through use, not just through initial capture.
