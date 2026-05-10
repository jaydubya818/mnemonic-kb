---
id: retrieval/repo-context
name: Repo Context
description: Return the repo's compiled-truth summary as a SearchResult.
status: active
parameters:
  - { name: repo, type: string, required: true }
outputs:
  - { name: results, type: "SearchResult[]" }
uses:
  - retrieval.getRepoContext
steps:
  - { id: load-index,  kind: deterministic, tool: retrieval.loadOrBuildIndex }
  - { id: search-repo, kind: deterministic, tool: retrieval.getRepoContext }
lanes:
  covers:   [repo-only-context]
  excludes: [task-context, write-anything]
risk: low
governance: none
triggers:
  - "get repo context"
  - "what's the situation with this repo"
---

# Repo Context

## Purpose
Cheap, focused alternative to a full task context: returns the repo's README
page (which carries compiled truth) and nothing else.

## When to Use
- Bootstrapping into a new repo.
- Confirming the repo's stated invariants before reading code.

## Procedure
1. Load index.
2. Search type=repo, repo=<repo>, limit=1.
3. Return the SearchResult.

## Output Format
`SearchResult[]` (one entry typically).

## Failure Modes
- No repo page → returns `[]`. Caller decides whether to escalate.

## Related Skills
- `retrieval/get-task-context` — for full task context.
