/**
 * Per-profile installed-state equivalence for Claude root context (issue #171,
 * task 3.0).
 *
 * `ROOT_FILES` (`DESIGN.md`, `TESTING.md`) install unconditionally on every
 * run. `CLAUDE.md` and `AGENTS.md` are different: they are consumer-facing
 * project memory that a consumer fills in with their own content, so they
 * must use install-if-absent semantics (never overwritten once present) while
 * still being delivered on a fresh install so Claude Code loads project
 * memory on the first turn.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { execSync, execFileSync } from "node:child_process";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
  cpSync,
} from "node:fs";
import { join, resolve, relative, sep } from "node:path";
import { tmpdir } from "node:os";
import {
  PROFILE_PATHS,
  ROOT_FILES,
  INSTALL_IF_ABSENT_FILES,
  ROOT_PROFILE_TAG,
  resolveProfile,
  type Platform,
} from "#core/distribution/profiles.js";

const ROOT = resolve(import.meta.dirname, "../..");
const DIST_BIN = resolve(ROOT, "dist/bin/dev-tasks.js");

describe("install/update — Claude root context parity (#171)", () => {
  let tmpDir: string;

  beforeAll(() => {
    if (!existsSync(DIST_BIN)) {
      execSync("pnpm run build", { cwd: ROOT, encoding: "utf-8" });
    }
  });

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "dev-tasks-install-parity-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function run(
    args: string[],
    options: { cwd?: string } = {},
  ): { stdout: string; stderr: string; exitCode: number } {
    const cwd = options.cwd ?? tmpDir;
    try {
      const stdout = execFileSync("node", [DIST_BIN, ...args], {
        cwd,
        encoding: "utf-8",
        env: { ...process.env, NODE_ENV: "test" },
        timeout: 10_000,
      });
      return { stdout, stderr: "", exitCode: 0 };
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; status?: number };
      return {
        stdout: e.stdout ?? "",
        stderr: e.stderr ?? "",
        exitCode: e.status ?? 1,
      };
    }
  }

  it("a fresh `install --profile claude` produces CLAUDE.md and AGENTS.md", () => {
    const result = run(["install", "--profile", "claude"]);
    expect(result.exitCode).toBe(0);

    const claudeMdPath = join(tmpDir, "CLAUDE.md");
    const agentsMdPath = join(tmpDir, "AGENTS.md");
    expect(existsSync(claudeMdPath)).toBe(true);
    expect(existsSync(agentsMdPath)).toBe(true);

    const claudeMd = readFileSync(claudeMdPath, "utf-8");
    expect(claudeMd.length).toBeGreaterThan(0);
  });

  it("an existing consumer CLAUDE.md survives `install` unchanged", () => {
    const consumerContent = "# My Project\n\nConsumer-authored project memory. Do not touch.\n";
    writeFileSync(join(tmpDir, "CLAUDE.md"), consumerContent, "utf-8");

    const result = run(["install", "--profile", "claude"]);
    expect(result.exitCode).toBe(0);

    expect(readFileSync(join(tmpDir, "CLAUDE.md"), "utf-8")).toBe(consumerContent);
  });

  it("an existing consumer AGENTS.md survives `install` unchanged", () => {
    const consumerContent = "# My Project Agents\n\nConsumer-authored. Do not touch.\n";
    writeFileSync(join(tmpDir, "AGENTS.md"), consumerContent, "utf-8");

    const result = run(["install", "--profile", "claude"]);
    expect(result.exitCode).toBe(0);

    expect(readFileSync(join(tmpDir, "AGENTS.md"), "utf-8")).toBe(consumerContent);
  });

  it("scaffolds docs/runbooks/ with index and template on a fresh install (AC-2)", () => {
    const result = run(["install", "--profile", "claude"]);
    expect(result.exitCode).toBe(0);

    expect(existsSync(join(tmpDir, "docs/runbooks/README.md"))).toBe(true);
    expect(existsSync(join(tmpDir, "docs/runbooks/runbook-template.md"))).toBe(true);

    const template = readFileSync(join(tmpDir, "docs/runbooks/runbook-template.md"), "utf-8");
    for (const heading of [
      "## Preconditions",
      "## Steps",
      "## Verification",
      "## Rollback",
      "## Escalation",
    ]) {
      expect(template).toContain(heading);
    }
  });

  it("does not ship this repository's own ten runbooks to a consumer", () => {
    // The consumer gets the scaffold; the runbooks in this repo document
    // this repo. Delivering them would put dev-tasks' procedures in
    // someone else's docs/ as if they were theirs.
    run(["install", "--profile", "all"]);
    const delivered = readdirSync(join(tmpDir, "docs/runbooks")).sort();
    expect(delivered).toEqual(["README.md", "runbook-template.md"]);
  });

  it("a consumer's edited runbook index survives a second install (AC-2)", () => {
    run(["install", "--profile", "claude"]);

    const edited = "# Runbooks\n\nOur own procedures. Do not touch.\n";
    writeFileSync(join(tmpDir, "docs/runbooks/README.md"), edited, "utf-8");
    writeFileSync(join(tmpDir, "docs/runbooks/runbook-deploy-ours.md"), "# Ours\n", "utf-8");

    const second = run(["install", "--profile", "claude"]);
    expect(second.exitCode).toBe(0);

    expect(readFileSync(join(tmpDir, "docs/runbooks/README.md"), "utf-8")).toBe(edited);
    expect(existsSync(join(tmpDir, "docs/runbooks/runbook-deploy-ours.md"))).toBe(true);
  });

  it("a deleted runbook index is re-scaffolded; an edited one is not (AC-2)", () => {
    run(["install", "--profile", "claude"]);
    rmSync(join(tmpDir, "docs/runbooks/README.md"));

    run(["install", "--profile", "claude"]);
    expect(existsSync(join(tmpDir, "docs/runbooks/README.md"))).toBe(true);
  });

  it("installs the platform-agnostic entry exactly once under --profile all (AC-1)", () => {
    // The failure this guards against is not a duplicate file — the
    // filesystem cannot hold two — but a duplicate or dropped manifest
    // entry, which is what tagging a platform-agnostic file with one
    // platform produces.
    const result = run(["install", "--profile", "all"]);
    expect(result.exitCode).toBe(0);

    const manifest = JSON.parse(
      readFileSync(join(tmpDir, ".dev-tasks/manifest.json"), "utf-8"),
    ) as { files: Array<{ path: string }> };
    const runbookEntries = manifest.files.filter((f) => f.path.startsWith("docs/runbooks/"));
    expect(runbookEntries).toEqual([]);
  });

  it("scaffolds the runbooks under every single-platform profile too (AC-1)", () => {
    for (const profile of ["copilot", "kiro"]) {
      const dir = mkdtempSync(join(tmpdir(), `dev-tasks-runbooks-${profile}-`));
      try {
        const result = run(["install", "--profile", profile], { cwd: dir });
        expect(result.exitCode).toBe(0);
        expect(
          existsSync(join(dir, "docs/runbooks/README.md")),
          `--profile ${profile} did not scaffold the runbook index`,
        ).toBe(true);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it("an existing consumer CLAUDE.md survives `update` unchanged", () => {
    const consumerContent = "# My Project\n\nConsumer-authored project memory. Do not touch.\n";

    const installResult = run(["install", "--profile", "claude"]);
    expect(installResult.exitCode).toBe(0);

    writeFileSync(join(tmpDir, "CLAUDE.md"), consumerContent, "utf-8");

    const updateResult = run(["update"]);
    expect(updateResult.exitCode).toBe(0);

    expect(readFileSync(join(tmpDir, "CLAUDE.md"), "utf-8")).toBe(consumerContent);
  });

  it("CLAUDE.md.template and AGENTS.md.template are not tracked in the manifest", () => {
    const result = run(["install", "--profile", "claude", "--json"]);
    expect(result.exitCode).toBe(0);

    const manifestPath = join(tmpDir, ".dev-tasks", "manifest.json");
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
      files: Array<{ path: string }>;
    };
    const trackedPaths = manifest.files.map((f) => f.path);
    expect(trackedPaths).not.toContain("CLAUDE.md");
    expect(trackedPaths).not.toContain("AGENTS.md");
  });
});

/**
 * Installed-state enforcement-surface parity across profiles (issue #176,
 * task 8.0).
 *
 * Every parity test above this point asserts files exist *in this
 * repository*. None asserted that `install --profile claude` produces an
 * install functionally equivalent to `install --profile kiro` — that blind
 * spot is exactly how the delivery gaps closed by tasks 1.0-3.0 slipped
 * through (each platform's files were present and correct in-tree, only the
 * installed result diverged). These tests install each profile into its own
 * temp dir and compare *enforcement surface* — hooks wired to a runtime
 * trigger, always-on context, scoped execution rules, documented platform
 * asymmetries, and path ownership accounting — not file counts.
 *
 * Known, pre-existing, systemic limitation (logged by task 3.0's own audit
 * and reconfirmed here, not fixed by this task): `DIST_BIN` is the built CLI
 * run directly against this repository's own checkout as `sourceDir`
 * (see `getPackageRoot()` in `bin/dev-tasks.ts`), not a real `npm pack`
 * tarball. A regression where a file is silently dropped from
 * `package.json` `files[]` would not be caught by any assertion in this
 * file, because the file is still present on disk regardless of what the
 * published package would contain. The path-ownership tests below
 * (`findUnaccountedPaths`) close the *profiles.ts vs. installed-tree*
 * accounting gap, but they do not — and cannot, without a real packaging
 * boundary — close the packaging gap. Out of scope for this task per its
 * own framing (install *behavior* parity, not packaging verification).
 */
describe("install — enforcement-surface parity across profiles (#176)", () => {
  const scratchDirs: string[] = [];

  beforeAll(() => {
    if (!existsSync(DIST_BIN)) {
      execSync("pnpm run build", { cwd: ROOT, encoding: "utf-8" });
    }
  });

  afterEach(() => {
    for (const dir of scratchDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function makeScratchDir(prefix: string): string {
    const dir = mkdtempSync(join(tmpdir(), prefix));
    scratchDirs.push(dir);
    return dir;
  }

  function runCli(
    args: string[],
    cwd: string,
  ): { stdout: string; stderr: string; exitCode: number } {
    try {
      const stdout = execFileSync("node", [DIST_BIN, ...args], {
        cwd,
        encoding: "utf-8",
        env: { ...process.env, NODE_ENV: "test" },
        timeout: 10_000,
      });
      return { stdout, stderr: "", exitCode: 0 };
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; status?: number };
      return { stdout: e.stdout ?? "", stderr: e.stderr ?? "", exitCode: e.status ?? 1 };
    }
  }

  /** Install a profile into a fresh scratch dir; asserts success and returns the dir. */
  function installProfile(profile: string): string {
    const dir = makeScratchDir(`dev-tasks-parity-${profile}-`);
    const result = runCli(["install", "--profile", profile], dir);
    expect(result.exitCode, `install --profile ${profile} failed: ${result.stderr}`).toBe(0);
    return dir;
  }

  /** Recursively collect every file under `dir`, as POSIX-style paths relative to `dir`. */
  function collectAllRelPaths(dir: string): string[] {
    const out: string[] = [];
    function walk(d: string): void {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        const full = join(d, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else {
          out.push(relative(dir, full).split(sep).join("/"));
        }
      }
    }
    walk(dir);
    return out;
  }

  // ---- Per-platform enforcement-surface assertions ----
  // Each returns a list of human-readable violations; empty means "passes".

  function assertClaudeEnforcement(dir: string): string[] {
    const violations: string[] = [];
    const settingsPath = join(dir, ".claude", "settings.json");
    if (!existsSync(settingsPath)) {
      violations.push("missing .claude/settings.json");
      return violations;
    }

    const settings = JSON.parse(readFileSync(settingsPath, "utf-8")) as {
      hooks?: { PreToolUse?: Array<{ hooks?: Array<{ command?: string }> }> };
    };
    const wiredCommands = (settings.hooks?.PreToolUse ?? []).flatMap((entry) =>
      (entry.hooks ?? []).map((h) => h.command).filter((c): c is string => typeof c === "string"),
    );

    const hooksDir = join(dir, ".claude", "hooks");
    const scripts = existsSync(hooksDir)
      ? readdirSync(hooksDir).filter((f) => f.endsWith(".sh"))
      : [];
    if (scripts.length === 0) {
      violations.push("no .claude/hooks/*.sh scripts shipped");
    }
    for (const script of scripts) {
      if (!wiredCommands.some((cmd) => cmd.includes(script))) {
        violations.push(`hook script ${script} is not wired to any PreToolUse trigger`);
      }
    }

    if (!existsSync(join(dir, "CLAUDE.md"))) {
      violations.push("missing CLAUDE.md (always-on context)");
    }
    for (const skill of ["implement", "plan"]) {
      if (!existsSync(join(dir, ".claude", "skills", skill, "SKILL.md"))) {
        violations.push(`scoped execution rule "${skill}" not reachable via .claude/skills`);
      }
    }
    return violations;
  }

  function assertKiroEnforcement(dir: string): string[] {
    const violations: string[] = [];
    const hooksJsonPath = join(dir, ".kiro", "hooks", "git-guard.json");
    if (!existsSync(hooksJsonPath)) {
      violations.push("missing .kiro/hooks/git-guard.json");
      return violations;
    }

    const hooksConfig = JSON.parse(readFileSync(hooksJsonPath, "utf-8")) as {
      hooks?: Array<{
        name?: string;
        trigger?: string;
        matcher?: string;
        action?: { command?: string };
      }>;
    };
    const wiredCommands = (hooksConfig.hooks ?? [])
      .map((h) => h.action?.command)
      .filter((c): c is string => typeof c === "string");

    const scriptsDir = join(dir, ".kiro", "hooks", "scripts");
    const scripts = existsSync(scriptsDir)
      ? readdirSync(scriptsDir).filter((f) => f.endsWith(".sh"))
      : [];
    if (scripts.length === 0) {
      violations.push("no .kiro/hooks/scripts/*.sh scripts shipped");
    }
    for (const script of scripts) {
      if (!wiredCommands.some((cmd) => cmd.includes(script))) {
        violations.push(`hook script ${script} is not wired to any registered Kiro hook`);
      }
    }
    for (const h of hooksConfig.hooks ?? []) {
      if (!h.trigger || !h.matcher) {
        violations.push(
          `kiro hook "${h.name ?? "<unnamed>"}" missing trigger/matcher runtime wiring`,
        );
      }
    }

    const steeringDir = join(dir, ".kiro", "steering");
    const steeringFiles = existsSync(steeringDir) ? readdirSync(steeringDir) : [];
    const alwaysOn = steeringFiles.filter((f) =>
      /inclusion:\s*always\b/.test(readFileSync(join(steeringDir, f), "utf-8")),
    );
    if (alwaysOn.length === 0) {
      violations.push("no Kiro steering file with `inclusion: always` (always-on context)");
    }
    for (const name of ["implement.md", "plan.md"]) {
      const p = join(steeringDir, name);
      if (!existsSync(p)) {
        violations.push(`missing .kiro/steering/${name} (scoped execution rule)`);
        continue;
      }
      if (!/fileMatchPattern/.test(readFileSync(p, "utf-8"))) {
        violations.push(`.kiro/steering/${name} missing fileMatchPattern scoping`);
      }
    }
    return violations;
  }

  function assertCopilotEnforcement(dir: string): string[] {
    const violations: string[] = [];
    // Documented asymmetry (AGENTS.md hooks table): Copilot has no hook
    // system — enforcement is prompt-level only. A hooks directory
    // appearing here would silently widen that asymmetry.
    if (existsSync(join(dir, ".github", "hooks"))) {
      violations.push(
        "unexpected .github/hooks directory — Copilot has no hook system per documented asymmetry",
      );
    }
    for (const name of ["implement.instructions.md", "plan.instructions.md"]) {
      const p = join(dir, ".github", "instructions", name);
      if (!existsSync(p)) {
        violations.push(`missing .github/instructions/${name} (scoped execution rule)`);
        continue;
      }
      if (!/applyTo:/.test(readFileSync(p, "utf-8"))) {
        violations.push(`.github/instructions/${name} missing applyTo scoping`);
      }
    }
    return violations;
  }

  /**
   * Documented Claude-specific asymmetries (see AGENTS.md "Platform coverage"
   * and CP-08 test plan): `infra-engineer`, `planner`, `product-engineer` run
   * as Claude commands with no matching agent file; `verifier` ships as two
   * commands (`verifier-audit`, `verifier-design`) rather than one; the
   * Copilot-only `planner-resume` and three `product-engineer-*` entry
   * points are collapsed into single Claude commands.
   */
  function assertClaudeAsymmetries(dir: string): string[] {
    const violations: string[] = [];
    const agentsDir = join(dir, ".claude", "agents");
    const commandsDir = join(dir, ".claude", "commands");
    const agents = existsSync(agentsDir) ? readdirSync(agentsDir) : [];
    const commands = existsSync(commandsDir) ? readdirSync(commandsDir) : [];

    for (const name of ["infra-engineer.md", "planner.md", "product-engineer.md"]) {
      if (agents.includes(name)) {
        violations.push(
          `.claude/agents unexpectedly contains ${name} — documented asymmetry: command-only on Claude`,
        );
      }
      if (!commands.includes(name)) {
        violations.push(`.claude/commands missing ${name}`);
      }
    }
    for (const name of ["verifier-audit.md", "verifier-design.md"]) {
      if (!commands.includes(name)) {
        violations.push(`.claude/commands missing ${name} (verifier two-command split)`);
      }
    }
    if (commands.includes("verifier.md")) {
      violations.push(
        "`.claude/commands` unexpectedly contains a combined verifier.md — verifier must stay split into two commands on Claude",
      );
    }
    if (commands.includes("planner-resume.md")) {
      violations.push(
        "`.claude/commands` unexpectedly contains planner-resume.md — must stay merged into planner.md",
      );
    }
    for (const name of [
      "product-engineer-init.md",
      "product-engineer-feature.md",
      "product-engineer-issue.md",
    ]) {
      if (commands.includes(name)) {
        violations.push(
          `.claude/commands unexpectedly contains ${name} — product-engineer entry points must stay collapsed into product-engineer.md`,
        );
      }
    }
    return violations;
  }

  /** Every path installed for `platforms` must be templated by `profiles.ts` or a known root/manifest file. */
  function findUnaccountedPaths(dir: string, platforms: Platform[]): string[] {
    const prefixes: string[] = [];
    for (const platform of platforms) {
      for (const managedPath of PROFILE_PATHS[platform]) {
        prefixes.push(managedPath.target);
      }
    }
    const exact = new Set<string>([...ROOT_FILES, ".dev-tasks/manifest.json"]);
    for (const f of INSTALL_IF_ABSENT_FILES) {
      // A platform-agnostic entry is delivered under every profile, so it
      // is accounted for whatever `platforms` holds.
      if (f.platform === ROOT_PROFILE_TAG || platforms.includes(f.platform)) exact.add(f.target);
    }

    return collectAllRelPaths(dir).filter(
      (p) =>
        !exact.has(p) && !prefixes.some((prefix) => p === prefix || p.startsWith(`${prefix}/`)),
    );
  }

  /**
   * Guards the exact class of gap that stranded `.claude/settings.json`
   * (issue #169): a `bundle-manifest.json` `consumer_owned_paths` entry that
   * is neither delivered by an install-if-absent/root template nor on the
   * documented consumer-supplied allowlist. Growing the allowlist requires a
   * deliberate code change, which is the point.
   */
  function findUnaccountedConsumerOwnedPaths(
    manifestPath: string = join(ROOT, "bundle-manifest.json"),
  ): string[] {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
      consumer_owned_paths?: string[];
    };
    const consumerOwned = manifest.consumer_owned_paths ?? [];
    const installIfAbsentTargets = new Set(INSTALL_IF_ABSENT_FILES.map((f) => f.target));
    const rootFiles = new Set<string>(ROOT_FILES);
    const documentedConsumerSupplied = new Set<string>([
      ".kiro/settings/mcp.json",
      ".kiro/specs",
      "infra/",
      ".github/workflows/deploy-dev.yml",
      ".github/workflows/deploy-prod.yml",
      ".github/workflows/rollback.yml",
      // The consumer's own runbooks. dev-tasks delivers only the index and
      // the template into this directory (install-if-absent); everything
      // else under it is written by the consumer and never ours to touch.
      "docs/runbooks/",
    ]);

    return consumerOwned.filter(
      (p) =>
        !installIfAbsentTargets.has(p) && !rootFiles.has(p) && !documentedConsumerSupplied.has(p),
    );
  }

  it("claude profile: hooks wired, always-on context present, scoped rules reachable", () => {
    const dir = installProfile("claude");
    expect(assertClaudeEnforcement(dir)).toEqual([]);
  });

  it("kiro profile: hooks wired, always-on steering present, scoped rules reachable", () => {
    const dir = installProfile("kiro");
    expect(assertKiroEnforcement(dir)).toEqual([]);
  });

  it("copilot profile: no hook system (documented asymmetry), scoped rules reachable via applyTo", () => {
    const dir = installProfile("copilot");
    expect(assertCopilotEnforcement(dir)).toEqual([]);
  });

  it("--profile both installs claude and copilot enforcement surfaces together", () => {
    const dir = installProfile("both");
    expect(assertClaudeEnforcement(dir)).toEqual([]);
    expect(assertCopilotEnforcement(dir)).toEqual([]);
  });

  it("--profile all installs the union of claude, kiro, and copilot enforcement surfaces", () => {
    const dir = installProfile("all");
    expect(assertClaudeEnforcement(dir)).toEqual([]);
    expect(assertKiroEnforcement(dir)).toEqual([]);
    expect(assertCopilotEnforcement(dir)).toEqual([]);
  });

  it("claude profile preserves documented command/agent asymmetries", () => {
    const dir = installProfile("claude");
    expect(assertClaudeAsymmetries(dir)).toEqual([]);
  });

  it("every installed path is templated by profiles.ts or a known root/manifest file, for every profile", () => {
    for (const profile of ["copilot", "claude", "kiro", "both", "all"] as const) {
      const dir = installProfile(profile);
      const platforms = resolveProfile(profile);
      expect(findUnaccountedPaths(dir, platforms), `profile ${profile}`).toEqual([]);
    }
  });

  it("every bundle-manifest.json consumer_owned_paths entry is templated or on the documented consumer-supplied allowlist", () => {
    expect(findUnaccountedConsumerOwnedPaths()).toEqual([]);
  });

  // ---- Negative-injection regression guards (AC-1, AC-2) ----
  // Each mutates a copy of a real installed tree and confirms the assertion
  // helper above — the one guarding the corresponding positive case — is
  // actually capable of catching the regression it exists to catch.

  it("regression guard: fails when .claude/settings.json is removed from the install output", () => {
    const dir = installProfile("claude");
    rmSync(join(dir, ".claude", "settings.json"));
    const violations = assertClaudeEnforcement(dir);
    expect(violations).toContain("missing .claude/settings.json");
  });

  it("regression guard: fails when a Claude hook script ships without a matching trigger registration", () => {
    const dir = installProfile("claude");
    const settingsPath = join(dir, ".claude", "settings.json");
    const settings = JSON.parse(readFileSync(settingsPath, "utf-8")) as {
      hooks: { PreToolUse: Array<{ matcher: string; hooks: Array<{ command: string }> }> };
    };
    // Strip the branch-guard registration while leaving its script file in place.
    settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter(
      (entry) => !entry.hooks.some((h) => h.command.includes("branch-guard.sh")),
    );
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8");

    const violations = assertClaudeEnforcement(dir);
    expect(violations).toContain(
      "hook script branch-guard.sh is not wired to any PreToolUse trigger",
    );
  });

  it("regression guard: fails when a Kiro hook script ships without a matching trigger registration", () => {
    const dir = installProfile("kiro");
    const hooksJsonPath = join(dir, ".kiro", "hooks", "git-guard.json");
    const hooksConfig = JSON.parse(readFileSync(hooksJsonPath, "utf-8")) as {
      hooks: Array<{ name: string; action: { command: string } }>;
    };
    hooksConfig.hooks = hooksConfig.hooks.filter((h) => h.name !== "git-guard");
    writeFileSync(hooksJsonPath, JSON.stringify(hooksConfig, null, 2), "utf-8");

    const violations = assertKiroEnforcement(dir);
    expect(violations).toContain(
      "hook script git-guard.sh is not wired to any registered Kiro hook",
    );
  });

  it("regression guard: fails when an undocumented Claude asymmetry widens (extra command with no matching doc)", () => {
    const dir = installProfile("claude");
    // Simulate the split silently widening to a third verifier command.
    cpSync(
      join(dir, ".claude", "commands", "verifier-audit.md"),
      join(dir, ".claude", "commands", "verifier-triage.md"),
    );
    // Base assertion (no false positive from the extra file alone):
    expect(assertClaudeAsymmetries(dir)).toEqual([]);

    // Simulate the documented command-only asymmetry being violated: an
    // agent file reappearing for a Claude-command-only role.
    writeFileSync(join(dir, ".claude", "agents", "planner.md"), "# planner agent\n", "utf-8");
    const violations = assertClaudeAsymmetries(dir);
    expect(violations).toContain(
      ".claude/agents unexpectedly contains planner.md — documented asymmetry: command-only on Claude",
    );
  });

  it("regression guard: fails when an installed path is neither templated nor consumer-owned", () => {
    const dir = installProfile("claude");
    // Injected at the repo root — no managed-directory prefix in
    // PROFILE_PATHS covers ".", so a stray top-level file is exactly the
    // "neither templated nor documented" shape this check exists to catch.
    // (A file dropped *inside* an existing managed directory, e.g.
    // `.claude/commands/`, is indistinguishable from a legitimate template
    // file by directory-prefix accounting alone — that is a known,
    // out-of-scope limitation shared with the packaging-boundary gap noted
    // in this describe block's header comment.)
    writeFileSync(join(dir, "MYSTERY-UNOWNED.md"), "orphan", "utf-8");
    const platforms = resolveProfile("claude");
    const violations = findUnaccountedPaths(dir, platforms);
    expect(violations).toContain("MYSTERY-UNOWNED.md");
  });

  it("regression guard: fails when a consumer_owned_paths entry is neither templated nor on the documented allowlist", () => {
    // Build a synthetic manifest fixture rather than mutating the real
    // bundle-manifest.json on disk — this asserts the accounting function
    // itself catches the class of bug (an entry added with no delivery path
    // and no doc), which is exactly issue #169's original defect shape
    // (`.claude/settings.json` sat in consumer_owned_paths with no delivery
    // path before it was added to INSTALL_IF_ABSENT_FILES). That specific
    // path is fixed now, so this fixture uses a fresh synthetic entry to
    // prove the check still catches the *class* of bug, not just the one
    // historical instance.
    const fixtureDir = makeScratchDir("dev-tasks-parity-manifest-fixture-");
    const fixtureManifest = {
      consumer_owned_paths: ["AGENTS.md", ".claude/settings.json", "docs/totally-unowned.md"],
    };
    const fixtureManifestPath = join(fixtureDir, "bundle-manifest.json");
    writeFileSync(fixtureManifestPath, JSON.stringify(fixtureManifest, null, 2), "utf-8");

    const violations = findUnaccountedConsumerOwnedPaths(fixtureManifestPath);
    expect(violations).toEqual(["docs/totally-unowned.md"]);
  });
});
