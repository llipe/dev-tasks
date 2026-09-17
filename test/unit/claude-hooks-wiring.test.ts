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
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  statSync,
  existsSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const ROOT = resolve(__dirname, "../..");

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

/**
 * Deterministic enforcement parity (issue #170, task 2.0): Claude Code
 * writes files through `Edit`/`Write`, never `Bash`, so `git-guard.sh`
 * (matched on `Bash` only) never observes a single file write. This block
 * asserts the shipped template and this repo's own `.claude/settings.json`
 * both register `branch-guard.sh` on the write-tool matchers, alongside the
 * existing `git-guard.sh` registration on `Bash`, and that both hook
 * scripts exist and are executable.
 */
describe("templates/claude/settings.json — hook registration (#170)", () => {
  const SETTINGS_FILES = [
    { label: "template", path: "templates/claude/settings.json" },
    { label: "repo", path: ".claude/settings.json" },
  ] as const;

  function readSettings(relPath: string): {
    hooks?: { PreToolUse?: Array<{ matcher?: string; hooks?: Array<{ command?: string }> }> };
  } {
    return JSON.parse(readFileSync(resolve(ROOT, relPath), "utf-8"));
  }

  function commandsFor(settings: ReturnType<typeof readSettings>, matcher: string): string[] {
    const entries = settings.hooks?.PreToolUse ?? [];
    return entries
      .filter((entry) => entry.matcher === matcher)
      .flatMap((entry) => entry.hooks ?? [])
      .map((hook) => hook.command ?? "");
  }

  for (const { label, path } of SETTINGS_FILES) {
    it(`registers git-guard.sh on the Bash matcher (${label})`, () => {
      const settings = readSettings(path);
      const commands = commandsFor(settings, "Bash");
      expect(commands.some((cmd) => cmd.includes("git-guard.sh"))).toBe(true);
    });

    it(`registers branch-guard.sh on the Edit|Write|NotebookEdit matcher (${label})`, () => {
      const settings = readSettings(path);
      const commands = commandsFor(settings, "Edit|Write|NotebookEdit");
      expect(commands.some((cmd) => cmd.includes("branch-guard.sh"))).toBe(true);
    });
  }

  it("ships .claude/hooks/branch-guard.sh as an executable file", () => {
    const scriptPath = resolve(ROOT, ".claude/hooks/branch-guard.sh");
    expect(existsSync(scriptPath)).toBe(true);
    const mode = statSync(scriptPath).mode;
    expect(mode & 0o111).not.toBe(0);
  });

  it("ships .claude/hooks/git-guard.sh as an executable file", () => {
    const scriptPath = resolve(ROOT, ".claude/hooks/git-guard.sh");
    expect(existsSync(scriptPath)).toBe(true);
    const mode = statSync(scriptPath).mode;
    expect(mode & 0o111).not.toBe(0);
  });

  it("branch-guard.sh does not reference Kiro's toolArgs limitation", () => {
    const scriptPath = resolve(ROOT, ".claude/hooks/branch-guard.sh");
    const contents = readFileSync(scriptPath, "utf-8");
    expect(contents).not.toContain("toolArgs");
  });
});
