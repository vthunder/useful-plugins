---
name: zettel-diff
description: "Compare two zettel libraries and summarize what changed. Trigger: 'diff releases', 'what changed between 1.0 and 2.0', 'compare release specs', 'zettel diff', 'what's new in this release'."
user-invocable: true
---

# zettel-diff

Compare two zettel libraries — typically two release-spec libraries — and produce a structured summary of what was added, removed, or changed. Use for release notes drafting, scope comparison, or understanding how intent evolved between releases.

## Input

Two library names: `<from-library> <to-library>`. Both must be resolvable from the standard library configs. Optionally `--tag <tag>` to restrict the diff to zettels carrying a specific tag.

Example: `zettel-diff task-1.0 task-2.0`

## Library resolution

Standard resolution order for both libraries:
1. `.zettel-libraries.yaml` in cwd (also `.claude/zettel-libraries.yaml`)
2. `~/.config/zettel/libraries.yaml`
3. Fail with a clear error if either library name is not found.

## Steps

1. **Collect zettels from each library.** For each library, read all non-MOC, non-INDEX `.md` files. Extract `id`, `title`, `tags`, and `body` from frontmatter and body.

2. **Match zettels across libraries.** Match by slug (the non-date portion of the ID, e.g. `multi-auth-strategy` from `20260526-multi-auth-strategy`). If no slug match, fall back to title match (case-insensitive, normalized). Unmatched zettels in `<from>` are **removed**; unmatched in `<to>` are **added**.

3. **Classify matched pairs.**
   - **Unchanged** — body and title identical (after normalizing whitespace)
   - **Retitled** — slug matched, title differs, body similar
   - **Revised** — body differs meaningfully (more than minor whitespace/formatting)
   - **Renamed + revised** — neither slug nor title matches well; treat as removed + added unless you can infer the connection from content similarity

4. **For each revised zettel**, produce a human-readable summary of what changed — not a line diff, but a prose description: "The auth model zettel now includes a standalone mode section and removes the Clerk-only path."

5. **Output format:**

   ```
   Diff: <from-library> → <to-library>
   =====================================
   <N> added · <N> removed · <N> revised · <N> unchanged

   ADDED (<N>)
   + [slug] Title — one-line summary of what this covers

   REMOVED (<N>)
   - [slug] Title — one-line note on what was dropped

   REVISED (<N>)
   ~ [slug] Title
     <Prose summary of what changed, 1–3 sentences>

   UNCHANGED (<N>): slug1, slug2, slug3, ...
   ```

   Omit any section that has 0 entries. List UNCHANGED as a compact comma-separated line, not a full list — it's the least interesting part.

6. **Release notes draft (optional).** If the user asks for release notes, render the ADDED and REVISED sections as user-facing prose:

   ```markdown
   ## What's new in <to-library>

   **<Added zettel title>** — <1–2 sentence user-facing description>

   **<Revised zettel title>** — <what changed and why it matters>
   ```

   Skip REMOVED entries unless they represent a deliberate feature removal worth calling out.

## Notes

- This skill compares *intent*, not implementation. It tells you how the spec changed, not whether the code changed to match.
- If comparing libraries with different `kind:` values (e.g., evergreen vs. release-spec), warn the user — the comparison may not be meaningful.
- For large libraries, apply `--tag` to focus the diff on a subsystem rather than the whole release.
