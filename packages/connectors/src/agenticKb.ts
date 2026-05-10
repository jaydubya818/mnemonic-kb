/**
 * Agentic-KB connector — v0.1 stubs + mappers.
 *
 * Day-0 inspection of https://github.com/jaydubya818/Agentic-KB found:
 *   - Pages are Markdown with YAML frontmatter.
 *   - Common frontmatter fields: title, type, date, status, author, tags,
 *     reviewed, reviewed_date, confidence.
 *   - Decisions follow ADR shape (## Status / ## Context / ## Decision).
 *   - Wiki sections: agents/{leads,orchestrators,workers}, decisions/, concepts/,
 *     domains/, entities/, evaluations/, frameworks/.
 *   - 30+ MCP tools (search_wiki, read_article, list_articles, query_wiki,
 *     load_agent_context, promote_learning, merge_rewrite, …).
 *   - PIN-gated private scope.
 *
 * Lossy fields when mapping Agentic-KB → Mnemonic:
 *   - `author`, `reviewed`, `reviewed_date` → captured into `evidence[]` as a
 *     single `imported` entry; not preserved as first-class fields.
 *   - `status: deferred` (Agentic-KB) → mapped to `draft` (Mnemonic) by default.
 *   - Nested wiki paths (`agents/leads/...`) → flattened to type=agent + tag.
 *
 * Lossy fields when mapping Mnemonic → Agentic-KB:
 *   - `aliases[]` → ignored (Agentic-KB has no equivalent in v1.0).
 *   - `links[]` → preserved as Markdown wikilinks at the bottom of body.
 *   - `evidence[]` → flattened into a "## Evidence" section in body.
 */
import type { Page, PageType, PageStatus } from "@mnemonic/schemas";

export interface AgenticKbArticle {
  // Subset of the fields we observed; expand as needed.
  title: string;
  type: string;
  date?: string;
  status?: string;
  author?: string;
  tags?: string[];
  reviewed?: boolean;
  reviewed_date?: string;
  confidence?: string;
  body: string;
  filePath?: string;
}

export interface ImportOpts {
  agenticKbRoot: string;
  vaultRoot: string;
  // If false, only validate; do not write.
  dryRun?: boolean;
}

export interface ExportOpts {
  vaultRoot: string;
  agenticKbRoot: string;
  dryRun?: boolean;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  warnings: string[];
}

export interface ExportResult {
  exported: number;
  skipped: number;
  warnings: string[];
}

/** v0.1 stub. */
export async function importFromAgenticKb(_opts: ImportOpts): Promise<ImportResult> {
  throw new Error(
    "Not implemented in v0.1. Mapping is documented in docs/agentic-kb-integration.md " +
    "and packages/connectors/src/agenticKb.ts (lossy-fields list). Wire-up is v0.3."
  );
}

/** v0.1 stub. */
export async function exportToAgenticKb(_opts: ExportOpts): Promise<ExportResult> {
  throw new Error("Not implemented in v0.1. See docs/agentic-kb-integration.md.");
}

const AGENTIC_TYPE_MAP: Record<string, PageType> = {
  decision: "decision",
  concept: "note",
  agent: "agent",
  domain: "note",
  entity: "person",
  evaluation: "lesson",
  framework: "pattern",
  meeting: "meeting",
};

const AGENTIC_STATUS_MAP: Record<string, PageStatus> = {
  active: "active",
  draft: "draft",
  deferred: "draft",        // intentional: deferred is a Mnemonic-draft
  deprecated: "deprecated",
  superseded: "superseded",
};

/** Pure mapper: Agentic-KB article → Mnemonic page (without id/createdAt; caller fills). */
export function mapAgenticKbArticleToMnemonicPage(
  a: AgenticKbArticle,
  injected: { id: string; createdAt: string; updatedAt: string }
): Page {
  const type = AGENTIC_TYPE_MAP[a.type] ?? "note";
  const status = AGENTIC_STATUS_MAP[a.status ?? "active"] ?? "active";
  const evidence = [];
  if (a.author || a.reviewed_date) {
    evidence.push({
      type: "imported" as const,
      ...(a.filePath ? { path: a.filePath } : {}),
      ...(a.reviewed_date ? { date: a.reviewed_date } : {}),
      ...(a.author ? { note: `author: ${a.author}` } : {}),
    });
  }
  return {
    frontmatter: {
      id: injected.id,
      schemaVersion: 1,
      type,
      status,
      title: a.title,
      tags: a.tags ?? [],
      aliases: [],
      createdAt: injected.createdAt,
      updatedAt: injected.updatedAt,
      source: "import",
      confidence: (a.confidence as Page["frontmatter"]["confidence"]) ?? "medium",
      links: [],
      evidence,
    },
    body: a.body,
  };
}

/** Pure mapper: Mnemonic page → Agentic-KB article (lossy on aliases/evidence). */
export function mapMnemonicPageToAgenticKbArticle(p: Page): AgenticKbArticle {
  const fm = p.frontmatter;
  // Flatten evidence into body for round-trip-ish preservation.
  const evidenceBlock = fm.evidence.length
    ? `\n\n## Evidence\n${fm.evidence.map((e) => `- ${e.type}${e.path ? ` · ${e.path}` : ""}${e.note ? ` · ${e.note}` : ""}`).join("\n")}`
    : "";
  const linksBlock = fm.links.length
    ? `\n\n## Related\n${fm.links.map((l) => `- [[${l}]]`).join("\n")}`
    : "";
  return {
    title: fm.title,
    type: fm.type,
    date: fm.createdAt,
    status: fm.status,
    tags: fm.tags,
    confidence: fm.confidence,
    body: `${p.body}${evidenceBlock}${linksBlock}`,
  };
}
