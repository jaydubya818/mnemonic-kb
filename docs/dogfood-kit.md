# Dogfood kit

Everything you need to use Mnemonic for a week of real work and capture the friction. Keep this open in a tab.

## 1. Shell aliases (one-time, paste into `~/.zshrc` or `~/.bashrc`)

```bash
# Mnemonic KB
export MNEMONIC_REPO="/Users/jaywest/Documents/Claude/Projects/Mnemonic/mnemonic-kb"
export MNEMONIC_VAULT="$HOME/mnemonic-vault"
alias mn="node $MNEMONIC_REPO/apps/cli/bin/mnemonic.js"
alias mnctx='mn context --task'
alias mns='mn search'
alias mnr='mn remember'
alias mnbug='_mnbug(){ mn remember "Bug: $*" --tag bug --tag v0.2; }; _mnbug'
alias mnfric='_mnfric(){ mn remember "Friction: $*" --tag friction --tag v0.2; }; _mnfric'
alias mnfeat='_mnfeat(){ mn remember "Feature request: $*" --tag feature --tag v0.2; }; _mnfeat'
alias mnwiki="pnpm --filter @mnemonic/wiki --dir $MNEMONIC_REPO start"
```

After pasting, `source ~/.zshrc` (or restart your terminal). Then:

```bash
mn doctor                              # sanity check
mnr "first thought of the day"         # quick capture
mnctx "what I'm about to work on"      # build context
```

## 2. MCP server — Claude Code

```bash
# Create or edit the config file
mkdir -p ~/.claude
cat >> ~/.claude/mcp_servers.json <<'EOF'
{
  "mcpServers": {
    "mnemonic": {
      "command": "node",
      "args": ["/Users/jaywest/Documents/Claude/Projects/Mnemonic/mnemonic-kb/apps/mcp-server/bin/mnemonic-mcp.js"],
      "env": {
        "MNEMONIC_VAULT": "/Users/jaywest/mnemonic-vault"
      }
    }
  }
}
EOF
```

If the file already has other servers, merge under the existing `mcpServers` key. Restart Claude Code. The tools should appear under the MCP indicator (`mnemonic.search`, `mnemonic.get_task_context`, etc.).

## 3. MCP server — Cursor

In your project's `.cursor/mcp.json` (or `~/.cursor/mcp.json` for global):

```json
{
  "mcpServers": {
    "mnemonic": {
      "command": "node",
      "args": ["/Users/jaywest/Documents/Claude/Projects/Mnemonic/mnemonic-kb/apps/mcp-server/bin/mnemonic-mcp.js"],
      "env": {
        "MNEMONIC_VAULT": "/Users/jaywest/mnemonic-vault"
      }
    }
  }
}
```

Restart Cursor. Confirm the tools show up in MCP settings.

## 4. The daily loop

**Before a coding task:**
```bash
mnctx "<one-line task description>" --repo <repo-slug>
```

If `mnctx` returns "0 relevant pages, confidence low" but you *know* you have notes on it, fall back to:
```bash
mns "<keywords>"
```
(That asymmetry is exactly the v0.2 P0 friction you'd be capturing — see below.)

**During work:** when something surprises you (good or bad), capture in one line:
```bash
mnbug "promote failed silently when proposal target was deprecated"
mnfric "search relevance feels off for short queries"
mnfeat "mn open <id> should pop the page in $EDITOR"
mnr "lesson: vaultWriter chokepoint paid off — clean refactor"
```

**End of day:**
```bash
mn inbox                              # see what you captured
mn inbox promote <id> --reason "..."  # graduate inbox notes worth keeping
mn proposals --status open            # check what's awaiting promotion
```

**Weekly:**
```bash
mn doctor --verbose                   # health check
```

## 5. When to synthesize

You're ready when:

```bash
mn search "v0.2" --limit 50 | grep -c "^[0-9]"
# returns ≥ 20
```

At that point, copy `docs/v0.2-synthesis-template.md` to `docs/v0.2-design.md` and fill it in. The synthesis is **manual** in v0.1 because `diarize` is a v0.3 skill — see `templates/skills/retrieval/diarize-documents/SKILL.md` for the format that automated synthesis will eventually use.

## 6. What "good capture" looks like

| Tag | When to use | Example |
|---|---|---|
| `bug` | Mnemonic did the wrong thing | `mnbug "search ranks deprecated above active for same title"` |
| `friction` | Mnemonic did the right thing but it was painful | `mnfric "no way to bulk-archive inbox older than N days"` |
| `feature` | Mnemonic doesn't do this and it should | `mnfeat "mn graph --depth 2 to show backlink network"` |
| `lesson` | Something worked well and you want to keep it | `mn remember "lesson: typing 'mnr' for remember is the right ergonomics" --tag lesson` |
| `v0.2` | Tag liberally on every bug/friction/feature so synthesis is one query | (default in the aliases above) |
| Repo-specific | When the friction relates to using Mnemonic against a specific codebase | `mnbug "..." --repo hermes-agent` |

## 7. Anti-patterns — don't

- **Don't batch-capture at end of day from memory.** Capture in the moment or you'll lose detail.
- **Don't filter for "important" before capturing.** Cheap notes are fine; the synthesis pass is where you cull.
- **Don't fix v0.1 bugs while dogfooding.** Capture and move on. The whole point is to accumulate evidence for what v0.2 should be.
- **Don't promote friction notes to canonical lessons.** Friction is pre-canonical; let it stay in inbox or proposal status until the v0.2 design pass.

## 8. Wiki for review

`mnwiki` opens `http://localhost:4477`. Useful when you want to skim everything you've captured this week without typing search queries.

---

**See also:**
- [docs/cli.md](cli.md) — full CLI reference
- [docs/mcp-tools.md](mcp-tools.md) — full MCP tool reference
- [docs/dogfood-log.md](dogfood-log.md) — initial dogfood log (v0.1.0 release session)
- [docs/v0.2-synthesis-template.md](v0.2-synthesis-template.md) — template for when you hit ~20–30 notes
