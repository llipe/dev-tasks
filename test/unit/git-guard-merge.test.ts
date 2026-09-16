/**
 * Deterministic checks for git-guard rules 1 and 3 (issue #177, task 9.0).
 *
 * Confirmed live defect: rule 3 blocked `gh pr merge <n> --squash --delete-branch`
 * (the repository's own canonical merge command, which has no `--base` flag) while
 * permitting the unreviewable raw-git escape `git checkout integration/x && git merge
 * story/y && git push origin integration/x`. This file is the first coverage for
 * rules 1 and 3 (only rule 4 / tags had coverage before — see git-guard-tags.test.ts).
 *
 * The hook receives the PreToolUse payload as JSON on stdin; exit code 2 blocks the
 * command, exit 0 allows it. `gh` is stubbed via PATH (test/fixtures/git-guard/bin/gh)
 * so base-branch resolution never touches the network.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
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

/** Run the hook with a command string, return its exit code and stderr. */
function runHook(command: string, opts: RunOptions = {}): { status: number; stderr: string } {
  const payload = JSON.stringify({ tool_input: { command } });
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
  const root = mkdtempSync(resolve(tmpdir(), "git-guard-repo-"));
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

describe("git-guard rule 1 — push/merge into the default branch (generalized)", () => {
  let repo: { bareDir: string; cloneDir: string };

  beforeEach(() => {
    repo = makeRepoWithDefaultBranch("master");
  });

  afterEach(() => {
    rmSync(resolve(repo.cloneDir, ".."), { recursive: true, force: true });
  });

  it("blocks `git push origin master` when the resolved default branch is master", () => {
    const { status } = runHook("git push origin master", { cwd: repo.cloneDir });
    expect(status).toBe(2);
  });

  it("blocks `git push origin HEAD:master`", () => {
    const { status } = runHook("git push origin HEAD:master", { cwd: repo.cloneDir });
    expect(status).toBe(2);
  });

  it("blocks `git merge` while HEAD is the default branch (master)", () => {
    const { status } = runHook("git merge story/1-x", { cwd: repo.cloneDir });
    expect(status).toBe(2);
  });

  it("allows pushing a normal feature branch (master is default, not the target)", () => {
    const { status } = runHook("git push -u origin issue/1-x", { cwd: repo.cloneDir });
    expect(status).toBe(0);
  });
});

describe("git-guard rule 1 — raw-git escape from story/issue into integration", () => {
  let repo: { bareDir: string; cloneDir: string };

  beforeEach(() => {
    repo = makeRepoWithDefaultBranch("main");
    git(["checkout", "-b", "integration/parity-plan"], repo.cloneDir);
  });

  afterEach(() => {
    rmSync(resolve(repo.cloneDir, ".."), { recursive: true, force: true });
  });

  it("blocks `git merge story/1-x` while on an integration/* branch", () => {
    const { status, stderr } = runHook("git merge story/1-x", { cwd: repo.cloneDir });
    expect(status).toBe(2);
    expect(stderr).toContain("gh pr merge");
  });

  it("blocks `git merge issue/1-x` while on an integration/* branch", () => {
    const { status } = runHook("git merge issue/1-x", { cwd: repo.cloneDir });
    expect(status).toBe(2);
  });

  it("allows `gh pr merge` of a story PR into the integration branch (the reviewable path)", () => {
    const { status } = runHook("gh pr merge 42 --squash --delete-branch", {
      cwd: repo.cloneDir,
      env: { GIT_GUARD_STUB_PR_BASE: "integration/parity-plan" },
    });
    expect(status).toBe(0);
  });
});

describe("git-guard rule 3 — gh pr merge base resolution (real, not text-matched)", () => {
  it("blocks a PR merge whose resolved base is the default branch", () => {
    const { status, stderr } = runHook("gh pr merge 42 --squash --delete-branch", {
      env: { GIT_GUARD_STUB_PR_BASE: "main" },
    });
    expect(status).toBe(2);
    expect(stderr).toContain("main");
  });

  it("allows a PR merge whose resolved base is an integration branch", () => {
    const { status } = runHook("gh pr merge 42 --squash --delete-branch", {
      env: { GIT_GUARD_STUB_PR_BASE: "integration/parity-plan" },
    });
    expect(status).toBe(0);
  });

  it("allows the canonical merge command with no --base flag at all (the confirmed live defect)", () => {
    const { status } = runHook("gh pr merge 180 --squash --delete-branch", {
      env: { GIT_GUARD_STUB_PR_BASE: "integration/claude-runtime-parity-plan" },
    });
    expect(status).toBe(0);
  });

  it("resolves the PR number from a `#123` reference", () => {
    const { status } = runHook("gh pr merge #42 --squash --delete-branch", {
      env: { GIT_GUARD_STUB_PR_BASE: "main" },
    });
    expect(status).toBe(2);
  });

  it("resolves the current branch's PR when no number is given", () => {
    const { status } = runHook("gh pr merge --squash --delete-branch", {
      env: { GIT_GUARD_STUB_PR_BASE: "main" },
    });
    expect(status).toBe(2);
  });

  it("fails closed when the base lookup errors (unauthenticated / network failure)", () => {
    const { status, stderr } = runHook("gh pr merge 42 --squash --delete-branch", {
      env: { GIT_GUARD_STUB_PR_BASE_EXIT: "1" },
    });
    expect(status).toBe(2);
    expect(stderr).toContain("gh pr view");
  });

  it("blocks `gh pr merge --admin` outright regardless of base", () => {
    const { status } = runHook("gh pr merge 42 --admin", {
      env: { GIT_GUARD_STUB_PR_BASE: "integration/parity-plan" },
    });
    expect(status).toBe(2);
  });

  it("blocks `--auto` when the resolved base is the default branch", () => {
    const { status } = runHook("gh pr merge 42 --auto --squash", {
      env: { GIT_GUARD_STUB_PR_BASE: "main" },
    });
    expect(status).toBe(2);
  });

  it("allows `--auto` when the resolved base is an integration branch", () => {
    const { status } = runHook("gh pr merge 42 --auto --squash", {
      env: { GIT_GUARD_STUB_PR_BASE: "integration/parity-plan" },
    });
    expect(status).toBe(0);
  });
});

describe("git-guard header documents the fail-closed exception (task 9.3)", () => {
  it("mentions fail-closed as an exception to the default fail-open contract", () => {
    const result = spawnSync("grep", ["-i", "-c", "fail-closed", HOOK], { encoding: "utf-8" });
    expect(Number(result.stdout.trim())).toBeGreaterThan(0);
  });
});
