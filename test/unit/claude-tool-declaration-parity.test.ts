/**
 * Tool-declaration parity for `.claude/agents/*.md` (issue #175, CP-07).
 *
 * `test/unit/qa-engineer-parity.test.ts:162` and
 * `test/unit/researcher-parity.test.ts:139` only assert that a `tools:` line
 * *exists* in Kiro frontmatter — never which tools. Nothing mechanically
 * catches an agent whose prompt directs it to invoke another subagent while
 * its frontmatter withholds the `Task` tool needed to do so.
 *
 * This test parses each `.claude/agents/*.md` file, extracts the declared
 * `tools:` list, and scans the prompt body for unconditioned directives to
 * invoke another named subagent (`invoke `X`` / `delegate to `X`` where `X`
 * is another file in `.claude/agents/`). Claude Code subagents cannot spawn
 * other subagents (flat orchestration model, see AGENTS.md § Orchestration
 * model) — so an unconditioned directive of this shape is only honest when
 * `Task` is declared.
 *
 * A directive is exempt from this check when it falls inside a section
 * explicitly scoped to a context where `Task` genuinely is available (for
 * example, `developer`'s "Main-Thread Mode Addendum", which documents the
 * separate `.claude/commands/developer.md` interactive entry point that
 * reuses this same contract file in a main-thread session that *does* have
 * `Task`). Callers detect this by checking whether the nearest enclosing
 * heading matches ADDENDUM_HEADING_RE.
 *
 * Inverse check: `Task` itself must not be declared by an agent whose prompt
 * never directs it to invoke another subagent — an unused capability. The
 * inverse is scoped to `Task` specifically (not every declared tool) because
 * every other tool name (`Read`, `Write`, `Edit`, `Bash`, ...) collides with
 * ordinary English prose in these prompts (e.g. "Task list", "Task type",
 * "read the file") badly enough that literal-name presence is not a reliable
 * usage signal — verified empirically against the current fixture set before
 * writing this test. `Task` invocation, by contrast, is already precisely
 * what the forward check detects, so the inverse is its mirror rather than a
 * separate heuristic.
 */

import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = resolve(__dirname, "../..");
const AGENTS_DIR = ".claude/agents";

/** Sections whose headings mark an exempt, Task-available context. */
const ADDENDUM_HEADING_RE = /Main-Thread Mode Addendum/i;

function agentFiles(): string[] {
  return readdirSync(resolve(ROOT, AGENTS_DIR))
    .filter((f) => f.endsWith(".md"))
    .sort();
}

function agentNameOf(fileName: string): string {
  return fileName.replace(/\.md$/, "");
}

function read(relPath: string): string {
  return readFileSync(resolve(ROOT, relPath), "utf-8");
}

/** Extract the YAML frontmatter `tools:` line as a normalized array. */
export function extractTools(contents: string): string[] {
  const match = contents.match(/^tools:\s*(.+)$/m);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Split the body into (heading, sectionText) pairs so directives can be
 * checked against their nearest enclosing heading. The "preamble" before the
 * first heading is recorded under an empty heading string.
 */
export function splitIntoSections(body: string): Array<{ heading: string; text: string }> {
  const lines = body.split("\n");
  const sections: Array<{ heading: string; text: string }> = [];
  let currentHeading = "";
  let currentLines: string[] = [];
  for (const line of lines) {
    const headingMatch = line.match(/^#{1,6}\s+(.*)$/);
    if (headingMatch) {
      sections.push({ heading: currentHeading, text: currentLines.join("\n") });
      currentHeading = headingMatch[1];
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  sections.push({ heading: currentHeading, text: currentLines.join("\n") });
  return sections;
}

/**
 * Directive shapes that instruct the agent to invoke a named subagent.
 * Only the active imperative/present-tense "delegate(s) to" forms are
 * included — the past participle "delegated to" is excluded because it
 * reads as passive voice describing workflow direction (e.g. "remediation
 * is always delegated to `developer`"), not a directive for the current
 * agent to perform a `Task` invocation itself.
 */
const DIRECTIVE_RE =
  /\b(?:invoke[sd]?|delegat(?:e|es)(?:\s+the\s+work)?\s+to)\s+(?:the\s+)?`?([a-z][a-z0-9-]*)`?/gi;

/**
 * A window of text immediately preceding a directive match that flips it
 * from a self-directive into something else: a stated impossibility
 * ("cannot invoke `X`") or a third party performing the action ("planner
 * invokes `X`"). Both are honest descriptions, not `Task`-requiring
 * self-directives, so matches preceded by these are excluded.
 */
const PRECEDING_EXCLUSION_RE =
  /\b(?:cannot|can['’]?t|does\s+not|do\s+not|did\s+not|never|must\s+not|planner)[`*\s]*$/i;

/** Characters of preceding context inspected for PRECEDING_EXCLUSION_RE. */
const PRECEDING_WINDOW = 30;

/**
 * A wider window of preceding context checked for an explicit statement that
 * `Task` is available in the context being described (e.g. "...where `Task`
 * is available and this agent invokes `X` itself"). This phrasing is honest
 * — it is conditioned on the same capability the forward check enforces —
 * so it is excluded even though it falls outside an ADDENDUM_HEADING_RE
 * section (it appears as an inline forward-reference from within a
 * no-delegation-default rule to the addendum that documents the
 * Task-available context).
 */
const TASK_AVAILABLE_RE = /Task`?\s+is\s+available/i;
const TASK_AVAILABLE_WINDOW = 100;

/**
 * Whether a directive match at `matchIndex` within `text` should be excluded
 * from counting as an unconditioned self-directive (see PRECEDING_EXCLUSION_RE
 * and TASK_AVAILABLE_RE above for the two exclusion shapes).
 */
function isExcludedMatch(text: string, matchIndex: number): boolean {
  const tightWindow = text.slice(Math.max(0, matchIndex - PRECEDING_WINDOW), matchIndex);
  if (PRECEDING_EXCLUSION_RE.test(tightWindow)) return true;
  const wideWindow = text.slice(Math.max(0, matchIndex - TASK_AVAILABLE_WINDOW), matchIndex);
  if (TASK_AVAILABLE_RE.test(wideWindow)) return true;
  return false;
}

/**
 * Find every unconditioned instruction in `body` (for the agent named
 * `selfName`) to invoke one of `knownAgentNames`. "Unconditioned" means: not
 * inside a section whose heading matches an addendum/exemption heading.
 */
export function findUnconditionedInvocations(
  body: string,
  selfName: string,
  knownAgentNames: readonly string[],
): string[] {
  const found = new Set<string>();
  for (const section of splitIntoSections(body)) {
    if (ADDENDUM_HEADING_RE.test(section.heading)) continue;
    let match: RegExpExecArray | null;
    DIRECTIVE_RE.lastIndex = 0;
    while ((match = DIRECTIVE_RE.exec(section.text)) !== null) {
      const target = match[1].toLowerCase();
      if (target === selfName) continue;
      if (!knownAgentNames.includes(target)) continue;
      if (isExcludedMatch(section.text, match.index)) continue;
      found.add(target);
    }
  }
  return [...found];
}

describe("claude tool-declaration parity — CP-07", () => {
  const files = agentFiles();
  const agentNames = files.map(agentNameOf);

  describe("forward: an unconditioned instruction to invoke a subagent requires Task", () => {
    for (const file of files) {
      const relPath = `${AGENTS_DIR}/${file}`;
      const selfName = agentNameOf(file);

      it(`${relPath} declares Task if it unconditionally invokes another subagent`, () => {
        const contents = read(relPath);
        const tools = extractTools(contents);
        const invoked = findUnconditionedInvocations(contents, selfName, agentNames);

        if (invoked.length > 0) {
          expect(
            tools,
            `${relPath} unconditionally invokes [${invoked.join(", ")}] but does not declare ` +
              `the \`Task\` tool needed to do so as a subagent (declared tools: ${tools.join(", ") || "none"})`,
          ).toContain("Task");
        } else {
          // Nothing to assert — no unconditioned invocation found, so Task
          // is not required by this check for this file.
          expect(invoked).toEqual([]);
        }
      });
    }
  });

  describe("inverse: Task is not declared unless the prompt actually invokes a subagent", () => {
    for (const file of files) {
      const relPath = `${AGENTS_DIR}/${file}`;
      const selfName = agentNameOf(file);

      it(`${relPath} does not declare an unused Task tool`, () => {
        const contents = read(relPath);
        const tools = extractTools(contents);
        if (!tools.includes("Task")) {
          // Task not declared — nothing to check for this file.
          return;
        }
        // Task is declared anywhere in the body (including exempt
        // addendum sections) to count as "used" — the inverse check only
        // flags a Task declaration paired with zero invocation language.
        const invokedAnywhere = new Set<string>();
        for (const section of splitIntoSections(contents)) {
          let match: RegExpExecArray | null;
          DIRECTIVE_RE.lastIndex = 0;
          while ((match = DIRECTIVE_RE.exec(section.text)) !== null) {
            const target = match[1].toLowerCase();
            if (target === selfName || !agentNames.includes(target)) continue;
            if (isExcludedMatch(section.text, match.index)) continue;
            invokedAnywhere.add(target);
          }
        }
        expect(
          invokedAnywhere.size,
          `${relPath} declares the \`Task\` tool but its prompt never directs it to invoke ` +
            `another named subagent`,
        ).toBeGreaterThan(0);
      });
    }
  });
});
