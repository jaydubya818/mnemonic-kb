/**
 * Tiny tokenizer + BM25-lite scorer for v0.1.
 *
 * No stemmer, no fancy ranking — just enough to make small vaults searchable.
 * SQLite FTS5 / vector embeddings replace this in v0.3.
 */
const STOP = new Set([
  "the","a","an","and","or","but","of","to","in","on","at","for","with",
  "is","are","was","were","be","been","being",
  "i","you","he","she","it","we","they",
  "this","that","these","those",
  "as","by","from","into","over","under",
]);

export function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

/**
 * Very small BM25-style score for one query against one document field.
 * Treats each unique query term independently and rewards matches with low
 * doc-frequency boosts (we approximate by just counting occurrences).
 */
export function scoreField(queryTerms: string[], docText: string): number {
  if (!queryTerms.length) return 0;
  const docTerms = tokenize(docText);
  if (!docTerms.length) return 0;
  let score = 0;
  const docLen = docTerms.length;
  // Precompute frequencies.
  const freq = new Map<string, number>();
  for (const t of docTerms) freq.set(t, (freq.get(t) ?? 0) + 1);
  const k1 = 1.2;
  const b = 0.75;
  const avgLen = 30; // assumed average; tunable
  for (const q of queryTerms) {
    const f = freq.get(q) ?? 0;
    if (!f) continue;
    const norm = (f * (k1 + 1)) / (f + k1 * (1 - b + b * (docLen / avgLen)));
    score += norm;
  }
  return score;
}
