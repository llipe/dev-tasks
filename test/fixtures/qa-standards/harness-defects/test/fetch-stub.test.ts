// Defect 4: stubs a global and never restores it. Passes today only because of
// per-worker isolation; fragile against any pool configuration change.
import { vi, it, expect } from "vitest";

it("reads the remote total", async () => {
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ total: 1 })));
  const res = await fetch("/total");
  expect(await res.json()).toEqual({ total: 1 });
  // missing: vi.unstubAllGlobals()
});
