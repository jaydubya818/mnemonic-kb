# Mnemonic KB

> **Personal developer memory for agentic engineering.**
> *Thin harness, fat skills, explicit resolver, durable memory.*

[![status](https://img.shields.io/badge/status-v0.1.0-blue)](docs/release-v0.1.0.md)
[![tests](https://img.shields.io/badge/tests-25%2F25-brightgreen)](#development)
[![license](https://img.shields.io/badge/license-MIT-green)](#license)
[![node](https://img.shields.io/badge/node-%3E%3D20-blue)](#installation)
[![pnpm](https://img.shields.io/badge/pnpm-9-orange)](#installation)
[![telemetry](https://img.shields.io/badge/telemetry-zero-success)](#telemetry)

## The problem

Every time you start a chat with Claude Code or Cursor, the agent has no memory of anything you decided last week. You repeat yourself constantly. Decisions get re-litigated. Patterns you've already proven get re-invented. The model gets better; your accumulated context doesn't go anywhere.

## What Mnemonic is

A local-first Markdown notebook that your coding agent can read and write through an MCP server. Everything lives in `~/mnemonic-vault` as plain `.md` files. No database, no cloud, no telemetry. You own it; you can `grep` it; you can put it under git. The agent calls it; it returns context; you stop repeating yourself.

It is **not** a brain. It is the filing cabinet underneath the brain.

## What it does day-to-day

Each step below has been end-to-end verified against a fresh vault. The bracketed lines flag what's known rough; the [v0.2 P0](docs/dogfood-log.md) section explains how those will close.

### 1. Capture

```bash
mn remember "Hermes should not own durable memory directly"
# → Captured to inbox: 01KRBZ0ZHHZHZW2Y2D4H0H9H69
#   /Users/you/mnemonic-vault/inbox/01KRBZ0ZHHZHZW2Y2D4H0H9H69.md
```

Writes a Markdown file to `inbox/` with a ULID, full frontmatter (`type: note`, `status: active`, `source: cli`), and a body with `# Captured` + `# Hints` sections. Optional flags: `--repo <slug>`, `--project <slug>`, `--tag <t>` (repeatable). Same operation is exposed via MCP as `mnemonic.remember` for your coding agent.

**No canonicalization happens here** — even if you pass `--tag decision` or hint at a type, the file goes to inbox. Promotion is the only path to canonical types (see step 3).

### 2. Recall

```bash
mn context --task "implement run cancellation" --repo hermes-agent
```

Returns a Markdown context pack with `## Compiled Truth` excerpts from repo/project pages, plus `## Relevant Decisions`, `## Relevant Lessons`, `## Applicable Patterns`, all citing local file paths. Footer reports the token budget and confidence (`low` / `medium` / `high` based on how many active relevant pages were found). Paste the Markdown directly into a planning prompt → your agent has the context.

Same operation via MCP: `mnemonic.get_task_context`. Same payload, same paths, returnable as JSON.

> **Known rough edge ([v0.2 P0](docs/dogfood-log.md#10-recommended-v02-priority-list-evidence-based)):** the context buckets currently include only canonical types (decision / lesson / pattern). If the only relevant content in your vault is in `inbox/` (not yet promoted), `mn context` returns *zero* matches while `mn search "<same query>"` finds them with high relevance. **Workaround:** when `context` returns "confidence: low", fall back to `mn search` for the same terms; promote any worth keeping. v0.2 will add an inbox-fallback section to the context pack.

### 3. Canonicalize

Two ways to promote an inbox note into a canonical typed page. They produce different results.

**Quick path** (one inbox note → lesson):

```bash
mn inbox promote <id> --reason "This is the cancellation propagation policy"
# → creates _proposals/<pid>.md  (typeHint: lesson, status: open)

mn promote <pid>
# → lands at repos/<repo>/lessons/<new-id>.md  (type: lesson, source: promotion)
# → proposal file preserved with status: promoted (audit trail)
```

**Explicit-type path** (when you want a `decision` or `pattern`):

```bash
mn propose "Run cancellation must propagate to children synchronously." \
  --reason "Architecture decision worth canonicalizing" \
  --type decision \
  --repo hermes-agent
# → creates _proposals/<pid>.md  (typeHint: decision)

mn promote <pid>
# → lands at repos/hermes-agent/decisions/<new-id>.md
```

The canonical page has all sections pre-seeded (`## Compiled Truth`, `## Current State`, `## Decisions`, `## Lessons`, `## Patterns`, `## Known Pitfalls`, `## Related Pages`, `## Timeline`) and links back to the originating proposal via `evidence[]`. Nothing is overwritten by promotion — subsequent promotes that target the same page append to `## Timeline` instead. Nothing is destroyed; promoted and rejected proposals stay on disk.

> **Known rough edge:** `mn inbox promote` hardcodes `typeHint: lesson` and ignores the wording of `--reason`. To promote into a `decision` or `pattern`, use the **explicit-type path** above (`mn propose ... --type ...`). v0.2 will add `--type` to `mn inbox promote`.

### 4. Browse

```bash
mn wiki                          # or: pnpm --filter @mnemonic/wiki start
# → http://localhost:4477
```

Read-only wiki, localhost only, no auth. Routes verified working:

| Route | Shows |
|---|---|
| `/` | Recent pages with type + status + date |
| `/p/:id` | Rendered page (frontmatter + Markdown body + backlinks) |
| `/search?q=…` | Server-rendered ranked results |
| `/skills` | All 8 active skills |
| `/skills/:id` | Skill frontmatter + body |
| `/inbox` | Unpromoted captures |
| `/proposals` | Open + promoted + rejected, with status badges |
| `/healthz` | `ok` |

Hono + server-rendered Markdown + Tailwind via CDN. No build step.

## How it fits with the rest of your stack

| System | Role | What ships in v0.1 |
|---|---|---|
| **Mnemonic** | Remembers. Markdown vault + skill catalog + resolver. *That's all it does.* | Full: CLI, MCP server (14 tools), wiki, 8 skills, proposal/promote lifecycle. |
| **Hermes** | Reasons and acts. Calls Mnemonic for context; proposes durable knowledge back after a task. | Adapter stubs + integration doc + the only real function: `buildHermesContextBlock` (pure formatter). Hermes itself calls Mnemonic via MCP — no runtime coupling. |
| **Pi** | Governs execution and audit. Will gate risky writes. | `PiAuditRecord` type shape defined. No enforcement wired (v0.3). |
| **Agentic-KB** | Enriches. Import/export bridge to your richer personal KB. | Pure mappers (`mapAgenticKbArticleToMnemonicPage` / inverse) + documented lossy-fields table. `importFromAgenticKb` / `exportToAgenticKb` throw with doc pointers (v0.3 wires them). |

Three systems, three jobs, clean contracts. Mnemonic doesn't try to be a brain. It's the filing cabinet underneath the brain.

The integration docs are concrete and ready for whoever builds against them: [docs/hermes-integration.md](docs/hermes-integration.md), [docs/pi-integration.md](docs/pi-integration.md), [docs/agentic-kb-integration.md](docs/agentic-kb-integration.md).

## Why it compounds

After a week of capture, your agent stops asking you the same questions twice. After a month, you have a personal knowledge base that survives every model upgrade and every chat restart. The data is yours, in plain Markdown. The agent just reads it. Models get smarter; your context layer keeps getting denser.

The tagline is *thin harness, fat skills, explicit resolver, durable memory* — meaning the runtime is small, the procedural knowledge lives in versioned Markdown skills, routing is explicit (no magic dispatching), and the memory itself is plain text on your disk under your git history. Inspired by Garry Tan's GBrain architecture, but smaller, with stronger boundaries, and designed to plug into a specific agent ecosystem rather than be one.

```mermaid
graph TD
  A[Developer / Coding Agent] --> B[CLI]
  A --> C[MCP server]
  A --> D[Read-only wiki]
  B --> E[core + retrieval]
  C --> E
  D --> E
  E --> F[Markdown vault + JSON index + skills + resolver]
  F -. import/export .-> G[Agentic-KB]
  C -. context pack .-> H[Hermes]
  C -. governed writes .-> I[Pi]
```

---

## Table of contents

- [What it does](#what-it-does)
- [What it is NOT](#what-it-is-not)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Concepts](#concepts)
  - [Pages](#pages)
  - [Memory lifecycle](#memory-lifecycle)
  - [Skills and resolver](#skills-and-resolver)
  - [Context packs](#context-packs)
- [CLI reference](#cli-reference)
- [MCP server](#mcp-server)
- [Wiki](#wiki)
- [Vault layout](#vault-layout)
- [Integrations](#integrations)
- [Development](#development)
- [Status and roadmap](#status-and-roadmap)
- [Telemetry](#telemetry)
- [Contributing](#contributing)
- [Acknowledgements](#acknowledgements)
- [License](#license)

---

## What it does

```bash
# Capture
mnemonic remember "Cancellation must propagate to children" --repo hermes-agent

# Recall
mnemonic search "cancellation"
mnemonic context --task "implement run cancellation" --repo hermes-agent
# → returns a Markdown context pack with cited decisions, lessons, patterns

# Canonicalize
mnemonic inbox promote <id> --reason "design decision worth keeping"
mnemonic promote <proposalId>
# → durable page lands under repos/hermes-agent/decisions/ with append-only timeline
```

Everything lives in plain Markdown in `~/mnemonic-vault`. No database. No cloud. You own the data; you can grep it; you can put it under git.

Designed for use over **MCP** with Claude Code and Cursor, so your coding agent calls `mnemonic.get_task_context` before starting work and `mnemonic.propose_memory` after, building up a compounding context layer across sessions.

## What it is NOT

- **Not** an agent runtime. That's Hermes.
- **Not** a governance engine. That's Pi.
- **Not** an embedding store or vector DB. Plain Markdown + JSON index.
- **Not** a hosted service. Local-first. No cloud. No multi-user.
- **Not** destructive — `delete_memory`, canonical rewrites, and page renames are out of scope for v0.1.
- **Not** instrumented. **Zero telemetry**.

---

## Installation

**Prerequisites:** Node ≥ 20, pnpm ≥ 9.

```bash
git clone https://github.com/jaydubya818/mnemonic-kb.git
cd mnemonic-kb
pnpm install --package-import-method copy --ignore-scripts
pnpm test         # expect 25/25 passing
pnpm -r --workspace-concurrency=1 build
pnpm lint         # expect zero violations
```

Notes:
- `--package-import-method copy` avoids `EPERM` on filesystems without reliable hardlinks (some VM mounts).
- `--ignore-scripts` skips lifecycle scripts; CLI/MCP/wiki binaries are invoked via `node <path>` rather than `node_modules/.bin/`.

## Quick start

```bash
MNCLI="node apps/cli/bin/mnemonic.js"

# 1. Initialize a vault (default: ~/mnemonic-vault)
$MNCLI init --yes --vault ~/mnemonic-vault
export MNEMONIC_VAULT=~/mnemonic-vault

# 2. Capture
$MNCLI remember "Hermes should not own durable memory; it retrieves context from Mnemonic." \
  --repo hermes-agent

# 3. Search and build context
$MNCLI search "Hermes memory"
$MNCLI context --task "implement run cancellation" --repo hermes-agent

# 4. Browse in the read-only wiki
$MNCLI wiki        # http://localhost:4477
# or: pnpm --filter @mnemonic/wiki start
```

Sample output of step 3:

```
# Task: implement run cancellation

## Context Summary
Task: implement run cancellation. Repo/project context: 1 page(s). Found 1 relevant decision.

## Repo / Project Context
- [Hermes Agent](repos/hermes-agent/README.md) — Hermes is the reasoning runtime…

## Relevant Decisions
- [Cancel run policy](repos/hermes-agent/decisions/01J9X8….md) — cancellation
  must propagate to all child runs immediately…

…

---
_Mnemonic context pack v1 · generated 2026-05-10T20:14:55Z · token budget 6000 · confidence medium_
```

---

## Concepts

### Pages

Each page is a Markdown file with YAML frontmatter. **Compiled Truth** at the top (current best understanding); **Timeline** at the bottom (append-only history). Promotion appends to Timeline; it never rewrites Compiled Truth.

```yaml
---
id: 01J9X8000000000000000000   # ULID
schemaVersion: 1
type: decision
status: active                  # draft | active | deprecated | superseded
title: Run cancellation propagates to children
tags: [cancellation, hermes]
aliases: []
repo: hermes-agent
createdAt: 2026-05-10T00:00:00.000Z
updatedAt: 2026-05-10T00:00:00.000Z
source: manual
confidence: high
links: []
evidence: []
---
# Run cancellation propagates to children
## Compiled Truth
Cancel signals must propagate to all child runs immediately and idempotently.
## Timeline
- 2026-05-10 — Initial decision.
```

**Page types:** `repo`, `project`, `decision`, `lesson`, `pattern`, `prompt`, `meeting`, `person`, `agent`, `note`.

### Memory lifecycle

```
remember "<x>"                            mnemonic remember (CLI / MCP)
   │
   ▼
inbox/<id>.md       type: note, status: active, # Captured + # Hints
   │
   │  inbox promote <id>  --reason "..."
   ▼
_proposals/<id>.md  status: open
   │
   │  promote <id>
   ▼
canonical page      typed by filing rules
                    OR appends to existing target's ## Timeline
                    + proposal preserved with status: promoted (audit trail)
```

- `remember` writes to **inbox only**, regardless of any `--type` hint. Promotion is the only path to canonical memory.
- **No destructive operations.** Proposals stay on disk after `promote` or `reject`. Pages move to `status: deprecated` instead of being deleted.
- See [docs/memory-lifecycle.md](docs/memory-lifecycle.md).

### Skills and resolver

Skills are Markdown documents under `<vault>/.mnemonic/skills/`. Each `SKILL.md` carries typed frontmatter (`parameters`, `lanes`, latent/deterministic `steps`) plus a body that's read by humans **and** LLMs. The runtime never executes code from a skill body.

The **resolver** (`RESOLVER.md`) is a Markdown table mapping intent → skill. `mnemonic check-resolvable` audits the layer for structural integrity.

v0.1 ships **8 active skills**:

```
memory/remember              memory/propose-memory       memory/promote-memory
retrieval/get-task-context   retrieval/repo-context
maintenance/check-resolvable maintenance/skillify       (procedural doc only in v0.1)
integrations/hermes-context
```

### Context packs

`mnemonic.get_task_context` returns a Markdown block with cited decisions, lessons, patterns, and repo/project context for a task. Ranks by hand-rolled BM25-lite with status/recency/repo penalties+bonus; deprecated pages get a relevance penalty (not exclusion). Token budget: default 6000, hard cap 12000.

The block is meant to be pasted directly into Hermes' (or any agent's) planning prompt.

---

## CLI reference

Full reference + exit codes: [docs/cli.md](docs/cli.md).

```
mnemonic init [--vault <path>] [--force] [--yes]
mnemonic remember "<content>" [--repo <r>] [--project <p>] [--tag <t>...]
mnemonic search "<query>" [--type <t>] [--repo <r>] [--limit <n>]
mnemonic read <idOrPath> [--format md|json]
mnemonic recent [--type <t>] [--limit <n>]
mnemonic context --task "<task>" [--repo <r>] [--project <p>] [--max-tokens <n>]
mnemonic repo-context <repo>
mnemonic inbox | inbox show <id> | inbox promote <id> [--reason "..."] | inbox archive <id>
mnemonic propose "<content>" --reason "<r>" [--repo <r>] [--type <t>]
mnemonic promote <proposalId>
mnemonic reject <proposalId> --reason "<r>"
mnemonic proposals [--status open|promoted|rejected]
mnemonic skills list [--status active|draft] | skills inspect <skillId>
mnemonic check-resolvable                 # alias: mnemonic check
mnemonic doctor [--verbose]
mnemonic wiki [--port <n>]
```

**Exit codes:** `0` ok · `1` user error · `2` vault not found · `3` schema fail · `4` audit fail · `5` not found.

---

## MCP server

Mnemonic exposes **14 tools** over stdio MCP. Full tool reference: [docs/mcp-tools.md](docs/mcp-tools.md).

### Claude Code

```jsonc
// ~/.claude/mcp_servers.json
{
  "mcpServers": {
    "mnemonic": {
      "command": "node",
      "args": ["/abs/path/to/mnemonic-kb/apps/mcp-server/bin/mnemonic-mcp.js"],
      "env": { "MNEMONIC_VAULT": "/Users/you/mnemonic-vault" }
    }
  }
}
```

### Cursor

```jsonc
// .cursor/mcp.json
{
  "mcpServers": {
    "mnemonic": {
      "command": "node",
      "args": ["/abs/path/to/mnemonic-kb/apps/mcp-server/bin/mnemonic-mcp.js"],
      "env": { "MNEMONIC_VAULT": "/Users/you/mnemonic-vault" }
    }
  }
}
```

### Tool surface

| Read tools | Write tools |
|---|---|
| `mnemonic.search` | `mnemonic.remember` |
| `mnemonic.read_page` | `mnemonic.propose_memory` |
| `mnemonic.list_recent` | `mnemonic.promote_memory` |
| `mnemonic.get_repo_context` | `mnemonic.create_decision` *(creates proposal in v0.1)* |
| `mnemonic.get_task_context` | `mnemonic.create_lesson` *(creates proposal in v0.1)* |
| `mnemonic.list_skills` | `mnemonic.create_pattern` *(creates proposal in v0.1)* |
| `mnemonic.inspect_skill` | |
| `mnemonic.check_resolvable` | |

`list_skills` returns a small index (~200 B per skill). `inspect_skill` returns full body on dispatch only — **progressive disclosure** keeps Hermes' context lean.

---

## Wiki

```bash
pnpm --filter @mnemonic/wiki start
# http://localhost:4477
```

Routes: `/`, `/p/:id`, `/search?q=`, `/skills`, `/skills/:id`, `/inbox`, `/proposals`, `/healthz`.

Hono + server-rendered Markdown + Tailwind CDN. No build step. Localhost only. No auth.

---

## Vault layout

```
~/mnemonic-vault/
├── inbox/                 # quick-capture; never canonical
├── people/
├── repos/<repo-slug>/
│   ├── README.md          # repo page (compiled-truth section)
│   ├── decisions/
│   ├── lessons/
│   ├── patterns/
│   └── notes/
├── projects/<project-slug>/
│   ├── README.md
│   ├── decisions/
│   └── lessons/
├── decisions/             # cross-cutting (no repo/project)
├── lessons/
├── patterns/
├── prompts/
├── meetings/
├── agents/
├── _proposals/            # status: open | promoted | rejected
└── .mnemonic/
    ├── config.yaml
    ├── _filing-rules.md   # YAML-fenced rule engine input
    ├── skills/            # 8 v0.1 skills + RESOLVER.md
    ├── index.json         # generated
    └── .skills-index.json # generated
```

---

## Integrations

### Hermes — reasons and acts

Hermes calls Mnemonic via MCP for context (`get_task_context`, `list_skills`, `inspect_skill`) and proposes durable knowledge back via `propose_memory` after a task. Hermes does **not** own durable memory. See [docs/hermes-integration.md](docs/hermes-integration.md).

### Pi — governs execution

Pi audits and gates risky writes (promotions, future destructive ops). v0.1 ships only the `PiAuditRecord` shape; v0.3 wires enforcement. See [docs/pi-integration.md](docs/pi-integration.md).

### Agentic-KB — enriches

Bidirectional Markdown vault. Import/export adapters with a documented lossy-fields table. v0.1 ships pure mappers + stubs; live sync is v0.3. See [docs/agentic-kb-integration.md](docs/agentic-kb-integration.md).

---

## Development

### Monorepo layout

```
mnemonic-kb/
├── apps/{cli, mcp-server, wiki}/       # thin transports
├── packages/
│   ├── schemas/                        # Zod schemas
│   ├── core/                           # CRUD, filing, vaultWriter, init, skills
│   ├── retrieval/                      # JSON index, ranking, context pack
│   ├── connectors/                     # Agentic-KB import/export
│   └── agent-adapters/                 # Hermes + Pi typed stubs
├── templates/{vault, skills}/          # seed material for `mnemonic init`
├── docs/                               # 12 architecture + integration docs
├── PLAN.md                             # v2.0 plan (scope + decisions register)
├── CLAUDE.md                           # repo rules for AI coding sessions
└── PROGRESS.md                         # build progress log
```

### Run tests, build, lint

```bash
pnpm test                                          # vitest, 25 tests
pnpm -r --workspace-concurrency=1 build            # tsup, ESM + DTS
pnpm lint                                          # eslint
```

The lint rule **forbids `node:fs` imports** outside `packages/core`. All filesystem access must go through `vaultWriter` (writes), `loadSkills`/`readSkillByPath`/`loadSkillIndex` (skill reads), `initVault` (vault setup), and `saveRetrievalIndex`/`loadRetrievalIndex` (index IO). This is non-negotiable — see [CLAUDE.md](CLAUDE.md).

### Adding a skill

1. Copy `templates/skills/_skill-template.md` to `templates/skills/<namespace>/<id>/SKILL.md`.
2. Fill in `id`, `name`, `description`, `parameters`, `outputs`, `uses`, `steps` (each labeled `kind: latent | deterministic`), `lanes.covers`, `lanes.excludes`, `triggers`.
3. Add a row to `templates/skills/RESOLVER.md`.
4. Re-init or copy to your vault's `.mnemonic/skills/`.
5. `mnemonic check-resolvable` must exit 0.

### Adding a page type

1. Extend `PageType` in `packages/schemas/src/index.ts`.
2. Add a filing rule in `templates/skills/_filing-rules.md` (YAML block).
3. Add a unit test covering the new rule in `packages/core/src/core.test.ts`.

---

## Status and roadmap

**Current:** v0.1.0 — first release. [Release verification](docs/release-v0.1.0.md). [Dogfood log](docs/dogfood-log.md). **[Dogfood kit](docs/dogfood-kit.md)** — aliases, MCP setup, capture cheatsheet for the v0.1 → v0.2 dogfooding phase.

**v0.2 priorities** (evidence-based from [docs/dogfood-log.md](docs/dogfood-log.md) §10):

- **P0** — `getTaskContext` inbox-fallback + `## Relevant Notes / Inbox Signals` section in context-pack template.
- **P1** — Open proposals in the context pack with `[proposal]` labels; `mnemonic read` accepts absolute paths to `_proposals/<id>.md`.
- **P2** — Doctor warning rollup; better context-pack debuggability when empty.
- **P3** — Programmatic `mnemonic skillify`, trigger evals, dry-audit, latent/deterministic runtime enforcement. *Defer until dogfooding surfaces concrete friction.*

**v0.3** — Diarization, inbox triage, Agentic-KB live sync, Hermes writeback, Pi governance, vector search or SQLite FTS5.

Full roadmap: [docs/roadmap.md](docs/roadmap.md).

---

## Telemetry

**Zero.** No usage pings, no error reports, no cloud sync. Local-first means local-only. Do not add any.

---

## Contributing

This repo follows a strict discipline documented in [CLAUDE.md](CLAUDE.md):

- **Don't bypass `vaultWriter`.** All vault writes go through it. The lint rule will catch you.
- **Don't add destructive operations to v0.1.** No delete, no canonical rewrites, no renames. Status transitions only.
- **Don't expand scope without `PLAN.md` first.** New decisions go into the register before code.
- **Don't add features without dogfood evidence backing them.** v0.2 priorities are derived from observed friction, not imagined need.

For non-trivial changes: open an issue describing the friction, link the relevant `docs/dogfood-log.md` entry (or capture one), then PR.

---

## Acknowledgements

Architecturally indebted to:

- **GBrain** by Garry Tan — thin harness + fat skills, fractal resolver, filing-rules-as-chokepoint, skillify checklist, latent vs deterministic separation. Critical analysis in [docs/inspiration-analysis.md](docs/inspiration-analysis.md).
- **GStack** by Garry Tan — resolver-trigger ergonomics, pure-tool registration discipline.
- **Skillfully** — skill authoring conventions.
- **Karpathy's LLM Wiki gist** — per-entity page accumulating over time.
- **Agentic-KB** — proposal/promotion lifecycle, Markdown wiki shape.

Mnemonic borrows architecture, **not scope**. Where GBrain optimizes for personal compounding scale, Mnemonic optimizes for clean contracts that Hermes and Pi can build on without conflict.

---

## License

MIT.

---

**Source of truth for design and decisions:** [`PLAN.md`](PLAN.md) (v2.0).
**Project state across sessions:** [`PROGRESS.md`](PROGRESS.md).
**Rules for AI coding sessions in this repo:** [`CLAUDE.md`](CLAUDE.md).
