---
id: retrieval/get-task-context
name: Get Task Context
description: Build a context pack for a coding agent task with cited decisions, lessons, patterns, and repo/project context.
status: active
parameters:
  - { name: task, type: string, required: true }
  - { name: repo, type: string, required: false }
  - { name: project, type: string, required: false }
  - { name: include, type: "string[]", required: false, default: ["decisions","lessons","patterns"] }
  - { name: maxTokens, type: number, required: false, default: 6000 }
outputs:
  - { name: contextPack, type: ContextPack }
uses:
  - retrieval.getTaskContext
steps:
  - { id: load-index,    kind: deterministic, tool: retrieval.loadOrBuildIndex }
  - { id: search,        kind: deterministic, tool: retrieval.searchPages }
  - { id: render,        kind: deterministic, tool: retrieval.getTaskContext }
lanes:
  covers:   [task-context, hermes-context-primary]
  excludes: [repo-only-context, single-page-fetch, write-anything]
risk: low
governance: none
triggers:
  - "get context for this repo task"
  - "build a context pack"
  - "what should I know before working on ..."
---

# Get Task Context

## Purpose
Synthesize a Markdown context pack for a coding-agent task. Cites local file
paths. Penalizes deprecated/superseded pages (already in ranking) and labels
them when included.

## When to Use
Before any non-trivial coding task — especially when calling an LLM that
benefits from anchored context. This is the primary integration point with Hermes.

## Inputs
- `task` — required, free text.
- `repo`, `project` — optional scope filters.
- `include` — bucket selector; defaults to decisions/lessons/patterns.
- `maxTokens` — default 6000; hard cap 12000.

## Procedure
1. Load (or build) the JSON index for the vault.
2. For each `include` bucket, run a typed search filtered by repo/project.
3. Render Markdown with sections: Task → Context Summary → Repo/Project Context → buckets → Pitfalls → Files to Inspect → Open Questions.
4. Compute confidence: `low` if <2 active relevant pages, `medium` if 2, `high` if ≥3.
5. Truncate buckets if estimated tokens exceed budget.

## Output Format
A `ContextPack` JSON object whose `contextPackMarkdown` field is what an agent
should paste into its planning prompt.

## Failure Modes
- No vault → fall back to empty pack with `confidence: low`.
- All matches deprecated → still include (with `[deprecated]` label) and warn.

## Examples
> get task context for "implement run cancellation" --repo hermes-agent
→ Markdown with Compiled-Truth excerpts and citations.

## Related Skills
- `retrieval/repo-context` — when you only need the repo summary.
- `integrations/hermes-context` — wraps this skill for Hermes' planning prompt.
