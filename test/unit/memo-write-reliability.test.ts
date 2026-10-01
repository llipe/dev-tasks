/**
 * Regression checks for issue #253: memo-cli writes failed in every
 * consumer repository, so no entries were ever recorded.
 *
 * Two defects caused it, and both are prompt text, so the tests read the
 * prompts:
 *
 *   1. `export MEMO_BANK=…` in one shell command, `--bank $MEMO_BANK` in
 *      the next. Agent runtimes run each command in a fresh shell, the
 *      variable is empty, the shell drops it, and commander takes the next
 *      token as the bank id (`--bank --rationale …`). memo-cli rejects it
 *      with VALIDATION_FAILED.
 *   2. technical-writer's `kb` template paired `--source agent` with an
 *      optional `--provenance`. memo-cli rejects an agent-sourced semantic
 *      entry with no provenance, and the ids came from the writes defect 1
 *      broke.
 *
 * The rest of the file guards the visibility fix: a write that fails is
 * reported, the closeout payload carries the result, and planner treats
 * an absent result as an incomplete story.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

function read(relPath: string): string {
  const full = resolve(ROOT, relPath);
  if (!existsSync(full)) throw new Error(`missing file: ${relPath}`);
  return readFileSync(full, "utf-8");
}

function markdownUnder(relDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(resolve(ROOT, dir))) {
      const rel = join(dir, name);
      if (statSync(resolve(ROOT, rel)).isDirectory()) walk(rel);
      else if (name.endsWith(".md")) out.push(rel);
    }
  };
  walk(relDir);
  return out;
}

const PROMPT_TREES = [".claude", ".github", ".kiro"];

const DEVELOPER = [
  ".claude/agents/developer.md",
  ".github/agents/developer.agent.md",
  ".kiro/agents/developer.md",
];

const TECHNICAL_WRITER = [
  ".claude/agents/technical-writer.md",
  ".github/agents/technical-writer.agent.md",
  ".kiro/agents/technical-writer.md",
];

const PRODUCT_ENGINEER = [
  ".claude/commands/product-engineer.md",
  ".github/agents/product-engineer.agent.md",
  ".kiro/agents/product-engineer.md",
];

const PLANNER = [
  ".claude/commands/planner.md",
  ".github/agents/planner.agent.md",
  ".kiro/agents/planner.md",
];

const IMPLEMENT = [
  ".claude/skills/implement/SKILL.md",
  ".github/instructions/implement.instructions.md",
  ".kiro/steering/implement.md",
];

/** The `## memo-cli Integration` section, up to the next `## ` heading. */
function memoSection(content: string): string {
  const start = content.indexOf("## memo-cli Integration");
  if (start === -1) return "";
  const next = content.indexOf("\n## ", start + 1);
  return content.slice(start, next === -1 ? undefined : next);
}

describe("memo-cli commands name the bank literally (#253 defect 1)", () => {
  const files = PROMPT_TREES.flatMap(markdownUnder);

  it("finds the prompt files it is meant to scan", () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it("no prompt passes --bank $MEMO_BANK, which is empty in a fresh shell", () => {
    const offenders = files.filter((f) =>
      /(?<!`)--bank\s+"?\$\{?MEMO_BANK(?![^\n`]*`)/.test(read(f)),
    );
    expect(offenders, "files still passing --bank $MEMO_BANK").toEqual([]);
  });

  it("no prompt tells an agent to export MEMO_BANK inside a shell block", () => {
    const offenders = files.filter((f) => /^\s*export MEMO_BANK=/m.test(read(f)));
    expect(offenders, "files still exporting MEMO_BANK").toEqual([]);
  });

  it("every developer memo write names developer-memory", () => {
    for (const f of DEVELOPER) {
      const writes = memoSection(read(f)).match(/memo write[\s\S]*?--json/g) ?? [];
      expect(writes.length, `${f} has no memo write`).toBeGreaterThanOrEqual(2);
      for (const w of writes) expect(w, f).toContain("--bank developer-memory");
    }
  });

  it("planner's run-outcome write names planner-memory", () => {
    for (const f of PLANNER) {
      expect(memoSection(read(f)), f).toContain("--bank planner-memory");
    }
  });
});

describe("semantic kb writes satisfy memo-cli's provenance rule (#253 defect 2)", () => {
  it("technical-writer never pairs --source agent with an optional provenance", () => {
    for (const f of TECHNICAL_WRITER) {
      const section = memoSection(read(f));
      expect(section, f).not.toMatch(/--provenance "[^"]*if any/);
      expect(section, f).toContain("--manual");
      expect(section, f).toMatch(/Never pass an empty `--provenance ""`/);
    }
  });

  it("product-engineer writes confirmed decisions to kb as --manual", () => {
    for (const f of PRODUCT_ENGINEER) {
      const section = memoSection(read(f));
      expect(section, f).toContain("Decision Write-Back");
      expect(section, f).toMatch(/--kind semantic[\s\S]*--bank kb[\s\S]*--manual/);
      expect(section, f).not.toMatch(/does NOT write to memo/);
    }
  });
});

describe("a memo write's result is recorded, never swallowed", () => {
  it("the developer closeout payload carries memo_intent and memo_outcome", () => {
    for (const f of DEVELOPER) {
      const payload = read(f).match(/BEGIN CLOSEOUT PAYLOAD[\s\S]*?END CLOSEOUT PAYLOAD/);
      expect(payload, `${f} has no closeout payload`).not.toBeNull();
      expect(payload![0], f).toMatch(
        /memo_intent: written\(<id>\) \| failed\(<reason>\) \| skipped\(<reason>\)/,
      );
      expect(payload![0], f).toMatch(
        /memo_outcome: written\(<id>\) \| failed\(<reason>\) \| skipped\(<reason>\)/,
      );
    }
  });

  it("the intent write is a numbered Execution Flow step, not prose elsewhere", () => {
    for (const f of DEVELOPER) {
      const flow = read(f).match(/## Execution Flow[\s\S]*?\n---\n/);
      expect(flow, `${f} has no Execution Flow`).not.toBeNull();
      expect(flow![0], f).toMatch(/^\d+\. \*\*memo intent/m);
      expect(flow![0], f).toMatch(/memo_outcome/);
    }
  });

  it("the implement skill carries both memo steps", () => {
    for (const f of IMPLEMENT) {
      const content = read(f);
      expect(content, f).toMatch(/^\d+\. \*\*memo intent/m);
      expect(content, f).toMatch(/^\d+\. \*\*memo outcome/m);
    }
  });

  it("planner treats an absent memo field as an incomplete story, not a failed one", () => {
    for (const f of PLANNER) {
      const gate3 = read(f).match(/^3\. Verify delegated closeout payload.*$/m);
      expect(gate3, `${f} missing merge gate 3`).not.toBeNull();
      expect(gate3![0], f).toMatch(/memo_intent/);
      expect(gate3![0], f).toMatch(/absent memo field marks the story incomplete/);
      expect(gate3![0], f).toMatch(/does \*\*NOT\*\* block the merge/);
    }
  });

  it("a configured repository without the binary warns instead of skipping silently", () => {
    for (const f of [...DEVELOPER, ...TECHNICAL_WRITER, ...PRODUCT_ENGINEER, ...PLANNER]) {
      const section = memoSection(read(f));
      expect(section, f).not.toMatch(/If `memo` is not found, skip all memo operations silently/);
      expect(section, f).toMatch(/`memo\.config\.json` exists/);
    }
  });
});

/** Text from `start` up to the next `### ` or `## ` heading. */
function subsection(content: string, start: string): string {
  const a = content.indexOf(start);
  if (a === -1) return "";
  const next = content.slice(a + start.length).search(/\n##+ /);
  return content.slice(a, next === -1 ? undefined : a + start.length + next);
}

describe("memo sections stay identical across platforms", () => {
  // product-engineer's read-side subsections already differed between
  // platforms before #253; only the parts this fix owns are compared.
  it("product-engineer's bank, availability, and write-back rules match their mirrors", () => {
    for (const heading of [
      "### Bank Declaration",
      "### Availability Check",
      "### Decision Write-Back",
    ]) {
      const [first, ...rest] = PRODUCT_ENGINEER.map((f) =>
        subsection(memoSection(read(f)), heading),
      );
      expect(first, heading).not.toBe("");
      for (const [i, other] of rest.entries())
        expect(other, `${PRODUCT_ENGINEER[i + 1]} ${heading}`).toBe(first);
    }
  });

  for (const group of [DEVELOPER, TECHNICAL_WRITER, PLANNER]) {
    it(`${group[0]} matches its mirrors`, () => {
      const [first, ...rest] = group.map((f) => memoSection(read(f)));
      for (const [i, other] of rest.entries()) expect(other, group[i + 1]).toBe(first);
    });
  }
});
