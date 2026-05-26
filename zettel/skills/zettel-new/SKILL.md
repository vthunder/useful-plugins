---
name: zettel-new
description: "Create a new atomic zettel note. Trigger: 'new zettel', 'create zettel', 'add to zettelkasten', 'atomize this idea'."
user-invocable: true
---

# zettel-new

Create a single atomic zettel. One idea. One file. Densely linked.

## Library resolution

Resolve the target library using this order:

1. Check for `.zettel-libraries.yaml` in the current working directory (also check `.claude/zettel-libraries.yaml`). The write target is the entry marked `default: true`, or the first entry if none is marked.
2. If no local config exists, the write target is `./docs/zettel/`. Also check `~/.config/zettel/libraries.yaml` for additional named libraries — these are available for search and linking but are **never** the write target.
3. A `library:` parameter overrides the write target by name (searched across both local and global configs).

All writes go to `<resolved-write-target>/<id>.md`.

## Title rule (enforce strictly)

**Title must be a claim or named concept — not a category.**

| Bad (category) | Good (claim or concept) |
|---|---|
| "ACT-R research" | "ACT-R base-level activation decays logarithmically" |
| "Memory notes" | "Working memory capacity is 4 ± 1 chunks" |
| "Spacing effect" | "Spaced repetition exploits the spacing effect to reduce forgetting" |

If the title reads like a folder name, reject it and ask for a specific claim.

## Steps

0. **Resolve target library** using the resolution order above.

1. **Search first.** Run `zettel-search` with the core concept. If strong overlap exists, link to existing instead of creating.
2. **Gather info:**
   - Title (claim/concept — enforce the rule above)
   - Tags (2–5 lowercase kebab-case tags)
   - Links (slugs of related existing zettels)
   - Source file path (optional) if derived from another file — use a path that will remain meaningful (absolute, or relative to a stable root)
   - Library (optional, overrides default library selection)
3. **Generate ID:** `YYYYMMDD-slug` where slug is a short (2–5 word) kebab-case version of the title. Use today's date.
4. **Write** to `<resolved-library-path>/<id>.md`:

```markdown
---
id: YYYYMMDD-slug
title: The claim or concept stated precisely
tags: [tag1, tag2]
links: [related-slug, another-slug]
source: <path to source file, if applicable>
created: YYYY-MM-DD
---

Body: 50–200 words. Atomic — one idea per zettel. Self-contained: a reader should understand the idea without consulting the source. End with the implication or why this idea matters.
```

5. **Bidirectional links.** For each zettel listed in `links:`, check which library it belongs to. If it is in the **same library** as the new zettel, open that file and add the new zettel's slug to its `links:` frontmatter array (if not already present). If the linked zettel is in a **different library**, add its ID to the new zettel's `external_links:` field instead — never edit files in external libraries (see zettel-link for cross-library link behavior).

6. **MOC suggestions.** Glob `<resolved-library-path>/moc-*.md` to find existing Maps of Content. For each MOC whose topic matches the new zettel's tags, note it as a candidate. Surface 0–3 suggestions in this form:

   > "This zettel could link into `moc-memory-systems` (shared tag: memory-retrieval). Add it?"

   Do not add it automatically — surface the suggestion so the agent can decide and act.

   Also check whether `<resolved-library-path>/INDEX.md` exists. If the new zettel is a strong entry point for a major topic, suggest whether it warrants a mention there.

## Quality checks

- Body is 50–200 words
- Body does not merely restate the title — it explains, justifies, or extends
- No unresolved pronouns ("it", "this") without clear antecedent
- `source:` is set if the idea came from another file
