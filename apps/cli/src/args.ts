/**
 * Minimal flag parser. No external dependency — keeps CLI startup fast.
 *
 * Supports:
 *   --flag value
 *   --flag=value
 *   --bool                 (no value → true)
 *   --tag a --tag b        (repeated → string[])
 *   positionals
 *
 * Stops parsing at `--`.
 */
export interface ParsedArgs {
  positional: string[];
  flags: Record<string, string | string[] | boolean>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | string[] | boolean> = {};
  let i = 0;
  while (i < argv.length) {
    const a = argv[i]!;
    if (a === "--") { positional.push(...argv.slice(i + 1)); break; }
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      let key: string;
      let val: string | undefined;
      if (eq !== -1) {
        key = a.slice(2, eq);
        val = a.slice(eq + 1);
      } else {
        key = a.slice(2);
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith("--")) {
          val = next;
          i++;
        }
      }
      const existing = flags[key];
      if (val === undefined) {
        flags[key] = true;
      } else if (existing === undefined) {
        flags[key] = val;
      } else if (Array.isArray(existing)) {
        existing.push(val);
      } else if (typeof existing === "string") {
        flags[key] = [existing, val];
      } else {
        flags[key] = val;
      }
    } else {
      positional.push(a);
    }
    i++;
  }
  return { positional, flags };
}

export function getFlagString(flags: ParsedArgs["flags"], key: string): string | undefined {
  const v = flags[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[v.length - 1];
  return undefined;
}

export function getFlagBool(flags: ParsedArgs["flags"], key: string): boolean {
  return flags[key] === true || flags[key] === "true";
}

export function getFlagNumber(flags: ParsedArgs["flags"], key: string): number | undefined {
  const s = getFlagString(flags, key);
  if (s === undefined) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export function getFlagArray(flags: ParsedArgs["flags"], key: string): string[] {
  const v = flags[key];
  if (Array.isArray(v)) return v.slice();
  if (typeof v === "string") return [v];
  return [];
}
