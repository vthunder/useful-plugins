---
name: zettel-query
description: "Answer a question by finding and synthesizing relevant zettels. Trigger: 'query the spec', 'ask the zettelkasten', 'how does X work according to the spec', 'what does the spec say about', 'explain X from the zettels'."
user-invocable: true
---

# zettel-query

Answer a natural language question by searching all registered libraries, reading the relevant zettels, and synthesizing a composed response. Unlike zettel-search (which returns a hit list), zettel-query returns an answer — with citations.

## Input

A question or topic string. Optionally `--library <name>` to restrict search to one library, or `--libraries <name1,name2>` for a subset.

## Library resolution

Standard resolution order — search ALL registered libraries unless scoped:
1. `.zettel-libraries.yaml` in cwd (also `.claude/zettel-libraries.yaml`)
2. `~/.config/zettel/libraries.yaml`
3. Default: `./docs/zettel/`

## Steps

1. **Parse the question.** Extract the core concepts and entities. Identify whether the question is:
   - **Factual** — "What statuses can a task have?" → answer is likely in one zettel
   - **Relational** — "How do epics relate to sprints?" → requires synthesizing 2+ zettels
   - **Procedural** — "How would a new engineer get SSH access?" → requires traversal + synthesis
   - **Comparative** — "How is task auth different from hq auth?" → requires contrast

2. **Search across libraries.** For each library:
   - Title match: grep `title:` frontmatter for question keywords
   - Tag match: grep `tags:` for relevant terms
   - Body match: full-text grep for key terms
   Collect unique matching zettels. Note which library each came from.

3. **Traverse links.** For each matched zettel, follow its `links:` one hop. Add any newly discovered zettels that appear relevant (use judgment — don't blindly add all linked zettels, only ones that bear on the question).

4. **Read and synthesize.** Read the full body of all collected zettels. Compose an answer that:
   - Directly addresses the question
   - Draws on all relevant zettels without repeating their full text
   - Notes tensions or gaps if the zettels don't fully answer the question
   - Cites each zettel used: inline as `[zettel-slug]` or in a "Sources" list at the end

5. **Output format:**

   ```
   <Composed answer — prose, as long as needed to fully answer the question>

   Sources:
   - [slug] Title — one line on what this zettel contributed to the answer
   - [slug] Title — ...

   Gaps: <if the question wasn't fully answerable from the zettels, say what's missing>
   ```

   Omit "Gaps" if the question was fully answered.

6. **Capture new knowledge.** If answering the question required non-obvious synthesis across multiple zettels — combining ideas in a way not captured in any single zettel — flag it:

   > "This synthesis isn't captured in any single zettel. Worth adding as a new zettel? Suggested title: `<claim>`"

   This is especially valuable for release-spec libraries, where Q&A can surface implicit design decisions that were never made explicit.

## Quality guidance

- Answer the question; don't just summarize the zettels. A question deserves a direct answer, not a tour of the corpus.
- If the answer conflicts across libraries (e.g., evergreen pattern vs. release-specific override), surface the conflict explicitly.
- For `release-spec` libraries: note if a spec zettel describes intent that may not yet be implemented.
