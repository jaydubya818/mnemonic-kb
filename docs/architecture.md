# Architecture

Mnemonic is a five-package monorepo with three thin transport apps. Source of truth for scope and decisions: `PLAN.md` (v2.0).

## Layered diagram

```
[CLI] [MCP] [Wiki]              ← thin transports (apps/*)
        │
   [retrieval]                  ← search, ranking, context-pack
        │
     [core]                     ← CRUD, filing rules, vaultWriter
        │
[Markdown vault + JSON index + skills + resolver]
        │
[agent-adapters/*]  [connectors/agenticKb]   ← doc-first stubs in v0.1
```

## Boundaries

- `core` knows files, schemas, filing. It does not know MCP, CLI, HTTP.
- `retrieval` depends on `core`. It does not know transports.
- `apps/*` are thin transports — replaceable.
- `agent-adapters/*` and `connectors/*` define **contracts**, not runtime behavior, in v0.1.
- **Skill execution paths receive only `VaultContext` and `VaultWriter`. Never raw `fs`.** Lint rule enforces this in v0.2.

## Key types

- `Page` — frontmatter + body; the canonical unit.
- `Proposal` — staged content under `_proposals/`; promotion is the only path to canonical.
- `Skill` — Markdown document with typed frontmatter (parameters, lanes, steps).
- `ContextPack` — output of `getTaskContext`; cites local paths; carries `confidence` + `warnings`.
- `VaultWriter` — single legitimate write path; runs filing rules; rejects path traversal.

## Page shape

`## Compiled Truth` (current best understanding) at the top. `## Timeline` (append-only) at the bottom. Other sections (Decisions / Lessons / Patterns / Known Pitfalls / Related Pages) sit between. Promotion appends to `## Timeline` rather than rewriting Compiled Truth.

## Retrieval ranking (v0.1)

```
score = 3.0·BM25(title) + 2.0·BM25(tags) + 2.0·BM25(aliases) + 1.0·BM25(body)
      + 0.20·recencyDecay(updatedAt)              # half-life 90 days
      − 0.50·(status==="deprecated")
      − 0.70·(status==="superseded")
      − 0.30·(confidence==="low")
      + 0.30·(repoFilter && page.repo === repoFilter)
```

Implementation: `packages/retrieval/src/ranking.ts`. SQLite FTS5 / vector embeddings replace this in v0.3.

## Wiki style

Wiki uses Tailwind via CDN. No build step. Pages render Markdown via `marked`. Components: header nav, search box, list rendering with status labels for non-active pages. No client-side state.

## Build

pnpm workspace. Each package has its own `tsup` config. Vitest uses path aliases (`vitest.config.ts`) so tests resolve workspace packages from source without requiring a build first.
