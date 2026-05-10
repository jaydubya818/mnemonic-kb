# Memory lifecycle

```
remember "<x>"                            mnemonic remember
   │                                      mnemonic.remember (MCP)
   ▼
inbox/<id>.md       (type: note, status: active, # Captured + # Hints)
   │
   │  inbox promote <id>  --reason "..."
   ▼
_proposals/<id>.md  (status: open, content, typeHint, evidence[])
   │
   │  promote <id>
   ▼
canonical page      (decisions/, lessons/, patterns/, etc. per filing rules)
                    OR appends to existing target's ## Timeline
                    + proposal preserved with status: promoted (audit trail)
```

## Rules

- `mnemonic remember` writes to **inbox only**, regardless of any `--type` hint. The hint is recorded in the body's `# Hints` section so future inbox-triage skills (v0.3) can read it.
- A proposal is itself a Markdown file. It is never deleted. Status transitions `open → promoted` or `open → rejected`; both leave the file on disk for audit.
- Promotion either:
  - **Appends to an existing target** (when `target.pageId` is set) — adds an entry to the target's `## Timeline` section. The Compiled Truth is not modified by promotion.
  - **Creates a fresh canonical page** (when `typeHint` is set but no target page) — uses filing rules to pick the path; copies content into Compiled Truth; seeds Timeline with "Page created from proposal &lt;id&gt;".
- **No destructive operations in v0.1.** No `delete_memory`, no canonical rewrites, no `mnemonic mv`. Deprecation uses `setStatus(id, "deprecated")` — content stays on disk.

## CLI commands

```
mnemonic remember "<content>"                 # quick capture
mnemonic inbox                                # list inbox
mnemonic inbox show <id>
mnemonic inbox promote <id> [--reason "..."]  # → proposal
mnemonic inbox archive <id>                   # status: deprecated

mnemonic propose "<content>" --reason "<r>" [--type <t>] [--repo <r>]
mnemonic promote <proposalId>
mnemonic reject <proposalId> --reason "<r>"
mnemonic proposals [--status open|promoted|rejected]
```

## MCP tools

```
mnemonic.remember
mnemonic.propose_memory
mnemonic.promote_memory
mnemonic.create_decision   ← creates a proposal in v0.1
mnemonic.create_lesson     ← creates a proposal in v0.1
mnemonic.create_pattern    ← creates a proposal in v0.1
```

`create_decision`, `create_lesson`, and `create_pattern` are **structured** entry points that ultimately produce proposals — never direct canonical writes in v0.1. Pi governance for direct writes is v0.3.
