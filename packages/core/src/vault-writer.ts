/**
 * VaultWriter — the single legitimate write path into a vault.
 *
 * apps/* and packages/agent-adapters/* and skills/* MUST NOT import node:fs
 * for writes. They go through this interface. The lint rule (see eslint config)
 * enforces this; the `assertPathInsideVault` check defends against escapes.
 */
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import type { Page, Proposal, ProposalStatus, PageStatus, FilingRule } from "@mnemonic/schemas";
import { Proposal as ProposalSchema } from "@mnemonic/schemas";
import { writeFrontmatter, parseFrontmatter } from "./frontmatter.js";
import { resolveForPage, assertPathInsideVault } from "./filing-rules.js";
import type { VaultContext } from "./context.js";

export interface TimelineEntry {
  date: string; // ISO
  text: string;
}

export interface VaultWriter {
  writePage(page: Page): Promise<{ id: string; path: string }>;
  appendTimeline(pageId: string, entry: TimelineEntry): Promise<void>;
  setStatus(pageId: string, status: PageStatus, reason?: string): Promise<void>;
  createProposal(input: NewProposalInput): Promise<{ id: string; path: string }>;
  promote(proposalId: string): Promise<{ targetPath: string; appendedTimeline: boolean }>;
  reject(proposalId: string, reason: string): Promise<void>;
  writeInbox(note: Page): Promise<{ id: string; path: string }>;
}

export interface NewProposalInput {
  proposedBy: string;
  reason: string;
  content: string;
  typeHint?: Proposal["typeHint"];
  repo?: string;
  project?: string;
  target?: Proposal["target"];
  evidence?: Proposal["evidence"];
}

export interface PageLookup {
  // Maps page id → absolute path. Built from index or filesystem walk.
  resolveById(pageId: string): string | null;
}

export interface VaultWriterDeps {
  ctx: VaultContext;
  rules: FilingRule[];
  lookup: PageLookup;
}

export function createVaultWriter(deps: VaultWriterDeps): VaultWriter {
  const { ctx, rules, lookup } = deps;
  const root = ctx.vaultRoot;

  return {
    async writePage(page) {
      const rel = resolveForPage(rules, page);
      const abs = assertPathInsideVault(root, rel);
      ensureDir(path.dirname(abs));
      fs.writeFileSync(abs, writeFrontmatter(page), "utf8");
      return { id: page.frontmatter.id, path: abs };
    },

    async appendTimeline(pageId, entry) {
      const abs = resolveOrThrow(lookup, pageId);
      const raw = fs.readFileSync(abs, "utf8");
      const page = parseFrontmatter(raw);
      const updated = appendTimelineSection(page.body, entry);
      const next: Page = {
        frontmatter: { ...page.frontmatter, updatedAt: ctx.now().toISOString() },
        body: updated,
      };
      fs.writeFileSync(abs, writeFrontmatter(next), "utf8");
    },

    async setStatus(pageId, status, _reason) {
      const abs = resolveOrThrow(lookup, pageId);
      const raw = fs.readFileSync(abs, "utf8");
      const page = parseFrontmatter(raw);
      const next: Page = {
        frontmatter: { ...page.frontmatter, status, updatedAt: ctx.now().toISOString() },
        body: page.body,
      };
      fs.writeFileSync(abs, writeFrontmatter(next), "utf8");
    },

    async createProposal(input) {
      const id = ctx.randomId();
      const createdAt = ctx.now().toISOString();
      const proposal: Proposal = ProposalSchema.parse({
        id,
        status: "open" satisfies ProposalStatus,
        proposedBy: input.proposedBy,
        reason: input.reason,
        createdAt,
        evidence: input.evidence ?? [],
        content: input.content,
        ...(input.typeHint ? { typeHint: input.typeHint } : {}),
        ...(input.repo ? { repo: input.repo } : {}),
        ...(input.project ? { project: input.project } : {}),
        ...(input.target ? { target: input.target } : {}),
      });
      const rel = path.join("_proposals", `${id}.md`);
      const abs = assertPathInsideVault(root, rel);
      ensureDir(path.dirname(abs));
      fs.writeFileSync(abs, renderProposalFile(proposal), "utf8");
      return { id, path: abs };
    },

    async promote(proposalId) {
      const propPath = assertPathInsideVault(root, path.join("_proposals", `${proposalId}.md`));
      if (!fs.existsSync(propPath)) {
        throw new VaultWriterError(`Proposal not found: ${proposalId}`);
      }
      const proposal = readProposalFile(propPath);
      if (proposal.status !== "open") {
        throw new VaultWriterError(`Proposal ${proposalId} is ${proposal.status}, not open.`);
      }

      // Resolve target page. v0.1 strategy:
      //   - If target.pageId is set and that page exists, append to its timeline.
      //   - Else, create a fresh canonical page from the proposal content using typeHint.
      let targetPath: string;
      let appended = false;

      if (proposal.target?.pageId) {
        const tp = lookup.resolveById(proposal.target.pageId);
        if (!tp) throw new VaultWriterError(`Target page not found: ${proposal.target.pageId}`);
        const raw = fs.readFileSync(tp, "utf8");
        const page = parseFrontmatter(raw);
        const updatedBody = appendTimelineSection(page.body, {
          date: ctx.now().toISOString(),
          text: `Promoted proposal ${proposalId}: ${proposal.reason}`,
        });
        const next: Page = {
          frontmatter: { ...page.frontmatter, updatedAt: ctx.now().toISOString() },
          body: updatedBody,
        };
        fs.writeFileSync(tp, writeFrontmatter(next), "utf8");
        targetPath = tp;
        appended = true;
      } else {
        if (!proposal.typeHint) {
          throw new VaultWriterError(
            `Proposal ${proposalId} has no target.pageId and no typeHint; cannot promote in v0.1.`
          );
        }
        const newPage: Page = {
          frontmatter: {
            id: ctx.randomId(),
            schemaVersion: 1,
            type: proposal.typeHint,
            status: "active",
            title: deriveTitle(proposal.content),
            tags: [],
            aliases: [],
            ...(proposal.repo ? { repo: proposal.repo } : {}),
            ...(proposal.project ? { project: proposal.project } : {}),
            createdAt: ctx.now().toISOString(),
            updatedAt: ctx.now().toISOString(),
            source: "promotion",
            confidence: "medium",
            links: [proposalId],
            evidence: [{ type: "proposal", path: propPath, note: proposal.reason }],
          },
          body: renderCanonicalBody(proposal),
        };
        const rel = resolveForPage(rules, newPage);
        const abs = assertPathInsideVault(root, rel);
        ensureDir(path.dirname(abs));
        fs.writeFileSync(abs, writeFrontmatter(newPage), "utf8");
        targetPath = abs;
        appended = false;
      }

      // Update proposal status (preserve file as audit trail).
      const promotedAt = ctx.now().toISOString();
      const updatedProposal: Proposal = { ...proposal, status: "promoted", promotedAt };
      fs.writeFileSync(propPath, renderProposalFile(updatedProposal), "utf8");

      return { targetPath, appendedTimeline: appended };
    },

    async reject(proposalId, reason) {
      const propPath = assertPathInsideVault(root, path.join("_proposals", `${proposalId}.md`));
      if (!fs.existsSync(propPath)) {
        throw new VaultWriterError(`Proposal not found: ${proposalId}`);
      }
      const proposal = readProposalFile(propPath);
      const next: Proposal = {
        ...proposal,
        status: "rejected",
        rejectedAt: ctx.now().toISOString(),
        rejectedReason: reason,
      };
      fs.writeFileSync(propPath, renderProposalFile(next), "utf8");
    },

    async writeInbox(note) {
      if (note.frontmatter.type !== "note") {
        throw new VaultWriterError("writeInbox requires type=note");
      }
      const rel = path.join("inbox", `${note.frontmatter.id}.md`);
      const abs = assertPathInsideVault(root, rel);
      ensureDir(path.dirname(abs));
      fs.writeFileSync(abs, writeFrontmatter(note), "utf8");
      return { id: note.frontmatter.id, path: abs };
    },
  };
}

// ─── helpers ──────────────────────────────────────────────────────────────

function ensureDir(d: string): void { fs.mkdirSync(d, { recursive: true }); }

function resolveOrThrow(lookup: PageLookup, pageId: string): string {
  const p = lookup.resolveById(pageId);
  if (!p) throw new VaultWriterError(`Page not found: ${pageId}`);
  return p;
}

function deriveTitle(content: string): string {
  const first = content.split(/\r?\n/, 1)[0] ?? content;
  return first.replace(/^#+\s*/, "").slice(0, 80) || "Promoted memory";
}

function appendTimelineSection(body: string, entry: TimelineEntry): string {
  const line = `- ${entry.date.slice(0, 10)} — ${entry.text}`;
  if (/^##\s+Timeline\s*$/m.test(body)) {
    return body.replace(/(##\s+Timeline\s*\n)([\s\S]*?)(\n##\s|\n*$)/, (_full, head, list, tail) => {
      const trimmed = (list ?? "").replace(/\n+$/, "");
      const next = trimmed ? `${trimmed}\n${line}\n` : `${line}\n`;
      return `${head}${next}${tail.startsWith("\n##") ? tail : tail || ""}`;
    });
  }
  return `${body.replace(/\n+$/, "")}\n\n## Timeline\n${line}\n`;
}

function renderCanonicalBody(p: Proposal): string {
  return [
    `# ${deriveTitle(p.content)}`,
    "",
    "## Compiled Truth",
    p.content.trim(),
    "",
    "## Current State",
    "",
    "## Decisions",
    "",
    "## Lessons",
    "",
    "## Patterns",
    "",
    "## Known Pitfalls",
    "",
    "## Related Pages",
    "",
    "## Timeline",
    `- ${new Date().toISOString().slice(0, 10)} — Page created from proposal ${p.id}.`,
    "",
  ].join("\n");
}

function renderProposalFile(p: Proposal): string {
  // Proposals are stored as their own minimal Markdown files. Frontmatter is
  // a flat YAML mapping; body is the content + the rejection/promotion log.
  const fm = {
    id: p.id,
    schemaVersion: 1,
    kind: "proposal",
    status: p.status,
    proposedBy: p.proposedBy,
    reason: p.reason,
    typeHint: p.typeHint ?? null,
    repo: p.repo ?? null,
    project: p.project ?? null,
    target: p.target ?? null,
    createdAt: p.createdAt,
    promotedAt: p.promotedAt ?? null,
    rejectedAt: p.rejectedAt ?? null,
    rejectedReason: p.rejectedReason ?? null,
    evidence: p.evidence ?? [],
  };
  const yaml = YAML.stringify(fm, { lineWidth: 0 }).trimEnd();
  return `---\n${yaml}\n---\n\n# Proposal\n\n${p.content.trim()}\n`;
}

function readProposalFile(absPath: string): Proposal {
  const raw = fs.readFileSync(absPath, "utf8");
  const fence = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
  const m = fence.exec(raw);
  if (!m) throw new VaultWriterError(`Malformed proposal: ${absPath}`);
  const yamlText = m[1] ?? "";
  const data = YAML.parse(yamlText) as Record<string, unknown>;
  const body = raw.slice(m[0].length);
  const content = body.replace(/^\s*#\s+Proposal\s*\n+/, "").trim();
  return ProposalSchema.parse({
    id: data.id, status: data.status, proposedBy: data.proposedBy, reason: data.reason,
    typeHint: data.typeHint ?? undefined,
    repo: data.repo ?? undefined,
    project: data.project ?? undefined,
    target: data.target ?? undefined,
    createdAt: data.createdAt,
    promotedAt: data.promotedAt ?? undefined,
    rejectedAt: data.rejectedAt ?? undefined,
    rejectedReason: data.rejectedReason ?? undefined,
    evidence: data.evidence ?? [],
    content,
  });
}

export class VaultWriterError extends Error {
  override name = "VaultWriterError";
}
