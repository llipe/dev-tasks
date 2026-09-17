/**
 * Cost controls — subagent model tiers and permission allowlist
 * (issue #174, task 6.0; see workstream/test-plan-claude-runtime-parity.md CP-06).
 *
 * Two independent contracts, both asserted here:
 *
 *   1. Every `.claude/agents/*.md` declares a `model:` value from the allowed
 *      set. Mechanical agents (`github-ops`, `housekeeping`, `technical-writer`,
 *      `researcher`) declare a smaller-tier model (`haiku`); judgement-heavy
 *      agents (`developer`, `verifier`, `qa-engineer`, `ux-engineer`) declare
 *      `inherit` so they keep running on the main thread's model. A missing
 *      `model:` field, or a value outside the allowed set (typo, deprecated
 *      identifier), fails the test.
 *
 *   2. `permissions.allow` in both `templates/claude/settings.json` and this
 *      repo's own `.claude/settings.json` contains only the read-only /
 *      quality-gate command set the issue names, and no write-capable
 *      pattern. A `git-guard.sh` invocation with the allowlist populated
 *      still blocks a disallowed command (exit 2) — the allowlist is a
 *      Claude Code host-level permission-prompt suppression, not a bypass
 *      of the deterministic hook guard.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const AGENTS_DIR = resolve(ROOT, ".claude/agents");
const HOOK = resolve(ROOT, ".claude/hooks/git-guard.sh");

/**
 * Allowed `model:` values for `.claude/agents/*.md` frontmatter, per Claude
 * Code's documented subagent frontmatter schema: a named tier alias, or
 * `inherit` to run on the conversation's (main-thread) model.
 *
 * NOTE (flagged for human confirmation — see closeout): this repo has no
 * prior `model:` reference to copy a convention from (checked
 * `.github/agents/*.md`, `.kiro/agents/*.md`, and docs mentioning model
 * tiers — none declare a Claude Code `model:` field). These identifiers
 * follow Claude Code's own documented subagent frontmatter convention as
 * best known at implementation time. Confirm against current Claude Code
 * docs before relying on this list long-term.
 */
const ALLOWED_MODELS = ["haiku", "sonnet", "opus", "inherit"];

/** Agents that MUST run on the smaller ("haiku") tier — mechanical work. */
const MECHANICAL_AGENTS = ["github-ops", "housekeeping", "technical-writer", "researcher"];

/** Agents left on the inherited (main-thread) model — judgement-heavy work. */
const INHERITED_AGENTS = ["developer", "verifier", "qa-engineer", "ux-engineer"];

function parseFrontmatterModel(content: string): string | undefined {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return undefined;
  const frontmatter = match[1];
  const modelLine = frontmatter.split("\n").find((line) => /^model:\s*/.test(line));
  if (!modelLine) return undefined;
  return modelLine
    .replace(/^model:\s*/, "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

describe("model tiers — every .claude/agents/*.md declares an allowed model", () => {
  const agentFiles = readdirSync(AGENTS_DIR).filter((f) => f.endsWith(".md"));

  it("finds at least the eight known agent files", () => {
    expect(agentFiles.length).toBeGreaterThanOrEqual(8);
  });

  for (const file of readdirSync(AGENTS_DIR).filter((f) => f.endsWith(".md"))) {
    const name = file.replace(/\.md$/, "");
    it(`${file} declares a model: value from the allowed set`, () => {
      const content = readFileSync(resolve(AGENTS_DIR, file), "utf-8");
      const model = parseFrontmatterModel(content);
      expect(model, `${file} is missing a model: frontmatter field`).toBeDefined();
      expect(
        ALLOWED_MODELS.includes(model as string),
        `${file} declares model: "${model}", not in allowed set [${ALLOWED_MODELS.join(", ")}]`,
      ).toBe(true);
    });

    if (MECHANICAL_AGENTS.includes(name)) {
      it(`${file} (mechanical agent) declares the smaller-tier model`, () => {
        const content = readFileSync(resolve(AGENTS_DIR, file), "utf-8");
        const model = parseFrontmatterModel(content);
        expect(model).toBe("haiku");
      });
    }

    if (INHERITED_AGENTS.includes(name)) {
      it(`${file} (judgement-heavy agent) declares inherit`, () => {
        const content = readFileSync(resolve(AGENTS_DIR, file), "utf-8");
        const model = parseFrontmatterModel(content);
        expect(model).toBe("inherit");
      });
    }
  }
});

/** The exact read-only / quality-gate command set the issue names. */
const EXPECTED_ALLOWLIST = [
  "Bash(git status:*)",
  "Bash(git diff:*)",
  "Bash(git log:*)",
  "Bash(git rev-parse:*)",
  "Bash(git branch:*)",
  "Bash(pnpm run lint:*)",
  "Bash(pnpm run test:*)",
  "Bash(pnpm run typecheck:*)",
  "Bash(pnpm run format:check:*)",
  "Bash(pnpm run audit:*)",
  "Bash(gh pr view:*)",
  "Bash(gh issue view:*)",
];

/** Patterns that must never appear in permissions.allow, however phrased. */
const WRITE_CAPABLE_PATTERNS = [
  /git\s+push/i,
  /git\s+commit/i,
  /git\s+merge/i,
  /gh\s+pr\s+merge/i,
  /gh\s+pr\s+create/i,
  /gh\s+pr\s+edit/i,
  /gh\s+issue\s+comment/i,
  /gh\s+issue\s+create/i,
  /gh\s+issue\s+edit/i,
  /gh\s+release/i,
  /git\s+tag/i,
  /\brm\b/,
  /\bmv\b/,
  /pnpm\s+run\s+(build|dev|deploy|publish|release)/i,
];

function loadAllowlist(relPath: string): string[] {
  const content = readFileSync(resolve(ROOT, relPath), "utf-8");
  const parsed = JSON.parse(content) as { permissions?: { allow?: string[] } };
  return parsed.permissions?.allow ?? [];
}

describe.each([["templates/claude/settings.json"], [".claude/settings.json"]])(
  "permission allowlist — %s",
  (relPath) => {
    it("contains exactly the expected read-only / quality-gate command set", () => {
      const allow = loadAllowlist(relPath);
      expect(new Set(allow)).toEqual(new Set(EXPECTED_ALLOWLIST));
    });

    it("contains no write-capable command pattern", () => {
      const allow = loadAllowlist(relPath);
      for (const entry of allow) {
        for (const pattern of WRITE_CAPABLE_PATTERNS) {
          expect(
            pattern.test(entry),
            `${relPath} entry "${entry}" matches write pattern ${pattern}`,
          ).toBe(false);
        }
      }
    });
  },
);

describe("permission allowlist — guard still blocks with the allowlist active", () => {
  let tmpDir: string;
  let rootDir: string;
  const STUB_BIN = resolve(ROOT, "test/fixtures/git-guard/bin");

  function git(args: string[], cwd: string): void {
    const result = spawnSync("git", args, { cwd, encoding: "utf-8" });
    if (result.status !== 0) {
      throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
    }
  }

  function runHook(command: string, cwd: string): { status: number; stderr: string } {
    const payload = JSON.stringify({ tool_input: { command } });
    const result = spawnSync("bash", [HOOK], {
      input: payload,
      encoding: "utf-8",
      cwd,
      env: {
        ...process.env,
        PATH: `${STUB_BIN}${delimiter}${process.env.PATH ?? ""}`,
      },
    });
    return { status: result.status ?? -1, stderr: result.stderr ?? "" };
  }

  beforeEach(() => {
    const root = mkdtempSync(resolve(tmpdir(), "model-tiers-allowlist-repo-"));
    const bareDir = resolve(root, "origin.git");
    const cloneDir = resolve(root, "clone");
    git(["init", "--bare", "-b", "main", bareDir], root);
    git(["clone", bareDir, cloneDir], root);
    git(["config", "user.email", "test@example.com"], cloneDir);
    git(["config", "user.name", "Test"], cloneDir);
    git(["commit", "--allow-empty", "-m", "chore: init"], cloneDir);
    git(["push", "origin", "HEAD:main"], cloneDir);
    git(["fetch", "origin"], cloneDir);
    git(["remote", "set-head", "origin", "main"], cloneDir);
    rootDir = root;
    tmpDir = cloneDir;
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it("still blocks `git push origin main` (a non-allowlisted write) with the allowlist populated", () => {
    // The allowlist only ever suppresses Claude Code's own permission
    // prompt for a matched read-only command; it is enforced by the host
    // application, not by this hook script, so the hook's own deterministic
    // block for a disallowed write command must be unaffected either way.
    const { status } = runHook("git push origin main", tmpDir);
    expect(status).toBe(2);
  });

  it("does not block an allowlisted read-only command (git status)", () => {
    const { status } = runHook("git status", tmpDir);
    expect(status).toBe(0);
  });
});
