# CLI reference

```
mnemonic <command> [args] [flags]
```

The CLI auto-detects the vault by walking up from `cwd` looking for `.mnemonic/config.yaml`, then `MNEMONIC_VAULT`, then `~/mnemonic-vault`.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | success |
| 1 | user error (bad arguments) |
| 2 | vault not found |
| 3 | schema-validation failure |
| 4 | check-resolvable failure |
| 5 | resource not found (page/proposal id) |

## Commands

### `mnemonic init`

```
mnemonic init [--vault <path>] [--force] [--yes]
```

Initializes a vault from `templates/`. Creates the vault skeleton, copies skills templates into `<vault>/.mnemonic/skills/`, writes `.mnemonic/_filing-rules.md`, writes `.mnemonic/config.yaml`, builds the index.

- `--vault <path>` — defaults to `~/mnemonic-vault`.
- `--force` — overwrite skills templates if vault is non-empty.
- `--yes` — non-interactive (placeholder; v0.1 init is already non-interactive).

### `mnemonic remember`

```
mnemonic remember "<content>" [--repo <r>] [--project <p>] [--tag <t>...]
```

Writes to `inbox/<id>.md`. Always inbox, regardless of any type-related flag.

### `mnemonic search`

```
mnemonic search "<query>" [--type <t>] [--repo <r>] [--limit <n>]
```

Ranks via `score = 3·BM25(title) + 2·BM25(tags) + 2·BM25(aliases) + BM25(body) + recencyDecay − statusPenalty − lowConfPenalty + repoBonus`. Default limit: 10.

### `mnemonic read`

```
mnemonic read <idOrPath> [--format md|json]
```

Reads by ULID or by relative/absolute path.

### `mnemonic recent`

```
mnemonic recent [--type <t>] [--limit <n>]
```

### `mnemonic context`

```
mnemonic context --task "<task>" [--repo <r>] [--project <p>] [--max-tokens <n>]
```

Default `--max-tokens` = 6000; hard cap = 12000. Output is the full Markdown context pack (cited paths, sectioned by decisions / lessons / patterns).

### `mnemonic repo-context`

```
mnemonic repo-context <repo>
```

Prints the repo page summary.

### `mnemonic inbox`

```
mnemonic inbox                              # list
mnemonic inbox show <id>                    # display one
mnemonic inbox promote <id> [--reason "<r>"]
mnemonic inbox archive <id>                 # status: deprecated
```

### Proposals

```
mnemonic propose "<content>" --reason "<r>" [--repo <r>] [--type <t>]
mnemonic promote <proposalId>
mnemonic reject <proposalId> --reason "<r>"
mnemonic proposals [--status open|promoted|rejected]
```

### Skills

```
mnemonic skills list [--status active|draft]
mnemonic skills inspect <skillId>
```

### Audit

```
mnemonic check-resolvable     # alias: mnemonic check
mnemonic doctor [--verbose]
```

`doctor` (v0.1) runs schema-validate + check-resolvable + index-rebuild. v0.2 adds eval-triggers + dry-audit + smoke + `--fix`.

### Wiki

```
mnemonic wiki [--port <n>]
```

Default port 4477. Localhost only, no auth.
