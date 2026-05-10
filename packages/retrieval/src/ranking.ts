/**
 * Ranking formula for v0.1.
 *
 *   score(query, page) =
 *       3.0 * bm25Lite(query, title)
 *     + 2.0 * bm25Lite(query, tags)
 *     + 2.0 * bm25Lite(query, aliases)
 *     + 1.0 * bm25Lite(query, body)
 *     + 0.20 * recencyDecay(updatedAt)
 *     − 0.50 if status === "deprecated"
 *     − 0.70 if status === "superseded"
 *     − 0.30 if confidence === "low"
 *     + 0.30 if repoFilter && page.repo === repoFilter
 *
 * recencyDecay half-life: 90 days.
 */
import type { IndexEntry } from "./index-store.js";
import { tokenize, scoreField } from "./tokenize.js";

export interface RankInput {
  query: string;
  repoFilter?: string;
  now?: Date;
}

const TITLE_W = 3.0;
const TAG_W = 2.0;
const ALIAS_W = 2.0;
const BODY_W = 1.0;
const RECENCY_W = 0.20;
const DEPRECATED_PEN = 0.50;
const SUPERSEDED_PEN = 0.70;
const LOW_CONF_PEN = 0.30;
const REPO_BONUS = 0.30;

const HALF_LIFE_DAYS = 90;
const LN2 = Math.log(2);
const MS_PER_DAY = 86_400_000;

export function recencyDecay(updatedAtIso: string, now = new Date()): number {
  const t = new Date(updatedAtIso).getTime();
  if (Number.isNaN(t)) return 0;
  const days = Math.max(0, (now.getTime() - t) / MS_PER_DAY);
  return Math.exp(-LN2 * (days / HALF_LIFE_DAYS));
}

export function rankEntry(entry: IndexEntry, input: RankInput): number {
  const q = tokenize(input.query);
  if (!q.length) return 0;
  const now = input.now ?? new Date();
  let score = 0;
  score += TITLE_W * scoreField(q, entry.title);
  score += TAG_W * scoreField(q, entry.tags.join(" "));
  score += ALIAS_W * scoreField(q, entry.aliases.join(" "));
  score += BODY_W * scoreField(q, entry.body);
  score += RECENCY_W * recencyDecay(entry.updatedAt, now);
  if (entry.status === "deprecated") score -= DEPRECATED_PEN;
  if (entry.status === "superseded") score -= SUPERSEDED_PEN;
  if (entry.confidence === "low") score -= LOW_CONF_PEN;
  if (input.repoFilter && entry.repo === input.repoFilter) score += REPO_BONUS;
  return score;
}
