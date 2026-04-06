# useful-plugins

A collection of general-purpose plugins for the [Bud](https://github.com/vthunder/bud2) agent framework.

## Plugins

- **zettel** — Zettelkasten knowledge management skills (create, link, search, lint, archive notes)
- **dev-docs** — Documentation generation and maintenance skills (arch-doc, doc-audit, doc-maintain, doc-scan, repo-doc)
- **dev-general** — General development skills (code-review, web-research, prd)

## Usage

Clone this repo and add `--plugin-dir` to your Bud config:

```
--plugin-dir /path/to/useful-plugins
```

Bud will load all plugin directories found under the specified path.
