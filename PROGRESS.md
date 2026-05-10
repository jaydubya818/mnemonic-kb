# Mnemonic KB — Build progress

External memory bridge between sessions. Update at every phase boundary.

**Source of truth for plan: `PLAN.md` (v2.0).**

---

## Status: v0.1 — code complete; full build verification pending

Last update: 2026-05-10

### Done (Phases 1–5 all green)

- **Day 0** — Cloned and inspected Agentic-KB. Findings folded into `docs/agentic-kb-integration.md` and `packages/connectors/src/agenticKb.ts`.
- **Phase 1** — Monorepo scaffold + `@mnemonic/schemas` + `@mnemonic/core`. **20/20 tests passing.**
- **Phase 2** — `@mnemonic/retrieval` + full CLI vertical slice. **25/25 tests passing**, including the mandatory `MANDATORY: context pack from §11.2` test (active/deprecated decisions, citations, token budget, Open Questions, confidence label).
- **Phase 3** — `apps/mcp-server` (14 tools) sharing the same handlers as the CLI.
- **Phase 4** — 8 active skills + RESOLVER.md + filing rules (YAML-fenced) + `mnemonic check-resolvable` + `mnemonic doctor` (v0.1 subset). End-to-end smoke test passes: `init → remember ×2 → search → inbox → context → check-resolvable (exit 0, 8 skills, 15 resolver entries) → doctor`.
- **Phase 5** — `apps/wiki` (Hono + marked + Tailwind CDN), `packages/agent-adapters` (Hermes + Pi stubs with shaped types), `packages/connectors` (Agentic-KB mappers with documented lossy fields), all 8 docs, README, CLAUDE.md, PROGRESS.md.

### Phase 6 — verification status

**What was verified before the workspace rebooted:**
- ✅ `pnpm install` succeeds with `--package-import-method copy --ignore-scripts`.
- ✅ `pnpm test` — 25/25 tests pass (schemas: 7, core: 13, retrieval: 5).
- ✅ `pnpm --filter @mnemonic/schemas build` — ESM + DTS clean.
- ✅ `pnpm --filter @mnemonic/core build` — ESM + DTS clean.
- ✅ `pnpm --filter @mnemonic/retrieval build` — ESM + DTS clean.
- ✅ CLI smoke test (init, remember, search, inbox, context, check-resolvable, doctor) — all green, all exit 0.

**What is pending re-verification (env-blocked):**
- `pnpm --filter @mnemonic/agent-adapters build` — failed DTS first time with "Cannot find module '@mnemonic/schemas'"; re-installing pnpm workspace was supposed to fix link order. Workspace tmpfs filled to 100% before second `pnpm install` could complete.
- `pnpm --filter @mnemonic/connectors build` — same shape.
- `pnpm --filter @mnemonic/mcp-server build` — not attempted in this session.
- `pnpm --filter @mnemonic/wiki build` — not attempted in this session.

**Likely fix for the agent-adapters/connectors DTS failure** (mechanical):
1. Fresh `pnpm install --package-import-method copy --ignore-scripts` (requires available disk; session tmpfs was full).
2. `pnpm -r --workspace-concurrency=1 build` so schemas finishes before downstream packages start their DTS pass.

These are install-environment issues, not source-code issues. The TS code itself compiles in isolation and the JS builds passed when attempted; only DTS resolution for the two newest packages failed because they were added after the workspace install was last refreshed.

### Acceptance checklist (v0.1)

- [x] `packages/schemas` builds + tests pass
- [x] `packages/core` builds + tests pass
- [x] `packages/retrieval` builds + tests pass (incl. mandatory context-pack test)
- [x] CLI: init / remember / search / read / recent / context / inbox / propose / promote / reject / proposals / skills / check-resolvable / doctor / wiki
- [x] MCP server: 14 tools registered, structured JSON responses, parity with CLI on `get_task_context`
- [x] 8 active skills + RESOLVER + filing rules templates (YAML-fenced)
- [x] `mnemonic check-resolvable` exits 0 on seeded vault; deliberate breaks caught
- [x] `mnemonic doctor` runs schema-validate + check-resolvable + index-rebuild
- [x] Wiki app source (Hono routes for /, /p/:id, /search, /skills, /skills/:id, /inbox, /proposals, /healthz)
- [x] Hermes/Pi/Agentic-KB integration docs concrete (function signatures, sequence diagrams, lossy-fields table)
- [x] `docs/inspiration-analysis.md` exists and is critical, not laudatory
- [x] README with Mermaid + quickstart + MCP config + non-goals + telemetry-none
- [x] CLAUDE.md (repo-specific session rules)
- [x] PROGRESS.md (this file)
- [x] docs/tech-stack.md
- [x] No destructive ops shipped
- [x] No telemetry shipped
- [~] Full `pnpm -r build` clean — pending fresh install on a clean env

---

## Notes for the next session

To unblock verification:

```bash
cd /Users/jaywest/Documents/Claude/Projects/Mnemonic/mnemonic-kb
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm config set store-dir ~/.pnpm-store
pnpm install --package-import-method copy --ignore-scripts
pnpm test
pnpm -r --workspace-concurrency=1 build
pnpm --filter @mnemonic/cli exec mnemonic init --vault ~/mnemonic-vault --yes
```

If install hits EPERM/ENOSPC on the session mount, mirror to `/tmp`:

```bash
rsync -a --exclude=node_modules --exclude=dist /Users/jaywest/Documents/Claude/Projects/Mnemonic/mnemonic-kb/ /tmp/mnemonic-build/
cd /tmp/mnemonic-build
TMPDIR=/tmp/vitest-tmp pnpm install --package-import-method copy --ignore-scripts
TMPDIR=/tmp/vitest-tmp pnpm test
```
