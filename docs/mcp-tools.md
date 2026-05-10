# MCP tools (v0.1)

Mnemonic exposes 14 tools over stdio MCP. Read tools are pure; write tools route through `vaultWriter`.

## Read tools

| Tool | Args | Returns |
|---|---|---|
| `mnemonic.search` | `{ query, type?, repo?, limit? }` | `{ results: SearchResult[] }` (absolute paths) |
| `mnemonic.read_page` | `{ idOrPath }` | `{ path, frontmatter, body }` |
| `mnemonic.list_recent` | `{ limit?, type? }` | `{ pages: ListedPage[] }` |
| `mnemonic.get_repo_context` | `{ repo, maxTokens? }` | `{ results: SearchResult[] }` |
| `mnemonic.get_task_context` | `{ task, repo?, project?, include?, maxTokens? }` | `ContextPack` + `markdown` |
| `mnemonic.list_skills` | `{ status? }` | `{ skills: SkillIndexEntry[] }` |
| `mnemonic.inspect_skill` | `{ id }` | `{ skill: Skill }` (frontmatter + body) |
| `mnemonic.check_resolvable` | `{}` | `{ ok, errors[], warnings[] }` |

## Write tools

| Tool | Args | Effect | Notes |
|---|---|---|---|
| `mnemonic.remember` | `{ content, tags?, repo?, project? }` | Writes to `inbox/<id>.md` | Never canonical |
| `mnemonic.propose_memory` | `{ content, reason, type?, repo?, project? }` | Creates `_proposals/<id>.md` | `status: open` |
| `mnemonic.promote_memory` | `{ proposalId }` | Promotes to canonical | Appends timeline or creates page |
| `mnemonic.create_decision` | `{ title, context, decision, consequences?, repo?, project? }` | Creates a proposal | Not a direct canonical write in v0.1 |
| `mnemonic.create_lesson` | `{ title, lesson, repo?, project? }` | Creates a proposal | Not a direct canonical write in v0.1 |
| `mnemonic.create_pattern` | `{ title, pattern, whenToUse?, repo?, project? }` | Creates a proposal | Not a direct canonical write in v0.1 |

## Response shape

Every tool returns a JSON payload. Tools whose output is human-readable also include a `markdown` field (notably `get_task_context`). All file paths in responses are **absolute**.

## Progressive disclosure

`list_skills` returns ~200 B per skill (~1.6 KB total for 8 skills). Hermes calls this first to dispatch. Only the matched skill is fetched in full via `inspect_skill`. This keeps Hermes' context lean — see `docs/hermes-integration.md`.

## Configuration

See README "MCP setup" for Claude Code and Cursor config snippets. The server reads `MNEMONIC_VAULT` (or auto-detects from cwd) — pass it via the MCP client's `env`.
