---
name: zettel-archive
description: "Move an ephemeral file to an archive/ subdirectory. Trigger: 'archive this note', 'move to archive', 'this note has no zettel value', 'archive sprint brief', 'archive PR snapshot'."
user-invocable: true
---

# zettel-archive

Move an ephemeral file to an `archive/` subdirectory alongside it. Use for files with no evergreen knowledge value: sprint briefs, PR status snapshots, benchmark runs, wellness checks, meeting agendas.

**Do NOT create a zettel** as part of this skill. If there is knowledge worth keeping, run `zettel-convert` first, then archive.

## Input

A file path to archive. The archive destination is `<parent-dir>/archive/<filename>` — the `archive/` folder is always a sibling of the source file, so the file stays near its original context.

## Library resolution

To check for zettel citations, resolve libraries using this order:

1. Check for `.zettel-libraries.yaml` in the current working directory (also check `.claude/zettel-libraries.yaml`).
2. If not found, check `~/.config/zettel/libraries.yaml`.
3. If neither exists, use `./docs/zettel/` as the sole default library.

## Steps

1. **Check for zettel citations.** Grep all resolved library paths for the source file's path in any `source:` frontmatter field.
   - If found: update the `source:` path in those zettels to `<parent-dir>/archive/<filename>`.
   - If not found: proceed.

2. **Move the file.**
   ```bash
   mv <source-path> <parent-dir>/archive/<filename>
   ```
   Create the `archive/` directory if it doesn't exist. If a file with that name already exists in archive, append the current date to the filename before moving: `<stem>-YYYYMMDD.<ext>`.

3. **Confirm.** Report: "Archived `<source-path>` → `<parent-dir>/archive/<filename>`." and list any zettels whose `source:` path was updated.

## What belongs in archive

- Sprint briefs, weekly plans, status updates
- PR or deploy snapshots
- One-off benchmark or profiling runs
- Wellness checks, incident timelines (after postmortem zettel is written)
- Meeting notes with no lasting insight

## What does NOT belong in archive

If a note contains a novel claim, design decision rationale, or lasting finding — run `zettel-convert` first to extract the value, then archive.
