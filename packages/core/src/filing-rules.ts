/**
 * Filing rules engine.
 *
 * Rules live in `<skills>/_filing-rules.md` inside a fenced ```yaml block.
 * Prose is documentation; YAML is the input. One source of truth.
 *
 * resolveVaultPath(page) walks rules top-to-bottom; first match wins.
 */
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { FilingRule, FilingRulesFile, Page, PageFrontmatter } from "@mnemonic/schemas";

const YAML_FENCE = /```ya?ml\s*([\s\S]*?)\s*```/;

export function loadFilingRules(filingRulesPath: string): FilingRule[] {
  if (!fs.existsSync(filingRulesPath)) {
    throw new FilingRulesError(`Filing rules not found: ${filingRulesPath}`);
  }
  const raw = fs.readFileSync(filingRulesPath, "utf8");
  const m = YAML_FENCE.exec(raw);
  if (!m) {
    throw new FilingRulesError(
      `No YAML block found in ${filingRulesPath}. Expected a fenced \`\`\`yaml block.`
    );
  }
  const yamlBlock = m[1] ?? "";
  let parsed: unknown;
  try {
    parsed = YAML.parse(yamlBlock);
  } catch (err) {
    throw new FilingRulesError(`YAML parse failed: ${(err as Error).message}`);
  }
  const file = FilingRulesFile.parse(parsed);
  return file.rules;
}

export interface ResolveInput {
  type: PageFrontmatter["type"];
  id: string;
  repo?: string;
  project?: string;
}

/**
 * Resolve a vault-relative path for the given page metadata.
 * Throws if no rule matches (signals a schema bug).
 */
export function resolveVaultPath(rules: FilingRule[], input: ResolveInput): string {
  for (const rule of rules) {
    const m = rule.match;
    if (m.type && m.type !== input.type) continue;
    if (m.hasRepo === true && !input.repo) continue;
    if (m.hasRepo === false && input.repo) continue;
    if (m.hasProject === true && !input.project) continue;
    if (m.hasProject === false && input.project) continue;
    return interpolate(rule.target, input);
  }
  throw new FilingRulesError(
    `No filing rule matched: type=${input.type} repo=${input.repo ?? "—"} project=${input.project ?? "—"}`
  );
}

function interpolate(template: string, input: ResolveInput): string {
  return template
    .replace(/\{id\}/g, input.id)
    .replace(/\{repo\}/g, input.repo ?? "")
    .replace(/\{project\}/g, input.project ?? "");
}

/**
 * Validate that a resolved path is inside vaultRoot. Defends against path
 * traversal in crafted IDs or rule templates.
 */
export function assertPathInsideVault(vaultRoot: string, resolvedRelPath: string): string {
  const abs = path.resolve(vaultRoot, resolvedRelPath);
  const rootAbs = path.resolve(vaultRoot);
  const rel = path.relative(rootAbs, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new FilingRulesError(`Resolved path escapes vault: ${resolvedRelPath}`);
  }
  return abs;
}

export class FilingRulesError extends Error {
  override name = "FilingRulesError";
}

/**
 * Convenience: derive the filing-rules path inside a vault.
 * v0.1: filing rules live in `<vault>/.mnemonic/_filing-rules.md` (copied
 * from the skills templates at `mnemonic init`).
 */
export function defaultFilingRulesPath(vaultRoot: string): string {
  return path.join(vaultRoot, ".mnemonic", "_filing-rules.md");
}

/**
 * Helper: filing rules for a Page (extracts the ResolveInput).
 */
export function resolveForPage(rules: FilingRule[], page: Page): string {
  return resolveVaultPath(rules, {
    type: page.frontmatter.type,
    id: page.frontmatter.id,
    repo: page.frontmatter.repo,
    project: page.frontmatter.project,
  });
}
