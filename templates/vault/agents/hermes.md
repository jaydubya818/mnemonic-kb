---
id: 01AGENTHERMES000000000000
schemaVersion: 1
type: agent
status: active
title: Hermes
tags: [hermes, agent-runtime]
aliases: []
createdAt: 2026-05-10T00:00:00.000Z
updatedAt: 2026-05-10T00:00:00.000Z
source: manual
confidence: high
links: [01AGENTMNEMONIC0000000000]
evidence: []
---

# Hermes

## Compiled Truth
Hermes reasons and acts. It calls Mnemonic via MCP for context (`get_task_context`, `list_skills`, `inspect_skill`). Hermes does not own durable memory; it proposes durable knowledge back to Mnemonic via `propose_memory` after a task.

## Current State
External system; this page tracks how Hermes integrates with Mnemonic.

## Decisions

## Lessons

## Patterns

## Known Pitfalls
- Loading every skill body up front bloats Hermes' context. Use `list_skills` first; `inspect_skill` only on dispatch.

## Related Pages
- agents/mnemonic.md
- agents/pi.md

## Timeline
- 2026-05-10 — Initial page.
