/**
 * Layer 1 tests for `bin/parse-args.ts` (S-013 task 3.16, qa-engineer gate
 * on PR #328). The parser reports unknown flags and value flags with no
 * value; `validateGlobalArgs` turns either into `InvalidUsage` (2) for every
 * command, and `parseMigrateProjectsArgs` validates `migrate projects`.
 */
import { describe, it, expect } from "vitest";
import { parseArgs, parseMigrateProjectsArgs, validateGlobalArgs } from "../../bin/parse-args.js";

describe("parseArgs", () => {
  it("reads the command, positionals and known flags", () => {
    const a = parseArgs(["install", "--profile", "claude", "--pin=1.2.3", "--json", "-v", "-f"]);
    expect(a.command).toBe("install");
    expect(a.positional).toEqual([]);
    expect(a.flags).toMatchObject({
      profile: "claude",
      pin: "1.2.3",
      json: true,
      verbose: true,
      force: true,
    });
    expect(a.unknownFlags).toEqual([]);
    expect(a.missingValues).toEqual([]);
  });

  it("collects unknown flags as typed, never as positional arguments", () => {
    const a = parseArgs(["--bogus", "install", "-x", "--forse=1"]);
    expect(a.command).toBe("install");
    expect(a.unknownFlags).toEqual(["--bogus", "-x", "--forse=1"]);
    expect(a.positional).toEqual([]);
  });

  it.each([
    [["install", "--profile"], "--profile"],
    [["install", "--profile", "--json"], "--profile"],
    [["install", "--profile", "-v"], "--profile"],
    [["update", "--pin", "--json"], "--pin"],
    [["install", "--profile="], "--profile"],
    [["migrate", "projects", "--plan", "--repo"], "--repo"],
    [["migrate", "projects", "--plan", "--out="], "--out"],
    [["migrate", "projects", "--apply", "--plan-file"], "--plan-file"],
  ])("%j: %s has no value", (argv, flag) => {
    const a = parseArgs(argv);
    expect(a.missingValues).toEqual([flag]);
  });

  it("a value starting with `-` is given with `=`", () => {
    expect(parseArgs(["migrate", "projects", "--plan", "--out=-x.md"]).flags.out).toBe("-x.md");
  });
});

describe("validateGlobalArgs (every command)", () => {
  it("passes clean arguments", () => {
    expect(validateGlobalArgs(parseArgs(["install", "--profile", "kiro"]))).toBeNull();
    expect(validateGlobalArgs(parseArgs(["migrate", "docs", "--force", "--json"]))).toBeNull();
    expect(validateGlobalArgs(parseArgs(["migrate", "--json"]))).toBeNull();
  });

  it.each([
    [["--bogus", "install"], /unknown flag --bogus/],
    [["migrate", "docs", "--forse"], /unknown flag --forse/],
    [["pin", "-x"], /unknown flag -x/],
    [["install", "--profile", "--json"], /--profile needs a value/],
    [["update", "--pin="], /--pin needs a value/],
  ])("%j is refused", (argv, message) => {
    expect(validateGlobalArgs(parseArgs(argv))).toMatch(message);
  });

  it.each([
    ["migrate", "--plan"],
    ["migrate", "--apply"],
    ["migrate", "--out", "x.md"],
    ["migrate", "docs", "--plan"],
  ])("%s %s without `projects` points to migrate projects", (...argv) => {
    expect(validateGlobalArgs(parseArgs(argv))).toMatch(/dev-tasks migrate projects/);
  });

  it("leaves `migrate projects` to its own validation", () => {
    expect(validateGlobalArgs(parseArgs(["migrate", "projects", "--plan", "--bogus"]))).toBeNull();
  });
});

describe("parseMigrateProjectsArgs", () => {
  const p = (...argv: string[]) => parseMigrateProjectsArgs(parseArgs(argv));
  it("plan mode with defaults", () => {
    expect(p("migrate", "projects", "--plan")).toEqual({
      ok: true,
      mode: "plan",
      repo: undefined,
      out: "workstream/migration-projects.md",
      json: false,
    });
  });
  it("apply mode with its default plan file", () => {
    expect(p("migrate", "projects", "--apply", "--json")).toEqual({
      ok: true,
      mode: "apply",
      planFile: "workstream/migration-projects.md",
      json: true,
    });
  });
  it.each([
    [["migrate", "projects"], /exactly one/],
    [["migrate", "projects", "--plan", "--apply"], /exactly one/],
    [["migrate", "projects", "--plan", "--bogus"], /unknown flag --bogus/],
    [["migrate", "projects", "--plan", "--out"], /--out needs a value/],
    [["migrate", "projects", "--plan", "extra"], /unexpected argument extra/],
    [["migrate", "projects", "--plan", "--force"], /--force does not apply/],
    [["migrate", "projects", "--plan", "--plan-file", "x"], /--plan-file does not apply/],
    [["migrate", "projects", "--apply", "--out", "x"], /--out does not apply/],
    [["migrate", "projects", "--plan", "--repo", "nope"], /owner>\/<repo/],
  ])("%j is refused", (argv, message) => {
    const r = parseMigrateProjectsArgs(parseArgs(argv));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(message);
  });
});
