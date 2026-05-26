---
name: zettel-libraries
description: "Print an overview of all configured zettel libraries. Trigger: 'show zettel libraries', 'list all zettel libraries', 'zettel library overview', 'what zettel libraries exist'."
user-invocable: true
---

# zettel-libraries

Print a compact tree overview of all configured zettel libraries. Shows each library's MOCs and their section names — no individual zettels. Useful for orienting across multiple libraries before searching or linking.

## Steps

1. **Collect all libraries.** Build the full list from both sources:
   - Local config: `.zettel-libraries.yaml` in cwd (also check `.claude/zettel-libraries.yaml`).
   - Global config: `~/.config/zettel/libraries.yaml`.
   - If neither exists, use `./docs/zettel/` as a single unnamed local library.
   - Deduplicate by resolved path (local config takes precedence if the same path appears in both).

2. **For each library**, read its MOC files (`moc-*.md`). From each MOC extract:
   - The tag name (from `id: moc-<tag>`)
   - The zettel count (from the "N zettels" line in the body, or by counting `[[...]]` references)
   - The `##` section headings (names only)

3. **Count totals**: total zettels across all libraries (count non-MOC, non-INDEX `.md` files), total MOCs.

4. **Print the tree:**

```
Zettel libraries  —  <L> libraries · <N> zettels · <M> MOCs

◉ <display-name>  <path>  (<N> zettels · <M> MOCs)
  ├── <tag>  (<N> zettels)
  │     <Section> · <Section> · <Section>
  ├── <tag>  (<N> zettels)
  │     <Section> · <Section>
  └── · · · <K> more MOCs

◉ <next library ...>

◌ <library with no MOCs>  <path>  (<N> zettels · 0 MOCs)
```

**Display name:** for a named library (from config), use the `name:` field. For the local convention fallback (`./docs/zettel/`), use the path itself as the display name.

**Path:** show the path after the display name when display name differs from path; omit when they are the same (e.g. the fallback case where display name is already the path).

**Truncation:** show at most 4 MOCs per library. If a library has more, show the first 4 and a `· · · K more MOCs` line.

**Sections:** list all section headings for a MOC inline, separated by ` · `. If a MOC has no sections (flat list), omit the section line entirely.

**`◉` vs `◌`:** `◉` for libraries that have at least one MOC, `◌` for libraries with no MOCs.

**Connector characters:** use `├──` for all entries except the last, `└──` for the last. Child lines under a non-last parent use `│     ` indent; under a last parent use `      ` indent.

5. **After the tree**, print any relevant nudges:
   - For each `◌` library: `→ <name> has no MOCs — run zettel-index to organize it`
   - If a library has 5+ unindexed zettels (zettels not referenced in any MOC): `→ <name> has <N> unindexed zettels`

## Example output

```
Zettel libraries  —  2 libraries · 49 zettels · 8 MOCs

◉ ./docs/zettel/  (6 zettels · 1 MOC)
  └── zettelkasten  (6 zettels)
        Structure · Organization · Tooling

◉ bud  ~/Documents/bud-state/zettels/  (43 zettels · 7 MOCs)
  ├── memory  (14 zettels)
  │     Retrieval · Storage · Encoding
  ├── learning  (9 zettels)
  │     Spaced Practice · Interleaving
  ├── act-r  (8 zettels)
  │     Activation · Declarative Memory
  └── · · · 4 more MOCs
```
