---
name: zettel-audit
description: "Audit a zettel library for internal consistency — contradictions, interface mismatches, unspecced dependencies, stale claims, and open questions. Trigger: 'audit the spec', 'check spec consistency', 'are there contradictions in the spec', 'audit the zettels'."
user-invocable: true
---

# zettel-audit

Check a zettel library for internal consistency. Unlike `zettel-lint` (which checks structure), `zettel-audit` checks *content* — whether the zettels agree with each other, whether new additions invalidate old claims, and whether everything implied by the spec is actually specced.

Read-only: this skill reports findings and suggests resolutions. It does not edit zettels.

## Input

`--library <name>` to target a specific library. Without this flag, audits all registered libraries but only runs semantic checks on `release-spec` libraries (evergreen libraries get structural checks only).

Optionally `--focus <slug1,slug2,...>` to check only the impact of specific recently-added zettels against the rest of the library. Useful after adding new zettels to verify they don't conflict with existing ones.

## Steps

### 1. Resolve library and collect zettels

Standard library resolution. Read all non-MOC, non-INDEX `.md` files. For each zettel, extract:
- `id`, `title`, `tags`, `links`, `external_links`, `created` from frontmatter
- Full body text

### 2. Mechanical checks (all library kinds)

Run these first — they're fast and catch problems before the semantic pass.

**2a. Broken internal links**
For each zettel, verify every slug in `links:` resolves to a file in the same library. Report missing targets.

**2b. Broken external links**
For each slug in `external_links:`, verify it exists in any registered library.

**2c. INDEX coverage** (release-spec only)
Every non-MOC, non-INDEX zettel should appear in INDEX.md. Report zettels missing from the index.

**2d. Orphaned zettels** (release-spec only)
Zettels not referenced in INDEX.md and not linked from any other zettel. In a release spec, every zettel should be reachable.

Report mechanical findings immediately, then proceed to semantic checks.

### 3. Extract structured claims

Read every zettel body and extract the following into working lists. Be thorough — a missed extraction leads to a missed conflict.

**Interface inventory** — every command name, HTTP route, API endpoint, and flag mentioned:
```
sprint:close --team <slug>       [20260526-sprint-close-open-ceremony]
GET /api/v1/users/me/preferences  [20260526-user-preferences]
task config set default-view     [20260526-user-preferences]
```

**Data model inventory** — every table name, column name, and field name mentioned:
```
teams.active_sprint_id           [20260526-sprint-close-open-ceremony]
task_sprint_appearances          [20260526-sprint-close-open-ceremony]
user_preferences.default_view    [20260526-user-preferences]
tasks.carried_from_sprint_id     [20260526-sprint-close-open-ceremony]  ← if present
```

**Behavioral claims** — assertions about how the system behaves, especially anything involving resolution rules, defaults, or conditions:
```
sprint == current resolves to teams.active_sprint_id when team context available
  [20260526-sprint-close-open-ceremony]
sprint == current resolves to date-based when no team context
  [20260526-sprint-close-open-ceremony]
task list with no args defaults to assigned-to-me view
  [20260526-user-preferences]
```

**Terminology** — key terms used and their definitions (or lack thereof):
```
"team-scoped view"  defined in [20260526-filter-expression-language]
"standalone mode"   defined in [20260526-multi-auth-strategy]
```

### 4. Semantic consistency checks

Work through each check category. For each finding, cite the specific zettels in conflict.

**4a. Interface contradictions**
Look for the same command, route, or field name described differently across zettels. Examples to catch:
- Command spelled `sprint:close` in one zettel, `sprint close` in another
- Route path differs between the zettel that introduces it and the zettel that references it
- A flag exists in one description but is absent or named differently in another

**4b. Data model conflicts**
Look for the same table or column referenced with different names, types, or semantics across zettels. Also check:
- A zettel references a field (e.g. `tasks.carried_from_sprint_id`) that is not declared in any data model zettel
- A zettel declares a schema change that contradicts an earlier zettel's schema

**4c. Behavioral contradictions**
Look for two zettels making incompatible claims about the same behavior. Common patterns:
- Resolution rules: zettel A says X resolves one way, zettel B implies it resolves differently
- Default values: zettel A says default is X, zettel B assumes default is Y
- Scope: zettel A says a setting applies globally, zettel B treats it as per-team

**4d. Stale claims** (the "new zettel invalidates old one" class)
For each recently-added zettel (or all zettels if `--focus` is not set), check whether its claims supersede or contradict claims in *older* zettels that weren't updated. This is the hardest check — it requires reasoning about whether an old claim is still true given new context.

Example pattern to catch: a new zettel changes how `sprint == current` resolves (per-team active sprint), but an older zettel (filter-expression-language) still documents the old date-based resolution without acknowledging the new behavior.

For each stale claim found: identify the old zettel, the specific claim that is now outdated, and the new zettel that supersedes it.

**4e. Unspecced dependencies**
Look for concepts, tables, fields, commands, or behaviors that are *implied* by a zettel but not specced anywhere. Examples:
- A command is mentioned but its behavior is not described in any zettel
- A table is referenced in queries but never defined
- A migration is implied (new column, new table) but no zettel describes it
- An API endpoint is called by the CLI but no zettel specifies its contract

**4f. Terminology inconsistency**
Look for the same concept referred to by different names across zettels, or the same term used with different meanings. Examples: "active sprint" vs "current sprint" vs "team sprint" — do all zettels mean the same thing?

**4g. Open questions**
Look for unresolved questions, TODOs, or "TBD" markers in zettel bodies that represent decisions not yet made. Flag these as pending — they are not contradictions, but they are gaps.

### 5. Produce the report

```
Zettel Audit Report — YYYY-MM-DD
=================================
Library: <name> (kind: release-spec | evergreen)
Zettels audited: N
Focus: <slugs if --focus was given, else "full library">

MECHANICAL (N issues)
─────────────────────
[broken-link] <slug> — links: [<missing-slug>] does not resolve
[missing-index] <slug> — not in INDEX.md
...

SEMANTIC (N issues)
───────────────────
[contradiction] <category>
  <slug-a>: "<quoted claim>"
  <slug-b>: "<quoted conflicting claim>"
  → Suggested resolution: <one sentence>

[stale-claim] <slug-old> — claim superseded by <slug-new>
  Stale: "<quoted claim from old zettel>"
  Superseded by: "<quoted claim from new zettel>"
  → Suggested fix: update <slug-old> to reflect the new behavior

[unspecced-dependency] <slug> implies <concept/table/command> that is not specced
  → Suggested fix: add a zettel for <concept>, or add a section to <related-slug>

[terminology] "<term-a>" in <slug-a> appears to mean the same as "<term-b>" in <slug-b>
  → Suggested fix: standardize on one term; update both zettels

[open-question] <slug> — "<quoted unresolved question or TODO>"
  → Resolution required before this spec section is implementable

SUMMARY
───────
N mechanical issues · N contradictions · N stale claims · N unspecced deps · N terminology · N open questions
Spec is [consistent | has issues that should be resolved before building]
```

If no issues are found in a category, omit that section. If no issues at all: print `All checks passed — spec is internally consistent.`

### 6. Prioritize for the user

After the report, if there are issues: state clearly which ones block implementation (contradictions, stale claims affecting currently-being-built features, unspecced dependencies for imminent work) vs. which are lower priority (terminology cleanup, open questions in future milestones).

## Guidance

- Cite exact quotes from zettel bodies when reporting conflicts — don't paraphrase, as the user needs to know exactly what to change.
- A stale claim is not always wrong — sometimes the new zettel is the one that needs updating. Present both sides; let the user decide which direction to resolve.
- When in doubt about whether two claims conflict, report it as a low-confidence finding rather than suppressing it. The user can dismiss false positives; they cannot act on findings that were never surfaced.
- For `--focus` runs: still read the entire library, but bias the stale-claim check toward zettels that the focused slugs could plausibly affect (same tags, shared links, same domain vocabulary).
