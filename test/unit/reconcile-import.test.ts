import { describe, it, expect } from "vitest";

describe("core/reconcile — module independence", () => {
  it("can be imported directly from core/reconcile without distribution dependency", async () => {
    // Import from core/reconcile.ts directly (not via distribution barrel)
    const mod = await import("#core/reconcile.js");
    expect(mod.reconcile).toBeTypeOf("function");
  });

  it("can be imported from the core barrel export", async () => {
    const core = await import("#core/index.js");
    expect(core.reconcile).toBeTypeOf("function");
  });

  it("reconcile from core/reconcile.ts is the same function as from core/ barrel", async () => {
    const direct = await import("#core/reconcile.js");
    const barrel = await import("#core/index.js");
    expect(direct.reconcile).toBe(barrel.reconcile);
  });

  it("core/reconcile.ts does NOT import from core/distribution/", async () => {
    // Read the actual source to verify no distribution imports
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const source = readFileSync(resolve(import.meta.dirname, "../../core/reconcile.ts"), "utf-8");
    expect(source).not.toMatch(/from\s+["']\.\/distribution/);
    expect(source).not.toMatch(/from\s+["']#core\/distribution/);
  });
});
