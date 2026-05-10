/**
 * Build the JSON index from a vault. Persistence lives in `@mnemonic/core`
 * (`saveRetrievalIndex` / `loadRetrievalIndex`) — this module is pure builder
 * + cached loader logic. No `fs` imports.
 */
import type { Page, PageStatus, PageType, Confidence } from "@mnemonic/schemas";
import {
  listPages, saveRetrievalIndex, loadRetrievalIndex, retrievalIndexPath,
} from "@mnemonic/core";

export interface IndexEntry {
  id: string;
  title: string;
  type: PageType;
  status: PageStatus;
  confidence: Confidence;
  tags: string[];
  aliases: string[];
  repo?: string | undefined;
  project?: string | undefined;
  path: string;
  body: string;
  updatedAt: string;
  links: string[];
  backlinks: string[];
}

export interface IndexFile {
  version: 1;
  generatedAt: string;
  entries: IndexEntry[];
}

export function indexPath(vaultRoot: string): string {
  return retrievalIndexPath(vaultRoot);
}

export function buildIndex(vaultRoot: string, now: () => Date = () => new Date()): IndexFile {
  const all = listPages(vaultRoot);
  const entries: IndexEntry[] = all.map(({ path: p, page }) => entryFromPage(p, page, vaultRoot));
  const backIdx = new Map<string, Set<string>>();
  for (const e of entries) {
    for (const target of e.links) {
      if (!backIdx.has(target)) backIdx.set(target, new Set());
      backIdx.get(target)!.add(e.id);
    }
  }
  for (const e of entries) {
    e.backlinks = [...(backIdx.get(e.id) ?? [])];
  }
  return { version: 1, generatedAt: now().toISOString(), entries };
}

function entryFromPage(absPath: string, page: Page, vaultRoot: string): IndexEntry {
  // Compute relative path without `path` import to keep this module minimal.
  const rel = absPath.startsWith(vaultRoot) ? absPath.slice(vaultRoot.length).replace(/^[/\\]+/, "") : absPath;
  return {
    id: page.frontmatter.id,
    title: page.frontmatter.title,
    type: page.frontmatter.type,
    status: page.frontmatter.status,
    confidence: page.frontmatter.confidence,
    tags: page.frontmatter.tags,
    aliases: page.frontmatter.aliases,
    repo: page.frontmatter.repo,
    project: page.frontmatter.project,
    path: rel,
    body: page.body,
    updatedAt: page.frontmatter.updatedAt,
    links: page.frontmatter.links,
    backlinks: [],
  };
}

export function saveIndex(vaultRoot: string, idx: IndexFile): void {
  saveRetrievalIndex(vaultRoot, idx);
}

export function loadIndex(vaultRoot: string): IndexFile | null {
  return loadRetrievalIndex<IndexFile>(vaultRoot);
}

export function loadOrBuildIndex(vaultRoot: string): IndexFile {
  const existing = loadIndex(vaultRoot);
  if (existing) return existing;
  const fresh = buildIndex(vaultRoot);
  saveIndex(vaultRoot, fresh);
  return fresh;
}
