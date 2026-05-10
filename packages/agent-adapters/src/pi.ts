/**
 * Pi adapter — audit-record types + stubs for v0.1.
 *
 * v0.1 defines the types only; nothing emits records yet. v0.3 will route
 * promotions and risky writes through Pi and emit one record per effect.
 *
 * See docs/pi-integration.md for the wire format and intended flow.
 */

export type PiEffectKind = "read" | "remember" | "propose" | "promote" | "reject";

export interface PiAuditRecord {
  effect: PiEffectKind;
  callerId: string;                     // "cli" | "mcp" | "<agent-id>"
  query?: string;                       // for read effects
  pages?: string[];                     // page ids returned
  proposalId?: string;
  targetId?: string;
  contextHash?: string;                 // SHA-256 of serialized context pack
  accepted: boolean;
  rejectedReason?: string;
  timestamp: string;                    // ISO
}

export interface PiEffect {
  kind: PiEffectKind;
  record: PiAuditRecord;
  // The actual side-effect, called by Pi after governance approves.
  apply: () => Promise<unknown>;
}

/**
 * Build a generic audit record. v0.3 will plug this into the MCP server so
 * every write tool emits one.
 */
export function buildPiMemoryEffect(record: PiAuditRecord): PiAuditRecord {
  return record;
}

/** Stub for v0.1. */
export function createMnemonicReadEffect(_input: unknown): PiEffect {
  throw new Error("Not implemented in v0.1. See docs/pi-integration.md for v0.3 wiring.");
}

export function createMnemonicWriteProposalEffect(_input: unknown): PiEffect {
  throw new Error("Not implemented in v0.1. See docs/pi-integration.md for v0.3 wiring.");
}

export function createMnemonicPromotionEffect(_input: unknown): PiEffect {
  throw new Error("Not implemented in v0.1. See docs/pi-integration.md for v0.3 wiring.");
}
