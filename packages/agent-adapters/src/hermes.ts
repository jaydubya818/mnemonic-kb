/**
 * Hermes adapter — doc-first stubs for v0.1.
 *
 * See docs/hermes-integration.md for the full flow and contract. v0.1 ships
 * function signatures + a working `buildHermesContextBlock` formatter; the
 * other functions wrap MCP/HTTP calls Hermes would make.
 */
import type { ContextPack } from "@mnemonic/schemas";

export interface HermesTaskInput {
  task: string;
  repo?: string;
  project?: string;
  maxTokens?: number;
}

export interface HermesRunSummary {
  task: string;
  whatChanged: string;
  decisions?: string[];
  lessons?: string[];
  patterns?: string[];
}

/**
 * Stub: Hermes calls MCP `mnemonic.get_task_context`. v0.1 documents the call;
 * implementation lives in Hermes' own runtime.
 */
export async function getHermesTaskContext(_input: HermesTaskInput): Promise<ContextPack> {
  throw new Error(
    "Not implemented in v0.1. Hermes should call MCP `mnemonic.get_task_context` directly. " +
    "See docs/hermes-integration.md."
  );
}

/**
 * Convert a ContextPack into a Markdown block Hermes can paste into its
 * planning prompt. This is the only function with a real implementation in
 * v0.1 — it is pure formatting.
 */
export function buildHermesContextBlock(pack: ContextPack): string {
  const header = pack.confidence === "low"
    ? `> Low-confidence context: ${pack.warnings.join("; ") || "few relevant pages found"}.\n\n`
    : "";
  return `${header}${pack.contextPackMarkdown.trim()}\n`;
}

/**
 * Stub: after a Hermes run, propose any durable lessons/decisions/patterns
 * back to Mnemonic via `mnemonic.propose_memory`.
 */
export async function proposeHermesRunSummaryMemory(
  _summary: HermesRunSummary
): Promise<{ proposalIds: string[] }> {
  throw new Error(
    "Not implemented in v0.1. Hermes should call MCP `mnemonic.propose_memory` for each " +
    "durable item discovered. See docs/hermes-integration.md."
  );
}
