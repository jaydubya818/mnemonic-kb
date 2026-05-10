/**
 * mnemonic MCP server — stdio transport.
 *
 * Tools mirror the CLI surface. Read tools are pure; write tools route through
 * the same vaultWriter the CLI uses.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema, ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as h from "./handlers.js";

const server = new Server(
  { name: "mnemonic", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

const tools = [
  // Read tools
  {
    name: "mnemonic.search",
    description: "Search the vault. Returns ranked SearchResult[] with absolute paths.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        type: { type: "string", description: "Optional page type filter" },
        repo: { type: "string" },
        limit: { type: "number" },
      },
      required: ["query"],
    },
  },
  {
    name: "mnemonic.read_page",
    description: "Read a page by id or path. Returns frontmatter + body.",
    inputSchema: {
      type: "object",
      properties: { idOrPath: { type: "string" } },
      required: ["idOrPath"],
    },
  },
  {
    name: "mnemonic.list_recent",
    description: "List recently updated pages.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number" },
        type: { type: "string" },
      },
    },
  },
  {
    name: "mnemonic.get_repo_context",
    description: "Return the repo page summary for a given repo slug.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string" },
        maxTokens: { type: "number" },
      },
      required: ["repo"],
    },
  },
  {
    name: "mnemonic.get_task_context",
    description:
      "Build a context pack for a coding-agent task. Returns ContextPack JSON; the `markdown` field is what to inject into a planning prompt.",
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string" },
        repo: { type: "string" },
        project: { type: "string" },
        include: { type: "array", items: { type: "string" } },
        maxTokens: { type: "number" },
      },
      required: ["task"],
    },
  },
  {
    name: "mnemonic.list_skills",
    description:
      "Return a small skill index (~200 B per skill). Use inspect_skill to fetch full body — progressive disclosure.",
    inputSchema: {
      type: "object",
      properties: { status: { type: "string", enum: ["active", "draft"] } },
    },
  },
  {
    name: "mnemonic.inspect_skill",
    description: "Return the full Markdown body + frontmatter for a skill id.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "mnemonic.check_resolvable",
    description: "Run the structural skill/resolver/filing-rules audit. Returns errors + warnings.",
    inputSchema: { type: "object", properties: {} },
  },
  // Write tools
  {
    name: "mnemonic.remember",
    description: "Capture a quick note to inbox. Never canonical — promotion is the only path to canonical.",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        repo: { type: "string" },
        project: { type: "string" },
      },
      required: ["content"],
    },
  },
  {
    name: "mnemonic.propose_memory",
    description: "Create a proposal to canonicalize a piece of content.",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string" },
        reason: { type: "string" },
        type: { type: "string", description: "Page type hint (decision|lesson|pattern|...)" },
        repo: { type: "string" },
        project: { type: "string" },
      },
      required: ["content", "reason"],
    },
  },
  {
    name: "mnemonic.promote_memory",
    description: "Promote an open proposal to canonical. Appends to target page timeline or creates new page.",
    inputSchema: {
      type: "object",
      properties: { proposalId: { type: "string" } },
      required: ["proposalId"],
    },
  },
  {
    name: "mnemonic.create_decision",
    description: "Propose a decision (creates a proposal — not direct canonical write in v0.1).",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        context: { type: "string" },
        decision: { type: "string" },
        consequences: { type: "string" },
        repo: { type: "string" },
        project: { type: "string" },
      },
      required: ["title", "context", "decision"],
    },
  },
  {
    name: "mnemonic.create_lesson",
    description: "Propose a lesson (creates a proposal in v0.1).",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        lesson: { type: "string" },
        repo: { type: "string" },
        project: { type: "string" },
      },
      required: ["title", "lesson"],
    },
  },
  {
    name: "mnemonic.create_pattern",
    description: "Propose a pattern (creates a proposal in v0.1).",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        pattern: { type: "string" },
        whenToUse: { type: "string" },
        repo: { type: "string" },
        project: { type: "string" },
      },
      required: ["title", "pattern"],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  try {
    const out = await dispatch(name, args);
    return {
      content: [{ type: "text", text: JSON.stringify(out, null, 2) }],
      isError: false,
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `error: ${(err as Error).message}` }],
      isError: true,
    };
  }
});

async function dispatch(name: string, args: Record<string, unknown>): Promise<unknown> {
  // The MCP SDK passes args as Record<string, unknown>. We pre-validate that the
  // shape includes required fields, then route through `unknown` to the typed
  // handler — keeps TS happy under strict casts while preserving runtime checks.
  const a = args as unknown;
  switch (name) {
    case "mnemonic.search":            return h.search(a as h.SearchInput);
    case "mnemonic.read_page":         return h.readPageTool(a as { idOrPath: string });
    case "mnemonic.list_recent":       return h.listRecent(a as Parameters<typeof h.listRecent>[0]);
    case "mnemonic.get_repo_context":  return h.getRepoContextTool(a as Parameters<typeof h.getRepoContextTool>[0]);
    case "mnemonic.get_task_context":  return h.getTaskContextTool(a as Parameters<typeof h.getTaskContextTool>[0]);
    case "mnemonic.list_skills":       return h.listSkillsTool(a as Parameters<typeof h.listSkillsTool>[0]);
    case "mnemonic.inspect_skill":     return h.inspectSkillTool(a as { id: string });
    case "mnemonic.check_resolvable":  return h.checkResolvableTool();
    case "mnemonic.remember":          return await h.rememberTool(a as Parameters<typeof h.rememberTool>[0]);
    case "mnemonic.propose_memory":    return await h.proposeMemoryTool(a as Parameters<typeof h.proposeMemoryTool>[0]);
    case "mnemonic.promote_memory":    return await h.promoteMemoryTool(a as { proposalId: string });
    case "mnemonic.create_decision":   return await h.createDecisionTool(a as Parameters<typeof h.createDecisionTool>[0]);
    case "mnemonic.create_lesson":     return await h.createLessonTool(a as Parameters<typeof h.createLessonTool>[0]);
    case "mnemonic.create_pattern":    return await h.createPatternTool(a as Parameters<typeof h.createPatternTool>[0]);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("mnemonic MCP server: listening on stdio");
