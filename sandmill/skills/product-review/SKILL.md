---
name: product-review
description: "Generate a monthly product review document for a project. Trigger: '/product-review', 'product review for', 'monthly review'."
user-invocable: true
---

# Product Review Skill

Generate a monthly product review document for a project.

## Usage

```
/product-review <project-name>
```

## What This Skill Does

Generates a structured Product Review document following the Square format:

1. **Brief Snapshot** - What the team is working towards and recent focus areas
2. **People Investment** - Team composition, vacancies, hiring risks
3. **Major Accomplishments** - Outcomes achieved since last review
4. **Risks and Challenges** - Current blockers and mitigation plans
5. **Goals Snapshot & Progress** - Status against OKRs/objectives

## Data Sources

The skill pulls from available data sources to pre-populate the review:

- **GitHub Project** - Sprint items, completed work, PRs merged
- **GTD/Tasks** - Project-related tasks and their status
- **Calendar** - Recent meetings, upcoming milestones
- **Project notes** - From state/projects/<project>/notes.md
- **Previous reviews** - For continuity and comparison

## Instructions

When invoked, follow these steps:

### 1. Gather Context

First, identify the project and collect available data:

```
# Check for project folder
Read state/projects/<project-name>/notes.md if it exists

# Get recent GitHub activity for the project
Use github_project_items to fetch recent completed items

# Check GTD for project tasks
Use gtd_list with project filter

# Look for previous reviews
Glob state/projects/<project-name>/reviews/*.md
```

### 2. Generate Draft

Create a draft review using the template structure:

```markdown
# Product Review: <Project Name>
**Period:** <Month Year>
**Prepared by:** Bud (with <owner> input)

## Brief Snapshot

<2-3 sentences on current mission and recent focus. Pull from project notes and recent activity.>

## People Investment

| Role | Current | Target | Notes |
|------|---------|--------|-------|
<If known from project context, otherwise mark TBD>

**Vacancies:** <List open roles or "None">

**Hiring commentary:** <Investment appropriateness, key person risks>

## Major Accomplishments

<Pull from GitHub completed items, merged PRs, GTD completed tasks>

- **<Accomplishment>** - <Impact/outcome>

## Risks and Challenges

| Risk | Severity | Mitigation | Owner |
|------|----------|------------|-------|
<Pull from project notes, blocked items, overdue tasks>

**Key challenges:**
<Technical debt, dependencies, external factors>

## Goals Snapshot & Progress

| Goal | Status | Progress | Notes |
|------|--------|----------|-------|
<Pull from project OKRs if defined, otherwise ask user>
```

### 3. Review With User

Present the draft and ask:
- Are there accomplishments I missed?
- Any risks or challenges to add?
- What's the current team composition (for People Investment)?
- Any updates to goals/OKRs?

### 4. Finalize and Save

After user input:
- Update the document with corrections
- Save to `state/projects/<project-name>/reviews/YYYY-MM.md`
- Offer to push to Notion if project has a linked Notion page

## Notes

- Keep reviews to 1-2 pages max
- Focus on outcomes, not activities
- Be honest about risks - flag early, don't bury bad news
- The People Investment section is a differentiator - most templates skip it

---

*Based on Square's product review process*
