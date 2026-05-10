# Pi integration

**Pi governs execution and audit.** v0.1 ships only the audit-record shape. v0.3 wires governance enforcement.

## v0.1 surface

`packages/agent-adapters/src/pi.ts` exports:

```ts
export type PiEffectKind = "read" | "remember" | "propose" | "promote" | "reject";

export interface PiAuditRecord {
  effect: PiEffectKind;
  callerId: string;                  // "cli" | "mcp" | "<agent-id>"
  query?: string;                    // for read effects
  pages?: string[];                  // page ids returned
  proposalId?: string;
  targetId?: string;
  contextHash?: string;              // SHA-256 of serialized context pack
  accepted: boolean;
  rejectedReason?: string;
  timestamp: string;
}

export interface PiEffect {
  kind: PiEffectKind;
  record: PiAuditRecord;
  apply: () => Promise<unknown>;     // runs only after Pi approves
}
```

In v0.1: types are frozen, `buildPiMemoryEffect` is a passthrough, the `create*` factory functions throw "Not implemented in v0.1." This locks the wire format so v0.3 wiring is mechanical.

## v0.3 plan (forward-looking)

1. Every MCP write tool builds a `PiEffect` instead of executing directly.
2. The MCP server emits the `PiAuditRecord` to a Pi-readable sink (file, named pipe, or HTTP — TBD).
3. Pi inspects the record + the in-flight context, decides accept/reject.
4. On accept, Pi calls `effect.apply()`; on reject, the proposal is recorded as rejected.
5. Read effects emit records too, but apply() runs immediately (Pi only audits, doesn't gate reads).

## Things Pi will govern in v0.3

- `promote_memory` — moving a proposal to canonical.
- Any future `delete_memory` (out of scope in v0.1 but reserved).
- Direct canonical writes (out of scope in v0.1).
- Repeated promotions of the same proposal.
- Promotions that overwrite Compiled Truth (vs. only appending Timeline).

## Things Pi will NOT govern

- `mnemonic.remember` (inbox writes) — too low-stakes; high friction would discourage capture.
- `mnemonic.propose_memory` itself — proposals are inherently safe (audit trail, no canonical change).
- Read tools — Pi only audits, never blocks reads.

## Sink format (proposed)

Newline-delimited JSON, one record per line:

```json
{"effect":"promote","callerId":"mcp:hermes-001","proposalId":"01PROP…","targetId":"01TARGET…","contextHash":"sha256:…","accepted":true,"timestamp":"2026-05-10T12:00:00.000Z"}
```

Default sink path (proposed for v0.3): `<vault>/.mnemonic/pi-audit.ndjson`.
