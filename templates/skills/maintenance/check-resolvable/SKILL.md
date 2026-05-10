---
id: maintenance/check-resolvable
name: Check Resolvable
description: Audit the skill/resolver/filing-rules layer for structural integrity.
status: active
parameters: []
outputs:
  - { name: report, type: ResolverAuditResult }
uses:
  - cli.checkResolvable
steps:
  - { id: load-skills,   kind: deterministic }
  - { id: load-resolver, kind: deterministic }
  - { id: validate,      kind: deterministic }
  - { id: regenerate-index, kind: deterministic }
lanes:
  covers:   [resolver-audit, structural-validation]
  excludes: [trigger-evals, dry-audit, runtime-enforcement]
risk: low
governance: none
triggers:
  - "can this skill be invoked"
  - "audit my skills"
  - "is my resolver healthy"
---

# Check Resolvable

## Purpose
Static structural audit of the skills + resolver + filing-rules layer. Fails
on errors that would prevent the system from running correctly. Warns on
informational issues (lane overlaps, draft skills with no resolver entry).

## When to Use
- Pre-commit hook.
- After adding or removing a skill.
- Before promoting a v0.1 vault to use with Hermes/Pi.

## Procedure
1. Walk `<vault>/.mnemonic/skills/` and parse every `SKILL.md`.
2. Parse `RESOLVER.md` (Markdown table).
3. Parse filing rules YAML.
4. Run audit checks (errors and warnings).
5. Regenerate `.skills-index.json`.

## Errors (fail check)
- Invalid skill schema.
- Duplicate active skill id.
- Active skill missing resolver entry.
- Resolver entry pointing to a missing skill.
- Filing rules unparseable.

## Warnings (do not fail)
- Draft skill without resolver entry.
- Lane overlap (two skills covering the same lane).
- Deterministic step missing a registered tool.

## Output Format
Exit 0 + summary line on success. Exit 4 on failures.

## Related Skills
- `maintenance/skillify` — emits skills that should pass this audit.
