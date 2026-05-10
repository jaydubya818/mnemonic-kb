# Inspiration analysis

A critical (not laudatory) accounting of what Mnemonic borrows from prior art and what it deliberately skips.

## Sources

- **GBrain** — Garry Tan. github.com/garrytan/gbrain
- **GStack** — Garry Tan. github.com/garrytan/gstack
- **Skillfully** — skillfully.sh
- **Agentic-KB** — Jay's prior system. github.com/jaydubya818/Agentic-KB
- **Karpathy LLM Wiki gist** — gist.github.com/karpathy/442a6bf555914893e9891c11519de94f

## What Mnemonic borrows

### From GBrain (Tan) — primary architectural source

| Concept | Adopted | Where it shows up in Mnemonic |
|---|---|---|
| Thin harness, fat skills | yes, fully | runtime is a thin harness; skills are Markdown |
| Three-layer fractal resolver | yes, named | skill resolver, filing resolver, context resolver |
| Filing rules as code-level chokepoint | yes | `vaultWriter` enforces; YAML-fenced `_filing-rules.md` is the single input |
| Compiled truth + append-only timeline | yes | page template + promotion appends timeline |
| `doctor` aggregate command | partial | v0.1 = schema + check-resolvable + index; v0.2 adds dry-audit, eval-triggers |
| Skillify 10-step checklist | partial | v0.1 ships the procedural document; v0.2 wires the runner |
| Parameterized method-call skills | yes | `parameters[]` in skill frontmatter; resolver returns `{ skillId, params }` |
| Lane-based DRY audit | partial | `lanes.covers/excludes` required in schema; warn-only audit in v0.1 |
| Latent vs deterministic step labels | partial | required in schema (v0.1); runtime enforcement v0.2 |
| Progressive disclosure | yes | `list_skills` returns ~200 B per skill; body via `inspect_skill` |

### From GStack

| Concept | Adopted | Notes |
|---|---|---|
| Resolver-trigger ergonomics | yes | flat Markdown table in `RESOLVER.md` |
| Pure-tool registration discipline | partial | the `pure: bool` flag is roadmap (v0.2 enforcement) |
| Structured PR review patterns | no | out of Mnemonic scope; this is harness/codegen territory |

### From Skillfully

| Concept | Adopted | Notes |
|---|---|---|
| Frontmatter contract | yes | full Zod schema for skill frontmatter |
| Examples-first authoring | yes | every shipped skill has an `## Examples` section |
| Lanes inside the skill | yes | `lanes.covers/excludes` |

### From Agentic-KB

| Concept | Adopted | Notes |
|---|---|---|
| Proposal/promotion lifecycle | yes | `_proposals/` directory; `vaultWriter.promote()` |
| Markdown + YAML page format | yes | `Page` schema |
| ADR-shape decisions | yes (template) | optional within `## Compiled Truth` |
| 30+ MCP tool surface | no | Mnemonic ships 14, focused on the v0.1 loop |
| PIN-gated private scope | no | Mnemonic v0.1 is local-first; auth is roadmap |

### From Karpathy's LLM Wiki

| Concept | Adopted | Notes |
|---|---|---|
| Per-entity page accumulating over time | yes | repo, project, person, agent pages all do this |
| Schema is just YAML | yes | with Zod for type safety |

## What Mnemonic intentionally skips

- **GBrain's 100k-page brain target.** v0.1 targets working memory, not exhaustive ingest.
- **GBrain's cron-heavy ingest stack.** Out of v0.1; entity propagation and meeting ingestion are v0.3.
- **Cross-modal eval (multiple models scoring each other).** Roadmap; v0.1 has string-match trigger evals only.
- **Chromium / Playwright tooling.** Harness concern, not memory concern.
- **Agentic-KB's full MCP surface.** Mnemonic's 14 tools cover the v0.1 loop. Bloat the surface only when a real consumer needs it.
- **Self-healing / RLM resolver.** Forward-looking even in Tan's writing; not in Mnemonic v0.1 or v0.2.

## What Mnemonic does differently from prior art

| Decision | Why |
|---|---|
| **`vaultWriter` as the only fs write path.** Lint rule blocks `node:fs` in non-core packages. | Tan's Manidis story: 10/13 brain-writing skills had hardcoded paths and misfiled. Docs alone failed. We need a code-level chokepoint. |
| **`mnemonic remember` writes to inbox only**, regardless of `--type` hint. | Promotion is the only path to canonical. Prevents quick-capture from corrupting durable memory. |
| **No destructive ops in v0.1.** | Deferred to v0.3 with Pi governance. v0.1 ships safely. |
| **Three sibling agents (Mnemonic / Hermes / Pi) with explicit contracts.** | Avoids the GBrain monolith pattern. Each system has one job. |
| **ULIDs over UUIDs for page ids.** | Lexicographic sort = chronological. Free recency ordering everywhere. |
| **Status field on pages and skills (`draft|active|deprecated|superseded`).** | Lets us deprecate without deleting. Search penalizes (penalty in ranking formula); doesn't exclude. |
| **`aliases[]` on every page.** | Survives renames. Cheap. |
| **Telemetry: zero.** Local-first means local-only. | Trust. |

## What I would NOT copy (even though it's in the source)

- **GBrain's "skills compose" recursive depth.** Composition is good; uncontrolled recursion isn't. v0.1 skills name their `uses:` explicitly.
- **Karpathy LLM Wiki's lack of schema.** OK for a personal experiment; not OK for an interoperable layer that Hermes/Pi/Agentic-KB all touch.
- **Tan's "fat code" surface area.** v0.1 stays small. Code expansion comes only when v0.2/v0.3 features earn it.

## Net positioning

Mnemonic borrows GBrain's **architecture** (thin harness, fat skills, fractal resolver) but takes a **smaller v0.1 scope** with **stronger boundaries** (vaultWriter chokepoint, three-agent split). Where GBrain optimizes for personal compounding scale, Mnemonic optimizes for **clean contracts** that Hermes and Pi can build on without conflict.
