# Hermes integration

**Mnemonic remembers; Hermes reasons and acts.** Hermes does not own durable memory. It calls Mnemonic via MCP for context and proposes durable knowledge back via `propose_memory`.

## Sequence

```
Hermes                              Mnemonic
  │                                   │
  │  (1) list_skills                  │ ── 8 SkillIndexEntry (~1.6 KB total)
  │ ────────────────────────────────► │
  │ ◄─────────────────────────────── │
  │                                   │
  │  (2) Hermes resolver dispatches   │
  │      intent → { skillId, params } │
  │                                   │
  │  (3) inspect_skill(skillId)       │ ── full SKILL.md only on dispatch
  │ ────────────────────────────────► │
  │ ◄─────────────────────────────── │
  │                                   │
  │  (4) get_task_context             │ ── ContextPack + markdown
  │ ────────────────────────────────► │
  │ ◄─────────────────────────────── │
  │                                   │
  │  (5) Hermes injects markdown       │
  │      into planning prompt + acts   │
  │                                   │
  │  (6) propose_memory ×N            │ ── proposals for durable items
  │ ────────────────────────────────► │
  │ ◄─────────────────────────────── │
```

## Adapter functions

In `packages/agent-adapters/src/hermes.ts`:

- `getHermesTaskContext(input)` — stub; Hermes calls `mnemonic.get_task_context` directly via MCP.
- `buildHermesContextBlock(pack: ContextPack): string` — **implemented**: pure formatter that adds a low-confidence header when warranted, then includes `pack.contextPackMarkdown`. Hermes pastes the result into its planning prompt.
- `proposeHermesRunSummaryMemory(summary)` — stub; Hermes calls `mnemonic.propose_memory` for each durable item.

## Recommended Hermes pattern

1. Don't load all skill bodies. `list_skills` first.
2. Don't load all memory. `get_task_context` returns a budgeted, cited pack.
3. Treat `confidence: low` warnings as a signal to ask the user a clarifying question rather than guessing.
4. After the run, propose memory for what changed — let the user (or Pi in v0.3) decide whether to canonicalize.
5. Never bypass `mnemonic.propose_memory` to write canonical content directly. The proposal+promote ritual exists for a reason.

## Common pitfalls

- **Loading every skill body up front.** This is the bug `list_skills` is designed to prevent. ~5 KB index ≪ summed skill bodies.
- **Stuffing whole pages into the prompt.** Use `get_task_context`; it returns excerpts and citations, not full bodies.
- **Promoting from inside Hermes.** v0.1 has no governance enforcement, so technically this works — but it shouldn't. Hermes proposes; humans (or Pi in v0.3) promote.
