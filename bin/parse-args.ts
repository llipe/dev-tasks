/**
 * Shared CLI argument parser for the dev-tasks binary.
 * Handles --json, --pin, --force, --profile, -v/--verbose, --version, and
 * the `migrate projects` flags (--plan, --apply, --repo, --out, --plan-file).
 *
 * Unknown flags are collected in `unknownFlags`, not treated as positional
 * arguments, and value flags given without a value in `missingValues`.
 * `validateGlobalArgs` refuses either for every command (InvalidUsage, 2),
 * so a typo never silently changes what a command does. A value that starts
 * with `-` is given with `=` (`--out=-x.md`).
 */

export interface ParsedArgs {
  command: string | undefined;
  positional: string[];
  flags: {
    json: boolean;
    verbose: boolean;
    version: boolean;
    help: boolean;
    pin: string | undefined;
    force: boolean;
    profile: string | undefined;
    plan: boolean;
    apply: boolean;
    repo: string | undefined;
    out: string | undefined;
    planFile: string | undefined;
  };
  /** Every recognised flag as typed in canonical long form (`--json`, `--out`, …), in order. */
  seenFlags: string[];
  /** Flags the parser does not know, as typed. */
  unknownFlags: string[];
  /** Value-taking flags given without a value. */
  missingValues: string[];
}

/** Flags that take a value, by canonical name. */
const VALUE_FLAGS = ["--pin", "--profile", "--repo", "--out", "--plan-file"] as const;

export function parseArgs(argv: string[]): ParsedArgs {
  const flags: ParsedArgs["flags"] = {
    json: false,
    verbose: false,
    version: false,
    help: false,
    pin: undefined,
    force: false,
    profile: undefined,
    plan: false,
    apply: false,
    repo: undefined,
    out: undefined,
    planFile: undefined,
  };

  const positional: string[] = [];
  const seenFlags: string[] = [];
  const unknownFlags: string[] = [];
  const missingValues: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    let arg = argv[i];

    // Handle --flag=value syntax: split into --flag and value
    let inlineValue: string | undefined;
    if (arg.startsWith("--") && arg.includes("=")) {
      const eqIdx = arg.indexOf("=");
      inlineValue = arg.slice(eqIdx + 1);
      arg = arg.slice(0, eqIdx);
    }

    if ((VALUE_FLAGS as readonly string[]).includes(arg)) {
      let value = inlineValue;
      if (value === undefined) {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith("-")) {
          value = next;
          i++;
        }
      }
      seenFlags.push(arg);
      if (value === undefined || value === "") {
        missingValues.push(arg);
        continue;
      }
      if (arg === "--pin") flags.pin = value;
      else if (arg === "--profile") flags.profile = value;
      else if (arg === "--repo") flags.repo = value;
      else if (arg === "--out") flags.out = value;
      else flags.planFile = value;
    } else if (arg === "--json") {
      flags.json = true;
      seenFlags.push("--json");
    } else if (arg === "--force" || arg === "-f") {
      flags.force = true;
      seenFlags.push("--force");
    } else if (arg === "-v" || arg === "--verbose") {
      flags.verbose = true;
      seenFlags.push("--verbose");
    } else if (arg === "--version") {
      flags.version = true;
      seenFlags.push("--version");
    } else if (arg === "--help" || arg === "-h") {
      flags.help = true;
      seenFlags.push("--help");
    } else if (arg === "--plan") {
      flags.plan = true;
      seenFlags.push("--plan");
    } else if (arg === "--apply") {
      flags.apply = true;
      seenFlags.push("--apply");
    } else if (argv[i].startsWith("-")) {
      unknownFlags.push(argv[i]);
    } else {
      positional.push(argv[i]);
    }
  }

  const command = positional.length > 0 ? positional[0] : undefined;
  const rest = positional.slice(1);

  return { command, positional: rest, flags, seenFlags, unknownFlags, missingValues };
}

/** Flags that belong to `migrate projects` only. */
const MIGRATE_PROJECTS_FLAGS = ["--plan", "--apply", "--repo", "--out", "--plan-file"];

/**
 * The checks every command shares: an unknown flag, a value flag with no
 * value, or a `migrate projects` flag without the `projects` sub-verb is an
 * error message for `InvalidUsage` (2); `null` when the arguments are clean.
 * `migrate projects` is left to `parseMigrateProjectsArgs`, which reports
 * the same errors with its own usage line.
 */
export function validateGlobalArgs(args: ParsedArgs): string | null {
  if (args.command === "migrate" && args.positional[0] === "projects") return null;
  if (args.unknownFlags.length > 0) return `unknown flag ${args.unknownFlags[0]}`;
  if (args.missingValues.length > 0) return `${args.missingValues[0]} needs a value`;
  const foreign = args.seenFlags.find((f) => MIGRATE_PROJECTS_FLAGS.includes(f));
  if (foreign !== undefined) {
    return args.command === "migrate"
      ? `${foreign} belongs to \`dev-tasks migrate projects\`; run \`dev-tasks migrate projects ${foreign === "--apply" ? "--apply" : "--plan"}\``
      : `${foreign} does not apply to ${args.command ?? "dev-tasks"}; it belongs to \`dev-tasks migrate projects\``;
  }
  return null;
}

export type MigrateProjectsArgs =
  | { ok: true; mode: "plan"; repo: string | undefined; out: string; json: boolean }
  | { ok: true; mode: "apply"; planFile: string; json: boolean }
  | { ok: false; error: string };

export const MIGRATE_PROJECTS_USAGE =
  "Usage: dev-tasks migrate projects --plan [--repo <owner/repo>] [--out <path>] [--json]";

const DEFAULT_PLAN_FILE = "workstream/migration-projects.md";
const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

/**
 * Validate `migrate projects` flags (A-63): exactly one of `--plan` and
 * `--apply`, no unknown or foreign flag, no stray argument, and every value
 * flag with its value. Any violation is `InvalidUsage` (2) for the caller.
 */
export function parseMigrateProjectsArgs(args: ParsedArgs): MigrateProjectsArgs {
  if (args.flags.plan === args.flags.apply) {
    return { ok: false, error: "give exactly one of --plan or --apply" };
  }
  if (args.unknownFlags.length > 0) {
    return { ok: false, error: `unknown flag ${args.unknownFlags[0]}` };
  }
  if (args.missingValues.length > 0) {
    return { ok: false, error: `${args.missingValues[0]} needs a value` };
  }
  if (args.positional.length > 1) {
    return { ok: false, error: `unexpected argument ${args.positional[1]}` };
  }
  const mode = args.flags.plan ? "plan" : "apply";
  const allowed =
    mode === "plan"
      ? ["--plan", "--repo", "--out", "--json", "--verbose"]
      : ["--apply", "--plan-file", "--json", "--verbose"];
  const foreign = args.seenFlags.find((f) => !allowed.includes(f));
  if (foreign !== undefined) {
    return { ok: false, error: `${foreign} does not apply to migrate projects --${mode}` };
  }
  if (mode === "apply") {
    return {
      ok: true,
      mode,
      planFile: args.flags.planFile ?? DEFAULT_PLAN_FILE,
      json: args.flags.json,
    };
  }
  if (args.flags.repo !== undefined && !REPO_PATTERN.test(args.flags.repo)) {
    return { ok: false, error: `--repo must read <owner>/<repo>, not ${args.flags.repo}` };
  }
  return {
    ok: true,
    mode,
    repo: args.flags.repo,
    out: args.flags.out ?? DEFAULT_PLAN_FILE,
    json: args.flags.json,
  };
}
