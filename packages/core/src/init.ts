/**
 * `mnemonic init` core logic — moved into core so apps don't import `fs`.
 *
 * Copies vault skeleton + skills templates + filing rules + config into the
 * target vault directory. Refuses non-empty target unless force=true.
 */
import fs from "node:fs";
import path from "node:path";

export interface InitOpts {
  target: string;
  templatesRoot: string;
  force?: boolean;
}

export interface InitResult {
  target: string;
  skillsTemplatesCopied: boolean;
  filingRulesCopied: boolean;
  configWritten: boolean;
}

export class InitError extends Error {
  override name = "InitError";
}

export function initVault(opts: InitOpts): InitResult {
  const { target, templatesRoot, force = false } = opts;

  if (fs.existsSync(target)) {
    const entries = fs.readdirSync(target).filter((e) => !e.startsWith("."));
    if (entries.length > 0 && !force) {
      throw new InitError(
        `Refusing to init: ${target} is non-empty. Pass --force to overwrite skills templates only.`
      );
    }
  } else {
    fs.mkdirSync(target, { recursive: true });
  }

  // Vault skeleton.
  copyTree(path.join(templatesRoot, "vault"), target, { skipExisting: true });

  // Skills templates → .mnemonic/skills/
  fs.mkdirSync(path.join(target, ".mnemonic"), { recursive: true });
  copyTree(
    path.join(templatesRoot, "skills"),
    path.join(target, ".mnemonic", "skills"),
    { skipExisting: !force }
  );

  // Filing rules → .mnemonic/_filing-rules.md
  let filingRulesCopied = false;
  const filingSrc = path.join(templatesRoot, "skills", "_filing-rules.md");
  if (fs.existsSync(filingSrc)) {
    fs.copyFileSync(filingSrc, path.join(target, ".mnemonic", "_filing-rules.md"));
    filingRulesCopied = true;
  }

  // Default config.
  const cfgPath = path.join(target, ".mnemonic", "config.yaml");
  let configWritten = false;
  if (!fs.existsSync(cfgPath) || force) {
    fs.writeFileSync(cfgPath, `vaultRoot: ${target}\nschemaVersion: 1\n`, "utf8");
    configWritten = true;
  }

  return {
    target,
    skillsTemplatesCopied: true,
    filingRulesCopied,
    configWritten,
  };
}

/**
 * Locate the templates directory. CLI is installed under `apps/cli`; templates
 * live at `<repo>/templates`. Walks up from `startFrom` (or this module's path)
 * until it finds a `templates/vault` sibling.
 */
export function resolveTemplatesRoot(startFrom?: string): string {
  const here = startFrom ?? path.dirname(new URL(import.meta.url).pathname);
  let dir = here;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, "templates", "vault"))) return path.join(dir, "templates");
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  if (fs.existsSync(path.join(process.cwd(), "templates", "vault"))) {
    return path.join(process.cwd(), "templates");
  }
  throw new InitError("Could not locate templates/. Reinstall mnemonic-kb or pass a templatesRoot explicitly.");
}

function copyTree(src: string, dst: string, opts: { skipExisting?: boolean } = {}): void {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyTree(s, d, opts);
    } else if (entry.isFile()) {
      if (opts.skipExisting && fs.existsSync(d)) continue;
      fs.copyFileSync(s, d);
    }
  }
}
