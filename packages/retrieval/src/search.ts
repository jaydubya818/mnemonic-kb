/**
 * searchPages: query the index, score, filter, return SearchResult[].
 */
import type { SearchResult, PageType } from "@mnemonic/schemas";
import type { IndexEntry, IndexFile } from "./index-store.js";
import { rankEntry } from "./ranking.js";

export interface SearchInput {
  query: string;
  type?: PageType;
  repo?: string;
  project?: string;
  limit?: number;
  now?: Date;
  // If true, deprecated/superseded pages are still returned (with penalty); if
  // false, they are excluded entirely.
  includeArchived?: boolean;
}

export function searchPages(idx: IndexFile, input: SearchInput): SearchResult[] {
  const limit = input.limit ?? 20;
  const includeArchived = input.includeArchived ?? true;
  const ranked: Array<{ entry: IndexEntry; score: number }> = [];
  for (const entry of idx.entries) {
    if (input.type && entry.type !== input.type) continue;
    if (input.repo && entry.repo !== input.repo) continue;
    if (input.project && entry.project !== input.project) continue;
    if (!includeArchived && (entry.status === "deprecated" || entry.status === "superseded")) continue;
    const ranking: { query: string; now?: Date; repoFilter?: string } = { query: input.query };
    if (input.now) ranking.now = input.now;
    if (input.repo) ranking.repoFilter = input.repo;
    const score = rankEntry(entry, ranking);
    if (score <= 0) continue;
    ranked.push({ entry, score });
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit).map(({ entry, score }) => toResult(entry, score));
}

function toResult(entry: IndexEntry, score: number): SearchResult {
  return {
    id: entry.id,
    title: entry.title,
    type: entry.type,
    path: entry.path,
    relevance: roundTo(score, 4),
    excerpt: makeExcerpt(entry.body, 240),
    status: entry.status,
    updatedAt: entry.updatedAt,
  };
}

function makeExcerpt(body: string, max: number): string {
  // Strip headings + repeated whitespace; take the first prose-y chunk.
  const cleaned = body
    .replace(/^---[\s\S]*?---/, "")
    .replace(/^#+\s.*$/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length <= max) return cleaned;
  return cleaned.slice(0, max - 1).trimEnd() + "…";
}

function roundTo(n: number, places: number): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}
