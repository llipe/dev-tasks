/**
 * A `GhRunner` over the fake GitHub model that records every argv.
 *
 * It fails the test outright when called with a write (by the independent
 * oracle in `is-write.ts`), so `--plan` cannot slip a write through even
 * where no assertion looks at the log.
 */
import type { GhRunner } from "#core/migrate-projects/gh.js";
import type { LocalReader } from "#core/migrate-projects/local-reader.js";
import { isWrite } from "./is-write.js";
import { respond, type FakeOptions, type RepoModel } from "./fake-github.js";

export interface RecordingRunner {
  runner: GhRunner;
  calls: string[][];
}

export function recordingRunner(model: RepoModel, options: FakeOptions = {}): RecordingRunner {
  const calls: string[][] = [];
  const runner: GhRunner = async (args) => {
    calls.push([...args]);
    if (isWrite(args)) throw new Error(`write call during --plan: gh ${args.join(" ")}`);
    return respond(model, args, options);
  };
  return { runner, calls };
}

/** A `LocalReader` over the model's `files` map (repository-relative paths). */
export function modelReader(model: RepoModel): LocalReader & { reads: string[] } {
  const reads: string[] = [];
  return {
    reads,
    readText(path) {
      reads.push(path);
      return Object.hasOwn(model.files, path) ? model.files[path] : undefined;
    },
    listFiles(dir) {
      reads.push(`${dir}/`);
      const prefix = `${dir}/`;
      return Object.keys(model.files)
        .filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes("/"))
        .map((p) => p.slice(prefix.length))
        .sort();
    },
  };
}
