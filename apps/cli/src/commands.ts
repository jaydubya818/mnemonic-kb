/**
 * Command implementations. Each command takes a parsed-args object and a
 * resolved VaultContext (where applicable), prints to stdout, and returns
 * an exit code.
 *
 * Commands that mutate go through vaultWriter — never raw fs.
 */
import path from "node:path";
import {
  defaultContext, loadVaultConfig, autoDetectVault,
  loadFilingRules, defaultFilingRulesPath, buildLookup,
  buildInboxNote, createVaultWriter,
  listInbox, listProposals, readPage, getRecentPages,
  initVault, resolveTemplatesRoot,
  type VaultContext,
} from "@mnemonic/core";
import {
  buildIndex, saveIndex, loadOrBuildIndex, searchPages, getTaskContext, getRepoContext,
} from "@mnemonic/retrieval";
import type { PageType } from "@mnemonic/schemas";
import { CliError, EXIT } from "./exit-codes.js";
import { getFlagArray, getFlagBool, getFlagNumber, getFlagString, type ParsedArgs } from "./args.js";

// ─── helpers ──────────────────────────────────────────────────────────────

function resolveCtx(args: ParsedArgs): VaultContext {
  const explicit = getFlagString(args.flags, "vault");
  const vaultRoot = explicit ?? autoDetectVault();
  const cfg = loadVaultConfig(vaultRoot);
  return { ...defaultContext(vaultRoot, cfg), vaultRoot };
}

function rebuildAndSaveIndex(vaultRoot: string): void {
  const idx = buildIndex(vaultRoot);
  saveIndex(vaultRoot, idx);
}

function ok(msg: string): number { console.log(msg); return EXIT.OK; }

// ─── init ──────────────────────────────────────────────────────────────────

export async function cmdInit(args: ParsedArgs): Promise<number> {
  const target = getFlagString(args.flags, "vault") ?? path.join(process.env.HOME ?? "/", "mnemonic-vault");
  const force = getFlagBool(args.flags, "force");
  try {
    initVault({ target, templatesRoot: resolveTemplatesRoot(), force });
  } catch (err) {
    if ((err as Error).name === "InitError") {
      throw new CliError(EXIT.USER_ERROR, (err as Error).message);
    }
    throw err;
  }
  rebuildAndSaveIndex(target);
  return ok(`Initialized vault at ${target}\n  - skills templates copied to .mnemonic/skills/\n  - filing rules at .mnemonic/_filing-rules.md\n  - config at .mnemonic/config.yaml\n  - index at .mnemonic/index.json`);
}

// ─── remember ──────────────────────────────────────────────────────────────

export async function cmdRemember(args: ParsedArgs): Promise<number> {
  const content = args.positional[0];
  if (!content) throw new CliError(EXIT.USER_ERROR, `Usage: mnemonic remember "<content>"`);
  const ctx = resolveCtx(args);
  const rules = loadFilingRules(defaultFilingRulesPath(ctx.vaultRoot));
  const writer = createVaultWriter({ ctx, rules, lookup: buildLookup(ctx.vaultRoot) });
  const note = buildInboxNote(ctx, {
    content,
    tags: getFlagArray(args.flags, "tag"),
    repo: getFlagString(args.flags, "repo"),
    project: getFlagString(args.flags, "project"),
    capturedBy: "cli",
  });
  const { id, path: p } = await writer.writeInbox(note);
  rebuildAndSaveIndex(ctx.vaultRoot);
  return ok(`Captured to inbox: ${id}\n  ${p}`);
}

// ─── search ────────────────────────────────────────────────────────────────

export async function cmdSearch(args: ParsedArgs): Promise<number> {
  const q = args.positional[0];
  if (!q) throw new CliError(EXIT.USER_ERROR, `Usage: mnemonic search "<query>"`);
  const ctx = resolveCtx(args);
  const idx = loadOrBuildIndex(ctx.vaultRoot);
  const results = searchPages(idx, {
    query: q,
    type: getFlagString(args.flags, "type") as PageType | undefined,
    repo: getFlagString(args.flags, "repo"),
    limit: getFlagNumber(args.flags, "limit") ?? 10,
  });
  if (!results.length) return ok("(no matches)");
  for (const r of results) {
    const status = r.status === "active" ? "" : ` [${r.status}]`;
    console.log(`${r.relevance.toFixed(3)}  ${r.type.padEnd(8)} ${r.title}${status}`);
    console.log(`         ${r.path}`);
    console.log(`         ${r.excerpt}`);
    console.log();
  }
  return EXIT.OK;
}

// ─── read ──────────────────────────────────────────────────────────────────

export async function cmdRead(args: ParsedArgs): Promise<number> {
  const idOrPath = args.positional[0];
  if (!idOrPath) throw new CliError(EXIT.USER_ERROR, `Usage: mnemonic read <idOrPath>`);
  const ctx = resolveCtx(args);
  try {
    const { path: p, page } = readPage(ctx.vaultRoot, idOrPath);
    const fmt = getFlagString(args.flags, "format") ?? "md";
    if (fmt === "json") {
      console.log(JSON.stringify({ path: p, ...page }, null, 2));
    } else {
      console.log(`# ${page.frontmatter.title}`);
      console.log(`(id: ${page.frontmatter.id}, type: ${page.frontmatter.type}, status: ${page.frontmatter.status})`);
      console.log(`(${p})`);
      console.log();
      console.log(page.body.trim());
    }
    return EXIT.OK;
  } catch {
    throw new CliError(EXIT.NOT_FOUND, `Page not found: ${idOrPath}`);
  }
}

// ─── recent ────────────────────────────────────────────────────────────────

export async function cmdRecent(args: ParsedArgs): Promise<number> {
  const ctx = resolveCtx(args);
  const limit = getFlagNumber(args.flags, "limit") ?? 20;
  const type = getFlagString(args.flags, "type") as PageType | undefined;
  const results = getRecentPages(ctx.vaultRoot, limit, type);
  if (!results.length) return ok("(no pages)");
  for (const { page, path: p } of results) {
    console.log(`${page.frontmatter.updatedAt.slice(0, 10)}  ${page.frontmatter.type.padEnd(8)} ${page.frontmatter.title}`);
    console.log(`             ${p}`);
  }
  return EXIT.OK;
}

// ─── context ───────────────────────────────────────────────────────────────

export async function cmdContext(args: ParsedArgs): Promise<number> {
  const task = getFlagString(args.flags, "task");
  if (!task) throw new CliError(EXIT.USER_ERROR, `Usage: mnemonic context --task "<task>" [--repo <r>]`);
  const ctx = resolveCtx(args);
  const idx = loadOrBuildIndex(ctx.vaultRoot);
  const input: Parameters<typeof getTaskContext>[1] = { task };
  const repo = getFlagString(args.flags, "repo");
  const project = getFlagString(args.flags, "project");
  const maxTokens = getFlagNumber(args.flags, "max-tokens");
  if (repo) input.repo = repo;
  if (project) input.project = project;
  if (maxTokens) input.maxTokens = maxTokens;
  const pack = getTaskContext(idx, input);
  console.log(pack.contextPackMarkdown);
  return EXIT.OK;
}

// ─── repo-context ─────────────────────────────────────────────────────────

export async function cmdRepoContext(args: ParsedArgs): Promise<number> {
  const repo = args.positional[0];
  if (!repo) throw new CliError(EXIT.USER_ERROR, `Usage: mnemonic repo-context <repo>`);
  const ctx = resolveCtx(args);
  const idx = loadOrBuildIndex(ctx.vaultRoot);
  const results = getRepoContext(idx, repo);
  if (!results.length) return ok(`(no repo page found for ${repo})`);
  for (const r of results) {
    console.log(`# ${r.title}`);
    console.log(`  ${r.path}`);
    console.log(`  ${r.excerpt}`);
  }
  return EXIT.OK;
}

// ─── inbox ─────────────────────────────────────────────────────────────────

export async function cmdInbox(args: ParsedArgs): Promise<number> {
  const ctx = resolveCtx(args);
  const sub = args.positional[0];
  if (!sub) {
    const notes = listInbox(ctx.vaultRoot);
    if (!notes.length) return ok("(inbox is empty)");
    for (const { page, path: p } of notes) {
      console.log(`${page.frontmatter.updatedAt.slice(0, 10)}  ${page.frontmatter.id}  ${page.frontmatter.title}`);
      console.log(`             ${p}`);
    }
    return EXIT.OK;
  }
  if (sub === "show") {
    const id = args.positional[1];
    if (!id) throw new CliError(EXIT.USER_ERROR, `Usage: mnemonic inbox show <id>`);
    const { path: p, page } = readPage(ctx.vaultRoot, id);
    console.log(`# ${page.frontmatter.title}`);
    console.log(`(${p})`);
    console.log(page.body.trim());
    return EXIT.OK;
  }
  if (sub === "promote") {
    const id = args.positional[1];
    if (!id) throw new CliError(EXIT.USER_ERROR, `Usage: mnemonic inbox promote <id> [--reason "..."]`);
    const reason = getFlagString(args.flags, "reason") ?? "(promoted from inbox without explicit reason)";
    const { page } = readPage(ctx.vaultRoot, id);
    if (page.frontmatter.type !== "note") {
      throw new CliError(EXIT.USER_ERROR, `Page ${id} is not an inbox note`);
    }
    const rules = loadFilingRules(defaultFilingRulesPath(ctx.vaultRoot));
    const writer = createVaultWriter({ ctx, rules, lookup: buildLookup(ctx.vaultRoot) });
    const captured = extractCaptured(page.body);
    const { id: propId, path: pp } = await writer.createProposal({
      proposedBy: "cli",
      reason,
      content: captured,
      typeHint: "lesson",
      ...(page.frontmatter.repo ? { repo: page.frontmatter.repo } : {}),
      ...(page.frontmatter.project ? { project: page.frontmatter.project } : {}),
    });
    rebuildAndSaveIndex(ctx.vaultRoot);
    return ok(`Created proposal ${propId}\n  ${pp}\n  Run \`mnemonic promote ${propId}\` to canonicalize.`);
  }
  if (sub === "archive") {
    const id = args.positional[1];
    if (!id) throw new CliError(EXIT.USER_ERROR, `Usage: mnemonic inbox archive <id>`);
    const rules = loadFilingRules(defaultFilingRulesPath(ctx.vaultRoot));
    const writer = createVaultWriter({ ctx, rules, lookup: buildLookup(ctx.vaultRoot) });
    await writer.setStatus(id, "deprecated", "archived from inbox");
    rebuildAndSaveIndex(ctx.vaultRoot);
    return ok(`Archived ${id} (status=deprecated)`);
  }
  throw new CliError(EXIT.USER_ERROR, `Unknown inbox subcommand: ${sub}`);
}

function extractCaptured(body: string): string {
  const m = /^#\s+Captured\s*\n+([\s\S]*?)(?:\n+#\s+Hints|$)/.exec(body);
  return (m ? m[1] : body).trim();
}

// ─── propose / promote / reject ───────────────────────────────────────────

export async function cmdPropose(args: ParsedArgs): Promise<number> {
  const content = args.positional[0];
  if (!content) throw new CliError(EXIT.USER_ERROR, `Usage: mnemonic propose "<content>" --reason "<r>"`);
  const reason = getFlagString(args.flags, "reason");
  if (!reason) throw new CliError(EXIT.USER_ERROR, `--reason is required`);
  const ctx = resolveCtx(args);
  const rules = loadFilingRules(defaultFilingRulesPath(ctx.vaultRoot));
  const writer = createVaultWriter({ ctx, rules, lookup: buildLookup(ctx.vaultRoot) });
  const repo = getFlagString(args.flags, "repo");
  const project = getFlagString(args.flags, "project");
  const typeHint = (getFlagString(args.flags, "type") ?? "lesson") as PageType;
  const { id, path: p } = await writer.createProposal({
    proposedBy: "cli",
    reason,
    content,
    typeHint,
    ...(repo ? { repo } : {}),
    ...(project ? { project } : {}),
  });
  rebuildAndSaveIndex(ctx.vaultRoot);
  return ok(`Created proposal ${id}\n  ${p}`);
}

export async function cmdPromote(args: ParsedArgs): Promise<number> {
  const id = args.positional[0];
  if (!id) throw new CliError(EXIT.USER_ERROR, `Usage: mnemonic promote <proposalId>`);
  const ctx = resolveCtx(args);
  const rules = loadFilingRules(defaultFilingRulesPath(ctx.vaultRoot));
  const writer = createVaultWriter({ ctx, rules, lookup: buildLookup(ctx.vaultRoot) });
  const result = await writer.promote(id);
  rebuildAndSaveIndex(ctx.vaultRoot);
  return ok(`Promoted ${id}\n  target: ${result.targetPath}\n  appendedTimeline: ${result.appendedTimeline}`);
}

export async function cmdReject(args: ParsedArgs): Promise<number> {
  const id = args.positional[0];
  const reason = getFlagString(args.flags, "reason");
  if (!id || !reason) throw new CliError(EXIT.USER_ERROR, `Usage: mnemonic reject <proposalId> --reason "<r>"`);
  const ctx = resolveCtx(args);
  const rules = loadFilingRules(defaultFilingRulesPath(ctx.vaultRoot));
  const writer = createVaultWriter({ ctx, rules, lookup: buildLookup(ctx.vaultRoot) });
  await writer.reject(id, reason);
  return ok(`Rejected proposal ${id}`);
}

export async function cmdProposals(args: ParsedArgs): Promise<number> {
  const ctx = resolveCtx(args);
  const status = getFlagString(args.flags, "status") as "open" | "promoted" | "rejected" | undefined;
  const items = listProposals(ctx.vaultRoot, status);
  if (!items.length) return ok("(no proposals)");
  for (const it of items) {
    console.log(`${it.status.padEnd(9)} ${it.id}  ${it.reason}`);
    console.log(`          ${it.path}`);
  }
  return EXIT.OK;
}
