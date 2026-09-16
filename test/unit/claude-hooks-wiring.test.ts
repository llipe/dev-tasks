/**
 * `doctor` check: Claude hook scripts must be wired into `.claude/settings.json`
 * (issue #169, task 1.7 / 1.11).
 *
 * `.claude/hooks/*.sh` can be installed while `.claude/settings.json` is
 * absent or stale (install-if-absent semantics never force a template
 * update onto a consumer-modified file), so `doctor` must independently
 * detect and name any hook script that no `PreToolUse` entry references.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { checkClaudeHooksWiring, runDoctor } from "#core/distribution/doctor.js";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("core/distribution/doctor — checkClaudeHooksWiring (#169)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "dev-tasks-claude-hooks-wiring-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function write(relPath: string, content: string): void {
    const fullPath = join(tmpDir, relPath);
    mkdirSync(join(fullPath, ".."), { recursive: true });
    writeFileSync(fullPath, content, "utf-8");
  }

  it("passes when there are no .claude/hooks/*.sh scripts", async () => {
    const result = await checkClaudeHooksWiring(tmpDir);
    expect(result.pass).toBe(true);
    expect(result.name).toBe("claude-hooks-wiring");
  });

  it("warns when hooks exist but .claude/settings.json is absent", async () => {
    write(".claude/hooks/git-guard.sh", "#!/bin/bash");
    const result = await checkClaudeHooksWiring(tmpDir);
    expect(result.pass).toBe(false);
    expect(result.message).toContain("git-guard.sh");
  });

  it("warns when settings.json exists but wires no matching PreToolUse entry", async () => {
    write(".claude/hooks/git-guard.sh", "#!/bin/bash");
    write(".claude/hooks/branch-guard.sh", "#!/bin/bash");
    write(
      ".claude/settings.json",
      JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: "Bash",
              hooks: [{ type: "command", command: 'bash ".claude/hooks/git-guard.sh"' }],
            },
          ],
        },
      }),
    );
    const result = await checkClaudeHooksWiring(tmpDir);
    expect(result.pass).toBe(false);
    expect(result.message).toContain("branch-guard.sh");
    expect(result.message).not.toContain("git-guard.sh, branch-guard.sh");
  });

  it("is silent (passes) when every hook script is wired", async () => {
    write(".claude/hooks/git-guard.sh", "#!/bin/bash");
    write(
      ".claude/settings.json",
      JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: "Bash",
              hooks: [
                {
                  type: "command",
                  command: 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/git-guard.sh"',
                },
              ],
            },
          ],
        },
      }),
    );
    const result = await checkClaudeHooksWiring(tmpDir);
    expect(result.pass).toBe(true);
  });

  it("fails gracefully (reports, does not throw) when settings.json is not valid JSON", async () => {
    write(".claude/hooks/git-guard.sh", "#!/bin/bash");
    write(".claude/settings.json", "{ not valid json");
    const result = await checkClaudeHooksWiring(tmpDir);
    expect(result.pass).toBe(false);
    expect(result.message).toMatch(/git-guard\.sh/);
  });

  it("is included in runDoctor's check list", async () => {
    const checks = await runDoctor({ repoRoot: tmpDir, cacheDir: tmpDir });
    expect(checks.map((c) => c.name)).toContain("claude-hooks-wiring");
  });
});
