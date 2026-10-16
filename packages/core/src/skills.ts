/**
 * Skill / resolver / filing-rules loaders.
 *
 * Moved into `core` so apps (CLI, MCP, wiki) consume a single boundary and
 * never need `node:fs`. This is what makes the "no fs outside core" lint
 * rule enforceable without exemptions.
 */
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import {
  SkillFrontmatter, type Skill, type SkillIndexEntry, type ResolverEntry,
} from "@mnemonic/schemas";

/** Locate skills directory inside a vault. */
export function skillsDir(vaultRoot: string): string {
  return path.join(vaultRoot, ".mnemonic", "skills");
}

/** Walk a skills directory and parse every SKILL.md. */
export function loadSkills(skillsRoot: string): { skills: Skill[]; errors: string[] } {
  const errors: string[] = [];
  const skills: Skill[] = [];
  if (!fs.existsSync(skillsRoot)) return { skills, errors: [`Skills directory not found: ${skillsRoot}`] };

  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name === "SKILL.md") {
        try {
          const raw = fs.readFileSync(full, "utf8");
          const { fm, body } = parseSkillFile(raw);
          const validated = SkillFrontmatter.parse(fm);
          skills.push({ frontmatter: validated, body, path: full });
        } catch (err) {
          errors.push(`${full}: ${(err as Error).message}`);
        }
      }
    }
  }
  walk(skillsRoot);
  return { skills, errors };
}

function parseSkillFile(raw: string): { fm: unknown; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!m) throw new Error("Missing frontmatter fence");
  const fm = YAML.parse(m[1] ?? "");
  return { fm, body: raw.slice(m[0].length) };
}

/** Parse RESOLVER.md (markdown table). */
export function loadResolver(skillsRoot: string): { entries: ResolverEntry[]; errors: string[] } {
  const p = path.join(skillsRoot, "RESOLVER.md");
  if (!fs.existsSync(p)) return { entries: [], errors: [`RESOLVER.md not found: ${p}`] };
  const raw = fs.readFileSync(p, "utf8");
  const entries: ResolverEntry[] = [];
  const rows = raw.split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|") && l.endsWith("|"));
  if (rows.length < 2) return { entries: [], errors: ["No table found in RESOLVER.md"] };
  for (let i = 2; i < rows.length; i++) {
    const cols = rows[i]!.slice(1, -1).split("|").map((c) => c.trim());
    if (cols.length < 2) continue;
    const [intent, skillId, notes] = cols;
    if (!intent || !skillId) continue;
    entries.push({
      intentExample: intent,
      skillId: skillId,
      ...(notes ? { notes } : {}),
    });
  }
  return { entries, errors: [] };
}

export function generateSkillIndex(skills: Skill[]): SkillIndexEntry[] {
  return skills
    .filter((s) => s.frontmatter.status === "active")
    .map((s) => ({
      id: s.frontmatter.id,
      name: s.frontmatter.name,
      description: s.frontmatter.description,
      status: s.frontmatter.status,
      risk: s.frontmatter.risk,
      triggers: s.frontmatter.triggers,
    }));
}

export function skillIndexPath(vaultRoot: string): string {
  return path.join(vaultRoot, ".mnemonic", ".skills-index.json");
}

/** Read the generated `.skills-index.json` if present. */
export function loadSkillIndex(vaultRoot: string): SkillIndexEntry[] {
  const p = skillIndexPath(vaultRoot);
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as SkillIndexEntry[];
  } catch {
    return [];
  }
}

/** Write the index back. Used by check-resolvable. */
export function saveSkillIndex(vaultRoot: string, entries: SkillIndexEntry[]): void {
  const p = skillIndexPath(vaultRoot);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(entries, null, 2), "utf8");
}

/** Read a single skill's body+frontmatter from disk. Wiki uses this for `/skills/:id`. */
export function readSkillByPath(vaultRoot: string, skillId: string): { frontmatterYaml: string; body: string } | null {
  const p = path.join(skillsDir(vaultRoot), skillId, "SKILL.md");
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, "utf8");
  const fmMatch = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  return {
    frontmatterYaml: fmMatch ? (fmMatch[1] ?? "") : "",
    body: fmMatch ? raw.slice(fmMatch[0].length) : raw,
  };
}

// ─── check-resolvable structural audit ────────────────────────────────────

export interface ResolverAuditResult {
  errors: string[];
  warnings: string[];
}

export interface CheckResolvableInput {
  skills: Skill[];
  skillLoadErrors: string[];
  resolver: ResolverEntry[];
  resolverLoadErrors: string[];
  filingRulesValid: boolean;
}

export function checkResolvable(opts: CheckResolvableInput): ResolverAuditResult {
  const errors: string[] = [...opts.skillLoadErrors, ...opts.resolverLoadErrors];
  const warnings: string[] = [];

  const ids = new Map<string, number>();
  for (const s of opts.skills.filter((s) => s.frontmatter.status === "active")) {
    ids.set(s.frontmatter.id, (ids.get(s.frontmatter.id) ?? 0) + 1);
  }
  for (const [id, count] of ids) {
    if (count > 1) errors.push(`Duplicate active skill id: ${id} (${count} occurrences)`);
  }

  const skillIds = new Set(opts.skills.map((s) => s.frontmatter.id));
  for (const r of opts.resolver) {
    if (!skillIds.has(r.skillId)) {
      errors.push(`Resolver entry "${r.intentExample}" → ${r.skillId}: skill does not exist`);
    }
  }

  const reachable = new Set(opts.resolver.map((r) => r.skillId));
  const missingToolSteps: string[] = [];
  for (const s of opts.skills) {
    if (s.frontmatter.status === "active" && !reachable.has(s.frontmatter.id)) {
      errors.push(`Active skill ${s.frontmatter.id} is not reachable from RESOLVER.md`);
    }
    if (s.frontmatter.status === "draft" && !reachable.has(s.frontmatter.id)) {
      warnings.push(`Draft skill ${s.frontmatter.id} has no resolver entry (informational)`);
    }
    for (const step of s.frontmatter.steps) {
      if (step.kind === "deterministic" && !step.tool) {
        missingToolSteps.push(`${s.frontmatter.id}: step "${step.id}"`);
      }
    }
  }
  // Rolled up into one line instead of one warning per step: with v0.1's
  // expected baseline of unregistered deterministic steps, printing each
  // occurrence separately drowns out warnings that need attention.
  // See docs/dogfood-log.md P2 #5.
  if (missingToolSteps.length === 1) {
    warnings.push(`${missingToolSteps[0]} is deterministic but has no tool`);
  } else if (missingToolSteps.length > 1) {
    warnings.push(
      `${missingToolSteps.length} deterministic steps without a registered tool (expected in v0.1; see v0.2 enforcement): ${missingToolSteps.join(", ")}`,
    );
  }

  const laneToSkills = new Map<string, string[]>();
  for (const s of opts.skills.filter((s) => s.frontmatter.status === "active")) {
    for (const lane of s.frontmatter.lanes?.covers ?? []) {
      if (!laneToSkills.has(lane)) laneToSkills.set(lane, []);
      laneToSkills.get(lane)!.push(s.frontmatter.id);
    }
  }
  for (const [lane, ids2] of laneToSkills) {
    if (ids2.length > 1) {
      warnings.push(`Lane overlap: "${lane}" is covered by ${ids2.join(", ")}`);
    }
  }

  if (!opts.filingRulesValid) {
    errors.push("Filing rules are invalid or missing");
  }

  return { errors, warnings };
}
