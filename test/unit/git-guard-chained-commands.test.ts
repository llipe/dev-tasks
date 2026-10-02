/**
 * Regression checks for issue #256: git-guard read a command's arguments to
 * the end of the whole command string instead of the end of that command.
 *
 * That produced false blocks and missed blocks from one root cause:
 *
 *   - A feature push chained with `gh pr create --base main` was blocked as a
 *     push to `main`, because `main` from `--base main` looked like a push
 *     destination.
 *   - `--tags` anywhere in the string (a commit message, an echo) was blocked
 *     as a tag push.
 *   - A greedy `.*git push` match checked only the LAST push, so
 *     `git push origin main && git push origin feat` was allowed. The same
 *     greedy read let `gh pr merge 12 && gh pr merge 13` check only #13, and
 *     `git tag --list; git tag v1.0.0` pass because one segment was a read.
 *
 * The guard now splits the command into simple-command segments, outside
 * quotes, and every rule reads its arguments from its own segment.
 */
import { spawnSync } from "node:child_process";
import { delimiter, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const CLAUDE_HOOK = resolve(ROOT, ".claude/hooks/git-guard.sh");
const KIRO_HOOK = resolve(ROOT, ".kiro/hooks/scripts/git-guard.sh");
const STUB_BIN = resolve(ROOT, "test/fixtures/git-guard/bin");

/** Run a hook with a command string, return its exit code (2 = block, 0 = allow). */
function runHook(hook: string, command: string, env: Record<string, string> = {}): number {
  const result = spawnSync("bash", [hook], {
    input: JSON.stringify({ tool_input: { command } }),
    encoding: "utf-8",
    cwd: ROOT,
    env: {
      ...process.env,
      PATH: `${STUB_BIN}${delimiter}${process.env.PATH ?? ""}`,
      GIT_GUARD_STUB_DEFAULT_BRANCH: "main",
      ...env,
    },
  });
  return result.status ?? -1;
}

const FEATURE = "issue/256-guard-segments";

describe("claude git-guard — chained commands no longer false-block", () => {
  const allowed: readonly string[] = [
    // The reported case: feature push, then open a PR against main.
    `git push -u origin ${FEATURE} && gh pr create --base main --title "fix: x" --body-file body.md`,
    `git push origin ${FEATURE}; gh pr create --base main --body-file body.md`,
    // The word `--tags` outside the push's own arguments.
    `git commit -m "fix(memo): cap the --tags template" && git push origin ${FEATURE}`,
    `git push origin ${FEATURE} && echo --tags`,
    `git push origin ${FEATURE} | tee push.log; echo main`,
    // A separator inside a quoted argument does not split the command.
    `git commit -m "fix: a; git push origin feat" && git push origin ${FEATURE}`,
    // Tag reads stay allowed, alone or chained.
    "git tag --list && git describe --tags",
    // A branch whose name merely starts with the default branch's name.
    "git push origin main-fix",
  ];
  for (const cmd of allowed) {
    it(`allows: ${cmd}`, () => {
      expect(runHook(CLAUDE_HOOK, cmd), cmd).toBe(0);
    });
  }
});

describe("claude git-guard — every segment is still checked", () => {
  const blocked: readonly string[] = [
    "git push origin main",
    "echo hi && git push origin main",
    "git status\ngit push origin main",
    // Previously missed: only the last push was read.
    `git push origin main && git push origin ${FEATURE}`,
    // Previously missed: refs/heads/ prefix on the destination.
    "git push origin HEAD:refs/heads/main",
    // Subshell and quoted forms still yield the destination.
    "x=$(git push origin main)",
    'bash -c "git push origin main"',
    // Tag pushes, alone or chained after a feature push.
    `git push origin ${FEATURE} && git push --tags`,
    "git push origin v1.2.3 && echo done",
    `git push --follow-tags origin ${FEATURE}`,
    "git push --mirror origin",
    // Previously missed: a tag read in one segment let another segment create a tag.
    "git tag --list; git tag v1.0.0",
  ];
  for (const cmd of blocked) {
    it(`blocks: ${JSON.stringify(cmd)}`, () => {
      expect(runHook(CLAUDE_HOOK, cmd), cmd).toBe(2);
    });
  }
});

describe("claude git-guard — gh pr merge is checked per segment", () => {
  it("blocks when any merged PR targets main, not only the last one", () => {
    const status = runHook(CLAUDE_HOOK, "gh pr merge 12 --squash && gh pr merge 13 --squash", {
      GIT_GUARD_STUB_PR_BASE_FOR_12: "main",
      GIT_GUARD_STUB_PR_BASE_FOR_13: "integration/x",
    });
    expect(status).toBe(2);
  });

  it("does not read a later command's --admin as this merge's flag", () => {
    const status = runHook(CLAUDE_HOOK, "gh pr merge 13 --squash && echo --admin", {
      GIT_GUARD_STUB_PR_BASE_FOR_13: "integration/x",
    });
    expect(status).toBe(0);
  });
});

describe("kiro git-guard — chained commands", () => {
  const allowed: readonly string[] = [
    `git push -u origin ${FEATURE} && gh pr create --base main --title t --body-file body.md`,
    "git push origin main-fix",
    "gh pr merge 5 --base integration/x && gh pr create --base main --body-file body.md",
  ];
  for (const cmd of allowed) {
    it(`allows: ${cmd}`, () => {
      expect(runHook(KIRO_HOOK, cmd), cmd).toBe(0);
    });
  }

  const blocked: readonly string[] = [
    "git push origin main",
    "git push origin HEAD:main",
    `git push origin main && git push origin ${FEATURE}`,
    "gh pr merge 5 --base main",
  ];
  for (const cmd of blocked) {
    it(`blocks: ${cmd}`, () => {
      expect(runHook(KIRO_HOOK, cmd), cmd).toBe(2);
    });
  }
});
