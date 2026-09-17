/**
 * Structural checks for the `developer` command/agent duplication collapse.
 *
 * Covers issue #173 (parent task 5.0):
 *   - `.claude/commands/developer.md` MUST stay a thin wrapper (size cap,
 *     no restatement of the Non-Negotiable Operating Rules).
 *   - `.claude/agents/developer.md` MUST NOT carry the inert "Steering
 *     Context Check" block (Kiro `fileMatch` semantics, no-op on Claude).
 *   - Both the agent and the command MUST invoke the `implement` skill
 *     explicitly as step 0 of the execution flow.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = resolve(__dirname, "../..");

const CLAUDE_AGENT = ".claude/agents/developer.md";
const CLAUDE_COMMAND = ".claude/commands/developer.md";

/**
 * Thin command wrappers in this repo range ~600-1900 bytes
 * (github-ops.md: 681, housekeeping.md: 606, qa-engineer.md: 1818).
 * `/developer` carries one extra explanatory paragraph (main-thread vs.
 * subagent distinction), so the cap is generous but still far below the
 * near-verbatim-copy size (~21.8 KB) it replaces.
 */
const COMMAND_SIZE_CAP_BYTES = 3000;

/** Phrases that only belong in the full agent contract, never a wrapper. */
const NON_NEGOTIABLE_RULE_MARKERS = [
  "Non-Negotiable Operating Rules",
  "Mandatory QA coverage gate",
  "Platform-write prohibition",
  "Meta-repo write restriction (RF-64)",
  "Cross-repo sub-task scope (RF-63)",
];

/** Kiro-only activation semantics that are inert (no-op) on Claude. */
const KIRO_ACTIVATION_MARKERS = [/Steering Context Check/i, /fileMatch/, /\bapplyTo\b/];

function read(relPath: string): string {
  return readFileSync(resolve(ROOT, relPath), "utf-8");
}

function byteSize(relPath: string): number {
  return statSync(resolve(ROOT, relPath)).size;
}

describe("developer command collapse — command file is a thin wrapper", () => {
  it("exists", () => {
    expect(existsSync(resolve(ROOT, CLAUDE_COMMAND))).toBe(true);
  });

  it(`stays under the ${COMMAND_SIZE_CAP_BYTES} byte thin-wrapper cap`, () => {
    const size = byteSize(CLAUDE_COMMAND);
    expect(
      size,
      `${CLAUDE_COMMAND} is ${size} bytes, expected < ${COMMAND_SIZE_CAP_BYTES}`,
    ).toBeLessThan(COMMAND_SIZE_CAP_BYTES);
  });

  it("does not restate the Non-Negotiable Operating Rules", () => {
    const content = read(CLAUDE_COMMAND);
    for (const marker of NON_NEGOTIABLE_RULE_MARKERS) {
      expect(content.includes(marker), `${CLAUDE_COMMAND} restates rule marker: "${marker}"`).toBe(
        false,
      );
    }
  });

  it("points to the developer agent contract file", () => {
    const content = read(CLAUDE_COMMAND);
    expect(/\.claude\/agents\/developer\.md/.test(content)).toBe(true);
  });

  it("invokes the implement skill explicitly", () => {
    const content = read(CLAUDE_COMMAND);
    expect(/implement/i.test(content)).toBe(true);
  });

  it("preserves the step-gated default and $ARGUMENTS placeholder", () => {
    const content = read(CLAUDE_COMMAND);
    expect(/step-gated/i.test(content)).toBe(true);
    expect(content.includes("$ARGUMENTS")).toBe(true);
  });
});

describe("developer command collapse — agent file drops Kiro-only activation semantics", () => {
  it("does not contain the inert Steering Context Check block", () => {
    const content = read(CLAUDE_AGENT);
    for (const marker of KIRO_ACTIVATION_MARKERS) {
      expect(marker.test(content), `${CLAUDE_AGENT} still matches: ${marker}`).toBe(false);
    }
  });

  it("invokes the implement skill explicitly as step 0 of the Execution Flow", () => {
    const content = read(CLAUDE_AGENT);
    const flowSection = content.slice(content.indexOf("## Execution Flow"));
    expect(/^0\.\s+.*implement.*skill/im.test(flowSection)).toBe(true);
  });
});

describe("developer command collapse — no .claude file carries Kiro-only activation semantics for developer", () => {
  for (const relPath of [CLAUDE_AGENT, CLAUDE_COMMAND]) {
    it(`${relPath} references no Kiro fileMatch/applyTo/Steering-Context activation mechanism`, () => {
      const content = read(relPath);
      for (const marker of KIRO_ACTIVATION_MARKERS) {
        expect(marker.test(content), `${relPath} matches: ${marker}`).toBe(false);
      }
    });
  }
});
