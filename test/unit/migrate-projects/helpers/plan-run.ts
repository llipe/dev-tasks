/**
 * Run `--plan` in process over a fake GitHub model and parse what it wrote.
 * Shared by the S-014 tests (`plan`, `answers`, `ac11-fixture`).
 */
import { runMigrationPlan, type PlanFileStore } from "#core/migrate-projects/index.js";
import {
  parseMigrationPlan,
  type MigrationPlan,
  type MigrationPlanBatch,
  type MigrationPlanWrite,
} from "#core/migrate-projects/planfile.js";
import type { FakeOptions, RepoModel } from "./fake-github.js";
import { modelReader, recordingRunner } from "./recording-runner.js";

export const PLAN_PATH = "workstream/migration-projects.md";
export const NOW = () => new Date("2026-10-24T12:00:00Z");

export function memoryStore(
  initial: Record<string, string> = {},
): PlanFileStore & { files: Record<string, string> } {
  const files = { ...initial };
  return {
    files,
    read: (p) => (Object.hasOwn(files, p) ? files[p] : undefined),
    write: (p, c) => {
      files[p] = c;
    },
  };
}

export interface PlanRun {
  exitCode: number;
  error?: string;
  text: string;
  plan: MigrationPlan;
  calls: string[][];
  /** The batch with `key`. */
  batch(key: string): MigrationPlanBatch;
  /** Every CLI write, in file order. */
  writes(): MigrationPlanWrite[];
}

/** `--plan` over `model`; `previous` is an existing plan file at the same path. */
export async function planModel(
  model: RepoModel,
  options: { previous?: string; fake?: FakeOptions } = {},
): Promise<PlanRun> {
  const rec = recordingRunner(model, options.fake);
  const store = memoryStore(
    options.previous === undefined ? {} : { [PLAN_PATH]: options.previous },
  );
  const result = await runMigrationPlan({
    runner: rec.runner,
    reader: modelReader(model),
    out: PLAN_PATH,
    now: NOW,
    store,
  });
  if (result.exitCode !== 0) {
    throw Object.assign(new Error(`--plan exited ${result.exitCode}: ${result.error}`), {
      result,
    });
  }
  const text = store.files[PLAN_PATH];
  const plan = parseMigrationPlan(text).plan;
  return {
    exitCode: result.exitCode,
    error: result.error,
    text,
    plan,
    calls: rec.calls,
    batch: (key) => plan.batches.find((b) => b.key === key)!,
    writes: () => plan.batches.flatMap((b) => b.writes),
  };
}

/** A row as `[action, target, detail]`, the shape the tests compare. */
export const triple = (w: MigrationPlanWrite): [string, string, string] => [
  w.action,
  w.target,
  w.detail,
];
