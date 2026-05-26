---
name: zettel-convert
description: "Convert a file into one or more zettels. Trigger: 'convert note to zettel', 'atomize this note', 'extract zettels from', 'zettelify'."
user-invocable: true
---

# zettel-convert

Extract atomic knowledge from a file into the zettelkasten. This skill guides judgment — it does not auto-generate zettels.

## Input

A file path to convert. This can be any file: a notes doc, a design doc, a plan file, a meeting summary, etc.

## Finding unmigrated files

To find all files in a directory that have NOT yet been migrated, run:

```bash
grep -rL "migrated\|converted:" <directory>/*.md
```

This catches all legacy marker variants (`<!-- migrated to zettel:`, `<!-- migrated:`, `<!-- converted:`). Files without any of these are candidates.

Do NOT check git history or look for zettel files by name — the marker in the source file is the authoritative signal.

## Steps

### 1. Read the source file

Read the full contents of the target file.

### 2. Determine target library

Check the resolved library list (same resolution order as zettel-new). If there are multiple libraries or a `library:` argument was provided, resolve accordingly. Read the `kind:` field of the resolved target library — this affects the candidate criteria in step 3. If `kind:` is absent, treat as `evergreen`.

### 3. Identify candidate concepts

List every distinct idea, claim, or finding in the file. Number them. For each, assess:
- **Atomic?** Can it stand alone without the source document?
- **Evergreen?** *(evergreen libraries only)* Will it still be true or relevant in a year?
- **Novel?** Does it add something not already obvious from context (or from the codebase, for release-spec)?

Mark each: `zettel` / `combine` / `skip`.
- `zettel`: warrants its own zettel
- `combine`: related to another candidate, should be merged into one zettel
- `skip`: procedural, ephemeral, or too narrow to stand alone

**For `release-spec` libraries:** drop the evergreen criterion. The question is whether the section is a coherent, self-contained unit of intent. Content that is purely derivable from current code without expressing any design intent is still a skip.

**Show this list to the user** (or reason through it explicitly) before writing any zettels.

### 4. For each `zettel` or `combine` group

- Run `zettel-search` to check for existing coverage
- If not covered: run `zettel-new` to create the zettel (it will use the resolved library)
- If covered: note the existing zettel slug (for the comment in step 5)

### 5. Mark the source file

Append a comment at the **bottom** of the source file:

```
<!-- migrated: YYYY-MM-DD, library: <library-name>, zettels: slug1, slug2, slug3 -->
```

(Legacy variants `<!-- converted:` and `<!-- migrated to zettel:` are equivalent — do not add a second marker if one already exists. Legacy markers without `library:` are assumed to target the default evergreen library.)

### 6. Do NOT move or delete the source

The source file stays as a reference. Only move it if separately running `zettel-archive`.

## Judgment guidance

Err toward fewer, better zettels. A 10-page design doc might yield 3–5 zettels, not 30. If a concept only makes sense in the context of the doc, it's a `skip`.
