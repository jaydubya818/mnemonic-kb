/**
 * Read-side helpers: list, recent, lookup, backlinks.
 *
 * These functions never write. Writes go through VaultWriter.
 */
import fs from "node:fs";
import path from "node:path";
import type { Page } from "@mnemonic/schemas";
import { parseFrontmatter } from "./frontmatter.js";
import type { PageLookup } from "./vault-writer.js";

export interface ListedPage {
  path: string;
  page: Page;
}

const SKIP_DIRS = new Set([".mnemonic", ".git", "node_modules", "_proposals"]);

export function listPages(vaultRoot: string, opts?: { includeProposals?: boolean }): ListedPage[] {
  const out: ListedPage[] = [];
  const skip = new Set(SKIP_DIRS);
  if (opts?.includeProposals) skip.delete("_proposals");

  function walk(dir: string): void {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") && entry.name !== ".mnemonic") continue;
      if (skip.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".md") && !entry.name.startsWith("_")) {
        try {
          const raw = fs.readFileSync(full, "utf8");
          const page = parseFrontmatter(raw);
          out.push({ path: full, page });
        } catch {
          // Skip malformed files silently in v0.1; doctor will catch them.
        }
      }
    }
  }
  walk(vaultRoot);
  return out;
}

export function getRecentPages(vaultRoot: string, limit = 20, type?: Page["frontmatter"]["type"]): ListedPage[] {
  const all = listPages(vaultRoot);
  const filtered = type ? all.filter((p) => p.page.frontmatter.type === type) : all;
  return filtered.sort(byUpdatedAtDesc).slice(0, limit);
}

export function readPage(vaultRoot: string, idOrPath: string): ListedPage {
  // If it looks like a path, try direct read first.
  if (idOrPath.includes("/") || idOrPath.endsWith(".md")) {
    const candidate = path.isAbsolute(idOrPath) ? idOrPath : path.join(vaultRoot, idOrPath);
    if (fs.existsSync(candidate)) {
      const raw = fs.readFileSync(candidate, "utf8");
      return { path: candidate, page: parseFrontmatter(raw) };
    }
  }
  // Otherwise treat as id and look up.
  const all = listPages(vaultRoot, { includeProposals: true });
  const hit = all.find((p) => p.page.frontmatter.id === idOrPath);
  if (!hit) throw new PageNotFoundError(`Page not found: ${idOrPath}`);
  return hit;
}

export function buildLookup(vaultRoot: string): PageLookup {
  const all = listPages(vaultRoot, { includeProposals: false });
  const map = new Map<string, string>();
  for (const { path: p, page } of all) {
    map.set(page.frontmatter.id, p);
  }
  return {
    resolveById(id) { return map.get(id) ?? null; },
  };
}

export function listInbox(vaultRoot: string): ListedPage[] {
  const inboxDir = path.join(vaultRoot, "inbox");
  if (!fs.existsSync(inboxDir)) return [];
  const out: ListedPage[] = [];
  for (const entry of fs.readdirSync(inboxDir)) {
    if (!entry.endsWith(".md")) continue;
    const full = path.join(inboxDir, entry);
    try {
      const raw = fs.readFileSync(full, "utf8");
      const page = parseFrontmatter(raw);
      out.push({ path: full, page });
    } catch {
      // skip
    }
  }
  return out.sort(byUpdatedAtDesc);
}

export function listProposals(vaultRoot: string, status?: "open" | "promoted" | "rejected"): { id: string; path: string; status: string; reason: string; createdAt: string }[] {
  const dir = path.join(vaultRoot, "_proposals");
  if (!fs.existsSync(dir)) return [];
  const out: { id: string; path: string; status: string; reason: string; createdAt: string }[] = [];
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith(".md")) continue;
    const full = path.join(dir, entry);
    const raw = fs.readFileSync(full, "utf8");
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
    if (!m) continue;
    // Cheap parse — enough for listing.
    const yamlText = m[1] ?? "";
    const id = matchField(yamlText, "id");
    const st = matchField(yamlText, "status");
    const reason = matchField(yamlText, "reason");
    const createdAt = matchField(yamlText, "createdAt");
    if (status && st !== status) continue;
    out.push({ id, path: full, status: st, reason, createdAt });
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function matchField(yamlText: string, key: string): string {
  const re = new RegExp(`^${key}:\\s*(.+)$`, "m");
  const m = re.exec(yamlText);
  if (!m) return "";
  return (m[1] ?? "").trim().replace(/^["']|["']$/g, "");
}

function byUpdatedAtDesc(a: ListedPage, b: ListedPage): number {
  return b.page.frontmatter.updatedAt.localeCompare(a.page.frontmatter.updatedAt);
}

export class PageNotFoundError extends Error {
  override name = "PageNotFoundError";
}

/**
 * Build backlinks: for each page id, the set of page ids that reference it
 * via `links:` or via `[[id]]` / `[title](relative.md)` in body. v0.1 does
 * the simple `links:` field walk; the wikilink/relative-link parse is v0.2.
 */
export function buildBacklinks(vaultRoot: string): Record<string, string[]> {
  const all = listPages(vaultRoot);
  const back: Record<string, string[]> = {};
  for (const { page } of all) {
    for (const target of page.frontmatter.links) {
      if (!back[target]) back[target] = [];
      back[target]!.push(page.frontmatter.id);
    }
  }
  return back;
}
