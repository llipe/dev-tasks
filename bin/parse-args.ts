/**
 * Shared CLI argument parser for the dev-tasks binary.
 * Handles --json, --pin, --force, --profile, -v/--verbose, and --version flags.
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
  };
}

export function parseArgs(argv: string[]): ParsedArgs {
  const flags = {
    json: false,
    verbose: false,
    version: false,
    help: false,
    pin: undefined as string | undefined,
    force: false,
    profile: undefined as string | undefined,
  };

  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    let arg = argv[i];

    // Handle --flag=value syntax: split into --flag and value
    let inlineValue: string | undefined;
    if (arg.startsWith("--") && arg.includes("=")) {
      const eqIdx = arg.indexOf("=");
      inlineValue = arg.slice(eqIdx + 1);
      arg = arg.slice(0, eqIdx);
    }

    if (arg === "--json") {
      flags.json = true;
    } else if (arg === "--pin") {
      flags.pin = inlineValue ?? argv[++i];
    } else if (arg === "--profile") {
      flags.profile = inlineValue ?? argv[++i];
    } else if (arg === "--force" || arg === "-f") {
      flags.force = true;
    } else if (arg === "-v" || arg === "--verbose") {
      flags.verbose = true;
    } else if (arg === "--version") {
      flags.version = true;
    } else if (arg === "--help" || arg === "-h") {
      flags.help = true;
    } else if (argv[i].startsWith("-")) {
      // Unknown flag — treat as positional for now
      positional.push(argv[i]);
    } else {
      positional.push(argv[i]);
    }
  }

  const command = positional.length > 0 ? positional[0] : undefined;
  const rest = positional.slice(1);

  return { command, positional: rest, flags };
}
