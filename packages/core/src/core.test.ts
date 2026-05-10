import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  parseFrontmatter, writeFrontmatter,
  loadFilingRules, resolveVaultPath, assertPathInsideVault,
  buildInboxNote, createVaultWriter, buildLookup, listPages, listInbox,
  type VaultContext,
} from "./index.js";
import type { Page } from "@mnemonic/schemas";

function tempVault(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mnemonic-vault-"));
  fs.mkdirSync(path.join(dir, "inbox"), { recursive: true });
  fs.mkdirSync(path.join(dir, "_proposals"), { recursive: true });
  fs.mkdirSync(path.join(dir, ".mnemonic"), { recursive: true });
  // Filing rules fixture
  const rules = `# Filing Rules

\`\`\`yaml
rules:
  - match: { type: note }
    target: "inbox/{id}.md"
  - match: { type: lesson, hasRepo: true }
    target: "repos/{repo}/lessons/{id}.md"
  - match: { type: decision, hasRepo: true }
    target: "repos/{repo}/decisions/{id}.md"
  - match: { type: pattern, hasRepo: true }
    target: "repos/{repo}/patterns/{id}.md"
  - match: { type: lesson, hasProject: true }
    target: "projects/{project}/lessons/{id}.md"
  - match: { type: decision, hasProject: true }
    target: "projects/{project}/decisions/{id}.md"
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

function fixedCtx(vaultRoot: string, time = "2026-05-10T12:00:00.000Z"): VaultContext {
  let counter = 0;
  return {
    vaultRoot,
    config: { vaultRoot, schemaVersion: 1 },
    now: () => new Date(time),
    randomId: () => `01TEST00000000000000${String(counter++).padStart(4, "0")}`,
  };
}

describe("frontmatter", () => {
  it("round-trips a page", () => {
    const original: Page = {
      frontmatter: {
        id: "01J9X8000000000000000000",
        schemaVersion: 1,
        type: "decision",
        status: "active",
        title: "T",
        tags: ["a", "b"],
        aliases: [],
        createdAt: "2026-05-10T00:00:00.000Z",
        updatedAt: "2026-05-10T00:00:00.000Z",
        source: "manual",
        confidence: "high",
        links: [],
        evidence: [],
      },
      body: "\n# T\n\n## Compiled Truth\nhello\n",
    };
    const text = writeFrontmatter(original);
    const parsed = parseFrontmatter(text);
    expect(parsed.frontmatter.id).toBe(original.frontmatter.id);
    expect(parsed.frontmatter.tags).toEqual(["a", "b"]);
    expect(parsed.body).toContain("Compiled Truth");
  });

  it("rejects missing fence", () => {
    expect(() => parseFrontmatter("no frontmatter here")).toThrow();
  });
});

describe("filing rules", () => {
  let root: string;
  beforeEach(() => { root = tempVault(); });

  it("notes go to inbox", () => {
    const rules = loadFilingRules(path.join(root, ".mnemonic", "_filing-rules.md"));
    expect(resolveVaultPath(rules, { type: "note", id: "01N" })).toBe("inbox/01N.md");
  });

  it("repo lessons land under repos/<repo>/lessons", () => {
    const rules = loadFilingRules(path.join(root, ".mnemonic", "_filing-rules.md"));
    expect(resolveVaultPath(rules, { type: "lesson", id: "L1", repo: "hermes-agent" }))
      .toBe("repos/hermes-agent/lessons/L1.md");
  });

  it("project decisions land under projects/<project>/decisions", () => {
    const rules = loadFilingRules(path.join(root, ".mnemonic", "_filing-rules.md"));
    expect(resolveVaultPath(rules, { type: "decision", id: "D1", project: "ramp-up" }))
      .toBe("projects/ramp-up/decisions/D1.md");
  });

  it("generic decisions land under decisions/", () => {
    const rules = loadFilingRules(path.join(root, ".mnemonic", "_filing-rules.md"));
    expect(resolveVaultPath(rules, { type: "decision", id: "D2" })).toBe("decisions/D2.md");
  });

  it("rejects path traversal", () => {
    expect(() => assertPathInsideVault("/tmp/v", "../../etc/passwd")).toThrow();
  });

  it("covers every page type", () => {
    const rules = loadFilingRules(path.join(root, ".mnemonic", "_filing-rules.md"));
    const cases: Array<[string, Parameters<typeof resolveVaultPath>[1]]> = [
      ["note",     { type: "note", id: "x" }],
      ["lesson",   { type: "lesson", id: "x" }],
      ["decision", { type: "decision", id: "x" }],
      ["pattern",  { type: "pattern", id: "x" }],
      ["prompt",   { type: "prompt", id: "x" }],
      ["meeting",  { type: "meeting", id: "x" }],
      ["person",   { type: "person", id: "x" }],
      ["agent",    { type: "agent", id: "x" }],
      ["repo",     { type: "repo", id: "x", repo: "r" }],
      ["project",  { type: "project", id: "x", project: "p" }],
    ];
    for (const [_label, input] of cases) {
      expect(() => resolveVaultPath(rules, input)).not.toThrow();
    }
  });
});

describe("inbox + vaultWriter", () => {
  let root: string;
  beforeEach(() => { root = tempVault(); });

  it("buildInboxNote produces a typed note with hints", () => {
    const ctx = fixedCtx(root);
    const note = buildInboxNote(ctx, {
      content: "Hermes should not own memory directly",
      tags: [],
      capturedBy: "cli",
      repo: "hermes-agent",
    });
    expect(note.frontmatter.type).toBe("note");
    expect(note.body).toContain("# Captured");
    expect(note.body).toContain("# Hints");
    expect(note.body).toContain("repo: hermes-agent");
  });

  it("writeInbox lands in inbox/<id>.md", async () => {
    const ctx = fixedCtx(root);
    const rules = loadFilingRules(path.join(root, ".mnemonic", "_filing-rules.md"));
    const writer = createVaultWriter({ ctx, rules, lookup: buildLookup(root) });
    const note = buildInboxNote(ctx, { content: "x", tags: [], capturedBy: "cli" });
    const { path: p } = await writer.writeInbox(note);
    expect(p).toContain(path.join(root, "inbox"));
  });

  it("remember with type-hint=lesson still writes to inbox (D11)", async () => {
    const ctx = fixedCtx(root);
    const rules = loadFilingRules(path.join(root, ".mnemonic", "_filing-rules.md"));
    const writer = createVaultWriter({ ctx, rules, lookup: buildLookup(root) });
    const note = buildInboxNote(ctx, {
      content: "test", tags: [], capturedBy: "cli", typeHint: "lesson",
    });
    const { path: p } = await writer.writeInbox(note);
    expect(p).toContain("inbox/");
    expect(p).not.toContain("lessons/");
  });

  it("createProposal + promote: appends timeline, preserves proposal", async () => {
    const ctx = fixedCtx(root);
    const rules = loadFilingRules(path.join(root, ".mnemonic", "_filing-rules.md"));
    // First, create a target page to promote into.
    const targetWriter = createVaultWriter({ ctx, rules, lookup: buildLookup(root) });
    const targetPage: Page = {
      frontmatter: {
        id: "01TARGET0000000000000000",
        schemaVersion: 1,
        type: "decision",
        status: "active",
        title: "Cancel run policy",
        tags: [], aliases: [],
        createdAt: ctx.now().toISOString(),
        updatedAt: ctx.now().toISOString(),
        source: "manual",
        confidence: "medium",
        links: [], evidence: [],
        repo: "hermes-agent",
      },
      body: "# Cancel run policy\n\n## Compiled Truth\nTBD\n\n## Timeline\n",
    };
    await targetWriter.writePage(targetPage);

    // Now propose and promote.
    const writer = createVaultWriter({ ctx, rules, lookup: buildLookup(root) });
    const { id: propId } = await writer.createProposal({
      proposedBy: "test",
      reason: "found a clearer policy",
      content: "Cancel signals must propagate to children.",
      target: { pageId: "01TARGET0000000000000000" },
    });
    const result = await writer.promote(propId);
    expect(result.appendedTimeline).toBe(true);

    // Target page should have new timeline entry.
    const updated = fs.readFileSync(result.targetPath, "utf8");
    expect(updated).toContain("## Timeline");
    expect(updated).toContain(`Promoted proposal ${propId}`);

    // Proposal file must still exist with status=promoted.
    const propPath = path.join(root, "_proposals", `${propId}.md`);
    expect(fs.existsSync(propPath)).toBe(true);
    expect(fs.readFileSync(propPath, "utf8")).toContain("status: promoted");
  });

  it("listInbox returns only inbox notes", async () => {
    const ctx = fixedCtx(root);
    const rules = loadFilingRules(path.join(root, ".mnemonic", "_filing-rules.md"));
    const writer = createVaultWriter({ ctx, rules, lookup: buildLookup(root) });
    await writer.writeInbox(buildInboxNote(ctx, { content: "first", tags: [], capturedBy: "cli" }));
    await writer.writeInbox(buildInboxNote(ctx, { content: "second", tags: [], capturedBy: "cli" }));
    const notes = listInbox(root);
    expect(notes.length).toBe(2);
  });
});
