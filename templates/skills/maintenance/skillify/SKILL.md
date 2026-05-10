---
id: maintenance/skillify
name: Skillify
description: Convert a repeated workflow into a reusable Markdown skill (procedural document only in v0.1).
status: active
parameters:
  - { name: workflowDescription, type: string, required: true }
  - { name: triggers, type: "string[]", required: false, default: [] }
outputs:
  - { name: skillDraftPath, type: string }
uses:
  - core.vaultWriter
steps:
  - { id: confirm-repeat,        kind: latent }
  - { id: draft-skill-md,        kind: latent }
  - { id: scaffold-tools,        kind: deterministic }
  - { id: scaffold-unit-tests,   kind: deterministic }
  - { id: scaffold-integration,  kind: deterministic }
  - { id: add-trigger-evals,     kind: latent }
  - { id: register-resolver,     kind: deterministic }
  - { id: run-doctor,            kind: deterministic }
  - { id: scaffold-smoke,        kind: deterministic }
  - { id: verify-filing-rules,   kind: deterministic }
lanes:
  covers:   [skill-authoring, meta-skill]
  excludes: [direct-skill-execution, runtime-dispatch]
risk: medium
governance: proposal-required
triggers:
  - "skillify this"
  - "make this a reusable skill"
  - "turn this workflow into a skill"
---

# Skillify

## v0.1 status
**This is a procedural document only.** There is no `mnemonic skillify` command
in v0.1 — the agent reads this skill body and authors the new SKILL.md by hand,
following the procedure below. v0.2 ships the runner and turns each step into a
deterministic tool.

## Purpose
Encode a repeated workflow as a reusable, parameterized skill so future runs
are durable and audited.

## When to Use
- The same workflow has happened ≥ 2 times manually.
- The user explicitly says "skillify this."
- An agent finishes a task and notices the procedure should compound.

## Procedure (10 steps)

1. **Confirm repeat.** Verify the workflow happened at least twice in recent activity.
2. **Draft `SKILL.md`.** Use `_skill-template.md`. Fill `parameters`, `outputs`, `uses`, `steps[].kind`, `lanes.covers`, `lanes.excludes`, `triggers`.
3. **Scaffold deterministic tools.** Stub each `kind: deterministic` step's tool in `tools/<skill>/<step>.ts`. (v0.2.)
4. **Scaffold unit tests.** Vitest stub for each tool. (v0.2.)
5. **Scaffold integration test.** Real vault fixture, end-to-end. (v0.2.)
6. **Add trigger evals.** Append ≥3 cases to `skills/evals/trigger-evals.json`.
7. **Register resolver.** Add a row to `RESOLVER.md`.
8. **Run `mnemonic doctor`.** Must exit 0.
9. **Smoke test.** Manual run with realistic input.
10. **Verify filing rules.** If the new skill writes pages, confirm `_filing-rules.md` covers its outputs.

## Latent / Judgment Steps
Steps 1, 2, 6 require synthesis: deciding the right parameter shape, the right
trigger phrasings, the right lane boundaries. Do not over-mechanize these.

## Deterministic Steps (v0.2 + )
Steps 3, 4, 5, 7, 8, 9, 10 are all deterministic and become tooling in v0.2.

## Output Format
Path to the new `SKILL.md` (in v0.1, the agent writes it directly).

## Failure Modes
- Workflow has only happened once → defer (don't skillify yet).
- Lane overlap with an existing skill → either narrow the new skill or merge.

## Related Skills
- `maintenance/check-resolvable` — must pass after skillify.
