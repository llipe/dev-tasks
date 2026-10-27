/**
 * EC-140 (task 5.22, S5, S5b; §16a A-80): the plan file is written back
 * through a temporary file and a rename, so a crash between the write and
 * the rename leaves the old file intact, never a truncated one. `node:fs`
 * is wrapped so a test can make a write stop half-way and the rename fail,
 * the way a killed process or a full disk would.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const crash = vi.hoisted(() => ({ armed: false }));

vi.mock("node:fs", async (importOriginal) => {
  const fs = await importOriginal<typeof import("node:fs")>();
  const writeFileSync = (path: unknown, data: unknown, ...rest: unknown[]) => {
    if (crash.armed && typeof data === "string") {
      // Half the bytes reach the disk, then the process dies.
      (fs.writeFileSync as (...a: unknown[]) => void)(path, data.slice(0, data.length >> 1));
      throw new Error("killed during write (test)");
    }
    return (fs.writeFileSync as (...a: unknown[]) => void)(path, data, ...rest);
  };
  const renameSync = (from: unknown, to: unknown) => {
    if (crash.armed) throw new Error("killed before rename (test)");
    return (fs.renameSync as (...a: unknown[]) => void)(from, to);
  };
  return { ...fs, default: { ...fs, writeFileSync, renameSync }, writeFileSync, renameSync };
});

const { createPlanFileStore } = await import("#core/migrate-projects/index.js");
const { applyModel, approve } = await import("./helpers/apply-run.js");
const { planModel } = await import("./helpers/plan-run.js");
const { cloneModel, loadModel } = await import("./helpers/fake-github.js");
const { parseMigrationPlan } = await import("#core/migrate-projects/planfile.js");

let dir: string;
beforeEach(() => {
  crash.armed = false;
  dir = mkdtempSync(join(tmpdir(), "apply-writeback-"));
});
afterEach(() => {
  crash.armed = false;
  rmSync(dir, { recursive: true, force: true });
});

describe("atomic write-back (EC-140, S5, S5b)", () => {
  it("a normal write replaces the file and leaves no temp file", () => {
    const store = createPlanFileStore((p) => join(dir, p));
    writeFileSync(join(dir, "plan.md"), "old\n");
    store.write("plan.md", "new content\n");
    expect(readFileSync(join(dir, "plan.md"), "utf-8")).toBe("new content\n");
    expect(readdirSync(dir)).toEqual(["plan.md"]);
  });

  it("a crash during the write or before the rename leaves the old file intact, never truncated", () => {
    const store = createPlanFileStore((p) => join(dir, p));
    const old = "# Migration plan: acme/x\n" + "row\n".repeat(200);
    writeFileSync(join(dir, "plan.md"), old);
    crash.armed = true;
    expect(() =>
      store.write("plan.md", "# Migration plan: acme/x\n" + "new\n".repeat(200)),
    ).toThrow(/killed/);
    crash.armed = false;
    expect(readFileSync(join(dir, "plan.md"), "utf-8")).toBe(old);
    // The half-written temp file is removed too.
    expect(readdirSync(dir)).toEqual(["plan.md"]);
  });

  it("an --apply whose third write-back crashes leaves a parseable file with the first two states", async () => {
    const model = cloneModel(loadModel("ac11"));
    const approved = approve((await planModel(model)).text);
    writeFileSync(join(dir, "plan.md"), approved);
    const real = createPlanFileStore((p) => join(dir, p));
    let n = 0;
    const store = {
      read: real.read,
      write: (p: string, c: string) => {
        crash.armed = ++n === 3;
        try {
          real.write(p, c);
        } finally {
          crash.armed = false;
        }
      },
      files: {} as Record<string, string>,
    };
    const run = await applyModel(model, undefined, { store, path: "plan.md" });
    expect(run.result.exitCode).toBe(1);
    const onDisk = parseMigrationPlan(readFileSync(join(dir, "plan.md"), "utf-8")).plan;
    const states = onDisk.batches.flatMap((b) => b.writes).map((w) => w.state);
    expect(states.slice(0, 3)).toEqual(["done", "done", "pending"]);
  });
});
