---
id: memory/remember
name: Remember
description: Capture a quick note to inbox without canonicalizing it.
status: active
parameters:
  - { name: content, type: string, required: true }
  - { name: tags, type: "string[]", required: false, default: [] }
  - { name: repo, type: string, required: false }
  - { name: project, type: string, required: false }
outputs:
  - { name: pageId, type: string }
  - { name: path, type: string }
uses:
  - vaultWriter.writeInbox
  - core.buildInboxNote
steps:
  - { id: build-note, kind: deterministic, tool: core.buildInboxNote }
  - { id: write,      kind: deterministic, tool: vaultWriter.writeInbox }
lanes:
  covers:   [quick-capture, inbox-write]
  excludes: [canonical-write, decision-creation, lesson-promotion]
risk: low
governance: none
triggers:
  - "remember that ..."
  - "note this"
  - "save this for later"
---

# Remember

## Purpose
Capture a low-friction note into inbox. Does not produce canonical memory.

## When to Use
The user wants something remembered but has not asked to make it canonical.
The note may include a repo or project hint, but the destination is always
inbox — promotion is the only path to canonical types.

## Inputs
- `content` — required, free text.
- `tags` — optional array.
- `repo`, `project` — optional hints recorded in the `# Hints` body section.

## Procedure
1. Build an inbox note via `core.buildInboxNote`.
2. The note's frontmatter type is always `note`. Type hints become body data.
3. Write via `vaultWriter.writeInbox`.

## Deterministic Steps
- Build note (frontmatter + `# Captured` + `# Hints` body).
- Write to `inbox/{id}.md`.

## Latent / Judgment Steps
None.

## Output Format
`{ pageId: string, path: string }` — JSON.

## Failure Modes
- `content` empty → reject with "content cannot be empty".
- Vault not initialized → reject with "Run `mnemonic init` first".

## Examples
> remember that Hermes should not own memory directly
→ inbox note created at `inbox/01J9X9....md`.

## Related Skills
- `memory/propose-memory` — when you want it to become canonical.
- `memory/promote-memory` — to canonicalize an open proposal.
