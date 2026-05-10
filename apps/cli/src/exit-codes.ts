/**
 * CLI exit codes (documented in docs/cli.md):
 *   0 — success
 *   1 — user error (bad args)
 *   2 — vault not found
 *   3 — schema-validation failure
 *   4 — check-resolvable failure
 *   5 — resource not found (page/proposal id)
 */
export const EXIT = {
  OK: 0,
  USER_ERROR: 1,
  VAULT_NOT_FOUND: 2,
  SCHEMA_FAIL: 3,
  CHECK_RESOLVABLE_FAIL: 4,
  NOT_FOUND: 5,
} as const;

export class CliError extends Error {
  override name = "CliError";
  constructor(public code: number, message: string) { super(message); }
}
