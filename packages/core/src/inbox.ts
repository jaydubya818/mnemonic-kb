import type { Page } from "@mnemonic/schemas";
import type { InboxNoteInput } from "@mnemonic/schemas";
import type { VaultContext } from "./context.js";

/**
 * Build an inbox note from raw input. The body has a `# Captured` section with
 * the verbatim content and a `# Hints` section so future inbox-triage skills
 * have structured metadata to read without re-parsing prose.
 *
 * Inbox notes always have type=note and status=active. Type hints are recorded
 * in the body (not the frontmatter type) so that promotion is the only path to
 * canonical typing.
 */
export function buildInboxNote(ctx: VaultContext, input: InboxNoteInput): Page {
  const id = ctx.randomId();
  const now = ctx.now().toISOString();
  const title = firstLine(input.content).slice(0, 60).trim() || "Captured note";
  const body = renderInboxBody(input);

  return {
    frontmatter: {
      id,
      schemaVersion: 1,
      type: "note",
      status: "active",
      title,
      tags: input.tags,
      aliases: [],
      ...(input.repo ? { repo: input.repo } : {}),
      ...(input.project ? { project: input.project } : {}),
      createdAt: now,
      updatedAt: now,
      source: input.capturedBy === "mcp" ? "mcp" : input.capturedBy === "agent" ? "manual" : "cli",
      confidence: "medium",
      links: [],
      evidence: [],
    },
    body,
  };
}

function firstLine(s: string): string {
  return s.split(/\r?\n/, 1)[0] ?? s;
}

function renderInboxBody(input: InboxNoteInput): string {
  const hintsLines = [
    `- repo: ${input.repo ?? "—"}`,
    `- project: ${input.project ?? "—"}`,
    `- type-hint: ${input.typeHint ?? "—"}`,
    `- captured-by: ${input.capturedBy}`,
  ].join("\n");
  return `\n# Captured\n\n${input.content.trimEnd()}\n\n# Hints\n\n${hintsLines}\n`;
}
