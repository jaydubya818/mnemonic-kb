/**
 * MCP tool handlers — share the SAME core/retrieval logic the CLI uses.
 *
 * Each handler returns structured JSON. When display text is useful, a
 * `markdown` field is also returned. Local file paths are absolute.
 */
import path from "node:path";
import {
  defaultContext, loadVaultConfig, autoDetectVault,
  loadFilingRules, defaultFilingRulesPath, buildLookup,
  buildInboxNote, createVaultWriter,
  listInbox, listProposals, readPage, getRecentPages,
  loadSkills, loadResolver, generateSkillIndex, checkResolvable, skillsDir,
  type VaultContext,
} from "@mnemonic/core";
import {
  loadOrBuildIndex, buildIndex, saveIndex, searchPages, getTaskContext, getRepoContext,
} from "@mnemonic/retrieval";
import type { PageType } from "@mnemonic/schemas";

function resolveCtx(): VaultContext {
  const root = autoDetectVault();
  const cfg = loadVaultConfig(root);
  return { ...defaultContext(root, cfg), vaultRoot: root };
}

function rebuildIndex(vaultRoot: string): void {
  const idx = buildIndex(vaultRoot);
  saveIndex(vaultRoot, idx);
}

// ─── Read tools ────────────────────────────────────────────────────────────

export interface SearchInput {
  query: string;
  type?: PageType;
  repo?: string;
  limit?: number;
}

export function search(input: SearchInput) {
  const ctx = resolveCtx();
  const idx = loadOrBuildIndex(ctx.vaultRoot);
  const opts: Parameters<typeof searchPages>[1] = { query: input.query, limit: input.limit ?? 10 };
  if (input.type) opts.type = input.type;
  if (input.repo) opts.repo = input.repo;
  const results = searchPages(idx, opts);
  return { results: results.map((r) => ({ ...r, path: path.resolve(ctx.vaultRoot, r.path) })) };
}

export function readPageTool(input: { idOrPath: string }) {
  const ctx = resolveCtx();
  const { path: p, page } = readPage(ctx.vaultRoot, input.idOrPath);
  return { path: p, frontmatter: page.frontmatter, body: page.body };
}

export function listRecent(input: { limit?: number; type?: PageType }) {
  const ctx = resolveCtx();
  const items = getRecentPages(ctx.vaultRoot, input.limit ?? 20, input.type);
  return {
    pages: items.map(({ path: p, page }) => ({
      id: page.frontmatter.id,
      title: page.frontmatter.title,
      type: page.frontmatter.type,
      status: page.frontmatter.status,
      updatedAt: page.frontmatter.updatedAt,
      path: p,
    })),
  };
}

export function getRepoContextTool(input: { repo: string; maxTokens?: number }) {
  const ctx = resolveCtx();
  const idx = loadOrBuildIndex(ctx.vaultRoot);
  const results = getRepoContext(idx, input.repo);
  return { results: results.map((r) => ({ ...r, path: path.resolve(ctx.vaultRoot, r.path) })) };
}

export function getTaskContextTool(input: {
  task: string; repo?: string; project?: string;
  include?: string[]; maxTokens?: number;
}) {
  const ctx = resolveCtx();
  const idx = loadOrBuildIndex(ctx.vaultRoot);
  const opts: Parameters<typeof getTaskContext>[1] = { task: input.task };
  if (input.repo) opts.repo = input.repo;
  if (input.project) opts.project = input.project;
  if (input.include) opts.include = input.include as Parameters<typeof getTaskContext>[1]["include"];
  if (input.maxTokens) opts.maxTokens = input.maxTokens;
  const pack = getTaskContext(idx, opts);
  // Absolute paths in citations.
  return {
    ...pack,
    pages: pack.pages.map((p) => ({ ...p, path: path.resolve(ctx.vaultRoot, p.path) })),
    markdown: pack.contextPackMarkdown,
  };
}

export function listSkillsTool(input: { status?: "active" | "draft" }) {
  const ctx = resolveCtx();
  const skillsRoot = skillsDir(ctx.vaultRoot);
  const { skills } = loadSkills(skillsRoot);
  const idx = generateSkillIndex(skills);
  const filtered = input.status ? idx.filter((s) => s.status === input.status) : idx;
  return { skills: filtered };
}

export function inspectSkillTool(input: { id: string }) {
  const ctx = resolveCtx();
  const skillsRoot = skillsDir(ctx.vaultRoot);
  const { skills } = loadSkills(skillsRoot);
  const s = skills.find((x) => x.frontmatter.id === input.id);
  if (!s) throw new Error(`Skill not found: ${input.id}`);
  return { skill: s };
}

export function checkResolvableTool() {
  const ctx = resolveCtx();
  const skillsRoot = skillsDir(ctx.vaultRoot);
  const { skills, errors: skillLoadErrors } = loadSkills(skillsRoot);
  const { entries: resolver, errors: resolverLoadErrors } = loadResolver(skillsRoot);
  let filingRulesValid = false;
  try { loadFilingRules(defaultFilingRulesPath(ctx.vaultRoot)); filingRulesValid = true; }
  catch { filingRulesValid = false; }
  const audit = checkResolvable({ skills, skillLoadErrors, resolver, resolverLoadErrors, filingRulesValid });
  return { errors: audit.errors, warnings: audit.warnings, ok: audit.errors.length === 0 };
}

// ─── Write tools ───────────────────────────────────────────────────────────

export function rememberTool(input: {
  content: string; tags?: string[]; repo?: string; project?: string;
}) {
  const ctx = resolveCtx();
  const rules = loadFilingRules(defaultFilingRulesPath(ctx.vaultRoot));
  const writer = createVaultWriter({ ctx, rules, lookup: buildLookup(ctx.vaultRoot) });
  const note = buildInboxNote(ctx, {
    content: input.content,
    tags: input.tags ?? [],
    ...(input.repo ? { repo: input.repo } : {}),
    ...(input.project ? { project: input.project } : {}),
    capturedBy: "mcp",
  });
  return writer.writeInbox(note).then((res) => {
    rebuildIndex(ctx.vaultRoot);
    return { pageId: res.id, path: res.path };
  });
}

export function proposeMemoryTool(input: {
  content: string; reason: string; type?: PageType; repo?: string; project?: string;
}) {
  const ctx = resolveCtx();
  const rules = loadFilingRules(defaultFilingRulesPath(ctx.vaultRoot));
  const writer = createVaultWriter({ ctx, rules, lookup: buildLookup(ctx.vaultRoot) });
  return writer.createProposal({
    proposedBy: "mcp",
    reason: input.reason,
    content: input.content,
    typeHint: input.type ?? "lesson",
    ...(input.repo ? { repo: input.repo } : {}),
    ...(input.project ? { project: input.project } : {}),
  }).then((res) => {
    rebuildIndex(ctx.vaultRoot);
    return { proposalId: res.id, path: res.path };
  });
}

export function promoteMemoryTool(input: { proposalId: string }) {
  const ctx = resolveCtx();
  const rules = loadFilingRules(defaultFilingRulesPath(ctx.vaultRoot));
  const writer = createVaultWriter({ ctx, rules, lookup: buildLookup(ctx.vaultRoot) });
  return writer.promote(input.proposalId).then((r) => {
    rebuildIndex(ctx.vaultRoot);
    return { targetPath: r.targetPath, appendedTimeline: r.appendedTimeline };
  });
}

// create_decision/lesson/pattern → all create proposals in v0.1.
export function createDecisionTool(input: {
  title: string; context: string; decision: string; consequences?: string;
  repo?: string; project?: string;
}) {
  const content = renderDecisionContent(input);
  return proposeMemoryTool({
    content,
    reason: `Proposed decision: ${input.title}`,
    type: "decision",
    ...(input.repo ? { repo: input.repo } : {}),
    ...(input.project ? { project: input.project } : {}),
  });
}

export function createLessonTool(input: {
  title: string; lesson: string; repo?: string; project?: string;
}) {
  const content = `# ${input.title}\n\n${input.lesson}`;
  return proposeMemoryTool({
    content,
    reason: `Proposed lesson: ${input.title}`,
    type: "lesson",
    ...(input.repo ? { repo: input.repo } : {}),
    ...(input.project ? { project: input.project } : {}),
  });
}

export function createPatternTool(input: {
  title: string; pattern: string; whenToUse?: string; repo?: string; project?: string;
}) {
  const content = renderPatternContent(input);
  return proposeMemoryTool({
    content,
    reason: `Proposed pattern: ${input.title}`,
    type: "pattern",
    ...(input.repo ? { repo: input.repo } : {}),
    ...(input.project ? { project: input.project } : {}),
  });
}

function renderDecisionContent(i: { title: string; context: string; decision: string; consequences?: string }): string {
  const parts = [
    `# ${i.title}`,
    "",
    "## Context",
    i.context,
    "",
    "## Decision",
    i.decision,
  ];
  if (i.consequences) {
    parts.push("", "## Consequences", i.consequences);
  }
  return parts.join("\n");
}

function renderPatternContent(i: { title: string; pattern: string; whenToUse?: string }): string {
  const parts = [
    `# ${i.title}`,
    "",
    "## Pattern",
    i.pattern,
  ];
  if (i.whenToUse) {
    parts.push("", "## When to Use", i.whenToUse);
  }
  return parts.join("\n");
}
