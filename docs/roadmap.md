# Roadmap

## v0.1 — Usable memory layer (current)

Vault, schemas, core, retrieval, CLI, MCP, wiki, proposal/promotion lifecycle, basic skills + resolver + check-resolvable, integration docs/stubs. **Source of truth: `PLAN.md` (v2.0).**

## v0.2 — Self-auditing skill system

- `mnemonic doctor` full surface: `schema-validate + check-resolvable + eval-triggers + dry-audit + smoke + --fix`.
- **Trigger evals.** Run `templates/skills/evals/trigger-evals.json` against the resolver. Default = exact-string-match. `--judge` opt-in for LLM-as-judge.
- **DRY audit.** Parse `lanes.covers/excludes` across all skills; flag overlaps with file:line citations.
- **Latent vs deterministic enforcement at runtime.** Refuse to invoke a model on a `kind: deterministic` step when a registered tool exists.
- **Programmatic skillify.** `mnemonic skillify --from-task <id>` runs the 10-step checklist and gates on `mnemonic doctor`.
- **`pure: bool` flag** on registered tools. The audit warns when a `deterministic` step calls a non-pure tool.
- ESLint rule (`node:fs` outside `core`) escalated from warn to error.

## v0.3 — Compounding system

- **Diarization** skill — read a set of raw inputs, produce a structured page (Compiled Truth, Timeline, Entities, Decisions, Lessons, Contradictions, Open Questions).
- **Inbox triage** — automated ingestion of inbox notes into proposals using the `# Hints` body data.
- **Agentic-KB live sync** — bidirectional with documented conflict resolution (a separate design doc must land first).
- **Hermes writeback wired** — `proposeHermesRunSummaryMemory` becomes real; Hermes' MCP integration emits propose calls automatically.
- **Pi-governed promotion effects** — MCP write tools build `PiEffect`; Pi audits/gates; sink format finalized.
- **Stale-memory detection** — pages with `updatedAt` older than N days surface in `mnemonic doctor`.
- **Resolver learning** — observe dispatch logs, propose trigger updates (RLM-style; require approval before applying).
- **SQLite FTS5** OR vector embeddings for retrieval (one or the other; not both).
- **Schema migration runner** — actually does work; v0.1 ships an empty baseline.

## NOT in any planned version

- Embeddings + SQLite simultaneously (pick one in v0.3).
- Auth / multi-user / cloud sync (out of project scope).
- Telemetry of any kind.
- Destructive `delete_memory` without a future explicit governance design.
- Arbitrary canonical Compiled-Truth rewrites (only proposal+promote can affect canonical, and even then only via append-to-Timeline by default).
- Page renames (`mnemonic mv`) until link-integrity story is designed.
- File-level locking until concurrency model is designed.
- React/Next.js wiki — Hono + server-rendered Markdown is the long-term answer.
- `computer://` link printing in CLI output (originally proposed, dropped in v2.0 review).
- `graph --depth N` traversal (basic graph only; depth is roadmap if anyone needs it).
- Automatic git init / push on `mnemonic init`.
- Cron-heavy ingestion (entity propagation, etc.) — strictly v0.3+ and orthogonal to the memory layer.
- Cross-modal eval (multiple models scoring each other's output).
- Real Playwright CLI / browser tooling — harness concern, not memory concern.

## Boundaries

If a feature seems to belong to "memory but for X," consider whether X belongs to Hermes (reasoning) or Pi (governance) instead. Mnemonic's job is durable memory + skill catalog + resolver. Adding orthogonal capabilities is the wrong direction.
