# Mnemonic KB — Claude session rules

Repo-specific rules for Claude Code / Cowork sessions. Complements global guidelines.
**Source of truth for scope and decisions: `PLAN.md` (v2.0).**

## Non-negotiable

- `vaultWriter` (in `packages/core/src/vault-writer.ts`) is the **only** path that writes
  into a vault. Apps, skills, and adapters must never import `node:fs` write APIs.
- `mnemonic remember` writes to `vault/inbox/` only. It must never produce canonical
  pages — even when the caller passes a `typeHint`. Promotion is the only path to canonical.
- No destructive operations in v0.1. No `delete_memory`. No canonical rewrites without
  proposal + promote. No `mnemonic mv`. Documented in `PLAN.md` D10 and `docs/roadmap.md`.
- Filing rules live in **one place**: a fenced `yaml` block inside `_filing-rules.md`.
  Prose around it is documentation; YAML is the rule engine input.
- Skills are Markdown documents. Frontmatter is the runtime contract. Body is human +
  LLM consumable. The runtime never executes code from a skill body.
- Telemetry is zero. No usage pings, no error reports, no cloud sync.

## Architecture invariants

- **Boundaries:** `core` knows files/schemas/filing. `retrieval` depends on `core`. Apps
  (`cli`, `mcp-server`, `wiki`) are thin transports. `agent-adapters` and `connectors` are
  doc-first stubs in v0.1.
- **Time and randomness are injected** via `VaultContext.now()` and `VaultContext.randomId()`.
  Never call `new Date()` or generate IDs outside the context. Tests pin both.
- **Page IDs are ULIDs.** Filenames use the ULID. Lexicographic sort = chronological.
- **Schema versioning:** every page carries `schemaVersion: 1`. The migration scaffold lives
  at `packages/core/migrations/`. v0.3 will use it; v0.1 ships an empty baseline.

## Skill authoring

- Every skill has frontmatter with: `id`, `name`, `description`, `status`, `parameters`,
  `outputs`, `uses`, `steps`, `lanes`, `risk`, `governance`, `triggers`.
- Each `step` is `kind: latent | deterministic`. Authoring is required in v0.1; runtime
  enforcement comes in v0.2.
- `lanes.covers` and `lanes.excludes` are required (warn-only DRY audit in v0.1).
- Active skills must be reachable from `RESOLVER.md` (direct or transitive). Draft skills
  may be unreachable but `check-resolvable` warns.

## Versioned scope

| Version | Surface |
|---|---|
| **v0.1** | Usable memory layer (this repo's current target). |
| v0.2 | Self-auditing skills: `doctor` full, trigger evals, dry audit, latent/deterministic enforcement, programmatic skillify. |
| v0.3 | Compounding system: diarization, inbox triage, Agentic-KB live sync, Hermes writeback, Pi-governed promotion, vector search. |

If a v0.1 design choice blocks v0.2/v0.3, fix the v0.1 choice now. Don't let scope creep
forward — let it slide back into v0.2/v0.3 instead.

## Common pitfalls — don't do these

- Don't add embeddings, SQLite, auth, multi-user, cloud sync to v0.1.
- Don't add a React/Next.js wiki. Wiki is Hono + server-rendered Markdown + Tailwind CDN.
- Don't introduce destructive APIs even if a test seems to need one.
- Don't bypass `vaultWriter` "just for this case." There are no cases.
- Don't expand `mnemonic doctor` past `schema-validate + check-resolvable + index-rebuild`
  in v0.1. Trigger evals + dry audit are v0.2.
- Don't write code from a skill body. Skills declare `uses:`; deterministic logic lives in
  registered tools that core resolves.

## Ecosystem position

- **Mnemonic remembers.** It is memory + skill catalog + resolver, nothing more.
- **Hermes reasons and acts.** Hermes calls Mnemonic via MCP for context; Hermes does not own memory.
- **Pi governs execution and audit.** v0.1 ships only the audit-record shape; enforcement is v0.3.
- **Agentic-KB enriches.** Import/export adapters only in v0.1; live sync is v0.3.

## When in doubt

Re-read `PLAN.md` §2 (decisions register). If a decision contradicts what you're about to do,
either follow it or surface the conflict to the user before changing direction.
