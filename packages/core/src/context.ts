/**
 * VaultContext — injected runtime dependencies.
 *
 * Tests pin `now` and `randomId` so behavior is deterministic. Production
 * uses real wall-clock time and ULIDs.
 */
import { ulid } from "ulid";
import path from "node:path";
import fs from "node:fs";
import YAML from "yaml";

export interface VaultConfig {
  vaultRoot: string;
  schemaVersion: 1;
  git?: { autoCommit?: boolean; signOff?: boolean; messagePrefix?: string };
  // Reserved for v0.2/v0.3.
  experiments?: Record<string, boolean>;
}

export interface VaultContext {
  vaultRoot: string;
  config: VaultConfig;
  now: () => Date;
  randomId: () => string;
}

export function defaultContext(vaultRoot: string, config?: Partial<VaultConfig>): VaultContext {
  const merged: VaultConfig = {
    vaultRoot,
    schemaVersion: 1,
    git: { autoCommit: false, signOff: false, messagePrefix: "mnemonic: " },
    ...(config ?? {}),
  };
  return {
    vaultRoot,
    config: merged,
    now: () => new Date(),
    randomId: () => ulid(),
  };
}

/**
 * Load `.mnemonic/config.yaml` if present; otherwise return defaults.
 */
export function loadVaultConfig(vaultRoot: string): VaultConfig {
  const cfgPath = path.join(vaultRoot, ".mnemonic", "config.yaml");
  const base: VaultConfig = {
    vaultRoot,
    schemaVersion: 1,
    git: { autoCommit: false, signOff: false, messagePrefix: "mnemonic: " },
  };
  if (!fs.existsSync(cfgPath)) return base;
  const raw = fs.readFileSync(cfgPath, "utf8");
  const parsed = YAML.parse(raw) ?? {};
  return { ...base, ...parsed, vaultRoot };
}

/**
 * Walk up from `cwd` looking for a `.mnemonic/config.yaml`. If found, returns
 * the directory containing `.mnemonic/`. Falls back to MNEMONIC_VAULT, then
 * `~/mnemonic-vault`. Throws if no vault is found.
 */
export function autoDetectVault(opts?: { cwd?: string; env?: NodeJS.ProcessEnv; home?: string }): string {
  const cwd = opts?.cwd ?? process.cwd();
  const env = opts?.env ?? process.env;
  const home = opts?.home ?? (env.HOME ?? "/");
  let dir = path.resolve(cwd);
  while (true) {
    if (fs.existsSync(path.join(dir, ".mnemonic", "config.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  if (env.MNEMONIC_VAULT && fs.existsSync(path.join(env.MNEMONIC_VAULT, ".mnemonic", "config.yaml"))) {
    return env.MNEMONIC_VAULT;
  }
  const fallback = path.join(home, "mnemonic-vault");
  if (fs.existsSync(path.join(fallback, ".mnemonic", "config.yaml"))) return fallback;
  throw new VaultNotFoundError(`No vault found. Run \`mnemonic init\` or set MNEMONIC_VAULT.`);
}

export class VaultNotFoundError extends Error {
  override name = "VaultNotFoundError";
}
