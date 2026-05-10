---
id: memory/promote-memory
name: Promote Memory
description: Canonicalize an open proposal into a typed page (or append to an existing page's timeline).
status: active
parameters:
  - { name: proposalId, type: string, required: true }
outputs:
  - { name: targetPath, type: string }
  - { name: appendedTimeline, type: boolean }
uses:
  - vaultWriter.promote
steps:
  - { id: load-proposal,  kind: deterministic }
  - { id: resolve-target, kind: deterministic }
  - { id: write-or-append, kind: deterministic, tool: vaultWriter.promote }
lanes:
  covers:   [canonical-write, proposal-promote]
  excludes: [proposal-create, deletion]
risk: high
governance: proposal-required
triggers:
  - "promote this memory"
  - "canonicalize this proposal"
  - "make this proposal final"
---

# Promote Memory

## Purpose
Move a proposal from `_proposals/` into canonical state. If the proposal has a
target page, append to its `## Timeline`. Otherwise, create a new page using
the proposal's `typeHint` and the filing rules.

## When to Use
After a proposal has been reviewed and accepted.

## Procedure
1. Load proposal by id (must be `status: open`).
2. Resolve target:
   - If `target.pageId` is set, append to that page's timeline.
   - Else, create a fresh page from `typeHint` (filing rules pick the path).
3. Update proposal `status: promoted`. The proposal file is preserved as audit trail — never deleted.

## Output Format
`{ targetPath, appendedTimeline }`.

## Failure Modes
- Proposal not found → reject (NOT_FOUND).
- Proposal not `open` → reject.
- No `target.pageId` and no `typeHint` → reject; cannot promote in v0.1.

## Examples
> promote 01PROP000000000000000000
→ either appends to an existing decision/lesson/pattern, or creates a fresh page from the typeHint.

## Related Skills
- `memory/propose-memory` — upstream.
