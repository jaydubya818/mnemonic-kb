---
id: integrations/hermes-context
name: Hermes Context
description: Build a Hermes-ready context block from a task, suitable for pasting into Hermes' planning prompt.
status: active
parameters:
  - { name: task, type: string, required: true }
  - { name: repo, type: string, required: false }
  - { name: project, type: string, required: false }
outputs:
  - { name: contextBlock, type: string }
uses:
  - retrieval.getTaskContext
  - agentAdapters.hermes.buildHermesContextBlock
steps:
  - { id: get-task-context, kind: deterministic, tool: retrieval.getTaskContext }
  - { id: format-block,     kind: deterministic, tool: agentAdapters.hermes.buildHermesContextBlock }
lanes:
  covers:   [hermes-context-block, hermes-planning-prompt-input]
  excludes: [hermes-execution, hermes-writeback]
risk: low
governance: none
triggers:
  - "prepare Hermes for this task"
  - "give Hermes context for ..."
  - "build a Hermes context block"
---

# Hermes Context

## Purpose
Wrap `retrieval/get-task-context` with the formatting Hermes prefers for its
planning prompt. Mnemonic does not call Hermes; it just produces the block.

## Hermes flow this skill supports

1. Receive user task.
2. Hermes calls `mnemonic.list_skills` (cheap index).
3. Hermes' resolver dispatches the task to a Mnemonic skill.
4. Hermes calls `mnemonic.inspect_skill` for the matched skill (only on dispatch).
5. Hermes calls this skill (`integrations/hermes-context`) to produce the
   context block.
6. Hermes injects the block into its planning prompt and executes the task.
7. After the task, Hermes calls `mnemonic.propose_memory` for any durable
   lessons/decisions/patterns it discovered.

## Procedure
1. Call `retrieval.getTaskContext({ task, repo?, project? })`.
2. Pass the resulting `ContextPack` to `agentAdapters.hermes.buildHermesContextBlock`.
3. Return the formatted Markdown.

## Output Format
A Markdown string Hermes can paste verbatim into its planning prompt.

## Failure Modes
- Empty vault → block contains a single line saying "No prior context."
- Truncation occurred → the block carries the warning so Hermes can decide.

## Related Skills
- `retrieval/get-task-context` — upstream.
