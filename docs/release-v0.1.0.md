# Mnemonic KB — v0.1.0 release checklist

**Tagline:** Personal developer memory for agentic engineering.
**Architecture:** Thin harness, fat skills, explicit resolver, durable memory.

The v0.1 product loop is: **init → remember → search → context → propose → promote → MCP → wiki.**

## Reproducible verification

### 1. Install

```bash
cd mnemonic-kb
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install --package-import-method copy --ignore-scripts
```

Notes:
- `--package-import-method copy` avoids EPERM on filesystems without reliable hardlinks (some VM mounts).
- `--ignore-scripts` skips lifecycle scripts; binaries are invoked via `node <bin path>` rather than `node_modules/.bin/`.

### 2. Tests

```bash
pnpm test
```

Expected: **25/25 passing** (`schemas`: 7, `core`: 13, `retrieval`: 5).

### 3. Build

```bash
pnpm -r --workspace-concurrency=1 build
```

Expected: 5 packages + 3 apps build clean (ESM + .d.ts).
- `@mnemonic/schemas`, `@mnemonic/core`, `@mnemonic/retrieval`, `@mnemonic/connectors`, `@mnemonic/agent-adapters`
- `@mnemonic/cli`, `@mnemonic/mcp-server`, `@mnemonic/wiki`

### 4. Lint (vaultWriter boundary enforcement)

```bash
pnpm lint
```

Expected: zero violations. The lint rule (`.eslintrc.json`) forbids `node:fs` imports from `apps/**`, `packages/{retrieval,connectors,agent-adapters,schemas}/**` so all filesystem access funnels through `@mnemonic/core`.

### 5. CLI smoke

```bash
MNCLI="node apps/cli/bin/mnemonic.js"
$MNCLI init --yes --vault /tmp/test-vault
MNEMONIC_VAULT=/tmp/test-vault $MNCLI remember "Hermes should not own durable memory directly; it should retrieve context from Mnemonic."
MNEMONIC_VAULT=/tmp/test-vault $MNCLI search "Hermes memory"
MNEMONIC_VAULT=/tmp/test-vault $MNCLI context --task "implement run cancellation" --repo hermes-agent
MNEMONIC_VAULT=/tmp/test-vault $MNCLI inbox
MNEMONIC_VAULT=/tmp/test-vault $MNCLI check-resolvable
MNEMONIC_VAULT=/tmp/test-vault $MNCLI doctor
```

Expected:
- `init` creates the vault skeleton + `.mnemonic/skills/` + `.mnemonic/_filing-rules.md` + `.mnemonic/config.yaml` + `.mnemonic/index.json`.
- `remember` writes to `inbox/<id>.md`.
- `search` returns ranked results citing local paths.
- `context` returns a Markdown context pack with footer `Mnemonic context pack v1 · …`.
- `inbox` lists captured notes.
- `check-resolvable` exits **0** — "OK — 8 skills, 15 resolver entries, .skills-index.json (8 active) generated."
- `doctor` exits **0** — "doctor: OK (N pages indexed)."

### 6. MCP smoke

```bash
MNEMONIC_VAULT=/tmp/test-vault node apps/mcp-server/dist/index.js
```

The server prints `mnemonic MCP server: listening on stdio` to stderr and accepts JSON-RPC requests on stdin. Verified end-to-end:

- `tools/list` returns **14 tools**: `mnemonic.search`, `mnemonic.read_page`, `mnemonic.list_recent`, `mnemonic.get_repo_context`, `mnemonic.get_task_context`, `mnemonic.list_skills`, `mnemonic.inspect_skill`, `mnemonic.check_resolvable`, `mnemonic.remember`, `mnemonic.propose_memory`, `mnemonic.promote_memory`, `mnemonic.create_decision`, `mnemonic.create_lesson`, `mnemonic.create_pattern`.
- `tools/call mnemonic.get_task_context` returns a payload containing `Mnemonic context pack v1`.

Configure your MCP client (Claude Code, Cursor) per README "MCP setup."

### 7. Wiki smoke

```bash
MNEMONIC_VAULT=/tmp/test-vault node apps/wiki/dist/index.js
# or: pnpm --filter @mnemonic/wiki start
```

Expected (`http://localhost:4477`):
- `/healthz` → `ok`
- `/` → recent pages (lists the 3 seeded agent pages + the inbox note)
- `/skills` → all 8 active skills with links to detail pages
- `/skills/memory/remember` → renders the SKILL.md frontmatter + body
- `/inbox` → 1 captured note
- `/proposals` → empty in a fresh vault

### 8. Final verification (one-shot)

```bash
pnpm install --package-import-method copy --ignore-scripts
pnpm test
pnpm lint
pnpm -r --workspace-concurrency=1 build
node apps/cli/bin/mnemonic.js doctor --vault /tmp/test-vault
```

All five must pass.

### 9. Tag

```bash
git init                            # if not already a git repo
git add -A
git commit -m "release v0.1.0"
git tag v0.1.0
```

## Known limitations (v0.1, by design)

- **No embeddings, no vector search.** Ranking is hand-rolled BM25-lite with status/recency/repo penalties+bonus.
- **No SQLite, no database.** Source of truth is Markdown; JSON index at `.mnemonic/index.json`.
- **No auth, no multi-user, no cloud sync.** Local-first means local-only.
- **No telemetry.** Zero pings, zero error reports.
- **No destructive memory deletion.** No `delete_memory`. No canonical rewrites without proposal+promote. Deprecation uses `status: deprecated` — content stays on disk.
- **No programmatic `mnemonic skillify` command.** v0.1 ships the procedural document at `templates/skills/maintenance/skillify/SKILL.md`. The runner is v0.2.
- **No trigger evals / dry-audit / smoke runner in `doctor`.** v0.1 doctor = schema-validate + check-resolvable + index-rebuild. The rest is v0.2.
- **No Pi enforcement.** v0.1 ships only the `PiAuditRecord` shape; nothing emits records yet. Wiring is v0.3.
- **Agentic-KB connector is stub-first.** Day-0 inspection of github.com/jaydubya818/Agentic-KB informed the mappers and the lossy-fields table; `importFromAgenticKb` / `exportToAgenticKb` throw with doc pointers. Live sync is v0.3.
- **Wiki is localhost-only with no auth.** Documented as such.
- **CLI bin is not symlinked under `--ignore-scripts`.** Invoke via `node apps/cli/bin/mnemonic.js` or wire `node_modules/.bin/mnemonic` manually if you need it on `PATH`.
- **Page renames (`mnemonic mv`) are not implemented.** Link integrity story is roadmap.
- **No file-level locking.** Optimistic last-writer-wins. Roadmap.

## Source of truth

- `PLAN.md` — v2.0 plan (scope, decisions register, acceptance criteria).
- `CLAUDE.md` — rules for AI sessions touching this repo.
- `PROGRESS.md` — phase-by-phase build log.
- `IMPLEMENTATION_REPORT.md` — what was built and why.
- `docs/` — architecture, lifecycle, MCP tools, integrations, inspiration, CLI, tech stack, roadmap.
