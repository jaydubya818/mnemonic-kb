# Agentic-KB integration

**Mnemonic enriches with Agentic-KB; it does not depend on it.** v0.1 ships import/export adapters as documented stubs + pure mappers. Live two-way sync is v0.3.

## What we observed (Day 0 inspection of github.com/jaydubya818/Agentic-KB)

- **Format:** Markdown + YAML frontmatter, like Mnemonic.
- **Common frontmatter:** `title`, `type`, `date`, `status`, `author`, `tags`, `reviewed`, `reviewed_date`, `confidence`.
- **Decisions:** ADR-shape (`## Status`, `## Context`, `## Decision`).
- **Wiki structure:** `agents/{leads,orchestrators,workers}`, `decisions/`, `concepts/`, `domains/`, `entities/`, `evaluations/`, `frameworks/`.
- **Runtime:** ~30 MCP tools, repo-runtime + agent-runtime split, PIN-gated private scope.
- **Status values:** `active`, `draft`, `deferred`, `deprecated`, `superseded` — wider than Mnemonic's set.

## Mapping table (v0.1)

| Agentic-KB | Mnemonic | Notes |
|---|---|---|
| `type: decision` | `type: decision` | direct |
| `type: concept` | `type: note` | concepts collapsed to notes |
| `type: agent` | `type: agent` | direct (path nuance: `agents/leads/x` flattened to `agents/x.md` + tag) |
| `type: domain` | `type: note` + tag | direct mapping is lossy |
| `type: entity` | `type: person` | when entity is a person; entities-that-are-companies are also `person` in v0.1 |
| `type: evaluation` | `type: lesson` | semantic match |
| `type: framework` | `type: pattern` | semantic match |
| `type: meeting` | `type: meeting` | direct |
| `status: deferred` | `status: draft` | intentional collapse |
| `author`, `reviewed_date` | `evidence[].imported` | not first-class fields |
| `reviewed: true/false` | (lost) | no Mnemonic equivalent in v0.1 |

## Mapper signatures

In `packages/connectors/src/agenticKb.ts`:

```ts
mapAgenticKbArticleToMnemonicPage(a, { id, createdAt, updatedAt }): Page
mapMnemonicPageToAgenticKbArticle(p): AgenticKbArticle
```

Both are pure functions and round-trip with documented loss (above table). The v0.3 `importFromAgenticKb` / `exportToAgenticKb` will walk a directory tree and apply these mappers; v0.1 throws "Not implemented" with a doc pointer.

## Lossy fields when round-tripping

**Agentic-KB → Mnemonic → Agentic-KB:**
- `author`, `reviewed_date` end up in `evidence[].note`; on export they re-flatten into a body `## Evidence` section, not back into top-level frontmatter.
- `reviewed: true/false` is dropped on import; default to `false` on re-export.

**Mnemonic → Agentic-KB → Mnemonic:**
- `aliases[]` is dropped (Agentic-KB v1.0 has no alias field).
- `links[]` is preserved as wikilinks in body; on re-import they would need to be re-parsed (v0.3).

## Recommended workflow (when implemented)

1. **One-shot import** at vault initialization. `mnemonic init --import-agentic-kb /path/to/Agentic-KB`. Maps everything to Mnemonic-canonical paths via filing rules.
2. **Periodic export** as backup. `mnemonic export-to-agentic-kb /path`. Useful if you want to keep a richer Agentic-KB instance in parallel.
3. **Two-way sync** is **out of scope** until conflict resolution is designed. v0.3 spike will produce a separate design doc before implementation.

## Don't do this

- Don't run two-way sync as a cron in v0.1 — there's no conflict resolution.
- Don't assume Agentic-KB's PIN-gated private scope maps to Mnemonic. Mnemonic v0.1 is local-first with no auth; private/public is the user's filesystem permissions.
- Don't depend on Agentic-KB at runtime. Mnemonic must work standalone.
