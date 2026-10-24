/**
 * Run `--apply` in process over a fake GitHub model (S-015). Shared by the
 * `apply-*.test.ts` files.
 */
import {
  runMigrationApply,
  type MigrationApplyLock,
  type MigrationApplyRunResult,
  type PlanFileStore,
} from "#core/migrate-projects/index.js";
import { parseMigrationPlan, type MigrationPlan } from "#core/migrate-projects/planfile.js";
import type { RepoModel } from "./fake-github.js";
import { applyRunner, type ApplyRunner, type ApplyRunnerOptions } from "./fake-github-writes.js";
import { memoryStore, PLAN_PATH } from "./plan-run.js";
import { modelReader } from "./recording-runner.js";

/** The plan with its approval line set, the one human act `--apply` checks (D-80). */
export function approve(text: string): string {
  if (!/^Approved: no$/m.test(text)) throw new Error("approve: no `Approved: no` line");
  return text.replace(/^Approved: no$/m, "Approved: yes");
}

export interface MemoryLock extends MigrationApplyLock {
  held: boolean;
  acquired: number;
  released: number;
}

/** An in-memory lock; `heldByOther` makes every acquire fail, as a second process would. */
export function memoryLock(heldByOther = false): MemoryLock {
  const lock: MemoryLock = {
    held: false,
    acquired: 0,
    released: 0,
    acquire() {
      if (heldByOther || lock.held) return false;
      lock.held = true;
      lock.acquired++;
      return true;
    },
    release() {
      if (lock.held) lock.released++;
      lock.held = false;
    },
  };
  return lock;
}

export interface ApplyRun extends ApplyRunner {
  result: MigrationApplyRunResult;
  /** The plan file after the run (or as it was, when nothing was written back). */
  text: string;
  plan: MigrationPlan;
  store: PlanFileStore & { files: Record<string, string> };
  lock: MemoryLock;
  /** Row ID to State after the run. */
  states(): Record<string, string>;
}

export interface ApplyModelOptions {
  runner?: ApplyRunnerOptions;
  store?: PlanFileStore & { files: Record<string, string> };
  lock?: MemoryLock;
  path?: string;
  /** Observer for each write: its row ID and argv, before the call. */
  beforeWrite?: (id: string, argv: readonly string[]) => void;
}

/** `--apply` of `planText` over `model`; the plan file lives in a memory store. */
export async function applyModel(
  model: RepoModel,
  planText: string | undefined,
  options: ApplyModelOptions = {},
): Promise<ApplyRun> {
  const path = options.path ?? PLAN_PATH;
  const store = options.store ?? memoryStore(planText === undefined ? {} : { [path]: planText });
  if (options.store !== undefined && planText !== undefined) store.files[path] = planText;
  const lock = options.lock ?? memoryLock();
  const rec = applyRunner(model, options.runner);
  const result = await runMigrationApply({
    runner: rec.runner,
    reader: modelReader(model),
    planFile: path,
    store,
    lock,
    observer: options.beforeWrite === undefined ? undefined : { beforeWrite: options.beforeWrite },
  });
  const text = store.files[path] ?? "";
  let plan: MigrationPlan;
  try {
    plan = parseMigrationPlan(text).plan;
  } catch {
    plan = undefined as unknown as MigrationPlan;
  }
  return {
    ...rec,
    result,
    text,
    plan,
    store,
    lock,
    states: () =>
      Object.fromEntries(
        (plan?.batches ?? []).flatMap((b) => [
          ...b.writes.map((w) => [w.id, w.state]),
          ...b.steps.map((s) => [s.id, s.state]),
        ]),
      ),
  };
}
