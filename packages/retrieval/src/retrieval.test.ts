import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  buildInboxNote, createVaultWriter, buildLookup, loadFilingRules, type VaultContext,
} from "@mnemonic/core";
import type { Page } from "@mnemonic/schemas";
import { buildIndex, saveIndex, getTaskContext, searchPages, recencyDecay, rankEntry } from "./index.js";

function tempVault(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mnemonic-retrieval-"));
  fs.mkdirSync(path.join(dir, "inbox"), { recursive: true });
  fs.mkdirSync(path.join(dir, "_proposals"), { recursive: true });
  fs.mkdirSync(path.join(dir, ".mnemonic"), { recursive: true });
  fs.mkdirSync(path.join(dir, "repos", "hermes-agent", "decisions"), { recursive: true });
  fs.mkdirSync(path.join(dir, "repos", "hermes-agent", "lessons"), { recursive: true });
  fs.mkdirSync(path.join(dir, "repos", "hermes-agent", "patterns"), { recursive: true });
  const rules = `\`\`\`yaml
rules:
  - match: { type: note }
    target: "inbox/{id}.md"
  - match: { type: lesson, hasRepo: true }
    target: "repos/{repo}/lessons/{id}.md"
  - match: { type: decision, hasRepo: true }
    target: "repos/{repo}/decisions/{id}.md"
  - match: { type: pattern, hasRepo: true }
    target: "repos/{repo}/patterns/{id}.md"
  - match: { type: lesson }
    target: "lessons/{id}.md"
  - match: { type: decision }
    target: "decisions/{id}.md"
  - match: { type: pattern }
    target: "patterns/{id}.md"
  - match: { type: prompt }
    target: "prompts/{id}.md"
  - match: { type: meeting }
    target: "meetings/{id}.md"
  - match: { type: person }
    target: "people/{id}.md"
  - match: { type: agent }
    target: "agents/{id}.md"
  - match: { type: repo }
    target: "repos/{repo}/README.md"
  - match: { type: project }
    target: "projects/{project}/README.md"
\`\`\`
`;
  fs.writeFileSync(path.join(dir, ".mnemonic", "_filing-rules.md"), rules);
  return dir;
}

function ctx(vaultRoot: string, time = "2026-05-10T12:00:00.000Z"): VaultContext {
  let i = 0;
  return {
    vaultRoot,
    config: { vaultRoot, schemaVersion: 1 },
    now: () => new Date(time),
    randomId: () => `01R${String(i++).padStart(20, "0")}A`,
  };
}

function page(opts: {
  id: string; type: Page["frontmatter"]["type"]; title: string;
  body: string; status?: Page["frontmatter"]["status"]; repo?: string;
  updatedAt?: string;
}): Page {
  return {
    frontmatter: {
      id: opts.id,
      schemaVersion: 1,
      type: opts.type,
      status: opts.status ?? "active",
      title: opts.title,
      tags: [],
      aliases: [],
      ...(opts.repo ? { repo: opts.repo } : {}),
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: opts.updatedAt ?? "2026-05-10T00:00:00.000Z",
      source: "manual",
      confidence: "medium",
      links: [],
      evidence: [],
    },
    body: opts.body,
  };
}

describe("retrieval — basics", () => {
  it("recencyDecay = 1 at t=0, 0.5 at half-life, ~0 at far past", () => {
    const now = new Date("2026-05-10T00:00:00Z");
    expect(recencyDecay("2026-05-10T00:00:00Z", now)).toBeCloseTo(1, 3);
    expect(recencyDecay("2026-02-09T00:00:00Z", now)).toBeCloseTo(0.5, 1); // ~90 days
    expect(recencyDecay("2024-01-01T00:00:00Z", now)).toBeLessThan(0.05);
  });

  it("rankEntry penalizes deprecated and superseded", () => {
    const base = {
      id: "x", title: "alpha", type: "decision" as const, status: "active" as const,
      confidence: "medium" as const, tags: [], aliases: [], path: "p", body: "alpha beta gamma",
      updatedAt: "2026-05-10T00:00:00Z", links: [], backlinks: [],
    };
    const a = rankEntry(base, { query: "alpha" });
    const d = rankEntry({ ...base, status: "deprecated" }, { query: "alpha" });
    const s = rankEntry({ ...base, status: "superseded" }, { query: "alpha" });
    expect(a).toBeGreaterThan(d);
    expect(d).toBeGreaterThan(s);
  });
});

describe("MANDATORY: context pack from §11.2 of PLAN.md", () => {
  let root: string;

  beforeEach(async () => {
    root = tempVault();
    const c = ctx(root);
    const rules = loadFilingRules(path.join(root, ".mnemonic", "_filing-rules.md"));
    const writer = createVaultWriter({ ctx: c, rules, lookup: buildLookup(root) });

    // 1 active repo page
    await writer.writePage(page({
      id: "01REPO00000000000000000000",
      type: "repo",
      repo: "hermes-agent",
      title: "Hermes Agent",
      body: "## Compiled Truth\nHermes is the reasoning runtime. It does not own memory. cancellation propagates to children.",
    }));

    // 1 active repo decision (matches the task)
    await writer.writePage(page({
      id: "01DEC0ACTIVE00000000000000",
      type: "decision",
      repo: "hermes-agent",
      title: "Run cancellation propagates to children",
      body: "## Compiled Truth\ncancellation must propagate to all child runs immediately. cancellation should be idempotent.",
    }));

    // 1 deprecated repo decision
    await writer.writePage(page({
      id: "01DEC0DEPRECATED0000000000",
      type: "decision",
      repo: "hermes-agent",
      status: "deprecated",
      title: "Old cancellation policy",
      body: "## Compiled Truth\nOld cancellation policy: send SIGTERM only.",
    }));

    // 1 repo lesson
    await writer.writePage(page({
      id: "01LES0000000000000000000A",
      type: "lesson",
      repo: "hermes-agent",
      title: "Don't swallow cancellation errors",
      body: "## Compiled Truth\nLesson: cancellation errors must surface; do not swallow.",
    }));

    // 1 repo pattern
    await writer.writePage(page({
      id: "01PAT0000000000000000000A",
      type: "pattern",
      repo: "hermes-agent",
      title: "Cancellation token pattern",
      body: "## Compiled Truth\nPattern: thread a cancellation token through every async call.",
    }));
  });

  it("returns a usable ContextPack for the cancellation task", () => {
    const idx = buildIndex(root, () => new Date("2026-05-10T13:00:00Z"));
    saveIndex(root, idx);
    const pack = getTaskContext(idx, {
      task: "implement run cancellation",
      repo: "hermes-agent",
      now: new Date("2026-05-10T13:00:00Z"),
    });

    // Active decision included.
    const ids = pack.pages.map((p) => p.id);
    expect(ids).toContain("01DEC0ACTIVE00000000000000");

    // Deprecated decision: either excluded or labeled.
    const md = pack.contextPackMarkdown;
    if (ids.includes("01DEC0DEPRECATED0000000000")) {
      expect(md).toContain("[deprecated]");
    }

    // Local file paths cited.
    expect(md).toContain("repos/hermes-agent/decisions/");

    // Token budget.
    const estTokens = Math.ceil(md.length / 4);
    expect(estTokens).toBeLessThanOrEqual(pack.maxTokens);

    // Open Questions section always present.
    expect(md).toContain("## Open Questions");

    // Summary non-empty.
    expect(pack.summary.length).toBeGreaterThan(0);

    // Confidence field set.
    expect(["low", "medium", "high"]).toContain(pack.confidence);

    // Markdown has the canonical task header and footer.
    expect(md).toMatch(/^# Task: implement run cancellation/);
    expect(md).toContain("Mnemonic context pack v1");
  });

  it("low confidence + warning when very few active pages match", () => {
    // Build a vault with no relevant content.
    const empty = tempVault();
    const idx = buildIndex(empty);
    saveIndex(empty, idx);
    const pack = getTaskContext(idx, {
      task: "totally unrelated task",
      now: new Date("2026-05-10T13:00:00Z"),
    });
    expect(pack.confidence).toBe("low");
    expect(pack.warnings.some((w) => w.toLowerCase().includes("low"))).toBe(true);
  });
});

describe("search filters", () => {
  it("filters by type and repo", () => {
    const root = tempVault();
    const c = ctx(root);
    const rules = loadFilingRules(path.join(root, ".mnemonic", "_filing-rules.md"));
    const writer = createVaultWriter({ ctx: c, rules, lookup: buildLookup(root) });
    return Promise.all([
      writer.writePage(page({ id: "01A", type: "decision", repo: "hermes-agent", title: "alpha cancellation", body: "alpha" })),
      writer.writePage(page({ id: "01B", type: "lesson",   repo: "hermes-agent", title: "alpha cancellation lesson", body: "alpha" })),
      writer.writePage(page({ id: "01C", type: "decision", repo: "other",        title: "alpha cancellation other repo", body: "alpha" })),
    ]).then(() => {
      const idx = buildIndex(root);
      const r = searchPages(idx, { query: "alpha cancellation", type: "decision", repo: "hermes-agent" });
      expect(r.length).toBe(1);
      expect(r[0]?.id).toBe("01A");
    });
  });
});
