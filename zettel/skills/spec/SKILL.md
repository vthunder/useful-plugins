---
name: spec
description: "Browse and navigate a zettel spec library at varying levels of detail, drilling from a whole-library overview down into individual zettels — without rendering the whole spec. Trigger: 'spec', '/spec', 'browse the spec', 'navigate the spec', 'spec overview', 'zoom into the spec'."
user-invocable: true
---

# spec — interactive spec navigator

Turn the conversation into a spec browser. Instead of rendering the whole spec (which gets too big), render one slice at a time at a chosen **zoom level**, and end every view with a navigation footer so the user can move with one short reply. Claude holds the cursor (current location + zoom) in the conversation — no app, no second terminal.

This is a *read/navigate* tool. It never edits zettels. To edit, the user clicks a file path to open it in their editor, or uses the `zettel-edit` skill.

## The zoom dial

Zoom works like a camera: **higher = more zoomed in = more detail.** L0 is the furthest-out overview; L3 is the full text. Each view opens at a sensible default zoom and the user dials in (`+`) or out (`-`) from there.

| Level | Meaning | Source of text |
|---|---|---|
| **L0** | One abstract for the whole library/area | INDEX intro paragraph / MOC intro |
| **L1** | One line per zettel — title + index description | INDEX bullet |
| **L2** | One paragraph per zettel — the lead paragraph (first non-frontmatter paragraph) | zettel lead paragraph |
| **L3** | Full zettel body | the zettel file body |

Default zoom by view: library opens at **L0**, an area at **L1**, a single zettel at **L3**.

## Location grammar

The argument is `<location> [zoom] [? "query"]`:

- **empty** → Library view (home): the library abstract + the list of areas.
- **area name** → Area view: that INDEX `##` section, its member zettels.
- **slug or id** (e.g. `task-crud`, `20260601-task-crud`) → Zettel view: that zettel, full body.
- **a MOC** (e.g. `browse-tui`, `moc-browse-tui`) → MOC view: like an area, but driven by the MOC file's own sections.
- **a bare number** → resolves against the *numbered list in the most recent view* (the current cursor). "3" = open item 3 of what was just shown.
- **zoom modifier**: a trailing `+N` / `-N` adjusts zoom relative to the view's default. `+` = **zoom in / more detail** (raises the level number); `-` = **zoom out / less detail** (lowers it). An absolute `L0`–`L3` sets the level directly. Clamp to [0,3].
- **`? "..."`** → escape hatch: hand the question to the `zettel-query` skill instead of navigating.

Match locations **fuzzily** — area names case-insensitively and by prefix ("query" → "Query and Views"); slugs by suffix/substring ("crud" → `20260601-task-crud`). If ambiguous, render the candidates as a numbered pick-list rather than guessing.

## Library resolution

Resolve the library exactly as `zettel-render` does:
1. `.zettel-libraries.yaml` in cwd (or `.claude/zettel-libraries.yaml`)
2. `~/.config/zettel/libraries.yaml`
3. Default `./docs/zettel/`

Use the `default: true` library unless the user names one with `--library <name>`. The library path holds the zettel `.md` files, an `INDEX.md` (authoritative area structure and order), and zero or more `moc-*.md` files.

## How to render each view

Always lead with a **breadcrumb** showing location and current zoom, and always end with a **footer** of available moves. Keep views compact — this is navigation, not a document dump.

### Library view (`/spec`, default L0)

1. Read `INDEX.md`. Each `##` heading is an area; derive a one-line gloss for each from its bullets.
2. **Lead with a short product narrative** — 2–3 sentences on *what the product is and does*, so a newcomer gets oriented before the structure. Source it in this priority order:
   - an authored overview if one exists (a zettel tagged `about`/`overview`, or an `## About` / `## What it is` section in INDEX.md) — use it verbatim;
   - otherwise synthesize it from the area glosses and the top zettels. Keep it product-focused (what it does for users), not meta ("this is a table of contents…"). Do **not** surface INDEX changelog/audit housekeeping here.
3. Render:

```
<library-name>                                                        [L0 · overview]
──────────────────────────────────────────────────────────────────────────────────
<2–3 sentence product narrative>

Areas:
  1. Interactive UI       entry point, browse TUI interaction model
  2. Process              sprint ceremonies and SSH TUI
  3. Sprints              identity, cadence, reference resolution
  …
```

Footer:
```
open an area: type a number   ·   zoom in: +   ·   ask: ? "question"
```

### Area view (`/spec <area>`, default L1)

1. Find the matching `##` section in INDEX.md.
2. Render its member zettels as a numbered list: title + index description. A member that is itself a MOC is marked `▸` (expandable).

```
<library> › <Area>                                                    [L1 · area]
──────────────────────────────────────────────────────────────────────────────────
<one-line area gloss>

  1. filter-expression-language    boolean expr DSL shared by CLI + saved views
  2. query-command                 views-first; `query <view>` replaces list/epics
  3. task-crud                     non-interactive create / show / update
  …
```

Footer:
```
open: type a number   ·   zoom in: +   ·   back: up   ·   ask: ? "question"
```

Zooming in one notch (`+` → L2) reads each member zettel and shows its lead paragraph instead of the index one-liner.

### MOC view (`/spec <moc>`)

Same as an area, but use the MOC file's own `##` sections and `[[id]]` order as the structure (it has finer grouping than the INDEX). Breadcrumb shows the MOC title.

### Zettel view (`/spec <slug>`, default L3)

1. Read the zettel file. Strip frontmatter.
2. Render the full body. Resolve `[[slug]]` links inline to `<title>` so they read naturally, and list them as navigable siblings in the footer.
3. **Always print the clickable file path** so the user can open it in their editor to read fully or edit:

```
<library> › <Area> › <Zettel title>                                 [L3 · zettel]
──────────────────────────────────────────────────────────────────────────────────
<full zettel body, [[links]] resolved to titles>

📄 docs/zettel-1.0/20260601-task-crud.md:1     (click to open in editor)
🔗 related: filter-expression-language · epic-hierarchy · sprint-reference-resolution
🧪 tests: <from frontmatter>
```

Footer:
```
open related: type a slug   ·   zoom out: -   ·   back: up
```

The zettel view opens at full detail (L3). Zooming out condenses it: `-` (L2) shows only the lead paragraph; `--` (L1) shows only the title + index description.

## Continuing the session

The SKILL instructions stay in context after the first invocation, so **the user never has to retype `/spec`** — a bare reply continues the browse loop. If they reply with just a number, a slug, an area name, `up`, `+`, `-`, `home`, or "open the X one", interpret it against the **cursor** (the last view you rendered) and render the next view the same way. Maintain the cursor mentally from the conversation; you don't need external state. The `/spec ...` forms shown in footers are only the canonical spelling — the bare form is what the user will normally type.

Aliases: `home`/`top` → library view; `up`/`back` → parent scope; `+`/`-` alone → zoom the current view in/out by one notch (`+` = more detail, `-` = less). `+` at the library/area level expands every entry one notch without picking a specific child.

## Notes

- Never render more than one view per reply unless the user asks to "expand all".
- Prefer reading only the files you need: INDEX.md for library/area views; the single zettel file for a zettel view; member files only when an area is zoomed in to L2.
- If the requested location doesn't resolve, show the nearest candidates as a numbered pick-list — don't dump the whole library.
- Keep the breadcrumb and footer on every view; they are the whole navigation affordance.
