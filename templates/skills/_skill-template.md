---
id: namespace/skill-name
name: Skill Name
description: One-line resolver-facing description.
status: draft
parameters:
  - { name: required_param, type: "string", required: true }
outputs:
  - { name: result, type: string }
uses:
  - tool.name
steps:
  - { id: step-1, kind: deterministic, tool: tool.name }
  - { id: step-2, kind: latent }
lanes:
  covers:    [what-this-does]
  excludes:  [what-this-does-not-do]
risk: low
governance: none
triggers:
  - "trigger phrase ..."
---

# Skill Name

## Purpose
What this skill does and why.

## When to Use
Concrete triggers and contexts.

## Inputs
Each parameter, with examples and defaults.

## Procedure
1. ...
2. ...

## Deterministic Steps
The mechanical, code-driven steps.

## Latent / Judgment Steps
The model-driven steps requiring synthesis or judgment.

## Output Format
What the caller receives.

## Failure Modes
Known ways this skill can fail and how to recover.

## Examples
Concrete invocations and outputs.

## Related Skills
Adjacent skills and when to use them instead.
