/**
 * Shared CLI argument parser for both binaries.
 * Handles --json, --meta-repo, -v/--verbose, and --version flags.
 */

export interface ParsedArgs {
  command: string | undefined;
  positional: string[];
  flags: {
    json: boolean;
    metaRepo: string | undefined;
    verbose: boolean;
    version: boolean;
    help: boolean;
    pin: string | undefined;
    force: boolean;
    dbUrl: string | undefined;
    strategy: string | undefined;
  };
}

export function parseArgs(argv: string[]): ParsedArgs {
  const flags = {
    json: false,
    metaRepo: undefined as string | undefined,
    verbose: false,
    version: false,
    help: false,
    pin: undefined as string | undefined,
    force: false,
    dbUrl: undefined as string | undefined,
    strategy: undefined as string | undefined,
  };

  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--json") {
      flags.json = true;
    } else if (arg === "--meta-repo") {
      flags.metaRepo = argv[++i];
    } else if (arg === "--pin") {
      flags.pin = argv[++i];
    } else if (arg === "--db-url") {
      flags.dbUrl = argv[++i];
    } else if (arg === "--strategy") {
      flags.strategy = argv[++i];
    } else if (arg === "--force" || arg === "-f") {
      flags.force = true;
    } else if (arg === "-v" || arg === "--verbose") {
      flags.verbose = true;
    } else if (arg === "--version") {
      flags.version = true;
    } else if (arg === "--help" || arg === "-h") {
      flags.help = true;
    } else if (arg.startsWith("-")) {
      // Unknown flag — treat as positional for now
      positional.push(arg);
    } else {
      positional.push(arg);
    }
  }

  const command = positional.length > 0 ? positional[0] : undefined;
  const rest = positional.slice(1);

  return { command, positional: rest, flags };
}
