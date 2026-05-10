/**
 * getTaskContext: synthesize a context pack for a coding agent.
 *
 * Pulls relevant decisions, lessons, patterns, and repo/project context for a
 * task. Cites local file paths. Penalizes deprecated/superseded pages (already
 * baked into ranking) and labels them when included.
 *
 * Token-budget defaults: 6000 default, 12000 hard cap. Estimator is
 * intentionally crude — char-count / 4. Real tokenization is v0.3.
 */
import type { ContextPack, SearchResult, PageType, Confidence } from "@mnemonic/schemas";
import type { IndexFile } from "./index-store.js";
import { searchPages } from "./search.js";

export interface TaskContextInput {
  task: string;
  repo?: string;
  project?: string;
  include?: Array<"decisions" | "lessons" | "patterns" | "prompts" | "recent" | "agents" | "meetings">;
  maxTokens?: number;
  now?: Date;
}

const DEFAULT_MAX_TOKENS = 6000;
const HARD_CAP_TOKENS = 12_000;

const DEFAULT_INCLUDE: NonNullable<TaskContextInput["include"]> = [
  "decisions", "lessons", "patterns",
];

const SECTION_TYPES: Record<NonNullable<TaskContextInput["include"]>[number], PageType | "*"> = {
  decisions: "decision",
  lessons: "lesson",
  patterns: "pattern",
  prompts: "prompt",
  agents: "agent",
  meetings: "meeting",
  recent: "*",
};

interface Bucket {
  label: string;
  results: SearchResult[];
}

export function getTaskContext(idx: IndexFile, input: TaskContextInput): ContextPack {
  const max = clamp(input.maxTokens ?? DEFAULT_MAX_TOKENS, 500, HARD_CAP_TOKENS);
  const include = (input.include ?? DEFAULT_INCLUDE ?? []).slice();
  const generatedAt = (input.now ?? new Date()).toISOString();

  // Pull repo/project context first (separate from typed buckets).
  const repoContext: SearchResult[] = [];
  if (input.repo) {
    const r = searchPages(idx, { query: input.repo, type: "repo", repo: input.repo, limit: 1 });
    repoContext.push(...r);
  }
  if (input.project) {
    const r = searchPages(idx, { query: input.project, type: "project", project: input.project, limit: 1 });
    repoContext.push(...r);
  }

  const buckets: Bucket[] = [];
  const bucketLabels: Record<string, string> = {
    decisions: "Relevant Decisions",
    lessons: "Relevant Lessons",
    patterns: "Applicable Patterns",
    prompts: "Relevant Prompts",
    agents: "Agent Notes",
    meetings: "Meeting Notes",
    recent: "Recent",
  };
  for (const key of include) {
    const t = SECTION_TYPES[key];
    const opts: Parameters<typeof searchPages>[1] = { query: input.task, limit: 5 };
    if (t !== "*") opts.type = t as PageType;
    if (input.repo) opts.repo = input.repo;
    if (input.project) opts.project = input.project;
    const results = searchPages(idx, opts);
    buckets.push({ label: bucketLabels[key] ?? key, results });
  }

  // Deduplicate across buckets.
  const seen = new Set<string>();
  for (const b of buckets) {
    b.results = b.results.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
  }

  // Determine total active pages found across buckets+repo for confidence calc.
  const allResults: SearchResult[] = [...repoContext, ...buckets.flatMap((b) => b.results)];
  const activeCount = allResults.filter((r) => r.status === "active").length;
  const confidence: Confidence = activeCount >= 3 ? "high" : activeCount >= 2 ? "medium" : "low";

  const warnings: string[] = [];
  if (allResults.some((r) => r.status === "deprecated" || r.status === "superseded")) {
    warnings.push("Some included pages are deprecated or superseded; they are labeled in the pack.");
  }
  if (confidence === "low") {
    warnings.push(`Confidence is low: only ${activeCount} active relevant page(s) found.`);
  }

  // Render Markdown, truncating buckets if needed to stay under maxTokens.
  let markdown = renderMarkdown({
    task: input.task,
    repo: input.repo,
    project: input.project,
    repoContext,
    buckets,
    confidence,
    warnings,
    generatedAt,
    maxTokens: max,
  });

  // Naive truncation: if over budget, drop lowest-relevance entries from buckets.
  let est = estimateTokens(markdown);
  if (est > max) {
    truncateBuckets(buckets, max, repoContext);
    markdown = renderMarkdown({
      task: input.task,
      repo: input.repo,
      project: input.project,
      repoContext,
      buckets,
      confidence,
      warnings: [...warnings, "Context pack was truncated to fit token budget."],
      generatedAt,
      maxTokens: max,
    });
    est = estimateTokens(markdown);
  }

  const summary = makeSummary(input.task, repoContext, buckets);

  const pack: ContextPack = {
    task: input.task,
    ...(input.repo ? { repo: input.repo } : {}),
    ...(input.project ? { project: input.project } : {}),
    summary,
    confidence,
    warnings,
    pages: allResults,
    contextPackMarkdown: markdown,
    generatedAt,
    maxTokens: max,
  };
  return pack;
}

interface RenderInput {
  task: string;
  repo?: string;
  project?: string;
  repoContext: SearchResult[];
  buckets: Bucket[];
  confidence: Confidence;
  warnings: string[];
  generatedAt: string;
  maxTokens: number;
}

function renderMarkdown(r: RenderInput): string {
  const lines: string[] = [];
  lines.push(`# Task: ${r.task}`);
  lines.push("");
  lines.push("## Context Summary");
  lines.push(makeSummary(r.task, r.repoContext, r.buckets));
  lines.push("");
  lines.push("## Repo / Project Context");
  if (r.repoContext.length === 0) {
    lines.push("- (none)");
  } else {
    for (const p of r.repoContext) {
      lines.push(`- ${labelStatus(p)}[${p.title}](${p.path}) — ${p.excerpt}`);
    }
  }
  lines.push("");

  // Buckets
  for (const b of r.buckets) {
    lines.push(`## ${b.label}`);
    if (!b.results.length) {
      lines.push("- (none)");
    } else {
      for (const p of b.results) {
        lines.push(`- ${labelStatus(p)}[${p.title}](${p.path}) — ${p.excerpt}`);
      }
    }
    lines.push("");
  }

  lines.push("## Known Pitfalls");
  lines.push("- (none captured for this task)");
  lines.push("");
  lines.push("## Files / Pages to Inspect First");
  const inspectList = [
    ...r.repoContext.slice(0, 2).map((p) => p.path),
    ...r.buckets.flatMap((b) => b.results.slice(0, 1)).map((p) => p.path),
  ];
  if (!inspectList.length) {
    lines.push("- (none)");
  } else {
    for (const p of inspectList) lines.push(`- ${p}`);
  }
  lines.push("");
  lines.push("## Open Questions");
  if (r.warnings.length) {
    for (const w of r.warnings) lines.push(`- ${w}`);
  } else {
    lines.push("- (none)");
  }
  lines.push("");
  lines.push("---");
  lines.push(`_Mnemonic context pack v1 · generated ${r.generatedAt} · token budget ${r.maxTokens} · confidence ${r.confidence}_`);
  return lines.join("\n");
}

function labelStatus(p: SearchResult): string {
  if (p.status === "deprecated") return "[deprecated] ";
  if (p.status === "superseded") return "[superseded] ";
  if (p.status === "draft") return "[draft] ";
  return "";
}

function makeSummary(task: string, repoContext: SearchResult[], buckets: Bucket[]): string {
  const counts = buckets.map((b) => `${b.results.length} ${b.label.toLowerCase()}`);
  const parts = [
    `Task: ${task}.`,
    repoContext.length ? `Repo/project context: ${repoContext.length} page(s).` : "No repo/project page found.",
    counts.length ? `Found ${counts.join(", ")}.` : "",
  ].filter(Boolean);
  return parts.join(" ");
}

function estimateTokens(s: string): number {
  // ~4 chars/token heuristic.
  return Math.ceil(s.length / 4);
}

function truncateBuckets(buckets: Bucket[], maxTokens: number, repoContext: SearchResult[]): void {
  // Drop the lowest-relevance entry from the largest bucket repeatedly until we
  // think we'll fit. Crude but predictable.
  let safety = 50;
  while (safety-- > 0) {
    // Approximate current size: count title+excerpt chars.
    const size =
      repoContext.reduce((s, p) => s + p.title.length + p.excerpt.length + p.path.length, 0) +
      buckets.reduce(
        (s, b) => s + b.results.reduce((ss, p) => ss + p.title.length + p.excerpt.length + p.path.length, 0),
        0
      );
    if (size / 4 < maxTokens * 0.85) return;
    let largest: Bucket | null = null;
    for (const b of buckets) {
      if (!largest || b.results.length > largest.results.length) largest = b;
    }
    if (!largest || !largest.results.length) return;
    largest.results.pop();
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Convenience: just the repo context page(s).
 */
export function getRepoContext(idx: IndexFile, repo: string): SearchResult[] {
  return searchPages(idx, { query: repo, type: "repo", repo, limit: 1 });
}
