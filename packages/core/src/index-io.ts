/**
 * Persistence of the retrieval index. Lives in core so retrieval stays pure
 * (no `fs` imports) and the lint rule "no fs outside core" is enforceable.
 */
import fs from "node:fs";
import path from "node:path";

/** Minimum shape needed for persistence; retrieval defines the canonical type. */
export interface IndexFileLike {
  version: 1;
  generatedAt: string;
  entries: unknown[];
}

export function retrievalIndexPath(vaultRoot: string): string {
  return path.join(vaultRoot, ".mnemonic", "index.json");
}

export function saveRetrievalIndex(vaultRoot: string, idx: IndexFileLike): void {
  const p = retrievalIndexPath(vaultRoot);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(idx, null, 2), "utf8");
}

export function loadRetrievalIndex<T extends IndexFileLike = IndexFileLike>(vaultRoot: string): T | null {
  const p = retrievalIndexPath(vaultRoot);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as T;
  } catch {
    return null;
  }
}
