---
name: zettel-edit
description: "Edit an existing zettel's title, body, or tags. Trigger: 'edit zettel', 'update zettel', 'revise zettel', 'the spec changed update the zettel'."
user-invocable: true
---

# zettel-edit

Edit an existing zettel in place. Use when spec intent changes, a design decision is revised, or a zettel's body is stale.

## Input

A zettel ID or slug, plus the fields to change. Accepts a `library:` argument to narrow search scope if the slug is ambiguous across libraries.

## Library resolution

Resolve registered libraries using the standard order:

1. Check for `.zettel-libraries.yaml` in the current working directory (also check `.claude/zettel-libraries.yaml`).
2. If not found, check `~/.config/zettel/libraries.yaml`.
3. If neither exists, use `./docs/zettel/` as the sole library.

## Steps

1. **Locate the zettel.** Glob `<library-path>/*<slug>*` across all resolved libraries. If multiple files match, list them and ask the user to clarify. If none match, report and stop.

2. **Read the current content.** Show the user the current title, tags, and body before making any changes.

3. **Apply edits.** Accept changes to any subset of:
   - `title` — subject to the title rule for the library's `kind` (claim for evergreen, specific label for release-spec)
   - `body` — replace or patch; if patching, show a before/after diff
   - `tags` — add, remove, or replace
   - `links` — add or remove entries (bidirectional: update linked zettels in the same library accordingly, same as zettel-new)

   Do not change `id`, `created`, or `source` unless explicitly asked.

4. **Write the updated file.**

5. **Check for stale MOC entries.** If the title changed, grep `<library-path>/moc-*.md` for the zettel's ID in `[[id]]` references. If found, the annotation in the MOC may be stale — flag it: "MOC `moc-<tag>` references this zettel; its annotation may need updating."

6. **Confirm.** Report which fields changed and list any MOCs that may need attention.

## When to use

- A design decision in a `release-spec` library changed — update the relevant zettel rather than leaving it stale
- An evergreen zettel's claim needs refinement after new evidence
- Tags need normalization after a zettel-lint run

## When NOT to use

- The change is so significant that the zettel's core claim is different — create a new zettel and link from the old one instead of overwriting
- You want to split a zettel into two — create the new ones via zettel-new, then edit the original to narrow its scope
