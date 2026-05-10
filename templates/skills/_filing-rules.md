# Filing Rules

These rules govern where memory belongs in a Mnemonic vault. File by **primary subject and usage**, never by source format alone.

The runtime extracts the YAML block below and uses it as the rule engine input. Edit the prose freely; if you change the YAML, run `mnemonic doctor` to re-validate.

## Machine-readable rules

```yaml
rules:
  - match: { type: note }
    target: "inbox/{id}.md"

  - match: { type: lesson, hasRepo: true }
    target: "repos/{repo}/lessons/{id}.md"

  - match: { type: decision, hasRepo: true }
    target: "repos/{repo}/decisions/{id}.md"

  - match: { type: pattern, hasRepo: true }
    target: "repos/{repo}/patterns/{id}.md"

  - match: { type: lesson, hasProject: true }
    target: "projects/{project}/lessons/{id}.md"

  - match: { type: decision, hasProject: true }
    target: "projects/{project}/decisions/{id}.md"

  - match: { type: lesson }
    target: "lessons/{id}.md"

  - match: { type: decision }
    target: "decisions/{id}.md"

  - match: { type: pattern }
    target: "patterns/{id}.md"

  - match: { type: prompt }
    target: "prompts/{id}.md"

  - match: { type: meeting }
    target: "meetings/{id}.md"

  - match: { type: person }
    target: "people/{id}.md"

  - match: { type: agent }
    target: "agents/{id}.md"

  - match: { type: repo }
    target: "repos/{repo}/README.md"

  - match: { type: project }
    target: "projects/{project}/README.md"
```

## Notes

- Rules are evaluated **top-to-bottom; first match wins**. Repo-specific and project-specific rules come before generic.
- **Inbox is for quick capture only.** Promotion (via `mnemonic inbox promote` or `mnemonic propose` + `mnemonic promote`) is the only path to canonical types.
- Canonical truth lives at the top of the page in `## Compiled Truth`. Append-only history goes in `## Timeline`. Both are conventions — see the page template for details.
- **Path traversal is rejected at the write boundary.** Templates with literal `..` in `target:` will be rejected by `vaultWriter`.
