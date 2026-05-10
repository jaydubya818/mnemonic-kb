# Mnemonic KB — Dogfood log

**Date:** 2026-05-10
**Vault used for sandbox dogfooding:** `/tmp/test-vault` (proxy for user's `~/mnemonic-vault`)
**Build dir:** `/tmp/mnemonic-build` (mirror of `/Users/jaywest/Documents/Claude/Projects/Mnemonic/mnemonic-kb/`)
**Scope:** v0.1 dogfooding. **No v0.2 implementation.**

The goal is to use Mnemonic to capture friction with Mnemonic itself, then summarize evidence for v0.2.

---

## 1. State verification

| Check | Status | Notes |
|---|---|---|
| `git status` | ✅ | Branch `master`, no commits yet (tagging deferred to user's machine — workspace mount has EPERM on `.git`). |
| `pnpm test` | ✅ | **25/25** (schemas 7, core 13, retrieval 5). |
| `pnpm -r --workspace-concurrency=1 build` | ✅ | All 5 packages + 3 apps build ESM + DTS clean. |
| `mnemonic doctor --verbose` | ✅ | Exit 0. 8 expected v0.1 warnings (deterministic-step-missing-tool). |

No code changes required to unblock dogfooding.

## 2. Commands run

```bash
# Setup
pnpm test
pnpm -r --workspace-concurrency=1 build
MNCLI="node apps/cli/bin/mnemonic.js"
MNEMONIC_VAULT=/tmp/test-vault $MNCLI init --yes --vault /tmp/test-vault
MNEMONIC_VAULT=/tmp/test-vault $MNCLI doctor --verbose

# Capture observed bugs
$MNCLI remember "Bug: mnemonic read cannot read an absolute path to a proposal under _proposals…" --tag bug --tag cli --tag proposal --tag v0.2
$MNCLI remember "Bug: mnemonic context returns 0 relevant pages for a topic even when mnemonic search finds an inbox note on the same topic…" --tag bug --tag context --tag retrieval --tag v0.2

# Wiki smoke (all routes 200)
$MNCLI wiki   # boots at localhost:4477
curl /healthz /  /inbox /proposals /skills /search?q=Hermes

# Proposal lifecycle
$MNCLI propose "Hermes should retrieve context via mnemonic.get_task_context, never own durable memory." --reason "Surface architecture invariant as a canonical decision" --type decision --repo hermes-agent
$MNCLI proposals --status open

# MCP smoke (14 tools registered)
node apps/mcp-server/dist/index.js < <(jsonrpc init + tools/list + tools/call ×5)

# Real dogfood task
$MNCLI context --task "define Mnemonic v0.2 priorities from dogfooding feedback" --max-tokens 6000
$MNCLI search "v0.2 priorities dogfooding" --limit 5   # control — for direct comparison

# Capture friction + features
$MNCLI remember "Friction: …" --tag friction --tag v0.2     ×3
$MNCLI remember "Feature request: …" --tag feature --tag v0.2  ×3
$MNCLI remember "Observation: …" --tag friction --tag debuggability --tag v0.2

# Verify signals
$MNCLI search "v0.2" "Bug" "Friction" "Feature request"
$MNCLI proposals --status open
$MNCLI inbox
```

## 3. What passed

- **CLI loop end-to-end** — init, remember, search, read, recent, context, inbox/{show, promote, archive}, propose, promote, reject, proposals, skills/{list, inspect}, check-resolvable, doctor.
- **Wiki** — every route in scope: `/`, `/p/:id`, `/search`, `/skills`, `/skills/:id`, `/inbox`, `/proposals`, `/healthz`. All return 200 and render expected content.
- **MCP** — 14 tools registered; `initialize`, `tools/list`, `tools/call` all served. Verified `get_task_context` returns a valid context pack, `list_skills` returns 8 active skills, `inspect_skill` returns full SKILL.md frontmatter+body, `search` returns ranked results, `remember` writes to inbox (inbox count grew from 3 → 4 after the MCP call).
- **Proposal lifecycle** — `propose` → `proposals --status open` → `promote` → re-promote correctly fails ("not open").
- **Search ranking** — captured notes are findable by their key terms with sensible relevance ordering (e.g. `search "Feature request"` returns the three feature-request notes at scores 13.84, 13.79, 13.70; canonical pages at 0.20).

## 4. What failed (captured to Mnemonic, not fixed)

**Bug — `mnemonic read` cannot load proposals by absolute path.**
Pre-observed by the user. Captured: inbox note `01KR9RD724MQVWB6SVK1KN9Q76`.
Reproduction: `mnemonic read /tmp/test-vault/_proposals/<id>.md` → "Page not found." Same proposal is loadable by `mnemonic promote <id>` and listed by `mnemonic proposals`. Likely cause: `readPage()` excludes the `_proposals/` directory from `listPages` (deliberate, since proposals aren't canonical) but also doesn't accept absolute paths landing in `_proposals/`.

**Bug — context pack omits inbox notes when canonical types miss.**
Reproduced under the prescribed dogfood task:
- Vault: 6 inbox notes (3 directly relevant to "v0.2 priorities"), 1 open proposal, 3 active agent pages.
- `mnemonic search "v0.2 priorities dogfooding" --limit 5` → returns 3 notes with relevance 3.4, 3.3, 3.3.
- `mnemonic context --task "define Mnemonic v0.2 priorities from dogfooding feedback" --max-tokens 6000` → 0 relevant pages, confidence low.

Same vault. Same query terms. Search finds the notes; context does not. Captured: `01KR9RD73R7V8H61S4904YS95D` (bug) + `01KR9RF9RH6J059HVWYSDAMHRY` (friction).

## 5. Bugs captured

| ID | Tags | Summary |
|---|---|---|
| `01KR9RD724MQVWB6SVK1KN9Q76` | bug, cli, proposal, v0.2 | `mnemonic read` cannot read absolute paths to `_proposals/<id>.md` |
| `01KR9RD73R7V8H61S4904YS95D` | bug, context, retrieval, v0.2 | `mnemonic context` returns 0 results when search returns matching inbox notes |

## 6. Friction captured

| ID | Tags | Summary |
|---|---|---|
| `01KR9RF9RH6J059HVWYSDAMHRY` | friction, context, retrieval, v0.2 | Context pack omits inbox notes (reproduced with empirical query) |
| `01KR9RF9T3N9ARTZE9174YT7MB` | friction, context, proposals, v0.2 | Context pack omits open proposals |
| `01KR9RF9YT6K2BFN01M14QRVTZ` | friction, doctor, v0.2 | `doctor` emits 8 expected v0.1 warnings — noisy, lowers signal |
| `01KR9RFA28TFFQPK3CGWP2APZ7` | friction, context, debuggability, v0.2 | Context summary is generic; can't tell why 0 results |

## 7. Feature requests captured

| ID | Tags | Summary |
|---|---|---|
| `01KR9RF9VNZHJPE4AH54GQ32DN` | feature, context, v0.2 | Context pack: add "Relevant Notes / Inbox Signals" fallback section |
| `01KR9RF9X554NC3V86XQB31WHG` | feature, context, proposals, v0.2 | Context pack: optionally include open proposals with `[proposal]` label |
| `01KR9RFA0HCJB9BWV5D3QZW2YR` | feature, cli, read, v0.2 | `mnemonic read` should accept absolute path to any `.md` in the vault, including `_proposals/<id>.md` |

## 8. Open proposals

| ID | Reason |
|---|---|
| `01KR9RDR9K21RNV3DWKT4RD4Z7` | Surface architecture invariant as a canonical decision (Hermes should retrieve context via Mnemonic, never own memory) |

## 9. Promoted lessons

(None yet from dogfooding; the lifecycle was tested in earlier verification but the promoted pages live in a different vault.)

## 10. Recommended v0.2 priority list (evidence-based)

Ranked by frequency of friction, severity, and how often the issue showed up while doing the prescribed dogfood task. Every item below was empirically observed in this session.

### P0 — Without these, the context pack is unreliable

1. **Align `getTaskContext` retrieval with `search`** — specifically, add a fallback that pulls inbox notes when canonical buckets (`decisions`, `lessons`, `patterns`) return zero.
   *Evidence:* `01KR9RD73R7V8H61S4904YS95D`, `01KR9RF9RH6J059HVWYSDAMHRY`. Reproduced under the prescribed dogfood task.

2. **Add a `## Relevant Notes / Inbox Signals` section to the context-pack template** when fallback engages. Label it so callers know the content is pre-canonical.
   *Evidence:* `01KR9RF9VNZHJPE4AH54GQ32DN`. Directly proposed; covers (1) without changing the canonical-type ranking.

### P1 — Promotes correctness once P0 is in

3. **Include open proposals in the context pack** as a separate section, with `[proposal]` status labels analogous to `[deprecated]` / `[superseded]`.
   *Evidence:* `01KR9RF9T3N9ARTZE9174YT7MB`, `01KR9RF9X554NC3V86XQB31WHG`. Open proposal in the dogfood vault was directly relevant but never surfaced.

4. **`mnemonic read` accepts absolute paths to any `.md` file inside the vault, including `_proposals/<id>.md`.** Asymmetric with `promote`, which loads by id fine.
   *Evidence:* `01KR9RD724MQVWB6SVK1KN9Q76`, `01KR9RFA0HCJB9BWV5D3QZW2YR`.

### P2 — Quality of life

5. **Doctor warning rollup.** Group the 8 deterministic-step-missing-tool warnings as a single line like "8 deterministic steps without registered tools (expected in v0.1; see v0.2 enforcement)" or suppress them behind `--strict`.
   *Evidence:* `01KR9RF9YT6K2BFN01M14QRVTZ`. Every doctor run produces the same noise.

6. **Context summary debuggability.** When the pack returns 0 results, the summary line should explain *why* — list the buckets tried, filters applied, and a hint that inbox-fallback (P0) would have helped.
   *Evidence:* `01KR9RFA28TFFQPK3CGWP2APZ7`.

### P3 — Backlog / nice to have (not from this session's evidence)

The rest of the v0.2 surface from `PLAN.md` v2.0 (full doctor with eval-triggers + dry-audit, programmatic `skillify`, latent/deterministic enforcement, lane-overlap blocking) is **not yet supported by dogfood evidence**. Defer those until a session uncovers concrete friction.

## 11. Blocking issues for continued dogfooding

**None.** v0.1 is usable for ongoing capture. The retrieval miss (P0 above) is the only friction that meaningfully reduces value, and the workaround is to use `mnemonic search` directly when `context` returns nothing.

## 12. How to keep dogfooding

```bash
# Aliases worth setting (zsh / bash)
alias mn="node /path/to/mnemonic-kb/apps/cli/bin/mnemonic.js"
export MNEMONIC_VAULT=~/mnemonic-vault

# Daily loop
mn remember "<thing you'd otherwise forget>" --tag <bug|friction|feature|...> [--tag v0.2]
mn context --task "<actual task>" [--repo <r>]
# If context comes back light, fall back to:
mn search "<keywords>"
# Periodically:
mn inbox             # triage
mn inbox promote <id> --reason "..."   # → proposal
mn promote <pid>     # → canonical (after review)
mn doctor            # weekly health check
```

When you've accumulated ~20–30 friction/feature notes, run a synthesis pass (manually for now, since `diarize` is v0.3) and use it as the input to the v0.2 design doc.
