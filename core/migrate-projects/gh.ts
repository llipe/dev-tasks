/**
 * The one door between `migrate projects` and GitHub (D-90, spec §4).
 *
 * `snapshot.ts` (and later `apply.ts`) call `gh` only through a `GhRunner`,
 * so tests inject a fake and the real one is a thin wrapper over
 * `execFile("gh", args)`: an argument vector, never a shell string, so no
 * title or label value can be read as shell syntax (D-79).
 */
import { execFile, type ChildProcess } from "node:child_process";

export interface GhResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Runs `gh` with `args` and resolves with its output and exit code. A
 * non-zero exit resolves, it does not reject: the caller decides what a
 * failure means. It rejects only when `gh` could not be run at all
 * (`GhNotFoundError` when it is not on `PATH`).
 */
export type GhRunner = (args: readonly string[]) => Promise<GhResult>;

/** `gh` is not installed or not on `PATH` (spawn `ENOENT`). */
export class GhNotFoundError extends Error {
  constructor() {
    super("gh is not installed or not on PATH");
    this.name = "GhNotFoundError";
  }
}

/** Large enough for a paginated issue list of a big repository. */
const MAX_BUFFER = 512 * 1024 * 1024;

export interface GhRunnerOptions {
  /** Working directory for `gh` (its repository context). Defaults to the process cwd. */
  cwd?: string;
}

/** `gh` processes the real runner started that have not exited yet. */
const running = new Set<ChildProcess>();

/**
 * Kill every `gh` call still in flight (D-111). `--apply`'s signal handler
 * calls it before releasing the lock, so no write can land after the lock
 * is gone and its state is never recorded.
 */
export function killRunningGh(): number {
  const n = running.size;
  for (const child of running) child.kill("SIGKILL");
  running.clear();
  return n;
}

/** The real runner: `execFile("gh", args)`, no shell. */
export function createGhRunner(options: GhRunnerOptions = {}): GhRunner {
  return (args) =>
    new Promise((resolvePromise, reject) => {
      const child = execFile(
        "gh",
        [...args],
        { cwd: options.cwd, encoding: "utf-8", maxBuffer: MAX_BUFFER, windowsHide: true },
        (error, stdout, stderr) => {
          running.delete(child);
          if (error === null) {
            resolvePromise({ stdout, stderr, exitCode: 0 });
            return;
          }
          const code = (error as NodeJS.ErrnoException).code;
          if (code === "ENOENT") {
            reject(new GhNotFoundError());
            return;
          }
          if (typeof code === "number") {
            resolvePromise({ stdout, stderr, exitCode: code });
            return;
          }
          reject(error);
        },
      );
      running.add(child);
    });
}

/** The first non-empty line of `gh`'s stderr, for error messages and `failed(<reason>)`. */
export function firstLine(text: string): string {
  return (
    text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? ""
  );
}

/**
 * Parse `gh api --paginate` output: one or more JSON values printed back to
 * back. Current `gh` merges array pages into one array and prints object
 * pages one after another (`}{`); older versions print arrays as `][`.
 * Both are split here into the list of top-level values.
 */
export function parseJsonStream(text: string): unknown[] {
  const values: unknown[] = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      if (depth === 0) throw new SyntaxError(`unexpected string at offset ${i}`);
    } else if (ch === "[" || ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "]" || ch === "}") {
      depth--;
      if (depth < 0) throw new SyntaxError(`unbalanced JSON at offset ${i}`);
      if (depth === 0) values.push(JSON.parse(text.slice(start, i + 1)));
    } else if (depth === 0 && !/\s/.test(ch)) {
      throw new SyntaxError(`unexpected character at offset ${i}`);
    }
  }
  if (depth !== 0 || inString) throw new SyntaxError("truncated JSON");
  return values;
}

/** Flatten paginated list output into its items (array pages, merged or not). */
export function paginatedItems(text: string): unknown[] {
  return parseJsonStream(text).flatMap((page) => (Array.isArray(page) ? page : [page]));
}
