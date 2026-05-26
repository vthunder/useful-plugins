---
name: zettel-visualize
description: "Print a tree overview of a zettel library organized by MOC. Trigger: 'visualize zettels', 'show zettel tree', 'zettel overview', 'what's in my zettel library'."
user-invocable: true
---

# zettel-visualize

Print a tree view of the zettel library, organized by MOC. Each MOC becomes a top-level branch; its existing `##` sections become sub-branches; zettels are listed under their section with truncation for large clusters. Zettels not covered by any MOC appear at the bottom under `unindexed`.

## Library resolution

Resolve the library using this order:

1. Check for `.zettel-libraries.yaml` in the current working directory (also check `.claude/zettel-libraries.yaml`). Use the entry marked `default: true`, or the first entry if none is marked.
2. If no local config exists, use `./docs/zettel/`. Also load `~/.config/zettel/libraries.yaml` for named external libraries — include them in the tree if a `library:` parameter names one, otherwise show only the default library.
3. A `library:` parameter selects a specific library by name.

## Steps

1. **Find all MOCs.** Glob `<library-path>/moc-*.md`. Read each MOC file and extract:
   - The MOC title (from `title:` frontmatter)
   - Each `##` section heading and the zettel IDs listed under it (the `[[id]]` references)

2. **Collect all zettel IDs.** Read the `id:` frontmatter field from every `*.md` file in the library that is not a MOC (`moc-*.md`) and not `INDEX.md`. This is the full corpus.

3. **Determine unindexed zettels.** Any zettel ID not referenced in any MOC's `[[id]]` entries is unindexed.

4. **Resolve titles.** For each zettel ID referenced in a MOC, read its `title:` frontmatter. Do this in bulk — one pass over the files you haven't already read.

5. **Print the tree.** Format as follows:

```
<library-path>  —  <N> zettels · <M> MOCs

◉ <MOC title without "MOC: " prefix>  (<N> zettels)
  ├── <Section heading>
  │   ├── <zettel title>
  │   ├── <zettel title>
  │   ├── <zettel title>
  │   └── · · · <K> more
  └── <Section heading>
      ├── <zettel title>
      └── <zettel title>

◉ <next MOC ...>

◌ unindexed  (<N> zettels)
  ├── <zettel title>
  └── · · · <K> more
```

**Truncation rule:** show at most 3 zettels per section. If a section has more than 3, show the first 3 and a `· · · K more` line. If a section has 3 or fewer, show all with no truncation line.

**Connector characters:** use `├──` for all entries except the last in a group, which uses `└──`. Child lines under a non-last parent use `│   ` indent; child lines under a last parent use `    ` indent.

**`◉` vs `◌`:** `◉` for MOC branches (indexed), `◌` for the unindexed group. Omit the `◌ unindexed` block entirely if there are no unindexed zettels.

6. **After the tree**, print a one-line status:

   - If unindexed count ≥ 5: `→ <N> unindexed zettels — consider running zettel-index`
   - If any MOC has no section headings (flat list only): `→ moc-<tag> has no sections — consider reorganizing`
   - Otherwise: nothing.

## Example output

```
./docs/zettel/  —  14 zettels · 2 MOCs

◉ zettelkasten  (6 zettels)
  ├── Structure
  │   ├── A zettel captures exactly one idea
  │   ├── Zettel IDs encode creation date and a topic slug
  │   └── Bidirectional links turn isolated zettels into a knowledge graph
  ├── Organization
  │   ├── Tags group zettels into navigable clusters without imposing hierarchy
  │   └── Maps of Content curate dense tag clusters into navigable overviews
  └── Tooling
      └── Zettel skills resolve library location from config files

◉ memory  (8 zettels)
  ├── Retrieval
  │   ├── Spaced repetition exploits the spacing effect to reduce forgetting
  │   ├── Retrieval practice strengthens memory more than re-reading
  │   ├── The testing effect holds across content types and age groups
  │   └── · · · 1 more
  └── Storage
      ├── Working memory capacity is 4 ± 1 chunks
      └── · · · 3 more

◌ unindexed  (0 zettels)
```
