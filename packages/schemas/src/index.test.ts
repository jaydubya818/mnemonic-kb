import { describe, it, expect } from "vitest";
import {
  PageFrontmatter, Proposal, ContextPack, SkillFrontmatter, Evidence, FilingRule,
} from "./index.js";

describe("schemas", () => {
  it("PageFrontmatter accepts a valid page", () => {
    const fm = PageFrontmatter.parse({
      id: "01J9X8000000000000000000",
      schemaVersion: 1,
      type: "decision",
      title: "Defer SDK migration",
      createdAt: "2026-05-10T00:00:00.000Z",
      updatedAt: "2026-05-10T00:00:00.000Z",
    });
    expect(fm.status).toBe("active");
    expect(fm.confidence).toBe("medium");
    expect(fm.tags).toEqual([]);
  });

  it("PageFrontmatter rejects schemaVersion mismatch", () => {
    expect(() => PageFrontmatter.parse({
      id: "x", schemaVersion: 2, type: "note", title: "t",
      createdAt: "2026-05-10T00:00:00.000Z", updatedAt: "2026-05-10T00:00:00.000Z",
    })).toThrow();
  });

  it("Proposal requires status + content", () => {
    expect(() => Proposal.parse({ id: "x" })).toThrow();
    const p = Proposal.parse({
      id: "01PROP", status: "open", proposedBy: "cli",
      reason: "important", createdAt: "2026-05-10T00:00:00.000Z",
      content: "Hermes should not own memory directly",
    });
    expect(p.status).toBe("open");
    expect(p.evidence).toEqual([]);
  });

  it("ContextPack requires confidence and warnings", () => {
    const cp = ContextPack.parse({
      task: "implement cancellation", summary: "ok",
      confidence: "medium", pages: [], contextPackMarkdown: "# Task: ...",
      generatedAt: "2026-05-10T00:00:00.000Z", maxTokens: 6000,
    });
    expect(cp.warnings).toEqual([]);
  });

  it("SkillFrontmatter parses a parameterized skill with steps and lanes", () => {
    const s = SkillFrontmatter.parse({
      id: "memory/remember", name: "Remember",
      description: "Capture a quick note to inbox",
      parameters: [{ name: "content", type: "string", required: true }],
      outputs: [{ name: "pageId", type: "string" }],
      uses: ["vaultWriter.writeInbox"],
      steps: [{ id: "write", kind: "deterministic", tool: "vaultWriter.writeInbox" }],
      lanes: { covers: ["quick-capture"], excludes: ["canonical-write"] },
      triggers: ["remember that ..."],
    });
    expect(s.status).toBe("active");
    expect(s.steps[0]?.kind).toBe("deterministic");
  });

  it("FilingRule round-trips", () => {
    const r = FilingRule.parse({
      match: { type: "lesson", hasRepo: true },
      target: "repos/{repo}/lessons/{id}.md",
    });
    expect(r.target).toContain("{repo}");
  });

  it("Evidence is permissive about all-optional fields", () => {
    expect(() => Evidence.parse({ type: "manual" })).not.toThrow();
  });
});
