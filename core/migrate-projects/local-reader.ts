/**
 * Reads from the working tree for `migrate projects` (spec §16a A-52).
 *
 * `docs/roadmap.md`, the PRD files and `workstream/planner-state-*.md` are
 * local files, not GitHub data: `workstream/` may be gitignored, so a
 * remote read would miss the state files. They go through this injectable
 * reader, never through the `GhRunner`, and the command never writes them.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

export interface LocalReader {
  /** The file's UTF-8 text, or `undefined` when it does not exist. Repository-relative path. */
  readText(path: string): string | undefined;
  /** Names of the regular files directly inside `dir` (not recursive), sorted; `[]` when absent. */
  listFiles(dir: string): string[];
}

export function createLocalReader(root: string): LocalReader {
  return {
    readText(path) {
      const full = resolve(root, path);
      if (!existsSync(full) || !statSync(full).isFile()) return undefined;
      return readFileSync(full, "utf-8");
    },
    listFiles(dir) {
      const full = resolve(root, dir);
      if (!existsSync(full) || !statSync(full).isDirectory()) return [];
      return readdirSync(full, { withFileTypes: true })
        .filter((d) => d.isFile())
        .map((d) => d.name)
        .sort();
    },
  };
}
