/**
 * Frontmatter parser/serializer with round-trip stability.
 *
 * Format: ```---\n<yaml>\n---\n<body>```
 */
import YAML from "yaml";
import { Page, PageFrontmatter } from "@mnemonic/schemas";

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseFrontmatter(raw: string): Page {
  const m = FENCE.exec(raw);
  if (!m) {
    throw new FrontmatterError("Missing frontmatter fence; expected file to start with ---");
  }
  const yamlText = m[1] ?? "";
  const body = raw.slice(m[0].length);
  let data: unknown;
  try {
    data = YAML.parse(yamlText);
  } catch (err) {
    throw new FrontmatterError(`Failed to parse YAML frontmatter: ${(err as Error).message}`);
  }
  const fm = PageFrontmatter.parse(data);
  return { frontmatter: fm, body };
}

export function writeFrontmatter(page: Page): string {
  PageFrontmatter.parse(page.frontmatter); // validate before serialize
  const yaml = YAML.stringify(page.frontmatter, { lineWidth: 0 }).trimEnd();
  return `---\n${yaml}\n---\n${page.body.startsWith("\n") ? "" : "\n"}${page.body.replace(/^\n+/, "")}`;
}

export class FrontmatterError extends Error {
  override name = "FrontmatterError";
}
