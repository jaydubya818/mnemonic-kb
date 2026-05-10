# Skill Resolver

Routing table: user/agent intent → skill. Every active skill must be reachable from this table directly or transitively. Draft skills may be unreachable but `mnemonic check-resolvable` will warn.

## Active skills

| Intent example | Skill ID | Notes |
|---|---|---|
| remember this | memory/remember | Writes to inbox only |
| save this for later | memory/remember | Writes to inbox only |
| note this | memory/remember | Writes to inbox only |
| propose this as a lesson | memory/propose-memory | Creates a proposal |
| save this as a decision | memory/propose-memory | Creates a proposal |
| promote this memory | memory/promote-memory | Promotes a proposal to canonical |
| canonicalize this proposal | memory/promote-memory | Promotes a proposal to canonical |
| get context for this repo task | retrieval/get-task-context | Primary Hermes context path |
| build a context pack | retrieval/get-task-context | Primary Hermes context path |
| get repo context | retrieval/repo-context | Repo-level summary |
| can this skill be invoked | maintenance/check-resolvable | Resolver audit |
| audit my skills | maintenance/check-resolvable | Resolver audit |
| skillify this | maintenance/skillify | Procedural document only in v0.1 |
| make this a reusable skill | maintenance/skillify | Procedural document only in v0.1 |
| prepare Hermes for this task | integrations/hermes-context | Builds Hermes context block |
