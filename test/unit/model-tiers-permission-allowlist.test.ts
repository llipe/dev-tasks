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
 *
 * NOTE (verifier audit fix, issue #174, round 2): the issue's original 6.4
 * text named `git branch` as one of the eleven read-only commands, but
 * Claude Code's `Bash(<prefix>:*)` permission pattern is a plain prefix
 * match with no subcommand/flag awareness, so `Bash(git branch:*)` also
 * silently pre-approved `git branch -D <name>` (delete) and `git branch -m
 * <old> <new>` (rename) — real write operations with no confirmation prompt
 * and no `git-guard.sh` backstop (that hook has no branch delete/rename
 * rule). There is no narrower Claude Code pattern that admits bare/listing
 * invocations while excluding `-D`/`-m` within a single prefix rule, so
 * `git branch` was dropped from the allowlist entirely rather than
 * mis-scoped; branch state remains visible via the already-allowed `git
 * status` and `git rev-parse --abbrev-ref HEAD`. See
 * `workstream/fidelity-report-174.md` (D-1) for the full drift writeup.
 *
 * NOTE (verifier audit fix, issue #174, round 3): the SAME class of bug was
 * found in a different entry, `Bash(pnpm run lint:*)`. `package.json`
 * defines both `"lint"` (read-only: `eslint . --max-warnings 0`) and
 * `"lint:fix"` (mutates files: `eslint . --fix`). The literal string
 * `pnpm run lint:fix` starts with the literal string `pnpm run lint` (there
 * is no space between "lint" and the colon), so the entry silently
 * pre-approved the file-mutating variant too, with zero backstop —
 * `git-guard.sh` has no rules for pnpm/npm commands at all. Fixed the same
 * way as `git branch`: dropped `Bash(pnpm run lint:*)` from
 * `permissions.allow` in both settings files.
 *
 * This round also fixed a bug in `allowlistEntryMatches()` itself: it
 * required a literal space right after the prefix before treating a longer
 * command as a valid continuation (`command === prefix || command.startsWith(
 * prefix + " ")`). That space requirement is why the round-2 regression
 * tests caught the space-separated `git branch -D`/`-m` case but completely
 * missed the colon-glued `pnpm run lint:fix` case — false confidence. Claude
 * Code's actual `Bash(<prefix>:*)` permission rule has no boundary
 * requirement at all; it is a true raw string-prefix match. The helper now
 * matches that (`command.startsWith(prefix)`), and a generic sweep test
 * below cross-references every `pnpm run <x>:*` allowlist prefix against
 * every actual `package.json` script name so this whole class of bug is
 * caught mechanically going forward, not just the two instances found by
 * hand so far. See `workstream/fidelity-report-174.md` (D-1, D-3) for the
 * full drift writeup.
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

/**
 * Reproduces Claude Code's permission-pattern matching for a single
 * `Bash(...)` allowlist entry against a literal shell command string.
 *
 * `Bash(<prefix>:*)` is a TRUE raw string-prefix match: it allows any
 * command whose text starts with `<prefix>`, with no space, colon, or word
 * boundary requirement of any kind. This is exactly the mechanism that let
 * `Bash(git branch:*)` silently pre-approve `git branch -D <name>` (delete)
 * and `git branch -m <old> <new>` (rename) alongside the intended bare
 * listing form, AND the mechanism that let `Bash(pnpm run lint:*)` silently
 * pre-approve `pnpm run lint:fix` (mutates files) alongside the intended
 * read-only `pnpm run lint` — see issue #174 fidelity report.
 *
 * NOTE (round 3 fix): an earlier version of this helper required a literal
 * space right after the prefix (`command === prefix || command.startsWith(
 * prefix + " ")`). That extra boundary requirement caught the
 * space-separated `git branch -D` case but missed the colon-glued
 * `pnpm run lint:fix` case entirely — a modeling bug that produced false
 * confidence. There is no boundary requirement in Claude Code's actual
 * behavior, so this helper has none either.
 *
 * `Bash(<literal>)` with no `:*` suffix is an exact match only.
 */
function allowlistEntryMatches(entry: string, command: string): boolean {
  const inner = entry.match(/^Bash\((.*)\)$/)?.[1];
  if (inner === undefined) return false;
  if (inner.endsWith(":*")) {
    const prefix = inner.slice(0, -2);
    return command.startsWith(prefix);
  }
  return command === inner;
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

    it("does not pre-approve `git branch -D <name>` (branch delete) via any entry", () => {
      const allow = loadAllowlist(relPath);
      const command = "git branch -D some-branch";
      const matches = allow.filter((entry) => allowlistEntryMatches(entry, command));
      expect(
        matches,
        `${relPath}: "${command}" matched allowlist entr${matches.length === 1 ? "y" : "ies"} [${matches.join(", ")}] — a prefix-matched "git branch:*" entry silently pre-approves delete, not just listing`,
      ).toEqual([]);
    });

    it("does not pre-approve `git branch -m <old> <new>` (branch rename) via any entry", () => {
      const allow = loadAllowlist(relPath);
      const command = "git branch -m old-name new-name";
      const matches = allow.filter((entry) => allowlistEntryMatches(entry, command));
      expect(
        matches,
        `${relPath}: "${command}" matched allowlist entr${matches.length === 1 ? "y" : "ies"} [${matches.join(", ")}] — a prefix-matched "git branch:*" entry silently pre-approves rename, not just listing`,
      ).toEqual([]);
    });

    it("does not pre-approve `pnpm run lint:fix` (lint autofix, mutates files) via any entry", () => {
      const allow = loadAllowlist(relPath);
      const command = "pnpm run lint:fix";
      const matches = allow.filter((entry) => allowlistEntryMatches(entry, command));
      expect(
        matches,
        `${relPath}: "${command}" matched allowlist entr${matches.length === 1 ? "y" : "ies"} [${matches.join(", ")}] — the literal string "pnpm run lint:fix" starts with the literal string "pnpm run lint" (no space between "lint" and the colon), so a prefix-matched "pnpm run lint:*" entry silently pre-approves the mutating autofix variant, not just the read-only lint check`,
      ).toEqual([]);
    });
  },
);

/**
 * Classifies a `package.json` script as write-capable (mutates the
 * filesystem) purely from its command text, recursing into any `pnpm run
 * <other>` it invokes. This intentionally does NOT flag `test:unit`/
 * `test:integration` as unsafe siblings of `test:*` — running tests isn't a
 * write — while still flagging `lint:fix` (`--fix`), `format` (`--write`),
 * and `build`/`prepublishOnly` (bare `tsc`, which emits `dist/`, unlike
 * `typecheck`'s `tsc --noEmit`).
 */
function isWriteCapableScript(
  name: string,
  scripts: Record<string, string>,
  seen: Set<string> = new Set(),
): boolean {
  if (seen.has(name)) return false;
  seen.add(name);
  const command = scripts[name];
  if (!command) return false;
  if (command.includes("--fix") || command.includes("--write")) return true;
  if (/\btsc\b/.test(command) && !command.includes("--noEmit")) return true;
  const referenced = [...command.matchAll(/pnpm run (\S+)/g)].map((m) => m[1]);
  return referenced.some((ref) => isWriteCapableScript(ref, scripts, seen));
}

/**
 * Generic, forward-looking sweep: rather than relying on hand-found
 * instances, cross-reference every `pnpm run <x>:*` allowlist prefix
 * against every write-capable script name in `package.json`. Claude Code's
 * `Bash(<prefix>:*)` rule is a true raw string-prefix match (see
 * `allowlistEntryMatches` above), so any allowlist prefix that is itself a
 * literal string-prefix of a *different, write-capable* script name
 * silently pre-approves that mutating script too. This is the general form
 * of the `git branch` (D-1) and `pnpm run lint:fix` (D-3) bugs, and catches
 * the whole class mechanically going forward instead of one instance at a
 * time. (Read-only siblings, like `test:unit` under `pnpm run test:*`, are
 * not a defect and must not be flagged.)
 */
describe.each([["templates/claude/settings.json"], [".claude/settings.json"]])(
  "permission allowlist — %s: pnpm run prefixes have no write-capable sibling-script collision",
  (relPath) => {
    const packageJson = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8")) as {
      scripts?: Record<string, string>;
    };
    const scripts = packageJson.scripts ?? {};
    const scriptNames = Object.keys(scripts);

    it("finds at least one known write-capable script (sanity check on the classifier)", () => {
      const writeCapable = scriptNames.filter((name) => isWriteCapableScript(name, scripts));
      expect(writeCapable).toEqual(expect.arrayContaining(["lint:fix", "format", "build"]));
    });

    it("has no pnpm run allowlist prefix that is a raw string-prefix of a write-capable sibling script", () => {
      const allow = loadAllowlist(relPath);
      for (const entry of allow) {
        const match = entry.match(/^Bash\(pnpm run (.+):\*\)$/);
        if (!match) continue;
        const prefix = match[1];
        const collisions = scriptNames.filter(
          (name) =>
            name !== prefix && name.startsWith(prefix) && isWriteCapableScript(name, scripts),
        );
        expect(
          collisions,
          `${relPath} entry "${entry}" (prefix "${prefix}") is a raw string-prefix of write-capable sibling script(s) [${collisions.join(", ")}] in package.json — Claude Code's Bash(<prefix>:*) pattern has no colon/word-boundary awareness, so this entry silently pre-approves those mutating scripts too`,
        ).toEqual([]);
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
