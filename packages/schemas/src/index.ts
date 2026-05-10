/**
 * @mnemonic/schemas — Zod schemas for Mnemonic KB v0.1.
 *
 * The contract between every package. Pages, proposals, skills, search results,
 * and context packs are all validated against these schemas before they cross
 * a layer boundary.
 */
import { z } from "zod";

// ─── Primitives ────────────────────────────────────────────────────────────

export const PageType = z.enum([
  "repo", "project", "decision", "lesson", "pattern",
  "prompt", "meeting", "person", "agent", "note",
]);
export type PageType = z.infer<typeof PageType>;

export const PageStatus = z.enum(["draft", "active", "deprecated", "superseded"]);
export type PageStatus = z.infer<typeof PageStatus>;

export const Source = z.enum(["manual", "cli", "mcp", "import", "promotion"]);
export type Source = z.infer<typeof Source>;

export const Confidence = z.enum(["low", "medium", "high"]);
export type Confidence = z.infer<typeof Confidence>;

export const Risk = z.enum(["low", "medium", "high"]);
export type Risk = z.infer<typeof Risk>;

export const Governance = z.enum(["none", "proposal-required", "pi-governed"]);
export type Governance = z.infer<typeof Governance>;

export const StepKind = z.enum(["latent", "deterministic"]);
export type StepKind = z.infer<typeof StepKind>;

export const SkillStatus = z.enum(["draft", "active"]);
export type SkillStatus = z.infer<typeof SkillStatus>;

// ─── Evidence ──────────────────────────────────────────────────────────────

export const Evidence = z.object({
  type: z.enum(["note", "meeting", "commit", "issue", "manual", "imported", "proposal"]),
  path: z.string().optional(),
  quote: z.string().optional(),
  date: z.string().datetime().optional(),
  note: z.string().optional(),
});
export type Evidence = z.infer<typeof Evidence>;

// ─── Page frontmatter ──────────────────────────────────────────────────────

export const PageFrontmatter = z.object({
  id: z.string(),                          // ULID
  schemaVersion: z.literal(1),
  type: PageType,
  status: PageStatus.default("active"),
  title: z.string(),
  tags: z.array(z.string()).default([]),
  aliases: z.array(z.string()).default([]),
  repo: z.string().optional(),
  project: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  source: Source.default("manual"),
  confidence: Confidence.default("medium"),
  links: z.array(z.string()).default([]),
  evidence: z.array(Evidence).default([]),
});
export type PageFrontmatter = z.infer<typeof PageFrontmatter>;

export const Page = z.object({
  frontmatter: PageFrontmatter,
  body: z.string(),
});
export type Page = z.infer<typeof Page>;

// ─── Proposal ──────────────────────────────────────────────────────────────

export const ProposalStatus = z.enum(["open", "promoted", "rejected"]);
export type ProposalStatus = z.infer<typeof ProposalStatus>;

export const ProposalTargetSection = z.enum([
  "compiled-truth", "timeline", "decisions", "lessons", "patterns",
]);

export const ProposalTarget = z.object({
  pageId: z.string().optional(),
  section: ProposalTargetSection.optional(),
});

export const Proposal = z.object({
  id: z.string(),
  status: ProposalStatus,
  proposedBy: z.string(),
  reason: z.string(),
  target: ProposalTarget.optional(),
  createdAt: z.string().datetime(),
  promotedAt: z.string().datetime().optional(),
  rejectedAt: z.string().datetime().optional(),
  rejectedReason: z.string().optional(),
  evidence: z.array(Evidence).default([]),
  // Body of the proposal (the candidate content for canonicalization).
  content: z.string(),
  // Optional hint about what type of canonical page this should become.
  typeHint: PageType.optional(),
  repo: z.string().optional(),
  project: z.string().optional(),
});
export type Proposal = z.infer<typeof Proposal>;

// ─── Search + context ──────────────────────────────────────────────────────

export const SearchResult = z.object({
  id: z.string(),
  title: z.string(),
  type: PageType,
  path: z.string(),
  relevance: z.number(),
  excerpt: z.string(),
  status: PageStatus,
  updatedAt: z.string().datetime(),
});
export type SearchResult = z.infer<typeof SearchResult>;

export const ContextPack = z.object({
  task: z.string(),
  repo: z.string().optional(),
  project: z.string().optional(),
  summary: z.string(),
  confidence: Confidence,
  warnings: z.array(z.string()).default([]),
  pages: z.array(SearchResult),
  contextPackMarkdown: z.string(),
  generatedAt: z.string().datetime(),
  maxTokens: z.number(),
});
export type ContextPack = z.infer<typeof ContextPack>;

// ─── Skills ────────────────────────────────────────────────────────────────

export const SkillParameter = z.object({
  name: z.string(),
  type: z.string(),
  required: z.boolean().default(false),
  default: z.unknown().optional(),
});
export type SkillParameter = z.infer<typeof SkillParameter>;

export const SkillOutput = z.object({
  name: z.string(),
  type: z.string(),
});

export const SkillStep = z.object({
  id: z.string(),
  kind: StepKind,
  tool: z.string().optional(),
});

export const SkillLanes = z.object({
  covers: z.array(z.string()).default([]),
  excludes: z.array(z.string()).default([]),
});

export const SkillFrontmatter = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  status: SkillStatus.default("active"),
  parameters: z.array(SkillParameter).default([]),
  outputs: z.array(SkillOutput).default([]),
  uses: z.array(z.string()).default([]),
  steps: z.array(SkillStep).default([]),
  lanes: SkillLanes.optional(),
  risk: Risk.default("low"),
  governance: Governance.default("none"),
  triggers: z.array(z.string()).default([]),
});
export type SkillFrontmatter = z.infer<typeof SkillFrontmatter>;

export const Skill = z.object({
  frontmatter: SkillFrontmatter,
  body: z.string(),
  path: z.string(),
});
export type Skill = z.infer<typeof Skill>;

// Progressive-disclosure: small index entry returned by list_skills.
export const SkillIndexEntry = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  status: SkillStatus,
  risk: Risk,
  triggers: z.array(z.string()),
});
export type SkillIndexEntry = z.infer<typeof SkillIndexEntry>;

// ─── Resolver ──────────────────────────────────────────────────────────────

export const ResolverEntry = z.object({
  intentExample: z.string(),
  skillId: z.string(),
  notes: z.string().optional(),
});
export type ResolverEntry = z.infer<typeof ResolverEntry>;

// ─── Filing rules ──────────────────────────────────────────────────────────

export const FilingRuleMatch = z.object({
  type: PageType.optional(),
  hasRepo: z.boolean().optional(),
  hasProject: z.boolean().optional(),
});

export const FilingRule = z.object({
  match: FilingRuleMatch,
  target: z.string(), // path template, e.g. "repos/{repo}/lessons/{id}.md"
});
export type FilingRule = z.infer<typeof FilingRule>;

export const FilingRulesFile = z.object({
  rules: z.array(FilingRule),
});
export type FilingRulesFile = z.infer<typeof FilingRulesFile>;

// ─── Inbox note convenience ────────────────────────────────────────────────

export const InboxNoteInput = z.object({
  content: z.string().min(1, "content cannot be empty"),
  tags: z.array(z.string()).default([]),
  repo: z.string().optional(),
  project: z.string().optional(),
  typeHint: PageType.optional(),
  capturedBy: z.enum(["cli", "mcp", "agent"]).default("cli"),
});
export type InboxNoteInput = z.infer<typeof InboxNoteInput>;
