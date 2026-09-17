/**
 * Deterministic checks for git-guard MCP coverage (issue #178, task 10.0).
 *
 * `.claude/settings.json` matched `"Bash"` only, so the four git-guard
 * invariants (merge/push to default, Conventional Commits, inline `--body`,
 * human-only tags) were bypassed completely by any consumer with the GitHub
 * MCP server enabled — `mcp__github__merge_pull_request` and friends never
 * ran through `git-guard.sh` at all. This file covers the fix: a second
 * `PreToolUse` matcher entry for the mutating MCP tool surface
 * (`mcp__github__merge_pull_request`, `enable_pr_auto_merge`, `push_files`,
 * `create_or_update_file`, `delete_file`, `create_branch`), and a guard
 * branch inside `git-guard.sh` that reads the PreToolUse payload's
 * structured `tool_name` / `tool_input` fields directly — never a
 * stringified/regexed version of `tool_input` — since MCP calls arrive as
 * JSON, not a shell command string.
 *
 * `gh` is stubbed via PATH (test/fixtures/git-guard/bin/gh) so base-branch
 * resolution never touches the network, exactly like git-guard-merge.test.ts.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const HOOK = resolve(ROOT, ".claude/hooks/git-guard.sh");
const STUB_BIN = resolve(ROOT, "test/fixtures/git-guard/bin");

interface RunOptions {
  cwd?: string;
  env?: Record<string, string>;
}

/** Run the hook with a structured MCP tool_name/tool_input payload. */
function runMcpHook(
  toolName: string,
  toolInput: Record<string, unknown>,
  opts: RunOptions = {},
): { status: number; stderr: string } {
  const payload = JSON.stringify({ tool_name: toolName, tool_input: toolInput });
  const result = spawnSync("bash", [HOOK], {
    input: payload,
    encoding: "utf-8",
    cwd: opts.cwd ?? ROOT,
    env: {
      ...process.env,
      PATH: `${STUB_BIN}${delimiter}${process.env.PATH ?? ""}`,
      ...opts.env,
    },
  });
  return { status: result.status ?? -1, stderr: result.stderr ?? "" };
}

function git(args: string[], cwd: string): void {
  const result = spawnSync("git", args, { cwd, encoding: "utf-8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
}

/** Build a local repo (no network) whose resolved default branch is `branchName`. */
function makeRepoWithDefaultBranch(branchName: string): { bareDir: string; cloneDir: string } {
  const root = mkdtempSync(resolve(tmpdir(), "git-guard-mcp-repo-"));
  const bareDir = resolve(root, "origin.git");
  const cloneDir = resolve(root, "clone");
  git(["init", "--bare", "-b", branchName, bareDir], root);
  git(["clone", bareDir, cloneDir], root);
  git(["config", "user.email", "test@example.com"], cloneDir);
  git(["config", "user.name", "Test"], cloneDir);
  git(["commit", "--allow-empty", "-m", "chore: init"], cloneDir);
  git(["push", "origin", `HEAD:${branchName}`], cloneDir);
  git(["fetch", "origin"], cloneDir);
  git(["remote", "set-head", "origin", branchName], cloneDir);
  return { bareDir, cloneDir };
}

// --- Matcher coverage (CT-01 / CP-10 positive assertion) ---------------------

describe("templates/claude/settings.json — MCP matcher coverage (#178)", () => {
  const MCP_MUTATING_TOOLS = [
    "mcp__github__merge_pull_request",
    "mcp__github__enable_pr_auto_merge",
    "mcp__github__push_files",
    "mcp__github__create_or_update_file",
    "mcp__github__delete_file",
    "mcp__github__create_branch",
  ] as const;

  const SETTINGS_FILES = [
    { label: "template", path: "templates/claude/settings.json" },
    { label: "repo", path: ".claude/settings.json" },
  ] as const;

  function readSettings(relPath: string): {
    hooks?: { PreToolUse?: Array<{ matcher?: string; hooks?: Array<{ command?: string }> }> };
  } {
    return JSON.parse(readFileSync(resolve(ROOT, relPath), "utf-8"));
  }

  for (const { label, path } of SETTINGS_FILES) {
    for (const tool of MCP_MUTATING_TOOLS) {
      it(`registers git-guard.sh for ${tool} (${label})`, () => {
        const settings = readSettings(path);
        const entries = settings.hooks?.PreToolUse ?? [];
        const matched = entries.filter((entry) => {
          if (!entry.matcher) return false;
          return new RegExp(`^(${entry.matcher})$`).test(tool);
        });
        const commands = matched.flatMap((entry) => entry.hooks ?? []).map((h) => h.command ?? "");
        expect(
          commands.some((cmd) => cmd.includes("git-guard.sh")),
          `expected some PreToolUse matcher to cover ${tool} and run git-guard.sh`,
        ).toBe(true);
      });
    }

    it(`does not match the non-mutating mcp__github__get_pull_request tool (${label})`, () => {
      const settings = readSettings(path);
      const entries = settings.hooks?.PreToolUse ?? [];
      const matched = entries.filter((entry) => {
        if (!entry.matcher) return false;
        return new RegExp(`^(${entry.matcher})$`).test("mcp__github__get_pull_request");
      });
      expect(matched.length).toBe(0);
    });
  }
});

// --- Behavioral: merge_pull_request / enable_pr_auto_merge -------------------

describe("git-guard MCP rule — mcp__github__merge_pull_request base resolution", () => {
  it("blocks a merge whose resolved base is the default branch", () => {
    const { status, stderr } = runMcpHook(
      "mcp__github__merge_pull_request",
      { owner: "llipe", repo: "dev-tasks", pullNumber: 42 },
      { env: { GIT_GUARD_STUB_PR_BASE: "main" } },
    );
    expect(status).toBe(2);
    expect(stderr).toContain("main");
  });

  it("allows a merge whose resolved base is an integration branch", () => {
    const { status } = runMcpHook(
      "mcp__github__merge_pull_request",
      { owner: "llipe", repo: "dev-tasks", pullNumber: 42 },
      { env: { GIT_GUARD_STUB_PR_BASE: "integration/parity-plan" } },
    );
    expect(status).toBe(0);
  });

  it("fails closed when the base lookup errors (unauthenticated / network failure)", () => {
    const { status, stderr } = runMcpHook(
      "mcp__github__merge_pull_request",
      { owner: "llipe", repo: "dev-tasks", pullNumber: 42 },
      { env: { GIT_GUARD_STUB_PR_BASE_EXIT: "1" } },
    );
    expect(status).toBe(2);
    expect(stderr).toContain("gh pr view");
  });

  it("fails closed when pullNumber is missing entirely (cannot verify base)", () => {
    const { status } = runMcpHook("mcp__github__merge_pull_request", {
      owner: "llipe",
      repo: "dev-tasks",
    });
    expect(status).toBe(2);
  });
});

describe("git-guard MCP rule — mcp__github__enable_pr_auto_merge", () => {
  it("blocks enabling auto-merge on a PR targeting the default branch", () => {
    const { status, stderr } = runMcpHook(
      "mcp__github__enable_pr_auto_merge",
      { owner: "llipe", repo: "dev-tasks", pullNumber: 7 },
      { env: { GIT_GUARD_STUB_PR_BASE: "main" } },
    );
    expect(status).toBe(2);
    expect(stderr).toContain("main");
  });

  it("allows enabling auto-merge on a PR targeting an integration branch", () => {
    const { status } = runMcpHook(
      "mcp__github__enable_pr_auto_merge",
      { owner: "llipe", repo: "dev-tasks", pullNumber: 7 },
      { env: { GIT_GUARD_STUB_PR_BASE: "integration/parity-plan" } },
    );
    expect(status).toBe(0);
  });
});

// --- Behavioral: push_files / create_or_update_file / delete_file -----------

describe("git-guard MCP rule — file-write tools targeting the default branch", () => {
  let repo: { bareDir: string; cloneDir: string };

  beforeEach(() => {
    repo = makeRepoWithDefaultBranch("main");
  });

  afterEach(() => {
    rmSync(resolve(repo.cloneDir, ".."), { recursive: true, force: true });
  });

  const CASES = [
    "mcp__github__push_files",
    "mcp__github__create_or_update_file",
    "mcp__github__delete_file",
  ] as const;

  for (const tool of CASES) {
    it(`blocks ${tool} with branch explicitly set to the default branch`, () => {
      const { status, stderr } = runMcpHook(
        tool,
        { owner: "llipe", repo: "dev-tasks", branch: "main", message: "chore: x" },
        { cwd: repo.cloneDir },
      );
      expect(status).toBe(2);
      expect(stderr).toContain("main");
    });

    it(`blocks ${tool} when branch is omitted (GitHub API defaults to the default branch)`, () => {
      const { status } = runMcpHook(
        tool,
        { owner: "llipe", repo: "dev-tasks", message: "chore: x" },
        { cwd: repo.cloneDir },
      );
      expect(status).toBe(2);
    });

    it(`allows ${tool} targeting a feature branch`, () => {
      const { status } = runMcpHook(
        tool,
        { owner: "llipe", repo: "dev-tasks", branch: "issue/1-x", message: "chore: x" },
        { cwd: repo.cloneDir },
      );
      expect(status).toBe(0);
    });
  }
});

// --- Behavioral: create_branch ------------------------------------------------

describe("git-guard MCP rule — mcp__github__create_branch", () => {
  let repo: { bareDir: string; cloneDir: string };

  beforeEach(() => {
    repo = makeRepoWithDefaultBranch("main");
  });

  afterEach(() => {
    rmSync(resolve(repo.cloneDir, ".."), { recursive: true, force: true });
  });

  it("blocks creating a branch literally named the default branch", () => {
    const { status } = runMcpHook(
      "mcp__github__create_branch",
      { owner: "llipe", repo: "dev-tasks", branch: "main" },
      { cwd: repo.cloneDir },
    );
    expect(status).toBe(2);
  });

  it("allows creating a normal feature branch", () => {
    const { status } = runMcpHook(
      "mcp__github__create_branch",
      { owner: "llipe", repo: "dev-tasks", branch: "issue/1-x", from_branch: "main" },
      { cwd: repo.cloneDir },
    );
    expect(status).toBe(0);
  });
});

// --- Negative / edge: non-mutating MCP calls are never blocked ---------------

describe("git-guard MCP rule — non-mutating MCP tool calls pass through untouched", () => {
  it("does not block mcp__github__get_pull_request even with a default-branch-shaped payload", () => {
    const { status } = runMcpHook("mcp__github__get_pull_request", {
      owner: "llipe",
      repo: "dev-tasks",
      pullNumber: 42,
      base: "main",
    });
    expect(status).toBe(0);
  });

  it("does not block an unrelated tool_name with no tool_input.command", () => {
    const { status } = runMcpHook("mcp__github__list_pull_requests", {
      owner: "llipe",
      repo: "dev-tasks",
    });
    expect(status).toBe(0);
  });
});
