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
 *
 * PR #181 independent-audit follow-up fixes (task 9.0 continued):
 *   Fix 1 — the rule 1b raw-git-escape check only matched a bare `story/*`/`issue/*`
 *   merge argument, so `git merge origin/story/1-x`, `git merge remotes/origin/story/1-x`,
 *   and `git merge refs/heads/story/1-x` — all canonical ref-qualified forms per
 *   .claude/skills/git-ops/SKILL.md — bypassed the block entirely.
 *   Fix 2 — `gh_pr_merge_number()` only recognized a numeric token or `#123`; a branch
 *   name or PR URL target silently fell back to checking the CURRENT branch's PR
 *   instead of the one actually named. The stub's per-argument lookup table
 *   (`GIT_GUARD_STUB_PR_BASE_FOR_<KEY>`) lets a test give the named target a different
 *   base than the current-branch fallback, so it would catch a regression to that
 *   fallback behavior.
 *
 * Second-round independent audit (task 9.0, final scoped fix round):
 *   Gap A — `strip_merge_ref_prefix()` handled `refs/heads/`, bare `remotes/<remote>/`,
 *   and bare `<remote>/`, but not the fully-qualified `refs/remotes/<remote>/<branch>`
 *   form, so `git merge refs/remotes/origin/story/1-x` bypassed the block.
 *   Gap B — `git_merge_arg()` did naive "first non-dash token" scanning with no concept
 *   of a flag that consumes a following value, so `git merge -m "merge note" story/1-x`
 *   and `git merge --strategy-option theirs story/1-x` picked up the flag's VALUE
 *   (`merge`, `theirs`) as "the merge argument" and never inspected the real target.
 *   Gap C — the identical flag-value-confusion defect existed in `gh_pr_merge_number()`/
 *   `gh_pr_merge_target()`: `gh pr merge --subject 99 42 --squash --delete-branch` picked
 *   up `99` (the `--subject` value) as "the PR number" and verified the wrong PR, letting
 *   an unsafe merge of the real target (42) through undetected. Also fixed as part of the
 *   same rewrite: `gh pr merge --repo owner/repo 42 --squash` previously misattributed
 *   `owner/repo` as the target and false-positive-blocked a legitimate command.
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

  // Fix 1 (issue #177, PR #181 audit): the raw-git escape check only matched a
  // bare `story/*`/`issue/*` merge argument. `git merge origin/story/1-x`,
  // `git merge remotes/origin/story/1-x`, and `git merge refs/heads/story/1-x`
  // are all canonical ref-qualified forms (see .claude/skills/git-ops/SKILL.md
  // lines 61, 70) and previously bypassed the block entirely.
  it("blocks `git merge origin/story/1-x` while on an integration/* branch", () => {
    const { status, stderr } = runHook("git merge origin/story/1-x", { cwd: repo.cloneDir });
    expect(status).toBe(2);
    expect(stderr).toContain("gh pr merge");
  });

  it("blocks `git merge remotes/origin/story/1-x` while on an integration/* branch", () => {
    const { status } = runHook("git merge remotes/origin/story/1-x", { cwd: repo.cloneDir });
    expect(status).toBe(2);
  });

  it("blocks `git merge refs/heads/story/1-x` while on an integration/* branch", () => {
    const { status } = runHook("git merge refs/heads/story/1-x", { cwd: repo.cloneDir });
    expect(status).toBe(2);
  });

  it("blocks `git merge origin/issue/1-x` while on an integration/* branch", () => {
    const { status } = runHook("git merge origin/issue/1-x", { cwd: repo.cloneDir });
    expect(status).toBe(2);
  });

  // Gap A (second-round audit): the fully-qualified `refs/remotes/<remote>/<branch>`
  // form was not stripped, unlike `refs/heads/`, bare `remotes/<remote>/`, and bare
  // `<remote>/`.
  it("blocks `git merge refs/remotes/origin/story/1-x` while on an integration/* branch", () => {
    const { status, stderr } = runHook("git merge refs/remotes/origin/story/1-x", {
      cwd: repo.cloneDir,
    });
    expect(status).toBe(2);
    expect(stderr).toContain("gh pr merge");
  });

  it("blocks `git merge refs/remotes/upstream/issue/42-x` while on an integration/* branch", () => {
    const { status } = runHook("git merge refs/remotes/upstream/issue/42-x", {
      cwd: repo.cloneDir,
    });
    expect(status).toBe(2);
  });

  // Gap B (second-round audit): a value-consuming flag's following token must not
  // be mistaken for the merge target.
  it('blocks `git merge -m "merge note" story/1-x` while on an integration/* branch', () => {
    const { status } = runHook('git merge -m "merge note" story/1-x', { cwd: repo.cloneDir });
    expect(status).toBe(2);
  });

  it("blocks `git merge --strategy-option theirs story/1-x` while on an integration/* branch", () => {
    const { status } = runHook("git merge --strategy-option theirs story/1-x", {
      cwd: repo.cloneDir,
    });
    expect(status).toBe(2);
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

  // Fix 2 (issue #177, PR #181 audit): a branch name or PR URL is a valid
  // `gh pr merge` target too, not just a number or `#123`. The old code
  // silently fell back to the CURRENT branch's PR for either, so a crafted
  // `gh pr merge <other-branch-or-url>` could merge a different, unsafe PR
  // while the guard verified the wrong one. The stub's per-argument lookup
  // table (GIT_GUARD_STUB_PR_BASE_FOR_<KEY>) lets the fallback base and the
  // real target's base differ, so this test would pass falsely if the guard
  // still resolved the current branch's PR instead of the named target.
  it("resolves a branch-name target directly, not the current branch's PR", () => {
    const { status, stderr } = runHook("gh pr merge some-branch --squash --delete-branch", {
      env: {
        // What the CURRENT branch's PR would resolve to (safe) — must be
        // ignored in favor of the actual named target.
        GIT_GUARD_STUB_PR_BASE: "integration/parity-plan",
        // What `some-branch`'s PR actually targets (unsafe: the default branch).
        GIT_GUARD_STUB_PR_BASE_FOR_SOME_BRANCH: "main",
      },
    });
    expect(status).toBe(2);
    expect(stderr).toContain("main");
  });

  it("resolves a PR-URL target directly, not the current branch's PR", () => {
    const { status } = runHook(
      "gh pr merge https://github.com/o/r/pull/99 --squash --delete-branch",
      {
        env: {
          GIT_GUARD_STUB_PR_BASE: "integration/parity-plan",
          GIT_GUARD_STUB_PR_BASE_FOR_HTTPS___GITHUB_COM_O_R_PULL_99: "main",
        },
      },
    );
    expect(status).toBe(2);
  });

  it("allows a branch-name target whose resolved base is an integration branch", () => {
    const { status } = runHook("gh pr merge some-branch --squash --delete-branch", {
      env: {
        GIT_GUARD_STUB_PR_BASE: "main",
        GIT_GUARD_STUB_PR_BASE_FOR_SOME_BRANCH: "integration/parity-plan",
      },
    });
    expect(status).toBe(0);
  });

  // Gap C (second-round audit): `--subject`/`-t` (and other value-consuming flags)
  // must not have their VALUE mistaken for the PR number/target. `99` here is the
  // `--subject` value (a decoy that merely looks numeric); `42` is the real target.
  it("resolves the real PR number past a `--subject` flag value, not the flag's value", () => {
    const { status, stderr } = runHook("gh pr merge --subject 99 42 --squash --delete-branch", {
      env: {
        // Decoy PR 99's base (safe) — must NOT be what gets checked.
        GIT_GUARD_STUB_PR_BASE_FOR_99: "integration/parity-plan",
        // Real target PR 42's base (unsafe: the default branch).
        GIT_GUARD_STUB_PR_BASE_FOR_42: "main",
      },
    });
    expect(status).toBe(2);
    expect(stderr).toContain("main");
  });

  it("resolves the real PR target past a `--body` flag value", () => {
    const { status } = runHook('gh pr merge --body "some text" 42 --squash', {
      env: {
        GIT_GUARD_STUB_PR_BASE_FOR_42: "main",
      },
    });
    expect(status).toBe(2);
  });

  it("allows `gh pr merge --repo owner/repo 42 --squash` when 42's base is safe (no false-positive block)", () => {
    const { status } = runHook("gh pr merge --repo owner/repo 42 --squash", {
      env: {
        GIT_GUARD_STUB_PR_BASE_FOR_42: "integration/parity-plan",
      },
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
