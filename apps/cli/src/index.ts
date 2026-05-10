/**
 * mnemonic CLI — main entrypoint.
 */
import { parseArgs, type ParsedArgs } from "./args.js";
import { CliError, EXIT } from "./exit-codes.js";
import {
  cmdInit, cmdRemember, cmdSearch, cmdRead, cmdRecent, cmdContext, cmdRepoContext,
  cmdInbox, cmdPropose, cmdPromote, cmdReject, cmdProposals,
} from "./commands.js";
import {
  cmdSkillsList, cmdSkillsInspect, cmdCheckResolvable, cmdDoctor,
} from "./commands-skills.js";

const HELP = `mnemonic — personal developer memory for agentic engineering

Usage:
  mnemonic init [--vault <path>] [--force] [--yes]
  mnemonic remember "<content>" [--repo <r>] [--project <p>] [--tag <t>...]
  mnemonic search "<query>" [--type <t>] [--repo <r>] [--limit <n>]
  mnemonic read <idOrPath> [--format md|json]
  mnemonic recent [--type <t>] [--limit <n>]
  mnemonic context --task "<task>" [--repo <r>] [--project <p>] [--max-tokens <n>]
  mnemonic repo-context <repo>
  mnemonic inbox
  mnemonic inbox show <id>
  mnemonic inbox promote <id> [--reason "<r>"]
  mnemonic inbox archive <id>
  mnemonic propose "<content>" --reason "<r>" [--repo <r>] [--type <t>]
  mnemonic promote <proposalId>
  mnemonic reject <proposalId> --reason "<r>"
  mnemonic proposals [--status open|promoted|rejected]
  mnemonic skills list [--status active|draft]
  mnemonic skills inspect <skillId>
  mnemonic check-resolvable
  mnemonic doctor [--verbose]
  mnemonic wiki [--port <n>]

Exit codes: 0 success · 1 user error · 2 vault not found · 3 schema fail · 4 audit fail · 5 not found
`;

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    console.log(HELP);
    return EXIT.OK;
  }
  const cmd = argv[0]!;
  const args = parseArgs(argv.slice(1));

  try {
    switch (cmd) {
      case "init":             return await cmdInit(args);
      case "remember":         return await cmdRemember(args);
      case "search":           return await cmdSearch(args);
      case "read":             return await cmdRead(args);
      case "recent":           return await cmdRecent(args);
      case "context":          return await cmdContext(args);
      case "repo-context":     return await cmdRepoContext(args);
      case "inbox":            return await cmdInbox(args);
      case "propose":          return await cmdPropose(args);
      case "promote":          return await cmdPromote(args);
      case "reject":           return await cmdReject(args);
      case "proposals":        return await cmdProposals(args);
      case "skills":           return await runSkillsSubcommand(args);
      case "check":
      case "check-resolvable": return await cmdCheckResolvable(args);
      case "doctor":           return await cmdDoctor(args);
      case "wiki":             return await runWiki(args);
      default:
        console.error(`Unknown command: ${cmd}`);
        console.error(HELP);
        return EXIT.USER_ERROR;
    }
  } catch (err) {
    if (err instanceof CliError) {
      console.error(err.message);
      return err.code;
    }
    if ((err as Error).name === "VaultNotFoundError") {
      console.error((err as Error).message);
      return EXIT.VAULT_NOT_FOUND;
    }
    console.error(`error: ${(err as Error).message}`);
    return EXIT.SCHEMA_FAIL;
  }
}

async function runSkillsSubcommand(args: ParsedArgs): Promise<number> {
  const sub = args.positional[0];
  const rest = { positional: args.positional.slice(1), flags: args.flags };
  switch (sub) {
    case "list":    return cmdSkillsList(rest);
    case "inspect": return cmdSkillsInspect(rest);
    default:
      console.error(`Usage: mnemonic skills <list|inspect>`);
      return EXIT.USER_ERROR;
  }
}

async function runWiki(args: ParsedArgs): Promise<number> {
  // Wiki app is a separate package. We exec it via tsx in dev or its bin in prod.
  // For v0.1, the CLI just prints a hint; the wiki is started by `pnpm --filter @mnemonic/wiki start`
  // or by importing dynamically. Here we dynamically import to avoid making the
  // CLI depend on Hono at install time.
  try {
    // @ts-ignore — dynamic import resolved at runtime.
    const wiki = await import("@mnemonic/wiki");
    if (typeof wiki.startWiki === "function") {
      const port = (() => {
        const p = args.flags["port"];
        return typeof p === "string" ? Number(p) : 4477;
      })();
      await wiki.startWiki({ port });
      return EXIT.OK;
    }
  } catch {
    // Fall through to hint.
  }
  console.log("To start the wiki: pnpm --filter @mnemonic/wiki start");
  return EXIT.OK;
}

const code = await main();
process.exit(code);
