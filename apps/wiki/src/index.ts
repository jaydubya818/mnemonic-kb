/**
 * Mnemonic wiki — Hono + server-rendered Markdown.
 *
 * Read-only. Localhost only by default. No auth in v0.1.
 *
 * All filesystem reads go through `@mnemonic/core` — no direct `fs` imports.
 */
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { marked } from "marked";
import path from "node:path";
import {
  defaultContext, loadVaultConfig, autoDetectVault,
  listInbox, listProposals, readPage, getRecentPages,
  loadSkillIndex, readSkillByPath,
  type VaultContext,
} from "@mnemonic/core";
import { loadOrBuildIndex, searchPages } from "@mnemonic/retrieval";

function getCtx(): VaultContext {
  const root = autoDetectVault();
  const cfg = loadVaultConfig(root);
  return { ...defaultContext(root, cfg), vaultRoot: root };
}

const layout = (title: string, body: string): string => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(title)} · Mnemonic</title>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    .prose pre { background: #f3f4f6; padding: 0.75rem; border-radius: 4px; overflow-x: auto; }
    .prose code { background: #f3f4f6; padding: 0 0.25rem; border-radius: 3px; }
  </style>
</head>
<body class="bg-white text-gray-900">
  <header class="border-b">
    <nav class="max-w-4xl mx-auto px-6 py-3 flex items-center gap-6">
      <a href="/" class="font-semibold">Mnemonic</a>
      <a href="/" class="text-sm text-gray-600 hover:text-black">Recent</a>
      <a href="/skills" class="text-sm text-gray-600 hover:text-black">Skills</a>
      <a href="/inbox" class="text-sm text-gray-600 hover:text-black">Inbox</a>
      <a href="/proposals" class="text-sm text-gray-600 hover:text-black">Proposals</a>
      <form action="/search" class="ml-auto">
        <input name="q" placeholder="Search..." class="border rounded px-2 py-1 text-sm" />
      </form>
    </nav>
  </header>
  <main class="max-w-4xl mx-auto px-6 py-6">
    ${body}
  </main>
</body>
</html>`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const app = new Hono();

app.get("/", (c) => {
  const ctx = getCtx();
  const recent = getRecentPages(ctx.vaultRoot, 30);
  const items = recent
    .map(({ page }) => {
      const status = page.frontmatter.status === "active" ? "" : ` <span class="text-xs text-gray-500">[${page.frontmatter.status}]</span>`;
      return `<li class="py-1">
        <span class="text-xs text-gray-500 inline-block w-24">${page.frontmatter.updatedAt.slice(0, 10)}</span>
        <span class="text-xs text-gray-500 inline-block w-20">${page.frontmatter.type}</span>
        <a class="text-blue-700 hover:underline" href="/p/${page.frontmatter.id}">${escapeHtml(page.frontmatter.title)}</a>${status}
      </li>`;
    })
    .join("");
  const body = `<h1 class="text-2xl font-semibold mb-4">Recent</h1><ul>${items}</ul>`;
  return c.html(layout("Recent", body));
});

app.get("/p/:id", (c) => {
  const ctx = getCtx();
  try {
    const { path: p, page } = readPage(ctx.vaultRoot, c.req.param("id"));
    const html = marked.parse(page.body) as string;
    const body = `
      <article class="prose max-w-none">
        <h1 class="text-2xl font-semibold mb-1">${escapeHtml(page.frontmatter.title)}</h1>
        <div class="text-xs text-gray-500 mb-4">
          ${page.frontmatter.type} · ${page.frontmatter.status} · updated ${page.frontmatter.updatedAt.slice(0, 10)}
          · <code>${escapeHtml(path.relative(ctx.vaultRoot, p))}</code>
        </div>
        <div class="bg-gray-50 border rounded p-3 mb-4 text-xs">
          <div><strong>id:</strong> ${page.frontmatter.id}</div>
          ${page.frontmatter.repo ? `<div><strong>repo:</strong> ${page.frontmatter.repo}</div>` : ""}
          ${page.frontmatter.tags.length ? `<div><strong>tags:</strong> ${page.frontmatter.tags.join(", ")}</div>` : ""}
        </div>
        ${html}
      </article>
    `;
    return c.html(layout(page.frontmatter.title, body));
  } catch {
    return c.html(layout("Not found", `<p>Page not found: ${escapeHtml(c.req.param("id"))}</p>`), 404);
  }
});

app.get("/search", (c) => {
  const q = c.req.query("q") ?? "";
  if (!q) return c.html(layout("Search", `<p>Enter a query.</p>`));
  const ctx = getCtx();
  const idx = loadOrBuildIndex(ctx.vaultRoot);
  const results = searchPages(idx, { query: q, limit: 30 });
  const items = results
    .map((r) => {
      const status = r.status === "active" ? "" : ` <span class="text-xs text-gray-500">[${r.status}]</span>`;
      return `<li class="py-2 border-b">
        <div><a class="text-blue-700 hover:underline" href="/p/${r.id}">${escapeHtml(r.title)}</a>${status}
          <span class="text-xs text-gray-500 ml-2">${r.relevance.toFixed(3)} · ${r.type}</span></div>
        <div class="text-sm text-gray-700">${escapeHtml(r.excerpt)}</div>
      </li>`;
    })
    .join("");
  const body = `
    <h1 class="text-2xl font-semibold mb-4">Search: ${escapeHtml(q)}</h1>
    ${results.length ? `<ul>${items}</ul>` : "<p>No matches.</p>"}
  `;
  return c.html(layout(`Search: ${q}`, body));
});

app.get("/skills", (c) => {
  const ctx = getCtx();
  const entries = loadSkillIndex(ctx.vaultRoot);
  const items = entries
    .map((s) => `<li class="py-2 border-b">
      <a class="text-blue-700 hover:underline font-medium" href="/skills/${encodeURIComponent(s.id)}">${escapeHtml(s.id)}</a>
      <span class="text-xs text-gray-500 ml-2">risk=${s.risk}</span>
      <div class="text-sm text-gray-700">${escapeHtml(s.description)}</div>
    </li>`)
    .join("");
  return c.html(layout("Skills", `<h1 class="text-2xl font-semibold mb-4">Skills</h1>${entries.length ? `<ul>${items}</ul>` : "<p>No skills indexed. Run <code>mnemonic check-resolvable</code>.</p>"}`));
});

app.get("/skills/:id{.+}", (c) => {
  const id = c.req.param("id");
  const ctx = getCtx();
  const skill = readSkillByPath(ctx.vaultRoot, id);
  if (!skill) {
    return c.html(layout("Skill not found", `<p>Skill not found: ${escapeHtml(id)}</p>`), 404);
  }
  const html = marked.parse(skill.body) as string;
  return c.html(layout(`Skill: ${id}`, `
    <h1 class="text-2xl font-semibold mb-1">Skill: ${escapeHtml(id)}</h1>
    <div class="bg-gray-50 border rounded p-3 mb-4 text-xs"><pre>${escapeHtml(skill.frontmatterYaml)}</pre></div>
    <article class="prose max-w-none">${html}</article>
  `));
});

app.get("/inbox", (c) => {
  const ctx = getCtx();
  const items = listInbox(ctx.vaultRoot)
    .map(({ page }) => `<li class="py-1">
      <span class="text-xs text-gray-500 inline-block w-24">${page.frontmatter.updatedAt.slice(0, 10)}</span>
      <a class="text-blue-700 hover:underline" href="/p/${page.frontmatter.id}">${escapeHtml(page.frontmatter.title)}</a>
    </li>`).join("");
  return c.html(layout("Inbox", `<h1 class="text-2xl font-semibold mb-4">Inbox</h1>${items ? `<ul>${items}</ul>` : "<p>(empty)</p>"}`));
});

app.get("/proposals", (c) => {
  const ctx = getCtx();
  const items = listProposals(ctx.vaultRoot)
    .map((p) => `<li class="py-1">
      <span class="text-xs text-gray-500 inline-block w-20">${p.status}</span>
      <span class="font-mono text-xs">${p.id}</span> — ${escapeHtml(p.reason)}
    </li>`).join("");
  return c.html(layout("Proposals", `<h1 class="text-2xl font-semibold mb-4">Proposals</h1>${items ? `<ul>${items}</ul>` : "<p>(none)</p>"}`));
});

app.get("/healthz", (c) => c.text("ok"));

export interface StartOpts { port?: number }

export async function startWiki(opts: StartOpts = {}): Promise<void> {
  const port = opts.port ?? 4477;
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Mnemonic wiki: http://localhost:${info.port}`);
  });
}

// CLI entrypoint when run directly.
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  await startWiki({ port: Number(process.env.PORT ?? 4477) });
}
