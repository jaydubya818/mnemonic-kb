/**
 * Skill / resolver / doctor CLI commands.
 *
 * All filesystem work happens in `@mnemonic/core` (`packages/core/src/skills.ts`).
 * This file is a thin CLI wrapper.
 */
import YAML from "yaml";
import {
  defaultContext, loadVaultConfig, autoDetectVault, defaultFilingRulesPath, loadFilingRules,
  loadSkills, loadResolver, generateSkillIndex, checkResolvable, saveSkillIndex, skillsDir,
} from "@mnemonic/core";
import { buildIndex, saveIndex } from "@mnemonic/retrieval";
import { CliError, EXIT } from "./exit-codes.js";
import { getFlagString, type ParsedArgs } from "./args.js";

// Re-export for any downstream consumer (e.g., MCP handlers used to import these from here).
export { loadSkills, loadResolver, generateSkillIndex, checkResolvable } from "@mnemonic/core";

function ctxFromArgs(args: ParsedArgs) {
  const explicit = getFlagString(args.flags, "vault");
  const vaultRoot = explicit ?? autoDetectVault();
  const cfg = loadVaultConfig(vaultRoot);
  return { ...defaultContext(vaultRoot, cfg), vaultRoot };
}

export async function cmdSkillsList(args: ParsedArgs): Promise<number> {
  const ctx = ctxFromArgs(args);
  const { skills, errors } = loadSkills(skillsDir(ctx.vaultRoot));
  if (errors.length) {
    for (const e of errors) console.error(`  warning: ${e}`);
  }
  const status = getFlagString(args.flags, "status");
  const filtered = status ? skills.filter((s) => s.frontmatter.status === status) : skills;
  if (!filtered.length) { console.log("(no skills)"); return EXIT.OK; }
  for (const s of filtered) {
    const tag = s.frontmatter.status === "active" ? "" : ` [${s.frontmatter.status}]`;
    console.log(`${s.frontmatter.id.padEnd(35)} risk=${s.frontmatter.risk}${tag}`);
    console.log(`  ${s.frontmatter.description}`);
  }
  return EXIT.OK;
}

export async function cmdSkillsInspect(args: ParsedArgs): Promise<number> {
  const id = args.positional[0];
  if (!id) throw new CliError(EXIT.USER_ERROR, `Usage: mnemonic skills inspect <skillId>`);
  const ctx = ctxFromArgs(args);
  const { skills } = loadSkills(skillsDir(ctx.vaultRoot));
  const s = skills.find((x) => x.frontmatter.id === id);
  if (!s) throw new CliError(EXIT.NOT_FOUND, `Skill not found: ${id}`);
  console.log(`# ${s.frontmatter.name}`);
  console.log(`(id: ${s.frontmatter.id}, status: ${s.frontmatter.status}, risk: ${s.frontmatter.risk})`);
  console.log();
  console.log("## Frontmatter");
  console.log(YAML.stringify(s.frontmatter, { lineWidth: 0 }).trimEnd());
  console.log();
  console.log("## Body");
  console.log(s.body.trim());
  return EXIT.OK;
}

export async function cmdCheckResolvable(args: ParsedArgs): Promise<number> {
  const ctx = ctxFromArgs(args);
  const root = skillsDir(ctx.vaultRoot);
  const { skills, errors: skillLoadErrors } = loadSkills(root);
  const { entries: resolver, errors: resolverLoadErrors } = loadResolver(root);

  let filingRulesValid = false;
  try {
    loadFilingRules(defaultFilingRulesPath(ctx.vaultRoot));
    filingRulesValid = true;
  } catch {
    filingRulesValid = false;
  }

  const audit = checkResolvable({
    skills, skillLoadErrors, resolver, resolverLoadErrors, filingRulesValid,
  });

  for (const e of audit.errors) console.error(`error: ${e}`);
  for (const w of audit.warnings) console.error(`warn:  ${w}`);

  const indexEntries = generateSkillIndex(skills);
  saveSkillIndex(ctx.vaultRoot, indexEntries);

  if (audit.errors.length) return EXIT.CHECK_RESOLVABLE_FAIL;
  console.log(`OK — ${skills.length} skills, ${resolver.length} resolver entries, .skills-index.json (${indexEntries.length} active) generated.`);
  return EXIT.OK;
}

export async function cmdDoctor(args: ParsedArgs): Promise<number> {
  const ctx = ctxFromArgs(args);
  const verbose = args.flags["verbose"] === true;

  const idx = buildIndex(ctx.vaultRoot);
  saveIndex(ctx.vaultRoot, idx);
  if (verbose) console.log(`schema-validate: indexed ${idx.entries.length} pages`);

  const code = await cmdCheckResolvable(args);
  if (code !== EXIT.OK) return code;

  console.log(`doctor: OK (${idx.entries.length} pages indexed)`);
  return EXIT.OK;
}
