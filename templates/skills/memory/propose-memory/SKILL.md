---
id: memory/propose-memory
name: Propose Memory
description: Create a proposal to canonicalize a piece of content as a decision, lesson, pattern, or other typed page.
status: active
parameters:
  - { name: content, type: string, required: true }
  - { name: reason, type: string, required: true }
  - { name: typeHint, type: string, required: false, default: "lesson" }
  - { name: repo, type: string, required: false }
  - { name: project, type: string, required: false }
outputs:
  - { name: proposalId, type: string }
  - { name: path, type: string }
uses:
  - vaultWriter.createProposal
steps:
  - { id: validate-input, kind: deterministic }
  - { id: write-proposal, kind: deterministic, tool: vaultWriter.createProposal }
lanes:
  covers:   [proposal-create]
  excludes: [direct-canonical-write, deletion]
risk: medium
governance: proposal-required
triggers:
  - "propose this as a lesson"
  - "save this as a decision"
  - "make this a canonical pattern"
---

# Propose Memory

## Purpose
Stage a piece of content for canonicalization. The proposal is a Markdown file
under `_proposals/` and has `status: open` until promoted or rejected.

## When to Use
- The user wants something to *become* canonical (decision, lesson, pattern)
  but the system should not bypass the review step.
- An agent has discovered durable knowledge during a task and wants to surface it.

## Inputs
- `content` — required.
- `reason` — required; explains why this should be canonical.
- `typeHint` — optional, defaults to `lesson`.
- `repo`, `project` — optional, scope the future canonical page.

## Procedure
1. Validate inputs.
2. Call `vaultWriter.createProposal`. Status begins `open`.
3. Return `{ proposalId, path }`.

## Output Format
JSON with `proposalId` and the absolute file path.

## Failure Modes
- Missing reason → reject.
- Vault not initialized → reject.

## Examples
> propose: "cancellation must propagate to children" — found this hardening run cancellation
→ creates `_proposals/01PROP....md`.

## Related Skills
- `memory/promote-memory` — to canonicalize the proposal.
- `memory/remember` — when you don't need it canonical (yet).
